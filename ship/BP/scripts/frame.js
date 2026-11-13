// Frames: every position in Shipwright is measured from a zero we chose, and moving from one frame
// to another is one function, here. (The physics project's rule: no position is absolute; the map
// from frame A to frame B is all there is, and moving the zero changes nothing as long as the
// offset is carried.)
//
//   World frame: Minecraft's x, y, z. Heading 0 faces +z (south), 90 faces -x (west).
//   Ship frame:  along (+ forward) and across (+ starboard), measured from the ship's origin,
//                which is its helm. The hull's centre lies `centreAhead` blocks forward of it.
//   Dock frame:  u toward the sea (u = -1 is the table's wall, u = 0 the first basin row), w to
//                starboard looking out to sea, dy up from the quay.
//
// Nothing else converts between frames; if a position looks wrong, the bug is in the frame used.

/** Unit vector of a heading, in the world. */
export const forwardOf = (heading) => ({ x: -Math.sin((heading * Math.PI) / 180), z: Math.cos((heading * Math.PI) / 180) });
/** Unit vector to starboard (the right hand, looking forward). */
export const starboardOf = (heading) => { const f = forwardOf(heading); return { x: -f.z, z: f.x }; };

/** A ship's frame: its origin (the helm), its heading, and where its centre lies. */
export class ShipFrame {
  constructor(origin, heading, h = null) {
    this.o = origin;
    this.heading = heading;
    this.f = forwardOf(heading);
    this.r = { x: -this.f.z, z: this.f.x };
    this.centreAhead = -(h?.helmAt ?? 0);       // helmAt is the helm measured from the centre (negative: aft)
  }
  /** World position of a point on the ship, measured from the helm. */
  toWorld(along, across = 0, up = 0) {
    return { x: this.o.x + this.f.x * along + this.r.x * across, y: (this.o.y ?? 0) + up, z: this.o.z + this.f.z * along + this.r.z * across };
  }
  /** A world point's place on the ship, measured from the helm. */
  toLocal(p) {
    const dx = p.x - this.o.x, dz = p.z - this.o.z;
    return { along: dx * this.f.x + dz * this.f.z, across: dx * this.r.x + dz * this.r.z };
  }
  /** World position of a point measured from the hull's centre. */
  fromCentre(along, across = 0, up = 0) { return this.toWorld(this.centreAhead + along, across, up); }
  /** The hull's centre in the world. */
  centre() { return this.fromCentre(0, 0); }
}

/** The frame of a ship entity at its current place and the heading the steering holds. */
export const shipFrame = (entity, heading, h) => new ShipFrame(entity.location, heading, h);

/** A dock's frame: its origin (the table's place in the landward wall) and the direction to the sea. */
export class DockFrame {
  constructor(origin, dir) {
    this.o = origin;
    this.d = dir;
  }
  at(u, w, dy = 0) {
    const { o, d } = this;
    return { x: o.x + d.x * (u + 1) - d.z * w, y: o.y + dy, z: o.z + d.z * (u + 1) + d.x * w };
  }
}
