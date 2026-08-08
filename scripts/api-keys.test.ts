import test from 'node:test'
import assert from 'node:assert/strict'

import { apiKeysFromEnv, mergeApiKeys, EMPTY_API_KEYS } from '../lib/copyright/apiKeys'

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  try {
    fn()
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

test('apiKeysFromEnv: placeholder trong .env.example bị coi là chưa cấu hình', () => {
  withEnv({ YOUTUBE_API_KEY: 'your_youtube_api_key_here' }, () => {
    assert.equal(apiKeysFromEnv().youtubeApiKey, '')
  })
})

test('apiKeysFromEnv: chuỗi rỗng và khoảng trắng đều là chưa cấu hình', () => {
  withEnv({ YOUTUBE_API_KEY: '   ', GOOGLE_SEARCH_ENGINE_ID: '' }, () => {
    const keys = apiKeysFromEnv()
    assert.equal(keys.youtubeApiKey, '')
    assert.equal(keys.googleSearchEngineId, '')
  })
})

test('apiKeysFromEnv: GOOGLE_API_KEY là fallback của GOOGLE_SEARCH_API_KEY', () => {
  withEnv({ GOOGLE_SEARCH_API_KEY: undefined, GOOGLE_API_KEY: 'legacy-key' }, () => {
    assert.equal(apiKeysFromEnv().googleSearchApiKey, 'legacy-key')
  })
  withEnv({ GOOGLE_SEARCH_API_KEY: 'new-key', GOOGLE_API_KEY: 'legacy-key' }, () => {
    assert.equal(apiKeysFromEnv().googleSearchApiKey, 'new-key')
  })
})

test('mergeApiKeys: key của user thắng env', () => {
  const env = { ...EMPTY_API_KEYS, youtubeApiKey: 'from-env' }
  const merged = mergeApiKeys(env, { youtubeApiKey: 'from-user-settings' })
  assert.equal(merged.youtubeApiKey, 'from-user-settings')
})

test('mergeApiKeys: ô trống của user rơi về env, không xoá mất key', () => {
  const env = { ...EMPTY_API_KEYS, youtubeApiKey: 'from-env', googleSearchApiKey: 'g-env' }
  const merged = mergeApiKeys(env, { youtubeApiKey: '', googleSearchApiKey: undefined })
  assert.equal(merged.youtubeApiKey, 'from-env')
  assert.equal(merged.googleSearchApiKey, 'g-env')
})

test('mergeApiKeys: không làm thay đổi object gốc', () => {
  const env = { ...EMPTY_API_KEYS, youtubeApiKey: 'from-env' }
  mergeApiKeys(env, { youtubeApiKey: 'other' })
  assert.equal(env.youtubeApiKey, 'from-env')
})
