# Handoff checklist

## Picking up
- [ ] Read `STATE.md` top to bottom.
- [ ] Read the last stage file (two if the last was short).
- [ ] Scan `ISSUES.md` and the newest entries in `DECISIONS.md`.
- [ ] Check `math-feed/INDEX.md` for `ACT` / `CHECK` entries no stage has acted on yet.
- [ ] `git switch main && git pull` (once there's a remote); `git log -1` matches the tag in STATE.md.
- [ ] Get the build named in STATE.md; check its SHA-256 (`shasum -a 256 <zip>`) matches.
- [ ] Install it (`ww update <zip>`); `ww status` shows the right version.
- [ ] `bash handover/bin/new-stage.sh <code> "<title>"` and fill in section 1 before writing any code.
- [ ] Set **Baton:** in STATE.md to you (one-line edit) so everyone can see who has it.

## Handing off
- [ ] Bump the version (BP + RP manifests, both dependency entries, `VERSION`). See CONVENTIONS.
- [ ] Build (`node tools/buildmod.mjs`); put the zips in the top folder (beside the repo, not in it); note SHA-256s.
- [ ] Commit on your stage branch; `git switch main && git merge --no-ff stage/S00n-<code>`;
      `git tag -a v<version> -m "<one line>"`; push if there's a remote.
- [ ] Run the tests in section 6 of your stage file and fill it in.
- [ ] Finish every section of your stage file — especially **8. For the next person**.
- [ ] Add decisions to `DECISIONS.md`, problems to `ISSUES.md` (close the ones you fixed).
- [ ] If the math changed: `MATH.md`. If files were added/removed: `bash handover/bin/codemap.sh … > handover/CODEBASE.md`.
- [ ] **Rewrite** `STATE.md` (don't append to it).
- [ ] Add your line to the top of `LOG.md`.
- [ ] Tell the next person, with one sentence and a pointer to STATE.md.
