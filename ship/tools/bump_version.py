"""Bumps the patch version of both packs. Bedrock clients cache resource packs
by version, so bump after any RP change or the Switch keeps the old one."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
bp_path, rp_path = ROOT / "BP/manifest.json", ROOT / "RP/manifest.json"
bp, rp = json.loads(bp_path.read_text()), json.loads(rp_path.read_text())
new = bp["header"]["version"][:2] + [bp["header"]["version"][2] + 1]
for m in (bp, rp):
    m["header"]["version"] = new
    for mod in m["modules"]:
        mod["version"] = new
bp_uuid, rp_uuid = bp["header"]["uuid"], rp["header"]["uuid"]
for d in bp["dependencies"]:
    if d.get("uuid") == rp_uuid:
        d["version"] = new
for d in rp["dependencies"]:
    if d.get("uuid") == bp_uuid:
        d["version"] = new
bp_path.write_text(json.dumps(bp, indent=2))
rp_path.write_text(json.dumps(rp, indent=2))
print("Packs now at", ".".join(map(str, new)))
