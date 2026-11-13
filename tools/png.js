// A small PNG codec (8-bit grayscale or RGB, no interlace) on Node's zlib, so the world map can be
// read and painted in any image editor with no packages.
import zlib from "node:zlib";

const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();   // given: the PNG CRC
const crc = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);   // given: the PNG signature

/** Write a PNG: channels 1 (grayscale) or 3 (RGB); data is a Uint8Array of w*h*channels. */
export function encode(w, h, data, channels = 1) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = { 1: 0, 2: 4, 3: 2, 4: 6 }[channels];   // given: bit depth, colour type (grey, grey and alpha, RGB, RGBA)
  const row = w * channels, raw = Buffer.alloc((row + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (row + 1)] = 0; Buffer.from(data.buffer, data.byteOffset + y * row, row).copy(raw, y * (row + 1) + 1); }
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);   // given: best compression
}

/** Read a PNG (8-bit grayscale, grayscale+alpha, RGB or RGBA): { w, h, channels, data }. */
export function decode(buf) {
  let p = 8, w, h, type, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), t = buf.toString("ascii", p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (t === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 8 || d[12]) throw new Error("8-bit, non-interlaced PNGs only"); type = d[9]; }   // given
    if (t === "IDAT") idat.push(d);
    p += 12 + len;   // given: length, type, crc
  }
  const ch = { 0: 1, 4: 2, 2: 3, 6: 4 }[type];   // given: PNG colour types
  const raw = zlib.inflateSync(Buffer.concat(idat)), row = w * ch, out = new Uint8Array(row * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (row + 1)], src = raw.subarray(y * (row + 1) + 1, (y + 1) * (row + 1));
    for (let i = 0; i < row; i++) {
      const a = i >= ch ? out[y * row + i - ch] : 0, b = y ? out[(y - 1) * row + i] : 0, c = i >= ch && y ? out[(y - 1) * row + i - ch] : 0;
      let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * row + i] = v & 255;   // given: a byte
    }
  }
  return { w, h, channels: ch, data: out };
}
