import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db'
import { query, queryOne } from '@/lib/neon'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const keywordId = parseInt(id, 10)
    if (Number.isNaN(keywordId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const body = await request.json()
    const userId = (session.user as any).id || session.user.email!

    const fields: string[] = []
    const values: any[] = [userId, keywordId]
    let idx = 3

    if (body.term !== undefined) { fields.push(`term = $${idx++}`); values.push(body.term) }
    if (body.platforms !== undefined) { fields.push(`platforms = $${idx++}`); values.push(body.platforms) }
    if (body.status !== undefined) { fields.push(`status = $${idx++}`); values.push(body.status) }
    if (body.refreshInterval !== undefined) { fields.push(`refresh_interval = $${idx++}`); values.push(body.refreshInterval) }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const updated = await queryOne(
      `UPDATE keywords SET ${fields.join(', ')} WHERE user_id = $1 AND id = $2 RETURNING *`,
      values
    )
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Keyword PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const keywordId = parseInt(id, 10)
    if (Number.isNaN(keywordId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const userId = (session.user as any).id || session.user.email!
    await query(`DELETE FROM mentions WHERE keyword_id = $1`, [keywordId])
    await query(`DELETE FROM trend_data WHERE keyword_id = $1`, [keywordId])
    const result = await queryOne(
      `DELETE FROM keywords WHERE user_id = $1 AND id = $2 RETURNING id`,
      [userId, keywordId]
    )
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Keyword DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
