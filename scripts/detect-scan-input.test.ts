import test from 'node:test'
import assert from 'node:assert/strict'
import { detectScanInput } from '../lib/scans/detectScanInput'

test('detectScanInput: YouTube URL luôn tạo name để quick scan không bị lỗi "Name is required"', () => {
  const input = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  const result = detectScanInput(input)

  assert.ok(result)
  assert.equal(result.assetType, 'video')
  assert.equal(result.youtubeUrl, input)
  assert.ok(result.name.length > 0)
})

test('detectScanInput: domain đơn giản -> brand_name với officialDomains', () => {
  const input = 'nike.com'
  const result = detectScanInput(input)

  assert.ok(result)
  assert.equal(result.assetType, 'brand_name')
  assert.equal(result.officialDomains, 'nike.com')
  assert.equal(result.keywords, 'nike')
})

