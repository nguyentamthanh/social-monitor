import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { put } from '@vercel/blob'
import { createHash } from 'crypto'
import { authOptions } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db'
import { createBrandAsset, findAssetsByUserId } from '@/lib/models/CopyrightMonitor'
import { computePHash } from '@/lib/copyright/imageHash'
import { CopyrightAssetType } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const allowedTypes: CopyrightAssetType[] = ['brand_name', 'text', 'image', 'logo', 'video', 'audio']
const IMAGE_TYPES: CopyrightAssetType[] = ['image', 'logo']

export async function GET() {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id || session.user.email!
    const assets = await findAssetsByUserId(userId)

    return NextResponse.json(assets)
  } catch (error) {
    console.error('Assets GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const name = String(formData.get('name') || '').trim()
    const assetType = String(formData.get('assetType') || '') as CopyrightAssetType
    const keywords = splitList(String(formData.get('keywords') || ''))
    const officialDomains = splitList(String(formData.get('officialDomains') || ''))
    const textContent = String(formData.get('textContent') || '').trim() || null
    const audioTitle = String(formData.get('audioTitle') || '').trim() || null
    const audioArtist = String(formData.get('audioArtist') || '').trim() || null
    const file = formData.get('file')

    if (!name || !allowedTypes.includes(assetType)) {
      return NextResponse.json({ error: 'Missing or invalid asset details' }, { status: 400 })
    }

    let fileName: string | null = null
    let filePath: string | null = null
    let fileMimeType: string | null = null
    let fileSize: number | null = null
    let fileHash: string | null = null
    let perceptualHash: string | null = null

    if (file instanceof File && file.size > 0) {
      const bytes = Buffer.from(await file.arrayBuffer())
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storedName = `copyright-assets/${Date.now()}-${safeName}`

      const blobToken = process.env.BLOB_READ_WRITE_TOKEN
      if (blobToken) {
        const blob = await put(storedName, bytes, {
          access: 'public',
          token: blobToken,
          contentType: file.type || 'application/octet-stream',
          addRandomSuffix: false
        })
        filePath = blob.url
      } else {
        // Local dev fallback: write to public/uploads
        const { mkdir, writeFile } = await import('fs/promises')
        const path = await import('path')
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'copyright-assets')
        await mkdir(uploadDir, { recursive: true })
        const local = `${Date.now()}-${safeName}`
        await writeFile(path.join(uploadDir, local), bytes)
        filePath = `/uploads/copyright-assets/${local}`
      }

      fileName = file.name
      fileMimeType = file.type || 'application/octet-stream'
      fileSize = file.size
      fileHash = createHash('sha256').update(bytes).digest('hex')

      if (IMAGE_TYPES.includes(assetType) && (fileMimeType?.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(file.name))) {
        try {
          perceptualHash = await computePHash(bytes)
        } catch (err) {
          console.warn('pHash computation failed:', err)
        }
      }
    }

    const audioMetadata =
      assetType === 'audio' && (audioTitle || audioArtist)
        ? { title: audioTitle || name, artist: audioArtist || undefined }
        : null

    const userId = (session.user as any).id || session.user.email!
    const asset = await createBrandAsset({
      userId,
      name,
      assetType,
      keywords,
      textContent,
      officialDomains,
      fileName,
      filePath,
      fileMimeType,
      fileSize,
      fileHash,
      perceptualHash,
      audioMetadata
    })

    return NextResponse.json(asset, { status: 201 })
  } catch (error) {
    console.error('Assets POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}
