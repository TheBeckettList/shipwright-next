# The matrix behind the hall

The hall's math, offered by the Mover's stream (R) to everyone. It is computed in `olympus.mjs` from `core/pantheon.js` and
never copied. `node olympus/olympus.mjs matrix` shows it, and the lens holds it.

## The nine are a plane

A god is a pair of trits (a, b): where it acts, and what it does. The nine pairs are the nine points of the plane over
the field of three, AG(2,3). F = [[1,1],[1,0]] mod 3 has order 8 and F⁴ = −I, so:

- **The breath:** F holds (0,0), the Measure, and runs the other eight round one cycle. The cycle is the web: a tablet
  by v is answered by F·v.
- **Opposites:** F⁴ = −I pairs each god with its opposite, half a breath on. Its opposite takes its debts.

## The twelve councils

The plane has twelve lines. On a line, three gods' vectors sum to the still point, so their claims cancel
(`resolveClaims`).

| kind | how many | who | what it means |
|---|---|---|---|
| ledger | 4 | v, −v, the Measure | a god, its opposite and the judge: the shared ledgers |
| triad | 8 | three gods summing to 0 | a balanced council: what one gives another takes |

The structure is exact, and the lens checks it:

- Each god sits in three triads and one ledger.
- Each pair of gods meets in exactly one council.
- The land row (Builder, Grower, Unmaker) and the sea row (Bounty, Mover, Toll) are triads themselves. Each stream's own
  gods balance, so a stream can settle its own claims among its own gods.
- The peoples row (Reaper, Trader) closes its line through the Measure: it is a ledger. The shared row keeps the shared
  frame.

F carries lines to lines, so the councils turn with the breath. The sitting's lead convenes its own four councils.

## The web as matrices

Read on the eight (the Measure apart):

- **C:** the cycle, a permutation matrix. Row v holds a 1 at F·v: who answers whom.
- **C⁴:** the opposites (F⁴ = −I): who takes the debts.
- **R:** the hall's record. R[i][j] counts the answers god j gave god i's tablets.

A hall that keeps the web has R's weight on C. Weight elsewhere is either asked for, by a `question` naming its god, or
cross-talk. `matrix` counts all three.

## What is owed

A tablet or question addressed to a god, by the web or by `--asks`, is open until answered. At its sitting's close it
becomes a debt to the writer's opposite: weight moves along C⁴.

Each open item is weighed at ψ = 1/φ of its cause's words. That is the most its answer should run, so the owed column
is also each god's word budget.

The numbers settle as the sim's reactions do:

- One hop leaves ψ.
- A breath leaves φ⁻⁸ ≈ 2.1%.
- An act and its answers net (1 − ψ⁸)/(1 − ψ) ≈ 0.605 of the act. ψ here is signed, −1/φ; it alternates.
- In whole units an answer to a Fibonacci number is the one below it: 13 → 8 → 5 → 3 → 2.
