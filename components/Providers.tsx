'use client'

import '@ant-design/v5-patch-for-react-19'
import { ConfigProvider, App as AntdApp, theme as antTheme } from 'antd'
import { SessionProvider } from 'next-auth/react'
import { I18nProvider } from '@/lib/i18n/context'
import { ThemeProvider, useTheme } from '@/components/ThemeProvider'

const LIGHT_TOKENS = {
  colorPrimary: '#8b5cf6',
  colorSuccess: '#10b981',
  colorWarning: '#f59e0b',
  colorError: '#ef4444',
  colorBgBase: 'var(--bg-base)',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBorder: 'rgba(139, 92, 246, 0.12)',
  colorBorderSecondary: 'rgba(139, 92, 246, 0.08)',
  colorText: 'var(--text-primary)',
  colorTextSecondary: 'var(--text-secondary)',
  colorTextTertiary: 'var(--text-muted)',
  borderRadius: 10,
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
}

const DARK_TOKENS = {
  colorPrimary: '#a78bfa',
  colorSuccess: '#34d399',
  colorWarning: '#fbbf24',
  colorError: '#f87171',
  colorBgBase: '#17141f',
  colorBgContainer: '#1f1b2b',
  colorBgElevated: '#262138',
  colorBorder: 'rgba(167, 139, 250, 0.18)',
  colorBorderSecondary: 'rgba(167, 139, 250, 0.12)',
  colorText: '#f1edfa',
  colorTextSecondary: '#b5aed0',
  colorTextTertiary: '#8b84a8',
  borderRadius: 10,
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
}

function AntdProviders({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: isDark ? DARK_TOKENS : LIGHT_TOKENS,
        components: {
          Button: {
            primaryShadow: isDark
              ? '0 2px 8px rgba(167, 139, 250, 0.35)'
              : '0 2px 8px rgba(139, 92, 246, 0.3)'
          },
          Card: {
            borderRadiusLG: 16,
            colorBgContainer: isDark ? '#1f1b2b' : '#ffffff'
          },
          Layout: {
            bodyBg: 'transparent',
            headerBg: isDark ? 'rgba(23, 20, 31, 0.75)' : 'rgba(255, 255, 255, 0.75)',
            siderBg: isDark ? 'rgba(31, 27, 43, 0.9)' : 'rgba(255, 255, 255, 0.9)'
          },
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent'
          }
        }
      }}
    >
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  )
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <I18nProvider>
          <AntdProviders>{children}</AntdProviders>
        </I18nProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
