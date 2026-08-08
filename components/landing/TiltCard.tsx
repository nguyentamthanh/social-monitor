'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface TiltCardProps {
  children: React.ReactNode
  className?: string
  /** Góc nghiêng tối đa (độ). */
  max?: number
}

/**
 * Thẻ nghiêng 3D theo vị trí con trỏ, kèm vệt sáng chạy theo chuột.
 * Tự tắt trên thiết bị cảm ứng (pointer: coarse) và khi người dùng bật
 * `prefers-reduced-motion` — lúc đó chỉ còn là một thẻ tĩnh bình thường.
 */
export default function TiltCard({ children, className = '', max = 9 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef<number>(0)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setEnabled(finePointer && !reduced)
  }, [])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!enabled) return
    const node = ref.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height

    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      node.style.setProperty('--tilt-x', `${(0.5 - py) * max * 2}deg`)
      node.style.setProperty('--tilt-y', `${(px - 0.5) * max * 2}deg`)
      node.style.setProperty('--glare-x', `${px * 100}%`)
      node.style.setProperty('--glare-y', `${py * 100}%`)
    })
  }, [enabled, max])

  const onLeave = useCallback(() => {
    const node = ref.current
    if (!node) return
    cancelAnimationFrame(frame.current)
    node.style.setProperty('--tilt-x', '0deg')
    node.style.setProperty('--tilt-y', '0deg')
  }, [])

  return (
    <div
      ref={ref}
      className={`tilt-card${enabled ? ' is-tiltable' : ''}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {/* className của caller nằm ở lớp trong — đây mới là mặt thẻ được xoay */}
      <div className={`tilt-card__inner ${className}`.trim()}>
        {children}
        <span className="tilt-card__glare" aria-hidden="true" />
      </div>
    </div>
  )
}
