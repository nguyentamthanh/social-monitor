import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db'
import { getConnectorStatuses } from '@/lib/copyright/adapters'
import { mergeApiKeys, resolveApiKeys, type ScanApiKeys } from '@/lib/copyright/apiKeys'
import { ConnectorStatus } from '@/types'

export const dynamic = 'force-dynamic'

/** Tên field ở form Cài đặt → field trong ScanApiKeys. */
const FIELD_MAP: Record<string, keyof ScanApiKeys> = {
  youtube_api_key: 'youtubeApiKey',
  google_search_api_key: 'googleSearchApiKey',
  google_search_engine_id: 'googleSearchEngineId',
  facebook_token: 'facebookToken',
  tiktok_token: 'tiktokToken'
}

/** Video công khai lâu đời, dùng làm mẫu ping — `videos.list` chỉ tốn 1 quota unit. */
const PING_VIDEO_ID = 'dQw4w9WgXcQ'

function fromClientKeys(input: unknown): Partial<ScanApiKeys> {
  if (!input || typeof input !== 'object') return {}
  const out: Partial<ScanApiKeys> = {}
  for (const [field, value] of Object.entries(input as Record<string, unknown>)) {
    const target = FIELD_MAP[field]
    // Bỏ qua giá trị đã che (server trả về dạng AIza****abcd) — nó không phải key thật.
    if (!target || typeof value !== 'string' || !value.trim() || value.includes('***')) continue
    out[target] = value.trim()
  }
  return out
}

function errored(platform: ConnectorStatus['platform'], message: string): ConnectorStatus {
  return { platform, capability: 'error', code: 'invalid_key', message }
}

async function pingYouTube(apiKey: string): Promise<ConnectorStatus | null> {
  try {
    const params = new URLSearchParams({ part: 'id', id: PING_VIDEO_ID, key: apiKey })
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
    if (res.ok) return null
    const data = await res.json().catch(() => null)
    const reason = data?.error?.message || `HTTP ${res.status}`
    return errored('youtube', `Key bị YouTube từ chối: ${reason}`)
  } catch {
    return errored('youtube', 'Không gọi được YouTube Data API (lỗi mạng)')
  }
}

async function pingGoogleSearch(apiKey: string, engineId: string): Promise<ConnectorStatus | null> {
  try {
    const params = new URLSearchParams({ key: apiKey, cx: engineId, q: 'copyright', num: '1' })
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`)
    if (res.ok) return null
    const data = await res.json().catch(() => null)
    const reason = data?.error?.message || `HTTP ${res.status}`
    return errored('google', `Key hoặc Engine ID bị từ chối: ${reason}`)
  } catch {
    return errored('google', 'Không gọi được Custom Search API (lỗi mạng)')
  }
}

/**
 * Kiểm tra key **không lưu vào DB**: nhận giá trị đang gõ trên form, ghép lên
 * key đã lưu, rồi gọi thật mỗi API một lần rẻ nhất để phân biệt "chưa nhập key"
 * với "key sai / hết quota".
 */
export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id || session.user.email!
    const body = await request.json().catch(() => ({}))
    const keys = mergeApiKeys(await resolveApiKeys(userId), fromClientKeys(body?.apiKeys))

    const statuses = getConnectorStatuses(undefined, keys)
    const byPlatform = new Map(statuses.map(s => [s.platform, s]))

    const [ytError, googleError] = await Promise.all([
      byPlatform.get('youtube')?.capability === 'ready' ? pingYouTube(keys.youtubeApiKey) : Promise.resolve(null),
      byPlatform.get('google')?.capability === 'ready'
        ? pingGoogleSearch(keys.googleSearchApiKey, keys.googleSearchEngineId)
        : Promise.resolve(null)
    ])

    if (ytError) byPlatform.set('youtube', ytError)
    if (googleError) {
      byPlatform.set('google', googleError)
      // facebook đi qua chính Custom Search nên cùng chung số phận
      if (byPlatform.get('facebook')?.capability === 'ready') {
        byPlatform.set('facebook', errored('facebook', googleError.message))
      }
    }

    const connectors = statuses.map(s => byPlatform.get(s.platform) || s)
    return NextResponse.json({
      connectors,
      readyCount: connectors.filter(c => c.capability === 'ready').length
    })
  } catch (error) {
    console.error('Settings test error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
