import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { TrendData } from '@/lib/models/TrendData'
import { Keyword } from '@/lib/models/Keyword'

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

    await connectDB()

    const userId = (session.user as any).id || session.user?.email

    const keywordQuery: any = { userId }
    if (keywordId) {
      keywordQuery._id = keywordId
    }

    const keywords = await Keyword.find(keywordQuery)
    const keywordIds = keywords.map(k => k._id.toString())

    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - days)

    const query: any = {
      keywordId: { $in: keywordIds },
      date: { $gte: dateFrom }
    }

    if (platform) {
      query.platform = platform
    }

    const trends = await TrendData.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            platform: '$platform'
          },
          totalMentions: { $sum: '$mentionCount' },
          totalEngagement: { $sum: '$engagement' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ])

    const formattedTrends = trends.map(t => ({
      date: t._id.date,
      platform: t._id.platform,
      mentionCount: t.totalMentions,
      engagement: t.totalEngagement
    }))

    return NextResponse.json(formattedTrends)
  } catch (error) {
    console.error('Trends GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
