const WATCH_URL = (id: string) => `https://www.youtube.com/watch?v=${id}&hl=en`

interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind?: string
}

export async function fetchTranscript(videoId: string): Promise<string> {
  const tracks = await listCaptionTracks(videoId)
  if (tracks.length === 0) return ''

  const preferred =
    tracks.find(t => t.languageCode === 'vi') ||
    tracks.find(t => t.languageCode === 'en') ||
    tracks[0]

  try {
    const res = await fetch(preferred.baseUrl, { cache: 'no-store' })
    if (!res.ok) return ''
    const xml = await res.text()
    return xmlToText(xml)
  } catch {
    return ''
  }
}

async function listCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  try {
    const res = await fetch(WATCH_URL(videoId), {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9,vi;q=0.8'
      },
      cache: 'no-store'
    })
    if (!res.ok) return []
    const html = await res.text()
    const match = html.match(/"captionTracks":(\[.*?\])/)
    if (!match) return []
    const parsed = JSON.parse(match[1]) as Array<{ baseUrl?: string; languageCode?: string; kind?: string }>
    return parsed
      .filter(t => !!t.baseUrl)
      .map(t => ({
        baseUrl: t.baseUrl!.replace(/\\u0026/g, '&'),
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
