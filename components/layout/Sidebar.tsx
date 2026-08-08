'use client'

import { Layout, Menu, Avatar, Dropdown, Drawer } from 'antd'
import {
  DashboardOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
  FileProtectOutlined,
  SecurityScanOutlined,
  WarningOutlined,
  SafetyCertificateOutlined,
  MenuOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons'
import { useRouter, usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { useTheme } from '@/components/ThemeProvider'

const { Sider } = Layout

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const { t } = useTranslation()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

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
    { key: '/settings', icon: <SettingOutlined />, label: t('nav.settings') }
  ]

  const selectedKey = menuItems.find(item => pathname.startsWith(item.key))?.key || '/dashboard'

  const userMenuItems = [
    { key: 'logout', icon: <LogoutOutlined />, label: t('common.signOut'), danger: true }
  ]

  return (
    <>
    <Sider
      width={260}
      collapsedWidth={72}
      collapsed={collapsed}
      className="hidden md:block app-sider"
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
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
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
            <div style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
              {t('app.name')}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', marginTop: 2 }}>
              v1.0
            </div>
          </div>
        )}
      </div>

      {/* Hàng "mở rộng menu" khi Sider đang thu gọn (768–992px, không có nút
          nào khác để xem menu đầy đủ ở dải width này). Đặt ngay trong dòng
          chảy của Sider — cùng nhịp với các mục menu — thay vì nút nổi rời
          rạc để trông cân đối, liền mạch với thiết kế. */}
      {collapsed && (
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Expand menu"
          className="sider-expand-btn"
        >
          <MenuUnfoldOutlined />
        </button>
      )}

      <Menu
        theme={isDark ? 'dark' : 'light'}
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
            <Avatar style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }} icon={<UserOutlined />} />
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session?.user?.name || 'User'}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session?.user?.email || ''}
                </div>
              </div>
            )}
          </div>
        </Dropdown>
      </div>
    </Sider>

      {/* Mobile hamburger — góc trái header (bên phải đã có theme/bell/avatar) */}
      <button
        className="md:hidden fixed top-[8px] left-2 z-[300] w-[32px] h-[32px] flex items-center justify-center rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-base cursor-pointer hover:bg-[var(--bg-hover)] hover:border-[var(--accent-violet)] transition-all shadow-sm"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <MenuOutlined />
      </button>

      {/* Mobile drawer — đẹp hơn */}
      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        width={300}
        styles={{
          body: { padding: 0, background: 'var(--bg-base)' },
          header: { display: 'none' }
        }}
      >
        {/* Header with close */}
        <div className="flex items-center justify-between px-5 h-[64px] border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-[10px] bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] text-white text-lg shadow-[0_0_16px_rgba(139,92,246,0.4)]">
              <SafetyCertificateOutlined />
            </div>
            <div>
              <div className="text-[var(--text-primary)] font-bold text-[15px] leading-tight">{t('app.name')}</div>
              <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-[1px] mt-0.5">v1.0</div>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] text-sm cursor-pointer hover:bg-[rgba(255,255,255,0.1)] hover:text-[var(--text-primary)] transition-all"
          >
            ✕
          </button>
        </div>

        {/* Menu */}
        <Menu
          theme={isDark ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => {
            router.push(key)
            setMobileOpen(false)
          }}
          className="!border-r-0 !mt-2 !bg-transparent"
          style={{
            background: 'transparent',
            borderRight: 0
          }}
        />

        {/* User footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[rgba(255,255,255,0.06)] bg-[var(--bg-base)]">
          <Dropdown
            menu={{ items: userMenuItems, onClick: ({ key }) => key === 'logout' && signOut({ callbackUrl: '/login' }) }}
            trigger={['click']}
          >
            <div className="flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.04)] transition-all">
              <Avatar style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }} size={36} icon={<UserOutlined />} />
              <div className="flex-1 min-w-0">
                <div className="text-[var(--text-primary)] text-sm font-medium truncate">{session?.user?.name || 'User'}</div>
                <div className="text-[var(--text-muted)] text-[11px] truncate">{session?.user?.email || ''}</div>
              </div>
            </div>
          </Dropdown>
        </div>
      </Drawer>
    </>
  )
}
