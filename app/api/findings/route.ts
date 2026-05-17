import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db'
import { findFindings } from '@/lib/models/CopyrightMonitor'
import { FindingStatus, Platform } from '@/types'

export const dynamic = 'force-dynamic'

const statuses: FindingStatus[] = ['new', 'reviewing', 'confirmed', 'dismissed']
const platforms: Platform[] = ['facebook', 'google', 'youtube', 'tiktok']

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status') as FindingStatus | null
    const platformParam = searchParams.get('platform') as Platform | null
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const userId = (session.user as any).id || session.user.email!

    const result = await findFindings({
      userId,
      status: statusParam && statuses.includes(statusParam) ? statusParam : undefined,
      platform: platformParam && platforms.includes(platformParam) ? platformParam : undefined,
      limit,
      offset
    })

    return NextResponse.json({ ...result, limit, offset })
  } catch (error) {
    console.error('Findings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
