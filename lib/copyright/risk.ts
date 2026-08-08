import { MessageKey } from '@/lib/i18n/messages'

export type RiskLevel = 'high' | 'medium' | 'low'

/** Ngưỡng dùng chung cho mọi màn hình. Trước đây mỗi trang tự định nghĩa lại. */
export const RISK_THRESHOLD = { high: 70, medium: 45 } as const

export function riskLevel(score: number): RiskLevel {
  if (score >= RISK_THRESHOLD.high) return 'high'
  if (score >= RISK_THRESHOLD.medium) return 'medium'
  return 'low'
}

export const RISK_MESSAGE_KEY: Record<RiskLevel, MessageKey> = {
  high: 'risk.high',
  medium: 'risk.medium',
  low: 'risk.low'
}

/** Màu antd tương ứng, cho các chỗ còn dùng `<Tag color=...>`. */
export const RISK_TAG_COLOR: Record<RiskLevel, string> = {
  high: 'error',
  medium: 'warning',
  low: 'success'
}

const RISK_CSS_VAR: Record<RiskLevel, string> = {
  high: 'var(--danger)',
  medium: 'var(--warning)',
  low: 'var(--success)'
}

/** Biến màu CSS theo điểm — thay cho `scoreColor` từng bị nhân bản ở 3 trang. */
export function riskCssVar(score: number): string {
  return RISK_CSS_VAR[riskLevel(score)]
}
