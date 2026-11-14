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

## D-006 — Thera's cone island: radius × 1.5, a ring waterfront carrying the cothon and the League's Mint  (accepted · Richard · 2026-11-12 · S003, for S004)
Context: the Thera spec (`design/s004-specs/thera.md`) proposed doubling the cone island's area (radius × √2) because
doubling the radius closed the lagoon round the cothon.
Decision: the island's radius grows by half (1.08 → about 1.62 km), its height by a quarter. The cothon moves in to
the island, and it and the League's Thera HQ and Mint (cothon-sized) both attach to a ring round the cone island that
is its main waterfront.
Consequence: `world/thera.js` (seat, cone, cothon placement), `theraplan.js`, `theracity.js` and the skyways move;
the lagoon narrows; the grown towns' source closure is touched (one regrow, batched with the terraforming).

## D-007 — Two streams at once, on GitHub  (accepted · Richard · 2026-11-13 · S003)
Context: a second developer is building the cities and the landscape while the ships are worked on; one baton at a
time would leave one of them idle.
Decision: the repo lives at github.com/TheBeckettList/shipwright-next (public; authors on the GitHub no-reply
address). Two streams run at once: ships on `s003/*`, the world on `world/<topic>`, each into the stage branch by pull
request. The stage branch is the default and takes pull requests only. `COLLABORATING.md` is the working agreement.
Consequence: the baton rule (handover/README) holds per stream, and the hand-off merges both streams first.


## D-008 — The sim runs as a pantheon of nine, derived from the law  (accepted · Richard · 2026-11-13 · S004)
Context: going all in on the sim (D-003) needs a way to divide the world's systems among agents, and to say how their
updates, reactions and conflicts work, without inventing a framework beside the math.
Decision: nine agents, read off F on trit pairs mod 3 (`core/pantheon.js`): the still point (0,0) is the Measure
(Nereus), and the other eight pairs, one cycle of the breath, are the gods, each named by where it acts (sea, peoples,
land) and what it does to the stock (takes, holds, gives), with a Greek sea-power's name. Opposites (F^4 = -I) share a
ledger and take each other's debts; F.v answers v on the next tick, bounded by psi = -1/phi; claims on a cell add as
vectors, a set summing to the still point holds the cell, and any other set goes to the earliest slot from the
breath's lead. Built wave by wave, each wave merged only when the
`pantheon` lens holds. The design and its open questions are in the doc "The Pantheon: the sim's nine agents and the
web between them".
Consequence: wave 0 (the Measure: `core/pantheon.js`, the `pantheon` lens) lands first; every later system is a god in
`world/gods/`, and the inherency lens must then read subfolders. Decided too (Richard, 2026-11-13): the gods are both, the sim's architecture and beings in the world. They can enter
the sim and look round (each through its own realm), and the world honours them; Richard designs the honours. Answered by the math (2026-11-13, for Richard's review): (1) answers in whole units are
round(cause x psi), which from a Fibonacci number is the one below it (Binet), and the roundings drift at most
phi^2/2 (`SLACK`); (2) claims are vectors: a balanced set holds, otherwise the earliest slot from a lead that turns a
slot a breath, so every god leads once in eight; (3) chance is `drawOf(tick, purpose)`: one god a tick, so the tick is its
stream (a row key would add nothing, since the tick already names the god), and the world's own draws are untouched; (4) the gods are
built in four waves of two, a god and its opposite together, in F's order from the Builder (they share a ledger, so
neither can be checked alone); (5) a debt goes to the writer's opposite always, the weak routes included (-v is the
only route F gives every god); (6) a god that holds may only move its own stock: on another's it lets its tick pass,
and the next god answers at psi^2. (7) a stock lives in [0, room], starting at room / phi: with the floor
alone the one-day sample's stocks climbed as a walk reflected at zero (the root of their writes); with both ends they
stay in the room and the overflow is a debt like the shortfall. Open: counterparts for the shallow-water and European
peoples.
