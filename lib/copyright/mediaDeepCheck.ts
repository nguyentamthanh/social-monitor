import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { computePHash, hammingDistance } from '@/lib/copyright/imageHash'

export interface MediaDeepCheckResult {
  available: boolean
  skippedReason?: string
  originalVideoId: string
  candidateVideoId: string
  audio?: {
    checked: boolean
    similarity: number
    matched: boolean
    skippedReason?: string
  }
  video?: {
    checked: boolean
    bestFrameSimilarity: number
    matched: boolean
    matchedFrames: number
    skippedReason?: string
  }
}

interface DeepCheckOptions {
  maxSeconds?: number
  frameIntervalSeconds?: number
}

interface MediaTools {
  ytDlp: string | null
  ffmpeg: string | null
  fpcalc: string | null
}

const DEFAULT_MAX_SECONDS = 180
const DEFAULT_FRAME_INTERVAL_SECONDS = 10
const VIDEO_MATCH_THRESHOLD = 0.82
const AUDIO_MATCH_THRESHOLD = 0.72

export async function checkYouTubeMediaSimilarity(
  originalVideoId: string,
  candidateVideoId: string,
  options: DeepCheckOptions = {}
): Promise<MediaDeepCheckResult> {
  const tools = await getToolAvailability()
  if (!tools.ytDlp || !tools.ffmpeg) {
    return {
      available: false,
      skippedReason: 'Cần cài yt-dlp và ffmpeg để tải/trích media.',
      originalVideoId,
      candidateVideoId
    }
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'copyright-media-'))
  try {
    const maxSeconds = options.maxSeconds ?? DEFAULT_MAX_SECONDS
    const frameIntervalSeconds = options.frameIntervalSeconds ?? DEFAULT_FRAME_INTERVAL_SECONDS
    const originalUrl = youtubeUrl(originalVideoId)
    const candidateUrl = youtubeUrl(candidateVideoId)

    const originalAudioStem = path.join(workDir, 'original-audio')
    const candidateAudioStem = path.join(workDir, 'candidate-audio')
    const originalVideoStem = path.join(workDir, 'original-video')
    const candidateVideoStem = path.join(workDir, 'candidate-video')

    const [audioDownload, videoDownload] = await Promise.all([
      Promise.all([
        downloadMedia(tools.ytDlp, tools.ffmpeg, originalUrl, originalAudioStem, 'audio', maxSeconds),
        downloadMedia(tools.ytDlp, tools.ffmpeg, candidateUrl, candidateAudioStem, 'audio', maxSeconds)
      ]),
      Promise.all([
        downloadMedia(tools.ytDlp, tools.ffmpeg, originalUrl, originalVideoStem, 'video', maxSeconds),
        downloadMedia(tools.ytDlp, tools.ffmpeg, candidateUrl, candidateVideoStem, 'video', maxSeconds)
      ])
    ])

    const [originalAudio, candidateAudio] = audioDownload
    const [originalVideo, candidateVideo] = videoDownload

    const [audio, video] = await Promise.all([
      compareAudio(originalAudio, candidateAudio, tools.fpcalc),
      compareVideoFrames(
        originalVideo,
        candidateVideo,
        workDir,
        frameIntervalSeconds
      )
    ])

    return {
      available: true,
      originalVideoId,
      candidateVideoId,
      audio,
      video
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function getToolAvailability(): Promise<MediaTools> {
  const [ytDlp, ffmpeg, fpcalc] = await Promise.all([
    resolveCommand('yt-dlp', 'YTDLP_PATH'),
    resolveCommand('ffmpeg', 'FFMPEG_PATH'),
    resolveCommand('fpcalc', 'FPCALC_PATH')
  ])
  return { ytDlp, ffmpeg, fpcalc }
}

async function resolveCommand(command: string, envKey: string): Promise<string | null> {
  const envValue = process.env[envKey]
  const candidates = [
    envValue,
    command,
    ...wingetCandidates(command)
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const result = await run(candidate, command === 'ffmpeg' || command === 'fpcalc' ? ['-version'] : ['--version'], 8_000)
    if (result.exitCode === 0) return candidate
  }

  return null
}

function wingetCandidates(command: string): string[] {
  if (process.platform !== 'win32') return []
  const localAppData = process.env.LOCALAPPDATA
  if (!localAppData) return []

  const packagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages')
  if (command === 'yt-dlp') {
    return [path.join(packagesDir, 'yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe', 'yt-dlp.exe')]
  }
  if (command === 'ffmpeg') {
    return [
      path.join(
        packagesDir,
        'yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe',
        'ffmpeg-N-124279-g0f6ba39122-win64-gpl',
        'bin',
        'ffmpeg.exe'
      )
    ]
  }
  if (command === 'fpcalc') {
    return [
      path.join(
        packagesDir,
        'AcoustID.Chromaprint_Microsoft.Winget.Source_8wekyb3d8bbwe',
        'chromaprint-fpcalc-1.6.0-windows-x86_64',
        'fpcalc.exe'
      )
    ]
  }
  return []
}

async function downloadMedia(
  ytDlpCommand: string,
  ffmpegCommand: string,
  url: string,
  outputStem: string,
  kind: 'audio' | 'video',
  maxSeconds: number
): Promise<string | null> {
  const format =
    kind === 'audio'
      ? 'ba[ext=m4a]/ba'
      : 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/bv*[height<=720]+ba/best[height<=720]/best'

  const args = [
    '--no-playlist',
    '--quiet',
    '--no-warnings',
    '--download-sections',
    `*0-${maxSeconds}`,
    '-f',
    format,
    '--ffmpeg-location',
    path.dirname(ffmpegCommand),
    '-o',
    `${outputStem}.%(ext)s`
  ]
  if (kind === 'audio') {
    args.push('-x', '--audio-format', 'm4a')
  } else {
    args.push('--merge-output-format', 'mp4')
  }
  args.push(url)

  const result = await run(ytDlpCommand, args, 180_000)
  if (result.exitCode !== 0) return null

  const dir = path.dirname(outputStem)
  const base = path.basename(outputStem)
  const files = await fs.readdir(dir)
  for (const file of files) {
    if (!file.startsWith(`${base}.`)) continue
    const fullPath = path.join(dir, file)
    const stat = await fs.stat(fullPath)
    if (stat.size > 0) return fullPath
  }

  return null
}

async function compareAudio(
  originalAudio: string | null,
  candidateAudio: string | null,
  fpcalcCommand: string | null
): Promise<MediaDeepCheckResult['audio']> {
  if (!originalAudio || !candidateAudio) {
    return {
      checked: false,
      similarity: 0,
      matched: false,
      skippedReason: 'Không tải được audio để fingerprint.'
    }
  }
  if (!fpcalcCommand) {
    return {
      checked: false,
      similarity: 0,
      matched: false,
      skippedReason: 'Cần cài fpcalc/chromaprint để so audio fingerprint.'
    }
  }

  const [original, candidate] = await Promise.all([
    fingerprintAudio(fpcalcCommand, originalAudio),
    fingerprintAudio(fpcalcCommand, candidateAudio)
  ])
  if (original.length === 0 || candidate.length === 0) {
    return {
      checked: false,
      similarity: 0,
      matched: false,
      skippedReason: 'Không tạo được audio fingerprint.'
    }
  }

  const similarity = compareFingerprintWindows(original, candidate)
  return {
    checked: true,
    similarity,
    matched: similarity >= AUDIO_MATCH_THRESHOLD
  }
}

async function fingerprintAudio(fpcalcCommand: string, filePath: string): Promise<number[]> {
  const result = await run(fpcalcCommand, ['-raw', '-json', '-length', String(DEFAULT_MAX_SECONDS), filePath], 60_000)
  if (result.exitCode !== 0 || !result.stdout.trim()) return []

  try {
    const parsed = JSON.parse(result.stdout) as { fingerprint?: string | number[] }
    if (Array.isArray(parsed.fingerprint)) return parsed.fingerprint.map(Number).filter(Number.isFinite)
    if (typeof parsed.fingerprint === 'string') {
      return parsed.fingerprint
        .split(',')
        .map(value => Number(value.trim()))
        .filter(Number.isFinite)
    }
  } catch {
    return []
  }

  return []
}

async function compareVideoFrames(
  originalVideo: string | null,
  candidateVideo: string | null,
  workDir: string,
  frameIntervalSeconds: number
): Promise<MediaDeepCheckResult['video']> {
  if (!originalVideo || !candidateVideo) {
    return {
      checked: false,
      bestFrameSimilarity: 0,
      matched: false,
      matchedFrames: 0,
      skippedReason: 'Không tải được video để trích frame.'
    }
  }

  const originalDir = path.join(workDir, 'original-frames')
  const candidateDir = path.join(workDir, 'candidate-frames')
  await Promise.all([fs.mkdir(originalDir), fs.mkdir(candidateDir)])

  const [originalOk, candidateOk] = await Promise.all([
    extractFrames(originalVideo, originalDir, frameIntervalSeconds),
    extractFrames(candidateVideo, candidateDir, frameIntervalSeconds)
  ])
  if (!originalOk || !candidateOk) {
    return {
      checked: false,
      bestFrameSimilarity: 0,
      matched: false,
      matchedFrames: 0,
      skippedReason: 'Không trích được frame từ video.'
    }
  }

  const [originalHashes, candidateHashes] = await Promise.all([hashFrames(originalDir), hashFrames(candidateDir)])
  if (originalHashes.length === 0 || candidateHashes.length === 0) {
    return {
      checked: false,
      bestFrameSimilarity: 0,
      matched: false,
      matchedFrames: 0,
      skippedReason: 'Không tạo được frame hash.'
    }
  }

  let bestFrameSimilarity = 0
  let matchedFrames = 0
  for (const original of originalHashes) {
    let bestForFrame = 0
    for (const candidate of candidateHashes) {
      const similarity = 1 - hammingDistance(original, candidate) / 64
      bestForFrame = Math.max(bestForFrame, similarity)
    }
    bestFrameSimilarity = Math.max(bestFrameSimilarity, bestForFrame)
    if (bestForFrame >= VIDEO_MATCH_THRESHOLD) matchedFrames += 1
  }

  return {
    checked: true,
    bestFrameSimilarity,
    matched: matchedFrames >= 2 || bestFrameSimilarity >= 0.9,
    matchedFrames
  }
}

async function extractFrames(videoPath: string, outputDir: string, intervalSeconds: number): Promise<boolean> {
  const outputPattern = path.join(outputDir, 'frame-%03d.jpg')
  const result = await run(
    (await getToolAvailability()).ffmpeg || 'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-i', videoPath, '-vf', `fps=1/${intervalSeconds}`, '-frames:v', '18', outputPattern],
    90_000
  )
  if (result.exitCode !== 0) return false
  const files = await fs.readdir(outputDir)
  return files.some(file => /\.(jpe?g|png)$/i.test(file))
}

async function hashFrames(frameDir: string): Promise<string[]> {
  const files = (await fs.readdir(frameDir))
    .filter(file => /\.(jpe?g|png)$/i.test(file))
    .sort()

  const hashes: string[] = []
  for (const file of files) {
    const buffer = await fs.readFile(path.join(frameDir, file))
    hashes.push(await computePHash(buffer))
  }
  return hashes
}

function compareFingerprintWindows(a: number[], b: number[]): number {
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (shorter.length === 0 || longer.length === 0) return 0

  const windowSize = Math.min(shorter.length, longer.length, 120)
  let best = 0
  const maxOffset = Math.max(0, longer.length - windowSize)
  const step = Math.max(1, Math.floor(windowSize / 12))

  for (let offset = 0; offset <= maxOffset; offset += step) {
    let totalBits = 0
    let sameBits = 0
    for (let i = 0; i < windowSize; i++) {
      const xor = (shorter[i] ^ longer[offset + i]) >>> 0
      const diff = popCount32(xor)
      totalBits += 32
      sameBits += 32 - diff
    }
    best = Math.max(best, sameBits / totalBits)
  }

  return best
}

function popCount32(value: number): number {
  let count = 0
  let current = value >>> 0
  while (current) {
    current &= current - 1
    count += 1
  }
  return count
}

function youtubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

function run(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    const child = spawn(command, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stdout?.on('data', chunk => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', chunk => {
      stderr += chunk.toString()
    })
    child.on('error', error => {
      clearTimeout(timer)
      resolve({ exitCode: 127, stdout, stderr: error.message })
    })
    child.on('close', exitCode => {
      clearTimeout(timer)
      resolve({ exitCode, stdout, stderr })
    })
  })
}
