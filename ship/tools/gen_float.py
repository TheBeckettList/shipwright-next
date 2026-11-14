"""The glass float: a fisherman's glass ball in a rope net, a buoy and a fender in one.

Bakes everything the float is made of, so none of it is hand-edited:
  BP/entities/glass_float.json, BP/items/glass_float.json, BP/recipes/glass_float.json,
  RP/entity/glass_float.entity.json, RP/render_controllers/glass_float.render_controllers.json,
  RP/models/entity/glass_float.geo.json,
  RP/animations/glass_float.animation.json, RP/textures/entity/shipwright/glass_float.png,
  RP/textures/items/glass_float.png and its entry in RP/textures/item_texture.json.

    python3 ship/tools/gen_float.py

Afloat she stays where she was set and a boat can be tied to her; hung from a dock face on a rope
(shipwright:drop is the rope's length in blocks) she is a fender boats lie alongside. A lantern
used on her goes inside the glass (shipwright:lantern).
"""
import json
import math
from pathlib import Path

from PIL import Image

SHIP = Path(__file__).resolve().parent.parent
BP, RP = SHIP / "BP", SHIP / "RP"
ID = "shipwright:glass_float"

PHI = (1 + 5 ** 0.5) / 2                 # vision: the golden law
R = 6.0                                  # vision: the ball's radius, px (3/4 of a block across)
LIFT = R / PHI ** 2                      # derived: glass floats high: her centre rides 1/φ² of her radius above the waterline
ROPE = 0.5                               # vision: rope thickness, px
TEX = 32                                 # vision: texture sheet, px

# The sheet: one small swatch per material (u, v, w, h).
GLASS, GLASS_HI = (0, 0, 8, 8), (8, 0, 4, 4)
ROPE_SW = (16, 0, 4, 4)
IRON, FLAME = (0, 16, 4, 4), (4, 16, 4, 4)


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def faces(sw):
    """Every face of a cube sampling one swatch (per-face uv)."""
    u, v, w, h = sw
    f = {"uv": [u + 0.5, v + 0.5], "uv_size": [w - 1, h - 1]}
    return {k: dict(f) for k in ("north", "south", "east", "west", "up", "down")}


def cube(origin, size, sw, **kw):
    c = {"origin": [round(x, 3) for x in origin], "size": [round(x, 3) for x in size], "uv": faces(sw)}
    c.update(kw)
    return c


def ball():
    """The glass: slices of a sphere, each a cross of two boxes and a square, so the round reads from every side."""
    cubes = []
    n = 6                                                # vision: slices through the ball
    for i in range(n):
        y0 = -R + i * (2 * R / n)
        yc = y0 + R / n
        w = math.sqrt(max(R * R - yc * yc, 0.0))         # derived: the sphere's half-width at that slice
        h = 2 * R / n
        sq = w / math.sqrt(2) * 2                        # derived: the square inscribed in the circle
        cy = y0 + LIFT
        cubes.append(cube([-w, cy, -w * 0.38], [2 * w, h, w * 0.76], GLASS))   # derived: 0.38 ≈ 1/φ² — a cross arm's half-depth
        cubes.append(cube([-w * 0.38, cy, -w], [w * 0.76, h, 2 * w], GLASS))
        cubes.append(cube([-sq / 2, cy, -sq / 2], [sq, h, sq], GLASS_HI))
    return cubes


def net():
    """The rope over her: two great circles crossed over the top and the equator, short straight lays rotated round her centre."""
    cubes = []
    rr = R + ROPE / 2                                    # derived: rope lies on the glass
    steps = 16                                           # vision: lays per great circle
    seg = 2 * math.pi * rr / steps * 1.05                # derived: lay length, a hair long so the lays meet
    for k in range(steps):
        a = 360 * k / steps
        # meridian in the x-y plane (rotate about z) and in the z-y plane (rotate about x)
        cubes.append(cube([-seg / 2, LIFT + rr - ROPE / 2, -ROPE / 2], [seg, ROPE, ROPE], ROPE_SW,
                          pivot=[0, LIFT, 0], rotation=[0, 0, a]))
        cubes.append(cube([-ROPE / 2, LIFT + rr - ROPE / 2, -seg / 2], [ROPE, ROPE, seg], ROPE_SW,
                          pivot=[0, LIFT, 0], rotation=[a, 0, 0]))
        # equator (rotate about y)
        cubes.append(cube([-seg / 2, LIFT - ROPE / 2, rr - ROPE / 2], [seg, ROPE, ROPE], ROPE_SW,
                          pivot=[0, LIFT, 0], rotation=[0, a, 0]))
    # the eye on top, where a line is made fast
    top = LIFT + R + ROPE
    cubes.append(cube([-1.5, top, -ROPE / 2], [3, ROPE, ROPE], ROPE_SW))
    cubes.append(cube([-1.5, top, -ROPE / 2], [ROPE, 2, ROPE], ROPE_SW))
    cubes.append(cube([1.5 - ROPE, top, -ROPE / 2], [ROPE, 2, ROPE], ROPE_SW))
    cubes.append(cube([-1.5, top + 2 - ROPE, -ROPE / 2], [3, ROPE, ROPE], ROPE_SW))
    return cubes


def lantern():
    """A lantern sat inside the glass: iron cage, flame within."""
    y = LIFT - 2.5
    return [
        cube([-1.5, y, -1.5], [3, 0.5, 3], IRON),
        cube([-1.5, y + 3.5, -1.5], [3, 0.5, 3], IRON),
        cube([-1, y + 0.5, -1], [2, 3, 2], FLAME),
        cube([-0.5, y + 4, -0.5], [1, 1, 1], IRON),
    ]


def hanger():
    """The rope up to the dock: one block long at rest, stretched by shipwright:drop."""
    top = LIFT + R + ROPE + 2
    return [cube([-ROPE / 2, top, -ROPE / 2], [ROPE, 16, ROPE], ROPE_SW)]


def geometry():
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": "geometry.shipwright.glass_float",
                "texture_width": TEX, "texture_height": TEX,
                "visible_bounds_width": 3, "visible_bounds_height": 6, "visible_bounds_offset": [0, 2, 0],
            },
            "bones": [
                {"name": "root", "pivot": [0, 0, 0]},
                {"name": "glass", "parent": "root", "pivot": [0, LIFT, 0], "cubes": ball()},
                {"name": "net", "parent": "root", "pivot": [0, LIFT, 0], "cubes": net()},
                {"name": "lantern", "parent": "root", "pivot": [0, LIFT, 0], "cubes": lantern()},
                {"name": "hanger", "parent": "root", "pivot": [0, LIFT + R + ROPE + 2, 0], "cubes": hanger()},
            ],
        }],
    }


def animations():
    return {
        "format_version": "1.8.0",
        "animations": {
            "animation.shipwright.glass_float.bob": {
                "loop": True,
                # afloat she rides the swell; hung she hardly stirs
                "bones": {"root": {"position": [0, "math.sin(q.life_time * 72) * (q.property('shipwright:drop') > 0 ? 0.15 : 0.6)", 0],
                                   "rotation": ["math.sin(q.life_time * 55) * 4", 0, "math.cos(q.life_time * 47) * 4"]}},
            },
            "animation.shipwright.glass_float.parts": {
                "loop": True,
                "bones": {
                    "hanger": {"scale": [1, "math.max(q.property('shipwright:drop'), 0.0001)", 1],
                               "position": [0, 0, 0]},
                },
            },
        },
    }


def client():
    return {
        "format_version": "1.10.0",
        "minecraft:client_entity": {
            "description": {
                "identifier": ID,
                "materials": {"default": "entity_alphablend"},
                "textures": {"default": "textures/entity/shipwright/glass_float"},
                "geometry": {"default": "geometry.shipwright.glass_float"},
                "animations": {"bob": "animation.shipwright.glass_float.bob", "parts": "animation.shipwright.glass_float.parts"},
                "scripts": {"animate": ["bob", "parts"]},
                "render_controllers": ["controller.render.shipwright.glass_float"],
            }
        },
    }


def render_controller():
    return {
        "format_version": "1.8.0",
        "render_controllers": {
            "controller.render.shipwright.glass_float": {
                "geometry": "Geometry.default",
                "materials": [{"*": "Material.default"}],
                "textures": ["Texture.default"],
                "part_visibility": [{"lantern": "q.property('shipwright:lantern')"},
                                    {"hanger": "q.property('shipwright:drop') > 0"}],
            }
        },
    }


def server():
    return {
        "format_version": "1.21.40",
        "minecraft:entity": {
            "description": {
                "identifier": ID, "is_spawnable": False, "is_summonable": True,
                "properties": {
                    "shipwright:lantern": {"type": "bool", "default": False, "client_sync": True},
                    "shipwright:drop": {"type": "float", "range": [0.0, 6.0], "default": 0.0, "client_sync": True},
                },
            },
            "components": {
                "minecraft:type_family": {"family": ["shipwright_float", "inanimate"]},
                "minecraft:collision_box": {"width": 0.75, "height": 0.75},
                "minecraft:physics": {"has_gravity": False, "has_collision": False},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
                "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
                "minecraft:health": {"value": 1, "max": 1},
                "minecraft:knockback_resistance": {"value": 1.0},
                "minecraft:nameable": {"always_show": False, "allow_name_tag_renaming": True},
                "minecraft:persistent": {},
            },
        },
    }


def item():
    return {
        "format_version": "1.21.40",
        "minecraft:item": {
            "description": {"identifier": ID, "menu_category": {"category": "items"}},
            "components": {
                "minecraft:icon": "shipwright_glass_float",
                "minecraft:max_stack_size": 16,
                "minecraft:display_name": {"value": "item.shipwright:glass_float.name"},
            },
        },
    }


def recipe():
    return {
        "format_version": "1.20.10",
        "minecraft:recipe_shaped": {
            "description": {"identifier": ID},
            "tags": ["crafting_table"],
            "pattern": [" S ", "SGS", " S "],
            "key": {"S": {"item": "minecraft:string"}, "G": {"item": "minecraft:glass"}},
            "unlock": [{"item": "minecraft:glass"}],
            "result": {"item": ID, "count": 2},
        },
    }


# ---- textures -------------------------------------------------------------------------------

def fill(img, sw, rgba, shade=None):
    u, v, w, h = sw
    for x in range(u, u + w):
        for y in range(v, v + h):
            c = rgba if shade is None else shade(x - u, y - v, rgba)
            img.putpixel((x, y), c)


def sheet():
    img = Image.new("RGBA", (TEX, TEX), (0, 0, 0, 0))
    fill(img, GLASS, (120, 190, 200, 110))                         # vision: sea-green glass, mostly clear
    fill(img, GLASS_HI, (190, 235, 240, 140))                      # vision: the bright of the glass
    fill(img, ROPE_SW, (150, 112, 70, 255), lambda x, y, c: c if (x + y) % 2 else (122, 90, 55, 255))   # vision: tarred hemp, laid
    fill(img, IRON, (60, 60, 68, 255))                             # vision: lantern iron
    fill(img, FLAME, (255, 214, 110, 255))                         # vision: lantern light
    return img


def icon():
    """16 px: the ball, its net and the eye."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    cx, cy, r = 7.5, 8.5, 6.2
    for x in range(16):
        for y in range(16):
            d = math.hypot(x - cx, y - cy)
            if d <= r:
                hi = (x - cx) + (y - cy) < -4
                img.putpixel((x, y), (200, 240, 245, 230) if hi else (110, 185, 195, 220))
            if abs(d - r) < 0.6 or (d < r and (abs(x - cx) < 0.6 or abs(y - cy) < 0.6)):
                img.putpixel((x, y), (140, 104, 64, 255))
    for x, y in ((6, 1), (7, 1), (8, 1), (9, 1), (6, 2), (9, 2)):
        img.putpixel((x, y), (140, 104, 64, 255))
    return img


def main():
    write(BP / "entities/glass_float.json", server())
    write(BP / "items/glass_float.json", item())
    write(BP / "recipes/glass_float.json", recipe())
    write(RP / "entity/glass_float.entity.json", client())
    write(RP / "render_controllers/glass_float.render_controllers.json", render_controller())
    write(RP / "models/entity/glass_float.geo.json", geometry())
    write(RP / "animations/glass_float.animation.json", animations())
    (RP / "textures/entity/shipwright").mkdir(parents=True, exist_ok=True)
    sheet().save(RP / "textures/entity/shipwright/glass_float.png")
    icon().save(RP / "textures/items/glass_float.png")
    it = RP / "textures/item_texture.json"
    d = json.loads(it.read_text())
    d["texture_data"]["shipwright_glass_float"] = {"textures": "textures/items/glass_float"}
    it.write_text(json.dumps(d, indent=2) + "\n")
    for lang in (BP / "texts/en_US.lang", RP / "texts/en_US.lang"):
        lines = lang.read_text().splitlines()
        for key in ("item.shipwright:glass_float.name=", "entity.shipwright:glass_float.name="):
            lines = [l for l in lines if not l.startswith(key)] + [key + "Glass Float"]
        lang.write_text("\n".join(lines) + "\n")
    print("glass float baked")


if __name__ == "__main__":
    main()
