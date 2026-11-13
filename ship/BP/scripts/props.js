// Entity properties, under Bedrock's limit of 32 per entity (over it, the game rejects them all and
// the boat can't be drawn). Small values share a number: each logical name is a "digit" of a
// packed property, at a place value (div) with a range (mod), plus an offset for values that start at 1.
// Mirrored in tools/gen_boats.py (PACKED), which decodes them for the models.

export const PACKED = {
  // three hull-section materials, 12 choices each
  wood_bow: { prop: "woods", div: 1, mod: 12 },
  wood_mid: { prop: "woods", div: 12, mod: 12 },
  wood_stern: { prop: "woods", div: 144, mod: 12 },
  // on/off flags
  sail: { prop: "flags", div: 1, mod: 2 },
  sail_set: { prop: "flags", div: 2, mod: 2 },
  furnace_lit: { prop: "flags", div: 4, mod: 2 },
  outrigger: { prop: "flags", div: 8, mod: 2 },
  moored: { prop: "flags", div: 16, mod: 2 },          // anchored, tied up or beached: modules show moored
  // small choices
  hull_scale: { prop: "kinds", div: 1, mod: 2, offset: 1 },
  rudder_type: { prop: "kinds", div: 2, mod: 2 },
  rig_style: { prop: "kinds", div: 4, mod: 8 },
  prop_style: { prop: "kinds", div: 32, mod: 8 },
  power_type: { prop: "kinds", div: 256, mod: 4 },
  orient: { prop: "kinds", div: 1024, mod: 16 },
};
// Each packed number's default, matching the entity definitions (spruce in all three sections; sail
// set; square rig), so a number that doesn't exist yet starts from the same values the game uses.
export const PACKED_DEFAULTS = { woods: 1 + 12 + 144, flags: 2, kinds: 4 };
// Ranges of the plain number properties, matching the entity definitions (checked by a test).
export const RANGES = {
  stage: [0, 5], mids: [1, 8], beam: [0.75, 1.5], depth: [0.75, 1.5], sail_color: [0, 15],
  yaw: [-180, 180], wind_rel: [-180, 180], wind_str: [0, 1.5], rudder: [-30, 30], sail_fill: [0, 1],
  heel: [-30, 30], rowing: [0, 1], oar_pairs: [0, 4], rig_scale: [0.5, 3], stroke_l: [-1, 1], stroke_r: [-1, 1],
  turn: [-1, 1], telltale: [-1, 1], mods: [0, 4095], deck: [0, 16 ** 7 - 1],
};
// Values worked out from others rather than stored.
const DERIVED = { furnace: (get) => get("power_type") > 0 };

const num = (v) => (v === true ? 1 : v === false ? 0 : Number(v) || 0);

/** Sets a property by its logical name, packing it into its shared number if it has one. */
export function setP(entity, name, value) {
  if (DERIVED[name]) return;                    // set through what it's derived from
  const p = PACKED[name];
  if (!p) {
    let v = value;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) return;            // never send a broken number to the game
      const r = RANGES[name];
      if (r) v = Math.max(r[0], Math.min(r[1], v));
    }
    entity.setProperty(`shipwright:${name}`, v);
    return;
  }
  const raw = entity.getProperty(`shipwright:${p.prop}`);
  const cur = Number(raw ?? PACKED_DEFAULTS[p.prop] ?? 0);
  const digit = Math.floor(cur / p.div) % p.mod;
  const v = Math.max(0, Math.min(p.mod - 1, Math.round(num(value) - (p.offset ?? 0))));
  if (raw !== undefined && digit === v) return;     // unchanged (always write if the number doesn't exist yet)
  entity.setProperty(`shipwright:${p.prop}`, cur - digit * p.div + v * p.div);
}

/** Reads a property by its logical name. Flags come back as true or false. */
export function getP(entity, name) {
  if (DERIVED[name]) return DERIVED[name]((n) => getP(entity, n));
  const p = PACKED[name];
  if (!p) return entity.getProperty(`shipwright:${name}`);
  const raw = entity.getProperty(`shipwright:${p.prop}`) ?? PACKED_DEFAULTS[p.prop];
  if (raw === undefined) return undefined;
  const v = (Math.floor(Number(raw) / p.div) % p.mod) + (p.offset ?? 0);
  return p.prop === "flags" ? v === 1 : v;
}
