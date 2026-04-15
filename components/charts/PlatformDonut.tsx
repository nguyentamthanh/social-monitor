'use client'

import { useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { FacebookFilled, GoogleSquareFilled, YoutubeFilled, TikTokFilled } from '@ant-design/icons'
import * as echarts from 'echarts'

interface PlatformDonutProps {
  data: Array<{
    platform: string
    mentions: number
    engagement: number
  }>
}

const platformConfig: Record<string, { color: string; icon: React.ReactNode; gradient: string }> = {
  facebook: {
    color: '#1877F2',
    gradient: 'linear-gradient(135deg, #1877F2, #4267B2)',
    icon: <FacebookFilled />
  },
  google: {
    color: '#4285F4',
    gradient: 'linear-gradient(135deg, #4285F4, #34A853)',
    icon: <GoogleSquareFilled />
  },
  youtube: {
    color: '#FF0000',
    gradient: 'linear-gradient(135deg, #FF0000, #CC0000)',
    icon: <YoutubeFilled />
  },
  tiktok: {
    color: '#000000',
    gradient: 'linear-gradient(135deg, #333333, #000000)',
    icon: <TikTokFilled />
  }
}

export default function PlatformDonut({ data }: PlatformDonutProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const total = data.reduce((sum, d) => sum + d.mentions, 0)

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      padding: [12, 16],
      textStyle: { color: '#1e293b', fontSize: 13 },
      formatter: (params: any) => {
        return `<div style="font-weight:600;margin-bottom:4px">${params.name}</div>
          <div style="display:flex;justify-content:space-between;gap:16px">
            <span style="color:#64748b">Mentions</span>
            <span style="font-weight:600">${params.value.toLocaleString()}</span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:16px">
            <span style="color:#64748b">Share</span>
            <span style="font-weight:600">${params.percent.toFixed(1)}%</span>
          </div>`
      }
    },
    series: [
      {
        name: 'Platform',
        type: 'pie',
        radius: ['55%', '80%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 3
        },
        label: {
          show: false
        },
        emphasis: {
          scale: true,
          scaleSize: 10,
          label: {
            show: false
          }
        },
        labelLine: {
          show: false
        },
        data: data.map(d => ({
          value: d.mentions,
          name: d.platform.charAt(0).toUpperCase() + d.platform.slice(1),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
              { offset: 0, color: platformConfig[d.platform]?.color || '#6366f1' },
              { offset: 1, color: platformConfig[d.platform]?.color || '#6366f1' + '99' }
            ])
          }
        }))
      }
    ]
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>{total.toLocaleString()}</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Total</div>
      </div>
      <ReactECharts
        option={option}
        style={{ height: 300 }}
        opts={{ renderer: 'svg' }}
        onEvents={{ click: (params: any) => setSelectedPlatform(params.name.toLowerCase()) }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 16 }}>
        {data.map(d => {
          const config = platformConfig[d.platform]
          const isSelected = selectedPlatform === d.platform
          return (
            <div
              key={d.platform}
              onClick={() => setSelectedPlatform(isSelected ? null : d.platform)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: isSelected ? config?.gradient || '#6366f1' : '#f8fafc',
                color: isSelected ? 'white' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: isSelected ? 'none' : '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span style={{ fontSize: 16 }}>{config?.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, opacity: isSelected ? 0.8 : 1 }}>{d.platform}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{d.mentions.toLocaleString()}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
