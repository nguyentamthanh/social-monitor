import { query } from '../lib/neon'
import bcrypt from 'bcryptjs'

async function seed() {
  // Create demo user
  const hashedPassword = await bcrypt.hash('demo123456', 12)
  await query(
    `INSERT INTO users (email, name, password) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`,
    ['demo@demo.com', 'Demo User', hashedPassword]
  )

  // Get user id
  const user = await query<{ id: number }>(`SELECT id FROM users WHERE email = $1`, ['demo@demo.com'])
  if (!user[0]) {
    console.log('User not found')
    return
  }
  const userId = user[0].id.toString()

  // Create keywords
  const keywords = [
    { term: 'React', platforms: ['youtube', 'tiktok'] },
    { term: 'Next.js', platforms: ['youtube', 'google'] },
    { term: 'TypeScript', platforms: ['youtube', 'tiktok'] },
    { term: 'AI', platforms: ['youtube', 'google', 'tiktok'] },
    { term: 'Machine Learning', platforms: ['youtube', 'google'] }
  ]

  for (const kw of keywords) {
    const keyword = await query<{ id: number }>(
      `INSERT INTO keywords (user_id, term, platforms, status, last_fetched_at) VALUES ($1, $2, $3, 'active', NOW()) RETURNING id`,
      [userId, kw.term, kw.platforms]
    )

    if (keyword[0]) {
      const keywordId = keyword[0].id

      // Create mentions for each keyword
      const mentions = [
        { platform: 'youtube', content: `Amazing tutorial about ${kw.term}! Must watch!`, views: 50000, likes: 2500, comments: 450, shares: 120 },
        { platform: 'tiktok', content: `Quick tips on ${kw.term} #tech #coding`, views: 25000, likes: 1200, comments: 89, shares: 45 },
        { platform: 'youtube', content: `${kw.term} vs Vue.js - Which is better?`, views: 120000, likes: 8500, comments: 1200, shares: 340 },
        { platform: 'google', content: `Everything you need to know about ${kw.term}`, views: 0, likes: 0, comments: 0, shares: 0 },
      ]

      for (const m of mentions) {
        const publishedAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
        await query(
          `INSERT INTO mentions (keyword_id, platform, external_id, author, content, url, metrics, published_at, fetched_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            keywordId,
            m.platform,
            `ext_${Math.random().toString(36).substr(2, 9)}`,
            JSON.stringify({ id: '123', name: 'Tech Creator', handle: '@techcreator', avatar: '' }),
            m.content,
            `https://${m.platform}.com/watch?v=${Math.random().toString(36).substr(2, 9)}`,
            JSON.stringify({ views: m.views, likes: m.likes, comments: m.comments, shares: m.shares }),
            publishedAt
          ]
        )
      }

      // Create trend data
      for (let i = 30; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        await query(
          `INSERT INTO trend_data (keyword_id, platform, date, mention_count, engagement)
           VALUES ($1, $2, $3, $4, $5)`,
          [keywordId, kw.platforms[0], date, Math.floor(Math.random() * 50) + 10, Math.floor(Math.random() * 500) + 50]
        )
      }
    }
  }

  console.log('Seed data created successfully!')
  console.log('Login: demo@demo.com / demo123456')
}

seed().catch(console.error)
