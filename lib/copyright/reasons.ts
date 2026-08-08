/**
 * Từ điển lý do dùng chung cho cả hai engine chấm điểm (`scoring.ts` cho quét
 * theo tài sản và `findCopies.ts` cho tìm reup YouTube). Trước đây hai file
 * giữ hai bảng nhãn riêng nên cùng một khái niệm hiện ra với chữ khác nhau.
 *
 * `class` phân hạng độ mạnh của bằng chứng và quyết định trần điểm:
 *  - `weak`   — chỉ khớp chuỗi (tên, keyword, tag). Trùng tên là chuyện thường
 *               gặp, tự nó không chứng minh vi phạm.
 *  - `medium` — khớp nội dung có cấu trúc (văn bản, mô tả, transcript, thumbnail).
 *  - `strong` — đã đối chiếu media thật (pHash ảnh, fingerprint audio, frame video).
 *  - `penalty`— tín hiệu loại trừ, luôn âm điểm và không nâng trần.
 */
export type EvidenceClass = 'weak' | 'medium' | 'strong' | 'penalty'

/**
 * Trần điểm theo hạng bằng chứng cao nhất có mặt. Chỉ trùng tiêu đề thì tối đa
 * 35 — vẫn lưu và vẫn thấy, nhưng nằm dưới ngưỡng "trung bình" (45) nên không
 * còn kêu gào "rủi ro cao". Khi worker xác minh được audio/frame, hạng lên
 * `strong` và điểm mới được phép chạm 100.
 */
export const EVIDENCE_CAP: Record<Exclude<EvidenceClass, 'penalty'>, number> = {
  weak: 35,
  medium: 70,
  strong: 100
}

export interface ReasonSpec {
  label: string
  class: EvidenceClass
}

export const REASON_SPECS: Record<string, ReasonSpec> = {
  // --- Khớp chuỗi: yếu ---
  brand_name_match: { label: 'Trùng tên thương hiệu', class: 'weak' },
  keyword_match: { label: 'Trùng keyword theo dõi', class: 'weak' },
  tag_overlap: { label: 'Trùng tags', class: 'weak' },
  title_match: { label: 'Trùng tên video', class: 'weak' },
  audio_title_match: { label: 'Trùng tên bài hát/audio (chỉ so chữ)', class: 'weak' },
  audio_artist_match: { label: 'Trùng nghệ sĩ/hãng phát hành (chỉ so chữ)', class: 'weak' },
  audio_streaming_host: { label: 'Xuất hiện trên dịch vụ streaming', class: 'weak' },

  // --- Khớp nội dung có cấu trúc: trung bình ---
  text_similarity_high: { label: 'Nội dung giống văn bản gốc', class: 'medium' },
  description_match: { label: 'Trùng description', class: 'medium' },
  transcript_match: { label: 'Transcript trùng nội dung', class: 'medium' },
  thumbnail_match: { label: 'Thumbnail tương đồng', class: 'medium' },

  // --- Đã đối chiếu media thật: mạnh ---
  image_phash_match: { label: 'Ảnh có perceptual hash tương đồng', class: 'strong' },
  video_thumbnail_match: { label: 'Thumbnail video tương đồng tài sản', class: 'strong' },
  audio_fingerprint_match: { label: 'Âm thanh fingerprint tương đồng', class: 'strong' },
  video_frame_match: { label: 'Frame video tương đồng', class: 'strong' },

  // --- Loại trừ: âm điểm ---
  official_domain_match: { label: 'Nguồn thuộc domain chính thức', class: 'penalty' },
  same_channel: { label: 'Cùng channel (loại trừ)', class: 'penalty' },
  older_than_original: { label: 'Đăng trước video gốc (có thể video gốc copy lại)', class: 'penalty' },
  newer_than_original: { label: 'Đăng sau video gốc', class: 'weak' }
}

export function reasonLabel(code: string): string {
  return REASON_SPECS[code]?.label || code
}

export function reasonClass(code: string): EvidenceClass {
  return REASON_SPECS[code]?.class || 'weak'
}

/**
 * Cộng điểm rồi chặn theo trần của hạng bằng chứng cao nhất. Trả thêm
 * `needsVerification` để UI nói rõ "chưa xác minh media" thay vì để người dùng
 * tự đoán vì sao điểm thấp.
 */
export function capRiskScore(reasons: Array<{ code: string; points: number }>): {
  riskScore: number
  topClass: EvidenceClass
  needsVerification: boolean
} {
  const raw = reasons.reduce((sum, item) => sum + item.points, 0)

  let topClass: EvidenceClass = 'penalty'
  for (const item of reasons) {
    const cls = reasonClass(item.code)
    if (cls === 'strong') { topClass = 'strong'; break }
    if (cls === 'medium') topClass = 'medium'
    else if (cls === 'weak' && topClass !== 'medium') topClass = 'weak'
  }

  const cap = topClass === 'penalty' ? 0 : EVIDENCE_CAP[topClass]
  const riskScore = Math.max(0, Math.min(cap, raw))

  return { riskScore, topClass, needsVerification: topClass !== 'strong' }
}
