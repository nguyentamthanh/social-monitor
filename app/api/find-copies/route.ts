import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db'
import { extractYouTubeVideoId } from '@/lib/copyright/urlParser'
import { YouTubeLookupError } from '@/lib/copyright/youtubeVideoLookup'
import { findCopies, FIND_COPIES_QUOTA_UNITS } from '@/lib/copyright/findCopies'
import { resolveApiKeys } from '@/lib/copyright/apiKeys'
import { parseOrError, youtubeUrlRequestSchema } from '@/lib/validation'
import { getQuota, recordUsage } from '@/lib/copyright/quota'
import { getUserSettings } from '@/lib/models/UserSettings'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = parseOrError(youtubeUrlRequestSchema, await request.json().catch(() => ({})))
    if (!parsed.ok) return parsed.response
    const rawUrl = parsed.data.url
    const deepMediaCheck = parsed.data.deepMediaCheck === true

    const videoId = extractYouTubeVideoId(rawUrl)
    if (!videoId) {
      return NextResponse.json(
        { error: 'invalid_url', message: 'URL không hợp lệ. Hỗ trợ youtube.com/watch, youtu.be, /shorts, /embed.' },
        { status: 400 }
      )
    }

    const userId = (session.user as any).id || session.user.email!
    const keys = await resolveApiKeys(userId)

    const settings = await getUserSettings(userId).catch(() => null)
    const quota = await getQuota(userId, settings?.preferences)
    if (quota.exceeded) {
      return NextResponse.json(
        {
          error: 'quota_exceeded',
          message: `Đã dùng hết ${quota.budget} quota YouTube hôm nay. Quota reset lúc 00:00 giờ Thái Bình Dương, hoặc tăng hạn mức trong Cài đặt.`,
          quota
        },
        { status: 429 }
      )
    }
    const result = await findCopies(videoId, { deepMediaCheck, apiKey: keys.youtubeApiKey })
    await recordUsage(userId, FIND_COPIES_QUOTA_UNITS)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof YouTubeLookupError) {
      const status = error.code === 'config_missing' ? 500 : error.code === 'not_found' ? 404 : 502
      return NextResponse.json({ error: error.code, message: error.message }, { status })
    }
    const msg = error instanceof Error ? error.message : 'unknown'
    if (msg.startsWith('config_missing')) {
      return NextResponse.json({ error: 'config_missing', message: msg }, { status: 500 })
    }
    if (msg.startsWith('youtube_search_failed')) {
      return NextResponse.json({ error: 'youtube_search_failed', message: msg }, { status: 502 })
    }
    console.error('find-copies POST error:', error)
    return NextResponse.json({ error: 'internal_error', message: 'Internal server error' }, { status: 500 })
  }
}
