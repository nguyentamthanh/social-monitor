import { query, queryOne } from '@/lib/neon'
import { Platform } from '@/types'

export interface Keyword {
  id: number
  user_id: string
  term: string
  platforms: string[]
  status: string
  refresh_interval: number
  last_fetched_at: Date | null
  created_at: Date
}

export async function findKeywordsByUserId(userId: string): Promise<Keyword[]> {
  return query<Keyword>('SELECT * FROM keywords WHERE user_id = $1 ORDER BY created_at DESC', [userId])
}

export async function findKeywordById(id: number): Promise<Keyword | null> {
  return queryOne<Keyword>('SELECT * FROM keywords WHERE id = $1', [id])
}

export async function createKeyword(
  userId: string,
  term: string,
  platforms: Platform[],
  refreshInterval: number = 3600000
): Promise<Keyword> {
  const result = await queryOne<Keyword>(
    `INSERT INTO keywords (user_id, term, platforms, status, refresh_interval, last_fetched_at)
     VALUES ($1, $2, $3, 'active', $4, NOW())
     RETURNING *`,
    [userId, term, platforms, refreshInterval]
  )
  return result!
}

export async function updateKeywordLastFetched(id: number): Promise<void> {
  await query('UPDATE keywords SET last_fetched_at = NOW() WHERE id = $1', [id])
}