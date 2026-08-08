import test from 'node:test'
import assert from 'node:assert/strict'

import { createTikTokResearchAdapterForTest } from '../lib/copyright/adapters'
import { EMPTY_API_KEYS } from '../lib/copyright/apiKeys'

test('tiktok research adapter: status limited khi thiếu token', () => {
  const adapter = createTikTokResearchAdapterForTest()
  const status = adapter.status(EMPTY_API_KEYS)
  assert.equal(status.capability, 'limited')
  assert.equal(status.code, 'config_missing')
})

test('tiktok research adapter: status ready khi có token', () => {
  const adapter = createTikTokResearchAdapterForTest()
  const status = adapter.status({ ...EMPTY_API_KEYS, tiktokToken: 'dummy_token' })
  assert.equal(status.capability, 'ready')
})
