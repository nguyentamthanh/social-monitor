'use client'

import { useTranslation } from '@/lib/i18n/context'
import { useEffect, useRef, useState } from 'react'
import { MessageKey } from '@/lib/i18n/messages'
import Reveal from './Reveal'
import TiltCard from './TiltCard'
import HeroScene from './HeroScene'
import ThemeToggle from '@/components/ui/ThemeToggle'
import BrandMark from '@/components/ui/BrandMark'

interface LandingPageProps {
  isAuthenticated: boolean
}

interface Feature {
  icon: string
  titleKey: MessageKey
  descKey: MessageKey
}

interface Step {
  num: number
  titleKey: MessageKey
  descKey: MessageKey
}

interface PricingTier {
  id: 'free' | 'pro' | 'business' | 'enterprise'
  featured?: boolean
  priceUnit?: 'monthly' | 'none'
  ctaHref: string
  ctaKey: MessageKey
  featureKeys: MessageKey[]
}

const FEATURES: Feature[] = [
  { icon: '🛡️', titleKey: 'landing.feature.assets.title', descKey: 'landing.feature.assets.desc' },
  { icon: '🔍', titleKey: 'landing.feature.batchScan.title', descKey: 'landing.feature.batchScan.desc' },
  { icon: '🔗', titleKey: 'landing.feature.urlCheck.title', descKey: 'landing.feature.urlCheck.desc' },
  { icon: '⚡', titleKey: 'landing.feature.scoring.title', descKey: 'landing.feature.scoring.desc' },
  { icon: '🖼️', titleKey: 'landing.feature.phash.title', descKey: 'landing.feature.phash.desc' },
  { icon: '🌐', titleKey: 'landing.feature.multiPlatform.title', descKey: 'landing.feature.multiPlatform.desc' }
]

const STEPS: Step[] = [
  { num: 1, titleKey: 'landing.how.step1.title', descKey: 'landing.how.step1.desc' },
  { num: 2, titleKey: 'landing.how.step2.title', descKey: 'landing.how.step2.desc' },
  { num: 3, titleKey: 'landing.how.step3.title', descKey: 'landing.how.step3.desc' }
]

const TIERS: PricingTier[] = [
  {
    id: 'free',
    priceUnit: 'monthly',
    ctaHref: '/register',
    ctaKey: 'landing.pricing.cta',
    featureKeys: [
      'landing.tier.free.feat1',
      'landing.tier.free.feat2',
      'landing.tier.free.feat3',
      'landing.tier.free.feat4',
      'landing.tier.free.feat5',
      'landing.tier.free.feat6'
    ]
  },
  {
    id: 'pro',
    featured: true,
    priceUnit: 'monthly',
    ctaHref: '/register?plan=pro',
    ctaKey: 'landing.pricing.cta',
    featureKeys: [
      'landing.tier.pro.feat1',
      'landing.tier.pro.feat2',
      'landing.tier.pro.feat3',
      'landing.tier.pro.feat4',
      'landing.tier.pro.feat5',
      'landing.tier.pro.feat6'
    ]
  },
  {
    id: 'business',
    priceUnit: 'monthly',
    ctaHref: '/register?plan=business',
    ctaKey: 'landing.pricing.cta',
    featureKeys: [
      'landing.tier.business.feat1',
      'landing.tier.business.feat2',
      'landing.tier.business.feat3',
      'landing.tier.business.feat4',
      'landing.tier.business.feat5',
      'landing.tier.business.feat6'
    ]
  },
  {
    id: 'enterprise',
    priceUnit: 'none',
    ctaHref: 'mailto:sales@copyright-monitor.local',
    ctaKey: 'landing.pricing.ctaEnterprise',
    featureKeys: [
      'landing.tier.enterprise.feat1',
      'landing.tier.enterprise.feat2',
      'landing.tier.enterprise.feat3',
      'landing.tier.enterprise.feat4',
      'landing.tier.enterprise.feat5',
      'landing.tier.enterprise.feat6'
    ]
  }
]

const NAV_SECTIONS: Array<{ id: string; labelKey: MessageKey }> = [
  { id: 'features', labelKey: 'landing.nav.features' },
  { id: 'pricing', labelKey: 'landing.nav.pricing' },
  { id: 'faq', labelKey: 'landing.nav.faq' }
]

const FAQ_ITEMS: Array<{ qKey: MessageKey; aKey: MessageKey }> = [
  { qKey: 'landing.faq.q1', aKey: 'landing.faq.a1' },
  { qKey: 'landing.faq.q2', aKey: 'landing.faq.a2' },
  { qKey: 'landing.faq.q3', aKey: 'landing.faq.a3' },
  { qKey: 'landing.faq.q4', aKey: 'landing.faq.a4' },
  { qKey: 'landing.faq.q5', aKey: 'landing.faq.a5' }
]

export default function LandingPage({ isAuthenticated }: LandingPageProps) {
  const { t, locale, setLocale } = useTranslation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  // Scrollspy: làm nổi mục đang xem trên nav. Vùng quan sát thu về dải giữa màn
  // hình để chỉ có đúng một section "thắng" tại mỗi thời điểm.
  useEffect(() => {
    const nodes = NAV_SECTIONS.map(s => document.getElementById(s.id)).filter(
      (node): node is HTMLElement => !!node
    )
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) setActiveSection(visible[0].target.id)
      },
      { rootMargin: '-45% 0px -50% 0px' }
    )
    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  // Thanh tiến trình đọc + trạng thái "đã cuộn" cho nav.
  // Ghi thẳng vào style qua ref để không re-render component mỗi frame cuộn.
  useEffect(() => {
    let ticking = false
    const update = () => {
      ticking = false
      const max = document.documentElement.scrollHeight - window.innerHeight
      const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${ratio})`
      }
      setScrolled(window.scrollY > 12)
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="landing-root">
      <nav className={`landing-nav${scrolled ? ' is-scrolled' : ''}`}>
        <div ref={progressRef} className="landing-progress" />
        <div className="landing-nav__inner">
          <a href="/" className="landing-nav__brand">
            <span className="landing-nav__brand-mark"><BrandMark size={18} /></span>
            {t('app.name')}
          </a>

          {/* Dùng class CSS thật thay vì utility màu của Tailwind: reset của AntD
              không nằm trong @layer nên luôn thắng utility, khiến link bị xanh mặc định */}
          <div className="landing-nav__links">
            {NAV_SECTIONS.map(section => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={activeSection === section.id ? 'is-active' : ''}
                onClick={() => setMobileNavOpen(false)}
              >
                {t(section.labelKey)}
              </a>
            ))}
          </div>

          <div className="landing-nav__actions">
            <ThemeToggle />
            <div className="landing-locale" role="group" aria-label="Language">
              <button className={locale === 'vi' ? 'is-active' : ''} onClick={() => setLocale('vi')}>VI</button>
              <button className={locale === 'en' ? 'is-active' : ''} onClick={() => setLocale('en')}>EN</button>
            </div>
            {isAuthenticated ? (
              <a href="/dashboard" className="landing-btn landing-btn--primary">
                {t('landing.nav.dashboard')} →
              </a>
            ) : (
              <>
                <a href="/login" className="landing-btn">{t('landing.nav.signIn')}</a>
                <a href="/register" className="landing-btn landing-btn--primary">
                  {t('landing.nav.getStarted')}
                </a>
              </>
            )}
            <button
              className="hidden max-lg:flex items-center justify-center w-[38px] h-[38px] rounded-lg border border-[var(--border-strong)] bg-transparent text-[var(--text-primary)] text-xl cursor-pointer hover:border-[var(--accent-violet)] hover:bg-[var(--bg-hover)] transition-all"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              aria-label="Toggle menu"
            >
              {mobileNavOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        <div className={`${mobileNavOpen ? 'flex' : 'hidden'} lg:hidden flex-col absolute top-full left-0 right-0 bg-[var(--bg-card)] border-b border-[var(--border-subtle)] px-6 pb-5 pt-3 gap-3 backdrop-blur-xl z-[99] animate-[fadeUp_0.2s_ease-out]`}>
          {NAV_SECTIONS.map(section => (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={() => setMobileNavOpen(false)}
              className="landing-nav__mobile-link"
            >
              {t(section.labelKey)}
            </a>
          ))}
          <hr className="border-0 border-t border-[var(--border-subtle)] my-2" />
          {/* Ở ≤640px thanh nav không đủ chỗ cho VI/EN nên nó sống ở đây */}
          <div className="landing-locale landing-locale--menu self-start" role="group" aria-label="Language">
            <button className={locale === 'vi' ? 'is-active' : ''} onClick={() => setLocale('vi')}>VI</button>
            <button className={locale === 'en' ? 'is-active' : ''} onClick={() => setLocale('en')}>EN</button>
          </div>
          {isAuthenticated ? (
            <a href="/dashboard" className="landing-btn landing-btn--primary flex text-center justify-center">
              {t('landing.nav.dashboard')} →
            </a>
          ) : (
            <div className="flex flex-col gap-2.5">
              <a href="/login" className="landing-btn flex text-center justify-center">
                {t('landing.nav.signIn')}
              </a>
              <a href="/register" className="landing-btn landing-btn--primary flex text-center justify-center">
                {t('landing.nav.getStarted')}
              </a>
            </div>
          )}
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-aurora" aria-hidden="true">
          <span className="landing-aurora__blob landing-aurora__blob--1" />
          <span className="landing-aurora__blob landing-aurora__blob--2" />
          <span className="landing-aurora__blob landing-aurora__blob--3" />
        </div>

        <Reveal variant="scale">
          <span className="landing-hero__badge">⚡ {t('landing.hero.badge')}</span>
        </Reveal>
        <Reveal delay={80}>
          <h1>
            {t('landing.hero.title').split(' ').slice(0, -3).join(' ')}{' '}
            <span className="gradient-text">
              {t('landing.hero.title').split(' ').slice(-3).join(' ')}
            </span>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="landing-hero__sub">{t('landing.hero.subtitle')}</p>
        </Reveal>
        <Reveal delay={240}>
          <div className="landing-hero__cta">
            <a
              href={isAuthenticated ? '/dashboard' : '/register'}
              className="landing-btn landing-btn--primary landing-btn--lg"
            >
              {t('landing.hero.ctaPrimary')} →
            </a>
            <a href="#features" className="landing-btn landing-btn--lg">
              {t('landing.hero.ctaSecondary')}
            </a>
          </div>
        </Reveal>
        <Reveal delay={320} variant="scale">
          <HeroScene />
        </Reveal>
      </section>

      <section id="features" className="landing-section">
        <Reveal>
          <h2>{t('landing.features.title')}</h2>
          <p className="landing-section__sub">{t('landing.features.sub')}</p>
        </Reveal>
        <div className="landing-feature-grid">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.titleKey} delay={i * 70}>
              <TiltCard className="landing-card">
                <div className="landing-card__icon">{feature.icon}</div>
                <h3>{t(feature.titleKey)}</h3>
                <p>{t(feature.descKey)}</p>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <Reveal>
          <h2>{t('landing.how.title')}</h2>
        </Reveal>
        <div className="landing-steps">
          {STEPS.map((step, i) => (
            <Reveal key={step.num} variant={i === 0 ? 'left' : i === 2 ? 'right' : 'up'} delay={i * 90}>
              <div className="landing-step">
                <div className="landing-step__num">{step.num}</div>
                <h3>{t(step.titleKey)}</h3>
                <p>{t(step.descKey)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="pricing" className="landing-section">
        <Reveal>
          <h2>{t('landing.pricing.title')}</h2>
          <p className="landing-section__sub">{t('landing.pricing.sub')}</p>
        </Reveal>
        <div className="pricing-grid">
          {TIERS.map((tier, i) => (
            <Reveal key={tier.id} delay={i * 70} className="pricing-cell">
              <TiltCard
                max={6}
                className={`pricing-card ${tier.featured ? 'pricing-card--featured' : ''}`}
              >
              {tier.featured && (
                <span className="pricing-card__badge">{t('landing.pricing.featured')}</span>
              )}
              <div className="pricing-card__name">{t(`landing.tier.${tier.id}.name` as MessageKey)}</div>
              <div className="pricing-card__tagline">{t(`landing.tier.${tier.id}.tagline` as MessageKey)}</div>
              <div className="pricing-card__price">
                <span className="pricing-card__price-value">
                  {t(`landing.tier.${tier.id}.price` as MessageKey)}
                </span>
                {tier.priceUnit === 'monthly' && (
                  <span className="pricing-card__price-unit">{t('landing.pricing.monthly')}</span>
                )}
              </div>
              <ul className="pricing-card__features">
                {tier.featureKeys.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
              <a href={tier.ctaHref} className="pricing-card__cta">
                {t(tier.ctaKey)}
              </a>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="faq" className="landing-section">
        <Reveal>
          <h2>{t('landing.faq.title')}</h2>
        </Reveal>
        <div className="landing-faq">
          {FAQ_ITEMS.map((item, i) => (
            <Reveal key={i} delay={i * 60}>
              <details className="landing-faq__item">
                <summary>{t(item.qKey)}</summary>
                <div className="landing-faq__answer">{t(item.aKey)}</div>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <span>{t('landing.footer.copy')}</span>
          <div>
            <a href="#">{t('landing.footer.terms')}</a>
            <a href="#">{t('landing.footer.privacy')}</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
