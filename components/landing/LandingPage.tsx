'use client'

import { useTranslation } from '@/lib/i18n/context'
import { MessageKey } from '@/lib/i18n/messages'

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

const FAQ_ITEMS: Array<{ qKey: MessageKey; aKey: MessageKey }> = [
  { qKey: 'landing.faq.q1', aKey: 'landing.faq.a1' },
  { qKey: 'landing.faq.q2', aKey: 'landing.faq.a2' },
  { qKey: 'landing.faq.q3', aKey: 'landing.faq.a3' },
  { qKey: 'landing.faq.q4', aKey: 'landing.faq.a4' },
  { qKey: 'landing.faq.q5', aKey: 'landing.faq.a5' }
]

export default function LandingPage({ isAuthenticated }: LandingPageProps) {
  const { t, locale, setLocale } = useTranslation()

  return (
    <div className="landing-root">
      <nav className="landing-nav">
        <div className="landing-nav__inner">
          <a href="/" className="landing-nav__brand">
            <span className="landing-nav__brand-mark">🛡️</span>
            {t('app.name')}
          </a>

          <div className="landing-nav__links">
            <a href="#features">{t('landing.nav.features')}</a>
            <a href="#pricing">{t('landing.nav.pricing')}</a>
            <a href="#faq">{t('landing.nav.faq')}</a>
          </div>

          <div className="landing-nav__actions">
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
          </div>
        </div>
      </nav>

      <section className="landing-hero">
        <span className="landing-hero__badge">⚡ {t('landing.hero.badge')}</span>
        <h1>
          {t('landing.hero.title').split(' ').slice(0, -3).join(' ')}{' '}
          <span className="gradient-text">
            {t('landing.hero.title').split(' ').slice(-3).join(' ')}
          </span>
        </h1>
        <p className="landing-hero__sub">{t('landing.hero.subtitle')}</p>
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
      </section>

      <section id="features" className="landing-section">
        <h2>{t('landing.features.title')}</h2>
        <p className="landing-section__sub">{t('landing.features.sub')}</p>
        <div className="landing-feature-grid">
          {FEATURES.map((feature) => (
            <div key={feature.titleKey} className="landing-card">
              <div className="landing-card__icon">{feature.icon}</div>
              <h3>{t(feature.titleKey)}</h3>
              <p>{t(feature.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2>{t('landing.how.title')}</h2>
        <div className="landing-steps">
          {STEPS.map((step) => (
            <div key={step.num} className="landing-step">
              <div className="landing-step__num">{step.num}</div>
              <h3>{t(step.titleKey)}</h3>
              <p>{t(step.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="landing-section">
        <h2>{t('landing.pricing.title')}</h2>
        <p className="landing-section__sub">{t('landing.pricing.sub')}</p>
        <div className="pricing-grid">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
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
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="landing-section">
        <h2>{t('landing.faq.title')}</h2>
        <div className="landing-faq">
          {FAQ_ITEMS.map((item, i) => (
            <details key={i} className="landing-faq__item">
              <summary>{t(item.qKey)}</summary>
              <div className="landing-faq__answer">{t(item.aKey)}</div>
            </details>
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
