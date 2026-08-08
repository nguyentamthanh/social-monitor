/**
 * Đếm quota YouTube Data API đã tiêu theo user/ngày.
 *
 * Vì sao cần: mỗi lần quét sinh tới 6 truy vấn `search.list`, mỗi truy vấn tốn
 * 100 unit ⇒ ~600 unit/lần. Quota mặc định của Google là 10.000 unit/ngày, tức
 * chỉ khoảng 16 lần quét. Không đếm thì key sẽ chết giữa chừng và người dùng chỉ
 * thấy "quét không ra kết quả" mà không hiểu vì sao.
 *
 * Bảng giá quota: https://developers.google.com/youtube/v3/determine_quota_cost
 */
export const YOUTUBE_COST = {
  /** `search.list` — đắt nhất, dùng khi tìm video tương tự. */
  search: 100,
  /** `videos.list` — lấy metadata 1 video. */
  videos: 1
} as const

export const DEFAULT_DAILY_BUDGET = 10000

/** Ngưỡng cảnh báo trước khi chạm trần. */
export const WARN_RATIO = 0.8

export interface QuotaSnapshot {
  used: number
  budget: number
  remaining: number
  exceeded: boolean
  nearLimit: boolean
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

export function resolveDailyBudget(preferences?: Record<string, unknown> | null): number {
  const raw = preferences?.youtubeDailyQuota
  const value = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_DAILY_BUDGET
  return Math.floor(value)
}

export function snapshot(used: number, budget: number): QuotaSnapshot {
  const remaining = Math.max(0, budget - used)
  return {
    used,
    budget,
    remaining,
    exceeded: used >= budget,
    nearLimit: used >= budget * WARN_RATIO
  }
}

export async function getUsedUnits(userId: string, provider = 'youtube'): Promise<number> {
  try {
    // Import động: `neon` throw ngay lúc load nếu thiếu NEON_DATABASE_URL —
    // nạp lười để phần tính toán thuần tuý ở trên vẫn unit-test được.
    const { queryOne } = await import('@/lib/neon')
    const row = await queryOne<{ units: number }>(
      `SELECT units FROM api_usage WHERE user_id = $1 AND provider = $2 AND usage_date = $3`,
      [userId, provider, todayUTC()]
    )
    return Number(row?.units || 0)
  } catch (error) {
    // Không chặn việc quét chỉ vì bảng đếm lỗi.
    console.error('getUsedUnits error:', error)
    return 0
  }
}

export async function getQuota(
  userId: string,
  preferences?: Record<string, unknown> | null,
  provider = 'youtube'
): Promise<QuotaSnapshot> {
  return snapshot(await getUsedUnits(userId, provider), resolveDailyBudget(preferences))
}

/** Cộng dồn unit đã tiêu. Lỗi ở đây chỉ log, không làm hỏng lượt quét. */
export async function recordUsage(userId: string, units: number, provider = 'youtube'): Promise<void> {
  if (units <= 0) return
  try {
    const { query } = await import('@/lib/neon')
    await query(
      `INSERT INTO api_usage (user_id, provider, usage_date, units, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, provider, usage_date)
       DO UPDATE SET units = api_usage.units + EXCLUDED.units, updated_at = NOW()`,
      [userId, provider, todayUTC(), units]
    )
  } catch (error) {
    console.error('recordUsage error:', error)
  }
}
