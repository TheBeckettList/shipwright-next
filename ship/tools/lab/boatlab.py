"""The boat lab: looks at every generated boat model through lenses, no game needed.

    python3 tools/lab/boatlab.py [boat ...]

Lenses
  gaps      the planking's run from stern to bow has no holes (light through the hull)
  overlaps  two cubes sharing a face plane, facing the same way, overlapping: they z-fight (flicker)
  stand     a player standing on the laid deck: feet against the hull's floor, and the gunwale
            against their knees (do they sink into the floor, or stand above a rail too low to hold)

Cubes are in model pixels (16 to a block). Rotated cubes and bones are skipped by the face lens
(their planes aren't axis-aligned).
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import gen_boats as G  # noqa: E402


def bones_of(pid):
    geo = json.loads((ROOT / f"RP/models/entity/{pid}.geo.json").read_text())
    return [b for g in geo["minecraft:geometry"] for b in g["bones"]]


def rotated(bone, byname):
    while bone:
        if any(abs(r) > 1e-6 for r in bone.get("rotation", [0, 0, 0])):
            return True
        bone = byname.get(bone.get("parent"))
    return False


def ancestors(bone, byname):
    out = []
    while bone:
        out.append(bone["name"])
        bone = byname.get(bone.get("parent"))
    return out


def gaps(pid, bones):
    """Holes along the planked run, stern to bow."""
    runs = []
    for b in bones:
        if b["name"].endswith("_plank") or b["name"] in ("bow_plank", "stern_plank"):
            for c in b.get("cubes", []):
                runs.append((c["origin"][2], c["origin"][2] + c["size"][2]))
    if not runs:
        return ["no planking"]
    runs.sort()
    holes, reach = [], runs[0][1]
    for a, b in runs[1:]:
        if a > reach + 0.01:
            holes.append(f"{reach:.2f}..{a:.2f}")
        reach = max(reach, b)
    return holes


def faces(c):
    k = c.get("inflate", 0)
    (x, y, z), (sx, sy, sz) = [v - k for v in c["origin"]], [v + 2 * k for v in c["size"]]
    yield ("x-", x, (y, y + sy, z, z + sz)); yield ("x+", x + sx, (y, y + sy, z, z + sz))
    yield ("y-", y, (x, x + sx, z, z + sz)); yield ("y+", y + sy, (x, x + sx, z, z + sz))
    yield ("z-", z, (x, x + sx, y, y + sy)); yield ("z+", z + sz, (x, x + sx, y, y + sy))


def overlaps(pid, bones):
    """Coplanar, same-facing, overlapping faces from different cubes (z-fighting)."""
    byname = {b["name"]: b for b in bones}
    planes = {}
    for b in bones:
        if rotated(b, byname):
            continue
        for i, c in enumerate(b.get("cubes", [])):
            if any(abs(r) > 1e-6 for r in c.get("rotation", [0, 0, 0])) or min(c["size"]) <= 0:
                continue
            for d, at, rect in faces(c):
                planes.setdefault((d, round(at, 3)), []).append((b["name"], i, rect))
    solids = []
    for b in bones:
        if rotated(b, byname):
            continue
        for c in b.get("cubes", []):
            if any(abs(r) > 1e-6 for r in c.get("rotation", [0, 0, 0])):
                continue
            k = c.get("inflate", 0)
            (x, y, z), (sx, sy, sz) = [v - k for v in c["origin"]], [v + 2 * k for v in c["size"]]
            solids.append((b["name"], (x, x + sx, y, y + sy, z, z + sz)))

    def covered(d, at, rect, skip):
        """The face is hidden: the space just outside it is inside some other cube."""
        e = 0.02 * (1 if d[1] == "+" else -1)
        u, v = (rect[0] + rect[1]) / 2, (rect[2] + rect[3]) / 2
        p = {"x": (at + e, u, v), "y": (u, at + e, v), "z": (u, v, at + e)}[d[0]]
        for n, (x0, x1, y0, y1, z0, z1) in solids:
            if n in skip or exclusive(n, skip[0]) or exclusive(n, skip[1]):
                continue
            if x0 < p[0] < x1 and y0 < p[1] < y1 and z0 < p[2] < z1:
                return True
        return False

    hits = []
    for (d, at), fs in planes.items():
        for i in range(len(fs)):
            for j in range(i + 1, len(fs)):
                (n1, _, r1), (n2, _, r2) = fs[i], fs[j]
                if n1 == n2:
                    continue
                # parts that never show together (alternatives) can't fight
                if exclusive(n1, n2):
                    continue
                ox = min(r1[1], r2[1]) - max(r1[0], r2[0])
                oy = min(r1[3], r2[3]) - max(r1[2], r2[2])
                if ox > 0.05 and oy > 0.05:
                    rect = (max(r1[0], r2[0]), min(r1[1], r2[1]), max(r1[2], r2[2]), min(r1[3], r2[3]))
                    if covered(d, at, rect, (n1, n2)):
                        continue
                    fam = "/".join(sorted(re.sub(r"_\d+", "_i", n) for n in (n1, n2)))
                    hits.append(f"{fam} {d}")
    # one line per kind of clash (the same clash repeats at every section)
    from collections import Counter
    return [f"{k} x{n}" for k, n in Counter(hits).most_common()]


# one way of moving or steering at a time: the render controllers show the steering oar or T-rudder ("rudder") only
# under sail with rudder type 0, the sternpost rudder with type 1, a scull or pole in place of both, the stern staff
# only when there is no sail (S002/S003: the foiler's T-rudder hangs on the centre line, where the others do)
PROPULSION = {"paddle", "dpaddle", "pole", "scull", "staff", "rudder_post", "rudder"}


def exclusive(a, b):
    """Bones that are alternatives (sail styles, furled vs set, deck module options at one station,
    one way of moving or steering)."""
    if a in PROPULSION and b in PROPULSION:
        return True
    if {a, b} & {"staff"} and (a.startswith("rig_") or b.startswith("rig_")):   # the stern staff stands only when there is no sail
        return True
    if a.startswith("mast") or b.startswith("mast"):           # masts slide to their stations at run time
        return True
    # a rig is lifted, slid and scaled to its hull at run time (gen_boats animation: lift, slide, rs), so where its cut
    # cloth's box meets a paddle or pole in the file is not where they meet in the game (S002)
    if (a in PROPULSION and b.startswith("rig_")) or (b in PROPULSION and a.startswith("rig_")):
        return True
    # the furnace and its cranks are brought to a block's true size at run time (gen_boats true_size), scaled about
    # their own pivot, so where their authored box meets a rig or a paddle in the file is not where they meet in game
    scaled = lambda n: n == "furnace" or n.startswith("crank_")
    moved = lambda n: n.startswith(("rig_", "oar_")) or n in PROPULSION
    if (scaled(a) and moved(b)) or (scaled(b) and moved(a)):
        return True
    alt = ("rig_", "sail_", "furl", "deck_", "tt_", "oar_", "power_", "canopy", "ama", "float", "shield", "pennant", "flag")
    if a.split("_")[0] == b.split("_")[0] and any(a.startswith(p) for p in alt):
        return True
    return any(a.startswith(p) for p in alt) and any(b.startswith(p) for p in alt)


def stand(pid, b):
    """Feet of a player on the laid deck vs the hull's walked floor and rail, in world pixels above the entity's origin
    (the launched model: her keel the law's draught under the water, D-004)."""
    # The deck is barriers in the water block the hull floats in (or whole blocks over it on a decked ship: grid.js
    # topDeckUp); the boat floats with its origin WATERLINE under the water's top, so feet stand there.
    s = b.get("scale", 1)
    feet = (G.WATERLINE + b["_deck"]["up"]) * 16
    floor = G.root_lift(b) + G.deck_y(b) * s
    rail = G.root_lift(b) + (b["side"] + b["wash"]) * s
    return {"feet": round(feet, 1), "floor": round(floor, 1), "rail": round(rail, 1), "rail_above_feet": round(rail - feet, 1)}


def main():
    want = sys.argv[1:] or [k for k in G.BOATS if k != "testship"]
    bad = 0
    for pid in want:
        bones = bones_of(pid)
        g, o, s = gaps(pid, bones), overlaps(pid, bones), stand(pid, G.BOATS[pid])
        issues = len(g) + len(o) + (1 if s["floor"] > s["feet"] + 2 else 0)
        bad += issues
        print(f"{pid}: {'clean' if not issues else f'{issues} issue(s)'}  stand {s}")
        if g:
            print(f"  gaps: {', '.join(g[:8])}")
        if o:
            print(f"  overlaps ({len(o)}): {'  '.join(o[:6])}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
