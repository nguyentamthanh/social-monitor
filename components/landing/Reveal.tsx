'use client'

import { useEffect, useRef, useState } from 'react'

type Variant = 'up' | 'left' | 'right' | 'scale'

interface RevealProps {
  children: React.ReactNode
  /** Hướng phần tử bay vào khi cuộn tới. */
  variant?: Variant
  /** Trễ theo ms — dùng để stagger các item trong cùng một lưới. */
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'li'
}

/**
 * Bọc một khối nội dung để nó fade + trượt vào khi cuộn tới viewport.
 * Dùng IntersectionObserver (không thư viện ngoài) và chỉ chạy 1 lần cho mỗi khối.
 * Người dùng bật `prefers-reduced-motion` sẽ thấy nội dung hiện sẵn, không animate.
 */
export default function Reveal({
  children,
  variant = 'up',
  delay = 0,
  className = '',
  as: Tag = 'div'
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref as React.Ref<any>}
      className={`reveal reveal--${variant}${shown ? ' is-visible' : ''} ${className}`.trim()}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  )
}
