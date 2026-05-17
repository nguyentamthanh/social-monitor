import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db'
import { runCopyrightScan } from '@/lib/copyright/scanner'
import { getConnectorStatuses } from '@/lib/copyright/adapters'
import { findScanRunsByUserId } from '@/lib/models/CopyrightMonitor'
import { Platform } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id || session.user.email!
    const [scans, connectorStatus] = await Promise.all([
      findScanRunsByUserId(userId),
      Promise.resolve(getConnectorStatuses())
    ])

    return NextResponse.json({ scans, connectorStatus })
  } catch (error) {
    console.error('Scans GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const assetIds = Array.isArray(body.assetIds)
      ? body.assetIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id))
      : undefined
    const platforms = Array.isArray(body.platforms)
      ? body.platforms.filter((platform: string) => ['facebook', 'google', 'youtube', 'tiktok'].includes(platform)) as Platform[]
      : undefined

    const userId = (session.user as any).id || session.user.email!
    const result = await runCopyrightScan({ userId, assetIds, platforms })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Scans POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
