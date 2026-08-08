import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { computePHash, hammingDistance } from '../lib/copyright/imageHash'

const DCT_SIZE = 32
const HASH_SIZE = 8

/**
 * Bản DCT O(N⁴) nguyên gốc, giữ lại nguyên văn trong test để chứng minh bản
 * tách chiều mới cho ra hash y hệt chứ không chỉ "gần giống".
 */
function legacyPHashBits(raw: Buffer): string {
  const matrix: number[][] = []
  for (let y = 0; y < DCT_SIZE; y++) {
    const row: number[] = []
    for (let x = 0; x < DCT_SIZE; x++) row.push(raw[y * DCT_SIZE + x])
    matrix.push(row)
  }

  const N = matrix.length
  const dct: number[][] = []
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
      row.push((2 / N) * cu * cv * sum)
    }
    dct.push(row)
  }

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
  return bits
}

function bitsToHex(bits: string): string {
  let hex = ''
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}

async function legacyPHash(buffer: Buffer): Promise<string> {
  const raw = await sharp(buffer).grayscale().resize(DCT_SIZE, DCT_SIZE, { fit: 'fill' }).raw().toBuffer()
  return bitsToHex(legacyPHashBits(raw))
}

/** Ảnh giả lập có cấu trúc (gradient + khối) để DCT có phổ tần số thật. */
function syntheticImage(seed: number, size = 96): Promise<Buffer> {
  const pixels = Buffer.alloc(size * size * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3
      const wave = Math.sin((x + seed) / 7) * 60 + Math.cos((y * seed) / 11) * 50
      const block = ((x >> 4) + (y >> 4) + seed) % 2 === 0 ? 90 : 20
      const v = Math.max(0, Math.min(255, Math.round(120 + wave * 0.5 + block * 0.5)))
      pixels[i] = v
      pixels[i + 1] = (v * 3 + seed * 17) % 256
      pixels[i + 2] = (v * 7 + seed * 31) % 256
    }
  }
  return sharp(pixels, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer()
}

test('separable DCT produces byte-identical hashes to the legacy O(N^4) version', async () => {
  for (let seed = 1; seed <= 12; seed++) {
    const img = await syntheticImage(seed)
    const [fast, legacy] = await Promise.all([computePHash(img), legacyPHash(img)])
    assert.equal(fast, legacy, `hash mismatch for seed ${seed}: ${fast} vs ${legacy}`)
    assert.equal(fast.length, 16)
  }
})

test('near-identical images hash to a small hamming distance', async () => {
  const original = await syntheticImage(5)
  // Re-encode ở kích thước khác: pHash phải bền với resize.
  const resized = await sharp(original).resize(64, 64).jpeg({ quality: 80 }).toBuffer()

  const a = await computePHash(original)
  const b = await computePHash(resized)
  assert.equal(hammingDistance(a, b) <= 10, true, `distance too large: ${hammingDistance(a, b)}`)
})

test('unrelated images hash far apart', async () => {
  const a = await computePHash(await syntheticImage(2))
  const b = await computePHash(await syntheticImage(9))
  assert.equal(hammingDistance(a, b) > 10, true)
})

test('separable DCT is dramatically faster than the legacy version', async () => {
  const images = await Promise.all(Array.from({ length: 12 }, (_, i) => syntheticImage(i + 1)))

  const legacyStart = performance.now()
  for (const img of images) await legacyPHash(img)
  const legacyMs = performance.now() - legacyStart

  const fastStart = performance.now()
  for (const img of images) await computePHash(img)
  const fastMs = performance.now() - fastStart

  // sharp decode chiếm phần lớn thời gian của bản nhanh, nên so tổng vẫn rất
  // bảo thủ so với mức tăng tốc thật của riêng phép DCT.
  console.log(`  legacy ${legacyMs.toFixed(0)}ms vs fast ${fastMs.toFixed(0)}ms (${(legacyMs / fastMs).toFixed(1)}x)`)
  assert.equal(fastMs < legacyMs / 5, true, `expected >5x speedup, got ${(legacyMs / fastMs).toFixed(1)}x`)
})
