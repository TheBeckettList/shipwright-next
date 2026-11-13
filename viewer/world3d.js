// The built world in 3D, block for block (tools/modtest/vox.mjs): every block that can be seen, each face drawn
// in its block's colour, shaded by the way it faces, in WebGL2 with no library. Drag to turn, right-drag or
// shift-drag to pan, wheel to zoom.
(function (root) {
  const VS = `#version 300 es
  in vec3 p; in vec4 c; uniform mat4 M; out vec4 v; out float f;
  void main(){ gl_Position = M * vec4(p, 1.0); v = c; f = gl_Position.w; }`;
  const FS = `#version 300 es
  precision mediump float; in vec4 v; in float f; uniform float fog; out vec4 o;
  void main(){ float k = clamp((f - fog * 0.35) / (fog * 0.9), 0.0, 1.0); o = vec4(mix(v.rgb, vec3(0.06, 0.11, 0.19), k * 0.85), v.a); }`;
  const SHADE = [0.72, 0.78, 0.5, 1.0, 0.86, 0.66];
  const QUAD = [ // corner offsets of each face, in order, for faces x-, x+, y-, y+, z-, z+
    [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
    [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
    [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]];

  function make(canvas, meta, buf) {
    const gl = canvas.getContext("webgl2", { antialias: true });
    if (!gl) return null;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    const R = new Uint16Array(buf), n = R.length / 5;
    // two passes: solid blocks, then see-through ones (water, glass, leaves) blended over them
    const build = (clear) => {
      let faces = 0;
      for (let i = 0; i < n; i++) { const m = R[i * 5 + 4]; if (!!(m & 64) !== clear) continue; for (let f = 0; f < 6; f++) if (m & (1 << f)) faces++; }
      const P = new Float32Array(faces * 12), C = new Uint8Array(faces * 16), I = new Uint32Array(faces * 6);
      let q = 0;
      for (let i = 0; i < n; i++) {
        const m = R[i * 5 + 4]; if (!!(m & 64) !== clear) continue;
        const x = R[i * 5], y = R[i * 5 + 1] + meta.ymin, z = R[i * 5 + 2], col = meta.palette[R[i * 5 + 3]];
        for (let f = 0; f < 6; f++) {
          if (!(m & (1 << f))) continue;
          const sd = SHADE[f], jit = 0.94 + 0.06 * (((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) & 7) / 7;
          QUAD[f].forEach(([a, b, c], k) => { P.set([x + a, y + b, z + c], q * 12 + k * 3); C.set([col[0] * sd * jit, col[1] * sd * jit, col[2] * sd * jit, col[3] ?? 255], q * 16 + k * 4); });
          I.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6); q++;
        }
      }
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, P, gl.STATIC_DRAW);
      const pl = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl, 3, gl.FLOAT, false, 0, 0);
      const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, C, gl.STATIC_DRAW);
      const cl = gl.getAttribLocation(prog, "c"); gl.enableVertexAttribArray(cl); gl.vertexAttribPointer(cl, 4, gl.UNSIGNED_BYTE, true, 0, 0);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I, gl.STATIC_DRAW);
      return { vao, count: faces * 6 };
    };
    const solid = build(false), clear = build(true);
    const cam = { yaw: 0.7, pitch: 0.75, dist: Math.max(meta.nx, meta.nz) * 0.8, tx: meta.nx / 2, ty: 70, tz: meta.nz / 2 };
    function mat() {
      const w = canvas.width, h = canvas.height, f = 1 / Math.tan(0.45), near = 1, far = cam.dist * 6;
      const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const ex = cam.tx + cam.dist * cp * sy, ey = cam.ty + cam.dist * sp, ez = cam.tz + cam.dist * cp * cy;
      let zx = ex - cam.tx, zy = ey - cam.ty, zz = ez - cam.tz; const zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl;
      let xx = zz, xz = -zx; const xl = Math.hypot(xx, xz); xx /= xl; xz /= xl;
      const yx = zy * xz - 0, yy = zz * xx - zx * xz, yz = 0 - zy * xx;
      const V = [xx, yx, zx, 0, 0, yy, zy, 0, xz, yz, zz, 0, -(xx * ex + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1];
      const Pm = [f / (w / h), 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
      const out = new Float32Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += Pm[k * 4 + j] * V[i * 4 + k]; out[i * 4 + j] = s; }
      return out;
    }
    function draw() {
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0.06, 0.11, 0.19, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog); gl.uniformMatrix4fv(gl.getUniformLocation(prog, "M"), false, mat()); gl.uniform1f(gl.getUniformLocation(prog, "fog"), cam.dist * 2.2);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);
      gl.bindVertexArray(solid.vao); gl.drawElements(gl.TRIANGLES, solid.count, gl.UNSIGNED_INT, 0);
      gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.bindVertexArray(clear.vao); gl.drawElements(gl.TRIANGLES, clear.count, gl.UNSIGNED_INT, 0); gl.depthMask(true);
    }
    let drag = null;
    canvas.onpointerdown = (e) => { drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey, c: { ...cam } }; canvas.setPointerCapture(e.pointerId); };
    canvas.oncontextmenu = (e) => e.preventDefault();
    canvas.onpointermove = (e) => {
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (drag.pan) { const k = cam.dist / 600; cam.tx = drag.c.tx - (dx * Math.cos(cam.yaw) - dy * Math.sin(cam.yaw)) * k; cam.tz = drag.c.tz + (dx * Math.sin(cam.yaw) + dy * Math.cos(cam.yaw)) * k; }
      else { cam.yaw = drag.c.yaw - dx * 0.006; cam.pitch = Math.max(0.08, Math.min(1.5, drag.c.pitch + dy * 0.006)); }
      draw();
    };
    canvas.onpointerup = () => { drag = null; };
    canvas.onwheel = (e) => { e.preventDefault(); cam.dist = Math.max(12, Math.min(3000, cam.dist * (e.deltaY < 0 ? 0.88 : 1.13))); draw(); };
    draw();
    return { draw, cam };
  }
  root.World3D = { make };
})(this);
