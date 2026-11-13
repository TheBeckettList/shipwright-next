"""Builds every boat its own way: a hull builder per tradition, a kit of culture-made parts
placed at that hull's sockets, and a separate animation and set of render controllers per boat.

    python3 tools/gen_boats.py      (run by gen_assets.py)

Frame (pixels, 16 per block): the stern spans z 0..24 with its tip at 24, mid-sections run from
z 0 toward -z (16 each, up to 7), and the bow sits beyond them; animation slides the bow to the
last visible mid-section and shifts the whole hull so the helm (z 8) sits over the entity's pivot.
"""
import json
import math
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "RP"
NS = "shipwright"
SEG, END, SLICES, MAX_MIDS, MAX_OARS = 16, 24, 6, 7, 4
HULL_LIFT, HELM_Z, FURNACE_Z = 5, 8, 0      # HULL_LIFT: the building model's keel over the yard floor (world px)
DECK_STATIONS = 7      # given: the deck property holds 4 bits a station and Bedrock's int stops at 2^31: seven stations
# Small values share a property (Bedrock allows 32 per entity). Mirrors BP/scripts/props.js:
# name -> (packed property, place value, range, offset).
PACKED = {
    "wood_bow": ("woods", 1, 12, 0), "wood_mid": ("woods", 12, 12, 0), "wood_stern": ("woods", 144, 12, 0),
    "sail": ("flags", 1, 2, 0), "sail_set": ("flags", 2, 2, 0), "furnace_lit": ("flags", 4, 2, 0), "outrigger": ("flags", 8, 2, 0),
    "moored": ("flags", 16, 2, 0),
    "hull_scale": ("kinds", 1, 2, 1), "rudder_type": ("kinds", 2, 2, 0), "rig_style": ("kinds", 4, 8, 0),
    "prop_style": ("kinds", 32, 8, 0), "power_type": ("kinds", 256, 4, 0), "orient": ("kinds", 1024, 16, 0),
}


def P(n):
    """A property as Molang, decoding packed values."""
    if n == "furnace":
        return f"({P('power_type')} > 0)"
    if n not in PACKED:
        return f"q.property('{NS}:{n}')"
    prop, div, mod, off = PACKED[n]
    expr = f"math.mod(math.floor(q.property('{NS}:{prop}') / {div}), {mod})"
    return f"({expr} + {off})" if off else f"({expr})"

# Texture order shared with BP/scripts/config/materials.js: 9 woods, leather, rabbit hide, birch bark.
MATERIAL_KEYS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "bamboo",
                 "hide", "rabbit", "birch_bark"]
WOOL_KEYS = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
             "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"]

# ---------------------------------------------------------------- boats
# section: how the sides are built.  F: half-width at midship.  side: side height.
# Ends: taper (pointed, fine, blunt, flat), rise (sheer upsweep), floor (how far the bottom lifts), stem (the end's form).
# Design inputs. Each hull has two dimensions, F (half-beam at midship) and side (side height),
# in model pixels (16 per block). Everything else is a proportion of those:
#   rise, floor: how far the ends' sheer and bottom lift, as fractions of the side height
#   oar: oar length as a multiple of the half-beam (long Norse sweeps, short European oars)
#   aspect: the tradition's square sail, height over width
BOATS = {
    "faering":   dict(section="clinker", F=10, side=13, oar=2.0, aspect=0.75,
                      bow=dict(taper="pointed", rise=0.46, floor=0.31, stem="norse"), stern=dict(taper="pointed", rise=0.46, floor=0.31, stem="norse")),
    "longship":  dict(section="clinker", F=10, side=13, oar=2.2, aspect=0.75, ports=True, scale=2,
                      bow=dict(taper="pointed", rise=0.54, floor=0.31, stem="norse_tall"), stern=dict(taper="pointed", rise=0.54, floor=0.31, stem="norse_tall")),
    "rowboat":   dict(section="carvel", F=10.5, side=12, oar=1.55, aspect=0.9, tholes=True,
                      bow=dict(taper="pointed", rise=0.17, floor=0.25, stem="plumb"), stern=dict(taper="flat", rise=0.08, floor=0.125, stem="transom")),
    "bark_canoe": dict(section="bark", F=8.5, side=10, oar=1.8, aspect=0.9, ribs=True, lashings=True,
                      bow=dict(taper="pointed", rise=0.5, floor=0.3, stem="recurve"), stern=dict(taper="pointed", rise=0.5, floor=0.3, stem="recurve")),
    "outrigger": dict(section="v", F=7, side=10, oar=1.8, aspect=0.9,
                      bow=dict(taper="fine", rise=0.3, floor=0.2, stem="end_board"), stern=dict(taper="fine", rise=0.2, floor=0.2, stem="end_board")),
    "sewn_boat": dict(section="carvel", F=10, side=12, oar=1.8, aspect=0.9, stitches=True,
                      bow=dict(taper="pointed", rise=0.33, floor=0.33, stem="raked"), stern=dict(taper="pointed", rise=0.25, floor=0.25, stem="raked_short")),
    "sampan":    dict(section="flat", F=10.5, side=11, oar=1.6, aspect=0.9, keel=False,
                      bow=dict(taper="flat", rise=0.36, floor=0.64, stem="bow_board"), stern=dict(taper="flat", rise=0.18, floor=0.14, stem="transom")),
    "wasen":     dict(section="flat", F=9.5, side=12, oar=1.7, aspect=1.15, keel=False,
                      bow=dict(taper="pointed", rise=0.42, floor=0.25, stem="blade"), stern=dict(taper="flat", rise=0.17, floor=0.125, stem="transom")),
    "dugout":    dict(section="round", F=8.5, side=11, oar=1.8, aspect=0.9,
                      bow=dict(taper="blunt", rise=0.09, floor=0.18, stem="lug"), stern=dict(taper="blunt", rise=0.09, floor=0.18, stem="lug")),
    "punt":      dict(section="flat", F=11, side=8, oar=1.4, aspect=0.9, keel=False,
                      bow=dict(taper="flat", rise=0.0, floor=0.75, stem="swim"), stern=dict(taper="flat", rise=0.0, floor=0.75, stem="swim")),
    "kayak":     dict(section="chine", F=7, side=8, oar=2.0, aspect=0.9, deck=True,
                      bow=dict(taper="fine", rise=0.375, floor=0.25, stem="kayak_bow"), stern=dict(taper="fine", rise=0.125, floor=0.25, stem="kayak_stern")),
}

# The Therans (Waterworld's own people): modern sailing ancientified, white and gold. Wave-piercing bows (a knife entry,
# the deck falling to the stem, so she cuts through a sea instead of climbing it), rigid wings, and each a step up in
# hulls: the skiff a foiling monohull on a T-foil, the ship a catamaran with a canted wing on each hull and a small
# tail wing raked aft on the centre line (a fighter's fin), the flagship a trimaran, its main hull visibly longer
# than its floats, three wings stepped down its middle (short, tallest, middle from bow to stern).
PIERCE = dict(taper="piercer", rise=0, drop=0.32, floor=0.12, stem="piercer")
THERAN_STERN = dict(taper="fine", rise=0.05, floor=0.12, stem="transom")
BOATS["theran_skiff"] = dict(section="v", F=7.5, side=9.5, oar=1.8, aspect=0.9, foils=True, bow=PIERCE, stern=THERAN_STERN)

# Fitted modules drawn on the boat, as bits of the shipwright:mods property (mirrored in ship.js).
MODULE_BITS = {"shield_rail": 0, "ram": 1, "ice_runners": 3, "crossbow": 4, "full_deck": 5, "sewn_hull": 6, "bulkheads": 7, "light_hull": 8,
               "boat_deck": 9, "boat_stern": 10}
# Deck modules drawn at their stations: the shipwright:deck property holds a code per hull section
# (3 bits each, section 0 nearest the helm), mirrored in ship.js.
DECK_CODES = {"hold": 1, "benches": 2, "canopy": 3, "navigation": 4, "bunk": 5, "castle": 6, "deckhouse": 7, "lookout": 8,
              "cannon": 9, "diving_bell": 10}
DECK_BASE = 16           # 4 bits per station
deck_at = lambda i, key: f"math.mod(math.floor({P('deck')} / {DECK_BASE ** i}), {DECK_BASE}) == {DECK_CODES[key]}"
NORSE = {"faering", "longship", "skeid"}
# Each tradition's canopy: shape and material.
CANOPY = {"sampan": ("arch", "hull_bamboo"), "outrigger": ("thatch", "hay"), "wasen": ("arch_low", "hay"),
          "faering": ("tent", "wool"), "longship": ("tent", "wool"), "skeid": ("tent", "wool")}
mod_on = lambda key: f"math.mod(math.floor({P('mods')} / {2 ** MODULE_BITS[key]}), 2) == 1"

# Proportions of each rig type, relative to the hull it stands on (at rig scale 1).
MAST_H = 3.2          # mast height, in side heights
SQUARE_W = 3.0        # square sail width, in half-beams (height = width x the tradition's aspect)
LATEEN = dict(yard=5.4, rake=31, drop=0.68)     # yard length (half-beams), rake (deg), cloth depth (of yard)
CRAB = dict(upper=4.4, lower=4.2, opening=56, tilt=74)   # spar lengths (half-beams), V opening (deg), bisector 16 deg aft of vertical
JUNK = dict(width=1.9, height=0.72, batten=5)
WING = dict(aspect=2.8, taper=0.5, thick=0.13)   # the Theran wing: height (of the rig's mast), root chord (half-beams), taper to the head, thickness (of chord)   # width (half-beams), height (of the mast), batten spacing (px)
CRAB_X = 1.75         # a crab claw hangs beside its mast, to port


def typical_length(b):
    """A typical hull length in model pixels: 7 blocks for small boats, 17 for medium (drawn at half size)."""
    return TYPICAL_BLOCKS[b.get("scale", 1)] / b.get("scale", 1) * 16


def multihull(b):
    """Where a multihull's float or second hull sits, from the main hull's length L and beam B (model px).
    Float: about 0.65 L long and 0.35 B thick, out at the larger of 1.25 B and 0.28 L, on booms 0.4 L apart.
    Twin hulls: about 0.3 L apart, centre to centre, the craft centred between them."""
    use(b)
    L = typical_length(b)
    B = 2 * (b["F"] + outer_of(b["section"], b.get("scale", 1)))
    return dict(float_out=max(1.25 * B, 0.28 * L), float_r=0.175 * B, float_len=0.65 * L, boom=0.2 * L,
                twin_gap=0.3 * L if b.get("twin") else 0, L=L)


# True size. The hull is drawn at its model scale (2 for medium, 4 for large), but things a person
# handles or a vanilla block stands for keep their real size: a furnace is never bigger than a block,
# a chest never bigger than a chest, a paddle is a paddle a person holds, and an oar or rod is as
# thick on a great ship as on a faering (only its length grows). Each part's bone is scaled by the
# inverse of the hull's scale to get there.
BLOCK = 16
THICK = {1: 1.0, 2: 1.25, 4: 1.5}       # world px thickness of an oar, rod or pole, by model scale


def y_scale(hs):
    """The model's height scale: its breadth scale (D-004). The squash this once was (1 + 0.4 (s - 1)) drew the big
    hulls at a quarter to four fifths of their depth; the seat and eye it patched are the decks' work now."""
    return hs


def max_mids(b):
    """Mid sections a hull can show: 7, and 8 at scale 2 so the ship class reaches its plans' 22 blocks (chief.md
    section 2: MAX_MIDS = ceil(L_max / s) - 3)."""
    return 8 if b.get("scale", 1) == 2 else MAX_MIDS


def root_lift(b):
    """Where the launched hull's keel sits, world px over the entity's origin: the law's draught under the water
    (WATERLINE over the origin, handling.js), so she floats as deep as she is built."""
    return round(16 * WATERLINE - b["wl"] * b.get("scale", 1), 3)


# The helm. On a hull deep enough that a seated helmsman would see only planking, the helm stands
# where the tradition put it, up where they could see: the carrack's whipstaff on the quarterdeck,
# a tiller on the high stern of the fuchuan, shuinsen and baghlah, the cog's tiller under her
# aftcastle. Open hulls (skeid, drua) keep the steering oar at the rail. raise: blocks above the rail.
HELM = {"carrack": ("whipstaff", 1.0), "fuchuan": ("tiller", 1.2), "shuinsen": ("tiller", 1.0), "baghlah": ("tiller", 1.0),
        "cog": ("tiller", 0.5)}
SEAT_BASE = 0.35                # the seat height every open boat was calibrated at (blocks above the origin)
EYE = 1.1                       # a seated player's eye above the seat
DEPTH_BANDS = {"lo": 0.8, "": 1.0, "hi": 1.35}   # seat sets for a shallow, typical and deep build


def rail_y(b, depth=1.0):
    """The rail's height above the entity's origin, in blocks, launched: the hull's depth property scales her about
    the waterline (the hull bones' pivot), so draught and freeboard grow together."""
    return WATERLINE + (b["side"] + b["wash"] - b["wl"]) * y_scale(b.get("scale", 1)) * depth / 16


def deck_y(b):
    """The walked surface, model px over the keel's foot: the weather deck where she is decked, else the sole."""
    dk = b["_deck"]
    if dk["kind"] != "open":
        return dk["top"]
    return b["wl"] + 1 / b.get("scale", 1)


def seat_bands(b):
    """Seat heights by depth band; one band when the depth makes no difference (open hulls)."""
    bands = {band: seat_heights(b, dd) for band, dd in DEPTH_BANDS.items()}
    return bands if len({tuple(v) for v in bands.values()}) > 1 else {"": bands[""]}


def seat_heights(b, depth=1.0):
    """(helm, crew) seat heights in blocks: open hulls at the calibrated height; deep hulls high
    enough to see over the rail, the helm on its raised station."""
    r = rail_y(b, depth)
    raise_ = HELM.get(b.get("_pid"), ("", 0))[1]
    # a decked hull's crew sit on her walked deck (grid.js topDeckUp: whole blocks over the water)
    walk = WATERLINE + b["_deck"]["up"] * depth if b["_deck"]["kind"] in ("full", "biti") else 0
    # the helm's eye clears the rail by 0.35 (on its raised station where it has one)
    return round(max(SEAT_BASE, r - (EYE - 0.35), walk) + raise_, 3), round(max(SEAT_BASE, r - 1.0, walk), 3)


def true_size(b):
    """Bone -> [x, y, z] scale that brings it to its true size (world px), given the hull's scale."""
    hs, F, side = b.get("scale", 1), b["F"], b["side"]
    ys = y_scale(hs)
    out = {}
    fs = 0.4 * side * 2                                   # the furnace as authored
    w = min(BLOCK, fs * hs)                               # never bigger than the block it is
    out["furnace"] = [w / (fs * hs), w / (fs * ys), w / (fs * hs)]
    cw, ch, cd = 0.9 * F, 0.45 * side + 0.18 * side, 0.5 * F
    out["sea_chest"] = [min(1, 14 / (cw * hs)), min(1, 14 / (ch * ys)), min(1, 14 / (cd * hs))]
    t = THICK.get(hs, 1.5)
    for i in range(MAX_OARS):
        for s in ("l", "r"):
            out[f"oar_{i}_{s}"] = [1, t / ys, t / hs]     # long as the hull needs, thick as an oar
    for s in ("l", "r"):
        out[f"link_{s}"] = [t / hs, t / ys, 1]
        out[f"linkx_{s}"] = [1, t / ys, t / hs]
    for n in ("scull", "pole"):
        out[n] = [t / hs, 1, t / hs] if n == "pole" else [t / hs, t / ys, 1]
    # Hand paddles: as a person holds them, whatever the hull (about 1.75 blocks for a paddle).
    paddle_len = 2.2 * side + 0.45 * side
    u = min(hs, 28 / paddle_len)
    out["paddle"] = [u / hs, u / ys, u / hs]
    span = 2 * (F + 1.1 * side)
    u = min(hs, 44 / span)
    out["dpaddle"] = [u / hs, u / ys, u / hs]
    return {k: [round(v, 4) for v in xs] for k, xs in out.items()}


def derived(b):
    """Every derived dimension of a boat's parts, from its two inputs and the proportions above."""
    F, side = b["F"], b["side"]
    mast = MAST_H * side
    oar = b["oar"] * F
    d = dict(
        mast=mast,
        oar_len=oar,
        # Sweep so the blade travels about one rowing station; longer oars swing slower, like a pendulum.
        oar_amp=math.degrees(math.atan(SEG * 0.9 / oar)),
        oar_rate=1100 / math.sqrt(oar),
        oar_inboard=min(0.3 * oar, F - 1.5),
        crank_root_x=(0.4 * side + 0.5) * true_size(b)["furnace"][0],     # the crank, where the furnace's true size puts it
        paddle_shaft=2.2 * side, paddle_blade=(0.3 * F, 0.45 * side),
        dpaddle_half=F + 1.1 * side, dpaddle_blade=(0.6 * side, 0.35 * F),
        scull=2.0 * side + F, scull_blade=0.4 * side,
        pole=3.5 * side,
        rudder=1.7 * side, rudder_blade=0.6 * side, tiller=0.55 * side,
        ama_out=multihull(b)["float_out"], ama_r=max(1.5, multihull(b)["float_r"]), ama_len=multihull(b)["float_len"], boom=multihull(b)["boom"],
        square=(SQUARE_W * F, SQUARE_W * F * b["aspect"]),
        junk=(JUNK["width"] * F, JUNK["height"] * mast),
    )
    return d


def cube(o, s, uv=None):
    c = {"origin": [round(v, 3) for v in o], "size": [round(v, 3) for v in s], "uv": uv or [0, 0]}
    return c


# ---------------------------------------------------------------- cross-sections
T = 1.6          # thickness of the twin hulls' platform deck, in model pixels

# ---------------------------------------------------------------- construction standards
# Thicknesses in world pixels (16 to a block), per construction style. A model's own thickness is the
# world thickness divided by its scale, so a longship's planks are as thick in the world as a faering's.
CON = {
    "clinker": dict(shell=1, frame=1, gunwale=2, keel=2, frames=True),        # strakes lap 1 pixel
    "carvel":  dict(shell=2, frame=1.5, gunwale=2, keel=2, frames=True),
    "flat":    dict(shell=2, frame=1, gunwale=2, keel=0, frames=True, chine=1),
    "bark":    dict(shell=1, frame=1, gunwale=1.5, keel=1.5, frames=True, half=True),
    "skin":    dict(shell=0.5, frame=1, gunwale=1, keel=1, frames=True),      # open skin boats (umiak)
    "v":       dict(shell=1.5, frame=1, gunwale=1.5, keel=1.5, frames=True),
    "chine":   dict(shell=0.5, frame=1, gunwale=1, keel=1, frames=True),      # decked skin (kayak)
    "round":   dict(shell=3, frame=0, gunwale=3, keel=0, frames=False),       # carved from one log
}
SCALE = 1          # the model scale of the boat being built (2 for medium ships)
SIMPLE = False     # building the launched (simplified) model
WALL = None        # the wall law's thickness for the boat being built (world px); None: today's CON (the old beams)
PHI = (1 + 5 ** 0.5) / 2                                   # given: the golden ratio
FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]     # given: core/golden.js's rungs


def th(st, key):
    """A construction thickness in this model's pixels. The wall law (D-004, chief.md section 3): the launched shell
    carries the whole wall w (planking, frames and ceiling), w = max(CON, 16 L / K) world px; the building model's
    planks are w / phi^2 with frames w / phi inside them; keel and gunwale phi w, deck w / phi; any edge against the
    sky at least 2 px (given: the vanilla boat's 2 px sides). A carved log keeps its wall (its rim is the wall)."""
    c = CON[st]
    if WALL is None:
        return c.get(key, 0) / SCALE
    w = WALL
    v = {"shell": w if SIMPLE or not c["frames"] else max(c["shell"], w / PHI ** 2),
         "frame": max(1, w / PHI) if c["frames"] else 0,
         "gunwale": w if st == "round" else max(2, PHI * w),
         "keel": max(2, PHI * w) if c["keel"] else 0,
         "chine": max(c.get("chine", 0), w / PHI ** 2) if "chine" in c else 0,
         "deck": max(2, w / PHI),
         "wash": max(2, w / PHI ** 2)}[key]
    return v / SCALE


def panels(st, hw):
    """A section's side panels: (bottom, top) as shares of the side height, and the panel's inner face
    offset from the half-width hw. Planking sits outside the inner face; frames sit inside it."""
    sh = th(st, "shell")
    if st == "clinker":
        if SIMPLE:
            return [(0, 1, sh)]
        return [(0, 1 / 3, 0), (1 / 3, 2 / 3, sh), (2 / 3, 1, 2 * sh)]   # each strake laps outside the one below
    if st in ("carvel", "flat"):
        return [(0, 1, 0)]
    if st == "bark":
        return [(0, 0.5, 0), (0.5, 1, 0.5 * sh)]      # bark swells out above the turn of the bilge
    if st == "skin":
        return [(0, 0.5, 0), (0.5, 1, sh)]            # flared sides
    if st == "v":
        return [(0, 0.45, -0.35 * hw), (0.45, 1, 0)]  # a narrow V below, stepping out at a ledge
    if st == "chine":
        return [(0, 0.5, -0.15 * hw), (0.5, 1, 0)]    # hard chine: the lower panel tucked in
    if st == "round":
        return [(0, 0.6, 0), (0.6, 1, -sh / 3)]       # carved walls curving in toward the rim
    raise ValueError(st)


def outer_of(st, scale=1, legacy=False):
    """How far a section's planking reaches outside its half-width, in model pixels at a scale: the launched wall's,
    so the building model's thinner planks lie on the same outer face. legacy: as v0.9.14 measured it (CON, the
    building model's laps), which set every beam the models are drawn to."""
    global SCALE, SIMPLE, WALL
    saved, SCALE, simple, SIMPLE, wall = SCALE, scale, SIMPLE, not legacy, WALL
    if legacy:
        WALL = None
    sh, gun = th(st, "shell"), th(st, "gunwale")
    ps = panels(st, 0)
    r = max(max(p[2] for p in ps) + sh, ps[-1][2] + gun)
    if st == "flat":
        r = max(r, sh + th(st, "chine"))
    SCALE, SIMPLE, WALL = saved, simple, wall
    return r


# ---------------------------------------------------------------- the rounded shell
# Each section is a curve from the keel to the sheer (a quarter superellipse: n 2 a true round, under 2 a V with
# its turn rounded off, over 2 a flat floor with a rounded chine), and the shell is planked along it in strakes,
# each one a slab turned to lie on the curve. Along the ends the curve is taken at both edges of each slice and
# each slab fitted to the four corners, so the hull runs smooth from the middle to the stem.
ROUND = {"clinker": 2.3, "carvel": 2.5, "bark": 2.1, "skin": 2.2, "v": 1.55, "chine": 1.7, "round": 2.0, "flat": 4.5}
STRAKES, STRAKES_LAUNCHED = 6, 4          # strakes a side: the building model, and the lighter launched one
END_SLICES, END_SLICES_LAUNCHED = 12, {1: 4, 2: 5, 4: 6}   # launched: the near model's end slices by class (chief.md section 6)


def profile(b, hw, fy, sy):
    """Points from the keel (x 0) up to the sheer, on this tradition's curve, out to the planking's outer face."""
    n, X = ROUND[b["section"]], hw + outer_of(b["section"], SCALE)
    N = (STRAKES_LAUNCHED - (1 if b.get("twin") else 0)) if SIMPLE else STRAKES   # a twin draws two hulls: each a strake lighter
    pts = []
    for k in range(N + 1):
        th_ = (k / N) * math.pi / 2
        pts.append((X * math.sin(th_) ** (2 / n), fy + (sy - fy) * (1 - math.cos(th_) ** (2 / n))))
    return pts


def euler_file(R):
    """The stored file rotation that turns a cube by R (columns: where x, y and z go, in file coordinates). The game
    shows file x mirrored and turns by Rz(rz) . Ry(-ry) . Rx(-rx); so take R into shown coordinates and split it."""
    M = [[-1, 0, 0], [0, 1, 0], [0, 0, 1]]
    mul = lambda A, B: [[sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    Ri = mul(M, mul(R, M))
    bb = -math.asin(max(-1, min(1, Ri[2][0])))
    aa = math.atan2(Ri[2][1], Ri[2][2])
    cc = math.atan2(Ri[1][0], Ri[0][0])
    return [round(-math.degrees(aa), 3), round(-math.degrees(bb), 3), round(math.degrees(cc), 3)]


def swept_tube(root, tip, chord, depth, arch=0.0, drop=0.0, m=16, ring=12, taper=0.45):
    """A strut built as the hulls are: a white planked shell, round-edged and flattened like a wing in section, from
    root (x, y, z) to tip, its chord and depth fining toward the tip by taper, arched up by arch at its middle and
    dropping by drop over its last sixth (faired down into whatever it meets)."""
    out = []
    def station(u):
        c, h = chord * (1 - taper * u), max(1.2, depth * (1 - 0.9 * taper * u))
        y = root[1] + (tip[1] - root[1]) * u + arch * math.sin(math.pi * u) - (0 if u < 0.84 else (u - 0.84) / 0.16 * drop)
        return (root[0] + (tip[0] - root[0]) * u, y, root[2] + (tip[2] - root[2]) * u, c / 2, h / 2)
    def ell(st, th_):
        cs = math.cos(th_)
        return (st[0], st[1] + st[4] * math.sin(th_), st[2] + st[3] * cs * (abs(cs) ** -0.35 if cs else 0))
    for j in range(m):
        A_, C_ = station(j / m), station((j + 1) / m)
        for r in range(ring):
            t0, t1 = 2 * math.pi * r / ring, 2 * math.pi * (r + 1) / ring
            out += slab(ell(A_, t0), ell(A_, t1), ell(C_, t0), ell(C_, t1), 0.6, A_[:3])
    return out


def hourglass_net(ni, no, fi, ai, fo, ao, y, pinch):
    """A trampoline: an hourglass of diamond mesh from an inner edge (x ni, fore fi to aft ai) out to an outer one
    (x no, fo to ao), its fore and aft edges bowed in by pinch. Returns its edge rope and its cords."""
    outline = [(ni + (no - ni) * k / 8, fi + (fo - fi) * k / 8 + pinch * math.sin(math.pi * k / 8)) for k in range(9)]
    outline += [(no + (ni - no) * k / 8, ao + (ai - ao) * k / 8 - pinch * math.sin(math.pi * k / 8)) for k in range(9)]
    rope, cords = [], []
    for (x1, z1), (x2, z2) in zip(outline, outline[1:] + outline[:1]):
        rope += rod((x1, y, z1), (x2, y, z2), 0.7)
    step = max(2.4, abs(no - ni) / 6)
    span_ = abs(no - ni) + (max(ai, ao) - min(fi, fo))
    for k in range(-int(span_ / step) - 2, int(span_ / step) + 3):
        for dirn in (1, -1):
            for (pa, pb) in clip_poly((min(ni, no), min(fi, fo) + k * step), (1.0, float(dirn)), outline):
                cords += rod((pa[0], y, pa[1]), (pb[0], y, pb[1]), 0.3)
    return rope, cords


def clip_poly(p0, d, poly):
    """The pieces of the line p0 + t d (in the x-z plane) that lie inside the polygon, as pairs of points."""
    ts = []
    for (x1, z1), (x2, z2) in zip(poly, poly[1:] + poly[:1]):
        ex, ez = x2 - x1, z2 - z1
        den = d[0] * ez - d[1] * ex
        if abs(den) < 1e-9:
            continue
        t = ((x1 - p0[0]) * ez - (z1 - p0[1]) * ex) / den
        u = ((x1 - p0[0]) * d[1] - (z1 - p0[1]) * d[0]) / den
        if 0 <= u < 1:
            ts.append(t)
    ts.sort()
    at = lambda t: (p0[0] + d[0] * t, p0[1] + d[1] * t)
    return [(at(ts[i]), at(ts[i + 1])) for i in range(0, len(ts) - 1, 2) if ts[i + 1] - ts[i] > 0.3]


def slab(p0, p1, q0, q1, t, inside):
    """A plank t thick fitted to four corners (p0 p1 at one end, q0 q1 at the other), its outer face on them and
    its thickness toward the inside point."""
    if (q0[2] + q1[2]) < (p0[2] + p1[2]):            # run along +z, so a piece's stored extent is where it lies
        p0, p1, q0, q1 = q0, q1, p0, p1
    sub = lambda a, c: [a[i] - c[i] for i in range(3)]
    dot = lambda a, c: sum(a[i] * c[i] for i in range(3))
    cross = lambda a, c: [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]]
    unit = lambda a: [v / (math.sqrt(dot(a, a)) or 1) for v in a]
    u = [(p1[i] - p0[i] + q1[i] - q0[i]) / 2 for i in range(3)]
    width = math.sqrt(dot(u, u))
    if width < 0.05:
        return []
    uh = unit(u)
    wv = [(q0[i] + q1[i] - p0[i] - p1[i]) / 2 for i in range(3)]
    wv = [wv[i] - dot(wv, uh) * uh[i] for i in range(3)]
    length = math.sqrt(dot(wv, wv))
    if length < 0.05:
        return []
    wh = unit(wv)
    nh = cross(wh, uh)
    # centred on the four corners, so a box fitted to a tapering quad errs evenly round it
    cen = [(p0[i] + p1[i] + q0[i] + q1[i]) / 4 for i in range(3)]
    o = [cen[i] - (width + 0.08) / 2 * uh[i] - length / 2 * wh[i] for i in range(3)]
    if dot(nh, sub(inside, p0)) < 0:
        o = [o[i] - t * nh[i] for i in range(3)]
    R = [[uh[i], nh[i], wh[i]] for i in range(3)]
    rot = euler_file(R)
    if all(abs(v) < 1e-3 for v in rot):                 # not turned at all: a plain cube
        return [{"origin": [round(v, 3) for v in o], "size": [round(width, 3), round(t, 3), round(length, 3)], "uv": [0, 0]}]
    return [{"origin": [round(v, 3) for v in o], "size": [round(width + 0.08, 3), round(t, 3), round(length, 3)],
             "pivot": [round(v, 3) for v in o], "rotation": rot, "uv": [0, 0]}]


def shell(b, a, c, za, zc, t=None, cockpit=False):
    """The planking between two sections a and c (each (hw, fy, sy)) at za and zc: strakes both sides, a lap strip at
    each seam on a clinker hull, the gunwale capping the sheer, a floor across the bilge, and a kayak's deck."""
    st, out = b["section"], []
    sh, gun = max(0.2, th(st, "shell")), max(0.2, th(st, "gunwale"))     # true thickness in the world at any scale
    t = t or sh
    A, C = profile(b, *a), profile(b, *c)
    N = len(A) - 1
    inside_y = max(a[2], c[2]) + 2
    for sx in (-1, 1):
        for k in range(N):
            p0, p1 = (sx * A[k][0], A[k][1], za), (sx * A[k + 1][0], A[k + 1][1], za)
            q0, q1 = (sx * C[k][0], C[k][1], zc), (sx * C[k + 1][0], C[k + 1][1], zc)
            mid = (za + zc) / 2
            out += slab(p0, p1, q0, q1, t, (0, inside_y, mid))
            if st == "clinker" and not SIMPLE and 0 < k < N - 1:   # the lap: the strake above overlaps the one below
                lw = 0.35 * math.dist(A[k], A[k + 1])
                f = lambda P, Q: tuple(P[i] + (Q[i] - P[i]) * lw / max(0.01, math.dist(P, Q)) for i in range(3))
                out += slab(p1, f(p1, p0), q1, f(q1, q0), t, (sx * 9999, A[k + 1][1], mid))   # proud of the shell
        pa, pc = A[-1], C[-1]
        wash = 0 if b.get("deck") else b.get("wash", 0)
        if wash > 0:                      # the washstrake: a strake over the sheer where the freeboard falls short of the reach's need
            out += slab((sx * pa[0], pa[1], za), (sx * pa[0], pa[1] + wash, za), (sx * pc[0], pc[1], zc), (sx * pc[0], pc[1] + wash, zc),
                        gun if SIMPLE else th(st, "wash"), (0, (pa[1] + pc[1]) / 2 + wash / 2, (za + zc) / 2))
            if SIMPLE:                    # launched, one slab: the washstrake as thick as the gunwale that caps it
                continue
        # the gunwale capping the sheer (or the washstrake), on both models: the edge the eye sees against the sky
        out += slab((sx * (pa[0] - gun), pa[1] + wash, za), (sx * pa[0], pa[1] + wash, za), (sx * (pc[0] - gun), pc[1] + wash, zc), (sx * pc[0], pc[1] + wash, zc),
                    gun, (0, -9999, (za + zc) / 2))
    # the floor (sole) across between the strakes, its underside on the water (D-004: under the waterline the game draws
    # the sea inside a hull, so whatever is walked lies on or over it); a hull with no waterline (a float) a quarter of
    # the way up its bilge. A decked hull's deck is her floor.
    if (not b.get("deck") or cockpit) and b.get("_deck", {}).get("kind", "open") == "open":
        fa = fc = b["wl"] + 1 / SCALE if "wl" in b else None       # its top a world pixel over the water: no flicker, feet barely in it
        if fa is None:
            fa, fc = a[1] + 0.22 * (a[2] - a[1]), c[1] + 0.22 * (c[2] - c[1])
        wa = next((x for x, y in A if y >= fa), A[-1][0]) - 0.13
        wc = next((x for x, y in C if y >= fc), C[-1][0]) - 0.13
        if min(wa, wc) > 0.6 and max(fa, fc) < min(a[2], c[2]):
            out += slab((-wa, fa, za), (wa, fa, za), (-wc, fc, zc), (wc, fc, zc), sh, (0, -9999, (za + zc) / 2))
    if b.get("deck") and not cockpit:
        out += slab((-A[-1][0], A[-1][1], za), (A[-1][0], A[-1][1], za), (-C[-1][0], C[-1][1], zc), (C[-1][0], C[-1][1], zc),
                    sh, (0, -9999, (za + zc) / 2))
    return out


def inner_half(pts, y, t):
    """The shell's inner half-width at height y, from a section's profile (its outer face), or None outside it."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if y0 <= y <= y1:
            return x0 + (x1 - x0) * (y - y0) / max(1e-6, y1 - y0) - t
    return None


def deck_slabs(b, a, c, za, zc, ends=False):
    """The decks across a span between sections a and c (each (hw, fy, sy)): the weather deck (and, amidships, the
    decks below it, every DECK_HEIGHT), each a slab w / phi thick lying on the shell's inner face, wherever the hull
    is wide and deep enough to hold it (D-004: decks from depth; chief.md section 3)."""
    dk = b.get("_deck")
    if not dk or dk["kind"] == "open":
        return []
    sh, t = th(b["section"], "shell"), dk["t"]
    A, C = profile(b, *a), profile(b, *c)
    tops = [dk["top"]] + ([] if ends or dk["kind"] != "full" else dk["lower"])
    out = []
    for top in tops:
        if top > min(a[2], c[2]):                       # above the sheer here: the deck stops short of this end
            continue
        wa, wc = inner_half(A, top - t, sh), inner_half(C, top - t, sh)
        if wa is None or wc is None or min(wa, wc) < 1:
            continue
        out += slab((-wa, top, za), (wa, top, za), (-wc, top, zc), (wc, top, zc), t, (0, -9999, (za + zc) / 2))
    return out


def section(b, hw, fy, sy, z0, L, cockpit=False):
    """A span of hull of constant section, length L."""
    return shell(b, (hw, fy, sy), (hw, fy, sy), z0, z0 + L, cockpit=cockpit)


def frames(b, hw, fy, sy, zc):
    """One frame across the hull at zc: a rib following the curve inside the shell. Carved hulls have none."""
    st = b["section"]
    if not CON[st]["frames"]:
        return []
    fr, sh = th(st, "frame"), max(0.2, th(st, "shell"))
    pts, out = profile(b, hw, fy, sy), []
    inset = lambda P, s: (s * max(0, P[0] - sh), P[1] + sh * 0.5)
    for sx in (-1, 1):
        for k in range(len(pts) - 2):
            a0, a1 = inset(pts[k], sx), inset(pts[k + 1], sx)
            out += slab((a0[0], a0[1], zc - fr / 2), (a1[0], a1[1], zc - fr / 2), (a0[0], a0[1], zc + fr / 2), (a1[0], a1[1], zc + fr / 2),
                        fr, (0, sy + 2, zc))
    return out


# How far each section's planking reaches outside its half-width (its outermost strake or gunwale).
OUTER = {st: outer_of(st, legacy=True) for st in CON}        # at model scale 1


# Medium hulls, drawn at twice the size. Each half-beam is derived from the tradition's typical
# length-to-beam ratio at a typical medium length; side height is a ratio of the half-beam.
MEDIUM_SCALE, MEDIUM_TYPICAL_LENGTH = 2, 17
# Large ships, drawn at four times the size (2.2 times as tall), built in a dry dock.
LARGE_SCALE, LARGE_TYPICAL_LENGTH = 4, 34
TYPICAL_BLOCKS = {1: 7, MEDIUM_SCALE: MEDIUM_TYPICAL_LENGTH, LARGE_SCALE: LARGE_TYPICAL_LENGTH}


def medium(section, lb, depth, scale=MEDIUM_SCALE, **kw):
    beam_blocks = TYPICAL_BLOCKS[scale] / lb
    snap = lambda v: round(v * 2) / 2              # on the half-pixel grid, so planks keep their true thickness
    F = snap(beam_blocks / 2 / scale * 16 - outer_of(section, scale, legacy=True))
    return dict(section=section, F=F, side=snap(depth * F), scale=scale, **kw)


def large(section, lb, depth, **kw):
    return medium(section, lb, depth, scale=LARGE_SCALE, **kw)


BOATS.update({
    "cog": medium("clinker", 3.15, 1.0, oar=1.6, aspect=0.95,
                  bow=dict(taper="pointed", rise=0.2, floor=0.2, stem="raked"), stern=dict(taper="blunt", rise=0.25, floor=0.15, stem="raked_short")),
    "freight_canoe": medium("bark", 6, 0.7, oar=1.8, aspect=0.9, ribs=True, lashings=True,
                            bow=dict(taper="pointed", rise=0.5, floor=0.3, stem="recurve"), stern=dict(taper="pointed", rise=0.5, floor=0.3, stem="recurve")),
    # Twin masts, like the Hawaiian double canoes, one forward and one aft of the platform's middle.
    "voyaging_canoe": medium("v", 7.5, 0.85, oar=1.8, aspect=0.9, twin=True, masts=[(-0.22, 1.0), (0.2, 1.0)],
                             bow=dict(taper="fine", rise=0.35, floor=0.2, stem="end_board"), stern=dict(taper="fine", rise=0.3, floor=0.2, stem="end_board")),
    # Main mast raked just forward of the middle, a smaller mizzen aft (the two-masted ghanjah and baghlah).
    "dhow": medium("carvel", 3.75, 0.7, oar=1.8, aspect=0.9, stitches=True, masts=[(-0.12, 1.0), (0.3, 0.6)],
                   bow=dict(taper="pointed", rise=0.4, floor=0.3, stem="raked"), stern=dict(taper="pointed", rise=0.35, floor=0.25, stem="raked_short")),
    # Main mast near the middle, a smaller foremast right up in the bow.
    "junk": medium("flat", 3.25, 0.6, oar=1.6, aspect=0.9, keel=False, masts=[(0.02, 1.0), (-0.3, 0.75)],
                   bow=dict(taper="flat", rise=0.35, floor=0.55, stem="bow_board"), stern=dict(taper="flat", rise=0.6, floor=0.15, stem="transom")),
    "bezaisen": medium("flat", 3.75, 0.62, oar=1.7, aspect=1.15, keel=False,
                       bow=dict(taper="pointed", rise=0.5, floor=0.3, stem="blade"), stern=dict(taper="flat", rise=0.3, floor=0.125, stem="transom")),
    "war_canoe": medium("round", 8, 0.75, oar=1.8, aspect=0.9, masts=[(-0.2, 1.0), (0.15, 0.85)],
                        bow=dict(taper="blunt", rise=0.9, floor=0.25, stem="lug"), stern=dict(taper="blunt", rise=0.4, floor=0.2, stem="lug")),
    "flatboat": medium("flat", 3.5, 0.4, oar=1.4, aspect=0.9, keel=False,
                       bow=dict(taper="flat", rise=0.0, floor=0.6, stem="swim"), stern=dict(taper="flat", rise=0.0, floor=0.6, stem="swim")),
    "umiak": medium("skin", 4, 0.55, oar=1.7, aspect=0.9,
                    bow=dict(taper="pointed", rise=0.3, floor=0.3, stem="raked_short"), stern=dict(taper="pointed", rise=0.3, floor=0.3, stem="raked_short")),
})


BOATS.update({
    # depth 0.85: freeboard enough that the lee hull stays dry at the 3° a catamaran heels to before a hull lifts
    "theran_ship": medium("v", 9, 0.85, oar=1.8, aspect=0.9, twin=True, bow=PIERCE, stern=THERAN_STERN,
                          # (z, size, hull side, cant out from the centre line, rake aft): a wing canted out on each hull,
                          # and behind them two small tail wings canted in toward each other, like a fighter's twin fins
                          masts=[(0.0, 1.0, -1, 14, 0), (0.0, 1.0, 1, 14, 0), (0.33, 0.42, -1, -14, 8), (0.33, 0.42, 1, -14, 8)]),
})


# Large ships: each tradition's biggest working hull, at about 34 blocks. Masts as each carried them.
BOATS.update({
    # The skeid: the largest longships, one great square sail and a long run of oars.
    "skeid": large("clinker", 7.5, 0.6, oar=2.2, aspect=0.75, ports=True,
                   bow=dict(taper="pointed", rise=0.5, floor=0.31, stem="norse_tall"), stern=dict(taper="pointed", rise=0.5, floor=0.31, stem="norse_tall")),
    # The carrack: high-sided, carvel-built, three masts (fore, main and a small mizzen aft).
    "carrack": large("carvel", 3.0, 1.1, oar=1.6, aspect=0.95, masts=[(-0.3, 0.7), (0.0, 1.0), (0.3, 0.55)],
                     bow=dict(taper="pointed", rise=0.3, floor=0.2, stem="raked"), stern=dict(taper="flat", rise=0.35, floor=0.15, stem="transom")),
    # The baghlah: the great deep-sea dhow, its square transom stern and two lateen masts.
    "baghlah": large("carvel", 3.5, 0.8, oar=1.8, aspect=0.9, masts=[(-0.12, 1.0), (0.3, 0.6)],
                     bow=dict(taper="pointed", rise=0.45, floor=0.3, stem="raked"), stern=dict(taper="flat", rise=0.4, floor=0.2, stem="transom")),
    # The fuchuan: the Fujian sea junk, a sharp keeled bottom, high stern, three battened masts.
    "fuchuan": large("v", 3.2, 0.75, oar=1.6, aspect=0.9, masts=[(-0.32, 0.65), (0.0, 1.0), (0.3, 0.6)],
                     bow=dict(taper="flat", rise=0.35, floor=0.5, stem="bow_board"), stern=dict(taper="flat", rise=0.65, floor=0.15, stem="transom")),
    # The shuinsen: the red-seal trading ship, Japanese and Chinese building together, three masts.
    "shuinsen": large("flat", 3.4, 0.7, oar=1.7, aspect=1.1, keel=False, masts=[(-0.3, 0.6), (0.0, 1.0), (0.3, 0.5)],
                      bow=dict(taper="pointed", rise=0.5, floor=0.3, stem="blade"), stern=dict(taper="flat", rise=0.35, floor=0.125, stem="transom")),
    # The drua: the Fijian double canoe, the largest of the Pacific, one great sail on its platform.
    "drua": large("v", 8, 0.85, oar=1.8, aspect=0.9, twin=True,
                  bow=dict(taper="fine", rise=0.35, floor=0.2, stem="end_board"), stern=dict(taper="fine", rise=0.35, floor=0.2, stem="end_board")),
})


# The League's galleys, the -remes: long, slim, carvel-built rowing ships of the inner sea, a bank of oars a side for
# each size (one, two, three), a square sail for the passage, a three-bladed bronze ram at the waterline, the bow
# raked over it and the stern sweeping up and curling in over the helm (the aphlaston). They row to fight and sail
# only for the passage, so their sail is a little over half a sailing ship's (sail_share; plans.js sailShare).
GALLEY_BOW = dict(taper="pointed", rise=0.22, floor=0.2, stem="raked")
GALLEY_STERN = dict(taper="pointed", rise=0.55, floor=0.3, stem="norse_tall")
BOATS["league_monoreme"] = dict(section="carvel", F=8, side=11, oar=2.3, aspect=0.9, ports=True, banks=1, sail_share=0.55, bow=GALLEY_BOW, stern=GALLEY_STERN)
BOATS.update({
    "league_bireme": medium("carvel", 7, 0.62, oar=2.3, aspect=0.9, ports=True, banks=2, sail_share=0.55, bow=GALLEY_BOW, stern=GALLEY_STERN),
    "league_trireme": large("carvel", 8, 0.62, oar=2.3, aspect=0.9, ports=True, banks=3, sail_share=0.55, bow=GALLEY_BOW, stern=GALLEY_STERN),
})


BOATS.update({
    "theran_flagship": large("v", 10, 0.75, oar=1.8, aspect=0.9, tri=True, bow=PIERCE, stern=THERAN_STERN,
                             masts=[(-0.26, 0.6), (0.0, 1.0), (0.26, 0.8)]),   # stepped short, tallest, middle from bow to stern
})


# ---------------------------------------------------------------- the laws (D-004; chief.md sections 2 and 3)
# Every hull is drawn to the world's own measure (world/boatsizes.js sizeOf(...).exact, one source of truth, read
# through node so there is no Python copy of the core): depth by form, the law's draught under the water, the
# freeboard against its reach's design wave (a washstrake makes up any shortfall), walls that grow with length, and
# decks from depth. The model's beam stays as drawn (Theran and twin beams are step 3's work).
WATERLINE = 0.4        # given: the water's surface over a floating boat's origin (handling.js, grid.js WATERLINE)
DECK_HEIGHT = 2        # given: a 1.8-block player walks a 2-block tween (grid.js DECK_HEIGHT)
BULWARK = 1            # vision: a waist-high bulwark, a block, from the weather deck to the rail
LAW_NAME = {"theran_skiff": "skiff", "theran_ship": "Theran ship", "theran_flagship": "flagship"}
law_name = lambda pid: LAW_NAME.get(pid, pid.replace("league_", "").replace("_", " "))


def _law():
    js = ("import('./BP/world/boatsizes.js').then((m) => { const o = {}; for (const F of Object.values(m.FLEETS)) for (const t of F) "
          "o[t.name] = { ...m.sizeOf(t).exact, cls: t.cls, reach: t.reach }; console.log(JSON.stringify(o)); });")
    return json.loads(subprocess.run(["node", "-e", js], cwd=ROOT, check=True, capture_output=True, text=True).stdout)


LAW = _law()
# K, the wall law's length over thickness, by how the hull is built (on Fibonacci rungs by construction): frame-first
# carvel 89, bulkheaded or flat 144, shell-first light (clinker, sewn, mortise-and-tenon, bark, skin) 233; a carved
# log keeps its own wall (None).
K_SECTION = {"clinker": FIB[12], "carvel": FIB[10], "flat": FIB[11], "v": FIB[12], "bark": FIB[12], "skin": FIB[12], "chine": FIB[12], "round": None}
K_BOAT = {"cog": FIB[10],                                  # given: frame-first, the Bremen cog (chief.md section 3)
          "dhow": FIB[12], "sewn_boat": FIB[12],           # given: sewn, shell-first (atlantic_indian.md)
          "fuchuan": FIB[11],                              # given: bulkheaded, the Quanzhou ship
          "shuinsen": FIB[10],                             # given: keeled, framed carvel (eastasian_pacific.md)
          "league_monoreme": FIB[12], "league_bireme": FIB[12], "league_trireme": FIB[12],   # given: mortise-and-tenon shells (Olympias)
          "theran_skiff": FIB[11], "theran_ship": FIB[11], "theran_flagship": FIB[11]}       # vision: the Therans' moulded hulls, as bulkheaded
# Decks by class (chief.md section 3): n = floor((D - 1) / 2) decks (a bulwark and a 2-block tween each); full (n >= 1),
# half (the ends) on undecked ships, open on small boats. Culture readings: the junk's full deck (eastasian_pacific.md),
# the trireme's katastroma (league.md), the Norse deck boards on the biti at the waterline (northern.md, Gokstad).
DECK_OVERRIDE = {"junk": "full", "league_trireme": "full", "skeid": "biti", "longship": "biti"}
snap_w = lambda v: round(v * 2) / 2                       # derived: the half world pixel, finish()'s grid


def _apply_laws():
    global SCALE, WALL
    for pid, b in BOATS.items():
        lw = LAW[law_name(pid)]
        s, st = b.get("scale", 1), b["section"]
        snap = lambda v: round(v * 2 * s) / (2 * s)       # model px on the half world pixel
        beam_out = b["F"] + outer_of(st, s, legacy=True)  # the half-beam outside the planking, as drawn at v0.9.14
        K = K_BOAT.get(pid, K_SECTION[st])
        SCALE, WALL = s, snap_w(max(CON[st]["shell"], 16 * lw["L"] / K if K else 0))
        b["_law"], b["_wall"] = lw, WALL
        b["F"] = snap(beam_out - outer_of(st, s))         # the same beam outside a thicker wall
        b["fy"] = snap(th(st, "keel")) if (CON[st]["keel"] and b.get("keel", True)) else 0   # the keel, moulded as sided
        b["side"] = snap(16 * lw["depth"] / s)            # keel's foot to the sheer: the law's depth
        b["wl"] = snap(16 * lw["draft"] / s)              # the waterline over the keel's foot: the law's draught
        b["wash"] = snap(16 * lw["wash"] / s)             # a washstrake over the sheer, where the freeboard falls short
        n = max(0, math.floor((lw["depth"] - BULWARK) / DECK_HEIGHT))
        kind = DECK_OVERRIDE.get(pid) or ("full" if n >= 1 else "open" if lw["cls"] == "small" else "half")
        up = 0 if (kind == "biti" or n == 0) else max(0, math.floor(lw["freeboard"] + lw["wash"] - BULWARK + 0.5))   # derived: whole blocks, where feet stand (grid.js topDeckUp)
        t = th(st, "deck")
        on = lambda y: y + (1 / s if abs(y - b["wl"]) < 1e-6 else 0)   # a deck at the waterline stands a world pixel over it: the sea is drawn under it, never through it
        top = on(b["wl"] + snap(16 * up / s))
        b["_deck"] = dict(kind=kind, n=n, up=up, top=top, t=t,
                          lower=[on(b["wl"] + snap(16 * (up - DECK_HEIGHT * k) / s)) for k in range(1, n) if b["wl"] + 16 * (up - DECK_HEIGHT * k) / s > b["fy"] + 16 / s])
    SCALE, WALL = 1, None


_apply_laws()


def use(b):
    """Builds at this boat's scale and wall."""
    global SCALE, WALL
    SCALE, WALL = b.get("scale", 1), b["_wall"]


def details(b, hw, fy, sy, z0, L, mid=False):
    """Telling details along a span: ribs, lashings, stitching, tholes, deck lines."""
    out = []
    o = outer_of(b["section"], SCALE)            # the outer face of the planking
    if b.get("lashings"):
        for z in range(int(z0) + 1, int(z0 + L), 3):
            for sx in (-1, 1):
                x = hw + o if sx > 0 else -(hw + o) - 0.5
                out.append(cube([x, sy - 1.5, z], [0.5, 1.5, 1]))
    if b.get("stitches"):
        for z in range(int(z0) + 1, int(z0 + L), 3):
            for sx in (-1, 1):
                x = hw + o if sx > 0 else -(hw + o) - 0.5
                out.append(cube([x, fy + (sy - fy) * 0.5, z], [0.5, 0.5, 0.5]))
    if b.get("tholes") and mid:
        for sx in (-1, 1):
            out.append(cube([(hw + o - 0.75) * sx - 0.25, sy, z0 + 7], [0.5, 2, 0.5]))
    if b.get("deck") and mid:
        out.append(cube([-hw, sy, z0 + 4], [2 * hw, 0.3, 0.4]))      # deck lines across
        out.append(cube([-hw, sy, z0 + 11], [2 * hw, 0.3, 0.4]))
    if b.get("ports") and mid:
        for sx in (-1, 1):
            out.append(cube([(hw + o) * sx - (0 if sx > 0 else 0.5), sy - 2.5, z0 + 6.5], [0.5, 1, 1.5]))  # oar port frames
    return out


# ---------------------------------------------------------------- ends
def end_shape(b, end, t):
    F, side = b["F"], b["side"]
    taper = end["taper"]
    if taper == "pointed":
        hw = max(1.2, F * (1 - t ** 1.6))
    elif taper == "fine":
        hw = max(0.8, F * (1 - t ** 1.2))
    elif taper == "blunt":
        hw = F * (1 - 0.5 * t ** 1.5)
    elif taper == "piercer":                      # a wave-piercer: a knife-fine entry, the deck falling toward the stem
        hw = max(0.6, F * (1 - t ** 1.05))
        return hw, b["fy"] + end["floor"] * side * t, side - end.get("drop", 0.3) * side * t ** 1.4
    else:
        hw = F * (1 - 0.15 * t ** 2)
    return hw, b["fy"] + end["floor"] * side * t ** 2, side + end["rise"] * side * t ** 3


def at(tip, sign, dz, sz):
    """Origin z for a piece sz deep that sits dz beyond an end's tip (outward)."""
    return tip - dz - sz if sign < 0 else tip + dz


def stem_curve(kind, s, hw, fy, sy):
    """Each end's line, as (outward from the tip, height) points starting at the keel's foot under the tip: one
    smooth timber, from the keel up through the sheer to its head. In proportion to the side height s."""
    h = sy - fy
    line = lambda n, f: [f(k / n) for k in range(n + 1)]
    def rise_and_curl(height, lean, r, turn):
        top = sy + height * s
        up = line(10, lambda t: (lean * s * t ** 1.6, fy + (top - fy) * math.sin(t * math.pi / 2)))
        zt, yt = up[-1]
        cz = zt - r * s                                            # the curl turns back over the hull
        return up + [(cz + r * s * math.cos(a), yt + r * s * math.sin(a))
                     for a in (turn * k / 8 for k in range(1, 9))]
    if kind == "norse":
        return rise_and_curl(1.0, 0.42, 0.16, 3.6)
    if kind == "norse_tall":
        return rise_and_curl(1.3, 0.5, 0.18, 3.6)
    if kind == "recurve":
        return rise_and_curl(0.7, 0.32, 0.14, 2.6)
    if kind in ("raked", "raked_short"):
        r, head = (0.75, 0.16) if kind == "raked" else (0.45, 0.08)
        return line(8, lambda t: (r * s * t ** 1.4, fy + (h + head * s) * t))
    if kind == "piercer":                       # the wave-piercer: the foot reaching furthest out, raked back as it rises
        return line(8, lambda t: (0.42 * s * (1 - t) ** 1.25, fy + (h + 0.04 * s) * t))
    if kind == "blade":
        return line(8, lambda t: (0.28 * s * t ** 1.2, fy + (h + 0.7 * s) * t))
    if kind in ("kayak_bow", "kayak_stern"):
        r = 0.42 if kind == "kayak_bow" else 0.22
        return line(6, lambda t: (r * s * t ** 0.7, fy + h * t ** 1.6))
    if kind == "lug":
        return line(3, lambda t: (0.08 * s * t, fy + (h + 0.12 * s) * t))
    if kind == "end_board":
        return line(4, lambda t: (0.12 * s * t, fy + (h + 0.4 * s) * t))
    return line(2, lambda t: (0.0, fy + (h + 0.12 * s) * t))        # plumb


def stem(b, end, sign, tip, hw, fy, sy):
    """The end of the hull: where its shell is still broad, a board cut to the hull's curve closes it; then the stem,
    one swept timber from the keel's foot to its head, plated back into the shell all the way up to the sheer, so the
    end is one piece with the hull."""
    kind, out = end["stem"], []
    s, F = b["side"], b["F"]
    pts = profile(b, hw, fy, sy)
    if kind in ("bow_board", "transom", "swim") or hw > 0.18 * F + 1:
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            w_ = max(x0, x1)
            if w_ > 0.3:
                out.append(cube([-w_, y0, at(tip, sign, -0.5, 1.2)], [2 * w_, y1 - y0 + 0.3, 1.2]))
        if kind == "bow_board":                            # the sampan's bow board, standing above the sheer
            X = pts[-1][0]
            out.append(cube([-X, sy, at(tip, sign, -0.5, 1.2)], [2 * X, 0.3 * s, 1.2]))
        if kind in ("bow_board", "transom", "swim"):
            return out
    w = max(1.2, min(2 * hw + 0.8, 0.22 * F + 1))            # the timber: as broad as the closing hull, never a plank
    d = max(1.2, 0.11 * s)
    curve = stem_curve(kind, s, hw, fy, sy)
    Z = lambda dz: tip + sign * dz
    for (za, ya), (zb, yb) in zip(curve, curve[1:]):
        out += slab((-w / 2, ya, Z(za)), (w / 2, ya, Z(za)), (-w / 2, yb, Z(zb)), (w / 2, yb, Z(zb)), d,
                    (0, (ya + yb) / 2, tip - sign * 999))
        # the plate between the timber and the hull's end, up to the sheer: the stem never stands apart
        lo, hi = min(ya, yb), min(max(ya, yb), sy)
        reach = min(za, zb)
        if hi > lo and reach > 0.2:
            out.append(cube([-w / 2 + 0.15, lo, at(tip, sign, -0.6, reach + 0.6)], [w - 0.3, hi - lo + 0.2, reach + 0.6]))
    if kind == "end_board":                                 # the outrigger's board across the end, over the stem
        out.append(cube([-0.35 * F, sy + 0.25 * s, at(tip, sign, 0.05 * s, 1)], [0.7 * F, 0.22 * s, 1]))
    if kind == "lug":
        out.append(cube([-0.18 * F, sy - 0.1 * s, at(tip, sign, 0, 0.2 * s)], [0.36 * F, 0.2 * s, 0.2 * s]))
    return out


def end_section(b, sign, base):
    end = b["bow"] if sign < 0 else b["stern"]
    slices = END_SLICES_LAUNCHED[b.get("scale", 1)] - (1 if b.get("twin") else 0) if SIMPLE else END_SLICES   # a twin's two hulls: a slice lighter each
    seg = END / slices
    st = b["section"]
    kw, FY = th(st, "keel"), b["fy"]
    keel, frame, plank = [], [], []
    shape = lambda t: (b["F"], FY, b["side"]) if t <= 0 else end_shape(b, end, t)
    for j in range(slices):
        a, c = shape(j / slices), shape((j + 1) / slices)
        za, zc = base + sign * seg * j, base + sign * seg * (j + 1)
        z0 = min(za, zc)
        hw, fy, sy = shape((j + 0.5) / slices)
        if FY > 0:                       # the keel, standing proud under the bottom (both models: D-004)
            keel.append(cube([-kw / 2, fy - FY, z0], [kw, FY + th(st, "shell"), seg]))
        cockpit = b.get("deck") and sign > 0 and z0 < 14
        plank += shell(b, a, c, za, zc, cockpit=cockpit) + deck_slabs(b, a, c, za, zc, ends=True)
        if not SIMPLE:
            plank += details(b, hw, fy, sy, z0, seg)
            if j in (slices // 4, slices // 2 + 1):
                frame += frames(b, hw, fy, sy, z0 + seg / 2)
    tip = base + sign * END
    plank += stem(b, end, sign, tip, *shape(1.0))
    return keel, frame, plank


# ---------------------------------------------------------------- part kits (culture-made, placed at this hull's sockets)
def rig_ref(b):
    """The half-beam a rig is proportioned from: the whole breadth for twin hulls, and never so
    narrow that a long, slim hull gets a toy rig (at least 0.09 of a typical length)."""
    return max(b["F"] + multihull(b)["twin_gap"] / 2, 0.09 * typical_length(b))


def mast_plan(b):
    """Where each mast stands (share of the hull's length from the centre, - forward) and its rig's
    relative size. One mast unless the tradition carried more."""
    return b.get("masts", [(0.0, 1.0)])


def kit_factor(b):
    """Each mast's rig is built at this share of a single rig, so all of them together carry the area one would."""
    return 1 / math.sqrt(sum(m[1] * m[1] for m in mast_plan(b)))


import sys  # noqa: E402
sys.path.insert(0, str(Path(__file__).resolve().parent))
import sailcloth as SC  # noqa: E402

BELLY = 0.08           # how deep a drawing sail's belly is, of its width


def _ratios():
    """Each sail type's area rule, read from handling.js so the model and the physics never disagree."""
    src = (ROOT / "BP/scripts/handling.js").read_text()
    grab = lambda name: {k: float(v) for k, v in re.findall(r"(\w+): ([\d.]+)", re.search(name + r" = \{([^}]*)\}", src).group(1))}
    return grab("SAIL_RATIO"), grab("SAIL_PER_L2")


SAIL_RATIO, SAIL_PER_L2 = _ratios()
RIG_TARGETS = json.loads((ROOT / "tools/rig_targets.json").read_text()) if (ROOT / "tools/rig_targets.json").exists() else {}
FILL = {k: sum(SC.inside(k, (i + 0.5) / 40, (j + 0.5) / 40) for i in range(40) for j in range(40)) / 1600 for k in SC.REGION}
# Each sail type's mast: how far over the cloth its head stands (of the sail's size a) and its thickness (of a).
MAST_OF = {"square": (0.1, 0.05), "lateen": (0.12, 0.055), "crab_claw": (0.0, 0.04), "junk": (0.1, 0.05), "wing": (0.0, 0.035)}


def sail_area(b, style, g):
    """The area (square blocks) a sail of this type carries on this hull at its typical length, shared by g over
    the masts: the larger of its share of displacement and its share of length squared, as handling.js sets it."""
    pid = b.get("_pid")
    t = RIG_TARGETS.get(pid, {})
    L = t.get("L", TYPICAL_BLOCKS[b.get("scale", 1)])
    V23 = t.get("V23", 0)
    return max(SAIL_RATIO.get(style, 6) * V23, SAIL_PER_L2.get(style, 0.2) * L * L) * g * g * b.get("sail_share", 1)


def face_uv(r, u0=0.0, u1=1.0, mirror=False):
    x, y, w, h = r
    return {"uv": [round(x + (u1 if mirror else u0) * w, 3), y], "uv_size": [round((u1 - u0) * w * (-1 if mirror else 1), 3), h]}


CLEAR_FACE = {"uv": list(SC.CLEAR[:2]), "uv_size": list(SC.CLEAR[2:])}
ALL_FACES = ("north", "south", "east", "west", "up", "down")
uv_all = lambda r: {f: {"uv": list(r[:2]), "uv_size": list(r[2:])} for f in ALL_FACES}


def cloth(kind, axis, a0, a1, y0, y1, belly, n=6, at=0.0):
    """A sail's cloth: n panels from a0 to a1 along its axis ("z" fore and aft, "x" across), each set off by the belly
    at its middle, each face showing its own slice of this cloth's region of the sheet, so the cut shape reads whole.
    The game shows a face's texture as seen from outside it, with file x mirrored: so of a fore-and-aft cloth the east
    face reads aft-to-fore and the west fore-to-aft, and of a square sail the north face follows file x."""
    out, r = [], SC.REGION[kind]
    for k in range(n):
        u0, u1 = k / n, min(1.0, (k + 1.12) / n)          # each panel laps the next a little, as cloths are sewn
        c0, c1 = a0 + (a1 - a0) * u0, a0 + (a1 - a0) * u1
        off = belly * (1 - (2 * (k + 0.5) / n - 1) ** 2)
        uv = {f: dict(CLEAR_FACE) for f in ALL_FACES}
        if axis == "z":
            o, sz = [at - 0.25 + off, y0, c0], [0.5, y1 - y0, c1 - c0 + 0.02]
            uv["west"], uv["east"] = face_uv(r, u0, u1), face_uv(r, u0, u1, mirror=True)
        else:
            o, sz = [c0, y0, at - 0.25 + off], [c1 - c0 + 0.02, y1 - y0, 0.5]
            uv["north"], uv["south"] = face_uv(r, u0, u1), face_uv(r, u0, u1, mirror=True)
        out.append({"origin": [round(v, 3) for v in o], "size": [round(v, 3) for v in sz], "uv": uv})
    return out


def spar(p0, p1, t, xw=None):
    """A round spar from p0 to p1 (y, z) on the centre plane, t thick: one piece, turned to lie along its line."""
    xw = xw if xw is not None else t
    (ya, za), (yb, zb) = p0, p1
    nz, ny = -(yb - ya), (zb - za)                      # the spar's normal in the y-z plane
    L = math.hypot(ny, nz) or 1
    oy, oz = ny / L * t / 2, nz / L * t / 2
    out = slab((-xw / 2, ya - oy, za - oz), (xw / 2, ya - oy, za - oz), (-xw / 2, yb - oy, zb - oz), (xw / 2, yb - oy, zb - oz), t,
               (0, (ya + yb) / 2 + oy * 99, (za + zb) / 2 + oz * 99))
    for c in out:
        c["uv"] = uv_all(SC.SPAR)
    return out


def rod(p, q, t):
    """A straight rod (strut, chord, cord) t thick from p to q, anywhere: one piece, turned to lie along it."""
    d = [q[i] - p[i] for i in range(3)]
    ax = [0, 0, 1] if abs(d[2]) < 0.7 * math.sqrt(sum(v * v for v in d)) else [1, 0, 0]
    cr = [d[1] * ax[2] - d[2] * ax[1], d[2] * ax[0] - d[0] * ax[2], d[0] * ax[1] - d[1] * ax[0]]
    m = math.sqrt(sum(v * v for v in cr)) or 1
    u = [v / m * t / 2 for v in cr]
    side_ = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]
    mm = math.sqrt(sum(v * v for v in side_)) or 1
    off = [v / mm * t / 2 for v in side_]
    P = lambda a, sg: tuple(a[i] - u[i] * sg - off[i] for i in range(3))
    return slab(P(p, 1), P(p, -1), P(q, 1), P(q, -1), t, tuple(p[i] + off[i] * 9 for i in range(3)))


def rig_kit(b, g):
    """One mast and its five sail styles. Each sail type is drawn at the area it sails with on this hull at its
    typical length (sail_area: its own share of displacement and of length squared), so the model is the size the
    game sets it at; and each type stands on its own mast (MAST_OF: how far its head stands over the cloth and how
    thick it is). Sizes are worked in world blocks and drawn in the model's pixels (x and z by the hull's scale, y by
    its height scale). Every cloth is one cut sail (sailcloth.py) with its spars: the square sail's yard, the
    lateen's raked yard, the crab claw's two spars, the junk's yard, battens and boom."""
    hs = b.get("scale", 1)
    ys = y_scale(hs)
    zx, yy = (lambda v: v * 16 / hs), (lambda v: v * 16 / ys)
    base = b["side"] + b["wash"]                     # the rail: every sail sets clear of it
    spar_t = max(0.6, zx(0.07))
    bones = []

    # Square sail: on a yard near the masthead, hanging to a foot well clear of the deck.
    A = sail_area(b, "square", g)
    a = math.sqrt(A)
    W = math.sqrt(A / FILL["square"] / b["aspect"])
    Hs = W * b["aspect"]
    clear = 0.3 * a
    yard_y = base + yy(clear + Hs)
    sq = cloth("square", "x", -zx(W) / 2, zx(W) / 2, yard_y - yy(Hs), yard_y, -zx(BELLY * W))
    sq.append({"origin": [-zx(W) / 2 - 1, yard_y - spar_t / 2, -spar_t / 2], "size": [zx(W) + 2, spar_t, spar_t], "uv": uv_all(SC.SPAR)})
    bones.append({"name": "rig_square", "parent": "root", "pivot": [0, yard_y, 0], "cubes": sq, "_area": A,
                  "_mast_top": yard_y + yy(MAST_OF["square"][0] * a), "_mast_t": zx(MAST_OF["square"][1] * a), "_tt": (0.25 * zx(W), yard_y - 0.5 * yy(Hs), 1.1)})

    # Lateen: a long yard raked at its angle (tack low forward, peak high aft), the cloth from the foot up to it.
    A = sail_area(b, "lateen", g)
    a = math.sqrt(A)
    rake = math.radians(LATEEN["rake"])
    Y = math.sqrt(A / FILL["lateen"] / (math.sin(rake) * math.cos(rake)))        # the cloth's box: Y cos by Y sin
    foot = base + yy(0.12 * a)
    tz, pz = -zx(0.55 * Y * math.cos(rake)), zx(0.45 * Y * math.cos(rake))
    peak = foot + yy(Y * math.sin(rake))
    yard_at = lambda z: foot + (peak - foot) * (z - tz) / (pz - tz)
    lat = cloth("lateen", "z", tz, pz, foot, peak, zx(BELLY * Y * 0.5), n=8)
    lat += spar((foot - 0.3, tz - zx(0.06 * Y)), (peak + 0.3, pz + zx(0.04 * Y)), spar_t)
    bones.append({"name": "rig_lateen", "parent": "root", "pivot": [0, (foot + peak) / 2, 0], "cubes": lat, "_area": A,
                  "_mast_top": yard_at(0) + yy(MAST_OF["lateen"][0] * a), "_mast_t": zx(MAST_OF["lateen"][1] * a),
                  "_tt": (0.4, (foot + yard_at(tz + 0.3 * (pz - tz))) / 2, tz + 0.3 * (pz - tz))})

    # Crab claw (Pacific): two spars spring from a tack low forward and open into a V, the cloth a crescent between
    # their tips. The mast is short: it props the upper spar about halfway up its length.
    A = sail_area(b, "crab_claw", g)
    a = math.sqrt(A)
    z0, z1, y0, y1 = SC.crab_box()
    S = math.sqrt(A / FILL["crab_claw"] / ((z1 - z0) * (y1 - y0)))
    apex = (base + yy(0.06 * a) + 0.13, -zx(0.3 * S))
    _, (az, ay), (fz, fy_) = SC.crab_points()
    crab = cloth("crab_claw", "z", apex[1] + zx(z0 * S), apex[1] + zx(z1 * S), apex[0] + yy(y0 * S), apex[0] + yy(y1 * S),
                 zx(BELLY * S * 0.5), n=8, at=CRAB_X)
    for tz_, ty_ in ((az, ay), (fz, fy_)):
        crab += [dict(c, origin=[c["origin"][0] + CRAB_X, *c["origin"][1:]], **({"pivot": [c["pivot"][0] + CRAB_X, *c["pivot"][1:]]} if "pivot" in c else {}))
                 for c in spar((apex[0], apex[1]), (apex[0] + yy(ty_ * S), apex[1] + zx(tz_ * S)), spar_t)]
    bones.append({"name": "rig_crab", "parent": "root", "pivot": [CRAB_X, apex[0], apex[1]], "cubes": crab, "_area": A,
                  "_mast_top": apex[0] + yy(0.56 * S), "_mast_t": zx(MAST_OF["crab_claw"][1] * a),
                  "_tt": (CRAB_X + 0.4, apex[0] + yy(0.45 * fy_ * S), apex[1] + zx(0.45 * fz * S) + 1.5)})

    # Junk: a tall battened lug, set a little forward of the mast; a yard on its sloping head, battens, a boom.
    A = sail_area(b, "junk", g)
    a = math.sqrt(A)
    jw = math.sqrt(A / FILL["junk"] / 1.3)
    jh = 1.3 * jw
    jy = base + yy(0.18 * a)
    jz0, jz1 = -zx(0.3 * jw), zx(0.7 * jw)
    junk = cloth("junk", "z", jz0, jz1, jy, jy + yy(jh), zx(BELLY * jw * 0.4), n=6)
    head = lambda u: jy + yy(jh) * (1 - 0.1 * (1 - u))
    junk += spar((head(0), jz0 - 1), (head(1), jz1 + 1), spar_t)                     # the yard, along the head
    for k in range(6):
        y = jy + yy(jh) * (1 - (k + 1) / 6)
        reach = 1 - 0.07 * math.sin(math.pi * (k + 1) / 6)
        junk.append({"origin": [-0.6, y - 0.4, jz0 - 0.5], "size": [1.2, 0.8, (jz1 - jz0) * reach + 0.5], "uv": uv_all(SC.SPAR)})
    bones.append({"name": "rig_junk", "parent": "root", "pivot": [0, jy, 0], "cubes": junk, "_area": A,
                  "_mast_top": head(0.3) + yy(MAST_OF["junk"][0] * a), "_mast_t": zx(MAST_OF["junk"][1] * a),
                  "_tt": (0.4, jy + 0.55 * yy(jh), jz0 + 0.1 * (jz1 - jz0))})

    # Wing (the Therans'): a rigid two-element wing, tall and narrow, a thick main element and a slotted flap
    # behind it, its chord tapering to the head, in short stacked pieces so it reads as one smooth aerofoil.
    A = sail_area(b, "wing", g)
    a = math.sqrt(A)
    c0 = math.sqrt(A / (WING["aspect"] * (1 - WING["taper"] / 2)))
    wh = WING["aspect"] * c0
    wing, n = [], 18
    skin = uv_all(SC.SOLID)
    wy = base + yy(0.1 * a)
    for k in range(n):
        c = zx(c0 * (1 - WING["taper"] * (k + 0.5) / n))
        y0_ = wy + k * yy(wh) / n
        t_ = max(1.0, WING["thick"] * c)
        dy = yy(wh) / n + 0.05
        wing.append({"origin": [-t_ / 2, y0_, -0.32 * c], "size": [t_, dy, 0.3 * c], "uv": skin})               # nose
        wing.append({"origin": [-0.36 * t_, y0_, -0.02 * c], "size": [0.72 * t_, dy, 0.38 * c], "uv": skin})    # main element aft
        wing.append({"origin": [-0.22 * t_, y0_, 0.42 * c], "size": [0.44 * t_, dy, 0.26 * c], "uv": skin})     # flap, past its slot
    ctip = zx(c0 * (1 - WING["taper"]))
    wtop = wy + yy(wh)
    wing.append({"origin": [-1.0, wtop, -0.34 * ctip], "size": [2.0, 0.8, 1.04 * ctip], "uv": uv_all(SC.SPAR)})   # the gold tip cap
    bones.append({"name": "rig_wing", "parent": "root", "pivot": [0, base, 0], "cubes": wing, "_area": A,
                  "_mast_top": wtop + 0.8, "_mast_t": zx(MAST_OF["wing"][1] * a), "_tt": (1.2, wy + 0.6 * yy(wh), -0.2 * zx(c0))})

    # The mast: stepped on the keel (the floor's top), through every deck, as tall as the tallest rig's own mast and
    # as thick as the stoutest (each type's mast is trimmed to its own height and thickness by mast_factors and
    # mast_thickness, about its step). A twin's masts stand on the platform between her hulls, as before.
    H = max(x["_mast_top"] for x in bones) - base
    mt = max(x["_mast_t"] for x in bones)
    foot = mast_foot(b)
    bones.insert(0, {"name": "mast", "parent": "root", "pivot": [0, foot, 0], "cubes": [cube([-mt / 2, foot, -mt / 2], [mt, H + base - foot, mt])]})
    for x in list(bones[1:]):
        px_, py_, pz_ = x["_tt"]
        bones += telltale_bones(x["name"], [(px_, py_, pz_), (-px_ if x["name"] != "rig_crab" else 2 * CRAB_X - px_, py_, pz_)])
    # The wind pennant flies from the masthead.
    ptop = base + H
    bones.append({"name": "pennant", "parent": "root", "pivot": [0, ptop, 0], "cubes": [
        cube([-0.25, ptop - 3, -6], [0.5, 3, 6]), cube([-0.25, ptop - 2.5, -10], [0.5, 2, 4])]})
    return bones


def mast_foot(b):
    """Where a mast is stepped (model px): on the keel, the floor's top; on the platform where twin hulls carry it."""
    if b.get("twin"):
        return b["side"] - 2
    return b["fy"] + th(b["section"], "shell")


def parts(b):
    """The culture-made parts kit, every size derived from this hull's proportions."""
    use(b)
    F, side = b["F"], b["side"]
    d = derived(b)
    H = d["mast"]
    base = deck_y(b)                               # what stands aboard stands on the walked deck
    kf = kit_factor(b)
    bones = []
    for k, r in enumerate(m[1] for m in mast_plan(b)):
        kit = rig_kit(b, kf * r)
        if k > 0:                                  # further masts: their own names, no telltales or pennant
            kit = [dict(x, name=f"{x['name']}_{k}", parent=(x["parent"] if x["parent"] == "root" else f"{x['parent']}_{k}"))
                   for x in kit if not x["name"].startswith("tt_") and x["name"] != "pennant"]
        m = mast_plan(b)[k]
        if len(m) > 2 and (m[2] or m[3] or m[4]):   # stepped off the centre line (on a hull of a pair), canted out, raked
            X = m[2] * multihull(b)["twin_gap"] / 2
            for x in kit:
                x["cubes"] = [dict(c, origin=[round(c["origin"][0] + X, 3), c["origin"][1], c["origin"][2]]) for c in x["cubes"]]
                x["pivot"] = [round(x["pivot"][0] + X, 3), x["pivot"][1], x["pivot"][2]]
                if x["name"] == "pennant":                 # carried to where the canted masthead is, still flying free
                    al = math.atan(math.tan(math.radians(m[3])) * y_scale(b.get("scale", 1)) / b.get("scale", 1)) * ((1 if X < 0 else -1) if X else 1)
                    h_ = x["pivot"][1] - 2
                    dx, dy = -h_ * math.sin(al), h_ * (math.cos(al) - 1)
                    x["pivot"] = [round(x["pivot"][0] + dx, 3), round(x["pivot"][1] + dy, 3), x["pivot"][2]]
                    x["cubes"] = [dict(c, origin=[round(c["origin"][0] + dx, 3), round(c["origin"][1] + dy, 3), c["origin"][2]]) for c in x["cubes"]]
                if x["name"].split("_")[0] in ("mast", "rig"):
                    # canted out from (or, a negative cant, in toward) the centre line, raked aft: turned about the foot
                    # (the hull is drawn taller by y_scale than its breadth by its scale: the angles are set so they
                    # read true in the world)
                    hs_, ys_ = b.get("scale", 1), y_scale(b.get("scale", 1))
                    al = math.atan(math.tan(math.radians(m[3])) * ys_ / hs_) * ((1 if X < 0 else -1) if X else 1)
                    rk = math.atan(math.tan(math.radians(m[4])) * ys_ / hs_)
                    Rz = [[math.cos(al), -math.sin(al), 0], [math.sin(al), math.cos(al), 0], [0, 0, 1]]
                    Rx = [[1, 0, 0], [0, math.cos(rk), -math.sin(rk)], [0, math.sin(rk), math.cos(rk)]]
                    R = [[sum(Rz[i][k_] * Rx[k_][j] for k_ in range(3)) for j in range(3)] for i in range(3)]
                    x["pivot"] = [round(X, 3), 2, 0]
                    x["rotation"] = euler_file(R)
        bones += kit

    # Oars: one pair per rowing station, this tradition's length; blade a fifth of the oar.
    ol = d["oar_len"]
    blade = 0.2 * ol
    # Each oar runs from its handle inboard (where the rower, or the power linkage, works it) out
    # through the oarlock. Thickness is drawn at true size (see TRUE_SIZE): only the length grows.
    inb = d["oar_inboard"]
    for i in range(MAX_OARS):
        z = -(i + 0.5) * SEG
        for sname, sx in (("r", -1), ("l", 1)):
            lock = (F + 0.5) * sx
            shaft0 = lock - inb if sx > 0 else lock - ol
            blade0 = lock + ol - blade if sx > 0 else lock - ol
            oars = [cube([shaft0, side - 1.5, z - 0.5], [ol + inb, 1, 1]), cube([blade0, side - 1.75, z - 0.15 * ol], [blade, 0.5, 0.3 * ol])]
            # A galley's further banks: each lower one through its own ports, staggered aft a third of a room
            # (the rowers sit in echelon, as in the trireme), its oars a little shorter.
            for k in range(1, b.get("banks", 1)):
                dy, dz_, sh_ = -k * 0.26 * side, k * SEG / 3, 1 - 0.12 * k
                oars.append(cube([shaft0 + (0 if sx > 0 else ol * (1 - sh_)), side - 1.5 + dy, z - 0.5 + dz_], [(ol + inb) * sh_, 1, 1]))
                bl0 = lock + ol * sh_ - blade if sx > 0 else lock - ol * sh_
                oars.append(cube([bl0, side - 1.75 + dy, z - 0.15 * ol + dz_], [blade, 0.5, 0.3 * ol]))
            bones.append({"name": f"oar_{i}_{sname}", "parent": "root", "pivot": [lock, side - 1, z], "cubes": oars})

    # Single paddle over the right side from the helm, long enough to reach the water.
    px = -(F + 1.5)
    ps, (pbw, pbl) = d["paddle_shaft"], d["paddle_blade"]
    grip = side + 0.3 * side
    bones.append({"name": "paddle", "parent": "root", "pivot": [px, grip, HELM_Z - 3], "cubes": [
        cube([px - 0.5, grip - ps, HELM_Z - 3.5], [1, ps, 1]),
        cube([px - 0.3, grip - ps - pbl + 1, HELM_Z - 3 - pbw / 2], [0.6, pbl, pbw]),
        cube([px - 1.5, grip, HELM_Z - 3.5], [3, 1, 1])]})
    # Double paddle (Arctic), across the cockpit: each blade reaches past the side by a freeboard.
    half, (dbl, dbw) = d["dpaddle_half"], d["dpaddle_blade"]
    dy = side + 0.3 * side
    bones.append({"name": "dpaddle", "parent": "root", "pivot": [0, dy, HELM_Z - 3], "cubes": [
        cube([-half, dy - 0.5, HELM_Z - 3.5], [2 * half, 1, 1]),
        cube([-half - dbl + 1, dy - 0.8, HELM_Z - 3 - dbw / 2], [dbl, 0.6, dbw]),
        cube([half - 1, dy - 0.8, HELM_Z - 3 - dbw / 2], [dbl, 0.6, dbw])]})
    # Sculling oar on its stern pin.
    sl, sb = d["scull"], d["scull_blade"]
    pin = END - 2
    bones.append({"name": "scull", "parent": "root", "pivot": [0, side + 1, pin], "cubes": [
        cube([-0.5, side + 0.5, pin], [1, 1, sl]), cube([-0.25 * sb, side + 0.2, pin + sl - sb], [0.5 * sb, 0.6, sb]),
        cube([-0.5, side + 1.5, pin - 1], [1, 2, 1])]})
    # Punting pole, long enough to reach bottom in shallow water.
    pl = d["pole"]
    top = side + 0.45 * side
    bones.append({"name": "pole", "parent": "root", "pivot": [px, top, HELM_Z - 4], "cubes": [
        cube([px - 0.5, top + 0.3 * side - pl, HELM_Z - 4.5], [1, pl, 1])]})
    # Outrigger: a float out to port on two lashed booms, placed by the hull's length and beam (multihull()).
    fx, r, al, boom = d["ama_out"], d["ama_r"], d["ama_len"], d["boom"]
    fl = b["wl"] - r                                 # the float rides half under, its middle at the waterline
    post = max(0.5, side - 2 - 2 * r - fl)
    bones.append({"name": "ama", "parent": "root", "pivot": [0, 0, 0], "cubes": [
        cube([fx - r, fl, -al / 2], [2 * r, 2 * r, al]),
        cube([fx - 0.75 * r, fl + 0.25 * r, -al / 2 - 0.1 * al], [1.5 * r, 1.5 * r, 0.1 * al]),
        cube([fx - 0.75 * r, fl + 0.25 * r, al / 2], [1.5 * r, 1.5 * r, 0.1 * al]),
        cube([F, side - 1, -boom - 1], [fx - F, 1.5, 2]), cube([F, side - 1, boom - 1], [fx - F, 1.5, 2]),
        cube([fx - 0.5, fl + 2 * r, -boom - 1], [1, post, 1.5]), cube([fx - 0.5, fl + 2 * r, boom - 1], [1, post, 1.5]),
        cube([F + 1, side - 1.6, -boom - 1.5], [1, 2.6, 3]), cube([F + 1, side - 1.6, boom - 1.5], [1, 2.6, 3])]})
    # Foils (the Theran skiff): a strut under the middle carrying a T-wing, and a T-rudder aft: at speed she lifts
    # onto them and flies.
    if b.get("foils"):
        span, depth_ = 2.6 * F, 1.2 * side
        bones.append({"name": "foils", "parent": "root", "pivot": [0, 0, 0], "cubes": [
            cube([-0.6, 1 - depth_, -4], [1.2, depth_, 5]), cube([-span / 2, 1 - depth_ - 0.8, -6], [span, 0.8, 8]),
            cube([-0.4, 1 - 0.8 * depth_, 14], [0.8, 0.8 * depth_, 3]), cube([-0.45 * span, 1 - 0.8 * depth_ - 0.6, 12.5], [0.9 * span, 0.6, 5])]})
    # The Theran trimaran: two slim wave-piercing floats (true hulls, rounded and decked), each carried on a single
    # forward-swept gold aka, and an hourglass trampoline of diamond mesh between each float and the main hull.
    if b.get("twin") and b.get("bow") is PIERCE:
        # The Theran catamaran's middle, in the same hand as the trimaran: two white beams, each swept forward from
        # the hulls to a chevron at the centre line, a short white pod between the hulls under them (the bridge
        # deck's nacelle, drawn with the mid sections), and an hourglass trampoline either side of the pod.
        L, D = typical_length(b), multihull(b)["twin_gap"]
        hi_, pod = D / 2 - F * 0.6, 0.22 * (D / 2 - F)
        akas, nets = [], []
        for zb in (-0.2 * L, 0.16 * L):
            for sx in (-1, 1):
                akas += swept_tube((sx * hi_, side + 0.6, zb + 0.05 * L), (0, side + 0.9, zb - 0.05 * L), 0.05 * L, 0.16 * side, arch=0.5, taper=0.2)
        for sx in (-1, 1):
            rope, cords = hourglass_net(sx * (pod + 0.6), sx * (D / 2 - F - 0.4), -0.27 * L, 0.2 * L, -0.25 * L, 0.18 * L, side - 0.2, 0.06 * L)
            akas += rope
            nets += cords
        bones.append({"name": "akas", "parent": "root", "pivot": [0, 0, 0], "cubes": akas})
        bones.append({"name": "nets", "parent": "root", "pivot": [0, 0, 0], "cubes": nets})
    if b.get("tri"):
        L = typical_length(b)
        out_, al, ar = max(1.9 * F, 0.26 * L), 0.6 * L, max(1.6, 0.42 * F)
        ah = 0.62 * side
        amas, akas, nets = [], [], []
        fb = dict(section="v", deck=True)
        n = 16
        shape = lambda t: (max(0.3, ar * (1 - abs(2 * t - 1) ** (1.6 if t < 0.5 else 2.6))), 1 + 0.25 * ah * abs(2 * t - 1) ** 3,
                           ah * (1 - 0.18 * max(0, 1 - 2 * t) ** 1.4))
        fl = b["wl"] - 0.55 * ah                   # the floats ride with their waterline at the main hull's
        for sx in (-1, 1):
            x0 = sx * out_
            for k in range(n):
                za, zc = -al / 2 + k * al / n, -al / 2 + (k + 1) * al / n
                for c in shell(fb, shape(k / n), shape((k + 1) / n), za, zc):
                    c["origin"][0] += x0
                    c["origin"][1] += fl
                    if "pivot" in c:
                        c["pivot"][0] += x0
                        c["pivot"][1] += fl
                    amas.append(c)
            # The aka: one strut a side, swept forward from the main hull's side to the float like a fighter's wing,
            # white and planked like the hulls, deep at its root and fining to its tip, faired down into the float.
            xi, xo = sx * (F - 0.5), x0 - sx * 0.2 * ar
            amas += swept_tube((xi, side + 0.8, 0.14 * L), (xo, side + 0.8, -0.1 * L), 0.07 * L, 0.2 * side, arch=0.9, drop=side + 0.8 - ah - fl)
            # The trampoline: an hourglass, broad along each hull and pinched between them, the aka sweeping across it.
            rope, cords = hourglass_net(sx * (F + 0.6), x0 - sx * 0.75 * ar, -0.3 * L, 0.28 * L, -0.24 * L, 0.18 * L, side - 0.2, 0.09 * L)
            akas += rope
            nets += cords
        bones.append({"name": "amas", "parent": "root", "pivot": [0, 0, 0], "cubes": amas})
        bones.append({"name": "akas", "parent": "root", "pivot": [0, 0, 0], "cubes": akas})
        bones.append({"name": "nets", "parent": "root", "pivot": [0, 0, 0], "cubes": nets})
    # Steering oar on the starboard quarter, reaching below the bottom.
    rx, rl, rb, tl = -(F + 2), d["rudder"], d["rudder_blade"], d["tiller"]
    bones.append({"name": "rudder", "parent": "root", "pivot": [rx, 0.45 * side, 14], "cubes": [
        cube([rx - 0.5, side + 1 - rl, 13.5], [1, rl, 1]), cube([rx - 0.25, side + 1 - rl, 13.5], [0.5, rb, 0.4 * rb]),
        cube([rx + 0.5, side + 1, 14 - tl * 0.6], [tl, 1, 1]), cube([rx + 0.5, side + 1, 14 - tl * 0.6], [1, 1, 0.55 * tl])]})
    # The sea chest, part of the boat: a dark, ender-style chest on deck just ahead of the helm.
    cw, ch, cd = 0.9 * F, 0.45 * side, 0.5 * F
    cz = HELM_Z - 17
    chest_uv = {f: {"uv": [0, 0], "uv_size": [16, 16]} for f in ("north", "south", "east", "west", "up", "down")}
    bones.append({"name": "sea_chest", "parent": "root", "pivot": [0, base, cz], "cubes": [
        {"origin": [-cw / 2, base, cz - cd / 2], "size": [cw, ch, cd], "uv": chest_uv},
        {"origin": [-cw / 2 - 0.25, base + ch, cz - cd / 2 - 0.25], "size": [cw + 0.5, 0.18 * side, cd + 0.5], "uv": chest_uv},
        {"origin": [-0.6, base + ch - 1.2, cz - cd / 2 - 0.5], "size": [1.2, 1.8, 0.5], "uv": chest_uv}]})
    # Sternpost rudder: a blade hung on the sternpost, with a tiller reaching in over the stern.
    bones.append({"name": "rudder_post", "parent": "root", "pivot": [0, 0.5 * side, END], "cubes": [
        cube([-0.75, 0.5, END], [1.5, 0.95 * side, 0.4 * side]),
        cube([-0.5, side + 0.5, END - 0.6 * side], [1, 1, 0.6 * side + 1])]})
    # A stern staff for the pennant on boats with no mast, crank furnace and cranks.
    bones.append({"name": "staff", "parent": "root", "pivot": [0, base, 20], "cubes": [cube([-0.5, base, 19.5], [1, 0.72 * H, 1])]})
    # The helm station (deep hulls): a raised deck aft under the helmsman's seat, a breastwork at its
    # forward edge, and the tradition's helm: a whipstaff (a lever standing through the deck) or a
    # tiller (a bar from the rudder head forward over the deck).
    kind, raise_ = HELM.get(b.get("_pid"), ("", 0))
    if raise_ > 0:
        ys = y_scale(b.get("scale", 1))
        top = round((seat_heights(b)[0] * 16 - root_lift(b)) / ys - 1, 2)
        w = round(0.8 * F, 2)
        z0, z1 = HELM_Z - 7, END - 3
        bones.append({"name": "helm_deck", "parent": "stern", "pivot": [0, top, HELM_Z], "cubes": [
            cube([-w, side - 2, z0], [2 * w, top - side + 2, z1 - z0]),
            cube([-w, top, z0 - 1], [2 * w, round(9 / ys, 2), 1])]})
        if kind == "whipstaff":
            bones.append({"name": "helm_whip", "parent": "helm_deck", "pivot": [0, top, HELM_Z - 5], "cubes": [
                cube([-0.5, top, HELM_Z - 5.5], [1, round(15 / ys, 2), 1])]})
        else:
            bones.append({"name": "helm_tiller", "parent": "helm_deck", "pivot": [0, top + 6 / ys, END - 4], "cubes": [
                cube([-0.5, round(top + 6 / ys, 2), HELM_Z - 4], [1, 1, END - HELM_Z])]})
    # The ship's boat a great ship carries (a skin: the boat itself is stored in her record): on chocks
    # on deck between the masts, or hoisted up across the stern. Drawn at a small boat's true size
    # (about 6 by 1.5 blocks), whatever the ship's scale.
    hs = b.get("scale", 1)
    if hs >= 4:
        ys = y_scale(hs)
        L, W, H = 6 * 16 / hs, 1.5 * 16 / hs, 0.6 * 16 / ys
        def small_hull(cx, cy, cz, along_z=True):
            l2, w2 = L / 2, W / 2
            if along_z:
                return [cube([cx - w2, cy, cz - l2 + 1], [W, 0.6, L - 2]),                  # bottom
                        cube([cx - w2, cy, cz - l2 + 1], [0.5, H, L - 2]), cube([cx + w2 - 0.5, cy, cz - l2 + 1], [0.5, H, L - 2]),
                        cube([cx - w2 / 2, cy + 0.3, cz - l2], [w2, H - 0.3, 1]), cube([cx - w2 / 2, cy + 0.3, cz + l2 - 1], [w2, H - 0.3, 1])]
            return [cube([cx - l2 + 1, cy, cz - w2], [L - 2, 0.6, W]),
                    cube([cx - l2 + 1, cy, cz - w2], [L - 2, H, 0.5]), cube([cx - l2 + 1, cy, cz + w2 - 0.5], [L - 2, H, 0.5]),
                    cube([cx - l2, cy + 0.3, cz - w2 / 2], [1, H - 0.3, w2]), cube([cx + l2 - 1, cy + 0.3, cz - w2 / 2], [1, H - 0.3, w2])]
        chock_y = base + 1                      # on chocks on the weather deck
        bones.append({"name": "deck_boat", "parent": "root", "pivot": [0, chock_y, 0], "cubes": small_hull(0, chock_y, 0) + [
            cube([-W / 2 - 0.5, chock_y - 1, -L / 4], [W + 1, 1, 0.6]), cube([-W / 2 - 0.5, chock_y - 1, L / 4], [W + 1, 1, 0.6])]})
        hang_y = side + b["wash"] - 5
        bones.append({"name": "deck_sboat", "parent": "stern", "pivot": [0, hang_y, END + 2 + W / 2], "cubes": small_hull(0, hang_y, END + 2 + W / 2, False) + [
            cube([-L / 2 + 1, hang_y + H, END + 2 + W / 2 - 0.25], [0.5, side + 4 - hang_y - H, 0.5]),
            cube([L / 2 - 1.5, hang_y + H, END + 2 + W / 2 - 0.25], [0.5, side + 4 - hang_y - H, 0.5]),
            cube([-L / 2 + 1, side + 3.5, END - 1], [0.6, 0.6, 3 + W / 2 + 0.5]), cube([L / 2 - 1.6, side + 3.5, END - 1], [0.6, 0.6, 3 + W / 2 + 0.5])]})
    full = {"uv": [0, 0], "uv_size": [128, 128]}
    fs = 0.4 * side * 2                       # half-block furnace on a standard hull
    bones.append({"name": "furnace", "parent": "root", "pivot": [0, base, FURNACE_Z], "cubes": [
        {"origin": [-fs / 2, base, FURNACE_Z - fs / 2], "size": [fs, fs, fs], "uv": {f: dict(full) for f in ("north", "south", "east", "west", "up", "down")}}]})
    # Cranks on the furnace's sides (they turn with it and share its true size), and the linkage:
    # a cross-bar from each crank out to the oar handles, and a rod along the handles that every oar
    # is pinned to, so one engine works them all in step.
    for sname, sx in (("l", 1), ("r", -1)):
        cx = (fs / 2 + 0.5) * sx
        bones.append({"name": f"crank_{sname}", "parent": "furnace", "pivot": [cx, base + fs / 2, FURNACE_Z], "cubes": [
            cube([cx - 0.5, base + fs / 2 - 0.5, FURNACE_Z - 0.5], [1, 1, 1]),
            cube([cx - 0.25 + 0.5 * sx, base + fs / 2 - 0.5, FURNACE_Z - 0.5], [0.5, fs / 2, 1])]})
    for sname, sx in (("l", 1), ("r", -1)):
        hx = ((F + 0.5) - inb) * sx                    # the oar handles' inboard ends
        y = side - 1.75                                # at the handles, a quarter pixel off the gunwale's underside (no flicker)
        x0 = d["crank_root_x"] * sx
        bones.append({"name": f"linkx_{sname}", "parent": "root", "pivot": [x0, y, FURNACE_Z], "cubes": [
            cube([min(x0, hx), y - 0.5, FURNACE_Z - 0.5], [abs(hx - x0) + 0.5, 1, 1])]})
        span = (MAX_OARS - 0.5) * SEG
        bones.append({"name": f"link_{sname}", "parent": "root", "pivot": [hx, y, FURNACE_Z], "cubes": [
            cube([hx - 0.5, y - 0.5, FURNACE_Z - span], [1, 1, span])]})
    return bones


def layer_bones(zone, pivot, keel, frame, plank):
    return [{"name": f"{zone}_{n}", "parent": zone, "pivot": pivot, "cubes": c}
            for n, c in (("keel", keel), ("frame", frame), ("plank", plank))]


def deck_bones(pid, b, mid, i, z0, F, side):
    """Hold, benches, canopy and navigation for one hull section, in this tradition's look."""
    zc = z0 + SEG / 2
    full = lambda o, s: {"origin": [round(v, 3) for v in o], "size": [round(v, 3) for v in s],
                         "uv": {f: {"uv": [0, 0], "uv_size": [16, 16]} for f in ("north", "south", "east", "west", "up", "down")}}
    out = []
    # Hold: a pair of barrels.
    bw = 0.55 * F
    out.append({"name": f"deck_hold_{i}", "parent": mid, "pivot": [0, 2, zc], "cubes": [
        full([-bw - 0.6, 2, zc - bw / 2], [bw, 0.55 * side, bw]), full([0.6, 2, zc - bw / 2], [bw, 0.55 * side, bw])]})
    # Benches: Norse rowers sat on their own sea chests along each side; elsewhere a stout thwart.
    if pid in NORSE:
        cw, ch = 0.32 * F, 0.38 * side
        bench = [cube([-F + 1.2, 2, zc - 2.5], [cw, ch, 5]), cube([F - 1.2 - cw, 2, zc - 2.5], [cw, ch, 5]),
                 cube([-F + 1.0, 2 + ch, zc - 2.7], [cw + 0.4, 0.8, 5.4]), cube([F - 1.4 - cw, 2 + ch, zc - 2.7], [cw + 0.4, 0.8, 5.4])]
    else:
        bench = [cube([-F + 1.5, 0.5 * side, zc - 1.5], [2 * F - 3, 1.6, 3]), cube([-0.75, 2, zc - 0.75], [1.5, 0.5 * side - 2, 1.5])]
    out.append({"name": f"deck_bench_{i}", "parent": mid, "pivot": [0, 2, zc], "cubes": bench})
    # Canopy: the tradition's own shelter over this station.
    shape = CANOPY.get(pid, ("arch", "wool"))[0]
    can = []
    R = F + 0.65                                 # its eaves just outside the gunwale, never on its face
    L = SEG - 2
    if shape in ("arch", "arch_low"):            # three pieces: two sides and the crown
        rise = (0.9 if shape == "arch" else 0.55) * R
        can += [cube([-R, side, z0 + 1], [1.5, rise * 0.7, L]), cube([R - 1.5, side, z0 + 1], [1.5, rise * 0.7, L]),
                cube([-R, side + rise * 0.7, z0 + 1], [2 * R, 1.5, L])]
    elif shape == "thatch":                      # two slopes, each in two steps
        for t in (0.25, 0.75):
            can.append(cube([-R + t * R - 1.5, side + 0.9 * R * t, z0 + 1], [R * 0.6, 1.5, L]))
            can.append(cube([R - t * R - R * 0.6 + 1.5, side + 0.9 * R * t, z0 + 1], [R * 0.6, 1.5, L]))
    else:                                        # tent: two cloth sides on a ridge pole
        for t in (0.3, 0.75):
            can.append(cube([-R * (1 - t) - 0.5, side + 0.8 * R * t - R * 0.2, z0 + 1], [1, R * 0.4, L]))
            can.append(cube([R * (1 - t) - 0.5, side + 0.8 * R * t - R * 0.2, z0 + 1], [1, R * 0.4, L]))
        can.append(cube([-0.5, side + 0.8 * R, z0], [1, 1, SEG]))
    skin = lambda cs: [dict(c, uv={f: {"uv": [0, 0], "uv_size": [16, 16]} for f in ("north", "south", "east", "west", "up", "down")}) for c in cs]
    out.append({"name": f"deck_canopy_{i}", "parent": mid, "pivot": [0, side, zc], "cubes": skin(can)})
    # Under way the canopy is furled: one roll lashed along the centre line.
    out.append({"name": f"deck_furled_{i}", "parent": mid, "pivot": [0, side, zc], "cubes": skin([
        cube([-1.25, side - 1, z0 + 1], [2.5, 2.5, L])])})
    # Navigation: a small brass binnacle.
    nb = 0.32 * F
    out.append({"name": f"deck_nav_{i}", "parent": mid, "pivot": [0, 2, zc], "cubes": [
        full([-nb / 2, 2, zc - nb / 2], [nb, 0.45 * side, nb]), full([-nb / 2 - 0.4, 2 + 0.45 * side, zc - nb / 2 - 0.4], [nb + 0.8, 0.8, nb + 0.8])]})
    # ---- module skins: every size from this hull's half-beam F and freeboard (side) ----
    t = max(1.0, 0.1 * F)                                       # a plank's thickness here
    # Bunk: a low cot along each side, a blanket roll at its head.
    out.append({"name": f"deck_bunk_{i}", "parent": mid, "pivot": [0, 2, zc], "cubes": [
        cube([-F + 1, 2, z0 + 2], [0.8 * F - 1, 0.3 * side, SEG - 4]), cube([0.2 * F, 2, z0 + 2], [0.8 * F - 1, 0.3 * side, SEG - 4]),
        cube([-F + 1, 2 + 0.3 * side, z0 + 2], [0.8 * F - 1, 0.25 * side, 3]), cube([0.2 * F, 2 + 0.3 * side, z0 + 2], [0.8 * F - 1, 0.25 * side, 3])]})
    # Castle: a raised fighting platform the width of the hull, on posts, with a crenellated rail.
    ph = side + 0.7 * side
    castle = [cube([-F - 0.5, ph, z0], [2 * F + 1, t, SEG])]
    for x in (-F, F - 2):
        for z in (z0, z0 + SEG - 2):
            castle.append(cube([x, 2, z], [2, ph - 2, 2]))
    for z in range(int(z0), int(z0 + SEG), 4):
        castle += [cube([-F - 0.5, ph + t, z], [t, 0.35 * side, 2]), cube([F + 0.5 - t, ph + t, z], [t, 0.35 * side, 2])]
    out.append({"name": f"deck_castle_{i}", "parent": mid, "pivot": [0, 2, zc], "cubes": castle})
    # Deckhouse: a cabin with a roof overhanging it, a door aft.
    dh = 0.9 * side
    out.append({"name": f"deck_house_{i}", "parent": mid, "pivot": [0, 2, zc], "cubes": [
        cube([-0.7 * F, side - 1, z0 + 1.5], [1.4 * F, dh, SEG - 3]),
        cube([-0.8 * F, side - 1 + dh, z0 + 0.5], [1.6 * F, t, SEG - 1])]})
    # Lookout: a tall post with a small railed platform near its top.
    lh = side + 2.2 * side
    lp = 0.45 * F
    out.append({"name": f"deck_lookout_{i}", "parent": mid, "pivot": [0, 2, zc], "cubes": [
        cube([-1, 2, zc - 1], [2, lh, 2]), cube([-lp, lh - 1, zc - lp], [2 * lp, t, 2 * lp]),
        cube([-lp, lh - 1 + t, zc - lp], [2 * lp, 0.25 * side, t]), cube([-lp, lh - 1 + t, zc + lp - t], [2 * lp, 0.25 * side, t])]})
    # Full deck: planking across the hull at the gunwale.
    out.append({"name": f"deck_full_{i}", "parent": mid, "pivot": [0, side, zc], "cubes": [cube([-F, side - 1.5, z0], [2 * F, t, SEG])]})
    # Bulkheads: a watertight board across the hull at each station's forward end.
    out.append({"name": f"deck_bulkhead_{i}", "parent": mid, "pivot": [0, 2, zc], "cubes": [cube([-F + 0.5, 1, z0], [2 * F - 1, side - 2, t])]})
    # Shield rail: a batten along each gunwale, outside, for the mounted shields' pegs.
    o = outer_of(b["section"], SCALE)
    out.append({"name": f"deck_rail_{i}", "parent": mid, "pivot": [0, side, zc], "cubes": [
        cube([F + o, side - 2, z0], [1, 1.5, SEG]), cube([-F - o - 1, side - 2, z0], [1, 1.5, SEG])]})
    # Sewn seams: rows of stitches along the planking, outside.
    stitches = []
    for z in range(int(z0) + 1, int(z0 + SEG), 3):
        for y in (0.35 * side, 0.7 * side):
            stitches += [cube([F + o, y, z], [0.5, 0.6, 0.6]), cube([-F - o - 0.5, y, z], [0.5, 0.6, 0.6])]
    out.append({"name": f"deck_stitch_{i}", "parent": mid, "pivot": [0, 2, zc], "cubes": stitches})
    # Light hull: lashings over the gunwale where the frames are tied rather than nailed.
    lash = []
    for z in range(int(z0) + 2, int(z0 + SEG), 4):
        lash += [cube([F - 0.5, side - 1.5, z], [o + 1, 2, 0.75]), cube([-F - o - 0.5, side - 1.5, z], [o + 1, 2, 0.75])]
    out.append({"name": f"deck_lash_{i}", "parent": mid, "pivot": [0, side, zc], "cubes": lash})
    # Crossbow mount: a swivel post at the rail each side with the bow across it (first station only).
    if i == 0:
        cb = []
        for sx in (1, -1):
            x = sx * (F - 1) - (1 if sx < 0 else 0)
            cb += [cube([x, side - 2, zc - 0.5], [1, 0.4 * side, 1]), cube([x - 0.5 * sx + (0 if sx > 0 else 0), side - 2 + 0.4 * side, zc - 3], [1.5, 1, 6]),
                   cube([x - 0.25, side - 2 + 0.4 * side + 0.25, zc - 4], [1.5, 0.5, 8])]
        out.append({"name": "deck_crossbow", "parent": mid, "pivot": [0, side, zc], "cubes": cb})
    # Cannon (copper): a barrel run out to each side on its carriage.
    out.append({"name": f"deck_cannon_{i}", "parent": mid, "pivot": [0, 2, zc], "cubes": [
        full([-F + 1, 2, zc - 2], [2 * F - 2, 0.35 * side, 4]),
        full([0.3 * F, 2 + 0.35 * side, zc - 1.2], [0.7 * F + 2, 2.4, 2.4]), full([-F - 2, 2 + 0.35 * side, zc - 1.2], [0.7 * F + 2, 2.4, 2.4])]})
    # Diving bell (copper): the bell hung from a davit over the side.
    bx = F - 1.3                                 # its post stands clear of the gunwale's inner face
    out.append({"name": f"deck_bell_{i}", "parent": mid, "pivot": [0, 2, zc], "cubes": [
        full([bx - 1, 2, zc - 1], [2, side + 0.9 * side, 2]), full([bx - 1, side + 0.9 * side, zc - 1], [6, 1.5, 2]),
        full([bx + 1.5, side * 0.6, zc - 2.5], [5, 4, 5]), full([bx + 2.5, side * 0.6 + 4, zc - 1.5], [3, 1, 3])]})
    return out


def hull_bones(b, simple):
    """The hull: yaw and root, seven mid sections and the two ends, each with keel, frame and plank
    layers. The building model has everything plus a cradle; the launched model is the shell alone."""
    global SIMPLE
    SIMPLE = simple
    F, side = b["F"], b["side"]
    st = b["section"]
    kw, FY, wl = th(st, "keel"), b["fy"], b["wl"]
    bones = [{"name": "yaw", "pivot": [0, 0, 0]}, {"name": "root", "parent": "yaw", "pivot": [0, 0, 0]}]
    zones = {"bow": [], "mid": [], "stern": []}
    for i in range(max_mids(b)):
        z0 = -(i + 1) * SEG
        name = f"mid_{i}"
        pivot = [0, wl, z0 + SEG / 2]          # the depth property scales her about the waterline: draught and freeboard together
        bones.append({"name": name, "parent": "root", "pivot": pivot})
        keel = [cube([-kw / 2, 0, z0], [kw, FY + th(st, "shell"), SEG])] if FY > 0 else []
        frame = []
        if not simple:
            spots = [z0 + SEG / 4, z0 + 3 * SEG / 4] if CON[st].get("half") else [z0 + SEG / 2]
            for zc in spots:
                frame += frames(b, F, FY, side, zc)
        plank = section(b, F, FY, side, z0, SEG) + deck_slabs(b, (F, FY, side), (F, FY, side), z0, z0 + SEG) \
            + ([] if simple else details(b, F, FY, side, z0, SEG, mid=True))
        bones += layer_bones(name, pivot, keel, frame, plank)
        zones["mid"] += [name, f"{name}_keel", f"{name}_frame", f"{name}_plank"]
        if not simple:
            # The building cradle: a chock under the keel down to the ground, gone at launch.
            bones.append({"name": f"{name}_cradle", "parent": name, "pivot": pivot, "cubes": [
                cube([-0.45 * F, -HULL_LIFT, z0 + SEG / 2 - 2], [0.9 * F, HULL_LIFT, 4]),
                cube([-0.45 * F, -1, z0 + SEG / 2 - 2], [1, 2.5, 4]), cube([0.45 * F - 1, -1, z0 + SEG / 2 - 2], [1, 2.5, 4])]})
            zones["mid"].append(f"{name}_cradle")
    bow_base = -max_mids(b) * SEG
    bones.append({"name": "bow", "parent": "root", "pivot": [0, wl, bow_base]})
    bones.append({"name": "stern", "parent": "root", "pivot": [0, wl, 0]})
    for zone, sign, base in (("bow", -1, bow_base), ("stern", 1, 0)):
        keel, frame, plank = end_section(b, sign, base)
        bones += layer_bones(zone, [0, wl, base], keel, frame, plank)
        zones[zone] += [zone, f"{zone}_keel", f"{zone}_frame", f"{zone}_plank"]
    if b.get("twin"):
        # Two hulls, centre to centre 0.3 of the length apart, with the craft centred between them, and a
        # platform deck joining them across the mid sections (the walking deck).
        D = multihull(b)["twin_gap"]
        moved = lambda c, dx: dict(c, origin=[round(c["origin"][0] + dx, 3), c["origin"][1], c["origin"][2]],
                                   **({"pivot": [round(c["pivot"][0] + dx, 3), c["pivot"][1], c["pivot"][2]]} if "pivot" in c else {}))
        for bone in bones:
            if bone["name"].endswith(("_plank", "_keel", "_frame", "_cradle")) and bone["name"].split("_")[0] in ("mid", "bow", "stern"):
                bone["cubes"] = [moved(c, -D / 2) for c in bone["cubes"]] + [moved(c, D / 2) for c in bone["cubes"]]
            if bone["name"].endswith("_plank") and bone["name"].startswith("mid_"):
                z0 = -(int(bone["name"].split("_")[1]) + 1) * SEG
                inner = D / 2 - F
                if b.get("bow") is PIERCE:              # the Theran pod: a small white hull riding between the two
                    pw = 0.22 * inner
                    bone["cubes"] += shell(dict(section="v", deck=True), (pw, 0.55 * side, side + 0.2 * side), (pw, 0.55 * side, side + 0.2 * side), z0, z0 + SEG)
                else:
                    bone["cubes"].append(cube([-inner, side - th(st, "shell") * 2, z0], [2 * inner, th(st, "shell") * 2, SEG]))
    SIMPLE = False
    return bones, zones


# Rams, by tradition: each one cast or carved onto the stem's foot at the waterline.
RAM_OF = {"theran": "theran", "league": "fin", "dhow": "fin", "baghlah": "fin", "sewn_boat": "fin",
          "junk": "beak", "fuchuan": "beak", "shuinsen": "beak", "sampan": "beak", "bezaisen": "beak", "wasen": "beak",
          "outrigger": "beak", "voyaging_canoe": "beak", "drua": "beak", "war_canoe": "beak"}


def ram_style(pid):
    if pid.startswith("theran"):
        return "theran"
    if pid.startswith("league"):
        return "fin"
    return RAM_OF.get(pid, "chisel")


def ram_cubes(pid, b):
    """The ram, from the foot of the stem out. chisel: a broad bronze wedge with a flat, level edge, for the Norse and
    the northern carvel ships. fin: the three-bladed ram of the inner sea, a flat fighting face with three level blades
    over a cowl round the stem (the League's galleys, the dhows). beak: a hooked beak, its point turned down (the
    junks and the Pacific hulls). theran: the Therans' gold one, a ram their ships stopped needing long ago and kept
    as an emblem: three nested chevrons round a faceted diamond spike, still sharp enough in a pinch."""
    s, F = b["side"], b["F"]
    end = b["bow"]
    hw, fy, sy = end_shape(b, end, 1.0)
    reach = stem_curve(end["stem"], s, hw, fy, sy)[0][0]       # how far the stem's foot stands out from the hull's tip
    z0 = -max_mids(b) * SEG - END - reach + 0.6                 # the ram's root, into the stem's foot
    y0 = max(fy + 0.18 * s, b["wl"])                            # at the waterline (the law's draught over the keel)
    full = {f: {"uv": [0, 0], "uv_size": [16, 16]} for f in ALL_FACES}
    box = lambda o, sz: {"origin": [round(v, 3) for v in o], "size": [round(v, 3) for v in sz], "uv": full}
    style, out = ram_style(pid), []
    if style == "chisel":
        L, n = 0.5 * s, 5
        for k in range(n):
            t = k / n
            w, h = 0.55 * F * (1 - 0.35 * t), 0.32 * s * (1 - 0.8 * t)
            out.append(box([-w / 2, y0 - h / 2, z0 - (k + 1) * L / n], [w, h, L / n + 0.1]))
        out.append(box([-0.6 * F / 2, y0 - 0.22 * s, z0 - 0.6], [0.6 * F, 0.44 * s, 1.2]))           # the collar
    elif style == "fin":
        L = 0.6 * s
        out.append(box([-0.22 * F, y0 - 0.2 * s, z0 - 0.45 * L], [0.44 * F, 0.4 * s, 0.45 * L + 0.6]))  # the cowl
        for dy in (-0.15, 0.0, 0.15):                                                                     # three blades
            w = 0.5 * F * (1 - 0.15 * abs(dy) / 0.15)
            out.append(box([-w / 2, y0 + dy * s - 0.03 * s, z0 - L], [w, 0.06 * s, 0.6 * L]))
        out.append(box([-0.48 * F / 2, y0 - 0.19 * s, z0 - L - 0.6], [0.48 * F, 0.38 * s, 0.8]))       # the fighting face
        out.append(box([-0.6, y0 - 0.15 * s, z0 - L], [1.2, 0.3 * s, 0.6 * L]))                         # the centre web
    elif style == "beak":
        n, L = 6, 0.55 * s
        for k in range(n):
            t = (k + 0.5) / n
            w, h = 0.36 * F * (1 - 0.7 * t), 0.22 * s * (1 - 0.6 * t)
            dy = -0.12 * s * t * t                                                                     # turning down
            out.append(box([-w / 2, y0 + dy - h / 2, z0 - (k + 1) * L / n], [w, h, L / n + 0.15]))
    else:                                                                                              # theran
        L = 0.7 * s
        for k in range(6):                       # the spike: a diamond in section (a square turned on its corner), tapering
            t = k / 6
            d = 0.3 * s * (1 - 0.85 * t)
            zc = z0 - (k + 0.5) * L / 6
            out.append({"origin": [round(-d / 2, 3), round(y0 - d / 2, 3), round(zc - L / 12 - 0.05, 3)], "size": [round(d, 3), round(d, 3), round(L / 6 + 0.1, 3)],
                        "pivot": [0, round(y0, 3), round(zc, 3)], "rotation": [0, 0, 45], "uv": full})
        for j, (w, lift, len_) in enumerate(((0.62, 0.0, 0.55), (0.46, 0.09, 0.42), (0.3, 0.17, 0.3))):  # three nested chevrons
            yc = y0 + (lift - 0.04) * s
            for sx in (-1, 1):
                plate = slab((sx * w * F / 2, yc - 0.05 * s, z0), (sx * w * F / 2, yc + 0.05 * s, z0),
                             (0, yc - 0.05 * s, z0 - len_ * L * 1.6), (0, yc + 0.05 * s, z0 - len_ * L * 1.6), 0.8, (0, yc, z0 + 99))
                for c in plate:
                    c["uv"] = full
                out += plate
            if j == 0:                            # and the same chevron below the spike, mirrored
                for sx in (-1, 1):
                    plate = slab((sx * w * F / 2, y0 - 0.14 * s, z0), (sx * w * F / 2, y0 - 0.06 * s, z0),
                                 (0, y0 - 0.14 * s, z0 - len_ * L * 1.6), (0, y0 - 0.06 * s, z0 - len_ * L * 1.6), 0.8, (0, y0, z0 + 99))
                    for c in plate:
                        c["uv"] = full
                    out += plate
    return out


# Hull modules sit on the hull itself (its sheer, its sides, its floor); the rest stand on the walked deck.
HULL_MODULES = ("deck_rail_", "deck_stitch_", "deck_lash_", "deck_full_", "deck_bulkhead_")


def deck_modules(pid, b, name, i, z0):
    """Deck modules at a station, in the tradition's look: drawn as on an open boat (over a floor at y 2, under a rail
    at its side), then carried up onto this hull's walked deck, the rail being the bulwark over it."""
    F, rail, wy = b["F"], b["side"] + b["wash"], deck_y(b)
    lift = wy - 2
    # sized by the bulwark over the deck, as they were by an open hull's side, but never smaller than for a
    # three-quarter-block bulwark (vision: a barrel or a bench stays a size a person uses on the law's low small boats)
    on_deck = deck_bones(pid, b, name, i, z0, F, max(rail - lift, 12 / b.get("scale", 1)))
    on_hull = {x["name"]: x for x in deck_bones(pid, b, name, i, z0, F, rail)}
    out = []
    for x in on_deck:
        if x["name"].startswith(HULL_MODULES):
            out.append(on_hull[x["name"]])
            continue
        moved = lambda c: dict(c, origin=[c["origin"][0], round(c["origin"][1] + lift, 3), c["origin"][2]],
                               **({"pivot": [c["pivot"][0], round(c["pivot"][1] + lift, 3), c["pivot"][2]]} if "pivot" in c else {}))
        out.append(dict(x, pivot=[x["pivot"][0], round(x["pivot"][1] + lift, 3), x["pivot"][2]], cubes=[moved(c) for c in x["cubes"]]))
    return out


def geometry(pid, b):
    use(b)
    F, side = b["F"], b["side"]
    o = outer_of(b["section"], SCALE)
    bones, zones = hull_bones(b, False)
    for i in range(max_mids(b)):
        z0 = -(i + 1) * SEG
        name, zc = f"mid_{i}", z0 + SEG / 2
        # Deck modules at this station, each in its tradition's look.
        bones += deck_modules(pid, b, name, i, z0)
        # Bone runners under the keel (ice runners).
        bones.append({"name": f"runner_{i}", "parent": name, "pivot": [0, 0, zc], "cubes": [
            cube([-0.55 * F, -1.5, z0], [1, 1.5, SEG]), cube([0.55 * F - 1, -1.5, z0], [1, 1.5, SEG])]})
    bones.append({"name": "ram", "parent": "bow", "pivot": [0, b["wl"], -max_mids(b) * SEG - END], "cubes": ram_cubes(pid, b)})
    bones += parts(b)
    launched, _ = hull_bones(b, True)
    geos = []
    for group in GROUPS:
        geos.append(geo_entry(geometry_id(pid, group), group_bones(bones, group)))
    geos.append(geo_entry(geometry_id(pid, "launched"), launched))
    for gdef in geos:
        finish(gdef["bones"])
        layer(gdef["bones"])
    return {"format_version": "1.12.0", "minecraft:geometry": geos}, zones


# Layers: pieces that meet on a shared face plane would flicker (z-fight), so each kind of piece
# stands a hair proud of the one beneath it, in a fixed order: frames, then planking (the middle
# strakes over the stems' where they overlap at a joint), then the keel, then anything fitted.
LAYERS = [(re.compile(r"^deck_|^runner_|^ram$"), 0.06), (re.compile(r"^(bow|stern)_keel$"), 0.0475),
          (re.compile(r"_keel$"), 0.04),
          (re.compile(r"^(pole|d?paddle|scull|staff|rudder|oar_|rig_|pennant|ama|crank|furnace)"), 0.03),
          (re.compile(r"^linkx_"), 0.035), (re.compile(r"^link_"), 0.025),
          (re.compile(r"^mid_\d+_plank$"), 0.02), (re.compile(r"_frame$"), 0.01)]


def layer(bones):
    for bone in bones:
        for pat, k in LAYERS:
            if pat.search(bone["name"]):
                # neighbouring sections overlap at their joint: alternate ones stand a hair prouder
                m = re.search(r"_(\d+)(?:_|$)", bone["name"])
                k += 0.005 * (int(m.group(1)) % 2) if m else 0
                for c in bone.get("cubes", []):
                    c["inflate"] = round(k, 3)
                break


def geo_entry(identifier, bones):
    return {"description": {"identifier": identifier, "texture_width": 128, "texture_height": 128,
                            "visible_bounds_width": 96, "visible_bounds_height": 16, "visible_bounds_offset": [0, 2, 0]},
            "bones": bones}


def finish(bones):
    """The pixel grid: every edge snapped outward to half a world pixel (so pieces only ever grow and
    joins stay closed), and textures mapped one texel to one world pixel on every face."""
    S = 0.5 / SCALE
    for bone in bones:
        for k in [k for k in bone if k.startswith("_")]:
            del bone[k]
        for c in bone.get("cubes", []):
            o, s = c["origin"], c["size"]
            if c.get("rotation"):
                c["origin"], c["size"] = [round(v, 4) for v in o], [round(max(0.05, v), 4) for v in s]
                if c.get("uv") == [0, 0]:
                    w, h, d = (min(128, max(1, round(v * SCALE, 3))) for v in c["size"])
                    c["uv"] = {"north": {"uv": [0, 0], "uv_size": [w, h]}, "south": {"uv": [0, 0], "uv_size": [w, h]},
                               "east": {"uv": [0, 0], "uv_size": [d, h]}, "west": {"uv": [0, 0], "uv_size": [d, h]},
                               "up": {"uv": [0, 0], "uv_size": [w, d]}, "down": {"uv": [0, 0], "uv_size": [w, d]}}
                continue
            lo = [math.floor(round(o[k] / S, 6)) * S for k in range(3)]
            hi = [math.ceil(round((o[k] + s[k]) / S, 6)) * S for k in range(3)]
            c["origin"] = [round(v, 4) for v in lo]
            c["size"] = [round(max(S, hi[k] - lo[k]), 4) for k in range(3)]
            if c.get("uv") == [0, 0]:
                w, h, d = (min(128, round(v * SCALE, 3)) for v in c["size"])
                c["uv"] = {"north": {"uv": [0, 0], "uv_size": [w, h]}, "south": {"uv": [0, 0], "uv_size": [w, h]},
                           "east": {"uv": [0, 0], "uv_size": [d, h]}, "west": {"uv": [0, 0], "uv_size": [d, h]},
                           "up": {"uv": [0, 0], "uv_size": [w, d]}, "down": {"uv": [0, 0], "uv_size": [w, d]}}


# ---------------------------------------------------------------- the render split
# Each render pass draws only its own small model instead of the whole boat. A part's group decides
# which model it lives in; parent parts it hangs from are copied in empty so it keeps its place.
GROUPS = ["hull", "fittings", "rig", "outfit", "deck_hold", "deck_wood", "deck_cloth", "deck_copper", "chest", "furnace"]


def part_group(name):
    # Deck modules are drawn in one pass per material, each pass with only its own parts.
    if name.startswith("deck_hold"):
        return "deck_hold"
    if name.startswith(("deck_canopy", "deck_furled")):
        return "deck_cloth"
    if name.startswith(("deck_nav", "deck_cannon", "deck_bell")):
        return "deck_copper"
    if name.startswith("deck_"):
        return "deck_wood"
    if name.startswith(("shield_", "runner_")) or name == "ram":
        return "outfit"
    if name.startswith("mast"):
        return "fittings"                            # wood, like the oars and rudder
    if name.startswith(("rig_", "tt_")) or name == "pennant":
        return "rig"
    if name in ("rudder", "rudder_post", "paddle", "dpaddle", "scull", "pole", "ama", "staff", "foils", "amas", "akas", "nets") or name.startswith(("oar_", "crank_", "link", "helm_")):
        return "fittings"
    if name == "sea_chest":
        return "chest"
    if name == "furnace":
        return "furnace"
    return "hull"


def group_bones(bones, group):
    by_name = {x["name"]: x for x in bones}
    keep = [x for x in bones if part_group(x["name"]) == group]
    needed = set()
    for x in keep:                                   # parents a part hangs from, so it keeps its place
        p = x.get("parent")
        while p and p not in needed:
            needed.add(p)
            p = by_name[p].get("parent")
    names = {x["name"] for x in keep}
    out = []
    for x in bones:                                  # original order, parents first
        if x["name"] in names:
            out.append(x)
        elif x["name"] in needed:
            out.append({k: v for k, v in x.items() if k != "cubes"})
    return out


geometry_id = lambda pid, group: f"geometry.{NS}.{pid}" if group == "hull" else f"geometry.{NS}.{pid}.{group}"


# ---------------------------------------------------------------- animation (one per boat)
def animation(pid, b):
    use(b)
    mids, rs = P("mids"), P("rig_scale")
    hs = str(b.get("scale", 1))          # each boat is drawn at its own constant scale
    beam, depth = P("beam"), P("depth")
    d = derived(b)
    # The rig grows from the mast foot: each rig part keeps its place by moving with its own pivot.
    piv = {x["name"]: x["pivot"] for x in parts(b)}
    foot = piv["mast"][1]
    lift = lambda n: f"({rs} - 1) * {round(piv[n][1] - foot, 3)}"
    f = mast_factors(b)
    style = P("rig_style")
    # this rig's mast height, as a share of the standard mast
    t = mast_thickness(b)
    tf = f"({style} == 2 ? {t['lateen']} : ({style} == 3 ? {t['crab_claw']} : ({style} == 4 ? {t['junk']} : ({style} == 5 ? {t['wing']} : {t['square']}))))"
    mf = f"({style} == 2 ? {f['lateen']} : ({style} == 3 ? {f['crab_claw']} : ({style} == 4 ? {f['junk']} : ({style} == 5 ? {f['wing']} : {f['square']}))))"
    # Each mast stands at its share of the hull's length from the centre (- forward), so the masts
    # spread apart as the hull grows.
    off = lambda k: "" if mast_plan(b)[k][0] == 0 else f" + {mast_plan(b)[k][0]} * ({mids} + 3) * {SEG}"
    slide = lambda n, k=0: f"-{mids} * 8 + ({rs} - 1) * {round(piv[n][2], 3)}{off(k)}"
    row_rate = lambda base: f"q.life_time * ({base} + 240 * v.row)"
    bones = {
        "yaw": {"rotation": [0, f"{P('yaw')} - q.body_y_rotation + ({P('orient')} >= 2 ? 180 : 0)", 0]},
        "root": {"rotation": [0, 0, "v.heel"],
                 # The helm (one model block in from the stern tip) sits over the entity's origin: the
                 # game turns a ridden boat about its origin, so the helmsman's seat never swings. Launched,
                 # her keel sits the law's draught under the water; in the yard, on her cradle.
                 "position": [0, f"{P('stage')} >= 5 ? {root_lift(b)} : {HULL_LIFT}", f"-8 * {hs}"],
                 "scale": [hs, hs, hs]},
        "bow": {"position": [0, 0, f"({max_mids(b)} - {mids}) * {SEG}"], "scale": [beam, depth, 1]},
        "stern": {"scale": [beam, depth, 1]},
        # The rig grows with the hull, from the foot of the mast (y 2).
        "mast": {"position": [0, 0, f"-{mids} * 8{off(0)}"], "scale": [f"math.sqrt({rs}) * {tf}", f"{rs} * {mf}", f"math.sqrt({rs}) * {tf}"]},
        # The outrigger float scales with the hull's length so it never outruns a short canoe.
        # The float stays centred on the hull and keeps its share of the hull's length.
        # The carried boat on deck: forward of the middle, between the masts.
        "ama": {"position": [0, 0, f"-{mids} * 8"], "scale": [1, 1, f"math.clamp(({mids} + 3) / {round(multihull(b)['L'] / 16, 3)}, 0.6, 1.4)"]},
        # Square: braced round to the wind, tilts as it fills, hauls up to the yard when furled.
        "rig_square": {"position": [0, lift("rig_square"), slide("rig_square")],
                       "rotation": ["-v.fill * 12", f"v.trim + ((v.fill < 0.15 && {P('sail_set')}) ? math.sin(q.life_time * 900) * 4 : 0)", 0],
                       "scale": [rs, f"{rs} * v.furl", rs]},
        # Lateen: the long yard swings across the mast; furled, the yard comes down and the cloth bundles along it.
        "rig_lateen": {"position": [0, lift("rig_lateen"), slide("rig_lateen")], "rotation": ["v.fill * 6", "v.ftrim", 0], "scale": [rs, f"{rs} * (0.2 + 0.8 * v.furl)", rs]},
        # Crab claw: pivots at its tack, bellies out as it fills, folds shut when furled.
        "rig_crab": {"position": [0, lift("rig_crab"), slide("rig_crab")], "rotation": [0, "v.ftrim * 0.8", "v.fill * 8"], "scale": [rs, rs, f"{rs} * (0.08 + 0.92 * v.furl)"]},
        # Wing: turns on its mast to its angle of attack; furled, it telescopes down into itself.
        "rig_wing": {"position": [0, lift("rig_wing"), slide("rig_wing")], "rotation": [0, "v.ftrim * 0.5", 0], "scale": [rs, f"{rs} * (0.3 + 0.7 * v.furl)", rs]},
        "foils": {"position": [0, 0, f"-{mids} * 8"]},
        "amas": {"position": [0, 0, f"-{mids} * 8"], "scale": [1, 1, f"math.clamp(({mids} + 3) / {round(typical_length(b) / 16, 3)}, 0.6, 1.4)"]},
        "akas": {"position": [0, 0, f"-{mids} * 8"], "scale": [1, 1, f"math.clamp(({mids} + 3) / {round(typical_length(b) / 16, 3)}, 0.6, 1.4)"]},
        "nets": {"position": [0, 0, f"-{mids} * 8"], "scale": [1, 1, f"math.clamp(({mids} + 3) / {round(typical_length(b) / 16, 3)}, 0.6, 1.4)"]},
        # Junk: battened panel swings on its mast and folds down onto the boom when furled.
        "rig_junk": {"position": [0, lift("rig_junk"), slide("rig_junk")], "rotation": [0, "v.ftrim", 0], "scale": [rs, f"{rs} * v.furl", rs]},
        **{f"tt_{r}_{s}": {"rotation": [
            # side a is to port: windward when the wind blows toward starboard (wind_rel > 0)
            f"(({P('wind_rel')} >= 0) == ({1 if s == 'a' else 0} == 1) ? -40 * math.max(0, -v.tt) : 60 * math.max(0, v.tt))"
            f" + math.sin(q.life_time * 1300 + {0 if s == 'a' else 90}) * 25 * math.min(1, math.abs(v.tt) * 1.5)",
            f"math.sin(q.life_time * 900 + {45 if s == 'a' else 0}) * (4 + 20 * math.abs(v.tt))", 0]}
           for r in ("rig_square", "rig_lateen", "rig_crab", "rig_junk", "rig_wing") for s in ("a", "b")},
        "pennant": {
            "position": [0, f"{P('sail')} ? ({rs} * {mf} - 1) * {round(piv['pennant'][1] - foot, 3)} : {round(piv['staff'][1] + 0.72 * d['mast'] - piv['pennant'][1], 3)}", f"{P('sail')} ? -{mids} * 8{off(0)} : 20"],
            "rotation": [f"(1 - math.min({P('wind_str')}, 1)) * 70",
                         f"{P('wind_rel')} + math.sin(q.life_time * (300 + 500 * {P('wind_str')})) * (2 + 6 * math.min({P('wind_str')}, 1))", 0]},
        "rudder": {"rotation": [0, f"-1 * {P('rudder')}", 0]},
        "rudder_post": {"rotation": [0, f"{P('rudder')}", 0]},
        "crank_l": {"rotation": ["v.p_crank", 0, 0]},
        "crank_r": {"rotation": ["v.p_crank", 0, 0]},
        # Each side strokes on its own (v.l port, v.r starboard, -1 astern to 1 ahead), on smooth
        # running phases so changes in effort or turning speed the stroke up rather than jump it.
        "paddle": {"rotation": ["v.r * math.sin(v.p_pad) * 30 - (1 - v.a) * 60", 0, "(1 - v.a) * 70"]},
        "dpaddle": {"rotation": [0, "v.a * math.sin(v.p_dp) * 18 + v.turn * 10",
                                 "math.sin(v.p_dp) * (math.sin(v.p_dp) > 0 ? math.abs(v.l) : math.abs(v.r)) * 28"]},
        "scull": {"rotation": ["20 + v.a * math.sin(v.p_scull * 2) * 6", "v.a * math.sin(v.p_scull) * 26 - v.turn * 25",
                               "v.a * math.cos(v.p_scull) * 20"]},
        "pole": {"position": [0, "v.a * math.sin(v.p_pole) * 6", 0],
                 "rotation": ["v.a * (math.sin(v.p_pole) * 16 + 12) - (1 - v.a) * 70", 0, "v.turn * 12"]},
    }
    if b.get("scale", 1) >= 4:
        # The carried boat on deck: forward of the middle, between the masts.
        bones["deck_boat"] = {"position": [0, 0, f"-{mids} * 8 - 0.17 * ({mids} + 3) * {SEG}"]}
    # Further masts move and furl just like the first, from their own place along the hull.
    for k in range(1, len(mast_plan(b))):
        bones[f"mast_{k}"] = dict(bones["mast"], position=[0, 0, f"-{mids} * 8{off(k)}"])
        for r in RIG_BONES.values():
            bones[f"{r}_{k}"] = dict(bones[r], position=[0, lift(f"{r}_{k}"), slide(f"{r}_{k}", k)])
    for i in range(MAX_OARS):
        for sname, sx, side in (("r", -1, "v.r"), ("l", 1, "v.l")):
            stow = f"(1 - math.min(1, math.abs({side}) * 3))"
            bones[f"oar_{i}_{sname}"] = {"rotation": [
                # under power every oar is pinned to the one rod: all in step with the crank
                0, f"{sx} * ({stow} * 80 - {side} * math.sin(v.po + {i * 25} * (1 - v.pw)) * {round(d['oar_amp'], 1)})",
                f"{sx} * math.min(1, math.abs({side}) * 3) * (math.cos(v.po + {i * 25} * (1 - v.pw)) > 0 ? {round(0.45 * d['oar_amp'], 1)} : -{round(0.2 * d['oar_amp'], 1)})"]}
    # The linkage: the rod runs the length of the oars that are out, and slides with the stroke.
    travel = round(d["oar_inboard"] * math.sin(math.radians(d["oar_amp"])), 3)
    ts = true_size(b)
    pairs = f"math.min({P('oar_pairs')}, {mids})"
    for s in ("l", "r"):
        lx = ts[f"link_{s}"]
        bones[f"link_{s}"] = {"position": [0, 0, f"math.sin(v.po) * {travel} * v.a"],
                              "scale": [lx[0], lx[1], f"math.max(0.05, ({pairs} - 0.5) / {MAX_OARS - 0.5})"]}
        bones[f"linkx_{s}"] = {"position": [0, 0, f"math.sin(v.po) * {travel} * v.a"], "scale": ts[f"linkx_{s}"]}
    # True size for the parts a person handles and the vanilla blocks.
    for name, sc in ts.items():
        if name.startswith("link"):
            continue
        bones.setdefault(name, {})["scale"] = sc
    for i in range(max_mids(b)):
        cond = f"{mids} > {i}"
        bones[f"mid_{i}"] = {"scale": [f"{cond} ? {beam} : 0", f"{cond} ? {depth} : 0", f"{cond} ? 1 : 0"]}
    # Split into groups that only run when relevant (the rig with a sail, oars when rowing with oars...).
    groups = {"hull": {}, "rig": {}, "oars": {}, "paddles": {}, "cranks": {}}
    for name, anim in bones.items():
        if name.startswith(("mast", "rig_", "tt_")):
            groups["rig"][name] = anim
        elif name.startswith("oar_"):
            groups["oars"][name] = anim
        elif name in ("paddle", "dpaddle", "scull", "pole"):
            groups["paddles"][name] = anim
        elif name.startswith(("crank_", "link")):
            groups["cranks"][name] = anim
        else:
            groups["hull"][name] = anim                 # yaw, root, hull sections, rudders, pennant, float
    return {"format_version": "1.8.0", "animations": {
        f"animation.{NS}.{pid}.{k}": {"loop": True, "bones": v} for k, v in groups.items() if v}}


# ---------------------------------------------------------------- render controllers (one set per boat)
def controllers(pid, zones):
    stage = P("stage")
    woods = [f"Texture.hull_{k}" for k in MATERIAL_KEYS]
    b = BOATS[pid]
    sails = [f"Texture.sail_{c}" for c in WOOL_KEYS]
    if pid.startswith("theran_"):               # the Therans' own: their marble-white hulls veined in gold, white wings
        woods, sails = ["Texture.hull_theran"] * len(MATERIAL_KEYS), ["Texture.sail_theran"] * len(WOOL_KEYS)
    rigged = f"{P('sail')} && {stage} >= 4"
    style = P("rig_style")
    prop = P("prop_style")
    rc = {}
    for zone, prop_name in (("bow", "wood_bow"), ("mid", "wood_mid"), ("stern", "wood_stern")):
        vis = [{"*": False}, {"yaw": True}, {"root": True}]
        for bn in zones[zone]:
            layer = bn.rsplit("_", 1)[-1]
            vis.append({bn: {"keel": f"{stage} >= 1", "frame": f"{stage} >= 2", "plank": f"{stage} >= 3",
                             "cradle": f"{stage} >= 1 && {stage} < 5"}.get(layer, True)})
        rc[f"controller.render.{NS}.{pid}.{zone}"] = {
            # The building model in the yard; the simple launched model once she's afloat.
            "arrays": {"textures": {"Array.woods": woods}, "geometries": {"Array.hulls": ["Geometry.default", "Geometry.launched"]}},
            "geometry": f"Array.hulls[{stage} >= 5 ? 1 : 0]",
            "materials": [{"*": "Material.default"}], "textures": [f"Array.woods[{P(prop_name)}]"], "part_visibility": vis}
    # Paddles, sculling oars and poles steer the boat themselves; the steering oar goes with long oars.
    fittings = [{"*": False}, {"yaw": True}, {"root": True}] + \
               [{n: rigged} for n in ["mast"] + [f"mast_{k}" for k in range(1, len(mast_plan(b)))]] + [
                {"rudder": f"{stage} >= 4 && {prop} == 0 && {P('rudder_type')} == 0"},
                {"rudder_post": f"{stage} >= 4 && {P('rudder_type')} == 1"},
                *([] if b.get("twin") else [{"ama": f"{stage} >= 3 && {P('outrigger')}"}]), {"staff": f"{stage} >= 5 && !{P('sail')}"},
                *([{"foils": f"{stage} >= 4"}] if b.get("foils") else []), *([{"amas": f"{stage} >= 3"}] if b.get("tri") else []),
                *([{"akas": f"{stage} >= 3"}, {"nets": f"{stage} >= 4"}] if b.get("tri") or (b.get("twin") and b.get("bow") is PIERCE) else []),
                {"paddle": f"{stage} >= 5 && {prop} == 1"}, {"dpaddle": f"{stage} >= 5 && {prop} == 2"},
                {"scull": f"{stage} >= 5 && {prop} == 3"}, {"pole": f"{stage} >= 5 && {prop} == 4"},
                {"crank_l": f"{stage} >= 5 && {P('furnace')}"}, {"crank_r": f"{stage} >= 5 && {P('furnace')}"}] + [
                {n: f"{stage} >= 5 && {P('furnace')} && {prop} == 0"} for n in ("linkx_l", "linkx_r", "link_l", "link_r")] + [
                {n: f"{stage} >= 4"} for n in ("helm_deck", "helm_whip", "helm_tiller") if any(x["name"] == n for x in parts(b))]
    # At rest only the first pair shows, shipped along the hull; every pair strokes while rowing.
    fittings += [{f"oar_{i}_{s}": f"{stage} >= 5 && {prop} == 0 && {P('oar_pairs')} > {i} && {P('mids')} > {i}"
                  + ("" if i == 0 else f" && {P('rowing')} > 0")}
                 for i in range(MAX_OARS) for s in ("r", "l")]
    rc[f"controller.render.{NS}.{pid}.fittings"] = {
        "arrays": {"textures": {"Array.woods": woods}}, "geometry": "Geometry.fittings",
        "materials": [{"*": "Material.default"}], "textures": [f"Array.woods[{P('wood_mid')}]"], "part_visibility": fittings}
    rc[f"controller.render.{NS}.{pid}.sail"] = {
        "arrays": {"textures": {"Array.sails": sails}}, "geometry": "Geometry.rig",
        "materials": [{"*": "Material.default"}], "textures": [f"Array.sails[{P('sail_color')}]"],
        "part_visibility": [{"*": False}, {"yaw": True}, {"root": True}, {"pennant": f"{stage} >= 5"},
                            {"rig_square": f"{rigged} && {style} == 1"}, {"rig_lateen": f"{rigged} && {style} == 2"},
                            {"rig_crab": f"{rigged} && {style} == 3"}, {"rig_junk": f"{rigged} && {style} == 4"}, {"rig_wing": f"{rigged} && {style} == 5"}]
                           + [{f"{r}_{k}": f"{rigged} && {style} == {i}"} for k in range(1, len(mast_plan(b)))
                              for i, r in ((1, "rig_square"), (2, "rig_lateen"), (3, "rig_crab"), (4, "rig_junk"), (5, "rig_wing"))]
                           + [{f"tt_{r}_{s}": f"{rigged} && {style} == {i} && {stage} >= 5 && {P('sail_fill')} > 0"}
                              for i, r in ((1, "rig_square"), (2, "rig_lateen"), (3, "rig_crab"), (4, "rig_junk"), (5, "rig_wing")) for s in ("a", "b")]}
    mods_vis = lambda names, key: [{"*": False}, {"yaw": True}, {"root": True}] + \
        [{z: True} for z in zones["mid"] if z.count("_") == 1] + [{"bow": True}] + \
        [{n: f"{stage} >= 5 && {mod_on(key)}"} for n in names]
    rc[f"controller.render.{NS}.{pid}.ram"] = {
        "geometry": "Geometry.outfit", "materials": [{"*": "Material.default"}], "textures": ["Texture.copper"],
        # D-005: a ram only where it was used: the League's and the Therans' ships carry theirs; any other shows one
        # only when the ram fitting is fitted
        "part_visibility": (mods_vis([], "ram") + [{"ram": f"{stage} >= 5"}]) if pid.startswith(("theran", "league")) else mods_vis(["ram"], "ram")}
    mids_vis = [{"*": False}, {"yaw": True}, {"root": True}] + [{z: True} for z in zones["mid"] if z.count("_") == 1]
    deck_vis = lambda part, key: mids_vis + [{f"deck_{part}_{i}": f"{stage} >= 5 && {deck_at(i, key)}"} for i in range(max_mids(b))]
    rc[f"controller.render.{NS}.{pid}.deck_hold"] = {
        "geometry": "Geometry.deck_hold", "materials": [{"*": "Material.default"}], "textures": ["Texture.barrel"],
        "part_visibility": deck_vis("hold", "hold")}
    rc[f"controller.render.{NS}.{pid}.deck_bench"] = {
        "arrays": {"textures": {"Array.woods": woods}}, "geometry": "Geometry.deck_wood",
        "materials": [{"*": "Material.default"}], "textures": [f"Array.woods[{P('wood_mid')}]"],
        # Every wooden module skin, in the hull's own midships wood: deck modules at their stations,
        # hull and rail modules on every visible section.
        "part_visibility": deck_vis("bench", "benches")
        + [{f"deck_{part}_{i}": f"{stage} >= 5 && {deck_at(i, key)}"} for i in range(max_mids(b))
           for part, key in (("bunk", "bunk"), ("castle", "castle"), ("house", "deckhouse"), ("lookout", "lookout"))]
        + [{f"deck_{part}_{i}": f"{stage} >= 5 && {mod_on(key)}"} for i in range(max_mids(b))
           for part, key in (("full", "full_deck"), ("bulkhead", "bulkheads"), ("rail", "shield_rail"), ("stitch", "sewn_hull"), ("lash", "light_hull"))]
        + [{"deck_crossbow": f"{stage} >= 5 && {mod_on('crossbow')}"}]
        + ([{"deck_boat": f"{stage} >= 5 && {mod_on('boat_deck')}"}, {"deck_sboat": f"{stage} >= 5 && {mod_on('boat_stern')}"}] if b.get("scale", 1) >= 4 else [])}
    rc[f"controller.render.{NS}.{pid}.deck_canopy"] = {
        "geometry": "Geometry.deck_cloth", "materials": [{"*": "Material.default"}], "textures": ["Texture.canopy"],
        "part_visibility": mids_vis
        + [{f"deck_canopy_{i}": f"{stage} >= 5 && {deck_at(i, 'canopy')} && {P('moored')}"} for i in range(max_mids(b))]
        + [{f"deck_furled_{i}": f"{stage} >= 5 && {deck_at(i, 'canopy')} && !{P('moored')}"} for i in range(max_mids(b))]}
    rc[f"controller.render.{NS}.{pid}.deck_nav"] = {
        "geometry": "Geometry.deck_copper", "materials": [{"*": "Material.default"}], "textures": ["Texture.copper"],
        "part_visibility": deck_vis("nav", "navigation")
        + [{f"deck_{part}_{i}": f"{stage} >= 5 && {deck_at(i, key)}"} for i in range(max_mids(b)) for part, key in (("cannon", "cannon"), ("bell", "diving_bell"))]}
    rc[f"controller.render.{NS}.{pid}.chest"] = {
        "geometry": "Geometry.chest", "materials": [{"*": "Material.default"}], "textures": ["Texture.sea_chest"],
        "part_visibility": [{"*": False}, {"yaw": True}, {"root": True}, {"sea_chest": f"{stage} >= 5"}]}
    rc[f"controller.render.{NS}.{pid}.furnace"] = {
        "arrays": {"textures": {"Array.power": ["Texture.furnace_off", "Texture.furnace_on", "Texture.smoker_off",
                                                 "Texture.smoker_on", "Texture.blast_off", "Texture.blast_on"]}},
        "geometry": "Geometry.furnace", "materials": [{"*": "Material.default"}],
        "textures": [f"Array.power[math.max(0, {P('power_type')} - 1) * 2 + ({P('furnace_lit')} ? 1 : 0)]"],
        "part_visibility": [{"*": False}, {"yaw": True}, {"root": True}, {"furnace": f"{stage} >= 5 && {P('furnace')}"}]}
    return {"format_version": "1.8.0", "render_controllers": rc}


def client_entity(pid, rc_names, b):
    tex = {f"hull_{k}": f"textures/entity/{NS}/hull_{k}" for k in MATERIAL_KEYS}
    tex.update({f"sail_{c}": f"textures/entity/{NS}/sail_{c}" for c in WOOL_KEYS})
    tex["sea_chest"] = f"textures/entity/{NS}/sea_chest_ender"
    if pid.startswith("theran_"):
        tex["hull_theran"], tex["sail_theran"] = f"textures/entity/{NS}/hull_theran", f"textures/entity/{NS}/sail_theran"
    can_tex = CANOPY.get(pid, ("arch", "wool"))[1]
    tex["canopy"] = {"hull_bamboo": f"textures/entity/{NS}/hull_bamboo", "hay": "textures/blocks/hay_block_side",
                     "wool": "textures/blocks/wool_colored_white"}[can_tex]
    tex.update({"shields": f"textures/entity/{NS}/shields",
                "copper": "textures/blocks/gold_block" if pid.startswith("theran") else "textures/blocks/copper_block",
                "barrel": "textures/blocks/barrel_side", "bone": "textures/blocks/bone_block_side"})
    tex.update({"furnace_off": "textures/blocks/furnace_front_off", "furnace_on": "textures/blocks/furnace_front_on",
                "smoker_off": "textures/blocks/smoker_front_off", "smoker_on": "textures/blocks/smoker_front_on",
                "blast_off": "textures/blocks/blast_furnace_front_off", "blast_on": "textures/blocks/blast_furnace_front_on"})
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": f"{NS}:{pid}", "materials": {"default": "entity_alphatest"}, "textures": tex,
        "geometry": {**{("default" if grp == "hull" else grp): geometry_id(pid, grp) for grp in GROUPS},
                     "launched": geometry_id(pid, "launched")},
        "animations": {k: f"animation.{NS}.{pid}.{k}" for k in ("hull", "rig", "oars", "paddles", "cranks")},
        "scripts": {"pre_animation": [
            f"v.furl = math.lerp(v.furl ?? 1.0, {P('sail_set')} ? 1.0 : 0.12, 0.08);",
            f"v.fill = math.lerp(v.fill ?? 0.0, {P('sail_fill')}, 0.1);",
            # square sails brace across; fore-and-aft sails swing out to leeward, further the freer the wind
            f"v.trim = math.lerp(v.trim ?? 0.0, math.clamp({P('wind_rel')} * 0.5, -55, 55), 0.08);",
            # A fore-and-aft sail's free end points aft of its mast, so it turns against the wind's
            # side to swing out to leeward (the pennant, pointing forward, turns with it).
            f"v.ftrim = math.lerp(v.ftrim ?? 0.0, ({P('wind_rel')} >= 0 ? -1 : 1) * math.clamp((180 - math.abs({P('wind_rel')})) * 0.45, 8, 80), 0.08);",
            f"v.tt = math.lerp(v.tt ?? 0.0, {P('telltale')}, 0.1);",
            f"v.heel = math.lerp(v.heel ?? 0.0, {P('heel')}, 0.1);",
            f"v.row = math.lerp(v.row ?? 0.0, {P('rowing')}, 0.15);",
            f"v.l = math.lerp(v.l ?? 0.0, {P('stroke_l')}, 0.12);",
            f"v.r = math.lerp(v.r ?? 0.0, {P('stroke_r')}, 0.12);",
            f"v.turn = math.lerp(v.turn ?? 0.0, {P('turn')}, 0.12);",
            "v.a = math.max(math.abs(v.l), math.abs(v.r));",
            # running phases (degrees), advanced by frame time: speeding up never makes a stroke jump
            f"v.p_oar = math.mod((v.p_oar ?? 0) + q.delta_time * ({round(derived(b)['oar_rate'])} + 240 * v.row), 360);",
            "v.p_pad = math.mod((v.p_pad ?? 0) + q.delta_time * (300 + 240 * v.row), 360);",
            "v.p_dp = math.mod((v.p_dp ?? 0) + q.delta_time * (260 + 240 * v.row), 360);",
            "v.p_scull = math.mod((v.p_scull ?? 0) + q.delta_time * (200 + 200 * v.row), 360);",
            "v.p_pole = math.mod((v.p_pole ?? 0) + q.delta_time * (120 + 120 * v.row), 360);",
            "v.p_crank = math.mod((v.p_crank ?? 0) + q.delta_time * 320 * v.row, 360);",
            f"v.pw = {P('furnace_lit')} ? 1 : 0;",
            "v.po = v.pw > 0 ? v.p_crank : v.p_oar;"],
            # only animate what's there: the rig with a sail, oars or paddles by propulsion, cranks with power
            "animate": ["hull", {"rig": f"{P('sail')}"}, {"oars": f"{P('prop_style')} == 0"},
                        {"paddles": f"{P('prop_style')} > 0"}, {"cranks": f"{P('furnace')}"}]},
        "render_controllers": rc_names}}}


def sail_areas(b):
    """Each rig's cloth area at rig scale 1, in square blocks, summed over every mast (as each was cut)."""
    bones = parts(b)
    return {style: round(sum(x.get("_area", 0) for x in bones if x["name"] == name or re.fullmatch(rf"{name}_\d+", x["name"])) / b.get("scale", 1) ** 2, 3)
            for style, name in RIG_BONES.items()}


RIG_BONES = {"square": "rig_square", "lateen": "rig_lateen", "crab_claw": "rig_crab", "junk": "rig_junk", "wing": "rig_wing"}
RIG_INDEX = {"square": 1, "lateen": 2, "crab_claw": 3, "junk": 4, "wing": 5}


TELLTALE_UV = [120, 120]   # a corner of every sail texture painted in the telltale's colour


def telltale_bones(rig_name, points):
    """Two yarn strips on a rig, one each side of the cloth, streaming aft from where they're sewn."""
    out = []
    for side, (x, y, z) in zip(("a", "b"), points):
        out.append({"name": f"tt_{rig_name}_{side}", "parent": rig_name, "pivot": [x, y, z],
                    "cubes": [{"origin": [x - 0.1, y - 0.1, z], "size": [0.2, 0.2, 3.5], "uv": TELLTALE_UV}]})
    return out


def mast_factors(b):
    """For each rig, the mast height that reaches just above its sail's top, as a share of its own mast."""
    bones = {x["name"]: x for x in parts(b)}
    foot, H = bones["mast"]["pivot"][1], bones["mast"]["cubes"][0]["size"][1]   # the whole mast, from its step on the keel
    out = {}
    for style, name in RIG_BONES.items():
        out[style] = round((bones[name]["_mast_top"] - foot) / H, 3)
    return out


def mast_thickness(b):
    """For each rig, its mast's thickness as a share of the mast as built."""
    bones = {x["name"]: x for x in parts(b)}
    t = bones["mast"]["cubes"][0]["size"][0]
    return {style: round(bones[name]["_mast_t"] / t, 3) for style, name in RIG_BONES.items()}


def mast_heights(b):
    """Each rig's mast over the rail at rig scale 1 (model px): what heels her (handling.js rigFor)."""
    bones = {x["name"]: x for x in parts(b)}
    return {style: bones[name]["_mast_top"] - (b["side"] + b["wash"]) for style, name in RIG_BONES.items()}


def proportions():
    """What the scripts need to know about each hull, derived from the same inputs as the models."""
    out = {}
    for pid, b in BOATS.items():
        use(b)
        d = derived(b)
        out[pid] = {
            "beam": round(2 * (b["F"] + outer_of(b["section"], b.get("scale", 1))) / 16, 4),   # blocks, outside the planking
            "depth": round(b["side"] / 16, 4),                             # blocks at model scale 1: keel's foot to the sheer (the law's depth)
            "draft": round(b["wl"] / 16, 4),                               # blocks at model scale 1: the law's draught
            "wash": round(b["wash"] / 16, 4),                              # blocks at model scale 1: the washstrake over the sheer
            "deck": b["_deck"]["kind"],                                    # open, half, full, or biti (the Norse deck at the waterline)
            "sheds": bool(b.get("deck")),                                  # decked over to the sheer (the kayak): the sea runs off her, no freeboard asked
            "decks": b["_deck"]["n"],                                      # the law's decks: floor((D - 1) / 2)
            "wall": b["_wall"],                                            # world px: the wall law's w(L)
            "mast": round(d["mast"] / 16, 3),
            "masts": {k: round(v / 16 * y_scale(b.get("scale", 1)) / b.get("scale", 1), 3) for k, v in mast_heights(b).items()},
            "scale": b.get("scale", 1),
            "mast_count": len(mast_plan(b)),
            "seats": seat_bands(b),
            "rail": round(rail_y(b), 3),
            "helm": HELM.get(pid, ("oar" if rail_y(b) < 1.6 else "tiller", 0))[0],
            "mast_at": [m[0] for m in mast_plan(b)],                       # share of the hull's length from the centre, - forward
            "oar": round(d["oar_len"] / 16, 3),
            "sail": sail_areas(b),
            # multihull layout in blocks at model scale 1 (scripts multiply by the model scale)
            "twin_gap": round(multihull(b)["twin_gap"] / 16, 4),
            # the Theran pod between the hulls (the bridge deck's nacelle, gen hull()): a half width you can sit and walk on
            "pod_half": round(0.22 * (multihull(b)["twin_gap"] / 2 - b["F"]) / 16, 4) if b.get("twin") and b.get("bow") is PIERCE else 0,
            "float_out": round(multihull(b)["float_out"] / 16, 4),
            "float_len": round(multihull(b)["float_len"] / 16, 4),
            "typical_len": round(multihull(b)["L"] / 16, 4),
        }
    return out


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


for _pid, _b in BOATS.items():
    _b["_pid"] = _pid


def main():
    for stale in ("animations/boat.animation.json", "render_controllers/boat.render_controllers.json"):
        (RP / stale).unlink(missing_ok=True)
    for pid, b in BOATS.items():
        geo, zones = geometry(pid, b)
        write(RP / f"models/entity/{pid}.geo.json", geo)
        write(RP / f"animations/{pid}.animation.json", animation(pid, b))
        rc = controllers(pid, zones)
        write(RP / f"render_controllers/{pid}.render_controllers.json", rc)
        write(RP / f"entity/{pid}.entity.json", client_entity(pid, list(rc["render_controllers"].keys()), b))
    js = ("// Generated by tools/gen_boats.py from the same inputs as the boat models. Do not edit.\n"
          "// beam, depth, mast, oar: blocks at model scale 1. sail: each rig's area at rig scale 1, square blocks.\n"
          f"export const PROPORTIONS = {json.dumps(proportions(), indent=2)};\n")
    (ROOT / "BP/scripts/config/proportions.js").write_text(js)
    print(f"Built {len(BOATS)} boats, each with its own hull, parts kit, animation and render controllers")


if __name__ == "__main__":
    main()
