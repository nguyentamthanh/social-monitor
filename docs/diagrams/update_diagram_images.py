#!/usr/bin/env python3
"""Replace the image blob of specific already-embedded diagrams in the BA docx
in place (used after regenerating a PNG whose content/branding changed, so we
don't have to re-run the full insert pipeline and duplicate images)."""
import os
from docx import Document
from docx.oxml.ns import qn

HERE = os.path.dirname(os.path.abspath(__file__))
DOCX_PATH = os.path.normpath(os.path.join(HERE, '..', 'BA-Social-Monitor-Copyright-Checker.docx'))
DOCX_OUT_PATH = os.path.normpath(os.path.join(HERE, '..', 'BA-Copyright-Checker.docx'))
PNG_DIR = os.path.join(HERE, 'diagrams', 'png')

# caption prefix -> new png filename
REPLACEMENTS = {
    'Hình 3. Tổng quan kiến trúc': '01-tong-quan-kien-truc.png',
    'Hình 6. Mô hình dữ liệu': '05-mo-hinh-du-lieu-erd.png',
}


def get_blip_rid(paragraph):
    ns = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
    blip = paragraph._p.find('.//' + ns + 'blip')
    if blip is None:
        return None
    return blip.get(qn('r:embed'))


def main():
    document = Document(DOCX_PATH)
    paras = document.paragraphs
    done = 0
    for i, p in enumerate(paras):
        text = p.text.strip()
        for prefix, png_name in REPLACEMENTS.items():
            if text.startswith(prefix):
                img_para = paras[i - 1]
                rid = get_blip_rid(img_para)
                if not rid:
                    print(f"!! no image found before caption: {prefix}")
                    continue
                image_part = document.part.related_parts[rid]
                with open(os.path.join(PNG_DIR, png_name), 'rb') as f:
                    new_bytes = f.read()
                image_part._blob = new_bytes
                print(f"replaced image for '{prefix}' with {png_name} ({len(new_bytes)} bytes)")
                done += 1
    document.save(DOCX_OUT_PATH)
    print(f"SAVED to {DOCX_OUT_PATH} ({done} images replaced)")


if __name__ == '__main__':
    main()
