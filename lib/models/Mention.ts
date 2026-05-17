import { query, queryOne } from '@/lib/neon'
import { Platform, Author, Metrics } from '@/types'

export interface Mention {
  id: number
  keyword_id: number
  platform: Platform
  external_id: string
  author: Author
  content: string
  url: string
  metrics: Metrics
  published_at: Date
  fetched_at: Date
}

export interface MentionWithKeyword extends Mention {
  keyword_term?: string
}

export async function findMentions(filters: {
  keywordId?: number
  platform?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}): Promise<{ mentions: Mention[]; total: number }> {
  const conditions: string[] = []
  const params: any[] = []
  let paramIndex = 1

  if (filters.keywordId) {
    conditions.push(`keyword_id = $${paramIndex++}`)
    params.push(filters.keywordId)
  }

  if (filters.platform) {
    conditions.push(`platform = $${paramIndex++}`)
    params.push(filters.platform)
  }

  if (filters.startDate) {
    conditions.push(`published_at >= $${paramIndex++}`)
    params.push(filters.startDate)
  }

  if (filters.endDate) {
    conditions.push(`published_at <= $${paramIndex++}`)
    params.push(filters.endDate)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit || 50
  const offset = filters.offset || 0

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM mentions ${whereClause}`,
    params
  )
  const total = parseInt(countResult?.count || '0')

  const mentions = await query<Mention>(
    `SELECT * FROM mentions ${whereClause}
     ORDER BY published_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  )

  return { mentions, total }
}

export async function insertMentions(mentions: Array<{
  keywordId: number
  platform: Platform
  externalId: string
  author: Author
  content: string
  url: string
  metrics: Metrics
  publishedAt: Date
}>): Promise<void> {
  if (mentions.length === 0) return

  const values = mentions.map((m, i) => {
    const base = i * 9
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`
  }).join(', ')

  const params: any[] = []
  for (const m of mentions) {
    params.push(
      m.keywordId,
      m.platform,
      m.externalId,
      JSON.stringify(m.author),
      m.content,
      m.url,
      JSON.stringify(m.metrics),
      m.publishedAt,
      new Date()
    )
  }

  await query(
    `INSERT INTO mentions (keyword_id, platform, external_id, author, content, url, metrics, published_at, fetched_at)
     VALUES ${values}`,
    params
  )
}

export async function countMentionsByKeywordIds(keywordIds: number[]): Promise<number> {
  if (keywordIds.length === 0) return 0
  const result = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM mentions WHERE keyword_id = ANY($1)',
    [keywordIds]
  )
  return parseInt(result?.count || '0')
}

export async function findRecentMentions(keywordIds: number[], limit: number = 10): Promise<MentionWithKeyword[]> {
  return query<MentionWithKeyword>(
    `SELECT m.*, k.term as keyword_term
     FROM mentions m
     LEFT JOIN keywords k ON m.keyword_id = k.id
     WHERE m.keyword_id = ANY($1)
     ORDER BY m.published_at DESC
     LIMIT $2`,
    [keywordIds, limit]
  )
}