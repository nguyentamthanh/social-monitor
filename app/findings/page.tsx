'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Layout, Select, Pagination, Spin, Empty, Tag, Drawer, Segmented, Popconfirm, Button, message
} from 'antd'
import {
  AppstoreOutlined, UnorderedListOutlined, EyeOutlined, CheckOutlined, CloseOutlined, DeleteOutlined
} from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import PlatformBadge from '@/components/ui/PlatformBadge'
import RiskPill from '@/components/ui/RiskPill'
import { Finding, FindingStatus, Platform } from '@/types'
import { useTranslation } from '@/lib/i18n/context'

const { Content } = Layout

export default function FindingsPage() {
  const { status: authStatus } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  const [findings, setFindings] = useState<Finding[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(12)
  const [statusFilter, setStatusFilter] = useState<FindingStatus | undefined>(undefined)
  const [platformFilter, setPlatformFilter] = useState<Platform | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [selected, setSelected] = useState<Finding | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((page - 1) * pageSize)
      })
      if (statusFilter) params.set('status', statusFilter)
      if (platformFilter) params.set('platform', platformFilter)
      const res = await fetch(`/api/findings?${params}`)
      if (res.ok) {
        const data = await res.json()
        setFindings(data.findings || [])
        setTotal(data.total || 0)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, statusFilter, platformFilter])

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login')
    else if (authStatus === 'authenticated') load()
  }, [authStatus, router, load])

  const updateStatus = async (id: number, status: FindingStatus) => {
    try {
      const res = await fetch(`/api/findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (!res.ok) throw new Error('Update failed')
      message.success('Đã cập nhật trạng thái')
      load()
    } catch (err: any) {
      message.error(err?.message || 'Có lỗi xảy ra')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/findings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      message.success('Đã xóa')
      load()
    } catch (err: any) {
      message.error(err?.message || 'Có lỗi xảy ra')
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
        <Header title={t('nav.findings')} />
        <Content className="page-container">
          <div className="page-header">
            <h1>{t('findings.title')}</h1>
            <p>{t('findings.sub')}</p>
          </div>

          <div className="filter-bar" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <Select
                placeholder="Trạng thái"
                allowClear
                value={statusFilter}
                onChange={(v) => { setStatusFilter(v); setPage(1) }}
                options={[
                  { label: 'Mới', value: 'new' },
                  { label: 'Đang xem xét', value: 'reviewing' },
                  { label: 'Xác nhận', value: 'confirmed' },
                  { label: 'Đã loại bỏ', value: 'dismissed' }
                ]}
              />
              <Select
                placeholder="Nền tảng"
                allowClear
                value={platformFilter}
                onChange={(v) => { setPlatformFilter(v); setPage(1) }}
                options={[
                  { label: 'YouTube', value: 'youtube' },
                  { label: 'Google', value: 'google' },
                  { label: 'Facebook', value: 'facebook' },
                  { label: 'TikTok', value: 'tiktok' }
                ]}
              />
              <span style={{ color: '#71717a', fontSize: 12 }}>Tổng: {total}</span>
            </div>
            <Segmented
              value={view}
              onChange={(v) => setView(v as 'grid' | 'table')}
              options={[
                { label: 'Lưới', value: 'grid', icon: <AppstoreOutlined /> },
                { label: 'Bảng', value: 'table', icon: <UnorderedListOutlined /> }
              ]}
            />
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
          ) : findings.length === 0 ? (
            <div className="cm-card" style={{ textAlign: 'center', padding: 60 }}>
              <Empty description={<span style={{ color: '#71717a' }}>Chưa có vi phạm nào</span>} />
            </div>
          ) : view === 'grid' ? (
            <div className="finding-grid">
              {findings.map(f => (
                <div key={f.id} className="finding-card" onClick={() => setSelected(f)}>
                  <div className="finding-thumb">
                    <span style={{ fontSize: 40, color: '#71717a' }}>⚠</span>
                    <div style={{ position: 'absolute', top: 10, left: 10 }}><RiskPill score={f.risk_score} /></div>
                    <div style={{ position: 'absolute', top: 10, right: 10 }}><PlatformBadge platform={f.platform as Platform} showLabel={false} /></div>
                  </div>
                  <div className="finding-body">
                    <div className="finding-title">{f.title}</div>
                    <div className="finding-meta">
                      <Tag>{f.status}</Tag>
                      <span>{new Date(f.found_at).toLocaleDateString()}</span>
                    </div>
                    {f.reasons?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                        {f.reasons.slice(0, 3).map(r => (
                          <Tag key={r.code} style={{ fontSize: 10, padding: '0 6px' }}>{r.label}</Tag>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="cm-card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th style={{ textAlign: 'left', padding: 12, color: '#71717a', fontSize: 11, textTransform: 'uppercase' }}>Risk</th>
                    <th style={{ textAlign: 'left', padding: 12, color: '#71717a', fontSize: 11, textTransform: 'uppercase' }}>Title</th>
                    <th style={{ textAlign: 'left', padding: 12, color: '#71717a', fontSize: 11, textTransform: 'uppercase' }}>Platform</th>
                    <th style={{ textAlign: 'left', padding: 12, color: '#71717a', fontSize: 11, textTransform: 'uppercase' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: 12, color: '#71717a', fontSize: 11, textTransform: 'uppercase' }}>Found</th>
                    <th style={{ padding: 12 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map(f => (
                    <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }} onClick={() => setSelected(f)}>
                      <td style={{ padding: 12 }}><RiskPill score={f.risk_score} /></td>
                      <td style={{ padding: 12, color: '#fafafa', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</td>
                      <td style={{ padding: 12 }}><PlatformBadge platform={f.platform as Platform} /></td>
                      <td style={{ padding: 12 }}><Tag>{f.status}</Tag></td>
                      <td style={{ padding: 12, color: '#71717a', fontSize: 12 }}>{new Date(f.found_at).toLocaleDateString()}</td>
                      <td style={{ padding: 12 }}>
                        <Button size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); setSelected(f) }}>Xem</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > pageSize && (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Pagination current={page} pageSize={pageSize} total={total} onChange={setPage} />
            </div>
          )}
        </Content>
      </Layout>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.title} width={520}>
        {selected && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <RiskPill score={selected.risk_score} size="lg" />
              <PlatformBadge platform={selected.platform as Platform} />
              <Tag>{selected.status}</Tag>
            </div>
            <div style={{ background: '#13131a', padding: 16, borderRadius: 12, marginBottom: 16, color: '#a1a1aa', fontSize: 13, lineHeight: 1.6 }}>
              {selected.content}
            </div>
            <div style={{ marginBottom: 16 }}>
              <a href={selected.url} target="_blank" rel="noopener noreferrer" style={{ color: '#8b5cf6', wordBreak: 'break-all' }}>
                {selected.url}
              </a>
            </div>
            {selected.reasons?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#71717a', fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>Lý do</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected.reasons.map(r => (
                    <div key={r.code} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#13131a', borderRadius: 8 }}>
                      <span style={{ color: '#fafafa', fontSize: 13 }}>{r.label}</span>
                      <span style={{ color: r.points > 0 ? '#fcd34d' : '#6ee7b7', fontWeight: 600, fontSize: 13 }}>
                        {r.points > 0 ? '+' : ''}{r.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button icon={<EyeOutlined />} onClick={() => updateStatus(selected.id, 'reviewing')}>{t('findings.markReviewing')}</Button>
              <Button type="primary" icon={<CheckOutlined />} onClick={() => updateStatus(selected.id, 'confirmed')}>{t('findings.markConfirmed')}</Button>
              <Button icon={<CloseOutlined />} onClick={() => updateStatus(selected.id, 'dismissed')}>{t('findings.markDismissed')}</Button>
              <Popconfirm title="Xóa vi phạm này?" onConfirm={() => { handleDelete(selected.id); setSelected(null) }}>
                <Button danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
              </Popconfirm>
            </div>
          </div>
        )}
      </Drawer>
    </Layout>
  )
}
