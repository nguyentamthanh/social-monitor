import sharp from 'sharp'

const HASH_SIZE = 8
const DCT_SIZE = 32

/**
 * Perceptual hash (pHash) via DCT. Returns a 64-bit hex string (16 chars).
 * Hamming distance <= 10 typically indicates the same image with minor edits.
 */
export async function computePHash(buffer: Buffer): Promise<string> {
  const raw = await sharp(buffer)
    .grayscale()
    .resize(DCT_SIZE, DCT_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer()

  const matrix: number[][] = []
  for (let y = 0; y < DCT_SIZE; y++) {
    const row: number[] = []
    for (let x = 0; x < DCT_SIZE; x++) {
      row.push(raw[y * DCT_SIZE + x])
    }
    matrix.push(row)
  }

  const dct = applyDCT2D(matrix)
  const lowFreq: number[] = []
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      if (x === 0 && y === 0) continue
      lowFreq.push(dct[y][x])
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
      bits += dct[y][x] > median ? '1' : '0'
    }
  }

  return bitsToHex(bits)
}

export async function computePHashFromUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CopyrightMonitor/1.0' }
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

function applyDCT2D(matrix: number[][]): number[][] {
  const N = matrix.length
  const result: number[][] = []
  for (let u = 0; u < N; u++) {
    const row: number[] = []
    for (let v = 0; v < N; v++) {
      let sum = 0
      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          sum +=
            matrix[x][y] *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N))
        }
      }
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1
      row.push(((2 / N) * cu * cv * sum))
    }
    result.push(row)
  }
  return result
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
