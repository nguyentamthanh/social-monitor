'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import BrandMark from '@/components/ui/BrandMark'

/**
 * Khối minh hoạ 3D dưới hero: một "phiếu kết quả quét" nổi trong không gian,
 * kèm 2 chip nền tảng ở độ sâu khác nhau nên khi rê chuột chúng dịch chuyển
 * lệch nhau (parallax) tạo cảm giác chiều sâu thật.
 * Toàn bộ là CSS transform — không thư viện 3D, không ảnh hưởng bundle size.
 */
export default function HeroScene() {
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef<number>(0)
  const [interactive, setInteractive] = useState(false)

  useEffect(() => {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setInteractive(finePointer && !reduced)
  }, [])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return
    const node = ref.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5

    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      node.style.setProperty('--scene-rx', `${-py * 14}deg`)
      node.style.setProperty('--scene-ry', `${px * 18}deg`)
    })
  }, [interactive])

  const onLeave = useCallback(() => {
    const node = ref.current
    if (!node) return
    cancelAnimationFrame(frame.current)
    node.style.setProperty('--scene-rx', '0deg')
    node.style.setProperty('--scene-ry', '0deg')
  }, [])

  return (
    <div
      ref={ref}
      className="hero-scene"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      aria-hidden="true"
    >
      <div className="hero-scene__stage">
        <div className="hero-scene__glow hero-scene__glow--a" />
        <div className="hero-scene__glow hero-scene__glow--b" />
        <div className="hero-scene__grid" />

        {/* Thẻ kết quả chính */}
        <div className="hero-scene__card" data-depth="0">
          <div className="hero-scene__scanline" />
          <div className="hero-scene__card-head">
            <span className="hero-scene__shield"><BrandMark size={22} /></span>
            <div>
              <div className="hero-scene__card-title">Copyright scan</div>
              <div className="hero-scene__card-sub">youtube.com/watch?v=…</div>
            </div>
            <span className="hero-scene__risk">92</span>
          </div>
          <div className="hero-scene__bars">
            <span style={{ width: '92%' }} />
            <span style={{ width: '74%' }} />
            <span style={{ width: '58%' }} />
          </div>
          <div className="hero-scene__tags">
            <span>Title match</span>
            <span>pHash 4</span>
            <span>Audio</span>
          </div>
        </div>

        {/* Chip nổi ở độ sâu khác */}
        <div className="hero-scene__chip hero-scene__chip--yt">▶ YouTube</div>
        <div className="hero-scene__chip hero-scene__chip--g">🔍 Google</div>
        <div className="hero-scene__chip hero-scene__chip--img">🖼️ pHash</div>
      </div>
    </div>
  )
}
