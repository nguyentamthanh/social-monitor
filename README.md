# Copyright Monitor

Dashboard giám sát bản quyền thương hiệu cho **text · ảnh · video · âm nhạc** trên Web, YouTube và Google.

Stack: Next.js 16 · React 19 · Neon Postgres · NextAuth · Ant Design · TypeScript · Sharp · Vercel Blob.

## Tính năng chính

- **Copyright Scan** cho 4 loại media:
  - **Text** — similarity Jaccard (uni + bigram) + keyword match
  - **Image / Logo** — perceptual hash (pHash 64-bit, DCT-based) + Hamming distance
  - **Video** — YouTube Data API + thumbnail pHash matching
  - **Audio / Music** — title + artist matching qua YouTube Music + Google streaming hosts
- **3-step Scan Wizard**: chọn tài sản → chọn nền tảng → chạy
- **Text Policy Checker** — kiểm tra văn bản theo chính sách YouTube/TikTok/Facebook/Google
- **Brand Asset CRUD** — upload ảnh/video/audio, tự động compute SHA-256 + pHash
- **Findings workflow** — new → reviewing → confirmed → dismissed, kèm lý do điểm số explainable
- **Notifications** — tự động tạo khi quét phát hiện vi phạm
- **Settings** — lưu API keys trong DB, encrypt AES-256-GCM với `NEXTAUTH_SECRET`
- **i18n Vi/En** — toggle ngay trên header
- **Dark Modern SaaS UI** — gradient violet/cyan, glassmorphism

## Setup local

```bash
npm install
cp .env.example .env.local
# Điền NEON_DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL=http://localhost:3000
npm run dev
```

Mở http://localhost:3000.

## Environment Variables

| Key | Required | Mục đích |
|---|---|---|
| `NEON_DATABASE_URL` | ✅ | Postgres connection (Neon) |
| `NEXTAUTH_SECRET` | ✅ | JWT signing + AES key cho API keys |
| `NEXTAUTH_URL` | ✅ | Base URL (localhost:3000 hoặc Vercel domain) |
| `BLOB_READ_WRITE_TOKEN` | ⚠️ prod | Vercel Blob; nếu thiếu, fallback ghi `public/uploads` (chỉ local) |
| `YOUTUBE_API_KEY` | optional | Cho phép quét YouTube + YouTube Music |
| `GOOGLE_SEARCH_API_KEY` | optional | Custom Search JSON API |
| `GOOGLE_SEARCH_ENGINE_ID` | optional | CX ID từ cse.google.com |
| `FACEBOOK_ACCESS_TOKEN` | optional | Hiện đang limited (cần Meta app review) |
| `TIKTOK_ACCESS_TOKEN` | optional | Hiện đang limited (cần TikTok Research API) |

## Deploy lên Vercel

1. Push repo lên GitHub
2. Import vào [Vercel Dashboard](https://vercel.com/new)
3. Trong project Settings → Environment Variables, set tất cả keys ở bảng trên
4. Trong Storage tab → **Create Blob Store**, sao chép `BLOB_READ_WRITE_TOKEN` vào env vars
5. Deploy

Function timeouts đã được cấu hình sẵn trong [`vercel.json`](vercel.json) (60s cho `/api/scans`).

## Architecture

```
app/                    # Next.js app router pages
  api/                  # REST endpoints (assets, scans, findings, settings, notifications, ...)
  dashboard/            # Hero dashboard với Scan Wizard CTA
  scans/                # Scan history + wizard launcher
  assets/               # Brand asset grid + drawer CRUD
  findings/             # Grid/Table view + detail drawer
  text-check/           # Policy checker UI
  settings/             # API keys + preferences
  (auth)/login,register # Split-hero auth

components/
  layout/Sidebar.tsx    # Glass dark sidebar
  layout/Header.tsx     # Glassmorphism + notification bell + locale switch
  ui/ScanWizard.tsx     # 3-step wizard drawer
  ui/UploadDropzone.tsx # Drag-drop file picker
  ui/PlatformBadge.tsx, RiskPill.tsx, LocaleSwitch.tsx

lib/
  db.ts                 # Init + cached migrations (brand_assets, scan_runs, findings, evidence_items, user_settings, notifications)
  neon.ts               # Postgres pool
  auth.ts               # NextAuth config
  crypto.ts             # AES-256-GCM cho API keys
  i18n/                 # Vi/En messages + React context
  copyright/
    scoring.ts          # Risk scoring (brand match, text similarity, pHash, audio metadata, domain)
    adapters.ts         # YouTube + Google + Facebook + TikTok connectors
    scanner.ts          # Orchestrator: candidates → scoring → findings
    imageHash.ts        # DCT-based perceptual hash + Hamming distance
    audioMatcher.ts     # Title/artist normalization + streaming host hint
  policies/textPolicy.ts # Text rules for YouTube/TikTok/etc
  models/                # CopyrightMonitor, Notification, UserSettings, Keyword, Mention, User, TrendData
```

## Testing

```bash
npm run test:copyright   # Scoring unit tests
npm run typecheck        # tsc --noEmit
npm run lint             # next lint
npm run build            # next build
```

## Notes

- Facebook & TikTok adapters trả về `limited` cho đến khi có Meta app review / TikTok Research API approval.
- Image pHash hoạt động tốt nhất khi ảnh gốc và ảnh tìm thấy ≥ 256px. Hamming distance ≤ 10 ⇒ điểm cao.
- Audio scan dùng metadata matching (title + artist normalized). Để fingerprint thực sự cần thêm AudD.io hoặc AcoustID (paid).
- Settings page lưu API keys riêng cho user vào DB, mã hóa AES-256-GCM. Adapters hiện vẫn dùng env vars; merge user settings sẽ là phase tiếp theo.
