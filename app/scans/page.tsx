'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Space
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
  SettingOutlined
} from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
  youtube: <YoutubeFilled style={{ color: '#ff6b6b' }} />,
  google: <GoogleSquareFilled style={{ color: '#88aaff' }} />,
  facebook: <FacebookFilled style={{ color: '#6aa5ff' }} />,
  tiktok: <TikTokFilled />
}

const PLATFORM_LIST: Platform[] = ['youtube', 'google', 'facebook', 'tiktok']
const LS_PLATFORMS = 'scan.platforms'
const LS_YT_MODE = 'scan.youtubeMode'

type YouTubeMode = 'fast' | 'deep'

export default function ScansPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t } = useTranslation()

  const [scans, setScans] = useState<ScanRun[]>([])
  const [connectorStatus, setConnectorStatus] = useState<ConnectorStatus[]>([])
  const [loadingScans, setLoadingScans] = useState(true)

  const [query, setQuery] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['youtube', 'google'])
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<{ status: 'idle' | 'running' | 'completed' | 'failed'; findings: number }>({ status: 'idle', findings: 0 })
  const [quickFindings, setQuickFindings] = useState<any[]>([])
  const [quickScanMeta, setQuickScanMeta] = useState<any>(null)
  const [rescanningId, setRescanningId] = useState<number | null>(null)
  const [youtubeMode, setYoutubeMode] = useState<YouTubeMode>('fast')

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
        if (Array.isArray(arr) && arr.length) setSelectedPlatforms(arr.filter(p => PLATFORM_LIST.includes(p)))
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
    const readySet = new Set(connectorStatus.filter(c => c.capability === 'ready').map(c => c.platform))
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

  const columns = useMemo(() => ([
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70, render: (v: number) => <span style={{ color: '#a1a1aa' }}>#{v}</span> },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 110,
      render: (v: string) => <Tag color={statusColors[v] || 'default'}>{v}</Tag>
    },
    {
      title: 'Tài sản', dataIndex: 'asset_ids', key: 'asset_ids', width: 90,
      render: (ids: number[]) => <span style={{ color: '#a1a1aa' }}>{ids?.length || 0} asset</span>
    },
    {
      title: 'Kết quả', dataIndex: 'findings_count', key: 'findings_count', width: 90,
      render: (v: number) => <span style={{ color: v > 0 ? '#fcd34d' : '#a1a1aa', fontWeight: 600 }}>{v || 0}</span>
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
      render: (d: string) => <span style={{ color: '#a1a1aa', fontSize: 12 }}>{d ? new Date(d).toLocaleString() : '—'}</span>
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

  const inputHint = useMemo(() => {
    const d = detectScanInput(query)
    if (!d) return 'Mẹo: dán link YouTube để hệ thống tự lấy metadata, hoặc gõ domain (vd: nike.com).'
    if (d.assetType === 'video') return 'Đã nhận diện link YouTube — sẽ tìm video tương tự và deep check âm thanh + frame video.'
    if (d.officialDomains) return `Sẽ quét tên miền chính thức: ${d.officialDomains}`
    return `Sẽ quét theo từ khóa: "${d.keywords}"`
  }, [query])

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
        <Header title={t('nav.scans')} />
        <Content className="page-container" style={{ padding: '24px 32px' }}>

          {/* Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, background: 'linear-gradient(90deg, #fafafa 0%, #a1a1aa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t('scans.title')}</h1>
              <p style={{ color: '#71717a', marginTop: 4, fontSize: 14 }}>Dán link, gõ từ khóa hoặc domain — bấm <kbd style={{ background: '#27272a', padding: '1px 6px', borderRadius: 4, color: '#e4e4e7', fontSize: 11 }}>Enter</kbd> để quét ngay.</p>
            </div>
            <Button icon={<ReloadOutlined />} onClick={load} className="cm-btn-secondary">Làm mới lịch sử</Button>
          </div>

          {/* Hero scan bar */}
          <div className="cm-card" style={{ padding: 20, background: 'linear-gradient(180deg, #15151d 0%, #101016 100%)', border: '1px solid rgba(139,92,246,0.18)', borderRadius: 16, marginBottom: 20 }}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                ref={inputRef}
                size="large"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onPressEnter={onHeroScan}
                disabled={scanning}
                prefix={<SearchOutlined style={{ color: '#71717a' }} />}
                placeholder="Dán link YouTube, domain (vd: nike.com), hoặc gõ từ khóa thương hiệu..."
                allowClear
              />
              <Button
                type="primary"
                size="large"
                icon={<ThunderboltOutlined />}
                loading={scanning}
                onClick={onHeroScan}
              >Quét ngay</Button>
            </Space.Compact>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ color: '#a1a1aa', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <BulbOutlined style={{ color: '#fcd34d' }} />
                {inputHint}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: '#71717a', fontSize: 11, marginRight: 4 }}>Nền tảng:</span>
                {PLATFORM_LIST.map(p => {
                  const s = connectorStatus.find(c => c.platform === p)
                  const ready = s?.capability === 'ready'
                  const selected = selectedPlatforms.includes(p)
                  return (
                    <Tooltip key={p} title={ready ? '' : 'Cần cấu hình API key'}>
                      <Button
                        size="small"
                        icon={PLATFORM_ICONS[p]}
                        disabled={!ready}
                        onClick={() => togglePlatform(p)}
                        style={{
                          background: selected ? 'rgba(139, 92, 246, 0.18)' : 'rgba(255,255,255,0.02)',
                          borderColor: selected ? '#8b5cf6' : 'rgba(255,255,255,0.08)',
                          color: selected ? '#a78bfa' : '#a1a1aa',
                          opacity: ready ? 1 : 0.4
                        }}
                      >
                        <span style={{ textTransform: 'capitalize', fontSize: 12 }}>{p}</span>
                      </Button>
                    </Tooltip>
                  )
                })}
                <Tooltip title="Chỉ áp dụng khi dán link YouTube. Fast nhanh hơn (tắt check âm thanh + hình ảnh), Deep đầy đủ.">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 10 }}>
                    <span style={{ color: '#71717a', fontSize: 11 }}>YouTube mode:</span>
                    <Segmented
                      size="small"
                      value={youtubeMode}
                      onChange={(v) => setYoutubeMode(v as YouTubeMode)}
                      options={[
                        { label: 'Fast', value: 'fast' },
                        { label: 'Deep', value: 'deep' }
                      ]}
                    />
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Live results panel */}
          <div className="cm-card" style={{ padding: 20, background: '#13131a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, marginBottom: 20, minHeight: 200 }}>
            {scanProgress.status === 'idle' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', color: '#71717a', textAlign: 'center' }}>
                <SearchOutlined style={{ fontSize: 32, color: '#4b5563', marginBottom: 8 }} />
                <div style={{ fontSize: 13 }}>Kết quả quét trực tiếp sẽ hiển thị tại đây.</div>
              </div>
            )}

            {scanProgress.status === 'running' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <Progress percent={75} status="active" strokeColor={{ '0%': '#8b5cf6', '100%': '#06b6d4' }} showInfo={false} style={{ flex: 1 }} />
                  <span style={{ color: '#a1a1aa', fontSize: 12 }}>Đang quét trên {selectedPlatforms.length} nền tảng…</span>
                </div>
                <Skeleton active paragraph={{ rows: 3 }} title={false} />
              </div>
            )}

            {scanProgress.status === 'completed' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <CheckCircleOutlined style={{ fontSize: 22, color: '#10b981' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fafafa', fontWeight: 600, fontSize: 14 }}>Phát hiện {scanProgress.findings} kết quả nghi vấn</div>
                    <div style={{ color: '#a1a1aa', fontSize: 12 }}>
                      {quickFindings.length > 0 ? 'Bấm tiêu đề để mở nguồn trong tab mới.' : 'Không tìm thấy vi phạm đáng nghi.'}
                    </div>
                  </div>
                  <Link href="/findings"><Button size="small">Xem tất cả Findings →</Button></Link>
                </div>
                {(quickScanMeta?.mode === 'youtube_deep_url' || quickScanMeta?.mode === 'youtube_deep_fallback') && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <Tag>Quét YouTube: {quickScanMeta.searched || 0}</Tag>
                    <Tag>Transcript: {quickScanMeta.transcriptChecked || 0}</Tag>
                    <Tag>Media deep check: {quickScanMeta.mediaChecked || 0}</Tag>
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
                          <a href={record.url} target="_blank" rel="noreferrer" style={{ color: '#a78bfa', fontWeight: 500, fontSize: 13 }}>{title}</a>
                        )
                      },
                      {
                        title: 'Bằng chứng',
                        dataIndex: 'reasons',
                        key: 'reasons',
                        render: (reasons: any[]) => (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {(reasons || []).slice(0, 4).map((reason, idx) => (
                              <Tag key={idx} style={{ fontSize: 10 }}>
                                {reason.label}
                              </Tag>
                            ))}
                          </div>
                        )
                      },
                      { title: 'Rủi ro', dataIndex: 'riskScore', key: 'riskScore', width: 90, render: (score: number) => <RiskPill score={score} /> }
                    ]}
                  />
                )}
              </div>
            )}

            {scanProgress.status === 'failed' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8 }}>
                <div style={{ fontSize: 28, color: '#ef4444' }}>✕</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fafafa', fontWeight: 600 }}>Quét thất bại</div>
                  <div style={{ color: '#a1a1aa', fontSize: 12 }}>Kiểm tra kết nối hoặc API key.</div>
                </div>
                <Button size="small" icon={<RedoOutlined />} onClick={onHeroScan}>Thử lại</Button>
              </div>
            )}
          </div>

          {/* Advanced */}
          <Collapse
            ghost
            style={{ marginBottom: 24 }}
            items={[{
              key: 'advanced',
              label: (
                <span style={{ color: '#a1a1aa', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <SettingOutlined /> Nâng cao: quét tài sản đã lưu hoặc upload tệp / audio
                </span>
              ),
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <div className="cm-card" style={{ padding: 18, background: '#13131a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h4 style={{ color: '#fafafa', margin: 0, fontSize: 14 }}>Giám sát tài sản đã lưu</h4>
                        <Link href="/assets" style={{ color: '#8b5cf6', fontSize: 12 }}>Quản lý tài sản →</Link>
                      </div>
                      {loadingAssets ? (
                        <div style={{ padding: 24, textAlign: 'center' }}><Spin size="small" /></div>
                      ) : assets.length === 0 ? (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: '#71717a' }}>Chưa có tài sản nào.</span>} />
                      ) : (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
                            {assets.map(asset => (
                              <label key={asset.id} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 12px',
                                background: selectedAssets.includes(asset.id) ? 'rgba(139, 92, 246, 0.08)' : '#181820',
                                border: `1px solid ${selectedAssets.includes(asset.id) ? '#8b5cf6' : 'rgba(255,255,255,0.04)'}`,
                                borderRadius: 8, cursor: 'pointer'
                              }}>
                                <Checkbox
                                  checked={selectedAssets.includes(asset.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedAssets([...selectedAssets, asset.id])
                                    else setSelectedAssets(selectedAssets.filter(id => id !== asset.id))
                                  }}
                                />
                                <FileProtectOutlined style={{ color: '#8b5cf6' }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ color: '#fafafa', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
                                  <div style={{ color: '#71717a', fontSize: 11 }}>{asset.asset_type.toUpperCase()} · {asset.keywords?.length || 0} keywords</div>
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
                    <div className="cm-card" style={{ padding: 18, background: '#13131a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}>
                      <h4 style={{ color: '#fafafa', marginTop: 0, marginBottom: 12, fontSize: 14 }}>Quét nhanh với tùy chọn chi tiết</h4>
                      <Form form={advancedForm} layout="vertical" size="small" initialValues={{ assetType: 'brand_name' }}>
                        <Row gutter={12}>
                          <Col span={12}>
                            <Form.Item name="name" label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>Tên tài sản</span>}>
                              <Input placeholder="VD: Slogan chiến dịch" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="assetType" label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>Loại</span>}>
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
                            <Form.Item name="keywords" label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>Từ khóa</span>}>
                              <Input placeholder="slogan, tagline" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="officialDomains" label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>Domain chính thức</span>}>
                              <Input placeholder="example.com" />
                            </Form.Item>
                          </Col>
                        </Row>
                        {['audio', 'video'].includes(watchType || '') && (
                          <Form.Item name="youtubeUrl" label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>YouTube URL</span>}>
                            <Input placeholder="https://www.youtube.com/watch?v=..." />
                          </Form.Item>
                        )}
                        {watchType === 'audio' && (
                          <Row gutter={12}>
                            <Col span={12}>
                              <Form.Item name="audioTitle" label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>Tên bài hát</span>}>
                                <Input />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="audioArtist" label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>Nghệ sĩ</span>}>
                                <Input />
                              </Form.Item>
                            </Col>
                          </Row>
                        )}
                        {['text', 'brand_name'].includes(watchType || 'brand_name') && (
                          <Form.Item name="textContent" label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>Nội dung văn bản</span>}>
                            <Input.TextArea rows={3} placeholder="Nội dung cần quét..." />
                          </Form.Item>
                        )}
                        {['image', 'logo', 'video', 'audio'].includes(watchType || '') && (
                          <Form.Item label={<span style={{ color: '#a1a1aa', fontSize: 12 }}>Tệp tải lên</span>}>
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

          {/* History */}
          <div className="cm-card" style={{ padding: 24 }}>
            <h3 style={{ color: '#fafafa', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{t('scans.history')}</h3>
            {loadingScans ? (
              <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
            ) : scans.length === 0 ? (
              <Empty description={<span style={{ color: '#71717a' }}>Chưa có lần quét nào</span>} />
            ) : (
              <Table dataSource={scans} columns={columns} rowKey="id" pagination={{ pageSize: 10 }} scroll={{ x: 800 }} />
            )}
          </div>

        </Content>
      </Layout>
    </Layout>
  )
}
