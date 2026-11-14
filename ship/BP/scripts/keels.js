// The flagship's retracting keels (Richard: "retractable twin keels so she can stand in shallow water, like a mobile
// island"; "remove the rear one, let it rest on two"). Two bilge keels, splayed. They
// reach down as far as the water lets them: in deep water all the way, sailing on them; over shallows they draw up to
// clear the floor; at anchor in shallows they come down onto the floor and she stands on them, still as an island.
// Pure: what the keels do, from her sounding and draught. steering.js shows it and holds her.
import { KEEL_REACH } from "./config/keels.js";

const CLEAR = 0.25;           // vision: water kept under the feet while she moves, blocks

/** Her keels' reach in blocks, or 0 if she has none that retract. */
export const reachOf = (typeId) => KEEL_REACH[String(typeId ?? "").replace("shipwright:", "")] ?? 0;

/**
 * The keels' set: extension 0 (drawn up into her) .. 1 (all the way down), and whether she stands on them.
 * under: water depth under her in blocks (the sounding); draft: her hull's draught; anchored: at rest on her anchor.
 */
export function keelLaw({ reach, under, draft, anchored }) {
  if (!reach) return { ext: 1, standing: false };
  if (under == null || under >= draft + reach + CLEAR) return { ext: 1, standing: false };   // deep: all the way down
  const room = Math.max(0, under - draft);                                                    // water between hull and floor
  if (anchored) return { ext: Math.min(1, room / reach), standing: true };                    // down onto the floor: she stands
  return { ext: Math.max(0, Math.min(1, (room - CLEAR) / reach)), standing: false };          // up enough to clear it
}
