import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * Trả về lỗi 400 kèm tên field thay vì để dữ liệu sai lọt xuống tầng dưới rồi
 * nổ thành 500 chung chung.
 */
export function validationError(error: z.ZodError) {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_'
    if (!fields[path]) fields[path] = issue.message
  }
  return NextResponse.json(
    {
      error: 'invalid_request',
      message: 'Dữ liệu gửi lên không hợp lệ',
      fields
    },
    { status: 400 }
  )
}

/** Parse an toàn: trả `{ ok: true, data }` hoặc `{ ok: false, response }`. */
export function parseOrError<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown
): { ok: true; data: z.infer<T> } | { ok: false; response: NextResponse } {
  const result = schema.safeParse(input)
  if (!result.success) return { ok: false, response: validationError(result.error) }
  return { ok: true, data: result.data }
}

export const PLATFORMS = ['youtube', 'google', 'facebook', 'tiktok'] as const
export const ASSET_TYPES = ['brand_name', 'text', 'image', 'logo', 'video', 'audio'] as const

/** Chuỗi phân tách bằng dấu phẩy trong FormData → mảng platform hợp lệ. */
export const platformListSchema = z
  .string()
  .optional()
  .transform(value =>
    (value || '')
      .split(',')
      .map(item => item.trim())
      .filter((item): item is (typeof PLATFORMS)[number] => (PLATFORMS as readonly string[]).includes(item))
  )

export const scanRequestSchema = z.object({
  assetIds: z.array(z.number().int().positive()).max(100).optional(),
  platforms: z.array(z.enum(PLATFORMS)).max(4).optional()
})

export const youtubeUrlRequestSchema = z.object({
  url: z.string().trim().min(1, 'Thiếu URL').max(500),
  deepMediaCheck: z.boolean().optional()
})

export const quickScanSchema = z.object({
  name: z.string().trim().max(200).optional(),
  assetType: z.enum(ASSET_TYPES).default('brand_name'),
  keywords: z.string().max(500).optional(),
  officialDomains: z.string().max(500).optional(),
  youtubeUrl: z.string().trim().max(500).optional(),
  textContent: z.string().max(20000).optional(),
  audioTitle: z.string().max(200).optional(),
  audioArtist: z.string().max(200).optional(),
  mode: z.enum(['fast', 'deep']).optional(),
  platforms: platformListSchema
})

export const settingsSchema = z.object({
  apiKeys: z.record(z.string(), z.string().max(500)).optional(),
  preferences: z.record(z.string(), z.unknown()).optional()
})

export const textCheckSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Thiếu nội dung cần kiểm tra')
    .max(20000, 'Nội dung quá dài, tối đa 20.000 ký tự'),
  platforms: z.array(z.enum(PLATFORMS)).max(4).optional().default([])
})
