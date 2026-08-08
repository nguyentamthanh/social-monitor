import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db'
import { copyrightAdapters, countYoutubeQueries } from '@/lib/copyright/adapters'
import { resolveApiKeys } from '@/lib/copyright/apiKeys'
import { parseOrError, quickScanSchema } from '@/lib/validation'
import { getQuota, recordUsage, YOUTUBE_COST } from '@/lib/copyright/quota'
import { getUserSettings } from '@/lib/models/UserSettings'
import { scoreCandidate } from '@/lib/copyright/scoring'
import { computePHash } from '@/lib/copyright/imageHash'
import { findCopies, FindCopiesResult } from '@/lib/copyright/findCopies'
import { extractYouTubeVideoId } from '@/lib/copyright/urlParser'
import {
  upsertAdhocAsset,
  createScanRun,
  updateScanRun,
  upsertFinding,
  createEvidenceItem
} from '@/lib/models/CopyrightMonitor'
import { BrandAsset, Platform, CopyrightAssetType } from '@/types'
import { resolveFindCopiesOptions } from './resolveFindCopiesOptions'

interface PersistableFinding {
  platform: string
  source: string
  externalId: string
  title: string
  content: string
  url: string
  author: { id?: string; name?: string; handle?: string }
  riskScore: number
  reasons: Array<{ code: string; label: string; points: number }>
  publishedAt: Date | null
  media: { thumbnailUrl?: string; deepCheck?: unknown }
}

/**
 * Ghi kết quả findCopies xuống DB và trả về id lần quét.
 * Lỗi ghi không được làm hỏng phản hồi — người dùng vẫn phải thấy kết quả
 * vừa quét kể cả khi DB trục trặc.
 */
async function persistFindCopiesResult(
  userId: string,
  result: FindCopiesResult,
  findings: PersistableFinding[]
): Promise<number | null> {
  try {
    const asset = await upsertAdhocAsset({
      userId,
      sourceUrl: result.original.url,
      name: result.original.title || result.original.videoId,
      assetType: 'video'
    })

    const scanRun = await createScanRun({ userId, trigger: 'manual', assetIds: [asset.id] })

    for (const finding of findings) {
      const saved = await upsertFinding({
        userId,
        scanRunId: scanRun.id,
        assetId: asset.id,
        platform: finding.platform as Platform,
        source: finding.source,
        externalId: finding.externalId,
        title: finding.title,
        content: finding.content,
        url: finding.url,
        author: finding.author,
        riskScore: finding.riskScore,
        reasons: finding.reasons,
        publishedAt: finding.publishedAt
      })

      // Thumbnail sống trong evidence_items — đó là nguồn ảnh cho trang
      // Findings (LEFT JOIN LATERAL trong findFindings).
      if (finding.media.thumbnailUrl) {
        await createEvidenceItem({
          findingId: saved.id,
          evidenceType: 'thumbnail',
          thumbnailUrl: finding.media.thumbnailUrl,
          metadata: { deepCheck: finding.media.deepCheck ?? null }
        })
      }
    }

    await updateScanRun(scanRun.id, 'completed', [], {}, findings.length)
    return scanRun.id
  } catch (error) {
    console.error('persistFindCopiesResult failed:', error)
    return null
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Vercel Hobby giới hạn cứng 60s; khai 300 chỉ khiến function bị cắt giữa
// chừng thành 504 thay vì trả lỗi tử tế.
export const maxDuration = 60

function formDataString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id || session.user.email!
    const keys = await resolveApiKeys(userId)

    const formData = await request.formData()
    const file = formData.get('file')

    // Validate phần text của FormData; `file` xử lý riêng vì zod không mô tả Blob.
    const parsed = parseOrError(quickScanSchema, {
      name: formDataString(formData, 'name'),
      assetType: formDataString(formData, 'assetType') || 'brand_name',
      keywords: formDataString(formData, 'keywords'),
      officialDomains: formDataString(formData, 'officialDomains'),
      youtubeUrl: formDataString(formData, 'youtubeUrl'),
      textContent: formDataString(formData, 'textContent'),
      audioTitle: formDataString(formData, 'audioTitle'),
      audioArtist: formDataString(formData, 'audioArtist'),
      mode: formDataString(formData, 'mode') || undefined,
      platforms: formDataString(formData, 'platforms') || 'youtube,google'
    })
    if (!parsed.ok) return parsed.response

    const input = parsed.data
    const mode = input.mode
    const assetType = input.assetType as CopyrightAssetType
    const keywords = splitList(input.keywords || '')
    const officialDomains = splitList(input.officialDomains || '')
    const platforms = input.platforms as Platform[]
    const youtubeUrl = input.youtubeUrl || null
    const youtubeVideoId = youtubeUrl ? extractYouTubeVideoId(youtubeUrl) : null

    // Chặn trước khi gọi YouTube: hết quota thì nói rõ thay vì để Google trả 403.
    const usesYoutube = platforms.includes('youtube')
    const settings = await getUserSettings(userId).catch(() => null)
    const quota = usesYoutube
      ? await getQuota(userId, settings?.preferences)
      : null
    if (quota?.exceeded) {
      return NextResponse.json(
        {
          error: 'quota_exceeded',
          message: `Đã dùng hết ${quota.budget} quota YouTube hôm nay. Quota reset lúc 00:00 giờ Thái Bình Dương, hoặc tăng hạn mức trong Cài đặt.`,
          quota
        },
        { status: 429 }
      )
    }

    if (youtubeVideoId && platforms.includes('youtube')) {
      const result = await findCopies(youtubeVideoId, { ...resolveFindCopiesOptions(mode), apiKey: keys.youtubeApiKey })
      // Ghi đúng số unit đã tiêu: 101 cho một truy vấn, 201 khi phải tìm thêm
      // theo transcript.
      await recordUsage(userId, result.quotaUnits)
      const findings = result.candidates.map(candidate => ({
        platform: 'youtube',
        source: 'youtube_find_copies_deep',
        externalId: candidate.videoId,
        title: candidate.title,
        content: candidate.reasons.map(reason => reason.label).join(', '),
        url: candidate.url,
        author: {
          id: candidate.channelId,
          name: candidate.channelTitle,
          handle: candidate.channelTitle
        },
        riskScore: candidate.riskScore,
        // Cho UI biết ứng viên này đã được đối chiếu media thật (khung hình /
        // fingerprint) hay mới chỉ khớp chữ — đó là khác biệt quan trọng nhất
        // khi người dùng quyết định có gửi khiếu nại bản quyền hay không.
        needsVerification: candidate.needsVerification ?? true,
        reasons: candidate.reasons,
        publishedAt: candidate.publishedAt ? new Date(candidate.publishedAt) : null,
        media: {
          thumbnailUrl: candidate.thumbnailUrl,
          deepCheck: candidate.mediaCheck
        }
      }))

      // Lưu kết quả. Trước đây nhánh này chỉ trả JSON rồi thôi: người dùng
      // quét xong, chuyển trang là mất sạch, mà nút "Xem tất cả Findings" lại
      // dẫn sang trang trống. Neo vào một asset ad-hoc theo URL gốc để mọi
      // finding có chỗ gắn, và để quét lại cùng link thì cập nhật đúng bản ghi
      // cũ thay vì nhân bản.
      const scanRunId = await persistFindCopiesResult(userId, result, findings)

      const youtubeDeepSummary = {
        scanRunId,
        original: result.original,
        searched: result.searched,
        transcriptChecked: result.transcriptChecked,
        frameChecked: result.frameChecked,
        mediaChecked: result.mediaChecked,
        mediaCheckEnabled: result.mediaCheckEnabled,
        mediaCheckStatus: result.mediaCheckStatus
      }

      // Trả về vô điều kiện: findCopies đã là câu trả lời đầy đủ cho một link
      // YouTube. Trước đây khi không tìm thấy reup nào (kết quả PHỔ BIẾN NHẤT)
      // hàm rơi xuống nhánh adapter và tiêu thêm ~600 unit quota nữa — tức là
      // trường hợp "không có gì" lại tốn 700 unit thay vì 101.
      return NextResponse.json({
        success: true,
        mode: mode === 'fast' ? 'youtube_fast_url' : 'youtube_deep_url',
        findingsCreated: findings.length,
        findings,
        ...youtubeDeepSummary
      })
    }

    let name = input.name || ''
    let textContent = input.textContent || null
    let audioTitle = input.audioTitle || null
    let audioArtist = input.audioArtist || null
    let perceptualHash: string | null = null

    // If YouTube URL is provided, fetch its metadata to auto-populate attributes
    if (youtubeUrl && ['audio', 'video'].includes(assetType)) {
      const videoId = extractYouTubeVideoId(youtubeUrl)
      if (videoId) {
        const apiKey = keys.youtubeApiKey
        if (apiKey) {
          try {
            const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`)
            if (ytRes.ok) {
              const ytData = await ytRes.json()
              const snippet = ytData.items?.[0]?.snippet
              if (snippet) {
                if (!name) name = snippet.title || 'YouTube Video'
                if (!textContent) textContent = snippet.description || null
                if (assetType === 'audio') {
                  if (!audioTitle) audioTitle = snippet.title
                  if (!audioArtist) audioArtist = snippet.channelTitle
                }

                // Download thumbnail and compute pHash for visual matching
                const thumbnailUrl = snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url
                if (thumbnailUrl) {
                  try {
                    const imgRes = await fetch(thumbnailUrl)
                    if (imgRes.ok) {
                      const bytes = Buffer.from(await imgRes.arrayBuffer())
                      perceptualHash = await computePHash(bytes)
                    }
                  } catch (err) {
                    console.warn('Quick scan YouTube thumbnail pHash calculation failed:', err)
                  }
                }
              }
            }
          } catch (err) {
            console.error('Failed to fetch YouTube video details for quick scan:', err)
          }
        }
      }
    }

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Fallback file upload pHash
    if (!perceptualHash && file instanceof File && file.size > 0) {
      const bytes = Buffer.from(await file.arrayBuffer())
      if (['image', 'logo', 'video'].includes(assetType)) {
        try {
          perceptualHash = await computePHash(bytes)
        } catch (err) {
          console.warn('Quick scan file pHash calculation failed:', err)
        }
      }
    }

    const audioMetadata =
      assetType === 'audio' && (audioTitle || audioArtist)
        ? { title: audioTitle || name, artist: audioArtist || undefined }
        : null

    // Create Mock BrandAsset
    const mockAsset: BrandAsset = {
      id: 0,
      user_id: userId,
      name,
      asset_type: assetType,
      keywords,
      text_content: textContent,
      official_domains: officialDomains,
      perceptual_hash: perceptualHash,
      audio_metadata: audioMetadata,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    }

    const findings: any[] = []
    const seen = new Set<string>()

    for (const platform of platforms) {
      const adapter = copyrightAdapters[platform]
      if (!platform) continue

      const status = adapter.status(keys)
      if (status.capability !== 'ready') continue

      try {
        const candidates = await adapter.search(mockAsset, keys)
        if (platform === 'youtube') {
          await recordUsage(userId, countYoutubeQueries(mockAsset) * YOUTUBE_COST.search)
        }
        for (const candidate of candidates) {
          const dedupeKey = `${platform}:${candidate.externalId || candidate.url}`
          if (seen.has(dedupeKey)) continue
          seen.add(dedupeKey)

          const score = scoreCandidate(mockAsset, candidate)
          if (score.riskScore >= 22) {
            findings.push({
              platform: candidate.platform,
              source: candidate.source,
              externalId: candidate.externalId || candidate.url,
              title: candidate.title || candidate.content.slice(0, 120) || 'Untitled candidate',
              content: candidate.content || candidate.title,
              url: candidate.url,
              author: candidate.author,
              riskScore: score.riskScore,
              reasons: score.reasons,
              publishedAt: candidate.publishedAt || null,
              media: candidate.media
            })
          }
        }
      } catch (error) {
        console.error(`Quick scan error for platform ${platform}:`, error)
      }
    }

    // Sort findings by risk score descending
    findings.sort((a, b) => b.riskScore - a.riskScore)

    return NextResponse.json({
      success: true,
      mode: 'quick_scan',
      findingsCreated: findings.length,
      findings
    })
  } catch (error) {
    console.error('Quick scan POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
