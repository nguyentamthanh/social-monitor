'use client'

import { useRouter, usePathname } from 'next/navigation'
import { LinkOutlined, SearchOutlined, FileSearchOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useTranslation } from '@/lib/i18n/context'

const TOOLS = [
  { key: '/scans', icon: <ThunderboltOutlined /> },
  { key: '/url-check', icon: <LinkOutlined /> },
  { key: '/find-copies', icon: <SearchOutlined /> },
  { key: '/text-check', icon: <FileSearchOutlined /> }
] as const

const LABEL_KEY: Record<string, 'nav.scans' | 'nav.urlCheck' | 'nav.findCopies' | 'nav.textCheck'> = {
  '/scans': 'nav.scans',
  '/url-check': 'nav.urlCheck',
  '/find-copies': 'nav.findCopies',
  '/text-check': 'nav.textCheck'
}

/** Quick-switch tab bar shown on every copyright-check surface so users can
 * jump between Scan / URL check / Find Copies / Text check without going back
 * through the sidebar. */
export default function CheckSwitch() {
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useTranslation()

  return (
    <div className="check-switch" role="tablist" aria-label="Copyright check tools">
      {TOOLS.map((tool) => {
        const active = pathname.startsWith(tool.key)
        return (
          <button
            key={tool.key}
            role="tab"
            aria-selected={active}
            className={`check-switch-item${active ? ' is-active' : ''}`}
            onClick={() => !active && router.push(tool.key)}
          >
            <span className="check-switch-icon">{tool.icon}</span>
            {t(LABEL_KEY[tool.key])}
          </button>
        )
      })}
    </div>
  )
}
