'use client'

import { Layout, Input, Badge, Avatar, Dropdown, Space, Popover, List, Empty, Spin } from 'antd'
import {
  SearchOutlined,
  BellOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined
} from '@ant-design/icons'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import LocaleSwitch from '@/components/ui/LocaleSwitch'
import { useTranslation } from '@/lib/i18n/context'

const { Header: AntHeader } = Layout

interface HeaderProps {
  title?: string
}

interface NotificationItem {
  id: number
  type: string
  title: string
  message?: string
  read_at?: string | null
  created_at: string
}

export default function Header({ title }: HeaderProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loadingNotifs, setLoadingNotifs] = useState(false)

  useEffect(() => {
    if (!session?.user) return
    const fetchNotifs = async () => {
      setLoadingNotifs(true)
      try {
        const res = await fetch('/api/notifications')
        if (res.ok) {
          const data = await res.json()
          setNotifications(data.items || [])
          setUnread(data.unread || 0)
        }
      } catch {
        /* noop */
      } finally {
        setLoadingNotifs(false)
      }
    }
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 30000)
    return () => clearInterval(interval)
  }, [session?.user])

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' })
    setUnread(0)
    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
  }

  const userMenuItems = [
    { key: 'settings', icon: <SettingOutlined />, label: t('nav.settings') },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: t('common.signOut'), danger: true }
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') signOut({ callbackUrl: '/login' })
    else if (key === 'settings') router.push('/settings')
  }

  const notifContent = (
    <div style={{ width: 320, maxHeight: 420, overflow: 'auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <span style={{ fontWeight: 600, color: '#fafafa' }}>{t('common.notifications')}</span>
        {unread > 0 && (
          <a onClick={markAllRead} style={{ fontSize: 12 }}>
            Mark all read
          </a>
        )}
      </div>
      {loadingNotifs ? (
        <div style={{ padding: 24, textAlign: 'center' }}><Spin /></div>
      ) : notifications.length === 0 ? (
        <Empty description="No notifications" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 24 }} />
      ) : (
        <List
          dataSource={notifications}
          renderItem={(item) => (
            <List.Item style={{ padding: '12px', cursor: 'pointer', background: !item.read_at ? 'rgba(139,92,246,0.05)' : 'transparent' }}>
              <List.Item.Meta
                title={<span style={{ color: '#fafafa', fontSize: 13 }}>{item.title}</span>}
                description={<span style={{ color: '#a1a1aa', fontSize: 12 }}>{item.message}</span>}
              />
            </List.Item>
          )}
        />
      )}
    </div>
  )

  return (
    <AntHeader
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fafafa', letterSpacing: '-0.01em' }}>
        {title || t('nav.dashboard')}
      </h2>
      <Space size={16}>
        <Input
          className="app-header-search"
          placeholder={t('common.search')}
          prefix={<SearchOutlined />}
          style={{ width: 280 }}
        />
        <LocaleSwitch />
        <Popover content={notifContent} trigger="click" placement="bottomRight" arrow={false}>
          <Badge count={unread} size="small">
            <BellOutlined style={{ fontSize: 18, color: '#a1a1aa', cursor: 'pointer' }} />
          </Badge>
        </Popover>
        <Dropdown menu={{ items: userMenuItems, onClick: handleMenuClick }} trigger={['click']}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 10
            }}
          >
            <Avatar style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }} size={32} icon={<UserOutlined />} />
            <div className="app-header-user-meta" style={{ lineHeight: 1.3 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#fafafa' }}>{session?.user?.name || 'User'}</div>
            </div>
          </div>
        </Dropdown>
      </Space>
    </AntHeader>
  )
}
