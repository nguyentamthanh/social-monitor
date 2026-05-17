'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Form, Input, Button, message } from 'antd'
import { MailOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useTranslation } from '@/lib/i18n/context'

export default function LoginPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  const onSubmit = async (values: { email: string; password: string }) => {
    setLoading(true)
    try {
      const res = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false
      })
      if (res?.error) {
        message.error('Email hoặc mật khẩu không đúng')
      } else {
        router.push('/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  const useDemo = () => {
    onSubmit({ email: 'admin@admin.com', password: 'admin123' })
  }

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <div style={{
              width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 12, background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
              boxShadow: '0 0 24px rgba(139,92,246,0.5)'
            }}>
              <SafetyCertificateOutlined style={{ color: 'white', fontSize: 22 }} />
            </div>
            <span style={{ color: '#fafafa', fontSize: 20, fontWeight: 700 }}>{t('app.name')}</span>
          </div>
          <h1>{t('auth.brandTitle')}</h1>
          <p>{t('auth.brandSub')}</p>
        </div>

        <div style={{ display: 'flex', gap: 32 }}>
          {['Text', 'Image', 'Video', 'Audio'].map((label, i) => (
            <div key={label}>
              <div style={{
                color: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'][i],
                fontSize: 22, fontWeight: 700, lineHeight: 1
              }}>4</div>
              <div style={{ color: '#a1a1aa', fontSize: 12, marginTop: 4 }}>{label} scan</div>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-form-wrap">
        <div className="auth-form">
          <h2>{t('auth.welcome')}</h2>
          <p>{t('auth.welcomeSub')}</p>
          <Form
            layout="vertical"
            onFinish={onSubmit}
            initialValues={{ email: 'admin@admin.com', password: 'admin123' }}
          >
            <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Email không hợp lệ' }]}>
              <Input prefix={<MailOutlined />} placeholder={t('auth.email')} size="large" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, min: 6 }]}>
              <Input.Password prefix={<LockOutlined />} placeholder={t('auth.password')} size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ marginBottom: 12 }}>
              {t('auth.loginCta')}
            </Button>
            <Button block onClick={useDemo} disabled={loading} size="large">
              {t('auth.tryDemo')}
            </Button>
          </Form>
          <div style={{ marginTop: 24, textAlign: 'center', color: '#a1a1aa', fontSize: 13 }}>
            {t('auth.noAccount')}{' '}
            <Link href="/register" className="auth-link">{t('auth.register')}</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
