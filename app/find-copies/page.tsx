'use client'

import { useState } from 'react'
import { Layout, Input, Button, Spin, Empty, Tag, message } from 'antd'
import { SearchOutlined, LinkOutlined, YoutubeOutlined } from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { useTranslation } from '@/lib/i18n/context'

const { Content } = Layout

interface Reason {
  code: string
  label: string
  points: number
}

interface Candidate {
  videoId: string
  title: string
  channelId: string
  channelTitle: string
  thumbnailUrl?: string
  url: string
  publishedAt: string | null
  riskScore: number
  reasons: Reason[]
}

interface FindCopiesResponse {
  original: {
    videoId: string
    title: string
    channelTitle: string
    thumbnailUrl?: string
    url: string
    publishedAt: string | null
  }
  candidates: Candidate[]
  searched: number
  transcriptChecked: number
  query: string
}

const SAMPLE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

export default function FindCopiesPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<FindCopiesResponse | null>(null)
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
      const res = await fetch('/api/find-copies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || data.error || 'Lỗi không xác định')
        message.error(data.message || 'Quét thất bại')
        return
      }
      setResult(data)
      if (data.candidates.length === 0) {
        message.success(`Quét ${data.searched} video, không phát hiện reup khả nghi`)
      } else {
        message.warning(`Phát hiện ${data.candidates.length} video có dấu hiệu reup`)
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
        <Header title={t('nav.findCopies')} />
        <Content className="page-container">
          <div className="page-header">
            <h1>{t('findCopies.title')}</h1>
            <p>{t('findCopies.sub')}</p>
          </div>

          <div className="cm-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ color: '#a1a1aa', fontSize: 13, flex: 1 }}>
                {t('findCopies.inputLabel')}
              </span>
              <a
                onClick={() => setUrl(SAMPLE_URL)}
                style={{ color: '#8b5cf6', fontSize: 12, cursor: 'pointer' }}
              >
                Tải mẫu
              </a>
            </div>
            <Input
              size="large"
              prefix={<LinkOutlined style={{ color: '#71717a' }} />}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('findCopies.placeholder')}
              onPressEnter={run}
              disabled={loading}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              size="large"
              onClick={run}
              loading={loading}
              disabled={!url.trim()}
              style={{ marginTop: 16, width: '100%' }}
            >
              {t('findCopies.run')}
            </Button>

            <div style={{ marginTop: 16, color: '#71717a', fontSize: 12, lineHeight: 1.6 }}>
              {t('findCopies.help')}
            </div>
          </div>

          {loading ? (
            <div className="cm-card" style={{ textAlign: 'center', padding: 64 }}>
              <Spin size="large" />
              <div style={{ color: '#a1a1aa', marginTop: 16, fontSize: 13 }}>
                Đang quét YouTube, chấm điểm và đối chiếu transcript...
              </div>
            </div>
          ) : error ? (
            <div className="cm-card">
              <Empty description={<span style={{ color: '#fca5a5' }}>{error}</span>} />
            </div>
          ) : result ? (
            <>
              <div className="cm-card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  {result.original.thumbnailUrl && (
                    <img
                      src={result.original.thumbnailUrl}
                      alt={result.original.title}
                      style={{
                        width: 200,
                        height: 112,
                        objectFit: 'cover',
                        borderRadius: 12,
                        flexShrink: 0
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#71717a', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                      Video gốc
                    </div>
                    <div style={{ color: '#fafafa', fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
                      {result.original.title}
                    </div>
                    <div style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 8 }}>
                      <YoutubeOutlined style={{ marginRight: 6 }} />
                      {result.original.channelTitle}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Tag>Đã quét {result.searched} video</Tag>
                      <Tag>Transcript check {result.transcriptChecked}</Tag>
                      <Tag style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd' }}>
                        {result.candidates.length} kết quả khả nghi
                      </Tag>
                    </div>
                  </div>
                </div>
              </div>

              {result.candidates.length === 0 ? (
                <div className="cm-card">
                  <Empty description={<span style={{ color: '#71717a' }}>Không phát hiện video reup khả nghi</span>} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {result.candidates.map((c) => (
                    <div key={c.videoId} className="cm-card" style={{ padding: 16 }}>
                      <div style={{ display: 'flex', gap: 16 }}>
                        {c.thumbnailUrl && (
                          <a href={c.url} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                            <img
                              src={c.thumbnailUrl}
                              alt={c.title}
                              style={{ width: 160, height: 90, objectFit: 'cover', borderRadius: 10 }}
                            />
                          </a>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: '#fafafa',
                                fontWeight: 600,
                                fontSize: 14,
                                textDecoration: 'none',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {c.title}
                            </a>
                            <Tag
                              style={{
                                background: 'rgba(255,255,255,0.06)',
                                color: scoreColor(c.riskScore),
                                fontWeight: 700,
                                flexShrink: 0
                              }}
                            >
                              {scoreLabel(c.riskScore)} · {c.riskScore}
                            </Tag>
                          </div>
                          <div style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 10 }}>
                            {c.channelTitle}
                            {c.publishedAt && ` · ${new Date(c.publishedAt).toLocaleDateString()}`}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {c.reasons.map((r, i) => (
                              <Tag
                                key={i}
                                style={{
                                  fontSize: 11,
                                  background: r.points >= 0 ? 'rgba(255,255,255,0.04)' : 'rgba(239, 68, 68, 0.1)',
                                  color: r.points >= 0 ? '#a1a1aa' : '#fca5a5'
                                }}
                              >
                                {r.label} {r.points >= 0 ? `+${r.points}` : r.points}
                              </Tag>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="cm-card">
              <Empty description={<span style={{ color: '#71717a' }}>Dán URL video gốc và bấm quét</span>} />
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  )
}
