import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findMentions } from '@/lib/models/Mention'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const keywordId = searchParams.get('keywordId')
    const platform = searchParams.get('platform')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = parseInt(searchParams.get('skip') || '0')

    const filters: {
      keywordId?: number
      platform?: string
      startDate?: Date
      endDate?: Date
      limit: number
      offset: number
    } = {
      limit,
      offset: skip
    }

    if (keywordId) {
      filters.keywordId = parseInt(keywordId)
    }

    if (platform) {
      filters.platform = platform
    }

    if (startDate) {
      filters.startDate = new Date(startDate)
    }

    if (endDate) {
      filters.endDate = new Date(endDate)
    }

    const { mentions, total } = await findMentions(filters)

    return NextResponse.json({
      mentions,
      total,
      limit,
      skip
    })
  } catch (error) {
    console.error('Mentions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}