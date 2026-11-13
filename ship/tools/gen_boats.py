"""Builds every boat its own way: a hull builder per tradition, a kit of culture-made parts
placed at that hull's sockets, and a separate animation and set of render controllers per boat.

    python3 tools/gen_boats.py      (run by gen_assets.py)

Frame (pixels, 16 per block): the stern spans z 0..24 with its tip at 24, mid-sections run from
z 0 toward -z (16 each, up to 7), and the bow sits beyond them; animation slides the bow to the
last visible mid-section and shifts the whole hull so the helm (z 8) sits over the entity's pivot.
"""
import json
import math
import os
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
# The Therans' hulls are drawn in the line of the America's Cup AC72 (Richard, S003: "the hull to look like the
# Americas Cup AC72's in the theran theme. I know its not temporally accurate"): a long, slender round-bilged hull
# (AC_ROUND, a full U that rolls smoothly into a crowned deck), a long fine entry to a near-plumb knife stem with the
# deck level all the way to it, and a broad open transom with the bottom rocking up to it.
AC_BOW = dict(taper="ac_bow", rise=0.02, floor=0.22, stem="ac_plumb")
AC_STERN = dict(taper="ac_stern", rise=0, floor=0.34, stem="transom")
# The catamaran's bow in the line of Motor Yacht A (Starck; Richard, S003: "i want the hulls to look like this more for
# the medium"): the deck runs straight and level to a high knife point far forward, and the stem falls back from it in
# one long straight line to the waterline, so the whole forefoot overhangs; full at the deck, fine at the water.
YACHT_BOW = dict(taper="yacht", rise=0.06, floor=0.82, stem="knife")
# The Exokoitos (the skiff; Richard, S003: a firefly or flying fish, "a thick x-bow like 'head' that tapers to a
# cockpit"): an X-bow head, full and high, its stem falling back from a low forward foot over a rounded brow; and a
# firefly's tail, the body narrowing and its bottom lifting aft to where the tail boom springs.
XBOW = dict(taper="xbow", rise=0.18, floor=0.06, stem="xhead")
FLY_TAIL = dict(taper="fly_tail", rise=0, floor=0.45, stem="raked_short")
AC_ROUND = 2.2     # vision: a little fuller than a carved log (2.0): with the crown (X/phi) the AC72's upright oval section
is_theran = lambda b: any(b.get("bow") is x for x in (AC_BOW, PIERCE, YACHT_BOW, XBOW))   # the Theran build (their pod, rudders, nets)
BOATS["theran_skiff"] = dict(section="v", F=7.5, side=9.5, oar=1.8, aspect=0.9, glider=True, keel=False, wings="zip", hull="arrow", tail="stealth", sail="clam", bow=XBOW, stern=FLY_TAIL, round=AC_ROUND, crown=True)

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
                twin_gap=b.get("gap", 0.3 * L) if b.get("twin") else 0, L=L)


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
IN_END = False     # building a bow or stern (the launched ends are planked a strake lighter)
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
    n, X = b.get("round", ROUND[b["section"]]), hw + outer_of(b["section"], SCALE)   # a hull's own curve, else its tradition's
    # a twin draws two hulls: each a strake lighter; launched, the short curved ends a strake lighter again (the lens's
    # near budget, chief.md section 6: there the curve, not the strake count, is what reads)
    N = (STRAKES_LAUNCHED - (1 if b.get("twin") else 0) - (1 if IN_END else 0)) if SIMPLE else STRAKES
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
    if b.get("glider"):                   # the Exokoitos has no planking: her frame and skin are her hull (glider_parts)
        return []
    st, out = b["section"], []
    sh, gun = max(0.2, th(st, "shell")), max(0.2, th(st, "gunwale"))     # true thickness in the world at any scale
    t = t or sh
    A, C = profile(b, *a), profile(b, *c)
    N = len(A) - 1
    inside_y = max(a[2], c[2]) + 2
    band = b.get("sealed") and (0 if b.get("deck") else b.get("wash", 0)) <= 0 and N > 1   # a Theran top strake drawn as two (below)
    for sx in (-1, 1):
        for k in range(N - 1 if band else N):
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
        sealed = b.get("sealed")
        if band:                          # a Theran hull: the fresco-blue band, the top of her top strake under the gold sheer
            k = N - 1                     # (therans.md section 6): the top strake drawn as two, its upper 1/phi^2 blue
            f = lambda P, Q: (P[0] + (Q[0] - P[0]) / PHI, P[1] + (Q[1] - P[1]) / PHI)
            ma, mc = f(A[k], A[k + 1]), f(C[k], C[k + 1])
            out += slab((sx * A[k][0], A[k][1], za), (sx * ma[0], ma[1], za), (sx * C[k][0], C[k][1], zc), (sx * mc[0], mc[1], zc), t, (0, inside_y, (za + zc) / 2))
            out += theran_uv(slab((sx * ma[0], ma[1], za), (sx * pa[0], pa[1], za), (sx * mc[0], mc[1], zc), (sx * pc[0], pc[1], zc), t, (0, inside_y, (za + zc) / 2)), "blue")
        if wash > 0:                      # the washstrake: a strake over the sheer where the freeboard falls short of the reach's need
            ws = slab((sx * pa[0], pa[1], za), (sx * pa[0], pa[1] + wash, za), (sx * pc[0], pc[1], zc), (sx * pc[0], pc[1] + wash, zc),
                      gun if SIMPLE else th(st, "wash"), (0, (pa[1] + pc[1]) / 2 + wash / 2, (za + zc) / 2))
            out += theran_uv(ws, "blue") if sealed else ws   # a Theran's washstrake is her blue band
            if SIMPLE and not sealed:     # launched, one slab: the washstrake as thick as the gunwale that caps it
                continue
        if sealed:                        # the Theran sheer strake: gold, 2t tall, standing t proud of the shell (therans.md section 3)
            tw = WALL / SCALE
            hi_a, hi_c = pa[1] + wash, pc[1] + wash
            out += theran_uv(slab((sx * (pa[0] + tw), hi_a - 2 * tw, za), (sx * (pa[0] + tw), hi_a, za), (sx * (pc[0] + tw), hi_c - 2 * tw, zc),
                                  (sx * (pc[0] + tw), hi_c, zc), gun + tw, (0, (hi_a + hi_c) / 2 - tw, (za + zc) / 2)), "gold")
            continue
        # the gunwale capping the sheer (or the washstrake), on both models: the edge the eye sees against the sky
        out += slab((sx * (pa[0] - gun), pa[1] + wash, za), (sx * pa[0], pa[1] + wash, za), (sx * (pc[0] - gun), pc[1] + wash, zc), (sx * pc[0], pc[1] + wash, zc),
                    gun, (0, -9999, (za + zc) / 2))
    # the floor (sole) across between the strakes, its underside on the water (D-004: under the waterline the game draws
    # the sea inside a hull, so whatever is walked lies on or over it); a hull with no waterline (a float) a quarter of
    # the way up its bilge. A decked hull's deck is her floor.
    if (not (b.get("deck") or b.get("sealed")) or cockpit) and b.get("_deck", {}).get("kind", "open") == "open":
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
    if b.get("crown") and not cockpit:    # the AC72's crowned deck: the shell carries on past the sheer, rolling in over the top in a
        X_a, X_c = A[-1][0], C[-1][0]     # quarter ellipse to the centre line, rising X/phi (the hull a closed oval tube, as theirs are)
        M = 4                             # vision: four facets read as a smooth crown at any of the three scales
        arc = lambda X, y, k: (X * math.cos(k / M * math.pi / 2), y + X / PHI * math.sin(k / M * math.pi / 2))
        w_ = b.get("wash", 0)                 # over any washstrake still drawn
        for sx in (-1, 1):
            for k in range(M):
                a0, a1 = arc(X_a, A[-1][1] + w_, k), arc(X_a, A[-1][1] + w_, k + 1)
                c0, c1 = arc(X_c, C[-1][1] + w_, k), arc(X_c, C[-1][1] + w_, k + 1)
                out += slab((sx * a0[0], a0[1], za), (sx * a1[0], a1[1], za), (sx * c0[0], c0[1], zc), (sx * c1[0], c1[1], zc),
                            t, (0, -9999, (za + zc) / 2))
        return out
    if b.get("sealed") and not cockpit:   # a Theran hull decked whole at her rail (therans.md section 3: sealed cells), its
        wash = b.get("wash", 0)           # edges in against the sheer strake's inner face
        wa, wc = A[-1][0] - gun - 0.05, C[-1][0] - gun - 0.05
        if min(wa, wc) > 0.3:
            out += slab((-wa, A[-1][1] + wash, za), (wa, A[-1][1] + wash, za), (-wc, C[-1][1] + wash, zc), (wc, C[-1][1] + wash, zc),
                        th(st, "deck"), (0, -9999, (za + zc) / 2))
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
    if not dk or dk["kind"] == "open" or (SIMPLE and b.get("sealed")):   # launched, a sealed hull's inside is never seen
        return []
    sh, t = th(b["section"], "shell"), dk["t"]
    A, C = profile(b, *a), profile(b, *c)
    tops = [dk["top"]] + ([] if ends or dk["kind"] != "full" else dk["lower"])
    out = []
    for top in tops:
        if top > min(a[2], c[2]):                       # above the sheer here: the deck stops short of this end
            continue
        wa, wc = inner_half(A, top - t, sh), inner_half(C, top - t, sh)
        if wa is None or wc is None or 2 * min(wa, wc) * SCALE < 16:   # vision: no deck where the hull is under a block across (nobody walks it; the stem's plates close it)
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
    "theran_ship": medium("v", 9, 0.85, oar=1.8, aspect=0.9, twin=True, bow=YACHT_BOW, stern=AC_STERN, round=AC_ROUND, crown=True, foils=True,
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
    "theran_flagship": large("v", 10, 0.75, oar=1.8, aspect=0.9, tri=True, bow=AC_BOW, stern=AC_STERN, round=AC_ROUND, crown=True, foils=True,
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
        # the half-beam outside the planking: the law's beam (sizeOf exact B = L / lb, one hull's on a twin). The hand-set
        # beams v0.9.14 drew strayed up to a third from it (narrow sewn boat and trimaran, broad punt and dugout), and at
        # true depth a beam that strays takes GM with it (the lens: the trimaran capsized, the sewn boat stood on 0.05)
        # the Pacific twins keep v0.9.14's hulls (already within the lens's half-step of the law) until step 3 settles
        # whether the fleet's beam is one hull's or both (eastasian_pacific.md); the Theran catamaran's hulls, drawn a
        # third narrower, take the law's
        legacy = b.get("twin") and not pid.startswith("theran_")
        beam_out = b["F"] + outer_of(st, s, legacy=True) if legacy else 16 * lw["B"] / 2 / s
        if b.get("twin") and pid.startswith("theran_"):
            # the Theran catamaran's hulls are each as big as they need be (Richard, S003: "make the hulls the necessary
            # size, keep the dimensions"): the two together displace what the law's one hull of beam B would, at the
            # same length and depth, so each is B/2 wide; her overall breadth is kept, so each hull's centre moves out by
            # B/4 (the gap opens by B/2): slimmer hulls, farther apart, the AC72's stance
            beam_out = 16 * lw["B"] / 4 / s
            b["gap"] = 0.3 * typical_length(b) + 16 * lw["B"] / 2 / s
        K = K_BOAT.get(pid, K_SECTION[st])
        SCALE, WALL = s, snap_w(max(CON[st]["shell"], 16 * lw["L"] / K if K else 0))
        b["_law"], b["_wall"] = lw, WALL
        b["F"] = snap(beam_out - outer_of(st, s))         # the same beam outside a thicker wall
        b["fy"] = snap(th(st, "keel")) if (CON[st]["keel"] and b.get("keel", True)) else 0   # the keel, moulded as sided
        b["side"] = snap(16 * lw["depth"] / s)            # keel's foot to the sheer: the law's depth
        # an AC72 crowned hull (shell()) keeps her sheer on the law's depth: the crown, X/phi over it, is her reserve of
        # freeboard (an ocean ship's need, 1.44 blocks), not her depth (englab measures depth to the sheer)
        b["wl"] = snap(16 * lw["draft"] / s)              # the waterline over the keel's foot: the law's draught
        b["wash"] = snap(16 * lw["wash"] / s)             # a washstrake over the sheer, where the freeboard falls short
        if b.get("crown"):                                # an AC72 crowned hull's crown (X/phi) is that reserve: only what it
            b["wash"] = snap(max(0, b["wash"] - (b["F"] + outer_of(st, s)) / PHI))   # leaves short is a washstrake
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
    elif taper == "xbow":                         # the X-bow head: full almost to the tip (a brow, not a point), the deck
        hw = F * (1 - 0.55 * t ** 2.2)            # rising a little into it
        return hw, b["fy"] + end["floor"] * side * t ** 2, side + end["rise"] * side * math.sin(t * math.pi / 2)
    elif taper == "fly_tail":                     # the firefly's tail: narrowing, the bottom lifting, the deck falling
        hw = max(0.8, F * (1 - t ** 1.4))
        return hw, b["fy"] + end["floor"] * side * t ** 1.5, side - 0.2 * side * t ** 2
    elif taper == "yacht":                        # Yacht A: the bottom rising in one straight line to the deck's knife point
        hw = max(0.5, F * (1 - t ** 1.3))         # (floor 0.82 of the side at the tip), the deck full until late, the sheer
        return hw, b["fy"] + end["floor"] * side * t, side + end["rise"] * side * t   # lifting a little toward it
    elif taper == "ac_bow":                       # the AC72's entry: fine and long, narrowing almost straight to a knife,
        hw = max(0.5, F * (1 - t ** 0.85))        # the deck level to the stem, the forefoot lifting a little
        return hw, b["fy"] + end["floor"] * side * t ** 2, side + end["rise"] * side * t
    elif taper == "ac_stern":                     # the AC72's run: broad to a wide open transom, the bottom rocking up
        hw = F * (1 - 0.22 * t ** 2)
        return hw, b["fy"] + end["floor"] * side * t ** 1.6, side
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
    if kind == "xhead":                         # the X-bow's stem: its foot furthest out, low; falling back as it rises
        return line(8, lambda t: (0.3 * s * (1 - t) ** 0.6, fy + (h + 0.18 * s) * t))
    if kind == "knife":                         # Yacht A's tip: the short knife edge left between the risen floor and the deck
        return line(2, lambda t: (0.06 * s * t, fy + (h + 0.02 * s) * t))
    if kind == "ac_plumb":                      # the AC72's stem: near plumb, its foot a touch forward of its head
        return line(3, lambda t: (0.05 * s * (1 - t), fy + (h + 0.02 * s) * t))
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
    if b.get("glider"):                   # the Exokoitos's nose and tail are her frame's (glider_parts)
        return []
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
    if SIMPLE:                                              # launched, every other station of the timber (every third on a long curled
        k = 3 if len(curve) > 12 else 2                     # stem): the same line, a half or a third of the pieces
        curve = curve[::k] + ([curve[-1]] if (len(curve) - 1) % k else [])
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
    global IN_END
    IN_END = True
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
        well = b.get("well")              # a Theran cockpit well (the foiler's): open between its ends
        cockpit = (b.get("deck") and sign > 0 and z0 < 14) or bool(well and well[0] <= z0 and z0 + seg <= well[1])
        plank += shell(b, a, c, za, zc, cockpit=cockpit) + deck_slabs(b, a, c, za, zc, ends=True)
        if not SIMPLE:
            plank += details(b, hw, fy, sy, z0, seg)
            if j in (slices // 4, slices // 2 + 1):
                frame += frames(b, hw, fy, sy, z0 + seg / 2)
    tip = base + sign * END
    plank += stem(b, end, sign, tip, *shape(1.0))
    IN_END = False
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
# Two solid patches in the free bottom-right corner of the Theran hull sheet (gen_assets.py paints them): fresco blue
# and gold, for the pieces drawn in the Therans' colours rather than their marble (the blue band, gold sheer, glass)
THERAN_PATCH = {"gold": (112, 120, 8, 8), "blue": (120, 120, 8, 8)}
theran_uv = lambda cubes, tone: [dict(c, uv=uv_all(THERAN_PATCH[tone])) for c in cubes]


def cloth(kind, axis, a0, a1, y0, y1, belly, n=6, at=0.0):
    """A sail's cloth: n panels from a0 to a1 along its axis ("z" fore and aft, "x" across), each set off by the belly
    at its middle, each face showing its own slice of this cloth's region of the sheet, so the cut shape reads whole.
    The game shows a face's texture as seen from outside it, with file x mirrored: so of a fore-and-aft cloth the east
    face reads aft-to-fore and the west fore-to-aft, and of a square sail the north face follows file x."""
    out, r = [], SC.REGION[kind]
    # Each panel is a chord of the belly's curve, from its point at k/n to its point at (k+1)/n, turned about the
    # vertical to lie along it: neighbouring cloths meet at the seam (one cloth, not panels stepped apart, which left
    # every sail but its outermost cloths hanging in the air off its yard), lapping on a little as cloths are sewn.
    bel = lambda u: belly * (1 - (2 * u - 1) ** 2)
    for k in range(n):
        u0, u1 = k / n, min(1.0, (k + 1.12) / n)          # the slice of the sheet it shows: each laps the next a little
        c0, c1 = a0 + (a1 - a0) * k / n, a0 + (a1 - a0) * (k + 1) / n
        e0, e1 = bel(k / n), bel((k + 1) / n)
        dl, de = c1 - c0, e1 - e0
        ln = math.hypot(dl, de) or 1
        run = ln * (u1 - u0) * n + 0.02                   # the chord, lapped on as far as its slice of the sheet runs
        uv = {f: dict(CLEAR_FACE) for f in ALL_FACES}
        if axis == "z":                                   # cloth thin in x: local z along the chord (de in x, dl in z)
            d = [de / ln, 0.0, dl / ln]
            nrm = [d[2], 0.0, -d[0]]                     # y x d
            R = [[nrm[i], [0, 1, 0][i], d[i]] for i in range(3)]
            o = [at + e0 - 0.25 * nrm[0], y0, c0 - 0.25 * nrm[2]]
            sz = [0.5, y1 - y0, run]
            uv["west"], uv["east"] = face_uv(r, u0, u1), face_uv(r, u0, u1, mirror=True)
        else:                                             # cloth thin in z: local x along the chord (dl in x, de in z)
            d = [dl / ln, 0.0, de / ln]
            nrm = [-d[2], 0.0, d[0]]                     # d x y
            R = [[d[i], [0, 1, 0][i], nrm[i]] for i in range(3)]
            o = [c0 - 0.25 * nrm[0], y0, at + e0 - 0.25 * nrm[2]]
            sz = [run, y1 - y0, 0.5]
            uv["north"], uv["south"] = face_uv(r, u0, u1), face_uv(r, u0, u1, mirror=True)
        c = {"origin": [round(v, 3) for v in o], "size": [round(v, 3) for v in sz], "uv": uv}
        rot = euler_file(R)
        if any(abs(v) > 1e-3 for v in rot):
            c.update(pivot=list(c["origin"]), rotation=rot)
        out.append(c)
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
    # it hangs to port of its mast, its spars lying against the mast's side (a fixed offset in model px stood them a
    # quarter block clear of a ship's thinner mast, the whole sail in the air)
    cx = round((zx(MAST_OF["crab_claw"][1] * a) + spar_t) / 2 - 0.05, 3)
    _, (az, ay), (fz, fy_) = SC.crab_points()
    crab = cloth("crab_claw", "z", apex[1] + zx(z0 * S), apex[1] + zx(z1 * S), apex[0] + yy(y0 * S), apex[0] + yy(y1 * S),
                 zx(BELLY * S * 0.5), n=8, at=cx)
    for tz_, ty_ in ((az, ay), (fz, fy_)):
        crab += [dict(c, origin=[c["origin"][0] + cx, *c["origin"][1:]], **({"pivot": [c["pivot"][0] + cx, *c["pivot"][1:]]} if "pivot" in c else {}))
                 for c in spar((apex[0], apex[1]), (apex[0] + yy(ty_ * S), apex[1] + zx(tz_ * S)), spar_t)]
    bones.append({"name": "rig_crab", "parent": "root", "pivot": [cx, apex[0], apex[1]], "cubes": crab, "_area": A,
                  "_mast_top": apex[0] + yy(0.56 * S), "_mast_t": zx(MAST_OF["crab_claw"][1] * a),
                  "_tt": (cx + 0.4, apex[0] + yy(0.45 * fy_ * S), apex[1] + zx(0.45 * fz * S) + 1.5)})

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
        bones += telltale_bones(x["name"], [(px_, py_, pz_), (-px_ if x["name"] != "rig_crab" else 2 * x["pivot"][0] - px_, py_, pz_)])
    # The wind pennant flies from the masthead.
    ptop = base + H
    bones.append({"name": "pennant", "parent": "root", "pivot": [0, ptop, 0], "cubes": [
        cube([-0.25, ptop - 3, -6], [0.5, 3, 6]), cube([-0.25, ptop - 2.5, -10], [0.5, 2, 4])]})
    return bones


def mast_foot(b):
    """Where a mast is stepped (model px): on the keel, the floor's top; on the platform where twin hulls carry it."""
    if b.get("twin") and not any(len(m) > 2 and m[2] for m in mast_plan(b)):   # a twin's centreline masts: through her
        return b["side"] + iako_of(b)[1] - 0.1                                    # platform, stepped on the iako under it
    return b["fy"] + th(b["section"], "shell")          # on a keel (a twin's masts stood on her hulls: on that hull's)


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
    # Foils (the Theran skiff): one foiling keel, a strut under the middle carrying the main T-wing, and the lift aft
    # comes from the rudder (below), itself a T-foil: at speed she lifts onto the two and flies, as a modern foiling
    # monohull does with one centre foil and a T-rudder.
    if b.get("foils"):
        span, depth_ = 2.6 * F, 1.2 * side
        # each hull's foil (a twin's under both, a trimaran's under her main hull): the strut down to the apex of an
        # obtuse inverted V (Richard, S003: "kinda like an upside down V but obtuse"), its two arms sweeping down and
        # out at the golden angle (tan 1/phi^2, about 21 degrees: an included angle near 138)
        xs = [-multihull(b)["twin_gap"] / 2, multihull(b)["twin_gap"] / 2] if b.get("twin") else [0]
        cubes_ = []
        for x0 in xs:
            cubes_ += [cube([x0 - 0.6, 1 - depth_, -4], [1.2, depth_, 5])] + lambda_foil(x0, 1 - depth_, -6, 8, span, 0.8)
        bones.append({"name": "foils", "parent": "root", "pivot": [0, 0, 0], "cubes": cubes_})
    if b.get("glider"):
        bones += glider_parts(b)
    # The Theran trimaran: two slim wave-piercing floats (true hulls, rounded and decked), each carried on a single
    # forward-swept gold aka, and an hourglass trampoline of diamond mesh between each float and the main hull.
    if b.get("twin") and is_theran(b):
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
    if b.get("glider"):
        g = glider_frame(b)
        # The Exokoitos steers with her tail fin: hung at the end of the boom, back and down, deepest of all in the water
        # (deeper than the tailplane's tips), standing over the boom as her vertical stabiliser when she flies. It turns.
        # one fin on the centre line, hung from the middle of the tailplane like a T (Richard: "one in the middle like a
        # T off the horizontal stabiliser"): deepest of all in the water as her rudder, standing over the tailplane as
        # her fin; it turns
        # a T, not a t (Richard): the blade hangs only below the tailplane, down to the keel foil's depth, a fine chord
        # (cf/phi), with an inverted-V foil at its foot level with the keel's, so the two fly together
        zf, ye, cr_ = END + g["Lb"], g["ye"], g["cf"] / PHI
        yfoil = 1 - side
        bones.append({"name": "rudder", "parent": "root", "pivot": [0, ye, zf], "cubes": [] if b.get("tail") == "stealth" else theran_uv(
            slab((0, yfoil, zf - cr_ / 2), (0, ye, zf - cr_ / 2), (0, yfoil, zf + cr_ / 2), (0, ye, zf + cr_ / 2), 0.7, (99, 0, zf)), "gold")})   # the stealth tail steers with its fins (glider_parts)   # just the rudder, her fin (Richard: "fuck the foil on the rudder")
    elif b.get("foils"):
        # A foiler steers with a T-rudder hung on the centre of her transom: the blade reaches as deep as the main
        # foil (depth 0.8 of the strut's, so it flies a little higher, trimming her bow up), a small T-wing at its
        # foot (a third of the main span) lifts the stern, and a tiller reaches in over the transom. It turns as one.
        span, depth_ = 2.6 * F, 1.2 * side
        rz, dr = END - 1, 0.8 * depth_
        bones.append({"name": "rudder", "parent": "root", "pivot": [0, 0.45 * side, rz], "cubes": [
            cube([-0.4, 1 - dr, rz - 1.5], [0.8, side + dr, 3]), *lambda_foil(0, 1 - dr, rz - 2, 4, span / 3, 0.6),
            cube([-0.5, side + 1, rz - tl], [1, 1, tl])]})
    else:
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
    if b.get("twin"):
        # A twin steers and flies her staff from her hulls, never from the water between them (eastasian_pacific.md:
        # the sweep over the starboard hull's stern; therans.md: a rudder on each transom): each is carried out to the
        # starboard hull (- x), the Theran's rudder drawn again on the port hull as a bone of its own, turning with it.
        D = multihull(b)["twin_gap"]
        for x in bones[-3:] + [x for x in bones if x["name"] == "rudder"]:
            if x["name"] in ("rudder", "rudder_post", "staff"):
                x["pivot"] = [round(x["pivot"][0] - D / 2, 3), *x["pivot"][1:]]
                x["cubes"] = [dict(c, origin=[round(c["origin"][0] - D / 2, 3), *c["origin"][1:]]) for c in x["cubes"]]
        if is_theran(b):
            post = next(x for x in bones if x["name"] == "rudder_post")
            bones.append({"name": "rudder_post_p", "parent": "root", "pivot": [round(post["pivot"][0] + D, 3), *post["pivot"][1:]],
                          "cubes": [dict(c, origin=[round(c["origin"][0] + D, 3), *c["origin"][1:]]) for c in post["cubes"]]})
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
        well = b.get("well")
        plank = section(b, F, FY, side, z0, SEG, cockpit=bool(well and well[0] <= z0 and z0 + SEG <= well[1])) \
            + deck_slabs(b, (F, FY, side), (F, FY, side), z0, z0 + SEG) \
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
                if is_theran(b):              # the Theran pod: a small white hull riding between the two
                    pw = 0.22 * inner
                    bone["cubes"] += shell(dict(section="v", deck=True), (pw, 0.55 * side, side + 0.2 * side), (pw, 0.55 * side, side + 0.2 * side), z0, z0 + SEG)
        if not is_theran(b):
            pacific_joining(b, bones, D)
    SIMPLE = False
    return bones, zones


def iako_of(b):
    """The Pacific twins' crossbeams (iako): round(L/phi^2) + 1 of them (Hokule'a's eight on her 19 m), evenly spaced:
    k to each mid section and k in each end, so her typical length carries the count (eastasian_pacific.md L8). Each
    is square, phi^2 t (the shell's t), in model px. Returns (k, its side)."""
    L, s = b["_law"]["L"], b.get("scale", 1)
    mids = max(1, round(L / s - 3))                   # derived: the mid sections the game shows at her typical length
    N = round(L / PHI ** 2) + 1                       # given: Hokule'a's eight iako on 19 m (round(19/phi^2) + 1)
    return max(1, round(N / (mids + 2))), round(PHI ** 2 * b["_wall"] / s, 2)   # t: the launched wall (both models alike)


def pacific_joining(b, bones, D):
    """The Pacific twins joined as they were (eastasian_pacific.md section 3): the iako lie across both sheers, a lashing
    turn at each, overhanging each outer side by t; the slatted platform (pola) on them, from hull centre to hull
    centre over the mid sections, the masts stepped through it on the centre line. Every piece rests on what carries
    it, so the craft is one body (the old platform hung between the gunwales and the masts stood through it)."""
    st, F = b["section"], b["F"]
    k, ik = iako_of(b)
    t, o = b["_wall"] / b.get("scale", 1), outer_of(st, SCALE)
    def beam_at(zc, hw, sy):
        X = D / 2 + hw + o + t
        return cube([-X, sy - 0.05, zc - ik / 2], [2 * X, ik, ik])
    bow_base = -max_mids(b) * SEG
    for bone in bones:
        n = bone["name"]
        if not n.endswith("_plank"):
            continue
        if n.startswith("mid_"):
            z0 = -(int(n.split("_")[1]) + 1) * SEG
            bone["cubes"] += [beam_at(z0 + SEG * (j + 0.5) / k, F, b["side"]) for j in range(k)]
            bone["cubes"].append(cube([-D / 2, b["side"] + ik - 0.1, z0], [D, th(st, "deck"), SEG]))   # the pola
        elif n in ("stern_plank", "bow_plank"):
            sign, end = (1, b["stern"]) if n == "stern_plank" else (-1, b["bow"])
            for j in range(k):
                dz = SEG * (j + 0.5) / k
                hw, _, sy = end_shape(b, end, dz / END)
                bone["cubes"].append(beam_at((0 if sign > 0 else bow_base) + sign * dz, hw, sy))


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


def glider_frame(b):
    """The Exokoitos's measures, model px, in the foils bone's frame (z 0 midships; she is bought at one length, so her
    typical one): her half length, the tail boom Lt/phi^3 long dropping back and down, the tailplane 2/3 of her length
    across (Richard: "the horizontal stabiliser being 2/3 the width of the body", read across her length so its tips
    reach the water), the fin's and tailplane's chord Lt/phi^5, the wing's span phi Lt."""
    F, side = b["F"], b["side"]
    Lt = typical_length(b)
    mids = max(1, round((Lt - 2 * END) / SEG))
    half = mids * 8 + END
    return dict(F=F, side=side, Lt=Lt, half=half, Lb=Lt / PHI ** 3, ye=0.35 * side, span=2 / 3 * Lt, cf=Lt / PHI ** 5,
                wspan=PHI * Lt, top=side + (F + outer_of(b["section"], SCALE)) / PHI)


# her wing fold (Richard: "imagine if the wing folded a second time, tip to the first fold point, away from the
# fuselage"; "remember the F4U with another fold; make it part of the hull when folded"): three pieces, the stub 1/phi^3
# of her half span, the middle and the outer 1/phi^2 each (1/phi^3 + 2/phi^2 = 1; the second fold is her kestrel knee).
# Fold one is the Corsair's: the middle swings up and over the hull until it leans in at 45 degrees, the two sides
# meeting over her centre line in a gable. Fold two: the outer folds back down outside the middle, its tip to fold one.
# Folded, the wings are a cloth roof over her; the stubs stay out, part of her flanks.
FOLD_MID = 180 - 45 - math.degrees(math.atan(1 / PHI ** 2))                           # derived: from the inner's rise to
                                                                                    # leaning in at 45 (vision)
FOLD_OUT = 180 - math.degrees(math.atan(1 / PHI ** 2) + math.atan(1 / PHI))           # derived: back along the middle


def fold_wings(b, g, H, wingpts):
    """Her wings, slim and swept, folding away as part of her hull (Richard, S003: "way slimmer ... a slight backsweep
    ... cool origami to stealthily give as much area ... longer when unfolded"; the counterfolds /\\/; "the wingtips
    gold for the folding effect and a little gap"; "the folded wings stand out a bit more, but as if part of the hull").
    Each wing keeps the folding wing's area (about 2,500 px^2 a side), its chord 1/phi of the hull band it folds onto
    at the root and 1/phi of that at the tip, so it runs long. Its root hinge sits on her flank just above her gold
    waterline, near her centre of gravity (just ahead of her keel's foil and at the front of her cockpits).
    Folding, as a carrier plane's "Sto-Wing" does with one skewed hinge (here a swing and a turn): the wing swings
    back along her flank and turns on edge, its chord standing up her side; then it counterfolds twice along its span,
    mountain then valley, so its three panels stack along her flank like a strake; the gold tip folds over last,
    outermost, stopping a little short so a band of wing shows. Open (fold 0): swept back atan 1/phi^3, rising at
    atan 1/phi^3 (the golden arch), the tip dropped at atan 1/phi. The model's rest pose is the wing straight out,
    level and unswept; the animation (shipwright:fold) sets the rest."""
    TMAX, zs, wid, bot, top, section, boot = H["TMAX"], H["zs"], H["wid"], H["bot"], H["top"], H["section"], H["boot"]
    LB, zt = H["LB"], H["zt"]
    gold = lambda cubes: [dict(c, uv=H["spar"]) for c in cubes]
    skin = lambda cubes: [dict(c, uv=H["skin_uv"]) for c in cubes]
    tr = H["t_root"]
    zr = zt(tr)
    y0 = boot(tr) + 0.5                                                   # just above her gold waterline
    sec = section(tr)
    iE = max(range(len(sec) // 2 + 1), key=lambda k: sec[k][0])
    xr = wid(tr) * sec[iE][0] + 1.5                                       # vision: standing a little proud of her flank
    band = max(4.0, (top(tr) - y0) * 0.9)                                 # the hull band it folds onto, keel-ish to coaming
    cr = band / PHI ** 0.5                                                # vision: the root chord, a little under the band
    ct = cr / PHI                                                         # the tip's, 1/phi of it
    AREA = 2500                                                           # derived: the folding wing's area a side, px^2
    S = 2 * AREA / (cr + ct)                                              # derived: the span that keeps it
    st = S / PHI ** 4                                                     # vision: the gold tip, 1/phi^4 of the span
    s1 = (S - st) / 3                                                     # three panels between the root and the tip
    chord = lambda x: cr + (ct - cr) * x / S
    T_ = 0.6                                                              # a panel's thickness
    GAP = 16 / PHI ** 4                                                   # the band of wing the gold tip leaves showing
    LAM, ARCH, DROP = (math.degrees(math.atan(1 / PHI ** 3)), math.degrees(math.atan(1 / PHI ** 3)), math.degrees(math.atan(1 / PHI)))
    sg = [float(v) for v in os.environ.get("WING_SIGNS", "1,1,1,1").split(",")]   # preview signs (yaw, roll, arch/fold)
    b["_wing"] = dict(LAM=LAM, ARCH=ARCH, DROP=DROP)
    out = []
    for side_, sx in (("l", 1), ("r", -1)):
        n = f"rig_glide_{side_}"
        R0 = (sx * xr, y0, zr)                                            # the root hinge, at the leading edge
        X = lambda x: R0[0] + sx * x                                      # a span station, outward
        def plate(xa, xb, gold_=False, edges=True, lift=0.0):
            """A panel from span xa to xb (rest pose: straight out, level, chord aft from the leading edge)."""
            a0, a1 = (X(xa), y0 + lift, zr), (X(xb), y0 + lift, zr)
            q0, q1 = (X(xa), y0 + lift, zr + chord(xa)), (X(xb), y0 + lift, zr + chord(xb))
            under = ((a0[0] + a1[0]) / 2, y0 - 99, zr + cr / 2)
            if gold_:
                return gold(slab(a0, a1, q0, q1, T_ * 1.3, under)), []
            fr = []
            if edges:                                                     # gold rails at its leading and trailing edges,
                fr += slab(a0, a1, (a0[0], a0[1], a0[2] + 0.8), (a1[0], a1[1], a1[2] + 0.8), T_ * 1.2, under)   # the strake's
                fr += slab((q0[0], q0[1], q0[2] - 0.8), (q1[0], q1[1], q1[2] - 0.8), q0, q1, T_ * 1.2, under)   # lines folded
                for xx in (xa, xb):                                       # and its ends
                    fr += slab((X(xx) - 0.3 * sx, y0 + lift, zr), (X(xx) + 0.3 * sx, y0 + lift, zr), (X(xx) - 0.3 * sx, y0 + lift, zr + chord(xx)), (X(xx) + 0.3 * sx, y0 + lift, zr + chord(xx)), T_, under)
            return gold(fr), skin(slab(a0, a1, q0, q1, T_ * 0.5, under))
        x1, x2, x3 = s1, 2 * s1, 3 * s1
        (f1, c1), (f2, c2), (f3, c3) = plate(0, x1), plate(x1, x2), plate(x2, x3)
        ft, _ = plate(x3, x3 + st - GAP, gold_=True)
        pv = lambda x, dy=0.0: [round(X(x), 3), round(y0 + dy, 3), round(zr, 3)]
        out += [{"name": n, "parent": "root", "pivot": pv(0), "cubes": []},                       # the swing (yaw)
                {"name": n + "_turn", "parent": n, "pivot": pv(0), "cubes": []},                   # the turn on edge (roll)
                {"name": n + "_arch", "parent": n + "_turn", "pivot": pv(0), "cubes": f1},          # the arch, and panel one
                {"name": n + "_skin", "parent": n + "_arch", "pivot": pv(0), "cubes": c1},
                {"name": n + "_mid", "parent": n + "_arch", "pivot": pv(x1, T_), "cubes": f2},      # counterfold one (mountain)
                {"name": n + "_mid_skin", "parent": n + "_mid", "pivot": pv(x1, T_), "cubes": c2},
                {"name": n + "_out", "parent": n + "_mid", "pivot": pv(x2, -T_), "cubes": f3},      # counterfold two (valley)
                {"name": n + "_out_skin", "parent": n + "_out", "pivot": pv(x2, -T_), "cubes": c3},
                {"name": n + "_tip", "parent": n + "_out", "pivot": pv(x3, T_), "cubes": ft}]      # the gold tip, over last
        if os.environ.get("FOLD_PREVIEW"):                                # a still of the fold, for the viewer
            fo = float(os.environ["FOLD_PREVIEW"].split(",")[0])
            for nm, rot in wing_pose(sx, fo, b["_wing"], sg).items():
                next(x_ for x_ in out if x_["name"] == n + nm)["rotation"] = [round(v, 3) for v in rot]
        tipx = X(S)
        wingpts[sx] = (R0[0], y0, X(x2), y0 + x2 * math.tan(math.radians(ARCH)), tipx, y0, zr, zr + S * math.tan(math.radians(LAM)) / 2, zr + S * math.tan(math.radians(LAM)), cr, (cr + ct) / 2, ct)
    return out


def wing_pose(sx, fo, w, sg=(1, 1, 1, 1)):
    """Each wing bone's rotation [x, y, z] at fold fo (0 open, 1 folded): the swing back (y) from the sweep to along
    her flank, the turn on edge (x), the arch (z) open only, the counterfolds (z, 180 each way) and the tip (z, dropped
    open, folded over)."""
    return {"": [0, sg[0] * -sx * (w["LAM"] + (90 - w["LAM"]) * fo), 0],
            "_turn": [sg[1] * -90 * fo, 0, 0],
            "_arch": [0, 0, sg[2] * -sx * w["ARCH"] * (1 - fo)],
            "_mid": [0, 0, sg[3] * sx * 180 * fo],
            "_out": [0, 0, sg[3] * -sx * 180 * fo],
            "_tip": [0, 0, sg[2] * sx * w["DROP"] * (1 - fo) + sg[3] * sx * 180 * fo]}

def glider_parts(b):
    """The Exokoitos's own parts (Richard, S003: "a gold ultralight frame wrapped in the transparent sailcloth, like the
    wings"; "way more aero and hydro front, way less hotdog hull"; "twin boom to rear"; "thinner rears by 1/3"; "a gold
    triangular section where the bow will hit"; "powered off of some piece of some ore we make up from the comet ...
    glowing"). All in the rig (the sail sheet: gold SPAR, translucent SKIN, glowing CORE), riding amidships with her
    foils; each frame bone's cloth is a child bone of its own (*_skin), drawn blended, and her core is drawn emissive.
      the body   an ogive nose that cuts the water at the waterline, full a third of the way aft, the run behind it a
                 third slimmer than a plain taper, ending at the booms' roots: sixteen-sided sections, gold rings at
                 every other station and stringers, the cloth between
      the cutwater   a gold V on her forefoot, where she meets the water or a shore
      the core   asterion (the Fallen Star's ore: a quasicrystal with phi in its grain, after icosahedrite, the only
                 natural one, which came from a meteorite) glowing in her heart under the cockpit, seen through her skin
      the tail   twin gold booms from her flanks, back and down to twin fins (her rudder, deepest in the water); the
                 tailplane between them 2/3 of her length across, its tips past the booms canted down as foils
      the wings  an F4U Corsair's inverted gull, fierce: swept back, the inner panel falling hard to the knee, the outer
                 rising to a narrow raked point; gold frame, cloth skin; hinged at the hull and the knee, to fold"""
    g = glider_frame(b)
    F, side, half, Lt = g["F"], g["side"], g["half"], g["Lt"]
    x0_, y0_, w_, h_ = SC.SPAR                            # the gold strip, kept clear of its ends (the telltale's red is next door)
    spar, skin_uv, core_uv = uv_all((x0_ + 4, y0_, w_ - 12, h_ - 1)), uv_all(SC.SKIN), uv_all(SC.CORE)
    gold = lambda cubes: [dict(c, uv=spar) for c in cubes]
    skin = lambda cubes: [dict(c, uv=skin_uv) for c in cubes]
    wl = b.get("wl", 0.4 * side)
    W, H = F, 0.8 * side                                  # her envelope: half-breadth and half-depth at her fullest
    TMAX = 1 / PHI ** 2                                   # vision: full at 0.38 of her length, a fast hull's
    N = 21                                                # vision: FIB, twenty-one stations (the pod's fairing needs them)
    # her run, nose to tail point: the Silver Arrow's is longer aft (Richard: "extend the rear ... more Silver Arrows
    # proportions"; "not a beluga bulge, a tapered aero rear"), by 1/phi^2 of her length past the half-length aft
    EXT = 2 * half / PHI ** 2 if b.get("hull") == "arrow" else 0
    LB = 2 * half + EXT
    zs = [-half + LB * i / N for i in range(N + 1)]
    # her whole hull, nose to the booms' roots, by b["hull"] (Richard: "the whole hull from tip to end of main fuselage
    # ... get the area for the main fuselage and play with it"). Each is a plan (her breadth, wid), a profile (her deck
    # line, top, and keel line, bot) and a section, all inside the envelope above, the waterline wl:
    #   round    the first: an ogive, sixteen-sided, the run a third slimmer
    #   boat     a flying boat's float: a deep-V forefoot under a raised spoon bow, a straight keel to a planing step
    #            at her middle, the afterbody rising clear to the booms; flared chines throwing spray; a canopy hump
    #   manta    a lifting body: a delta plan widest past her middle, flat bottomed, knife edged, low arched roof; she
    #            planes on her belly and flies on it, her body a wing
    #   dart     a cut crystal (her asterion core's own form): a diamond plan and profile of straight facets, a
    #            hexagonal section, fullest under her cockpit
    hull = b.get("hull", "round")
    lerp = lambda a, c, u: a + (c - a) * max(0.0, min(1.0, u))
    seat_t, pod = [], (lambda t: 0)                                        # the cockpit pod (the dart's), none by default
    ease = lambda u: (lambda v: v * v * (3 - 2 * v))(max(0.0, min(1.0, u)))
    if hull == "boat":
        STEP = 0.5                                        # the planing step, at her middle
        def wid(t): return 1.1 * W * (math.sin(math.pi / 2 * min(1, t / 0.3)) ** 0.5 if t < 0.55 else lerp(1, 0.45, (t - 0.55) / 0.45))
        def bot(t):
            if t < 0.2: return lerp(wl + 0.35 * side, -0.3 * side, ease(t / 0.2))
            if t < STEP: return -0.3 * side
            return lerp(-0.12 * side, wl + 0.15 * side, (t - STEP) / (1 - STEP))
        def top(t):
            if t < 0.4: return lerp(wl + 0.55 * side, 1.7 * side, math.sin(math.pi / 2 * t / 0.4))
            return lerp(1.7 * side, 0.9 * side, ease((t - 0.4) / 0.6))
        def section(t):
            d = lerp(0.6, 0.25, t)                        # deadrise: deep forward, flatter aft
            return [(0, -1), (0.7, -1 + d), (1.08, -1 + d + 0.05), (0.95, 0.25), (0.62, 0.82), (0, 1),
                    (-0.62, 0.82), (-0.95, 0.25), (-1.08, -1 + d + 0.05), (-0.7, -1 + d)]
    elif hull == "manta":
        def wid(t): return PHI * W * (min(1, t / 0.6) ** 0.8 if t < 0.6 else lerp(1, 0.6, ease((t - 0.6) / 0.4)))   # as wide as her booms
        def bot(t): return lerp(wl + 0.25 * side, wl - 0.25 * side, ease(t / 0.2))
        def top(t):
            if t < 0.42: return lerp(wl + 0.2 * side, 1.1 * side, math.sin(math.pi / 2 * t / 0.42) ** 0.8)
            return lerp(1.1 * side, wl + 0.3 * side, ease((t - 0.42) / 0.58))
        def section(t):
            return [(0, -1), (0.72, -1), (1, -0.55), (0.72, 0.2), (0.32, 0.8), (0, 1),
                    (-0.32, 0.8), (-0.72, 0.2), (-1, -0.55), (-0.72, -1)]
    elif hull == "dart":
        # a cut crystal with a plumb bow (Richard: "a plumb bow that doesn't bulge back out to the tip"): her stem stands
        # straight from deck to forefoot at the very tip, a knife in plan, and she widens behind it in straight facets
        # and her cockpit pod (Richard: "a biplane-esque cockpit that the MC character fits in without glitching through";
        # "widen the cockpit"; "more a diamond at the wing piece ... widening at the apex of the side"): round her two
        # tandem seats (the entity's, at its origin and 0.7 of a block ahead) she swells to POD_W a side at her shoulders,
        # a seated player's arms (8 px a side) and room, a diamond in section, faired into the dart fore and aft
        mids_ = (half - END) // 8
        seat_t = [((zv * 16 + mids_ * 8) + half) / LB for zv in (0, -0.7)]   # given: the entity's seats, blocks
        podA, podB = min(seat_t) - 1 / PHI ** 4, max(seat_t) + 1 / PHI ** 5           # vision: the pod's run, round both seats
        FAIR = 1 / PHI ** 4                                                        # vision: its fairing, fore and aft
        def pod(t):
            e = lambda u: (lambda v: v * v * (3 - 2 * v))(max(0.0, min(1.0, u)))
            return min(e((t - podA + FAIR) / FAIR), e((podB + FAIR - t) / FAIR))
        POD_W = 9.5                                                                # vision: a player's arms, 8 px a side, and room
        def wid0(t): return 0.85 * W * (lerp(0.04, 1, t / TMAX) if t < TMAX else lerp(1, 0.4, (t - TMAX) / (1 - TMAX)))
        def wid(t): return lerp(wid0(t), POD_W / 0.8, pod(t))                    # derived: her shoulders (0.8 of her beam) at POD_W
        def bot(t): return lerp(-0.2 * side, -0.35 * side, t / TMAX) if t < TMAX else lerp(-0.35 * side, wl, (t - TMAX) / (1 - TMAX))
        def top(t): return lerp(1.4 * side, 1.85 * side, t / TMAX) if t < TMAX else lerp(1.85 * side, 0.8 * side, (t - TMAX) / (1 - TMAX))
        def section(t):
            q = pod(t)                                                             # the pod's diamond: the apex out, the shoulders wide
            return [(0, -1), (lerp(0.62, 0.5, q), -0.45), (1, 0.1), (lerp(0.5, 0.8, q), 0.78), (0, 1), (-lerp(0.5, 0.8, q), 0.78), (-1, 0.1), (-lerp(0.62, 0.5, q), -0.45)]
    elif hull == "arrow":
        # a Silver Arrow with her plumb bow (Richard: "kinda like a Mercedes Silver Arrows with the current bow"): the
        # 1930s streamliners' long rounded body with a flattish belly, full at the cockpits, a headrest fairing rising
        # behind the driver and a long tail drawn to a point; forward it narrows to her knife-edged plumb stem
        mids_ = (half - END) // 8
        seat_t = [((zv * 16 + mids_ * 8) + half) / LB for zv in (0, -0.7)]   # given: the entity's seats, blocks
        TF = (min(seat_t) + max(seat_t)) / 2                                       # her fullest, between the cockpits
        BEAM = 16 * 1.5 / 2                                                        # given: her law's beam, 1.5 blocks (lawdump)
        pod = lambda t: max(0.0, 1 - abs(t - TF) / (max(seat_t) - min(seat_t) + 1 / PHI ** 4))
        # her tail (Richard: "a tapered aero rear", "not a beluga bulge"): behind the rear cockpit's after edge a small
        # headrest fairing, then she draws out long and clean to a point, the belly sweeping gently up to meet the deck
        TT = max(seat_t) + (0.7 * 16 / 3) / LB                                     # derived: the rear cockpit's after edge
        tailu = lambda t: max(0.0, min(1.0, (t - TT) / (1 - TT)))
        def wid(t):
            if t <= TF:
                return BEAM * max(0.03, math.sin(math.pi / 2 * t / TF) ** (1 / PHI))   # vision: a full, rounded entry
            if t <= TT:
                return BEAM
            return BEAM * max(1 / PHI ** 5, math.cos(math.pi / 2 * tailu(t)) ** 1.2)   # vision: a long taper to a point
        def bot(t):
            if t <= TF:
                return lerp(-0.2 * side, -0.3 * side, math.sin(math.pi / 2 * t / TF))
            return lerp(-0.3 * side, wl + 0.35 * side, tailu(t) ** PHI)          # the belly, sweeping gently up
        H0, HEND = 1.5 * side, wl + 0.45 * side                                    # vision: the coaming, the tail's point
        rest = lambda t: math.exp(-((tailu(t) - 1 / PHI ** 3) / (1 / PHI ** 3)) ** 2)   # the headrest, just behind the driver
        def top(t):
            if t <= TF:
                return lerp(1.25 * side, H0, t / TF)
            if t <= TT:
                return H0
            return lerp(HEND, H0, math.cos(math.pi / 2 * tailu(t)) ** 0.9) + 0.3 * side * rest(t)   # vision: a modest fairing
        SEC = [(0, -1), (0.58, -0.9), (0.9, -0.55), (1, -0.05), (0.95, 0.42), (0.78, 0.75), (0, 1),
               (-0.78, 0.75), (-0.95, 0.42), (-1, -0.05), (-0.9, -0.55), (-0.58, -0.9)]   # vision: a rounded body, flattish belly
        KNIFE = [(0, -1), (0.35, -0.7), (0.62, -0.3), (0.75, 0.1), (0.62, 0.45), (0.4, 0.75), (0, 1),
                 (-0.4, 0.75), (-0.62, 0.45), (-0.75, 0.1), (-0.62, -0.3), (-0.35, -0.7)]   # the plumb bow's own, a diamond
        def section(t):
            e = (lambda v: v * v * (3 - 2 * v))(max(0.0, min(1.0, t / (1 / PHI ** 2))))   # knife to round over her first 0.38
            return [(a[0] + (c[0] - a[0]) * e, a[1] + (c[1] - a[1]) * e) for a, c in zip(KNIFE, SEC)]
    else:
        seat_t, pod = [], (lambda t: 0)
        ymid0 = 0.7 * side
        def fat0(t):
            if t <= TMAX:
                return math.sin(math.pi / 2 * t / TMAX) ** 0.6
            u = (t - TMAX) / (1 - TMAX)
            return (1 - u / 3) * (1 - 0.62 * u ** 1.6)
        cy0 = lambda t: wl + 1 + (ymid0 - wl - 1) * min(1, t / TMAX) ** 0.5
        def wid(t): return W * fat0(t)
        def bot(t): return cy0(t) - H * fat0(t)
        def top(t): return cy0(t) + H * fat0(t)
        R16 = [(math.cos(2 * math.pi * (k + 0.5) / 16), math.sin(2 * math.pi * (k + 0.5) / 16) * (0.85 if math.sin(2 * math.pi * (k + 0.5) / 16) > 0 else 1.0)) for k in range(16)]
        def section(t): return R16
    fat = lambda t: max(0.02, wid(t) / W)                  # the rest of her hangs off these
    cy = lambda t: (top(t) + bot(t)) / 2
    hd = lambda t: max(0.15, (top(t) - bot(t)) / 2)
    ymid = cy(0.42)
    K = len(section(0))
    def ring(i):
        t = i / N
        w, lo, hi = max(0.15, wid(t)), bot(t), max(top(t), bot(t) + 0.3)
        return [(w * u, lo + (hi - lo) * (v + 1) / 2, zs[i]) for u, v in section(t)]
    R = [ring(i) for i in range(N + 1)]
    frame, cloth, gskin = [], [], []
    frame_, cloth_, gskin_ = frame, cloth, gskin                            # (her body's own lists; the loop below swaps)
    # her bottom paint (Richard: "a gold 'bottom paint' kind of shield ... the same as the triangular bow gold shield"):
    # the boot line runs level just over her waterline along her length and climbs at the bow to the shield's head,
    # half her side above the water, so the bow shield and the bottom are one gold piece
    T_SHIELD = 1 / PHI ** 3                                # vision: the shield sweeps back a quarter (0.24) of her length
    boot0 = lambda t: wl + side * (0.05 + 0.45 * max(0.0, 1 - t / T_SHIELD))
    # and aft (Richard: "make the gold on the hull sweep up to the rearmost tip of the fuselage where the stabs are, and
    # that's where it telescopes out"): over her last 1/phi^3 it climbs smoothly to her point's height, the stabs' roots
    T_SWEEP = 1 - 1 / PHI ** 3 if b.get("tail") == "stealth" else 2         # vision: the sweep starts 0.24 from her point
    sstep = lambda v: v * v * (3 - 2 * v)
    boot = lambda t: boot0(t) + (cy(1.0) + 0.5 - boot0(t)) * sstep(max(0.0, min(1.0, (t - T_SWEEP) / (1 - T_SWEEP)))) if t > T_SWEEP else boot0(t)
    def split(P, Q, yb):                                   # the fraction of P->Q, from its low end, under the line yb
        y0, y1 = min(P[1], Q[1]), max(P[1], Q[1])
        if y1 - y0 < 1e-6:
            return 1.0 if y0 <= yb else 0.0
        return max(0.0, min(1.0, (yb - y0) / (y1 - y0)))
    at = lambda P, Q, u: tuple(P[j] + (Q[j] - P[j]) * u for j in range(3))
    # her cockpits (the pod's): an opening in her roof over each seat, 0.7 of a block long, the seat a third from its after
    # edge (a seated player's legs run forward under the deck), with a gold coaming round it and a windscreen ahead
    mids_c = (half - END) // 8
    seats_z = [zv * 16 + mids_c * 8 for zv in (0, -0.7)] if seat_t else []     # given: the entity's seats, blocks
    PIT = 0.7 * 16                                                          # vision: an opening 0.7 of a block long
    pits = [(z - PIT * 2 / 3, z + PIT / 3) for z in seats_z]
    in_pit = lambda z: any(z0 <= z <= z1 for z0, z1 in pits)
    roof = lambda i, k: min(section(i / N)[k][1], section(i / N)[(k + 1) % K][1]) >= 0.7   # vision: the facets over her shoulders
    # her tail's tip (Richard: "the rearmost tip of the fuselage telescopes out"): her last 1/phi^4 is its own bone, the
    # same skin, sliding aft a block aloft out of her (the stealth tail, below)
    T_CUT = 1 - 1 / PHI ** 4 if b.get("tail") == "stealth" else 2           # vision: the last 0.15 of her
    i_cut = min(N, math.ceil(T_CUT * N))
    tipF, tipG, tipC = [], [], []
    for i in range(N):
        mid = (zs[i] + zs[i + 1]) / 2
        inside = (0, cy((i + 0.5) / N), mid)
        frame, gskin, cloth = (tipF, tipG, tipC) if i >= i_cut else (frame_, gskin_, cloth_)
        for k in range(K):
            if in_pit(mid) and roof(i, k):
                continue                                                    # the cockpit's opening
            a, c = R[i][k], R[i][(k + 1) % K]
            a2, c2 = R[i + 1][k], R[i + 1][(k + 1) % K]
            # the skin, gold below her boot line (her bottom paint), cloth above: each facet is cut where it crosses
            sa, sb = split(a, c, boot(i / N)), split(a2, c2, boot((i + 1) / N))
            lo = a[1] <= c[1]                                                          # which end of the facet is low
            A, C, A2, C2 = (a, c, a2, c2) if lo else (c, a, c2, a2)
            if sa > 0 or sb > 0:
                gskin += slab(A, at(A, C, sa), A2, at(A2, C2, sb), 0.25, inside)
            if sa < 1 or sb < 1:
                cloth += slab(at(A, C, sa), C, at(A2, C2, sb), C2, 0.2, inside)
            if k % max(1, K // 4) == 0:                                                # stringers, gold
                f = lambda P, Q: tuple(P[j] + (Q[j] - P[j]) * 0.18 for j in range(3))
                frame += slab(a, f(a, c), a2, f(a2, c2), 0.5, inside)
        frame = frame_
        if i % 2 == 0 and i > 0 and i <= i_cut:                                        # a gold ring at every other station
            for k in range(K):
                if in_pit(zs[i]) and roof(i, k):
                    continue
                a, c = R[i][k], R[i][(k + 1) % K]
                frame += slab(a, c, (a[0], a[1], a[2] + 0.5), (c[0], c[1], c[2] + 0.5), 0.5, (0, cy(i / N), zs[i]))
    frame, cloth, gskin = frame_, cloth_, gskin_
    instr = []                                                              # (her dials, lit with her core: its bone, below)
    # the coamings and windscreens (the biplane's): a gold rim along each opening's shoulders and across its ends, raised a
    # little; ahead of each, a small screen of her cloth leaning back over its front edge
    for z0, z1 in pits:
        tm = lambda z: max(0.0, min(1.0, (z + half) / LB))
        sh = lambda z, sx: (sx * wid(tm(z)) * section(tm(z))[3][0], bot(tm(z)) + (top(tm(z)) - bot(tm(z))) * (section(tm(z))[3][1] + 1) / 2)
        ridge = lambda z: (0, top(tm(z)))
        for sx in (-1, 1):                                                  # along her shoulders
            A, B = sh(z0, sx), sh(z1, sx)
            frame += slab((A[0] - 0.4, A[1] + 0.6, z0), (A[0] + 0.4, A[1] + 0.6, z0), (B[0] - 0.4, B[1] + 0.6, z1), (B[0] + 0.4, B[1] + 0.6, z1), 0.7, (0, -99, (z0 + z1) / 2))
        for z in (z0, z1):                                                  # across its ends, over her roof's peak
            L, Rr, Pk = sh(z, -1), sh(z, 1), ridge(z)
            for A, B in ((L, Pk), (Pk, Rr)):
                frame += slab((A[0], A[1] + 0.6, z - 0.35), (B[0], B[1] + 0.6, z - 0.35), (A[0], A[1] + 0.6, z + 0.35), (B[0], B[1] + 0.6, z + 0.35), 0.7, (0, -99, z))
        L, Rr = sh(z0, -1), sh(z0, 1)                                       # the windscreen: rising 3 px, leaning back 2
        hS = 3 / 1.58                                                        # derived: 3 px seen, under the game's height scale
        cloth += slab((L[0] * 0.8, L[1] + 0.8, z0 - 0.6), (Rr[0] * 0.8, Rr[1] + 0.8, z0 - 0.6), (L[0] * 0.7, L[1] + 0.8 + hS * 2, z0 + 1.4), (Rr[0] * 0.7, Rr[1] + 0.8 + hS * 2, z0 + 1.4), 0.2, (0, -99, z0))
        # the instrument cowling (Richard: "a little cowling that has instruments in the cockpit at neck level"): a gold
        # hood under the screen, its after face to the rider, and on it three lit dials of her core: her speed, her
        # height, her sherd's charge
        if b.get("sail") == "clam":
            yc_ = L[1] + 0.8
            frame += slab((L[0] * 0.6, yc_ + 2.4, z0 + 0.2), (Rr[0] * 0.6, yc_ + 2.4, z0 + 0.2), (L[0] * 0.55, yc_, z0 + 2.6), (Rr[0] * 0.55, yc_, z0 + 2.6), 0.5, (0, yc_ - 99, z0))
            for kx in (-1, 0, 1):
                instr.append({"origin": [round(kx * abs(L[0]) * 0.3 - 0.45, 3), round(yc_ + 0.7, 3), round(z0 + 2.3, 3)], "size": [0.9, 0.9, 0.4], "uv": core_uv})
    # the cutwater: gold where she meets the water or a shore. On a plumb stem, a plate on each side of the stem from
    # above her waterline down to her forefoot, sweeping back along her flank to a point a quarter of her length aft;
    # on a raked nose, a V under her forefoot
    t1 = 0.25
    z1 = -half + LB * t1
    tusk_tip = None
    if hull == "arrow":
        # her ram (Richard: "remove the weird cross ram at the bow; instead a narwhal-inspired ram that's kind of pitot
        # tube-esque, but larger, and tipped, obviously, with the power of the precious power source"): a gold tusk
        # straight out of her stem head, level, a block long and drawn fine as a narwhal's, with three collars as a pitot
        # tube has, and at its point a shard of her core, the sherd's own light
        # (Richard: "have it off-centre, but high to port, protruding from the top deck almost", as a narwhal's
        # tusk grows from the left of its jaw)
        t_s = 1 / PHI ** 5                                                 # vision: it springs from her deck 0.09 aft
        S0 = (wid(t_s) * 0.5, top(t_s) - 0.8, -half + LB * t_s)           # port (+x, her left), just under her deck line
        TL = 16.0 + (S0[2] - zs[0])                                        # vision: a block out past her stem
        r0t, r1t = 1.3, 0.4                                                # vision: its thickness at her deck and at its point
        segs = 8
        for j in range(segs):
            u0, u1 = j / segs, (j + 1) / segs
            ra, rb = r0t + (r1t - r0t) * u0 ** 0.8, r0t + (r1t - r0t) * u1 ** 0.8
            frame += strut((S0[0], S0[1], S0[2] - TL * u0), (S0[0], S0[1], S0[2] - TL * u1), (ra + rb) / 2)
        for u in (1 - 1 / PHI, 1 - 1 / PHI ** 2, 1 - 1 / PHI ** 4):        # the collars, out past her stem (the narwhal's twist, the pitot's rings)
            rr = (r0t + (r1t - r0t) * u ** 0.8) * 1.35
            frame += strut((S0[0], S0[1], S0[2] - TL * u + 0.35), (S0[0], S0[1], S0[2] - TL * u - 0.35), rr)
        tusk_tip = (S0[0], S0[1], S0[2] - TL - 0.6)
        # and to starboard, its answer (Richard: "on the other side, high starboard, have an aero cooling intake, to kind
        # of symmetry the off-symmetry"): a scoop on her starboard shoulder, a gold lip round a mouth facing forward, its
        # duct of her cloth fairing back into her flank
        t_i = 1 / PHI ** 4                                                 # vision: a little aft of the tusk's root
        zi = -half + LB * t_i
        yi_ = top(t_i) - 2.2
        ii_ = round(t_i * N)
        xs_ = max([abs(A_[0] + (C_[0] - A_[0]) * (yi_ - A_[1]) / (C_[1] - A_[1])) for A_, C_ in zip(R[ii_], R[ii_][1:] + R[ii_][:1])
                   if (A_[1] - yi_) * (C_[1] - yi_) <= 0 and abs(C_[1] - A_[1]) > 1e-6] or [wid(t_i)])   # her skin there
        I0 = (-(xs_ + 0.9), yi_, zi)                                       # starboard (-x), high on her shoulder, half proud of her skin
        ri, DL = 1.7, 16 / PHI ** 2                                        # vision: the mouth's radius; the duct's run
        ring = [(I0[0] + ri * 1.25 * math.cos(2 * math.pi * k / 10), I0[1] + ri * 0.8 * math.sin(2 * math.pi * k / 10)) for k in range(10)]
        for (xa, ya), (xb, yb_) in zip(ring, ring[1:] + ring[:1]):         # the lip, an oval a little wider than tall
            frame += slab((xa, ya, zi - 0.4), (xb, yb_, zi - 0.4), (xa, ya, zi + 0.5), (xb, yb_, zi + 0.5), 0.6, (I0[0], I0[1], zi))
            # the duct: from the lip back, closing into her flank
            m_ = lambda P_, f: (P_[0] + (-xs_ * 0.9 - P_[0]) * f, P_[1] + (I0[1] - P_[1]) * f * 0.6, zi + DL * f)
            cloth += slab(m_((xa, ya), 0), m_((xb, yb_), 0), m_((xa, ya), 1), m_((xb, yb_), 1), 0.2, (I0[0], I0[1], zi + DL / 2))
    elif hull == "dart":
        frame += slab((0, boot(0), zs[0] - 0.2), (0, bot(0), zs[0] - 0.2), (0, boot(0), zs[0] + 0.6), (0, bot(0), zs[0] + 0.6), 0.7, (99, 0, zs[0]))   # a gold stem bar
    else:
        tip = (0, cy(0), zs[0])
        foot = (0, cy(t1) - hd(t1), z1)
        for sx in (-1, 1):
            flank = (sx * 0.62 * W * fat(t1), cy(t1) - 0.55 * hd(t1), foot[2])
            frame += slab((0, tip[1] + 0.3, tip[2]), (sx * 0.4, tip[1], tip[2] + 0.2), foot, flank, 0.6, (0, cy(t1), foot[2] - 2))
    # the foiling keel (Richard: "a foiling keel that could be lift too"): a gold strut down from her keel line just
    # ahead of her fullest, as deep as her fins, carrying an inverted-V hydrofoil phi^2 of her breadth across: the foil
    # she rises onto before she flies, her tail riding on the tailplane's canted tips
    tk = 1 / math.sqrt(5) if b.get("hull") == "arrow" else TMAX - 0.06   # vision: the Arrow's foil just ahead of her centre of
                                                   # gravity (her riders aft at the cockpits, her long tail)
    zk, yk = -half + LB * tk, cy(tk) - hd(tk)
    ck = Lt / PHI ** 5                                    # a fine chord, bow to stern (Richard: "less thick")
    bones = [{"name": "rig_glide_body", "parent": "root", "pivot": [0, 0, 0], "cubes": gold(frame + gskin)},
             {"name": "rig_glide_body_skin", "parent": "rig_glide_body", "pivot": [0, 0, 0], "cubes": skin(cloth)}]
    # the core: an asterion crystal turned on its corners (three cubes, an icosahedron's look), at her heart
    zc, rc = -half + LB * 0.42, 0.7 * W
    core = [{"origin": [-rc / 2, ymid - rc / 2, zc - rc / 2], "size": [rc, rc, rc], "pivot": [0, ymid, zc], "rotation": rot, "uv": core_uv}
            for rot in ([45, 0, 35], [0, 45, 35], [35, 0, 45])]
    core += instr
    if tusk_tip:                                                           # the shard at her tusk's point, her core's own
        rt = 2.2
        core += [{"origin": [-rt / 2, tusk_tip[1] - rt / 2, tusk_tip[2] - rt / 2], "size": [rt, rt, rt * PHI], "pivot": list(tusk_tip), "rotation": rot, "uv": core_uv}
                 for rot in ([45, 0, 0], [0, 0, 45])]
    bones.append({"name": "rig_glide_core", "parent": "rig_glide_body", "pivot": [0, ymid, zc], "cubes": core})
    # the tail: twin booms from her flanks just aft of her fullest, back and down, splaying to phi of her breadth
    tb = TMAX + 0.2
    zr, yr, xr = -half + LB * tb, cy(tb), W * fat(tb)
    ze, ye, xb = half + g["Lb"], g["ye"], PHI * W
    tail, tcloth = [], []
    for sx in (-1, 1):
        tail += slab((sx * (xr - 0.4), yr - 0.4, zr), (sx * (xr + 0.4), yr - 0.4, zr), (sx * (xb - 0.4), ye - 0.4, ze), (sx * (xb + 0.4), ye - 0.4, ze), 0.8, (0, -99, (zr + ze) / 2))
    # the tailplane: cloth on a gold frame between the booms, its tips past them canted down into the water as foils
    hs, cs = g["span"] / 2, g["cf"]
    ytip = 1 - 0.4 * side
    tcloth += slab((-xb, ye, ze - cs / 2), (xb, ye, ze - cs / 2), (-xb, ye, ze + cs / 2), (xb, ye, ze + cs / 2), 0.2, (0, -99, ze))
    tail += slab((-xb, ye + 0.2, ze - cs / 2 - 0.3), (xb, ye + 0.2, ze - cs / 2 - 0.3), (-xb, ye + 0.2, ze - cs / 2 + 0.3), (xb, ye + 0.2, ze - cs / 2 + 0.3), 0.5, (0, -99, ze))
    for sx in (-1, 1):
        tcloth += slab((sx * xb, ye, ze - cs / 2), (sx * hs, ytip, ze - 0.4 * cs), (sx * xb, ye, ze + cs / 2), (sx * hs, ytip, ze + 0.3 * cs), 0.2, (0, -99, ze))
        tail += slab((sx * xb, ye + 0.2, ze - cs / 2 - 0.3), (sx * hs, ytip + 0.2, ze - 0.4 * cs - 0.3), (sx * xb, ye + 0.2, ze - cs / 2 + 0.3), (sx * hs, ytip + 0.2, ze - 0.4 * cs + 0.3), 0.5, (0, -99, ze))
    if b.get("tail") == "stealth":
        # her tail (Richard: twin racing rudders, all gold; "the rearmost tip of the fuselage telescopes out, and it is
        # attached to the rudders through the central single-piece h stab; the rudders' front top corners touch the
        # hull; the h stab lets the rudders steer through variable geometry, which also makes it self-acting for flight;
        # like three sides of a cube: the front struts solid, unmoving, the back ones flex to change the tunnel shape";
        # "build the geometry off of how it has to work, for the fewest pieces and no gaps while moving"; "do the three
        # strips"). So, the whole of it rides on her tip:
        #   the tip    her own last stations (the body loop above), a silver sleeve running forward inside her, so
        #              running out a block aloft it shows a neck, never a gap
        #   a rudder   three gold strips on two hinge lines, the fore strip fixed to the tip, its top fore corner on her
        #              hull; each hinge a turned bone's own axis, so neighbouring strips share their edge at every angle
        #              (no gaps). The strips run phi^2 : phi : 1 fore to aft, canted out atan 1/phi^3, raked atan 1/phi^2,
        #              tapering to 1/phi of their chord at the foot (the leading edge takes phi/2 of the taper)
        #   the stab   one gold piece across the tunnel's roof from the tip to the rudders' top after corners; it yaws
        #              with the helm and the two after strips bend after it (each hinge turning the same, so the blade
        #              curves smoothly), the tunnel's after end swinging as one
        tail, tcloth = [], []
        tz = lambda t: -half + LB * t
        TEL = 16                                                                 # vision: the tip runs out a block
        ext = TEL * (1 - float(os.environ["FOLD_PREVIEW"].split(",")[0])) if os.environ.get("FOLD_PREVIEW") else 0
        rud_pre = float(os.environ.get("RUDDER_PREVIEW", "0"))                    # (a still of the helm over, degrees)
        t_c = i_cut / N
        cyc = cy(t_c)
        sleeve = []
        for k in range(K):                                                       # the sleeve: her ring at the cut, 0.9 of it
            P0, P1 = R[i_cut][k], R[i_cut][(k + 1) % K]
            s9 = lambda P_, dz: (0.9 * P_[0], cyc + 0.9 * (P_[1] - cyc), P_[2] + dz)
            sleeve += slab(s9(P0, 0), s9(P1, 0), s9(P0, -TEL - 2), s9(P1, -TEL - 2), 0.4, (0, cyc, zs[i_cut] - 4))   # gold (Richard: "the piece that comes out when extended in flight is still gold")
        def half_at(i_, y_):                                                     # her half breadth at height y_ on ring i_
            best = 0.0
            for k in range(K):
                a_, c_ = R[i_][k], R[i_][(k + 1) % K]
                if (a_[1] - y_) * (c_[1] - y_) <= 0 and abs(c_[1] - a_[1]) > 1e-6:
                    best = max(best, abs(a_[0] + (c_[0] - a_[0]) * (y_ - a_[1]) / (c_[1] - a_[1])))
            return best
        i_f = N - 2                                                              # vision: the rudders' fore corners two stations short of her point
        yS = cy(i_f / N) - (cy(i_f / N) - bot(i_f / N)) / PHI                    # derived: low on her flanks there
        hsS = 16 * 1.5 / 2 / PHI                                                 # given: her law's beam, 1.5 blocks; the tunnel 1/phi of it
        zS = tz(1.0)                                                             # vision: the after corners square with her point
        # (her tail's underside rises aft about as her hinges rake, so the rudders' top edges, square to the hinges, run
        # up along her flanks to her point, where the stab lies level)
        cant, rake = math.atan(1 / PHI ** 3), math.atan(1 / PHI ** 2)
        yfoil = 1 - side - 16 / PHI ** 4                                         # vision: her rudder's old depth, stretched a tad (Richard)
        unit = lambda v: (lambda n: [c / n for c in v])(math.sqrt(sum(c * c for c in v)) or 1)
        dot = lambda a_, c_: sum(a_[k] * c_[k] for k in range(3))
        cross = lambda a_, c_: [a_[1] * c_[2] - a_[2] * c_[1], a_[2] * c_[0] - a_[0] * c_[2], a_[0] * c_[1] - a_[1] * c_[0]]
        WS = (PHI ** 2, PHI, 1.0)                                                # vision: the strips, phi^2 : phi : 1
        RyF = lambda a_: [[math.cos(a_), 0, math.sin(a_)], [0, 1, 0], [-math.sin(a_), 0, math.cos(a_)]]
        sgn_y = euler_file(RyF(math.radians(1)))[1]                              # the file's sign for a turn about y
        Ps = (0, yS, tz(1.0) - 2)                                                # the stab's pivot, on the tip near its point
        Ls = zS - Ps[2]
        tail_bones = [{"name": "rig_glide_tailtip", "parent": "root", "pivot": [0, round(cyc, 3), round(zs[i_cut], 3)], "cubes": gold(tipF + tipG + sleeve)},
                      {"name": "rig_glide_tailtip_skin", "parent": "rig_glide_tailtip", "pivot": [0, round(cyc, 3), round(zs[i_cut], 3)], "cubes": skin(tipC)}]
        for side_, sx in (("l", 1), ("r", -1)):
            F = (sx * half_at(i_f, yS), yS, zs[i_f])                             # top fore corner, on her hull
            hgt = yS - yfoil
            d = [sx * hgt * math.tan(cant), -hgt, hgt * math.tan(rake)]         # down a hinge: canted out, raked aft
            # its top edge square to its hinges (so every strip is a true trapezoid, its hinge sides whole): raked hinges
            # make it rise aft, with her tail's own upsweep, to the stab's tip
            Rt = (sx * hsS, F[1] + ((sx * hsS - F[0]) * d[0] + (zS - F[2]) * d[2]) / hgt, zS)
            e = [Rt[k] - F[k] for k in range(3)]
            L = math.sqrt(dot(d, d))
            yl = unit([-c for c in d])
            zl = unit([e[k] - dot(e, yl) * yl[k] for k in range(3)])
            xl = cross(yl, zl)
            Rm = [[xl[0], yl[0], zl[0]], [xl[1], yl[1], zl[1]], [xl[2], yl[2], zl[2]]]
            ws = [w / sum(WS) for w in WS]
            H1 = [F[k] + e[k] * ws[0] for k in range(3)]                         # the hinges' tops, on the top edge
            loc = lambda P_: [dot([P_[k] - H1[k] for k in range(3)], ax) for ax in (xl, yl, zl)]
            Fl, Rl = loc(F), loc(Rt)                                             # its top edge, in the hinge's frame
            C = Rl[2] - Fl[2]
            topy = lambda z_: 0.0                                                # (square to the hinges: level in its frame)
            z1 = 0.0
            z2 = Fl[2] + C * (ws[0] + ws[1])
            dT = 0.0                                                             # vision: a racing blade's even chord (true boxes, no steps)
            lead = lambda f: Fl[2]                                               # the leading edge straight down its hinge line
            trail = lambda f: Rl[2] - dT * f                                     # the trailing edge raked less: the taper
            out = 0.45 * sx                                                      # the plate centred on its hinges
            # its foot (Richard: "make the rudder bottoms align with the hull shape, aero like instead of incline from
            # front to rear; make them look lighter, maybe have the leading edge gold and the rest the fuselage style"):
            # level at her rudder's depth, its fore corner rounded on an ellipse over 1/phi^2 of the chord, so each strip
            # ends where the foot crosses it (the strips' hinge sides stay whole)
            cR = C / PHI ** 2                                                    # vision: the rounded fore corner
            def yfoot_w(z_):
                u = (z_ - Fl[2]) / cR
                return yfoil + (cR * (1 - math.sqrt(max(0.0, 1 - (1 - u) ** 2))) if u < 1 else 0.0)
            yfoot = lambda z_: (yfoot_w(z_) - H1[1] - z_ * zl[1]) / yl[1]        # the foot, in the hinge's frame
            # gold and cloth (Richard: "leading edge and 25% back on v stabs are gold, back to where the rake meets the
            # rear of the rudder wing"): gold from the leading edge a quarter of the chord back at the top, the line
            # raking down and aft to the trailing edge at the foot; all below it gold, her cloth above
            zA, zB = Fl[2] + C / 4, Rl[2]                                       # given: a quarter of the chord
            yB = lambda z_: 0.0 if z_ <= zA else yfoot(zB) * (z_ - zA) / (zB - zA)
            def cols(z0, z1, n):                                                 # a strip's piece from z0 to z1, in n columns
                g_, c_ = [], []
                for j in range(n):
                    za_, zb_ = z0 + (z1 - z0) * j / n, z0 + (z1 - z0) * (j + 1) / n
                    # laid span-wise (its width down the hinge, its length along the chord), so the file's angles never
                    # lock: a quarter turn about z, not about y
                    q_ = lambda y0a, y1a, y0b, y1b, t_: slab((out - sx * (0.9 - t_) / 2, y0a, za_), (out - sx * (0.9 - t_) / 2, y1a, za_),
                                                             (out - sx * (0.9 - t_) / 2, y0b, zb_), (out - sx * (0.9 - t_) / 2, y1b, zb_), t_, (-sx * 99, -L / 2, (za_ + zb_) / 2))
                    ba, bb = max(yB(za_), yfoot(za_)), max(yB(zb_), yfoot(zb_))
                    if ba < -0.05 or bb < -0.05:
                        c_ += q_(0.0, ba, 0.0, bb, 0.3)
                    g_ += q_(ba, yfoot(za_), bb, yfoot(zb_), 0.6)
                return g_, c_
            to_file = lambda pcs: [dict(c, origin=[round(c["origin"][0] + H1[0], 3), round(c["origin"][1] + H1[1], 3), round(c["origin"][2] + H1[2], 3)],
                                         **({"pivot": [round(c["pivot"][0] + H1[0], 3), round(c["pivot"][1] + H1[1], 3), round(c["pivot"][2] + H1[2], 3)]} if "pivot" in c else {}))
                                   for c in pcs]                                 # the hinge frame's origin at H1, in the file
            hp = [round(v, 3) for v in H1]
            th = math.radians(rud_pre / PHI) * Ls / (C * (ws[1] + 2 * ws[2]))    # each hinge's turn for the stab's swing
            z0_, z3_ = Fl[2], Rl[2]
            nc = lambda w_: max(1, round(w_ / 1.0))                              # columns about a pixel wide (the gold line's steps fine)
            p2 = [round(H1[0], 3), round(H1[1], 3), round(H1[2] + z2, 3)]
            parts = [(f"rig_glide_rud_{side_}", "rig_glide_tailtip", hp, cols(z0_, z1, nc(z1 - z0_))),
                     (f"rig_glide_rud_{side_}_mid", f"rig_glide_rud_{side_}", hp, cols(z1, z2, nc(z2 - z1))),
                     (f"rig_glide_rud_{side_}_aft", f"rig_glide_rud_{side_}_mid", p2, cols(z2, z3_, nc(z3_ - z2)))]
            for k_, (nm_, par_, pv_, (gpcs, spcs)) in enumerate(parts):
                bn = {"name": nm_, "parent": par_, "pivot": list(pv_), "cubes": gold(to_file(gpcs))}
                if k_ == 0:
                    bn["rotation"] = euler_file(Rm)
                elif th:
                    bn["rotation"] = euler_file(RyF(th))
                tail_bones += [bn, {"name": nm_ + "_skin", "parent": nm_, "pivot": list(pv_), "cubes": skin(to_file(spcs))}]
            b.setdefault("_rud", {})[side_] = Ls / (C * (ws[1] + 2 * ws[2]))
            b["_rud_top"] = Rt[1]
            b.setdefault("_rud_FR", {})[side_] = (F, Rt)
            b.setdefault("_rud_feet", {})[side_] = tuple(tuple(P_[k] + d[k] for k in range(3)) for P_ in (F, Rt))
        # the stab (Richard: "align the h stab and v stabs' edges more; the sail-ish material should free up the variable
        # geometry necessary"; "the h stab should have that as well, but only the part not in the hull"): her tunnel's
        # roof, a sheet of her cloth each side from where the rudder's top edge leaves her flank (its fore corner) along
        # that edge to its after corner, and back in square across to her point: its outer edge is the rudder's top edge,
        # its trailing edge the rudders' trailing edges' line; a gold edge where it springs from her hull. Inside her it
        # is not drawn. The cloth gives as the strips bend.
        # (Richard: "the h stab is gold in the V you see from the top in the hull; the rest aligns with the leading edge
        # 25% rule"): one plane through each rudder's top edge and her point; inside her V (her flanks narrowing to her
        # point, seen from above) all gold; outboard of it, gold from its leading edge a quarter of the chord back, cloth aft
        st, sc = [], []
        for sx, sd in ((1, "l"), (-1, "r")):
            F, Rt = b["_rud_FR"][sd]
            Pp = (sx * 0.6, Rt[1], zS)                                            # her point, at the after corners' height
            n3 = cross([Rt[k] - F[k] for k in range(3)], [Pp[k] - F[k] for k in range(3)])
            yP = lambda x_, z_: F[1] - (n3[0] * (x_ - F[0]) + n3[2] * (z_ - F[2])) / n3[1]
            Q = lambda x_, z_: (x_, yP(x_, z_), z_)
            lerpz = lambda A_, B_, x_: A_[2] + (B_[2] - A_[2]) * (x_ - A_[0]) / (B_[0] - A_[0])
            n_ = 6
            for j in range(n_):                                                  # her V: from her keel line out to her flank
                za_, zb_ = F[2] + (zS - F[2]) * j / n_, F[2] + (zS - F[2]) * (j + 1) / n_
                xa_ = F[0] + (Pp[0] - F[0]) * j / n_
                xb_ = F[0] + (Pp[0] - F[0]) * (j + 1) / n_
                st += slab(Q(0, za_), Q(xa_, za_), Q(0, zb_), Q(xb_, zb_), 0.5, (0, -99, zS))
            # the fillet (Richard: "have the h and v stabs fully connect to the hull where there are gaps"; "that gap
            # between hull and h stab should be gold"): gold from the stab's inner edge to the nearest of her skin, station
            # by station, so the stab and the rudders' tops grow out of her
            def near(i_, E_):                                                    # the point of ring i_ nearest E_ (x, y)
                best, bd = None, 1e9
                for k in range(K):
                    A_, B_ = R[i_][k], R[i_][(k + 1) % K]
                    vx, vy = B_[0] - A_[0], B_[1] - A_[1]
                    u_ = max(0.0, min(1.0, ((E_[0] - A_[0]) * vx + (E_[1] - A_[1]) * vy) / ((vx * vx + vy * vy) or 1)))
                    Pq = (A_[0] + vx * u_, A_[1] + vy * u_, zs[i_])
                    dd = (Pq[0] - E_[0]) ** 2 + (Pq[1] - E_[1]) ** 2
                    if dd < bd:
                        best, bd = Pq, dd
                return best
            Ez = lambda i_: at(F, Pp, (zs[i_] - F[2]) / (zS - F[2]))
            for i_ in range(i_f, N):
                E0, E1 = Ez(i_), Ez(i_ + 1)
                st += slab(E0, near(i_, E0), E1, near(i_ + 1, E1), 0.5, (0, -99, zS))
            m_ = 8
            for j in range(m_):                                                  # outboard, in span-wise columns
                xa_, xb_ = Pp[0] + (Rt[0] - Pp[0]) * j / m_, Pp[0] + (Rt[0] - Pp[0]) * (j + 1) / m_
                le = lambda x_: lerpz(F, Pp, x_) if abs(x_) < abs(F[0]) else lerpz(F, Rt, x_)
                te = lambda x_: lerpz(Pp, Rt, x_)
                g4 = lambda x_: le(x_) + (te(x_) - le(x_)) / 4
                st += slab(Q(xa_, le(xa_)), Q(xb_, le(xb_)), Q(xa_, g4(xa_)), Q(xb_, g4(xb_)), 0.5, (0, -99, zS))
                sc += slab(Q(xa_, g4(xa_)), Q(xb_, g4(xb_)), Q(xa_, te(xa_)), Q(xb_, te(xb_)), 0.25, (0, -99, zS))
        sb = {"name": "rig_glide_hstab", "parent": "rig_glide_tailtip", "pivot": [0, round(yS, 3), round(Ps[2], 3)], "cubes": gold(st)}
        if rud_pre:
            sb["rotation"] = euler_file(RyF(math.radians(rud_pre / PHI)))
        tail_bones.append(sb)
        tail_bones.append({"name": "rig_glide_hstab_skin", "parent": "rig_glide_hstab", "pivot": [0, round(yS, 3), round(Ps[2], 3)], "cubes": skin(sc)})
        b["_stab_y"] = sgn_y
        for bn in tail_bones:                                                    # (a still run out, for the viewer)
            bn["pivot"] = [bn["pivot"][0], bn["pivot"][1], round(bn["pivot"][2] + ext, 3)]
            bn["cubes"] = [dict(c, origin=[c["origin"][0], c["origin"][1], round(c["origin"][2] + ext, 3)],
                                **({"pivot": [c["pivot"][0], c["pivot"][1], round(c["pivot"][2] + ext, 3)]} if "pivot" in c else {})) for c in bn["cubes"]]
        bones += tail_bones
    bones.append({"name": "rig_glide_tail", "parent": "root", "pivot": [0, 0, 0], "cubes": gold(tail)})
    bones.append({"name": "rig_glide_tail_skin", "parent": "rig_glide_tail", "pivot": [0, 0, 0], "cubes": skin(tcloth)})
    # the wings, by style (b["wings"]): each side a root panel hinged at her flank and an outer panel hinged to it (to
    # fold), each a gold frame bone with its cloth in a child *_skin bone
    style = b.get("wings", "corsair")
    yw, zw, hsw = ymid, -half + LB * TMAX, g["wspan"] / 2
    s1, s2 = hsw / PHI, hsw / PHI ** 2
    cr = Lt / PHI ** 2.5
    def panel(x0, y0, x1, y1, c0, c1, l0, l1, t=0.6):
        """A wing panel with an airfoil (Richard: "a bit more believable, like have a bit of an airfoil to them and some
        more gold struts"): a cambered section 12% thick (NACA's four-digit form; vision), the cloth stretched over it
        top and bottom in strips across the chord; gold ribs at the root, the tip and the thirds between, each shaped to
        the section; a gold leading edge, a main spar's web at a quarter chord, and a gold trailing edge."""
        TT, CAM = 0.12, 0.04                              # vision: thickness and camber, of the chord
        yt = lambda v: 5 * TT * (0.2969 * math.sqrt(v) - 0.126 * v - 0.3516 * v * v + 0.2843 * v ** 3 - 0.1015 * v ** 4)
        cam = lambda v: CAM * 4 * v * (1 - v)
        def P(u, v, up):                                  # a point of the panel: u of the span, v of the chord, up or under
            x, y, l, c = x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, l0 + (l1 - l0) * u, c0 + (c1 - c0) * u
            return (x, y + c * (cam(v) + (yt(v) if up else -yt(v))), l + v * c)
        mid = lambda u: (x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + cam(0.3) * (c0 + (c1 - c0) * u), l0 + (l1 - l0) * u + 0.3 * (c0 + (c1 - c0) * u))
        inside = mid(0.5)
        VU, VL = (0, 0.07, 0.22, 0.45, 0.72, 1), (0, 0.3, 0.65, 1)
        cl, fr = [], []
        for vs, up in ((VU, True), (VL, False)):          # the cloth, top and bottom
            for va, vb in zip(vs, vs[1:]):
                cl += slab(P(0, va, up), P(1, va, up), P(0, vb, up), P(1, vb, up), 0.2, inside)
        for u in (0, 1 / 3, 2 / 3, 1):                     # the ribs, shaped to the section
            cin = mid(u)
            for vs, up in ((VU, True), (VL, False)):
                for va, vb in zip(vs, vs[1:]):
                    A, B = P(u, va, up), P(u, vb, up)
                    fr += slab((A[0] - 0.25, A[1], A[2]), (A[0] + 0.25, A[1], A[2]), (B[0] - 0.25, B[1], B[2]), (B[0] + 0.25, B[1], B[2]), 0.4, cin)
        fr += slab(P(0, 0, True), P(1, 0, True), P(0, 0.07, True), P(1, 0.07, True), t, inside)          # the leading edge
        fr += slab(P(0, 0.94, True), P(1, 0.94, True), P(0, 1, True), P(1, 1, True), 0.4, inside)       # the trailing edge
        fr += slab(P(0, 0.25, False), P(1, 0.25, False), P(0, 0.25, True), P(1, 0.25, True), 0.5, (inside[0], inside[1], inside[2] + 99))   # the spar's web
        return gold(fr), skin(cl)
    def fan(x0, y0, l0, c0, x1, y1, l1, c1, rays):
        """A fin panel: gold rays fanning from its root edge to its outer edge, cloth between each pair (a fish's fin)."""
        fr, cl = [], []
        pts = [((x0, y0, l0 + c0 * k / rays), (x1, y1, l1 + c1 * k / rays)) for k in range(rays + 1)]
        for (r0, r1) in pts:
            fr += slab((r0[0], r0[1] + 0.2, r0[2] - 0.2), (r1[0], r1[1] + 0.2, r1[2] - 0.2), (r0[0], r0[1] + 0.2, r0[2] + 0.2), (r1[0], r1[1] + 0.2, r1[2] + 0.2), 0.45, (x0, y0 - 9, l0))
        for (a0_, a1_), (b0_, b1_) in zip(pts, pts[1:]):
            cl += slab(a0_, a1_, b0_, b1_, 0.2, (x0, y0 - 9, l0))
        return gold(fr), skin(cl)
    wingpts = {}
    if os.environ.get("NO_WINGS"):
        style = "none"
    if style == "fold":
        t_root = (seats_z[-1] - 0.7 * 16 * 2 / 3 - 4 + half) / LB if seat_t else TMAX   # vision: the front cockpit's fore edge, less a rib
        bones += fold_wings(b, g, dict(W=W, TMAX=TMAX, half=half, zs=zs, wid=wid, bot=bot, top=top, cy=cy, section=section,
                                       boot=boot, spar=spar, skin_uv=skin_uv, LB=LB, zt=lambda t: -half + LB * t, t_root=t_root), wingpts)
    if os.environ.get("NO_WINGS"):                       # a look at her body alone, for the viewer
        style = "none"
    for side_, sx in ((("l", 1), ("r", -1)) if style not in ("fold", "none", "zip") else ()):
        braces = []                                       # her lift struts (the kestrel's), a bone of their own: they stay
        rx = sx * W * fat(TMAX) * 0.95                    # with the hull, hidden while the wings are folded
        if style == "corsair":            # an F4U Corsair's inverted gull: the inner panel down to the knee, the outer up
            a1, a2, sweep = math.atan(1 / PHI ** 2), math.atan(1 / PHI ** 2), 1 / PHI ** 2
            co, ct = cr / PHI, cr / PHI ** 3
            kx, ky = rx + sx * s1 * math.cos(a1), yw - s1 * math.sin(a1)
            tx, ty = kx + sx * s2 * math.cos(a2), ky + s2 * math.sin(a2)
            lr = zw - cr / 2
            lk, lt = lr + sweep * s1, lr + sweep * (s1 + s2)
            (f1, c1), (f2, c2) = panel(rx, yw, kx, ky, cr, co, lr, lk), panel(kx, ky, tx, ty, co, ct, lk, lt)
            p1, p2 = (rx, yw, zw), (kx, ky, lk + co / 2)
        elif style == "kestrel":          # a seagull's (the Corsair turned over): the inner panel lifting to the knee, the
            a1, a2 = math.atan(1 / PHI ** 2), math.atan(1 / PHI)   # outer swept hard down and back to a hawk's raked point
            co, ct = cr / PHI ** 0.5, cr / PHI ** 4
            kx, ky = rx + sx * s1 * math.cos(a1), yw + s1 * math.sin(a1)
            tx, ty = kx + sx * s2 * math.cos(a2), ky - s2 * math.sin(a2)
            lr = zw - cr / 2
            lk, lt = lr + s1 / PHI ** 3, lr + s1 / PHI ** 3 + s2 / PHI   # swept little inboard, hard at the hand
            fe = 1 / PHI ** 2                             # derived: fold one, 1/phi^3 of the half span along the 1/phi inner panel
            ex, ey, le, ce = rx + (kx - rx) * fe, yw + (ky - yw) * fe, lr + (lk - lr) * fe, cr + (co - cr) * fe
            (f1, c1), (fm, cm), (f2, c2) = panel(rx, yw, ex, ey, cr, ce, lr, le), panel(ex, ey, kx, ky, ce, co, le, lk), panel(kx, ky, tx, ty, co, ct, lk, lt)
            pm = (ex, ey, le + ce / 2)
            wingpts[sx] = (rx, yw, kx, ky, tx, ty, lr, lk, lt, cr, co, ct)
            braces = []
            # her lift struts: a gold V from her flank under the wing root out to the knee's underside, at a quarter
            # and three quarters of the knee's chord (a high wing's, braced)
            hy, hz = yw - hd(TMAX) / PHI ** 2, zw
            for v_ in (0.25, 0.75):
                kz_ = lk + v_ * co
                braces += gold(strut((rx, hy, hz), (kx, ky - 0.06 * co, kz_), 0.35))
            # and a jury strut from each strut's middle up to the wing, as a braced wing has
            for v_ in (0.25, 0.75):
                kz_ = lk + v_ * co
                m_ = ((rx + kx) / 2, (hy + ky) / 2, (hz + kz_) / 2)
                w_ = (rx + (kx - rx) / 2, yw + (ky - yw) / 2 - 0.06 * (cr + co) / 2, lr + (lk - lr) / 2 + v_ * (cr + co) / 2)
                braces += gold(strut(m_, w_, 0.25))
            p1, p2 = (rx, yw, zw), (kx, ky, lk + co / 2)
        elif style == "pectoral":         # the flying fish's own: one long broad fin a side, gold rays fanned from the root,
            span = hsw * 1.05             # cloth between; a little dihedral, the outer half hinged to fold back over the inner
            a = math.atan(1 / PHI ** 3)
            kx, ky = rx + sx * span / 2 * math.cos(a), yw + span / 2 * math.sin(a)
            tx, ty = rx + sx * span * math.cos(a), yw + span * math.sin(a)
            lr = zw - cr / 2
            ck, ct = cr * 1.15, cr / PHI          # broadest at the middle of the fin, rounding off to the tip
            lk, lt = lr + span / 2 / PHI ** 3, lr + span / PHI ** 2.2
            (f1, c1), (f2, c2) = fan(rx, yw, lr, cr, kx, ky, lk, ck, 5), fan(kx, ky, lk, ck, tx, ty, lt, ct, 5)
            p1, p2 = (rx, yw, zw), (kx, ky, lk + ck / 2)
        else:                             # elytra (the firefly's): a hard gold-framed wing case lifted off her back (as a
            ex_, ey_ = rx * 0.4, g["top"] if "top" in g else yw + H   # beetle's is in flight), and from under it the long
            el, ew = Lt / PHI ** 1.5, W * 1.1                           # narrow cloth wing reaching out, a little swept
            up = math.atan(1 / PHI)
            ox, oy = ex_ + sx * ew * math.cos(up), ey_ + ew * math.sin(up)
            lr = zw - el / 2
            case_f = gold(slab((ex_, ey_, lr), (ox, oy, lr + el / PHI ** 4), (ex_, ey_, lr + el), (ox, oy, lr + el * 0.92), 0.5, (0, ey_ - 9, zw)))
            case_c = skin(slab((ex_, ey_ + 0.4, lr + 0.6), (ox, oy + 0.4, lr + el / PHI ** 4 + 0.6), (ex_, ey_ + 0.4, lr + el - 0.6), (ox, oy + 0.4, lr + el * 0.92 - 0.6), 0.3, (0, ey_ - 9, zw)))   # its glazed panel
            kx, ky = ox, oy - 0.6
            tx, ty = kx + sx * hsw * math.cos(math.atan(1 / PHI ** 3)), ky - hsw * math.sin(math.atan(1 / PHI ** 3))
            lk = lr + el / PHI ** 2
            co, ct = cr * 0.9, cr / PHI ** 2
            f2, c2 = panel(kx, ky, tx, ty, co, ct, lk, lk + hsw / PHI ** 2)
            f1, c1 = case_f, case_c
            p1, p2 = (ex_, ey_, zw), (kx, ky, lk + co / 2)
        n = f"rig_glide_{side_}"
        rp = lambda P: [round(v, 3) for v in P]
        if style == "kestrel":                            # three pieces: the stub, the middle (fold one), the outer (fold two)
            bones += [{"name": n, "parent": "root", "pivot": rp(p1), "cubes": f1},
                      {"name": n + "_skin", "parent": n, "pivot": rp(p1), "cubes": c1},
                      {"name": n + "_mid", "parent": n, "pivot": rp(pm), "cubes": fm},
                      {"name": n + "_mid_skin", "parent": n + "_mid", "pivot": rp(pm), "cubes": cm},
                      {"name": n + "_out", "parent": n + "_mid", "pivot": rp(p2), "cubes": f2},
                      {"name": n + "_out_skin", "parent": n + "_out", "pivot": rp(p2), "cubes": c2}]
        else:
            bones += [{"name": n, "parent": "root", "pivot": rp(p1), "cubes": f1},
                      {"name": n + "_skin", "parent": n, "pivot": rp(p1), "cubes": c1},
                      {"name": n + "_out", "parent": n, "pivot": rp(p2), "cubes": f2},
                      {"name": n + "_out_skin", "parent": n + "_out", "pivot": rp(p2), "cubes": c2}]
        if braces:
            bones.append({"name": n + "_strut", "parent": "root", "pivot": rp(p1), "cubes": braces})
        if os.environ.get("FOLD_PREVIEW"):                # a still of the fold, for the viewer (FOLD_PREVIEW=fold,sign)
            fo, sg = map(float, os.environ["FOLD_PREVIEW"].split(","))
            mid, outer = (x_ for x_ in bones if x_["name"] == n + "_mid"), (x_ for x_ in bones if x_["name"] == n + "_out")
            next(mid)["rotation"] = [0, 0, round(sg * sx * fo * FOLD_MID, 3)]
            next(outer)["rotation"] = [0, 0, round(-sg * sx * fo * FOLD_OUT, 3)]
            if fo > 0.5:
                bones[:] = [x_ for x_ in bones if x_["name"] != n + "_strut"]
    # her sail (b["sail"]), in place of the Therans' rigid wing rig: she runs on her asterion core, and sails when she
    # would rather not spend it; gold frame, cloth skin, like her wings
    sail = b.get("sail")
    sf, sc = [], []
    if sail == "dorsal":                  # a flying fish's dorsal fin: a raked spar from her back, gold rays fanned from its
        ts = 0.3                          # foot, cloth between; it lies flat along her spine to fly
        z0, y0 = -half + LB * ts, cy(ts) + hd(ts)
        hgt, rake = Lt / PHI, 1 / PHI
        foot_aft = Lt / PHI ** 1.5
        rays = 6
        tips = [(0, y0 + hgt * math.cos(a_), z0 + hgt * math.sin(a_) * 1.0) for a_ in (math.atan(rake) + k * (math.pi / 2 - math.atan(rake)) / rays * 0.9 for k in range(rays + 1))]
        feet = [(0, y0, z0 + foot_aft * k / rays) for k in range(rays + 1)]
        for (f_, t_) in zip(feet, tips):
            sf += slab((f_[0] - 0.25, f_[1], f_[2]), (f_[0] + 0.25, f_[1], f_[2]), (t_[0] - 0.25, t_[1], t_[2]), (t_[0] + 0.25, t_[1], t_[2]), 0.45, (9, 0, f_[2]))
        for (fa, ta), (fb, tb) in zip(zip(feet, tips), zip(feet[1:], tips[1:])):
            sc += slab(fa, ta, fb, tb, 0.2, (9, 0, fa[2]))
    elif sail == "kite":                  # a crescent foil kite, high ahead of her on two gold lines
        kz, ky = -half - Lt / PHI, side + PHI * Lt
        kspan, kc = Lt * PHI, Lt / PHI ** 3
        segs = 6
        arc = [(kspan / 2 * math.sin(math.pi / 2 * (2 * k / segs - 1)), ky - kspan / PHI ** 3 * (1 - math.cos(math.pi / 2 * (2 * k / segs - 1))) * 1.6) for k in range(segs + 1)]
        for (xa, ya), (xb, yb) in zip(arc, arc[1:]):
            sc += slab((xa, ya, kz - kc / 2), (xb, yb, kz - kc / 2), (xa, ya, kz + kc / 2), (xb, yb, kz + kc / 2), 0.25, (0, ky - 99, kz))
            sf += slab((xa, ya + 0.3, kz - kc / 2 - 0.3), (xb, yb + 0.3, kz - kc / 2 - 0.3), (xa, ya + 0.3, kz - kc / 2 + 0.3), (xb, yb + 0.3, kz - kc / 2 + 0.3), 0.5, (0, ky - 99, kz))
        bow = (0, cy(0.05) + 0.3, -half + LB * 0.05)
        for (xa, ya) in (arc[1], arc[-2]):              # the two lines, down to her nose
            sf += slab((bow[0] - 0.15, bow[1], bow[2]), (bow[0] + 0.15, bow[1], bow[2]), (xa - 0.15, ya, kz), (xa + 0.15, ya, kz), 0.3, (0, 0, -999))
    elif sail == "clam":
        # her plates (Richard: "the sail zips into the wings and vice versa; they're the same plate, we just reconfigure
        # them in the hull; not fold, zip"; "two wings zip into one sail; the zipper determines the geometry of the gold
        # leading edge"; "I want it to look like one sail when up"; "a clamshell from the front ... when zipped, the
        # shell pieces can move fore and aft in their halves, around an internal mast"): two plates, port and starboard,
        # each a slim swept panel with a gold leading edge a quarter of its chord deep (the zipper's teeth), her cloth
        # aft of it, gold ribs at the golden spans, a gold cap. Each is laid in N strips root to tip, and each strip has
        # two places: up from a slot on her spine, as half of the sail, the two halves bowed into a lens and zipped along
        # their leading edges round an internal mast; or out from a slot in her flank, as her wing. The plates zip out
        # of her strip by strip, root first, into one place or the other (shipwright:clam_up the sail's share,
        # 1 - shipwright:fold the wings'), never more than one plate's worth between them. Zipped, the valves slide fore
        # and aft on the mast (shipwright:clam_cam) for camber.
        NZ = 3                                                                # vision: thirds (Richard: "have it by 1/3s, so we don't have insane parts")
        Lp = 16 * PHI ** 4                                                    # vision: a plate 6.85 blocks long
        c0p, c1p = 16 * PHI ** 2, 16 * PHI                                    # vision: its chord at the root and the tip
        swp = Lp / PHI ** 3                                                   # vision: its leading edge swept back atan 1/phi^3
        b["_plates"] = dict(L=Lp, area=2 * Lp * (c0p + c1p) / 2 / 256, c0=c0p, c1=c1p, swp=swp)   # derived: both plates' area, m^2 (glide.js's WINGS)
        cp = lambda u: c0p + (c1p - c0p) * u
        bow_ = lambda u, v: cp(u) / PHI ** 4 / 2 * math.sin(math.pi * v) ** 0.7 * (0.4 + 0.6 * math.sin(math.pi * (0.5 + 0.5 * u)))   # its section's bow
        pre = [float(v) for v in os.environ.get("CLAM_PREVIEW", "1,0").split(",")]   # (stills: the sail's share, the cam)
        fold_pre = float(os.environ["FOLD_PREVIEW"].split(",")[0]) if os.environ.get("FOLD_PREVIEW") else 1.0
        e_s, e_w = min(pre[0], fold_pre), 1 - fold_pre
        # the sail's place: up from her spine just aft of her after cockpit
        # (Richard: "more sail and wings fore of the character cockpit"): both slots ahead of her front cockpit, the plates'
        # trailing edges at its windscreen, so her riders sit behind her rig and wings as a pilot sits behind a mast
        zf_ = (pits[-1][0] - 2 - c0p) if pits else -half + LB * 0.3
        yd_ = top((zf_ + half) / LB) + 0.4
        sail_pt = lambda sx, u, v: (sx * bow_(u, v), yd_ + Lp * u, zf_ + swp * u + cp(u) * v)
        # the wings' place: out from her flank at the front cockpit's fore edge, low, its last 1/phi^3 drooping
        zw_ = zf_                                                             # the same station: one plate, two places
        t_w = (zw_ + half) / LB
        yw_ = boot(t_w) + 0.5
        xw_ = max(abs(P_[0]) for P_ in R[round(t_w * N)]) + 0.5
        droop = lambda u: Lp / PHI ** 5 * max(0.0, (u - (1 - 1 / PHI ** 3)) * PHI ** 3) ** 2
        wing_pt = lambda sx, u, v: (sx * (xw_ + Lp * u), yw_ + bow_(u, v) - droop(u), zw_ + swp * u + cp(u) * v)
        def strip(pt, sx, k, inside):
            u0, u1 = k / NZ, (k + 1) / NZ
            g_, c_ = [], []
            g_ += slab(pt(sx, u0, 0), pt(sx, u1, 0), pt(sx, u0, 0.25), pt(sx, u1, 0.25), 0.6, inside)
            for v0, v1 in ((0.25, 0.5), (0.5, 0.75), (0.75, 1.0)):
                c_ += slab(pt(sx, u0, v0), pt(sx, u1, v0), pt(sx, u0, v1), pt(sx, u1, v1), 0.25, inside)
            for ur in (1 / PHI ** 2, 1 / PHI):                                # gold ribs at the golden spans
                if u0 <= ur < u1:
                    for v0, v1 in ((0.25, 0.5), (0.5, 0.75), (0.75, 1.0)):
                        g_ += slab(pt(sx, ur - 0.004, v0), pt(sx, ur + 0.004, v0), pt(sx, ur - 0.004, v1), pt(sx, ur + 0.004, v1), 0.5, inside)
            if k == NZ - 1:                                                   # the cap, gold (her wingtips' gold, and its gap)
                for v0, v1 in ((0.0, 0.5), (0.5, 1.0)):
                    g_ += slab(pt(sx, 1 - 0.012, v0), pt(sx, 1, v0), pt(sx, 1 - 0.012, v1), pt(sx, 1, v1), 0.6, inside)
            return g_, c_
        # (Richard: "make it believable they zip into each other"): a plate runs through her as a zip does, a third at a
        # time round the turn between her two slots: the sail slides down into her spine root first, its cap last, while
        # the wing slides out of her flank tip first, its root last; whatever is inside her is hidden
        vis = lambda e, k: max(0.0, min(1.0, (k + 1) - (1 - e) * NZ))       # how much of third k is out of her
        RzF = lambda a_: [[math.cos(a_), -math.sin(a_), 0], [math.sin(a_), math.cos(a_), 0], [0, 0, 1]]
        dyS, dxW = -(1 - e_s) * Lp, (1 - e_w) * Lp                          # (stills: the sail run down, the wing run in)
        bones.append({"name": "rig_glide_sail", "parent": "root", "pivot": [0, round(yd_, 3), round(zf_, 3)], "cubes": []})
        mz = lambda u: zf_ + swp * u + cp(u) / PHI ** 2                       # the mast, inside the lens
        slideP = c0p / PHI ** 4                                               # vision: each valve slides up to 6 px
        b["_clam_slide"] = slideP
        for k in range(NZ):
            u0, u1 = k / NZ, (k + 1) / NZ
            pvm = [0, round(yd_ + Lp * u1, 3), round(zf_, 3)]                 # scaled from its top: its foot goes in first
            if vis(e_s, k) > 0.5:
                bones.append({"name": f"rig_glide_mast_{k}", "parent": "rig_glide_sail", "pivot": pvm,
                              "cubes": gold(strut((0, yd_ + Lp * u0 + dyS, mz(u0)), (0, yd_ + Lp * u1 + dyS, mz(u1)), 0.8))})
            else:
                bones.append({"name": f"rig_glide_mast_{k}", "parent": "rig_glide_sail", "pivot": pvm, "cubes": []})
        for sd, sx in (("l", 1), ("r", -1)):
            dz_ = sx * pre[1] * slideP if len(pre) > 1 else 0
            bones.append({"name": f"rig_glide_sail_{sd}", "parent": "rig_glide_sail", "pivot": [0, round(yd_, 3), round(zf_, 3)], "cubes": []})
            bones.append({"name": f"rig_glide_plate_{sd}", "parent": "root", "pivot": [round(sx * xw_, 3), round(yw_, 3), round(zw_, 3)], "cubes": []})
            for k in range(NZ):
                u0 = k / NZ
                g_, c_ = strip(sail_pt, sx, k, (0, yd_ + Lp * (u0 + 0.5 / NZ), zf_ + swp * u0 + cp(u0) * 0.4))
                mv = lambda cs, dx, dy, dz: [dict(c, origin=[round(c["origin"][0] + dx, 3), round(c["origin"][1] + dy, 3), round(c["origin"][2] + dz, 3)],
                                                  **({"pivot": [round(c["pivot"][0] + dx, 3), round(c["pivot"][1] + dy, 3), round(c["pivot"][2] + dz, 3)]} if "pivot" in c else {})) for c in cs]
                shift = lambda cs: mv(cs, 0, dyS, dz_)
                on = vis(e_s, k) > 0.5
                pv = [0, round(yd_ + Lp * (k + 1) / NZ, 3), round(zf_, 3)]      # scaled from its top
                bones += [{"name": f"rig_glide_sail_{sd}_{k}", "parent": f"rig_glide_sail_{sd}", "pivot": pv, "cubes": gold(shift(g_)) if on else []},
                          {"name": f"rig_glide_sail_{sd}_{k}_skin", "parent": f"rig_glide_sail_{sd}_{k}", "pivot": pv, "cubes": skin(shift(c_)) if on else []}]
                g_, c_ = strip(wing_pt, sx, k, (sx * (xw_ + Lp * (u0 + 0.5 / NZ)), yw_ - 99, zw_))
                on = vis(e_w, k) > 0.5
                pv = [round(sx * (xw_ + Lp * (k + 1) / NZ), 3), round(yw_, 3), round(zw_, 3)]   # scaled from its outer end
                g_, c_ = mv(g_, -sx * dxW, 0, 0), mv(c_, -sx * dxW, 0, 0)
                bones += [{"name": f"rig_glide_plate_{sd}_{k}", "parent": f"rig_glide_plate_{sd}", "pivot": pv, "cubes": gold(g_) if on else []},
                          {"name": f"rig_glide_plate_{sd}_{k}_skin", "parent": f"rig_glide_plate_{sd}_{k}", "pivot": pv, "cubes": skin(c_) if on else []}]
            # for her keel's reflection: the wing's place, as the old wings gave it
            wingpts[sx] = (sx * xw_, yw_, sx * (xw_ + Lp / PHI), yw_, sx * (xw_ + Lp), yw_ - droop(1.0), zw_, zw_ + swp / PHI, zw_ + swp, c0p, cp(1 / PHI), c1p)
        b["_zip"] = dict(N=NZ)
        # the slots: a low gold cowling along her spine at the sail's foot, and a gold lip at each flank slot
        for k_ in range(4):
            za_, zb_ = zf_ - 2 + k_ * (c0p + 4) / 4, zf_ - 2 + (k_ + 1) * (c0p + 4) / 4
            ya_, yb_ = top((za_ + half) / LB), top((zb_ + half) / LB)
            for sx in (-1, 1):
                sf += slab((0, ya_ + 1.2, za_), (sx * 2.6, ya_ - 0.2, za_), (0, yb_ + 1.2, zb_), (sx * 2.6, yb_ - 0.2, zb_), 0.5, (0, ya_ - 99, za_))
        for sx in (-1, 1):
            sf += slab((sx * xw_, yw_ + 1.6, zw_ - 1), (sx * xw_, yw_ - 1.2, zw_ - 1), (sx * xw_, yw_ + 1.6, zw_ + c0p + 1), (sx * xw_, yw_ - 1.2, zw_ + c0p + 1), 0.6, (0, yw_, zw_ + c0p / 2))
    elif sail == "claw":                  # the Pacific crab-claw redrawn: two gold spars from a tack on her foredeck opening
        ts = 0.18                         # into a V, the cloth a crescent between them
        tack = (0, cy(ts) + hd(ts), -half + LB * ts)
        L1, L2 = Lt / PHI * 1.3, Lt / PHI * 1.15
        up = (0, tack[1] + L1 * math.cos(math.atan(1 / PHI ** 2)), tack[2] + L1 * math.sin(math.atan(1 / PHI ** 2)))
        aft = (0, tack[1] + L2 * math.cos(math.atan(PHI)), tack[2] + L2 * math.sin(math.atan(PHI)))
        for e in (up, aft):
            sf += slab((-0.3, tack[1], tack[2]), (0.3, tack[1], tack[2]), (-0.3, e[1], e[2]), (0.3, e[1], e[2]), 0.55, (9, 0, tack[2]))
        n_ = 6
        pts = [(0, up[1] + (aft[1] - up[1]) * k / n_ - math.sin(math.pi * k / n_) * Lt / PHI ** 3, up[2] + (aft[2] - up[2]) * k / n_ + math.sin(math.pi * k / n_) * Lt / PHI ** 4) for k in range(n_ + 1)]
        for pa, pb in zip(pts, pts[1:]):
            sc += slab(tack, tack, pa, pb, 0.2, (9, 0, tack[2]))
    if sail == "clam":                    # (its housing rides with her body, not the sail)
        bones[0]["cubes"] = bones[0]["cubes"] + gold(sf)
    elif sail:
        bones += [{"name": "rig_glide_sail", "parent": "root", "pivot": [0, 0, 0], "cubes": gold(sf)},
                  {"name": "rig_glide_sail_skin", "parent": "rig_glide_sail", "pivot": [0, 0, 0], "cubes": skin(sc)}]
    # the cubes slab() fits come with their own uv; frames and skins above take the sheet's regions
    # her foil: a little Exokoitos of gold under her, her own reflection in the water (Richard: "make the keel a kind
    # of mini version of the boat itself, wing-wise ... reflect the boat above in outline"): her body, her wings and her
    # tail at 1/phi^3 of her size, turned over as a reflection is, so the wings' inner panels dip to the knee and the
    # outer ones rise, and the tailplane's tips cant up; a mast from her keel line down to its back, nothing under it.
    # Sized by her lift: her law's displacement (6 x 1.5 x 0.5625 m at a block coefficient of 0.45) is about 2.3 t,
    # 22.9 kN; carrying nine tenths of it at a lift coefficient of 0.5 at her design wind (7 m/s) wants 1.6-1.9 m^2 of
    # wing; her wings, about 30 m^2, at 1/phi^3 give 1.7 m^2, flying her at about 6.7 m/s (13 knots)
    km = 1 / PHI ** 3
    yb = 1 - side + 2                                     # the reflection's wing roots, near her old foil's depth
    zc = zk                                               # its wing roots under her mast
    T = lambda P: (km * P[0], yb - km * (P[1] - ymid), zc + km * (P[2] - zw))
    # one poured piece (Richard: "one shape ... less square ... one poured piece of metal, or 3D printed"): every part
    # flows into the next and thins toward its ends, as a casting does: a spindle for a fuselage, fullest at the wing
    # root and drawn to a point at nose and tail; the wings in narrow strips whose chord and thickness both run down
    # from the root to a fine tip; the tailplane the same; fillets where the wings meet the spindle
    mini = []
    def cast(pts, l0, c0, sweep, n, t0, t1, inside):
        """A cast wing along a bent span pts (x, y from the root out), its chord running from c0 to a point (a little
        over an ellipse), the leading edge curving back by sweep and the trailing edge sweeping forward into the tip;
        n strips, finer toward the tip, thinning from t0 to t1."""
        seg = [math.hypot(b_[0] - a_[0], b_[1] - a_[1]) for a_, b_ in zip(pts, pts[1:])]
        tot = sum(seg)
        def path(u):
            d = u * tot
            for (a_, b_), L_ in zip(zip(pts, pts[1:]), seg):
                if d <= L_ or L_ == seg[-1]:
                    f = min(1.0, d / L_) if L_ else 0
                    return a_[0] + (b_[0] - a_[0]) * f, a_[1] + (b_[1] - a_[1]) * f
                d -= L_
        chord = lambda u: max(c0 / PHI ** 4, c0 * max(0.0, 1 - u ** 1.3) ** 0.8)
        lead = lambda u: l0 + sweep * u ** 1.2 + (c0 - chord(u)) * 0.45
        us = [1 - (1 - k / n) ** 1.4 for k in range(n + 1)]
        out = []
        for ua, ub in zip(us, us[1:]):
            (xa, ya), (xb_, yb_) = path(ua), path(ub)
            out += slab(T((xa, ya, lead(ua))), T((xb_, yb_, lead(ub))), T((xa, ya, lead(ua) + chord(ua))), T((xb_, yb_, lead(ub) + chord(ub))),
                        t0 + (t1 - t0) * (ua + ub) / 2, inside)
        return out
    up_ = T((0, ymid - 99, zw))
    yr_ = T((0, ymid, 0))[1]
    nose_z, root_z, tail_z = T((0, 0, zs[0]))[2], T((0, 0, zw))[2], T((0, ye, ze + cs / 2))[2]
    tail_y = T((0, ye, ze))[1]
    spindle = [(nose_z, yr_, 0.12), (nose_z + (root_z - nose_z) * 0.35, yr_, 0.55), (root_z, yr_, 0.85),
               (root_z + (tail_z - root_z) * 0.3, yr_ + (tail_y - yr_) * 0.3, 0.6), (root_z + (tail_z - root_z) * 0.7, yr_ + (tail_y - yr_) * 0.7, 0.38),
               (tail_z, tail_y, 0.15)]
    for (za, ya, ra), (zb, yb_, rb) in zip(spindle, spindle[1:]):
        mini += strut((0, ya, za), (0, yb_, zb), (ra + rb) / 2)
    if b.get("tail") == "stealth":                                          # the Arrow's spindle ends at her own point
        tail_z, tail_y = T((0, 0, zs[N]))[2], T((0, cy(1.0), 0))[1]
        spindle[-3:] = [(root_z + (tail_z - root_z) * 0.3, yr_ + (tail_y - yr_) * 0.3, 0.6), (root_z + (tail_z - root_z) * 0.7, yr_ + (tail_y - yr_) * 0.7, 0.38),
                        (tail_z, tail_y, 0.3)]
        for (za, ya, ra), (zb, yb_, rb) in zip(spindle[-4:], spindle[-3:]):
            mini += strut((0, ya, za), (0, yb_, zb), (ra + rb) / 2)
    for sx, (rx_, yw_, kx_, ky_, tx_, ty_, lr_, lk_, lt_, cr_, co_, ct_) in wingpts.items():
        # her slim Sto-Wings reflected at the span the foil was drawn to (Richard: "make sure the keel is our cool
        # designed one that kind of mirrors the boat's flying surfaces"): the same plan and bends, its span brought in to
        # her old wing's and its chord let out to keep its area
        # flattened (Richard: "make the foil way more flattened out, like the wings in glide mode, like an actual foil
        # that could take this up"): its knee level with its root and its tips only just turned, as her wings fly
        ky_, ty_ = yw_, yw_ - 16 / PHI ** 4
        rS = min(1.0, hsw / max(abs(tx_), 1e-6))
        kx_, tx_, cr_, co_, ct_ = kx_ * rS, tx_ * rS, cr_ / rS, co_ / rS, ct_ / rS
        lk_, lt_ = lr_ + (lk_ - lr_) * rS, lr_ + (lt_ - lr_) * rS
        # the wing, cast along her bent path (centre line, knee, tip)
        mini += cast([(0, yw_), (kx_, ky_), (tx_, ty_)], lr_, cr_, lt_ - lr_, 12, 0.8, 0.45, up_)
        # the fillet: a wedge where the wing's root meets the spindle, under its leading half
        f0, f1 = T((0, yw_, lr_)), T((0, yw_, lr_ + cr_ * 0.6))
        mini += slab((f0[0], f0[1] + 0.5, f0[2]), (sx * 1.2, f0[1], f0[2] + 0.4), (f1[0], f1[1] + 0.5, f1[2]), (sx * 1.2, f1[1], f1[2]), 0.6, (0, f0[1] - 99, f0[2]))
    for sgn in ((-1, 1) if b.get("tail") != "stealth" else ()):   # the tailplane, cast the same, its tips canted up
        mini += cast([(0, ye), (sgn * xb, ye), (sgn * hs, ytip)], ze - cs / 2, cs * PHI, cs / PHI, 6, 0.7, 0.4, T((0, ye - 99, ze)))
    if b.get("tail") == "stealth" and b.get("_rud_FR"):                   # her twin rudders and stab, reflected: fins up
        FRl, FRr = b["_rud_FR"]["l"], b["_rud_FR"]["r"]
        for sd in ("l", "r"):
            (F_, Rt_), (Ff_, Rf_) = b["_rud_FR"][sd], b["_rud_feet"][sd]
            mini += slab(T(F_), T(Ff_), T(Rt_), T(Rf_), 0.5, (0, T((0, ymid, 0))[1] - 99, T(F_)[2]))
        mini += slab(T(FRr[0]), T(FRl[0]), T(FRr[1]), T(FRl[1]), 0.5, (0, T((0, ymid, 0))[1] + 99, T(FRl[0])[2]))
    if b.get("sail") == "clam" and b.get("_plates") and b.get("_rud_FR"):
        # simpler (Richard: "make it look way simpler geometry, and mirror the craft's wings and stab setup, just small;
        # it needs an h stab for lift on the tail anyway"; "make the fuselage a simplified one, like a normal drop keel
        # shape; then on the rear, have the emitter for the power source"): a teardrop bulb, her plates' wing on it at
        # 1/phi^3, and at its tail a level stab with two fins on its tips, her rudders mirrored (up, canted out)
        pl, km_ = b["_plates"], km
        Lb = km_ * LB                                                       # derived: the bulb, her length at 1/phi^3
        rb = Lb / (2 * PHI ** 5)                                            # vision: a slim drop, its girth 1/phi^5 of its length (Richard:
                                                                            # "way slimmer; not weight, just hydro")
        z0b = zc - Lb / PHI ** 2                                            # its nose: its wing at the third of its length
        ybk = yb                                                            # its axis, the wing's plane
        prof = [(0.0, 0.25), (0.1, 0.8), (1 / PHI ** 2, 1.0), (1 / PHI, 0.72), (1.0, 0.18)]   # vision: a drop, full at 0.38
        nf = 6
        ring_ = lambda f, r: [(r * rb * math.cos(2 * math.pi * (k + 0.5) / nf), ybk + r * rb * math.sin(2 * math.pi * (k + 0.5) / nf), z0b + Lb * f) for k in range(nf)]
        mini = []
        for (f0, r0), (f1, r1) in zip(prof, prof[1:]):
            A_, B_ = ring_(f0, r0), ring_(f1, r1)
            for k in range(nf):
                mini += slab(A_[k], A_[(k + 1) % nf], B_[k], B_[(k + 1) % nf], 0.5, (0, ybk, z0b + Lb * (f0 + f1) / 2))
        # one cast piece (Richard: "sweep the wings back a tad, and round the leading edge with the linear geometry";
        # "then make the whole thing one cast piece"; "no gaps"): every surface is laid as spanwise pieces between
        # stations, each piece reaching from the fuller of its two leading edges to the fuller of its two trailing edges
        # and lapping its neighbours a little, so a curve is drawn in straight pieces with no gap anywhere, and each
        # surface starts inside the body it grows from
        LAP = 0.3                                                           # vision: how far each piece laps the next, px
        def cast_surface(stations, t, inside):
            out_ = []
            for (xa, ya, la, ca), (xb_, yb2, lb, cb) in zip(stations, stations[1:]):
                dx, dy_ = xb_ - xa, yb2 - ya
                n_ = math.hypot(dx, dy_) or 1
                ex, ey = dx / n_ * LAP, dy_ / n_ * LAP
                # the piece follows its own leading and trailing edges (no steps), padded a little fore and aft so the
                # box fitted to it still covers both ends
                pad = abs((lb - la) - ((lb + cb) - (la + ca))) / 2 + 0.15
                out_ += slab((xa - ex, ya - ey, la - pad), (xb_ + ex, yb2 + ey, lb - pad), (xa - ex, ya - ey, la + ca + pad), (xb_ + ex, yb2 + ey, lb + cb + pad), t, inside)
            return out_
        c0m, c1m, Lm = km_ * pl["c0"], km_ * pl["c1"], km_ * (pl["L"] + W)
        swq = math.atan(1 / PHI ** 2)                                       # vision: swept back a tad more, atan 1/phi^2 (20.9 degrees)
        tc = math.tan(math.atan(1 / PHI))                                   # its outer third canted down at atan 1/phi
        zle = zc - c0m / 2
        US = [0.0, 0.2, 0.4, 0.55, 2 / 3, 0.78, 0.87, 0.94, 0.98, 1.0]
        chord_ = lambda u, c0_: max(c0_ / PHI ** 4, c0_ * math.sqrt(max(0.0, 1 - u ** 2.2)))   # an elliptic run to a rounded tip
        for sx in (-1, 1):
            st_ = []
            for u in US:
                c_ = chord_(u, c0m)
                le_ = zle + Lm * u * math.tan(swq) + (c0m - c_) * 0.75   # the leading edge curving back into the tip
                st_.append((sx * Lm * u, ybk - Lm * max(0.0, u - 2 / 3) * tc, le_, c_))
            mini += cast_surface(st_, 0.6, (0, ybk - 99, zle))
        # its tail, as her own stern is (Richard: "redo the tail to match the rear of the boat: flat h stab with drop v
        # stabs"; "widen the h stab so it's a real foil"; "make the rudders again swept and not taper up, align with the
        # hull line"): a flat stab, the wing's shape at 1/phi, and from each tip a fin dropping down, canted out and swept
        # aft as her rudders are, an even chord, its root along the stab's line
        # (Richard: "do the h and v stabs again: they're a box, not a capital pi"): the fins hang from the stab's very
        # tips, flush, as her rudders hang from her stab's: the stab tapers straight to a tip whose chord is the fins'
        zt_ = z0b + Lb * (1 - 1 / PHI ** 2)
        hsm, csm = Lm / PHI ** 2, c0m / PHI                                 # vision: half span 1/phi^2 of the wing's, chord 1/phi
        cft = csm / PHI                                                     # the tip's chord, and the fins'
        for sx in (-1, 1):
            st_ = [(sx * hsm * u, ybk, zt_ + hsm * u * math.tan(swq), csm + (cft - csm) * u) for u in (0.0, 0.5, 1.0)]
            mini += cast_surface(st_, 0.5, (0, ybk - 99, zt_))
        hf = max(3.0, km_ * 22)                                             # vision: the fins' depth, her rudders' at 1/phi^3
        cant_, rake_ = math.atan(1 / PHI ** 3), math.atan(1 / PHI ** 2)
        for sx in (-1, 1):
            x0_, z0_ = sx * hsm, zt_ + hsm * math.tan(swq)
            fin = [(x0_ + sx * hf * (k / 5) * math.tan(cant_), ybk + 0.3 - hf * (k / 5), z0_ + hf * (k / 5) * math.tan(rake_), cft) for k in range(6)]
            for (xa, ya, la, ca), (xb_, yb2, lb, cb) in zip(fin, fin[1:]):
                mini += slab((xa, ya + LAP, la), (xb_, yb2 - LAP, lb), (xa, ya + LAP, la + ca), (xb_, yb2 - LAP, lb + cb), 0.5, (0, ybk, la - 99))
        # fillets: where the wing and the stab grow from the drop, a wedge each side over their roots
        for (zl0, cl0) in ((zle, c0m), (zt_, csm)):
            for sx in (-1, 1):
                mini += slab((0, ybk + rb * 0.9, zl0 + cl0 * 0.1), (sx * rb * 2.2, ybk + 0.2, zl0 + cl0 * 0.1), (0, ybk + rb * 0.9, zl0 + cl0 * 0.85), (sx * rb * 2.2, ybk + 0.2, zl0 + cl0 * 0.85), 0.5, (0, ybk - 99, zl0))
        yr_, tail_y, tail_z = ybk, ybk, z0b + Lb                            # the mast meets its axis; the emitter at its tail
        b["_bulb_rb"] = rb
    # dropped (Richard: "drop the keel and foil and resize in turn with the rudders as they are"): its midline down to
    # the rudders' feet, the mast running down with it
    if b.get("tail") == "stealth":
        low = yr_                                                          # (Richard: "make the midline of the keel foil align with
                                                                           # the bottom of the rudders": its spindle's line, its wings' plane)
        outlet = (0, tail_y, tail_z)                                       # (its power outlet, below, moves with it)
        dy = (1 - side - 16 / PHI ** 4) - low
        mini = [dict(c, origin=[c["origin"][0], round(c["origin"][1] + dy, 3), c["origin"][2]],
                     **({"pivot": [c["pivot"][0], round(c["pivot"][1] + dy, 3), c["pivot"][2]]} if "pivot" in c else {})) for c in mini]
        yr_ += dy
    # the mast: her keel line down to the reflection's back, at its wing root
    ytop, ybot = cy(tk) - hd(tk) + 0.5, yr_
    cm = km * cr / PHI
    ymid_m = (ytop + ybot) / 2
    if b.get("sail") == "clam":
        # her keel blade as her rudders are (Richard: "shape the keel more like the rudder geometry to match it, not the
        # materials, but the less stepped, more swept"): one straight blade of their chord, raked aft at their
        # atan 1/phi^2, its foot on the bulb at the wing's root, its head into her hull; square to its rake, so it is one
        # true piece with no steps
        rk = math.atan(1 / PHI ** 2)
        ck = 16 / PHI                                                       # vision: the rudders' racing chord
        dn = [0, -math.cos(rk), math.sin(rk)]                               # down the blade: raked aft
        ch = [0, math.sin(rk), math.cos(rk)]                                # along its chord, square to the rake
        hk = (ytop + 1.5 - ybot) / math.cos(rk)                             # its length, from inside her hull to the bulb
        foot = (0, ybot, zc - ck / 2)
        head = tuple(foot[i] - hk * dn[i] for i in range(3))
        mini += slab(head, foot, tuple(head[i] + ck * ch[i] for i in range(3)), tuple(foot[i] + ck * ch[i] for i in range(3)), 0.9, (99, 0, zc))
    else:
        for (ya, ca, ta), (yb2, cb, tb) in (((ytop, cm * 1.3, 1.0), (ymid_m, cm, 0.8)), ((ymid_m, cm, 0.8), (ybot, cm * 0.85, 0.65))):
            mini += slab((0, ya, zc - ca / 2), (0, yb2, zc - cb / 2), (0, ya, zc + ca / 2), (0, yb2, zc + cb / 2), (ta + tb) / 2, (99, 0, zc))
    if b.get("tail") == "stealth":
        # its power outlet (Richard: "on the rear point of the keel fuselage, have a kinda obvious power outlet too, like
        # how furnaces, smokers and blast furnaces power others"): a gold nozzle flaring aft from the spindle's point, and
        # in its mouth a lit face of her core, the asterion's light, there to feed whatever she tows or docks to
        oz, oy = outlet[2], outlet[1] + dy
        rn = b.get("_bulb_rb", 5) * 0.18 if b.get("_bulb_rb") else 1.0     # vision: the nozzle's throat, the drop's tail
        mini += strut((0, oy, oz - 1.5), (0, oy, oz + 0.6), rn)              # its throat
        mini += strut((0, oy, oz + 0.6), (0, oy, oz + 1.4), rn * PHI)        # its flared lip
        glow = 1.2 * PHI
        cb = next(x_ for x_ in bones if x_["name"] == "rig_glide_core")
        cb["cubes"] = cb["cubes"] + [{"origin": [-glow / 2, oy - glow / 2, oz + 1.0], "size": [glow, glow, 0.6], "uv": core_uv},
                                     {"origin": [-0.5, oy - 0.5, oz + 1.6], "size": [1.0, 1.0, 0.5], "pivot": [0, oy, oz + 1.85], "rotation": [0, 0, 45], "uv": core_uv}]
    if os.environ.get("KEEL_DUMP"):                                         # (the foil alone, for a look at it)
        json.dump({"cubes": mini, "feet": 1 - side - 16 / PHI ** 4, "mid": yr_}, open(os.environ["KEEL_DUMP"], "w"))
    bones[0]["cubes"] = bones[0]["cubes"] + gold(mini)
    return bones


GLIDE_BONES = ("rig_glide_body", "rig_glide_body_skin", "rig_glide_core", "rig_glide_tail", "rig_glide_tail_skin", "rig_glide_sail", "rig_glide_sail_skin",
               *[f"rig_glide_{sd}{p_}" for sd in ("l", "r") for p_ in ("", "_turn", "_arch", "_skin", "_mid", "_mid_skin", "_out", "_out_skin", "_tip")])
GLIDE_STRUTS = ("rig_glide_l_strut", "rig_glide_r_strut")   # shown only with her wings spread
GLIDE_BONES = GLIDE_BONES + tuple(f"rig_glide_{w_}_{sd}{k_}{q_}" for w_ in ("sail", "plate") for sd in ("l", "r") for k_ in [""] + [f"_{k}" for k in range(8)] for q_ in ("", "_skin")) + tuple(f"rig_glide_mast_{k}" for k in range(8)) + ("rig_glide_tailtip", "rig_glide_tailtip_skin", "rig_glide_hstab", "rig_glide_hstab_skin", *[f"rig_glide_rud_{sd}{p_}{q_}" for sd in ("l", "r") for p_ in ("", "_mid", "_aft") for q_ in ("", "_skin")])
def _fin_back():
    """Aloft, how far each tail fin swings back about its root (degrees): until its span, canted atan phi below level and
    swept back atan sqrt(phi), trails aft dipping only atan 1/phi^2 below level (vision), the tips clear of the water."""
    c, sw = math.atan(PHI), math.atan(math.sqrt(PHI))
    d = (math.cos(c), -math.sin(c), math.tan(sw) * math.cos(c))
    n = math.sqrt(sum(v * v for v in d))
    want = -math.sin(math.atan(1 / PHI ** 2))
    lo, hi = 0.0, 90.0
    for _ in range(40):                                   # bisect: the dip falls as the swing grows
        th = (lo + hi) / 2
        r = math.radians(th)
        y = (d[1] * math.cos(r) + d[2] * math.sin(r)) / n
        lo, hi = (th, hi) if y < want else (lo, th)
    return (lo + hi) / 2


FIN_BACK = _fin_back()


def strut(A, B, r):
    """A gold strut from A to B, about 2r square: its width laid square to its run in the plane across her (so a
    strut running out and up keeps its climb; a width along z would turn the box a quarter about y, where the file's
    angles lock)."""
    d = [B[i] - A[i] for i in range(3)]
    w = [d[1], -d[0], 0.0]
    n = math.hypot(w[0], w[1])
    w = [r * v / n for v in w] if n > 1e-6 else [r, 0.0, 0.0]
    nrm = [w[1] * d[2] - w[2] * d[1], w[2] * d[0] - w[0] * d[2], w[0] * d[1] - w[1] * d[0]]
    nn = math.sqrt(sum(v * v for v in nrm)) or 1
    mid = [(A[i] + B[i]) / 2 + 99 * nrm[i] / nn for i in range(3)]
    c_ = [-r * nrm[i] / nn for i in range(3)]                    # centred on its line (slab lays its thickness to one side)
    A, B = [A[i] + c_[i] for i in range(3)], [B[i] + c_[i] for i in range(3)]
    return slab(tuple(A[i] - w[i] for i in range(3)), tuple(A[i] + w[i] for i in range(3)),
                tuple(B[i] - w[i] for i in range(3)), tuple(B[i] + w[i] for i in range(3)), 2 * r, mid)


def swept_wing(y, le, c0, span, mode, t, n=10):
    """A Theran foil wing after a hydrofoil's front wing (Richard's photograph): slim, its chord c0 at the root running
    out in an ellipse to a fine rounded tip (phi^-3 of the root's), its quarter-chord line swept gently back (1/phi of
    the root chord over the half span), so the leading edge curves back and the trailing edge forward into the tip.
    mode "lambda": each arm droops a little, at tan 1/phi^4 (her inverted V, shallow); "tips": level for 1/phi of the
    half span, the tips then turned down at tan 1/phi^2. n narrow strips a side, so the outline curves instead of stepping."""
    hs = span / 2
    def at(u):                                            # u of the half span: (x, drop, leading edge z, chord)
        c = max(c0 / PHI ** 3, c0 * math.sqrt(max(0.0, 1 - u * u)))
        q = le + c0 / 4 + u * c0 / PHI                    # the quarter-chord line, swept
        drop = u * hs / PHI ** 4 if mode == "lambda" else max(0.0, u - 1 / PHI) * hs / PHI ** 2   # a little cant (Richard: "cant a lil")
        return u * hs, drop, q - c / 4, c
    us = [1 - (1 - k / n) ** 1.5 for k in range(n + 1)]   # strips finer toward the tip, where the outline turns
    out = []
    for sx in (-1, 1):
        for u0, u1 in zip(us, us[1:]):
            x0, d0, l0, c_0 = at(u0)
            x1, d1, l1, c_1 = at(u1)
            out += slab((sx * x0, y - d0, l0), (sx * x1, y - d1, l1), (sx * x0, y - d0, l0 + c_0),
                        (sx * x1, y - d1, l1 + c_1), t, (0, y + 99, le))
    return out


def lambda_foil(x0, apex_y, z0, chord, span, t):
    """A Theran foil wing as an obtuse inverted V: two arms from an apex at (x0, apex_y), each reaching span/2 out and
    falling at the golden angle (tan 1/phi^2), t thick, chord long from z0. Slabs, so each arm is one cube."""
    out = []
    for sx in (-1, 1):
        tip = (x0 + sx * span / 2, apex_y - span / 2 / PHI ** 2)
        out += slab((x0, apex_y, z0), (tip[0], tip[1], z0), (x0, apex_y, z0 + chord), (tip[0], tip[1], z0 + chord), t,
                    (x0, apex_y + 99, z0 + chord / 2))
    return out


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
        # the socket: a gold boss the spike and chevrons spring from, run back into the knife-thin piercing stem so
        # the ram is cast onto the ship and never floats ahead of her (the lens's connect check)
        out.append(box([-0.16 * F, y0 - 0.12 * s, z0 - 0.4], [0.32 * F, 0.24 * s, 0.4 + 0.3 * s]))
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
    bones.append({"name": "ram", "parent": "bow", "pivot": [0, b["wl"], -max_mids(b) * SEG - END], "cubes": [] if b.get("glider") else ram_cubes(pid, b)})   # the Exokoitos's ram is her gold cutwater
    bones += parts(b)
    launched, _ = hull_bones(b, True)
    geos = []
    for group in GROUPS:
        geos.append(geo_entry(geometry_id(pid, group), group_bones(bones, group)))
    geos.append(geo_entry(geometry_id(pid, "launched"), launched))
    # the launched hull's culling box holds her whole height (D-004 sets her keel the draught under the water and her
    # ends' sheer high over it): at least the 16 blocks every geometry has, about the same offset
    ys = [(root_lift(b) + v * SCALE) / 16 for x in launched for c in x.get("cubes", []) for v in (c["origin"][1], c["origin"][1] + c["size"][1])]
    d = geos[-1]["description"]
    d["visible_bounds_height"] = max(d["visible_bounds_height"], 2 * math.ceil(max((abs(y - d["visible_bounds_offset"][1]) for y in ys), default=0)))   # a glider's launched hull is empty: her frame is in the rig
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
    if name in ("rudder", "rudder_post", "rudder_post_p", "paddle", "dpaddle", "scull", "pole", "ama", "staff", "foils", "amas", "akas", "nets") or name.startswith(("oar_", "crank_", "link", "helm_")):
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
        # the Exokoitos's wings ride amidships with her foils (the fold, by v.glide, comes with her flight)
        **({w: {"position": [0, 0, f"-{mids} * 8"]} for w in ("rig_glide_body", "rig_glide_tail", "rig_glide_sail") + GLIDE_STRUTS} if b.get("glider") else {}),
        # her plates run through her a third at a time: the sail down into her spine (shipwright:clam_up, held to her
        # fold), the wings out of her flanks tip first (1 - shipwright:fold); a third shows as it clears her skin
        **({**{f"rig_glide_{w_}_{sd}_{k}": {"scale": ([1, f"math.clamp({k + 1} - (1 - {ex}) * {b['_zip']['N']}, 0, 1)", 1] if w_ == "sail" else [f"math.clamp({k + 1} - (1 - {ex}) * {b['_zip']['N']}, 0, 1)", 1, 1])}
               for w_, ex in (("sail", f"math.min({P('clam_up')}, {P('fold')})"), ("plate", f"(1 - {P('fold')})")) for sd in ("l", "r") for k in range(b["_zip"]["N"])},
            **{f"rig_glide_mast_{k}": {"scale": [1, f"math.clamp({k + 1} - (1 - math.min({P('clam_up')}, {P('fold')})) * {b['_zip']['N']}, 0, 1)", 1]} for k in range(b["_zip"]["N"])},
            "rig_glide_sail": {"position": [0, f"-(1 - math.min({P('clam_up')}, {P('fold')})) * {b['_plates']['L']:.3f}", f"-{mids} * 8"]},
            **{f"rig_glide_plate_{sd}": {"position": [f"{-sxx} * (1 - (1 - {P('fold')})) * {b['_plates']['L']:.3f}", 0, f"-{mids} * 8"]} for sd, sxx in (("l", 1), ("r", -1))},
            **{f"rig_glide_sail_{sd}": {"position": [0, 0, f"{sxx} * {b.get('_clam_slide', 6):.3f} * {P('clam_cam')}"]} for sd, sxx in (("l", 1), ("r", -1))}}
           if b.get("glider") and b.get("sail") == "clam" and b.get("_zip") else {}),
        # her tail: the tip runs out a block aloft (her rudders and stab ride on it); the stab yaws with the helm, 1/phi
        # of it, and each rudder's two after strips turn on their hinges so its top after corner keeps to the stab's tip
        **({"rig_glide_tailtip": {"position": [0, 0, f"-{mids} * 8 + 16 * (1 - {P('fold')})"]},
            "rig_glide_hstab": {"rotation": [0, f"{b.get('_stab_y', 1):.0f} * {P('rudder')} / {PHI:.4f}", 0]},
            **{f"rig_glide_rud_{sd}{p_}": {"rotation": [0, f"{b.get('_stab_y', 1):.0f} * {P('rudder')} / {PHI:.4f} * {b.get('_rud', {}).get(sd, 0.5):.4f}", 0]}
               for sd in ("l", "r") for p_ in ("_mid", "_aft")}}
           if b.get("glider") and b.get("tail") == "stealth" else {}),
        # her wings fold (FOLD_MID, FOLD_OUT): the middle up and over the hull about fold one, the outer back down about the knee
        **({f"rig_glide_{sd}": {"position": [0, 0, f"-{mids} * 8"]} for sd in ("l", "r")} if b.get("glider") else {}),
        **({f"rig_glide_{sd}_mid": {"rotation": [0, 0, f"{-sx * FOLD_MID:.3f} * {P('fold')}"]} for sd, sx in (("l", 1), ("r", -1))} if b.get("glider") and b.get("wings") == "kestrel" else {}),
        **({f"rig_glide_{sd}_out": {"rotation": [0, 0, f"{sx * FOLD_OUT:.3f} * {P('fold')}"]} for sd, sx in (("l", 1), ("r", -1))} if b.get("glider") and b.get("wings") not in ("fold", "zip") else {}),
        # the folding wing (fold_wings, wing_pose): each hinge runs straight from open (fold 0) to folded (fold 1)
        **({f"rig_glide_{sd}{part}": {**({"position": [0, 0, f"-{mids} * 8"]} if not part else {}),
                                      "rotation": [f"{v0:.3f} + {v1 - v0:.3f} * {P('fold')}" for v0, v1 in zip(wing_pose(sx, 0, b["_wing"])[part], wing_pose(sx, 1, b["_wing"])[part])]}
            for sd, sx in (("l", 1), ("r", -1)) for part in ("", "_turn", "_arch", "_mid", "_out", "_tip")} if b.get("glider") and b.get("wings") == "fold" and b.get("_wing") else {}),
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
        **({"rudder_post_p": {"rotation": [0, f"{P('rudder')}", 0]}} if b.get("twin") and is_theran(b) else {}),
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
    rigged = "false" if b.get("glider") and b.get("sail") else f"{P('sail')} && {stage} >= 4"   # her own sail, not a rig
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
                *([{"rudder_post_p": f"{stage} >= 4 && {P('rudder_type')} == 1"}] if b.get("twin") and is_theran(b) else []),
                *([] if b.get("twin") or b.get("tri") else [{"ama": f"{stage} >= 3 && {P('outrigger')}"}]), {"staff": f"{stage} >= 5 && !{P('sail')}"},   # a trimaran's floats are her outrigger: no second one
                *([{"foils": f"{stage} >= 4"}] if b.get("foils") else []), *([{"amas": f"{stage} >= 3"}] if b.get("tri") else []),
                *([{"akas": f"{stage} >= 3"}, {"nets": f"{stage} >= 4"}] if b.get("tri") or (b.get("twin") and is_theran(b)) else []),
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
        "materials": [{"*": "Material.default"}] + ([{"*_skin": "Material.skin"}, {"rig_glide_core": "Material.glow"}] if b.get("glider") else []),
        "textures": [f"Array.sails[{P('sail_color')}]"],
        "part_visibility": [{"*": False}, {"yaw": True}, {"root": True}, {"pennant": f"{stage} >= 5"},
                            {"rig_square": f"{rigged} && {style} == 1"}, {"rig_lateen": f"{rigged} && {style} == 2"},
                            {"rig_crab": f"{rigged} && {style} == 3"}, {"rig_junk": f"{rigged} && {style} == 4"}, {"rig_wing": f"{rigged} && {style} == 5"}]
                           + ([{w: f"{stage} >= 3"} for w in GLIDE_BONES] if b.get("glider") else [])
                           + ([{w: f"{stage} >= 3 && {P('fold')} < 0.5"} for w in GLIDE_STRUTS] if b.get("glider") else [])
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
        "identifier": f"{NS}:{pid}", "materials": {"default": "entity_alphatest", **({"skin": "entity_alphablend", "glow": "entity_emissive_alpha"} if b.get("glider") else {})}, "textures": tex,
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
            "pod_half": round(0.22 * (multihull(b)["twin_gap"] / 2 - b["F"]) / 16, 4) if b.get("twin") and is_theran(b) else 0,
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
