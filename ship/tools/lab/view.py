"""The view lens: draws a voxel dump from yardlab.mjs (--dump) as an isometric picture, from two
corners, plus a plan view, so a yard can be looked at without the game.

    python3 tools/lab/view.py dump_dir/norse.json out.png
"""
import json, sys, re
from PIL import Image, ImageDraw

PALETTE = [
    (r"water", (64, 110, 200)), (r"glass|pane", (190, 220, 235)), (r"leaves|azalea", (70, 120, 50)),
    (r"grass_block", (95, 150, 70)), (r"dirt|mud|podzol|path", (120, 85, 60)), (r"sand", (220, 205, 150)),
    (r"spruce", (110, 80, 50)), (r"dark_oak", (70, 50, 30)), (r"birch", (215, 200, 150)), (r"jungle", (160, 115, 80)),
    (r"acacia", (175, 95, 55)), (r"mangrove", (120, 50, 45)), (r"cherry", (225, 175, 170)), (r"bamboo", (200, 190, 90)),
    (r"oak|planks|log|wood|barrel|crafting|chest|lectern|composter|fence|ladder|door|trapdoor", (165, 130, 80)),
    (r"deepslate", (75, 75, 80)), (r"cobble|stone|andesite|tuff|gravel", (130, 130, 130)), (r"brick", (160, 80, 65)),
    (r"terracotta", (170, 100, 75)), (r"sandstone", (215, 195, 140)), (r"snow|ice|bone|quartz|calcite", (235, 240, 245)),
    (r"wool|carpet|bed", (200, 60, 50)), (r"hay", (200, 170, 50)), (r"lantern|torch|campfire|candle|lamp", (255, 200, 80)),
    (r"copper", (190, 110, 80)), (r"iron|anvil|cauldron|chain", (150, 150, 155)), (r"coral|prismarine", (90, 170, 160)),
    (r"shipwright", (240, 120, 30)),
]

def colour(name):
    for pat, c in PALETTE:
        if re.search(pat, name):
            return c
    return (180, 120, 200)

def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)

def iso(blocks, flip, S=8):
    pts = []
    for x, y, z, name, st in blocks:
        if flip:
            x, z = -x, z
        pts.append((x, y, z, name, st))
    xs = [p[0] for p in pts]; zs = [p[2] for p in pts]; ys = [p[1] for p in pts]
    W = int((max(xs) - min(xs) + max(zs) - min(zs) + 4) * S * 1.0) + 40
    H = int((max(xs) - min(xs) + max(zs) - min(zs)) * S * 0.5 + (max(ys) - min(ys) + 4) * S) + 40
    img = Image.new("RGB", (W, H), (245, 242, 235))
    d = ImageDraw.Draw(img)
    ox = (max(zs) - min(zs) + 2) * S + 20
    oy = (max(ys) - min(ys) + 2) * S + 20
    def P(x, y, z):
        u = (x - min(xs)) - (z - min(zs))
        v = (x - min(xs)) + (z - min(zs))
        return (ox + u * S, oy + v * S * 0.5 - (y - min(ys)) * S)
    for x, y, z, name, st in sorted(pts, key=lambda p: (p[0] + p[2], p[1])):
        c = colour(name)
        h = 0.5 if name.endswith("_slab") and not (st or {}).get("minecraft:vertical_half") == "top" else 1
        if re.search(r"torch|lantern|flower|carpet|button|sign|banner|candle|rail|chain", name):
            h = 0.3
        lo = 0.5 if name.endswith("_slab") and (st or {}).get("minecraft:vertical_half") == "top" else 0
        top = [P(x, y + lo + h, z), P(x + 1, y + lo + h, z), P(x + 1, y + lo + h, z + 1), P(x, y + lo + h, z + 1)]
        left = [P(x, y + lo, z + 1), P(x + 1, y + lo, z + 1), P(x + 1, y + lo + h, z + 1), P(x, y + lo + h, z + 1)]
        right = [P(x + 1, y + lo, z), P(x + 1, y + lo, z + 1), P(x + 1, y + lo + h, z + 1), P(x + 1, y + lo + h, z)]
        alpha = name == "water"
        d.polygon(left, fill=shade(c, 0.7), outline=None if alpha else shade(c, 0.5))
        d.polygon(right, fill=shade(c, 0.85), outline=None if alpha else shade(c, 0.6))
        d.polygon(top, fill=c, outline=None if alpha else shade(c, 0.8))
    return img

def plan(blocks, S=10):
    top = {}
    for x, y, z, name, st in blocks:
        if (x, z) not in top or y > top[(x, z)][0]:
            top[(x, z)] = (y, name)
    xs = [k[0] for k in top]; zs = [k[1] for k in top]
    ymin = min(v[0] for v in top.values()); ymax = max(v[0] for v in top.values())
    img = Image.new("RGB", ((max(xs) + 1) * S, (max(zs) + 1) * S), (245, 242, 235))
    d = ImageDraw.Draw(img)
    for (x, z), (y, name) in top.items():
        k = 0.6 + 0.6 * (y - ymin) / max(1, ymax - ymin)
        d.rectangle([x * S, z * S, x * S + S - 1, z * S + S - 1], fill=shade(colour(name), k))
    return img

def visible(blocks):
    """Only blocks with a face open to the viewer (up, or toward +x / +z / -x): hidden ones cost time, show nothing."""
    occ = {(x, y, z) for x, y, z, n, st in blocks if n != "water"}
    keep = []
    for b in blocks:
        x, y, z = b[0], b[1], b[2]
        if b[3] == "water":
            if (x, y + 1, z) not in occ and not any(o[3] == "water" for o in ()):
                keep.append(b)
            continue
        if any(p not in occ for p in ((x, y + 1, z), (x + 1, y, z), (x, y, z + 1), (x - 1, y, z))):
            keep.append(b)
    return keep


def main():
    src, out = sys.argv[1], sys.argv[2]
    data = json.load(open(src))
    blocks = visible([b for b in data["blocks"] if not (b[3] == "water" and b[1] < 9)])
    a, b, p = iso(blocks, False), iso(blocks, True), plan(blocks)
    W = a.width + b.width + p.width
    H = max(a.height, b.height, p.height)
    sheet = Image.new("RGB", (W, H), (245, 242, 235))
    sheet.paste(a, (0, 0)); sheet.paste(b, (a.width, 0)); sheet.paste(p, (a.width + b.width, 0))
    sheet.save(out)

if __name__ == "__main__":
    main()
