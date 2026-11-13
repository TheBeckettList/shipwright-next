"""Builds the three files in dist/, fresh every time:

    shipwright-update.zip   what you download to update the dev server (dev/refresh.sh applies it):
                            BP, RP, dev, tools, tests at the top level, plus VERSION
    shipwright.mcaddon      double-click install for a device without the dev server
    shipwright-source.zip   the whole project in a shipwright/ folder

Each zip is written to a temporary name and checked (its BP manifest must carry this version)
before it replaces the old one, so a stale zip can never be sent out again.
"""
import json
import os
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
DIST.mkdir(exist_ok=True)
SKIP = {"node_modules", "data", "dist", "__pycache__"}
SKIP_FILES = {".netmode", "fresh-log.txt"}

version = json.loads((ROOT / "BP/manifest.json").read_text())["header"]["version"]
VERSION = ".".join(map(str, version))

# The scripts report the version they were built as, so the dev server can prove what it's running.
(ROOT / "BP/scripts/version.js").write_text(
    f'// Written by tools/package.py. The version these scripts were packaged as.\nexport const VERSION = "{VERSION}";\n')


def add(z, folder, arc):
    for root, dirs, files in os.walk(folder):
        dirs[:] = sorted(d for d in dirs if d not in SKIP)
        for f in sorted(files):
            if f in SKIP_FILES:
                continue
            p = Path(root) / f
            z.write(p, (Path(arc) / p.relative_to(folder)).as_posix())


def build(name, fill, manifest_path):
    tmp = DIST / f".{name}.tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        fill(z)
    with zipfile.ZipFile(tmp) as z:
        got = json.loads(z.read(manifest_path))["header"]["version"]
    if got != version:
        tmp.unlink()
        raise SystemExit(f"{name}: packaged version {got} != {version}")
    os.replace(tmp, DIST / name)
    return name


def update(z):
    for item in ("BP", "RP", "dev", "tools", "tests"):
        add(z, ROOT / item, item)
    for f in ("README.md", "package.json", ".gitignore"):
        if (ROOT / f).exists():
            z.write(ROOT / f, f)
    z.writestr("VERSION", VERSION + "\n")


def mcaddon(z):
    add(z, ROOT / "BP", "Shipwright_BP")
    add(z, ROOT / "RP", "Shipwright_RP")


def source(z):
    for item in ("BP", "RP", "tools", "tests", "dev"):
        add(z, ROOT / item, Path("shipwright") / item)
    for f in ("README.md", "package.json", ".gitignore"):
        if (ROOT / f).exists():
            z.write(ROOT / f, (Path("shipwright") / f).as_posix())


built = [build("shipwright-update.zip", update, "BP/manifest.json"),
         build("shipwright.mcaddon", mcaddon, "Shipwright_BP/manifest.json"),
         build("shipwright-source.zip", source, "shipwright/BP/manifest.json")]
print(f"Built {VERSION}:", *built)
