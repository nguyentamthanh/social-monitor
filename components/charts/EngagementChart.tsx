'use client'

import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'

interface EngagementChartProps {
  data: Array<{
    platform: string
    mentions: number
    engagement: number
  }>
}

const platformColors: Record<string, string> = {
  facebook: '#1877F2',
  google: '#4285F4',
  youtube: '#FF0000',
  tiktok: '#000000'
}

export default function EngagementChart({ data }: EngagementChartProps) {
  const sortedData = [...data].sort((a, b) => b.engagement - a.engagement)

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      padding: [12, 16],
      textStyle: { color: '#1e293b', fontSize: 13 },
      formatter: (params: any) => {
        const item = params[0]
        const dataItem = sortedData[item.dataIndex]
        return `<div style="font-weight:600;margin-bottom:8px">${item.name}</div>
          <div style="display:flex;justify-content:space-between;gap:16px">
            <span style="color:#64748b">Engagement</span>
            <span style="font-weight:600">${dataItem?.engagement.toLocaleString() || 0}</span>
          </div>`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 }
    },
    yAxis: {
      type: 'category',
      data: sortedData.map(d => d.platform.charAt(0).toUpperCase() + d.platform.slice(1)),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#64748b', fontSize: 12, fontWeight: 500 }
    },
    series: [
      {
        name: 'Engagement',
        type: 'bar',
        data: sortedData.map(d => ({
          value: d.engagement,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: platformColors[d.platform] || '#6366f1' },
              { offset: 1, color: (platformColors[d.platform] || '#6366f1') + '44' }
            ]),
            borderRadius: [0, 6, 6, 0]
          }
        })),
        barWidth: '50%',
        label: {
          show: true,
          position: 'right',
          formatter: '{c}',
          color: '#64748b',
          fontSize: 11
        },
        showBackground: true,
        backgroundStyle: {
          color: '#f1f5f9',
          borderRadius: [0, 6, 6, 0]
        },
        animationDelay: (idx: number) => idx * 100
      }
    ],
    animationEasing: 'elasticOut',
    animationDuration: 1200
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 220 }}
      opts={{ renderer: 'svg' }}
    />
  )
}
