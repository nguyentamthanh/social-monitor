'use client'

import { SunOutlined, MoonOutlined } from '@ant-design/icons'
import { useTheme } from '@/components/ThemeProvider'
import { useTranslation } from '@/lib/i18n/context'

/** Nút đổi sáng/tối dùng ngoài khu vực AntD Layout (landing, auth). */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const label = theme === 'dark' ? t('common.lightMode') : t('common.darkMode')

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle ${className}`.trim()}
      aria-label={label}
      title={label}
    >
      {theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
    </button>
  )
}
