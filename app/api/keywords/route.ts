import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findKeywordsByUserId, createKeyword } from '@/lib/models/Keyword'
import { insertMentions } from '@/lib/models/Mention'
import { createTrendData } from '@/lib/models/TrendData'
import { getAdapter } from '@/lib/social-platforms'
import { Platform } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id || session.user?.email
    const keywords = await findKeywordsByUserId(userId)

    return NextResponse.json(keywords)
  } catch (error) {
    console.error('Keywords GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { term, platforms, refreshInterval } = body

    if (!term || !platforms || !Array.isArray(platforms)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const userId = (session.user as any).id || session.user?.email

    const keyword = await createKeyword(
      userId,
      term,
      platforms,
      refreshInterval || 3600000
    )

    for (const platform of platforms as Platform[]) {
      const adapter = getAdapter(platform)
      const mentions = await adapter.searchMentions(term)

      const mentionDocs = mentions.map(m => ({
        keywordId: keyword.id,
        platform: m.platform,
        externalId: m.externalId,
        author: m.author,
        content: m.content,
        url: m.url,
        metrics: m.metrics,
        publishedAt: m.publishedAt
      }))

      if (mentionDocs.length > 0) {
        await insertMentions(mentionDocs)

        const totalEngagement = mentionDocs.reduce(
          (sum, m) => sum + m.metrics.likes + m.metrics.shares + m.metrics.comments,
          0
        )

        await createTrendData({
          keywordId: keyword.id,
          platform,
          date: new Date(),
          mentionCount: mentionDocs.length,
          engagement: totalEngagement
        })
      }
    }

    return NextResponse.json(keyword, { status: 201 })
  } catch (error) {
    console.error('Keywords POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}