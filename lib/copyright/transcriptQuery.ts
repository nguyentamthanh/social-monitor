import { normalizeText } from '@/lib/copyright/scoring'

/**
 * Trích một cụm từ đặc trưng trong transcript video gốc để dùng làm truy vấn
 * tìm kiếm thứ hai.
 *
 * Vì sao cần: truy vấn hiện tại dựng từ tiêu đề + tag, nên video reup đổi hẳn
 * tiêu đề sẽ không bao giờ xuất hiện trong danh sách ứng viên — tức là không
 * có cơ hội được chấm điểm, dù fingerprint có sẵn sàng. Nhưng kẻ reup bê
 * nguyên audio thì LỜI NÓI vẫn còn nguyên, và YouTube có index caption. Tìm
 * đúng một câu trong đó sẽ lôi được chúng ra bất kể tiêu đề là gì.
 *
 * Mỗi truy vấn tốn 100 quota unit nên việc chọn cụm từ phải "đắt xắt ra
 * miếng": một cụm chung chung kiểu "xin chào các bạn" sẽ trả về rác và phí
 * trọn 100 unit.
 */

/** Từ quá phổ biến, xuất hiện trong mọi video nên không phân biệt được gì. */
const STOPWORDS = new Set([
  // Tiếng Việt (đã bỏ dấu vì normalizeText strip dấu)
  'la', 'va', 'cua', 'co', 'khong', 'nhung', 'duoc', 'nay', 'do', 'cho', 'voi',
  'thi', 'ma', 'ra', 'nen', 'cac', 'mot', 'nhu', 'khi', 'den', 'tu', 'trong',
  'ban', 'minh', 'toi', 'chung', 'rat', 'cung', 'se', 'da', 'dang', 'con',
  'hay', 'nhe', 'roi', 'lai', 'len', 'xuong', 'gi', 'the', 'nao', 'vi', 'sao',
  'chao', 'xin', 'kenh', 'video', 'like', 'share', 'dang', 'ky', 'subscribe',
  // Tiếng Anh
  'the', 'and', 'that', 'this', 'you', 'your', 'for', 'are', 'with', 'have',
  'they', 'from', 'what', 'when', 'will', 'about', 'just', 'like', 'know',
  'been', 'was', 'were', 'his', 'her', 'she', 'him', 'has', 'had', 'not',
  'but', 'all', 'can', 'get', 'got', 'out', 'now', 'here', 'there', 'very',
  'hello', 'welcome', 'back', 'guys', 'today', 'channel', 'subscribe'
])

export interface DistinctivePhrase {
  /** Cụm từ đã chuẩn hoá, dùng trực tiếp làm `q` cho search.list. */
  phrase: string
  /** Điểm đặc trưng — càng cao càng ít khả năng trả về rác. */
  score: number
}

const PHRASE_WORDS = 8
/** Dưới mức này thì cụm từ quá chung chung, không đáng 100 unit. */
const MIN_PHRASE_SCORE = 4
/** Bỏ qua phần mở đầu: intro thường là lời chào lặp lại ở mọi video. */
const SKIP_LEADING_RATIO = 0.15

/**
 * Chọn cửa sổ `PHRASE_WORDS` từ liên tiếp có nhiều "từ nội dung" nhất —
 * tức là từ đủ dài, không phải stopword, và KHÔNG có trong tiêu đề (những từ
 * trong tiêu đề đã được truy vấn thứ nhất phủ rồi, lặp lại là phí).
 */
export function extractDistinctivePhrase(
  transcript: string,
  titleText: string = ''
): DistinctivePhrase | null {
  const normalized = normalizeText(transcript)
  if (!normalized) return null

  const words = normalized.split(' ').filter(Boolean)
  if (words.length < PHRASE_WORDS) return null

  const titleTokens = new Set(normalizeText(titleText).split(' ').filter(Boolean))

  const start = Math.floor(words.length * SKIP_LEADING_RATIO)
  let best: DistinctivePhrase | null = null

  for (let i = start; i + PHRASE_WORDS <= words.length; i++) {
    const window = words.slice(i, i + PHRASE_WORDS)

    let score = 0
    for (const word of window) {
      if (word.length < 4) continue
      if (STOPWORDS.has(word)) continue
      if (titleTokens.has(word)) continue
      // Từ dài hiếm gặp hơn nên phân biệt tốt hơn; trần 3 để một từ rất dài
      // không tự mình gánh cả cụm.
      score += Math.min(3, word.length - 3)
    }

    if (!best || score > best.score) {
      best = { phrase: window.join(' '), score }
    }
  }

  if (!best || best.score < MIN_PHRASE_SCORE) return null
  return best
}

/**
 * Bọc trong dấu ngoặc kép để YouTube khớp đúng cụm thay vì rã ra từng từ —
 * khớp rời rạc sẽ trả về hàng nghìn video không liên quan và phí sạch quota.
 */
export function buildTranscriptSearchQuery(phrase: string): string {
  return `"${phrase}"`
}
