export type Platform = 'facebook' | 'google' | 'youtube' | 'tiktok'

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
