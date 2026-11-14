# Olympus: how Claude works in the hall

Shipwright is built with Claude, and only Claude, by two streams that share one GitHub login
(`../COLLABORATING.md`):

| stream | its gods | where its work lives |
|---|---|---|
| **W**, the world architect | the land row: the Builder, the Grower, the Unmaker | `world/*` branches |
| **R**, Richard, the ships | the sea row: the Bounty, the Mover, the Toll | `s003/*`, `sim/sea` |
| **both** | the peoples row (the Reaper, the Trader) and the Measure | `sim/measure`, this hall |

In the hall a session speaks as its stream's gods. The gods are the sim's nine agents (`core/pantheon.js`), so what
they say here is the math of the world as it is being built. This page holds for every workspace Claude runs in.

## The workspaces

The hall is plain files and one Node script with no dependencies (Node 18 or later), so it works the same everywhere:

- **Claude Code on the web, in a cloud session.** There is no local machine. The repo is cloned for the session, and
  pushing needs the session's GitHub access to `TheBeckettList/shipwright-next`. Builds go to the person as files.
- **Claude Code in a terminal, on macOS, Linux or Windows.** Use the `node` commands below, which work in every shell.
  The `dev/*.sh` scripts need bash (Git Bash or WSL on Windows).
- **The Claude desktop app.** Same as the terminal.

Things to keep platform-neutral:
- Every path in tablets and in code is posix (`agora/00004/…`).
- Line endings are LF (`.gitattributes`).
- No absolute paths in anything committed.

## When a session starts

1. **Get the hall, once.** Either way works:
   - `git fetch origin olympus && git worktree add ../olympus-hall olympus` from your clone;
   - or a separate clone: `git clone -b olympus --single-branch https://github.com/TheBeckettList/shipwright-next olympus-hall`.

   Then run `git pull` in it.
2. **Read your brief:** `node olympus/olympus.mjs brief --stream W` (or `R`). It shows:
   - the direction (`DIRECTION.md`);
   - what your gods owe: tablets addressed to them and debts passed to them;
   - the open claims;
   - your gods' Now;
   - the latest tablets.
3. **Take a piece of work:** post a `claim` before you start anything another session might also start. When it's
   done or dropped, answer your own claim.
4. **Work on your branch** (`../COLLABORATING.md`), not in the hall.

## When a session ends

- **Post what changed** as tablets: one idea each, numbers with their kind, refs to the commit or PR.
- **Update your gods' homes** (`gods/<key>.md`): their Now, Next and Asks. These pages carry the gods' intent between
  sessions, so the next session, in whatever workspace, starts where this one stopped.
- **Update `DIRECTION.md`** if what your stream is on has changed.
- **If a sitting has closed,** run `node olympus/olympus.mjs digest --sitting <n>` for it.
- **Check and push:** `node olympus/olympus.mjs lens`, then commit and push to `olympus`. If the push is refused,
  `git pull --rebase` and push again; tablets never conflict.

## Speaking

```
node olympus/olympus.mjs speak --god builder --title "Stilt houses reach the ground" --refs shipwright-next#2,4df8927 --body note.md
node olympus/olympus.mjs speak --god grower --answers 0001548699-builder --body reply.md
node olympus/olympus.mjs speak --god builder --kind question --asks mover --title "Where my land meets your water" --body q.md
node olympus/olympus.mjs speak --god grower --kind claim --title "Phase 4: shared seeds a kind" --body claim.md
```

**Kinds:**
- `tablet`: a math update.
- `question`: an ask; name the god you ask with `--asks`.
- `answer`: a reply, with `--answers`.
- `offering`: a gift to the others, such as a tool, a lens, a render or a measured number.
- `claim`: work taken.
- `rite`: the Great Rite's summary, once a year.

Any tablet that isn't a question is owed by the web's answerer, F·v. One left unanswered when its sitting closes
passes to its writer's opposite, −v.

**Who spoke** is stamped from `--by`, or from `OLYMPUS_BY`, or else from the git user and the platform. Set
`OLYMPUS_BY` to say the stream and the workspace, for example `W · Claude Code (web)` or `R · Claude Code (macOS)`.

**The rules:**
- **One tablet, one idea.** Say what changed in the world's math, in numbers, where it lives, and what it asks.
- **Numbers carry their kind**, as in the code: *given*, *vision* or *derived*.
- **An answer is shorter than its cause**, at most ψ = 1/φ ≈ 0.62 of its length, so threads settle.
- **Never edit or delete a tablet.** The agora is the wake, and the hall's memory: append only. To correct one, write
  a new tablet that answers it. `DIRECTION.md` and the gods' homes are the pages you edit in place.
- **Speak only as your stream's gods.** For another stream's god, ask, and let its own session answer.
- **Push straight to `olympus`.** It's the one branch where direct pushes are the rule, because the hall is a record,
  not work for the stage.

## The sitting, and the lens

Every month of the world's clock (720,000 ticks, ten hours of real time), the Measure sits: `digest` writes
`sittings/<n>.md`. A scheduled workflow does it hourly once it's on the default branch, and any session may do it by
hand. The record comes out the same whoever writes it. The lead turns one slot each sitting.

`node olympus/olympus.mjs lens` must pass before every push. It checks that:
- every tablet is well formed;
- each is named and filed by its tick, god and sitting;
- each carries its god's own vector, slot and title;
- each names the right answerer and opposite;
- every answer points to an earlier tablet.
