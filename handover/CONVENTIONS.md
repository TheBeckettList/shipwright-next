# House rules

These are the rules the code already follows (read out of it at S000). Changing one needs a DECISIONS entry.

## Code
1. **`core/` is pure.** No `@minecraft/*` imports, no state outside its arguments, no free numbers.
2. **Every literal is tagged.** `// given:` (Minecraft/Earth), `// vision:` (our choice, with the reason), or it's
   derived in code. New constants go in `core/given.js`.
3. **Laws are reversible ops** (shear/record) on fixed-point state. A shear never reads its own key.
4. **`data/` is baked, never edited.** Change the source and re-run the bake (`tools/buildmod.mjs`).
5. **`game/calibration.js` is written only by `tools/calibrate.mjs`**, one Fibonacci rung at a time, with history.
   When a probe disagrees with a *law*, report it; don't calibrate it away.
6. **Timers divide the bar.** Any new periodic duty: period divides 200 ticks, registered in `tempo.js`'s
   `TEMPO` with a cost weight. No bare `system.runInterval`.
7. **Systems start through `start(name, fn)`** (`ship/boot.js`) so one failure never takes the rest down.
8. **Probes are one JSON line** `[WWPROBE] {k, t, cal, …}` and always carry the sim's prediction beside what
   the game saw.
9. **Each file opens with a header comment** saying what it is and how it works. `CODEBASE.md` is generated
   from these, so keep them true.
10. Builds are drawn once in their own frame and placed with the D4 matrices (`core/frames.js`); unknown
    directional block states are reported, not guessed.
11. Decisions an NPC or agent makes go through gates (`core/gates.js`, `ship/config/culturegates.js`):
    `must` / `prefer`, ties to the first listed, every verdict carries its reasons.

## The source tree (`shipwright-next`, from S001)
| Folder | Holds | Ends up in the build as |
|---|---|---|
| `core/`, `world/`, `game/` | the math, the world, what the game lays | `BP/scripts/core|world|game` |
| `mod/scripts/` | game entry: main, lay, rings, tempo, probe, bank | `BP/scripts/*.js` |
| `ship/` | the ship module (its own BP/RP, tests, tools) | `BP/scripts/ship/`, entities, models |
| `pack/RP/` | resource pack sources | `RP/` |
| `tools/` | bake, lab lenses, calibrate, generators, modtest | — |
| `lab/` | Bedrock id lists, sim readings, grown towns | — |
| `tests/`, `ship/tests/` | test suites and inherency ratchets | — |
| `viewer/` | the world viewer page | artifact "Waterworld — world viewer" |
| `dev/`, `ww` | the test-server kit | copied into update zips |

Commands (repo root; `npm install` first): bake `node tools/buildmod.mjs` (~3.5 min → `dist/`) · `npm test` ·
`npm run modtest` (no bad blocks) · `npm run ship:test` · `node tools/lab.mjs inherency` (must be 0) ·
`node ship/tools/lab/inherency.mjs` (ratchet in `ship/tests/inherency.json`, 2494 at S001: may fall, never rise) ·
after editing `game/ground.js`, `world/city.js`, `world/forms.js`, `world/building.js`: `node tools/bakegrown.mjs --restamp [n]`.

## Ship models (from S001)
1. Edit `ship/tools/gen_boats.py` (and `sailcloth.py`), then `python3 tools/gen_assets.py` in `ship/`.
2. **`gen_assets.py` deletes `RP/models/entity/shield_peg.geo.json`** — copy it first, restore it after.
3. `python3 tools/gen_icons.py` for the edit-screen icons.
4. **Never run `tools/gen_entities.py`** — its template is stale and overwrites hand-tuned `BP/entities`.
   To add a boat, copy an analogue's BP entity (with `sed`).
5. Regenerate `tools/rig_targets.json` after changing hulls or plans (recipe in `viewer-wip/README.md`).

## Namespaces and ids
- `waterworld:` — dimension `waterworld:sea`, entity `waterworld:folk`, script events, fogs.
- `shipwright:` — boats (28 entity types), items (chart_book, sea_chart, captains_key), blocks, script events.
- Block textures: `RP/textures/blocks/waterworld/`, `…/shipwright/`.

## Versions and builds
- The version is written in **two** source places: `tools/buildmod.mjs` (`VERSION` array) and `mod/scripts/main.js`
  (`VERSION` string). The bake writes the manifests from the first.
- BP and RP versions move **together**, and each manifest's dependency on the other moves with them.
  Header, every module, and the dependency: all the same triple.
- Patch (0.9.**x**) for fixes and tuning; minor (0.**x**.0) for a new system or a world rebake.
- A hand-off ships `handover-<version>.zip` holding `build/` (`Waterworld-<version>.mcaddon`,
  `waterworld-update-<version>.zip`), `shipwright-next-src-<version>.zip`, renders and WIP, and its HANDOVER.md.
  Copy that HANDOVER.md into `handover/stages/` beside your stage file (as S001 did).
- Write the zip's SHA-256 into STATE.md (`shasum -a 256 file.zip`).

## Git (from S001)
- Repo: `shipwright simuldev/shipwright-next/` (local; a GitHub remote can be added any time: `git remote add origin …`).
- `main` = the last handed-off stage. Every hand-off is a merge commit plus an annotated tag `v<version>`.
- Work on `stage/S00n-<code>`. Commit as you go; messages say *why*, like the code comments.
- **Not in git:** `node_modules/`, `dist/`, the test server's world (`dev/data/`), and every packaged build
  (`*.mcaddon`, `waterworld-update*.zip`, `handover-*.zip`, source zips). Builds live beside the repo in the top
  folder (and later as GitHub releases). `.gitignore` enforces this.
- The source zip in a hand-off is now optional: the tag *is* the source. Keep shipping it until everyone is on git.

## Testing before hand-off
- `npm test`, `node tools/lab.mjs inherency` (0), `npm run ship:test` (failures listed), `npm run modtest`.
- Server reports `[Waterworld] Scripts <version> loaded` (`ww status`).
- `/scriptevent shipwright:check` passes (or failures are listed in your stage file).
- `ww errors` is clean or every line is explained in your stage file.
- If you touched laying/rings/tempo: `ww soak` and/or `ww fly`, and attach the probes summary.
