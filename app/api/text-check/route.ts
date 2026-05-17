import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkTextAgainstPlatformPolicies } from '@/lib/policies/textPolicy'
import { Platform } from '@/types'

export const dynamic = 'force-dynamic'

const validPlatforms: Platform[] = ['facebook', 'google', 'youtube', 'tiktok']

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const text = String(body.text || '').trim()
    const platforms = Array.isArray(body.platforms)
      ? body.platforms.filter((platform: Platform) => validPlatforms.includes(platform))
      : []

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    if (text.length > 20000) {
      return NextResponse.json({ error: 'Text is too long. Limit is 20,000 characters.' }, { status: 400 })
    }

    return NextResponse.json(checkTextAgainstPlatformPolicies(text, platforms))
  } catch (error) {
    console.error('Text check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
