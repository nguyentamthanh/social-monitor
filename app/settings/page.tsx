'use client'

import { useEffect, useState } from 'react'
import { Layout, Card, Form, Input, Button, message, Switch, Tabs, Alert, Tooltip } from 'antd'
import { KeyOutlined, SaveOutlined, GlobalOutlined, ChromeOutlined, CopyOutlined, DeleteOutlined, ReloadOutlined, ApiOutlined } from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { useTranslation } from '@/lib/i18n/context'

const { Content } = Layout

const KEY_FIELDS = [
  {
    name: 'youtube_api_key',
    label: 'YouTube Data API Key',
    hint: 'Tạo credential trong Google Cloud Console, nhớ bật "YouTube Data API v3"',
    docUrl: 'https://console.cloud.google.com/apis/credentials'
  },
  {
    name: 'google_search_api_key',
    label: 'Google Search API Key',
    hint: 'Custom Search JSON API — bấm "Get a Key" trong trang tài liệu',
    docUrl: 'https://developers.google.com/custom-search/v1/introduction'
  },
  {
    name: 'google_search_engine_id',
    label: 'Google Custom Search Engine ID',
    hint: 'CX ID của search engine bạn tạo (nhớ bật "Search the entire web")',
    docUrl: 'https://programmablesearchengine.google.com/controlpanel/all'
  },
  {
    name: 'facebook_token',
    label: 'Facebook Access Token (tuỳ chọn)',
    hint: 'Cần Meta app review; nếu chưa có, Facebook vẫn quét được qua Google Custom Search',
    docUrl: 'https://developers.facebook.com/apps'
  },
  {
    name: 'tiktok_token',
    label: 'TikTok Access Token (tuỳ chọn)',
    hint: 'Cần được duyệt TikTok Research API',
    docUrl: 'https://developers.tiktok.com/products/research-api'
  }
]

const PLATFORM_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  google: 'Google Search',
  facebook: 'Facebook',
  tiktok: 'TikTok'
}

interface ConnectorCheck {
  platform: string
  capability: 'ready' | 'limited' | 'error'
  code: string
  message: string
}

export default function SettingsPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t, locale, setLocale } = useTranslation()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const [testing, setTesting] = useState(false)
  const [checks, setChecks] = useState<ConnectorCheck[] | null>(null)

  const [extKeyState, setExtKeyState] = useState<{ hasKey: boolean; createdAt: string | null }>({ hasKey: false, createdAt: null })
  const [extKeyPlain, setExtKeyPlain] = useState<string | null>(null)
  const [extKeyLoading, setExtKeyLoading] = useState(false)

  const loadExtKeyState = async () => {
    const res = await fetch('/api/extension/keygen')
    if (res.ok) setExtKeyState(await res.json())
  }

  const generateExtKey = async () => {
    setExtKeyLoading(true)
    setExtKeyPlain(null)
    try {
      const res = await fetch('/api/extension/keygen', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setExtKeyPlain(data.key)
      setExtKeyState({ hasKey: true, createdAt: new Date().toISOString() })
      message.success('API key đã được tạo — hãy copy và lưu ngay!')
    } catch {
      message.error('Không thể tạo key')
    } finally {
      setExtKeyLoading(false)
    }
  }

  const revokeExtKey = async () => {
    setExtKeyLoading(true)
    try {
      await fetch('/api/extension/keygen', { method: 'DELETE' })
      setExtKeyState({ hasKey: false, createdAt: null })
      setExtKeyPlain(null)
      message.success('Đã revoke API key')
    } finally {
      setExtKeyLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    else if (status === 'authenticated') {
      fetch('/api/settings').then(r => r.ok && r.json()).then((data) => {
        if (data?.apiKeys) form.setFieldsValue(data.apiKeys)
        if (data?.preferences?.autoRefresh !== undefined) setAutoRefresh(!!data.preferences.autoRefresh)
      })
      loadExtKeyState()
    }
  }, [status, router, form])

  const handleSave = async () => {
    setLoading(true)
    try {
      const values = await form.validateFields()
      // Don't send masked keys (those that contain '*' from server)
      const apiKeys: Record<string, string> = {}
      for (const [k, v] of Object.entries(values)) {
        if (typeof v === 'string' && v && !v.includes('***')) {
          apiKeys[k] = v
        }
      }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKeys, preferences: { autoRefresh } })
      })
      if (!res.ok) throw new Error('Save failed')
      message.success(t('settings.saved'))
      // Reload masked keys
      const fresh = await res.json()
      if (fresh?.apiKeys) form.setFieldsValue(fresh.apiKeys)
    } catch (err: any) {
      message.error(err?.message || 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  /** Gọi thử API thật với key đang gõ trên form — không lưu vào DB. */
  const handleTest = async () => {
    setTesting(true)
    try {
      const values = form.getFieldsValue()
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKeys: values })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Test failed')
      setChecks(data.connectors || [])
      if (data.readyCount > 0) message.success(`${data.readyCount} nền tảng sẵn sàng`)
      else message.warning('Chưa nền tảng nào sẵn sàng — kiểm tra lại key')
    } catch (err: any) {
      message.error(err?.message || 'Không kiểm tra được kết nối')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout className="ml-0 xl:ml-[260px]">
        <Header title={t('nav.settings')} />
        <Content className="page-container">
          <div className="page-header">
            <h1>{t('settings.title')}</h1>
            <p>{t('settings.sub')}</p>
          </div>

          <Tabs
            defaultActiveKey="api"
            items={[
              {
                key: 'api',
                label: <span><KeyOutlined /> {t('settings.apiKeys')}</span>,
                children: (
                  <Card>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 20 }}
                      message="Cần ít nhất YouTube Data API Key để quét được"
                      description="Key do bạn tự tạo trên trang của nhà cung cấp — bấm link cạnh mỗi ô để mở đúng trang. Key được mã hoá AES-256 trước khi lưu."
                    />
                    <Form form={form} layout="vertical">
                      {KEY_FIELDS.map(field => (
                        <Form.Item
                          key={field.name}
                          name={field.name}
                          tooltip={field.hint}
                          label={
                            <span className="settings-key-label">
                              {field.label}
                              <a href={field.docUrl} target="_blank" rel="noreferrer noopener">
                                Lấy key →
                              </a>
                            </span>
                          }
                        >
                          <Input.Password placeholder="Nhập key..." autoComplete="new-password" />
                        </Form.Item>
                      ))}

                      {checks && (
                        <div className="settings-check-row">
                          {checks.map(check => (
                            <Tooltip key={check.platform} title={check.message}>
                              <span className={`settings-check-chip is-${check.capability}`}>
                                {check.capability === 'ready' ? '✓' : check.capability === 'error' ? '✕' : '—'}
                                {PLATFORM_LABEL[check.platform] || check.platform}
                              </span>
                            </Tooltip>
                          ))}
                        </div>
                      )}

                      <div className="settings-actions">
                        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={loading}>
                          {t('common.save')}
                        </Button>
                        <Button icon={<ApiOutlined />} onClick={handleTest} loading={testing}>
                          Kiểm tra kết nối
                        </Button>
                      </div>
                    </Form>
                  </Card>
                )
              },
              {
                key: 'extension',
                label: <span><ChromeOutlined /> Extension Key</span>,
                children: (
                  <Card>
                    <div style={{ maxWidth: 520 }}>
                      <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>Chrome Extension API Key</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                        Dùng key này để kết nối Chrome Extension với tài khoản của bạn.
                        Key chỉ hiển thị một lần — hãy lưu lại ngay sau khi tạo.
                      </p>

                      {extKeyPlain && (
                        <Alert
                          type="success"
                          style={{ marginBottom: 16 }}
                          message="Copy key này ngay — sẽ không hiển thị lại!"
                          description={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                              <Input
                                value={extKeyPlain}
                                readOnly
                                style={{ fontFamily: 'monospace', fontSize: 12, flex: 1 }}
                              />
                              <Tooltip title="Copy">
                                <Button
                                  icon={<CopyOutlined />}
                                  size="small"
                                  onClick={() => {
                                    navigator.clipboard.writeText(extKeyPlain)
                                    message.success('Đã copy!')
                                  }}
                                />
                              </Tooltip>
                            </div>
                          }
                        />
                      )}

                      <div style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 10, marginBottom: 20 }}>
                        {extKeyState.hasKey ? (
                          <div>
                            <div style={{ color: '#10b981', fontSize: 13, marginBottom: 4 }}>✓ Đã có API key đang hoạt động</div>
                            {extKeyState.createdAt && (
                              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                                Tạo lúc: {new Date(extKeyState.createdAt).toLocaleString('vi-VN')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chưa có API key nào.</div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <Button
                          type="primary"
                          icon={extKeyState.hasKey ? <ReloadOutlined /> : <KeyOutlined />}
                          loading={extKeyLoading}
                          onClick={generateExtKey}
                        >
                          {extKeyState.hasKey ? 'Tạo key mới (revoke key cũ)' : 'Tạo API Key'}
                        </Button>
                        {extKeyState.hasKey && (
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            loading={extKeyLoading}
                            onClick={revokeExtKey}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              },
              {
                key: 'prefs',
                label: <span><GlobalOutlined /> {t('settings.preferences')}</span>,
                children: (
                  <Card>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--bg-card)', borderRadius: 10 }}>
                        <div>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Ngôn ngữ</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Chọn ngôn ngữ giao diện</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button size="small" type={locale === 'vi' ? 'primary' : 'default'} onClick={() => setLocale('vi')}>Tiếng Việt</Button>
                          <Button size="small" type={locale === 'en' ? 'primary' : 'default'} onClick={() => setLocale('en')}>English</Button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--bg-card)', borderRadius: 10 }}>
                        <div>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Tự động làm mới</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Cập nhật trang mỗi 60 giây</div>
                        </div>
                        <Switch checked={autoRefresh} onChange={setAutoRefresh} />
                      </div>
                      <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={loading}>
                        {t('common.save')}
                      </Button>
                    </div>
                  </Card>
                )
              }
            ]}
          />
        </Content>
      </Layout>
    </Layout>
  )
}
