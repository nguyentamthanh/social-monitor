/**
 * Bộ key mà mọi connector quét bản quyền cần. Các adapter nhận object này qua
 * tham số thay vì tự đọc `process.env`, nhờ vậy key người dùng lưu ở trang
 * Cài đặt mới thực sự có tác dụng.
 */
export interface ScanApiKeys {
  youtubeApiKey: string
  googleSearchApiKey: string
  googleSearchEngineId: string
  facebookToken: string
  tiktokToken: string
}

/** Placeholder trong .env.example — coi như chưa cấu hình. */
const PLACEHOLDERS = new Set([
  'your_youtube_api_key_here',
  'your_google_api_key_here',
  'your_google_search_api_key_here',
  'your_search_engine_id_here',
  'your_facebook_access_token_here',
  'your_tiktok_access_token_here'
])

function clean(value: string | undefined | null): string {
  const v = (value || '').trim()
  return PLACEHOLDERS.has(v) ? '' : v
}

export const EMPTY_API_KEYS: ScanApiKeys = {
  youtubeApiKey: '',
  googleSearchApiKey: '',
  googleSearchEngineId: '',
  facebookToken: '',
  tiktokToken: ''
}

export function apiKeysFromEnv(): ScanApiKeys {
  return {
    youtubeApiKey: clean(process.env.YOUTUBE_API_KEY),
    googleSearchApiKey: clean(process.env.GOOGLE_SEARCH_API_KEY) || clean(process.env.GOOGLE_API_KEY),
    googleSearchEngineId: clean(process.env.GOOGLE_SEARCH_ENGINE_ID),
    facebookToken: clean(process.env.FACEBOOK_ACCESS_TOKEN),
    tiktokToken: clean(process.env.TIKTOK_ACCESS_TOKEN)
  }
}

/** Ghép key rời (đã giải mã) lên trên nền env — ô nào trống thì rơi về env. */
export function mergeApiKeys(base: ScanApiKeys, overrides: Partial<ScanApiKeys>): ScanApiKeys {
  const merged = { ...base }
  for (const [field, value] of Object.entries(overrides) as [keyof ScanApiKeys, string | undefined][]) {
    const v = clean(value)
    if (v) merged[field] = v
  }
  return merged
}

/**
 * Key của user (bảng `user_settings`, đã mã hoá AES) đè lên key trong env.
 * Nếu không có userId hoặc DB lỗi thì dùng nguyên env — quét vẫn chạy được
 * trong môi trường chỉ cấu hình bằng biến môi trường.
 */
export async function resolveApiKeys(userId?: string | null): Promise<ScanApiKeys> {
  const envKeys = apiKeysFromEnv()
  if (!userId) return envKeys

  try {
    // Import động: `UserSettings` kéo theo pool Postgres và sẽ throw ngay lúc
    // load module nếu thiếu NEON_DATABASE_URL. Nạp lười giữ cho các adapter và
    // unit test dùng được phần thuần tuý của file này mà không cần DB.
    const { getUserSettings, getDecryptedKey } = await import('@/lib/models/UserSettings')
    const settings = await getUserSettings(String(userId))
    if (!settings) return envKeys
    return mergeApiKeys(envKeys, {
      youtubeApiKey: getDecryptedKey(settings, 'youtube_api_key'),
      googleSearchApiKey: getDecryptedKey(settings, 'google_search_api_key'),
      googleSearchEngineId: getDecryptedKey(settings, 'google_search_engine_id'),
      facebookToken: getDecryptedKey(settings, 'facebook_token'),
      tiktokToken: getDecryptedKey(settings, 'tiktok_token')
    })
  } catch (error) {
    console.error('resolveApiKeys: không đọc được user_settings, dùng env:', error)
    return envKeys
  }
}
