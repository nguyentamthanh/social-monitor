import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db'
import { copyrightAdapters } from '@/lib/copyright/adapters'
import { scoreCandidate } from '@/lib/copyright/scoring'
import { computePHash } from '@/lib/copyright/imageHash'
import { BrandAsset, Platform, CopyrightAssetType } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function splitList(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function extractYoutubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const assetType = String(formData.get('assetType') || 'brand_name') as CopyrightAssetType
    const keywords = splitList(String(formData.get('keywords') || ''))
    const officialDomains = splitList(String(formData.get('officialDomains') || ''))
    const file = formData.get('file')
    const platformsStr = String(formData.get('platforms') || 'youtube,google')
    const platforms = splitList(platformsStr).filter(p => ['youtube', 'google', 'facebook', 'tiktok'].includes(p)) as Platform[]
    const youtubeUrl = String(formData.get('youtubeUrl') || '').trim() || null

    let name = String(formData.get('name') || '').trim()
    let textContent = String(formData.get('textContent') || '').trim() || null
    let audioTitle = String(formData.get('audioTitle') || '').trim() || null
    let audioArtist = String(formData.get('audioArtist') || '').trim() || null
    let perceptualHash: string | null = null

    // If YouTube URL is provided, fetch its metadata to auto-populate attributes
    if (youtubeUrl && ['audio', 'video'].includes(assetType)) {
      const videoId = extractYoutubeId(youtubeUrl)
      if (videoId) {
        const apiKey = process.env.YOUTUBE_API_KEY
        if (apiKey && apiKey !== 'your_youtube_api_key_here') {
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

    const userId = (session.user as any).id || session.user.email!

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

      const status = adapter.status()
      if (status.capability !== 'ready') continue

      try {
        const candidates = await adapter.search(mockAsset)
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
      findingsCreated: findings.length,
      findings
    })
  } catch (error) {
    console.error('Quick scan POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
