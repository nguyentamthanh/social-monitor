import { fetchYouTubeVideoById } from '@/lib/copyright/youtubeVideoLookup'
import { computePHashFromUrl, hammingDistance } from '@/lib/copyright/imageHash'
import { fetchTranscript } from '@/lib/copyright/transcriptFetcher'
import { normalizeText } from '@/lib/copyright/scoring'
import { MediaDeepCheckResult, checkYouTubeMediaSimilarity } from '@/lib/copyright/mediaDeepCheck'

export interface CopyCandidate {
  videoId: string
  title: string
  channelId: string
  channelTitle: string
  thumbnailUrl?: string
  url: string
  publishedAt: string | null
  riskScore: number
  reasons: Array<{ code: string; label: string; points: number }>
  mediaCheck?: MediaDeepCheckResult
}

export interface FindCopiesResult {
  original: {
    videoId: string
    title: string
    channelId: string
    channelTitle: string
    thumbnailUrl?: string
    url: string
    publishedAt: string | null
  }
  candidates: CopyCandidate[]
  searched: number
  transcriptChecked: number
  mediaChecked: number
  mediaCheckEnabled: boolean
  mediaCheckStatus?: string
  query: string
}

const MIN_REPORT_SCORE = 30
const MAX_CANDIDATES = 50
const TRANSCRIPT_TOP_N = 5
const MEDIA_DEEP_CHECK_TOP_N = 3
const REASON_LABELS: Record<string, string> = {
  title_match: 'Trùng tên video',
  tag_overlap: 'Trùng tags',
  description_match: 'Trùng description',
  thumbnail_match: 'Thumbnail tương đồng',
  transcript_match: 'Transcript trùng nội dung',
  audio_fingerprint_match: 'Âm thanh fingerprint tương đồng',
  video_frame_match: 'Frame video tương đồng',
  same_channel: 'Cùng channel (loại trừ)',
  newer_than_original: 'Đăng sau video gốc',
  older_than_original: 'Đăng trước video gốc (có thể video gốc copy lại)'
}

// Helper cho unit test (tránh phải mock fetch/youtube).
export function buildFindCopiesInternalsForTest(options: { thumbnailMatch?: boolean }) {
  return { wantPHash: options.thumbnailMatch !== false }
}

export async function findCopies(
  videoId: string,
  options: { deepMediaCheck?: boolean; mediaCheckTopN?: number; thumbnailMatch?: boolean } = {}
): Promise<FindCopiesResult> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey || apiKey === 'your_youtube_api_key_here') {
    throw new Error('config_missing: YOUTUBE_API_KEY chưa cấu hình')
  }

  const wantPHash = options.thumbnailMatch !== false
  const original = await fetchYouTubeVideoById(videoId, { computeThumbnailHash: wantPHash })

  const originalThumbHash = original.candidate.media?.perceptualHash
  const originalTitleNorm = normalizeText(original.candidate.title)
  const originalDescNorm = normalizeText(original.candidate.content)
  const originalTags = ((original.candidate.metadata?.tags as string[]) || []).map(normalizeText).filter(Boolean)
  const originalChannelId = original.candidate.author?.id || ''
  const originalPublishedAt = original.candidate.publishedAt ? new Date(original.candidate.publishedAt) : null

  const query = buildSearchQuery(original.candidate.title, originalTags)

  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: String(MAX_CANDIDATES),
    q: query,
    key: apiKey
  })

  const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`)
  if (!searchRes.ok) {
    throw new Error(`youtube_search_failed: ${searchRes.status}`)
  }
  const searchJson = await searchRes.json()
  const items: any[] = Array.isArray(searchJson.items) ? searchJson.items : []

  const rawCandidates = items
    .filter(item => item.id?.videoId && item.id.videoId !== videoId)
    .map(item => ({
      videoId: item.id.videoId as string,
      title: (item.snippet?.title || '') as string,
      description: (item.snippet?.description || '') as string,
      channelId: (item.snippet?.channelId || '') as string,
      channelTitle: (item.snippet?.channelTitle || '') as string,
      thumbnailUrl: (item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.default?.url ||
        undefined) as string | undefined,
      publishedAt: (item.snippet?.publishedAt || null) as string | null
    }))

  let transcriptChecked = 0

  const preScored = await Promise.all(
    rawCandidates.map(async (cand) => {
      const reasons: Array<{ code: string; label: string; points: number }> = []
      const titleNorm = normalizeText(cand.title)
      const descNorm = normalizeText(cand.description)

      const titleSim = jaccardSimilarity(originalTitleNorm, titleNorm)
      if (titleSim >= 0.3) {
        reasons.push({ code: 'title_match', label: REASON_LABELS.title_match, points: Math.round(35 * titleSim) })
      }

      if (originalTags.length > 0) {
        const candTokens = new Set([...titleNorm.split(' '), ...descNorm.split(' ')].filter(Boolean))
        const tagHits = originalTags.filter(tag => tagInCandidate(tag, candTokens, titleNorm + ' ' + descNorm))
        if (tagHits.length > 0) {
          reasons.push({
            code: 'tag_overlap',
            label: REASON_LABELS.tag_overlap,
            points: Math.min(25, 5 + tagHits.length * 4)
          })
        }
      }

      if (originalDescNorm && descNorm) {
        const descSim = jaccardSimilarity(originalDescNorm, descNorm)
        if (descSim >= 0.4) {
          reasons.push({ code: 'description_match', label: REASON_LABELS.description_match, points: Math.round(15 * descSim) })
        }
      }

      let thumbHash: string | null = null
      if (options.thumbnailMatch !== false && originalThumbHash && cand.thumbnailUrl) {
        thumbHash = await computePHashFromUrl(cand.thumbnailUrl)
        if (thumbHash) {
          const distance = hammingDistance(originalThumbHash, thumbHash)
          if (distance <= 14) {
            reasons.push({
              code: 'thumbnail_match',
              label: REASON_LABELS.thumbnail_match,
              points: Math.max(10, Math.round(25 * (1 - distance / 18)))
            })
          }
        }
      }

      if (cand.channelId && originalChannelId && cand.channelId === originalChannelId) {
        reasons.push({ code: 'same_channel', label: REASON_LABELS.same_channel, points: -50 })
      }

      const candPublishedAt = cand.publishedAt ? new Date(cand.publishedAt) : null
      if (originalPublishedAt && candPublishedAt) {
        if (candPublishedAt > originalPublishedAt) {
          reasons.push({ code: 'newer_than_original', label: REASON_LABELS.newer_than_original, points: 5 })
        } else if (candPublishedAt < originalPublishedAt) {
          reasons.push({ code: 'older_than_original', label: REASON_LABELS.older_than_original, points: -10 })
        }
      }

      const preliminary = reasons.reduce((sum, r) => sum + r.points, 0)
      return { cand, reasons, preliminary }
    })
  )

  const sortedPre = [...preScored].sort((a, b) => b.preliminary - a.preliminary)
  const transcriptTargets = new Set(sortedPre.slice(0, TRANSCRIPT_TOP_N).map(s => s.cand.videoId))

  let originalTranscript = ''
  if (transcriptTargets.size > 0) {
    originalTranscript = await fetchTranscript(videoId)
  }
  const originalTranscriptNorm = normalizeText(originalTranscript)

  if (originalTranscriptNorm) {
    for (const entry of sortedPre) {
      if (!transcriptTargets.has(entry.cand.videoId)) continue
      const candTranscript = await fetchTranscript(entry.cand.videoId)
      transcriptChecked += 1
      const candTranscriptNorm = normalizeText(candTranscript)
      if (!candTranscriptNorm) continue
      const sim = jaccardSimilarity(originalTranscriptNorm, candTranscriptNorm, 3)
      if (sim >= 0.25) {
        entry.reasons.push({
          code: 'transcript_match',
          label: REASON_LABELS.transcript_match,
          points: Math.round(30 * sim)
        })
      }
    }
  }

  const mediaCheckTargets = new Set(
    options.deepMediaCheck
      ? [...preScored]
          .sort((a, b) => b.reasons.reduce((sum, r) => sum + r.points, 0) - a.reasons.reduce((sum, r) => sum + r.points, 0))
          .slice(0, options.mediaCheckTopN ?? MEDIA_DEEP_CHECK_TOP_N)
          .map(entry => entry.cand.videoId)
      : []
  )
  const mediaChecks = new Map<string, MediaDeepCheckResult>()
  let mediaChecked = 0
  let mediaCheckStatus: string | undefined

  if (options.deepMediaCheck && mediaCheckTargets.size > 0) {
    for (const entry of preScored) {
      if (!mediaCheckTargets.has(entry.cand.videoId)) continue

      const mediaCheck = await checkYouTubeMediaSimilarity(videoId, entry.cand.videoId)
      mediaChecks.set(entry.cand.videoId, mediaCheck)

      if (!mediaCheck.available) {
        mediaCheckStatus = mediaCheck.skippedReason || 'Không thể chạy deep media check.'
        continue
      }

      mediaChecked += 1
      if (mediaCheck.audio?.matched) {
        entry.reasons.push({
          code: 'audio_fingerprint_match',
          label: REASON_LABELS.audio_fingerprint_match,
          points: Math.round(45 * mediaCheck.audio.similarity)
        })
      }
      if (mediaCheck.video?.matched) {
        entry.reasons.push({
          code: 'video_frame_match',
          label: REASON_LABELS.video_frame_match,
          points: Math.round(35 * mediaCheck.video.bestFrameSimilarity)
        })
      }
    }
  }

  const candidates: CopyCandidate[] = preScored
    .map(({ cand, reasons }) => {
      const score = Math.max(0, Math.min(100, reasons.reduce((sum, r) => sum + r.points, 0)))
      return {
        videoId: cand.videoId,
        title: cand.title,
        channelId: cand.channelId,
        channelTitle: cand.channelTitle,
        thumbnailUrl: cand.thumbnailUrl,
        url: `https://www.youtube.com/watch?v=${cand.videoId}`,
        publishedAt: cand.publishedAt,
        riskScore: score,
        reasons,
        mediaCheck: mediaChecks.get(cand.videoId)
      }
    })
    .filter(c => c.riskScore >= MIN_REPORT_SCORE)
    .sort((a, b) => b.riskScore - a.riskScore)

  return {
    original: {
      videoId,
      title: original.candidate.title,
      channelId: originalChannelId,
      channelTitle: original.candidate.author?.name || '',
      thumbnailUrl: original.candidate.media?.thumbnailUrl,
      url: original.candidate.url,
      publishedAt: originalPublishedAt ? originalPublishedAt.toISOString() : null
    },
    candidates,
    searched: rawCandidates.length,
    transcriptChecked,
    mediaChecked,
    mediaCheckEnabled: !!options.deepMediaCheck,
    mediaCheckStatus,
    query
  }
}

function buildSearchQuery(title: string, tags: string[]): string {
  const titleTokens = normalizeText(title)
    .split(' ')
    .filter(tok => tok.length >= 3)
    .slice(0, 6)
  const tagTokens = tags.slice(0, 3).map(t => t.split(' ').slice(0, 2).join(' '))
  const combined = [...titleTokens, ...tagTokens].filter(Boolean)
  return Array.from(new Set(combined)).join(' ').slice(0, 120) || title.slice(0, 80)
}

function tagInCandidate(tag: string, candTokens: Set<string>, candText: string): boolean {
  if (!tag) return false
  if (tag.includes(' ')) {
    return candText.includes(tag)
  }
  return candTokens.has(tag)
}

function jaccardSimilarity(a: string, b: string, ngram = 2): number {
  if (!a || !b) return 0
  const aSet = buildNgramSet(a, ngram)
  const bSet = buildNgramSet(b, ngram)
  if (aSet.size === 0 || bSet.size === 0) return 0
  let intersection = 0
  for (const item of aSet) if (bSet.has(item)) intersection += 1
  return intersection / Math.max(aSet.size, bSet.size)
}

function buildNgramSet(text: string, n: number): Set<string> {
  const tokens = text.split(' ').filter(Boolean)
  if (tokens.length < n) return new Set(tokens)
  const set = new Set<string>()
  for (let i = 0; i <= tokens.length - n; i++) {
    set.add(tokens.slice(i, i + n).join(' '))
  }
  return set
}
