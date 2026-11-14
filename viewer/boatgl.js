// The boats in 3D, in the game's own textures: each boat's model as ship/tools/boatexport.py --uv gives it (every
// cube's eight corners as the game turns them, each face's place on its sheet; every cut cloth as a quad on the sail
// sheet), drawn with the hull's wood or marble and the sail's cloth (tex/<sheet>.png), cloth cut by the sheet's
// alpha as entity_alphatest cuts it, both sides lit. A sea at the waterline (blocks: 0.4 over the boat's origin).
// WebGL2, no library. Drag to turn, wheel or pinch to zoom, right-drag or shift-drag to pan.
(function (root) {
  const VS = `#version 300 es
  layout(location=0) in vec3 p; layout(location=1) in vec2 t; layout(location=2) in vec3 n;
  uniform mat4 M; out vec2 uv; out float lit;
  void main() { gl_Position = M * vec4(p, 1.0); uv = t; vec3 L = normalize(vec3(-0.4, 0.8, -0.45)); lit = 0.5 + 0.5 * abs(dot(normalize(n), L)); }`;
  const FS = `#version 300 es
  precision mediump float; in vec2 uv; in float lit; uniform sampler2D tex; uniform vec4 tint; uniform float clear; out vec4 o;
  // pass 0 the solid (cut by alpha at a half, as entity_alphatest); pass 1 the see-through cloth (the Exokoitos's skin,
  // entity_alphablend in the game): only what is partly clear, blended over the rest
  void main() { vec4 c = texture(tex, uv); if (tint.a > 0.0) { o = vec4(tint.rgb * lit, tint.a); return; }
    if (clear < 0.5) { if (c.a < 0.5) discard; o = vec4(c.rgb * lit, 1.0); }
    else { if (c.a >= 0.5 || c.a < 0.05) discard; o = vec4(c.rgb * lit, c.a); } }`;
  const SIZE = 128;                                   // given: the sheets' size (the models' texture_width)

  function make(canvas) {
    const gl = canvas.getContext("webgl2", { antialias: true, premultipliedAlpha: false });
    if (!gl) return null;
    const sh = (ty, s) => { const o = gl.createShader(ty); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    const U = (k) => gl.getUniformLocation(prog, k);
    const texCache = new Map();
    const texOf = (img) => { if (texCache.has(img)) return texCache.get(img); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); texCache.set(img, t); return t; };
    const mesh = (P, T, N) => { const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      [[P, 3], [T, 2], [N, 3]].forEach(([d, k], loc) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3 - (k === 2 ? 1 : 0), gl.FLOAT, false, 0, 0); });
      return { vao, n: P.length / 3 }; };
    let parts = null, sea = null, cam = { yaw: 0.75, pitch: 0.32, dist: 20, tx: 0, ty: 1, tz: 0 }, showSea = true, info = {};

    /** Builds a boat: B one entry of boats3d.json, FACES its face names, sheets { h: Image, s: Image }. */
    function load(B, sheets) {
      const by = { h: [[], [], []], s: [[], [], []] }, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      const quad = (sheet, q, [u, v, w, h]) => {          // q: four corners TL TR BR BL; the rect on the sheet in pixels
        const [a, b, c, d] = q, e1 = b.map((x, i) => x - a[i]), e2 = d.map((x, i) => x - a[i]);
        const nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const uvs = [[u, v], [u + w, v], [u + w, v + h], [u, v + h]].map(([x, y]) => [x / SIZE, y / SIZE]);
        const [P, T, N] = by[sheet];
        for (const k of [0, 1, 2, 0, 2, 3]) { P.push(...q[k]); T.push(...uvs[k]); N.push(...nn); q[k].forEach((x, i) => { lo[i] = Math.min(lo[i], x); hi[i] = Math.max(hi[i], x); }); }
      };
      const FACE = [[5, 1, 0, 4], [3, 7, 6, 2], [7, 5, 4, 6], [1, 3, 2, 0], [1, 5, 7, 3], [2, 6, 4, 0]];   // as boatexport.py FACES
      let pieces = 0;
      for (const box of B.boxes) {
        if (box[0] === "cloth") { const c = box.slice(4, 16), r = box[16]; if (!r) continue; quad("s", [0, 1, 2, 3].map((k) => c.slice(k * 3, k * 3 + 3)), r); pieces++; continue; }
        const C = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => box.slice(k * 3, k * 3 + 3)), sheet = box[25], faces = box[26] ?? [];
        for (const [fi, u, v, w, h] of faces) quad(sheet, FACE[fi].map((k) => C[k]), [u, v, w, h]);
        pieces++;
      }
      parts = ["h", "s"].map((k) => ({ tex: texOf(sheets[k]), ...mesh(...by[k]) }));
      const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
      cam = { ...cam, tx: mid[0], ty: mid[1] * 0.7, tz: mid[2], dist: span * 1.5 };
      const S = span * 1.6, W = 0.4;                          // given: the waterline, blocks over her origin (handling.js WATERLINE)
      sea = mesh([-S, W, -S, S, W, -S, S, W, S, -S, W, -S, S, W, S, -S, W, S].map((v, i) => v + (i % 3 === 0 ? mid[0] : i % 3 === 2 ? mid[2] : 0)), Array(12).fill(0), Array(6).fill([0, 1, 0]).flat());
      info = { pieces, long: +(hi[2] - lo[2]).toFixed(1), tall: +(hi[1] - lo[1]).toFixed(1), wide: +(hi[0] - lo[0]).toFixed(1) };
      draw(); return info;
    }
    function mat() {
      const w = canvas.width, h = canvas.height, f = 1 / Math.tan(0.4), near = 0.05, far = cam.dist * 20;
      const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const ex = cam.tx + cam.dist * cp * sy, ey = cam.ty + cam.dist * sp, ez = cam.tz + cam.dist * cp * cy;
      let zx = ex - cam.tx, zy = ey - cam.ty, zz = ez - cam.tz; const zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl;
      let xx = zz, xz = -zx; const xl = Math.hypot(xx, xz); xx /= xl; xz /= xl;
      const yx = zy * xz, yy = zz * xx - zx * xz, yz = -zy * xx;
      const V = [xx, yx, zx, 0, 0, yy, zy, 0, xz, yz, zz, 0, -(xx * ex + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1];
      const Pm = [f / (w / h), 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
      const out = new Float32Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += Pm[k * 4 + j] * V[i * 4 + k]; out[i * 4 + j] = s; }
      return out;
    }
    let queued = false;
    function draw() {
      if (queued || !parts) return; queued = true;
      requestAnimationFrame(() => { queued = false;
        gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0.13, 0.2, 0.31, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(prog); gl.uniformMatrix4fv(U("M"), false, mat()); gl.uniform1i(U("tex"), 0); gl.activeTexture(gl.TEXTURE0);
        gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.depthMask(true);
        gl.uniform1f(U("clear"), 0);
        for (const p of parts) { if (!p.n) continue; gl.bindTexture(gl.TEXTURE_2D, p.tex); gl.uniform4f(U("tint"), 0, 0, 0, 0); gl.bindVertexArray(p.vao); gl.drawArrays(gl.TRIANGLES, 0, p.n); }
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.uniform1f(U("clear"), 1);
        for (const p of parts) { if (!p.n) continue; gl.bindTexture(gl.TEXTURE_2D, p.tex); gl.uniform4f(U("tint"), 0, 0, 0, 0); gl.bindVertexArray(p.vao); gl.drawArrays(gl.TRIANGLES, 0, p.n); }
        gl.depthMask(true); gl.disable(gl.BLEND); gl.uniform1f(U("clear"), 0);
        if (showSea && sea) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.uniform4f(U("tint"), 0.16, 0.36, 0.62, 0.55); gl.bindVertexArray(sea.vao); gl.drawArrays(gl.TRIANGLES, 0, sea.n); gl.depthMask(true); }
      });
    }
    let drag = null; const pts = new Map(); let pinch = null;
    canvas.onpointerdown = (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture(e.pointerId);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), dist: cam.dist }; drag = null; return; }
      drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey, c: { ...cam } }; };
    canvas.oncontextmenu = (e) => e.preventDefault();
    canvas.onpointermove = (e) => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; cam.dist = Math.max(1, pinch.dist * pinch.d / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]))); draw(); return; }
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (drag.pan) { const k = cam.dist / 500; cam.tx = drag.c.tx - (dx * Math.cos(cam.yaw)) * k; cam.tz = drag.c.tz + (dx * Math.sin(cam.yaw)) * k; cam.ty = drag.c.ty + dy * k; }
      else { cam.yaw = drag.c.yaw - dx * 0.008; cam.pitch = Math.max(-0.6, Math.min(1.5, drag.c.pitch + dy * 0.008)); }
      draw();
    };
    canvas.onpointerup = canvas.onpointercancel = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; drag = null; };
    canvas.onwheel = (e) => { e.preventDefault(); cam.dist = Math.max(1, cam.dist * (e.deltaY < 0 ? 0.88 : 1.13)); draw(); };
    return { load, draw, set sea(v) { showSea = v; draw(); }, get cam() { return cam; } };
  }
  root.BoatGL = { make };
})(this);
