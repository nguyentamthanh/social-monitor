import { BrandAsset, FindingReason, RawCandidate } from '@/types'
import { hammingDistance } from '@/lib/copyright/imageHash'
import { detectAudioCandidate } from '@/lib/copyright/audioMatcher'

export interface ScoreResult {
  riskScore: number
  reasons: FindingReason[]
}

const REASON_LABELS: Record<string, string> = {
  brand_name_match: 'Trùng tên thương hiệu',
  keyword_match: 'Trùng keyword theo dõi',
  text_similarity_high: 'Nội dung giống văn bản gốc',
  official_domain_missing: 'Nguồn không nằm trong domain chính thức',
  official_domain_match: 'Nguồn thuộc domain chính thức',
  logo_candidate: 'Có dấu hiệu dùng tài sản hình ảnh/logo',
  media_candidate: 'Có dấu hiệu dùng tài sản media',
  image_phash_match: 'Ảnh có perceptual hash tương đồng',
  video_thumbnail_match: 'Thumbnail video tương đồng tài sản',
  audio_title_match: 'Trùng tên bài hát/audio',
  audio_artist_match: 'Trùng nghệ sĩ/ngãi phát',
  audio_streaming_host: 'Xuất hiện trên dịch vụ streaming'
}

export function scoreCandidate(asset: BrandAsset, candidate: RawCandidate): ScoreResult {
  const reasons: FindingReason[] = []
  const candidateText = normalizeText(`${candidate.title} ${candidate.content}`)
  const assetName = normalizeText(asset.name)
  const keywords = normalizeKeywords(asset.keywords)
  const sourceHost = extractHost(candidate.url)
  const officialDomains = asset.official_domains.map(normalizeDomain).filter(Boolean)
  const isOfficialDomain = officialDomains.some(domain => sourceHost === domain || sourceHost.endsWith(`.${domain}`))

  if (assetName && candidateText.includes(assetName)) {
    reasons.push(reason('brand_name_match', 35))
  } else if (assetName) {
    // Fuzzy fallback: bigram Jaccard between asset name and candidate text
    const sim = textSimilarity(assetName, candidateText)
    if (sim >= 0.4) {
      reasons.push(reason('brand_name_match', Math.max(15, Math.round(30 * sim))))
    }
  }

  const keywordHits = keywords.filter(keyword => candidateText.includes(keyword))
  if (keywordHits.length > 0) {
    reasons.push(reason('keyword_match', Math.min(30, 12 + keywordHits.length * 6)))
  }

  if (asset.text_content && asset.asset_type !== 'audio') {
    const similarity = textSimilarity(asset.text_content, candidate.content || candidate.title)
    if (similarity >= 0.55) {
      reasons.push(reason('text_similarity_high', Math.round(35 * similarity)))
    }
  }

  // Image / logo perceptual hash matching
  if (['image', 'logo'].includes(asset.asset_type)) {
    if (asset.perceptual_hash && candidate.media?.perceptualHash) {
      const distance = hammingDistance(asset.perceptual_hash, candidate.media.perceptualHash)
      if (distance <= 10) {
        const points = Math.round(30 * (1 - distance / 14))
        reasons.push(reason('image_phash_match', Math.max(15, points)))
      }
    } else if (candidate.media?.thumbnailUrl || candidate.media?.hash) {
      reasons.push(reason('logo_candidate', 18))
    }
  }

  // Video thumbnail perceptual matching when asset is a video
  if (asset.asset_type === 'video') {
    if (asset.perceptual_hash && candidate.media?.perceptualHash) {
      const distance = hammingDistance(asset.perceptual_hash, candidate.media.perceptualHash)
      if (distance <= 12) {
        reasons.push(reason('video_thumbnail_match', Math.round(25 * (1 - distance / 16))))
      }
    } else if (candidate.media?.thumbnailUrl || candidate.metadata?.duration) {
      reasons.push(reason('media_candidate', 15))
    }
  }

  // Audio title/artist matching
  if (asset.asset_type === 'audio') {
    const audioMatch = detectAudioCandidate(asset, `${candidate.title} ${candidate.content}`, candidate.url)
    if (audioMatch.titleMatch) {
      reasons.push(reason('audio_title_match', 30))
    }
    if (audioMatch.artistMatch) {
      reasons.push(reason('audio_artist_match', 20))
    }
    if (audioMatch.hostHint !== 'other') {
      reasons.push(reason('audio_streaming_host', 8))
    }
  }

  if (isOfficialDomain) {
    reasons.push(reason('official_domain_match', -40))
  } else if (sourceHost) {
    reasons.push(reason('official_domain_missing', 15))
  }

  const riskScore = Math.max(0, Math.min(100, reasons.reduce((sum, item) => sum + item.points, 0)))

  return {
    riskScore,
    reasons
  }
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeKeywords(keywords: string[]): string[] {
  return keywords.map(normalizeText).filter(keyword => keyword.length >= 2)
}

function normalizeDomain(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .trim()
}

function extractHost(url: string): string {
  try {
    return normalizeDomain(new URL(url).hostname)
  } catch {
    return normalizeDomain(url)
  }
}

function textSimilarity(source: string, candidate: string): number {
  // Combine unigram + bigram Jaccard for better long-passage matching
  const sourceNorm = normalizeText(source)
  const candidateNorm = normalizeText(candidate)
  if (!sourceNorm || !candidateNorm) return 0

  const uniSrc = new Set(sourceNorm.split(' ').filter(Boolean))
  const uniCand = new Set(candidateNorm.split(' ').filter(Boolean))
  const biSrc = ngrams(sourceNorm, 2)
  const biCand = ngrams(candidateNorm, 2)

  const uniSim = jaccard(uniSrc, uniCand)
  const biSim = jaccard(biSrc, biCand)
  return Math.max(uniSim, biSim * 1.1)
}

function ngrams(text: string, n: number): Set<string> {
  const tokens = text.split(' ').filter(Boolean)
  const result = new Set<string>()
  for (let i = 0; i <= tokens.length - n; i++) {
    result.add(tokens.slice(i, i + n).join(' '))
  }
  return result
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const token of a) {
    if (b.has(token)) intersection++
  }
  return intersection / Math.max(a.size, b.size)
}

function reason(code: string, points: number): FindingReason {
  return {
    code,
    label: REASON_LABELS[code] || code,
    points
  }
}
