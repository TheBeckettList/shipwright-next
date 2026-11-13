// Paints every folk skin (world/dress.js) and a contact sheet of them, front view.
//   node tools/folkskins.mjs [outdir] [sheet.png]
import fs from "node:fs";
import path from "node:path";
import { encode } from "./png.js";
import { skinOf, CULTURES, RANKS, RULER_SKINS, LEAGUE_SKINS, UV } from "../world/dress.js";
export function allSkins() {
  const out = [];
  for (const t of CULTURES) for (let s = 0; s < RANKS.length; s++) out.push({ name: `${t}_${RANKS[s]}_${s}`, px: skinOf({ tradition: t, slot: s }) });
  for (let k = 0; k < RULER_SKINS; k++) out.push({ name: `theran_ruler_${k}`, px: skinOf({ ruler: k }) });
  for (let k = 0; k < LEAGUE_SKINS; k++) out.push({ name: `league_warden_${k}`, px: skinOf({ warden: k }) });
  return out;
}
// a front view: head front over body front over robe front, arms either side, legs below (the robe drawn over)
function front(px) {
  const S = 4, W = 16 * S, H = 34 * S, img = new Uint8Array(W * H * 3).fill(246);
  const get = (x, y) => { const o = (y * 64 + x) * 4; return [px[o], px[o + 1], px[o + 2], px[o + 3]]; };
  const blit = (sx, sy, w, h, dx, dy) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = get(sx + i, sy + j); if (c[3] < 128) continue; for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) img.set(c.slice(0, 3), ((dy + j) * S + b) * W * 3 / W * W / W + 0) ; } };
  const put = (sx, sy, w, h, dx, dy) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = get(sx + i, sy + j); if (c[3] < 128) continue; for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) { const X = (dx + i) * S + a, Y = (dy + j) * S + b; if (X < W && Y < H) img.set(c.slice(0, 3), (Y * W + X) * 3); } } };
  const fr = (box) => { const [u, v] = box.uv, [w, h, d] = box.size; return [u + d, v + d, w, h]; };
  const [lu, lv, lw, lh] = fr(UV.leg); put(lu, lv, lw, lh, 4, 22); put(lu, lv, lw, lh, 8, 22);
  const [bu, bv, bw, bh] = fr(UV.body); put(bu, bv, bw, bh, 4, 10);
  const [ru, rv, rw, rh] = fr(UV.robe); put(ru, rv, rw, rh, 4, 12);
  const [au, av, aw, ah] = fr(UV.arm); put(au, av, aw, ah, 0, 11); put(au, av, aw, ah, 12, 11);
  const [hu, hv, hw, hh] = fr(UV.hands); put(hu, hv, hw, hh, 4, 15);
  const [eu, ev, ew, eh] = fr(UV.head); put(eu, ev, ew, eh, 4, 0);
  const [tu, tv, tw, th] = fr(UV.hat); put(tu, tv, tw, th, 4, 0);
  const [nu, nv, nw, nh] = fr(UV.nose); put(nu, nv, nw, nh, 7, 6);
  return { w: W, h: H, img };
}
if (process.argv[1]?.endsWith("folkskins.mjs")) {
  const dir = process.argv[2] ?? "skins", sheet = process.argv[3] ?? "folk.png"; fs.mkdirSync(dir, { recursive: true });
  const all = allSkins(), views = all.map((s) => front(s.px));
  for (const s of all) fs.writeFileSync(path.join(dir, `${s.name}.png`), encode(64, 64, s.px, 4));
  const per = RANKS.length, rows = Math.ceil(all.length / per), w = views[0].w + 4, h = views[0].h + 4, W = per * w, H = rows * h, img = new Uint8Array(W * H * 3).fill(255);
  views.forEach((v, k) => { const ox = (k % per) * w, oy = Math.floor(k / per) * h; for (let y = 0; y < v.h; y++) img.set(v.img.subarray(y * v.w * 3, (y + 1) * v.w * 3), ((oy + y) * W + ox) * 3); });
  fs.writeFileSync(sheet, encode(W, H, img, 3));
  console.log(`${all.length} skins in ${dir}; sheet ${sheet} (${W} x ${H}), rows: ${[...CULTURES, "therans' rulers + league"].join(", ")}`);
}
