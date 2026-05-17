import { Platform, MentionResult, Metrics, Author } from '@/types'

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || ''

interface GoogleNewsItem {
  title: string
  link: string
  pubDate: string
  description: string
}

interface GoogleNewsResponse {
  items: GoogleNewsItem[]
}

function generateMockMetrics(): Metrics {
  return {
    likes: Math.floor(Math.random() * 10000),
    shares: Math.floor(Math.random() * 2000),
    comments: Math.floor(Math.random() * 1000),
    views: Math.floor(Math.random() * 100000)
  }
}

function generateMockAuthor(platform: Platform) {
  const handles = ['techreviewer', 'dailyupdates', 'viralcontent', 'trendingnow', 'socialguru']
  const names = ['Alex Tech', 'Jordan News', 'Casey Stream', 'Morgan Trends', 'Taylor Social']
  const index = Math.floor(Math.random() * handles.length)
  return {
    id: `user_${Math.random().toString(36).substr(2, 9)}`,
    name: names[index],
    handle: `@${handles[index]}`,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${handles[index]}`
  }
}

export const googleAdapter = {
  platform: 'google' as Platform,

  searchMentions: async (keyword: string): Promise<MentionResult[]> => {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your_google_api_key_here') {
      // Return mock data if no API key
      const count = Math.floor(Math.random() * 5) + 3
      return Array.from({ length: count }, (_, i) => ({
        platform: 'google' as Platform,
        externalId: `goog_${Date.now()}_${i}`,
        author: generateMockAuthor('google'),
        content: `Mock: Everything you need to know about ${keyword}`,
        url: `https://news.google.com/articles/example`,
        metrics: generateMockMetrics(),
        publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      }))
    }

    try {
      // Use Google News RSS with search
      const response = await fetch(
        `https://news.googleapis.com/news/rss/search?q=${encodeURIComponent(keyword)}&key=${GOOGLE_API_KEY}&lang=en`
      )

      if (!response.ok) {
        throw new Error(`Google API error: ${response.status}`)
      }

      const text = await response.text()
      const parser = new DOMParser()
      const xml = parser.parseFromString(text, 'text/xml')
      const items = xml.querySelectorAll('item')

      const mentions: MentionResult[] = []
      items.forEach((item, i) => {
        const title = item.querySelector('title')?.textContent || ''
        const link = item.querySelector('link')?.textContent || ''
        const description = item.querySelector('description')?.textContent || ''
        const pubDateStr = item.querySelector('pubDate')?.textContent || ''

        mentions.push({
          platform: 'google' as Platform,
          externalId: `goog_${Date.now()}_${i}`,
          author: {
            id: `google_user_${i}`,
            name: 'Google News',
            handle: '@googlenews',
            avatar: ''
          },
          content: title || description.substring(0, 200),
          url: link || '',
          metrics: { likes: 0, shares: 0, comments: 0, views: Math.floor(Math.random() * 5000) },
          publishedAt: pubDateStr ? new Date(pubDateStr) : new Date()
        })
      })

      return mentions
    } catch (error) {
      console.error('Google search error:', error)
      return []
    }
  }
}

export const facebookAdapter = {
  platform: 'facebook' as Platform,

  searchMentions: async (keyword: string): Promise<MentionResult[]> => {
    const token = process.env.FACEBOOK_ACCESS_TOKEN || ''

    if (!token || token === 'your_facebook_access_token_here') {
      const count = Math.floor(Math.random() * 5) + 3
      return Array.from({ length: count }, (_, i) => ({
        platform: 'facebook' as Platform,
        externalId: `fb_${Date.now()}_${i}`,
        author: generateMockAuthor('facebook'),
        content: `Mock: ${keyword} is trending on Facebook!`,
        url: `https://facebook.com/posts/example`,
        metrics: generateMockMetrics(),
        publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      }))
    }

    try {
      // Facebook Graph API - search for posts
      const response = await fetch(
        `https://graph.facebook.com/v18.0/search?q=${encodeURIComponent(keyword)}&type=post&access_token=${token}`
      )

      if (!response.ok) {
        throw new Error(`Facebook API error: ${response.status}`)
      }

      const data = await response.json()
      const posts = data.data || []

      return posts.slice(0, 10).map((post: any, i: number) => ({
        platform: 'facebook' as Platform,
        externalId: post.id || `fb_${Date.now()}_${i}`,
        author: {
          id: post.from?.id || 'unknown',
          name: post.from?.name || 'Facebook User',
          handle: `@${post.from?.name?.replace(/\s/g, '').toLowerCase() || 'user'}`,
          avatar: ''
        },
        content: post.message || post.full_text || '',
        url: post.permalink_url || `https://facebook.com/${post.id}`,
        metrics: {
          likes: post.likes?.summary?.total_count || 0,
          shares: post.shares?.summary?.total_count || 0,
          comments: post.comments?.summary?.total_count || 0,
          views: 0
        },
        publishedAt: post.created_time ? new Date(post.created_time) : new Date()
      }))
    } catch (error) {
      console.error('Facebook search error:', error)
      return []
    }
  }
}

export const youtubeAdapter = {
  platform: 'youtube' as Platform,

  searchMentions: async (keyword: string): Promise<MentionResult[]> => {
    const apiKey = process.env.YOUTUBE_API_KEY || ''

    if (!apiKey || apiKey === 'your_youtube_api_key_here') {
      const count = Math.floor(Math.random() * 5) + 3
      return Array.from({ length: count }, (_, i) => ({
        platform: 'youtube' as Platform,
        externalId: `yt_${Date.now()}_${i}`,
        author: generateMockAuthor('youtube'),
        content: `Mock: Amazing tutorial about ${keyword}! Must watch!`,
        url: `https://youtube.com/watch?v=example`,
        metrics: generateMockMetrics(),
        publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      }))
    }

    try {
      // YouTube Data API v3 - search
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?q=${encodeURIComponent(keyword)}&part=snippet&type=video&maxResults=10&key=${apiKey}`
      )

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`)
      }

      const data = await response.json()
      const items = data.items || []

      return items.map((item: any) => ({
        platform: 'youtube' as Platform,
        externalId: item.id?.videoId || `yt_${Date.now()}`,
        author: {
          id: item.snippet?.channelId || 'unknown',
          name: item.snippet?.channelTitle || 'YouTube Channel',
          handle: `@${item.snippet?.channelTitle?.replace(/\s/g, '').toLowerCase() || 'channel'}`,
          avatar: item.snippet?.thumbnails?.default?.url || ''
        },
        content: item.snippet?.title || '',
        url: `https://youtube.com/watch?v=${item.id?.videoId}`,
        metrics: { likes: 0, shares: 0, comments: 0, views: Math.floor(Math.random() * 100000) },
        publishedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : new Date()
      }))
    } catch (error) {
      console.error('YouTube search error:', error)
      return []
    }
  }
}

export const tiktokAdapter = {
  platform: 'tiktok' as Platform,

  searchMentions: async (keyword: string): Promise<MentionResult[]> => {
    const token = process.env.TIKTOK_ACCESS_TOKEN || ''

    if (!token || token === 'your_tiktok_access_token_here') {
      const count = Math.floor(Math.random() * 5) + 3
      return Array.from({ length: count }, (_, i) => ({
        platform: 'tiktok' as Platform,
        externalId: `tt_${Date.now()}_${i}`,
        author: generateMockAuthor('tiktok'),
        content: `Mock: Quick tips on ${keyword} #tech #viral`,
        url: `https://tiktok.com/@user/video/example`,
        metrics: generateMockMetrics(),
        publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      }))
    }

    try {
      // TikTok API
      const response = await fetch(
        `https://open.tiktokapis.com/v2/video/search/?keywords=${encodeURIComponent(keyword)}&count=10`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`TikTok API error: ${response.status}`)
      }

      const data = await response.json()
      const videos = data.data?.videos || []

      return videos.map((video: any, i: number) => ({
        platform: 'tiktok' as Platform,
        externalId: video.id || `tt_${Date.now()}_${i}`,
        author: {
          id: video.author?.id || 'unknown',
          name: video.author?.nickname || 'TikTok User',
          handle: `@${video.author?.unique_id || 'user'}`,
          avatar: video.author?.avatar_url || ''
        },
        content: video.title || video.desc || '',
        url: `https://tiktok.com/@${video.author?.unique_id || 'user'}/video/${video.id}`,
        metrics: {
          likes: video.statistics?.digg_count || 0,
          shares: video.statistics?.share_count || 0,
          comments: video.statistics?.comment_count || 0,
          views: video.statistics?.play_count || 0
        },
        publishedAt: video.create_time ? new Date(video.create_time * 1000) : new Date()
      }))
    } catch (error) {
      console.error('TikTok search error:', error)
      return []
    }
  }
}

export const adapters = {
  facebook: facebookAdapter,
  google: googleAdapter,
  youtube: youtubeAdapter,
  tiktok: tiktokAdapter
}

export function getAdapter(platform: Platform) {
  return adapters[platform]
}
