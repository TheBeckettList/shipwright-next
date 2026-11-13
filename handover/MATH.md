# The shared math

All three of you work on the same math. This page says what it is *as the code uses it*, and where.
The deeper work (Seedworld, the golden breath, the lab's pre-registered tests) lives in Richard's
**Foundaitional Physics** project; `core/field.js` cites its docs `seedworld-findings` and `6d-to-1d-map`.
When a stage changes the math, update this page and say so in the stage file.

## 1. The one law

`F = [[1,1],[1,0]]`, the golden 2×2, acting on **trits** (residues mod 3, balanced: −1, 0, +1), brick-wall
on a Möbius loop (`core/field.js`). Everything else borrows its tempo or texture from it.

| Fact | Value | Used for |
|---|---|---|
| Larger eigenvalue | φ = 1.618… | ring weights, golden angle, phase spreading |
| Pisano period mod 3 | 8 | the "breath" beat (layer wake-up, edge ring) |
| mod 5 | 20 | one Minecraft second: gusts, chunk math |
| mod 25 | 100 | the folk's beat |
| mod 22 / 181 / 135 | 30 / 90 / 360 | month / season / year in days (`core/clock.js`) |
| F⁴ mod 3 | −I | the pole crossing: the globe's lost sign (`core/globe.js`) |

## 2. Three kinds of number (the inherency rule)

`core/given.js` holds every number the world is made of, in exactly three kinds:

- **GIVEN** — fixed by Minecraft or the Earth (20 ticks/s, 16-block chunk, 24,000-tick day, g, ρ_water…).
- **VISION** — a choice, each with its stated reason (CIRC, LAND share, HULL ratios, BELTS…).
- **derived** — a pure function of the two.

Any other literal in `core/` is a *free number* and fails the inherency lens (`tools/lab/inherency.mjs`).
Literals elsewhere sit on a line tagged `// given:` or `// vision:`. Treat this as a hard rule.

## 3. Reversibility

`core/reversible.js`: every law is a list of ops of two kinds.
- **shear** `s[k] += by(s)` where `by` doesn't read `s[k]` — undone exactly by subtracting. (F itself is two shears.)
- **record** an exchange with the world (wind gives, water takes); the sea keeps the record for
  `WAKE_KEEP` ticks; only when it's forgotten is a loss real.
Moving state is fixed-point (`Q` = 2¹⁶ per block, `TURN` = 2¹⁶ per turn, sine by table) so step and unstep
agree bit for bit (`core/fixed.js`). `core/boat.js` is a hull as one reversible step.

## 4. Two-layer universe (Seedworld v9)

`core/cycles.js`: a **pulse** (the golden line, back to its point in exactly 2L ticks — an era) drives a
**record** (one trit per cell, changed only where the pulse passes). Settles to balance; any tick runs
forward or back at the same cost. Drives cultures, borders, fortunes, the sea's good and lean years
(`world/sealife.js`), and the gust line (`core/wind.js`). `core/patterns.js` reads the record as native noise.

## 5. Near and far (closed forms)

`core/lod.js`: rendered (≤ NEAR) → edge → chunk math (≤ FAR) → abstract. Beyond reach nothing is stepped:
tide, wind, waves, a ship on a voyage, a people's day are closed forms of the tick, *asked* at any t.
On promotion the stepped and the closed-form state must agree (the analogue lens).

## 6. Golden spacing everywhere

- **Rings** (`rings.js`): Fibonacci radii in chunks (deep 5, folk 8, surface 13); pass weights 1, φ, φ².
- **Sight** (`core/sight.js`): rings growing by φ carry equal visible detail each, so detail cost grows with
  log(view distance), not its square.
- **Tempo** (`core/tempo.js`): every timer's period divides the 200-tick bar (the harmonic gate); phases
  are spread golden-first, heaviest first (legacy peak 90 → 15 on tick 0).
- **Drawing** (`core/golden.js`): Fibonacci word (strata beds, courses), Fibonacci lattice, Voronoi cells,
  truchet tiles.
- **Calibration** knobs move one Fibonacci rung at a time (`game/calibration.js`).

## 7. The globe

Equirectangular, x east wrapping, poles folded: `(x, z) → (x + W/2, −z)` with headings negated. Ships live on
the unwrapped double cover (no seams, so their laws stay shears); `fold()` projects to the world and loses
exactly one bit (`sheet`). W = `VISION.CIRC` = 262,144 blocks; map 2,048 × 1,024 cells of 128 blocks.

## 8. Physical laws carried in at 1 block = 1 m

Hulls: displacement, Denny's wetted surface, ITTC skin friction, Froude limit 0.4, sail polar, heel and roll
oscillator (`core/boat.js`). Sea: Pierson–Moskowitz waves with deep-water dispersion under Minecraft's g,
fetch, tide bulges, zonal currents (`core/sea.js`). Wind belts with Coriolis-set bearings (`core/wind.js`).
Rivers: priority flood + hydraulic geometry (`world/rivers.js`). Climate: latitude, lapse rate, rain shadow,
Whittaker bands (`world/climate.js`, `world/biomes.js`). Thera from the 2018 caldera reconstruction (`world/thera.js`).

## Open questions (add yours; say who and which stage)

- [S000] `core/given.js` header says the globe is 32,768 blocks round; `VISION.CIRC` is 262,144 ("eight times
  the first world"). The header is stale — confirm and fix the comment. (ISSUES I-003)
- [S000] `world/map.js` says "one pixel a chunk"; `VISION.MAP_PX` is 128 blocks (8×8 chunks). Same kind of drift.
