'use client'

import '@ant-design/v5-patch-for-react-19'
import { ConfigProvider, App as AntdApp, theme as antTheme } from 'antd'
import { SessionProvider } from 'next-auth/react'
import { I18nProvider } from '@/lib/i18n/context'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider>
        <ConfigProvider
          theme={{
            algorithm: antTheme.darkAlgorithm,
            token: {
              colorPrimary: '#8b5cf6',
              colorSuccess: '#10b981',
              colorWarning: '#f59e0b',
              colorError: '#ef4444',
              colorBgBase: '#0a0a0f',
              colorBgContainer: '#1a1a25',
              colorBgElevated: '#1a1a25',
              colorBorder: 'rgba(255, 255, 255, 0.08)',
              colorBorderSecondary: 'rgba(255, 255, 255, 0.06)',
              colorText: '#fafafa',
              colorTextSecondary: '#a1a1aa',
              colorTextTertiary: '#71717a',
              borderRadius: 10,
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
            },
            components: {
              Button: {
                primaryShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
              },
              Card: {
                borderRadiusLG: 16,
                colorBgContainer: '#1a1a25'
              },
              Layout: {
                bodyBg: 'transparent',
                headerBg: 'rgba(10, 10, 15, 0.7)',
                siderBg: 'rgba(13, 13, 20, 0.85)'
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
      </I18nProvider>
    </SessionProvider>
  )
}
