# Decisions

Append-only. A decision binds whoever holds the baton next. To change one, add a new entry that
**supersedes** it and mark the old one `superseded by D-0xx`. Status: **proposed** · **accepted** · **superseded**.

Format:
```
## D-0xx — title  (status · who · date · stage)
Context: why it came up.
Decision: what we do.
Consequence: what it changes for the next person.
```

---

## D-001 — Work passes by baton, through this folder  (accepted · Richard · 2026-11-12 · S000)
Context: three devs and their AIs work on one project in stages of a few days, with no overlap.
Decision: one baton holder at a time. Every stage gets a file in `stages/`, ends by rewriting `STATE.md`,
one line in `LOG.md`, and the build zip in `builds/`. Decisions go here; problems go in `ISSUES.md`.
Consequence: nobody needs to have been in anyone else's chat to pick up the work.

## D-002 — The source tree becomes the source of truth  (**accepted** · Richard · 2026-11-12 · S000/S001)
Context: I-001 — only built packs are shared; the bake tools, unbaked world, lab and tests aren't.
Decision (proposed): put the full source (BP/RP sources, `tools/`, `world/`, `lab/`, `tests/`, design notes) in a
private git repository (or, at minimum, a `source/` folder here zipped at each hand-off as
`source-<version>.zip`). Packs and update zips become build outputs only.
Consequence: any holder can rebake, run the lenses and calibrate; diffs between stages become readable.
Needs: Richard to accept or amend.
Update (S001): the source now travels as `shipwright-next-src-<version>.zip` inside `handover-<version>.zip` — the
minimum form of this decision is already happening. Still proposed: a git repo, so stages diff instead of re-zip.
Accepted (2026-11-12): a **local** git repo at `shipwright simuldev/shipwright-next/`, first commit = the 0.9.13
source, tagged `v0.9.13`; this package moved inside it. History before 0.9.13 isn't in git. GitHub remote: later.

## D-003 — The sim and the game are two ways into one world  (accepted · Richard · 2026-11-12 · S001)
Context: Richard: "ideally, I can play eventually in the sim just adventuring around, then in MC when I want to
play. The server sim parallel is intentional."
Decision: the sim (Node, `core/` + `world/`, closed forms of the tick) is a first-class place to *be*, not only a
bake step. Minecraft is one view of it, the server's live sim runs alongside, and both must agree on any tick.
Consequence: keep sim logic out of `mod/` and `ship/` game glue wherever it can live in `core/`/`world/`; keep the
closed-form/stepped handover exact (the analogue lens); treat the world viewer as the start of the sim's own
front end, not a debugging toy.

## D-004 — Ships keep the world's length rungs; depth, decks and walls are drawn true  (accepted · Richard · 2026-11-12 · S003)
Context: the big ships "look paper thin" and "flat". The culture engineers measured why: models drawn at 0.25–0.83 of
the law's depth (`y_scale`, `SIDE_TRIM`), walls a constant ~1/8 block (`th()` divides by the model scale).
Decision: lengths stay on `boatsizes.js`'s rungs (8 / 21 / 34; ship class to its plans' 22). Depth, draught and
freeboard come from the law (beam/φ, /φ², freeboard against the reach's design wave), walls grow with length
(w = 16·L/K, K on Fibonacci rungs by construction), decks from depth. The League's galleys are all great, sized by
route (29–37). Design: `design/S003-ship-engineering.md`.
Consequence: every hull is regenerated (0.10.0); the engineering lens (englab) judges the models against the law.

## D-005 — A ram only where it was used, or bought  (accepted · Richard · 2026-11-12 · S003)
Context: every culture's hull carried a ram; only the League and the Therans rammed. The League sells the ram as a
fitting to any fleet (`world/league.js` PIECES).
Decision: no ram drawn by default; the League's and Therans' ships carry theirs; any other ship shows one only when
the ram fitting is fitted.
Consequence: `RAM_OF` and the outfit render controller key on the fitting; a lens check: no unfitted rams.
