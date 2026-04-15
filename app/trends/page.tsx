'use client'

import { useEffect, useState } from 'react'
import { Layout, Card, Select } from 'antd'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import TrendChart from '@/components/charts/TrendChart'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const { Content } = Layout

const platformOptions = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' }
]

interface TrendItem {
  date: string
  platform: string
  mentionCount: number
  engagement: number
}

export default function TrendsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [trends, setTrends] = useState<TrendItem[]>([])
  const [platform, setPlatform] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchTrends()
    }
  }, [status, router, platform, days])

  const fetchTrends = async () => {
    try {
      const params = new URLSearchParams({ days: days.toString() })
      if (platform) {
        params.append('platform', platform)
      }

      const res = await fetch(`/api/trends?${params}`)
      const data = await res.json()
      setTrends(data)
    } catch (error) {
      console.error('Failed to fetch trends:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Sidebar />
        <Layout>
          <LoadingSpinner />
        </Layout>
      </Layout>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
        <Header title="Trends" />
        <Content className="page-container">
          <Card style={{ marginBottom: 24 }}>
            <div className="trend-filters">
              <Select
                placeholder="All Platforms"
                allowClear
                style={{ width: 160 }}
                onChange={(value) => setPlatform(value)}
                options={platformOptions}
              />
              <Select
                value={days}
                onChange={(value) => setDays(value)}
                options={[
                  { value: 7, label: 'Last 7 days' },
                  { value: 14, label: 'Last 14 days' },
                  { value: 30, label: 'Last 30 days' },
                  { value: 90, label: 'Last 90 days' }
                ]}
              />
            </div>
          </Card>

          <Card>
            <h3 className="chart-title">Mention Trends Over Time</h3>
            <TrendChart data={trends} />
          </Card>
        </Content>
      </Layout>
    </Layout>
  )
}
