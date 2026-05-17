'use client'

import { useCallback, useEffect, useState } from 'react'
import { Layout, Table, Tag, Button, Spin, Empty } from 'antd'
import { ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import ScanWizard from '@/components/ui/ScanWizard'
import PlatformBadge from '@/components/ui/PlatformBadge'
import { ConnectorStatus, Platform, ScanRun } from '@/types'
import { useTranslation } from '@/lib/i18n/context'

const { Content } = Layout

const statusColors: Record<string, string> = {
  running: 'processing',
  completed: 'success',
  failed: 'error',
  queued: 'default'
}

export default function ScansPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  const [scans, setScans] = useState<ScanRun[]>([])
  const [connectorStatus, setConnectorStatus] = useState<ConnectorStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/scans')
      if (res.ok) {
        const data = await res.json()
        setScans(data.scans || [])
        setConnectorStatus(data.connectorStatus || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    else if (status === 'authenticated') load()
  }, [status, router, load])

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80, render: (v: number) => <span style={{ color: '#a1a1aa' }}>#{v}</span> },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColors[v] || 'default'}>{v}</Tag>
    },
    {
      title: 'Tài sản',
      dataIndex: 'asset_ids',
      key: 'asset_ids',
      render: (ids: number[]) => <span style={{ color: '#a1a1aa' }}>{ids?.length || 0} asset</span>
    },
    {
      title: 'Kết quả',
      dataIndex: 'findings_count',
      key: 'findings_count',
      render: (v: number) => <span style={{ color: v > 0 ? '#fcd34d' : '#a1a1aa', fontWeight: 600 }}>{v || 0}</span>
    },
    {
      title: 'Connectors',
      dataIndex: 'platform_status',
      key: 'platform_status',
      render: (statuses: ConnectorStatus[]) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(statuses || []).map(s => (
            <PlatformBadge key={s.platform} platform={s.platform} showLabel={false} />
          ))}
        </div>
      )
    },
    {
      title: 'Bắt đầu',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (d: string) => <span style={{ color: '#a1a1aa', fontSize: 12 }}>{d ? new Date(d).toLocaleString() : '—'}</span>
    },
    {
      title: 'Kết thúc',
      dataIndex: 'finished_at',
      key: 'finished_at',
      render: (d: string) => <span style={{ color: '#a1a1aa', fontSize: 12 }}>{d ? new Date(d).toLocaleString() : '—'}</span>
    }
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
        <Header title={t('nav.scans')} />
        <Content className="page-container">
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1>{t('scans.title')}</h1>
              <p>{t('scans.sub')}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button icon={<ReloadOutlined />} onClick={load}>Làm mới</Button>
              <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => setWizardOpen(true)} size="large">
                {t('scans.start')}
              </Button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
            {connectorStatus.map(s => (
              <div key={s.platform} className="cm-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <PlatformBadge platform={s.platform as Platform} />
                  <Tag color={s.capability === 'ready' ? 'success' : s.capability === 'limited' ? 'warning' : 'error'}>
                    {s.capability}
                  </Tag>
                </div>
                <div style={{ color: '#a1a1aa', fontSize: 12, lineHeight: 1.5 }}>{s.message}</div>
              </div>
            ))}
          </div>

          <div className="cm-card">
            <h3 style={{ color: '#fafafa', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{t('scans.history')}</h3>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
            ) : scans.length === 0 ? (
              <Empty description={<span style={{ color: '#71717a' }}>Chưa có lần quét nào</span>} />
            ) : (
              <Table dataSource={scans} columns={columns} rowKey="id" pagination={{ pageSize: 10 }} />
            )}
          </div>
        </Content>
      </Layout>

      <ScanWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCompleted={() => load()} />
    </Layout>
  )
}
