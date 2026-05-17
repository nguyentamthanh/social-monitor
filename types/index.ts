export type Platform = 'facebook' | 'google' | 'youtube' | 'tiktok'
export type CopyrightAssetType = 'brand_name' | 'text' | 'image' | 'logo' | 'video' | 'audio'
export type ScanTrigger = 'manual' | 'scheduled'
export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed'
export type FindingStatus = 'new' | 'reviewing' | 'confirmed' | 'dismissed'
export type ConnectorCapability = 'ready' | 'limited' | 'error'

export interface User {
  _id?: string
  email: string
  name: string
  password: string
  createdAt?: Date
}

export interface Keyword {
  _id?: string
  userId: string
  term: string
  platforms: Platform[]
  status: 'active' | 'paused' | 'error'
  refreshInterval: number
  lastFetchedAt?: Date
  createdAt?: Date
}

export interface Author {
  id: string
  name: string
  handle: string
  avatar?: string
}

export interface Metrics {
  likes: number
  shares: number
  comments: number
  views: number
}

export interface Mention {
  _id?: string
  keywordId: string
  platform: Platform
  externalId: string
  author: Author
  content: string
  url: string
  metrics: Metrics
  publishedAt: Date
  fetchedAt: Date
}

export interface TrendData {
  _id?: string
  keywordId: string
  platform: Platform | 'all'
  date: Date
  mentionCount: number
  engagement: number
}

export interface MentionResult {
  platform: Platform
  externalId: string
  author: Author
  content: string
  url: string
  metrics: Metrics
  publishedAt: Date
}

export interface PlatformAdapter {
  platform: Platform
  searchMentions(keyword: string): Promise<MentionResult[]>
}

export interface BrandAsset {
  id: number
  user_id: string
  name: string
  asset_type: CopyrightAssetType
  keywords: string[]
  text_content?: string | null
  official_domains: string[]
  file_name?: string | null
  file_path?: string | null
  file_mime_type?: string | null
  file_size?: number | null
  file_hash?: string | null
  perceptual_hash?: string | null
  audio_metadata?: { title?: string; artist?: string; album?: string } | null
  status: 'active' | 'paused'
  created_at: Date
  updated_at: Date
}

export interface RawCandidate {
  platform: Platform
  source: string
  externalId: string
  title: string
  content: string
  url: string
  author?: Author
  publishedAt?: Date | null
  metadata?: Record<string, unknown>
  media?: {
    thumbnailUrl?: string
    mimeType?: string
    hash?: string
    perceptualHash?: string
  }
}

export interface Notification {
  id: number
  user_id: string
  type: string
  title: string
  message?: string
  payload?: Record<string, unknown>
  read_at?: Date | null
  created_at: Date
}

export interface UserSettings {
  user_id: string
  api_keys: Record<string, string>
  preferences: Record<string, unknown>
  updated_at: Date
}

export interface ConnectorStatus {
  platform: Platform
  capability: ConnectorCapability
  code: string
  message: string
}

export interface ScanRun {
  id: number
  user_id: string
  trigger: ScanTrigger
  status: ScanStatus
  asset_ids: number[]
  platform_status: ConnectorStatus[]
  error_summary: Record<string, unknown>
  findings_count?: number
  started_at: Date
  finished_at?: Date | null
  created_at: Date
}

export interface FindingReason {
  code: string
  label: string
  points: number
}

export interface Finding {
  id: number
  user_id: string
  scan_run_id: number
  asset_id: number
  asset_name?: string
  asset_type?: CopyrightAssetType
  platform: Platform
  source: string
  external_id: string
  title: string
  content: string
  url: string
  author?: Author | null
  risk_score: number
  reasons: FindingReason[]
  status: FindingStatus
  published_at?: Date | null
  found_at: Date
  updated_at: Date
}
