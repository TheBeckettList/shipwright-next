"""The engineering lens: every boat's model held against the law the world is laid from, one line a boat, the
model's figure beside the law's (like the house's probes), a `!` on each failing check.

    python3 tools/lab/englab.py                 one line per boat
    python3 tools/lab/englab.py --json          [ENG] {k, law, model, checks, fails} lines (the ratchet's input)
    python3 tools/lab/englab.py --boat carrack  only these boats (repeatable)
    python3 tools/lab/englab.py --ratchet       rewrite tests/engineering.json from today's counts (after a fix lowers
                                                them; its "hard" list is kept: checks the whole fleet must pass)

How it works. The law comes from tools/lab/lawdump.mjs (run under the test mocks so each plan also carries the
entity properties the game sets on her at launch); there is no Python copy of the core. The model comes from the
files the game reads: RP/models (through boatexport.export, the game-faithful layout, at the mid count the game
gives her typical length), RP/render_controllers, RP/entity and RP/animations (their Molang evaluated here against
those launch properties, under way: sail drawing, oars pulling). Measures are in blocks unless marked px (16 a block).

Checks (fail counts in brackets; chief.md §5, D-004, D-005):
  conn      [detached pieces] every box of the launched hull, fittings, rig and outfit touches the hull's
            connected graph (separating-axis test, within half a world pixel); cloth quads count as links
  step      [masts] each mast's foot within half a pixel of the floor or keel top under it (or sunk into it)
  thick     [1 + keel] the launched shell's median least side vs the wall law w(L); the keel's vs max(2, phi w)
  depth     model D / law D within [phi^-1/2, phi^1/2] (a half-step on the golden ladder)
  lb        model L:B / the fleet's L:B within the same half-step
  draught   the hull's bottom within half a pixel of the law's T under the waterline (handling.js WATERLINE)
  freeboard rail over the waterline >= the design wave's need (half its Hs; washstrake included when drawn)
  deck      a decked law (n >= 1): deck levels >= n and the top one covering >= 1 - 1/phi^4 of the waterplane
  gm        model GM (hullOf fed the model's L, B, D) within a step (phi^+-1) of the law's, and > 0 on a monohull
  heel      [law, model] the hull stands (heel <= HEEL_MAX) on a beam reach at her reach's design wind, and for
            sea and ocean boats does not need to reef below it
  cubes, bones, anim, rc, pv
            budgets at sea (chief.md §6): visible cubes near; bone instances a frame (each active render
            controller's geometry pass counts all its bones); animated bone evaluations a frame (each pass's bones
            that an active animation moves); active render controllers (4, plus one per fitted module family that
            shows); part_visibility entries over the active controllers
  zfight, gaps  boatlab.py's overlaps (coplanar faces) and planking holes, over every geometry
  bounds    [geometries] the launched, fittings, rig and outfit geometries' visible_bounds hold their pieces at the
            longest length with the rig at its longest-length scale
  ram       D-005: a ram drawn by default on a tradition other than the League's and the Therans'
"""
import json
import math
import re
import statistics
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

SHIP = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SHIP / "tools"))
sys.path.insert(0, str(SHIP / "tools" / "lab"))
import boatexport as E  # noqa: E402
import boatlab  # noqa: E402
import gen_boats as G  # noqa: E402

PHI = (1 + 5 ** 0.5) / 2   # derived: the golden ratio
PX = 1 / 16                # given: a world pixel, 16 to a block
EPS = PX / 2               # vision: half a world pixel, the lens's tolerance for touching and stepping
HALF_STEP = PHI ** 0.5     # derived: a half-step on the golden ladder, the band depth and L:B may stray
BUDGET = {                 # vision: chief.md §6's targets, on Fibonacci rungs, by class (twins count in their class)
    "small": dict(cubes=144, bones=34, anim=21),
    "ship": dict(cubes=233, bones=55, anim=34),
    "great": dict(cubes=377, bones=55, anim=34),
}
RC_BASE, PV_MAX = 4, 34    # vision: chief.md §6: four controllers at sea (one per fitted module family more); 34 entries
UNDERWAY = {"sail_fill": 1, "rowing": 1, "wind_str": 1}   # vision: judged under way, sail drawing and oars pulling (the dearer state)
CHECKS = ["conn", "step", "thick", "depth", "lb", "draught", "freeboard", "deck", "gm", "heel",
          "cubes", "bones", "anim", "rc", "pv", "zfight", "gaps", "bounds", "ram"]


def waterline():
    """The water's surface over a floating boat's origin, as the game holds it (grid.js WATERLINE, which handling.js and
    the model share since D-004), in blocks. The launched keel sits the law's draught under it."""
    for f in ("BP/scripts/grid.js", "BP/scripts/handling.js"):
        m = re.search(r"(?:export )?const WATERLINE = ([\d.]+)", (SHIP / f).read_text())
        if m:
            return float(m.group(1))
    return None


# ---------------------------------------------------------------- the law (lawdump.mjs, one node run)
def law_of(models=None):
    cmd = ["node", "--import", "./tests/mocks/register.mjs", "tools/lab/lawdump.mjs"]
    if models is not None:
        cmd += ["--model", "-"]
    out = subprocess.run(cmd, cwd=SHIP, input=json.dumps(models) if models is not None else None,
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


# ---------------------------------------------------------------- Molang, as much as the RP uses
TOK = re.compile(r"\s*(?:(\d+\.?\d*)|('[^']*')|([A-Za-z_][\w.]*)|(&&|\|\||==|!=|>=|<=|[-+*/!<>?:(),\[\]]))")


class Molang:
    """A small Pratt evaluator for the render controllers' and entity's expressions: numbers, q.property, v.*,
    math.*, logic, comparison, arithmetic, the ternary, and Array.x[i] / Geometry.x for geometry choice."""

    FN = {"math.mod": lambda a, b: math.fmod(a, b), "math.floor": math.floor, "math.abs": abs, "math.max": max,
          "math.min": min, "math.clamp": lambda x, a, b: max(a, min(b, x)), "math.sqrt": math.sqrt,
          "math.lerp": lambda a, b, t: a + (b - a) * t, "math.sin": lambda d: math.sin(math.radians(d))}

    def __init__(self, props, arrays=None):
        self.props, self.arrays = props, arrays or {}

    def __call__(self, src):
        if isinstance(src, bool):
            return src
        self.t = [next(g for g in m.groups() if g is not None) for m in TOK.finditer(str(src))]
        self.i = 0
        v = self.expr(0)
        return v

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else None

    def take(self, want=None):
        tok = self.t[self.i]
        self.i += 1
        if want and tok != want:
            raise ValueError(f"molang: wanted {want}, got {tok}")
        return tok

    BIN = {"||": 1, "&&": 2, "==": 3, "!=": 3, "<": 4, ">": 4, "<=": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "/": 6}

    def expr(self, lo):
        left = self.unary()
        while True:
            op = self.peek()
            if op == "?" and lo == 0:
                self.take()
                a = self.expr(0)
                self.take(":")
                b = self.expr(0)
                left = a if self.truth(left) else b
                continue
            p = self.BIN.get(op)
            if not p or p <= lo:
                return left
            self.take()
            right = self.expr(p)
            left = self.apply(op, left, right)

    @staticmethod
    def truth(v):
        return bool(v) if not isinstance(v, str) else True

    def apply(self, op, a, b):
        if op == "||":
            return float(self.truth(a) or self.truth(b))
        if op == "&&":
            return float(self.truth(a) and self.truth(b))
        a, b = float(a), float(b)
        return {"==": lambda: float(a == b), "!=": lambda: float(a != b), "<": lambda: float(a < b), ">": lambda: float(a > b),
                "<=": lambda: float(a <= b), ">=": lambda: float(a >= b), "+": lambda: a + b, "-": lambda: a - b,
                "*": lambda: a * b, "/": lambda: a / b if b else 0.0}[op]()

    def unary(self):
        tok = self.peek()
        if tok == "!":
            self.take()
            return float(not self.truth(self.unary()))
        if tok == "-":
            self.take()
            return -float(self.unary())
        return self.postfix(self.primary())

    def primary(self):
        tok = self.take()
        if tok == "(":
            v = self.expr(0)
            self.take(")")
            return v
        if tok[0].isdigit():
            return float(tok)
        if tok[0] == "'":
            return tok[1:-1]
        if tok in ("true", "false"):
            return float(tok == "true")
        if self.peek() == "(":                       # a call
            self.take()
            args = []
            while self.peek() != ")":
                args.append(self.expr(0))
                if self.peek() == ",":
                    self.take()
            self.take(")")
            if tok in ("q.property", "query.property"):
                return float(self.props.get(args[0].split(":")[-1], 0))
            return float(self.FN[tok](*[float(a) for a in args]))
        if tok.startswith(("Geometry.", "Texture.", "Material.")):
            return tok
        if tok.startswith("Array."):
            return self.arrays.get(tok, [])
        if tok.startswith(("v.", "variable.", "q.", "query.")):
            return 0.0                               # per-frame variables: their resting value
        raise ValueError(f"molang: unknown {tok}")

    def postfix(self, v):
        while self.peek() == "[":
            self.take()
            k = self.expr(0)
            self.take("]")
            v = v[int(float(k))] if isinstance(v, list) and v else v
        return v


# ---------------------------------------------------------------- the RP at sea: passes, visibility, budgets
def rp_of(pid):
    geo = {g["description"]["identifier"].replace(f"geometry.shipwright.{pid}", "").lstrip(".") or "default": g
           for g in json.loads((SHIP / f"RP/models/entity/{pid}.geo.json").read_text())["minecraft:geometry"]}
    ent = json.loads((SHIP / f"RP/entity/{pid}.entity.json").read_text())["minecraft:client_entity"]["description"]
    rcs = json.loads((SHIP / f"RP/render_controllers/{pid}.render_controllers.json").read_text())["render_controllers"]
    an = SHIP / f"RP/animations/{pid}.animation.json"
    anims = json.loads(an.read_text())["animations"] if an.exists() else {}
    return geo, ent, rcs, anims


def visible_bones(geometry, vis, ev):
    """Bones a pass shows: the last part_visibility entry naming each (or '*') decides, and a hidden parent hides its
    children (Bedrock's bone visibility is inherited)."""
    own = {}
    names = [b["name"] for b in geometry["bones"]]
    for entry in vis:
        for k, cond in entry.items():
            on = Molang.truth(ev(cond))
            if k == "*":
                for n in names:
                    own[n] = on
            elif k in own or k in names:
                own[k] = on
    parent = {b["name"]: b.get("parent") for b in geometry["bones"]}
    out = set()
    for n in names:
        p, ok = n, True
        while p and ok:
            ok = own.get(p, True)
            p = parent.get(p)
        if ok:
            out.add(n)
    return out


def budgets(pid, props):
    """What she costs at sea: visible cubes, bone instances, animated evaluations, controllers, visibility entries;
    and whether a ram shows unbought."""
    geo, ent, rcs, anims = rp_of(pid)
    ev = Molang(props)
    mids = int(props.get("mids", 1))
    hidden_mid = lambda n: bool(re.match(r"mid_(\d+)", n)) and int(re.match(r"mid_(\d+)", n).group(1)) >= mids   # scaled to nothing by the hull animation
    active = []
    for r in ent.get("render_controllers", []):
        if isinstance(r, str):
            active.append(r)
        else:
            active += [k for k, c in r.items() if Molang.truth(ev(c))]
    cubes = bones = pv = 0
    shown = {}
    module_passes = 0
    passes = []
    for name in active:
        rc = rcs[name]
        arrays = {k: v for kind in rc.get("arrays", {}).values() for k, v in kind.items()}
        g = Molang(props, arrays)(rc["geometry"])
        gname = g.split(".", 1)[1] if isinstance(g, str) else "default"
        gd = geo.get(gname) or geo["default"]
        vis = visible_bones(gd, rc.get("part_visibility", []), ev)
        byparent = {b["name"]: b.get("parent") for b in gd["bones"]}

        def under_hidden_mid(n):
            while n:
                if hidden_mid(n):
                    return True
                n = byparent.get(n)
            return False
        n_cubes = sum(len(b.get("cubes", [])) for b in gd["bones"] if b["name"] in vis and not under_hidden_mid(b["name"]))
        cubes += n_cubes
        bones += len(gd["bones"])
        pv += len(rc.get("part_visibility", []))
        passes.append(gd)
        for b in gd["bones"]:
            if b["name"] in vis and b.get("cubes") and not under_hidden_mid(b["name"]):
                shown[b["name"]] = shown.get(b["name"], 0) + len(b["cubes"])
        if not re.search(r"\.(bow|mid|stern|fittings|sail)$", name) and n_cubes:
            module_passes += 1                       # a module family that shows earns its own controller
    animate = ent.get("scripts", {}).get("animate", [])
    on = []
    for a in animate:
        if isinstance(a, str):
            on.append(a)
        else:
            on += [k for k, c in a.items() if Molang.truth(ev(c))]
    moved = set()
    for short in on:
        full = ent.get("animations", {}).get(short)
        moved |= set(anims.get(full, {}).get("bones", {}).keys())
    anim = sum(sum(1 for b in gd["bones"] if b["name"] in moved) for gd in passes)
    ram = shown.get("ram", 0) > 0
    return dict(cubes=cubes, bones=bones, anim=anim, animBones=len(moved), rc=len(active), rcAllowed=RC_BASE + module_passes,
                pv=pv, ram=ram)


# ---------------------------------------------------------------- the model's pieces as boxes
def pieces(pid, mids, rig_scale=1.0):
    """Every piece of the launched hull, fittings, rig and outfit: its corner points (blocks), its edge axes, its
    kind, bone and geometry. A cloth quad is a flat piece (its normal stands for the third axis)."""
    ex = E.export(pid, mids=mids, names=True)
    # boatexport lays every piece at y * ys + root_lift and z * hs: the game's root bone (gen_boats animation) moves by
    # [0, root_lift, -8 hs] px (launched: the keel the law's draught under the water, D-004) and scales by [hs, ys, hs]
    # about its pivot at the origin, and Bedrock does not scale a bone's own position by its own scale, so the export's
    # heights are already the entity's frame. Only the root's -8 hs px along her is left: every piece sits that much
    # further aft than the viewer's export draws it.
    hs = G.BOATS[pid].get("scale", 1)
    shift = np.array([0.0, 0.0, -8 * hs * PX])   # given: the root's position channel
    out = []
    for item, (bone, group) in zip(ex["boxes"], ex["bones"]):
        if item[0] == "cloth":
            P = np.array(item[4:16], float).reshape(4, 3)
            a, b = P[1] - P[0], P[3] - P[0]
            axes = [a, b, np.cross(a, b)]
            kind = "cloth"
        else:
            P = np.array(item[:24], float).reshape(8, 3)
            axes = [P[4] - P[0], P[2] - P[0], P[1] - P[0]]   # corners run i (x), j (y), l (z): i*4 + j*2 + l
            kind = item[24]
        out.append(dict(P=P + shift, axes=axes, kind=kind, bone=bone, group=group))
    if rig_scale != 1.0:                              # the rig grows from the mast foot with the hull (gen_boats animation)
        masts = [p for p in out if p["bone"].startswith("mast")]
        if masts:
            foot = min(p["P"][:, 1].min() for p in masts)
            for p in out:
                if p["group"] == "rig" or p["bone"].startswith("mast"):
                    p["P"] = p["P"].copy()
                    p["P"][:, 1] = foot + (p["P"][:, 1] - foot) * rig_scale
    return out


def _unit(axes):
    out = []
    for a in axes:
        n = np.linalg.norm(a)
        if n > 1e-9:   # given: under a double's noise at block scale, a degenerate edge
            out.append(a / n)
    return out


def touch(A, B):
    """Two pieces touch (or overlap) within EPS: no separating axis among their faces' normals and edge crosses."""
    ua, ub = A["u"], B["u"]
    axes = ua + ub + [np.cross(x, y) for x in ua for y in ub]
    for ax in axes:
        n = np.linalg.norm(ax)
        if n < 1e-6:   # given: parallel edges cross to nothing; not an axis
            continue
        a, b = A["P"] @ (ax / n), B["P"] @ (ax / n)
        if a.max() + EPS < b.min() or b.max() + EPS < a.min():
            return False
    return True


def connect(ps):
    """Pieces not joined to the hull's graph: the largest-hull component is the boat; every other is detached."""
    n = len(ps)
    for p in ps:
        p["u"] = _unit(p["axes"])
    lo = np.array([p["P"].min(0) for p in ps])
    hi = np.array([p["P"].max(0) for p in ps])
    par = list(range(n))

    def f(i):
        while par[i] != i:
            par[i] = par[par[i]]
            i = par[i]
        return i
    near = np.all((lo[:, None, :] <= hi[None, :, :] + EPS) & (lo[None, :, :] <= hi[:, None, :] + EPS), axis=2)
    for i, j in zip(*np.nonzero(np.triu(near, 1))):
        if f(i) != f(j) and touch(ps[i], ps[j]):
            par[f(i)] = f(j)
    comp = defaultdict(list)
    for i in range(n):
        comp[f(i)].append(i)
    main = max(comp.values(), key=lambda c: (sum(ps[i]["group"] == "launched" for i in c), len(c)))
    rest = [c for c in comp.values() if c is not main]
    return len(rest), sorted({ps[i]["bone"] for c in rest for i in c})


TAG = re.compile(r"(^|_)(shell|keel|wale|deck)(_|$)")   # the kind tags chief.md §5 asks the generator to name bones by


def least_px(p):
    return min(np.linalg.norm(a) for a in p["axes"][:3] if p["kind"] != "cloth") / PX


def raster(ps, x0, z0, nx, nz):
    """The pieces' footprints on the water (x, z), a pixel a cell (each piece by its plan-view box)."""
    g = np.zeros((nx, nz), bool)
    for p in ps:
        a, b = p["P"][:, 0].min(), p["P"][:, 0].max()
        c, d = p["P"][:, 2].min(), p["P"][:, 2].max()
        g[int((a - x0) / PX):max(int((a - x0) / PX) + 1, int(math.ceil((b - x0) / PX))),
          int((c - z0) / PX):max(int((c - z0) / PX) + 1, int(math.ceil((d - z0) / PX)))] = True
    return g


def measure(pid, law, mids, wl):
    """The model's own figures at the game's mid count for her typical length."""
    ps = pieces(pid, mids)
    hull = [p for p in ps if p["group"] == "launched"]
    mid = [p for p in hull if p["bone"].startswith("mid_")] or hull
    ys = np.concatenate([p["P"][:, 1] for p in mid])
    L = max(p["P"][:, 2].max() for p in hull) - min(p["P"][:, 2].min() for p in hull)
    if law["twin"]:                                   # a twin's beam is one hull's: the pieces wholly to one side, run in from the
        side = sorted((p for p in mid if p["P"][:, 0].min() > 0), key=lambda p: -p["P"][:, 0].max())   # outer face while
        hull1, reach = [], None                       # they touch (a bridge-deck pod between the hulls is not her beam)
        for p in side:
            if reach is None or p["P"][:, 0].max() >= reach - EPS:
                hull1.append(p)
                reach = min(reach if reach is not None else math.inf, p["P"][:, 0].min())
        xs = np.concatenate([p["P"][:, 0] for p in hull1]) if hull1 else np.array([0.0])
        if hull1:                                     # and her depth one hull's too: the iako and platform over the sheers
            ys = np.concatenate([p["P"][:, 1] for p in hull1])   # are her joining, not her hull
    else:
        xs = np.concatenate([p["P"][:, 0] for p in mid])
    B = float(xs.max() - xs.min())
    bottom, rail = float(ys.min()), float(ys.max())
    # the hull's depth runs to her sheer: a washstrake over it (where her freeboard falls short of her reach's need)
    # counts for freeboard, not for depth, draught or GM (gen_boats draws it wash px over the sheer)
    wash = G.BOATS[pid].get("wash", 0) * G.y_scale(G.BOATS[pid].get("scale", 1)) * PX
    m = dict(L=float(L), B=B, D=rail - wash - bottom, bottom=bottom, rail=rail, wash=wash)
    m["T"] = wl - bottom if wl is not None else None
    m["fb"] = rail - wl if wl is not None else None
    # walls: each slab's least side by its tag (a bone named for its kind: shell, keel, wale, deck; untagged hull
    # pieces read as shell, as today's models have no tags but boatexport's keel): the median for slabs that should
    # all be one thickness, the stoutest for the keel (a keel is one timber, its trim pieces are not)
    tagged = defaultdict(list)
    for p in ps:
        t = TAG.search(p["bone"])
        kind = t.group(2) if t else ("keel" if p["kind"] == "keel" else "shell" if p["group"] == "launched" and p["kind"] == "hull" else None)
        if kind:
            tagged[kind].append(least_px(p))
    m["wall"] = statistics.median(tagged["shell"]) if tagged["shell"] else 0.0
    m["keel"] = max(tagged["keel"]) if tagged["keel"] else None
    m["wale"] = statistics.median(tagged["wale"]) if tagged["wale"] else None
    m["deckslab"] = statistics.median(tagged["deck"]) if tagged["deck"] else None
    # masts: each one's foot over the floor or keel under it
    steps = {}
    for name in sorted({p["bone"] for p in ps if p["bone"].startswith("mast")}):
        mp = [p for p in ps if p["bone"] == name]
        pts = np.concatenate([p["P"] for p in mp])
        foot = pts[:, 1].min()
        low = pts[pts[:, 1] <= foot + PX]
        xc, zc = low[:, 0].mean(), low[:, 2].mean()
        under = [p for p in hull if p["P"][:, 0].min() - EPS <= xc <= p["P"][:, 0].max() + EPS
                 and p["P"][:, 2].min() - EPS <= zc <= p["P"][:, 2].max() + EPS]
        if any(p["P"][:, 1].min() <= foot + EPS and p["P"][:, 1].max() >= foot - EPS for p in under):
            steps[name] = 0.0                         # sunk into the floor or standing on it
        else:
            tops = [p["P"][:, 1].max() for p in under if p["P"][:, 1].max() < foot]
            steps[name] = float(foot - (max(tops) if tops else bottom))
    m["steps"] = steps
    # decks: horizontal slabs above the bilge, by level, and how much of the waterplane each covers
    x0, z0 = min(p["P"][:, 0].min() for p in hull) - PX, min(p["P"][:, 2].min() for p in hull) - PX
    nx = int((max(p["P"][:, 0].max() for p in hull) - x0) / PX) + 3   # vision: a margin of cells round the footprint
    nz = int((max(p["P"][:, 2].max() for p in hull) - z0) / PX) + 3   # vision: the same margin
    plane = raster(hull, x0, z0, nx, nz)

    def flat(p):
        u = _unit(p["axes"])
        k = int(np.argmin([np.linalg.norm(a) for a in p["axes"]]))
        return len(u) == 3 and abs(u[k][1]) > math.cos(math.radians(20))   # vision: a deck lies within 20° of level
    decks = [p for p in hull if p["kind"] == "hull" and flat(p) and p["P"][:, 1].min() >= bottom + m["D"] / PHI ** 2
             and (law["twin"] or p["P"][:, 0].min() < 0 < p["P"][:, 0].max())]   # across the centreline (a twin's platform spans the gap)
    levels = defaultdict(list)
    for p in decks:
        levels[round(p["P"][:, 1].max() * 4) / 4].append(p)   # vision: deck levels told apart a quarter block
    cover = {y: float((raster(v, x0, z0, nx, nz) & plane).sum() / max(1, plane.sum())) for y, v in levels.items()}
    half = 2 / PHI ** 3                                       # derived: a half deck, the rowing ends each L/phi^3
    m["decks"] = sum(1 for c in cover.values() if c >= half)
    m["cover"] = max(cover.values()) if cover else 0.0
    m["conn"], m["detached"] = connect(ps)
    return m


def bounds(pid, law, props_max):
    """Geometries whose visible_bounds do not hold their pieces at the longest length, rig grown to suit."""
    geo = rp_of(pid)[0]
    mids = int((props_max or {}).get("mids", G.MAX_MIDS))
    ps = pieces(pid, mids, float((props_max or {}).get("rig_scale", 1.0)))
    bad = []
    for gname in ("launched", "fittings", "rig", "outfit"):
        d = geo[gname]["description"]
        w, h = d.get("visible_bounds_width", 1), d.get("visible_bounds_height", 1)
        ox, oy, oz = d.get("visible_bounds_offset", [0, 0, 0])
        mine = [p for p in ps if p["group"] == gname]
        if not mine:
            continue
        P = np.concatenate([p["P"] for p in mine])
        if (np.abs(P[:, 0] - ox).max() > w / 2 or np.abs(P[:, 2] - oz).max() > w / 2
                or P[:, 1].min() < oy - h / 2 or P[:, 1].max() > oy + h / 2):
            bad.append(gname)
    top = max(p["P"][:, 1].max() for p in ps)
    return bad, float(top)


def judge(pid, law, m, cost, bnd):
    """Each check's fail count, and the line's cells (model / law)."""
    k = {c: 0 for c in CHECKS}
    cell = []
    fmt = lambda v, d=2: "-" if v is None else f"{v:.{d}f}"
    k["conn"] = m["conn"]
    cell.append(f"conn {m['conn']}" + (" !" if k["conn"] else ""))
    unstepped = {n: g for n, g in m["steps"].items() if g > EPS}
    k["step"] = len(unstepped)
    cell.append(f"step {max(m['steps'].values()) if m['steps'] else 0:.2f}" + (" !" if k["step"] else ""))
    w = law["wall"]
    TOL = 0.05                                                      # vision: a twentieth of a pixel, the export's rounding (a thousandth of a block)
    k["thick"] = int(m["wall"] + TOL < w["w"])
    needs_keel = not law["flat"] and law["wall"]["built"] != "carved" and law["id"] not in KEELLESS
    keel_bad = needs_keel and (m["keel"] is None or m["keel"] + TOL < w["keel"])
    k["thick"] += int(keel_bad)
    cell.append(f"wall {m['wall']:.1f}/{w['w']:.1f}" + (" !" if m["wall"] + TOL < w["w"] else ""))
    cell.append(f"keel {fmt(m['keel'], 1)}/{w['keel']:.1f}" + (" !" if keel_bad else "") if needs_keel else "keel -")
    for key, lawkey in (("wale", "wale"), ("deckslab", "deck")):   # only once the generator tags them
        if m[key] is not None:
            bad = m[key] + TOL < w[lawkey]
            k["thick"] += int(bad)
            cell.append(f"{lawkey} {m[key]:.1f}/{w[lawkey]:.1f}" + (" !" if bad else ""))
    r = m["D"] / law["D"]
    k["depth"] = int(not (1 / HALF_STEP <= r <= HALF_STEP))
    cell.append(f"D {m['D']:.2f}/{law['D']:.2f}" + (" !" if k["depth"] else ""))
    lb = m["L"] / m["B"] if m["B"] else float("inf")
    k["lb"] = int(not (1 / HALF_STEP <= lb / law["lb"] <= HALF_STEP))
    cell.append(f"L:B {lb:.1f}/{law['lb']:.1f}" + (" !" if k["lb"] else ""))
    k["draught"] = int(m["T"] is None or abs(m["T"] - law["T"]) > EPS)
    cell.append(f"T {fmt(m['T'])}/{law['T']:.2f}" + (" !" if k["draught"] else ""))
    k["freeboard"] = int(m["fb"] is None or m["fb"] + EPS < law["need"])
    cell.append(f"fb {fmt(m['fb'])}/{law['need']:.2f}" + (" !" if k["freeboard"] else ""))
    n = law["decks"]["n"]
    k["deck"] = int(n >= 1 and (m["decks"] < n or m["cover"] < law["decks"]["cover"]))
    cell.append(f"deck {m['cover']:.2f}/{law['decks']['cover']:.2f} {m['decks']}/{n}" + (" !" if k["deck"] else ""))
    gl, gm = law["hull"]["gm"], law["model"]["gm"]
    mono = not law["hull"]["twin"]
    k["gm"] = int((mono and gm <= 0) or not (gl > 0 and 1 / PHI <= gm / gl <= PHI))   # vision: a whole golden step either way (GM goes as B^2/T, so it swings wider than depth)
    cell.append(f"GM {gm:.2f}/{gl:.2f}" + (" !" if k["gm"] else ""))
    reef_need = law["designWind"] if law["reach"] in ("sea", "ocean") else 0
    heel_bad = lambda h: (not h["stands"]) or (h["reef"] is not None and h["reef"] < reef_need)
    k["heel"] = int(heel_bad(law["hull"])) + int(heel_bad(law["model"]))
    cell.append(f"heel {law['model']['heel']:.0f}/{law['hull']['heel']:.0f}" + (" !" if k["heel"] else ""))
    tgt = BUDGET[law["cls"]]
    for key in ("cubes", "bones", "anim"):
        k[key] = int(cost[key] > tgt[key])
        cell.append(f"{key} {cost[key]}/{tgt[key]}" + (" !" if k[key] else ""))
    k["rc"] = int(cost["rc"] > cost["rcAllowed"])
    cell.append(f"rc {cost['rc']}/{cost['rcAllowed']}" + (" !" if k["rc"] else ""))
    k["pv"] = int(cost["pv"] > PV_MAX)
    cell.append(f"pv {cost['pv']}/{PV_MAX}" + (" !" if k["pv"] else ""))
    k["zfight"], k["gaps"] = m["zfight"], m["gaps"]
    cell.append(f"zf {m['zfight']}" + (" !" if m["zfight"] else ""))
    cell.append(f"gaps {m['gaps']}" + (" !" if m["gaps"] else ""))
    k["bounds"] = len(bnd)
    cell.append(f"bounds {','.join(bnd) or 'ok'}" + (" !" if bnd else ""))
    k["ram"] = int(cost["ram"] and not law["ram"]["unbought"])
    cell.append(f"ram {'drawn' if cost['ram'] else '-'}" + (" !" if k["ram"] else ""))
    return k, cell


# given: hulls with no keel to measure (a bark or skin canoe's keel is a strip inside the shell; the kayak's chine)
KEELLESS = {"bark_canoe", "freight_canoe", "umiak", "kayak"}


RATCHET = SHIP / "tests/engineering.json"


def write_ratchet(counts):
    """The ratchet: each boat's fail count per check. ship:test lets them fall, never rise; a check in "hard" must be
    zero on every boat (chief.md §5: a check turns hard once the fleet passes it)."""
    old = json.loads(RATCHET.read_text()) if RATCHET.exists() else {}
    hard = old.get("hard") or [c for c in CHECKS if all(k[c] == 0 for k in counts.values())]
    row = lambda v: json.dumps(v, separators=(", ", ": "))   # a boat a line, so a diff shows which boat moved
    boats = ",\n".join(f'  "{pid}": {row({c: k[c] for c in CHECKS})}' for pid, k in counts.items())
    RATCHET.write_text("{\n" + f' "about": {json.dumps(ABOUT)},\n "checks": {row(CHECKS)},\n "hard": {row(hard)},\n'
                       + f' "boats": {{\n{boats}\n }}\n}}\n')


ABOUT = ("englab.py's fail counts per boat per check, written by `python3 tools/lab/englab.py --ratchet`. ship:test "
         "lets each count fall, never rise; a check listed in hard must be 0 on every boat.")


def main(argv):
    as_json = "--json" in argv
    want = [argv[i + 1] for i, a in enumerate(argv) if a == "--boat"]
    wl = waterline()
    law = law_of()
    ids = [k for k in G.BOATS if k in law and "error" not in law[k] and (not want or k in want)]
    measured, costs, bnds = {}, {}, {}
    for pid in ids:
        props = dict(law[pid]["props"] or {"stage": 5, "flags": 3, "kinds": 4, "mods": 0, "deck": 0,   # vision: the game's defaults when the mocks are missing
                                           "mids": max(1, round(law[pid]["L"] / law[pid]["scale"] - 3))})
        props.update(UNDERWAY)
        m = measure(pid, law[pid], int(props["mids"]), wl)
        bones = boatlab.bones_of(pid)
        m["zfight"], m["gaps"] = len(boatlab.overlaps(pid, bones)), len(boatlab.gaps(pid, bones))
        measured[pid] = m
        costs[pid] = budgets(pid, props)
        pm = dict(law[pid]["propsMax"] or {})
        bnds[pid], m["top"] = bounds(pid, law[pid], pm)
    both = law_of({pid: {"L": m["L"], "B": m["B"], "D": m["D"]} for pid, m in measured.items()})
    failing = {c: 0 for c in CHECKS}
    counts = {}
    for pid in ids:
        lw, m = both[pid], measured[pid]
        k, cell = judge(pid, lw, m, costs[pid], bnds[pid])
        counts[pid] = k
        for c, v in k.items():
            failing[c] += int(v > 0)
        if as_json:
            print("[ENG] " + json.dumps({
                "k": pid,
                "law": {x: lw[x] for x in ("cls", "reach", "L", "B", "D", "T", "fb", "need", "washstrake", "wall", "decks", "hull")},
                "model": {**{x: m[x] for x in ("L", "B", "D", "T", "fb", "wall", "keel", "wale", "deckslab", "steps", "decks", "cover", "conn", "detached", "top")},
                          "hull": lw["model"], "cost": costs[pid]},
                "checks": k, "fails": {c: v for c, v in k.items() if v}}, separators=(",", ":")))
        else:
            print(f"{pid} L{lw['L']} s{lw['scale']} | " + " | ".join(cell))
    if "--ratchet" in argv:
        if want:
            raise SystemExit("--ratchet measures the whole fleet: drop --boat")
        write_ratchet(counts)
    if not as_json:
        print(f"boats failing each check, of {len(ids)}: " + "  ".join(f"{c} {n}" for c, n in failing.items()))


if __name__ == "__main__":
    main(sys.argv[1:])
