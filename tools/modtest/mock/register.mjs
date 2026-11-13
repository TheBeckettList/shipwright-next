// inherency: instrument
// Points "@minecraft/server" (and -ui) at modtest's stand-in for the game, for the tool that imports this first and
// for every pack script it loads after. Each modtest tool imports it on its first line.
import { register } from "node:module";
register("./loader.mjs", import.meta.url);
