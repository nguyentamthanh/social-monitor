import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_DAILY_BUDGET,
  YOUTUBE_COST,
  resolveDailyBudget,
  snapshot
} from '../lib/copyright/quota'

test('resolveDailyBudget: mặc định 10.000 unit khi không cấu hình', () => {
  assert.equal(resolveDailyBudget(null), DEFAULT_DAILY_BUDGET)
  assert.equal(resolveDailyBudget({}), DEFAULT_DAILY_BUDGET)
})

test('resolveDailyBudget: giá trị vô lý rơi về mặc định', () => {
  assert.equal(resolveDailyBudget({ youtubeDailyQuota: 0 }), DEFAULT_DAILY_BUDGET)
  assert.equal(resolveDailyBudget({ youtubeDailyQuota: -5 }), DEFAULT_DAILY_BUDGET)
  assert.equal(resolveDailyBudget({ youtubeDailyQuota: 'không phải số' }), DEFAULT_DAILY_BUDGET)
})

test('resolveDailyBudget: nhận số hợp lệ, kể cả dạng chuỗi', () => {
  assert.equal(resolveDailyBudget({ youtubeDailyQuota: 500 }), 500)
  assert.equal(resolveDailyBudget({ youtubeDailyQuota: '2500' }), 2500)
  assert.equal(resolveDailyBudget({ youtubeDailyQuota: 999.9 }), 999)
})

test('snapshot: chưa dùng gì thì không chặn, không cảnh báo', () => {
  const s = snapshot(0, 10000)
  assert.equal(s.remaining, 10000)
  assert.equal(s.exceeded, false)
  assert.equal(s.nearLimit, false)
})

test('snapshot: cảnh báo từ mốc 80% hạn mức', () => {
  assert.equal(snapshot(7999, 10000).nearLimit, false)
  assert.equal(snapshot(8000, 10000).nearLimit, true)
})

test('snapshot: chạm đúng hạn mức là đã bị chặn', () => {
  assert.equal(snapshot(9999, 10000).exceeded, false)
  assert.equal(snapshot(10000, 10000).exceeded, true)
  assert.equal(snapshot(12000, 10000).exceeded, true)
})

test('snapshot: remaining không bao giờ âm', () => {
  assert.equal(snapshot(12000, 10000).remaining, 0)
})

test('một lần quét YouTube 6 truy vấn tốn 600 unit — hết quota sau 16 lần', () => {
  const perScan = 6 * YOUTUBE_COST.search
  assert.equal(perScan, 600)
  assert.equal(snapshot(perScan * 16, DEFAULT_DAILY_BUDGET).exceeded, false)
  assert.equal(snapshot(perScan * 17, DEFAULT_DAILY_BUDGET).exceeded, true)
})
