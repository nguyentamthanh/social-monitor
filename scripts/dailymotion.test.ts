import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDailymotionQuery, parseIsoDuration } from '../lib/copyright/dailymotion'

test('buildDailymotionQuery giữ tối đa 8 token có nghĩa', () => {
  const q = buildDailymotionQuery('Luis Fonsi - Despacito ft. Daddy Yankee (Official Video) (4K)')
  const tokens = q.split(' ')
  assert.equal(tokens.length <= 8, true)
  assert.equal(q.includes('despacito'), true)
})

test('buildDailymotionQuery bỏ token quá ngắn', () => {
  const q = buildDailymotionQuery('A B C Despacito')
  assert.equal(q.split(' ').every(t => t.length >= 3), true)
})

test('buildDailymotionQuery trả rỗng cho tiêu đề rỗng', () => {
  assert.equal(buildDailymotionQuery(''), '')
})

test('parseIsoDuration đọc đúng định dạng YouTube', () => {
  assert.equal(parseIsoDuration('PT4M33S'), 273)
  assert.equal(parseIsoDuration('PT1H2M3S'), 3723)
  assert.equal(parseIsoDuration('PT45S'), 45)
})

test('parseIsoDuration trả null cho input hỏng hoặc rỗng', () => {
  assert.equal(parseIsoDuration(''), null)
  assert.equal(parseIsoDuration(undefined), null)
  assert.equal(parseIsoDuration('not-a-duration'), null)
  assert.equal(parseIsoDuration('PT0S'), null)
})
