export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null
  const raw = input.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw

  let url: URL
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const path = url.pathname

  if (host === 'youtu.be') {
    const id = path.split('/').filter(Boolean)[0]
    return isValidId(id) ? id : null
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (path === '/watch') {
      const id = url.searchParams.get('v')
      return isValidId(id) ? id! : null
    }
    const segments = path.split('/').filter(Boolean)
    if (segments[0] === 'shorts' && segments[1]) {
      return isValidId(segments[1]) ? segments[1] : null
    }
    if (segments[0] === 'embed' && segments[1]) {
      return isValidId(segments[1]) ? segments[1] : null
    }
    if (segments[0] === 'live' && segments[1]) {
      return isValidId(segments[1]) ? segments[1] : null
    }
  }

  return null
}

function isValidId(id: string | null | undefined): id is string {
  return !!id && /^[A-Za-z0-9_-]{11}$/.test(id)
}
