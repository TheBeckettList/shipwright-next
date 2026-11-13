// The built world in 3D, block for block (tools/modtest/vox.mjs), in the pack's own textures (tools/viewerkit.mjs:
// an atlas of the tiles world/textures.js draws, each block's top, side and bottom). Every face that can be seen is
// one instance of a quad the GPU builds (16 bytes a face, so a few million faces fit a tablet); solid blocks first,
// then the see-through ones (water, glass, leaves, plants) blended over them, shaded by the way each face turns and
// fogged with distance. WebGL2, no library. Drag to turn, right-drag or shift-drag to pan, wheel or pinch to zoom.
(function (root) {
  const VS = `#version 300 es
  layout(location=0) in ivec4 a_p;     // x, y, z of the block, and which face (x- x+ y- y+ z- z+)
  layout(location=1) in float a_t;     // its tile in the atlas
  layout(location=2) in vec4 a_c;      // its colour (alpha: see-through), used where the tile is tinted or missing
  layout(location=3) in float a_k;     // 1: tint the tile by the colour, 2: no tile
  uniform mat4 M; uniform vec2 atlas;  // the atlas's columns and rows
  out vec2 uv; out vec4 col; out float fogd; flat out float kind; out float shade;
  const vec3 Q[24] = vec3[24](
    vec3(0,0,0), vec3(0,0,1), vec3(0,1,1), vec3(0,1,0),   vec3(1,0,1), vec3(1,0,0), vec3(1,1,0), vec3(1,1,1),
    vec3(0,0,0), vec3(1,0,0), vec3(1,0,1), vec3(0,0,1),   vec3(0,1,1), vec3(1,1,1), vec3(1,1,0), vec3(0,1,0),
    vec3(1,0,0), vec3(0,0,0), vec3(0,1,0), vec3(1,1,0),   vec3(0,0,1), vec3(1,0,1), vec3(1,1,1), vec3(0,1,1));
  const float SH[6] = float[6](0.72, 0.78, 0.5, 1.0, 0.86, 0.66);
  const int TRI[6] = int[6](0, 1, 2, 0, 2, 3);
  void main() {
    int f = a_p.w, k = TRI[gl_VertexID % 6];
    vec3 p = vec3(a_p.xyz) + Q[f * 4 + k];
    gl_Position = M * vec4(p, 1.0); fogd = gl_Position.w;
    vec2 c = vec2(k == 1 || k == 2 ? 1.0 : 0.0, k < 2 ? 1.0 : 0.0);           // the tile upright on the sides
    float t = a_t; vec2 cell = vec2(mod(t, atlas.x), floor(t / atlas.x));
    uv = (cell + 0.002 + c * 0.996) / atlas;
    float j = 0.94 + 0.06 * float((a_p.x * 73856093 ^ a_p.y * 19349663 ^ a_p.z * 83492791) & 7) / 7.0;
    shade = SH[f] * j; col = a_c; kind = a_k;
  }`;
  const FS = `#version 300 es
  precision mediump float;
  in vec2 uv; in vec4 col; in float fogd; flat in float kind; in float shade;
  uniform sampler2D tex; uniform float fog; out vec4 o;
  void main() {
    vec3 c = kind > 1.5 ? col.rgb : kind > 0.5 ? texture(tex, uv).rgb * col.rgb * 1.6 : texture(tex, uv).rgb;
    float k = clamp((fogd - fog * 0.35) / (fog * 0.9), 0.0, 1.0);
    o = vec4(mix(c * shade, vec3(0.06, 0.11, 0.19), k * 0.85), col.a);
  }`;

  function make(canvas, meta, buf, atlasImg) {
    const gl = canvas.getContext("webgl2", { antialias: true });
    if (!gl) return null;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasImg);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const R = new Uint16Array(buf), n = R.length / 5, TEX = meta.tex ?? [], TINT = meta.tint ?? [];
    const build = (clear) => {
      let faces = 0;
      for (let i = 0; i < n; i++) { const m = R[i * 5 + 4]; if (!!(m & 64) !== clear) continue; for (let f = 0; f < 6; f++) if (m & (1 << f)) faces++; }
      const P = new Int16Array(faces * 4), T = new Float32Array(faces), C = new Uint8Array(faces * 4), K = new Float32Array(faces);
      let q = 0;
      for (let i = 0; i < n; i++) {
        const m = R[i * 5 + 4]; if (!!(m & 64) !== clear) continue;
        const x = R[i * 5], y = R[i * 5 + 1] + meta.ymin, z = R[i * 5 + 2], b = R[i * 5 + 3], col = meta.palette[b], tt = TEX[b];
        for (let f = 0; f < 6; f++) {
          if (!(m & (1 << f))) continue;
          const tile = tt ? tt[f === 3 ? 0 : f === 2 ? 2 : 1] : -1;
          P.set([x, y, z, f], q * 4); T[q] = Math.max(0, tile); C.set([col[0], col[1], col[2], col[3] ?? 255], q * 4); K[q] = tile < 0 ? 2 : TINT[b] ? 1 : 0; q++;
        }
      }
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const attr = (loc, data, size, type, norm, int) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc);
        if (int) gl.vertexAttribIPointer(loc, size, type, 0, 0); else gl.vertexAttribPointer(loc, size, type, norm, 0, 0); gl.vertexAttribDivisor(loc, 1); };
      attr(0, P, 4, gl.SHORT, false, true); attr(1, T, 1, gl.FLOAT, false, false); attr(2, C, 4, gl.UNSIGNED_BYTE, true, false); attr(3, K, 1, gl.FLOAT, false, false);
      return { vao, faces };
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
    let queued = false;
    function draw() {
      if (queued) return; queued = true;
      requestAnimationFrame(() => { queued = false;
        gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0.06, 0.11, 0.19, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(prog); gl.uniformMatrix4fv(gl.getUniformLocation(prog, "M"), false, mat()); gl.uniform1f(gl.getUniformLocation(prog, "fog"), cam.dist * 2.2);
        gl.uniform2f(gl.getUniformLocation(prog, "atlas"), meta.atlas?.cols ?? 1, meta.atlas?.rows ?? 1);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(gl.getUniformLocation(prog, "tex"), 0);
        gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); gl.disable(gl.BLEND); gl.depthMask(true);
        gl.bindVertexArray(solid.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, solid.faces);
        gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        gl.bindVertexArray(clear.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, clear.faces); gl.depthMask(true);
      });
    }
    let drag = null; const pts = new Map(); let pinch = null;
    canvas.onpointerdown = (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture(e.pointerId);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), dist: cam.dist }; drag = null; return; }
      drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey, c: { ...cam } }; };
    canvas.oncontextmenu = (e) => e.preventDefault();
    canvas.onpointermove = (e) => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; cam.dist = Math.max(12, Math.min(3000, pinch.dist * pinch.d / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])))); draw(); return; }
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (drag.pan) { const k = cam.dist / 600; cam.tx = drag.c.tx - (dx * Math.cos(cam.yaw) - dy * Math.sin(cam.yaw)) * k; cam.tz = drag.c.tz + (dx * Math.sin(cam.yaw) + dy * Math.cos(cam.yaw)) * k; }
      else { cam.yaw = drag.c.yaw - dx * 0.006; cam.pitch = Math.max(0.08, Math.min(1.5, drag.c.pitch + dy * 0.006)); }
      draw();
    };
    canvas.onpointerup = canvas.onpointercancel = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; drag = null; };
    canvas.onwheel = (e) => { e.preventDefault(); cam.dist = Math.max(12, Math.min(3000, cam.dist * (e.deltaY < 0 ? 0.88 : 1.13))); draw(); };
    draw();
    return { draw, cam, faces: solid.faces + clear.faces };
  }
  root.World3D = { make };
})(this);
