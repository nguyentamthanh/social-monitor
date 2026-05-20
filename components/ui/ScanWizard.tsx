'use client'

import { Drawer, Steps, Checkbox, Button, Empty, Progress, message, Tag, Radio, Form, Input, Select, Table } from 'antd'
import {
  YoutubeFilled,
  GoogleSquareFilled,
  FacebookFilled,
  TikTokFilled,
  FileProtectOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { BrandAsset, ConnectorStatus, Platform, CopyrightAssetType } from '@/types'
import { useTranslation } from '@/lib/i18n/context'
import RiskPill from './RiskPill'
import PlatformBadge from './PlatformBadge'
import UploadDropzone from './UploadDropzone'

interface Props {
  open: boolean
  onClose: () => void
  onCompleted?: (scanId: number, findingsCount: number) => void
}

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  youtube: <YoutubeFilled style={{ color: '#ff6b6b' }} />,
  google: <GoogleSquareFilled style={{ color: '#88aaff' }} />,
  facebook: <FacebookFilled style={{ color: '#6aa5ff' }} />,
  tiktok: <TikTokFilled />
}

export default function ScanWizard({ open, onClose, onCompleted }: Props) {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const [scanMode, setScanMode] = useState<'asset' | 'quick'>('asset')
  const [assets, setAssets] = useState<BrandAsset[]>([])
  const [connectorStatus, setConnectorStatus] = useState<ConnectorStatus[]>([])
  const [selectedAssets, setSelectedAssets] = useState<number[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['youtube', 'google'])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanId, setScanId] = useState<number | null>(null)
  const [scanProgress, setScanProgress] = useState({ status: 'idle', findings: 0 })
  const [quickFindings, setQuickFindings] = useState<any[]>([])
  const [quickFile, setQuickFile] = useState<File | null>(null)
  
  const [quickForm] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoadingAssets(true)
    try {
      const [assetsRes, scansRes] = await Promise.all([
        fetch('/api/assets'),
        fetch('/api/scans')
      ])
      if (assetsRes.ok) setAssets(await assetsRes.json())
      if (scansRes.ok) {
        const data = await scansRes.json()
        setConnectorStatus(data.connectorStatus || [])
      }
    } finally {
      setLoadingAssets(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setStep(0)
      setScanId(null)
      setScanProgress({ status: 'idle', findings: 0 })
      setQuickFindings([])
      setQuickFile(null)
      quickForm.resetFields()
      fetchData()
    }
  }, [open, fetchData, quickForm])

  const nextFromStep0 = async () => {
    if (scanMode === 'quick') {
      try {
        await quickForm.validateFields()
        setStep(1)
      } catch (err) {
        message.error('Vui lòng nhập đầy đủ thông tin bắt buộc')
      }
    } else {
      if (selectedAssets.length === 0) {
        message.warning('Hãy chọn ít nhất 1 tài sản')
        return
      }
      setStep(1)
    }
  }

  const startScan = async () => {
    if (selectedPlatforms.length === 0) {
      message.warning('Hãy chọn ít nhất 1 nền tảng')
      return
    }
    setScanning(true)
    setScanProgress({ status: 'running', findings: 0 })
    setStep(2)
    try {
      if (scanMode === 'quick') {
        const values = await quickForm.validateFields()
        const fd = new FormData()
        fd.append('name', values.name)
        fd.append('assetType', values.assetType)
        if (values.keywords) {
          fd.append('keywords', values.keywords)
        }
        if (values.officialDomains) {
          fd.append('officialDomains', values.officialDomains)
        }
        if (values.textContent) fd.append('textContent', values.textContent)
        if (values.audioTitle) fd.append('audioTitle', values.audioTitle)
        if (values.audioArtist) fd.append('audioArtist', values.audioArtist)
        if (quickFile) fd.append('file', quickFile)
        fd.append('platforms', selectedPlatforms.join(','))

        const res = await fetch('/api/scans/quick', {
          method: 'POST',
          body: fd
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Quick scan failed')
        setQuickFindings(data.findings || [])
        setScanProgress({ status: 'completed', findings: data.findingsCreated || 0 })
      } else {
        const res = await fetch('/api/scans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetIds: selectedAssets, platforms: selectedPlatforms })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Scan failed')
        setScanId(data.scanRun?.id)
        setScanProgress({ status: data.scanRun?.status || 'completed', findings: data.findingsCreated || 0 })
        if (onCompleted) onCompleted(data.scanRun?.id, data.findingsCreated || 0)
      }
    } catch (err: any) {
      message.error(err?.message || 'Scan failed')
      setScanProgress({ status: 'failed', findings: 0 })
    } finally {
      setScanning(false)
    }
  }

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  const platforms: Platform[] = ['youtube', 'google', 'facebook', 'tiktok']
  const watchType = Form.useWatch('assetType', quickForm)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThunderboltOutlined style={{ color: '#8b5cf6' }} />
          {scanMode === 'quick' ? 'Quét nhanh tài sản' : t('scans.start')}
        </span>
      }
      width={680}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && step < 2 && <Button onClick={() => setStep(step - 1)}>Quay lại</Button>}
            {step === 0 && (
              <Button type="primary" onClick={nextFromStep0}>
                Tiếp tục
              </Button>
            )}
            {step === 1 && (
              <Button type="primary" onClick={startScan} loading={scanning} icon={<ThunderboltOutlined />}>
                {t('scans.start')}
              </Button>
            )}
            {step === 2 && scanProgress.status !== 'running' && (
              <Button type="primary" onClick={onClose}>Xong</Button>
            )}
          </div>
        </div>
      }
    >
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 32 }}
        items={[
          { title: scanMode === 'quick' ? 'Cấu hình nhanh' : t('scans.selectAssets') },
          { title: t('scans.selectPlatforms') },
          { title: scanProgress.status === 'completed' ? t('scans.completed') : t('scans.runningStatus') }
        ]}
      />

      {step === 0 && (
        <div>
          <div style={{ marginBottom: 20, textAlign: 'center' }}>
            <Radio.Group value={scanMode} onChange={(e) => setScanMode(e.target.value)} buttonStyle="solid">
              <Radio.Button value="asset">Giám sát tài sản sẵn có</Radio.Button>
              <Radio.Button value="quick">
                <ThunderboltOutlined /> Quét nhanh ad-hoc
              </Radio.Button>
            </Radio.Group>
          </div>

          {scanMode === 'asset' ? (
            <div>
              <div style={{ marginBottom: 16, color: '#a1a1aa', fontSize: 13 }}>
                Chọn các tài sản bạn muốn quét. Có thể chọn nhiều.
              </div>
              {loadingAssets ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#a1a1aa' }}>{t('common.loading')}</div>
              ) : assets.length === 0 ? (
                <Empty
                  description={
                    <span style={{ color: '#a1a1aa' }}>
                      Chưa có tài sản nào. <Link href="/assets" style={{ color: '#8b5cf6' }}>Tạo tài sản mới</Link>
                    </span>
                  }
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {assets.map(asset => (
                    <label
                      key={asset.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 16px',
                        background: selectedAssets.includes(asset.id) ? 'rgba(139, 92, 246, 0.08)' : '#13131a',
                        border: `1px solid ${selectedAssets.includes(asset.id) ? '#8b5cf6' : 'rgba(255,255,255,0.06)'}`,
                        borderRadius: 12,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <Checkbox
                        checked={selectedAssets.includes(asset.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedAssets([...selectedAssets, asset.id])
                          else setSelectedAssets(selectedAssets.filter(id => id !== asset.id))
                        }}
                      />
                      <FileProtectOutlined style={{ fontSize: 18, color: '#8b5cf6' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#fafafa', fontWeight: 500 }}>{asset.name}</div>
                        <div style={{ color: '#71717a', fontSize: 12 }}>
                          {asset.asset_type.toUpperCase()} · {asset.keywords?.length || 0} keywords
                        </div>
                      </div>
                      <Tag>{asset.status}</Tag>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Form form={quickForm} layout="vertical" style={{ background: '#13131a', padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.04)' }}>
              <Form.Item name="name" label="Tên tài sản quét nhanh" rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
                <Input placeholder="VD: Slogan chiến dịch mới" />
              </Form.Item>
              
              <Form.Item name="assetType" label="Loại hình tài sản" rules={[{ required: true }]} initialValue="brand_name">
                <Select
                  options={[
                    { label: '🏢 Tên thương hiệu / Từ khóa', value: 'brand_name' },
                    { label: '📄 Văn bản (Text)', value: 'text' },
                    { label: '🖼️ Hình ảnh', value: 'image' },
                    { label: '🏷️ Logo', value: 'logo' },
                    { label: '📹 Video', value: 'video' },
                    { label: '🎵 Âm thanh / Music', value: 'audio' }
                  ]}
                />
              </Form.Item>

              <Form.Item name="keywords" label="Từ khóa theo dõi" tooltip="Phân cách bằng dấu phẩy">
                <Input placeholder="slogan, tagline, keyword1" />
              </Form.Item>

              <Form.Item name="officialDomains" label="Tên miền chính thức" tooltip="Domain được tin cậy sẽ giảm điểm vi phạm">
                <Input placeholder="example.com, store.example.com" />
              </Form.Item>

              {watchType === 'audio' && (
                <>
                  <Form.Item name="audioTitle" label="Tên bài hát" rules={[{ required: true, message: 'Vui lòng nhập tên bài hát' }]}>
                    <Input placeholder="VD: Hãy Trao Cho Anh" />
                  </Form.Item>
                  <Form.Item name="audioArtist" label="Nghệ sĩ">
                    <Input placeholder="VD: Sơn Tùng M-TP" />
                  </Form.Item>
                </>
              )}

              {['text', 'brand_name'].includes(watchType || 'brand_name') && (
                <Form.Item name="textContent" label="Nội dung văn bản gốc">
                  <Input.TextArea rows={4} placeholder="Nội dung văn bản cần quét bản quyền..." />
                </Form.Item>
              )}

              {['image', 'logo', 'video', 'audio'].includes(watchType || '') && (
                <Form.Item label="Tải lên tệp quét nhanh">
                  <UploadDropzone
                    accept={
                      ['image', 'logo'].includes(watchType || '')
                        ? 'image/*'
                        : watchType === 'video'
                        ? 'video/*'
                        : 'audio/*'
                    }
                    onFile={setQuickFile}
                  />
                </Form.Item>
              )}
            </Form>
          )}
        </div>
      )}

      {step === 1 && (
        <div>
          <div style={{ marginBottom: 16, color: '#a1a1aa', fontSize: 13 }}>
            Chọn nền tảng để quét. Connector limited cần API key/approval.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {platforms.map(p => {
              const status = connectorStatus.find(s => s.platform === p)
              const ready = status?.capability === 'ready'
              const selected = selectedPlatforms.includes(p)
              return (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  disabled={!ready}
                  style={{
                    padding: 16,
                    background: selected ? 'rgba(139, 92, 246, 0.1)' : '#13131a',
                    border: `1px solid ${selected ? '#8b5cf6' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 12,
                    cursor: ready ? 'pointer' : 'not-allowed',
                    opacity: ready ? 1 : 0.55,
                    textAlign: 'left',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>{PLATFORM_ICONS[p]}</span>
                    <span style={{ color: '#fafafa', fontWeight: 600, textTransform: 'capitalize' }}>{p}</span>
                  </div>
                  <div style={{ fontSize: 11, color: ready ? '#10b981' : '#f59e0b' }}>
                    {ready ? '● Sẵn sàng' : '● Cần cấu hình'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          {scanProgress.status === 'running' && (
            <>
              <Progress type="circle" percent={75} status="active" strokeColor={{ '0%': '#8b5cf6', '100%': '#06b6d4' }} />
              <h3 style={{ color: '#fafafa', marginTop: 24 }}>{t('scans.runningStatus')}</h3>
              <p style={{ color: '#a1a1aa', marginTop: 8 }}>
                {scanMode === 'quick' ? 'Đang chạy quét nhanh ad-hoc...' : `Đang quét ${selectedAssets.length} tài sản...`}
              </p>
            </>
          )}
          {scanProgress.status === 'completed' && (
            <>
              <CheckCircleOutlined style={{ fontSize: 64, color: '#10b981' }} />
              <h3 style={{ color: '#fafafa', marginTop: 24 }}>{t('scans.completed')}</h3>
              
              <p style={{ color: '#a1a1aa', marginTop: 8 }}>
                Phát hiện <strong style={{ color: '#fafafa' }}>{scanProgress.findings}</strong> kết quả vi phạm tiềm ẩn.
              </p>

              {scanMode === 'asset' && scanId && (
                <div style={{ marginTop: 16 }}>
                  <Link href="/findings" style={{ color: '#8b5cf6', fontWeight: 600 }}>Xem chi tiết Findings →</Link>
                </div>
              )}

              {scanMode === 'quick' && quickFindings.length > 0 && (
                <div style={{ marginTop: 24, textAlign: 'left' }}>
                  <h4 style={{ color: '#fafafa', marginBottom: 12, fontSize: 14 }}>Kết quả quét nhanh:</h4>
                  <Table
                    dataSource={quickFindings}
                    rowKey={(record) => `${record.platform}:${record.externalId}`}
                    size="small"
                    pagination={{ pageSize: 5 }}
                    style={{ background: '#13131a', borderRadius: 8 }}
                    columns={[
                      {
                        title: 'Nền tảng',
                        dataIndex: 'platform',
                        key: 'platform',
                        width: 100,
                        render: (p: Platform) => <PlatformBadge platform={p} />
                      },
                      {
                        title: 'Tiêu đề / Nội dung vi phạm',
                        dataIndex: 'title',
                        key: 'title',
                        render: (title: string, record: any) => (
                          <div>
                            <a href={record.url} target="_blank" rel="noreferrer" style={{ color: '#a78bfa', fontWeight: 500, textDecoration: 'underline' }}>
                              {title}
                            </a>
                            <div style={{ color: '#71717a', fontSize: 11, marginTop: 4 }}>
                              {record.content?.slice(0, 100)}...
                            </div>
                          </div>
                        )
                      },
                      {
                        title: 'Rủi ro',
                        dataIndex: 'riskScore',
                        key: 'riskScore',
                        width: 90,
                        render: (score: number) => <RiskPill score={score} />
                      }
                    ]}
                  />
                </div>
              )}

              {scanMode === 'quick' && quickFindings.length === 0 && (
                <div style={{ marginTop: 24 }}>
                  <Empty description={<span style={{ color: '#71717a' }}>Không tìm thấy hành vi vi phạm nào đáng nghi ngờ.</span>} />
                </div>
              )}
            </>
          )}
          {scanProgress.status === 'failed' && (
            <>
              <div style={{ fontSize: 64, color: '#ef4444' }}>✕</div>
              <h3 style={{ color: '#fafafa', marginTop: 24 }}>{t('scans.failed')}</h3>
              <p style={{ color: '#a1a1aa' }}>Vui lòng kiểm tra cấu hình connector hoặc định dạng tệp và thử lại.</p>
            </>
          )}
        </div>
      )}
    </Drawer>
  )
}
