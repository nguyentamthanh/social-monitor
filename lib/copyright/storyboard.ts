import sharp from 'sharp'
import { computePHash, hammingDistance } from '@/lib/copyright/imageHash'
import { mapWithConcurrency } from '@/lib/util/pool'

/**
 * So khớp NỘI DUNG video bằng storyboard của YouTube.
 *
 * YouTube tự sinh sẵn các sprite sheet chứa ~100 khung hình trải đều theo
 * thời lượng video (dùng cho thanh tua). Chúng nằm trên CDN `i.ytimg.com`,
 * **miễn phí và không tốn quota API**, tải bằng fetch thường.
 *
 * Nhờ vậy ta so được frame thật của hai video mà KHÔNG cần `yt-dlp`,
 * `ffmpeg` hay worker riêng — tức là chạy được ngay trên Vercel. Đây là con
 * đường duy nhất hiện có để bắt kẻ chỉ lấy hình ảnh (đổi tiêu đề, đổi
 * thumbnail, tắt tiếng) mà vẫn nằm trong ngân sách free.
 *
 * Lưu ý về cách so: KHÔNG so theo vị trí (frame thứ i của A với thứ i của B).
 * Bản reup thường thêm intro hoặc cắt bớt nên trục thời gian lệch; đo thực
 * nghiệm cho thấy so theo vị trí không phân biệt nổi reup với video khác
 * hẳn. Phải so mọi-với-mọi rồi lấy phân vị thấp.
 */

const INNERTUBE_URL =
  'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'
const INNERTUBE_CONTEXT = {
  client: { clientName: 'ANDROID', clientVersion: '20.10.38', hl: 'en', gl: 'US' }
}
const FETCH_TIMEOUT_MS = 8000

/** Số sprite sheet tải tối đa mỗi video — đủ phủ nội dung mà vẫn nhẹ. */
const MAX_SHEETS = 2
const SHEET_CONCURRENCY = 3

interface StoryboardLevel {
  frameWidth: number
  frameHeight: number
  totalFrames: number
  cols: number
  rows: number
  sheetToken: string
  sigh: string
  levelIndex: number
}

export interface StoryboardFingerprint {
  videoId: string
  hashes: string[]
}

/**
 * Spec dạng: `<baseUrl>|w#h#total#cols#rows#interval#Ntoken#sigh|...`
 * `$L` là mức chất lượng, `$M` là số thứ tự sheet, `$N` là token.
 */
function parseSpec(spec: string): { base: string; levels: StoryboardLevel[] } | null {
  const parts = spec.split('|')
  if (parts.length < 2) return null
  const base = parts[0]

  const levels: StoryboardLevel[] = []
  parts.slice(1).forEach((raw, i) => {
    const f = raw.split('#')
    if (f.length < 8) return
    levels.push({
      frameWidth: Number(f[0]),
      frameHeight: Number(f[1]),
      totalFrames: Number(f[2]),
      cols: Number(f[3]),
      rows: Number(f[4]),
      sheetToken: f[6],
      sigh: f[7],
      levelIndex: i
    })
  })

  return levels.length ? { base, levels } : null
}

async function fetchStoryboardSpec(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(INNERTUBE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoId, context: INNERTUBE_CONTEXT }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      storyboards?: { playerStoryboardSpecRenderer?: { spec?: string } }
    }
    return json.storyboards?.playerStoryboardSpecRenderer?.spec || null
  } catch {
    return null
  }
}

/**
 * Tải storyboard, cắt sprite thành từng frame và băm pHash.
 * Trả mảng rỗng nếu video không có storyboard (video quá ngắn, hoặc bị chặn).
 */
export async function fetchStoryboardHashes(videoId: string): Promise<string[]> {
  const spec = await fetchStoryboardSpec(videoId)
  if (!spec) return []

  const parsed = parseSpec(spec)
  if (!parsed) return []

  // Chọn mức có frame lớn nhất: pHash co ảnh về 32×32 nên frame quá nhỏ
  // (48×27) sẽ mất chi tiết và làm tăng va chạm.
  const level = parsed.levels.reduce((best, l) => (l.frameWidth > best.frameWidth ? l : best))
  const perSheet = level.cols * level.rows
  if (perSheet <= 0 || !level.totalFrames) return []

  const sheetCount = Math.min(MAX_SHEETS, Math.ceil(level.totalFrames / perSheet))
  const sheetIndexes = Array.from({ length: sheetCount }, (_, i) => i)

  const perSheetHashes = await mapWithConcurrency(sheetIndexes, SHEET_CONCURRENCY, async sheetIndex => {
    const url =
      parsed.base
        .replace('$L', String(level.levelIndex))
        .replace('$N', level.sheetToken)
        .replace('$M', String(sheetIndex)) + `&sigh=${level.sigh}`

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (!res.ok) return []
      const buffer = Buffer.from(await res.arrayBuffer())
      return await sliceAndHash(buffer, level, sheetIndex)
    } catch {
      return []
    }
  })

  return perSheetHashes.flat()
}

async function sliceAndHash(
  sheet: Buffer,
  level: StoryboardLevel,
  sheetIndex: number
): Promise<string[]> {
  const image = sharp(sheet)
  const meta = await image.metadata()
  if (!meta.width || !meta.height) return []

  const perSheet = level.cols * level.rows
  const firstFrame = sheetIndex * perSheet
  const remaining = Math.max(0, level.totalFrames - firstFrame)
  const tiles = Math.min(perSheet, remaining)

  const jobs: Array<{ left: number; top: number }> = []
  for (let i = 0; i < tiles; i++) {
    const left = (i % level.cols) * level.frameWidth
    const top = Math.floor(i / level.cols) * level.frameHeight
    // Sheet cuối có thể thiếu ô; bỏ ô vượt biên thay vì để sharp ném lỗi.
    if (left + level.frameWidth > meta.width || top + level.frameHeight > meta.height) continue
    jobs.push({ left, top })
  }

  const hashes = await mapWithConcurrency(jobs, 4, async ({ left, top }) => {
    try {
      const tile = await sharp(sheet)
        .extract({ left, top, width: level.frameWidth, height: level.frameHeight })
        .png()
        .toBuffer()
      return await computePHash(tile)
    } catch {
      return null
    }
  })

  return hashes.filter((h): h is string => !!h)
}

export interface FrameMatchResult {
  /** Số cặp frame gần như trùng khớp. */
  matchedFrames: number
  /** Khoảng cách Hamming nhỏ nhất tìm được. */
  bestDistance: number
  /** 0..1 — tỉ lệ frame của video gốc tìm được cặp khớp bên ứng viên. */
  coverage: number
  comparedFrames: number
}

/** Dưới ngưỡng này coi là cùng một khung hình. */
const FRAME_MATCH_DISTANCE = 12

/**
 * So mọi-với-mọi. Tín hiệu chính là `coverage` (bao nhiêu phần nội dung video
 * gốc xuất hiện lại ở ứng viên) chứ không phải khoảng cách nhỏ nhất — một
 * frame tối màu hay một cảnh chuyển trắng có thể trùng ngẫu nhiên giữa hai
 * video bất kỳ, nhưng cả chục cảnh cùng trùng thì không.
 */
export function compareFrameHashes(original: string[], candidate: string[]): FrameMatchResult {
  if (original.length === 0 || candidate.length === 0) {
    return { matchedFrames: 0, bestDistance: 64, coverage: 0, comparedFrames: 0 }
  }

  let best = 64
  let matched = 0

  for (const a of original) {
    let localBest = 64
    for (const b of candidate) {
      const d = hammingDistance(a, b)
      if (d < localBest) localBest = d
      if (d < best) best = d
      if (localBest === 0) break
    }
    if (localBest <= FRAME_MATCH_DISTANCE) matched++
  }

  return {
    matchedFrames: matched,
    bestDistance: best,
    coverage: matched / original.length,
    comparedFrames: original.length * candidate.length
  }
}
