# Crop a PNG (8-bit RGB, as tools/png.js writes): python3 tools/pngcrop.py in.png out.png x0 y0 x1 y1
import sys, zlib, struct
def readpng(p):
    d = open(p, 'rb').read(); i = 8; idat = b''
    while i < len(d):
        l = struct.unpack('>I', d[i:i+4])[0]; t = d[i+4:i+8]; c = d[i+8:i+8+l]
        if t == b'IHDR': w, h = struct.unpack('>II', c[:8])
        if t == b'IDAT': idat += c
        i += 12 + l
    raw = zlib.decompress(idat); bpp = 3; stride = w * bpp; rows = []; prev = bytearray(stride); k = 0
    for y in range(h):
        f = raw[k]; k += 1; line = bytearray(raw[k:k+stride]); k += stride
        for x in range(stride):
            a = line[x-bpp] if x >= bpp else 0; b = prev[x]; c = prev[x-bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                pp = a + b - c; pa, pb, pc = abs(pp-a), abs(pp-b), abs(pp-c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else (b if pb <= pc else c))) & 255
        rows.append(line); prev = line
    return w, h, rows
def writepng(p, w, h, rows):
    raw = b''.join(b'\x00' + bytes(r) for r in rows)
    ch = lambda t, c: struct.pack('>I', len(c)) + t + c + struct.pack('>I', zlib.crc32(t + c) & 0xffffffff)
    open(p, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 6)) + ch(b'IEND', b''))
w, h, rows = readpng(sys.argv[1]); x0, y0, x1, y1 = map(int, sys.argv[3:7])
writepng(sys.argv[2], x1 - x0, y1 - y0, [r[x0*3:x1*3] for r in rows[y0:y1]])
