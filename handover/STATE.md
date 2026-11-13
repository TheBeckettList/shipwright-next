# STATE — the baton

> **Rewrite this whole page when you hand off.** It should always answer: if I pick this up cold,
> what do I have, does it work, and what do I do first? Keep it under a screen or two.

**Baton:** R (Richard) — after **S001** (0.9.13), filed 2026-11-12
**Next holder:** _(fill in)_

> **In progress: S002-R** on `stage/S002-R` — 0.9.13 in game + `ship:test` (`stages/S002-2026-11-12-R.md`).

## The build (all at the top of this folder)

| | File | SHA-256 |
|---|---|---|
| Update pack (for `ww update`) | `waterworld-update-0.9.13.zip` | `84b17ea082bdabbd67594cb3cfdd791732419c0acf100f8983fd834e993a1f61` |
| Full add-on | `Waterworld-0.9.13.mcaddon` | `e891b19fe6215751c5a9229b2c71c9f61a4f34558c33f386b637032c1c8aa11f` |
| Stage bundle (build + **source** + renders + viewer WIP) | `handover-0.9.13.zip` | `c6d37886932bfc84e8b680edd222b0331c448ba7e200860f13d2d132b8b27be9` |

Source: **git repo `shipwright-next/`** (this package is inside it at `handover/`), `main` @ tag `v0.9.13`.
`npm install` first. The same source is also in `handover-0.9.13.zip` → `shipwright-next-src-0.9.13.zip`.
Dev kit: the `ww` script and `dev/` are in the source tree and in every update zip. First-time setup on a new
machine still follows the old `START HERE` steps (I-007).

## Does it work?
| Check | Result |
|---|---|
| Loaded in game | **No — not yet.** First job of the next stage. |
| `npm test` | 53 pass (stage report). Not re-run here: it outlasts this shell's 3-minute limit. |
| `node tools/lab.mjs inherency` | **0 free numbers** (re-run when filing ✔) |
| `npm run ship:test` | 282 pass, 8 fail (stage report; some fixed in source since — rerun) → I-011 |
| Versions consistent | 0.9.13 in buildmod.mjs, main.js, BP manifest, RP dependency ✔ |

## What's new in 0.9.13 (S001)
Rounded, planked hulls; swept stems; cast rams; cut-cloth sails sized by the physics; per-rig masts. Theran Foiler,
Catamaran, Trimaran (wing rigs, gold ram, buy-only) and League mono/bi/trireme galleys (buy-only, not yet buyable
or sailing in the world). Full write-up: `stages/S001-HANDOVER-0.9.13.md`.

## Open, in priority order
1. **Load 0.9.13 in game.** Hulls, stems, sails, canted wings. If hulls look inside-out → I-012.
2. **I-010** — the repo is local; add a private GitHub remote so A and B can clone.
3. **I-013** — share the "Physics Sim Game Sandbox" project with A and B, or export its design docs here.
4. **I-011** — rerun `ship:test`, fix or re-expect the 6 real failures.
5. Then the stage's own list: world viewer 3D → Theran physics and buying → Sail Loft → Thera builds → ship port.
6. Housekeeping: I-005 (`ww new` reach), I-006 (A/B platforms), I-002 (`waterworld:struct`).

## Direction
D-003: the sim and Minecraft are two ways into one world — adventure in the sim, drop into the game when you
want to play, the server's sim running in parallel on purpose.

## Math feed
Latest: **MF-001** (LA review 11, 2026-11-12) — METHOD only; nothing to act on in code.

## First thing the next person does
Read `README.md`, then `stages/S001-2026-11-12-R.md` and its full write-up. Then
`bash handover/bin/new-stage.sh <code> "<title>"`.
