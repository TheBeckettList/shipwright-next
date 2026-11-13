# The lost keels: Theran keels, their sherds, and the museum

A plan, not built yet. Richard's idea (2026-11-13): every Theran hull carries a cast gold keel unique to its size.
When a Theran is lost at sea, the keel goes down with their sherd set in it. Bring one home and it goes on display in
a museum, and the sherd tells the lost Theran's story, written from a god's view. The stories are written on Olympus,
so the hall where the gods meet is where the game's lore is made.

## The keels

Each Theran keel is her own shadow in gold: the boat above, mirrored and cast small. The Exokoitos's foil set the
form, modelled first as a real casting and laid into the game one plate per face.

| hull | keel | form |
|---|---|---|
| Exokoitos (skiff) | the little Exokoitos | a slim drop; her plates' wing at 1/φ³; her stern's stab-and-fins band; a raked blade; the emitter at its tail |
| Theran ship (catamaran) | the twin | two drops on one wing, one under each hull, joined by its span; a band tail on each |
| Theran flagship (trimaran) | the great keel | a drop under the main hull, its wing reaching the floats; three blades; the emitter large enough to read from a quay |

**Inherency.** The keels are scaled by 1/φ³ (vision), shaped by NACA 0012 sections (given), and sized by her lift
(derived). The skiff's foil carries about 1.6 m², against the roughly 1.7 m² her weight needs on the foil.

**The emitter is the sherd's socket.** At the keel's tail, the gold nozzle holds the captain's sherd, and its light is
the sherd's. A keel with no sherd in it is dark.

**Pieces.** The skiff's cast foil is 338 plates, taking her to 1,049. The S003 brief puts the budget for a launched
hull at 460, so the cast foils need a cheaper version for the boat in play. The museum's display pieces can keep the
full casting.

## Lost Therans

A Theran hull that founders becomes a wreck: the Toll's take (`world/gods/toll.js`, wave 2).

- **Where:** wrecks fall along the Theran routes, where the sea is worst (Hs past the hull's limit), as the Toll's
  records.
- **What stays down:** the hull's value is the Toll's. The keel and its sherd are what the sea keeps whole, and the
  Bounty gives them up to whoever finds them: a chart (`charts.js`), a dive, a salvage.
- **The item:** an echo shard named for its Theran (*the sherd of Melaina, helmsman*), carrying their story as its lore
  lines. The keel comes up as a block-entity or a carried relic.

## The museum

Bring a keel home to Thera and set it on a plinth in the museum. It stands there for good, lit by its sherd.

- **Where:** Thera's library terraces (the Builder's civic ground, `world/terraform`). The hall of the lost runs along
  a terrace, one plinth a keel.
- **What returning one gives:**
  - The story is read aloud when the keel is set.
  - The Therans' standing rises.
  - The sherd is a vote: returning one gives its Theran their vote again, in the city's ostrakon count.
- **Size matters:** a flagship's keel is a rare find, a plinth of its own at the head of the hall.

## The stories, written on Olympus

Each sherd's story is told by one god, the god whose act it was:

- **The Toll** (storm, wreck): "I took her off Akrotiri in the third gale of the year…"
- **The Mover** (current, drift): where the sea carried them.
- **The Reaper** (what the peoples took): a raid, a debt.
- **The Bounty**, when the sherd is found: what the sea gave back.
- **The Measure** closes every story: the vote restored.

**How they get into the game:**

1. On Olympus a new kind of tablet, `sherd`, carries one story. It is written by its god's stream (R for the sea
   row), short, and numbered.
2. A tool (`olympus/sherds.mjs`) reads the agora's `sherd` tablets and writes `ship/BP/scripts/config/sherds.js`.
3. Wrecks draw their stories from that list by the Toll's seed. The hall's own laws keep them short (ψ of a cause) and
   never edited (the wake).

So the forum is where the lore is written, and the game shows it.

## Real Olympus (not Thera)

Thera is the Therans' home. Olympus is where the gods sit. We plan it as a place in the world, found by the world's
own law rather than placed by hand:

- **Proposal (derived):** Olympus is the world's highest summit, the land nearest the sky, wherever the terrain puts it.
  It is one point by the law, and every world has one.
- **The pilgrimage:** sail from Thera to the nearest shore below it, then climb. The Exokoitos can fly the last of it
  if the wind allows.
- **What stands there:** the Measure's seat, the still point. A bare summit with a ring of nine stones, the eight
  round and one at the centre, the pantheon's own figure. Each god's stone faces the way its row acts: land, peoples
  or sea.
- **Open to the Builder (W), whose land it is:** confirm the highest summit as the rule, and say whether the city
  should keep away from it (vision: no settlement within φ⁴ chunks).

## Tasks (for the sea stream's table)

| # | task | god | when |
|---|---|---|---|
| A | A launch-budget version of the cast foil; the twin and great keels | the Mover | after the Exokoitos loads in game |
| B | Wrecks as the Toll's records, each holding a keel and a sherd | the Toll | wave 2 |
| C | The `sherd` tablet kind on Olympus, `sherds.mjs`, the first eight stories | the Measure (both) | any time |
| D | The museum hall and plinths on Thera's library terraces | the Builder (W) | asked on Olympus |
| E | Olympus's site and the summit ring | the Builder (W) | asked on Olympus |
