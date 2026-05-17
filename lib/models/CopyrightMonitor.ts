import { query, queryOne } from '@/lib/neon'
import {
  BrandAsset,
  ConnectorStatus,
  CopyrightAssetType,
  Finding,
  FindingReason,
  FindingStatus,
  Platform,
  ScanRun,
  ScanStatus,
  ScanTrigger
} from '@/types'

export interface BrandAssetInput {
  userId: string
  name: string
  assetType: CopyrightAssetType
  keywords: string[]
  textContent?: string | null
  officialDomains: string[]
  fileName?: string | null
  filePath?: string | null
  fileMimeType?: string | null
  fileSize?: number | null
  fileHash?: string | null
  perceptualHash?: string | null
  audioMetadata?: { title?: string; artist?: string; album?: string } | null
}

export interface BrandAssetUpdate {
  name?: string
  keywords?: string[]
  textContent?: string | null
  officialDomains?: string[]
  status?: 'active' | 'paused'
  audioMetadata?: { title?: string; artist?: string; album?: string } | null
}

export async function findAssetsByUserId(userId: string): Promise<BrandAsset[]> {
  return query<BrandAsset>(
    `SELECT * FROM brand_assets
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  )
}

export async function findAssetById(userId: string, id: number): Promise<BrandAsset | null> {
  return queryOne<BrandAsset>(
    `SELECT * FROM brand_assets WHERE user_id = $1 AND id = $2`,
    [userId, id]
  )
}

export async function findActiveAssetsByIds(userId: string, assetIds?: number[]): Promise<BrandAsset[]> {
  const params: any[] = [userId]
  const conditions = [`user_id = $1`, `status = 'active'`]

  if (assetIds && assetIds.length > 0) {
    params.push(assetIds)
    conditions.push(`id = ANY($2)`)
  }

  return query<BrandAsset>(
    `SELECT * FROM brand_assets
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC`,
    params
  )
}

export async function createBrandAsset(input: BrandAssetInput): Promise<BrandAsset> {
  const result = await queryOne<BrandAsset>(
    `INSERT INTO brand_assets (
       user_id, name, asset_type, keywords, text_content, official_domains,
       file_name, file_path, file_mime_type, file_size, file_hash, perceptual_hash, audio_metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      input.userId,
      input.name,
      input.assetType,
      input.keywords,
      input.textContent || null,
      input.officialDomains,
      input.fileName || null,
      input.filePath || null,
      input.fileMimeType || null,
      input.fileSize || null,
      input.fileHash || null,
      input.perceptualHash || null,
      input.audioMetadata ? JSON.stringify(input.audioMetadata) : null
    ]
  )

  return result!
}

export async function updateBrandAsset(userId: string, id: number, update: BrandAssetUpdate): Promise<BrandAsset | null> {
  const fields: string[] = []
  const params: any[] = [userId, id]
  let idx = 3

  if (update.name !== undefined) { fields.push(`name = $${idx++}`); params.push(update.name) }
  if (update.keywords !== undefined) { fields.push(`keywords = $${idx++}`); params.push(update.keywords) }
  if (update.textContent !== undefined) { fields.push(`text_content = $${idx++}`); params.push(update.textContent) }
  if (update.officialDomains !== undefined) { fields.push(`official_domains = $${idx++}`); params.push(update.officialDomains) }
  if (update.status !== undefined) { fields.push(`status = $${idx++}`); params.push(update.status) }
  if (update.audioMetadata !== undefined) { fields.push(`audio_metadata = $${idx++}`); params.push(update.audioMetadata ? JSON.stringify(update.audioMetadata) : null) }

  if (fields.length === 0) return findAssetById(userId, id)

  fields.push(`updated_at = NOW()`)

  return queryOne<BrandAsset>(
    `UPDATE brand_assets SET ${fields.join(', ')}
     WHERE user_id = $1 AND id = $2
     RETURNING *`,
    params
  )
}

export async function deleteBrandAsset(userId: string, id: number): Promise<boolean> {
  const result = await queryOne<{ id: number }>(
    `DELETE FROM brand_assets WHERE user_id = $1 AND id = $2 RETURNING id`,
    [userId, id]
  )
  return !!result
}

export async function createScanRun(input: {
  userId: string
  trigger: ScanTrigger
  assetIds: number[]
}): Promise<ScanRun> {
  const result = await queryOne<ScanRun>(
    `INSERT INTO scan_runs (user_id, trigger, status, asset_ids)
     VALUES ($1, $2, 'running', $3)
     RETURNING *`,
    [input.userId, input.trigger, input.assetIds]
  )

  return result!
}

export async function updateScanRun(
  id: number,
  status: ScanStatus,
  platformStatus: ConnectorStatus[],
  errorSummary: Record<string, unknown> = {},
  findingsCount = 0
): Promise<ScanRun> {
  const result = await queryOne<ScanRun>(
    `UPDATE scan_runs
     SET status = $2, platform_status = $3, error_summary = $4, findings_count = $5, finished_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status, JSON.stringify(platformStatus), JSON.stringify(errorSummary), findingsCount]
  )

  return result!
}

export async function findScanRunById(userId: string, id: number): Promise<ScanRun | null> {
  return queryOne<ScanRun>(
    `SELECT * FROM scan_runs WHERE user_id = $1 AND id = $2`,
    [userId, id]
  )
}

export async function findScanRunsByUserId(userId: string, limit = 25): Promise<ScanRun[]> {
  return query<ScanRun>(
    `SELECT * FROM scan_runs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  )
}

export interface FindingInput {
  userId: string
  scanRunId: number
  assetId: number
  platform: Platform
  source: string
  externalId: string
  title: string
  content: string
  url: string
  author?: Record<string, unknown> | null
  riskScore: number
  reasons: FindingReason[]
  publishedAt?: Date | null
}

export async function upsertFinding(input: FindingInput): Promise<Finding> {
  const result = await queryOne<Finding>(
    `INSERT INTO findings (
       user_id, scan_run_id, asset_id, platform, source, external_id, title,
       content, url, author, risk_score, reasons, published_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (user_id, asset_id, platform, external_id)
     DO UPDATE SET
       scan_run_id = EXCLUDED.scan_run_id,
       source = EXCLUDED.source,
       title = EXCLUDED.title,
       content = EXCLUDED.content,
       url = EXCLUDED.url,
       author = EXCLUDED.author,
       risk_score = EXCLUDED.risk_score,
       reasons = EXCLUDED.reasons,
       published_at = EXCLUDED.published_at,
       updated_at = NOW()
     RETURNING *`,
    [
      input.userId,
      input.scanRunId,
      input.assetId,
      input.platform,
      input.source,
      input.externalId,
      input.title,
      input.content,
      input.url,
      input.author ? JSON.stringify(input.author) : null,
      input.riskScore,
      JSON.stringify(input.reasons),
      input.publishedAt || null
    ]
  )

  return result!
}

export async function createEvidenceItem(input: {
  findingId: number
  evidenceType: string
  excerpt?: string
  metadata?: Record<string, unknown>
  thumbnailUrl?: string
  fileHash?: string
}): Promise<void> {
  await query(
    `INSERT INTO evidence_items (finding_id, evidence_type, excerpt, metadata, thumbnail_url, file_hash)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.findingId,
      input.evidenceType,
      input.excerpt || null,
      JSON.stringify(input.metadata || {}),
      input.thumbnailUrl || null,
      input.fileHash || null
    ]
  )
}

export async function findFindings(filters: {
  userId: string
  status?: FindingStatus
  platform?: Platform
  limit?: number
  offset?: number
}): Promise<{ findings: Finding[]; total: number }> {
  const params: any[] = [filters.userId]
  const conditions = ['f.user_id = $1']
  let paramIndex = 2

  if (filters.status) {
    conditions.push(`f.status = $${paramIndex++}`)
    params.push(filters.status)
  }

  if (filters.platform) {
    conditions.push(`f.platform = $${paramIndex++}`)
    params.push(filters.platform)
  }

  const whereClause = conditions.join(' AND ')
  const limit = filters.limit || 50
  const offset = filters.offset || 0

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM findings f WHERE ${whereClause}`,
    params
  )

  const findings = await query<Finding>(
    `SELECT f.*, a.name as asset_name, a.asset_type
     FROM findings f
     LEFT JOIN brand_assets a ON a.id = f.asset_id
     WHERE ${whereClause}
     ORDER BY f.risk_score DESC, f.found_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  )

  return {
    findings,
    total: parseInt(countResult?.count || '0')
  }
}

export async function updateFindingStatus(
  userId: string,
  id: number,
  status: FindingStatus
): Promise<Finding | null> {
  return queryOne<Finding>(
    `UPDATE findings
     SET status = $3, updated_at = NOW()
     WHERE user_id = $1 AND id = $2
     RETURNING *`,
    [userId, id, status]
  )
}

export async function deleteFinding(userId: string, id: number): Promise<boolean> {
  const result = await queryOne<{ id: number }>(
    `DELETE FROM findings WHERE user_id = $1 AND id = $2 RETURNING id`,
    [userId, id]
  )
  return !!result
}
