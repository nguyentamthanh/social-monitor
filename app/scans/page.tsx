'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Layout,
  Table,
  Tag,
  Button,
  Spin,
  Empty,
  Form,
  Input,
  Select,
  Checkbox,
  Segmented,
  Row,
  Col,
  message,
  Collapse,
  Tooltip,
  Progress,
  Skeleton,
  Space,
  Statistic
} from 'antd'
import type { InputRef } from 'antd'
import {
  ThunderboltOutlined,
  ReloadOutlined,
  YoutubeFilled,
  GoogleSquareFilled,
  FacebookFilled,
  TikTokFilled,
  FileProtectOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  BulbOutlined,
  RedoOutlined,
  SettingOutlined,
  ClockCircleOutlined,
  HistoryOutlined
} from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import PlatformBadge from '@/components/ui/PlatformBadge'
import RiskPill from '@/components/ui/RiskPill'
import UploadDropzone from '@/components/ui/UploadDropzone'
import { ConnectorStatus, Platform, ScanRun, BrandAsset } from '@/types'
import { useTranslation } from '@/lib/i18n/context'
import { detectScanInput, type DetectedInput } from '@/lib/scans/detectScanInput'

const { Content } = Layout

const statusColors: Record<string, string> = {
  running: 'processing',
  completed: 'success',
  failed: 'error',
  queued: 'default'
}

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  youtube: <YoutubeFilled style={{ color: '#ef4444' }} />,
  google: <GoogleSquareFilled style={{ color: '#4285f4' }} />,
  facebook: <FacebookFilled style={{ color: '#1877f2' }} />,
  tiktok: <TikTokFilled />
}

const PLATFORM_LIST: Platform[] = ['youtube', 'google', 'facebook', 'tiktok']

/**
 * Nền tảng đã chạy thật. Ba nền tảng còn lại hiện là "sắp có" chứ không phải
 * "thiếu API key", vì kể cả cắm key chúng vẫn chưa dùng được:
 *  - google   : Google CSE chưa được đo quota (quá 100 truy vấn/ngày là tính
 *               tiền thật), phải làm phần đo trước khi mở.
 *  - facebook : không phải Graph API mà là Google CSE tìm site:facebook.com;
 *               Meta không còn cho tìm nội dung công khai nên hiệu quả rất thấp.
 *  - tiktok   : Research API phải đăng ký và được duyệt, không phải cắm key là xong.
 * Khi nào một nền tảng sẵn sàng thì chỉ cần thêm vào đây.
 */
const ENABLED_PLATFORMS = new Set<Platform>(['youtube'])
const COMING_SOON_LABEL = 'Sắp có — chưa mở trong bản này'
const LS_PLATFORMS = 'scan.platforms'
const LS_YT_MODE = 'scan.youtubeMode'

type YouTubeMode = 'fast' | 'deep'

/** Mẫu bấm-1-lần để người dùng mới biết ô nhập chấp nhận cái gì. */
const EXAMPLES: Array<{ icon: string; label: string; value: string }> = [
  { icon: '🎬', label: 'Link YouTube', value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { icon: '🌐', label: 'Tên miền', value: 'nike.com' },
  { icon: '🔤', label: 'Từ khóa', value: 'Just Do It' }
]

/** Suy ra loại tài sản từ MIME type của tệp kéo-thả / dán vào. */
function assetTypeFromFile(file: File): 'image' | 'video' | 'audio' | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return null
}

/**
 * useSearchParams bắt buộc phải nằm trong Suspense boundary ở App Router,
 * nếu không `next build` sẽ báo lỗi prerender.
 */
export default function ScansPage() {
  return (
    <Suspense fallback={null}>
      <ScansPageInner />
    </Suspense>
  )
}

function ScansPageInner() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()

  const [scans, setScans] = useState<ScanRun[]>([])
  const [connectorStatus, setConnectorStatus] = useState<ConnectorStatus[]>([])
  const [loadingScans, setLoadingScans] = useState(true)

  // Cho phép mở sẵn với link: /scans?url=... (ô quick-check ở Dashboard dùng
  // đường này). Trước đây /url-check nhận param nhưng không hề đọc nên link
  // người dùng gõ bị nuốt mất.
  const [query, setQuery] = useState(() => searchParams.get('url') || '')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['youtube'])
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<{ status: 'idle' | 'running' | 'completed' | 'failed'; findings: number }>({ status: 'idle', findings: 0 })
  const [quickFindings, setQuickFindings] = useState<any[]>([])
  const [quickScanMeta, setQuickScanMeta] = useState<any>(null)
  const [rescanningId, setRescanningId] = useState<number | null>(null)
  const [youtubeMode, setYoutubeMode] = useState<YouTubeMode>('fast')
  const [dragging, setDragging] = useState(false)
  const [quota, setQuota] = useState<{ used: number; budget: number; remaining: number; exceeded: boolean; nearLimit: boolean } | null>(null)

  // Advanced section state
  const [assets, setAssets] = useState<BrandAsset[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [selectedAssets, setSelectedAssets] = useState<number[]>([])
  const [advancedForm] = Form.useForm()
  const [advancedFile, setAdvancedFile] = useState<File | null>(null)
  const watchType = Form.useWatch('assetType', advancedForm)

  const inputRef = useRef<InputRef>(null)

  const load = useCallback(async () => {
    setLoadingScans(true)
    try {
      const res = await fetch('/api/scans')
      if (res.ok) {
        const data = await res.json()
        setScans(data.scans || [])
        setConnectorStatus(data.connectorStatus || [])
        setQuota(data.quota || null)
      }
    } finally {
      setLoadingScans(false)
    }
  }, [])

  const loadAssets = useCallback(async () => {
    setLoadingAssets(true)
    try {
      const res = await fetch('/api/assets')
      if (res.ok) setAssets(await res.json())
    } finally {
      setLoadingAssets(false)
    }
  }, [])

  // Auth gate + first load
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    else if (status === 'authenticated') {
      load()
      loadAssets()
    }
  }, [status, router, load, loadAssets])

  // Restore platform preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_PLATFORMS)
      if (saved) {
        const arr = JSON.parse(saved) as Platform[]
        // Lọc thêm theo ENABLED_PLATFORMS: lựa chọn cũ trong localStorage có
        // thể còn chứa nền tảng nay đã tạm khoá.
        const usable = Array.isArray(arr) ? arr.filter(p => ENABLED_PLATFORMS.has(p)) : []
        if (usable.length) setSelectedPlatforms(usable)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LS_PLATFORMS, JSON.stringify(selectedPlatforms))
    } catch {}
  }, [selectedPlatforms])

  // Restore YouTube scan mode preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_YT_MODE)
      if (saved === 'fast' || saved === 'deep') setYoutubeMode(saved)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LS_YT_MODE, youtubeMode)
    } catch {}
  }, [youtubeMode])

  // Drop platforms that aren't ready (e.g. saved selection includes a connector
  // whose API key was removed) so the user doesn't accidentally scan with 0 active platforms
  useEffect(() => {
    if (connectorStatus.length === 0) return
    const readySet = new Set(
      connectorStatus
        .filter(c => c.capability === 'ready' && ENABLED_PLATFORMS.has(c.platform))
        .map(c => c.platform)
    )
    const filtered = selectedPlatforms.filter(p => readySet.has(p))
    if (filtered.length === 0 && readySet.size > 0) {
      setSelectedPlatforms(Array.from(readySet) as Platform[])
    } else if (filtered.length !== selectedPlatforms.length) {
      setSelectedPlatforms(filtered)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectorStatus])

  // Auto-focus + Ctrl/Cmd+K shortcut
  useEffect(() => {
    if (status === 'authenticated') {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status])

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  const runQuickScan = async (payload: DetectedInput | null, file?: File | null, extra?: Record<string, string>) => {
    if (selectedPlatforms.length === 0) {
      message.warning('Hãy chọn ít nhất 1 nền tảng')
      return
    }
    if (!payload && !file) {
      message.warning('Hãy nhập từ khóa, dán link, hoặc tải lên tệp để quét')
      return
    }
    setScanning(true)
    setScanProgress({ status: 'running', findings: 0 })
    setQuickFindings([])
    setQuickScanMeta(null)
    try {
      const fd = new FormData()
      if (payload) {
        if (payload.name) fd.append('name', payload.name)
        fd.append('assetType', payload.assetType)
        if (payload.youtubeUrl) fd.append('youtubeUrl', payload.youtubeUrl)
        if (payload.officialDomains) fd.append('officialDomains', payload.officialDomains)
        if (payload.keywords) fd.append('keywords', payload.keywords)
      }
      if (extra) for (const [k, v] of Object.entries(extra)) if (v) fd.append(k, v)
      if (file) fd.append('file', file)
      fd.append('platforms', selectedPlatforms.join(','))
      if (payload?.youtubeUrl) fd.append('mode', youtubeMode)

      const res = await fetch('/api/scans/quick', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Quick scan failed')
      setQuickFindings(data.findings || [])
      setQuickScanMeta(data)
      setScanProgress({ status: 'completed', findings: data.findingsCreated || 0 })
      message.success(`Hoàn tất: ${data.findingsCreated || 0} kết quả nghi vấn`)
    } catch (err: any) {
      message.error(err?.message || 'Quét thất bại')
      setScanProgress({ status: 'failed', findings: 0 })
    } finally {
      setScanning(false)
    }
  }

  const onHeroScan = () => {
    const detected = detectScanInput(query)
    runQuickScan(detected)
  }

  /** Kéo-thả hoặc dán tệp thẳng vào scan deck → quét luôn, không cần mở Nâng cao. */
  const scanFile = useCallback((file: File) => {
    const assetType = assetTypeFromFile(file)
    if (!assetType) {
      message.warning('Chỉ hỗ trợ tệp ảnh, video hoặc âm thanh')
      return
    }
    const base = file.name.replace(/\.[^.]+$/, '').trim() || file.name
    setQuery(base)
    runQuickScan({ assetType, name: base, keywords: base }, file)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlatforms, youtubeMode])

  const onDeckDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) scanFile(file)
  }

  const onDeckPaste = (e: React.ClipboardEvent) => {
    const file = e.clipboardData.files?.[0]
    if (file) {
      e.preventDefault()
      scanFile(file)
    }
  }

  const onAdvancedQuickScan = async () => {
    try {
      const values = await advancedForm.validateFields()
      const payload: DetectedInput = {
        assetType: values.assetType,
        name: values.name || query || 'Quick scan',
        youtubeUrl: values.youtubeUrl,
        officialDomains: values.officialDomains,
        keywords: values.keywords
      }
      const extra: Record<string, string> = {}
      if (values.textContent) extra.textContent = values.textContent
      if (values.audioTitle) extra.audioTitle = values.audioTitle
      if (values.audioArtist) extra.audioArtist = values.audioArtist
      runQuickScan(payload, advancedFile, extra)
    } catch {
      message.error('Vui lòng nhập đủ thông tin bắt buộc')
    }
  }

  const onScanSavedAssets = async () => {
    if (selectedAssets.length === 0) {
      message.warning('Hãy chọn ít nhất 1 tài sản')
      return
    }
    if (selectedPlatforms.length === 0) {
      message.warning('Hãy chọn ít nhất 1 nền tảng')
      return
    }
    setScanning(true)
    setScanProgress({ status: 'running', findings: 0 })
    setQuickFindings([])
    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds: selectedAssets, platforms: selectedPlatforms })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Scan failed')
      setScanProgress({ status: data.scanRun?.status || 'completed', findings: data.findingsCreated || 0 })
      message.success(`Hoàn tất: ${data.findingsCreated || 0} findings được lưu`)
      load()
    } catch (err: any) {
      message.error(err?.message || 'Quét thất bại')
      setScanProgress({ status: 'failed', findings: 0 })
    } finally {
      setScanning(false)
    }
  }

  const rescanRow = async (row: ScanRun) => {
    const assetIds = (row.asset_ids || []).map(Number).filter(Number.isFinite)
    const platforms = (row.platform_status || []).map(p => p.platform)
    if (assetIds.length === 0 || platforms.length === 0) {
      message.warning('Không đủ dữ liệu để quét lại')
      return
    }
    setRescanningId(row.id)
    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds, platforms })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Rescan failed')
      message.success(`Quét lại xong: ${data.findingsCreated || 0} findings`)
      load()
    } catch (err: any) {
      message.error(err?.message || 'Quét lại thất bại')
    } finally {
      setRescanningId(null)
    }
  }

  const historyStats = useMemo(() => {
    const total = scans.length
    const completed = scans.filter(s => s.status === 'completed').length
    const failed = scans.filter(s => s.status === 'failed').length
    const running = scans.filter(s => s.status === 'running' || s.status === 'queued').length
    const findings = scans.reduce((acc, s) => acc + (s.findings_count || 0), 0)
    return { total, completed, failed, running, findings }
  }, [scans])

  const columns = useMemo(() => ([
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70, render: (v: number) => <span style={{ color: 'var(--text-secondary)' }}>#{v}</span> },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 110,
      render: (v: string) => <Tag color={statusColors[v] || 'default'}>{v}</Tag>
    },
    {
      title: 'Tài sản', dataIndex: 'asset_ids', key: 'asset_ids', width: 90,
      render: (ids: number[]) => <span style={{ color: 'var(--text-secondary)' }}>{ids?.length || 0} asset</span>
    },
    {
      title: 'Kết quả', dataIndex: 'findings_count', key: 'findings_count', width: 90,
      render: (v: number) => <span style={{ color: v > 0 ? 'var(--risk-medium)' : 'var(--text-secondary)', fontWeight: 600 }}>{v || 0}</span>
    },
    {
      title: 'Connectors', dataIndex: 'platform_status', key: 'platform_status',
      render: (statuses: ConnectorStatus[]) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(statuses || []).map(s => <PlatformBadge key={s.platform} platform={s.platform} showLabel={false} />)}
        </div>
      )
    },
    {
      title: 'Bắt đầu', dataIndex: 'started_at', key: 'started_at', width: 160,
      render: (d: string) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{d ? new Date(d).toLocaleString() : '—'}</span>
    },
    {
      title: '', key: 'actions', width: 110, fixed: 'right' as const,
      render: (_: unknown, row: ScanRun) => (
        <Button
          size="small"
          icon={<RedoOutlined />}
          loading={rescanningId === row.id}
          onClick={() => rescanRow(row)}
        >Quét lại</Button>
      )
    }
  ]), [rescanningId])

  /** Cho người dùng thấy hệ thống đã hiểu input của họ là gì trước khi bấm quét. */
  const detection = useMemo(() => {
    const d = detectScanInput(query)
    if (!d) {
      return {
        badge: null,
        hint: 'Dán link YouTube, gõ tên miền (vd: nike.com), gõ từ khóa — hoặc kéo-thả tệp ảnh/video/audio vào đây.'
      }
    }
    if (d.assetType === 'video') {
      return {
        badge: { icon: '🎬', label: 'Link YouTube' },
        hint: 'Sẽ tìm video tương tự, đối chiếu tiêu đề, transcript và frame hình ảnh.'
      }
    }
    if (d.officialDomains) {
      return {
        badge: { icon: '🌐', label: 'Tên miền' },
        hint: `Sẽ quét nội dung mạo danh tên miền chính thức: ${d.officialDomains}`
      }
    }
    return {
      badge: { icon: '🔤', label: 'Từ khóa' },
      hint: `Sẽ quét theo từ khóa: "${d.keywords}"`
    }
  }, [query])

  const readyPlatforms = useMemo(
    () =>
      new Set(
        connectorStatus
          .filter(c => c.capability === 'ready' && ENABLED_PLATFORMS.has(c.platform))
          .map(c => c.platform)
      ),
    [connectorStatus]
  )

  /** Lý do cụ thể từng nền tảng chưa dùng được, để tooltip nói rõ thiếu key nào. */
  const platformReason = useMemo(() => {
    const map = new Map<Platform, string>()
    for (const status of connectorStatus) {
      if (status.capability !== 'ready') map.set(status.platform, status.message)
    }
    return map
  }, [connectorStatus])

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout className="ml-0 xl:ml-[260px]">
        <Header title={t('nav.scans')} />
        <Content className="page-container" style={{ padding: '24px 32px' }}>
          {/* Toolbar */}
          <div className="dash-toolbar" style={{ marginBottom: 20 }}>
            <div>
              <h1 className="dash-title">
                {t('scans.title')}
                <span className="dash-title-dot">.</span>
              </h1>
              <p className="dash-sub">
                Dán link, gõ từ khóa hoặc domain — bấm <kbd style={{ background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4, color: 'var(--text-secondary)', fontSize: 11 }}>Enter</kbd> để quét ngay. Phím tắt <kbd style={{ background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4, color: 'var(--text-secondary)', fontSize: 11 }}>Ctrl K</kbd> để tập trung vào ô nhập.
              </p>
            </div>
            <Button icon={<ReloadOutlined />} onClick={load} className="dash-refresh-btn">
              Làm mới lịch sử
            </Button>
          </div>

          {/* ===== SCAN DECK — hero control surface ===== */}
          <div
            className={`scan-deck${dragging ? ' is-dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDeckDrop}
            onPaste={onDeckPaste}
          >
            <div className="scan-deck-glow" />
            <div className="scan-deck-head">
              <div className="scan-deck-title">
                <span className="scan-deck-bolt"><ThunderboltOutlined /></span>
                <div>
                  <div className="scan-deck-name">Quét bản quyền ngay lập tức</div>
                  <div className="scan-deck-desc">Hệ thống tự nhận diện link / domain / từ khóa, quét trên các nền tảng bạn chọn</div>
                </div>
              </div>
              <div className="scan-deck-badges">
                <div className="scan-deck-badge">
                  {readyPlatforms.size}/{ENABLED_PLATFORMS.size} nền tảng sẵn sàng
                </div>
                {quota && quota.used > 0 && (
                  // Con số cũ hardcode 600 unit (6 truy vấn) — sai kể từ khi
                  // quét link YouTube đi qua findCopies: 101 unit cho một truy
                  // vấn, 201 khi phải tìm thêm theo transcript.
                  <Tooltip title="Mỗi lần quét link YouTube tốn 101 quota unit (201 nếu phải tìm thêm theo transcript). Hạn mức reset lúc 00:00 giờ Thái Bình Dương.">
                    <div className={`scan-deck-badge scan-deck-badge--quota${quota.exceeded ? ' is-exceeded' : quota.nearLimit ? ' is-warning' : ''}`}>
                      Quota YouTube: {quota.used.toLocaleString()}/{quota.budget.toLocaleString()}
                    </div>
                  </Tooltip>
                )}
              </div>
            </div>

            {!loadingScans && readyPlatforms.size === 0 && (
              <div className="scan-deck-alert">
                <span aria-hidden>⚠️</span>
                <div>
                  <strong>Chưa nền tảng nào sẵn sàng.</strong>{' '}
                  Cần thêm API key của YouTube hoặc Google Search thì mới quét được.
                </div>
                <Link href="/settings" className="scan-deck-alert__cta">Cấu hình ngay →</Link>
              </div>
            )}

            <div className="scan-deck-input-row">
              <Input
                ref={inputRef}
                size="large"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onPressEnter={onHeroScan}
                disabled={scanning}
                prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                placeholder="Dán link YouTube, domain (vd: nike.com), hoặc gõ từ khóa thương hiệu..."
                allowClear
                className="scan-deck-input"
              />
              <Tooltip title={selectedPlatforms.length === 0 ? 'Chọn ít nhất 1 nền tảng đã cấu hình API key' : ''}>
                <Button
                  type="primary"
                  size="large"
                  icon={<ThunderboltOutlined />}
                  loading={scanning}
                  disabled={selectedPlatforms.length === 0}
                  onClick={onHeroScan}
                  className="scan-deck-cta"
                >
                  Quét ngay
                </Button>
              </Tooltip>
            </div>

            <div className="scan-deck-hint">
              {detection.badge ? (
                <span className="scan-detect-badge">
                  <span aria-hidden>{detection.badge.icon}</span>
                  {detection.badge.label}
                </span>
              ) : (
                <BulbOutlined style={{ color: 'var(--risk-medium)' }} />
              )}
              <span>{detection.hint}</span>
            </div>

            {!query && !scanning && (
              <div className="scan-examples">
                <span className="scan-option-label">Thử ngay</span>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    className="scan-example-chip"
                    onClick={() => {
                      setQuery(ex.value)
                      inputRef.current?.focus()
                    }}
                  >
                    <span aria-hidden>{ex.icon}</span> {ex.label}
                  </button>
                ))}
                <label className="scan-example-chip scan-example-chip--file">
                  <span aria-hidden>📁</span> Chọn tệp
                  <input
                    type="file"
                    accept="image/*,video/*,audio/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) scanFile(file)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            )}

            {dragging && (
              <div className="scan-deck-dropzone">
                <span>Thả tệp để quét ngay — ảnh, video hoặc audio</span>
              </div>
            )}

            <div className="scan-deck-options">
              <div className="scan-option-group">
                <span className="scan-option-label">Nền tảng</span>
                <div className="scan-platform-row">
                  {PLATFORM_LIST.map(p => {
                    const comingSoon = !ENABLED_PLATFORMS.has(p)
                    const ready = !comingSoon && readyPlatforms.has(p)
                    const selected = selectedPlatforms.includes(p)
                    return (
                      <Tooltip
                        key={p}
                        title={
                          comingSoon
                            ? COMING_SOON_LABEL
                            : ready
                              ? ''
                              : platformReason.get(p) || 'Cần cấu hình API key'
                        }
                      >
                        <button
                          type="button"
                          className={`scan-platform-chip${selected ? ' is-selected' : ''}${!ready ? ' is-disabled' : ''}`}
                          disabled={!ready}
                          onClick={() => togglePlatform(p)}
                        >
                          {PLATFORM_ICONS[p]}
                          <span style={{ textTransform: 'capitalize' }}>{p}</span>
                          {comingSoon
                            ? <span className="scan-chip-soon">Sắp có</span>
                            : selected && <span className="scan-chip-check">✓</span>}
                        </button>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
              <div className="scan-option-group">
                <span className="scan-option-label">Chế độ YouTube</span>
                <Segmented
                  size="small"
                  value={youtubeMode}
                  onChange={(v) => setYoutubeMode(v as YouTubeMode)}
                  options={[
                    { label: '⚡ Fast', value: 'fast' },
                    { label: '🔍 Deep', value: 'deep' }
                  ]}
                />
                <Tooltip title="Fast: quét nhanh, bỏ qua check âm thanh + hình ảnh. Deep: đầy đủ, chậm hơn.">
                  <span className="scan-mode-help">?</span>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* ===== LIVE RESULTS PANEL ===== */}
          <div className="cm-card scan-results" style={{ padding: 20, minHeight: 200 }}>
            {scanProgress.status === 'idle' && (
              <div className="scan-idle">
                <div className="scan-idle-icon"><SearchOutlined /></div>
                <div className="scan-idle-title">Sẵn sàng quét</div>
                <div className="scan-idle-sub">Kết quả quét sẽ hiển thị ngay tại đây sau khi bạn bấm Quét ngay</div>
              </div>
            )}

            {scanProgress.status === 'running' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <Progress percent={100} status="active" strokeColor={{ '0%': '#8b5cf6', '100%': '#ec4899' }} showInfo={false} style={{ flex: 1 }} />
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    Đang quét trên {selectedPlatforms.length} nền tảng…
                  </span>
                </div>
                <Skeleton active paragraph={{ rows: 3 }} title={false} />
              </div>
            )}

            {scanProgress.status === 'completed' && (
              <div>
                <div className="scan-result-head">
                  <div className="scan-result-status">
                    <CheckCircleOutlined style={{ fontSize: 22, color: 'var(--success)' }} />
                    <div>
                      <div className="scan-result-title">Phát hiện {scanProgress.findings} kết quả nghi vấn</div>
                      <div className="scan-result-sub">
                        {quickFindings.length > 0 ? 'Bấm tiêu đề để mở nguồn trong tab mới.' : 'Không tìm thấy vi phạm đáng nghi.'}
                      </div>
                    </div>
                  </div>
                  <Link href="/findings">
                    <Button size="small">Xem tất cả Findings →</Button>
                  </Link>
                </div>
                {quickScanMeta?.searched != null && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <Tag>Đã xét: {quickScanMeta.searched || 0} video</Tag>
                    <Tag color={quickScanMeta.frameChecked ? 'success' : undefined}>
                      Đối chiếu khung hình: {quickScanMeta.frameChecked || 0}
                    </Tag>
                    <Tag>Transcript: {quickScanMeta.transcriptChecked || 0}</Tag>
                    {quickScanMeta.mediaCheckStatus && (
                      <Tag color="warning">{quickScanMeta.mediaCheckStatus}</Tag>
                    )}
                  </div>
                )}
                {quickFindings.length > 0 && (
                  <Table
                    dataSource={quickFindings}
                    rowKey={(record) => `${record.platform}:${record.externalId}`}
                    size="small"
                    pagination={{ pageSize: 8 }}
                    columns={[
                      { title: 'Nguồn', dataIndex: 'platform', key: 'platform', width: 80, render: (p: Platform) => <PlatformBadge platform={p} showLabel={false} /> },
                      {
                        title: 'Tiêu đề', dataIndex: 'title', key: 'title',
                        render: (title: string, record: any) => (
                          <a href={record.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-violet)', fontWeight: 500, fontSize: 13 }}>{title}</a>
                        )
                      },
                      {
                        title: 'Bằng chứng',
                        dataIndex: 'reasons',
                        key: 'reasons',
                        render: (reasons: any[], record: any) => (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Bằng chứng media thật quan trọng hơn hẳn khớp
                                chữ, nên tách riêng thành nhãn nổi bật thay vì
                                lẫn vào dãy tag xám. */}
                            {!record.needsVerification && (
                              <Tag color="success" style={{ fontSize: 10, fontWeight: 600 }}>
                                ✓ Đã đối chiếu hình ảnh
                              </Tag>
                            )}
                            {(reasons || [])
                              .filter(r => r.code !== 'video_frame_match')
                              .slice(0, 3)
                              .map((reason, idx) => (
                                <Tag key={idx} style={{ fontSize: 10 }}>
                                  {reason.label}
                                </Tag>
                              ))}
                          </div>
                        )
                      },
                      {
                        title: 'Rủi ro',
                        dataIndex: 'riskScore',
                        key: 'riskScore',
                        width: 130,
                        render: (score: number, record: any) => (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <RiskPill score={score} />
                            {record.needsVerification && (
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>chưa xác minh media</span>
                            )}
                          </div>
                        )
                      }
                    ]}
                  />
                )}
              </div>
            )}

            {scanProgress.status === 'failed' && (
              <div className="scan-failed">
                <div className="scan-failed-icon">✕</div>
                <div style={{ flex: 1 }}>
                  <div className="scan-result-title">Quét thất bại</div>
                  <div className="scan-result-sub">Kiểm tra kết nối hoặc API key.</div>
                </div>
                <Button size="small" icon={<RedoOutlined />} onClick={onHeroScan}>Thử lại</Button>
              </div>
            )}
          </div>

          {/* ===== ADVANCED ===== */}
          <Collapse
            ghost
            style={{ marginBottom: 24 }}
            items={[{
              key: 'advanced',
              label: (
                <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <SettingOutlined /> Nâng cao: quét tài sản đã lưu hoặc upload tệp / audio
                </span>
              ),
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <div className="cm-card" style={{ padding: 18, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h4 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 14 }}>Giám sát tài sản đã lưu</h4>
                        <Link href="/assets" style={{ color: 'var(--accent-violet)', fontSize: 12 }}>Quản lý tài sản →</Link>
                      </div>
                      {loadingAssets ? (
                        <div style={{ padding: 24, textAlign: 'center' }}><Spin size="small" /></div>
                      ) : assets.length === 0 ? (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: 'var(--text-muted)' }}>Chưa có tài sản nào.</span>} />
                      ) : (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
                            {assets.map(asset => (
                              <label key={asset.id} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 12px',
                                background: selectedAssets.includes(asset.id) ? 'rgba(139, 92, 246, 0.08)' : 'var(--surface-subtle)',
                                border: `1px solid ${selectedAssets.includes(asset.id) ? 'var(--accent-violet)' : 'var(--border-subtle)'}`,
                                borderRadius: 8, cursor: 'pointer'
                              }}>
                                <Checkbox
                                  checked={selectedAssets.includes(asset.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedAssets([...selectedAssets, asset.id])
                                    else setSelectedAssets(selectedAssets.filter(id => id !== asset.id))
                                  }}
                                />
                                <FileProtectOutlined style={{ color: 'var(--accent-violet)' }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{asset.asset_type.toUpperCase()} · {asset.keywords?.length || 0} keywords</div>
                                </div>
                                <Tag style={{ fontSize: 10 }}>{asset.status}</Tag>
                              </label>
                            ))}
                          </div>
                          <Button
                            type="primary"
                            block
                            style={{ marginTop: 12 }}
                            icon={<ThunderboltOutlined />}
                            loading={scanning}
                            disabled={selectedAssets.length === 0}
                            onClick={onScanSavedAssets}
                          >Quét {selectedAssets.length || ''} tài sản đã chọn</Button>
                        </>
                      )}
                    </div>
                  </Col>
                  <Col xs={24} lg={12}>
                    <div className="cm-card" style={{ padding: 18, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14 }}>
                      <h4 style={{ color: 'var(--text-primary)', marginTop: 0, marginBottom: 12, fontSize: 14 }}>Quét nhanh với tùy chọn chi tiết</h4>
                      <Form form={advancedForm} layout="vertical" size="small" initialValues={{ assetType: 'brand_name' }}>
                        <Row gutter={12}>
                          <Col span={12}>
                            <Form.Item name="name" label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Tên tài sản</span>}>
                              <Input placeholder="VD: Slogan chiến dịch" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="assetType" label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Loại</span>}>
                              <Select
                                options={[
                                  { label: '🏢 Thương hiệu / Keyword', value: 'brand_name' },
                                  { label: '📄 Văn bản', value: 'text' },
                                  { label: '🖼️ Hình ảnh', value: 'image' },
                                  { label: '🏷️ Logo', value: 'logo' },
                                  { label: '📹 Video', value: 'video' },
                                  { label: '🎵 Âm thanh', value: 'audio' }
                                ]}
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Row gutter={12}>
                          <Col span={12}>
                            <Form.Item name="keywords" label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Từ khóa</span>}>
                              <Input placeholder="slogan, tagline" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="officialDomains" label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Domain chính thức</span>}>
                              <Input placeholder="example.com" />
                            </Form.Item>
                          </Col>
                        </Row>
                        {['audio', 'video'].includes(watchType || '') && (
                          <Form.Item name="youtubeUrl" label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>YouTube URL</span>}>
                            <Input placeholder="https://www.youtube.com/watch?v=..." />
                          </Form.Item>
                        )}
                        {watchType === 'audio' && (
                          <Row gutter={12}>
                            <Col span={12}>
                              <Form.Item name="audioTitle" label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Tên bài hát</span>}>
                                <Input />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="audioArtist" label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Nghệ sĩ</span>}>
                                <Input />
                              </Form.Item>
                            </Col>
                          </Row>
                        )}
                        {['text', 'brand_name'].includes(watchType || 'brand_name') && (
                          <Form.Item name="textContent" label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Nội dung văn bản</span>}>
                            <Input.TextArea rows={3} placeholder="Nội dung cần quét..." />
                          </Form.Item>
                        )}
                        {['image', 'logo', 'video', 'audio'].includes(watchType || '') && (
                          <Form.Item label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Tệp tải lên</span>}>
                            <UploadDropzone
                              accept={['image', 'logo'].includes(watchType || '') ? 'image/*' : watchType === 'video' ? 'video/*' : 'audio/*'}
                              onFile={setAdvancedFile}
                            />
                          </Form.Item>
                        )}
                        <Button type="primary" block icon={<ThunderboltOutlined />} loading={scanning} onClick={onAdvancedQuickScan}>
                          Quét nhanh với cấu hình trên
                        </Button>
                      </Form>
                    </div>
                  </Col>
                </Row>
              )
            }]}
          />

          {/* ===== HISTORY ===== */}
          <div className="cm-card" style={{ padding: 24 }}>
            <div className="dash-section-header" style={{ marginBottom: 16 }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, margin: 0 }}>
                <HistoryOutlined style={{ marginRight: 8, color: 'var(--accent-violet)' }} />
                {t('scans.history')}
              </h3>
            </div>

            {scans.length > 0 && (
              <div className="scan-history-stats">
                <div className="scan-history-stat">
                  <Statistic title="Tổng lần quét" value={historyStats.total} valueStyle={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 700 }} />
                </div>
                <div className="scan-history-stat">
                  <Statistic title="Hoàn thành" value={historyStats.completed} valueStyle={{ color: 'var(--success)', fontSize: 22, fontWeight: 700 }} />
                </div>
                <div className="scan-history-stat">
                  <Statistic title="Đang chạy" value={historyStats.running} valueStyle={{ color: '#38bdf8', fontSize: 22, fontWeight: 700 }} />
                </div>
                <div className="scan-history-stat">
                  <Statistic title="Thất bại" value={historyStats.failed} valueStyle={{ color: 'var(--danger)', fontSize: 22, fontWeight: 700 }} />
                </div>
                <div className="scan-history-stat">
                  <Statistic title="Tổng findings" value={historyStats.findings} valueStyle={{ color: 'var(--risk-medium)', fontSize: 22, fontWeight: 700 }} />
                </div>
              </div>
            )}

            {loadingScans ? (
              <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
            ) : scans.length === 0 ? (
              <Empty description={<span style={{ color: 'var(--text-muted)' }}>Chưa có lần quét nào</span>} />
            ) : (
              <Table dataSource={scans} columns={columns} rowKey="id" pagination={{ pageSize: 10 }} scroll={{ x: 800 }} />
            )}
          </div>

        </Content>
      </Layout>
    </Layout>
  )
}
