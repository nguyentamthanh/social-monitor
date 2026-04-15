import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { Mention } from '@/lib/models/Mention'

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

    await connectDB()

    const query: any = {}

    if (keywordId) {
      query.keywordId = keywordId
    }

    if (platform) {
      query.platform = platform
    }

    if (startDate || endDate) {
      query.publishedAt = {}
      if (startDate) {
        query.publishedAt.$gte = new Date(startDate)
      }
      if (endDate) {
        query.publishedAt.$lte = new Date(endDate)
      }
    }

    const [mentions, total] = await Promise.all([
      Mention.find(query)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit),
      Mention.countDocuments(query)
    ])

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
