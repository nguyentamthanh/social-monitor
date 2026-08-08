import test from 'node:test'
import assert from 'node:assert/strict'
import { compareFrameHashes } from '../lib/copyright/storyboard'

/** Hash 16 ký tự hex = 64 bit, đúng định dạng computePHash trả về. */
const h = (s: string) => s.padEnd(16, '0')

test('mảng rỗng không bao giờ báo khớp', () => {
  const r = compareFrameHashes([], [h('abc')])
  assert.equal(r.coverage, 0)
  assert.equal(r.matchedFrames, 0)
  assert.equal(r.bestDistance, 64)
})

test('frame giống hệt cho coverage 100%', () => {
  const frames = [h('0f0f0f0f0f0f0f0f'), h('1234567890abcdef'), h('ffffffffffffffff')]
  const r = compareFrameHashes(frames, frames)
  assert.equal(r.coverage, 1)
  assert.equal(r.matchedFrames, 3)
  assert.equal(r.bestDistance, 0)
})

test('so mọi-với-mọi chứ không theo vị trí', () => {
  // Bản reup thêm intro nên trục thời gian lệch: frame gốc [A,B] xuất hiện ở
  // ứng viên dưới dạng [X,A,B]. So theo vị trí sẽ trượt, so mọi-với-mọi thì bắt.
  const A = h('0000000000000000')
  const B = h('ffffffffffffffff')
  const X = h('0f0f0f0f0f0f0f0f')

  const r = compareFrameHashes([A, B], [X, A, B])
  assert.equal(r.coverage, 1, 'phải khớp cả hai frame bất kể lệch vị trí')
})

test('video không liên quan cho coverage 0', () => {
  const orig = [h('0000000000000000'), h('0000000000000000')]
  const other = [h('ffffffffffffffff'), h('ffffffffffffffff')]
  const r = compareFrameHashes(orig, other)
  assert.equal(r.matchedFrames, 0)
  assert.equal(r.coverage, 0)
  assert.equal(r.bestDistance, 64)
})

test('coverage là tỉ lệ trên số frame GỐC, không phải ứng viên', () => {
  const A = h('0000000000000000')
  const B = h('ffffffffffffffff')
  // 1 trong 2 frame gốc khớp, dù ứng viên có nhiều frame hơn hẳn.
  const r = compareFrameHashes([A, B], [A, h('1111111111111111'), h('2222222222222222')])
  assert.equal(r.matchedFrames, 1)
  assert.equal(r.coverage, 0.5)
})
