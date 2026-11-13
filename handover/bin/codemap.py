import os, re, sys
root = sys.argv[1]
groups = [("Entry and engine glue", ["main.js","lay.js","rings.js","tempo.js","probe.js","bank.js","b64.js"]),
          ("core/ — the pure math (no Minecraft imports)", "core"),
          ("world/ — the world's fields, read from the map", "world"),
          ("game/ — what the game lays (ground, rock, Theran buildings)", "game"),
          ("ship/ — Shipwright, folded in as the ship module", "ship"),
          ("ship/config/ — boat traditions, yards, plans, culture gates", "ship/config"),
          ("ship/world/ — Shipwright's world modules (homeport, port agents, peoples)", "ship/world"),
          ("data/ — BAKED by tools/buildmod.mjs. Never hand-edit.", "data")]
def head(p):
    out=[]
    with open(p, encoding="utf-8", errors="replace") as f:
        for i,l in enumerate(f):
            if i>12: break
            s=l.strip()
            if s.startswith("//"):
                t=s.lstrip("/ ").strip()
                if t.startswith("inherency:") or t.startswith("----") or not t: continue
                out.append(t)
                if len(" ".join(out))>150: break
            elif out: break
    t=" ".join(out)
    t=re.sub(r"\s+"," ",t)
    return (t[:200]+"…") if len(t)>200 else t
def size(p):
    if "/data/" in p: return f"{os.path.getsize(p)/1e6:.1f} MB"
    return f"{sum(1 for _ in open(p,encoding='utf-8',errors='replace'))} lines"
print("# Codebase map\n\nGenerated from each file's own header comment (the code documents itself; this is just the index). Built pack layout (BP/scripts). In the source tree these come from mod/scripts (entry files), core/, world/, game/, ship/BP/scripts (ship/), and data/ is written by tools/buildmod.mjs.\nRegenerate after big changes: `bash handover/bin/codemap.sh path/to/BP/scripts > handover/CODEBASE.md`.\n")
for title, g in groups:
    print(f"\n## {title}\n\n| File | Size | What it says it is |\n|---|---|---|")
    if isinstance(g, list): files=[os.path.join(root,f) for f in g if os.path.exists(os.path.join(root,f))]
    else:
        d=os.path.join(root,g)
        if not os.path.isdir(d): continue
        files=sorted(os.path.join(d,f) for f in os.listdir(d) if f.endswith(".js"))
    for p in files:
        rel=os.path.relpath(p,root)
        print(f"| `{rel}` | {size(p)} | {head(p).replace('|','/')} |")
