import { ConfigProvider, App as AntdApp } from 'antd'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Social Monitor - Keyword Monitoring Dashboard',
  description: 'Monitor keywords across Facebook, Google, YouTube, TikTok'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: '#6366f1',
                colorSuccess: '#10b981',
                colorWarning: '#f59e0b',
                colorError: '#ef4444',
                borderRadius: 8,
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
              },
              components: {
                Button: {
                  primaryShadow: '0 2px 4px rgba(99, 102, 241, 0.3)'
                },
                Card: {
                  borderRadiusLG: 16
                },
                Table: {
                  borderRadius: 12
                }
              }
            }}
          >
            <AntdApp>{children}</AntdApp>
          </ConfigProvider>
        </Providers>
      </body>
    </html>
  )
}
