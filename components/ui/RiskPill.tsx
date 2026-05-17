'use client'

interface Props {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

export default function RiskPill({ score, size = 'md' }: Props) {
  const level = score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low'
  const padding = size === 'sm' ? '2px 8px' : size === 'lg' ? '6px 14px' : '4px 10px'
  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 15 : 13

  return (
    <span className={`risk-pill ${level}`} style={{ padding, fontSize }}>
      ●&nbsp;{score}
    </span>
  )
}
