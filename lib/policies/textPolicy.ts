import { Platform } from '@/types'

export type PolicySeverity = 'low' | 'medium' | 'high'

export interface PolicySource {
  label: string
  url: string
  effectiveDate?: string
  summary: string
  excerpt: string
}

export interface PolicyFinding {
  ruleId: string
  platform: Platform
  category: string
  severity: PolicySeverity
  title: string
  detail: string
  matchedTerms: string[]
  source: PolicySource
}

export interface TextPolicyResult {
  score: number
  summary: string
  checkedAt: string
  findings: PolicyFinding[]
  sources: Record<Platform, PolicySource[]>
}

interface PolicyRule {
  id: string
  category: string
  severity: PolicySeverity
  title: string
  detail: string
  terms: string[]
}

export const platformPolicySources: Record<Platform, PolicySource[]> = {
  facebook: [
    {
      label: 'Meta Terms of Service',
      url: 'https://www.facebook.com/terms',
      effectiveDate: '2025-01-01',
      summary: 'Meta yeu cau nguoi dung chi chia se noi dung minh co quyen va khong xam pham copyright, trademark hoac quyen IP cua nguoi khac.',
      excerpt: 'you do not own or have the necessary rights to share'
    },
    {
      label: 'Facebook Intellectual Property Help Center',
      url: 'https://www.facebook.com/help/intellectual_property',
      summary: 'Facebook giai thich copyright bao ve cach the hien goc nhu loi van, hinh anh, am nhac, phim va tac pham nghe thuat.',
      excerpt: 'posting content that violates someone else’s intellectual property rights'
    }
  ],
  google: [
    {
      label: 'Google Terms of Service',
      url: 'https://policies.google.com/terms',
      summary: 'Google co the go noi dung vi pham dieu khoan, policy dich vu, luat ap dung, hoac gay hai cho nguoi dung/ben thu ba.',
      excerpt: 'violates applicable law, or could harm our users'
    }
  ],
  youtube: [
    {
      label: 'YouTube Terms of Service',
      url: 'https://www.youtube.com/t/terms',
      summary: 'YouTube gan Terms voi Community Guidelines va copyright policies; noi dung co the bi xu ly neu vi pham cac policy nay.',
      excerpt: 'subject to these terms, the YouTube Community Guidelines'
    },
    {
      label: 'Copyright on YouTube',
      url: 'https://support.google.com/youtube/answer/2797466',
      summary: 'YouTube canh bao viec dung noi dung cua nguoi khac khong dam bao tranh duoc copyright strike hoac Content ID claim.',
      excerpt: 'can’t guarantee that all the works linked to are free'
    },
    {
      label: 'YouTube Community Guidelines',
      url: 'https://support.google.com/youtube/answer/9288567',
      summary: 'YouTube Community Guidelines ap dung cho video, comment, links, posts, thumbnails va nhieu be mat noi dung khac.',
      excerpt: 'apply to all types of content on our platform'
    }
  ],
  tiktok: [
    {
      label: 'TikTok Intellectual Property Policy',
      url: 'https://www.tiktok.com/legal/copyright-policy?lang=en',
      effectiveDate: '2025-04-26',
      summary: 'TikTok khong cho phep noi dung xam pham copyright, trademark hoac IP cua nguoi khac, tru khi co quyen hoac ly do hop le.',
      excerpt: 'We do not allow any content that infringes copyright'
    },
    {
      label: 'TikTok Terms of Service',
      url: 'https://www.tiktok.com/legal/page/global/terms-of-service/en',
      summary: 'TikTok Terms cam tai len, truyen, luu tru hoac chia se noi dung co the xam pham copyright, trademark, privacy hoac quyen khac.',
      excerpt: 'may infringe any copyright, trade mark or other intellectual property'
    }
  ]
}

const sharedRules: PolicyRule[] = [
  {
    id: 'copyright-unauthorized-use',
    category: 'copyright',
    severity: 'high',
    title: 'Co dau hieu dung noi dung co ban quyen khi chua co quyen',
    detail: 'Cac nen tang thuong cam noi dung khong co quyen su dung, sao chep, tai lai, hoac phan phoi tac pham cua ben khac.',
    terms: [
      'copy lai',
      'sao chep',
      'reup',
      're-upload',
      'tai lai',
      'full movie',
      'full phim',
      'download phim',
      'download music',
      'nhac ban quyen',
      'khong can xin phep',
      'without permission',
      'copyrighted',
      'crack ebook',
      'pdf sach'
    ]
  },
  {
    id: 'trademark-counterfeit',
    category: 'trademark',
    severity: 'high',
    title: 'Co dau hieu gia mao thuong hieu hoac hang gia',
    detail: 'Cac nen tang co the han che noi dung lam nguoi xem nham lan ve nguon goc hang hoa, dich vu hoac quyen so huu thuong hieu.',
    terms: [
      'fake official',
      'official fake',
      'hang fake',
      'replica',
      'super fake',
      'gia mao',
      'nhai thuong hieu',
      'logo giong',
      'counterfeit'
    ]
  },
  {
    id: 'impersonation-deception',
    category: 'deception',
    severity: 'medium',
    title: 'Co dau hieu mao danh hoac gay nham lan',
    detail: 'Noi dung mao danh nguoi, kenh, doanh nghiep, hoac gay nham lan ve quan he chinh thuc co the vi pham policy.',
    terms: [
      'mao danh',
      'gia danh',
      'kenh chinh thuc fake',
      'official account',
      'verified fake',
      'impersonate',
      'impersonation'
    ]
  },
  {
    id: 'spam-scam',
    category: 'spam_scam',
    severity: 'medium',
    title: 'Co dau hieu spam, lua dao hoac tuyen bo qua muc',
    detail: 'Cac nen tang han che spam, lua dao, lien ket doc hai, va noi dung gay hieu nham.',
    terms: [
      'cam ket 100%',
      'kiem tien nhanh',
      'nhan qua mien phi',
      'click link ngay',
      'free gift',
      'airdrop chac chan',
      'scam',
      'phishing',
      'malware'
    ]
  },
  {
    id: 'privacy-sensitive-data',
    category: 'privacy',
    severity: 'high',
    title: 'Co the chua thong tin ca nhan nhay cam',
    detail: 'Nen tranh dang so dien thoai, email, CCCD/ID, dia chi, token, hoac thong tin rieng tu cua nguoi khac.',
    terms: [
      'cccd',
      'cmnd',
      'passport',
      'credit card',
      'so the',
      'mat khau',
      'password',
      'access token',
      'private key'
    ]
  },
  {
    id: 'regulated-dangerous-content',
    category: 'safety',
    severity: 'medium',
    title: 'Co dau hieu noi dung nguy hiem hoac bi quan ly',
    detail: 'Noi dung huong dan hanh vi nguy hiem, ban hang bi quan ly, tu hai, hoac bao luc co the bi xu ly rieng theo tung nen tang.',
    terms: [
      'huong dan hack',
      'hack tai khoan',
      'tu che vu khi',
      'thuoc cam',
      'ban sung',
      'tu tu',
      'self harm',
      'dangerous challenge'
    ]
  }
]

const platformAdjustments: Partial<Record<Platform, PolicyRule[]>> = {
  youtube: [
    {
      id: 'youtube-external-link-risk',
      category: 'external_links',
      severity: 'medium',
      title: 'Link ngoai co the can kiem tra them voi YouTube',
      detail: 'Mo ta video, comment, live chat va link deu co the bi ap dung Community Guidelines.',
      terms: ['link rut gon', 'bit.ly', 'tinyurl', 'telegram nhan file', 'download mien phi']
    }
  ],
  tiktok: [
    {
      id: 'tiktok-music-ip-risk',
      category: 'music_ip',
      severity: 'high',
      title: 'Co dau hieu rui ro IP ve nhac tren TikTok',
      detail: 'TikTok IP Policy bao gom copyright, trademark va quyen lien quan den nhac/video.',
      terms: ['nhac trend ban quyen', 'lay nhac goc', 'original sound reup', 'full song']
    }
  ]
}

const severityScore: Record<PolicySeverity, number> = {
  low: 10,
  medium: 22,
  high: 35
}

export function checkTextAgainstPlatformPolicies(text: string, platforms: Platform[]): TextPolicyResult {
  const normalized = normalize(text)
  const selectedPlatforms = platforms.length > 0 ? platforms : (['facebook', 'google', 'youtube', 'tiktok'] as Platform[])
  const findings: PolicyFinding[] = []

  for (const platform of selectedPlatforms) {
    const rules = [...sharedRules, ...(platformAdjustments[platform] || [])]
    const source = platformPolicySources[platform][0]

    for (const rule of rules) {
      const matchedTerms = rule.terms.filter(term => normalized.includes(normalize(term)))
      const piiMatches = rule.id === 'privacy-sensitive-data' ? detectSensitivePatterns(text) : []
      const allMatches = [...new Set([...matchedTerms, ...piiMatches])]

      if (allMatches.length === 0) {
        continue
      }

      findings.push({
        ruleId: rule.id,
        platform,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        detail: rule.detail,
        matchedTerms: allMatches,
        source
      })
    }
  }

  const score = Math.min(100, findings.reduce((sum, finding) => sum + severityScore[finding.severity], 0))

  return {
    score,
    summary: summarize(score, findings.length),
    checkedAt: new Date().toISOString(),
    findings,
    sources: platformPolicySources
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function detectSensitivePatterns(text: string): string[] {
  const matches: string[] = []
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) matches.push('email')
  if (/(?:\+?84|0)(?:\d[\s.-]?){8,10}\d/.test(text)) matches.push('phone')
  if (/\b\d{12}\b/.test(text)) matches.push('12_digit_id')
  if (/\b(?:\d[ -]*?){13,19}\b/.test(text)) matches.push('payment_card_like_number')
  return matches
}

function summarize(score: number, findingCount: number): string {
  if (findingCount === 0) return 'Chua thay dau hieu rui ro ro rang theo bo rule hien tai.'
  if (score >= 70) return 'Rui ro cao. Nen sua noi dung hoac kiem tra quyen su dung truoc khi dang.'
  if (score >= 35) return 'Rui ro trung binh. Nen review cac canh bao va bo sung giay phep/nguon.'
  return 'Rui ro thap, nhung van nen kiem tra nguon va quyen su dung.'
}
