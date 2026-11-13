# Math feed

The research math (Richard's **Foundaitional Physics** lab) and the game live in different projects.
This folder is the bridge. **Every time the lab has a review, one entry lands here**: the equations and laws
that came out of it, what changed in their status, and what (if anything) that means for the game's code.

Two audiences, both first-class:
- **The devs** (and their AIs) — "does this change anything I build on?"
- **The dev on the research side** — "what has the game already taken from us, and what's still open?"

## Rules
1. **One entry per review**, named `MF-<nnn>-<date>-<source>.md` (e.g. `MF-001-2026-11-12-la-review-11.md`).
   Entries are never edited after they land, except to fix a typo; corrections come as a new entry that says
   which earlier one it corrects.
2. **Equations are copied from the lab's own law statements**, not re-derived. Each carries its law id
   (e.g. `SLAB-4D`), its status (held / open / retracted / closed), and where it's pinned.
3. **Every entry has a "Game impact" section**, even when the answer is "none". Use these tags:
   - `ACT` — code should change (open an ISSUES entry and say which file)
   - `CHECK` — something in `core/` might be affected; someone should look
   - `METHOD` — a working rule worth copying (a process lesson, not an equation)
   - `NONE` — research progress with no bearing on the game yet
4. **Retractions travel too.** If a law the game relies on is weakened or retracted in the lab, that's an
   `ACT` or `CHECK`, at the top of the entry.
5. Add the entry's line to `INDEX.md` (newest on top). If it's `ACT`, also add to `../ISSUES.md`.
6. When a stage acts on an entry, the stage file says so, and `INDEX.md` gets the stage id in its last column.

## How an entry gets made
From the research project, after a review is written: see `HOW_TO_SEND.md` (a paste-in brief for whichever
assistant is working there). It reads the review and the lab's memory, writes the entry from
`../templates/MATH_FEED_TEMPLATE.md`, updates `INDEX.md`, and — only if it's linked to this computer — writes
straight into this folder. Otherwise it hands back the file to drop in here.

## Notation
Markdown with `$…$` LaTeX for formulas (renders in GitHub, Obsidian, VS Code preview). Every formula also gets
one plain-English line, so it reads fine in a text editor.
