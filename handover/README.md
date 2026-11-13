# Shipwright SimulDev — handover package

_Lives at `shipwright-next/handover/` in the repo._

**Start here.** (New session or new project? Read `NEXT_SESSION.md` first.) This folder is how three developers and their AI assistants pass one project between
them, a stage at a time, without losing anything in between.

The project: **Waterworld** (the golden-law world, laid in Minecraft Bedrock chunk by chunk from the
sim's own math) with **Shipwright** (historical boatbuilding and sailing) folded in as its ship module.
One shared body of math drives both. See `PROJECT.md`.

## The baton rule

Work happens in **stages** of a few days. **Exactly one person holds the baton at a time.** No overlap.

Since S001 the project is a **git repo** (`shipwright-next/`, with this package inside it). A stage is a branch.

```
  pick up                      work                          hand off
  ───────                      ────                          ────────
  1. read STATE.md             keep notes in your             1. finish your stage file
  2. read the last 1–2         stage file as you go           2. rewrite STATE.md
     stage files               (decisions → DECISIONS.md)     3. add one line to LOG.md
  3. check math-feed/INDEX                                     4. merge to main, tag, zip
  4. check the build matches                                   5. tell the next person
     STATE.md (version, hash)
  5. new-stage.sh (makes your
     stage file + branch)
```

In git terms: `main` is always the last handed-off stage, tagged `v<version>`. Your stage works on
`stage/S00n-<code>`; at hand-off it merges into `main` and gets its tag. Build zips stay *out* of git
(see CONVENTIONS, "Git").

Checklists for both ends: `templates/HANDOFF_CHECKLIST.md`.

## What's in here

| File | What it is | Who writes it | How |
|---|---|---|---|
| `README.md` | this page | rarely changes | edit |
| `STATE.md` | **the baton**: where things stand right now | the person handing off | **rewrite** every stage |
| `LOG.md` | one line per stage, newest on top | everyone | **append** |
| `stages/` | one file per stage: what was planned, done, learned, left | the stage's owner | new file each stage |
| `DECISIONS.md` | decisions that bind the next person | anyone | **append**; supersede, never delete |
| `PROJECT.md` | what the project is and how it fits together | anyone, when architecture changes | edit |
| `MATH.md` | the shared math, and which code runs on which part | anyone | edit; open questions at the bottom |
| `CONVENTIONS.md` | the house rules the code already follows | anyone, by decision | edit + a DECISIONS entry |
| `CODEBASE.md` | file-by-file map, generated from the code's own headers | `bin/codemap.sh` | regenerate |
| `ISSUES.md` | known problems and gaps, with status | anyone | edit status; don't delete, close |
| `AI_BRIEF.md` | paste-in brief for any AI assistant joining a stage | anyone | edit |
| `math-feed/` | **research → devs**: one entry per lab review — equations, status changes, game impact | research side, after each review | new entry; never edit old ones |
| `templates/` | stage file template, handoff checklist | — | copy |
| `bin/` | `new-stage.sh` (starts your stage file), `codemap.sh` | — | run |

## The math feed

The research lives in a different claude.ai project from the game. After every review there, an entry lands in
`math-feed/` with the equations, what changed, and an impact tag (`ACT` / `CHECK` / `METHOD` / `NONE`). When you
pick up a stage, check `math-feed/INDEX.md` for anything tagged `ACT` or `CHECK` that no stage has acted on yet.
How entries are made: `math-feed/README.md` and `math-feed/HOW_TO_SEND.md`.

## Roster (fill in)

| Code | Name | Focus | Usual AI |
|---|---|---|---|
| R | Richard | | Claude |
| A | | | |
| B | | | |

Stage files use these codes: `stages/S003-2026-11-20-A.md`.

## Starting a stage (30 seconds)

```bash
cd ~/Desktop/"shipwright simuldev"/shipwright-next
bash handover/bin/new-stage.sh A "terrain: rivers pass"     # your code, a short title
```

That creates the next numbered stage file from the template (today's date, the version STATE.md says you're
starting from) and, if your working tree is clean, a branch `stage/S00n-A` to work on.
