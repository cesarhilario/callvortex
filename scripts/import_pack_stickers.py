#!/usr/bin/env python3
"""
Copia os pacotes de figurinhas da pasta ./assets para o pacote embutido do app
(src/renderer/src/assets/stickers/<categoria>/), normalizando nomes
(minúsculas, sem espaços/"(n)") e reduzindo para 256x256 (o app exibe a
140px — 256 já é folgado e o bundle fica ~10x menor).
"""
from __future__ import annotations

import re
from pathlib import Path

from PIL import Image

SRC = Path("assets")
DST = Path("src/renderer/src/assets/stickers")

# pasta do pacote -> categoria do app (novo globo em defaultStickers.ts)
CATEGORIES = {
    "Brasil001": "brasil",
    "Christmas": "natal",
    "Animals": "selvagens",
    "Capivara": "capivara",
    "CatSavePlanet": "planeta",
    "Fantasia": "fantasia",
    "Frutas": "frutas",
}

IDX = re.compile(r"^(.*?)\s*\((\d+)\)\s*$")


def sanitize(stem: str) -> str:
    s = stem.strip().lower()
    s = s.replace("ç", "c").replace("ã", "a").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    s = re.sub(r"[\s()]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


img_count = 0
for src_dir, category in CATEGORIES.items():
    out_dir = DST / category
    out_dir.mkdir(parents=True, exist_ok=True)
    used: set[str] = set()
    for src in sorted((SRC / src_dir).glob("*.png")):
        stem = src.stem
        m = IDX.match(stem)
        if m:
            base = sanitize(m.group(1) or src_dir.lower())
            k = int(m.group(2))
            candidate = f"{base}-{k + 1}"
            while candidate in used:
                k += 1
                candidate = f"{base}-{k + 1}"
        else:
            base = sanitize(stem) or category
            candidate = base
            n = 2
            while candidate in used:
                candidate = f"{base}-{n}"
                n += 1
        used.add(candidate)

        img = Image.open(src).convert("RGBA")
        img = img.resize((256, 256), Image.LANCZOS)
        img.save(out_dir / f"{candidate}.png", optimize=True)
        img_count += 1

print(f"{img_count} figurinhas importadas")
