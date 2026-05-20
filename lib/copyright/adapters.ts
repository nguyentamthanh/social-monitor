import { BrandAsset, ConnectorStatus, Platform, RawCandidate } from '@/types'
import { computePHashFromUrl } from '@/lib/copyright/imageHash'
import { audioStreamingSearchQuery, buildAudioQuery } from '@/lib/copyright/audioMatcher'

interface CopyrightAdapter {
  platform: Platform
  status(): ConnectorStatus
  search(asset: BrandAsset): Promise<RawCandidate[]>
}

// Strip common YouTube/MV decorations so the search query is broad enough
// to surface re-uploads, covers, lyric videos, reactions, etc.
function trimDecorations(name: string): string {
  return name
    .replace(/\(([^)]*)\)/g, ' ')           // (Official MV), (Lyrics)
    .replace(/\[([^\]]*)\]/g, ' ')          // [OFFICIAL], [HD]
    .replace(/\|[^|]*$/g, ' ')              // strip trailing "| Official MV"
    .replace(/\b(official\s+mv|official\s+(music\s+)?video|lyrics?\s+video|audio\s+only|hd|4k|mv|m\/v)\b/gi, ' ')
    .replace(/\bft\.?\s+[^|\-–]+/gi, ' ')   // ft. Snoop Dogg
    .replace(/\bfeat\.?\s+[^|\-–]+/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function queryForAsset(asset: BrandAsset): string {
  if (asset.asset_type === 'audio') {
    return buildAudioQuery(asset)
  }
  const cleaned = trimDecorations(asset.name || '')
  const base = cleaned || asset.name || ''
  return [base, ...asset.keywords].filter(Boolean).join(' ').slice(0, 120)
}

// Multi-query expansion: generate variants to maximize re-upload coverage.
// Each YouTube search call costs ~100 quota units — keep total ≤ 6 queries.
function buildYoutubeQueries(asset: BrandAsset): string[] {
  if (asset.asset_type === 'audio') {
    return [buildAudioQuery(asset)]
  }
  const cleaned = trimDecorations(asset.name || '') || asset.name || ''
  const base = cleaned.trim()
  if (!base) return [queryForAsset(asset)]

  const queries = new Set<string>()
  queries.add(base)
  // Variants targeting common re-upload categories
  for (const suffix of ['cover', 'karaoke', 'remix', 'lyrics', 'live']) {
    queries.add(`${base} ${suffix}`)
  }
  // Add keywords-only query if user explicitly tracks keywords distinct from name
  const kw = asset.keywords.filter(k => k && !base.toLowerCase().includes(k.toLowerCase())).join(' ')
  if (kw) queries.add(kw)
  return Array.from(queries).slice(0, 6)
}

const youtubeAdapter: CopyrightAdapter = {
  platform: 'youtube',
  status() {
    const apiKey = process.env.YOUTUBE_API_KEY || ''
    if (!apiKey || apiKey === 'your_youtube_api_key_here') {
      return limited('youtube', 'config_missing', 'Chưa cấu hình YOUTUBE_API_KEY')
    }

    return ready('youtube', 'YouTube Data API đã sẵn sàng')
  },
  async search(asset) {
    const status = this.status()
    if (status.capability !== 'ready') return []

    const apiKey = process.env.YOUTUBE_API_KEY!
    const queries = buildYoutubeQueries(asset)
    const seenVideoIds = new Set<string>()
    const candidates: RawCandidate[] = []

    // Run query variants in parallel for speed
    const responses = await Promise.all(queries.map(async (q) => {
      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        maxResults: '15',
        q,
        key: apiKey
      })
      if (asset.asset_type === 'audio') params.set('videoCategoryId', '10')
      try {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
        if (!res.ok) return []
        const data = await res.json()
        return Array.isArray(data.items) ? data.items : []
      } catch {
        return []
      }
    }))

    const allItems = responses.flat()

    for (const item of allItems) {
      const videoId = item.id?.videoId
      if (videoId && seenVideoIds.has(videoId)) continue
      if (videoId) seenVideoIds.add(videoId)

      const thumbnailUrl = item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url
      let perceptualHash: string | undefined
      if (thumbnailUrl && ['image', 'logo', 'video'].includes(asset.asset_type) && asset.perceptual_hash) {
        const hash = await computePHashFromUrl(thumbnailUrl)
        if (hash) perceptualHash = hash
      }

      candidates.push({
        platform: 'youtube',
        source: 'youtube_data_api',
        externalId: videoId || item.etag || crypto.randomUUID(),
        title: item.snippet?.title || '',
        content: item.snippet?.description || item.snippet?.title || '',
        url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : 'https://www.youtube.com',
        author: {
          id: item.snippet?.channelId || 'unknown',
          name: item.snippet?.channelTitle || 'YouTube Channel',
          handle: item.snippet?.channelTitle || 'youtube',
          avatar: item.snippet?.thumbnails?.default?.url || ''
        },
        publishedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : null,
        metadata: {
          channelId: item.snippet?.channelId,
          channelTitle: item.snippet?.channelTitle,
          liveBroadcastContent: item.snippet?.liveBroadcastContent
        },
        media: {
          thumbnailUrl,
          perceptualHash
        }
      })
    }

    return candidates
  }
}

const googleAdapter: CopyrightAdapter = {
  platform: 'google',
  status() {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_API_KEY || ''
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID || ''

    if (!apiKey || !engineId) {
      return limited(
        'google',
        'config_missing',
        'Cần cấu hình GOOGLE_SEARCH_API_KEY và GOOGLE_SEARCH_ENGINE_ID'
      )
    }

    return ready('google', 'Google Programmable Search connector đã sẵn sàng')
  },
  async search(asset) {
    const status = this.status()
    if (status.capability !== 'ready') return []

    const apiKey = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_API_KEY!
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID!

    const baseParams: Record<string, string> = {
      key: apiKey,
      cx: engineId,
      num: '10'
    }

    // Tailor query and searchType for media assets
    if (['image', 'logo'].includes(asset.asset_type)) {
      baseParams.q = queryForAsset(asset)
      baseParams.searchType = 'image'
    } else if (asset.asset_type === 'audio') {
      baseParams.q = audioStreamingSearchQuery(asset)
    } else if (asset.asset_type === 'video') {
      baseParams.q = `${queryForAsset(asset)} video`
    } else {
      baseParams.q = queryForAsset(asset)
    }

    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${new URLSearchParams(baseParams)}`)
    if (!response.ok) {
      throw new Error(`Google Search API error: ${response.status}`)
    }

    const data = await response.json()
    const items = Array.isArray(data.items) ? data.items : []
    const candidates: RawCandidate[] = []

    for (const item of items) {
      const thumbnailUrl =
        item.image?.thumbnailLink ||
        item.pagemap?.cse_thumbnail?.[0]?.src ||
        item.pagemap?.cse_image?.[0]?.src
      const imageLink = item.link && baseParams.searchType === 'image' ? item.link : undefined
      let perceptualHash: string | undefined

      if (
        asset.perceptual_hash &&
        ['image', 'logo'].includes(asset.asset_type) &&
        (imageLink || thumbnailUrl)
      ) {
        const hash = await computePHashFromUrl(imageLink || thumbnailUrl!)
        if (hash) perceptualHash = hash
      }

      candidates.push({
        platform: 'google',
        source: baseParams.searchType === 'image' ? 'google_image_search' : 'google_programmable_search',
        externalId: item.cacheId || item.link || crypto.randomUUID(),
        title: item.title || '',
        content: item.snippet || '',
        url: item.image?.contextLink || item.link || '',
        author: {
          id: item.displayLink || 'web',
          name: item.displayLink || 'Web result',
          handle: item.displayLink || 'web'
        },
        publishedAt: null,
        metadata: {
          displayLink: item.displayLink,
          formattedUrl: item.formattedUrl,
          imageLink: imageLink || null,
          mime: item.mime
        },
        media: {
          thumbnailUrl,
          mimeType: item.mime,
          perceptualHash
        }
      })
    }

    return candidates
  }
}

const facebookAdapter: CopyrightAdapter = {
  platform: 'facebook',
  status() {
    return limited(
      'facebook',
      'access_required',
      'Meta public content search cần app review hoặc Content Library API'
    )
  },
  async search() {
    return []
  }
}

const tiktokAdapter: CopyrightAdapter = {
  platform: 'tiktok',
  status() {
    return limited(
      'tiktok',
      'access_required',
      'TikTok public video search cần Research API/VCE access'
    )
  },
  async search() {
    return []
  }
}

export const copyrightAdapters: Record<Platform, CopyrightAdapter> = {
  facebook: facebookAdapter,
  google: googleAdapter,
  youtube: youtubeAdapter,
  tiktok: tiktokAdapter
}

export function getConnectorStatuses(platforms: Platform[] = ['youtube', 'google', 'facebook', 'tiktok']): ConnectorStatus[] {
  return platforms.map(platform => copyrightAdapters[platform].status())
}

function ready(platform: Platform, message: string): ConnectorStatus {
  return {
    platform,
    capability: 'ready',
    code: 'ready',
    message
  }
}

function limited(platform: Platform, code: string, message: string): ConnectorStatus {
  return {
    platform,
    capability: 'limited',
    code,
    message
  }
}
