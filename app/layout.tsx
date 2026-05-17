import './globals.css'
import Providers from '@/components/Providers'

export const metadata = {
  title: 'Copyright Monitor — Brand Protection',
  description: 'Detect copyright infringement across the web for text, images, video and music.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
