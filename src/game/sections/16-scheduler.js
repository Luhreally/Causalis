// ═══════════════════════════════════════════════════════════════════════════
// 16. SCHEDULER AND FIXED-TICK CLOCK
// ═══════════════════════════════════════════════════════════════════════════
// ── Tick systems ────────────────────────────────────────────────────────────────
// A section adds to the tick by registering a system, not by wrapping simTick:
//
//   tickSystem("granary", function () { ... });       after the core tick
//   calendarSystem("belief", function () { ... });    in the calendar, after the weather
//
// Systems run in the order they are registered, which is manifest order, and
// that order is part of the world: swapping two of them moves the hash within
// 128 ticks. A system's body calls what it needs by name, so a later section
// that rewrites one of those functions is still heard. Each system has a name
// the profiler and the probes can hold it by (window.ALIFE_TICK_DEBUG).
//
// Memos that hold for a tick's span (70's plans, tile food and building lists)
// read PERF_TICKING. It is on for the core tick and for the systems registered
// before 70 calls endTickMemoWindow(), and off for the rest.
const TICK_SYSTEMS = { calendar: [], after: [] };
let PERF_TICKING = false,
  TICK_MEMO_SPAN = -1,
  TICK_PROFILE = null;
function registerTickSystem(phase, name, run) {
  if (typeof run !== "function") throw new Error(`tick system ${name} has no body`);
  const all = [...TICK_SYSTEMS.calendar, ...TICK_SYSTEMS.after];
  if (all.some((system) => system.name === name))
    throw new Error(`two tick systems are named ${name}`);
  TICK_SYSTEMS[phase].push({ name, phase, run, off: false });
}
function tickSystem(name, run) {
  registerTickSystem("after", name, run);
}
function calendarSystem(name, run) {
  registerTickSystem("calendar", name, run);
}
function endTickMemoWindow() {
  TICK_MEMO_SPAN = TICK_SYSTEMS.after.length;
}
function runTickSystems(systems, from, to) {
  const profile = TICK_PROFILE;
  for (let i = from; i < to; i++) {
    const system = systems[i];
    if (system.off) continue;
    if (!profile) {
      system.run();
      continue;
    }
    const started = performance.now();
    system.run();
    const spent = performance.now() - started,
      entry = (profile[system.name] ||= { ms: 0, calls: 0, slowest: 0 });
    entry.ms += spent;
    entry.calls++;
    if (spent > entry.slowest) entry.slowest = spent;
  }
}
function simTick() {
  if (!W) return;
  const systems = TICK_SYSTEMS.after;
  if (TICK_MEMO_SPAN < 0) {
    tickCore();
    runTickSystems(systems, 0, systems.length);
    return;
  }
  PERF_TICKING = true;
  try {
    tickCore();
    runTickSystems(systems, 0, TICK_MEMO_SPAN);
  } finally {
    PERF_TICKING = false;
  }
  runTickSystems(systems, TICK_MEMO_SPAN, systems.length);
}
// The core tick: the calendar, then the fields, the substrate and every life,
// then the slower passes on their cadences.
function tickCore() {
  const profile = TICK_PROFILE,
    started = profile ? performance.now() : 0;
  W.tick++;
  updateWeatherCycle();
  updateEnvironmentalFields();
  updatePhysicalSubstrate();
  updateArtificialLife();
  resolveEffects();
  if (W.tick % 8 === 0) {
    updatePlants();
    updateNichePrimaryProduction();
    updateReproduction();
    updateDiseaseAndDecay();
    resolveEffects();
  }
  if (W.tick % 16 === 0) updateCampaignOrders();
  if (W.tick % 32 === 0) {
    updateSettlements();
    updateCohorts();
    updateTerritoryCulture();
    updateMigration();
    resolveEffects();
  }
  if (W.tick % 128 === 0) {
    updateBiosphereResilience();
    updateFactions();
    updateDiplomacyAndWar();
    updateTechnology();
    classifySpecies();
    updateHistoricalSignificance();
    recordStatistics();
    resolveEffects();
  }
  commitDerivedCaches();
  if (W.tick % 1024 === 0) updateLongEpoch();
  if (W.tick % autosaveCadence() === 0) queueAutosave();
  // No yearly world hash here: nothing in the world reads it, and walking all
  // of W was the year tick's stall (45-80 ms on a grown world, 38 of it in the
  // social store). Saves, loads and the top bar take their own.
  rebuildSpatialBins();
  if (profile) {
    const entry = (profile["core tick"] ||= { ms: 0, calls: 0, slowest: 0 }),
      spent = performance.now() - started;
    entry.ms += spent;
    entry.calls++;
    if (spent > entry.slowest) entry.slowest = spent;
  }
}
function stepTicks(n) {
  UI.clockInterrupted = false;
  for (let i = 0; i < n; i++) {
    simTick();
    if (UI.clockInterrupted) break;
  }
  refreshUI(true);
}
// The tick's systems, read and timed. profile(true) times every system and the
// core from then on; report() lists them slowest first; off(name) skips one,
// for a probe's A/B (it changes the world, so never in play).
window.ALIFE_TICK_DEBUG = Object.freeze({
  systems: () =>
    ["calendar", "after"].flatMap((phase) =>
      TICK_SYSTEMS[phase].map((system, order) => ({
        name: system.name,
        phase,
        order,
        memo: phase === "calendar" || order < TICK_MEMO_SPAN,
        off: system.off,
      })),
    ),
  memoSpan: () => TICK_MEMO_SPAN,
  profile(on = true) {
    TICK_PROFILE = on ? {} : null;
    return !!TICK_PROFILE;
  },
  report: () =>
    Object.entries(TICK_PROFILE || {})
      .map(([name, entry]) => ({
        name,
        msPerCall: +(entry.ms / Math.max(1, entry.calls)).toFixed(3),
        ms: +entry.ms.toFixed(1),
        calls: entry.calls,
        slowest: +entry.slowest.toFixed(1),
      }))
      .sort((a, b) => b.ms - a.ms),
  off(name, off = true) {
    const system = [...TICK_SYSTEMS.calendar, ...TICK_SYSTEMS.after].find((s) => s.name === name);
    if (!system) return false;
    system.off = !!off;
    return true;
  },
});
