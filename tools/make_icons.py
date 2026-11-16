#!/usr/bin/env python3
"""Regenerate the Seclusa Calc icons.

    python3 tools/make_icons.py

Needs Pillow.
"""

from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ICONS = HERE.parent / "static" / "icons"

SIZE = 1024
BG = (10, 10, 10, 255)
FG = (255, 255, 255, 255)


def draw_mark(scale=1.0, colour=FG):
    """Calculator body with a readout strip and a small key grid."""
    s = int(SIZE * scale)
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # Outer body
    inset = int(s * 0.18)
    d.rounded_rectangle(
        [inset, inset, s - inset, s - inset], radius=int(s * 0.08), fill=colour
    )

    # Readout (cut out of the body colour by using BG on a white body —
    # invert: draw dark wells into white body).
    well = BG if colour == FG else FG
    rx0 = int(s * 0.28)
    ry0 = int(s * 0.28)
    rx1 = int(s * 0.72)
    ry1 = int(s * 0.42)
    d.rounded_rectangle([rx0, ry0, rx1, ry1], radius=int(s * 0.03), fill=well)

    # Key grid — 3x3 dots / mini keys
    cols, rows = 3, 3
    grid_x0 = int(s * 0.30)
    grid_x1 = int(s * 0.70)
    grid_y0 = int(s * 0.48)
    grid_y1 = int(s * 0.72)
    kw = int((grid_x1 - grid_x0 - (cols - 1) * s * 0.03) / cols)
    kh = int((grid_y1 - grid_y0 - (rows - 1) * s * 0.03) / rows)
    gap_x = int(s * 0.03)
    gap_y = int(s * 0.03)
    for r in range(rows):
        for c in range(cols):
            x0 = grid_x0 + c * (kw + gap_x)
            y0 = grid_y0 + r * (kh + gap_y)
            d.rounded_rectangle(
                [x0, y0, x0 + kw, y0 + kh],
                radius=max(2, int(s * 0.015)),
                fill=well,
            )
    return layer


def make_tile(scale, colour, size):
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mark = draw_mark(scale, colour)
    # Scale mark down to requested size if needed
    if mark.size[0] != size:
        mark = mark.resize((size, size), Image.Resampling.LANCZOS)
    out.paste(mark, (0, 0), mark)
    # Clip to rounded square
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=int(size * 0.2), fill=255
    )
    bg = Image.new("RGBA", (size, size), BG)
    bg.paste(out, (0, 0), out)
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.paste(bg, (0, 0), mask)
    return result


def make_maskable(colour, size):
    out = Image.new("RGBA", (size, size), BG)
    inner = int(size * 0.72)
    mark = draw_mark(inner / SIZE, colour)
    if mark.size[0] != inner:
        mark = mark.resize((inner, inner), Image.Resampling.LANCZOS)
    off = (size - inner) // 2
    out.paste(mark, (off, off), mark)
    return out


SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Seclusa Calc">
  <rect width="1024" height="1024" rx="200" fill="#0a0a0a"/>
  <rect x="184" y="184" width="656" height="656" rx="82" fill="#ffffff"/>
  <rect x="286" y="286" width="452" height="144" rx="30" fill="#0a0a0a"/>
  <rect x="307" y="492" width="110" height="90" rx="18" fill="#0a0a0a"/>
  <rect x="457" y="492" width="110" height="90" rx="18" fill="#0a0a0a"/>
  <rect x="607" y="492" width="110" height="90" rx="18" fill="#0a0a0a"/>
  <rect x="307" y="612" width="110" height="90" rx="18" fill="#0a0a0a"/>
  <rect x="457" y="612" width="110" height="90" rx="18" fill="#0a0a0a"/>
  <rect x="607" y="612" width="110" height="90" rx="18" fill="#0a0a0a"/>
  <rect x="307" y="732" width="110" height="90" rx="18" fill="#0a0a0a"/>
  <rect x="457" y="732" width="110" height="90" rx="18" fill="#0a0a0a"/>
  <rect x="607" y="732" width="110" height="90" rx="18" fill="#0a0a0a"/>
</svg>
"""


def main():
    ICONS.mkdir(parents=True, exist_ok=True)

    for size in (192, 512):
        tile = make_tile(1.0, FG, size)
        tile.save(ICONS / f"icon-{size}.png")

    make_maskable(FG, 512).save(ICONS / "icon-maskable-512.png")
    (ICONS / "icon.svg").write_text(SVG, encoding="utf-8")

    for name in ("icon-192.png", "icon-512.png", "icon-maskable-512.png", "icon.svg"):
        print(f"static/icons/{name}")


if __name__ == "__main__":
    main()
