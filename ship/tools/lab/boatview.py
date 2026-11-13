"""The boat view lens: draws a boat model (hull, masts and set sails, as the animation places them at
the longest hull) from the side and from above-quarter, at its true scale, next to a 2-block player
for size. No game needed.

    python3 tools/lab/boatview.py carrack out.png [style]
"""
import json, math, re, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import gen_boats as G  # noqa: E402

STYLE_BONE = {"square": "rig_square", "lateen": "rig_lateen", "crab_claw": "rig_crab", "junk": "rig_junk"}
COL = {"hull": (150, 105, 60), "keel": (95, 65, 35), "frame": (120, 85, 50), "mast": (110, 80, 45), "rig": (235, 228, 210),
       "pennant": (190, 40, 40), "oar": (130, 95, 55), "rudder": (100, 70, 40)}


def pick(name):
    for k, c in COL.items():
        if k in name:
            return c
    return (150, 105, 60)


def cubes(pid, style):
    b = G.BOATS[pid]
    hs = b.get("scale", 1)
    mids = G.MAX_MIDS
    plan = G.mast_plan(b)
    out = []
    geo = json.loads((ROOT / f"RP/models/entity/{pid}.geo.json").read_text())["minecraft:geometry"]
    want = {"": None, ".fittings": None, ".rig": None}
    for g in geo:
        gid = g["description"]["identifier"].replace(f"geometry.shipwright.{pid}", "")
        if gid not in want:
            continue
        for bone in g["bones"]:
            n = bone["name"]
            if gid == ".fittings" and not (n.startswith(("mast", "helm_")) or n in ("rudder_post", "staff")):
                continue
            if gid == ".rig":
                base = re.sub(r"_\d+$", "", n)
                if base != STYLE_BONE[style] and not n.startswith("pennant"):
                    continue
            k = int(n.rsplit("_", 1)[1]) if re.search(r"(mast|rig_\w+)_\d+$", n) else 0
            dz = 0.0
            if n.startswith(("mast", "rig_", "pennant")):
                dz = -mids * 8 + (plan[k][0] * (mids + 3) * 16 if k < len(plan) else 0)
            for c in bone.get("cubes", []):
                (x, y, z), (sx, sy, sz) = c["origin"], c["size"]
                out.append((x, y, z + dz, sx, sy, sz, pick(n)))
    ys = 1 + (hs - 1) * 0.4
    # model px -> blocks, at the boat's scale (x and z by hs, y by the height factor), root lift included
    return [((x) * hs / 16, (y + G.HULL_LIFT) * ys / 16, (z) * hs / 16, sx * hs / 16, sy * ys / 16, sz * hs / 16, c) for x, y, z, sx, sy, sz, c in out]


def draw(cs, view, S):
    def P(x, y, z):
        if view == "side":
            return (z * S, -y * S)
        u, v = x - z, x + z                                       # isometric
        return (u * S * 0.87, v * S * 0.5 - y * S)
    polys = []
    for x, y, z, sx, sy, sz, c in cs:
        X, Y, Z = x + sx, y + sy, z + sz
        if view == "side":
            polys.append((-x, [P(x, y, z), P(x, y, Z), P(x, Y, Z), P(x, Y, z)], c))
        else:
            key = x + z + y * 0.01
            polys.append((key, [P(x, Y, z), P(X, Y, z), P(X, Y, Z), P(x, Y, Z)], c))
            polys.append((key, [P(x, y, Z), P(X, y, Z), P(X, Y, Z), P(x, Y, Z)], tuple(int(v * 0.72) for v in c)))
            polys.append((key, [P(X, y, z), P(X, y, Z), P(X, Y, Z), P(X, Y, z)], tuple(int(v * 0.86) for v in c)))
    polys.sort(key=lambda p: p[0])
    xs = [q[0] for _, pts, _ in polys for q in pts]; ys = [q[1] for _, pts, _ in polys for q in pts]
    W, H = int(max(xs) - min(xs)) + 60, int(max(ys) - min(ys)) + 60
    img = Image.new("RGB", (W, H), (236, 242, 248))
    d = ImageDraw.Draw(img)
    ox, oy = 30 - min(xs), 30 - min(ys)
    wl = oy + 0.4 * S * (1 if view == "side" else 1)
    if view == "side":
        d.rectangle([0, wl, W, H], fill=(120, 160, 205))
    for _, pts, c in polys:
        d.polygon([(px + ox, py + oy) for px, py in pts], fill=c, outline=tuple(int(v * 0.6) for v in c))
    if view == "side":                                            # a player for scale, on the quay at the waterline
        d.rectangle([10, wl - 1.8 * S, 10 + 0.6 * S, wl], fill=(60, 90, 160))
    return img


def main():
    pid, out = sys.argv[1], sys.argv[2]
    style = sys.argv[3] if len(sys.argv) > 3 else {"square": "square", "fore_and_aft": "lateen"}.get("square")
    plans = (ROOT / "BP/scripts/config/plans.js").read_text()
    m = re.search(rf'id: "{pid}".*?rigStyle: "(\w+)"', plans, re.S)
    if len(sys.argv) <= 3 and m:
        style = m.group(1)
    cs = cubes(pid, style)
    S = 12 if G.BOATS[pid].get("scale", 1) >= 4 else 20
    a, b = draw(cs, "side", S), draw(cs, "iso", S)
    sheet = Image.new("RGB", (a.width + b.width, max(a.height, b.height)), (236, 242, 248))
    sheet.paste(a, (0, 0)); sheet.paste(b, (a.width, 0))
    sheet.save(out)


if __name__ == "__main__":
    main()
