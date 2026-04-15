'use client'

import { Layout, Menu, Avatar, Dropdown } from 'antd'
import {
  DashboardOutlined,
  TagsOutlined,
  MessageOutlined,
  LineChartOutlined,
  LogoutOutlined,
  UserOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { useRouter, usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

const { Sider } = Layout

const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard'
  },
  {
    key: '/keywords',
    icon: <TagsOutlined />,
    label: 'Keywords'
  },
  {
    key: '/mentions',
    icon: <MessageOutlined />,
    label: 'Mentions'
  },
  {
    key: '/trends',
    icon: <LineChartOutlined />,
    label: 'Trends'
  }
]

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()

  const selectedKey = menuItems.find(item => pathname.startsWith(item.key))?.key || '/dashboard'

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile'
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings'
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      danger: true
    }
  ]

  const handleMenuClick = (key: string) => {
    if (key === 'logout') {
      signOut({ callbackUrl: '/login' })
    } else if (key === 'profile' || key === 'settings') {
      // Handle navigation
    } else {
      router.push(key)
    }
  }

  return (
    <Sider width={260} className="app-sider" style={{ position: 'fixed', height: '100vh', left: 0, top: 0 }}>
      <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>
            Social Monitor
          </h1>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Marketing Dashboard
          </span>
        </div>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={({ key }) => router.push(key)}
        style={{ borderRight: 0, marginTop: 8 }}
      />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <Dropdown menu={{ items: userMenuItems, onClick: ({ key }) => handleMenuClick(key) }} trigger={['click']}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, transition: 'background 0.2s' }}>
            <Avatar style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }} icon={<UserOutlined />} />
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontSize: 14, fontWeight: 500 }}>{session?.user?.name || 'User'}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{session?.user?.email || 'user@email.com'}</div>
            </div>
          </div>
        </Dropdown>
      </div>
    </Sider>
  )
}
