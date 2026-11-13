"""Draws natural Thera from tools/theramap.mjs's heights: hypsometric colours, hillshade from the
north-west, 10-block contours, the coast, a scale bar, and the places' names."""
import json, sys, array, math
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
m = json.load(open(f"{d}/meta.json")); n, S, R = m["n"], m["S"], m["R"]
h = array.array("f"); h.frombytes(open(f"{d}/h.bin", "rb").read())
def col(v):
    if v <= 0:
        t = min(1, -v / 35)
        return (int(150 - 110 * t), int(200 - 110 * t), int(225 - 70 * t))
    stops = [(0, (214, 205, 170)), (2, (172, 178, 120)), (25, (140, 158, 96)), (60, (168, 140, 100)), (100, (150, 120, 100)), (145, (215, 205, 195))]
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if v <= b:
            t = (v - a) / (b - a); return tuple(int(ca[k] + (cb[k] - ca[k]) * t) for k in range(3))
    return stops[-1][1]
img = Image.new("RGB", (n, n)); px = img.load()
for j in range(n):
    for i in range(n):
        v = h[j * n + i]; c = col(v)
        if v > 0 and 0 < i < n - 1 and 0 < j < n - 1:
            dx = (h[j * n + i + 1] - h[j * n + i - 1]) / (2 * S); dz = (h[(j + 1) * n + i] - h[(j - 1) * n + i]) / (2 * S)
            shade = max(0.45, min(1.25, 1 + (-dx - dz) * 0.9))
            c = tuple(max(0, min(255, int(x * shade))) for x in c)
        if 0 < i and 0 < j:
            a, b, cc = h[j * n + i], h[j * n + i - 1], h[(j - 1) * n + i]
            if (a > 0) != (b > 0) or (a > 0) != (cc > 0): c = (60, 50, 40)
            elif a > 0 and (int(a // 10) != int(b // 10) or int(a // 10) != int(cc // 10)): c = tuple(int(x * 0.82) for x in c)
            elif a < 0 and (int(a // 10) != int(b // 10) or int(a // 10) != int(cc // 10)): c = tuple(int(x * 0.93) for x in c)
        px[i, j] = c
dr = ImageDraw.Draw(img)
try: f = ImageFont.load_default(size=22); fs_ = ImageFont.load_default(size=16)
except Exception: f = fs_ = ImageFont.load_default()
for name, x, y in m["places"]:
    i = (x * m["KM"] + R) / S; j = (-y * m["KM"] + R) / S
    w = dr.textlength(name, font=f)
    dr.text((i - w / 2, j - 11), name, font=f, fill=(30, 25, 20), stroke_width=3, stroke_fill=(250, 248, 240))
# scale bar: 500 blocks (5 km real at 1:10)
L = 500 / S; dr.rectangle([30, n - 50, 30 + L, n - 42], fill=(30, 25, 20))
dr.text((30, n - 75), f"500 blocks  (5 km at 1:{int(1000 / m['KM'])})", font=fs_, fill=(30, 25, 20))
dr.text((30, 20), "THERA  before the eruption", font=f, fill=(30, 25, 20))
dr.text((30, 48), "north up  ·  contours every 10 blocks  ·  relief x2.5", font=fs_, fill=(60, 55, 50))
img.save(out)
