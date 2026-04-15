import { Platform, MentionResult, Metrics } from '@/types'

const generateMockMetrics = (): Metrics => ({
  likes: Math.floor(Math.random() * 10000),
  shares: Math.floor(Math.random() * 2000),
  comments: Math.floor(Math.random() * 1000),
  views: Math.floor(Math.random() * 100000)
})

const generateMockContent = (keyword: string, platform: Platform): string => {
  const templates = [
    `Just discovered how ${keyword} is changing the game!`,
    `Why ${keyword} is the hottest topic right now`,
    `${keyword} - everyone is talking about it!`,
    `The truth about ${keyword} you need to know`,
    `How ${keyword} impacted my life significantly`,
    `${keyword} review after months of use`,
    `Breaking: ${keyword} announces major changes`,
    `What experts say about ${keyword}`,
    `${keyword} trends we are seeing in 2024`,
    `The ultimate guide to ${keyword}`
  ]
  return templates[Math.floor(Math.random() * templates.length)]
}

const generateMockAuthor = (platform: Platform) => {
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

export const facebookAdapter = {
  platform: 'facebook' as Platform,
  searchMentions: async (keyword: string): Promise<MentionResult[]> => {
    await new Promise(resolve => setTimeout(resolve, 100))
    const count = Math.floor(Math.random() * 5) + 3
    return Array.from({ length: count }, (_, i) => ({
      platform: 'facebook' as Platform,
      externalId: `fb_${Date.now()}_${i}`,
      author: generateMockAuthor('facebook'),
      content: generateMockContent(keyword, 'facebook'),
      url: `https://facebook.com/posts/${Math.random().toString(36).substr(2, 9)}`,
      metrics: generateMockMetrics(),
      publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    }))
  }
}

export const googleAdapter = {
  platform: 'google' as Platform,
  searchMentions: async (keyword: string): Promise<MentionResult[]> => {
    await new Promise(resolve => setTimeout(resolve, 100))
    const count = Math.floor(Math.random() * 5) + 3
    return Array.from({ length: count }, (_, i) => ({
      platform: 'google' as Platform,
      externalId: `goog_${Date.now()}_${i}`,
      author: generateMockAuthor('google'),
      content: generateMockContent(keyword, 'google'),
      url: `https://news.google.com/articles/${Math.random().toString(36).substr(2, 9)}`,
      metrics: generateMockMetrics(),
      publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    }))
  }
}

export const youtubeAdapter = {
  platform: 'youtube' as Platform,
  searchMentions: async (keyword: string): Promise<MentionResult[]> => {
    await new Promise(resolve => setTimeout(resolve, 100))
    const count = Math.floor(Math.random() * 5) + 3
    return Array.from({ length: count }, (_, i) => ({
      platform: 'youtube' as Platform,
      externalId: `yt_${Date.now()}_${i}`,
      author: generateMockAuthor('youtube'),
      content: generateMockContent(keyword, 'youtube'),
      url: `https://youtube.com/watch?v=${Math.random().toString(36).substr(2, 11)}`,
      metrics: generateMockMetrics(),
      publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    }))
  }
}

export const tiktokAdapter = {
  platform: 'tiktok' as Platform,
  searchMentions: async (keyword: string): Promise<MentionResult[]> => {
    await new Promise(resolve => setTimeout(resolve, 100))
    const count = Math.floor(Math.random() * 5) + 3
    return Array.from({ length: count }, (_, i) => ({
      platform: 'tiktok' as Platform,
      externalId: `tt_${Date.now()}_${i}`,
      author: generateMockAuthor('tiktok'),
      content: generateMockContent(keyword, 'tiktok'),
      url: `https://tiktok.com/@user/video/${Math.floor(Math.random() * 999999999999)}`,
      metrics: generateMockMetrics(),
      publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    }))
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
