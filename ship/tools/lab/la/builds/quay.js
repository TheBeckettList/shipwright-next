// Example build: a mooring quay in any culture's own materials. One side is drawn, the other is the
// same piece mirrored (frames.js), so port and starboard can't drift apart; posts stand every
// `style.every` blocks (the yard's own spacing), lights on the end posts and every other one, as
// yardbuild.js lights a dock.
//
//   node tools/lab/lasim.mjs build quay --culture japanese --png out.png
//   node tools/lab/lasim.mjs build quay --all
//
// A build script exports `make(ctx)` returning a Build (or a list), and `params` (its defaults).
// ctx: { Build, culture (the sim's view of the culture), args (parsed --key value pairs) }.
export const params = { length: 13, width: 2 };   // vision: a Fibonacci length, a walkway two wide

export function make({ Build, culture, args }) {
  const s = culture.style, L = Number(args.length ?? params.length), W = Number(args.width ?? params.width);
  // one side: the walkway (deck on the outside, wall slab inside), its posts and their lights
  const side = new Build("quay side", { culture: culture.key });
  for (let x = 0; x < L; x++) {
    side.put(x, 0, 1, s.wall);
    for (let z = 2; z <= W; z++) side.put(x, 0, z, s.deck);
  }
  const posts = [];
  side.every(s.every, 0, L - 1, (x) => posts.push(x));
  if (posts.at(-1) !== L - 1) posts.push(L - 1);
  posts.forEach((x, i) => {
    side.put(x, -1, W + 1, s.post, /_log$|bamboo_block|bone_block/.test(s.post) ? { pillar_axis: "y" } : {});
    side.put(x, 0, W + 1, s.post, /_log$|bamboo_block|bone_block/.test(s.post) ? { pillar_axis: "y" } : {});
    if (s.accent) side.put(x, 1, W + 1, s.accent);
    const lit = i === 0 || i === posts.length - 1 || i % 2 === 0;
    if (s.light && lit) side.put(x, s.accent ? 2 : 1, W + 1, s.light, /torch/.test(s.light) ? { torch_facing_direction: "top" } : {});
  });
  // the basin between the sides: water one block down, the bed under it
  const quay = new Build(`${culture.key} quay`, { culture: culture.key, notes: `${L} long, both sides from one` });
  quay.place(side, { z: 0 });
  quay.place(side, { z: 0, turns: 2, mirror: true, x: L - 1 });   // the far side: the same piece, mirrored
  for (let x = 0; x < L; x++) {
    quay.put(x, -1, 0, "minecraft:water");
    quay.put(x, -2, 0, s.base ?? "minecraft:gravel");
    for (let z = 1; z <= W + 1; z++) { quay.put(x, -2, z, s.base ?? "minecraft:gravel"); quay.put(x, -2, -z, s.base ?? "minecraft:gravel"); }
  }
  return quay;
}
