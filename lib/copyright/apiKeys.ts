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
  /** true nếu youtubeApiKey đang là key chung của hệ thống (env), không phải key user tự nhập. */
  youtubeApiKeyIsShared?: boolean
  /** true nếu user không có key riêng và đã dùng hết lượt quét YouTube miễn phí bằng key chung. */
  youtubeFreeScanUsed?: boolean
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

/** Các field key dạng chuỗi thật sự đọc từ env/Cài đặt — khác với 2 cờ suy ra (`...IsShared`, `...Used`). */
export type ScanApiKeyField = 'youtubeApiKey' | 'googleSearchApiKey' | 'googleSearchEngineId' | 'facebookToken' | 'tiktokToken'

/** Ghép key rời (đã giải mã) lên trên nền env — ô nào trống thì rơi về env. */
export function mergeApiKeys(base: ScanApiKeys, overrides: Partial<Record<ScanApiKeyField, string | undefined>>): ScanApiKeys {
  const merged = { ...base }
  for (const [field, value] of Object.entries(overrides) as [ScanApiKeyField, string | undefined][]) {
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
    const { getUserSettings, getDecryptedKey, YOUTUBE_FREE_SCAN_PREF_KEY } = await import('@/lib/models/UserSettings')
    // User mới toanh (chưa từng bấm Lưu ở Cài đặt) không có row nào ở
    // user_settings — vẫn phải tính cờ "đang dùng key chung" cho họ, không
    // được return sớm ở đây, kẻo mọi user mới đều lọt qua gate vô thời hạn.
    const settings = await getUserSettings(String(userId))

    const ownYoutubeKey = settings ? getDecryptedKey(settings, 'youtube_api_key') : ''
    const merged = settings
      ? mergeApiKeys(envKeys, {
          youtubeApiKey: ownYoutubeKey,
          googleSearchApiKey: getDecryptedKey(settings, 'google_search_api_key'),
          googleSearchEngineId: getDecryptedKey(settings, 'google_search_engine_id'),
          facebookToken: getDecryptedKey(settings, 'facebook_token'),
          tiktokToken: getDecryptedKey(settings, 'tiktok_token')
        })
      : { ...envKeys }

    // Không có key riêng ⇒ đang chạy bằng key chung (env). Quota 10.000
    // unit/ngày của key đó dùng chung cho MỌI user như vậy, nên chỉ cho
    // đúng 1 lần quét miễn phí mỗi tài khoản — xem markYoutubeFreeScanUsed.
    if (merged.youtubeApiKey && !ownYoutubeKey) {
      merged.youtubeApiKeyIsShared = true
      merged.youtubeFreeScanUsed = !!(settings?.preferences as Record<string, unknown> | undefined)?.[YOUTUBE_FREE_SCAN_PREF_KEY]
    }

    return merged
  } catch (error) {
    console.error('resolveApiKeys: không đọc được user_settings, dùng env:', error)
    return envKeys
  }
}
