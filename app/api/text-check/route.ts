import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkTextAgainstPlatformPolicies } from '@/lib/policies/textPolicy'
import { parseOrError, textCheckSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = parseOrError(textCheckSchema, await request.json().catch(() => ({})))
    if (!parsed.ok) return parsed.response

    const { text, platforms } = parsed.data
    return NextResponse.json(checkTextAgainstPlatformPolicies(text, platforms))
  } catch (error) {
    console.error('Text check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
