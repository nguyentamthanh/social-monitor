'use client'

import { useState } from 'react'
import { Layout, Input, Button, Spin, Empty, Tag, Progress, message } from 'antd'
import { YoutubeOutlined, LinkOutlined } from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
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

  const scoreColor = (s: number) => (s >= 70 ? '#ef4444' : s >= 45 ? '#f59e0b' : '#10b981')
  const scoreLabel = (s: number) => (s >= 70 ? 'CAO' : s >= 45 ? 'TRUNG BÌNH' : 'THẤP')

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
        <Header title={t('nav.urlCheck')} />
        <Content className="page-container">
          <div className="page-header">
            <h1>{t('urlCheck.title')}</h1>
            <p>{t('urlCheck.sub')}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="cm-card">
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#a1a1aa', fontSize: 13 }}>{t('urlCheck.inputLabel')}</span>
                <a onClick={() => setUrl(SAMPLE_URL)} style={{ color: '#8b5cf6', fontSize: 12, cursor: 'pointer' }}>
                  Tải mẫu
                </a>
              </div>
              <Input
                size="large"
                prefix={<LinkOutlined style={{ color: '#71717a' }} />}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('urlCheck.placeholder')}
                onPressEnter={run}
              />
              <Button
                type="primary"
                icon={<YoutubeOutlined />}
                size="large"
                onClick={run}
                loading={loading}
                disabled={!url.trim()}
                style={{ marginTop: 16, width: '100%' }}
              >
                {t('urlCheck.run')}
              </Button>

              <div style={{ marginTop: 20, color: '#71717a', fontSize: 12, lineHeight: 1.6 }}>
                <p style={{ marginBottom: 8 }}>{t('urlCheck.help')}</p>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  <li>youtube.com/watch?v=...</li>
                  <li>youtu.be/...</li>
                  <li>youtube.com/shorts/...</li>
                </ul>
              </div>
            </div>

            <div className="cm-card">
              <h3 style={{ color: '#fafafa', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                Kết quả phân tích
              </h3>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 48 }}>
                  <Spin />
                </div>
              ) : error ? (
                <Empty description={<span style={{ color: '#fca5a5' }}>{error}</span>} />
              ) : !result ? (
                <Empty description={<span style={{ color: '#71717a' }}>Dán URL và bấm kiểm tra</span>} />
              ) : (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: 12,
                      background: '#13131a',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 12,
                      marginBottom: 16
                    }}
                  >
                    {result.video.thumbnailUrl && (
                      <img
                        src={result.video.thumbnailUrl}
                        alt={result.video.title}
                        style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                      />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          color: '#fafafa',
                          fontSize: 13,
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}
                      >
                        {result.video.title}
                      </div>
                      <div style={{ color: '#a1a1aa', fontSize: 12, marginTop: 4 }}>{result.video.channelTitle}</div>
                      <a
                        href={result.video.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#8b5cf6', fontSize: 11 }}
                      >
                        Mở YouTube
                      </a>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <Progress
                      type="dashboard"
                      percent={result.topScore}
                      strokeColor={scoreColor(result.topScore)}
                      format={(v) => (
                        <span style={{ color: '#fafafa', fontSize: 28, fontWeight: 700 }}>{v}</span>
                      )}
                    />
                    <div style={{ color: '#a1a1aa', marginTop: 8, fontSize: 13 }}>
                      Top score · Đã đối chiếu {result.assetsChecked} tài sản
                    </div>
                  </div>

                  {result.matches.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {result.matches.map((m) => (
                        <div
                          key={m.assetId}
                          style={{
                            background: '#13131a',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: 12,
                            padding: 14
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ color: '#fafafa', fontWeight: 600, fontSize: 13 }}>
                              {m.assetName}{' '}
                              <span style={{ color: '#71717a', fontWeight: 400, fontSize: 11 }}>
                                ({m.assetType})
                              </span>
                            </span>
                            <Tag style={{ background: 'rgba(255,255,255,0.06)', color: scoreColor(m.riskScore) }}>
                              {scoreLabel(m.riskScore)} · {m.riskScore}
                            </Tag>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {m.reasons.map((r, i) => (
                              <Tag key={i} style={{ fontSize: 11 }}>
                                {r.label} {r.points > 0 ? `+${r.points}` : r.points}
                              </Tag>
                            ))}
                          </div>
                        </div>
                      ))}
                      {result.scanRunId !== null && (
                        <Button type="link" onClick={() => router.push('/findings')} style={{ padding: 0 }}>
                          Xem trong Findings →
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Empty description={<span style={{ color: '#71717a' }}>Không trùng với tài sản nào</span>} />
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
