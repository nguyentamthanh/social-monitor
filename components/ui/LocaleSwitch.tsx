'use client'

import { Segmented } from 'antd'
import { useTranslation } from '@/lib/i18n/context'

export default function LocaleSwitch() {
  const { locale, setLocale } = useTranslation()

  return (
    <Segmented
      size="small"
      value={locale}
      onChange={(value) => setLocale(value as 'vi' | 'en')}
      options={[
        { label: 'VI', value: 'vi' },
        { label: 'EN', value: 'en' }
      ]}
    />
  )
}
