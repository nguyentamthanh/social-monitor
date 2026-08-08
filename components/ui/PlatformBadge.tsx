'use client'

import { FacebookFilled, GoogleSquareFilled, YoutubeFilled, TikTokFilled, PlaySquareFilled } from '@ant-design/icons'
import { Platform } from '@/types'

const platformConfig: Record<Platform, { icon: React.ReactNode; label: string }> = {
  facebook: { icon: <FacebookFilled />, label: 'Facebook' },
  google: { icon: <GoogleSquareFilled />, label: 'Google' },
  youtube: { icon: <YoutubeFilled />, label: 'YouTube' },
  tiktok: { icon: <TikTokFilled />, label: 'TikTok' },
  dailymotion: { icon: <PlaySquareFilled />, label: 'Dailymotion' }
}

interface PlatformBadgeProps {
  platform: Platform | string
  showLabel?: boolean
  showIcon?: boolean
}

export default function PlatformBadge({ platform, showLabel = true, showIcon = true }: PlatformBadgeProps) {
  const config = platformConfig[platform as Platform] || platformConfig.tiktok
  return (
    <span className={`platform-pill ${platform}`}>
      {showIcon && <span style={{ display: 'inline-flex' }}>{config.icon}</span>}
      {showLabel && config.label}
    </span>
  )
}
