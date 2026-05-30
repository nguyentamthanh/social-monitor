# Fast/Deep mode cho YouTube Quick Scan (Scans page)

## Mục tiêu
- Giảm thời gian “pending” khi người dùng dán link YouTube ở màn **Scans → Quét ngay**.
- Cung cấp 2 chế độ:
  - **Fast**: giữ transcript (text) nhưng **tắt check âm thanh + hình ảnh** (deep media + thumbnail similarity).
  - **Deep**: giữ hành vi hiện tại (deep media + thumbnail similarity + transcript theo logic đang có).

## Phạm vi
### Trong phạm vi
- Chỉ áp dụng cho input **YouTube URL** khi gọi `POST /api/scans/quick`.
- Thêm UI toggle Fast/Deep trên trang `app/scans/page.tsx`.
- Backend hỗ trợ `mode=fast|deep` để bật/tắt các bước nặng.

### Ngoài phạm vi
- Không chuyển sang async job/queue.
- Không thay đổi flow quét keyword/domain/upload file (vẫn giữ như hiện tại).

## UX / UI
- Thêm control: **YouTube mode: Fast | Deep**
  - Hiển thị cạnh khu vực chọn platform.
  - Mặc định: **Fast**.
  - Lưu lựa chọn bằng `localStorage` (vd key: `scan.youtubeMode`).
- Logic áp dụng:
  - Nếu input là YouTube URL và user chọn YouTube platform → gửi `mode` lên API.
  - Nếu không phải YouTube URL → bỏ qua `mode` (hoặc vẫn gửi nhưng backend ignore).

## API Contract
### Request
`POST /api/scans/quick` (FormData)

Thêm field:
- `mode`: `'fast' | 'deep'` (optional)

### Response
Giữ nguyên schema response hiện tại.
Có thể bổ sung thêm (optional) để UI biết đang chạy mode nào:
- `mode`: `'youtube_deep_url' | 'youtube_fast_url' | 'youtube_deep_fallback' | 'quick_scan'`

> Gợi ý: không bắt buộc phải đổi tên `mode` hiện có trong response; nếu đổi thì cập nhật UI tags tương ứng.

## Backend: hành vi theo mode
File chính: `app/api/scans/quick/route.ts`

### Deep (hiện tại)
- Khi có `youtubeVideoId` và platforms includes `youtube`:
  - `findCopies(youtubeVideoId, { deepMediaCheck: true })`
  - Trả về kết quả sớm nếu có findings (như hiện tại).

### Fast (mới)
- Khi `mode=fast` và có `youtubeVideoId`:
  - `findCopies(youtubeVideoId, { deepMediaCheck: false, thumbnailMatch: false })`
  - Mục tiêu:
    - **Không chạy** deep media check (audio fingerprint + video frames).
    - **Không chạy** thumbnail similarity (pHash download/compare).
    - **Vẫn giữ transcript** (theo yêu cầu).

## Thay đổi ở `findCopies`
File: `lib/copyright/findCopies.ts`

Hiện tại:
- Luôn compute thumbnail pHash và luôn thử so thumbnail của candidates.
- Transcript check: top N.
- Deep media check: chỉ khi `options.deepMediaCheck`.

Đề xuất mở rộng options:
```ts
options: {
  deepMediaCheck?: boolean
  mediaCheckTopN?: number
  thumbnailMatch?: boolean // default true
}
```

Hành vi:
- Nếu `thumbnailMatch === false`:
  - `wantPHash = false`
  - skip hoàn toàn block `computePHashFromUrl` và reason `thumbnail_match`.

Transcript vẫn giữ như cũ.

## Testing (TDD)
### Unit tests
- `findCopies`:
  - Khi `thumbnailMatch: false` → không gọi `computePHashFromUrl` (có thể test gián tiếp qua behavior/branch; nếu khó, refactor nhỏ để injectable).
  - Khi `deepMediaCheck: false` → `mediaChecked` phải = 0 và không có reason `audio_fingerprint_match`/`video_frame_match`.

### Route tests (mức logic)
- `/api/scans/quick`:
  - Khi `mode=fast` và YouTube URL → gọi `findCopies` với `{ deepMediaCheck:false, thumbnailMatch:false }`.
  - Khi `mode=deep` → gọi `findCopies` với `{ deepMediaCheck:true }`.

## Rollout / Migration
- Thêm toggle UI, default Fast.
- Không phá vỡ backward compatibility: nếu client không gửi `mode`, backend coi như Deep hoặc hành vi hiện tại (tùy chọn).

## Tiêu chí hoàn thành
- Người dùng có thể chọn Fast/Deep rõ ràng trên trang Scans.
- Với Fast mode, thời gian pending giảm đáng kể khi dán link YouTube.
- Deep mode giữ đúng hành vi hiện tại (không regression).

