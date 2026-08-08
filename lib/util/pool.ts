/**
 * Chạy `fn` trên từng phần tử với số tác vụ song song tối đa là `limit`,
 * giữ nguyên thứ tự kết quả như `Promise.all`.
 *
 * Dùng khi mỗi tác vụ vừa tải mạng vừa tốn CPU (ví dụ tính pHash cho 50
 * thumbnail): `Promise.all` trần sẽ mở 50 kết nối và 50 phép DCT cùng lúc,
 * đủ để đẩy một lần quét vượt giới hạn 60s của Vercel.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []

  const results = new Array<R>(items.length)
  const workers = Math.max(1, Math.min(limit, items.length))
  let cursor = 0

  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (true) {
        const index = cursor++
        if (index >= items.length) return
        results[index] = await fn(items[index], index)
      }
    })
  )

  return results
}
