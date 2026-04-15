'use client'

import { Form, Input, Button, Card, message, Typography, Divider } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { UserOutlined, LockOutlined, GoogleOutlined, FacebookOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

interface LoginForm {
  email: string
  password: string
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const onFinish = async (values: LoginForm) => {
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false
      })

      if (result?.ok) {
        message.success('Welcome back!')
        router.push('/dashboard')
        router.refresh()
      } else {
        message.error('Invalid email or password')
      }
    } catch {
      message.error('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <Card className="auth-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', padding: '40px 40px 60px', textAlign: 'center' }}>
          <Title level={2} style={{ color: 'white', margin: 0, fontWeight: 700 }}>
            Social Monitor
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
            Keyword Monitoring Dashboard
          </Text>
        </div>

        <div style={{ padding: '40px 40px 32px' }}>
          <Title level={4} style={{ marginBottom: 24, textAlign: 'center' }}>Sign in to your account</Title>

          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <Button icon={<GoogleOutlined />} block size="large" style={{ height: 48 }}>
              Google
            </Button>
            <Button icon={<FacebookOutlined />} block size="large" style={{ height: 48 }}>
              Facebook
            </Button>
          </div>

          <Divider plain style={{ color: '#94a3b8', fontSize: 12 }}>Or continue with</Divider>

          <Form
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Please enter a valid email' }
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Email address"
                style={{ height: 48 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Password"
                style={{ height: 48 }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <a href="#" style={{ fontSize: 13 }}>Forgot password?</a>
              </div>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ height: 48 }}>
                Sign In
              </Button>
            </Form.Item>

            <Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 13 }}>
              Don&apos;t have an account?{' '}
              <Link href="/register" style={{ fontWeight: 500 }}>Create one</Link>
            </Text>
          </Form>
        </div>
      </Card>
    </div>
  )
}
