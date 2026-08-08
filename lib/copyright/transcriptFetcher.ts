/**
 * Lấy phụ đề YouTube — nguồn cho cả `transcript_match` (đối chiếu) lẫn tìm
 * kiếm theo câu nói (`transcriptQuery.ts`).
 *
 * Cách cũ (scrape trang watch rồi lấy `captionTracks[].baseUrl`) đã CHẾT:
 * YouTube vẫn nhả HTML chứa baseUrl, nhưng gọi thẳng baseUrl đó nay trả
 * 200 kèm 0 byte vì thiếu proof-of-origin token. Nó hỏng âm thầm — không
 * throw, không 4xx — nên `transcript_match` đã ngừng hoạt động mà không ai
 * biết.
 *
 * Cách hiện tại: gọi innertube `youtubei/v1/player` với client ANDROID. Đây
 * là API player chính chủ, trả baseUrl dùng được ngay, và không cần binary
 * nào nên chạy được trên Vercel serverless.
 */

const INNERTUBE_URL =
  'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'

const INNERTUBE_CONTEXT = {
  client: { clientName: 'ANDROID', clientVersion: '20.10.38', hl: 'en', gl: 'US' }
}

const FETCH_TIMEOUT_MS = 8000

interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind?: string
}

export async function fetchTranscript(videoId: string): Promise<string> {
  const tracks = await listCaptionTracks(videoId)
  if (tracks.length === 0) return ''

  // Ưu tiên vi → en; phụ đề do người tạo luôn tốt hơn bản tự sinh (kind='asr').
  const preferred =
    tracks.find(t => t.languageCode === 'vi' && t.kind !== 'asr') ||
    tracks.find(t => t.languageCode === 'vi') ||
    tracks.find(t => t.languageCode === 'en' && t.kind !== 'asr') ||
    tracks.find(t => t.languageCode === 'en') ||
    tracks[0]

  try {
    const res = await fetch(preferred.baseUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
    if (!res.ok) return ''
    return xmlToText(await res.text())
  } catch {
    return ''
  }
}

async function listCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  try {
    const res = await fetch(INNERTUBE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoId, context: INNERTUBE_CONTEXT }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
    if (!res.ok) return []

    const json = (await res.json()) as {
      captions?: {
        playerCaptionsTracklistRenderer?: {
          captionTracks?: Array<{ baseUrl?: string; languageCode?: string; kind?: string }>
        }
      }
    }

    const tracks = json.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
    return tracks
      .filter(t => !!t.baseUrl)
      .map(t => ({
        baseUrl: t.baseUrl!,
        languageCode: t.languageCode || 'unknown',
        kind: t.kind
      }))
  } catch {
    return []
  }
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<\/?(transcript|timedtext|head|body|p|s|wp|wsm)[^>]*>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
}
