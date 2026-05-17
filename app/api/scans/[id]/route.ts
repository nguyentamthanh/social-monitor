import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db'
import { findScanRunById } from '@/lib/models/CopyrightMonitor'
import { queryOne } from '@/lib/neon'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const scanId = parseInt(id, 10)
    if (Number.isNaN(scanId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const userId = (session.user as any).id || session.user.email!
    const scan = await findScanRunById(userId, scanId)
    if (!scan) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const findingsCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM findings WHERE scan_run_id = $1 AND user_id = $2`,
      [scanId, userId]
    )

    return NextResponse.json({
      scan,
      findingsCount: parseInt(findingsCount?.count || '0', 10)
    })
  } catch (error) {
    console.error('Scan GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
