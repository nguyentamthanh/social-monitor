import {
  createEvidenceItem,
  createScanRun,
  findActiveAssetsByIds,
  updateScanRun,
  upsertFinding
} from '@/lib/models/CopyrightMonitor'
import { copyrightAdapters, getConnectorStatuses } from '@/lib/copyright/adapters'
import { scoreCandidate } from '@/lib/copyright/scoring'
import { createNotification } from '@/lib/models/Notification'
import { ConnectorStatus, Platform, ScanRun } from '@/types'

const DEFAULT_PLATFORMS: Platform[] = ['youtube', 'google', 'facebook', 'tiktok']
const MIN_FINDING_SCORE = 30

export async function runCopyrightScan(input: {
  userId: string
  assetIds?: number[]
  platforms?: Platform[]
}): Promise<{ scanRun: ScanRun; findingsCreated: number }> {
  const platforms = input.platforms && input.platforms.length > 0 ? input.platforms : DEFAULT_PLATFORMS
  const assets = await findActiveAssetsByIds(input.userId, input.assetIds)
  const scanRun = await createScanRun({
    userId: input.userId,
    trigger: 'manual',
    assetIds: assets.map(asset => asset.id)
  })

  if (assets.length === 0) {
    const completedRun = await updateScanRun(
      scanRun.id,
      'completed',
      getConnectorStatuses(platforms),
      { message: 'No active assets to scan' },
      0
    )
    return { scanRun: completedRun, findingsCreated: 0 }
  }

  const platformStatus: ConnectorStatus[] = []
  let findingsCreated = 0
  const errors: Record<string, string> = {}

  for (const platform of platforms) {
    const adapter = copyrightAdapters[platform]
    const status = adapter.status()

    if (status.capability !== 'ready') {
      platformStatus.push(status)
      continue
    }

    try {
      const seen = new Set<string>()
      for (const asset of assets) {
        const candidates = await adapter.search(asset)
        for (const candidate of candidates) {
          const dedupeKey = `${asset.id}:${candidate.platform}:${candidate.externalId || candidate.url}`
          if (seen.has(dedupeKey)) {
            continue
          }
          seen.add(dedupeKey)

          const score = scoreCandidate(asset, candidate)
          if (score.riskScore < MIN_FINDING_SCORE) {
            continue
          }

          const finding = await upsertFinding({
            userId: input.userId,
            scanRunId: scanRun.id,
            assetId: asset.id,
            platform: candidate.platform,
            source: candidate.source,
            externalId: candidate.externalId || candidate.url,
            title: candidate.title || candidate.content.slice(0, 120) || 'Untitled candidate',
            content: candidate.content || candidate.title,
            url: candidate.url,
            author: candidate.author ? { ...candidate.author } : null,
            riskScore: score.riskScore,
            reasons: score.reasons,
            publishedAt: candidate.publishedAt || null
          })

          await createEvidenceItem({
            findingId: finding.id,
            evidenceType: 'source_snapshot',
            excerpt: candidate.content || candidate.title,
            metadata: candidate.metadata || {},
            thumbnailUrl: candidate.media?.thumbnailUrl,
            fileHash: candidate.media?.hash
          })

          findingsCreated += 1
        }
      }

      platformStatus.push(status)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown connector error'
      errors[platform] = message
      platformStatus.push({
        platform,
        capability: 'error',
        code: 'connector_error',
        message
      })
    }
  }

  const finalStatus = Object.keys(errors).length === platforms.length ? 'failed' : 'completed'
  const completedRun = await updateScanRun(scanRun.id, finalStatus, platformStatus, errors, findingsCreated)

  if (findingsCreated > 0) {
    try {
      await createNotification({
        userId: input.userId,
        type: 'scan_completed',
        title: `Phát hiện ${findingsCreated} vi phạm`,
        message: `Lần quét #${scanRun.id} hoàn thành với ${findingsCreated} kết quả rủi ro`,
        payload: { scanId: scanRun.id, findingsCreated }
      })
    } catch (err) {
      console.warn('Notification creation failed:', err)
    }
  }

  return {
    scanRun: completedRun,
    findingsCreated
  }
}
