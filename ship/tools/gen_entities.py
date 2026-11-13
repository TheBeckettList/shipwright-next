"""Writes one behavior entity per tier-1 boat, using BP/entities/faering.json as the template.

    python3 tools/gen_entities.py    (run after gen_seats.py)
"""
import copy
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BP = ROOT / "BP"
TEMPLATE = BP / "entities/faering.json"

BOATS = {
    "faering": "Faering", "rowboat": "Rowboat", "bark_canoe": "Bark Canoe", "outrigger": "Outrigger Canoe",
    "sewn_boat": "Sewn Boat", "sampan": "Sampan", "wasen": "Wasen", "dugout": "Dugout", "punt": "Punt",
    "kayak": "Kayak", "longship": "Longship",
    "cog": "Cog", "freight_canoe": "Freight Canoe", "voyaging_canoe": "Voyaging Canoe", "dhow": "Dhow", "junk": "Junk",
    "bezaisen": "Bezaisen", "war_canoe": "War Canoe", "flatboat": "Flatboat", "umiak": "Umiak",
    "skeid": "Skeid", "carrack": "Carrack", "baghlah": "Baghlah", "fuchuan": "Fuchuan", "shuinsen": "Shuinsen", "drua": "Drua",
    "league_monoreme": "Monoreme", "league_bireme": "Bireme", "league_trireme": "Trireme", "theran_skiff": "Theran Skiff", "theran_ship": "Theran Ship", "theran_flagship": "Theran Flagship",
}
MEDIUM = ["longship", "cog", "freight_canoe", "voyaging_canoe", "dhow", "junk", "bezaisen", "war_canoe", "flatboat", "umiak"]
# Seat heights to calibrate in game (/scriptevent shipwright:seat low|mid|high); mid is the default.
SEAT_HEIGHTS = {"low": 0.1, "mid": 0.35, "high": 0.6}
PROPS = json.loads(re.search(r"export const PROPORTIONS = (\{.*\});", (BP / "scripts/config/proportions.js").read_text(), re.S).group(1))
SCALE = {pid: PROPS[pid].get("scale", 1) for pid in PROPS}           # the model's scale: 1 small, 2 medium, 4 large
MEDIUM = {pid for pid, s in SCALE.items() if s > 1}                   # medium and large ships: crew stations, a big collision box


def half_length(pid, mids):
    """Half the hull's length in blocks: (mid sections + the two ends) at the model's scale."""
    return (mids + 3) * SCALE[pid] / 2


def helm_from_centre(pid, mids):
    """How far aft of the craft's centre the helm is (blocks): one model block in from the stern tip."""
    return half_length(pid, mids) - SCALE[pid]


def seat_positions(pid, mids):
    """Seat z positions (blocks, -z forward) from the entity's origin, which is the helm. A small
    boat adds a passenger just ahead; medium ships space six crew stations evenly from the helm to
    two blocks short of the bow."""
    scale = SCALE[pid]
    half = half_length(pid, mids)
    helm = 0.0
    bow = -(half + helm_from_centre(pid, mids))
    if pid in ONE_SEAT:
        return [helm]
    if pid not in MEDIUM:
        return [helm, helm - 0.7 * scale]
    last = bow + 2 * scale
    n = 8 if scale >= 4 else 6                       # a large ship has eight crew stations
    return [helm + (last - helm) * k / (n - 1) for k in range(n)]


def hit_areas(pid, mids):
    """Hit boxes every two blocks along the whole hull, wide enough for twin hulls and floats."""
    scale = SCALE[pid]
    half = half_length(pid, mids)
    p = PROPS.get(pid, {})
    width = max(2.2 if scale == 1 else 3.2, (p.get("twin_gap", 0) + p.get("beam", 0)) * scale)
    if pid in FLOAT_BUILT_IN:                   # reach out to the float so it can be clicked
        width = max(width, 2 * (p.get("float_out", 0) + 0.4) * scale)
    off = helm_from_centre(pid, mids)               # measured from the helm, not the centre
    zs, z = [], half - 0.5
    while z > -half:
        zs.append(round(z - off, 2))
        z -= 2
    zs.append(round(-half + 0.5 - off, 2))
    # Tall enough to reach the rail, so it can be used from a raised deck too.
    hgt = max(1.1 if scale == 1 else 1.4, p.get("rail", 0) + 0.4)
    return [{"width": round(width, 2), "height": round(hgt, 2), "pivot": [0, round(hgt / 2, 2), z]} for z in zs]
ONE_SEAT = {"kayak"}
FLOAT_BUILT_IN = {"outrigger"}


def main():
    t = json.loads(TEMPLATE.read_text())
    ent = t["minecraft:entity"]
    props = ent["description"]["properties"]
    # Bedrock rejects every property if an entity has more than 32. Small values share a number
    # (see BP/scripts/props.js): three woods in "woods", on/off flags in "flags", small choices in "kinds".
    for legacy in ("wood_bow", "wood_mid", "wood_stern", "sail", "sail_set", "furnace", "furnace_lit", "outrigger",
                   "hull_scale", "rig_style", "prop_style", "power_type", "rudder_type", "orient"):
        props.pop(f"shipwright:{legacy}", None)
    props["shipwright:woods"] = {"type": "int", "range": [0, 1727], "default": 1 + 12 + 144, "client_sync": True}   # spruce x3
    props["shipwright:flags"] = {"type": "int", "range": [0, 31], "default": 2, "client_sync": True}               # sail set
    props["shipwright:kinds"] = {"type": "int", "range": [0, 16383], "default": 4, "client_sync": True}            # square rig


    props["shipwright:mods"] = {"type": "int", "range": [0, 4095], "default": 0, "client_sync": True}
    props["shipwright:deck"] = {"type": "int", "range": [0, 16 ** 7 - 1], "default": 0, "client_sync": True}   # 4 bits per station
    props["shipwright:rig_scale"] = {"type": "float", "range": [0.5, 3.0], "default": 1.0, "client_sync": True}
    for k in ("stroke_l", "stroke_r", "turn", "telltale"):
        props[f"shipwright:{k}"] = {"type": "float", "range": [-1.0, 1.0], "default": 0.0, "client_sync": True}
    # The boat's sea chest: 27 slots showing one player's own items at a time; a Hold doubles it.
    ent["components"]["minecraft:inventory"] = {"inventory_size": 27, "container_type": "container", "private": False, "restrict_to_owner": False}
    groups, events = ent["component_groups"], ent["events"]
    groups["shipwright:hold"] = {"minecraft:inventory": {"inventory_size": 54, "container_type": "container", "private": False, "restrict_to_owner": False}}
    events["shipwright:hold_on"] = {"add": {"component_groups": ["shipwright:hold"]}}
    events["shipwright:hold_off"] = {"remove": {"component_groups": ["shipwright:hold"]}}
    assert len(props) <= 32, f"{len(props)} entity properties: Bedrock allows 32"
    TEMPLATE.write_text(json.dumps(t, indent=2))

    for pid in BOATS:
        d = copy.deepcopy(t)
        e = d["minecraft:entity"]
        e["description"]["identifier"] = f"shipwright:{pid}"
        if pid in MEDIUM:
            # Narrower than the hull: the script feels the hull against the shore itself, and a box
            # as wide as the hull would wedge in a snug dock.
            e["component_groups"]["shipwright:size_large"]["minecraft:collision_box"] = {"width": 2.0, "height": 0.9}
        # Seats and hit areas, measured from the craft's centre (the entity's origin), for every hull
        # length (7 mid-section counts) at each of the three calibration heights. The script switches
        # to the right one; forward is -z.
        groups, events = e["component_groups"], e["events"]
        for grp in ("shipwright:size_small", "shipwright:size_large"):
            groups[grp].pop("minecraft:custom_hit_test", None)
        for old in ("low", "mid", "high"):
            groups.pop(f"shipwright:seat_{old}", None)
            events.pop(f"shipwright:seat_{old}", None)
        base = groups["shipwright:launched"]["minecraft:rideable"]
        base["family_types"] = ["player"]
        # Seat sets: every hull length x calibration height x depth band (a deep hull's seats ride
        # higher, so the helm sees over the rail; shallow and deep builds get their own sets).
        seats = PROPS[pid].get("seats", {"": [0.35, 0.35]})
        names = [f"shipwright:seats_{h}_{m}{'_' + band if band else ''}" for band in seats for h in SEAT_HEIGHTS for m in range(1, 8)]
        twin = PROPS[pid].get("twin_gap", 0) * SCALE[pid] / 2          # twin hulls: seats on the hulls, not over the gap
        for band, (helm_y, crew_y) in seats.items():
            for h, y in SEAT_HEIGHTS.items():
                dy = y - SEAT_HEIGHTS["mid"]                            # the calibration nudge
                for m in range(1, 8):
                    r = copy.deepcopy(base)
                    zs = seat_positions(pid, m)
                    r["seat_count"] = len(zs)
                    r["seats"] = [{"position": [round((twin if k % 2 == 0 else -twin), 3), round((helm_y if k == 0 else crew_y) + dy, 3), round(z, 3)],
                                   "min_rider_count": 0, "max_rider_count": len(zs)} for k, z in enumerate(zs)]
                    name = f"shipwright:seats_{h}_{m}{'_' + band if band else ''}"
                    groups[name] = {"minecraft:rideable": r, "minecraft:custom_hit_test": {"hitboxes": hit_areas(pid, m)}}
                    events[name] = {"remove": {"component_groups": [n for n in names if n != name]}, "add": {"component_groups": [name]}}
        if pid in ONE_SEAT:
            r = groups["shipwright:launched"]["minecraft:rideable"]
            r["seat_count"] = 1
            r["seats"] = r["seats"][:1]
            r["seats"][0]["max_rider_count"] = 1
        (BP / f"entities/{pid}.json").write_text(json.dumps(d, indent=2))

    lines = ["tile.shipwright:shipwright_table.name=Shipwright's Table", "tile.shipwright:gate_post.name=Gate Post"]
    lines += [f"entity.shipwright:{pid}.name={name}" for pid, name in BOATS.items()]
    lines += ["entity.shipwright:sea_chest.name=Sea Chest", "entity.shipwright:shield_peg.name=Shield",
              "action.interact.shipwright.shield=Take or hang a shield"]
    lines += ["pack.name=Shipwright", "pack.description=Historical boatbuilding from vanilla materials"]
    (ROOT / "RP/texts/en_US.lang").write_text("\n".join(lines) + "\n")
    print("Wrote", len(BOATS), "boat entities")


if __name__ == "__main__":
    main()
