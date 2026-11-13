// Bedrock's .mcstructure files (little-endian NBT), written from a vox map, and read back (for the tests). A structure is
// placed whole by the game in one call (world.structureManager.place), so a baked building costs one call, not one a block.
//   writeStructure(vox, { version }) -> Buffer;  readStructure(buf) -> { size, palette, indices }
const TAG = { end: 0, byte: 1, int: 3, string: 8, list: 9, compound: 10 };
class W { constructor() { this.parts = []; } u8(v) { const b = Buffer.alloc(1); b.writeUInt8(v); this.parts.push(b); } i16(v) { const b = Buffer.alloc(2); b.writeInt16LE(v); this.parts.push(b); } i32(v) { const b = Buffer.alloc(4); b.writeInt32LE(v); this.parts.push(b); } str(s) { const b = Buffer.from(s, "utf8"); const l = Buffer.alloc(2); l.writeUInt16LE(b.length); this.parts.push(l, b); } buf() { return Buffer.concat(this.parts); } }
const tagOf = (v) => (typeof v === "boolean" ? TAG.byte : typeof v === "number" ? TAG.int : typeof v === "string" ? TAG.string : Array.isArray(v) ? TAG.list : TAG.compound);
function payload(w, t, v) {
  if (t === TAG.byte) w.u8(v ? 1 : 0);
  else if (t === TAG.int) w.i32(v);
  else if (t === TAG.string) w.str(v);
  else if (t === TAG.list) { const et = v.__type ?? (v.length ? tagOf(v[0]) : TAG.end); w.u8(et); w.i32(v.length); for (const e of v) payload(w, et, e); }
  else { for (const [k, x] of Object.entries(v)) { if (x === undefined) continue; const tt = x?.__tag ?? tagOf(x); w.u8(tt); w.str(k); payload(w, tt, x?.__tag ? x.v : x); } w.u8(TAG.end); }
}
const list = (type, arr) => Object.assign(arr, { __type: type });
/** The game's block version for an engine [major, minor, patch]: major << 24 | minor << 16 | patch << 8. */
export const blockVersion = ([a, b, c]) => (a << 24) | (b << 16) | (c << 8);
export function writeStructure(vox, { version = blockVersion([1, 21, 90]) } = {}) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const k of vox.keys()) { const [x, y, z] = k.split(",").map(Number); x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z); x1 = Math.max(x1, x); y1 = Math.max(y1, y); z1 = Math.max(z1, z); }
  const sx = x1 - x0 + 1, sy = y1 - y0 + 1, sz = z1 - z0 + 1, n = sx * sy * sz;
  const palette = [], index = new Map(), layer0 = new Array(n).fill(-1), layer1 = new Array(n).fill(-1);
  for (const [k, b] of vox) {
    if (b.id === "minecraft:air") continue;
    const key = b.s ? `${b.id}|${JSON.stringify(b.s)}` : b.id; let p = index.get(key);
    if (p === undefined) { p = palette.length; index.set(key, p); palette.push({ name: b.id, states: b.s ?? {}, version }); }
    const [x, y, z] = k.split(",").map(Number); layer0[((x - x0) * sy + (y - y0)) * sz + (z - z0)] = p;   // the game's order: z fastest, then y, then x
  }
  const root = {
    format_version: 1,
    size: list(TAG.int, [sx, sy, sz]),
    structure: {
      block_indices: list(TAG.list, [list(TAG.int, layer0), list(TAG.int, layer1)]),
      entities: list(TAG.compound, []),
      palette: { default: { block_palette: list(TAG.compound, palette.map((q) => ({ name: q.name, states: q.states, version: q.version }))), block_position_data: {} } },
    },
    structure_world_origin: list(TAG.int, [0, 0, 0]),
  };
  const w = new W(); w.u8(TAG.compound); w.str(""); payload(w, TAG.compound, root);
  return { buf: w.buf(), size: [sx, sy, sz], origin: [x0, y0, z0], palette: palette.length };
}
/** Read a structure back (enough to test the writer): its size, palette and first layer. */
export function readStructure(buf) {
  let o = 0; const u8 = () => buf.readUInt8(o++), i16 = () => { const v = buf.readInt16LE(o); o += 2; return v; }, i32 = () => { const v = buf.readInt32LE(o); o += 4; return v; }, str = () => { const l = buf.readUInt16LE(o); o += 2; const s = buf.toString("utf8", o, o + l); o += l; return s; };
  const read = (t) => { if (t === TAG.byte) return u8(); if (t === TAG.int) return i32(); if (t === TAG.string) return str(); if (t === TAG.list) { const et = u8(), n = i32(); return Array.from({ length: n }, () => read(et)); } if (t === TAG.compound) { const out = {}; for (;;) { const tt = u8(); if (tt === TAG.end) return out; out[str()] = read(tt); } } if (t === 2) return i16(); throw new Error(`tag ${t}`); };
  const t = u8(); str(); const root = read(t);
  return { size: root.size, palette: root.structure.palette.default.block_palette, indices: root.structure.block_indices[0], root };
}
