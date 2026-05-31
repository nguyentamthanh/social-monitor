import test from 'node:test'
import assert from 'node:assert/strict'

import { createTikTokResearchAdapterForTest } from '../lib/copyright/adapters'

test('tiktok research adapter: status limited khi thiếu token', () => {
  const adapter = createTikTokResearchAdapterForTest(() => '')
  const status = adapter.status()
  assert.equal(status.capability, 'limited')
  assert.equal(status.code, 'config_missing')
})

test('tiktok research adapter: status ready khi có token', () => {
  const adapter = createTikTokResearchAdapterForTest(() => 'dummy_token')
  const status = adapter.status()
  assert.equal(status.capability, 'ready')
})

