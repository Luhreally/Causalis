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
// ── A tick in slices ───────────────────────────────────────────────────────────
// A tick is a generator of steps: the calendar, the substrate, every life in
// runs of TICK_SLICE, the slower passes, each tick system. simTick runs one to
// its end, the same world to the bit as when it was one call. The page's clock
// (38) runs slices until its frame's time is spent and draws in between, so a
// slow phone's hundred-millisecond tick no longer holds a frame for all of it.
// Between slices the world is part-way through its tick: drawing only reads,
// the tick's memos are off (PERF_TICKING) so nothing read then is kept, and
// whatever would change the world, save it or step it finishes the tick first
// (finishPendingTick).
const TICK_SLICE = 16;
let pendingTick = null;
function* tickSteps() {
  const systems = TICK_SYSTEMS.after;
  if (TICK_MEMO_SPAN < 0) {
    yield* tickCoreSteps();
    for (let i = 0; i < systems.length; i++) {
      runTickSystems(systems, i, i + 1);
      yield;
    }
    return;
  }
  PERF_TICKING = true;
  try {
    yield* tickCoreSteps();
    for (let i = 0; i < TICK_MEMO_SPAN; i++) {
      runTickSystems(systems, i, i + 1);
      yield;
    }
  } finally {
    PERF_TICKING = false;
  }
  for (let i = TICK_MEMO_SPAN; i < systems.length; i++) {
    runTickSystems(systems, i, i + 1);
    yield;
  }
}
// Runs the tick in progress (or a new one) until it ends or the deadline
// passes; true when a tick ended.
function advanceTick(deadline) {
  if (!W) return false;
  if (pendingTick && pendingTick.world !== W) pendingTick = null;
  if (!pendingTick) pendingTick = { world: W, steps: tickSteps(), ticking: false };
  const tick = pendingTick;
  PERF_TICKING = tick.ticking;
  let done = false;
  try {
    do done = tick.steps.next().done;
    while (!done && performance.now() < deadline);
  } catch (error) {
    pendingTick = null;
    PERF_TICKING = false;
    throw error;
  }
  if (done) pendingTick = null;
  else {
    tick.ticking = PERF_TICKING;
    PERF_TICKING = false;
  }
  return done;
}
function finishPendingTick() {
  if (pendingTick) advanceTick(Infinity);
}
function tickInProgress() {
  return !!pendingTick && pendingTick.world === W;
}
function simTick() {
  if (!W) return;
  finishPendingTick();
  const profile = TICK_PROFILE;
  if (!profile) {
    const steps = tickSteps();
    while (!steps.next().done);
    return;
  }
  // Profiled: the core's steps are timed together, each system on its own.
  const steps = tickSteps(),
    started = performance.now();
  let timed = false;
  for (let step = steps.next(); !step.done; step = steps.next())
    if (!timed && CORE_TICK_DONE) {
      const entry = (profile["core tick"] ||= { ms: 0, calls: 0, slowest: 0 }),
        spent = performance.now() - started;
      entry.ms += spent;
      entry.calls++;
      if (spent > entry.slowest) entry.slowest = spent;
      timed = true;
    }
}
let CORE_TICK_DONE = false;
// The core tick: the calendar, then the fields, the substrate and every life,
// then the slower passes on their cadences.
function* tickCoreSteps() {
  CORE_TICK_DONE = false;
  W.tick++;
  updateWeatherCycle();
  yield;
  updateEnvironmentalFields();
  updatePhysicalSubstrate();
  yield;
  yield* updateArtificialLife();
  resolveEffects();
  yield;
  if (W.tick % 8 === 0) {
    updatePlants();
    updateNichePrimaryProduction();
    updateReproduction();
    updateDiseaseAndDecay();
    resolveEffects();
    yield;
  }
  if (W.tick % 16 === 0) updateCampaignOrders();
  if (W.tick % 32 === 0) {
    updateSettlements();
    yield;
    updateCohorts();
    updateTerritoryCulture();
    updateMigration();
    resolveEffects();
    yield;
  }
  if (W.tick % 128 === 0) {
    updateBiosphereResilience();
    updateFactions();
    yield;
    updateDiplomacyAndWar();
    yield;
    updateTechnology();
    classifySpecies();
    updateHistoricalSignificance();
    recordStatistics();
    resolveEffects();
    yield;
  }
  commitDerivedCaches();
  if (W.tick % 1024 === 0) updateLongEpoch();
  if (W.tick % autosaveCadence() === 0) queueAutosave();
  // No yearly world hash here: nothing in the world reads it, and walking all
  // of W was the year tick's stall (45-80 ms on a grown world, 38 of it in the
  // social store). Saves, loads and the top bar take their own.
  rebuildSpatialBins();
  CORE_TICK_DONE = true;
  yield;
}
function stepTicks(n) {
  UI.clockInterrupted = false;
  finishPendingTick();
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
