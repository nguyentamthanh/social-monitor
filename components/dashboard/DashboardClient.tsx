'use client'

import { useCallback, useEffect, useState } from 'react'
import { Layout, Empty, Tag, Spin, Button, Tooltip, Input } from 'antd'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileProtectOutlined,
  SecurityScanOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  FieldTimeOutlined,
  ArrowRightOutlined,
  LinkOutlined,
  SearchOutlined,
  PlayCircleOutlined
} from '@ant-design/icons'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import ScanWizard from '@/components/ui/ScanWizard'
import PlatformBadge from '@/components/ui/PlatformBadge'
import RiskPill from '@/components/ui/RiskPill'
import { useTranslation } from '@/lib/i18n/context'
import { Finding, ScanRun, Platform } from '@/types'

const { Content } = Layout

export default function DashboardClient() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{ totalAssets: number; totalScans: number; totalFindings: number; highRisk: number }>({
    totalAssets: 0,
    totalScans: 0,
    totalFindings: 0,
    highRisk: 0
  })
  const [recentFindings, setRecentFindings] = useState<Finding[]>([])
  const [recentScans, setRecentScans] = useState<ScanRun[]>([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [checkUrl, setCheckUrl] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [assetsRes, scansRes, findingsRes] = await Promise.all([
        fetch('/api/assets'),
        fetch('/api/scans'),
        fetch('/api/findings?limit=50&offset=0')
      ])
      const assets = assetsRes.ok ? await assetsRes.json() : []
      const scansData = scansRes.ok ? await scansRes.json() : { scans: [] }
      const findingsData = findingsRes.ok ? await findingsRes.json() : { findings: [], total: 0 }

      const allFindings = findingsData.findings as Finding[]
      const highRiskCount = allFindings.filter(f => f.risk_score >= 70).length

      setStats({
        totalAssets: Array.isArray(assets) ? assets.length : 0,
        totalScans: scansData.scans?.length || 0,
        totalFindings: findingsData.total || 0,
        highRisk: highRiskCount || findingsData.total || 0
      })
      setRecentFindings(allFindings.slice(0, 5))
      setRecentScans(scansData.scans?.slice(0, 4) || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchData()
    }
  }, [status, router, fetchData])

  const submitUrlCheck = () => {
    const url = checkUrl.trim()
    if (!url) return
    router.push(`/url-check?url=${encodeURIComponent(url)}`)
  }

  if (status === 'loading' || loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Sidebar />
        <Layout className="ml-0 xl:ml-[260px]">
          <Header />
          <Content style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <Spin size="large" />
          </Content>
        </Layout>
      </Layout>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout className="ml-0 xl:ml-[260px]">
        <Header title={t('nav.dashboard')} />
        <Content className="page-container">
          {/* Toolbar */}
          <div className="dash-toolbar">
            <div>
              <h1 className="dash-title">
                {t('nav.dashboard')}
                <span className="dash-title-dot">.</span>
              </h1>
              <p className="dash-sub">
                {session?.user?.name ? `👋 ${session.user.name} — ` : ''}
                {t('dashboard.hero.sub')}
              </p>
            </div>
            <div className="dash-actions">
              <Tooltip title={t('dashboard.refresh')}>
                <Button
                  className="dash-refresh-btn"
                  icon={<ReloadOutlined />}
                  onClick={fetchData}
                  aria-label={t('dashboard.refresh')}
                />
              </Tooltip>
              <Button type="primary" icon={<ThunderboltOutlined />} className="dash-scan-btn" onClick={() => setWizardOpen(true)}>
                {t('dashboard.hero.cta')}
              </Button>
            </div>
          </div>

          {/* Quick check bar */}
          <div className="cm-card dash-check-bar">
            <div className="dash-check-icon"><LinkOutlined /></div>
            <div className="dash-check-body">
              <div className="dash-check-title">{t('urlCheck.sub')}</div>
              <div className="dash-check-row">
                <Input
                  placeholder={t('urlCheck.placeholder')}
                  value={checkUrl}
                  onChange={e => setCheckUrl(e.target.value)}
                  onPressEnter={submitUrlCheck}
                  prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                  allowClear
                />
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={submitUrlCheck}>
                  {t('urlCheck.run')}
                </Button>
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="dash-kpi-grid">
            <KpiCard
              label={t('dashboard.stat.totalAssets')}
              value={stats.totalAssets}
              icon={<FileProtectOutlined />}
              href="/assets"
            />
            <KpiCard
              label={t('dashboard.stat.totalScans')}
              value={stats.totalScans}
              icon={<SecurityScanOutlined />}
              href="/scans"
            />
            <KpiCard
              label={t('dashboard.stat.totalFindings')}
              value={stats.totalFindings}
              icon={<WarningOutlined />}
              accent={stats.highRisk > 0}
              hint={stats.highRisk > 0 ? `${stats.highRisk} ${t('dashboard.stat.highRisk').toLowerCase()}` : undefined}
              href="/findings"
            />
            <KpiCard
              label={t('dashboard.stat.highRisk')}
              value={stats.highRisk}
              icon={<FieldTimeOutlined />}
              href="/findings"
            />
          </div>

          {/* Findings + scans row */}
          <div className="dash-bottom-grid">
            <div className="cm-card dash-card">
              <SectionHeader title={t('dashboard.recentFindings')} href="/findings" />
              {recentFindings.length === 0 ? (
                <Empty description={<span style={{ color: 'var(--text-muted)' }}>{t('dashboard.empty.findings')}</span>} style={{ padding: 24 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recentFindings.map(f => (
                    <Link key={f.id} href={`/findings`} className="dash-row-item">
                      <RiskPill score={f.risk_score} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="dash-row-title">{f.title}</div>
                        <div className="dash-row-sub">
                          {(f as any).asset_name && `${(f as any).asset_name} · `}
                          {new Date(f.found_at).toLocaleDateString()}
                        </div>
                      </div>
                      <PlatformBadge platform={f.platform as Platform} showLabel={false} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="cm-card dash-card">
              <SectionHeader title={t('dashboard.recentScans')} href="/scans" />
              {recentScans.length === 0 ? (
                <Empty description={<span style={{ color: 'var(--text-muted)' }}>{t('dashboard.empty.scans')}</span>} style={{ padding: 24 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recentScans.map(s => (
                    <div key={s.id} className="dash-scan-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span className="dash-scan-id">#{s.id}</span>
                        <Tag color={s.status === 'completed' ? 'success' : s.status === 'failed' ? 'error' : 'processing'}>
                          {s.status}
                        </Tag>
                      </div>
                      <div className="dash-scan-meta">
                        <FieldTimeOutlined /> {new Date(s.created_at).toLocaleString()}
                      </div>
                      <div className="dash-scan-meta">
                        {s.asset_ids?.length || 0} assets · {s.findings_count || 0} findings
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Content>
      </Layout>

      <ScanWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCompleted={() => fetchData()}
      />
    </Layout>
  )
}

function KpiCard({
  label,
  value,
  icon,
  href,
  accent,
  hint
}: {
  label: string
  value: number
  icon: React.ReactNode
  href?: string
  accent?: boolean
  hint?: string
}) {
  const content = (
    <div className={`dash-kpi${accent ? ' dash-kpi--accent' : ''}`}>
      <div className="dash-kpi-top">
        <span className="dash-kpi-label">{label}</span>
        <span className="dash-kpi-icon">{icon}</span>
      </div>
      <div className="dash-kpi-value">{value.toLocaleString()}</div>
      {hint ? <div className="dash-kpi-hint">{hint}</div> : <div className="dash-kpi-hint">&nbsp;</div>}
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  const { t } = useTranslation()
  return (
    <div className="dash-section-header">
      <h3>{title}</h3>
      <Link href={href} className="dash-view-all">
        {t('common.viewAll')} <ArrowRightOutlined />
      </Link>
    </div>
  )
}
