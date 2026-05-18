import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db'
import { extractYouTubeVideoId } from '@/lib/copyright/urlParser'
import { YouTubeLookupError } from '@/lib/copyright/youtubeVideoLookup'
import { findCopies } from '@/lib/copyright/findCopies'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const rawUrl: string = typeof body.url === 'string' ? body.url : ''

    const videoId = extractYouTubeVideoId(rawUrl)
    if (!videoId) {
      return NextResponse.json(
        { error: 'invalid_url', message: 'URL không hợp lệ. Hỗ trợ youtube.com/watch, youtu.be, /shorts, /embed.' },
        { status: 400 }
      )
    }

    const result = await findCopies(videoId)
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
