import { fetchYouTubeVideoById } from '@/lib/copyright/youtubeVideoLookup'
import { computePHashFromUrl, hammingDistance } from '@/lib/copyright/imageHash'
import { fetchTranscript } from '@/lib/copyright/transcriptFetcher'
import { normalizeText } from '@/lib/copyright/scoring'
import { MediaDeepCheckResult, checkYouTubeMediaSimilarity } from '@/lib/copyright/mediaDeepCheck'
import { mapWithConcurrency } from '@/lib/util/pool'
import { capRiskScore, reasonLabel } from '@/lib/copyright/reasons'
import { extractDistinctivePhrase, buildTranscriptSearchQuery } from '@/lib/copyright/transcriptQuery'
import { fetchStoryboardHashes, compareFrameHashes } from '@/lib/copyright/storyboard'

export interface CopyCandidate {
  videoId: string
  title: string
  channelId: string
  channelTitle: string
  thumbnailUrl?: string
  url: string
  publishedAt: string | null
  riskScore: number
  /** True khi chưa có bằng chứng media hạng `strong` (chưa fingerprint/frame). */
  needsVerification?: boolean
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
  /** Số ứng viên đã được so khung hình qua storyboard. */
  frameChecked: number
  mediaChecked: number
  mediaCheckEnabled: boolean
  mediaCheckStatus?: string
  query: string
  /** Truy vấn theo câu trong transcript, chỉ có khi vòng 2 thực sự chạy. */
  transcriptQuery?: string
  /** Quota YouTube đã tiêu thật cho lần chạy này (101 hoặc 201). */
  quotaUnits: number
}

/**
 * Quota YouTube tiêu cho một lần findCopies: 1 `videos.list` lấy video gốc (1 unit)
 * + 1 `search.list` tìm ứng viên (100 unit).
 */
export const FIND_COPIES_QUOTA_UNITS = 101

/**
 * Đặt TRÊN trần hạng `weak` (35) để ứng viên chỉ trùng tiêu đề/tag không lọt
 * vào báo cáo. Trước đây ngưỡng 30 nằm dưới trần weak nên mọi trùng tên đều
 * qua — một lần quét Despacito trả về 45 kết quả mà gần như toàn bộ là nhiễu.
 * Muốn được báo cáo thì phải có ít nhất bằng chứng hạng `medium`
 * (transcript / thumbnail / mô tả) hoặc `strong` (khung hình).
 */
const MIN_REPORT_SCORE = 40
const MAX_CANDIDATES = 50
/** Mỗi ứng viên vừa tải thumbnail vừa tính DCT — mở cả 50 cùng lúc là cách
 *  nhanh nhất để vượt giới hạn 60s của Vercel. */
const THUMBNAIL_HASH_CONCURRENCY = 6
const TRANSCRIPT_TOP_N = 5
const MEDIA_DEEP_CHECK_TOP_N = 3
/** Giá một lần `search.list`. */
export const YOUTUBE_SEARCH_UNITS = 100
/**
 * Ở chế độ `auto`, chỉ chi thêm 100 unit cho truy vấn theo transcript khi
 * truy vấn theo tiêu đề không moi ra được ứng viên nào đạt mức này. Đúng
 * bằng ngưỡng "rủi ro trung bình" — tức là "chưa tìm được gì đáng tin".
 */
const TRANSCRIPT_DISCOVERY_TRIGGER = 45
/** Số ứng viên được so khung hình. Mỗi lượt ~350ms nên 8 vẫn thoải mái trong 60s. */
const FRAME_MATCH_TOP_N = 8
const FRAME_CHECK_CONCURRENCY = 3
/**
 * Tỉ lệ frame gốc tìm được cặp khớp. Đo thực nghiệm: video không liên quan
 * cho 0%, còn chính nó cho 100% — nên 10% đã là tín hiệu rất mạnh.
 */
const FRAME_COVERAGE_THRESHOLD = 0.1

interface RawSearchCandidate {
  videoId: string
  title: string
  description: string
  channelId: string
  channelTitle: string
  thumbnailUrl?: string
  publishedAt: string | null
}

/** Một lần `search.list` → danh sách ứng viên đã loại chính video gốc. */
async function searchYouTube(
  query: string,
  apiKey: string,
  excludeVideoId: string
): Promise<RawSearchCandidate[]> {
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

  return items
    .filter(item => item.id?.videoId && item.id.videoId !== excludeVideoId)
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
}
/**
 * Nhãn lấy từ registry dùng chung (`reasons.ts`) thay vì bảng riêng — trước
 * đây file này và `scoring.ts` giữ hai từ điển độc lập nên cùng một khái niệm
 * hiện ra với chữ khác nhau tuỳ màn hình.
 */
const REASON_LABELS = new Proxy({} as Record<string, string>, {
  get: (_target, code: string) => reasonLabel(code)
})

// Helper cho unit test (tránh phải mock fetch/youtube).
export function buildFindCopiesInternalsForTest(options: { thumbnailMatch?: boolean }) {
  return { wantPHash: options.thumbnailMatch !== false }
}

export async function findCopies(
  videoId: string,
  options: {
    deepMediaCheck?: boolean
    mediaCheckTopN?: number
    thumbnailMatch?: boolean
    apiKey?: string
    /**
     * Tìm ứng viên theo câu nói trong transcript — bắt được video đổi hẳn tiêu
     * đề nhưng giữ nguyên audio. `auto` (mặc định) chỉ chi thêm quota khi truy
     * vấn theo tiêu đề trắng tay.
     */
    transcriptDiscovery?: 'auto' | 'always' | 'off'
    /**
     * So khung hình qua storyboard YouTube (mặc định bật). Đây là bằng chứng
     * media hạng `strong` duy nhất chạy được không cần worker.
     */
    frameMatch?: boolean
    frameMatchTopN?: number
  } = {}
): Promise<FindCopiesResult> {
  const apiKey = options.apiKey
  if (!apiKey) {
    throw new Error('config_missing: YouTube Data API Key chưa cấu hình')
  }

  const wantPHash = options.thumbnailMatch !== false
  const original = await fetchYouTubeVideoById(videoId, { computeThumbnailHash: wantPHash, apiKey })

  const originalThumbHash = original.candidate.media?.perceptualHash
  const originalTitleNorm = normalizeText(original.candidate.title)
  const originalDescNorm = normalizeText(original.candidate.content)
  const originalTags = ((original.candidate.metadata?.tags as string[]) || []).map(normalizeText).filter(Boolean)
  const originalChannelId = original.candidate.author?.id || ''
  const originalPublishedAt = original.candidate.publishedAt ? new Date(original.candidate.publishedAt) : null

  const query = buildSearchQuery(original.candidate.title, originalTags)
  const rawCandidates = await searchYouTube(query, apiKey, videoId)

  let transcriptChecked = 0
  let quotaUnits = FIND_COPIES_QUOTA_UNITS

  const scoreOne = async (cand: RawSearchCandidate) => {
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
  }

  const preScored = await mapWithConcurrency(rawCandidates, THUMBNAIL_HASH_CONCURRENCY, scoreOne)

  // Transcript video gốc lấy MỘT lần rồi dùng cho cả hai việc: tìm kiếm theo
  // nội dung (bên dưới) và đối chiếu transcript (phía sau). Bước này scrape
  // trang watch, không tốn quota.
  const originalTranscript = await fetchTranscript(videoId)
  const originalTranscriptNorm = normalizeText(originalTranscript)

  // --- Tìm kiếm vòng 2: theo nội dung nói, không theo tiêu đề ---
  // Chỉ chi thêm 100 unit khi vòng 1 KHÔNG tìm ra gì đáng tin. Nếu tiêu đề đã
  // lôi ra được ứng viên điểm cao thì tiêu thêm quota là lãng phí; còn khi
  // vòng 1 trắng tay thì đó đúng là lúc kẻ reup đã đổi tiêu đề — và là lúc
  // truy vấn theo transcript đáng giá nhất.
  const bestPreliminary = preScored.reduce((max, e) => Math.max(max, e.preliminary), 0)
  const discoveryMode = options.transcriptDiscovery ?? 'auto'
  const wantDiscovery =
    discoveryMode === 'always' ||
    (discoveryMode === 'auto' && bestPreliminary < TRANSCRIPT_DISCOVERY_TRIGGER)

  let transcriptQueryUsed: string | undefined

  if (wantDiscovery && originalTranscriptNorm) {
    const phrase = extractDistinctivePhrase(originalTranscript, original.candidate.title)
    if (phrase) {
      const seen = new Set([videoId, ...rawCandidates.map(c => c.videoId)])
      transcriptQueryUsed = buildTranscriptSearchQuery(phrase.phrase)
      const extra = (await searchYouTube(transcriptQueryUsed, apiKey, videoId)).filter(c => !seen.has(c.videoId))
      quotaUnits += YOUTUBE_SEARCH_UNITS

      if (extra.length > 0) {
        const extraScored = await mapWithConcurrency(extra, THUMBNAIL_HASH_CONCURRENCY, scoreOne)
        preScored.push(...extraScored)
      }
    }
  }

  const sortedPre = [...preScored].sort((a, b) => b.preliminary - a.preliminary)
  const transcriptTargets = new Set(sortedPre.slice(0, TRANSCRIPT_TOP_N).map(s => s.cand.videoId))

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

  // --- So khớp khung hình bằng storyboard ---
  // Chạy được ngay trên Vercel: storyboard là ảnh tĩnh trên CDN, không cần
  // yt-dlp/ffmpeg và không tốn quota API. Đây là bằng chứng hạng `strong`
  // duy nhất khả dụng khi chưa có worker, và là cách duy nhất bắt được kẻ
  // chỉ lấy hình ảnh (đổi tiêu đề, đổi thumbnail, tắt tiếng).
  let frameChecked = 0
  if (options.frameMatch !== false) {
    const frameTargets = sortedPre.slice(0, options.frameMatchTopN ?? FRAME_MATCH_TOP_N)
    if (frameTargets.length > 0) {
      const originalFrames = await fetchStoryboardHashes(videoId)

      if (originalFrames.length > 0) {
        await mapWithConcurrency(frameTargets, FRAME_CHECK_CONCURRENCY, async entry => {
          const candFrames = await fetchStoryboardHashes(entry.cand.videoId)
          if (candFrames.length === 0) return
          frameChecked += 1

          const match = compareFrameHashes(originalFrames, candFrames)
          if (match.coverage >= FRAME_COVERAGE_THRESHOLD) {
            entry.reasons.push({
              code: 'video_frame_match',
              label: REASON_LABELS.video_frame_match,
              points: Math.round(35 * Math.min(1, match.coverage / 0.5))
            })
          }
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
      // Chặn trần theo hạng bằng chứng: chỉ trùng tiêu đề/tag thì tối đa 35,
      // phải có transcript/thumbnail mới lên 70, và chỉ khi fingerprint audio
      // hoặc frame video khớp mới được chạm 100.
      const { riskScore, needsVerification } = capRiskScore(reasons)
      return {
        videoId: cand.videoId,
        title: cand.title,
        channelId: cand.channelId,
        channelTitle: cand.channelTitle,
        thumbnailUrl: cand.thumbnailUrl,
        url: `https://www.youtube.com/watch?v=${cand.videoId}`,
        publishedAt: cand.publishedAt,
        riskScore,
        needsVerification,
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
    searched: preScored.length,
    transcriptChecked,
    frameChecked,
    mediaChecked,
    mediaCheckEnabled: !!options.deepMediaCheck,
    mediaCheckStatus,
    query,
    transcriptQuery: transcriptQueryUsed,
    quotaUnits
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
