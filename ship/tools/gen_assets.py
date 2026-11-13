"""Generates Shipwright resource-pack assets for the faering.

Never hand-edit the generated files; change this script and re-run:
    python3 tools/gen_assets.py
"""
import json
import random
from pathlib import Path

from PIL import Image
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "RP"

NS = "shipwright"

# One hull profile per tier-1 boat. Gameplay data lives in BP/scripts/config/plans.js;
# these are only the looks. floor: half-width at midship (px); side: side height; upsweep:
# how far the ends rise; bow/stern: "pointed", "transom" or "raised" (a transom lifted clear).
PROFILES = {
    "faering": dict(name="Faering", floor=10, side=13, upsweep=6, bow="pointed", stern="pointed", clinker=True),
    "rowboat": dict(name="Rowboat", floor=10.5, side=12, upsweep=2, bow="pointed", stern="transom"),
    "bark_canoe": dict(name="Bark Canoe", floor=8.5, side=10, upsweep=4, bow="pointed", stern="pointed"),
    "outrigger": dict(name="Outrigger Canoe", floor=7, side=10, upsweep=3, bow="pointed", stern="pointed"),
    "sewn_boat": dict(name="Sewn Boat", floor=10, side=12, upsweep=4, bow="pointed", stern="pointed"),
    "sampan": dict(name="Sampan", floor=10.5, side=11, upsweep=4, bow="raised", stern="transom"),
    "wasen": dict(name="Wasen", floor=9.5, side=12, upsweep=7, bow="pointed", stern="transom", tall_stem=True),
    "dugout": dict(name="Dugout", floor=8.5, side=11, upsweep=1, bow="pointed", stern="pointed", thick=True),
    "punt": dict(name="Punt", floor=11, side=8, upsweep=0, bow="transom", stern="transom"),
    "longship": dict(name="Longship", floor=10, side=13, upsweep=6, bow="pointed", stern="pointed", clinker=True),
    "kayak": dict(name="Kayak", floor=7, side=8, upsweep=2, bow="pointed", stern="pointed", decked=True),
}
PROF = PROFILES["faering"]   # the profile being generated (set in main)
PROF_ID = "faering"
MAX_MIDS = 7
SEG = 16          # pixels per mid-section (one block)
END_LEN = 24      # bow and stern length in pixels (1.5 blocks)

# Order must match BP/scripts/config/materials.js
WOODS = [
    ("oak", (162, 130, 78)),
    ("spruce", (114, 84, 48)),
    ("birch", (196, 179, 123)),
    ("jungle", (160, 115, 80)),
    ("acacia", (168, 90, 50)),
    ("dark_oak", (66, 43, 20)),
    ("mangrove", (117, 54, 48)),
    ("cherry", (226, 178, 172)),
    ("bamboo", (194, 173, 80)),
    ("hide", (139, 90, 56)),       # leather skin (kayak)
    ("rabbit", (196, 160, 120)),   # rabbit-hide patchwork skin
    ("birch_bark", (226, 222, 210)),  # bark canoe skin
]
WOOL = [
    ("white", "F9FFFE"), ("orange", "F9801D"), ("magenta", "C74EBD"), ("light_blue", "3AB3DA"),
    ("yellow", "FED83D"), ("lime", "80C71F"), ("pink", "F38BAA"), ("gray", "474F52"),
    ("light_gray", "9D9D97"), ("cyan", "169C9C"), ("purple", "8932B8"), ("blue", "3C44AA"),
    ("brown", "835432"), ("green", "5E7C16"), ("red", "B02E26"), ("black", "1D1D21"),
]

P = lambda name: f"q.property('{NS}:{name}')"


def cube(origin, size):
    return {"origin": [round(v, 3) for v in origin], "size": [round(v, 3) for v in size], "uv": [0, 0]}


# Steering oar on the starboard (right-hand) stern quarter. Root frame, pixels:
# the stern spans z 0..24 and the helm sits at z 8. If it shows on the wrong side, flip RUDDER_SIDE.
RUDDER_SIDE = -1   # -x is the boat's right in this geometry
RUDDER_SWING = -1  # which way the oar swings for a given rudder angle (confirmed in game: -1)
RUDDER_X = 12 * RUDDER_SIDE
RUDDER_Z = 14
STAFF_Z = 20       # stern staff for the pennant on boats with no mast (root frame, pixels)
STAFF_TOP = 30     # pennant height on the staff
PENNANT_DROOP = 70 # degrees the pennant hangs in a dead calm
MAX_OAR_PAIRS = 4
OAR_SWEEP = -1     # stroke direction (confirmed in game: -1)
FURNACE_Z = 0      # crank furnace on deck, between the helm (z 8) and the first bench (z -8)
HULL_LIFT = 5      # pixels: keeps the floor above the waterline so no water shows inside
HELM_FROM_STERN = 1.0  # blocks; the helm sits here, and the entity's pivot sits under the helm
SIDE_H = 13       # top of the side planking at midship
END_SLICES = 6    # bow and stern are built from thin slices so the taper has no gaps


def side_cubes(hw, z0, length, floor_y, sheer_y):
    """Full-height sides (thick on a dugout), clinker laps on a clinker hull, and a gunwale."""
    h = sheer_y - floor_y
    t = 2 if PROF.get("thick") else 1
    out = []
    for sx in (-1, 1):
        x_in = hw if sx > 0 else -hw - t
        out.append(cube([x_in, floor_y, z0], [t, h, length]))
        if PROF.get("clinker"):
            lap_x = hw + 1 if sx > 0 else -hw - 1.4
            for frac in (0.35, 0.68):
                out.append(cube([lap_x, floor_y + h * frac, z0], [0.4, 1, length]))
        cap_x = hw - 0.3 if sx > 0 else -hw - 1.3
        out.append(cube([cap_x, sheer_y - 1, z0], [1.6, 1, length]))
    return out


def layer_bones(zone, pivot, keel, frame, plank):
    return [
        {"name": f"{zone}_keel", "parent": zone, "pivot": pivot, "cubes": keel},
        {"name": f"{zone}_frame", "parent": zone, "pivot": pivot, "cubes": frame},
        {"name": f"{zone}_plank", "parent": zone, "pivot": pivot, "cubes": plank},
    ]


def end_profile(t, kind):
    """Half-width, floor height and sheer height at fraction t along a bow or stern."""
    F = PROF["floor"]
    if kind == "pointed":
        hw = max(1.2, F * (1 - t ** 1.6))
        floor_y = 1 + 4 * t ** 2
    else:  # transom or raised: stays wide, ending in a flat board
        hw = F * (1 - 0.3 * t ** 2)
        floor_y = 1 + (7 if kind == "raised" else 1.5) * t ** 2
    sheer_y = PROF["side"] + PROF["upsweep"] * t ** 3
    return hw, floor_y, sheer_y


def end_section(sign, base):
    kind = PROF["bow"] if sign < 0 else PROF["stern"]
    F, side = PROF["floor"], PROF["side"]
    seg = END_LEN / END_SLICES
    keel, frame, plank = [], [], []
    prev = (F, 1, side)              # the midship profile the end joins onto
    for j in range(END_SLICES):
        t = (j + 0.5) / END_SLICES
        hw, fy, sy = end_profile(t, kind)
        z0 = base - seg * (j + 1) if sign < 0 else base + seg * j
        boundary = base - seg * j if sign < 0 else base + seg * j
        keel.append(cube([-1.5, fy - 1, z0], [3, 2, seg]))
        plank.append(cube([-hw, fy, z0], [hw * 2, 1, seg]))
        plank += side_cubes(hw, z0, seg, fy, sy)
        # Close the seam where this slice meets the wider one before it.
        phw, pfy, psy = prev
        if phw > hw:
            for sx in (-1, 1):
                x0 = hw if sx > 0 else -phw - 1
                plank.append(cube([x0, min(fy, pfy), boundary - 0.5], [(phw + 1) - hw, max(sy, psy) - min(fy, pfy), 1]))
        if fy > pfy:
            plank.append(cube([-hw, pfy, boundary - 0.5], [hw * 2, fy - pfy + 1, 1]))
        # A decked kayak is covered except for the cockpit just forward of the stern's tip (where the helm sits).
        if PROF.get("decked") and not (sign > 0 and z0 < 14):
            plank.append(cube([-hw, sy - 1, z0], [hw * 2, 1, seg]))
        if j in (0, 3):
            frame.append(cube([-hw + 1, fy + 1, z0 + seg / 2 - 1], [hw * 2 - 2, 1, 2]))
        prev = (hw, fy, sy)
    tip = base + sign * END_LEN
    hw, fy, sy = prev
    if kind == "pointed":
        stem_h = sy + (6 if PROF.get("tall_stem") and sign < 0 else 3)
        stem_z = tip - 2 if sign < 0 else tip - 1
        plank.append(cube([-1, 0, stem_z], [2, stem_h, 3]))
        if PROF["upsweep"] >= 4:   # the curled stem head on high-ended boats
            curl_z = stem_z - 2 if sign < 0 else stem_z + 2
            plank.append(cube([-1, stem_h - 2, curl_z], [2, 3, 3]))
    else:
        board_z = tip - 1 if sign < 0 else tip - 1
        plank.append(cube([-hw - 1, fy, board_z], [hw * 2 + 2, sy - fy, 1]))   # the transom board
    return keel, frame, plank


def build_geometry():
    bones = [{"name": "yaw", "pivot": [0, 0, 0]}, {"name": "root", "parent": "yaw", "pivot": [0, 0, 0]}]
    zone_bones = {"bow": [], "mid": [], "stern": []}

    # Mid-sections run from z=0 toward -z.
    for i in range(MAX_MIDS):
        z0 = -(i + 1) * SEG
        name = f"mid_{i}"
        pivot = [0, 0, z0 + SEG / 2]
        bones.append({"name": name, "parent": "root", "pivot": pivot})
        F, side = PROF["floor"], PROF["side"]
        keel = [cube([-1.5, 0, z0], [3, 2, SEG])]
        frame = [
            cube([-F, 2, z0 + 7], [1.5, side - 3, 2]),
            cube([F - 1.5, 2, z0 + 7], [1.5, side - 3, 2]),
            cube([-F + 1.5, 2, z0 + 7], [2 * F - 3, 1, 2]),
            cube([-F + 1.5, min(7, side - 4), z0 + 7], [2 * F - 3, 1, 2]),     # thwart
        ]
        plank = [cube([-F, 1, z0], [2 * F, 1, SEG])] + side_cubes(F, z0, SEG, 1, side)
        if PROF.get("decked"):
            plank.append(cube([-F, side - 1, z0], [2 * F, 1, SEG]))
        bones += layer_bones(name, pivot, keel, frame, plank)
        zone_bones["mid"] += [name, f"{name}_keel", f"{name}_frame", f"{name}_plank"]

    # Bow starts after the last possible mid; animation slides it back to the last visible one.
    bow_base = -MAX_MIDS * SEG
    bones.append({"name": "bow", "parent": "root", "pivot": [0, 0, bow_base]})
    stern_base = 0
    bones.append({"name": "stern", "parent": "root", "pivot": [0, 0, stern_base]})

    for zone, sign, base in (("bow", -1, bow_base), ("stern", 1, stern_base)):
        keel, frame, plank = end_section(sign, base)
        pivot = [0, 0, base]
        bones += layer_bones(zone, pivot, keel, frame, plank)
        zone_bones[zone] += [zone, f"{zone}_keel", f"{zone}_frame", f"{zone}_plank"]

    # Mast and sail are siblings under root so each render controller can show one without the other.
    bones.append({"name": "mast", "parent": "root", "pivot": [0, 2, 0], "cubes": [
        cube([-1, 2, -1], [2, 40, 2]),
    ]})
    # Yard and sail brace round the mast together; furling scales the cloth up to the yard.
    bones.append({"name": "sail", "parent": "root", "pivot": [0, 37, 0], "cubes": [
        cube([-16, 36, -0.75], [32, 1.5, 1.5]),
        cube([-15, 14, 0.5], [30, 22, 0.5]),
    ]})
    # Oars: a pair per thwart, at the middle of mid-sections 0..3 (nearest the stern first).
    for i in range(MAX_OAR_PAIRS):
        z = -(i + 0.5) * SEG
        for side, sx in (("r", -1), ("l", 1)):
            lock_x = (PROF["floor"] + 0.5) * sx
            shaft_x0 = lock_x if sx > 0 else lock_x - 18
            blade_x0 = lock_x + 14 if sx > 0 else lock_x - 18
            bones.append({"name": f"oar_{i}_{side}", "parent": "root", "pivot": [lock_x, 12, z], "cubes": [
                cube([shaft_x0, 11.5, z - 0.5], [18, 1, 1]),
                cube([blade_x0, 11.25, z - 1.5], [4, 0.5, 3]),
            ]})
    # Wind pennant: hangs from the masthead (or the stern staff on boats with no sail).
    # It points toward -z (the bow) at zero rotation, i.e. streaming forward when the wind is from astern.
    bones.append({"name": "pennant", "parent": "root", "pivot": [0, 42, 0], "cubes": [
        cube([-0.25, 39, -6], [0.5, 3, 6]),
        cube([-0.25, 39.5, -10], [0.5, 2, 4]),
    ]})
    # Steering oar: blade in the water aft, shaft up the quarter, tiller reaching to the helmsman's right hand.
    RUDDER_X = (PROF["floor"] + 2) * RUDDER_SIDE
    tiller_len = 7
    tiller_x0 = RUDDER_X if RUDDER_SIDE > 0 else RUDDER_X + 0.5
    bones.append({"name": "rudder", "parent": "root", "pivot": [RUDDER_X, 6, RUDDER_Z], "cubes": [
        cube([RUDDER_X - 0.5, -7, RUDDER_Z - 0.5], [1, 22, 1]),                        # shaft
        cube([RUDDER_X - 0.25, -7, RUDDER_Z - 0.5], [0.5, 8, 5]),                       # blade, trailing aft
        cube([min(tiller_x0, tiller_x0 - RUDDER_SIDE * tiller_len), 14, RUDDER_Z - 4],
             [tiller_len, 1, 1]),                                                       # tiller toward the helm
        cube([min(tiller_x0, tiller_x0 - RUDDER_SIDE * tiller_len), 14, RUDDER_Z - 4], [1, 1, 4]),
    ]})
    # Crank furnace: a half-block furnace on deck with crank arms that turn with the oars.
    full = {"uv": [0, 0], "uv_size": [128, 128]}
    bones.append({"name": "furnace", "parent": "root", "pivot": [0, 2, FURNACE_Z], "cubes": [
        {"origin": [-4, 2, FURNACE_Z - 4], "size": [8, 8, 8],
         "uv": {f: dict(full) for f in ("north", "south", "east", "west", "up", "down")}},
    ]})
    for side, sx in (("l", 1), ("r", -1)):
        bones.append({"name": f"crank_{side}", "parent": "root", "pivot": [4.5 * sx, 6, FURNACE_Z], "cubes": [
            cube([4.25 * sx - 0.5 if sx > 0 else -4.75, 5.5, FURNACE_Z - 0.5], [1, 1, 1]),
            cube([4.75 * sx - 0.25 if sx > 0 else -5.25, 5.5, FURNACE_Z - 0.5], [0.5, 4, 1]),
        ]})
    # Outrigger: a float to port on two crossbeams, centred on the hull (shown by the outrigger property).
    fx = PROF["floor"] + 20
    bones.append({"name": "outrigger", "parent": "root", "pivot": [0, 0, 0], "cubes": [
        cube([fx - 2, 1, -30], [4, 4, 60]),
        cube([PROF["floor"], 11, -18], [fx - PROF["floor"], 1.5, 2]),
        cube([PROF["floor"], 11, 16], [fx - PROF["floor"], 1.5, 2]),
    ]})
    bones.append({"name": "staff", "parent": "root", "pivot": [0, 2, STAFF_Z], "cubes": [
        cube([-0.5, 2, STAFF_Z - 0.5], [1, 29, 1]),
    ]})

    geo = {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": f"geometry.{NS}.{PROF_ID}",
                "texture_width": 128,
                "texture_height": 128,
                "visible_bounds_width": 24,
                "visible_bounds_height": 6,
                "visible_bounds_offset": [0, 1.5, 0],
            },
            "bones": bones,
        }],
    }
    return geo, zone_bones


# The script owns the boat's heading and writes it to shipwright:yaw. The model
# shows that heading and cancels whatever rotation the engine applies itself:
#   yaw bone = sign * (heading - body rotation) + flip
# Modes (shipwright:orient): 0 = +, 1 = -, 2 = + with bow flipped, 3 = - with bow flipped.
_O = "q.property('shipwright:orient')"
_Y = "q.property('shipwright:yaw')"
ORIENT_EXPR = (
    f"(math.mod({_O}, 2) == 0 ? 1 : -1) * ({_Y} - q.body_y_rotation) + ({_O} >= 2 ? 180 : 0)"
)


def build_animation():
    beam, depth, mids = P("beam"), P("depth"), P("mids")
    bones = {
        # Put the helm (just forward of the stern) over the entity's pivot, so the
        # rider there never swings, whatever rotation the engine applies to seats.
        # Centered hull: + mids*8. Then shift the stern half-length minus the helm offset.
        # A longship is drawn at twice the size: scale the hull, and the helm offset with it.
        "root": {
            "rotation": [0, 0, "v.heel"],
            "position": [0, HULL_LIFT, f"({mids} * 8 - ((({mids} + 3) / 2) - {HELM_FROM_STERN}) * 16) * {P('hull_scale')}"],
            "scale": [P("hull_scale"), f"1 + ({P('hull_scale')} - 1) * 0.4", P("hull_scale")],
        },
        "yaw": {"rotation": [0, ORIENT_EXPR, 0]},
        "crank_l": {"rotation": ["v.row * q.life_time * 320", 0, 0]},
        "crank_r": {"rotation": ["v.row * q.life_time * 320", 0, 0]},
        "rudder": {"rotation": [0, f"{RUDDER_SWING} * {P('rudder')}", 0]},
        "bow": {"position": [0, 0, f"({MAX_MIDS} - {mids}) * {SEG}"], "scale": [beam, depth, 1]},
        "stern": {"scale": [beam, depth, 1]},
        "mast": {"position": [0, 0, f"-{mids} * 8"]},
        "outrigger": {"position": [0, 0, f"-{mids} * 8"]},
        "sail": {
            "position": [0, 0, f"-{mids} * 8"],
            # braced round to the wind; tilts out as it fills; flaps when luffing
            "rotation": [
                "-v.fill * 12",
                f"v.trim + ((v.fill < 0.15 && {P('sail_set')}) ? math.sin(q.life_time * 900) * 4 : 0)",
                0,
            ],
            "scale": [1, "v.furl", 1],
        },
        # Points downwind; droops in a calm and flutters harder as the wind rises.
        "pennant": {
            "position": [0, f"{P('sail')} ? 0 : ({STAFF_TOP} - 42)", f"{P('sail')} ? -{mids} * 8 : {STAFF_Z}"],
            "rotation": [
                f"(1 - math.min({P('wind_str')}, 1)) * {PENNANT_DROOP}",
                f"{P('wind_rel')} + math.sin(q.life_time * (300 + 500 * {P('wind_str')})) * (2 + 6 * math.min({P('wind_str')}, 1))",
                0,
            ],
        },
    }
    # Oars: sweep in a rowing rhythm, ship along the hull at rest. Mirrored per side.
    for i in range(MAX_OAR_PAIRS):
        for side, sx in (("r", -1), ("l", 1)):
            bones[f"oar_{i}_{side}"] = {"rotation": [
                0,
                f"{sx} * ((1 - v.row) * 80 + v.row * {OAR_SWEEP} * math.sin(q.life_time * (200 + 260 * v.row) + {i * 25}) * 28)",
                f"{sx} * v.row * (math.cos(q.life_time * (200 + 260 * v.row) + {i * 25}) > 0 ? 14 : -6)",
            ]}
    for i in range(MAX_MIDS):
        cond = f"{mids} > {i}"
        bones[f"mid_{i}"] = {"scale": [f"{cond} ? {beam} : 0", f"{cond} ? {depth} : 0", f"{cond} ? 1 : 0"]}
    return {
        "format_version": "1.8.0",
        "animations": {
            f"animation.{NS}.boat.shape": {"loop": True, "bones": bones},
        },
    }


def build_render_controllers(zone_bones):
    stage = P("stage")
    woods_array = [f"Texture.hull_{w}" for w, _ in WOODS]
    sails_array = [f"Texture.sail_{c}" for c, _ in WOOL]
    controllers = {}

    for zone, prop in (("bow", "wood_bow"), ("mid", "wood_mid"), ("stern", "wood_stern")):
        vis = [{"*": False}, {"yaw": True}, {"root": True}]
        for b in zone_bones[zone]:
            if b.endswith("_keel"):
                vis.append({b: f"{stage} >= 1"})
            elif b.endswith("_frame"):
                vis.append({b: f"{stage} >= 2"})
            elif b.endswith("_plank"):
                vis.append({b: f"{stage} >= 3"})
            else:
                vis.append({b: True})
        controllers[f"controller.render.{NS}.boat.{zone}"] = {
            "arrays": {"textures": {"Array.woods": woods_array}},
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.default"}],
            "textures": [f"Array.woods[{P(prop)}]"],
            "part_visibility": vis,
        }

    rigged = f"{P('sail')} && {stage} >= 4"
    sail_up = f"{rigged} && {P('sail_set')}"
    controllers[f"controller.render.{NS}.boat.mast"] = {
        "arrays": {"textures": {"Array.woods": woods_array}},
        "geometry": "Geometry.default",
        "materials": [{"*": "Material.default"}],
        "textures": [f"Array.woods[{P('wood_mid')}]"],
        "part_visibility": [{"*": False}, {"yaw": True}, {"root": True}, {"mast": rigged},
                            {"rudder": f"{stage} >= 4"},
                            {"outrigger": f"{stage} >= 3 && {P('outrigger')}"},
                            {"crank_l": f"{stage} >= 5 && {P('furnace')}"},
                            {"crank_r": f"{stage} >= 5 && {P('furnace')}"},
                            *[{f"oar_{i}_{s}": f"{stage} >= 5 && {P('oar_pairs')} > {i} && {P('mids')} > {i}"}
                              for i in range(MAX_OAR_PAIRS) for s in ("r", "l")],
                            {"staff": f"{stage} >= 5 && !{P('sail')}"}],
    }
    controllers[f"controller.render.{NS}.boat.sail"] = {
        "arrays": {"textures": {"Array.sails": sails_array}},
        "geometry": "Geometry.default",
        "materials": [{"*": "Material.default"}],
        "textures": [f"Array.sails[{P('sail_color')}]"],
        "part_visibility": [{"*": False}, {"yaw": True}, {"root": True}, {"sail": rigged},
                            {"pennant": f"{stage} >= 5"}],
    }
    controllers[f"controller.render.{NS}.boat.furnace"] = {
        "arrays": {"textures": {"Array.power": [
            "Texture.furnace_off", "Texture.furnace_on", "Texture.smoker_off", "Texture.smoker_on",
            "Texture.blast_off", "Texture.blast_on"]}},
        "geometry": "Geometry.default",
        "materials": [{"*": "Material.default"}],
        "textures": [f"Array.power[math.max(0, {P('power_type')} - 1) * 2 + ({P('furnace_lit')} ? 1 : 0)]"],
        "part_visibility": [{"*": False}, {"yaw": True}, {"root": True},
                            {"furnace": f"{stage} >= 5 && {P('furnace')}"}],
    }
    return {"format_version": "1.8.0", "render_controllers": controllers}


def build_client_entity(controller_names):
    textures = {f"hull_{w}": f"textures/entity/{NS}/hull_{w}" for w, _ in WOODS}
    textures.update({f"sail_{c}": f"textures/entity/{NS}/sail_{c}" for c, _ in WOOL})
    textures["furnace_off"] = "textures/blocks/furnace_front_off"   # vanilla textures
    textures["furnace_on"] = "textures/blocks/furnace_front_on"
    textures["smoker_off"] = "textures/blocks/smoker_front_off"
    textures["smoker_on"] = "textures/blocks/smoker_front_on"
    textures["blast_off"] = "textures/blocks/blast_furnace_front_off"
    textures["blast_on"] = "textures/blocks/blast_furnace_front_on"
    return {
        "format_version": "1.10.0",
        "minecraft:client_entity": {
            "description": {
                "identifier": f"{NS}:{PROF_ID}",
                "materials": {"default": "entity_alphatest"},
                "textures": textures,
                "geometry": {"default": f"geometry.{NS}.{PROF_ID}"},
                "animations": {"shape": f"animation.{NS}.boat.shape"},
                "scripts": {
                    # Smooth everything on the client so motion is fluid without extra network traffic.
                    "pre_animation": [
                        f"v.furl = math.lerp(v.furl ?? 1.0, {P('sail_set')} ? 1.0 : 0.12, 0.08);",
                        f"v.fill = math.lerp(v.fill ?? 0.0, {P('sail_fill')}, 0.1);",
                        f"v.trim = math.lerp(v.trim ?? 0.0, math.clamp({P('wind_rel')} * 0.5, -55, 55), 0.08);",
                        f"v.heel = math.lerp(v.heel ?? 0.0, {P('heel')}, 0.1);",
                        f"v.row = math.lerp(v.row ?? 0.0, {P('rowing')}, 0.15);",
                    ],
                    "animate": ["shape"],
                },
                "render_controllers": controller_names,
            }
        },
    }


def jitter(c, amount, rng):
    return tuple(max(0, min(255, v + rng.randint(-amount, amount))) for v in c)


def plank_texture(color, seed):
    rng = random.Random(seed)
    img = Image.new("RGBA", (128, 128))
    px = img.load()
    for y in range(128):
        band = y // 8
        band_shift = ((band * 37) % 21) - 10
        base = tuple(max(0, min(255, v + band_shift)) for v in color)
        for x in range(128):
            c = jitter(base, 6, rng)
            if y % 8 == 7:
                c = tuple(int(v * 0.62) for v in c)
            elif (x + band * 23) % 48 == 0:
                c = tuple(int(v * 0.72) for v in c)
            px[x, y] = c + (255,)
    return img


def skin_texture(color, seed, patch=False):
    """Stretched hide over a frame: soft mottling, stitched seams, patchwork for rabbit hide."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (128, 128))
    px = img.load()
    for y in range(128):
        for x in range(128):
            base = color
            if patch:
                cell = ((x // 16) * 7 + (y // 16) * 13) % 5
                base = tuple(max(0, min(255, v + (cell - 2) * 9)) for v in color)
            c = jitter(base, 5, rng)
            if y % 32 == 0 and x % 4 < 2:
                c = tuple(int(v * 0.6) for v in c)   # stitched seam
            px[x, y] = c + (255,)
    return img


def bark_texture(color, seed):
    """Birch bark: pale, with dark horizontal lenticels and peeling seams."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (128, 128))
    px = img.load()
    for y in range(128):
        for x in range(128):
            c = jitter(color, 6, rng)
            if rng.random() < 0.03:
                c = (60, 55, 50)
            if (y * 7 + (x // 9) * 13) % 23 == 0 and x % 9 < 6:
                c = (45, 42, 40)       # lenticels: short dark dashes
            if y % 32 == 31:
                c = tuple(int(v * 0.7) for v in color)   # sewn bark seams
            px[x, y] = c + (255,)
    return img


def bamboo_texture(color, seed):
    """Jointed bamboo strips: long culms with darker nodes."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (128, 128))
    px = img.load()
    for y in range(128):
        strip = y // 6
        for x in range(128):
            c = jitter(color, 6, rng)
            if y % 6 == 5:
                c = tuple(int(v * 0.65) for v in c)
            if (x + strip * 11) % 24 in (0, 1):
                c = tuple(int(v * 0.6) for v in color)   # nodes
            px[x, y] = c + (255,)
    return img


def ender_chest_texture():
    """The sea chest's skin: dark obsidian panels with a glowing teal latch, like an ender chest."""
    rng = random.Random(42)
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            c = (24 + rng.randint(-4, 4), 32 + rng.randint(-4, 4), 38 + rng.randint(-4, 4))
            if x in (0, 15) or y in (0, 15):
                c = (52, 74, 78)                       # rim
            if (x * 7 + y * 11) % 17 == 0:
                c = (70, 40, 90)                       # purple obsidian flecks
            if 6 <= x <= 9 and 5 <= y <= 9:
                c = (40, 190, 160) if (x + y) % 2 else (90, 230, 200)   # latch glow
            img.putpixel((x, y), c + (255,))
    return img


def shields_texture():
    """A Minecraft shield, drawn in the game's own style: vertical oak planks inside an iron rim, at the
    shield's real 12 x 22 proportions (here at 2x, 24 x 44, top left of a 128 texture); its edge after it."""
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    planks = [(157, 128, 79), (143, 115, 69), (168, 138, 87), (131, 104, 62)]
    for y in range(44):
        for x in range(24):
            plank = planks[(x // 6) % 4]
            grain = ((x * 7 + y * 3) % 11 == 0)
            c = tuple(max(0, v - 18) for v in plank) if grain or x % 6 == 0 else plank
            rim = x < 2 or x >= 22 or y < 2 or y >= 42
            if rim:
                c = (118, 118, 124) if (x + y) % 5 else (92, 92, 98)       # iron rim
            elif 20 <= y < 24:
                c = (128, 128, 134)                                         # iron band across the middle
            img.putpixel((x, y), c + (255,))
    for y in range(44):                                                     # the edge: plank end grain
        for x in range(24, 28):
            img.putpixel((x, y), (110, 86, 52, 255))
    return img


def sail_texture(hex_color, seed, trim=None, spar=(124, 92, 56)):
    """The sail sheet: every rig's cloth cut to shape (sailcloth.py), seams and boltrope painted on, a strip of spar
    wood, and the telltale yarn's corner."""
    import sailcloth as SC
    rng = random.Random(seed)
    base = tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))
    trim = trim or tuple(int(v * 0.68) for v in base)
    img = Image.new("RGBA", (128, 128))
    SC.paint(img, base, trim, rng, jitter)
    px = img.load()
    x0, y0, w, h = SC.SPAR
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            c = jitter(spar, 6, rng)
            px[x, y] = (tuple(int(v * 0.85) for v in c) if y == y0 + h - 1 else c) + (255,)
    # Telltale yarn lives in this corner: red, or white on sails that are already reddish.
    reddish = base[0] > base[1] + 50 and base[0] > base[2] + 30
    yarn = (240, 240, 235) if reddish else (200, 40, 40)
    # The Exokoitos's skin: the cloth itself, translucent (alpha 0.4: drawn with entity_alphablend), its weave faintly
    # gridded; and asterion's glow for her core, a pale star-blue with a bright heart (drawn with entity_emissive_alpha)
    x0, y0, w, h = SC.SKIN
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            px[x, y] = (236, 240, 244, 92 if (x + y) % 3 else 120)
    x0, y0, w, h = SC.CORE
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            d = max(abs(x - x0 - 3.5), abs(y - y0 - 3.5))
            px[x, y] = (150, 230, 255, 255) if d > 2 else (232, 250, 255, 255)
    tx, ty, tw, th = SC.TELLTALE
    for y in range(ty, ty + th):
        for x in range(tx, tx + tw):
            px[x, y] = yarn + (255,)
    return img


def block_texture(kind):
    rng = random.Random(kind)
    img = Image.new("RGBA", (16, 16))
    px = img.load()
    plank = (150, 112, 66)
    dark = (92, 64, 36)
    for y in range(16):
        for x in range(16):
            c = jitter(plank, 8, rng)
            if y % 4 == 3:
                c = tuple(int(v * 0.7) for v in c)
            if kind == "top":
                if x in (0, 15) or y in (0, 15):
                    c = dark
                if 3 <= x <= 12 and y == 7:
                    c = (210, 205, 190)      # a drawn keel line
                if x in (4, 7, 10) and 5 <= y <= 9:
                    c = (210, 205, 190)      # frame stations
            elif kind == "front":
                if 4 <= y <= 6 and 2 <= x <= 13:
                    c = (120, 120, 125)      # iron vise
                if 9 <= y <= 13 and x in (3, 12):
                    c = dark
            else:
                if y >= 12 and x in (1, 2, 13, 14):
                    c = dark
            px[x, y] = c + (255,)
    return img


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


def main():
    # Boats: each built its own way (hull, parts kit, animation, render controllers).
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import gen_boats
    gen_boats.main()
    for stale in [p for p in (RP / "models/entity").glob("*.geo.json") if p.stem.replace(".geo", "") not in gen_boats.BOATS]:
        stale.unlink()

    tex = RP / "textures/entity" / NS
    tex.mkdir(parents=True, exist_ok=True)
    ender_chest_texture().save(tex / "sea_chest_ender.png")
    shields_texture().save(tex / "shields.png")
    tex.mkdir(parents=True, exist_ok=True)
    for i, (name, color) in enumerate(WOODS):
        if name in ("hide", "rabbit"):
            img = skin_texture(color, i, patch=(name == "rabbit"))
        elif name == "birch_bark":
            img = bark_texture(color, i)
        elif name == "bamboo":
            img = bamboo_texture(color, i)
        else:
            img = plank_texture(color, i)
        img.save(tex / f"hull_{name}.png")
    for i, (name, hexc) in enumerate(WOOL):
        sail_texture(hexc, 100 + i).save(tex / f"sail_{name}.png")
    # The Theran hull sheet (hand-painted marble) gets its two solid patches for gen_boats.THERAN_PATCH: gold and fresco
    # blue, in the bottom-right corner no hull face samples
    th = Image.open(tex / "hull_theran.png").convert("RGBA")
    for (x0, y0, w, h), col in ((gen_boats.THERAN_PATCH["gold"], (214, 172, 62)), (gen_boats.THERAN_PATCH["blue"], (46, 92, 170))):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                th.putpixel((x, y), col + (255,))
    th.save(tex / "hull_theran.png")
    # The Therans' cloth: white, gold-taped, on gold spars.
    sail_texture("f6f4ee", 199, trim=(214, 172, 62), spar=(214, 172, 62)).save(tex / "sail_theran.png")

    btex = RP / "textures/blocks"
    btex.mkdir(parents=True, exist_ok=True)
    for kind in ("top", "side", "front"):
        block_texture(kind).save(btex / f"shipwright_table_{kind}.png")
    print("Textures and blocks generated")


if __name__ == "__main__":
    main()
