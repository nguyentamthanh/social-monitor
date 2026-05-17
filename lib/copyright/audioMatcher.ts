import { BrandAsset } from '@/types'

export interface AudioMetadata {
  title?: string
  artist?: string
  album?: string
}

export function parseAudioMetadata(asset: BrandAsset): AudioMetadata {
  // Stored either in audio_metadata JSONB or fallback to text_content JSON
  const fromColumn = (asset as any).audio_metadata
  if (fromColumn && typeof fromColumn === 'object') {
    return {
      title: fromColumn.title || asset.name,
      artist: fromColumn.artist,
      album: fromColumn.album
    }
  }

  if (asset.text_content) {
    try {
      const parsed = JSON.parse(asset.text_content)
      if (parsed && typeof parsed === 'object') {
        return {
          title: parsed.title || asset.name,
          artist: parsed.artist,
          album: parsed.album
        }
      }
    } catch {
      // text_content is plain text, treat as title
      return { title: asset.text_content || asset.name }
    }
  }

  return { title: asset.name }
}

export function normalizeAudioToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildAudioQuery(asset: BrandAsset): string {
  const meta = parseAudioMetadata(asset)
  const parts = [meta.title, meta.artist].filter(Boolean) as string[]
  return parts.join(' ')
}

export interface AudioMatchScore {
  titleMatch: boolean
  artistMatch: boolean
  hostHint: 'youtube' | 'soundcloud' | 'spotify' | 'apple' | 'other'
}

const STREAMING_HOSTS = ['soundcloud.com', 'spotify.com', 'music.apple.com', 'music.youtube.com', 'youtube.com']

export function detectAudioCandidate(asset: BrandAsset, candidateText: string, candidateUrl: string): AudioMatchScore {
  const meta = parseAudioMetadata(asset)
  const normalizedText = normalizeAudioToken(candidateText)
  const normalizedTitle = meta.title ? normalizeAudioToken(meta.title) : ''
  const normalizedArtist = meta.artist ? normalizeAudioToken(meta.artist) : ''
  let hostHint: AudioMatchScore['hostHint'] = 'other'

  try {
    const host = new URL(candidateUrl).hostname.toLowerCase()
    if (host.includes('soundcloud')) hostHint = 'soundcloud'
    else if (host.includes('spotify')) hostHint = 'spotify'
    else if (host.includes('apple')) hostHint = 'apple'
    else if (host.includes('youtube')) hostHint = 'youtube'
  } catch {
    /* noop */
  }

  return {
    titleMatch: normalizedTitle.length > 2 && normalizedText.includes(normalizedTitle),
    artistMatch: normalizedArtist.length > 2 && normalizedText.includes(normalizedArtist),
    hostHint
  }
}

export function audioStreamingSearchQuery(asset: BrandAsset): string {
  const meta = parseAudioMetadata(asset)
  const base = [meta.title, meta.artist].filter(Boolean).join(' ')
  return `${base} ${STREAMING_HOSTS.map(host => `site:${host}`).join(' OR ')}`
}
