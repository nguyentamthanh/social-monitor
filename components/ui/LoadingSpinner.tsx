'use client'

import { Spin } from 'antd'

export default function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
      <Spin size="large" />
    </div>
  )
}
