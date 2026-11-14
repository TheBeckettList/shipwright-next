"""Sailcloth: every sail is one cut cloth, its shape cut out of the sail texture (alpha), so its edges are clean
however the model is scaled. Each rig type has its own cloth on the sheet, laid out like a sail on the floor of a
sail loft: its seams, its edge tape (the boltrope), its corner patches and reef bands painted on.

The sheet is also the canvas for the Sail Loft (a sailmaker's table, still to build): there a player lays a sail out
like a banner and stitches a device onto it, and the device is painted into the cloth's own region, so it follows the
sail's cut on every rig.

Shapes are in the cloth's own box: u from the luff (forward, 0) to the leech (aft, 1), v from the head (0) to the
foot (1). Geometry and painting both read them from here.
"""
import math

SHEET = 128
# Regions (x, y, w, h) on the 128 px sheet.
REGION = {"square": (0, 0, 60, 60), "lateen": (64, 0, 60, 60), "crab_claw": (0, 64, 60, 60), "junk": (64, 64, 56, 56)}
CLEAR = (124, 0, 4, 4)        # transparent: the cloth's edges and the faces seen edge-on
SPAR = (64, 124, 56, 4)       # wood for yards, spars and battens
SOLID = (24, 24, 8, 8)        # plain cloth, for the wing's rigid skin
SKIN = (120, 60, 8, 8)        # translucent cloth, for the Exokoitos's skin (her body and wings: drawn blended)
CORE = (120, 68, 8, 8)        # asterion's glow, for her core (drawn emissive)
TELLTALE = (120, 120, 8, 8)

CRAB_OPENING, CRAB_TILT, CRAB_SAG = 56, 74, 0.22


def crab_points():
    """The crab claw in its own frame: apex at the origin, the two spar tips, z aft and y up (spar length 1)."""
    half, lean = math.radians(CRAB_OPENING / 2), math.radians(90 - CRAB_TILT)
    aft = (math.sin(lean + half), math.cos(lean + half))
    fore = (math.sin(lean - half), math.cos(lean - half))
    return (0.0, 0.0), aft, fore


def crab_outline(n=24):
    apex, (az, ay), (fz, fy) = crab_points()
    pts = [apex, (az, ay)]
    for k in range(1, n):
        u = k / n                                    # from the aft tip to the fore tip along the crescent
        z = az + (fz - az) * u
        y = ay + (fy - ay) * u - CRAB_SAG * max(ay, fy) * 4 * u * (1 - u)
        pts.append((z, y))
    pts.append((fz, fy))
    return pts


def crab_box():
    pts = crab_outline()
    zs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(zs), max(zs), min(ys), max(ys)


def _in_poly(x, y, poly):
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def inside(kind, u, v):
    """Is (u, v) cloth?"""
    if kind == "square":
        foot = 0.93 + 0.07 * (1 - (2 * u - 1) ** 2)          # the foot cut with a little round
        return v <= foot and 0.015 <= u <= 0.985
    if kind == "lateen":
        return v >= 1 - u + 0.01 and v <= 1 - 0.06 * math.sin(math.pi * u) and u <= 0.985
    if kind == "junk":
        head = 0.1 * (1 - u)                                 # the head rising aft to its yard
        leech = 1 - 0.07 * math.sin(math.pi * v)             # the leech curved like a fan
        return v >= head and u <= leech and u >= 0.01 and v <= 0.99
    if kind == "crab_claw":
        z0, z1, y0, y1 = crab_box()
        return _in_poly(z0 + u * (z1 - z0), y1 - v * (y1 - y0), crab_outline())
    raise ValueError(kind)


def seams(kind):
    """Where the panel seams run: ('u', share) vertical seams, ('v', share) horizontal ones."""
    if kind == "square":
        return [("u", k / 7) for k in range(1, 7)] + [("v", 0.22)]          # cloths, and a reef band
    if kind == "lateen":
        return [("u", k / 8) for k in range(1, 8)]                          # cloths parallel to the leech
    if kind == "junk":
        return [("v", k / 6) for k in range(1, 6)]                          # under each batten
    if kind == "crab_claw":
        return [("u", k / 7) for k in range(1, 7)]
    return []


def paint(img, base, trim, rng, jitter):
    """Paint every cloth on the sheet: cloth in base colour, seams and boltrope in trim, corner patches."""
    px = img.load()
    for x in range(SHEET):
        for y in range(SHEET):
            px[x, y] = (0, 0, 0, 0)
    for kind, (rx, ry, rw, rh) in REGION.items():
        cut = [[inside(kind, (i + 0.5) / rw, (j + 0.5) / rh) for j in range(rh)] for i in range(rw)]
        lines = seams(kind)
        for i in range(rw):
            for j in range(rh):
                if not cut[i][j]:
                    continue
                u, v = (i + 0.5) / rw, (j + 0.5) / rh
                c = jitter(base, 5, rng)
                if (i + j) % 4 == 0:
                    c = tuple(int(q * 0.95) for q in c)
                for axis, s in lines:
                    if (axis == "u" and abs(u - s) * rw < 0.5) or (axis == "v" and abs(v - s) * rh < 0.5):
                        c = tuple(int(q * 0.86) for q in c)
                edge = any(not (0 <= i + di < rw and 0 <= j + dj < rh and cut[i + di][j + dj])
                           for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if edge:
                    c = trim                                     # the boltrope round the edge
                near = min((i, j), (rw - 1 - i, j), (i, rh - 1 - j), (rw - 1 - i, rh - 1 - j), key=lambda t: t[0] + t[1])
                if not edge and near[0] + near[1] < 0.16 * (rw + rh) / 2 and (i + j) % 2 == 0:
                    c = tuple(int(q * 0.9) for q in c)          # corner patches, doubled cloth
                px[rx + i, ry + j] = c + (255,)
    sx, sy, sw, sh = SOLID
    for i in range(sw):
        for j in range(sh):
            px[sx + i, sy + j] = jitter(base, 4, rng) + (255,)
    return img
