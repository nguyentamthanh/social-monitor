import { query, queryOne } from '@/lib/neon'
import bcrypt from 'bcryptjs'

export interface User {
  id: number
  email: string
  name: string
  password: string
  created_at: Date
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE email = $1', [email])
}

export async function createUser(email: string, name: string, password: string): Promise<User> {
  const hashedPassword = await bcrypt.hash(password, 12)
  const result = await queryOne<User>(
    'INSERT INTO users (email, name, password) VALUES ($1, $2, $3) RETURNING *',
    [email, name, hashedPassword]
  )
  return result!
}

export async function findUserById(id: number): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE id = $1', [id])
}