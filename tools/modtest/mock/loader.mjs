// inherency: instrument
// The module hook register.mjs installs: the game's script modules resolve to modtest's stand-ins.
const map = { "@minecraft/server": new URL("./server.mjs", import.meta.url).href, "@minecraft/server-ui": new URL("./server-ui.mjs", import.meta.url).href };
export async function resolve(specifier, context, next) {
  if (map[specifier]) return { url: map[specifier], shortCircuit: true };
  return next(specifier, context);
}
