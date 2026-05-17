'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Form, Input, Button, message } from 'antd'
import { MailOutlined, LockOutlined, UserOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useTranslation } from '@/lib/i18n/context'

export default function RegisterPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  const onSubmit = async (values: { name: string; email: string; password: string; confirm: string }) => {
    if (values.password !== values.confirm) {
      message.error('Mật khẩu xác nhận không khớp')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name, email: values.email, password: values.password })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Đăng ký thất bại')
      }
      await signIn('credentials', { email: values.email, password: values.password, redirect: false })
      router.push('/dashboard')
    } catch (err: any) {
      message.error(err?.message || 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
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
      </div>

      <div className="auth-form-wrap">
        <div className="auth-form">
          <h2>{t('auth.signupTitle')}</h2>
          <p>{t('auth.signupSub')}</p>
          <Form layout="vertical" onFinish={onSubmit}>
            <Form.Item name="name" rules={[{ required: true }]}>
              <Input prefix={<UserOutlined />} placeholder={t('auth.name')} size="large" />
            </Form.Item>
            <Form.Item name="email" rules={[{ required: true, type: 'email' }]}>
              <Input prefix={<MailOutlined />} placeholder={t('auth.email')} size="large" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, min: 6 }]}>
              <Input.Password prefix={<LockOutlined />} placeholder={t('auth.password')} size="large" />
            </Form.Item>
            <Form.Item name="confirm" rules={[{ required: true, min: 6 }]}>
              <Input.Password prefix={<LockOutlined />} placeholder={t('auth.confirmPassword')} size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              {t('auth.registerCta')}
            </Button>
          </Form>
          <div style={{ marginTop: 24, textAlign: 'center', color: '#a1a1aa', fontSize: 13 }}>
            {t('auth.haveAccount')}{' '}
            <Link href="/login" className="auth-link">{t('auth.login')}</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
