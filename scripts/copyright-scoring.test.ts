import test from 'node:test'
import assert from 'node:assert/strict'
import { scoreCandidate } from '../lib/copyright/scoring'
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

test('scores exact brand and keyword matches with explainable reasons', () => {
  const result = scoreCandidate(
    baseAsset,
    candidate({
      title: 'Acme Coffee deal',
      content: 'Try the Acme Latte today from an unofficial shop.'
    })
  )

  assert.equal(result.riskScore >= 50, true)
  assert.equal(result.reasons.some(reason => reason.code === 'brand_name_match'), true)
  assert.equal(result.reasons.some(reason => reason.code === 'keyword_match'), true)
  assert.equal(result.reasons.some(reason => reason.code === 'official_domain_missing'), true)
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
