"""Merakit bingkai PNG hasil scripts/demo.mjs menjadi docs/demo.gif. Butuh Pillow.

    python scripts/rakit_gif.py bingkai/ docs/demo.gif
"""
import sys
from pathlib import Path

from PIL import Image

folder, keluar = Path(sys.argv[1]), Path(sys.argv[2])
bingkai = []
for jalur in sorted(folder.glob("*.png")):
    gambar = Image.open(jalur).convert("RGB").resize((960, 540), Image.LANCZOS)
    # palet adaptif 96 warna tanpa dither: antarmuka gelap dengan sedikit warna jadi kecil dan tetap tajam
    bingkai.append(gambar.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
bingkai[0].save(keluar, save_all=True, append_images=bingkai[1:], duration=170, loop=0, optimize=True)
print(f"{len(bingkai)} bingkai -> {keluar} ({keluar.stat().st_size / 1e6:.1f} MB)")
