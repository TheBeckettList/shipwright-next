"""Draws the edit screen's 8-bit icons into RP/textures/ui/shipwright/.

16x16 sprites scaled to 32x32, in a flat palette sampled from vanilla planks, wool and metals.
    python3 tools/gen_icons.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "RP/textures/ui/shipwright"

PAL = {
    ".": None,
    "W": (102, 153, 214),   # water
    "w": (64, 110, 170),    # deep water
    "S": (235, 230, 215),   # sailcloth
    "R": (176, 46, 38),     # red wool
    "M": (98, 72, 44),      # mast / dark wood
    "H": (150, 112, 66),    # hull wood
    "h": (110, 80, 46),     # hull shade
    "K": (40, 40, 44),      # black / iron
    "I": (190, 190, 196),   # iron
    "i": (140, 140, 148),   # iron shade
    "C": (184, 115, 51),    # copper
    "G": (230, 190, 60),    # gold / lantern
    "B": (226, 222, 205),   # bone
    "L": (139, 90, 56),     # leather
    "Y": (110, 160, 60),    # green (check)
    "O": (60, 60, 60),      # outline
    "g": (120, 120, 120),   # stone
    "E": (90, 160, 210),    # ice
    "P": (200, 60, 60),     # bed red
}

WOOD = {
    "faering": (114, 84, 48), "rowboat": (162, 130, 78), "bark_canoe": (196, 179, 123),
    "outrigger": (160, 115, 80), "sewn_boat": (168, 90, 50), "sampan": (194, 173, 80),
    "wasen": (226, 178, 172), "dugout": (66, 43, 20), "punt": (117, 54, 48), "kayak": (139, 90, 56),
    "longship": (114, 84, 48),
}

SPRITES = {
    "sail_square": ["................", ".......M........", "...SSSSSSSSSS...", "...SSSSSSSSSS...", "...SSSSSSSSSS...",
                    "...SSSSSSSSSS...", "...SSSSSSSSSS...", "...SSSSSSSSSS...", ".......M........", ".......M........",
                    ".......M........", ".hHHHHHHHHHHHHh.", "..hHHHHHHHHHHh..", "WWWWWWWWWWWWWWWW", "wwwwwwwwwwwwwwww", "................"],
    "sail_fore":   ["................", "......M.........", "......MS........", "......MSS.......", "......MSSS......",
                    "......MSSSS.....", "......MSSSSS....", "......MSSSSSS...", "......MSSSSSSS..", "......M.........",
                    "......M.........", ".hHHHHHHHHHHHHh.", "..hHHHHHHHHHHh..", "WWWWWWWWWWWWWWWW", "wwwwwwwwwwwwwwww", "................"],
    "sail_none":   ["................", "................", "................", "................", "................",
                    "................", "................", "................", "................", "................",
                    "................", ".hHHHHHHHHHHHHh.", "..hHHHHHHHHHHh..", "WWWWWWWWWWWWWWWW", "wwwwwwwwwwwwwwww", "................"],
    "prop_oars":   ["................", "..............M.", ".............M..", "............M...", "...........M....",
                    "..........M.....", ".........M......", "........M.......", ".......M........", "......M.........",
                    ".....M..........", "....M...........", "...HH...........", "..HHH...........", ".HHH............", "................"],
    "prop_paddles":["................", ".......M........", ".......M........", ".......M........", ".......M........",
                    ".......M........", ".......M........", ".......M........", ".......M........", "......HHH.......",
                    "......HHH.......", "......HHH.......", "......HHH.......", ".......H........", "................", "................"],
    "prop_double": ["................", ".HH.............", ".HHH............", "..HHM...........", "....M...........",
                    ".....M..........", "......M.........", ".......M........", "........M.......", ".........M......",
                    "..........M.....", "...........MHH..", "............HHH.", ".............HH.", "................", "................"],
    "prop_scull":  ["................", "..M.............", "...M............", "....M...........", ".....M..........",
                    "......M.........", ".......M........", "........M.......", ".........M......", "..........M.....",
                    "...........HH...", "...........HHH..", "WWWWWWWWWWWHHHWW", "wwwwwwwwwwwwHHww", "................", "................"],
    "prop_pole":   ["........M.......", "........M.......", "........M.......", "........M.......", "........M.......",
                    "........M.......", "........M.......", "........M.......", "........M.......", "........M.......",
                    "WWWWWWWWMWWWWWWW", "wwwwwwwwMwwwwwww", "wwwwwwwwMwwwwwww", "gggggggggggggggg", "gggggggggggggggg", "................"],
    "power_none":  ["................", "................", "...OOOOOOOOOO...", "...O........O...", "...O........O...",
                    "...O........O...", "...O........O...", "...O........O...", "...O........O...", "...O........O...",
                    "...O........O...", "...OOOOOOOOOO...", "................", "................", "................", "................"],
    "anchor_stone":["................", "......gggg......", "......g..g......", "......gggg......", ".......gg.......",
                    "....gggggggg....", ".......gg.......", ".......gg.......", ".......gg.......", ".g.....gg.....g.",
                    ".gg....gg....gg.", "..gg...gg...gg..", "...gggggggggg...", ".....gggggg.....", "................", "................"],
    "anchor_iron": ["................", "......IIII......", "......I..I......", "......IIII......", ".......Ii.......",
                    "....IIIIIIII....", ".......Ii.......", ".......Ii.......", ".......Ii.......", ".I.....Ii.....I.",
                    ".Ii....Ii....Ii.", "..Ii...Ii...Ii..", "...IIIIIIIIIIi..", ".....iiiiii.....", "................", "................"],
    "hold":        ["................", "................", "..hhhhhhhhhhhh..", "..hHHHHHHHHHHh..", "..hHHHHHHHHHHh..",
                    "..hhhhhhhhhhhh..", "..hHHHHKKHHHHh..", "..hHHHHGGHHHHh..", "..hHHHHHHHHHHh..", "..hHHHHHHHHHHh..",
                    "..hHHHHHHHHHHh..", "..hhhhhhhhhhhh..", "................", "................", "................", "................"],
    "ram":         ["................", "................", "................", "................", "...........CC...",
                    ".hHHHHHHHHHCCCC.", ".hHHHHHHHHCCCCC.", "..hHHHHHHHHCCC..", "...hHHHHHHHH....", "WWWWWWWWWWWWWWWW",
                    "wwwwwwwwwwwwwwww", "................", "................", "................", "................", "................"],
    "bunk":        ["................", "................", "................", "................", "..SS............",
                    "..SSPPPPPPPPPP..", "..SSPPPPPPPPPP..", "..hhhhhhhhhhhh..", "..h..........h..", "..h..........h..",
                    "................", "................", "................", "................", "................", "................"],
    "lookout":     ["................", "......KKKK......", ".......KK.......", "......KGGK......", ".....KGGGGK.....",
                    ".....KGGGGK.....", ".....KGGGGK.....", "......KKKK......", ".......MM.......", ".......MM.......",
                    ".......MM.......", ".......MM.......", ".......MM.......", "................", "................", "................"],
    "crossbow":    ["................", ".......M........", "......MMM.......", "..KKKKKMKKKKK...", ".K.....M.....K..",
                    "K......M......K.", ".......M........", ".......M........", ".......M........", ".......M........",
                    "......MMM.......", "................", "................", "................", "................", "................"],
    "cannon":      ["................", "................", "................", "................", "...KKKKKKKKK....",
                    "..KKKKKKKKKKKK..", "..KKKKKKKKKKKKK.", "..KKKKKKKKKKKK..", "...KKKKKKKKK....", "....hh....hh....",
                    "...hHHh..hHHh...", "....hh....hh....", "................", "................", "................", "................"],
    "bell":        ["................", ".......KK.......", ".......KK.......", "......IIII......", ".....IEEEEI.....",
                    "....IEEEEEEI....", "....IEEEEEEI....", "...IEEEEEEEEI...", "...IEEEEEEEEI...", "..IIIIIIIIIIII..",
                    "................", "................", "................", "................", "................", "................"],
    "shield_rail": ["................", "................", "................", "................", ".RR..SS..RR..SS.",
                    "RRRRSSSSRRRRSSSS", "RRKRSSKSRRKRSSKS", "RRRRSSSSRRRRSSSS", ".RR..SS..RR..SS.", ".hHHHHHHHHHHHHh.",
                    "..hHHHHHHHHHHh..", "WWWWWWWWWWWWWWWW", "................", "................", "................", "................"],
    "castle":      ["................", "...H.H.H.H.H....", "...HHHHHHHHH....", "...HhhhhhhhH....", "...HHHHHHHHH....",
                    "...H.......H....", "...H.......H....", ".hHHHHHHHHHHHHh.", "..hHHHHHHHHHHh..", "WWWWWWWWWWWWWWWW",
                    "................", "................", "................", "................", "................", "................"],
    "light_hull":  ["................", "................", "................", "................", "...........SS...",
                    "..........SS....", ".........SS.....", "........SS......", "................", ".BB........BB...",
                    "..BBBBBBBBBB....", "...BBBBBBBB.....", "WWWWWWWWWWWWWWWW", "................", "................", "................"],
    "outrigger":   ["................", "................", "................", "...hHHHHHHHHh...", "....hHHHHHHh....",
                    ".....M....M.....", ".....M....M.....", ".....M....M.....", ".....M....M.....", "....MMMMMMMM....",
                    "...HHHHHHHHHH...", "WWWWWWWWWWWWWWWW", "................", "................", "................", "................"],
    "sewn_hull":   ["................", "................", "................", "................", ".hHHHHHHHHHHHHh.",
                    ".hSHHSHHSHHSHHh.", ".hHSHHSHHSHHSHh.", ".hHHHHHHHHHHHHh.", "..hHHHHHHHHHHh..", "WWWWWWWWWWWWWWWW",
                    "................", "................", "................", "................", "................", "................"],
    "bulkheads":   ["................", "................", "................", "................", ".hHHHHHHHHHHHHh.",
                    ".hH.hH..hH..hHh.", ".hH.hH..hH..hHh.", ".hHHHHHHHHHHHHh.", "..hHHHHHHHHHHh..", "WWWWWWWWWWWWWWWW",
                    "................", "................", "................", "................", "................", "................"],
    "deckhouse":   ["................", "................", ".....hhhhhh.....", "....hHHHHHHh....", "....hHKHHKHh....",
                    "....hHHHHHHh....", ".hHHHHHHHHHHHHh.", "..hHHHHHHHHHHh..", "WWWWWWWWWWWWWWWW", "................",
                    "................", "................", "................", "................", "................", "................"],
    "ice_runners": ["................", "................", "................", ".LLLLLLLLLLLLLL.", "..LLLLLLLLLLLL..",
                    "...B...B...B....", "...B...B...B....", ".BBBBBBBBBBBBBB.", "EEEEEEEEEEEEEEEE", "EEEEEEEEEEEEEEEE",
                    "................", "................", "................", "................", "................", "................"],
    "slot_empty":  ["................", "................", "...OOO....OOO...", "...O........O...", "...O........O...",
                    "................", "................", "................", "................", "................",
                    "...O........O...", "...O........O...", "...OOO....OOO...", "................", "................", "................"],
    "hull":        ["................", "................", "................", "................", "................",
                    ".H............H.", ".HH..........HH.", ".hHHHHHHHHHHHHh.", "..hHHHHHHHHHHh..", "...hHHHHHHHHh...",
                    "................", "................", "................", "................", "................", "................"],
    "launch":      ["................", ".......Y........", "......YYY.......", ".....YYYYY......", "....YYYYYYY.....",
                    ".......Y........", ".......Y........", ".......Y........", ".hHHHHHHHHHHHHh.", "..hHHHHHHHHHHh..",
                    "WWWWWWWWWWWWWWWW", "wwwwwwwwwwwwwwww", "................", "................", "................", "................"],
    "done":        ["................", "................", "................", "...............Y", "..............YY",
                    ".............YY.", "............YY..", "..Y........YY...", "..YY......YY....", "...YY....YY.....",
                    "....YY..YY......", ".....YYYY.......", "......YY........", "................", "................", "................"],
}


def draw(rows, wood=None):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row[:16]):
            c = PAL.get(ch)
            if ch in "Hh" and wood:
                c = wood if ch == "H" else tuple(int(v * 0.75) for v in wood)
            if c:
                px[x, y] = c + (255,)
    return img.resize((32, 32), Image.NEAREST)


BOAT_ROWS = {
    "faering":    ["................", ".......M........", "....RRRRRRR.....", "....RSSRSSR.....", "....RRRRRRR.....", ".......M........",
                   "H......M.......H", "HH.............H", ".HHHHHHHHHHHHHH.", "..hHHHHHHHHHHh..", "WWWWWWWWWWWWWWWW"],
    "rowboat":    ["................", ".......M........", "....SSSSSSS.....", "....SSSSSSS.....", "....SSSSSSS.....", ".......M........",
                   ".......M......HH", "H.............HH", "HHHHHHHHHHHHHHHH", ".hHHHHHHHHHHHHHh", "WWWWWWWWWWWWWWWW"],
    "bark_canoe": ["................", "................", "................", "................", "................", "................",
                   "H..............H", "HH............HH", ".HHHHHHHHHHHHHH.", "...hHHHHHHHHh...", "WWWWWWWWWWWWWWWW"],
    "outrigger":  ["................", "......M.........", "......MSSS......", "......MSSSSS....", "......MSSSSSS...", "......M.........",
                   "...MM..M...MM...", "H..MM.....MM...H", ".HHHHHHHHHHHHHH.", "..hHHHHHHHHHHh..", "WWHHHHHHHHHHHHWW"],
    "sewn_boat":  ["................", ".....M..........", ".....MSS........", ".....MSSSS......", ".....MSSSSSS....", ".....M..........",
                   "H....M.........H", "HH............HH", ".HHHHHHHHHHHHHH.", "..hHHHHHHHHHHh..", "WWWWWWWWWWWWWWWW"],
    "sampan":     ["................", "......M.........", "......MSSSS.....", "......MSSSS.....", "......MSSSS.....", "......M.........",
                   "HH....M.........", "HH.............H", ".HHHHHHHHHHHHHHH", "..hHHHHHHHHHHHHH", "WWWWWWWWWWWWWWWW"],
    "wasen":      ["H...............", "H......M........", "H...SSSSSSS.....", "H...SSSSSSS.....", "H...SSSSSSS.....", "H......M........",
                   "HH.....M.......H", ".H.............H", ".HHHHHHHHHHHHHHH", "..hHHHHHHHHHHHHH", "WWWWWWWWWWWWWWWW"],
    "dugout":     ["................", "................", "................", "................", "................", "................",
                   "................", "hH............Hh", "hHHHHHHHHHHHHHHh", ".hhHHHHHHHHHHhh.", "WWWWWWWWWWWWWWWW"],
    "punt":       ["................", "................", "................", "................", "................", "................",
                   "................", "................", "HHHHHHHHHHHHHHHH", "hhhhhhhhhhhhhhhh", "WWWWWWWWWWWWWWWW"],
    "longship":   ["......M.........", "..RRRRRRRRRRR...", "..RSSRSSRSSRR...", "..RRRRRRRRRRR...", "..RSSRSSRSSRR...", "......M.........",
                   "H.....M........H", "HH.RR.RR.RR.RRHH", ".HHHHHHHHHHHHHH.", "..hHHHHHHHHHHh..", "WWWWWWWWWWWWWWWW"],
    "kayak":      ["................", "................", "................", "................", "................", "................",
                   "........K.......", ".H.....KKK.....H", "HHHHHHHHHHHHHHHH", ".hHHHHHHHHHHHHh.", "WWWWWWWWWWWWWWWW"],
}


# Boat icons are rendered from the models themselves, so they always match.
BOAT_WOOD = {
    "faering": (114, 84, 48), "longship": (114, 84, 48), "rowboat": (162, 130, 78), "cog": (162, 130, 78),
    "bark_canoe": (226, 222, 210), "freight_canoe": (226, 222, 210), "outrigger": (160, 115, 80), "voyaging_canoe": (160, 115, 80),
    "sewn_boat": (168, 90, 50), "dhow": (168, 90, 50), "sampan": (194, 173, 80), "junk": (194, 173, 80),
    "wasen": (226, 178, 172), "bezaisen": (226, 178, 172), "dugout": (66, 43, 20), "war_canoe": (66, 43, 20),
    "punt": (117, 54, 48), "flatboat": (117, 54, 48), "kayak": (139, 90, 56), "umiak": (139, 90, 56),
    "skeid": (114, 84, 48), "carrack": (162, 130, 78), "baghlah": (168, 90, 50), "fuchuan": (194, 173, 80),
    "shuinsen": (226, 178, 172), "drua": (160, 115, 80),
    "theran_skiff": (232, 226, 210), "theran_ship": (232, 226, 210), "theran_flagship": (232, 226, 210),
    "league_monoreme": (150, 104, 62), "league_bireme": (150, 104, 62), "league_trireme": (150, 104, 62),
}
BOAT_RIG = {"faering": "square", "longship": "square", "rowboat": "square", "cog": "square", "outrigger": "crab",
            "voyaging_canoe": "crab", "sewn_boat": "lateen", "dhow": "lateen", "sampan": "junk", "junk": "junk",
            "wasen": "square", "bezaisen": "square", "skeid": "square", "carrack": "square", "baghlah": "lateen",
            "fuchuan": "junk", "shuinsen": "square", "drua": "crab", "theran_ship": "square", "theran_flagship": "square",
            "league_monoreme": "square", "league_bireme": "square", "league_trireme": "square"}


def render_boat_icon(pid):
    """A 16x16 side view from the boat's own model: hull in its material, its rig above, on water."""
    import json
    geo = json.loads((ROOT / f"RP/models/entity/{pid}.geo.json").read_text())["minecraft:geometry"][0]["bones"]
    mids = 3
    cubes = []
    for b in geo:
        n = b["name"]
        zone = "_".join(n.split("_")[:2]) if n.startswith("mid_") else n.split("_")[0]
        if not n.endswith("_plank") or (zone.startswith("mid_") and int(zone.split("_")[1]) >= mids):
            continue
        dz = mids * 8 - ((mids + 3) / 2 - 1) * 16 + ((7 - mids) * 16 if zone == "bow" else 0)
        for c in b["cubes"]:
            if pid in ("voyaging_canoe", "drua") and c["origin"][0] > 15:
                continue                                     # the second hull hides behind the first
            cubes.append((c["origin"][2] + dz, c["origin"][2] + dz + c["size"][2], c["origin"][1], c["origin"][1] + c["size"][1]))
    z0 = min(c[0] for c in cubes); z1 = max(c[1] for c in cubes)
    y1 = max(c[3] for c in cubes)
    sx = 14 / (z1 - z0)
    sy = min(sx * 1.9, 7 / max(1, y1))       # exaggerate height a little so the hull shape reads
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    wood = BOAT_WOOD.get(pid, (150, 112, 66))
    base = 13                                                # waterline row
    for (a, b2, ya, yb) in cubes:
        for x in range(int(1 + (a - z0) * sx), int(1 + (b2 - z0) * sx + 0.999)):
            for y in range(int(ya * sy), int(yb * sy + 0.999)):
                yy = base - y
                if 0 <= x < 16 and 0 <= yy < 16:
                    px[x, yy] = (wood if y > 1 else tuple(int(v * 0.75) for v in wood)) + (255,)
    rig = BOAT_RIG.get(pid)
    if rig:
        mx, top = 8, 1
        hull_top = min(yy for yy in range(16) for x in range(16) if px[x, yy][3] and x == mx) if any(px[mx, yy][3] for yy in range(16)) else base - 3
        for yy in range(top, hull_top):
            px[mx, yy] = (98, 72, 44, 255)
        cloth = (238, 234, 222, 255) if pid not in ("faering", "longship") else (178, 46, 38, 255)
        if rig == "square":
            for yy in range(top + 1, top + 5):
                for x in range(mx - 4, mx + 5):
                    px[x, yy] = cloth
        elif rig == "lateen":
            for k in range(6):
                for x in range(mx - 2 + k, mx + 4):
                    px[x, top + 5 - k] = cloth
        elif rig == "crab":
            for k in range(5):
                px[mx - 2 - k // 2, top + 5 - k] = (98, 72, 44, 255)
                px[mx + 1 + k, top + 5 - k] = (98, 72, 44, 255)
                for x in range(mx - 1 - k // 2, mx + 1 + k):
                    px[x, top + 5 - k] = cloth
        else:   # junk: a tall battened panel
            for yy in range(top, top + 6):
                for x in range(mx - 3, mx + 2):
                    px[x, yy] = (60, 50, 40, 255) if yy % 2 == 0 else cloth
    for x in range(16):
        for yy in (14, 15):
            if not px[x, yy][3]:
                px[x, yy] = ((102, 153, 214) if yy == 14 else (64, 110, 170)) + (255,)
    return img.resize((32, 32), Image.NEAREST)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, rows in SPRITES.items():
        draw(rows).save(OUT / f"{name}.png")
    for pid in BOAT_WOOD:
        render_boat_icon(pid).save(OUT / f"boat_{pid}.png")
    print("Wrote", len(SPRITES) + len(BOAT_WOOD), "icons to", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
