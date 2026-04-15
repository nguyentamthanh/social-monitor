'use client'

import { useState } from 'react'
import { Form, Input, Button, Card, message, Typography, Divider } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserOutlined, LockOutlined, MailOutlined, GoogleOutlined, FacebookOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

interface RegisterForm {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const onFinish = async (values: RegisterForm) => {
    if (values.password !== values.confirmPassword) {
      message.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password
        })
      })

      if (response.ok) {
        message.success('Account created successfully!')
        router.push('/login')
      } else {
        const data = await response.json()
        message.error(data.error || 'Registration failed')
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
            Join Social Monitor
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
            Start monitoring keywords across platforms
          </Text>
        </div>

        <div style={{ padding: '40px 40px 32px' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <Button icon={<GoogleOutlined />} block size="large" style={{ height: 48 }}>
              Google
            </Button>
            <Button icon={<FacebookOutlined />} block size="large" style={{ height: 48 }}>
              Facebook
            </Button>
          </div>

          <Divider plain style={{ color: '#94a3b8', fontSize: 12 }}>Or register with</Divider>

          <Form
            name="register"
            onFinish={onFinish}
            autoComplete="off"
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="name"
              rules={[{ required: true, message: 'Please enter your name' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Full Name"
                style={{ height: 48 }}
              />
            </Form.Item>

            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Please enter a valid email' }
              ]}
            >
              <Input
                prefix={<MailOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Email address"
                style={{ height: 48 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: 'Please enter your password' },
                { min: 6, message: 'Password must be at least 6 characters' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Create password"
                style={{ height: 48 }}
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              rules={[
                { required: true, message: 'Please confirm your password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('Passwords do not match'))
                  }
                })
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Confirm password"
                style={{ height: 48 }}
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ height: 48 }}>
                Create Account
              </Button>
            </Form.Item>

            <Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 13 }}>
              Already have an account?{' '}
              <Link href="/login" style={{ fontWeight: 500 }}>Sign in</Link>
            </Text>
          </Form>
        </div>
      </Card>
    </div>
  )
}
