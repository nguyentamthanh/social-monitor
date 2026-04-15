'use client'

import { Tag } from 'antd'
import { FacebookFilled, GoogleSquareFilled, YoutubeFilled, TikTokFilled } from '@ant-design/icons'
import { Platform } from '@/types'

const platformConfig: Record<Platform, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  facebook: { color: '#1877F2', bg: 'rgba(24, 119, 242, 0.12)', icon: <FacebookFilled />, label: 'Facebook' },
  google: { color: '#4285F4', bg: 'rgba(66, 133, 244, 0.12)', icon: <GoogleSquareFilled />, label: 'Google' },
  youtube: { color: '#FF0000', bg: 'rgba(255, 0, 0, 0.12)', icon: <YoutubeFilled />, label: 'YouTube' },
  tiktok: { color: '#000000', bg: 'rgba(0, 0, 0, 0.06)', icon: <TikTokFilled />, label: 'TikTok' }
}

interface PlatformBadgeProps {
  platform: Platform | string
  showLabel?: boolean
  showIcon?: boolean
}

export default function PlatformBadge({ platform, showLabel = true, showIcon = true }: PlatformBadgeProps) {
  const config = platformConfig[platform as Platform] || platformConfig.tiktok

  return (
    <Tag
      style={{
        background: config.bg,
        color: config.color,
        border: 'none',
        fontWeight: 600,
        fontSize: 12,
        padding: '4px 12px',
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6
      }}
      icon={showIcon ? config.icon : undefined}
    >
      {showLabel && config.label}
    </Tag>
  )
}
