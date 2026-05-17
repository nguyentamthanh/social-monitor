import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findKeywordsByUserId } from '@/lib/models/Keyword'
import { findRecentMentions, countMentionsByKeywordIds } from '@/lib/models/Mention'
import { aggregateTrendData } from '@/lib/models/TrendData'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id || session.user?.email

    const keywords = await findKeywordsByUserId(userId)
    const keywordIds = keywords.map(k => k.id)

    const totalMentions = await countMentionsByKeywordIds(keywordIds)
    const recentMentions = await findRecentMentions(keywordIds, 10)

    const activeKeywords = keywords.filter(k => k.status === 'active').length

    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - 30)

    const platformStats = await aggregateTrendData({
      keywordIds,
      startDate: dateFrom
    })

    let avgEngagement = 0
    let topPlatform = 'N/A'
    let maxEngagement = 0

    for (const stat of platformStats) {
      if (stat.total_engagement > maxEngagement) {
        maxEngagement = stat.total_engagement
        topPlatform = stat.platform
      }
    }

    if (totalMentions > 0) {
      const totalEngagement = platformStats.reduce((sum, s) => sum + s.total_engagement, 0)
      avgEngagement = Math.round(totalEngagement / totalMentions)
    }

    return NextResponse.json({
      stats: {
        totalMentions,
        activeKeywords,
        avgEngagement,
        topPlatform
      },
      platformBreakdown: platformStats.map(s => ({
        platform: s.platform,
        mentions: s.total_mentions,
        engagement: s.total_engagement
      })),
      recentMentions: recentMentions.map(m => ({
        id: m.id,
        content: m.content,
        platform: m.platform,
        author: m.author,
        url: m.url,
        metrics: m.metrics,
        publishedAt: m.published_at,
        keyword: m.keyword_term || 'Unknown'
      }))
    })
  } catch (error) {
    console.error('Dashboard GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}