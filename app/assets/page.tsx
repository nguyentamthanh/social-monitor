'use client'

import { useCallback, useEffect, useState } from 'react'
import { Layout, Button, Drawer, Form, Input, Select, Spin, Empty, Popconfirm, message, Tag } from 'antd'
import {
  PlusOutlined, FileImageOutlined, AudioOutlined, VideoCameraOutlined, FileTextOutlined,
  TagOutlined, DeleteOutlined, EditOutlined
} from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import UploadDropzone from '@/components/ui/UploadDropzone'
import { BrandAsset, CopyrightAssetType } from '@/types'
import { useTranslation } from '@/lib/i18n/context'

const { Content } = Layout

const ASSET_ICONS: Record<CopyrightAssetType, React.ReactNode> = {
  image: <FileImageOutlined />,
  logo: <FileImageOutlined />,
  audio: <AudioOutlined />,
  video: <VideoCameraOutlined />,
  text: <FileTextOutlined />,
  brand_name: <TagOutlined />
}

export default function AssetsPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  const [assets, setAssets] = useState<BrandAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState<BrandAsset | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/assets')
      if (res.ok) setAssets(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    else if (status === 'authenticated') load()
  }, [status, router, load])

  const openDrawer = (asset?: BrandAsset) => {
    setEditing(asset || null)
    setFile(null)
    form.resetFields()
    if (asset) {
      form.setFieldsValue({
        name: asset.name,
        assetType: asset.asset_type,
        keywords: asset.keywords?.join(', '),
        officialDomains: asset.official_domains?.join(', '),
        textContent: asset.text_content || '',
        audioTitle: asset.audio_metadata?.title,
        audioArtist: asset.audio_metadata?.artist
      })
    }
    setDrawerOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    setSubmitting(true)
    try {
      if (editing) {
        const res = await fetch(`/api/assets/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: values.name,
            keywords: values.keywords ? values.keywords.split(',').map((x: string) => x.trim()).filter(Boolean) : [],
            officialDomains: values.officialDomains ? values.officialDomains.split(',').map((x: string) => x.trim()).filter(Boolean) : [],
            textContent: values.textContent || null,
            audioMetadata: values.assetType === 'audio' ? { title: values.audioTitle, artist: values.audioArtist } : undefined
          })
        })
        if (!res.ok) throw new Error('Update failed')
        message.success('Đã cập nhật asset')
      } else {
        const fd = new FormData()
        fd.append('name', values.name)
        fd.append('assetType', values.assetType)
        if (values.keywords) fd.append('keywords', values.keywords)
        if (values.officialDomains) fd.append('officialDomains', values.officialDomains)
        if (values.textContent) fd.append('textContent', values.textContent)
        if (values.audioTitle) fd.append('audioTitle', values.audioTitle)
        if (values.audioArtist) fd.append('audioArtist', values.audioArtist)
        if (file) fd.append('file', file)
        const res = await fetch('/api/assets', { method: 'POST', body: fd })
        if (!res.ok) throw new Error('Create failed')
        message.success('Đã tạo asset bản quyền')
      }
      setDrawerOpen(false)
      load()
    } catch (err: any) {
      message.error(err?.message || 'Có lỗi xảy ra')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      message.success('Đã xóa asset')
      load()
    } catch (err: any) {
      message.error(err?.message || 'Có lỗi xảy ra')
    }
  }

  const watchType = Form.useWatch('assetType', form)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
        <Header title={t('nav.assets')} />
        <Content className="page-container">
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1>{t('assets.title')}</h1>
              <p>{t('assets.sub')}</p>
            </div>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()} size="large">
              {t('assets.new')}
            </Button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
          ) : assets.length === 0 ? (
            <div className="cm-card" style={{ textAlign: 'center', padding: 60 }}>
              <Empty description={<span style={{ color: '#71717a' }}>Chưa có tài sản nào</span>}>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()}>
                  {t('assets.new')}
                </Button>
              </Empty>
            </div>
          ) : (
            <div className="asset-grid">
              {assets.map(asset => (
                <div key={asset.id} className="asset-card">
                  <div className="asset-thumb">
                    {asset.file_path && ['image', 'logo'].includes(asset.asset_type) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.file_path} alt={asset.name} />
                    ) : (
                      <span style={{ fontSize: 40, color: '#71717a' }}>
                        {ASSET_ICONS[asset.asset_type as CopyrightAssetType]}
                      </span>
                    )}
                  </div>
                  <div className="asset-body">
                    <div className="asset-title">{asset.name}</div>
                    <div className="asset-meta">
                      <Tag style={{ textTransform: 'uppercase', fontSize: 10 }}>{asset.asset_type}</Tag>
                      {asset.keywords?.length > 0 && <span>{asset.keywords.length} keywords</span>}
                      {asset.perceptual_hash && <Tag color="success" style={{ fontSize: 10 }}>pHash</Tag>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openDrawer(asset)}>{t('common.edit')}</Button>
                      <Popconfirm title="Xóa asset này?" onConfirm={() => handleDelete(asset.id)} okText="Xóa" cancelText="Hủy">
                        <Button size="small" danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
                      </Popconfirm>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Content>
      </Layout>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? `Sửa: ${editing.name}` : t('assets.new')}
        width={520}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>{t('common.cancel')}</Button>
            <Button type="primary" onClick={handleSubmit} loading={submitting}>
              {editing ? t('common.save') : t('common.create')}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('assets.name')} rules={[{ required: true }]}>
            <Input placeholder="VD: Logo công ty 2024" />
          </Form.Item>
          {!editing && (
            <Form.Item name="assetType" label={t('assets.type')} rules={[{ required: true }]} initialValue="image">
              <Select
                options={[
                  { label: '🖼️ Hình ảnh', value: 'image' },
                  { label: '🏷️ Logo', value: 'logo' },
                  { label: '📹 Video', value: 'video' },
                  { label: '🎵 Audio/Music', value: 'audio' },
                  { label: '📄 Text', value: 'text' },
                  { label: '🏢 Tên thương hiệu', value: 'brand_name' }
                ]}
              />
            </Form.Item>
          )}
          <Form.Item name="keywords" label={t('assets.keywords')} tooltip="Phân cách bằng dấu phẩy">
            <Input placeholder="brand, slogan, tagline" />
          </Form.Item>
          <Form.Item name="officialDomains" label={t('assets.officialDomains')} tooltip="Domain chính thức sẽ giảm điểm risk">
            <Input placeholder="example.com, store.example.com" />
          </Form.Item>
          {watchType === 'audio' && (
            <>
              <Form.Item name="audioTitle" label={t('assets.audioTitle')}>
                <Input placeholder="Tên bài hát" />
              </Form.Item>
              <Form.Item name="audioArtist" label={t('assets.audioArtist')}>
                <Input placeholder="Nghệ sĩ / Người trình bày" />
              </Form.Item>
            </>
          )}
          {['text', 'brand_name'].includes(watchType) && (
            <Form.Item name="textContent" label={t('assets.textContent')}>
              <Input.TextArea rows={4} placeholder="Nội dung văn bản gốc..." />
            </Form.Item>
          )}
          {!editing && ['image', 'logo', 'video', 'audio'].includes(watchType) && (
            <Form.Item label="File">
              <UploadDropzone
                accept={watchType === 'image' || watchType === 'logo' ? 'image/*' : watchType === 'video' ? 'video/*' : 'audio/*'}
                onFile={setFile}
              />
            </Form.Item>
          )}
        </Form>
      </Drawer>
    </Layout>
  )
}
