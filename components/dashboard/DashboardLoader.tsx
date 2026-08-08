'use client'

import dynamic from 'next/dynamic'
import { Spin } from 'antd'

const DashboardClient = dynamic(() => import('./DashboardClient'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Spin size="large" />
    </div>
  )
})

export default function DashboardLoader() {
  return <DashboardClient />
}
