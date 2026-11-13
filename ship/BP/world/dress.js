// Pure. What each people wears, from what it has: the fibre its land gives, the dyes its climate grows
// (looks.js PALETTES) and the dyes its trade brings, the cut its climate and its work ask for, its own
// motif on the borders (looks.js MOTIFS), its armour from its own metal, hide, wood or fibre. Every
// person is a skin for the folk (64 x 64, the layout below), painted from these laws.
//
//   fibre      wool where it's cold and there are sheep; linen in the temperate west; cotton in the dry
//              and the hot; silk where the mulberry grows; hide and fur in the far north and the north
//              woods; bark cloth in the Pacific; cedar bark on the north-west coast
//   cut        the climate's: covered and layered in the cold (parka, tunic over trousers), long and
//              loose in the dry heat (robe, kaftan), wrapped where it's hot and wet (sarong, kilt),
//              cross-collared and sashed in the east (kimono, hanfu)
//   colour     the people's own dyes, and one bought dye: the dye its trade most reaches for (the
//              Therans' saffron and murex purple; the rest buy the Therans' blue, Egyptian blue, through
//              the Exchange). Undyed cloth is the fibre's own colour
//   pattern    stripes in the Fibonacci word (a band where the word says 1), the motif on the hem
//   rank       folk, cleric (the faith's sea-blue stole, the same for every people: one faith), guard
//              (the people's armour), ruler (the Therans' great houses: murex purple and gold),
//              warden (the League's sea wardens: a sea-blue tabard with the League's rose)
//   skin       a range of tones by the homeland's sun (the farther from the equator, the lighter), each
//              person a step within it; Thera mixes everyone
import { PHI, FIB, word, golden } from "../core/golden.js";
import { DYE } from "./textures.js";
import { LOOKS, SPECIAL, MOTIFS, dyesOf } from "./looks.js";

// vision: each people's dress, after how it really dressed (the one design choice per people)
export const DRESS = {
  norse: { fibre: "wool", cut: "tunic", legs: "trousers", head: "hood", armour: "mail", helm: "nasal", note: "wool tunic over trousers, a hooded cloak; mail and the nasal helm" },
  european: { fibre: "linen", cut: "gown", legs: "hose", head: "coif", armour: "plate", helm: "sallet", note: "linen shirt, wool gown or doublet, hose; plate over mail" },
  birchbark: { fibre: "hide", cut: "tunic", legs: "leggings", head: "bare", armour: "slat", helm: "none", note: "buckskin shirt and leggings, quillwork bands; rod-and-slat armour" },
  pacific: { fibre: "barkcloth", cut: "wrap", legs: "bare", head: "bare", armour: "sennit", helm: "none", note: "tapa wrap, bare above it, tattooed bands; coconut-fibre armour (Kiribati)" },
  indian_ocean: { fibre: "cotton", cut: "kaftan", legs: "robe", head: "turban", armour: "padded", helm: "turban", note: "the long cotton kanzu or kaftan, the turban or kofia; quilted cotton and mail" },
  east_asian: { fibre: "silk", cut: "crossed", legs: "robe", head: "cap", armour: "lamellar", helm: "bowl", note: "the cross-collared robe and sash, the black cap; lamellar of iron" },
  japanese: { fibre: "silk", cut: "crossed", legs: "hakama", head: "bare", armour: "laced", helm: "kabuto", note: "kimono and obi over hakama; laced lamellar, lacquered" },
  dugout: { fibre: "cedar", cut: "blanket", legs: "bare", head: "basket", armour: "slat", helm: "none", note: "the north-west coast: woven cedar-bark capes and hats, the button blanket; wooden slat and hide armour" },
  shallow: { fibre: "cotton", cut: "wrap", legs: "sarong", head: "headcloth", armour: "padded", helm: "headcloth", note: "batik sarong and jacket, the headcloth; padded cotton and rattan" },
  arctic: { fibre: "fur", cut: "parka", legs: "trousers", head: "furhood", armour: "bone", helm: "furhood", note: "the caribou and seal parka, fur trim, beaded borders; bone-slat armour" },
  therans: { fibre: "linen", cut: "kilt", legs: "bare", head: "bare", armour: "bronze", helm: "tusk", note: "the Akrotiri frescoes: the kilt and the flounced skirt, saffron and blue; bronze and the boar's-tusk helm" },
};
// the fibres' own colours (undyed), as RGB
const FIBRE = { wool: [178, 168, 148], linen: [222, 212, 186], cotton: [236, 232, 220], silk: [226, 222, 206], hide: [168, 126, 84], fur: [206, 194, 172], barkcloth: [204, 172, 124], cedar: [150, 104, 66] };   // vision: the fibres' colours
// the dye each people's trade brings (one bought colour): the Therans' own are saffron and murex
export const BOUGHT = { therans: ["orange", "purple"], default: ["light_blue"] };   // vision: saffron and murex purple are Thera's; Thera's blue is what the Exchange sells everyone
// the armours' colours: [main, shade, lace or rivet]
const ARMOUR = {
  mail: [[150, 152, 156], [98, 100, 106], [70, 72, 76]], plate: [[196, 198, 202], [130, 132, 138], [90, 92, 98]], slat: [[150, 110, 70], [104, 74, 46], [60, 40, 26]],   // vision: the painter's drawing (rows, columns and shades of the skin)
  sennit: [[196, 160, 104], [150, 118, 72], [110, 84, 48]], padded: [[230, 222, 200], [196, 186, 160], [150, 140, 116]], lamellar: [[120, 122, 128], [80, 82, 88], [160, 40, 34]],   // vision: the painter's drawing (rows, columns and shades of the skin)
  laced: [[40, 34, 32], [24, 20, 20], [176, 40, 34]], bone: [[226, 218, 196], [186, 176, 150], [120, 100, 80]], bronze: [[184, 128, 64], [140, 92, 44], [220, 170, 90]],   // vision: the painter's drawing (rows, columns and shades of the skin)
};   // vision: the armours' colours (laced: black lacquer, red lacing; lamellar: iron with red; bronze and its polish)
// skin tones, lightest to darkest (vision: a plain ramp of human skin colours), and each people's range by its homeland's sun
const TONES = [[242, 212, 190], [226, 190, 160], [204, 160, 122], [174, 126, 90], [138, 94, 62], [100, 66, 44]];   // vision: the painter's drawing (rows, columns and shades of the skin)
const RANGE = { norse: [0, 2], european: [0, 3], birchbark: [2, 4], pacific: [3, 5], indian_ocean: [2, 5], east_asian: [1, 3], japanese: [1, 2], dugout: [2, 4], shallow: [3, 4], arctic: [2, 4], therans: [2, 4] };   // vision: by latitude of the homeland, broad
const HAIR = [[30, 24, 20], [70, 46, 30], [120, 80, 44], [196, 160, 100], [40, 30, 26]];   // vision: black, dark brown, brown, fair, near-black
const HAIRS = { norse: [1, 2, 3], european: [1, 2, 3], default: [0, 4, 1] };   // vision: the painter's drawing (rows, columns and shades of the skin)

export const RANKS = ["folk", "folk", "folk", "folk", "cleric", "guard", "crafter", "elder"];   // a people's eight skins: four everyday, the cleric, the guard, the crafter (its apron), the elder (grey hair, the long garment)
export const LEAGUE_SKINS = 4, RULER_SKINS = 4;   // vision: the painter's drawing (rows, columns and shades of the skin)
export const CULTURES = Object.keys(DRESS);
/** A skin's index: a people's eight, then the Therans' rulers, then the League's wardens. */
export const skinIndex = (tradition, slot) => CULTURES.indexOf(tradition) * RANKS.length + slot;
export const rulerIndex = (k) => CULTURES.length * RANKS.length + (k % RULER_SKINS);
export const wardenIndex = (k) => CULTURES.length * RANKS.length + RULER_SKINS + (k % LEAGUE_SKINS);
export const SKINS = CULTURES.length * RANKS.length + RULER_SKINS + LEAGUE_SKINS;

// ---- the layout (64 x 64), box UVs in the standard order (top, bottom; right, front, left, back), the entity facing -z
export const UV = {
  head: { uv: [0, 0], size: [8, 10, 8] }, hat: { uv: [32, 0], size: [8, 10, 8] }, nose: { uv: [28, 46], size: [2, 4, 2] },   // given: the skin layout (64 x 64, the model's boxes: world/dress.js UV, tools/buildmod.mjs geometry)
  body: { uv: [16, 20], size: [8, 12, 6] }, robe: { uv: [0, 38], size: [8, 20, 6] }, leg: { uv: [0, 22], size: [4, 12, 4] },   // given: the skin layout (64 x 64, the model's boxes: world/dress.js UV, tools/buildmod.mjs geometry)
  arm: { uv: [44, 22], size: [4, 8, 4] }, hands: { uv: [40, 38], size: [8, 4, 4] },   // given: the skin layout (64 x 64, the model's boxes: world/dress.js UV, tools/buildmod.mjs geometry)
};
/** Every pixel of a box's faces: (face, i, j) with i across, j down, from the face's top-left. */
function faces(box) {
  const [u, v] = box.uv, [w, h, d] = box.size, out = [];
  const F = { top: [u + d, v, w, d], bottom: [u + d + w, v, w, d], right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h] };
  for (const [face, [x0, y0, fw, fh]] of Object.entries(F)) for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) out.push([face, i, j, x0 + i, y0 + j, fw, fh]);
  return out;
}
const mix = (a, b, t) => a.map((c, k) => Math.round(c * (1 - t) + b[k] * t));
const dye = (name) => DYE[name] ?? DYE.white;

/** A person's look: the colours and choices a skin is painted from. */
export function lookOf(tradition, slot, k = 0) {
  const D = DRESS[tradition] ?? DRESS.european, own = dyesOf(tradition), bought = BOUGHT[tradition] ?? BOUGHT.default;
  const g = golden(slot + 7 * k + CULTURES.indexOf(tradition));   // derived: the golden sequence picks each choice, so no two neighbours repeat
  const dyes = [...own, ...bought], main = g < 1 / PHI ** 2 ? FIBRE[D.fibre] : dye(dyes[Math.floor(g * dyes.length) % dyes.length]);   // derived: two in five wear the fibre undyed
  const second = dye(dyes[(Math.floor(g * dyes.length) + 1 + (slot % 2)) % dyes.length]);
  const [t0, t1] = RANGE[tradition] ?? [1, 4], tone = TONES[t0 + Math.floor(golden(slot * 3 + k + 11) * (t1 - t0 + 1))];   // vision: the painter's drawing (rows, columns and shades of the skin)
  const hs = HAIRS[tradition] ?? HAIRS.default, hair = HAIR[hs[Math.floor(golden(slot * 5 + k + 3) * hs.length)]];   // vision: the painter's drawing (rows, columns and shades of the skin)
  const motif = MOTIFS[(LOOKS[tradition] ?? SPECIAL.therans[0]).motif] ?? MOTIFS.spiral;
  const long = word(slot + k) === 1;   // derived: the word says whose hair is long
  return { D, main, second, tone, hair, motif, long, rank: RANKS[slot] ?? "folk", armour: ARMOUR[D.armour] ?? ARMOUR.padded, trim: dye(own[0]) };
}

/** Paint a skin: RGBA 64 x 64. who: { tradition, slot } or { ruler: k } or { warden: k }. */   // vision: the painter's drawing (rows, columns and shades of the skin)
export function skinOf(who) {
  const px = new Uint8Array(64 * 64 * 4);   // vision: the painter's drawing (rows, columns and shades of the skin)
  const set = (x, y, c, a = 255) => { const o = (y * 64 + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = a; };   // vision: the painter's drawing (rows, columns and shades of the skin)
  let L;
  if (who.ruler !== undefined) { L = lookOf("therans", 0, who.ruler); L.main = dye("purple"); L.second = dye("yellow"); L.rank = "ruler"; L.long = true; }
  else if (who.warden !== undefined) { const t = CULTURES[(who.warden * 3) % CULTURES.length]; L = lookOf(t, who.warden, 1); L.rank = "warden"; L.tradition = t; }   // vision: the painter's drawing (rows, columns and shades of the skin)
  else L = lookOf(who.tradition, who.slot, who.k ?? 0);
  const D = L.D, shade = (c, t = 0.25) => mix(c, [0, 0, 0], t), lite = (c, t = 0.25) => mix(c, [255, 255, 255], t);   // vision: the painter's drawing (rows, columns and shades of the skin)
  const elder = L.rank === "elder", hair = elder ? [196, 196, 190] : L.hair;   // vision: the painter's drawing (rows, columns and shades of the skin)
  const stripe = (j) => word(j) === 1 && j % FIB[4] === 2;   // derived: a thin stripe every fifth row where the word says so
  const hem = (i, j, w, h) => { const X = ((i / w) * 32 - 16) | 0, Y = ((j / h) * 32 - 16) | 0; return L.motif(X, Y) > 0.5; };   // vision: the painter's drawing (rows, columns and shades of the skin)
  // the head: skin, hair, eyes and brows on the front
  for (const [f, i, j, x, y, w, h] of faces(UV.head)) {
    let c = L.tone;
    if (f === "top" || (f === "back" && j < (L.long ? 9 : 5)) || ((f === "left" || f === "right") && j < (L.long ? 7 : 3))) c = hair;   // vision: the painter's drawing (rows, columns and shades of the skin)
    if (f === "front") { if (j < 2) c = hair; if (j === 3 && (i === 1 || i === 2 || i === 5 || i === 6)) c = shade(hair, 0.1); if (j === 4 && (i === 2 || i === 5)) c = [240, 240, 236]; if (j === 4 && (i === 1 || i === 6)) c = [60, 44, 30]; if (j === 7 && i > 2 && i < 5) c = shade(L.tone, 0.3); if (elder && j >= 6 && j <= 9 && i > 0 && i < 7 && !(who.tradition === "japanese")) c = hair; }   // vision: the painter's drawing (rows, columns and shades of the skin)
    set(x, y, c);
  }
  for (const [, , , x, y] of faces(UV.nose)) set(x, y, shade(L.tone, 0.08));   // given: the skin layout (64 x 64, the model's boxes: world/dress.js UV, tools/buildmod.mjs geometry)
  // the hat layer: headwear, or the helm for a guard; transparent elsewhere
  const helmOf = L.rank === "guard" ? D.helm : L.rank === "ruler" ? "circlet" : L.rank === "cleric" ? "veil" : D.head;
  for (const [f, i, j, x, y, w, h] of faces(UV.hat)) {
    let c = null;
    const band = (n) => (f !== "bottom" && j < n) || f === "top";
    switch (helmOf) {
      case "hood": case "furhood": if (f === "top" || f === "back" || ((f === "left" || f === "right") && j < h) || (f === "front" && (j < 2 || i === 0 || i === w - 1))) c = helmOf === "furhood" ? (f === "front" ? [236, 230, 214] : FIBRE.fur) : L.second; break;   // vision: the painter's drawing (rows, columns and shades of the skin)
      case "coif": if (band(3) || (f !== "front" && f !== "top" && j < 8)) c = FIBRE.linen; break;   // vision: the painter's drawing (rows, columns and shades of the skin)
      case "cap": if (band(3)) c = [28, 26, 26]; break;   // vision: the painter's drawing (rows, columns and shades of the skin)
      case "turban": if (band(4)) c = (j + i) % 3 === 0 ? shade(L.second, 0.2) : L.second; break;   // vision: the painter's drawing (rows, columns and shades of the skin)
      case "headcloth": if (band(3)) c = (i + j) % 2 ? L.second : shade(L.second, 0.3); break;   // vision: the painter's drawing (rows, columns and shades of the skin)
      case "basket": if (band(3)) c = (i + j) % 2 ? FIBRE.cedar : shade(FIBRE.cedar, 0.3); break;   // vision: the painter's drawing (rows, columns and shades of the skin)
      case "veil": if (f !== "front" && f !== "bottom" && (f === "top" || j < 8)) c = dye("light_blue"); if (f === "front" && j < 2) c = dye("light_blue"); break;   // vision: the painter's drawing (rows, columns and shades of the skin)
      case "circlet": if (f !== "top" && f !== "bottom" && j === 2) c = dye("yellow"); break;
      case "nasal": case "sallet": case "bowl": case "kabuto": case "tusk": {
        const [m, s2, r] = L.armour;
        if (band(4)) c = helmOf === "tusk" ? (j % 2 ? [236, 228, 206] : [176, 160, 130]) : j === 3 ? s2 : m;   // the boar's-tusk helm: rows of tusk plates   // vision: the painter's drawing (rows, columns and shades of the skin)
        if (helmOf === "nasal" && f === "front" && j < 7 && (i === 3 || i === 4)) c = m;   // vision: the painter's drawing (rows, columns and shades of the skin)
        if (helmOf === "kabuto" && f === "front" && j === 0 && i > 1 && i < 6) c = dye("yellow");   // the crest   // vision: the painter's drawing (rows, columns and shades of the skin)
        if (helmOf === "kabuto" && (f === "left" || f === "right" || f === "back") && j >= 4 && j < 7) c = r;   // the neck guard's lacing   // vision: the painter's drawing (rows, columns and shades of the skin)
        if (helmOf === "sallet" && f !== "front" && j < 7) c = m;   // vision: the painter's drawing (rows, columns and shades of the skin)
        break;
      }
      default: break;
    }
    if (c) set(x, y, c); else set(x, y, [0, 0, 0], 0);
  }
  // the garment: body (the upper) and robe (the lower, over the legs)
  const bare = D.cut === "wrap" || D.cut === "kilt";
  const SKIRT = 8, FULL = 12;   // the robe's rows: the waist at its eighth, twelve rows to the ankle (the layout's own geometry)   // vision: the painter's drawing (rows, columns and shades of the skin)
  const REACH = { robe: FULL, gown: FULL, kaftan: FULL, crossed: FULL, blanket: 9, parka: 9, tunic: 7, kilt: 4, wrap: 7 };   // vision: how far down each cut goes (rows below the waist: twelve the ankle, eight the knee)
  const reachOf = () => (L.rank === "elder" || L.rank === "cleric" || L.rank === "ruler" ? FULL : L.rank === "guard" ? Math.min(REACH[D.cut] ?? FULL, 8) : REACH[D.cut] ?? FULL);   // vision: the painter's drawing (rows, columns and shades of the skin)
  const garment = (box, upper) => {
    for (const [f, i, j, x, y, w, h] of faces(box)) {
      let c = L.main, a = 255;   // vision: the painter's drawing (rows, columns and shades of the skin)
      if (L.rank === "guard") {   // the people's armour over the garment
        const [m, s2, r] = L.armour, k = D.armour;
        if (upper || j - SKIRT < 5) {   // vision: the painter's drawing (rows, columns and shades of the skin)
          c = k === "mail" ? ((i + j) % 2 ? m : s2) : k === "plate" ? (i === 2 || i === 5 ? lite(m, 0.2) : m) : k === "laced" || k === "lamellar" ? (j % 2 === 0 && i % 2 === 0 ? r : j % 2 ? s2 : m)   // vision: the painter's drawing (rows, columns and shades of the skin)
            : k === "slat" || k === "bone" ? (i % 2 ? m : s2) : k === "padded" ? ((i + j) % 4 === 0 || (i - j + 64) % 4 === 0 ? s2 : m) : k === "sennit" ? ((i + (j >> 1)) % 2 ? m : s2) : k === "bronze" ? (j % 3 === 0 ? r : m) : m;   // vision: the painter's drawing (rows, columns and shades of the skin)
        } else c = L.main;
      } else if (L.rank === "warden") {   // the League's tabard: sea blue, the rose on the chest
        c = upper || j - SKIRT < 6 ? dye("cyan") : L.main;   // vision: the painter's drawing (rows, columns and shades of the skin)
        if (upper && f === "front" && Math.hypot(i - 3.5, j - 4.5) < 2.2) c = Math.hypot(i - 3.5, j - 4.5) < 1 ? dye("yellow") : dye("purple");   // vision: the painter's drawing (rows, columns and shades of the skin)
        if (f === "front" && (i === 0 || i === w - 1)) c = dye("purple");
      } else if (L.rank === "ruler") {
        c = L.main; if (j === h - 1 || (f === "front" && (i === 0 || i === w - 1)) || (upper && j === 0)) c = dye("yellow");
        if (!upper && j - SKIRT >= reachOf() - 4 && hem(i, j - SKIRT - (reachOf() - 4), w, 4)) c = dye("yellow");   // vision: the painter's drawing (rows, columns and shades of the skin)
      } else {
        if (bare && upper) { c = L.tone; if (D.cut === "wrap" && j > 3 && j < 6 && (f === "front" || f === "back")) c = shade(L.tone, 0.35); if (L.rank === "cleric" || L.rank === "elder") c = L.main; }   // bare above the wrap: the Pacific's tattooed band   // vision: the painter's drawing (rows, columns and shades of the skin)
        if (D.cut === "crossed" && upper && f === "front" && (i === j || i === w - 1 - j + 1)) c = lite(L.main, 0.35);   // the crossed collar   // vision: the painter's drawing (rows, columns and shades of the skin)
        if (D.cut === "crossed" && upper && j >= 8 && j <= 10) c = L.second;   // the sash, the obi   // vision: the painter's drawing (rows, columns and shades of the skin)
        if ((D.cut === "tunic" || D.cut === "gown" || D.cut === "parka") && upper && j === 9) c = [70, 48, 30];   // the belt   // vision: the painter's drawing (rows, columns and shades of the skin)
        if (D.cut === "parka" && ((upper && j === 0) || (!upper && j - SKIRT >= reachOf() - 2))) c = [236, 230, 214];   // fur trim   // vision: the painter's drawing (rows, columns and shades of the skin)
        if (D.cut === "blanket" && upper && j < 7) { c = [28, 34, 56]; if (j === 6 || ((f === "front" || f === "back") && (i + j) % 3 === 0 && j > 1)) c = j === 6 ? dye("red") : [238, 236, 230]; }   // the button blanket: navy, its red border, its shell buttons   // vision: the painter's drawing (rows, columns and shades of the skin)
        if (!upper && stripe(j - SKIRT)) c = L.second;
        if (!upper && j - SKIRT >= reachOf() - 3 && hem(i, j - SKIRT - (reachOf() - 3), w, 3)) c = L.trim;   // the motif on the hem   // vision: the painter's drawing (rows, columns and shades of the skin)
        if (L.rank === "cleric" && f === "front" && (i === 2 || i === 5)) c = j % 4 === 0 ? [236, 240, 240] : dye("light_blue");   // the faith's stole: sea blue, its white wave   // vision: the painter's drawing (rows, columns and shades of the skin)
        if (L.rank === "crafter" && f === "front" && i > 0 && i < w - 1 && (upper ? j > 3 : j < 8)) c = [134, 96, 60];   // the apron   // vision: the painter's drawing (rows, columns and shades of the skin)
      }
      // how far down the lower garment goes: to the ankle for robes, the knee for tunics, the thigh for kilts and wraps
      if (!upper && (j < SKIRT || j - SKIRT >= reachOf() || f === "top" || f === "bottom")) a = 0;   // the lower garment: from the waist down as far as its cut goes
      if (a) set(x, y, c); else set(x, y, [0, 0, 0], 0);
    }
  };
  garment(UV.body, true); garment(UV.robe, false);
  // the arms: sleeves, the hands in front
  for (const [f, i, j, x, y] of faces(UV.arm)) set(x, y, bare && L.rank === "folk" ? L.tone : j > 6 ? L.tone : L.rank === "guard" ? L.armour[0] : L.rank === "warden" ? dye("cyan") : L.main);   // given: the skin layout (64 x 64, the model's boxes: world/dress.js UV, tools/buildmod.mjs geometry)
  for (const [f, i, j, x, y] of faces(UV.hands)) set(x, y, (f === "front" || f === "top") && (i < 2 || i > 5) ? (L.rank === "guard" ? L.armour[1] : L.main) : L.tone);   // given: the skin layout (64 x 64, the model's boxes: world/dress.js UV, tools/buildmod.mjs geometry)
  // the legs: trousers, hose, leggings, hakama or bare; feet
  for (const [f, i, j, x, y, w, h] of faces(UV.leg)) {
    let c = L.tone;
    if (["trousers", "hose", "leggings", "hakama", "robe", "sarong"].includes(D.legs)) c = D.legs === "hose" ? L.second : D.legs === "leggings" ? FIBRE.hide : D.legs === "hakama" ? shade(L.second, 0.3) : D.legs === "trousers" ? (D.fibre === "fur" ? FIBRE.fur : shade(L.main, 0.3)) : L.main;   // vision: the painter's drawing (rows, columns and shades of the skin)
    if (j >= h - 2) c = D.legs === "bare" ? shade(L.tone, 0.1) : [60, 44, 30];   // the feet: shoes or boots, or bare   // vision: the painter's drawing (rows, columns and shades of the skin)
    set(x, y, c);
  }
  details(L, who, px);
  shadeSkin(px);
  return px;
}

// ---- the details, after the research (claude/own-blocks-and-facades.md: the peoples' dress): faces, hair, each
// people's own garments and ornament; then the shading that gives the boxes their volume
const at = (box, face, i, j) => { const [u, v] = UV[box].uv, [w, h, d] = UV[box].size, F = { top: [u + d, v], bottom: [u + d + w, v], right: [u, v + d], front: [u + d, v + d], left: [u + d + w, v + d], back: [u + 2 * d + w, v + d] }[face]; return [F[0] + i, F[1] + j]; };
const W_ = (box, face) => (face === "front" || face === "back" || face === "top" || face === "bottom" ? UV[box].size[0] : UV[box].size[2]), H_ = (box, face) => (face === "top" || face === "bottom" ? UV[box].size[2] : UV[box].size[1]);
function details(L, who, px) {
  const set = (box, face, i, j, c, a = 255) => { const [x, y] = at(box, face, i, j), o = (y * 64 + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = a; };   // vision: the painter's drawing (rows, columns and shades of the skin)
  const get = (box, face, i, j) => { const [x, y] = at(box, face, i, j), o = (y * 64 + x) * 4; return [px[o], px[o + 1], px[o + 2], px[o + 3]]; };   // vision: the painter's drawing (rows, columns and shades of the skin)
  const t = who.tradition ?? (who.ruler !== undefined ? "therans" : L.tradition), slot = who.slot ?? 0, fem = slot % 2 === 1 || (who.ruler ?? 0) % 2 === 1, elder = L.rank === "elder";
  const g = golden(slot * 11 + CULTURES.indexOf(t) * 3 + (who.k ?? 0)), sh = (c, k) => c.map((x) => Math.round(x * k)), hair = elder ? [196, 196, 190] : L.hair;   // vision: the painter's drawing (rows, columns and shades of the skin)
  // the face: eyes (white, then the iris toward the middle), brows, the mouth, a cheek's shade
  const iris = (t === "norse" || t === "european") && g < 1 / PHI ? (g < 1 / PHI ** 2 ? [70, 110, 150] : [110, 120, 110]) : [62, 42, 28];   // vision: blue or grey eyes among some northerners; brown elsewhere
  for (const [wi, ii] of [[1, 2], [6, 5]]) { set("head", "front", wi, 4, [240, 238, 232]); set("head", "front", ii, 4, iris); set("head", "front", wi, 3, sh(hair, 0.8)); set("head", "front", ii, 3, sh(hair, 0.8)); }   // vision: the painter's drawing (rows, columns and shades of the skin)
  set("head", "front", 3, 7, sh(L.tone, 0.72).map((c, k) => k === 0 ? Math.min(255, c + 24) : c)); set("head", "front", 4, 7, sh(L.tone, 0.72).map((c, k) => k === 0 ? Math.min(255, c + 24) : c));   // the lips   // vision: the painter's drawing (rows, columns and shades of the skin)
  for (const i of [0, 7]) for (let j = 2; j < 10; j++) { const c = get("head", "front", i, j); if (c[3]) set("head", "front", i, j, sh(c, 0.9)); }   // the face's sides in shade   // vision: the painter's drawing (rows, columns and shades of the skin)
  // beards: some men of the north, the east's elders
  if (!fem && (((t === "norse" || t === "european") && g > 1 / PHI ** 2) || (elder && (t === "east_asian" || t === "indian_ocean")))) for (let j = 6; j < 10; j++) for (let i = 1; i < 7; i++) if (!(j === 7 && (i === 3 || i === 4))) set("head", "front", i, j, sh(hair, j === 6 ? 0.9 : 1));   // vision: the painter's drawing (rows, columns and shades of the skin)
  // each people's own marks
  if (t === "therans" && fem) { set("head", "front", 1, 6, [196, 54, 44]); set("head", "front", 6, 6, [196, 54, 44]); }   // the saffron-dot cheeks of the Akrotiri women   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "arctic" && fem) for (const i of [2, 3, 4, 5]) for (const j of [8, 9]) if (i % 2 === 0 || j === 9) set("head", "front", i, j, sh(L.tone, 0.62).map((c, k) => k === 2 ? c + 24 : c));   // the chin's lines   // vision: the painter's drawing (rows, columns and shades of the skin)
  // hair: the peoples' own ways
  const hat = (face, i, j, c) => set("hat", face, i, j, c);
  if (t === "therans" && !fem && L.rank === "folk") { for (const f of ["top", "left", "right", "back"]) for (let j = 0; j < H_("head", f); j++) for (let i = 0; i < W_("head", f); i++) { const c = get("head", f, i, j); if (c[3] && (f === "top" || j < 4)) set("head", f, i, j, [104, 128, 156]); }   // the youths' shaved scalp, painted blue   // vision: the painter's drawing (rows, columns and shades of the skin)
    for (const i of [1, 4, 6]) for (let j = 0; j < 9; j++) hat("back", i, j, [26, 22, 22]); hat("top", 3, 6, [26, 22, 22]); }   // a few long locks left   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "therans" && fem) for (let j = 0; j < 10; j++) for (const i of [0, 1, 2, 5, 6, 7]) hat("back", i, j, j % 3 === 2 ? sh(hair, 0.7) : hair);   // the women's long tresses   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "japanese" && !fem && L.rank === "folk") { for (let i = 2; i < 6; i++) for (let j = 0; j < 4; j++) set("head", "top", i, j, sh(L.tone, 0.95)); for (let i = 3; i < 5; i++) { hat("top", i, 5, hair); hat("top", i, 6, hair); } }   // the shaved pate, the topknot   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "japanese" && L.rank === "crafter") for (const f of ["front", "left", "right", "back"]) for (let i = 0; i < W_("hat", f); i++) hat(f, i, 2, (i + (f === "front" ? 0 : 1)) % 3 ? [232, 232, 226] : [46, 62, 112]);   // the tenugui, knotted   // vision: the painter's drawing (rows, columns and shades of the skin)
  if ((t === "norse" || t === "birchbark") && fem) for (const i of [0, 7]) for (let j = 3; j < 10; j++) hat("front", i, j, j % 2 ? hair : sh(hair, 0.75));   // braids down the front   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "birchbark" && !fem) for (const f of ["left", "right"]) for (let j = 3; j < 10; j++) hat(f, 1, j, j % 2 ? hair : sh(hair, 0.75));   // the men's braids by the ears   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "arctic") for (let i = 0; i < 8; i++) set("head", "front", i, 2, hair);   // the straight fringe   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "indian_ocean" && !fem && L.rank === "folk") for (const f of ["front", "left", "right", "back", "top"]) for (let i = 0; i < W_("hat", f); i++) for (let j = 0; j < (f === "top" ? H_("hat", f) : 3); j++) hat(f, i, j, (i + j) % 3 === 0 ? [176, 140, 96] : [238, 234, 222]);   // the kofia, white, its stitching tan   // vision: the painter's drawing (rows, columns and shades of the skin)
  // the garments
  const body = (face, i, j, c) => set("body", face, i, j, c), robe = (face, i, j, c) => { if (get("robe", face, i, j)[3]) set("robe", face, i, j, c); };   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "norse" && fem && L.rank === "folk") { body("front", 1, 2, [196, 160, 70]); body("front", 6, 2, [196, 160, 70]); for (let i = 2; i < 6; i++) body("front", i, 3, [[54, 120, 170], [196, 120, 40], [170, 40, 34], [60, 140, 90]][i % 4]); for (const i of [1, 6]) body("front", i, 0, sh(L.main, 0.8)); }   // the apron dress's oval brooches, the beads strung between   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "therans" && fem && L.rank !== "guard") { const tiers = [[196, 54, 44], [222, 178, 66], [52, 86, 176]]; for (const f of ["front", "back", "left", "right"]) for (let j = 8; j < 20; j++) for (let i = 0; i < W_("robe", f); i++) { const k = Math.floor((j - 8) / 3) % 3, c = tiers[(k + (j % 3 === 2 ? 1 : 0)) % 3]; robe(f, i, j, j % 3 === 2 ? sh(c, 0.7) : c); }   // the flounced skirt, its tiers saffron, red and blue   // vision: the painter's drawing (rows, columns and shades of the skin)
    for (const f of ["front", "back"]) for (let i = 0; i < 8; i++) for (let j = 0; j < 7; j++) body(f, i, j, j < 2 || i === 0 || i === 7 ? [222, 178, 66] : [52, 86, 176]);   // the short jacket, its border gold   // vision: the painter's drawing (rows, columns and shades of the skin)
    for (let i = 2; i < 6; i++) body("front", i, 1, [214, 170, 62]); }   // the necklace   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "arctic" && L.rank !== "cleric" && L.rank !== "guard") { const CARIBOU = [[112, 80, 54], [94, 66, 44]]; for (const box of ["body", "robe", "arm"]) for (const f of ["front", "back", "left", "right"]) for (let j = 0; j < H_(box, f); j++) for (let i = 0; i < W_(box, f); i++) { const c = get(box, f, i, j); if (c[3] && Math.abs(c[0] - L.main[0]) + Math.abs(c[1] - L.main[1]) + Math.abs(c[2] - L.main[2]) < 30) set(box, f, i, j, CARIBOU[(i + j * 3) % 5 ? 0 : 1]); } }   // the parka's caribou, dark, the fur flecked   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "arctic") { const W2 = [236, 230, 214]; for (const f of ["front", "back"]) for (let i = 0; i < 8; i++) { body(f, i, 4, W2); body(f, i, 5, W2); } for (const f of ["front", "left", "right", "back"]) for (let i = 0; i < W_("arm", f); i++) set("arm", f, i, 6, W2);   // the white fur bands at the chest, the wrists   // vision: the painter's drawing (rows, columns and shades of the skin)
    for (const f of ["front", "left", "right"]) for (let i = 0; i < W_("hat", f); i++) for (let j = 0; j < 2; j++) if (get("hat", f, i, j)[3]) hat(f, i, j, (i + j) % 3 ? W2 : [60, 54, 50]); }   // the ruff, its tips dark   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "japanese" && L.rank === "folk" && !fem) for (const f of ["front", "back", "left", "right"]) for (let i = 0; i < W_("body", f); i++) for (let j = 0; j < 12; j++) body(f, i, j, f === "back" && Math.hypot(i - 3.5, j - 4.5) < 2 ? [236, 236, 230] : (f === "front" && (i === 3 || i === 4)) ? [236, 236, 230] : [42, 56, 98]);   // the indigo hanten, its collar white, a round mark on its back   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "indian_ocean" && !fem) { for (const f of ["front"]) for (let j = 0; j < 5; j++) body(f, 3, j, [176, 140, 96]); if (elder) for (const f of ["front", "back", "left", "right"]) for (let i = 0; i < W_("body", f); i++) for (let j = 0; j < 12; j++) if (f !== "front" || i < 2 || i > 5) body(f, i, j, (f === "front" && (i === 1 || i === 6)) ? [204, 164, 70] : [34, 34, 46]); }   // the kanzu's embroidered neck; the elder's joho, dark with gold   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "indian_ocean" && fem) for (const f of ["front", "back"]) for (let i = 0; i < 8; i++) for (let j = 8; j < 20; j++) robe(f, i, j, i === 0 || i === 7 || j === 8 || j === 19 ? [30, 30, 36] : Math.hypot(i - 3.5, j - 13.5) < 2.2 ? [222, 178, 66] : L.second);   // the kanga: its border, its middle   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "birchbark") { for (const f of ["front", "back"]) for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) { const v = Math.abs(j - 1.5 - Math.sin(i) * 0.8) < 0.6; body(f, i, j, v ? [[178, 50, 44], [214, 172, 52], [52, 82, 150], [236, 234, 226]][(i + j) % 4] : [28, 32, 58]); }   // the broadcloth's yoke, beaded with the vine   // vision: the painter's drawing (rows, columns and shades of the skin)
    for (const f of ["front", "left", "right", "back"]) for (let i = 0; i < W_("leg", f); i++) for (const j of [10, 11]) set("leg", f, i, j, j === 10 ? [24, 22, 26] : [150, 110, 70]); }   // moccasins, their cuffs dark   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "shallow") for (const f of ["front", "back", "left", "right"]) for (let i = 0; i < W_("robe", f); i++) for (let j = 8; j < 20; j++) robe(f, i, j, [[52, 140, 160], [220, 170, 60], [196, 70, 60], [240, 236, 220]][(Math.floor(i / 2) + Math.floor(j / 2)) % 4]);   // the patadyong's bright checks   // vision: the painter's drawing (rows, columns and shades of the skin)
  if (t === "pacific") for (const f of ["front", "left", "right", "back"]) for (let i = 0; i < W_("arm", f); i++) for (let j = 1; j < 6; j++) if ((i + j) % 3 === 0 || j === 3) set("arm", f, i, j, sh(L.tone, 0.6));   // the tattoo bands, our spiral's steps   // vision: the painter's drawing (rows, columns and shades of the skin)
}
/** The volume: tops lit, sides and backs in shade, the edges of each face darker, folds down the robes. */
function shadeSkin(px) {
  for (const box of ["head", "body", "robe", "leg", "arm", "hands", "hat"]) for (const face of ["top", "bottom", "right", "front", "left", "back"]) {
    const w = W_(box, face), h = H_(box, face), k0 = { top: 1.08, bottom: 0.78, front: 1, back: 0.9, left: 0.94, right: 0.94 }[face];   // vision: the light from above and in front
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const [x, y] = at(box, face, i, j), o = (y * 64 + x) * 4; if (!px[o + 3]) continue;   // vision: the painter's drawing (rows, columns and shades of the skin)
      let k = k0; if (face !== "top" && face !== "bottom" && (i === 0 || i === w - 1)) k *= 0.92;   // the edges turning away   // vision: the painter's drawing (rows, columns and shades of the skin)
      if (box === "robe" && face !== "top" && face !== "bottom") { k *= 1.04 - (0.1 * j) / h; if (word(i + j * 0) === 1 && i % 2 === 1) k *= 0.93; }   // the robe darker toward the hem, its folds   // vision: the painter's drawing (rows, columns and shades of the skin)
      if ((box === "body" || box === "arm") && face !== "top" && face !== "bottom" && j === 0) k *= 1.05;   // the shoulders catching the light   // vision: the painter's drawing (rows, columns and shades of the skin)
      for (let c = 0; c < 3; c++) px[o + c] = Math.max(0, Math.min(255, Math.round(px[o + c] * k))); } }   // vision: the painter's drawing (rows, columns and shades of the skin)
}
