'use client'

import { useEffect, useState } from 'react'
import { Layout, Card, Form, Input, Button, message, Switch, Tabs } from 'antd'
import { KeyOutlined, SaveOutlined, GlobalOutlined } from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { useTranslation } from '@/lib/i18n/context'

const { Content } = Layout

const KEY_FIELDS = [
  { name: 'youtube_api_key', label: 'YouTube Data API Key', hint: 'Lấy từ Google Cloud Console' },
  { name: 'google_search_api_key', label: 'Google Search API Key', hint: 'Custom Search JSON API' },
  { name: 'google_search_engine_id', label: 'Google Custom Search Engine ID', hint: 'CX ID từ cse.google.com' },
  { name: 'facebook_token', label: 'Facebook Access Token (optional)', hint: 'Cần Meta app approval' },
  { name: 'tiktok_token', label: 'TikTok Access Token (optional)', hint: 'Cần TikTok Research API access' }
]

export default function SettingsPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t, locale, setLocale } = useTranslation()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    else if (status === 'authenticated') {
      fetch('/api/settings').then(r => r.ok && r.json()).then((data) => {
        if (data?.apiKeys) form.setFieldsValue(data.apiKeys)
        if (data?.preferences?.autoRefresh !== undefined) setAutoRefresh(!!data.preferences.autoRefresh)
      })
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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
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
                    <Form form={form} layout="vertical">
                      {KEY_FIELDS.map(field => (
                        <Form.Item key={field.name} name={field.name} label={field.label} tooltip={field.hint}>
                          <Input.Password placeholder="Nhập key..." autoComplete="new-password" />
                        </Form.Item>
                      ))}
                      <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={loading}>
                        {t('common.save')}
                      </Button>
                    </Form>
                  </Card>
                )
              },
              {
                key: 'prefs',
                label: <span><GlobalOutlined /> {t('settings.preferences')}</span>,
                children: (
                  <Card>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: '#13131a', borderRadius: 10 }}>
                        <div>
                          <div style={{ color: '#fafafa', fontWeight: 500 }}>Ngôn ngữ</div>
                          <div style={{ color: '#71717a', fontSize: 12 }}>Chọn ngôn ngữ giao diện</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button size="small" type={locale === 'vi' ? 'primary' : 'default'} onClick={() => setLocale('vi')}>Tiếng Việt</Button>
                          <Button size="small" type={locale === 'en' ? 'primary' : 'default'} onClick={() => setLocale('en')}>English</Button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: '#13131a', borderRadius: 10 }}>
                        <div>
                          <div style={{ color: '#fafafa', fontWeight: 500 }}>Tự động làm mới</div>
                          <div style={{ color: '#71717a', fontSize: 12 }}>Cập nhật trang mỗi 60 giây</div>
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
