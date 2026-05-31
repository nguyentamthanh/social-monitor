import { NextRequest, NextResponse } from 'next/server'
import { initializeDatabase } from '@/lib/db'
import { queryOne } from '@/lib/neon'
import { createHash } from 'crypto'
import { extractYouTubeVideoId } from '@/lib/copyright/urlParser'
import { fetchYouTubeVideoById, YouTubeLookupError } from '@/lib/copyright/youtubeVideoLookup'
import { scoreCandidate } from '@/lib/copyright/scoring'
import { findActiveAssetsByIds } from '@/lib/models/CopyrightMonitor'

export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

async function resolveUser(apiKey: string): Promise<string | null> {
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const row = await queryOne<{ user_id: string }>(
    `SELECT user_id FROM extension_api_keys WHERE key_hash = $1`,
    [hash]
  )
  return row?.user_id ?? null
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()

    const body = await request.json().catch(() => ({}))
    const apiKey: string = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
    const rawUrl: string = typeof body.url === 'string' ? body.url.trim() : ''

    if (!apiKey) {
      return NextResponse.json(
        { error: 'api_key_required', message: 'Cần extension API key' },
        { status: 401, headers: CORS }
      )
    }

    const userId = await resolveUser(apiKey)
    if (!userId) {
      return NextResponse.json(
        { error: 'invalid_api_key', message: 'API key không hợp lệ hoặc đã bị revoke' },
        { status: 401, headers: CORS }
      )
    }

    const videoId = extractYouTubeVideoId(rawUrl)
    if (!videoId) {
      return NextResponse.json(
        { error: 'invalid_url', message: 'URL không hợp lệ. Hỗ trợ youtube.com/watch, youtu.be, /shorts.' },
        { status: 400, headers: CORS }
      )
    }

    const assets = await findActiveAssetsByIds(userId)
    if (assets.length === 0) {
      return NextResponse.json(
        { video: null, matches: [], topScore: 0, assetsChecked: 0, noAssets: true },
        { headers: CORS }
      )
    }

    const needThumbnailHash = assets.some(
      a => !!a.perceptual_hash && ['image', 'logo', 'video'].includes(a.asset_type)
    )

    let lookup
    try {
      lookup = await fetchYouTubeVideoById(videoId, { computeThumbnailHash: needThumbnailHash })
    } catch (err) {
      if (err instanceof YouTubeLookupError) {
        const status = err.code === 'config_missing' ? 500 : err.code === 'not_found' ? 404 : 502
        return NextResponse.json({ error: err.code, message: err.message }, { status, headers: CORS })
      }
      throw err
    }

    const candidate = lookup.candidate
    const matches: any[] = []
    for (const asset of assets) {
      const score = scoreCandidate(asset, candidate)
      if (score.riskScore >= 30) {
        matches.push({
          assetId: asset.id,
          assetName: asset.name,
          assetType: asset.asset_type,
          riskScore: score.riskScore,
          reasons: score.reasons
        })
      }
    }
    matches.sort((a, b) => b.riskScore - a.riskScore)

    return NextResponse.json(
      {
        video: {
          videoId,
          title: candidate.title,
          url: candidate.url,
          channelTitle: candidate.author?.name || '',
          thumbnailUrl: candidate.media?.thumbnailUrl,
          publishedAt: candidate.publishedAt,
          duration: lookup.raw.duration,
          viewCount: lookup.raw.viewCount
        },
        matches,
        topScore: matches[0]?.riskScore ?? 0,
        assetsChecked: assets.length
      },
      { headers: CORS }
    )
  } catch (error) {
    console.error('extension/check error:', error)
    return NextResponse.json(
      { error: 'internal_error', message: 'Internal server error' },
      { status: 500, headers: CORS }
    )
  }
}
