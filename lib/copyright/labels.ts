import { CopyrightAssetType, FindingStatus, Platform } from '@/types'

export const assetTypeLabels: Record<CopyrightAssetType, string> = {
  brand_name: 'Ten thuong hieu',
  text: 'Van ban',
  image: 'Hinh anh',
  logo: 'Logo',
  video: 'Video',
  audio: 'Audio'
}

export const findingStatusLabels: Record<FindingStatus, string> = {
  new: 'Moi',
  reviewing: 'Dang xem xet',
  confirmed: 'Da xac nhan',
  dismissed: 'Bo qua'
}

export const platformLabels: Record<Platform, string> = {
  facebook: 'Facebook',
  google: 'Google',
  youtube: 'YouTube',
  tiktok: 'TikTok'
}
