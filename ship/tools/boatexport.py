"""Every boat's model as boxes, each given by its eight corners in blocks, as the game shows it, for the world viewer's 3D boats: the launched hull, its fittings (masts, rudders,
foils, floats) and its own rig, laid out as the animation lays them at the longest hull (every mid section showing,
the bow slid out, the masts at their places), in blocks, each box with its bone's pivot and rotation.

    python3 tools/boatexport.py out.json
    python3 tools/boatexport.py --uv out.json     each face also carries where it sits on its texture sheet (the hull's
                                                  wood or the sail's cloth), so the viewer draws the game's own textures
"""
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import gen_boats as G  # noqa: E402
import sailcloth as SC  # noqa: E402

RIG_OF = {"theran_skiff": "wing", "theran_ship": "wing", "theran_flagship": "wing", "outrigger": "crab_claw", "voyaging_canoe": "crab_claw",
          "drua": "crab_claw", "sewn_boat": "lateen", "dhow": "lateen", "baghlah": "lateen", "sampan": "junk", "junk": "junk", "fuchuan": "junk"}
SAILLESS = {"bark_canoe", "dugout", "punt", "kayak", "freight_canoe", "war_canoe", "flatboat", "umiak"}
PART = [("net", (226, 214, 180)), ("aka", (110, 80, 45)), ("ram", (176, 112, 64)), ("spar", (120, 88, 52)), ("hull", (150, 105, 60)), ("keel", (95, 65, 35)), ("mast", (110, 80, 45)), ("rig", (238, 232, 216)), ("oar", (130, 95, 55)),
        ("rudder", (100, 70, 40)), ("foil", (196, 160, 70)), ("ama", (150, 105, 60)), ("pennant", (190, 40, 40))]
THERAN = {"net": (214, 172, 62), "aka": (244, 240, 230), "ram": (232, 188, 70), "spar": (214, 172, 62), "hull": (244, 240, 230), "keel": (214, 172, 62), "mast": (214, 172, 62), "rig": (248, 246, 240), "rudder": (214, 172, 62),
          "foil": (214, 172, 62), "ama": (244, 240, 230), "oar": (214, 172, 62), "pennant": (40, 80, 170)}


def R_of(rot):
    """A file rotation [rx, ry, rz] (degrees) as the matrix the game turns by, in shown coordinates (x mirrored, as
    Blockbench shows a Bedrock model): Rz(rz) . Ry(-ry) . Rx(-rx), right-handed."""
    a, b, c = (math.radians(v) for v in (-rot[0], -rot[1], rot[2]))
    ca, sa, cb, sb, cc, sc = math.cos(a), math.sin(a), math.cos(b), math.sin(b), math.cos(c), math.sin(c)
    Rx = [[1, 0, 0], [0, ca, -sa], [0, sa, ca]]
    Ry = [[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]]
    Rz = [[cc, -sc, 0], [sc, cc, 0], [0, 0, 1]]
    mul = lambda A, B: [[sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    return mul(Rz, mul(Ry, Rx))


def turn(p, piv, R):
    d = [p[0] - piv[0], p[1] - piv[1], p[2] - piv[2]]
    return [piv[i] + sum(R[i][k] * d[k] for k in range(3)) for i in range(3)]


def corners(c, piv, rot, sy_scale=None):
    """A cube's eight corners in shown model px: its own rotation about its own pivot, then its bone's."""
    (x, y, z), (sx, sy, sz) = c["origin"], c["size"]
    if sy_scale:
        sy = sy_scale(sy)
    inf = c.get("inflate", 0)
    pts = [[-(x - inf + i * (sx + 2 * inf)), y - inf + j * (sy + 2 * inf), z - inf + l * (sz + 2 * inf)]
           for i in (0, 1) for j in (0, 1) for l in (0, 1)]
    if c.get("rotation"):
        cp = c.get("pivot", [0, 0, 0])
        R = R_of(c["rotation"])
        pts = [turn(q, [-cp[0], cp[1], cp[2]], R) for q in pts]
    if any(rot):
        R = R_of(rot)
        pts = [turn(q, [-piv[0], piv[1], piv[2]], R) for q in pts]
    return pts


def cloth_of(c):
    """A cloth panel's sail type and its slice (u0, u1) of that cloth, or None."""
    uv = c.get("uv")
    if not isinstance(uv, dict):
        return None
    for face, axis in (("west", "z"), ("north", "x")):
        f = uv.get(face)
        if not f or f["uv_size"][0] <= 0 or f["uv"] == list(SC.SOLID[:2]):
            continue
        for k, (rx, ry, rw, rh) in SC.REGION.items():
            if rx <= f["uv"][0] < rx + rw and ry <= f["uv"][1] < ry + rh:
                u0 = (f["uv"][0] - rx) / rw
                return k, axis, round(u0, 4), round(u0 + f["uv_size"][0] / rw, 4)
    return None


def masks(n=48):
    """Each cloth's cut at n by n: 0 none, 1 cloth, 2 seam or edge tape."""
    out = {}
    for k in SC.REGION:
        cut = [[SC.inside(k, (i + 0.5) / n, (j + 0.5) / n) for i in range(n)] for j in range(n)]
        rows = []
        for j in range(n):
            row = ""
            for i in range(n):
                if not cut[j][i]:
                    row += "0"
                    continue
                edge = any(not (0 <= i + a < n and 0 <= j + b < n and cut[j + b][i + a]) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                u, v = (i + 0.5) / n, (j + 0.5) / n
                seam = any((ax == "u" and abs(u - t) * n < 0.5) or (ax == "v" and abs(v - t) * n < 0.5) for ax, t in SC.seams(k))
                row += "2" if edge or seam else "1"
            rows.append(row)
        out[k] = "".join(rows)
    return {"n": n, "cut": out}


# a cube's six faces as (name, the four corners' indices in corners() order (i x, j y, l z: i*4 + j*2 + l), as
# top-left, top-right, bottom-right, bottom-left seen from outside)
FACES = (("north", (5, 1, 0, 4)), ("south", (3, 7, 6, 2)), ("east", (7, 5, 4, 6)), ("west", (1, 3, 2, 0)), ("up", (1, 5, 7, 3)), ("down", (2, 6, 4, 0)))


def face_uvs(c):
    """Where each face of a cube sits on its sheet, [face index, u, v, w, h] in texture pixels: per-face uv as the
    file gives it, or Bedrock's box layout from one corner. Faces the file leaves out aren't drawn."""
    uv = c.get("uv")
    out = []
    if isinstance(uv, dict):
        for k, (f, _) in enumerate(FACES):
            if f in uv and abs(uv[f]["uv_size"][0]) * abs(uv[f]["uv_size"][1]) > 0:
                out.append([k, *[round(v, 3) for v in uv[f]["uv"]], *[round(v, 3) for v in uv[f]["uv_size"]]])
    elif isinstance(uv, list):
        u, v = uv
        sx, sy, sz = (math.floor(abs(a)) for a in c["size"])
        box = {"up": (u + sz, v, sx, sz), "down": (u + sz + sx, v + sz, sx, -sz), "east": (u, v + sz, sz, sy),
               "north": (u + sz, v + sz, sx, sy), "west": (u + sz + sx, v + sz, sz, sy), "south": (u + 2 * sz + sx, v + sz, sx, sy)}
        out = [[k, *box[f]] for k, (f, _) in enumerate(FACES)]
    return out


def kind(bone):
    for k, _ in PART:
        if k in bone:
            return k
    return "hull"


def export(pid, with_uv=False, mids=None, names=False):
    """mids: how many mid sections show (the game's v.mids for a length); by default her typical length's.
    names: also list, beside "boxes", each piece's bone and geometry ("bones": [[bone, group], ...]) for the
    engineering lens (englab.py), which tells hull from mast from ram by them. Neither changes the default output."""
    b = G.BOATS[pid]
    hs = b.get("scale", 1)
    if mids is None:
        mids = max(1, round((G.TYPICAL_BLOCKS[hs] * 16 / hs - 2 * G.END) / G.SEG))   # drawn at her typical length
    tags = []
    ys = G.y_scale(hs)
    lift = G.root_lift(b)                            # world px: the keel the law's draught under the water (launched)
    foot = G.mast_foot(b)                            # the mast's step, which its height grows from
    plan = G.mast_plan(b)
    rig = None if pid in SAILLESS else RIG_OF.get(pid, "square")
    geo = {g["description"]["identifier"].replace(f"geometry.shipwright.{pid}", ""): g for g in
           json.loads((ROOT / f"RP/models/entity/{pid}.geo.json").read_text())["minecraft:geometry"]}
    out, mf, tf = [], G.mast_factors(b), G.mast_thickness(b)
    for gid in (".launched", ".fittings", ".rig", ".outfit"):
        for bone in geo[gid]["bones"]:
            n = bone["name"]
            if gid == ".outfit" and (n != "ram" or not pid.startswith(("league_", "theran_"))):
                continue                                 # D-005: a ram only where it was used (unfitted ships show none)
            rows = (b.get("ports") or b.get("banks")) and re.match(r"oar_(\d+)_[rl]$", n) and int(n.split("_")[1]) < mids
            if gid == ".fittings" and not (n.startswith(("mast", "rudder", "foils", "amas", "akas", "nets")) or n in ("staff",) or rows):
                continue
            if gid == ".fittings" and n.startswith("mast") and not rig:
                continue
            if n.startswith("rudder") and n != ("rudder_post" if b.get("scale", 1) > 1 else "rudder"):
                continue
            mm = re.match(r"mid_(\d+)", n)
            if mm and int(mm.group(1)) >= mids:
                continue
            if gid == ".rig":
                base = re.sub(r"_\d+$", "", n)
                if not rig or (base != G.RIG_BONES[rig] and not n.startswith("pennant")):
                    continue
            k = int(n.rsplit("_", 1)[1]) if re.search(r"(mast|rig_\w+)_\d+$", n) else 0
            dz = 0.0
            if n.startswith(("mast", "rig_", "pennant")):
                dz = -mids * 8 + (plan[k][0] * (mids + 3) * 16 if k < len(plan) else 0)
            if n.startswith("pennant") and rig:          # the pennant flies from the masthead, wherever the mast was trimmed
                dy = (mf[rig] - 1) * (bone["pivot"][1] - foot)
                bone = dict(bone, pivot=[bone["pivot"][0], bone["pivot"][1] + dy, bone["pivot"][2]],
                            cubes=[dict(c, origin=[c["origin"][0], c["origin"][1] + dy, c["origin"][2]]) for c in bone["cubes"]])
            if n.startswith(("foils", "amas", "akas", "nets")):
                dz = -mids * 8
            elif n.startswith("bow") or n == "ram":
                dz = (G.max_mids(b) - mids) * G.SEG   # the bow slides aft to close up on the last mid section
            piv, rot = bone.get("pivot", [0, 0, 0]), bone.get("rotation", [0, 0, 0])
            for c in bone.get("cubes", []):
                grow = None
                if n.startswith("mast") and rig:            # the mast: its own rig's height and thickness
                    grow = lambda v: v * mf[rig]                 # the mast grows from its step (its cube starts there)
                    w = c["size"][0] * tf[rig]
                    c = dict(c, origin=[c["origin"][0] + (c["size"][0] - w) / 2, c["origin"][1], c["origin"][2] + (c["size"][2] - w) / 2],
                             size=[w, c["size"][1], w])
                cl = cloth_of(c) if n.startswith("rig_") else None
                if cl:                                       # a cloth panel: its face, cut by its sail's mask
                    k_, axis, u0, u1 = cl
                    (x, y, z), (sx, sy, sz) = c["origin"], c["size"]
                    if axis == "z":
                        xm = x + sx / 2
                        quad = [(xm, y + sy, z), (xm, y + sy, z + sz), (xm, y, z + sz), (xm, y, z)]
                    else:
                        zm = z + sz / 2
                        quad = [(x, y + sy, zm), (x + sx, y + sy, zm), (x + sx, y, zm), (x, y, zm)]
                    R = R_of(rot) if any(rot) else None
                    flat = []
                    for q in quad:
                        q = [-q[0], q[1], q[2]]
                        if R:
                            q = turn(q, [-piv[0], piv[1], piv[2]], R)
                        flat += [round(q[0] * hs / 16, 3), round((q[1] * ys + lift) / 16, 3), round((q[2] + dz) * hs / 16, 3)]
                    face = c["uv"]["west" if axis == "z" else "north"]
                    out.append(["cloth", k_, u0, u1] + flat + ([[*face["uv"], *face["uv_size"]]] if with_uv else []))
                    tags.append([n, gid[1:]])
                    continue
                pts = corners(c, piv, rot, grow)
                flat = []
                for (x, y, z) in pts:
                    flat += [round(x * hs / 16, 3), round((y * ys + lift) / 16, 3), round((z + dz) * hs / 16, 3)]
                spar_uv = isinstance(c.get("uv"), dict) and c["uv"].get("up", {}).get("uv") == list(SC.SPAR[:2])
                out.append(flat + ["spar" if spar_uv else kind(n)] + (["s" if gid == ".rig" else "h", face_uvs(c)] if with_uv else []))
                tags.append([n, gid[1:]])
    pal = THERAN if pid.startswith("theran_") else dict(PART)
    res = {"scale": hs, "rig": rig, "parts": {k: pal.get(k, (150, 105, 60)) for k, _ in PART}, "boxes": out}
    if names:
        res["bones"] = tags
    if with_uv:                                      # the sheets she's drawn in by default: her keel's wood, white cloth
        theran = pid.startswith("theran_")
        wood = re.search(r'id: "' + pid + r'"[^}]*?keelWood: "(\w+)"', PLANS_SRC)
        res["sheets"] = {"h": "hull_theran" if theran else f"hull_{wood.group(1) if wood else 'oak'}", "s": "sail_theran" if theran else "sail_white"}
        res["faces"] = [f for f, _ in FACES]
    return res


PLANS_SRC = (ROOT / "BP/scripts/config/plans.js").read_text()

if __name__ == "__main__":
    with_uv = "--uv" in sys.argv
    sys.argv = [a for a in sys.argv if a != "--uv"]
    names = dict(re.findall(r'"(\w+)": "([^"]+)"', (ROOT / "tools/gen_entities.py").read_text().split("BOATS = {")[1].split("}")[0]))
    data = {pid: {"name": names.get(pid, pid), **export(pid, with_uv)} for pid in G.BOATS}
    data["_cloth"] = masks()
    Path(sys.argv[1]).write_text(json.dumps(data, separators=(",", ":")))
    print(f"{len(data) - 1} boats, {sum(len(d['boxes']) for k, d in data.items() if k[0] != '_')} pieces -> {sys.argv[1]}")
