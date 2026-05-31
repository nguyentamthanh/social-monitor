import { extractYouTubeVideoId } from '@/lib/copyright/urlParser'

const YOUTUBE_RE = /(youtube\.com|youtu\.be)/i
const DOMAIN_RE = /^[\w-]+(\.[\w-]+)+(\/.*)?$/i

export type DetectedInput = {
  assetType: 'video' | 'brand_name'
  name: string
  youtubeUrl?: string
  officialDomains?: string
  keywords?: string
}

/**
 * Chuẩn hoá input từ ô "Quét ngay" để backend quick scan không bị thiếu field bắt buộc.
 * Lưu ý: với YouTube URL, luôn tạo `name` dự phòng vì YOUTUBE_API_KEY có thể chưa cấu hình.
 */
export function detectScanInput(raw: string): DetectedInput | null {
  const q = raw.trim()
  if (!q) return null

  if (YOUTUBE_RE.test(q)) {
    const videoId = extractYouTubeVideoId(q)
    // `name` là bắt buộc ở API /api/scans/quick khi rơi vào fallback path.
    // Nếu có videoId thì dùng id để ổn định, không thì dùng placeholder.
    const name = videoId ? `YouTube:${videoId}` : 'YouTube Video'
    return { assetType: 'video', name, youtubeUrl: q }
  }

  if (!q.includes(' ') && DOMAIN_RE.test(q)) {
    const host = q.replace(/^https?:\/\//, '').split('/')[0]
    return { assetType: 'brand_name', name: host, officialDomains: host, keywords: host.split('.')[0] }
  }

  return { assetType: 'brand_name', name: q.slice(0, 80), keywords: q }
}

