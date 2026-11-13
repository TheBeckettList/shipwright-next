# Kickoff for the game's own project

Written 2026-11-12 at the end of a session that ran in the wrong claude.ai project (Foundaitional Physics). Everything
that session learned is in this package; this page is the short version, for the first message in the game's own
project. Paste the block at the bottom to start.

## Where things are now
- **Repo:** `~/Desktop/shipwright simuldev/shipwright-next/` — local git, `main` @ tag `v0.9.13`, 2 commits:
  the 0.9.13 source as handed over, then this package. No remote yet (GitHub wasn't connected to that session).
- **Builds** (deliberately outside git, top of `shipwright simuldev/`): `Waterworld-0.9.13.mcaddon`,
  `waterworld-update-0.9.13.zip`, `handover-0.9.13.zip`. Hashes in STATE.md.
- Loose duplicates you can delete: `HANDOVER (1).md` (copied into `stages/S001-HANDOVER-0.9.13.md`) and
  `fleet-0.9.13.png` (also inside `handover-0.9.13.zip`).
- **Skill saved for the physics side:** `math-feed-update` — after each lab review, it writes a math-feed entry
  into `handover/math-feed/` (and, per HOW_TO_SEND, commits it on `main`).

## Decided in that session
- D-001 baton workflow · D-002 git (local now, GitHub later) · **D-003: the sim and Minecraft are two ways into one
  world** — adventure in the sim, drop into Minecraft to play; the server's sim running in parallel is intentional.

## Verified vs not
- ✔ `node tools/lab.mjs inherency` = 0 free numbers; 0.9.13 consistent across buildmod.mjs, main.js, manifests.
- ✔ `new-stage.sh` makes the stage file and branch (tested on a clone).
- ✘ `npm test`, `ship:test`, `modtest`, the bake: not run — that session's shell on the Mac stops anything over
  3 minutes, and background jobs are killed between calls. Run them in Terminal yourself.
- ✘ Nothing loaded in game yet.

## "Would the .mcaddon work on Mac?"
The add-on is Bedrock, and **Mojang ships no Bedrock client for macOS** (Java Edition is the native Mac game, and
Java can't load .mcaddon). So on a Mac:
- **As a server: yes, already.** The `ww` kit runs Bedrock Dedicated Server in Docker on the Mac and loads the
  packs; you join from the Switch (or any Bedrock device: iPad, iPhone, Android, Xbox, Windows).
- **To play on the Mac itself:** only unofficial routes — a Windows VM (Parallels) with Bedrock for Windows,
  cloud gaming, or community launchers (mcpelauncher-based; fan projects). Unsupported; expect breakage.
- **Simplest real setup:** the Mac hosts (`ww`), a Bedrock device plays. An iPad is the closest thing to "on the Mac".
This also bears on D-003: the *sim* side (Node, the world viewer) is the part that runs natively on the Mac, which
is one more reason to grow it into a place you can adventure in.

## Paste this as the first message in the new project
> I'm continuing Waterworld + Shipwright. The repo is `~/Desktop/shipwright simuldev/shipwright-next/` (local git,
> `main` @ `v0.9.13`). Read `handover/NEXT_SESSION.md`, then `handover/STATE.md`, `handover/README.md`, and the
> newest stage file. Then tell me what you see as the next stage and start it with
> `bash handover/bin/new-stage.sh R "<title>"`. Follow `handover/AI_BRIEF.md` and `handover/CONVENTIONS.md`.
