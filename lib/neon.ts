import { Pool } from 'pg'

const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL!

if (!NEON_DATABASE_URL) {
  throw new Error('Please define the NEON_DATABASE_URL environment variable')
}

const pool = new Pool({
  connectionString: NEON_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params)
  return result.rows as T[]
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const result = await pool.query(text, params)
  return (result.rows[0] as T) || null
}

export { pool }