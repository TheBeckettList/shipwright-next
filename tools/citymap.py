"""Labels the city plan (tools/citymap.mjs): names, a legend, a scale bar."""
import json, sys
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
m = json.load(open(f"{d}/meta.json")); n = m["n"]
base = Image.frombytes("RGB", (n, n), open(f"{d}/rgb.bin", "rb").read())
extra = 290 if m["legend"] else 0
img = Image.new("RGB", (n + extra, n), (250, 248, 240)); img.paste(base, (0, 0)); dr = ImageDraw.Draw(img)
f = ImageFont.load_default(size=20); fs = ImageFont.load_default(size=15)
for name, i, j in m["places"]:
    if 0 <= i < n and 0 <= j < n:
        w = dr.textlength(name, font=f); dr.text((i - w / 2, j - 10), name, font=f, fill=(25, 20, 15), stroke_width=3, stroke_fill=(250, 248, 240))
L = 200 / m["bpp"]; dr.rectangle([24, n - 40, 24 + L, n - 33], fill=(25, 20, 15)); dr.text((24, n - 62), "200 blocks", font=fs, fill=(25, 20, 15), stroke_width=2, stroke_fill=(250, 248, 240))
title = "THERA  the city on the cone, and the hub in the bay" if m["legend"] else "THERA  the city and the island"
dr.text((24, 16), title, font=f, fill=(25, 20, 15), stroke_width=3, stroke_fill=(250, 248, 240))
if m["legend"]:
    items = [("round harbour, merchant harbour, fairway", (45, 105, 165)), ("canals (the maze)", (80, 150, 200)), ("the Exchange", (230, 170, 60)), ("inner city / streets", (238, 232, 220)),
             ("the Library", (120, 70, 150)), ("shipsheds", (150, 120, 90)), ("cliff towns", (215, 200, 180)), ("the Light", (255, 60, 40)),
             ("Theran towns", (245, 245, 240)), ("Norse", (140, 90, 60)), ("N. European", (170, 60, 60)), ("Bark canoe", (215, 205, 170)), ("Pacific", (60, 150, 90)), ("Indian Ocean", (210, 150, 80)),
             ("East Asian", (190, 80, 60)), ("Japanese", (220, 150, 170)), ("Great dugout", (110, 70, 50)), ("Shallow water (stilts)", (150, 120, 80)), ("Arctic", (200, 215, 225))]
    x0, y0 = n + 20, 50
    for k, (t, c) in enumerate(items):
        dr.rectangle([x0, y0 + 22 * k + 3, x0 + 16, y0 + 22 * k + 17], fill=c, outline=(40, 35, 30)); dr.text((x0 + 24, y0 + 22 * k), t, font=fs, fill=(25, 20, 15))
img.save(out)
