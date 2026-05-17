import { query, queryOne } from '@/lib/neon'
import { Platform } from '@/types'

export interface TrendData {
  id: number
  keyword_id: number
  platform: Platform | 'all'
  date: Date
  mention_count: number
  engagement: number
}

export async function createTrendData(data: {
  keywordId: number
  platform: Platform
  date: Date
  mentionCount: number
  engagement: number
}): Promise<TrendData> {
  const result = await queryOne<TrendData>(
    `INSERT INTO trend_data (keyword_id, platform, date, mention_count, engagement)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.keywordId, data.platform, data.date, data.mentionCount, data.engagement]
  )
  return result!
}

export async function aggregateTrendData(filters: {
  keywordIds: number[]
  platform?: string
  startDate?: Date
}): Promise<Array<{
  platform: string
  total_mentions: number
  total_engagement: number
}>> {
  const conditions: string[] = ['keyword_id = ANY($1)']
  const params: any[] = [filters.keywordIds]
  let paramIndex = 2

  if (filters.platform) {
    conditions.push(`platform = $${paramIndex++}`)
    params.push(filters.platform)
  }

  if (filters.startDate) {
    conditions.push(`date >= $${paramIndex++}`)
    params.push(filters.startDate)
  }

  return query<{ platform: string; total_mentions: number; total_engagement: number }>(
    `SELECT platform, SUM(mention_count) as total_mentions, SUM(engagement) as total_engagement
     FROM trend_data
     WHERE ${conditions.join(' AND ')}
     GROUP BY platform`,
    params
  )
}

export async function findTrendsByKeywordIds(
  keywordIds: number[],
  platform?: string,
  startDate?: Date
): Promise<Array<{
  date: string
  platform: string
  mention_count: number
  engagement: number
}>> {
  const conditions: string[] = ['keyword_id = ANY($1)']
  const params: any[] = [keywordIds]
  let paramIndex = 2

  if (platform) {
    conditions.push(`platform = $${paramIndex++}`)
    params.push(platform)
  }

  if (startDate) {
    conditions.push(`date >= $${paramIndex++}`)
    params.push(startDate)
  }

  return query<{ date: string; platform: string; mention_count: number; engagement: number }>(
    `SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, platform,
            SUM(mention_count) as mention_count, SUM(engagement) as engagement
     FROM trend_data
     WHERE ${conditions.join(' AND ')}
     GROUP BY TO_CHAR(date, 'YYYY-MM-DD'), platform
     ORDER BY date ASC`,
    params
  )
}