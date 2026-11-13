// The Therans in play: the welcome to Strongyle, and the peoples' harbour tales.
//
// Every player is Theran (config/theran.js): they arrive at the round isle, and the rest of the sea
// knows the Therans only from tales. Sailing into a people's home waters for the first time, you
// hear how they tell it. Theran tablets in the round isle's lost ships (world/sites.js) read only
// for you (charts.js).
import { world, system } from "@minecraft/server";
import { SEA_DIM } from "./dims.js";
import { ARRIVAL, LEGENDS, THERAN } from "./config/theran.js";
import { worldSeed, seaWorldOn } from "./seaworld.js";
import { peopleAt, peoplesReady } from "./world/peoples.js";
import { homeportIfReady, inPort } from "./world/homeport.js";
import { warnOnce } from "./warn.js";

const WELCOMED = "shipwright:theran";
const TALES = "shipwright:tales";
export const TALE_HOLD = 0.5;   // vision: how deep into a people's waters before you hear their tale

/** The first sight of Strongyle: its title, and who you are. Once per player. */
export function welcome(player) {
  try {
    player.onScreenDisplay?.setTitle?.(ARRIVAL.title, { subtitle: ARRIVAL.subtitle, fadeInDuration: 20, stayDuration: 80, fadeOutDuration: 30 });   // vision: a few seconds
  } catch (err) {
    warnOnce("theran-title", `[Shipwright] Title: ${err}`);
  }
  if (player.getDynamicProperty?.(WELCOMED)) return;
  player.setDynamicProperty?.(WELCOMED, true);
  system.runTimeout(() => { try { for (const line of ARRIVAL.first) player.sendMessage(line); } catch { /* left */ } }, 60);   // vision: after the title
}

/** The tale a people tells of the Therans, if this player hasn't heard it yet here (and notes it heard). */
export function taleFor(player, seed, x, z) {
  const hp = homeportIfReady(seed);
  if (hp && inPort(hp, x, z, 200)) return null;   // vision: how far out of Strongyle the tales begin
  if (!peoplesReady(seed, x, z)) return null;
  const p = peopleAt(seed, x, z);
  if (!p || p.hold < TALE_HOLD || !LEGENDS[p.tradition]) return null;
  let heard = [];
  try { heard = JSON.parse(player.getDynamicProperty?.(TALES) ?? "[]"); } catch { heard = []; }
  if (heard.includes(p.tradition)) return null;
  heard.push(p.tradition);
  player.setDynamicProperty?.(TALES, JSON.stringify(heard));
  return `§7In the harbours of ${p.confed.name} they tell a tale of a people they've never placed: §o${LEGENDS[p.tradition]}§r §7(${THERAN.chat.gold}you know who they mean§7)`;
}

export function startTherans() {
  system.runInterval(() => {
    if (!seaWorldOn()) return;
    const seed = worldSeed();
    for (const p of world.getAllPlayers()) {
      try {
        if (p.dimension?.id !== SEA_DIM) continue;
        const t = taleFor(p, seed, p.location.x, p.location.z);
        if (t) p.sendMessage(t);
      } catch (err) {
        warnOnce("theran-tale", `[Shipwright] Tales: ${err}`);
      }
    }
  }, 200);   // vision: every ten seconds
}
