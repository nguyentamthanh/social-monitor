#!/usr/bin/env python3
"""Rasterize .excalidraw JSON files (rectangle/diamond/ellipse/arrow/text) to PNG
using Pillow — no headless browser / no Excalidraw renderer required.
Renders every *.excalidraw file in ./diagrams/ to ./diagrams/png/<name>.png
"""
import json
import os
import glob
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(HERE, 'diagrams')
OUT_DIR = os.path.join(SRC_DIR, 'png')
os.makedirs(OUT_DIR, exist_ok=True)

SCALE = 1.6
PAD = 40

FONT_REGULAR = os.environ.get("DIAGRAM_FONT_REGULAR", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
FONT_BOLD = os.environ.get("DIAGRAM_FONT_BOLD", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")

_font_cache = {}
def get_font(size, bold=False):
    size = max(int(round(size * SCALE)), 8)
    key = (size, bold)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)
    return _font_cache[key]


def hx(x):
    """map excalidraw x -> pixel x (offset applied by caller via closure)"""
    return x


def compute_bbox(elements):
    minx = miny = float('inf')
    maxx = maxy = float('-inf')
    for el in elements:
        if el['type'] == 'arrow':
            pts = el.get('points', [[0, 0], [el['width'], el['height']]])
            for px, py in pts:
                ax, ay = el['x'] + px, el['y'] + py
                minx, maxx = min(minx, ax), max(maxx, ax)
                miny, maxy = min(miny, ay), max(maxy, ay)
        else:
            x, y, w, h = el['x'], el['y'], el.get('width', 0), el.get('height', 0)
            minx, maxx = min(minx, x), max(maxx, x + w)
            miny, maxy = min(miny, y), max(maxy, y + h)
    return minx, miny, maxx, maxy


def draw_rounded_rect(draw, xy, radius, fill, outline, width, dashed=False):
    x0, y0, x1, y1 = xy
    r = min(radius, (x1 - x0) / 2, (y1 - y0) / 2)
    if not dashed:
        draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)
    else:
        draw.rounded_rectangle(xy, radius=r, fill=fill)
        draw_dashed_rect(draw, xy, outline, width, r)


def draw_dashed_rect(draw, xy, color, width, radius, dash=8, gap=6):
    x0, y0, x1, y1 = xy
    # top / bottom edges
    for y in (y0, y1):
        x = x0 + radius
        while x < x1 - radius:
            draw.line([(x, y), (min(x + dash, x1 - radius), y)], fill=color, width=width)
            x += dash + gap
    # left / right edges
    for x in (x0, x1):
        y = y0 + radius
        while y < y1 - radius:
            draw.line([(x, y), (x, min(y + dash, y1 - radius))], fill=color, width=width)
            y += dash + gap


def draw_dashed_line(draw, p1, p2, color, width, dash=9, gap=6):
    import math
    x1, y1 = p1
    x2, y2 = p2
    dist = math.hypot(x2 - x1, y2 - y1)
    if dist == 0:
        return
    ux, uy = (x2 - x1) / dist, (y2 - y1) / dist
    d = 0
    while d < dist:
        d2 = min(d + dash, dist)
        draw.line([(x1 + ux * d, y1 + uy * d), (x1 + ux * d2, y1 + uy * d2)], fill=color, width=width)
        d += dash + gap


def draw_arrowhead(draw, p_from, p_to, color, width, size=12):
    import math
    x1, y1 = p_from
    x2, y2 = p_to
    ang = math.atan2(y2 - y1, x2 - x1)
    a1 = ang + math.radians(150)
    a2 = ang - math.radians(150)
    p1 = (x2 + size * math.cos(a1), y2 + size * math.sin(a1))
    p2 = (x2 + size * math.cos(a2), y2 + size * math.sin(a2))
    draw.line([p1, (x2, y2)], fill=color, width=width)
    draw.line([p2, (x2, y2)], fill=color, width=width)


def wrap_and_draw_text(draw, box, text, font, color, align='center', valign='middle'):
    x, y, w, h = box
    lines = text.split('\n')
    line_h = font.size * 1.3
    total_h = line_h * len(lines)
    if valign == 'top':
        start_y = y
    elif valign == 'middle':
        start_y = y + (h - total_h) / 2
    else:
        start_y = y + h - total_h
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font)
        lw = bbox[2] - bbox[0]
        if align == 'left':
            lx = x
        elif align == 'right':
            lx = x + w - lw
        else:
            lx = x + (w - lw) / 2
        ly = start_y + i * line_h
        draw.text((lx, ly), line, font=font, fill=color)


def word_wrap(draw, text, font, max_width):
    """Word-wrap text (preserving explicit newlines) to fit max_width pixels."""
    out_lines = []
    for para in text.split('\n'):
        words = para.split(' ')
        cur = ''
        for word in words:
            trial = (cur + ' ' + word).strip()
            w = draw.textbbox((0, 0), trial, font=font)[2]
            if w <= max_width or not cur:
                cur = trial
            else:
                out_lines.append(cur)
                cur = word
        out_lines.append(cur)
    return out_lines


def draw_text_in_shape(draw, shape_el, text, base_font_size, color, X, Y, bold=False):
    """Re-flow + center bound text inside its actual shape box (ignores the
    original — often too-narrow — autosize estimate from generate_diagrams.py)."""
    sx0, sy0 = X(shape_el['x']), Y(shape_el['y'])
    sw = shape_el['width'] * SCALE
    sh = shape_el['height'] * SCALE
    stype = shape_el['type']
    pad = 10 * SCALE
    if stype == 'ellipse':
        inner_w = sw * 0.72 - pad
        inner_h = sh * 0.72 - pad
    elif stype == 'diamond':
        inner_w = sw * 0.55 - pad
        inner_h = sh * 0.55 - pad
    else:
        inner_w = sw - 2 * pad
        inner_h = sh - 2 * pad
    inner_x = sx0 + (sw - inner_w) / 2
    inner_y = sy0 + (sh - inner_h) / 2

    size = base_font_size
    while size >= 8:
        font = get_font(size / SCALE, bold=bold)
        lines = word_wrap(draw, text, font, inner_w)
        line_h = font.size * 1.25
        total_h = line_h * len(lines)
        if total_h <= inner_h or size <= 8:
            break
        size -= 1

    start_y = inner_y + (inner_h - total_h) / 2
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font)
        lw = bbox[2] - bbox[0]
        lx = inner_x + (inner_w - lw) / 2
        ly = start_y + i * line_h
        draw.text((lx, ly), line, font=font, fill=color)


def render(path):
    with open(path, encoding='utf-8') as f:
        doc = json.load(f)
    elements = doc['elements']
    bg = doc.get('appState', {}).get('viewBackgroundColor', '#ffffff')

    minx, miny, maxx, maxy = compute_bbox(elements)
    minx -= PAD
    miny -= PAD
    maxx += PAD
    maxy += PAD
    W = int((maxx - minx) * SCALE)
    H = int((maxy - miny) * SCALE)

    img = Image.new('RGB', (W, H), bg)
    draw = ImageDraw.Draw(img)

    def X(v):
        return (v - minx) * SCALE

    def Y(v):
        return (v - miny) * SCALE

    # 1) shapes first (rect/diamond/ellipse), 2) arrows, 3) text on top
    shapes = [e for e in elements if e['type'] in ('rectangle', 'diamond', 'ellipse')]
    shape_by_id = {e['id']: e for e in shapes}
    arrows = [e for e in elements if e['type'] == 'arrow']
    texts = [e for e in elements if e['type'] == 'text']

    for el in shapes:
        x0, y0 = X(el['x']), Y(el['y'])
        x1, y1 = X(el['x'] + el['width']), Y(el['y'] + el['height'])
        fill = el.get('backgroundColor', 'transparent')
        if fill == 'transparent':
            fill = None
        outline = el.get('strokeColor', '#1e1e1e')
        sw = max(1, int(el.get('strokeWidth', 2) * SCALE * 0.7))
        dashed = el.get('strokeStyle') == 'dashed'
        if el['type'] == 'rectangle':
            radius = 10 * SCALE if el.get('roundness') else 0
            draw_rounded_rect(draw, (x0, y0, x1, y1), radius, fill, outline, sw, dashed=dashed)
        elif el['type'] == 'ellipse':
            draw.ellipse((x0, y0, x1, y1), fill=fill, outline=outline, width=sw)
        elif el['type'] == 'diamond':
            cx0, cy0, cx1, cy1 = x0, y0, x1, y1
            mx, my = (cx0 + cx1) / 2, (cy0 + cy1) / 2
            pts = [(mx, cy0), (cx1, my), (mx, cy1), (cx0, my)]
            draw.polygon(pts, fill=fill, outline=outline)
            if sw > 0:
                draw.line(pts + [pts[0]], fill=outline, width=sw)

    for el in arrows:
        pts = el.get('points', [[0, 0], [el['width'], el['height']]])
        abs_pts = [(X(el['x'] + px), Y(el['y'] + py)) for px, py in pts]
        color = el.get('strokeColor', '#1e1e1e')
        sw = max(1, int(el.get('strokeWidth', 2) * SCALE * 0.7))
        dashed = el.get('strokeStyle') == 'dashed'
        for i in range(len(abs_pts) - 1):
            if dashed:
                draw_dashed_line(draw, abs_pts[i], abs_pts[i + 1], color, sw)
            else:
                draw.line([abs_pts[i], abs_pts[i + 1]], fill=color, width=sw)
        if el.get('endArrowhead') == 'arrow' and len(abs_pts) >= 2:
            draw_arrowhead(draw, abs_pts[-2], abs_pts[-1], color, sw)

    for el in texts:
        color = el.get('strokeColor', '#1e1e1e')
        align = el.get('textAlign', 'left')
        valign = el.get('verticalAlign', 'top')
        container = shape_by_id.get(el.get('containerId'))
        if container is not None and align == 'center' and valign == 'middle':
            # Bound "centered" label (rect/diamond/ellipse helpers) — re-wrap to
            # actually fit inside the shape instead of trusting the stored
            # (often too-narrow) autosize estimate from generate_diagrams.py.
            draw_text_in_shape(draw, container, el['text'], el.get('fontSize', 14) * SCALE, color, X, Y)
        else:
            x0, y0 = X(el['x']), Y(el['y'])
            w = el['width'] * SCALE
            h = el['height'] * SCALE
            font = get_font(el.get('fontSize', 14), bold=False)
            wrap_and_draw_text(draw, (x0, y0, w, h), el['text'], font, color, align, valign)

    return img


def main():
    files = sorted(glob.glob(os.path.join(SRC_DIR, '*.excalidraw')))
    for path in files:
        name = os.path.splitext(os.path.basename(path))[0]
        img = render(path)
        out_path = os.path.join(OUT_DIR, name + '.png')
        img.save(out_path, 'PNG')
        print(f"rendered {name}.png  ({img.width}x{img.height})")


if __name__ == '__main__':
    main()
