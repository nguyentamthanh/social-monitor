export type YouTubeQuickScanMode = 'fast' | 'deep'

/**
 * `fast` chỉ tắt `deepMediaCheck` (yt-dlp/ffmpeg — chậm, và vốn dĩ không chạy
 * được trên Vercel). `thumbnailMatch` KHÔNG còn bị tắt ở fast: nó từng bị tắt
 * để giảm độ trễ hồi pHash còn là DCT O(N⁴), nhưng sau khi tối ưu (DCT tách
 * chiều, xem imageHash.ts) một lượt so 50 thumbnail chỉ mất vài trăm ms — giữ
 * tắt nó chỉ còn làm mất tín hiệu mà không đổi lại gì. Nó còn là điều kiện
 * bắt buộc để Dailymotion đối chiếu được: adapter đó dùng chung
 * `original.thumbnailHash` do bước này tính ra.
 */
export function resolveFindCopiesOptions(
  mode?: string | null
): { deepMediaCheck: boolean; thumbnailMatch?: boolean } {
  if (mode === 'fast') return { deepMediaCheck: false }
  return { deepMediaCheck: true }
}

