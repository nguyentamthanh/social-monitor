import { RawCandidate } from '@/types'
import { computePHashFromUrl } from '@/lib/copyright/imageHash'

export interface YouTubeLookupResult {
  candidate: RawCandidate
  raw: {
    videoId: string
    duration?: string
    viewCount?: string
    likeCount?: string
  }
}

export class YouTubeLookupError extends Error {
  constructor(public code: 'config_missing' | 'not_found' | 'api_error', message: string) {
    super(message)
    this.name = 'YouTubeLookupError'
  }
}

export async function fetchYouTubeVideoById(
  videoId: string,
  options: { computeThumbnailHash?: boolean } = {}
): Promise<YouTubeLookupResult> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey || apiKey === 'your_youtube_api_key_here') {
    throw new YouTubeLookupError('config_missing', 'Chưa cấu hình YOUTUBE_API_KEY')
  }

  const params = new URLSearchParams({
    part: 'snippet,contentDetails,statistics',
    id: videoId,
    key: apiKey
  })

  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
  if (!response.ok) {
    throw new YouTubeLookupError('api_error', `YouTube API error: ${response.status}`)
  }

  const data = await response.json()
  const item = Array.isArray(data.items) ? data.items[0] : null
  if (!item) {
    throw new YouTubeLookupError('not_found', 'Video không tồn tại hoặc đã bị gỡ')
  }

  const snippet = item.snippet || {}
  const contentDetails = item.contentDetails || {}
  const statistics = item.statistics || {}

  const thumbnailUrl =
    snippet.thumbnails?.maxres?.url ||
    snippet.thumbnails?.high?.url ||
    snippet.thumbnails?.medium?.url ||
    snippet.thumbnails?.default?.url

  let perceptualHash: string | undefined
  if (options.computeThumbnailHash && thumbnailUrl) {
    const hash = await computePHashFromUrl(thumbnailUrl)
    if (hash) perceptualHash = hash
  }

  const candidate: RawCandidate = {
    platform: 'youtube',
    source: 'youtube_data_api',
    externalId: videoId,
    title: snippet.title || '',
    content: snippet.description || snippet.title || '',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    author: {
      id: snippet.channelId || 'unknown',
      name: snippet.channelTitle || 'YouTube Channel',
      handle: snippet.channelTitle || 'youtube',
      avatar: snippet.thumbnails?.default?.url || ''
    },
    publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt) : null,
    metadata: {
      channelId: snippet.channelId,
      channelTitle: snippet.channelTitle,
      duration: contentDetails.duration,
      tags: snippet.tags,
      categoryId: snippet.categoryId,
      viewCount: statistics.viewCount,
      likeCount: statistics.likeCount,
      commentCount: statistics.commentCount
    },
    media: {
      thumbnailUrl,
      perceptualHash
    }
  }

  return {
    candidate,
    raw: {
      videoId,
      duration: contentDetails.duration,
      viewCount: statistics.viewCount,
      likeCount: statistics.likeCount
    }
  }
}
