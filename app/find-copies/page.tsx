'use client'

import { useState } from 'react'
import { Layout, Input, Button, Spin, Empty, Tag, message, Switch } from 'antd'
import { SearchOutlined, YoutubeOutlined, ThunderboltOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import CheckSwitch from '@/components/ui/CheckSwitch'
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
  mediaCheck?: {
    available: boolean
    skippedReason?: string
    audio?: {
      checked: boolean
      similarity: number
      matched: boolean
      skippedReason?: string
    }
    video?: {
      checked: boolean
      bestFrameSimilarity: number
      matched: boolean
      matchedFrames: number
      skippedReason?: string
    }
  }
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
  mediaChecked: number
  mediaCheckEnabled: boolean
  mediaCheckStatus?: string
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
  const [deepMediaCheck, setDeepMediaCheck] = useState(false)
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
          body: JSON.stringify({ url: urls[i], deepMediaCheck })
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

  const scoreColor = (s: number) => (s >= 70 ? 'var(--danger)' : s >= 45 ? 'var(--warning)' : 'var(--success)')
  const scoreLabel = (s: number) => (s >= 70 ? 'CAO' : s >= 45 ? 'TRUNG BÌNH' : 'THẤP')

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout className="ml-0 xl:ml-[260px]">
        <Header title={t('nav.findCopies')} />
        <Content className="page-container">
          <div className="page-header">
            <h1>{t('findCopies.title')}</h1>
            <p>{t('findCopies.sub')}</p>
          </div>

          <CheckSwitch />

          <div className="scan-deck" style={{ marginBottom: 16 }}>
            <div className="scan-deck-glow" />
            <div className="scan-deck-head">
              <div className="scan-deck-title">
                <div className="scan-deck-bolt"><SearchOutlined /></div>
                <div>
                  <div className="scan-deck-name">{t('findCopies.inputLabel')}</div>
                  <div className="scan-deck-desc">Tối đa {MAX_URLS} link, mỗi dòng 1 link — quét tuần tự (queue)</div>
                </div>
              </div>
              <span className="check-sample-btn" onClick={() => setUrlsText(SAMPLE_URLS.join('\n'))} role="button">
                Tải link mẫu
              </span>
            </div>

            <Input.TextArea
              className="check-textarea"
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder={`${t('findCopies.placeholder')}\nhttps://www.youtube.com/watch?v=...`}
              disabled={loading}
              autoSize={{ minRows: 3, maxRows: 5 }}
            />

            <Button
              className="scan-deck-cta"
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={run}
              loading={loading}
              disabled={!urlsText.trim()}
              style={{ width: '100%', marginTop: 12 }}
            >
              {t('findCopies.run')}
            </Button>

            <div className="scan-deck-options">
              <div className="scan-option-group">
                <span className="scan-option-label">Deep check</span>
                <Switch checked={deepMediaCheck} onChange={setDeepMediaCheck} disabled={loading} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>Âm thanh + frame video</span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                ~{MAX_URLS * 101} unit YouTube API / {MAX_URLS * 10}s tổng
              </div>
            </div>

            {deepMediaCheck && (
              <div className="check-note is-warning">
                <InfoCircleOutlined style={{ marginTop: 1 }} />
                <span>Deep check cần yt-dlp, ffmpeg và fpcalc trên server; thời gian chạy sẽ lâu hơn.</span>
              </div>
            )}
          </div>

          {loading && entries.length === 0 ? (
            <div className="cm-card scan-results">
              <div className="scan-idle">
                <Spin size="large" />
                <div className="scan-idle-title" style={{ marginTop: 16 }}>Đang quét YouTube...</div>
                <div className="scan-idle-sub">Chấm điểm và đối chiếu transcript</div>
              </div>
            </div>
          ) : entries.length === 0 ? (
            <div className="cm-card scan-results">
              <div className="scan-idle">
                <div className="scan-idle-icon"><SearchOutlined /></div>
                <div className="scan-idle-title">Chưa có kết quả</div>
                <div className="scan-idle-sub">Dán tối đa {MAX_URLS} link YouTube và bấm quét</div>
              </div>
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
            <div className="check-batch-index">Link #{index}</div>
            <div style={{ color: 'var(--text-primary)', fontSize: 13, marginTop: 4 }}>{entry.url}</div>
          </div>
        </div>
      </div>
    )
  }

  if (entry.status === 'error') {
    return (
      <div className="cm-card">
        <div className="check-batch-index">Link #{index} · Lỗi</div>
        <div style={{ color: 'var(--text-primary)', fontSize: 13, marginBottom: 8 }}>{entry.url}</div>
        <div style={{ color: 'var(--danger)', fontSize: 13 }}>{entry.error}</div>
      </div>
    )
  }

  const data = entry.data!
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="cm-card">
        <div className="check-video-card" style={{ marginBottom: 0, background: 'transparent', border: 'none', padding: 0 }}>
          {data.original.thumbnailUrl && (
            <img src={data.original.thumbnailUrl} alt={data.original.title} style={{ width: 180, height: 100, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="check-batch-index">Link #{index} · Video gốc</div>
            <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, marginBottom: 6, marginTop: 4 }}>
              {data.original.title}
            </div>
            <div className="check-video-meta">
              <YoutubeOutlined style={{ marginRight: 6, color: '#ff6b6b' }} />
              {data.original.channelTitle}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Tag>Quét {data.searched}</Tag>
              <Tag>Transcript {data.transcriptChecked}</Tag>
              {data.mediaCheckEnabled && <Tag>Media {data.mediaChecked}</Tag>}
              <Tag style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-violet)' }}>
                {data.candidates.length} reup
              </Tag>
            </div>
            {data.mediaCheckStatus && (
              <div style={{ color: 'var(--warning)', fontSize: 12, marginTop: 8 }}>
                {data.mediaCheckStatus}
              </div>
            )}
          </div>
        </div>
      </div>

      {data.candidates.length === 0 ? (
        <div className="cm-card">
          <Empty description={<span style={{ color: 'var(--text-muted)' }}>Không phát hiện video reup khả nghi</span>} />
        </div>
      ) : (
        data.candidates.map((c) => (
          <div key={c.videoId} className="check-match-card">
            <div style={{ display: 'flex', gap: 14 }}>
              {c.thumbnailUrl && (
                <a href={c.url} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                  <img src={c.thumbnailUrl} alt={c.title} style={{ width: 140, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                </a>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="check-match-head">
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: 'var(--text-primary)',
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
                  <Tag style={{ background: 'var(--bg-hover)', color: scoreColor(c.riskScore), fontWeight: 700, flexShrink: 0 }}>
                    {scoreLabel(c.riskScore)} · {c.riskScore}
                  </Tag>
                </div>
                <div className="check-match-meta">
                  {c.channelTitle}
                  {c.publishedAt && ` · ${new Date(c.publishedAt).toLocaleDateString()}`}
                </div>
                <div className="check-reason-row">
                  {c.reasons.map((r, i) => (
                    <Tag
                      key={i}
                      style={{
                        fontSize: 10,
                        background: r.points >= 0 ? 'var(--bg-hover)' : 'rgba(239, 68, 68, 0.1)',
                        color: r.points >= 0 ? 'var(--text-secondary)' : 'var(--danger)'
                      }}
                    >
                      {r.label} {r.points >= 0 ? `+${r.points}` : r.points}
                    </Tag>
                  ))}
                  {c.mediaCheck?.audio?.checked && (
                    <Tag style={{ fontSize: 10, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                      Audio {(c.mediaCheck.audio.similarity * 100).toFixed(0)}%
                    </Tag>
                  )}
                  {c.mediaCheck?.video?.checked && (
                    <Tag style={{ fontSize: 10, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                      Frame {(c.mediaCheck.video.bestFrameSimilarity * 100).toFixed(0)}% · {c.mediaCheck.video.matchedFrames} frame
                    </Tag>
                  )}
                  {c.mediaCheck && !c.mediaCheck.available && (
                    <Tag style={{ fontSize: 10, background: 'rgba(251, 191, 36, 0.1)', color: '#b45309' }}>
                      Media unavailable
                    </Tag>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
