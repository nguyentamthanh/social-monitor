type BrandMarkProps = {
  size?: number
  className?: string
}

/**
 * Icon thương hiệu: khiên bo tròn với dấu tick được "khoét" ra dạng negative
 * space (giống 1Password/Stripe) thay vì vẽ đè icon lên nền — nhờ vậy nền
 * gradient của badge cha xuyên qua đúng hình dấu tick, cho cảm giác tinh xảo
 * hơn nhiều so với icon tô đặc màu trùng với nền.
 * Component chỉ vẽ glyph (trắng), phần nền gradient + glow do CSS của khối
 * cha (.landing-nav__brand-mark / .hero-scene__shield) đảm nhiệm.
 */
export default function BrandMark({ size = 20, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="brandMarkSheen" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1f0ff" />
        </linearGradient>
        <mask id="brandMarkCheckCut" maskUnits="userSpaceOnUse">
          <path
            d="M12 2.15c.17 0 .35.03.51.09l5.9 2.1c.66.24 1.09.86 1.09 1.56v5.52c0 5.06-3.23 9.53-8 11.08-4.77-1.55-8-6.02-8-11.08V5.9c0-.7.43-1.32 1.09-1.56l5.9-2.1c.16-.06.34-.09.51-.09Z"
            fill="#ffffff"
          />
          <path
            d="M8.4 12.35l2.55 2.55 4.9-5.1"
            stroke="#000000"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <path
        d="M12 2.15c.17 0 .35.03.51.09l5.9 2.1c.66.24 1.09.86 1.09 1.56v5.52c0 5.06-3.23 9.53-8 11.08-4.77-1.55-8-6.02-8-11.08V5.9c0-.7.43-1.32 1.09-1.56l5.9-2.1c.16-.06.34-.09.51-.09Z"
        fill="url(#brandMarkSheen)"
        mask="url(#brandMarkCheckCut)"
      />
      <path
        d="M12 2.15c.17 0 .35.03.51.09l5.9 2.1c.66.24 1.09.86 1.09 1.56v5.52c0 5.06-3.23 9.53-8 11.08-4.77-1.55-8-6.02-8-11.08V5.9c0-.7.43-1.32 1.09-1.56l5.9-2.1c.16-.06.34-.09.51-.09Z"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="0.6"
        fill="none"
      />
    </svg>
  )
}
