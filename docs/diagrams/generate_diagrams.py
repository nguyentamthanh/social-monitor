#!/usr/bin/env python3
"""Generate Excalidraw flow diagrams for Copyright Checker — v2 (clean layout,
arrows bound to shape edges, labels offset OFF the arrow line)."""
import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'diagrams')
os.makedirs(OUT, exist_ok=True)

_id = 0
def nid():
    global _id
    _id += 1
    return f"n{_id}"

# palette (excalidraw skill)
C_PRIMARY = "#a5d8ff"   # api / input
C_SUCCESS = "#b2f2bb"   # output / success
C_WARNING = "#ffd8a8"   # external / warning
C_PROCESS = "#d0bfff"   # processing
C_ERROR   = "#ffc9c9"   # error
C_NOTE    = "#fff3bf"   # decision / note
C_DATA    = "#c3fae8"   # storage
C_BAND    = "#f8f9fa"   # layer container fill
TXT       = "#1e1e1e"

FONT_FAMILY = 2  # Helvetica — basic modern font (1=Virgil handwriting, 3=Cascadia mono)

def _text_dims(text, font):
    """Approximate rendered size of text in Excalidraw (Helvetica ~0.55em/char, line ~1.25em)."""
    lines = text.split("\n")
    w = max((len(l) for l in lines), default=0) * font * 0.55 + 8
    h = len(lines) * font * 1.25 + 4
    return w, h

def _text_el(tid, x, y, w, h, text, font, color=TXT, align="center", valign="middle", container=None):
    el = {
        "type": "text", "id": tid, "x": x, "y": y, "width": max(w, 10), "height": max(h, 10),
        "text": text, "fontSize": font, "fontFamily": FONT_FAMILY, "strokeColor": color,
        "textAlign": align, "verticalAlign": valign, "originalText": text, "autoResize": True,
    }
    if container:
        el["containerId"] = container
    return el

def _centered_text(tid, bx, by, bw, bh, text, font, color=TXT, container=None):
    """Text element positioned at the exact center of box (bx,by,bw,bh)."""
    tw, th = _text_dims(text, font)
    x = bx + (bw - tw) / 2
    y = by + (bh - th) / 2
    return _text_el(tid, x, y, tw, th, text, font, color=color, container=container)

def rect(x, y, w, h, text, fill=C_PRIMARY, font=15, stroke=TXT, dashed=False):
    rid, tid = nid(), nid()
    el = {
        "type": "rectangle", "id": rid, "x": x, "y": y, "width": w, "height": h,
        "strokeColor": stroke, "backgroundColor": fill, "fillStyle": "solid",
        "strokeWidth": 2, "roughness": 0, "opacity": 100,
        "roundness": {"type": 3},
        "boundElements": [{"id": tid, "type": "text"}],
    }
    if dashed: el["strokeStyle"] = "dashed"
    return [el, _centered_text(tid, x, y, w, h, text, font, container=rid)]

def diamond(x, y, w, h, text, fill=C_NOTE, font=14):
    rid, tid = nid(), nid()
    el = {
        "type": "diamond", "id": rid, "x": x, "y": y, "width": w, "height": h,
        "strokeColor": TXT, "backgroundColor": fill, "fillStyle": "solid",
        "strokeWidth": 2, "roughness": 0, "opacity": 100,
        "boundElements": [{"id": tid, "type": "text"}],
    }
    return [el, _centered_text(tid, x, y, w, h, text, font, container=rid)]

def ellipse(x, y, w, h, text, fill=C_DATA, font=14):
    rid, tid = nid(), nid()
    el = {
        "type": "ellipse", "id": rid, "x": x, "y": y, "width": w, "height": h,
        "strokeColor": TXT, "backgroundColor": fill, "fillStyle": "solid",
        "strokeWidth": 2, "roughness": 0, "opacity": 100,
        "boundElements": [{"id": tid, "type": "text"}],
    }
    return [el, _centered_text(tid, x, y, w, h, text, font, container=rid)]

def band(x, y, w, h, title_text, fill=C_BAND):
    """Dashed layer container with a small title label at top-left."""
    els = rect(x, y, w, h, "", fill=fill, dashed=True)
    # title text (unbound, top-left)
    tid = nid()
    els.append({
        "type": "text", "id": tid, "x": x + 14, "y": y + 8, "width": len(title_text)*16, "height": 22,
        "text": title_text, "fontSize": 15, "fontFamily": FONT_FAMILY, "strokeColor": "#495057",
        "textAlign": "left", "verticalAlign": "top", "originalText": title_text, "autoResize": True,
    })
    return els

def _label_off_line(x1, y1, x2, y2, text, font):
    """Return (x, y, w, h) for a label placed OFF the arrow line."""
    dx, dy = x2 - x1, y2 - y1
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    w = len(text) * font * 0.55 + 8
    h = 20
    if abs(dx) >= abs(dy):
        # horizontal-ish: label sits ABOVE the line
        x = mx - w / 2
        y = my - 34 if dy >= 0 else my + 14
    else:
        # vertical-ish: label sits LEFT of the line
        x = mx - 10 - w
        y = my - h / 2
    return x, y, w, h

def arrow(x1, y1, x2, y2, label=None, dashed=False, color=TXT, font=13, w=2,
          sb=None, eb=None):
    """Arrow between absolute points. sb/eb = (shape_id, [fx, fy]) bindings."""
    aid, tid = nid(), nid()
    el = {
        "type": "arrow", "id": aid, "x": x1, "y": y1, "width": x2 - x1, "height": y2 - y1,
        "strokeColor": color, "backgroundColor": "transparent", "fillStyle": "solid",
        "strokeWidth": w, "roughness": 1, "opacity": 100,
        "points": [[0, 0], [x2 - x1, y2 - y1]], "endArrowhead": "arrow",
    }
    if dashed: el["strokeStyle"] = "dashed"
    if sb: el["startBinding"] = {"elementId": sb[0], "fixedPoint": sb[1], "focus": 0}
    if eb: el["endBinding"] = {"elementId": eb[0], "fixedPoint": eb[1], "focus": 0}
    els = [el]
    if label:
        lx, ly, lw, lh = _label_off_line(x1, y1, x2, y2, label, font)
        els.append(_text_el(tid, lx, ly, lw, lh, label, font, color=color, align="center", valign="middle"))
    return els

def title(x, y, text, size=24):
    tid = nid()
    return [{
        "type": "text", "id": tid, "x": x, "y": y, "width": len(text)*size*0.55, "height": size*1.2,
        "text": text, "fontSize": size, "fontFamily": FONT_FAMILY, "strokeColor": TXT,
        "textAlign": "left", "verticalAlign": "top", "originalText": text, "autoResize": True,
    }]

def save(name, elements):
    doc = {
        "type": "excalidraw", "version": 2, "source": "hermes-agent",
        "elements": elements,
        "appState": {"viewBackgroundColor": "#ffffff"},
    }
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print(f"wrote {name} ({len(elements)} els)")

# ================================================================ DIAGRAM 1
els = []
els += title(80, 30, "COPYRIGHT CHECKER — TỔNG QUAN KIẾN TRÚC HỆ THỐNG", 25)
els += title(80, 70, "Hệ thống CHECK/SCAN bản quyền đa nền tảng — Next.js 16 + NextAuth + Neon Postgres", 14)

# UI band
els += band(80, 120, 1180, 130, "UI LAYER — React 19 + Ant Design + Tailwind (app/*)")
ui = [
    ("Landing / Login / Register", 100, 165), ("Dashboard (Scan Deck)", 300, 165),
    ("Assets / Scans / Findings", 500, 165), ("URL Check", 700, 165),
    ("Find Copies", 900, 165), ("Text Check / Settings", 1100, 165),
]
ui_ids = []
for txt, x, y in ui:
    els += rect(x, y, 180, 44, txt, fill="#e5dbff", font=13)
    # rectangle id = last-but-one created
    ui_ids.append(f"n{_id - 1}")

els += arrow(670, 250, 670, 300, "HTTPS / JSON")

# API band
els += band(80, 300, 1180, 130, "API LAYER — Next.js App Router (app/api/*)  →  xác thực bằng getServerSession()")
api = [
    ("auth/[...nextauth], register", 100, 345), ("scans, scans/quick", 300, 345),
    ("check-url, find-copies", 500, 345), ("text-check", 700, 345),
    ("assets, findings, notifications", 900, 345), ("settings, extension/check, keygen", 1100, 345),
]
api_ids = []
for txt, x, y in api:
    els += rect(x, y, 180, 44, txt, fill="#d0ebff", font=12)
    api_ids.append(f"n{_id - 1}")

els += arrow(670, 430, 670, 480, "gọi service")

# Service band
els += band(80, 480, 1180, 130, "SERVICE LAYER — lib/*")
svc = [
    ("copyright/scanner + scoring\n(chấm điểm rủi ro)", 100, 525),
    ("copyright/adapters\n(youtube/google/fb/tiktok)", 300, 525),
    ("copyright/findCopies\n(fast / deep media)", 500, 525),
    ("policies/textPolicy", 700, 525),
    ("models/ + db.ts (DDL + migrations)", 900, 525),
    ("auth.ts (NextAuth) + crypto.ts\n(AES-256-GCM)", 1100, 525),
]
svc_ids = []
for txt, x, y in svc:
    els += rect(x, y, 180, 60, txt, fill="#d3f9d8", font=12)
    svc_ids.append(f"n{_id - 1}")

els += arrow(670, 610, 670, 660, "SQL")

# Data band
els += band(80, 660, 1180, 90, "DATA LAYER")
els += ellipse(100, 705, 300, 40, "Neon Postgres: users, brand_assets, scan_runs, findings, evidence_items, user_settings, notifications, extension_api_keys", fill=C_DATA, font=12)
els += rect(460, 705, 200, 40, "YOUTUBE_API_KEY", fill="#e6fcf5", font=13)
els += rect(680, 705, 200, 40, "GOOGLE / FB / TIKTOK keys", fill="#e6fcf5", font=13)
els += rect(900, 705, 200, 40, "NEXTAUTH_SECRET", fill="#e6fcf5", font=13)

# External column on right
els += band(1340, 120, 360, 630, "NỀN TẢNG NGOÀI")
ext = [
    ("YouTube Data API v3\n(videos, transcripts)", 1360, 175),
    ("Google News / Search", 1360, 255),
    ("Facebook Graph API", 1360, 335),
    ("TikTok Research API", 1360, 415),
    ("Browser Extension\n(extension/check)", 1360, 495),
]
ext_ids = []
for txt, x, y in ext:
    els += rect(x, y, 320, 60, txt, fill=C_WARNING, font=13)
    ext_ids.append(f"n{_id - 1}")

# arrows API band -> external (start at band right edge, end bound to ext box)
els += arrow(1260, 370, 1340, 205, "", eb=(ext_ids[0], [0, 0.5]), dashed=True)
els += arrow(1260, 390, 1340, 365, "", eb=(ext_ids[2], [0, 0.5]), dashed=True)
els += arrow(1260, 410, 1340, 525, "", eb=(ext_ids[4], [0, 0.5]), dashed=True)
save("01-tong-quan-kien-truc.excalidraw", els)

# ================================================================ DIAGRAM 2
els = []
els += title(80, 30, "LUỒNG XÁC THỰC — LOGIN / REGISTER (NextAuth Credentials + JWT)", 22)

els += ellipse(330, 110, 140, 60, "Người dùng", font=15)
els += arrow(470, 140, 600, 140, "nhập email + mật khẩu")
els += rect(600, 110, 220, 60, "/login\nsignIn('credentials')", fill=C_PRIMARY, font=14)
els += arrow(820, 140, 950, 140, "POST")
els += rect(950, 110, 240, 60, "/api/auth/callback/credentials", fill=C_PRIMARY, font=14)
els += arrow(1190, 140, 1320, 140)
els += rect(1320, 110, 260, 60, "authorize() — lib/auth.ts", fill=C_PROCESS, font=14)

# spine down
els += arrow(1450, 170, 1450, 300, "có email + mật khẩu?")
els += diamond(1370, 300, 160, 70, "Có email\n+ mật khẩu?", font=13)
els += arrow(1450, 370, 1450, 470)
els += rect(1330, 470, 240, 60, "initializeDatabase()\ntạo bảng nếu chưa có", fill=C_PROCESS, font=13)
els += arrow(1450, 530, 1450, 630)
els += rect(1330, 630, 240, 60, "findUserByEmail()\nNeon Postgres", fill=C_DATA, font=14)
els += arrow(1450, 690, 1450, 790)
els += diamond(1370, 790, 160, 70, "User\ntồn tại?", font=14)
els += arrow(1450, 860, 1450, 960, "có")
els += rect(1330, 960, 240, 60, "bcrypt.compare(password)", fill=C_PROCESS, font=14)
els += arrow(1450, 1020, 1450, 1120)
els += diamond(1370, 1120, 160, 70, "Mật khẩu\nkhớp?", font=14)
els += arrow(1450, 1190, 1450, 1290, "có")
els += rect(1290, 1290, 320, 60, "Tạo JWT session\n{id, email, name} → /dashboard", fill=C_SUCCESS, font=14)

# error branch 1: missing credentials (top-right)
els += arrow(1320, 140, 1180, 220, "không", color="#e03131", sb=None, eb=None)
els += rect(960, 220, 220, 56, "throw 'Missing credentials'", fill=C_ERROR, font=13)

# error branch 2: no user -> demo auto-create
els += arrow(1370, 825, 1180, 825, "không", color="#e03131", dashed=True)
els += diamond(980, 790, 200, 70, "Là tài khoản\ndemo?", font=13)
els += arrow(980, 860, 980, 960, "có")
els += rect(860, 960, 240, 60, "createUser() tự tạo\ndemo@demo.com", fill=C_SUCCESS, font=13)
els += arrow(1100, 990, 1330, 990, "", dashed=True)

# error branch 3: wrong password
els += arrow(1450, 1155, 1620, 1155, "không", color="#e03131", dashed=True)
els += rect(1620, 1120, 260, 70, "throw 'Invalid credentials'\n→ /api/auth/error", fill=C_ERROR, font=13)
save("02-luong-xac-thuc.excalidraw", els)

# ================================================================ DIAGRAM 3
els = []
els += title(80, 30, "LUỒNG QUÉT BẢN QUYỀN — QUICK SCAN & BATCH SCAN", 22)

els += rect(90, 110, 300, 70, "Ô 'Quét ngay'\nURL YouTube / domain /\ntên thương hiệu", fill=C_PRIMARY, font=13)
els += arrow(390, 145, 520, 145)
els += rect(520, 110, 260, 70, "detectScanInput()\nphân loại assetType + name", fill=C_PROCESS, font=14)
els += arrow(780, 145, 910, 145)
els += diamond(910, 110, 170, 70, "Là URL\nYouTube?", font=13)
els += arrow(1080, 145, 1210, 145, "có")
els += rect(1210, 110, 330, 70, "findCopies(videoId, mode)\nfast: title/desc\ndeep: + transcript + media", fill=C_PROCESS, font=13)
els += arrow(1540, 145, 1660, 145)
els += rect(1660, 110, 300, 70, "Candidates YouTube\n(title, kênh, thumbnail)", fill=C_SUCCESS, font=14)

# no branch
els += arrow(995, 180, 995, 300, "không", color="#e03131", dashed=True)
els += rect(850, 300, 290, 70, "Tạo mock BrandAsset\n(name, keywords, domains,\npHash từ file/thumbnail)", fill=C_PROCESS, font=13)
els += arrow(995, 370, 995, 470)
els += rect(850, 470, 290, 70, "Lặp từng platform\nyoutube, google, facebook, tiktok", fill=C_PROCESS, font=14)
els += arrow(995, 540, 995, 640)
els += diamond(910, 640, 170, 70, "Adapter\nsẵn sàng?", font=13)
els += arrow(910, 675, 760, 675, "chưa", color="#e03131")
els += rect(540, 640, 220, 70, "Bỏ qua platform\n(ghi connector status)", fill=C_WARNING, font=13)
els += arrow(995, 710, 995, 810, "có")
els += rect(850, 810, 290, 70, "adapter.search(asset)\ncandidates từ nền tảng", fill=C_PRIMARY, font=14)
els += arrow(995, 880, 995, 980)
els += rect(850, 980, 290, 70, "scoreCandidate(asset, candidate)\nđiểm rủi ro + lý do", fill=C_PROCESS, font=14)
els += arrow(995, 1050, 995, 1150)
els += diamond(910, 1150, 170, 70, "riskScore\n>= 22?", font=13)
els += arrow(910, 1185, 760, 1185, "không", color="#e03131")
els += rect(540, 1150, 220, 70, "Loại bỏ candidate", fill=C_WARNING, font=13)
els += arrow(995, 1220, 995, 1320, "có")
els += rect(850, 1320, 290, 70, "Gom findings\nsort theo riskScore desc", fill=C_SUCCESS, font=14)
els += arrow(995, 1390, 995, 1480)
els += rect(790, 1480, 410, 60, "Trả JSON: findings + mode\n(youtube_fast_url / deep / quick_scan)", fill=C_SUCCESS, font=14)

# batch scan note
els += band(1500, 300, 520, 260, "BATCH SCAN — /api/scans")
els += rect(1520, 355, 480, 44, "runCopyrightScan()\ncreateScanRun → lặp adapters → score → upsertFinding", fill=C_PROCESS, font=12)
els += rect(1520, 420, 480, 44, "createNotification khi có finding mới", fill=C_WARNING, font=12)
els += rect(1520, 485, 480, 44, "updateScanRun('completed', connector status)", fill=C_DATA, font=12)
save("03-luong-quet-ban-quyen.excalidraw", els)

# ================================================================ DIAGRAM 4
els = []
els += title(80, 30, "LUỒNG KIỂM TRA URL & TÌM BẢN SAO (YouTube)", 22)

els += ellipse(90, 110, 140, 60, "Người dùng", font=15)
els += arrow(230, 140, 360, 140, "dán link YouTube")
els += rect(360, 110, 260, 60, "POST /api/check-url\n{url}", fill=C_PRIMARY, font=14)
els += arrow(620, 140, 750, 140)
els += rect(750, 110, 280, 60, "extractYouTubeVideoId()\nwatch / youtu.be / shorts / embed", fill=C_PROCESS, font=12)
els += arrow(1030, 140, 1160, 140)
els += diamond(1160, 110, 160, 70, "Có\nvideoId?", font=13)
els += arrow(1160, 180, 1160, 300, "không", color="#e03131", dashed=True)
els += rect(1040, 300, 240, 56, "400 invalid_url", fill=C_ERROR, font=13)

els += arrow(1320, 145, 1450, 145, "có")
els += rect(1450, 110, 290, 70, "findActiveAssetsByIds()\ntài sản active của user", fill=C_DATA, font=13)
els += arrow(1595, 180, 1595, 300)
els += diamond(1510, 300, 170, 70, "Có tài\nsản?", font=13)
els += arrow(1510, 370, 1510, 480, "không", color="#e03131", dashed=True)
els += rect(1370, 480, 280, 56, "400 no_assets", fill=C_ERROR, font=13)

els += arrow(1595, 300, 1740, 300, "có", dashed=True)
els += rect(1740, 270, 300, 70, "fetchYouTubeVideoById()\n+ thumbnail pHash nếu cần", fill=C_PROCESS, font=12)
els += arrow(1890, 340, 1890, 450)
els += rect(1740, 450, 300, 70, "scoreCandidate() với TỪNG asset", fill=C_PROCESS, font=14)
els += arrow(1890, 520, 1890, 630)
els += diamond(1800, 630, 180, 70, "riskScore\n>= 30?", font=13)
els += arrow(1800, 700, 1590, 940, "không", color="#e03131", dashed=True)
els += rect(1440, 940, 300, 60, "Chỉ trả thông tin video\n(không tạo finding)", fill=C_WARNING, font=12)
els += arrow(1890, 700, 1890, 820, "có")
els += rect(1740, 820, 300, 70, "createScanRun → upsertFinding\n→ createEvidenceItem (snapshot)", fill=C_SUCCESS, font=12)
els += arrow(1890, 890, 1890, 1000)
els += rect(1740, 1000, 300, 70, "updateScanRun completed\n+ createNotification(url_check_match)", fill=C_SUCCESS, font=12)

# find-copies note
els += band(360, 560, 560, 240, "FIND COPIES — POST /api/find-copies")
els += rect(380, 615, 520, 44, "videoId → findCopies(videoId, {deepMediaCheck})", fill=C_PROCESS, font=13)
els += rect(380, 680, 520, 44, "fast: title/desc — deep: + transcript (transcriptFetcher)", fill=C_PROCESS, font=12)
els += rect(380, 745, 520, 44, "+ mediaDeepCheck: so khớp thumbnail/audio từng candidate", fill=C_PROCESS, font=12)
save("04-luong-url-check-find-copies.excalidraw", els)

# ================================================================ DIAGRAM 5 — MÔ HÌNH DỮ LIỆU (ERD)
els = []
els += title(80, 30, "COPYRIGHT CHECKER — MÔ HÌNH DỮ LIỆU (Neon Postgres, lib/db.ts)", 22)
els += title(80, 68, "8 bảng · quan hệ 1—N theo user_id/asset_id/scan_run_id/finding_id", 13)

def entity(x, y, w, name, fields, fill=C_DATA):
    """Entity box: bold header (tách rời) + list field trong 1 rectangle nhiều dòng."""
    h = 34 + 20 * len(fields)
    rid, tid = nid(), nid()
    el = {
        "type": "rectangle", "id": rid, "x": x, "y": y, "width": w, "height": h,
        "strokeColor": TXT, "backgroundColor": fill, "fillStyle": "solid",
        "strokeWidth": 2, "roughness": 0, "opacity": 100, "roundness": {"type": 3},
        "boundElements": [{"id": tid, "type": "text"}],
    }
    # header bar (không bound, đè lên trên rect cho nổi bật)
    hid = nid()
    header = {
        "type": "rectangle", "id": hid, "x": x, "y": y, "width": w, "height": 30,
        "strokeColor": TXT, "backgroundColor": "#495057", "fillStyle": "solid",
        "strokeWidth": 2, "roughness": 0, "opacity": 100, "roundness": {"type": 3},
    }
    htid = nid()
    header_text = _text_el(htid, x, y + 6, w, 20, name, 14, color="#ffffff", align="center", valign="middle")
    body_text = "\n".join(fields)
    body = _text_el(tid, x + 10, y + 36, w - 20, h - 40, body_text, 12, align="left", valign="top", container=rid)
    return [el, header, header_text, body], (x, y, w, h)

acc = []
acc_els, users_box = entity(560, 110, 260, "users", [
    "id PK, email UNIQUE", "name, password (hash)", "created_at"
], fill="#ffe8cc")
els += acc_els

acc_els, ba_box = entity(80, 300, 300, "brand_assets", [
    "id PK, user_id FK",
    "name, asset_type", "keywords[], official_domains[]",
    "file_hash, perceptual_hash", "audio_metadata, status"
])
els += acc_els

acc_els, sr_box = entity(420, 300, 300, "scan_runs", [
    "id PK, user_id FK",
    "trigger, status, asset_ids[]",
    "platform_status, error_summary",
    "findings_count, started/finished_at"
])
els += acc_els

acc_els, us_box = entity(760, 300, 260, "user_settings", [
    "user_id PK/FK", "api_keys (encrypted)", "preferences", "updated_at"
])
els += acc_els

acc_els, no_box = entity(1060, 300, 260, "notifications", [
    "id PK, user_id FK", "type, title, message", "payload, read_at, created_at"
])
els += acc_els

acc_els, ek_box = entity(1360, 300, 280, "extension_api_keys", [
    "key_hash PK (sha256)", "user_id FK", "created_at"
])
els += acc_els

acc_els, fi_box = entity(200, 560, 400, "findings", [
    "id PK, user_id FK, asset_id FK", "scan_run_id FK, platform, source",
    "external_id, title, content, url", "author, risk_score, reasons[]",
    "status: new→reviewing→confirmed→dismissed",
    "UNIQUE(user_id, asset_id, platform, external_id)"
], fill="#ffd8a8")
els += acc_els

acc_els, ev_box = entity(200, 830, 400, "evidence_items", [
    "id PK, finding_id FK", "evidence_type, excerpt", "metadata, thumbnail_url", "file_hash, fetched_at"
])
els += acc_els

def edge(box_a, box_b, label, side_a="bottom", side_b="top"):
    ax, ay, aw, ah = box_a
    bx, by, bw, bh = box_b
    if side_a == "bottom":
        x1, y1 = ax + aw / 2, ay + ah
    elif side_a == "left":
        x1, y1 = ax, ay + ah / 2
    else:
        x1, y1 = ax + aw, ay + ah / 2
    if side_b == "top":
        x2, y2 = bx + bw / 2, by
    elif side_b == "left":
        x2, y2 = bx, by + bh / 2
    else:
        x2, y2 = bx + bw, by + bh / 2
    return arrow(x1, y1, x2, y2, label, font=11)

els += edge(users_box, ba_box, "1—N")
els += edge(users_box, sr_box, "1—N")
els += edge(users_box, us_box, "1—1")
els += edge(users_box, no_box, "1—N")
els += edge(users_box, ek_box, "1—N")
els += edge(ba_box, fi_box, "1—N (asset_id)")
els += edge(sr_box, fi_box, "1—N (scan_run_id)")
els += edge(fi_box, ev_box, "1—N (finding_id)")

els += band(700, 830, 660, 130, "GHI CHÚ INDEXES")
els += rect(720, 875, 620, 34, "idx_brand_assets_user_id, idx_scan_runs_user_id, idx_findings_user_id/asset_id", fill=C_BAND, font=11)
els += rect(720, 915, 620, 34, "idx_evidence_items_finding_id, idx_notifications_user_id(created_at DESC)", fill=C_BAND, font=11)
save("05-mo-hinh-du-lieu-erd.excalidraw", els)

# ================================================================ DIAGRAM 6
els = []
els += title(80, 30, "LUỒNG EXTENSION API — KIỂM TRA VIDEO TỪ TRÌNH DUYỆT", 22)

els += ellipse(90, 110, 160, 60, "Browser\nExtension", fill=C_WARNING, font=14)
els += arrow(250, 140, 380, 140, "apiKey + URL video")
els += rect(380, 110, 290, 60, "POST /api/extension/check\n(CORS mở)", fill=C_PRIMARY, font=14)
els += arrow(670, 140, 800, 140)
els += rect(800, 110, 290, 60, "sha256(apiKey) → tra\nextension_api_keys", fill=C_DATA, font=13)
els += arrow(1090, 140, 1220, 140)
els += diamond(1220, 110, 170, 70, "Key\nhợp lệ?", font=13)
els += arrow(1220, 180, 1220, 300, "không", color="#e03131", dashed=True)
els += rect(1090, 300, 260, 56, "401 invalid_api_key", fill=C_ERROR, font=13)

els += arrow(1390, 145, 1520, 145, "có")
els += rect(1520, 110, 300, 70, "extractYouTubeVideoId()\n+ findActiveAssetsByIds()", fill=C_PROCESS, font=13)
els += arrow(1670, 180, 1670, 300)
els += diamond(1580, 300, 180, 70, "Có tài sản\nactive?", font=13)
els += arrow(1580, 370, 1580, 480, "không", color="#e03131", dashed=True)
els += rect(1430, 480, 300, 56, "200 {noAssets: true, matches: []}", fill=C_WARNING, font=12)

els += arrow(1670, 300, 1820, 300, "có", dashed=True)
els += rect(1820, 270, 290, 70, "fetchYouTubeVideoById()\n+ thumbnail pHash nếu cần", fill=C_PROCESS, font=12)
els += arrow(1965, 340, 1965, 450)
els += rect(1820, 450, 290, 70, "scoreCandidate() với từng asset\nngưỡng >= 30", fill=C_PROCESS, font=13)
els += arrow(1965, 520, 1965, 630)
els += rect(1820, 630, 290, 70, "Trả video info + matches\n+ topScore + assetsChecked", fill=C_SUCCESS, font=13)

els += band(380, 560, 560, 200, "KEYGEN — POST /api/extension/keygen")
els += rect(400, 615, 520, 44, "User tạo key trong Settings → lưu hash vào DB", fill=C_PROCESS, font=13)
els += rect(400, 680, 520, 44, "Chỉ lưu sha256 — key gốc không bao giờ lưu trữ", fill=C_DATA, font=13)
save("06-luong-extension-api.excalidraw", els)

print("ALL DONE")
