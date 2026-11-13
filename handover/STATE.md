# STATE — the baton

> **Rewrite this whole page when you hand off.** It should always answer: if I pick this up cold,
> what do I have, does it work, and what do I do first? Keep it under a screen or two.

**Baton:** R (Richard) — after **S002** (0.9.14), filed 2026-11-12
**Next holder:** R — S003, ship engineering (yard to launch)

## The build
| | File | SHA-256 |
|---|---|---|
| Full add-on | `Waterworld-0.9.14.mcaddon` (24.9 MB) | `60459e86984ac19facf12a2f8cb1a3cb3a35b4e484ea9d2f3a6a7160fc7335a0` |
| Update pack | `waterworld-update-0.9.14.zip` | `d4f913b6c1fd5ad50c72957817ade163b9c33eac481532f407176bfad4210b13` |

Baked in Claude's cloud workspace from tag `v0.9.14`; too large to copy to the Mac, so **rebake there**:
`rm -rf node_modules && npm install && node tools/buildmod.mjs` (~4 min) → `dist/`. (Zip hashes can differ by
timestamps; the content is the tag.) 0.9.13's files at the top of the folder are the previous build.
Source: git `main` @ tag `v0.9.14`. Viewer: artifact **"Waterworld — world viewer"** (release 0.9.14).

## Does it work?
| Check | Result |
|---|---|
| Loaded in game | **No — not yet** (nor 0.9.13). First job. |
| `npm test` | 53/53 (needs a bake first: `tempo` reads `dist/`) |
| `npm run modtest` | no bad blocks or states |
| `npm run ship:test` | 289 pass, 1 fail (boot lab → I-014) |
| inherency | 0 free numbers; ship ratchet 2494 |
| Grown towns | 21 in the build again (restamped) |

## Open, in priority order
1. **Load 0.9.14 in game**: hulls (I-012), stems, sails, wings; `/scriptevent shipwright:check`; `ww errors`.
2. **S003, ship engineering** (Richard's brief): a naval-architecture lens; sizes and scantlings from the world's own
   math; thicker hulls and real decks; lighter launched models; Theran ships redone (detached parts, flat); League
   galleys all large, sized per trade route, and League small/medium boats by route and need.
3. I-010 GitHub remote · I-013 design docs · I-014 boot lab on the merged pack.
4. Then: Theran physics and buying → Sail Loft → Thera builds → ship port.

## Direction
D-003: the sim and Minecraft are two ways into one world. The viewer is the sim's front end in waiting.

## Math feed
Latest: MF-001 (METHOD only). Nothing ACT/CHECK outstanding.

## First thing the next person does
Read `README.md` and `stages/S002-2026-11-12-R.md` §8. Rebake, load in game. Then `new-stage.sh`.
