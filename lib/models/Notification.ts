import { query, queryOne } from '@/lib/neon'
import { Notification } from '@/types'

export async function createNotification(input: {
  userId: string
  type: string
  title: string
  message?: string
  payload?: Record<string, unknown>
}): Promise<Notification> {
  const result = await queryOne<Notification>(
    `INSERT INTO notifications (user_id, type, title, message, payload)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.userId,
      input.type,
      input.title,
      input.message || null,
      JSON.stringify(input.payload || {})
    ]
  )
  return result!
}

export async function listNotifications(userId: string, limit = 10): Promise<{ items: Notification[]; unread: number }> {
  const items = await query<Notification>(
    `SELECT * FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  )

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  )

  return { items, unread: parseInt(countRow?.count || '0', 10) }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await query(
    `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  )
}
