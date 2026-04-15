import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { Keyword } from '@/lib/models/Keyword'
import { Mention } from '@/lib/models/Mention'
import { TrendData } from '@/lib/models/TrendData'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const userId = (session.user as any).id || session.user?.email

    const keywords = await Keyword.find({ userId })
    const keywordIds = keywords.map(k => k._id.toString())

    const [totalMentions, recentMentions] = await Promise.all([
      Mention.countDocuments({ keywordId: { $in: keywordIds } }),
      Mention.find({ keywordId: { $in: keywordIds } })
        .sort({ publishedAt: -1 })
        .limit(10)
        .populate('keywordId', 'term')
    ])

    const activeKeywords = keywords.filter(k => k.status === 'active').length

    const platformStats = await TrendData.aggregate([
      {
        $match: {
          keywordId: { $in: keywordIds }
        }
      },
      {
        $group: {
          _id: '$platform',
          totalMentions: { $sum: '$mentionCount' },
          totalEngagement: { $sum: '$engagement' }
        }
      }
    ])

    let avgEngagement = 0
    let topPlatform = 'N/A'
    let maxEngagement = 0

    for (const stat of platformStats) {
      if (stat.totalEngagement > maxEngagement) {
        maxEngagement = stat.totalEngagement
        topPlatform = stat._id
      }
    }

    if (totalMentions > 0) {
      const totalEngagement = platformStats.reduce((sum, s) => sum + s.totalEngagement, 0)
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
        platform: s._id,
        mentions: s.totalMentions,
        engagement: s.totalEngagement
      })),
      recentMentions: recentMentions.map(m => ({
        _id: m._id,
        content: m.content,
        platform: m.platform,
        author: m.author,
        url: m.url,
        metrics: m.metrics,
        publishedAt: m.publishedAt,
        keyword: (m.keywordId as any)?.term || 'Unknown'
      }))
    })
  } catch (error) {
    console.error('Dashboard GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
