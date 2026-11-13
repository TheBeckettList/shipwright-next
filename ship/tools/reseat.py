"""Rewrites only the seats, hit areas and hull-length property of every boat's behaviour entity, from the generated
proportions (BP/scripts/config/proportions.js), leaving the rest of each hand-tuned BP/entities file as it is.

    python3 tools/reseat.py      (after gen_assets.py, whenever seat heights, rails or mid-section counts change)

gen_entities.py's template is stale and must never be run (CONVENTIONS, "Ship models"); this borrows its seat and
hit-area rules and nothing else. A ship-class hull shows up to 8 mid sections (D-004: the ship class reaches 22
blocks), every other class 7, so the seat sets run to that many.
"""
import copy
import json

import gen_entities as GE

SEAT_HEIGHTS = GE.SEAT_HEIGHTS


def max_mids(pid):
    return 8 if GE.SCALE[pid] == 2 else 7          # derived: tools/gen_boats.py max_mids


def main():
    for pid in GE.BOATS:
        path = GE.BP / f"entities/{pid}.json"
        data = json.loads(path.read_text())
        e = data["minecraft:entity"]
        groups, events = e["component_groups"], e["events"]
        e["description"]["properties"]["shipwright:mids"]["range"] = [1, 8]   # BP/scripts/props.js RANGES
        old = [k for k in groups if k.startswith("shipwright:seats_")]
        base = copy.deepcopy(groups[old[0]]["minecraft:rideable"]) if old else copy.deepcopy(groups["shipwright:launched"]["minecraft:rideable"])
        for k in old:
            groups.pop(k)
            events.pop(k, None)
        seats = GE.PROPS[pid].get("seats", {"": [0.35, 0.35]})
        top = max_mids(pid)
        names = [f"shipwright:seats_{h}_{m}{'_' + band if band else ''}" for band in seats for h in SEAT_HEIGHTS for m in range(1, top + 1)]
        twin = GE.PROPS[pid].get("twin_gap", 0) * GE.SCALE[pid] / 2
        for band, (helm_y, crew_y) in seats.items():
            for h, y in SEAT_HEIGHTS.items():
                dy = y - SEAT_HEIGHTS["mid"]                            # the calibration nudge
                for m in range(1, top + 1):
                    r = copy.deepcopy(base)
                    zs = GE.seat_positions(pid, m)
                    r["seat_count"] = len(zs)
                    r["seats"] = [{"position": [round((twin if k % 2 == 0 else -twin), 3), round((helm_y if k == 0 else crew_y) + dy, 3), round(z, 3)],
                                   "min_rider_count": 0, "max_rider_count": len(zs)} for k, z in enumerate(zs)]
                    name = f"shipwright:seats_{h}_{m}{'_' + band if band else ''}"
                    groups[name] = {"minecraft:rideable": r, "minecraft:custom_hit_test": {"hitboxes": GE.hit_areas(pid, m)}}
                    events[name] = {"remove": {"component_groups": [n for n in names if n != name]}, "add": {"component_groups": [name]}}
        path.write_text(json.dumps(data, indent=2))
    print(f"Reseated {len(GE.BOATS)} boats")


if __name__ == "__main__":
    main()
