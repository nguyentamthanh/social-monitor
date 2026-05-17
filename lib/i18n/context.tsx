'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LOCALE, Locale, MessageKey, messages } from './messages'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, fallback?: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'cm.locale'

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    try {
      const stored = (typeof window !== 'undefined' && (localStorage.getItem(STORAGE_KEY) as Locale | null)) || null
      if (stored === 'vi' || stored === 'en') {
        setLocaleState(stored)
      }
    } catch {
      /* noop */
    }
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
      document.cookie = `${STORAGE_KEY}=${next}; path=/; max-age=${60 * 60 * 24 * 365}`
    } catch {
      /* noop */
    }
  }, [])

  const t = useCallback(
    (key: MessageKey, fallback?: string) => {
      const dict = messages[locale] || messages[DEFAULT_LOCALE]
      return (dict as Record<string, string>)[key] || fallback || key
    },
    [locale]
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE as Locale,
      setLocale: () => {},
      t: (key: MessageKey, fallback?: string) => fallback || key
    }
  }
  return ctx
}
