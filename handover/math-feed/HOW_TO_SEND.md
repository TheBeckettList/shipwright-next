# Sending a math-feed entry (paste this into the research-side session)

> A review has just been written in the Foundaitional Physics project. Make a math-feed entry for the game devs.
>
> 1. Read the newest review doc (`research/... review N (date).md`) and, for every law id it names, the law's
>    exact statement in `research/Linear algebra memory.md` (or the matching memory doc for that lab).
> 2. Read `handover/math-feed/INDEX.md` and `handover/MATH.md` in the game repo (`shipwright simuldev/shipwright-next/`) so you
>    know the entry number and what the game already uses.
> 3. Write `MF-<next>-<review date>-<lab>-review-<N>.md` from `handover/templates/MATH_FEED_TEMPLATE.md`:
>    - equations copied from the law statements, each with id, status, pin, and one plain-English line;
>    - status changes (newly held, retracted, closed posits, open claims);
>    - the review's method lessons, briefly;
>    - **Game impact** with ACT / CHECK / METHOD / NONE tags, judged against `handover/MATH.md` and the
>      `core/` files it lists. Don't overclaim: most physics results won't touch the game.
> 4. Add the line to the top of `INDEX.md`; if anything is ACT, add it to `handover/ISSUES.md`.
> 5. If this session is linked to Richard's computer, write the files into the folder and commit them on `main`
>    (`git add handover/math-feed handover/ISSUES.md && git commit -m "Math feed MF-nnn"`) — a math-feed
>    entry isn't a stage, so it doesn't need a branch. If not, hand them back
>    as files for Richard to drop in.
> Paraphrase review prose; don't paste whole sections. Equations and law statements are the content.
