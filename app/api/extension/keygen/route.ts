import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db'
import { query, queryOne } from '@/lib/neon'
import { createHash, randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as any).id || session.user.email!
    const row = await queryOne<{ created_at: string }>(
      `SELECT created_at FROM extension_api_keys WHERE user_id = $1`,
      [userId]
    )
    return NextResponse.json({ hasKey: !!row, createdAt: row?.created_at ?? null })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST() {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as any).id || session.user.email!
    const plain = 'sma_' + randomBytes(24).toString('hex')
    const hash = createHash('sha256').update(plain).digest('hex')

    await query(`DELETE FROM extension_api_keys WHERE user_id = $1`, [userId])
    await query(
      `INSERT INTO extension_api_keys (key_hash, user_id, created_at) VALUES ($1, $2, NOW())`,
      [hash, userId]
    )

    return NextResponse.json({ key: plain })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as any).id || session.user.email!
    await query(`DELETE FROM extension_api_keys WHERE user_id = $1`, [userId])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
