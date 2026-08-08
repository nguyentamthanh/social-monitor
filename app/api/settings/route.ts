import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db'
import { getUserSettings, maskedSettings, upsertUserSettings } from '@/lib/models/UserSettings'
import { parseOrError, settingsSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id || session.user.email!
    const settings = await getUserSettings(userId)
    return NextResponse.json(maskedSettings(settings))
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const parsed = parseOrError(settingsSchema, await request.json().catch(() => ({})))
    if (!parsed.ok) return parsed.response

    const userId = (session.user as any).id || session.user.email!
    await upsertUserSettings({
      userId,
      apiKeys: parsed.data.apiKeys || {},
      preferences: parsed.data.preferences || {}
    })
    const refreshed = await getUserSettings(userId)
    return NextResponse.json(maskedSettings(refreshed))
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
