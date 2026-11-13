# Texture spec (generated from world/textures.js)

| Family | Blocks | Kind | Golden device |
|---|---|---|---|
| stone | stone, andesite, diorite, granite, tuff, calcite, deepslate, basalt, quartz, obsidian | solid | veins in a 3D field: level sets of three plane waves with Fibonacci wavenumbers (1,1,2), (1,2,3), (2,3,5) across the cube (not (3,5,8): its face wavenumber passes the tile's Nyquist of 8 and would shimmer even up close), so veins run through every face and into the next block; grain from three crossing Fibonacci waves; 13 flecks on the Fibonacci lattice |
| log | every *_log and stripped log | solid | a cylinder: rings inside, widths from the Fibonacci word (wet years and dry), the pith off centre by the golden sequence; bark outside, ridges round the trunk spaced by the word, gently spiralled, fissures between. Top shows the rings and the bark rim; sides the bark; stripped sides the rings cut lengthwise |
| pillar | basalt, deepslate, hay_block, bone_block, quartz_pillar, purpur_pillar, bamboo_block | axis | anisotropic: the side runs along the block's axis, the end lies across it, and the game turns both when the block is laid sideways, so the same material reads one way stood up and another laid down. Basalt: columns five and three wide, cross-fractured by the word; ends near-hexagonal. Deepslate: wavering foliation. Hay: a bound sheaf, the band at the golden height; ends cut stalks. Bone: long grooves; ends marrow and ring at golden radii. Bamboo: poles five and three wide, nodes a golden interval apart; ends five hollow culms. Quartz and purpur: flutes three and two; ends a rosette |
| planks | every *_planks (and what's made of them) | solid | boards five and three wide from the word (as near phi as whole pixels allow), a butt joint at each board's golden position so no two end together, grain warped by the field, each board its own tone |
| grass | grass_block, podzol, mycelium, moss_block | solid | top: 34 blades on the Fibonacci lattice; side: earth under a turf fringe 16/phi^3 (about 4) pixels deep, ragged by the word; bottom: earth |
| strata | terracotta (all dyes), sandstone, red sandstone, smooth stone | solid | beds in y, three and two thick from the word, each its own tone, rippled in x and z by Fibonacci waves so they bend round corners and run on block to block; top: the uppermost bed |
| bricks | bricks, stone bricks, mud bricks, deepslate and other bricks | solid | courses four high; bricks six and four long (about phi) cut from the word, each course further on in it, so the bond wanders like hand-laid work; mortar sunk by the relief; each brick its own tone |
| cobble | cobblestone, blackstone | variants | Voronoi stones round the 13-point Fibonacci lattice, jittered per variant by the golden sequence; domed, joints sunk |
| gravel | gravel | variants | 21 Voronoi pebbles, each its own tone from the golden sequence |
| earth | dirt, mud, clay, packed mud, hay, farmland, dirt path | variants | 8 soft clods and 34 specks on Fibonacci lattices; farmland: furrows |
| sand | sand, red sand | variants | ripples of wavenumber (2, 3), windward the golden share of each, lee the rest; 34 grains on the lattice |
| leaves | every *_leaves | variants | 21 leaves on the Fibonacci lattice, each an ellipse of aspect phi turned the golden angle from the last; gaps dark |
| wool | wool and carpet (all dyes) | variants | a broken twill: the diagonal steps on where the word says L and back where it says S, so it never rules a line |
| snow | snow, ice, packed ice, blue ice | variants | snow: sparkle on a 21-point lattice; ice: cracks along 5 Voronoi edges, bubbles on the lattice |
| glazed | glazed terracotta (all dyes) | set | a Truchet tile: quarter arcs round opposite corners at golden radii 16/phi and 16/phi^2. It turns with how it's placed, so a floor of them draws golden spirals and meanders: the set is the pattern |
| water | water | animated | four wave trains at Fibonacci wavenumbers, each turning a whole number of times in 8 frames by deep-water dispersion; foam on the crests |
| prismarine | prismarine and its kin | animated | the 5D string (Seedworld gate #5) over a ground of 13 cells: from a point to one closed string and back in exactly 48 frames |
| coral | coral blocks, sponge | single | Gray-Scott reaction and diffusion (Turing's patterns), seeded by the record |
| glass | glass | single | clear, a frame, one streak of light at half the golden angle |
