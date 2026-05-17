'use client'

import { useCallback, useEffect, useState } from 'react'
import { Layout, Empty, Avatar, Tag, Spin, Progress } from 'antd'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileProtectOutlined,
  SecurityScanOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined
} from '@ant-design/icons'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import ScanWizard from '@/components/ui/ScanWizard'
import PlatformBadge from '@/components/ui/PlatformBadge'
import RiskPill from '@/components/ui/RiskPill'
import { useTranslation } from '@/lib/i18n/context'
import { Finding, ScanRun, Platform } from '@/types'

const { Content } = Layout

interface DashboardData {
  stats: {
    totalMentions: number
    activeKeywords: number
    avgEngagement: number
    topPlatform: string
  }
}

export default function DashboardPage() {
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

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [assetsRes, scansRes, findingsRes, highRiskRes] = await Promise.all([
        fetch('/api/assets'),
        fetch('/api/scans'),
        fetch('/api/findings?limit=6&offset=0'),
        fetch('/api/findings?limit=1&offset=0&status=new')
      ])
      const assets = assetsRes.ok ? await assetsRes.json() : []
      const scansData = scansRes.ok ? await scansRes.json() : { scans: [] }
      const findingsData = findingsRes.ok ? await findingsRes.json() : { findings: [], total: 0 }
      const highRiskData = highRiskRes.ok ? await highRiskRes.json() : { total: 0 }

      const highRiskCount = (findingsData.findings as Finding[]).filter(f => f.risk_score >= 70).length

      setStats({
        totalAssets: Array.isArray(assets) ? assets.length : 0,
        totalScans: scansData.scans?.length || 0,
        totalFindings: findingsData.total || 0,
        highRisk: highRiskCount || highRiskData.total || 0
      })
      setRecentFindings((findingsData.findings as Finding[])?.slice(0, 5) || [])
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

  if (status === 'loading' || loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Sidebar />
        <Layout>
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
      <Layout>
        <Header title={t('nav.dashboard')} />
        <Content className="page-container">
          {/* Hero */}
          <div className="hero-card">
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <Tag style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd', borderRadius: 999, marginBottom: 12 }}>
                  ● {session?.user?.name || 'Welcome'}
                </Tag>
                <h2>{t('dashboard.hero.title')}</h2>
                <p>{t('dashboard.hero.sub')}</p>
                <button className="hero-cta" onClick={() => setWizardOpen(true)}>
                  <ThunderboltOutlined /> {t('dashboard.hero.cta')}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, minWidth: 280 }}>
                <MiniStat label={t('dashboard.stat.totalFindings')} value={stats.totalFindings} icon={<WarningOutlined />} />
                <MiniStat label={t('dashboard.stat.highRisk')} value={stats.highRisk} icon={<ThunderboltOutlined />} accent />
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="stats-grid">
            <StatCard label={t('nav.assets')} value={stats.totalAssets} icon={<FileProtectOutlined />} href="/assets" />
            <StatCard label={t('nav.scans')} value={stats.totalScans} icon={<SecurityScanOutlined />} href="/scans" />
            <StatCard label={t('nav.findings')} value={stats.totalFindings} icon={<WarningOutlined />} href="/findings" />
            <StatCard label={t('dashboard.stat.highRisk')} value={stats.highRisk} icon={<ThunderboltOutlined />} accent href="/findings?status=new" />
          </div>

          {/* Content row */}
          <div className="charts-grid">
            <div className="cm-card">
              <SectionHeader title={t('dashboard.recentFindings')} href="/findings" />
              {recentFindings.length === 0 ? (
                <Empty description={<span style={{ color: '#71717a' }}>Chưa có vi phạm nào được phát hiện</span>} style={{ padding: 24 }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {recentFindings.map(f => (
                    <Link key={f.id} href={`/findings`} style={{ display: 'block' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: '#13131a', border: '1px solid rgba(255,255,255,0.04)', transition: 'all 0.15s', cursor: 'pointer' }}>
                        <RiskPill score={f.risk_score} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#fafafa', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.title}
                          </div>
                          <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>
                            {(f as any).asset_name && `${(f as any).asset_name} · `}
                            {new Date(f.found_at).toLocaleDateString()}
                          </div>
                        </div>
                        <PlatformBadge platform={f.platform as Platform} showLabel={false} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="cm-card">
              <SectionHeader title={t('dashboard.recentScans')} href="/scans" />
              {recentScans.length === 0 ? (
                <Empty description={<span style={{ color: '#71717a' }}>Chưa có lần quét nào</span>} style={{ padding: 24 }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {recentScans.map(s => (
                    <div key={s.id} style={{ padding: 12, borderRadius: 12, background: '#13131a', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ color: '#fafafa', fontWeight: 500, fontSize: 13 }}>#{s.id}</span>
                        <Tag color={s.status === 'completed' ? 'success' : s.status === 'failed' ? 'error' : 'processing'}>
                          {s.status}
                        </Tag>
                      </div>
                      <div style={{ color: '#71717a', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ClockCircleOutlined />
                        {new Date(s.created_at).toLocaleString()}
                      </div>
                      <div style={{ color: '#a1a1aa', fontSize: 12, marginTop: 6 }}>
                        {s.asset_ids?.length || 0} tài sản · {s.findings_count || 0} kết quả
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

function StatCard({ label, value, icon, href, accent }: { label: string; value: number; icon: React.ReactNode; href?: string; accent?: boolean }) {
  const content = (
    <div className="stat-card">
      <div className="stat-card-icon" style={accent ? { background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(245,158,11,0.2))', color: '#fcd34d' } : {}}>
        {icon}
      </div>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value.toLocaleString()}</div>
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function MiniStat({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.04)',
      border: `1px solid ${accent ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.06)'}`,
      borderRadius: 14,
      padding: 14
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: accent ? '#fca5a5' : '#a1a1aa', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {icon} {label}
      </div>
      <div style={{ color: '#fafafa', fontSize: 24, fontWeight: 700, marginTop: 6 }}>{value.toLocaleString()}</div>
    </div>
  )
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <h3 style={{ color: '#fafafa', fontSize: 16, fontWeight: 600, margin: 0 }}>{title}</h3>
      <Link href={href} style={{ color: '#8b5cf6', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        Xem tất cả <ArrowRightOutlined />
      </Link>
    </div>
  )
}
