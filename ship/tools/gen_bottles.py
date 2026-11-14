"""Ships in bottles: one creative-menu item per plan; used on water, she's uncorked as a finished,
launched ship at a size of your choosing (the plan's Short, Typical and Long presets). For testing
and for creative worlds: no recipe.

Bakes BP/items/bottle_<plan>.json, the two icons (RP/textures/items/ship_in_bottle*.png), their
item_texture.json entries and the names in both en_US.lang files. The plans are read from
BP/scripts/config/plans.js (through node), so a new plan gets its bottle on the next bake.

    python3 ship/tools/gen_bottles.py
"""
import json
import subprocess
from pathlib import Path

from PIL import Image

SHIP = Path(__file__).resolve().parent.parent
BP, RP = SHIP / "BP", SHIP / "RP"
PLANS_JS = BP / "scripts/config/plans.js"

GLASS = (170, 215, 225, 150)        # vision: bottle glass
GLASS_HI = (225, 245, 250, 200)
CORK = (160, 120, 75, 255)
HULL = (110, 75, 45, 255)
SAIL = {"therans": (235, 190, 60, 255), None: (240, 236, 225, 255)}   # vision: Theran gold, else canvas
WATER = (60, 110, 170, 220)


def plans():
    js = f'import("{PLANS_JS.as_uri()}").then(m => console.log(JSON.stringify(Object.values(m.PLANS).map(p => ({{ id: p.id, name: p.name, tradition: p.tradition }})))))'
    return json.loads(subprocess.check_output(["node", "-e", js], text=True))


def icon(sail):
    """16 px: a bottle on its side, cork to the right, a little ship sailing inside."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.putpixel
    for x in range(1, 12):                      # the body
        for y in range(4, 13):
            edge = y in (4, 12) or x == 1
            px((x, y), GLASS_HI if edge else GLASS)
    for x in range(12, 14):                     # the neck
        for y in range(6, 11):
            px((x, y), GLASS_HI if y in (6, 10) else GLASS)
    for y in range(7, 10):                      # the cork
        px((14, y), CORK)
    for x in range(2, 11):                      # the sea in the bottle
        px((x, 11), WATER)
    for x in range(3, 10):                      # the hull
        px((x, 10), HULL)
    for x in (4, 9):
        px((x, 9), HULL)
    for y in range(5, 10):                      # the mast
        px((6, y), HULL)
    for y, (a, b) in zip(range(5, 9), ((7, 7), (7, 8), (7, 9), (7, 9))):   # the sail
        for x in range(a, b + 1):
            px((x, y), sail)
    for y, x in zip(range(6, 9), (5, 4, 4)):
        px((x, y), sail)
    return img


def item(p):
    gold = p["tradition"] == "therans"
    return {
        "format_version": "1.21.40",
        "minecraft:item": {
            "description": {"identifier": f"shipwright:bottle_{p['id']}",
                            "menu_category": {"category": "items"}},
            "components": {
                "minecraft:icon": "shipwright_ship_in_bottle_gold" if gold else "shipwright_ship_in_bottle",
                "minecraft:max_stack_size": 1,
                "minecraft:glint": gold,
                "minecraft:display_name": {"value": f"item.shipwright:bottle_{p['id']}.name"},
            },
        },
    }


def main():
    ps = plans()
    for old in (BP / "items").glob("bottle_*.json"):
        old.unlink()
    for p in ps:
        (BP / f"items/bottle_{p['id']}.json").write_text(json.dumps(item(p), indent=2) + "\n")
    icon(SAIL[None]).save(RP / "textures/items/ship_in_bottle.png")
    icon(SAIL["therans"]).save(RP / "textures/items/ship_in_bottle_gold.png")
    it = RP / "textures/item_texture.json"
    d = json.loads(it.read_text())
    d["texture_data"]["shipwright_ship_in_bottle"] = {"textures": "textures/items/ship_in_bottle"}
    d["texture_data"]["shipwright_ship_in_bottle_gold"] = {"textures": "textures/items/ship_in_bottle_gold"}
    it.write_text(json.dumps(d, indent=2) + "\n")
    for lang in (BP / "texts/en_US.lang", RP / "texts/en_US.lang"):
        lines = [l for l in lang.read_text().splitlines() if not l.startswith("item.shipwright:bottle_")]
        lines += [f"item.shipwright:bottle_{p['id']}.name={p['name']} in a Bottle" for p in ps]
        lang.write_text("\n".join(lines) + "\n")
    print(f"{len(ps)} ships in bottles baked")


if __name__ == "__main__":
    main()
