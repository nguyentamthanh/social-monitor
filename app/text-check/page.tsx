'use client'

import { useState } from 'react'
import { Layout, Input, Button, Spin, Empty, Tag, Progress } from 'antd'
import { FileSearchOutlined, ThunderboltOutlined, CheckOutlined } from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import CheckSwitch from '@/components/ui/CheckSwitch'
import { useTranslation } from '@/lib/i18n/context'
import { riskCssVar } from '@/lib/copyright/risk'
import { Platform } from '@/types'

const { Content } = Layout

interface PolicyFinding {
  code: string
  label: string
  severity: 'low' | 'medium' | 'high'
  points: number
  matches?: string[]
  platform?: string
}

interface TextPolicyResult {
  score: number
  summary: string
  findings: PolicyFinding[]
  checkedAt: string
}

const SAMPLE = `Reup full video, làm lại MV bản quyền của ca sĩ X mà không xin phép. Bán link bit.ly dẫn tới crack ebook.`

const ALL_PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google' }
]

export default function TextCheckPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [platforms, setPlatforms] = useState<Platform[]>(['youtube', 'tiktok', 'facebook'])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TextPolicyResult | null>(null)

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  const run = async () => {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/text-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, platforms })
      })
      if (res.ok) setResult(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const severityColor = (s: string) => (s === 'high' ? 'var(--danger)' : s === 'medium' ? 'var(--warning)' : 'var(--success)')
  const scoreColor = riskCssVar

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout className="ml-0 xl:ml-[260px]">
        <Header title={t('nav.textCheck')} />
        <Content className="page-container">
          <div className="page-header">
            <h1>{t('textCheck.title')}</h1>
            <p>{t('textCheck.sub')}</p>
          </div>

          <CheckSwitch />

          <div className="cm-grid-2">
            <div className="scan-deck">
              <div className="scan-deck-glow" />
              <div className="scan-deck-head">
                <div className="scan-deck-title">
                  <div className="scan-deck-bolt"><FileSearchOutlined /></div>
                  <div>
                    <div className="scan-deck-name">Nội dung cần kiểm tra</div>
                    <div className="scan-deck-desc">Đối chiếu theo chính sách bản quyền/nội dung của từng nền tảng</div>
                  </div>
                </div>
                <span className="check-sample-btn" onClick={() => setText(SAMPLE)} role="button">
                  Tải văn bản mẫu
                </span>
              </div>

              <div className="scan-deck-options" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', marginBottom: 14 }}>
                <div className="scan-option-group">
                  <span className="scan-option-label">{t('textCheck.platforms')}</span>
                  <div className="scan-platform-row">
                    {ALL_PLATFORMS.map((p) => {
                      const active = platforms.includes(p.value)
                      return (
                        <div
                          key={p.value}
                          className={`scan-platform-chip${active ? ' is-selected' : ''}`}
                          onClick={() => togglePlatform(p.value)}
                        >
                          {active && <CheckOutlined className="scan-chip-check" />}
                          {p.label}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <Input.TextArea
                className="check-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                maxLength={20000}
                showCount
                placeholder={t('textCheck.placeholder')}
              />
              <Button
                className="scan-deck-cta"
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={run}
                loading={loading}
                disabled={!text.trim()}
                style={{ width: '100%', marginTop: 14 }}
              >
                {t('textCheck.run')}
              </Button>
            </div>

            <div className="cm-card scan-results">
              <h3 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Kết quả phân tích</h3>
              {loading ? (
                <div className="scan-idle">
                  <Spin size="large" />
                  <div className="scan-idle-title" style={{ marginTop: 16 }}>Đang phân tích văn bản...</div>
                </div>
              ) : !result ? (
                <div className="scan-idle">
                  <div className="scan-idle-icon"><FileSearchOutlined /></div>
                  <div className="scan-idle-title">Chưa có kết quả</div>
                  <div className="scan-idle-sub">Nhập văn bản và bấm &quot;{t('textCheck.run')}&quot;</div>
                </div>
              ) : (
                <div>
                  <div className="check-score-block">
                    <Progress
                      type="dashboard"
                      percent={result.score}
                      strokeColor={scoreColor(result.score)}
                      format={(v) => <span style={{ color: 'var(--text-primary)', fontSize: 28, fontWeight: 700 }}>{v}</span>}
                    />
                    <div className="check-score-sub">{result.summary}</div>
                  </div>

                  {result.findings.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {result.findings.map((f, i) => (
                        <div key={i} className="check-match-card">
                          <div className="check-match-head">
                            <span className="check-match-name">{f.label}</span>
                            <Tag style={{ background: 'var(--bg-hover)', color: severityColor(f.severity), fontWeight: 700 }}>
                              {f.severity.toUpperCase()} · +{f.points}
                            </Tag>
                          </div>
                          {f.matches && f.matches.length > 0 && (
                            <div className="check-reason-row">
                              {f.matches.slice(0, 6).map((m, j) => (
                                <Tag key={j} style={{ fontSize: 11 }}>{m}</Tag>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description={<span style={{ color: 'var(--text-muted)' }}>Không phát hiện vi phạm nào</span>} />
                  )}
                </div>
              )}
            </div>
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
