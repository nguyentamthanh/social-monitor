'use client'

import { CloudUploadOutlined, FileImageOutlined } from '@ant-design/icons'
import { useRef, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

interface Props {
  onFile: (file: File) => void
  accept?: string
  hint?: string
}

export default function UploadDropzone({ onFile, accept, hint }: Props) {
  const { t } = useTranslation()
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<{ name: string; size: number } | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleFile = (file: File) => {
    setPreview({ name: file.name, size: file.size })
    onFile(file)
  }

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      {preview ? (
        <div>
          <FileImageOutlined style={{ fontSize: 32, color: '#06b6d4', marginBottom: 12 }} />
          <div style={{ color: '#fafafa', fontWeight: 600, marginBottom: 4 }}>{preview.name}</div>
          <div style={{ color: '#71717a', fontSize: 12 }}>{(preview.size / 1024).toFixed(1)} KB</div>
        </div>
      ) : (
        <div>
          <CloudUploadOutlined className="dropzone-icon" />
          <div style={{ color: '#fafafa', fontWeight: 500, marginBottom: 4 }}>{t('assets.upload')}</div>
          <div style={{ color: '#71717a', fontSize: 12 }}>{hint || t('assets.uploadHint')}</div>
        </div>
      )}
    </div>
  )
}
