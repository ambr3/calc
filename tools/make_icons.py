#!/usr/bin/env python3
"""Regenerate Seclusa Calc icons from static/icons/icon.svg.

    python3 tools/make_icons.py

Needs ImageMagick (`magick`). Install icons always use a white tile background.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ICONS = HERE.parent / "static" / "icons"
SVG = ICONS / "icon.svg"


def magick(*args: str) -> None:
    cmd = ["magick", *args]
    try:
        subprocess.run(cmd, check=True)
    except FileNotFoundError:
        sys.stderr.write("magick (ImageMagick) not found\n")
        raise SystemExit(1)
    except subprocess.CalledProcessError as err:
        raise SystemExit(err.returncode) from err


def main() -> None:
    if not SVG.is_file():
        sys.stderr.write(f"missing {SVG}\n")
        raise SystemExit(1)

    ICONS.mkdir(parents=True, exist_ok=True)

    for size in (192, 512):
        out = ICONS / f"icon-{size}.png"
        # White tile behind the SVG so home-screen / splash never show through.
        magick(
            "-size", f"{size}x{size}", "xc:#ffffff",
            "(", str(SVG), "-background", "none", "-resize", f"{size}x{size}", ")",
            "-gravity", "center", "-compose", "over", "-composite",
            f"PNG32:{out}",
        )

    # Maskable: white canvas, mark inset in the safe zone.
    magick(
        "-size", "512x512", "xc:#ffffff",
        "(", str(SVG), "-background", "none", "-resize", "410x410", ")",
        "-gravity", "center", "-compose", "over", "-composite",
        f"PNG32:{ICONS / 'icon-maskable-512.png'}",
    )

    for name in ("icon-192.png", "icon-512.png", "icon-maskable-512.png", "icon.svg"):
        print(f"static/icons/{name}")


if __name__ == "__main__":
    main()
