'use client'

import { useEffect, useState } from 'react'
import { Layout, Table, Card, Row, Col, Typography, Empty, Progress, Tag, Avatar } from 'antd'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import StatsCard from '@/components/ui/StatsCard'
import TrendChart from '@/components/charts/TrendChart'
import PlatformDonut from '@/components/charts/PlatformDonut'
import EngagementChart from '@/components/charts/EngagementChart'
import PlatformBadge from '@/components/ui/PlatformBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { MessageOutlined, TagsOutlined, LikeOutlined, RiseOutlined, EyeOutlined, HeartOutlined, ShareAltOutlined, CommentOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const { Content } = Layout
const { Title, Text, Paragraph } = Typography

interface DashboardData {
  stats: {
    totalMentions: number
    activeKeywords: number
    avgEngagement: number
    topPlatform: string
  }
  platformBreakdown: Array<{ platform: string; mentions: number; engagement: number }>
  recentMentions: Array<{
    _id: string
    content: string
    platform: string
    author: { name: string; handle: string; avatar?: string }
    url: string
    metrics: { likes: number; shares: number; comments: number; views: number }
    publishedAt: string
    keyword: string
  }>
  trends?: Array<{ date: string; platform: string; mentionCount: number; engagement: number }>
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Compute values on client only to avoid hydration mismatch
  const formatNumber = (num: number | undefined) => {
    if (!mounted) return num || 0
    return (num || 0).toLocaleString()
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchData()
    }
  }, [status, router])

  const fetchData = async () => {
    try {
      const [dashboardRes, trendsRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/trends?days=14')
      ])
      const dashboardData = await dashboardRes.json()
      const trendsData = await trendsRes.json()
      setData({ ...dashboardData, trends: trendsData })
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEngagementRate = () => {
    if (!data?.stats.totalMentions || !data?.stats.avgEngagement) return 0
    return Math.min(100, Math.round((data.stats.avgEngagement / 100) * 100))
  }

  if (status === 'loading' || loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Sidebar />
        <Layout style={{ marginLeft: 260 }}>
          <LoadingSpinner />
        </Layout>
      </Layout>
    )
  }

  const hasData = data?.recentMentions && data.recentMentions.length > 0

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout style={{ marginLeft: 260 }}>
        <Header title="Dashboard" />
        <Content className="page-container">
          {/* Welcome Section */}
          <div style={{ marginBottom: 28 }}>
            <Title level={3} style={{ margin: 0, color: '#1e293b', fontWeight: 700 }}>
              Welcome back, {session?.user?.name}
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>
              Here&apos;s what&apos;s happening with your keywords today.
            </Text>
          </div>

          {/* Stats Cards */}
          <div className="stats-grid">
            <StatsCard
              title="Total Mentions"
              value={data?.stats.totalMentions || 0}
              icon={<MessageOutlined />}
              iconColor="#6366f1"
              gradient="linear-gradient(135deg, #6366f1, #818cf8)"
            />
            <StatsCard
              title="Active Keywords"
              value={data?.stats.activeKeywords || 0}
              icon={<TagsOutlined />}
              iconColor="#10b981"
              gradient="linear-gradient(135deg, #10b981, #34d399)"
            />
            <StatsCard
              title="Avg Engagement"
              value={data?.stats.avgEngagement || 0}
              icon={<LikeOutlined />}
              iconColor="#f59e0b"
              gradient="linear-gradient(135deg, #f59e0b, #fbbf24)"
            />
            <StatsCard
              title="Top Platform"
              value={data?.stats.topPlatform ? data.stats.topPlatform.charAt(0).toUpperCase() + data.stats.topPlatform.slice(1) : 'N/A'}
              icon={<RiseOutlined />}
              iconColor="#ef4444"
              gradient="linear-gradient(135deg, #ef4444, #f87171)"
            />
          </div>

          {/* Charts Row */}
          <Row gutter={20} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={16}>
              <div className="chart-card" style={{ height: '100%' }}>
                <h3 className="chart-title">Trend Analysis</h3>
                {data?.trends && data.trends.length > 0 ? (
                  <TrendChart data={data.trends} />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No trend data yet. Add keywords to start monitoring."
                    style={{ padding: '60px 0' }}
                  />
                )}
              </div>
            </Col>
            <Col xs={24} lg={8}>
              <div className="chart-card" style={{ height: '100%' }}>
                <h3 className="chart-title">Platform Distribution</h3>
                {data?.platformBreakdown && data.platformBreakdown.length > 0 ? (
                  <PlatformDonut data={data.platformBreakdown} />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No data yet"
                    style={{ padding: '60px 0' }}
                  />
                )}
              </div>
            </Col>
          </Row>

          {/* Second Charts Row */}
          <Row gutter={20} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <div className="chart-card">
                <h3 className="chart-title">Engagement by Platform</h3>
                {data?.platformBreakdown && data.platformBreakdown.length > 0 ? (
                  <EngagementChart data={data.platformBreakdown} />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No engagement data yet"
                    style={{ padding: '40px 0' }}
                  />
                )}
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div className="chart-card">
                <h3 className="chart-title">Quick Stats</h3>
                <div style={{ padding: '8px 0' }}>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text type="secondary">Engagement Rate</Text>
                      <Text strong>{getEngagementRate()}%</Text>
                    </div>
                    <Progress percent={getEngagementRate()} showInfo={false} strokeColor="#6366f1" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    <div style={{ textAlign: 'center', padding: 16, background: '#f8fafc', borderRadius: 12 }}>
                      <LikeOutlined style={{ fontSize: 24, color: '#ef4444', marginBottom: 8 }} />
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>
                        {formatNumber(data?.recentMentions?.reduce((sum, m) => sum + (m.metrics?.likes || 0), 0))}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>Total Likes</Text>
                    </div>
                    <div style={{ textAlign: 'center', padding: 16, background: '#f8fafc', borderRadius: 12 }}>
                      <ShareAltOutlined style={{ fontSize: 24, color: '#10b981', marginBottom: 8 }} />
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>
                        {formatNumber(data?.recentMentions?.reduce((sum, m) => sum + (m.metrics?.shares || 0), 0))}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>Total Shares</Text>
                    </div>
                    <div style={{ textAlign: 'center', padding: 16, background: '#f8fafc', borderRadius: 12 }}>
                      <CommentOutlined style={{ fontSize: 24, color: '#6366f1', marginBottom: 8 }} />
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>
                        {formatNumber(data?.recentMentions?.reduce((sum, m) => sum + (m.metrics?.comments || 0), 0))}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>Comments</Text>
                    </div>
                    <div style={{ textAlign: 'center', padding: 16, background: '#f8fafc', borderRadius: 12 }}>
                      <EyeOutlined style={{ fontSize: 24, color: '#f59e0b', marginBottom: 8 }} />
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>
                        {formatNumber(data?.recentMentions?.reduce((sum, m) => sum + (m.metrics?.views || 0), 0))}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>Views</Text>
                    </div>
                  </div>
                </div>
              </div>
            </Col>
          </Row>

          {/* Recent Mentions Table */}
          <div className="table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 className="chart-title" style={{ margin: 0 }}>Recent Mentions</h3>
              {hasData && (
                <Tag color="blue">{data?.recentMentions.length} mentions</Tag>
              )}
            </div>
            {hasData ? (
              <Table
                dataSource={data?.recentMentions}
                rowKey="_id"
                pagination={{ pageSize: 8, showSizeChanger: false }}
                style={{ marginTop: 8 }}
              >
                <Table.Column
                  title="Platform"
                  dataIndex="platform"
                  width={130}
                  render={(platform: string) => <PlatformBadge platform={platform} />}
                />
                <Table.Column
                  title="Content"
                  dataIndex="content"
                  ellipsis
                  render={(text: string) => (
                    <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, maxWidth: 400 }}>
                      {text}
                    </Paragraph>
                  )}
                />
                <Table.Column
                  title="Author"
                  key="author"
                  width={160}
                  render={(_, record: any) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar
                        size={32}
                        style={{
                          background: record.platform === 'facebook' ? '#1877F2' :
                            record.platform === 'youtube' ? '#FF0000' :
                              record.platform === 'google' ? '#4285F4' : '#000'
                        }}
                        src={record.author?.avatar}
                      >
                        {record.author?.name?.charAt(0) || 'U'}
                      </Avatar>
                      <div>
                        <Text strong style={{ fontSize: 13 }}>{record.author?.name || 'Unknown'}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>@{record.author?.handle || 'unknown'}</Text>
                      </div>
                    </div>
                  )}
                />
                <Table.Column
                  title="Keyword"
                  dataIndex="keyword"
                  width={130}
                  render={(keyword: string) => (
                    <Tag color="purple" style={{ borderRadius: 4 }}>{keyword}</Tag>
                  )}
                />
                <Table.Column
                  title="Metrics"
                  key="metrics"
                  width={180}
                  render={(_, record: any) => (
                    <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                      <span><HeartOutlined style={{ color: '#ef4444' }} /> {formatNumber(record.metrics?.likes)}</span>
                      <span><ShareAltOutlined style={{ color: '#10b981' }} /> {formatNumber(record.metrics?.shares)}</span>
                      <span><CommentOutlined style={{ color: '#6366f1' }} /> {formatNumber(record.metrics?.comments)}</span>
                    </div>
                  )}
                />
                <Table.Column
                  title="Time"
                  dataIndex="publishedAt"
                  width={120}
                  render={(date: string) => (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(date).fromNow()}
                    </Text>
                  )}
                />
              </Table>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <Text type="secondary">No mentions found yet.</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>Start by adding keywords to monitor across platforms.</Text>
                  </div>
                }
                style={{ padding: '40px 0' }}
              />
            )}
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
