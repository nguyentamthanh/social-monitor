import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db'
import { extractYouTubeVideoId } from '@/lib/copyright/urlParser'
import { fetchYouTubeVideoById, YouTubeLookupError } from '@/lib/copyright/youtubeVideoLookup'
import { scoreCandidate } from '@/lib/copyright/scoring'
import {
  createEvidenceItem,
  createScanRun,
  findActiveAssetsByIds,
  updateScanRun,
  upsertFinding
} from '@/lib/models/CopyrightMonitor'
import { createNotification } from '@/lib/models/Notification'
import { ConnectorStatus, FindingReason } from '@/types'

export const dynamic = 'force-dynamic'

const MIN_FINDING_SCORE = 30

interface MatchResult {
  assetId: number
  assetName: string
  assetType: string
  riskScore: number
  reasons: FindingReason[]
  findingId?: number
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id || session.user.email!
    const body = await request.json().catch(() => ({}))
    const rawUrl: string = typeof body.url === 'string' ? body.url : ''

    const videoId = extractYouTubeVideoId(rawUrl)
    if (!videoId) {
      return NextResponse.json(
        { error: 'invalid_url', message: 'URL không hợp lệ. Hỗ trợ link youtube.com/watch, youtu.be, /shorts, /embed.' },
        { status: 400 }
      )
    }

    const assets = await findActiveAssetsByIds(userId)
    if (assets.length === 0) {
      return NextResponse.json(
        { error: 'no_assets', message: 'Bạn chưa có tài sản nào ở trạng thái active để so khớp.' },
        { status: 400 }
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
        return NextResponse.json({ error: err.code, message: err.message }, { status })
      }
      throw err
    }

    const candidate = lookup.candidate
    const scored: MatchResult[] = []
    for (const asset of assets) {
      const score = scoreCandidate(asset, candidate)
      if (score.riskScore >= MIN_FINDING_SCORE) {
        scored.push({
          assetId: asset.id,
          assetName: asset.name,
          assetType: asset.asset_type,
          riskScore: score.riskScore,
          reasons: score.reasons
        })
      }
    }

    scored.sort((a, b) => b.riskScore - a.riskScore)

    let scanRunId: number | null = null
    if (scored.length > 0) {
      const scanRun = await createScanRun({
        userId,
        trigger: 'manual',
        assetIds: scored.map(m => m.assetId)
      })
      scanRunId = scanRun.id

      for (const match of scored) {
        const finding = await upsertFinding({
          userId,
          scanRunId: scanRun.id,
          assetId: match.assetId,
          platform: 'youtube',
          source: 'url_check',
          externalId: candidate.externalId,
          title: candidate.title || 'YouTube video',
          content: candidate.content || candidate.title,
          url: candidate.url,
          author: candidate.author ? { ...candidate.author } : null,
          riskScore: match.riskScore,
          reasons: match.reasons,
          publishedAt: candidate.publishedAt || null
        })
        match.findingId = finding.id

        await createEvidenceItem({
          findingId: finding.id,
          evidenceType: 'url_check_snapshot',
          excerpt: candidate.content || candidate.title,
          metadata: { ...candidate.metadata, checkedUrl: rawUrl },
          thumbnailUrl: candidate.media?.thumbnailUrl
        })
      }

      const platformStatus: ConnectorStatus[] = [
        { platform: 'youtube', capability: 'ready', code: 'ready', message: 'URL check completed' }
      ]
      await updateScanRun(scanRun.id, 'completed', platformStatus, { kind: 'url_check', url: rawUrl }, scored.length)

      try {
        await createNotification({
          userId,
          type: 'url_check_match',
          title: `URL check khớp ${scored.length} tài sản`,
          message: `Video "${candidate.title}" trùng với ${scored.length} brand asset`,
          payload: { scanId: scanRun.id, videoId, matches: scored.length }
        })
      } catch (err) {
        console.warn('Notification creation failed:', err)
      }
    }

    return NextResponse.json({
      video: {
        videoId,
        title: candidate.title,
        url: candidate.url,
        channelTitle: (candidate.author?.name) || '',
        channelId: (candidate.author?.id) || '',
        thumbnailUrl: candidate.media?.thumbnailUrl,
        publishedAt: candidate.publishedAt,
        duration: lookup.raw.duration,
        viewCount: lookup.raw.viewCount
      },
      matches: scored,
      topScore: scored[0]?.riskScore ?? 0,
      assetsChecked: assets.length,
      scanRunId
    })
  } catch (error) {
    console.error('check-url POST error:', error)
    return NextResponse.json({ error: 'internal_error', message: 'Internal server error' }, { status: 500 })
  }
}
