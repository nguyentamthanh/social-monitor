# YouTube Fast/Deep mode (Quick Scan) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm lựa chọn Fast/Deep cho YouTube URL trong Scans “Quét ngay” để giảm pending ở Fast mode (tắt check âm thanh + hình ảnh), vẫn giữ transcript; Deep mode giữ hành vi hiện tại.

**Architecture:** UI thêm toggle lưu vào localStorage và gửi `mode` qua FormData tới `/api/scans/quick`. Backend map `mode` vào options của `findCopies()` để tắt `deepMediaCheck` và `thumbnailMatch` khi Fast.

**Tech Stack:** Next.js App Router, TypeScript, Ant Design, node:test + tsx test runner (bun).

---

## File map (sẽ tạo/sửa)

**Modify**
- `c:\Users\ADMIN\Desktop\social-monitor\app\scans\page.tsx` — UI toggle Fast/Deep + localStorage + gửi mode.
- `c:\Users\ADMIN\Desktop\social-monitor\app\api\scans\quick\route.ts` — đọc mode, gọi `findCopies()` theo mode.
- `c:\Users\ADMIN\Desktop\social-monitor\lib\copyright\findCopies.ts` — thêm option `thumbnailMatch?: boolean` và skip thumbnail matching khi false.

**Create**
- `c:\Users\ADMIN\Desktop\social-monitor\scripts\youtube-fast-deep-mode.test.ts` — tests cho mapping mode → options và logic thumbnail/deep flags (TDD).

---

## Task 1: Thêm tests (RED) cho mode mapping ở API route

**Files:**
- Create: `c:\Users\ADMIN\Desktop\social-monitor\scripts\youtube-fast-deep-mode.test.ts`
- Modify (sau đó): `c:\Users\ADMIN\Desktop\social-monitor\app\api\scans\quick\route.ts`

- [ ] **Step 1: Write failing test** (test logic mapping mode → options)

```ts
import test from 'node:test'
import assert from 'node:assert/strict'

// tạo helper thuần để test: resolveFindCopiesOptions(mode)
import { resolveFindCopiesOptions } from '../app/api/scans/quick/resolveFindCopiesOptions'

test('resolveFindCopiesOptions: fast -> tắt deepMediaCheck & thumbnailMatch', () => {
  assert.deepEqual(resolveFindCopiesOptions('fast'), { deepMediaCheck: false, thumbnailMatch: false })
})

test('resolveFindCopiesOptions: deep/undefined -> bật deepMediaCheck, thumbnailMatch mặc định', () => {
  assert.deepEqual(resolveFindCopiesOptions('deep'), { deepMediaCheck: true })
  assert.deepEqual(resolveFindCopiesOptions(undefined), { deepMediaCheck: true })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
bun x tsx --test scripts/youtube-fast-deep-mode.test.ts
```
Expected: FAIL vì chưa có file/module `resolveFindCopiesOptions`.

- [ ] **Step 3: Minimal implementation** (GREEN)

Create file:
`c:\Users\ADMIN\Desktop\social-monitor\app\api\scans\quick\resolveFindCopiesOptions.ts`

```ts
export type YouTubeQuickScanMode = 'fast' | 'deep'

export function resolveFindCopiesOptions(mode?: string | null): { deepMediaCheck: boolean; thumbnailMatch?: boolean } {
  if (mode === 'fast') return { deepMediaCheck: false, thumbnailMatch: false }
  return { deepMediaCheck: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
bun x tsx --test scripts/youtube-fast-deep-mode.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/youtube-fast-deep-mode.test.ts app/api/scans/quick/resolveFindCopiesOptions.ts
git commit -m "test: add quick scan mode resolver"
```

---

## Task 2: TDD cho `findCopies` — thêm `thumbnailMatch` và đảm bảo fast mode không chạy thumbnail logic

**Files:**
- Modify: `c:\Users\ADMIN\Desktop\social-monitor\lib\copyright\findCopies.ts`
- Modify (test): `c:\Users\ADMIN\Desktop\social-monitor\scripts\youtube-fast-deep-mode.test.ts`

- [ ] **Step 1: Write failing tests**

Append vào `scripts/youtube-fast-deep-mode.test.ts`:

```ts
import { buildFindCopiesInternalsForTest } from '../lib/copyright/findCopies'

test('findCopies internals: thumbnailMatch=false -> wantPHash=false', () => {
  const internals = buildFindCopiesInternalsForTest({ deepMediaCheck: false, thumbnailMatch: false })
  assert.equal(internals.wantPHash, false)
})

test('findCopies internals: thumbnailMatch undefined -> wantPHash=true', () => {
  const internals = buildFindCopiesInternalsForTest({ deepMediaCheck: false })
  assert.equal(internals.wantPHash, true)
})
```

> Ghi chú: để test ổn định mà không mock `fetch`, ta expose 1 hàm nhỏ chỉ trả về cấu hình nội bộ (refactor an toàn, không ảnh hưởng runtime).

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
bun x tsx --test scripts/youtube-fast-deep-mode.test.ts
```
Expected: FAIL vì chưa có `buildFindCopiesInternalsForTest` và option `thumbnailMatch`.

- [ ] **Step 3: Minimal implementation** (GREEN)

Trong `lib/copyright/findCopies.ts`:
1) Mở rộng type options:
```ts
options: { deepMediaCheck?: boolean; mediaCheckTopN?: number; thumbnailMatch?: boolean } = {}
```
2) Thay `const wantPHash = true` bằng:
```ts
const wantPHash = options.thumbnailMatch !== false
```
3) Wrap block thumbnail matching:
```ts
if (options.thumbnailMatch !== false && originalThumbHash && cand.thumbnailUrl) { ... }
```
4) Export helper test:
```ts
export function buildFindCopiesInternalsForTest(options: { deepMediaCheck?: boolean; thumbnailMatch?: boolean }) {
  return { wantPHash: options.thumbnailMatch !== false }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun x tsx --test scripts/youtube-fast-deep-mode.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/copyright/findCopies.ts scripts/youtube-fast-deep-mode.test.ts
git commit -m "feat: add thumbnailMatch option to findCopies"
```

---

## Task 3: Wire mode vào `/api/scans/quick` (deep giữ nguyên, fast tắt deepMedia + thumbnail)

**Files:**
- Modify: `c:\Users\ADMIN\Desktop\social-monitor\app\api\scans\quick\route.ts`

- [ ] **Step 1: Write failing test (route-level mapping)**  
Mở rộng `resolveFindCopiesOptions` test đã có để cover `thumbnailMatch` và default deep.

*(Nếu đã cover ở Task 1 thì bỏ qua Step 1 này.)*

- [ ] **Step 2: Implement minimal changes**

Trong `app/api/scans/quick/route.ts`:
1) Read `mode` từ formData:
```ts
const mode = String(formData.get('mode') || '').trim() || undefined
```
2) Khi gọi `findCopies`:
```ts
import { resolveFindCopiesOptions } from './resolveFindCopiesOptions'
...
const fcOptions = resolveFindCopiesOptions(mode)
const result = await findCopies(youtubeVideoId, fcOptions)
```

3) (Optional) Response `mode` field:
- Deep URL: `mode: mode === 'fast' ? 'youtube_fast_url' : 'youtube_deep_url'`
- Fallback: `youtube_deep_fallback` giữ nguyên.

- [ ] **Step 3: Run tests**

```bash
bun x tsx --test scripts/youtube-fast-deep-mode.test.ts
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/scans/quick/route.ts
git commit -m "feat: support fast/deep mode in scans quick"
```

---

## Task 4: UI — thêm toggle Fast/Deep + localStorage + gửi mode

**Files:**
- Modify: `c:\Users\ADMIN\Desktop\social-monitor\app\scans\page.tsx`

- [ ] **Step 1: Implement UI state + persistence**

Add state:
```ts
type YouTubeMode = 'fast' | 'deep'
const LS_YT_MODE = 'scan.youtubeMode'
const [youtubeMode, setYoutubeMode] = useState<YouTubeMode>('fast')
```

Load/save localStorage tương tự `scan.platforms`.

- [ ] **Step 2: Add toggle control (Antd)**

Gợi ý dùng `Segmented` hoặc `Radio.Group`:
- Label: `YouTube mode: Fast | Deep`
- Tooltip mô tả: Fast nhanh hơn vì tắt audio+image check.

- [ ] **Step 3: Gửi mode khi gọi quick scan**

Trong `runQuickScan`, trước khi fetch:
```ts
if (payload?.youtubeUrl) fd.append('mode', youtubeMode)
```

- [ ] **Step 4: Typecheck**

```bash
bun run typecheck
```
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add app/scans/page.tsx
git commit -m "feat: add YouTube fast/deep toggle in scans page"
```

---

## Task 5: Verification

- [ ] **Step 1: Run tests**

```bash
bun x tsx --test scripts/youtube-fast-deep-mode.test.ts
```
Expected: PASS

- [ ] **Step 2: Run typecheck**

```bash
bun run typecheck
```
Expected: PASS

- [ ] **Step 3: Manual smoke**
1) Dán YouTube URL → chọn **Fast** → pending giảm (không chạy deep media + thumbnail).
2) Dán YouTube URL → chọn **Deep** → hành vi như cũ.

- [ ] **Step 4: Commit (nếu có fix nhỏ sau smoke)**

```bash
git add -A
git commit -m "chore: finalize youtube fast/deep mode"
```

