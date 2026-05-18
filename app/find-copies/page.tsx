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

interface BatchEntry {
  url: string
  status: 'pending' | 'success' | 'error'
  data?: FindCopiesResponse
  error?: string
}

const MAX_URLS = 5
const SAMPLE_URLS = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://www.youtube.com/watch?v=9bZkp7q19f0'
]

export default function FindCopiesPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  const [urlsText, setUrlsText] = useState('')
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<BatchEntry[]>([])

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  const parseUrls = (raw: string): string[] => {
    return Array.from(
      new Set(
        raw
          .split(/[\n,;\s]+/)
          .map(s => s.trim())
          .filter(Boolean)
      )
    ).slice(0, MAX_URLS)
  }

  const run = async () => {
    const urls = parseUrls(urlsText)
    if (urls.length === 0) {
      message.error('Vui lòng nhập ít nhất 1 link YouTube')
      return
    }

    setLoading(true)
    const initial: BatchEntry[] = urls.map(url => ({ url, status: 'pending' }))
    setEntries(initial)

    const results: BatchEntry[] = [...initial]
    for (let i = 0; i < urls.length; i++) {
      try {
        const res = await fetch('/api/find-copies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urls[i] })
        })
        const data = await res.json()
        if (!res.ok) {
          results[i] = { url: urls[i], status: 'error', error: data.message || data.error || 'Lỗi' }
        } else {
          results[i] = { url: urls[i], status: 'success', data }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error'
        results[i] = { url: urls[i], status: 'error', error: msg }
      }
      setEntries([...results])
    }

    setLoading(false)

    const totalMatches = results.reduce((sum, r) => sum + (r.data?.candidates.length || 0), 0)
    if (totalMatches > 0) {
      message.warning(`Phát hiện ${totalMatches} video reup trên ${urls.length} link`)
    } else {
      message.success('Không phát hiện reup khả nghi')
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
                {t('findCopies.inputLabel')} <span style={{ color: '#71717a' }}>(tối đa {MAX_URLS} link, mỗi dòng 1 link)</span>
              </span>
              <a
                onClick={() => setUrlsText(SAMPLE_URLS.join('\n'))}
                style={{ color: '#8b5cf6', fontSize: 12, cursor: 'pointer' }}
              >
                Tải mẫu
              </a>
            </div>
            <Input.TextArea
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder={`${t('findCopies.placeholder')}\nhttps://www.youtube.com/watch?v=...`}
              rows={3}
              disabled={loading}
              autoSize={{ minRows: 3, maxRows: 5 }}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              size="large"
              onClick={run}
              loading={loading}
              disabled={!urlsText.trim()}
              style={{ marginTop: 16, width: '100%' }}
            >
              {t('findCopies.run')}
            </Button>

            <div style={{ marginTop: 16, color: '#71717a', fontSize: 12, lineHeight: 1.6 }}>
              <div>{t('findCopies.help')}</div>
              <div style={{ marginTop: 6 }}>
                Tối đa {MAX_URLS} link/lần, chạy tuần tự (queue). Tốn {MAX_URLS * 101} unit / 10,000 free quota. Mất ~{MAX_URLS * 10}s tổng.
              </div>
            </div>
          </div>

          {loading && entries.length === 0 ? (
            <div className="cm-card" style={{ textAlign: 'center', padding: 64 }}>
              <Spin size="large" />
              <div style={{ color: '#a1a1aa', marginTop: 16, fontSize: 13 }}>
                Đang quét YouTube, chấm điểm và đối chiếu transcript...
              </div>
            </div>
          ) : entries.length === 0 ? (
            <div className="cm-card">
              <Empty description={<span style={{ color: '#71717a' }}>Dán {MAX_URLS} link YouTube và bấm quét</span>} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {entries.map((entry, idx) => (
                <BatchEntryView
                  key={idx}
                  index={idx + 1}
                  entry={entry}
                  scoreColor={scoreColor}
                  scoreLabel={scoreLabel}
                />
              ))}
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  )
}

function BatchEntryView({
  index,
  entry,
  scoreColor,
  scoreLabel
}: {
  index: number
  entry: BatchEntry
  scoreColor: (s: number) => string
  scoreLabel: (s: number) => string
}) {
  if (entry.status === 'pending') {
    return (
      <div className="cm-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Spin />
          <div>
            <div style={{ color: '#71717a', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
              Link #{index}
            </div>
            <div style={{ color: '#fafafa', fontSize: 13, marginTop: 4 }}>{entry.url}</div>
          </div>
        </div>
      </div>
    )
  }

  if (entry.status === 'error') {
    return (
      <div className="cm-card">
        <div style={{ color: '#71717a', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Link #{index} · Lỗi
        </div>
        <div style={{ color: '#fafafa', fontSize: 13, marginBottom: 8 }}>{entry.url}</div>
        <div style={{ color: '#fca5a5', fontSize: 13 }}>{entry.error}</div>
      </div>
    )
  }

  const data = entry.data!
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="cm-card">
        <div style={{ display: 'flex', gap: 16 }}>
          {data.original.thumbnailUrl && (
            <img
              src={data.original.thumbnailUrl}
              alt={data.original.title}
              style={{ width: 180, height: 100, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#71717a', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Link #{index} · Video gốc
            </div>
            <div style={{ color: '#fafafa', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
              {data.original.title}
            </div>
            <div style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 8 }}>
              <YoutubeOutlined style={{ marginRight: 6 }} />
              {data.original.channelTitle}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Tag>Quét {data.searched}</Tag>
              <Tag>Transcript {data.transcriptChecked}</Tag>
              <Tag style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd' }}>
                {data.candidates.length} reup
              </Tag>
            </div>
          </div>
        </div>
      </div>

      {data.candidates.length === 0 ? (
        <div className="cm-card">
          <Empty description={<span style={{ color: '#71717a' }}>Không phát hiện video reup khả nghi</span>} />
        </div>
      ) : (
        data.candidates.map((c) => (
          <div key={c.videoId} className="cm-card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 14 }}>
              {c.thumbnailUrl && (
                <a href={c.url} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                  <img
                    src={c.thumbnailUrl}
                    alt={c.title}
                    style={{ width: 140, height: 80, objectFit: 'cover', borderRadius: 8 }}
                  />
                </a>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: '#fafafa',
                      fontWeight: 600,
                      fontSize: 13,
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
                <div style={{ color: '#a1a1aa', fontSize: 11, marginBottom: 8 }}>
                  {c.channelTitle}
                  {c.publishedAt && ` · ${new Date(c.publishedAt).toLocaleDateString()}`}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {c.reasons.map((r, i) => (
                    <Tag
                      key={i}
                      style={{
                        fontSize: 10,
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
        ))
      )}
    </div>
  )
}
