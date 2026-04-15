'use client'

import { useEffect, useState } from 'react'
import { Layout, Table, Button, Drawer, Form, Input, Select, message, Popconfirm } from 'antd'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import PlatformBadge from '@/components/ui/PlatformBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { Keyword, Platform } from '@/types'

const { Content } = Layout

const platformOptions = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' }
]

export default function KeywordsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchKeywords()
    }
  }, [status, router])

  const fetchKeywords = async () => {
    try {
      const res = await fetch('/api/keywords')
      const data = await res.json()
      setKeywords(data)
    } catch (error) {
      console.error('Failed to fetch keywords:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (values: { term: string; platforms: Platform[]; refreshInterval: number }) => {
    setSubmitLoading(true)
    try {
      const res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      })

      if (res.ok) {
        message.success('Keyword created successfully')
        setDrawerOpen(false)
        form.resetFields()
        fetchKeywords()
      } else {
        const data = await res.json()
        message.error(data.error || 'Failed to create keyword')
      }
    } catch {
      message.error('An error occurred')
    } finally {
      setSubmitLoading(false)
    }
  }

  const columns = [
    {
      title: 'Keyword',
      dataIndex: 'term',
      key: 'term',
      render: (term: string) => <span style={{ fontWeight: 500 }}>{term}</span>
    },
    {
      title: 'Platforms',
      dataIndex: 'platforms',
      key: 'platforms',
      render: (platforms: Platform[]) => (
        <>
          {platforms.map(p => (
            <span key={p} style={{ marginRight: 8 }}>
              <PlatformBadge platform={p} />
            </span>
          ))}
        </>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'active' ? 'green' : status === 'paused' ? 'orange' : 'red'
        return <span style={{ color, textTransform: 'capitalize' }}>{status}</span>
      }
    },
    {
      title: 'Last Fetched',
      dataIndex: 'lastFetchedAt',
      key: 'lastFetchedAt',
      render: (date: string) => date ? new Date(date).toLocaleString() : 'Never'
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString()
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
        <Header title="Keywords" />
        <Content className="page-container">
          <div style={{ marginBottom: 24 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
              Add Keyword
            </Button>
          </div>

          <Table
            columns={columns}
            dataSource={keywords}
            rowKey="_id"
            pagination={{ pageSize: 10 }}
          />

          <Drawer
            title="Add Keyword"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            footer={null}
          >
            <Form form={form} layout="vertical" onFinish={handleCreate}>
              <Form.Item
                name="term"
                label="Keyword"
                rules={[{ required: true, message: 'Please enter a keyword term' }]}
              >
                <Input placeholder="Enter keyword to monitor" />
              </Form.Item>

              <Form.Item
                name="platforms"
                label="Platforms"
                rules={[{ required: true, message: 'Please select at least one platform' }]}
              >
                <Select mode="multiple" placeholder="Select platforms" options={platformOptions} />
              </Form.Item>

              <Form.Item
                name="refreshInterval"
                label="Refresh Interval (ms)"
                initialValue={3600000}
              >
                <Select
                  options={[
                    { value: 900000, label: '15 minutes' },
                    { value: 1800000, label: '30 minutes' },
                    { value: 3600000, label: '1 hour' },
                    { value: 7200000, label: '2 hours' }
                  ]}
                />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={submitLoading} block>
                  Create Keyword
                </Button>
              </Form.Item>
            </Form>
          </Drawer>
        </Content>
      </Layout>
    </Layout>
  )
}
