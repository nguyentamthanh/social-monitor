import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db'
import { deleteBrandAsset, updateBrandAsset } from '@/lib/models/CopyrightMonitor'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const assetId = parseInt(id, 10)
    if (Number.isNaN(assetId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const body = await request.json()
    const userId = (session.user as any).id || session.user.email!
    const updated = await updateBrandAsset(userId, assetId, {
      name: body.name,
      keywords: body.keywords,
      textContent: body.textContent,
      officialDomains: body.officialDomains,
      status: body.status,
      audioMetadata: body.audioMetadata
    })
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Asset PATCH error:', error)
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
    const assetId = parseInt(id, 10)
    if (Number.isNaN(assetId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const userId = (session.user as any).id || session.user.email!
    const ok = await deleteBrandAsset(userId, assetId)
    if (!ok) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Asset DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
