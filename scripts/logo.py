"""Génère docs/logo.png : le mot « rockfilon » en Jersey 10 pixel pour pixel, au-dessus d'une coupe de mine.

Reprend les sprites (web/src/game/sprites.ts) et les couleurs du site pour garder la même identité.
Usage, depuis la racine du dépôt (web/node_modules installé pour la police) :
    uv run --no-project --with fonttools --with brotli --with pillow python scripts/logo.py .
"""

import math
import re
import sys
from pathlib import Path

from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont

ROOT = Path(sys.argv[1])
FONT = ROOT / "web/node_modules/@fontsource/jersey-10/files/jersey-10-latin-400-normal.woff2"
W, H, SCALE = 176, 66, 5


def rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5))


BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
bayer = lambda x, y: (BAYER[y & 3][x & 3] + 0.5) / 16  # noqa: E731


def hash_(x, y, seed=0):
    h = (x * 374761393) ^ (y * 668265263) ^ ((seed + 1) * 1274126177)
    h &= 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return (h ^ (h >> 16)) / 4294967296


def sprites():
    """Lit les sprites du site : NOM = { rows: [...], colors: {...} } et les minerais 1..6."""
    src = (ROOT / "web/src/game/sprites.ts").read_text("utf-8")
    out = {}
    for m in re.finditer(r'(\w+)(?:: SpriteDef =|:) \{\s*rows: \[(.*?)\],\s*colors: \{(.*?)\}', src, re.S):
        rows = re.findall(r'"([^"]*)"', m.group(2))
        colors = dict(re.findall(r'(\w): "(#[0-9a-f]{6})"', m.group(3)))
        out[m.group(1)] = (rows, colors)
    return out


def word_bitmap(text):
    """Pixels allumés du texte en Jersey 10 (glyphes rectilignes sur une grille de 75 unités)."""
    font = TTFont(FONT)
    gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
    unit, pixels, x0 = 75, set(), 0
    for ch in text:
        name = cmap[ord(ch)]
        pen = RecordingPen()
        gs[name].draw(pen)
        polys, cur = [], []
        for op, args in pen.value:
            if op == "moveTo":
                cur = [args[0]]
            elif op == "lineTo":
                cur.append(args[0])
            elif op in ("closePath", "endPath"):
                polys.append(cur)
        for i in range(0, 20):
            for j in range(-4, 14):
                px, py = (i + 0.5) * unit, (j + 0.5) * unit
                inside = False
                for poly in polys:  # pair-impair
                    for (ax, ay), (bx, by) in zip(poly, poly[1:] + poly[:1]):
                        if (ay > py) != (by > py) and px < ax + (py - ay) * (bx - ax) / (by - ay):
                            inside = not inside
                if inside:
                    pixels.add((x0 + i, 9 - j))  # j vers le haut -> ligne d'écran
        x0 += round(hmtx[name][0] / unit)
    return pixels


SPR = sprites()
grid = [[None] * W for _ in range(H)]


def put(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        grid[y][x] = c


def sprite(name, x0, y0):
    rows, colors = SPR[name]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                put(x0 + x, y0 + y, rgb(colors[ch]))


# --- ciel, herbe, strates (mêmes tons et motifs que PixelWorld) ---
SKY = [rgb(c) for c in ("#0a0d13", "#0f131c", "#151b26", "#1d2532")]
GRASS = [rgb(c) for c in ("#66923d", "#4a6e30", "#33502a")]
STRATA = [  # (première ligne, tons, motif)
    (36, ["#6b4a30", "#4f3622", "#402b1b", "#322115"], "humus"),
    (40, ["#a8603a", "#8a4a2c", "#743d24", "#5e311c"], "argile"),
    (47, ["#a39a84", "#857d69", "#706958", "#5b5547"], "calcaire"),
    (55, ["#b8844d", "#98693c", "#7e5631", "#644326"], "gres"),
]


def texture(p, x, y):
    if p == "humus":
        r = hash_(x, y, 1)
        return -1 if r < 0.07 else 1 if r > 0.975 else 0
    if p == "argile":
        return -1 if y % 5 == 0 and (x + (y // 5) * 7) % 14 < 8 else 0
    if p == "calcaire":
        off = (x + ((y // 6) % 2) * 6) % 12
        if y % 6 == 0 or off == 0:
            return -1
        return 1 if y % 6 == 1 and 1 < off < 6 else 0
    r = hash_(x, y, 2)
    return -1 if r < 0.1 else 1 if r > 0.96 else 0


GROUND = 34
CX = 150  # axe du puits, à droite du mot
BOTTOM = 62  # fond du puits
LAMP = (CX, BOTTOM - 2)

for y in range(H):
    for x in range(W):
        g = GROUND - (1 if hash_(x // 5, 0, 9) < 0.3 else 0)
        if y < g - 1:
            c = SKY[max(0, min(3, int(y / g * 4 + bayer(x, y) - 0.5)))]
            r = hash_(x, y, 7)
            c = rgb("#cfc8ba") if r < 0.006 else rgb("#6f6b66") if r < 0.014 else c
        elif y < g:
            c = GRASS[0] if hash_(x, 3, 8) < 0.4 else SKY[3]
        elif y == g:
            c = GRASS[1]
        elif y == g + 1:
            c = GRASS[2]
        else:
            i = max(k for k, (top, _, _) in enumerate(STRATA) if y >= top or k == 0)
            top, tones, pat = STRATA[i]
            bottom = STRATA[i + 1][0] if i + 1 < len(STRATA) else H
            t = (y - top) / max(1, bottom - top)
            tone = 1 + max(0, min(2, int(t * 3 + bayer(x, y) - 0.5)))
            tex = texture(pat, x, y)
            c = rgb(tones[0]) if tex == 1 else tuple(v * 0.7 for v in rgb(tones[tone])) if tex == -1 else rgb(tones[tone])
            # éclairage par paliers tramés : la lampe du mineur éclaire autour du puits
            d = math.hypot(x - LAMP[0], (y - LAMP[1]) * 1.2)
            light = 1 - min(1, max(0, (d - 10) / 40))
            lvl = min(3, int(light * 3 + bayer(x, y)))
            c = tuple(v * (0.42, 0.58, 0.8, 1)[lvl] for v in c)
        grid[y][x] = c

# puits, corde, chevalement
for y in range(GROUND + 1, BOTTOM + 1):
    narrow = (y - BOTTOM + 2) * 2 if y > BOTTOM - 2 else 0
    left = CX - 6 + int(hash_(0, y // 3, 12) * 3) - 1 + narrow
    right = CX + 6 + int(hash_(1, y // 3, 13) * 3) - 1 - narrow
    for x in range(left, right + 1):
        put(x, y, rgb("#2a1f17") if x in (left, right) else rgb("#0b0807"))
for y in range(GROUND - 14, BOTTOM - 4):
    put(CX, y, rgb("#7d6f5f"))
sprite("HEADFRAME", CX - 6, GROUND - 15)
put(CX, LAMP[1], rgb("#fff3c4"))
put(CX - 1, LAMP[1], rgb("#fff3c4"))

# minerais : dans les parois du puits, et quelques filons dans la roche sous le mot
for tier, x, y in [("3", CX - 6 - 12 + 4, 38), ("4", CX + 6 - 3, 45), ("1", 22, 41), ("5", 62, 52), ("2", 104, 44)]:
    sprite(tier, x, y)
bx, by = CX - 6 - 12 + 4, 50
for y in range(by - 4, by + 16):  # halo tramé du béryl rouge
    for x in range(bx - 4, bx + 16):
        d = math.hypot(x - bx - 6, y - by - 6)
        if 0 <= y < H and 0 <= x < W and d < 10 and bayer(x, y) < (1 - d / 10) * 0.75:
            grid[y][x] = tuple(a + (b - a) * 0.5 for a, b in zip(grid[y][x], rgb("#ff2e63")))
sprite("6", bx, by)

# le mot, ×2, couleur lampe, ombre portée d'un pixel de police
WORD_X, WORD_Y = 10, 7
word = word_bitmap("rockfilon")
for dx, dy, color in [(2, 2, rgb("#000000")), (0, 0, rgb("#ffc65c"))]:
    for x, y in word:
        for sx in (0, 1):
            for sy in (0, 1):
                put(WORD_X + x * 2 + sx + dx, WORD_Y + y * 2 + sy + dy, color)

# --- PNG agrandi sans lissage : le pixel art se compresse bien et reste net partout ---
from PIL import Image

img = Image.new("RGB", (W, H))
img.putdata([tuple(round(v) for v in c) for row in grid for c in row])
img = img.resize((W * SCALE, H * SCALE), Image.NEAREST)
out = ROOT / "docs/logo.png"
out.parent.mkdir(exist_ok=True)
img.save(out, optimize=True)
print(out, img.size, out.stat().st_size // 1024, "Ko, mot :", max(x for x, _ in word) + 1, "px de large")
