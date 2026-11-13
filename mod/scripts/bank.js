// The League's counter (world/coinage.js): use a League Counter block and its book opens. Coin is change at par (a
// stater for thirteen drachmas, a drachma for eight obols, and back); the bank buys emeralds and stamped metal under
// their worth and sells them over it (its keep, 1/phi^5 either side); and it warrants a player's own nine ingots with
// the League's stamp for the keep alone. What's paid in coin is taken from the purse as a whole and the change given back
// in the fewest coins.
import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { COINS, STAMPED, INGOT, INGOT_ID, BLOCK_INGOTS, EMERALD_WORTH, bankBuys, bankSells } from "./world/coinage.js";

const COUNTER = "waterworld:league_counter", EMERALD = "minecraft:emerald";
const BIG_FIRST = [...COINS].sort((a, b) => b.worth - a.worth);
const invOf = (p) => p.getComponent("minecraft:inventory")?.container;
function count(c, id) { let n = 0; for (let i = 0; i < c.size; i++) { const s = c.getItem(i); if (s?.typeId === id) n += s.amount; } return n; }
function take(c, id, n) { for (let i = 0; i < c.size && n > 0; i++) { const s = c.getItem(i); if (s?.typeId !== id) continue; const k = Math.min(n, s.amount); n -= k; if (k === s.amount) c.setItem(i); else { s.amount -= k; c.setItem(i, s); } } }
function give(p, id, n) { const c = invOf(p); while (n > 0) { const k = Math.min(64, n); const left = c.addItem(new ItemStack(id, k)); if (left) p.dimension.spawnItem(left, p.location); n -= k; } }   // given: a stack's sixty-four
const purse = (c) => COINS.reduce((s, k) => s + count(c, k.id) * k.worth, 0);
/** Pay `w` obols from the purse: all its coin taken, the change given back in the fewest coins. False if it's short. */
function pay(p, w) { const c = invOf(p), have = purse(c); if (have < w) return false; for (const k of COINS) take(c, k.id, count(c, k.id)); paid(p, have - w); return true; }
/** Give `w` obols in the fewest coins. */
function paid(p, w) { for (const k of BIG_FIRST) { const n = Math.floor(w / k.worth); if (n) give(p, k.id, n); w -= n * k.worth; } }
const fmt = (w) => { const out = []; for (const k of BIG_FIRST) { const n = Math.floor(w / k.worth); if (n) out.push(`${n} ${k.name.split(" ")[1].toLowerCase()}${n > 1 ? "s" : ""}`); w -= n * k.worth; } return out.join(", ") || "nothing"; };
const tell = (p, s) => p.sendMessage(`§6[League]§r ${s}`);

/** The counter's book: what a player can do, each a label and a deed. */
function deeds(p) {
  const c = invOf(p), list = [];
  list.push([`Sell an emerald: ${fmt(bankBuys(EMERALD_WORTH))}`, () => { if (!count(c, EMERALD)) return tell(p, "You've no emerald."); take(c, EMERALD, 1); paid(p, bankBuys(EMERALD_WORTH)); tell(p, "An emerald bought."); }]);
  list.push([`Buy an emerald: ${fmt(bankSells(EMERALD_WORTH))}`, () => { if (!pay(p, bankSells(EMERALD_WORTH))) return tell(p, "Your purse is short."); give(p, EMERALD, 1); tell(p, "An emerald sold to you."); }]);
  list.push(["Change: break your largest coins", () => { for (const k of BIG_FIRST.slice(0, -1)) if (count(c, k.id)) { take(c, k.id, 1); const smaller = BIG_FIRST[BIG_FIRST.indexOf(k) + 1]; give(p, smaller.id, k.worth / smaller.worth); return tell(p, `A ${k.name} broken into ${k.worth / smaller.worth} ${smaller.name}s.`); } tell(p, "Nothing to break."); }]);
  list.push(["Change: make up your small coin", () => { const have = purse(c); for (const k of COINS) take(c, k.id, count(c, k.id)); paid(p, have); tell(p, `Your purse made up: ${fmt(have)}.`); }]);
  for (const metal of Object.keys(INGOT)) {
    const league = STAMPED.find((b) => b.metal === metal && b.stamp === "league"), keep = bankSells(league.worth) - league.worth;
    list.push([`Warrant 9 ${metal} ingots (League stamp): ${fmt(keep)}`, () => { if (count(c, INGOT_ID[metal]) < BLOCK_INGOTS) return tell(p, `You need ${BLOCK_INGOTS} ${metal} ingots.`); if (!pay(p, keep)) return tell(p, "Your purse is short of the keep."); take(c, INGOT_ID[metal], BLOCK_INGOTS); give(p, league.id, 1); tell(p, `Warranted: ${league.name}.`); }]);
    list.push([`Buy ${league.name}: ${fmt(bankSells(league.worth))}`, () => { if (!pay(p, bankSells(league.worth))) return tell(p, "Your purse is short."); give(p, league.id, 1); tell(p, `Sold to you: ${league.name}.`); }]);
    for (const b of STAMPED.filter((q) => q.metal === metal)) list.push([`Sell ${b.name}: ${fmt(bankBuys(b.worth))}`, () => { if (!count(c, b.id)) return tell(p, `You've no ${b.name}.`); take(c, b.id, 1); paid(p, bankBuys(b.worth)); tell(p, `Bought from you: ${b.name}.`); }]);
  }
  return list;
}
function openBook(p) {
  const list = deeds(p), c = invOf(p), f = new ActionFormData().title("The League's Counter").body(`Your purse: ${fmt(purse(c))}. An obol is an item's worth; a drachma 8, a stater 104, an emerald 16. The bank keeps about 9% either side.`);
  for (const [label] of list) f.button(label);
  f.show(p).then((r) => { if (!r.canceled && r.selection != null) list[r.selection][1](); }).catch(() => {});
}
export function startBank() {
  world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    if (ev.block?.typeId !== COUNTER || !ev.isFirstEvent) return;
    ev.cancel = true; const p = ev.player; system.run(() => openBook(p));
  });
}
