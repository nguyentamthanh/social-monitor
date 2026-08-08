import test from 'node:test'
import assert from 'node:assert/strict'
import { scoreCandidate } from '../lib/copyright/scoring'
import { EVIDENCE_CAP } from '../lib/copyright/reasons'
import { BrandAsset, RawCandidate } from '../types'

const baseAsset: BrandAsset = {
  id: 1,
  user_id: 'user-1',
  name: 'Acme Coffee',
  asset_type: 'brand_name',
  keywords: ['Acme Latte', 'best morning coffee'],
  text_content: 'Acme Coffee is the original best morning coffee for busy teams.',
  official_domains: ['acme.example'],
  status: 'active',
  created_at: new Date(),
  updated_at: new Date()
}

function candidate(overrides: Partial<RawCandidate>): RawCandidate {
  return {
    platform: 'google',
    source: 'test',
    externalId: 'candidate-1',
    title: '',
    content: '',
    url: 'https://unknown.example/post',
    ...overrides
  }
}

test('name/keyword matches alone stay capped as weak, unverified evidence', () => {
  const result = scoreCandidate(
    baseAsset,
    candidate({
      title: 'Acme Coffee deal',
      content: 'Try the Acme Latte today from an unofficial shop.'
    })
  )

  assert.equal(result.reasons.some(reason => reason.code === 'brand_name_match'), true)
  assert.equal(result.reasons.some(reason => reason.code === 'keyword_match'), true)

  // Trùng tên + keyword là khớp chuỗi thuần, chưa đối chiếu media nào: phải bị
  // chặn ở trần `weak` (35) chứ không được vượt ngưỡng "trung bình" (45).
  assert.equal(result.riskScore <= EVIDENCE_CAP.weak, true, `expected <= 35, got ${result.riskScore}`)
  assert.equal(result.needsVerification, true)

  // `official_domain_missing` đã bị bỏ: "không nằm trên domain chính thức"
  // đúng với gần như toàn bộ internet nên không phải bằng chứng.
  assert.equal(result.reasons.some(reason => reason.code === 'official_domain_missing'), false)
})

test('verified media evidence lifts the score past the weak/medium caps', () => {
  const imageAsset: BrandAsset = {
    ...baseAsset,
    asset_type: 'image',
    perceptual_hash: 'ffffffffffffffff'
  }

  const result = scoreCandidate(
    imageAsset,
    candidate({
      title: 'Acme Coffee deal',
      content: 'Try the Acme Latte today.',
      media: { perceptualHash: 'ffffffffffffffff' }
    })
  )

  assert.equal(result.reasons.some(reason => reason.code === 'image_phash_match'), true)
  assert.equal(result.needsVerification, false)
  assert.equal(result.riskScore > EVIDENCE_CAP.weak, true, `expected > 35, got ${result.riskScore}`)
})

test('a bare thumbnail no longer counts as evidence on its own', () => {
  const videoAsset: BrandAsset = { ...baseAsset, asset_type: 'video' }

  const result = scoreCandidate(
    videoAsset,
    candidate({
      title: 'Totally unrelated cooking stream',
      content: 'No mention of the brand here.',
      media: { thumbnailUrl: 'https://i.ytimg.com/vi/abc/hq.jpg' }
    })
  )

  // Trước đây nhánh `media_candidate` cộng 15 điểm chỉ vì có thumbnail.
  assert.equal(result.reasons.some(reason => reason.code === 'media_candidate'), false)
  assert.equal(result.reasons.some(reason => reason.code === 'logo_candidate'), false)
  assert.equal(result.riskScore, 0)
})

test('reduces score for official domains', () => {
  const result = scoreCandidate(
    baseAsset,
    candidate({
      title: 'Acme Coffee official campaign',
      content: 'Acme Latte from the original brand.',
      url: 'https://acme.example/campaign'
    })
  )

  assert.equal(result.reasons.some(reason => reason.code === 'official_domain_match'), true)
  assert.equal(result.riskScore < 50, true)
})

test('flags high text similarity', () => {
  const result = scoreCandidate(
    baseAsset,
    candidate({
      title: 'Morning coffee',
      content: 'Acme Coffee is the original best morning coffee for busy teams.'
    })
  )

  assert.equal(result.reasons.some(reason => reason.code === 'text_similarity_high'), true)
  assert.equal(result.riskScore >= 30, true)
})
