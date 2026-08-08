'use client'

import { Layout, Input, Badge, Avatar, Dropdown, Space, Popover, List, Empty, Spin, Button, Tooltip } from 'antd'
import {
  SearchOutlined,
  BellOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonOutlined
} from '@ant-design/icons'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import LocaleSwitch from '@/components/ui/LocaleSwitch'
import { useTranslation } from '@/lib/i18n/context'
import { useTheme } from '@/components/ThemeProvider'

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
  const { theme, toggleTheme } = useTheme()
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
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('common.notifications')}</span>
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
                title={<span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{item.title}</span>}
                description={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{item.message}</span>}
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
      className="!h-12 sm:!h-14 md:!h-16 !pl-12 !pr-2 sm:!pr-3 md:!px-8"
    >
      {/* pl-12 trên mobile chừa chỗ cho nút hamburger fixed của Sidebar */}
      <h2 className="m-0 text-sm sm:text-base md:text-lg font-semibold text-[var(--text-primary)] tracking-tight truncate max-w-[150px] sm:max-w-[200px] md:max-w-none">
        {title || t('nav.dashboard')}
      </h2>
      <Space size={8} className="gap-1 sm:gap-2 md:gap-4">
        {/* inline-flex chứ không phải block: affix-wrapper cần flex để icon và ô
            chữ nằm cùng hàng */}
        <Input
          className="hidden! lg:inline-flex!"
          placeholder={t('common.search')}
          prefix={<SearchOutlined />}
          style={{ width: 240 }}
        />
        <Tooltip title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}>
          <Button
            type="text"
            shape="circle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            icon={
              theme === 'dark'
                ? <SunOutlined className="text-[15px] sm:text-lg text-[var(--text-secondary)]" />
                : <MoonOutlined className="text-[15px] sm:text-lg text-[var(--text-secondary)]" />
            }
            className="!flex !items-center !justify-center"
          />
        </Tooltip>
        <div className="hidden sm:block">
          <LocaleSwitch />
        </div>
        <Popover content={notifContent} trigger="click" placement="bottomRight" arrow={false}>
          <Badge count={unread} size="small">
            <BellOutlined className="text-[15px] sm:text-lg text-[var(--text-secondary)] cursor-pointer" />
          </Badge>
        </Popover>
        <Dropdown menu={{ items: userMenuItems, onClick: handleMenuClick }} trigger={['click']}>
          <div className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer px-1 sm:px-2 py-1 rounded-xl">
            <Avatar style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }} size={24} className="sm:!w-[28px] sm:!h-[28px] md:!w-[32px] md:!h-[32px]" icon={<UserOutlined />} />
            <div className="hidden md:block leading-tight">
              <div className="text-sm font-medium text-[var(--text-primary)]">{session?.user?.name || 'User'}</div>
            </div>
          </div>
        </Dropdown>
      </Space>
    </AntHeader>
  )
}
