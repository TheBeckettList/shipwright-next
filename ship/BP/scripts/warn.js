// Throttled warnings: each kind of failure is logged at most once a minute, so an error that
// repeats every tick can't flood the server log.
const warned = new Map();
export function warnOnce(key, msg) {
  const now = Date.now();
  if (now - (warned.get(key) ?? 0) < 60000) return;
  warned.set(key, now);
  console.warn(msg);
}

/** Tells whoever sent a command (a player, or nobody: a command block or the console has no chat). */
export function tell(who, msg) {
  try {
    who?.sendMessage?.(msg);
  } catch {
    /* gone */
  }
}
