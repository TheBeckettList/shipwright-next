"""Writes the faering's seats, hit areas and launch group into BP/entities/faering.json.

Seats sit at (or right beside) the entity's pivot. The hull model is shifted so
its helm is over the pivot (see HELM_FROM_STERN in gen_assets.py), so a rider
there can't swing out of the hull no matter how the engine rotates seats.

    python3 tools/gen_seats.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENTITY = ROOT / "BP/entities/faering.json"
SEAT_Y = 0.1
SECOND_SEAT_Z = -0.7   # just forward of the helm, still inside the hull


def main():
    data = json.loads(ENTITY.read_text())
    ent = data["minecraft:entity"]
    groups, events = ent["component_groups"], ent["events"]
    for k in [k for k in groups if k.startswith("shipwright:seats_")]:
        del groups[k]
    for k in [k for k in events if k.startswith("shipwright:seats_")]:
        del events[k]
    groups["shipwright:launched"] = {"minecraft:rideable": {
        "seat_count": 2,
        "family_types": ["player"],
        "interact_text": "action.interact.ride.boat",
        "pull_in_entities": False,
        "seats": [
            {"position": [0.0, SEAT_Y, 0.0], "min_rider_count": 0, "max_rider_count": 2},
            {"position": [0.0, SEAT_Y, SECOND_SEAT_Z], "min_rider_count": 0, "max_rider_count": 2},
        ],
    }}
    # Hit areas run forward from the pivot (helm) along the hull.
    groups["shipwright:size_small"]["minecraft:custom_hit_test"] = {
        "hitboxes": [{"width": 1.6, "height": 1.0, "pivot": [0, 0.5, z]} for z in (0, -1.5, -3.0, -4.5)]}
    groups["shipwright:size_large"]["minecraft:custom_hit_test"] = {
        "hitboxes": [{"width": 2.2, "height": 1.1, "pivot": [0, 0.55, z]} for z in (0, -2.0, -4.0, -6.0, -8.0)]}
    ENTITY.write_text(json.dumps(data, indent=2))
    print("seats at the pivot; hit areas forward along the hull")


if __name__ == "__main__":
    main()
