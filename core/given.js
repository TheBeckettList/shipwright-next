// inherency: home
// Pure. Every number the world is made of, in one of three kinds, and no fourth:
//
//   GIVEN    what Minecraft or the Earth fixes. Not ours to change.
//   VISION   what we choose. Ratios, or multiples of a given, each with its reason.
//   derived  a law: a pure function of givens and vision (below, and in the other core files).
//
// Any other number in core/ is a free number, and the inherency lens (tools/lab.mjs inherency)
// fails on it. A literal elsewhere must sit on a line tagged `// given:` or `// vision:`.
//
// Three scales, each phenomenon says which it lives on (the analogue tests hold them together):
//   block   1 block = 1 metre, 1 tick = 1/20 s, under Minecraft's gravity: hulls, waves, wind
//   chunk   16 blocks: the unit the map is drawn in (one pixel a chunk) and the game loads in
//   world   the globe: 32,768 blocks round the equator, wrapped east-west, folded at the poles

export const GIVEN = Object.freeze({
  BLOCK_M: 1,               // metres a block
  TICKS_PER_S: 20,          // ticks a second
  CHUNK: 16,                // blocks a chunk side
  DAY: 24000,               // ticks a Minecraft day
  G: 0.08,                  // gravity, blocks per tick per tick (entities)
  SEA: 62,                  // the sea's level in a vanilla overworld
  YMIN: -64, YMAX: 319,     // the overworld's build limits
  EARTH_CIRC_M: 40075017,   // the Earth's equator, metres
  EARTH_G: 9.81,            // the Earth's gravity, m/s^2
  EARTH_DAY_S: 86400,       // the Earth's day, seconds
  OMEGA_E: 7.2921e-5,       // the Earth's rotation, rad/s (Coriolis)
  RHO_AIR: 1.225, RHO_WATER: 1025,   // kg/m^3 (sail and hull forces scale by their ratio)
});

export const VISION = Object.freeze({
  // ---- representation: exact integers everywhere the state lives
  Q: 65536,                 // fixed-point units a block (2^16): positions and speeds are integers in these
  TURN: 65536,              // angle units a full turn (2^16): headings wrap exactly
  SINE_STEPS: 4096,         // the sine table's steps a turn: angles look up, never call Math.sin in a step

  // ---- the world
  CIRC: 262144,             // blocks round the equator: eight times the first world (2^18, so the wrap and the fold stay exact), so that settlements cover under 1/21 of the land
  ICE_LAT: 76,              // degrees: beyond this the sea is pack ice (the poles stay reachable, slowly)
  LAND: [0.08, 0.16],       // share of the globe that is land: islands and seas
  MAP_PX: 128,              // blocks a map pixel: a region of 8 x 8 chunks (the map's 2,048 x 1,024 pixels read eight times wider)
  HOP: 20,                  // map cells of open water the sim's peoples count as one hop (their raids' and trade's reach)
  CROSSING: 320,            // blocks of open water a small boat dares (a minute and a half at its pace): the stepping stones keep to it
  CAY_HEIGHT: 2,            // blocks: a stepping-stone cay is a low sandy islet

  // ---- near and far (chunks from the nearest player, lod.js)
  LOD: { NEAR: 4, FAR: 24 },  // rendered out to 4 (the game's own load radius on a Switch is about 6); chunk math out to 24

  // ---- climate (heat 0 polar .. 1 equatorial; moisture 0 .. 1)
  HEAT_POW: 1.3,            // how heat falls with latitude (1: linearly; more: a broad warm middle)
  LAPSE: 1 / 300,           // heat lost a block of height (a 150-block peak is half a zone colder)
  TEMP: [-30, 32],          // degrees C at heat 0 and 1
  WET: { doldrums: 0.9, trades: 0.55, "horse latitudes": 0.2, westerlies: 0.75, "polar easterlies": 0.3 },   // the belts' rain
  SHADOW: 40,               // blocks of upwind height that dry the lee by half
  UPWIND: 6,                // chunks upwind a slope is felt
  COASTAL: 0.15,            // how much wetter the coast is than the island's heart
  // ---- peoples
  SETTLE: 4,                // chunks: the smallest island a people lives on
  REGION: 48,               // chunks: a big island holds a people every this many chunks across
  RAID: 3,                  // hops: how far raiders look for richer neighbours (in HOP lengths)
  TRADITION_SHARE: [0.05, 0.18],   // every tradition holds at least this share of the peoples and at most this (a diverse sea)
  FEATURED: { japanese: 1.4, pacific: 1.3, shallow: 1.3, birchbark: 1.3, dugout: 1.2, indian_ocean: 1.2 },   // the traditions to see more of: their floors are raised by this

  // ---- wind (m/s at sea level; belts by latitude, as the real ones lie)
  BELTS: [                  // [up to latitude, name, speed m/s, from bearing degrees (north hemisphere)]
    [5, "doldrums", 1.5, 90],
    [28, "trades", 7, 60],
    [35, "horse latitudes", 2, 0],
    [60, "westerlies", 10, 250],
    [90, "polar easterlies", 6, 70],
  ],
  BELT_BLEND: 3,            // degrees over which one belt hands over to the next
  GUST: 0.15,               // a gust's share of the wind, either way (the trit line: -1, 0, +1)
  GUST_LINE: 64,            // cells in the gust line (its breath is 2 x 64 ticks, golden on a Mobius loop)
  GUST_CELL: 256,           // blocks a gust cell spans

  // ---- sea
  TIDE_RANGE: 0.6,          // blocks of tide either way in open water
  SHELF_DEPTH: 20,          // blocks: shallower than this is shelf (the tide rises, the sea shoals)
  WAVE_SPREAD: 0.25,        // share of a turn the wave trains spread over (a quarter: +-45 degrees)
  WAVE_BAND: 0.4,           // spread of wavelengths round the peak, either way
  WAVES_SEEN: 1000,         // waves a month's worst sea throws at a shore, for its tallest (Rayleigh)
  RUNUP_MAX: 2.5,           // Iribarren's run-up stops growing past this (the wave surges instead of breaking)
  GODA: 1.2,                // a breaking wave's pressure on a wall, in rho g H (Goda's simple form)
  RESIST_KPA: 20,           // kPa of wave load a point of Minecraft's blast resistance stands (planks 60 kPa, stone 120: timber piers and masonry quays)
  DAMAGE_RATE: 0.15,        // share of a structure a month's sea wrecks for each strength it's over by
  SHELTER: 0.4,             // a harbour's exposure to the open sea (a people's landing lies in a lee)
  PILES: 0.5,               // what standing on piles takes off that exposure
  STORM: 1.6,               // a month's worst wind over the belt's steady wind (its gusts at their strongest, and a blow)
  TIDE_SHELF: 1.5,          // how much a shallow shelf raises it (2.5 times at the coast)
  WAVE_COMPONENTS: 4,       // wave trains summed for the sea state
  WAVE_SCALE: 1,            // blocks a real metre of wave height (Froude: 1:1, as everything at block scale)
  FETCH_FULL: 2000,         // blocks of open water for a fully developed sea
  CURRENTS: [               // [up to latitude, name, east speed m/s] zonal surface currents
    [3, "equatorial counter-current", 0.4],
    [20, "equatorial current", -0.5],
    [40, "subtropical drift", 0.1],
    [65, "west wind drift", 0.4],
    [90, "polar drift", -0.15],
  ],

  // ---- boats (a hull is length L blocks; everything else follows from L and Froude)
  HULL_FROUDE: 0.4,         // a displacement hull's speed limit: Fr = v / sqrt(g L) (naval architects' 0.4)
  HULL: { LB: 4, BT: 2.5, CB: 0.45 },   // length/beam, beam/draught, block coefficient: a working open boat
  CF: 0.003,                // skin-friction coefficient at a boat's Reynolds numbers (ITTC line, about 1e7)
  SAIL_AREA: 0.5,           // square blocks of sail per square block of length (a working rig)
  RIG: { square: { luff: 50 }, fore_and_aft: { luff: 28 } },   // degrees off the wind a rig stops drawing
  POLAR: { CL: 1, FILL: 15, CD0: 0.15, CD_RUN: 1.05 },        // the sail's lift, how fast it fills (deg), its drag close-hauled and running
  HEEL_GAIN: 40,            // degrees of heel per m/s^2 of side push (a stiff, ballasted hull)
  HEEL_MAX: 30,             // degrees: past this she spills wind (the sheet is eased)
  KEEL_GRIP: 0.35,          // share of sideways speed the keel takes each tick
  ROLL_PERIOD: 24,          // ticks a roll takes for a hull ROLL_REF_L long (scales by sqrt(L))
  ROLL_REF_L: 6,            // blocks
  ROLL_DAMP: 0.06,          // share of roll rate the water takes each tick
  TURN_DAMP: 0.25,          // share of turn rate the water takes each tick
  TURN_RADIUS_L: 3,         // at full helm she turns a circle this many lengths across
  HULL_POINTS: 5,           // stations along the hull where it feels the sea's surface
  TRAIN_EVERY: 8,           // ticks between rebuilding a place's wave trains (the breath; the surface moves every tick)
  TRAIN_CACHE: 64,          // places' wave trains kept
  HULL_DEPTH: 2.2,          // a hull's depth over its draught (freeboard is the rest)
  ADDED: 0.06,              // added resistance in waves, in rho g (H/2)^2 B^2 / L with the waves' own gravity (a small open hull, off resonance)
  ADDED_FOLLOW: 0.7,        // how much of that is lost when the sea is abeam or astern
  WEAR: { SAIL: 0.002, SLAM: 0.5, GREEN: 0.3 },   // repair units: a metre sailed, a slam, a sea shipped green
  SKIN: 0.0003,             // share of speed lost each tick to everything slow (eddies), so a drift dies in minutes
  WAKE_KEEP: 2400,          // ticks of wake the sea keeps (two minutes): exact reversal reaches this far back
  GLOBE_METRIC: true,       // ships make honest headway on the globe: an east block at latitude f is cos f of one at the equator
});

// ---------------------------------------------------------------- derived

export const D = Object.freeze({
  W: VISION.CIRC,                                        // blocks east-west
  H: VISION.CIRC / 2,                                    // blocks pole to pole
  M_PER_BLOCK: GIVEN.EARTH_CIRC_M / VISION.CIRC,         // the map scale: about 1,223 m a block
  MPS: 1 / GIVEN.TICKS_PER_S,                            // blocks a tick per metre a second (motion is 1:1)
  PX: VISION.MAP_PX,                                     // blocks a map cell (a region)
  CELLS_W: VISION.CIRC / VISION.MAP_PX,                  // 2,048 map cells round
  CELLS_H: VISION.CIRC / 2 / VISION.MAP_PX,              // 1,024 pole to pole
  DEG: VISION.CIRC / 360,                                // blocks a degree (north-south, and east-west at the equator)
  ICE_ROWS: Math.round((90 - VISION.ICE_LAT) * (VISION.CIRC / 360)),
  // the sky clock: Minecraft's day is 72 times the Earth's, so its rotation is 72 times faster
  SKY: GIVEN.EARTH_DAY_S / (GIVEN.DAY / GIVEN.TICKS_PER_S),
});
