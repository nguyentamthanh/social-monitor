'use client'

import { Layout, Input, Badge, Avatar, Dropdown, Space } from 'antd'
import { SearchOutlined, BellOutlined, SettingOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const { Header: AntHeader } = Layout

interface HeaderProps {
  title?: string
}

export default function Header({ title }: HeaderProps) {
  const { data: session } = useSession()
  const router = useRouter()

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

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      signOut({ callbackUrl: '/login' })
    } else if (key === 'profile') {
      router.push('/profile')
    }
  }

  return (
    <AntHeader style={{
      background: '#fff',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
    }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1e293b' }}>{title || 'Dashboard'}</h2>
      <Space size={20}>
        <Input
          placeholder="Search keywords, mentions..."
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          style={{ width: 280, borderRadius: 8 }}
        />
        <Badge count={3} size="small">
          <BellOutlined style={{ fontSize: 18, color: '#64748b', cursor: 'pointer' }} />
        </Badge>
        <Dropdown menu={{ items: userMenuItems, onClick: handleMenuClick }} trigger={['click']}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '4px 8px', borderRadius: 8, transition: 'background 0.2s' }}>
            <Avatar style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }} size={36} icon={<UserOutlined />} />
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1e293b' }}>{session?.user?.name || 'User'}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Marketing</div>
            </div>
          </div>
        </Dropdown>
      </Space>
    </AntHeader>
  )
}
