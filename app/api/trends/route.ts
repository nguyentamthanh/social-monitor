import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findTrendsByKeywordIds } from '@/lib/models/TrendData'
import { findKeywordsByUserId } from '@/lib/models/Keyword'

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
    const days = parseInt(searchParams.get('days') || '30')

    const userId = (session.user as any).id || session.user?.email

    const keywords = await findKeywordsByUserId(userId)
    const keywordIds = keywords.map(k => k.id)

    if (keywordIds.length === 0) {
      return NextResponse.json([])
    }

    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - days)

    const trends = await findTrendsByKeywordIds(
      keywordIds,
      platform || undefined,
      dateFrom
    )

    const formattedTrends = trends.map(t => ({
      date: t.date,
      platform: t.platform,
      mentionCount: t.mention_count,
      engagement: t.engagement
    }))

    return NextResponse.json(formattedTrends)
  } catch (error) {
    console.error('Trends GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}