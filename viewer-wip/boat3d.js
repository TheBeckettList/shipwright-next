// The boats in 3D: a small depth-buffered software renderer for boats.json (ship/tools/boatexport.py).
// Each piece is a box (eight corners, x y z in blocks, then its part's name) or a cut cloth
// (["cloth", sail type, u0, u1, then four corners: head-luff, head-leech, foot-leech, foot-luff]),
// drawn through its sail's mask so the cloth shows its true cut, seams and edge tape.
// The same code runs in the page (into a canvas's ImageData) and in node (for checking renders).
(function (root) {
  const FACES = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
  const SKY = [15, 27, 48];
  const L = (() => { const v = [-0.4, 0.8, -0.45], n = Math.hypot(...v); return v.map((x) => x / n); })();

  // Build a boat once into triangles (in its own frame, centred), each with a colour or a cloth mask lookup.
  function build(data, id) {
    const B = data[id], tris = [], cut = data._cloth;
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    const grow = (p) => p.forEach((v, n) => { lo[n] = Math.min(lo[n], v); hi[n] = Math.max(hi[n], v); });
    for (const b of B.boxes) {
      if (b[0] === "cloth") {
        const [, kind, u0, u1] = b, q = [0, 1, 2, 3].map((i) => b.slice(4 + 3 * i, 7 + 3 * i));
        q.forEach(grow);
        const uv = [[u0, 0], [u1, 0], [u1, 1], [u0, 1]];
        const col = B.parts.rig;
        for (const t of [[0, 1, 2], [0, 2, 3]]) tris.push({ p: t.map((i) => q[i]), uv: t.map((i) => uv[i]), mask: cut.cut[kind], n: cut.n, col, cloth: true });
        continue;
      }
      const C = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => b.slice(3 * i, 3 * i + 3));
      C.forEach(grow);
      const col = B.parts[b[24]] || [150, 105, 60];
      for (const f of FACES) { tris.push({ p: [C[f[0]], C[f[1]], C[f[2]]], col }); tris.push({ p: [C[f[0]], C[f[2]], C[f[3]]], col }); }
    }
    const mid = lo.map((v, n) => (v + hi[n]) / 2);
    for (const t of tris) t.p = t.p.map((q) => q.map((v, n) => v - mid[n]));
    for (const t of tris) {                       // flat shade by the face's normal (both sides lit: cloth is two-sided)
      const [a, b, c] = t.p, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], nl = Math.hypot(...n) || 1;
      t.lit = 0.55 + 0.45 * Math.abs((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl);
    }
    return { tris, span: Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]), floor: lo[1] - mid[1], length: hi[2] - lo[2], name: B.name, rig: B.rig, scale: B.scale, pieces: B.boxes.length };
  }

  // Draw a built boat into px (RGBA, W by H) from yaw, pitch and zoom.
  function draw(M, cam, px, W, H) {
    const zb = new Float32Array(W * H).fill(1e9);
    for (let i = 0; i < W * H; i++) { const y = i / W / H; px[4 * i] = SKY[0] + 10 * y; px[4 * i + 1] = SKY[1] + 14 * y; px[4 * i + 2] = SKY[2] + 22 * y; px[4 * i + 3] = 255; }
    const S = (0.82 * Math.min(W, H * 1.7)) / M.span * cam.zoom, cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const P = ([x, y, z]) => { const u = x * cy - z * sy, w = x * sy + z * cy; return [W / 2 + u * S, H / 2 + (-y * cp + w * sp) * S, -(w * cp + y * sp)]; };
    // the water: a grid at the waterline
    const g = 1, ext = Math.ceil(M.span * 0.75);
    for (let k = -ext; k <= ext; k += g) for (const [a, b] of [[[k, M.floor, -ext], [k, M.floor, ext]], [[-ext, M.floor, k], [ext, M.floor, k]]]) line(P(a), P(b), px, zb, W, H);
    for (const t of M.tris) {
      const [A, B, C] = t.p.map(P);
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
      const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
      if (Math.abs(den) < 1e-9 || x1 < x0 || y1 < y0) continue;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const gx = x + 0.5, gy = y + 0.5;
        const a = ((B[1] - C[1]) * (gx - C[0]) + (C[0] - B[0]) * (gy - C[1])) / den;
        const b = ((C[1] - A[1]) * (gx - C[0]) + (A[0] - C[0]) * (gy - C[1])) / den;
        const c = 1 - a - b;
        if (a < -1e-4 || b < -1e-4 || c < -1e-4) continue;
        const z = a * A[2] + b * B[2] + c * C[2], i = y * W + x;
        if (z >= zb[i]) continue;
        let k = t.lit;
        if (t.cloth) {
          const u = a * t.uv[0][0] + b * t.uv[1][0] + c * t.uv[2][0], v = a * t.uv[0][1] + b * t.uv[1][1] + c * t.uv[2][1];
          const m = t.mask[Math.min(t.n - 1, Math.max(0, Math.floor(v * t.n))) * t.n + Math.min(t.n - 1, Math.max(0, Math.floor(u * t.n)))];
          if (m === "0") continue;                 // cut away: not cloth
          if (m === "2") k *= 0.78;                // seam or edge tape
        }
        zb[i] = z;
        px[4 * i] = t.col[0] * k; px[4 * i + 1] = t.col[1] * k; px[4 * i + 2] = t.col[2] * k;
      }
    }
  }

  function line(a, b, px, zb, W, H) {
    const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])));
    for (let s = 0; s <= n; s++) {
      const t = s / (n || 1), x = Math.round(a[0] + (b[0] - a[0]) * t), y = Math.round(a[1] + (b[1] - a[1]) * t);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x, z = a[2] + (b[2] - a[2]) * t;
      if (z >= zb[i]) continue;
      px[4 * i] = 40; px[4 * i + 1] = 70; px[4 * i + 2] = 110; zb[i] = z + 1e-3;
    }
  }

  const api = { build, draw };
  if (typeof module !== "undefined") module.exports = api; else root.Boat3D = api;
})(this);
