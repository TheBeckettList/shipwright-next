import json, sys
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
m = json.load(open(f"{d}/meta.json"))
img = Image.frombytes("RGB", (m["w"], m["h"]), open(f"{d}/rgb.bin", "rb").read())
can = Image.new("RGB", (m["w"], m["h"] + 120), (250, 248, 240)); can.paste(img, (0, 120)); dr = ImageDraw.Draw(can)
f = ImageFont.load_default(size=20); fs = ImageFont.load_default(size=15)
dr.text((14, 10), m["title"], font=f, fill=(25, 20, 15))
dr.text((14, 40), m["a"][:120], font=fs, fill=(25, 20, 15)); dr.text((m["w"] // 2 + 14, 40), m["b"][:120], font=fs, fill=(25, 20, 15))
items = [("water", (150, 195, 225)), ("harbour", (30, 70, 140)), ("civic", (200, 60, 60)), ("market", (235, 170, 50)), ("homes", (235, 225, 205)), ("crafts", (150, 100, 70)), ("farms", (190, 200, 90)), ("pasture", (120, 170, 90)), ("wall", (60, 55, 50)), ("gate", (250, 250, 250)), ("old wall", (130, 120, 110))]
for k, (t, c) in enumerate(items):
    x = 14 + k * 96; dr.rectangle([x, 80, x + 14, 94], fill=c, outline=(40, 35, 30)); dr.text((x + 20, 78), t, font=fs, fill=(25, 20, 15))
can.save(out)
