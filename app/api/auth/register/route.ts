import { NextRequest, NextResponse } from 'next/server'
import { findUserByEmail, createUser } from '@/lib/models/User'
import { initializeDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()

    const body = await request.json()
    const { email, name, password } = body

    if (!email || !name || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const existingUser = await findUserByEmail(email)
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 })
    }

    const user = await createUser(email, name, password)

    return NextResponse.json({
      id: user.id.toString(),
      email: user.email,
      name: user.name
    }, { status: 201 })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}