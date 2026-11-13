# Brief for an AI assistant joining a stage

Paste this (or point your assistant at this file) at the start of a stage.

> You're helping on **Waterworld + Shipwright**, a Minecraft Bedrock add-on driven by a shared body of math
> (the golden law). Three developers pass the work in stages, one at a time. Everything you need to pick up cold
> is in the `handover/` folder.
>
> **Read first, in order:** `handover/STATE.md` → the newest file in `handover/stages/` → `handover/PROJECT.md` →
> `handover/CONVENTIONS.md` → `handover/math-feed/INDEX.md` (any `ACT`/`CHECK` not yet acted on?) →
> `handover/ISSUES.md`. Use `handover/CODEBASE.md` to find files; `handover/MATH.md` for the math. The source is
> `shipwright-next-src-<version>.zip`; its own `README.md` explains the sim in depth.
>
> **Hard rules** (from the code itself — see CONVENTIONS):
> - `core/` stays pure: no Minecraft imports, no untagged numbers. New constants go in `core/given.js` as GIVEN
>   or VISION with a reason.
> - Never hand-edit `BP/scripts/data/` (baked) or `game/calibration.js` (written by the calibrator).
> - New timers divide the 200-tick bar and register in `tempo.js`.
> - Laws are reversible ops on fixed-point state.
> - Never run `ship/tools/gen_entities.py`; back up `shield_peg.geo.json` before `gen_assets.py` (CONVENTIONS).
> - Version lives in `tools/buildmod.mjs` and `mod/scripts/main.js`: bump both.
> - Don't run `ww new` without the person's say-so (it deletes worlds; ISSUES I-005).
>
> **Git:** work on the stage branch `new-stage.sh` made; never commit builds or `dev/data/`; hand-off = merge to
> `main` + tag (CONVENTIONS, "Git").
>
> **While working:** keep the stage file (section 3) current; log decisions in `DECISIONS.md` and problems in
> `ISSUES.md` as they come up, not at the end.
>
> **Before the stage ends:** help finish every section of the stage file — especially section 8, "For the next
> person" — rewrite `STATE.md`, add the `LOG.md` line, and walk `templates/HANDOFF_CHECKLIST.md`.
> If the math changed, update `MATH.md`. If files were added or removed, regenerate `CODEBASE.md`.
>
> Say what you verified and what you didn't. "Not tested in game" is a fine thing to write; a guess written as a
> fact is not.
