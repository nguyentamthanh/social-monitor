'use client'

import { Card, Statistic } from 'antd'

interface StatsCardProps {
  title: string
  value: number | string
  prefix?: React.ReactNode
  suffix?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  icon?: React.ReactNode
  iconColor?: string
  gradient?: string
}

export default function StatsCard({ title, value, prefix, suffix, trend, icon, iconColor = '#6366f1', gradient = 'linear-gradient(135deg, #6366f1, #818cf8)' }: StatsCardProps) {
  return (
    <div className="stats-card">
      <Statistic
        title={title}
        value={value}
        prefix={prefix}
        suffix={suffix}
        valueStyle={{ fontWeight: 700, fontSize: 28, color: '#1e293b' }}
      />
      {trend && (
        <span style={{ color: trend.isPositive ? '#10b981' : '#ef4444', fontSize: 13, fontWeight: 500 }}>
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </span>
      )}
      {icon && (
        <div className="stats-icon" style={{ background: gradient }}>
          <span style={{ color: 'white' }}>{icon}</span>
        </div>
      )}
    </div>
  )
}
