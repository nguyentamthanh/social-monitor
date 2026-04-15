import mongoose, { Schema, Document, Model } from 'mongoose'
import { Platform } from '@/types'

export interface IKeyword extends Document {
  userId: string
  term: string
  platforms: Platform[]
  status: 'active' | 'paused' | 'error'
  refreshInterval: number
  lastFetchedAt?: Date
  createdAt: Date
}

const KeywordSchema = new Schema<IKeyword>({
  userId: { type: String, required: true },
  term: { type: String, required: true },
  platforms: [{ type: String, enum: ['facebook', 'google', 'youtube', 'tiktok'] }],
  status: { type: String, enum: ['active', 'paused', 'error'], default: 'active' },
  refreshInterval: { type: Number, default: 3600000 },
  lastFetchedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
})

export const Keyword: Model<IKeyword> = mongoose.models.Keyword || mongoose.model<IKeyword>('Keyword', KeywordSchema)
