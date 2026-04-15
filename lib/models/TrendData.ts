import mongoose, { Schema, Document, Model } from 'mongoose'
import { Platform } from '@/types'

export interface ITrendData extends Document {
  keywordId: string
  platform: Platform | 'all'
  date: Date
  mentionCount: number
  engagement: number
}

const TrendDataSchema = new Schema<ITrendData>({
  keywordId: { type: String, required: true, index: true },
  platform: { type: String, enum: ['facebook', 'google', 'youtube', 'tiktok', 'all'], required: true },
  date: { type: Date, required: true },
  mentionCount: { type: Number, default: 0 },
  engagement: { type: Number, default: 0 }
})

TrendDataSchema.index({ keywordId: 1, platform: 1, date: -1 })

export const TrendData: Model<ITrendData> = mongoose.models.TrendData || mongoose.model<ITrendData>('TrendData', TrendDataSchema)
