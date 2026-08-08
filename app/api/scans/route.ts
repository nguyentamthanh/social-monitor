import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db'
import { runCopyrightScan } from '@/lib/copyright/scanner'
import { getConnectorStatuses } from '@/lib/copyright/adapters'
import { resolveApiKeys } from '@/lib/copyright/apiKeys'
import { getQuota } from '@/lib/copyright/quota'
import { getUserSettings } from '@/lib/models/UserSettings'
import { findScanRunsByUserId } from '@/lib/models/CopyrightMonitor'
import { parseOrError, scanRequestSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id || session.user.email!
    const [scans, keys, settings] = await Promise.all([
      findScanRunsByUserId(userId),
      resolveApiKeys(userId),
      getUserSettings(userId).catch(() => null)
    ])
    const connectorStatus = getConnectorStatuses(undefined, keys)
    const quota = await getQuota(userId, settings?.preferences)

    return NextResponse.json({ scans, connectorStatus, quota })
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

    const parsed = parseOrError(scanRequestSchema, await request.json().catch(() => ({})))
    if (!parsed.ok) return parsed.response
    const { assetIds, platforms } = parsed.data

    const userId = (session.user as any).id || session.user.email!
    const result = await runCopyrightScan({ userId, assetIds, platforms })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Scans POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
