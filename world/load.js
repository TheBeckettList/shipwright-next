// Lab side: read world/map.png into the map module.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decode } from "../tools/png.js";
import { useMap, useIslets, useInsets } from "./map.js";
import { theraChunk } from "./thera.js";
import { useStones } from "./stones.js";
import { useHomeports } from "./homesites.js";
import { useTrunks } from "./rivers.js";
const here = path.dirname(fileURLToPath(import.meta.url));
export function loadMap(file = path.join(here, "map.png"), { cays = true, thera = true, stones = cays } = {}) {
  const m = useMap(decode(fs.readFileSync(file)));
  useIslets([]);   // the square cays (world/islets.json) are retired: the hidden stepping stones (world/stones.json) carry the route round alone
  useInsets(thera ? [theraChunk] : []);
  const tf = path.join(here, "trunks.json"); useTrunks(fs.existsSync(tf) ? JSON.parse(fs.readFileSync(tf, "utf8")).trunks : []);
  const hf = path.join(here, "homeports.json"); useHomeports(cays && fs.existsSync(hf) ? JSON.parse(fs.readFileSync(hf, "utf8")).homeports : []);
  const sf = path.join(here, "stones.json"); useStones(stones && fs.existsSync(sf) ? JSON.parse(fs.readFileSync(sf, "utf8")).stones : []);
  return m;
}
