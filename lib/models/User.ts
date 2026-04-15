import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IUser extends Document {
  email: string
  name: string
  password: string
  createdAt: Date
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
})

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
