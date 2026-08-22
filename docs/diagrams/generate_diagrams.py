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

# UI band — v3 (08/2026): /url-check, /find-copies, /text-check đã bị xoá;
# /scans giờ là cửa quét duy nhất (auto-detect + Fast/Deep + platform chips).
els += band(80, 120, 1180, 130, "UI LAYER — React 19 + Ant Design + Tailwind (app/*)")
ui = [
    ("Landing / Login / Register", 100, 165), ("Dashboard (Scan Deck)", 300, 165),
    ("Assets", 500, 165), ("Scans (auto-detect,\nFast/Deep, platform chips)", 700, 165),
    ("Findings", 900, 165), ("Settings", 1100, 165),
]
ui_ids = []
for txt, x, y in ui:
    els += rect(x, y, 180, 44, txt, fill="#e5dbff", font=12)
    # rectangle id = last-but-one created
    ui_ids.append(f"n{_id - 1}")

els += arrow(670, 250, 670, 300, "HTTPS / JSON")

# API band — check-url/find-copies/text-check đã xoá; mọi link YouTube đi qua
# scans/quick (findCopies + Dailymotion + persist trong 1 request).
els += band(80, 300, 1180, 130, "API LAYER — Next.js App Router (app/api/*)  →  xác thực bằng getServerSession()")
api = [
    ("auth/[...nextauth], register", 100, 345), ("scans, scans/quick,\nscans/[id]", 300, 345),
    ("assets, assets/[id]", 500, 345), ("findings, findings/[id]", 700, 345),
    ("notifications, settings", 900, 345), ("extension/check, keygen", 1100, 345),
]
api_ids = []
for txt, x, y in api:
    els += rect(x, y, 180, 44, txt, fill="#d0ebff", font=12)
    api_ids.append(f"n{_id - 1}")

els += arrow(670, 430, 670, 480, "gọi service")

# Service band — policies/textPolicy đã xoá cùng /text-check; thêm các module
# mới của đợt rework (transcriptQuery, storyboard, dailymotion, reasons/risk).
els += band(80, 480, 1180, 130, "SERVICE LAYER — lib/*")
svc = [
    ("copyright/scanner + scoring\n(hạng bằng chứng weak/medium/strong)", 100, 525),
    ("copyright/adapters\n(youtube/google/fb/tiktok/dailymotion)", 300, 525),
    ("copyright/findCopies +\ntranscriptQuery + storyboard", 500, 525),
    ("copyright/dailymotion\n+ reasons.ts + risk.ts (mới)", 700, 525),
    ("models/ + db.ts (DDL + migrations)", 900, 525),
    ("auth.ts (NextAuth) + crypto.ts\n(AES-256-GCM)", 1100, 525),
]
svc_ids = []
for txt, x, y in svc:
    els += rect(x, y, 180, 60, txt, fill="#d3f9d8", font=11)
    svc_ids.append(f"n{_id - 1}")

els += arrow(670, 610, 670, 660, "SQL")

# Data band
els += band(80, 660, 1180, 90, "DATA LAYER")
els += ellipse(100, 705, 300, 40, "Neon Postgres: users, brand_assets, scan_runs, findings, evidence_items, user_settings, notifications, extension_api_keys", fill=C_DATA, font=12)
els += rect(460, 705, 200, 40, "YOUTUBE_API_KEY", fill="#e6fcf5", font=13)
els += rect(680, 705, 200, 40, "GOOGLE/FB/TIKTOK keys\n(có nhưng chưa bật ở UI)", fill="#e6fcf5", font=10)
els += rect(900, 705, 200, 40, "NEXTAUTH_SECRET", fill="#e6fcf5", font=13)

# External column on right — Facebook không phải Graph API (Meta đã bỏ tìm
# kiếm nội dung công khai) mà là Google CSE site:facebook.com; thêm
# Dailymotion — nền tảng thứ 2 chạy thật, miễn phí, không cần key.
els += band(1340, 120, 360, 545, "NỀN TẢNG NGOÀI")
ext = [
    ("YouTube Data API v3\n(videos, storyboard, captions)", 1360, 175),
    ("Google Custom Search\n(Programmable Search)", 1360, 255),
    ("Facebook — qua Google CSE\nsite:facebook.com (KHÔNG phải Graph API)", 1360, 335),
    ("TikTok Research API\n(cần được duyệt)", 1360, 415),
    ("Dailymotion — tìm kiếm công khai\n(miễn phí, không cần key)", 1360, 495),
    ("Browser Extension\n(extension/check)", 1360, 575),
]
ext_ids = []
for txt, x, y in ext:
    els += rect(x, y, 320, 60, txt, fill=C_WARNING, font=11)
    ext_ids.append(f"n{_id - 1}")

# arrows API band -> external (start at band right edge, end bound to ext box)
els += arrow(1260, 370, 1340, 205, "", eb=(ext_ids[0], [0, 0.5]), dashed=True)
els += arrow(1260, 390, 1340, 365, "", eb=(ext_ids[2], [0, 0.5]), dashed=True)
els += arrow(1260, 400, 1340, 525, "", eb=(ext_ids[4], [0, 0.5]), dashed=True)
els += arrow(1260, 410, 1340, 605, "", eb=(ext_ids[5], [0, 0.5]), dashed=True)
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
# v3 (08/2026): endpoint /api/check-url + /api/find-copies + /url-check +
# /find-copies đã bị xoá — mọi link YouTube đi qua một cửa duy nhất
# POST /api/scans/quick, luôn lưu kết quả (không còn nhánh "chỉ trả JSON").
els = []
els += title(80, 30, "LUỒNG QUÉT BẢN QUYỀN — TRANG /scans (auto-detect + lưu kết quả)", 22)
els += title(80, 66, "Một cửa duy nhất: POST /api/scans/quick — chi tiết findCopies() xem Hình 5", 13)

els += rect(90, 110, 300, 70, "Ô 'Quét ngay' trên /scans\nURL YouTube / domain /\ntừ khóa thương hiệu", fill=C_PRIMARY, font=13)
els += arrow(390, 145, 520, 145)
els += rect(520, 110, 260, 70, "detectScanInput()\nphân loại assetType + name", fill=C_PROCESS, font=14)
els += arrow(780, 145, 910, 145)
els += diamond(910, 110, 170, 70, "Là URL\nYouTube?", font=13)

# nhánh "có" — findCopies + Dailymotion + lưu kết quả (YouTube + Dailymotion)
els += arrow(1080, 145, 1210, 145, "có")
els += rect(1210, 100, 340, 90, "findCopies(videoId, mode)\n2 vòng search + storyboard\n+ transcript — xem Hình 5", fill=C_PROCESS, font=13)
els += arrow(1380, 190, 1380, 260)
els += rect(1210, 260, 340, 70, "+ Dailymotion song song nếu chọn\n(miễn phí, không tốn quota YouTube)", fill=C_PRIMARY, font=13)
els += arrow(1380, 330, 1380, 400)
els += rect(1210, 400, 340, 60, "Lọc riskScore >= 40, gộp 2 nguồn\nsort theo điểm giảm dần", fill=C_PROCESS, font=13)
els += arrow(1380, 460, 1380, 530)
els += rect(1210, 530, 340, 90, "persistFindCopiesResult()\nupsertAdhocAsset → createScanRun\n→ upsertFinding + createEvidenceItem", fill=C_SUCCESS, font=13)
els += arrow(1380, 620, 1380, 690)
els += rect(1190, 690, 380, 70, "Trả JSON: findings (đã lưu, có scanRunId)\n+ quotaUnits, frameChecked, dailymotionSearched", fill=C_SUCCESS, font=13)

# nhánh "không" — quét theo tài sản đã lưu / từ khóa, KHÔNG đổi trong đợt rework
# này: vẫn dùng scoreCandidate + ngưỡng riêng 22 (khác 40 của findCopies).
els += arrow(995, 180, 995, 300, "không", color="#e03131", dashed=True)
els += rect(850, 300, 290, 70, "Tạo/khớp BrandAsset\n(name, keywords, domains,\npHash từ file/thumbnail)", fill=C_PROCESS, font=13)
els += arrow(995, 370, 995, 470)
els += rect(850, 470, 290, 80, "Lặp từng platform\nyoutube, google, facebook,\ntiktok, dailymotion", fill=C_PROCESS, font=14)
els += arrow(995, 550, 995, 650)
els += diamond(910, 650, 170, 70, "Adapter\nsẵn sàng?", font=13)
els += arrow(910, 685, 760, 685, "chưa", color="#e03131")
els += rect(540, 650, 220, 70, "Bỏ qua platform\n(ghi connector status)", fill=C_WARNING, font=13)
els += arrow(995, 720, 995, 820, "có")
els += rect(850, 820, 290, 70, "adapter.search(asset)\ncandidates từ nền tảng", fill=C_PRIMARY, font=14)
els += arrow(995, 890, 995, 990)
els += rect(850, 990, 290, 80, "scoreCandidate(asset, candidate)\nđiểm theo hạng bằng chứng\n(weak/medium/strong)", fill=C_PROCESS, font=13)
els += arrow(995, 1070, 995, 1170)
els += diamond(910, 1170, 170, 70, "riskScore\n>= 22?", font=13)
els += arrow(910, 1205, 760, 1205, "không", color="#e03131")
els += rect(540, 1170, 220, 70, "Loại bỏ candidate", fill=C_WARNING, font=13)
els += arrow(995, 1240, 995, 1340, "có")
els += rect(850, 1340, 290, 70, "Gom findings\nsort theo riskScore desc", fill=C_SUCCESS, font=14)
els += arrow(995, 1410, 995, 1500)
els += rect(790, 1500, 410, 60, "Trả JSON: findings + mode\n(quét theo tài sản đã lưu)", fill=C_SUCCESS, font=14)

# batch scan note
els += band(1500, 940, 560, 260, "BATCH SCAN — /api/scans (không đổi trong đợt rework này)")
els += rect(1520, 995, 520, 44, "runCopyrightScan()\ncreateScanRun → lặp adapters → score → upsertFinding", fill=C_PROCESS, font=12)
els += rect(1520, 1060, 520, 44, "Ngưỡng riêng 22 — KHÁC ngưỡng 40 của findCopies", fill=C_WARNING, font=12)
els += rect(1520, 1125, 520, 44, "updateScanRun('completed', connector status)", fill=C_DATA, font=12)
save("03-luong-quet-ban-quyen.excalidraw", els)

# ================================================================ DIAGRAM 4
# v3 (08/2026): /api/check-url và /api/find-copies đã bị xoá. Đây là chi tiết
# findCopies() thật đang chạy trong /api/scans/quick, cộng nhánh Dailymotion
# chạy song song. Không còn nhánh "đối chiếu với tài sản đã lưu của tôi".
els = []
els += title(80, 30, "LUỒNG TÌM BẢN SAO — findCopies() (YouTube) + Dailymotion song song", 22)
els += title(80, 66, "Chạy trong POST /api/scans/quick — thay thế /api/check-url + /api/find-copies (đã xoá)", 13)

els += rect(90, 110, 300, 70, "POST /api/scans/quick\nFormData {url, mode, platforms}", fill=C_PRIMARY, font=13)
els += arrow(390, 145, 520, 145)
els += rect(520, 110, 280, 70, "extractYouTubeVideoId()\nwatch / youtu.be / shorts / embed", fill=C_PROCESS, font=12)
els += arrow(800, 145, 930, 145)
els += diamond(930, 110, 160, 70, "Có\nvideoId?", font=13)
els += arrow(930, 180, 930, 280, "không", color="#e03131", dashed=True)
els += rect(810, 280, 240, 56, "400 invalid_url", fill=C_ERROR, font=13)

els += arrow(1090, 145, 1220, 145, "có")
els += rect(1220, 100, 320, 90, "fetchYouTubeVideoById()\n+ storyboard hash (innertube, free)\n+ thumbnail pHash", fill=C_PROCESS, font=13)
els += arrow(1380, 190, 1380, 260)
els += rect(1220, 260, 320, 70, "search.list vòng 1 (100 units)\ntheo tiêu đề + tags → tối đa 50 candidates", fill=C_PRIMARY, font=13)
els += arrow(1380, 330, 1380, 400)
els += diamond(1300, 400, 160, 80, "Điểm cao\nnhất < 45?", font=13)
els += arrow(1460, 430, 1620, 430, "có")
els += rect(1620, 395, 340, 90, "Trích cụm từ transcript đặc trưng\n→ search.list vòng 2 (+100 units)\ngộp candidate mới vào danh sách", fill=C_WARNING, font=12)
els += arrow(1380, 480, 1380, 560, "không\n(tiết kiệm quota)", color="#e03131")

els += rect(1220, 560, 320, 80, "scoreCandidate mỗi ứng viên\ntitle/tag/mô tả/thumbnail\n(hạng weak ≤35 / medium ≤70)", fill=C_PROCESS, font=12)
els += arrow(1380, 640, 1380, 720)
els += rect(1220, 720, 320, 90, "So khung hình qua storyboard\n(top 8, coverage >= 10%)\n→ video_frame_match (hạng strong = 100)", fill=C_SUCCESS, font=12)
els += arrow(1380, 810, 1380, 890)
els += diamond(1300, 890, 160, 80, "riskScore\n>= 40?", font=13)
els += arrow(1460, 920, 1620, 920, "không")
els += rect(1620, 890, 260, 60, "Loại khỏi kết quả", fill=C_WARNING, font=13)
els += arrow(1380, 970, 1380, 1050, "có")
els += rect(1220, 1050, 320, 90, "persistFindCopiesResult()\nupsertAdhocAsset + createScanRun\n+ upsertFinding + createEvidenceItem", fill=C_SUCCESS, font=12)

# Dailymotion — song song, miễn phí
els += band(90, 400, 1000, 340, "DAILYMOTION — song song, MIỄN PHÍ, không cần API key/quota")
els += rect(120, 460, 460, 60, "findDailymotionCopies(title, thumbnailHash,\nduration) — từ dữ liệu findCopies vừa lấy", fill=C_PRIMARY, font=12)
els += arrow(350, 520, 350, 580)
els += rect(120, 580, 460, 56, "Tìm kiếm công khai, không tính phí\n→ tối đa 30 candidates", fill=C_PROCESS, font=12)
els += arrow(350, 636, 350, 690)
els += rect(120, 690, 460, 72, "scoreCandidate: title + thumbnail pHash\n(không có storyboard → trần hạng medium 70)\nđã tự lọc riskScore >= 40 bên trong", fill=C_PROCESS, font=12)
els += arrow(600, 726, 1220, 1095, "gộp trước khi lưu", sb=None)

els += arrow(1380, 1140, 1380, 1220)
els += rect(1000, 1220, 760, 70, "Trả JSON: findings YouTube + Dailymotion (đã gộp, sort)\n+ scanRunId, quotaUnits, frameChecked, transcriptChecked, dailymotionSearched", fill=C_SUCCESS, font=13)
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
    "file_hash, perceptual_hash", "audio_metadata, status",
    "origin ('user'/'adhoc'), source_url",
    "UNIQUE(user_id, source_url) WHERE NOT NULL"
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
    "id PK, finding_id FK", "evidence_type, excerpt", "metadata, thumbnail_url", "file_hash, fetched_at",
    "UNIQUE(finding_id, evidence_type) — upsert, không nhân bản"
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

els += band(700, 830, 660, 170, "GHI CHÚ INDEXES")
els += rect(720, 875, 620, 34, "idx_brand_assets_user_id, idx_scan_runs_user_id, idx_findings_user_id/asset_id", fill=C_BAND, font=11)
els += rect(720, 915, 620, 34, "idx_evidence_items_finding_id, idx_notifications_user_id(created_at DESC)", fill=C_BAND, font=11)
els += rect(720, 955, 620, 34, "idx_brand_assets_source (mới) — cho phép upsert asset ad-hoc theo URL", fill=C_BAND, font=11)
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
