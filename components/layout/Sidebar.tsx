'use client'

import { Layout, Menu, Avatar, Dropdown } from 'antd'
import {
  DashboardOutlined,
  TagsOutlined,
  MessageOutlined,
  LineChartOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
  FileProtectOutlined,
  SecurityScanOutlined,
  WarningOutlined,
  FileSearchOutlined,
  LinkOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons'
import { useRouter, usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

const { Sider } = Layout

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 992px)')
    const update = () => setCollapsed(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: t('nav.dashboard') },
    { key: '/assets', icon: <FileProtectOutlined />, label: t('nav.assets') },
    { key: '/scans', icon: <SecurityScanOutlined />, label: t('nav.scans') },
    { key: '/findings', icon: <WarningOutlined />, label: t('nav.findings') },
    { key: '/text-check', icon: <FileSearchOutlined />, label: t('nav.textCheck') },
    { key: '/url-check', icon: <LinkOutlined />, label: t('nav.urlCheck') },
    { key: '/keywords', icon: <TagsOutlined />, label: t('nav.keywords') },
    { key: '/mentions', icon: <MessageOutlined />, label: t('nav.mentions') },
    { key: '/trends', icon: <LineChartOutlined />, label: t('nav.trends') },
    { key: '/settings', icon: <SettingOutlined />, label: t('nav.settings') }
  ]

  const selectedKey = menuItems.find(item => pathname.startsWith(item.key))?.key || '/dashboard'

  const userMenuItems = [
    { key: 'logout', icon: <LogoutOutlined />, label: t('common.signOut'), danger: true }
  ]

  return (
    <Sider
      width={260}
      collapsedWidth={72}
      collapsed={collapsed}
      className="app-sider"
      style={{ position: 'fixed', height: '100vh', left: 0, top: 0 }}
    >
      <div
        style={{
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          gap: 12
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            color: 'white',
            fontSize: 18,
            flexShrink: 0,
            boxShadow: '0 0 16px rgba(139, 92, 246, 0.4)'
          }}
        >
          <SafetyCertificateOutlined />
        </div>
        {!collapsed && (
          <div>
            <div style={{ color: '#fafafa', fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
              {t('app.name')}
            </div>
            <div style={{ color: '#71717a', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', marginTop: 2 }}>
              v1.0
            </div>
          </div>
        )}
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={({ key }) => router.push(key)}
        style={{ borderRight: 0, marginTop: 16 }}
      />

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 16,
          borderTop: '1px solid rgba(255,255,255,0.05)'
        }}
      >
        <Dropdown
          menu={{ items: userMenuItems, onClick: ({ key }) => key === 'logout' && signOut({ callbackUrl: '/login' }) }}
          trigger={['click']}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 12,
              cursor: 'pointer',
              padding: collapsed ? '8px 0' : '8px 10px',
              borderRadius: 10,
              transition: 'background 0.2s'
            }}
          >
            <Avatar style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }} icon={<UserOutlined />} />
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fafafa', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session?.user?.name || 'User'}
                </div>
                <div style={{ color: '#71717a', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session?.user?.email || ''}
                </div>
              </div>
            )}
          </div>
        </Dropdown>
      </div>
    </Sider>
  )
}
