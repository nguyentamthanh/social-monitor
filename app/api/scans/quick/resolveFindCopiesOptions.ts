export type YouTubeQuickScanMode = 'fast' | 'deep'

export function resolveFindCopiesOptions(
  mode?: string | null
): { deepMediaCheck: boolean; thumbnailMatch?: boolean } {
  if (mode === 'fast') return { deepMediaCheck: false, thumbnailMatch: false }
  return { deepMediaCheck: true }
}

