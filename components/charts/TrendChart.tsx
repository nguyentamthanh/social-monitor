'use client'

import { useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Segmented } from 'antd'
import * as echarts from 'echarts'

interface TrendChartProps {
  data: Array<{
    date: string
    platform: string
    mentionCount: number
    engagement: number
  }>
}

const platformColors: Record<string, string> = {
  facebook: '#1877F2',
  google: '#4285F4',
  youtube: '#FF0000',
  tiktok: '#000000'
}

const platformGradients: Record<string, string> = {
  facebook: 'rgba(24, 119, 242, 0.3)',
  google: 'rgba(66, 133, 244, 0.3)',
  youtube: 'rgba(255, 0, 0, 0.3)',
  tiktok: 'rgba(0, 0, 0, 0.2)'
}

export default function TrendChart({ data }: TrendChartProps) {
  const [chartType, setChartType] = useState<string>('area')
  const dates = [...new Set(data.map(d => d.date))].sort()
  const platforms = [...new Set(data.map(d => d.platform))]

  const getSeries = (type: string) => {
    return platforms.map(platform => {
      const color = platformColors[platform] || '#6366f1'
      const gradient = platformGradients[platform] || 'rgba(99, 102, 241, 0.3)'

      if (type === 'area') {
        return {
          name: platform.charAt(0).toUpperCase() + platform.slice(1),
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          sampling: 'average' as const,
          itemStyle: {
            color: color,
            borderWidth: 2,
            borderColor: '#fff'
          },
          lineStyle: { width: 3 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: gradient },
              { offset: 1, color: 'rgba(255,255,255,0)' }
            ])
          },
          emphasis: { scale: true, scaleSize: 10 },
          data: dates.map(date => {
            const item = data.find(d => d.date === date && d.platform === platform)
            return item?.mentionCount || 0
          })
        }
      } else if (type === 'bar') {
        return {
          name: platform.charAt(0).toUpperCase() + platform.slice(1),
          type: 'bar' as const,
          stack: 'total',
          itemStyle: { color: color, borderRadius: [4, 4, 0, 0] },
          barWidth: '60%',
          data: dates.map(date => {
            const item = data.find(d => d.date === date && d.platform === platform)
            return item?.mentionCount || 0
          })
        }
      } else {
        return {
          name: platform.charAt(0).toUpperCase() + platform.slice(1),
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 3, color: color },
          itemStyle: { color: color },
          data: dates.map(date => {
            const item = data.find(d => d.date === date && d.platform === platform)
            return item?.mentionCount || 0
          })
        }
      }
    })
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      padding: [12, 16],
      textStyle: { color: '#1e293b', fontSize: 13 },
      axisPointer: {
        type: 'cross',
        crossStyle: { color: '#94a3b8' },
        lineStyle: { color: '#94a3b8', type: 'dashed' }
      },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return ''
        let result = `<div style="font-weight:600;margin-bottom:8px">${params[0].axisValue}</div>`
        params.forEach((param: any) => {
          result += `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${param.color}"></span>
            <span style="flex:1">${param.seriesName}</span>
            <span style="font-weight:600">${param.value.toLocaleString()}</span>
          </div>`
        })
        return result
      }
    },
    legend: {
      show: true,
      bottom: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 24,
      textStyle: { color: '#64748b', fontSize: 12 }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '18%',
      top: '8%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: chartType === 'bar',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#94a3b8',
        fontSize: 11,
        formatter: (value: string) => {
          const date = new Date(value)
          return `${date.getMonth() + 1}/${date.getDate()}`
        }
      }
    },
    yAxis: {
      type: 'value',
      name: 'Mentions',
      nameTextStyle: { color: '#94a3b8', fontSize: 11, padding: [0, 0, 8, 0] },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 11 }
    },
    series: getSeries(chartType)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Segmented
          size="small"
          options={[
            { label: 'Area', value: 'area' },
            { label: 'Line', value: 'line' },
            { label: 'Stacked', value: 'bar' }
          ]}
          onChange={(value) => setChartType(value as string)}
        />
      </div>
      <ReactECharts
        option={option}
        style={{ height: 380 }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  )
}
