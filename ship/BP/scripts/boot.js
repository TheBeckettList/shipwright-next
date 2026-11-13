// Starting the pack's systems so that one failing never takes the rest down, and saying which did.
//
// Every system starts through start(name, fn). A system that throws is recorded and the others start
// anyway; the log's first Shipwright line then says how many started and names any that didn't, so
// a server log shows at a glance what's wrong. /scriptevent shipwright:check reports the same, and
// runs the pack's self-checks (checks.js).
const systems = [];

/** Starts one system, catching what it throws. */
export function start(name, fn) {
  try {
    fn();
    systems.push({ name, ok: true });
  } catch (err) {
    const error = String(err?.message ?? err);
    systems.push({ name, ok: false, error });
    console.warn(`[Shipwright] ${name} failed to start: ${error}`);
  }
}

/** Which systems started and which didn't. */
export function bootReport() {
  return { started: systems.filter((s) => s.ok).map((s) => s.name), failed: systems.filter((s) => !s.ok) };
}

/** One line for the log: how many systems started, and which didn't. */
export function bootLine(version) {
  const r = bootReport();
  const n = r.started.length + r.failed.length;
  return r.failed.length
    ? `[Shipwright] ${version}: ${r.started.length} of ${n} systems started. Failed: ${r.failed.map((s) => `${s.name} (${s.error})`).join("; ")}`
    : `[Shipwright] ${version}: all ${n} systems started`;
}
