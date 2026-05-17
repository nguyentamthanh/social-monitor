'use client'

import { useState } from 'react'
import { Layout, Input, Button, Select, Spin, Empty, Tag, Progress } from 'antd'
import { FileSearchOutlined } from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { useTranslation } from '@/lib/i18n/context'
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

  const severityColor = (s: string) => s === 'high' ? '#fca5a5' : s === 'medium' ? '#fcd34d' : '#6ee7b7'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
        <Header title={t('nav.textCheck')} />
        <Content className="page-container">
          <div className="page-header">
            <h1>{t('textCheck.title')}</h1>
            <p>{t('textCheck.sub')}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="cm-card">
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#a1a1aa', fontSize: 13 }}>{t('textCheck.platforms')}</span>
                <a onClick={() => setText(SAMPLE)} style={{ color: '#8b5cf6', fontSize: 12, cursor: 'pointer' }}>Tải mẫu</a>
              </div>
              <Select
                mode="multiple"
                value={platforms}
                onChange={setPlatforms}
                style={{ width: '100%', marginBottom: 12 }}
                options={[
                  { label: 'YouTube', value: 'youtube' },
                  { label: 'TikTok', value: 'tiktok' },
                  { label: 'Facebook', value: 'facebook' },
                  { label: 'Google', value: 'google' }
                ]}
              />
              <Input.TextArea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                maxLength={20000}
                showCount
                placeholder={t('textCheck.placeholder')}
              />
              <Button
                type="primary"
                icon={<FileSearchOutlined />}
                size="large"
                onClick={run}
                loading={loading}
                disabled={!text.trim()}
                style={{ marginTop: 16, width: '100%' }}
              >
                {t('textCheck.run')}
              </Button>
            </div>

            <div className="cm-card">
              <h3 style={{ color: '#fafafa', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Kết quả phân tích</h3>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
              ) : !result ? (
                <Empty description={<span style={{ color: '#71717a' }}>Nhập văn bản và bấm Phân tích</span>} />
              ) : (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Progress
                      type="dashboard"
                      percent={result.score}
                      strokeColor={result.score >= 70 ? '#ef4444' : result.score >= 45 ? '#f59e0b' : '#10b981'}
                      format={(v) => <span style={{ color: '#fafafa', fontSize: 28, fontWeight: 700 }}>{v}</span>}
                    />
                    <div style={{ color: '#a1a1aa', marginTop: 12, fontSize: 13 }}>{result.summary}</div>
                  </div>

                  {result.findings.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {result.findings.map((f, i) => (
                        <div key={i} style={{
                          background: '#13131a',
                          border: '1px solid rgba(255,255,255,0.05)',
                          borderRadius: 12,
                          padding: 14
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ color: '#fafafa', fontWeight: 600, fontSize: 13 }}>{f.label}</span>
                            <Tag style={{ background: 'rgba(255,255,255,0.06)', color: severityColor(f.severity) }}>
                              {f.severity.toUpperCase()} · +{f.points}
                            </Tag>
                          </div>
                          {f.matches && f.matches.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {f.matches.slice(0, 6).map((m, j) => (
                                <Tag key={j} style={{ fontSize: 11 }}>{m}</Tag>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description={<span style={{ color: '#71717a' }}>Không phát hiện vi phạm nào</span>} />
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
