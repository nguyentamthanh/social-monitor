import { queryOne } from '@/lib/neon'
import { decrypt, encrypt, maskKey } from '@/lib/crypto'
import { UserSettings } from '@/types'

const KEY_FIELDS = ['youtube_api_key', 'google_search_api_key', 'google_search_engine_id', 'facebook_token', 'tiktok_token']

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const row = await queryOne<any>(
    `SELECT * FROM user_settings WHERE user_id = $1`,
    [userId]
  )
  if (!row) return null
  return {
    ...row,
    api_keys: row.api_keys || {}
  }
}

export async function upsertUserSettings(input: {
  userId: string
  apiKeys?: Record<string, string>
  preferences?: Record<string, unknown>
}): Promise<UserSettings> {
  // Encrypt API keys before storing
  const encryptedKeys: Record<string, string> = {}
  if (input.apiKeys) {
    for (const [key, value] of Object.entries(input.apiKeys)) {
      if (!KEY_FIELDS.includes(key)) continue
      if (typeof value === 'string' && value && !value.startsWith('mask:')) {
        encryptedKeys[key] = encrypt(value)
      }
    }
  }

  const existing = await getUserSettings(input.userId)
  const mergedKeys = { ...(existing?.api_keys || {}), ...encryptedKeys }
  const mergedPrefs = { ...(existing?.preferences || {}), ...(input.preferences || {}) }

  const result = await queryOne<UserSettings>(
    `INSERT INTO user_settings (user_id, api_keys, preferences, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       api_keys = EXCLUDED.api_keys,
       preferences = EXCLUDED.preferences,
       updated_at = NOW()
     RETURNING *`,
    [input.userId, JSON.stringify(mergedKeys), JSON.stringify(mergedPrefs)]
  )
  return result!
}

export function getDecryptedKey(settings: UserSettings | null, key: string): string {
  const encrypted = settings?.api_keys?.[key]
  if (!encrypted) return ''
  return decrypt(encrypted)
}

export function maskedSettings(settings: UserSettings | null): { apiKeys: Record<string, string>; preferences: Record<string, unknown> } {
  const apiKeys: Record<string, string> = {}
  for (const key of KEY_FIELDS) {
    const encrypted = settings?.api_keys?.[key]
    if (encrypted) {
      const decrypted = decrypt(encrypted)
      apiKeys[key] = decrypted ? maskKey(decrypted) : ''
    } else {
      apiKeys[key] = ''
    }
  }
  return {
    apiKeys,
    preferences: settings?.preferences || {}
  }
}
