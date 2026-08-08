import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveFindCopiesOptions } from '../app/api/scans/quick/resolveFindCopiesOptions'
import { buildFindCopiesInternalsForTest } from '../lib/copyright/findCopies'

test('resolveFindCopiesOptions: fast -> chỉ tắt deepMediaCheck, giữ thumbnailMatch', () => {
  // thumbnailMatch không còn bị tắt ở fast kể từ khi pHash được tối ưu
  // (imageHash.ts, Phase 0) — nó rẻ, và Dailymotion phụ thuộc vào
  // original.thumbnailHash mà bước này tính ra.
  assert.deepEqual(resolveFindCopiesOptions('fast'), { deepMediaCheck: false })
})

test('resolveFindCopiesOptions: deep/undefined -> bật deepMediaCheck', () => {
  assert.deepEqual(resolveFindCopiesOptions('deep'), { deepMediaCheck: true })
  assert.deepEqual(resolveFindCopiesOptions(undefined), { deepMediaCheck: true })
})

test('findCopies internals: thumbnailMatch=false -> wantPHash=false', () => {
  const internals = buildFindCopiesInternalsForTest({ thumbnailMatch: false })
  assert.equal(internals.wantPHash, false)
})

test('findCopies internals: thumbnailMatch undefined -> wantPHash=true', () => {
  const internals = buildFindCopiesInternalsForTest({})
  assert.equal(internals.wantPHash, true)
})
