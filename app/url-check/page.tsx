'use client'

import { useState } from 'react'
import { Layout, Input, Button, Spin, Empty, Tag, Progress, message } from 'antd'
import { YoutubeOutlined, LinkOutlined, SafetyCertificateOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import CheckSwitch from '@/components/ui/CheckSwitch'
import { useTranslation } from '@/lib/i18n/context'
import { FindingReason } from '@/types'

const { Content } = Layout

interface MatchResult {
  assetId: number
  assetName: string
  assetType: string
  riskScore: number
  reasons: FindingReason[]
  findingId?: number
}

interface UrlCheckResult {
  video: {
    videoId: string
    title: string
    url: string
    channelTitle: string
    thumbnailUrl?: string
    publishedAt?: string | null
    duration?: string
    viewCount?: string
  }
  matches: MatchResult[]
  topScore: number
  assetsChecked: number
  scanRunId: number | null
}

const SAMPLE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

export default function UrlCheckPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UrlCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  const run = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/check-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || data.error || 'Lỗi không xác định')
        message.error(data.message || 'Kiểm tra thất bại')
        return
      }
      setResult(data)
      if (data.matches.length === 0) {
        message.success('Không phát hiện trùng khớp với tài sản nào')
      } else {
        message.warning(`Phát hiện ${data.matches.length} tài sản trùng khớp`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setError(msg)
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = (s: number) => (s >= 70 ? 'var(--danger)' : s >= 45 ? 'var(--warning)' : 'var(--success)')
  const scoreLabel = (s: number) => (s >= 70 ? 'CAO' : s >= 45 ? 'TRUNG BÌNH' : 'THẤP')

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout className="ml-0 xl:ml-[260px]">
        <Header title={t('nav.urlCheck')} />
        <Content className="page-container">
          <div className="page-header">
            <h1>{t('urlCheck.title')}</h1>
            <p>{t('urlCheck.sub')}</p>
          </div>

          <CheckSwitch />

          <div className="cm-grid-2">
            <div className="scan-deck">
              <div className="scan-deck-glow" />
              <div className="scan-deck-head">
                <div className="scan-deck-title">
                  <div className="scan-deck-bolt"><LinkOutlined /></div>
                  <div>
                    <div className="scan-deck-name">{t('urlCheck.inputLabel')}</div>
                    <div className="scan-deck-desc">Đối chiếu tự động với toàn bộ brand asset đang active</div>
                  </div>
                </div>
                <span
                  className="check-sample-btn"
                  onClick={() => setUrl(SAMPLE_URL)}
                  role="button"
                >
                  Tải link mẫu
                </span>
              </div>

              <div className="scan-deck-input-row">
                <Input
                  className="scan-deck-input"
                  prefix={<YoutubeOutlined style={{ color: '#ff6b6b' }} />}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={t('urlCheck.placeholder')}
                  onPressEnter={run}
                />
                <Button
                  className="scan-deck-cta"
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={run}
                  loading={loading}
                  disabled={!url.trim()}
                >
                  {t('urlCheck.run')}
                </Button>
              </div>

              <div className="check-help-chips">
                <span className="check-help-chip">youtube.com/watch?v=...</span>
                <span className="check-help-chip">youtu.be/...</span>
                <span className="check-help-chip">youtube.com/shorts/...</span>
              </div>

              <div className="check-note">
                <SafetyCertificateOutlined style={{ marginTop: 1 }} />
                <span>{t('urlCheck.help')} Hệ thống chấm điểm rủi ro 0–100 dựa trên tên thương hiệu, keyword, pHash ảnh và domain.</span>
              </div>
            </div>

            <div className="cm-card scan-results">
              <h3 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                Kết quả phân tích
              </h3>
              {loading ? (
                <div className="scan-idle">
                  <Spin size="large" />
                  <div className="scan-idle-title" style={{ marginTop: 16 }}>Đang phân tích video...</div>
                  <div className="scan-idle-sub">Đối chiếu với brand asset và tính điểm rủi ro</div>
                </div>
              ) : error ? (
                <div className="scan-failed">
                  <div className="scan-failed-icon">!</div>
                  <div>
                    <div className="scan-result-title">Kiểm tra thất bại</div>
                    <div className="scan-result-sub">{error}</div>
                  </div>
                </div>
              ) : !result ? (
                <div className="scan-idle">
                  <div className="scan-idle-icon"><LinkOutlined /></div>
                  <div className="scan-idle-title">Chưa có kết quả</div>
                  <div className="scan-idle-sub">Dán URL YouTube và bấm &quot;{t('urlCheck.run')}&quot;</div>
                </div>
              ) : (
                <div>
                  <div className="check-video-card">
                    {result.video.thumbnailUrl && (
                      <img src={result.video.thumbnailUrl} alt={result.video.title} className="check-video-thumb" />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="check-video-title">{result.video.title}</div>
                      <div className="check-video-meta">{result.video.channelTitle}</div>
                      <a href={result.video.url} target="_blank" rel="noreferrer" className="check-video-link">
                        Mở trên YouTube ↗
                      </a>
                    </div>
                  </div>

                  <div className="check-score-block">
                    <Progress
                      type="dashboard"
                      percent={result.topScore}
                      strokeColor={scoreColor(result.topScore)}
                      format={(v) => (
                        <span style={{ color: 'var(--text-primary)', fontSize: 28, fontWeight: 700 }}>{v}</span>
                      )}
                    />
                    <div className="check-score-sub">
                      Top score · Đã đối chiếu {result.assetsChecked} tài sản
                    </div>
                  </div>

                  {result.matches.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {result.matches.map((m) => (
                        <div key={m.assetId} className="check-match-card">
                          <div className="check-match-head">
                            <span className="check-match-name">
                              {m.assetName} <span className="check-match-type">({m.assetType})</span>
                            </span>
                            <Tag style={{ background: 'var(--bg-hover)', color: scoreColor(m.riskScore), fontWeight: 700 }}>
                              {scoreLabel(m.riskScore)} · {m.riskScore}
                            </Tag>
                          </div>
                          <div className="check-reason-row">
                            {m.reasons.map((r, i) => (
                              <Tag key={i} style={{ fontSize: 11 }}>
                                {r.label} {r.points > 0 ? `+${r.points}` : r.points}
                              </Tag>
                            ))}
                          </div>
                        </div>
                      ))}
                      {result.scanRunId !== null && (
                        <Button type="link" onClick={() => router.push('/findings')} style={{ padding: 0, alignSelf: 'flex-start' }}>
                          Xem trong Findings →
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Empty description={<span style={{ color: 'var(--text-muted)' }}>Không trùng với tài sản nào</span>} />
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
