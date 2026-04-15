import mongoose, { Schema, Document, Model } from 'mongoose'
import { Platform, Author, Metrics } from '@/types'

export interface IMention extends Document {
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

const MentionSchema = new Schema<IMention>({
  keywordId: { type: String, required: true, index: true },
  platform: { type: String, enum: ['facebook', 'google', 'youtube', 'tiktok'], required: true },
  externalId: { type: String, required: true },
  author: {
    id: { type: String, required: true },
    name: { type: String, required: true },
    handle: { type: String, required: true },
    avatar: { type: String }
  },
  content: { type: String, required: true },
  url: { type: String, required: true },
  metrics: {
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    views: { type: Number, default: 0 }
  },
  publishedAt: { type: Date, required: true },
  fetchedAt: { type: Date, default: Date.now }
})

MentionSchema.index({ keywordId: 1, platform: 1, publishedAt: -1 })

export const Mention: Model<IMention> = mongoose.models.Mention || mongoose.model<IMention>('Mention', MentionSchema)
