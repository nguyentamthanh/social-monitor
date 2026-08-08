import sharp from 'sharp'

const HASH_SIZE = 8
const DCT_SIZE = 32
const FETCH_TIMEOUT_MS = 5000

/**
 * Bảng cosine dựng sẵn một lần lúc load module: COS[k * DCT_SIZE + n] =
 * cos((2n+1)kπ / 2N). Trước đây mỗi ảnh gọi ~2.1 triệu lần Math.cos trong
 * vòng lặp nóng — đây là phần tốn CPU nhất của toàn sản phẩm.
 */
const COS = (() => {
  const table = new Float64Array(DCT_SIZE * DCT_SIZE)
  for (let k = 0; k < DCT_SIZE; k++) {
    for (let n = 0; n < DCT_SIZE; n++) {
      table[k * DCT_SIZE + n] = Math.cos(((2 * n + 1) * k * Math.PI) / (2 * DCT_SIZE))
    }
  }
  return table
})()

const INV_SQRT2 = 1 / Math.sqrt(2)

/**
 * Perceptual hash (pHash) via DCT. Returns a 64-bit hex string (16 chars).
 * Hamming distance <= 10 typically indicates the same image with minor edits.
 */
export async function computePHash(buffer: Buffer): Promise<string> {
  // resolveWithObject để đọc số kênh thật thay vì giả định 1 byte/pixel —
  // grayscale() hiện trả 1 kênh, nhưng nếu đổi thì hash sẽ hỏng âm thầm.
  const { data, info } = await sharp(buffer)
    .grayscale()
    .resize(DCT_SIZE, DCT_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const channels = info.channels || 1
  const dct = lowFrequencyDCT(data, channels)

  // Median của 63 hệ số (bỏ DC ở vị trí 0,0), giữ nguyên ngữ nghĩa bản cũ.
  const lowFreq: number[] = []
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      if (x === 0 && y === 0) continue
      lowFreq.push(dct[y * HASH_SIZE + x])
    }
  }
  const sorted = [...lowFreq].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]

  let bits = ''
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      if (x === 0 && y === 0) {
        bits += '0'
        continue
      }
      bits += dct[y * HASH_SIZE + x] > median ? '1' : '0'
    }
  }

  return bitsToHex(bits)
}

/**
 * DCT-2D tách chiều, chỉ tính khối HASH_SIZE×HASH_SIZE tần số thấp thực sự
 * dùng tới. Bản cũ tính đủ 32×32 hệ số theo công thức 4 vòng lặp lồng nhau
 * (N⁴ ≈ 1.05M vòng) rồi vứt đi 93% kết quả; bản này ~10K phép nhân.
 */
function lowFrequencyDCT(data: Buffer | Uint8Array, channels: number): Float64Array {
  // Pass 1 (theo hàng): temp[x][v] = Σ_y pixel[x][y] · COS[v][y], v < HASH_SIZE.
  const temp = new Float64Array(DCT_SIZE * HASH_SIZE)
  for (let x = 0; x < DCT_SIZE; x++) {
    const rowOffset = x * DCT_SIZE
    for (let v = 0; v < HASH_SIZE; v++) {
      const cosOffset = v * DCT_SIZE
      let sum = 0
      for (let y = 0; y < DCT_SIZE; y++) {
        sum += data[(rowOffset + y) * channels] * COS[cosOffset + y]
      }
      temp[x * HASH_SIZE + v] = sum
    }
  }

  // Pass 2 (theo cột): dct[u][v] = (2/N)·cu·cv·Σ_x temp[x][v] · COS[u][x].
  const scale = 2 / DCT_SIZE
  const out = new Float64Array(HASH_SIZE * HASH_SIZE)
  for (let u = 0; u < HASH_SIZE; u++) {
    const cosOffset = u * DCT_SIZE
    const cu = u === 0 ? INV_SQRT2 : 1
    for (let v = 0; v < HASH_SIZE; v++) {
      const cv = v === 0 ? INV_SQRT2 : 1
      let sum = 0
      for (let x = 0; x < DCT_SIZE; x++) {
        sum += temp[x * HASH_SIZE + v] * COS[cosOffset + x]
      }
      out[u * HASH_SIZE + v] = scale * cu * cv * sum
    }
  }

  return out
}

export async function computePHashFromUrl(url: string): Promise<string | null> {
  try {
    // Không có timeout thì một CDN thumbnail treo là kẹt cả lần quét quá 60s.
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CopyrightMonitor/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    return await computePHash(buffer)
  } catch {
    return null
  }
}

export function hammingDistance(hashA: string, hashB: string): number {
  if (!hashA || !hashB || hashA.length !== hashB.length) return 64
  const binA = hexToBits(hashA)
  const binB = hexToBits(hashB)
  let dist = 0
  for (let i = 0; i < binA.length; i++) {
    if (binA[i] !== binB[i]) dist++
  }
  return dist
}

/**
 * Similarity score 0..1 where 1 means identical
 */
export function pHashSimilarity(hashA: string, hashB: string): number {
  const distance = hammingDistance(hashA, hashB)
  return Math.max(0, 1 - distance / 64)
}

function bitsToHex(bits: string): string {
  let hex = ''
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  }
  return hex
}

function hexToBits(hex: string): string {
  let bits = ''
  for (const c of hex) {
    bits += parseInt(c, 16).toString(2).padStart(4, '0')
  }
  return bits
}
