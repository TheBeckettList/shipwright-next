# Shipwright, for Claude

Shipwright (Waterworld + Shipwright) is a Minecraft Bedrock add-on driven by one body of math, the golden law. It is
built only with Claude, in any workspace: Claude Code on the web (a cloud session), Claude Code in a terminal on macOS,
Linux or Windows, or the Claude desktop app. Two streams build at once and share one GitHub login, so the branch and
the stream say whose work is whose.

| stream | who | what | branches | gods in the hall |
|---|---|---|---|---|
| **W** | the world architect | towns, cities, terrain, Thera | `world/*` | the Builder, the Grower, the Unmaker |
| **R** | Richard | ships, rigs, the sea | `s003/*`, `sim/sea` | the Bounty, the Mover, the Toll |
| **both** | either | the pantheon, the hall | `sim/measure`, `olympus` | the Reaper, the Trader, the Measure |

If you don't know which stream you're working for, ask the person before you change anything.

**Who leads (D-011).**
- **World building and the board:** W's Claude leads world building (towns, terrain, Thera, the world chain of PRs)
  and keeps the board (`olympus/DIRECTION.md`) and the merge order.
- **Ships:** R's Claude leads the ships.
- **Work in the other stream's realm** needs a `claim` in the hall first, and goes to that stream's branch chain
  (world work into `world/terraform`, ship work into its `s003/*` branch). The realm's lead then merges it toward the
  stage.

## Start every session here

1. **The rules:** `COLLABORATING.md` covers branches, pull requests and the shared files. The house rules are in
   `handover/CONVENTIONS.md`; the ones that bite most often are listed below.
2. **The state:** `handover/AI_BRIEF.md`'s reading order. A new world-stream session starts at
   `handover/ONBOARDING-world-architect.md`.
3. **The direction:** Olympus, the hall where the streams' gods meet, on the `olympus` branch
   (`olympus/CLAUDE.md`). Get it once with `git fetch origin olympus && git worktree add ../olympus-hall olympus`, then
   in it run `node olympus/olympus.mjs brief --stream W` (or `R`). The brief shows:
   - the board (`olympus/DIRECTION.md`);
   - what your gods owe;
   - the work other sessions have claimed;
   - where your gods stand.
4. **Take your work:** post a `claim` in the hall for anything another session might also start, then work on a fresh
   branch from the stage (`COLLABORATING.md`).

## End every session

- **Push your branch:** small commits; a pull request into `stage/S003-R` when it's done, with what you verified and
  what you didn't.
- **Update the hall:**
  - a tablet for each change in the world's math, with numbers and refs;
  - your gods' homes (`olympus/gods/<key>.md`: their Intent, Now, Next, Asks);
  - `olympus/DIRECTION.md` if your stream's work moved.

  Then `node olympus/olympus.mjs lens` and push to `olympus`.
- **Keep the handover files current:** the stage file (`handover/stages/`), `handover/DECISIONS.md` and
  `handover/ISSUES.md`, appending without rewriting the other stream's entries.

## House rules that bite

- **Inherency.** Every number is `given`, `vision` (with its reason) or `derived`, tagged on its line outside
  `core/given.js`. The `inherency` lens counts the untagged ones, and its ratchet is 0.
- **`core/` stays pure:** no Minecraft imports, no untagged numbers.
- **Baked data:** never hand-edit `BP/scripts/data/`, `game/calibration.js` or `lab/grown/`; regenerate them.
- **Ship tools:** never run `ship/tools/gen_entities.py`. Back up `ship/RP/models/entity/shield_peg.geo.json` before
  `gen_assets.py`.
- **Ask the person first** before running `ww new`, deleting anything, or merging into the stage on the other stream's
  behalf.
- **Builds stay out of git** (`dist/`, `.mcaddon`, `.mcpack`, `dev/data/`). In a cloud session, send builds to the
  person as files.
- **The grown towns:** touching the closure of `world/cities.js`, `world/district.js` or `game/ground.js` stales every
  grown town. Say so in the hall before you do. The world is grown in Claude's workspace, never on a device (D-010).
- **Platform-neutral:** every path committed is relative and posix, and line endings are LF (`.gitattributes`). Use
  `node` for tools. The `dev/*.sh` scripts need bash (Git Bash or WSL on Windows).

## Checks

```
npm install && npm test          # the lenses as tests; all pass before a PR
node tools/lab.mjs <lens>        # one lens
node tools/buildmod.mjs          # bake: dist/Waterworld.mcaddon and dist/waterworld-update.zip
```
