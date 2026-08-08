import { computePHashFromUrl, hammingDistance } from '@/lib/copyright/imageHash'
import { normalizeText } from '@/lib/copyright/scoring'
import { capRiskScore, reasonLabel } from '@/lib/copyright/reasons'
import { mapWithConcurrency } from '@/lib/util/pool'

/**
 * Tìm bản sao trên Dailymotion.
 *
 * Vì sao là Dailymotion mà không phải Facebook/TikTok: API tìm kiếm công khai
 * của Dailymotion **không cần API key, không cần đăng ký, không có hạn mức
 * phải xin** — nên nó là nền tảng thứ hai duy nhất quét được mà không phát
 * sinh chi phí hay thủ tục. Facebook thì Meta đã bỏ tìm kiếm nội dung công
 * khai, TikTok thì Research API phải được duyệt.
 *
 * Giới hạn cần biết: Dailymotion không có storyboard như YouTube, nên bằng
 * chứng mạnh nhất ở đây chỉ là pHash thumbnail (hạng `medium`, trần 70 điểm),
 * không đạt hạng `strong` như so khung hình bên YouTube.
 */

const SEARCH_URL = 'https://api.dailymotion.com/videos'
const FIELDS = [
  'id',
  'title',
  'description',
  'thumbnail_720_url',
  'thumbnail_url',
  'owner.screenname',
  'owner.id',
  'created_time',
  'duration',
  'url'
].join(',')

const MAX_CANDIDATES = 30
const THUMBNAIL_CONCURRENCY = 5
const FETCH_TIMEOUT_MS = 10000
/** Chỉ báo cáo khi có ít nhất bằng chứng hạng medium — giống ngưỡng YouTube. */
const MIN_REPORT_SCORE = 40

export interface DailymotionCandidate {
  videoId: string
  title: string
  channelId: string
  channelTitle: string
  thumbnailUrl?: string
  url: string
  publishedAt: string | null
  riskScore: number
  needsVerification: boolean
  reasons: Array<{ code: string; label: string; points: number }>
}

export interface DailymotionSearchResult {
  candidates: DailymotionCandidate[]
  searched: number
  query: string
  /** Dailymotion không tính phí và không cần key — luôn là 0. */
  quotaUnits: 0
}

export interface RawVideo {
  id: string
  title?: string
  description?: string
  thumbnail_720_url?: string
  thumbnail_url?: string
  'owner.screenname'?: string
  'owner.id'?: string
  created_time?: number
  duration?: number
  url?: string
}

export interface DailymotionOriginal {
  title: string
  /** pHash thumbnail video gốc — nguồn bằng chứng mạnh nhất ở đây. */
  thumbnailHash?: string
  publishedAt?: string | null
  /** Thời lượng video gốc tính bằng giây, nếu biết. */
  durationSec?: number | null
}

/** Chuyển ISO 8601 của YouTube (PT4M33S) sang giây. */
export function parseIsoDuration(iso?: string | null): number | null {
  if (!iso) return null
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/)
  if (!m) return null
  const [, h, min, s] = m
  const total = Number(h || 0) * 3600 + Number(min || 0) * 60 + Number(s || 0)
  return total > 0 ? total : null
}

/**
 * Dựng truy vấn từ tiêu đề video gốc. Dailymotion không tính quota nên có thể
 * dùng nguyên cụm từ dài hơn so với YouTube.
 */
export function buildDailymotionQuery(title: string): string {
  return normalizeText(title)
    .split(' ')
    .filter(token => token.length >= 3)
    .slice(0, 8)
    .join(' ')
}

export async function findDailymotionCopies(
  original: DailymotionOriginal,
  options: { thumbnailMatch?: boolean } = {}
): Promise<DailymotionSearchResult> {
  const query = buildDailymotionQuery(original.title)
  if (!query) {
    return { candidates: [], searched: 0, query: '', quotaUnits: 0 }
  }

  const raw = await searchDailymotion(query)
  const originalPublishedAt = original.publishedAt ? new Date(original.publishedAt) : null
  const originalTitleNorm = normalizeText(original.title)

  const scored = await mapWithConcurrency(raw, THUMBNAIL_CONCURRENCY, async video => {
    const reasons: Array<{ code: string; label: string; points: number }> = []
    const titleNorm = normalizeText(video.title || '')

    const titleSim = jaccard(originalTitleNorm, titleNorm)
    if (titleSim >= 0.3) {
      reasons.push({
        code: 'title_match',
        label: reasonLabel('title_match'),
        points: Math.round(35 * titleSim)
      })
    }

    const thumbnailUrl = video.thumbnail_720_url || video.thumbnail_url
    if (options.thumbnailMatch !== false && original.thumbnailHash && thumbnailUrl) {
      const hash = await computePHashFromUrl(thumbnailUrl)
      if (hash) {
        const distance = hammingDistance(original.thumbnailHash, hash)
        if (distance <= 14) {
          reasons.push({
            code: 'thumbnail_match',
            label: reasonLabel('thumbnail_match'),
            points: Math.max(10, Math.round(25 * (1 - distance / 18)))
          })
        }
      }
    }

    // Thời lượng gần bằng nhau là dấu hiệu bê nguyên bản. Tự nó rất yếu (vô
    // số video dài bằng nhau) nên chỉ cho điểm nhỏ và xếp hạng `weak`.
    if (original.durationSec && video.duration) {
      const diff = Math.abs(original.durationSec - video.duration)
      if (diff <= 3) {
        reasons.push({
          code: 'duration_match',
          label: reasonLabel('duration_match'),
          points: 10
        })
      }
    }

    const publishedAt = video.created_time ? new Date(video.created_time * 1000) : null
    if (originalPublishedAt && publishedAt) {
      if (publishedAt > originalPublishedAt) {
        reasons.push({ code: 'newer_than_original', label: reasonLabel('newer_than_original'), points: 5 })
      } else {
        reasons.push({ code: 'older_than_original', label: reasonLabel('older_than_original'), points: -10 })
      }
    }

    const { riskScore, needsVerification } = capRiskScore(reasons)

    return {
      videoId: video.id,
      title: video.title || '',
      channelId: video['owner.id'] || '',
      channelTitle: video['owner.screenname'] || '',
      thumbnailUrl,
      url: video.url || `https://www.dailymotion.com/video/${video.id}`,
      publishedAt: publishedAt ? publishedAt.toISOString() : null,
      riskScore,
      needsVerification,
      reasons
    }
  })

  return {
    candidates: scored
      .filter(c => c.riskScore >= MIN_REPORT_SCORE)
      .sort((a, b) => b.riskScore - a.riskScore),
    searched: raw.length,
    query,
    quotaUnits: 0
  }
}

/** Xuất công khai để adapters.ts dùng chung cho quét theo tài sản đã lưu. */
export async function searchDailymotion(query: string): Promise<RawVideo[]> {
  try {
    const params = new URLSearchParams({
      search: query,
      fields: FIELDS,
      limit: String(MAX_CANDIDATES),
      sort: 'relevance'
    })
    const res = await fetch(`${SEARCH_URL}?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
    if (!res.ok) return []
    const json = (await res.json()) as { list?: RawVideo[] }
    return Array.isArray(json.list) ? json.list.filter(v => !!v.id) : []
  } catch {
    return []
  }
}

function jaccard(a: string, b: string, n = 2): number {
  const grams = (text: string) => {
    const tokens = text.split(' ').filter(Boolean)
    const set = new Set<string>()
    for (let i = 0; i <= tokens.length - n; i++) set.add(tokens.slice(i, i + n).join(' '))
    return set
  }
  const setA = grams(a)
  const setB = grams(b)
  if (setA.size === 0 || setB.size === 0) return 0
  let hit = 0
  for (const g of setA) if (setB.has(g)) hit++
  return hit / Math.max(setA.size, setB.size)
}
