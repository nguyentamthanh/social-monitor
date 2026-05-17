'use client'

import { useEffect, useState } from 'react'
import { Layout, Table, Select, DatePicker, Input } from 'antd'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import PlatformBadge from '@/components/ui/PlatformBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { Mention, Platform } from '@/types'

const { Content } = Layout
const { RangePicker } = DatePicker

const platformOptions = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' }
]

interface MentionsResponse {
  mentions: Mention[]
  total: number
  limit: number
  skip: number
}

export default function MentionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [mentions, setMentions] = useState<Mention[]>([])
  const [total, setTotal] = useState(0)
  const [platform, setPlatform] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchMentions()
    }
  }, [status, router, platform, dateRange, page])

  const fetchMentions = async () => {
    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        skip: ((page - 1) * pageSize).toString()
      })

      if (platform) {
        params.append('platform', platform)
      }

      if (dateRange) {
        params.append('startDate', dateRange[0].toISOString())
        params.append('endDate', dateRange[1].toISOString())
      }

      const res = await fetch(`/api/mentions?${params}`)
      const data: MentionsResponse = await res.json()
      setMentions(data.mentions)
      setTotal(data.total)
    } catch (error) {
      console.error('Failed to fetch mentions:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: Platform) => <PlatformBadge platform={platform} />
    },
    {
      title: 'Content',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true
    },
    {
      title: 'Author',
      key: 'author',
      render: (_: any, record: Mention) => (
        <span>
          {record.author?.name} <span style={{ color: '#999' }}>@{record.author?.handle}</span>
        </span>
      )
    },
    {
      title: 'Metrics',
      key: 'metrics',
      render: (_: any, record: Mention) => (
        <span style={{ fontSize: 12, color: '#666' }}>
          Likes: {record.metrics?.likes || 0} | Shares: {record.metrics?.shares || 0} | Comments: {record.metrics?.comments || 0}
        </span>
      )
    },
    {
      title: 'Published',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      render: (date: string) => new Date(date).toLocaleDateString()
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Mention) => (
        <a href={record.url} target="_blank" rel="noopener noreferrer">View</a>
      )
    }
  ]

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
        <Header title="Mentions" />
        <Content className="page-container">
          <div className="filter-bar">
            <Select
              placeholder="Filter by Platform"
              allowClear
              style={{ width: 160 }}
              onChange={(value) => setPlatform(value)}
              options={platformOptions}
            />
            <RangePicker
              onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            />
          </div>

          <Table
            columns={columns}
            dataSource={mentions}
            rowKey="id"
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: (p) => setPage(p)
            }}
          />
        </Content>
      </Layout>
    </Layout>
  )
}
