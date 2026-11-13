# Working on this together

Two people now build at once, each with their own Claude Code: Richard and his assistant on the **ships**, a second
developer and theirs on the **cities and the landscape**. Both use the same GitHub login (TheBeckettList), so the
**branch name** says whose work is whose. (This relaxes the one-baton rule in `handover/README.md` into two streams;
see D-007 in `handover/DECISIONS.md`.)

## Setting up (once)

```
git clone https://github.com/TheBeckettList/shipwright-next
cd shipwright-next
npm test                      # the lenses, as tests; all should pass before you start
```

The world stream starts at **`handover/ONBOARDING-world-architect.md`**. Then point your Claude Code at **`handover/AI_BRIEF.md`** and have it read, in order: `handover/STATE.md`, the newest
file in `handover/stages/`, `handover/PROJECT.md`, `handover/CONVENTIONS.md`, `handover/math-feed/INDEX.md`,
`handover/ISSUES.md`. Every house rule there holds for both streams. The ones that bite most often:

- **Inherency.** Every number is a `given`, a `vision` (with its reason) or `derived`; anywhere outside
  `core/given.js` it carries a `// given:`, `// vision:` or `// derived:` tag on its line. The `inherency` lens counts
  the rest, and its ratchet is 0.
- **`core/` stays pure:** no Minecraft imports, no untagged numbers.
- **Never hand-edit baked data** (`BP/scripts/data/`, `game/calibration.js`); regenerate it.
- **Never run `ship/tools/gen_entities.py`.** Back up `ship/RP/models/entity/shield_peg.geo.json` before
  `gen_assets.py` and put it back after.
- **Never run `ww new`** (or anything that deletes worlds or files) without asking the person first.
- **Builds stay out of git** (`.mcaddon`, `.mcpack`, `dist/`, `dev/data/`; `.gitignore` has the list).
- The version lives in `tools/buildmod.mjs` and `mod/scripts/main.js`: bump both, together, and only on the stage
  branch (see below).

## Branches

| branch | who | what |
|---|---|---|
| `stage/S003-R` (default) | both, by pull request only | the current stage; what is true now |
| `s003/*` (`s003/therans`, `s003/league`, ...) | ships | boats, rigs, the engineering lens, `ship/`, `core/boat.js` |
| `world/<topic>` (e.g. `world/terraform`, `world/thera`, `world/cities`) | cities and landscape | `world/`, the map, towns, Thera, terrain |
| `main` | at hand-off | the last finished stage, tagged |

Start every piece of work on a fresh branch from the stage branch:

```
git switch stage/S003-R && git pull
git switch -c world/terraform       # or s003/<topic>
```

Commit small and often; push your branch whenever you stop (`git push -u origin world/terraform`).

## Getting work into the stage

1. `git pull origin stage/S003-R` into your branch (or rebase onto it) and fix any conflict on your side.
2. `npm test` passes, and the lenses you touched read clean (`node tools/lab.mjs <lens>`).
3. Open a pull request into `stage/S003-R`. Say what changed, what you verified, and what you didn't ("not tested in
   game" is a fine thing to write).
4. Merge it yourself once it's green; the other stream pulls the stage branch before its next PR.

## Where the two streams touch

Mostly they don't: ships live in `ship/` and `core/boat.js`, the world in `world/` and the map. The shared places are:

- `core/given.js` (constants): add, don't change another stream's; say so in the PR.
- `handover/` (STATE, DECISIONS, ISSUES, LOG): append, never rewrite the other stream's entries. Number new decisions
  and issues after the highest on the stage branch when you merge.
- `world/boatsizes.js` (the size laws both use) and `world/thera.js` (the Therans' city, which the fleet docks at):
  change these only in a PR that says why, and pull first.
- The version (`tools/buildmod.mjs`, `mod/scripts/main.js`): bumped once per stage hand-off, not per PR.

## Handing off a stage

As before (`handover/templates/HANDOFF_CHECKLIST.md`), with one more step: both streams' PRs are merged into the stage
branch first, then the stage branch merges to `main` and is tagged.
