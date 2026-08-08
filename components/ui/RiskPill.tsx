'use client'

import { riskLevel, RISK_MESSAGE_KEY } from '@/lib/copyright/risk'
import { useTranslation } from '@/lib/i18n/context'

interface Props {
  score: number
  size?: 'sm' | 'md' | 'lg'
  /** Hiện nhãn chữ ("Rủi ro cao") bên cạnh số, không chỉ chấm màu. */
  showLabel?: boolean
}

export default function RiskPill({ score, size = 'md', showLabel = false }: Props) {
  const { t } = useTranslation()
  const level = riskLevel(score)
  const padding = size === 'sm' ? '2px 8px' : size === 'lg' ? '6px 14px' : '4px 10px'
  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 15 : 13

  return (
    <span className={`risk-pill ${level}`} style={{ padding, fontSize }}>
      ●&nbsp;{score}
      {showLabel && <>&nbsp;·&nbsp;{t(RISK_MESSAGE_KEY[level])}</>}
    </span>
  )
}
