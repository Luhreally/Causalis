// By what road do people enter a world?
//
// The houses probe found the coupling loop bearing nought to two children a
// year on a battery world whose people nonetheless grew from fifty-seven to
// eighty-five; the killer probe, counting BirthEvents of importance two or
// more, read nine to twenty-four births a year on the same seed once it had
// been pressed. One of those counts is not what it seems. This runs a fresh
// world, presses it the given number of times, and then, a year at a time,
// tallies every organism created by kind and parentage, every BirthEvent by
// its subject's kind and its evidence, every cohort materialised, and the
// statistics the game itself keeps, so the roads can be told apart.
//
// node scripts/births-probe.cjs <seed> <size> <complexity> <presses> <years>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "battery",
  complexity = process.argv[4] || "lean",
  presses = Number(process.argv[5] ?? 5),
  years = Number(process.argv[6] || 20);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, presses, years }));
for (let i = 0; i < year * 30; i++) tick();
for (let press = 1; press <= presses; press++) {
  const row = JSON.parse(rt.get(`(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), people: biospherePopulation(KINDS.PERSON), stop: r.stopReason }); })()`));
  console.log(JSON.stringify({ press, ...row }));
}
rt.get(`(() => {
  globalThis.__made = {}; globalThis.__events = {}; globalThis.__mat = 0; globalThis.__off = 0; globalThis.__coh = 0;
  const kindName = (k) => k === KINDS.PERSON ? "person" : k === KINDS.HERBIVORE ? "herbivore" : k === KINDS.PREDATOR ? "predator" : "kind" + k;
  const co = createOrganism; createOrganism = function (kind, x, y, r, parents, tile, divine) {
    const key = kindName(kind) + (parents && parents.length ? "/parents" : "/none");
    globalThis.__made[key] = (globalThis.__made[key] || 0) + 1;
    return co(kind, x, y, r, parents, tile, divine);
  };
  const ee = emitEvent; emitEvent = function (type, d) {
    const ev = ee(type, d);
    if (type === "BirthEvent") {
      const subject = d?.subjects?.[0], key = kindName(W.kind[subject]) + " imp" + (ev.importance ?? d?.importance ?? "?") + " " + String((d?.evidence || [])[0] || d?.data?.stage || "").slice(0, 40);
      globalThis.__events[key] = (globalThis.__events[key] || 0) + 1;
    }
    return ev;
  };
  const mc = materializeCohort; materializeCohort = function (c) { const out = mc(c); if (out && c.kind === KINDS.PERSON) globalThis.__mat++; return out; };
  const cf = createOffspring; createOffspring = function (kind, ...a) { if (kind === KINDS.PERSON) globalThis.__off++; return cf(kind, ...a); };
  const ab = addBirthToCohort; addBirthToCohort = function (kind, ...a) { if (kind === KINDS.PERSON) globalThis.__coh++; return ab(kind, ...a); };
  return 1;
})()`);
const aYear = `(() => {
  globalThis.__made = {}; globalThis.__events = {}; globalThis.__mat = 0; globalThis.__off = 0; globalThis.__coh = 0;
  const bk0 = { ...(W.statistics.birthsByKind || {}) }, people0 = biospherePopulation(KINDS.PERSON);
  for (let i = 0; i < ${year}; i++) simTick();
  const bk = W.statistics.birthsByKind || {};
  const personCohorts = (W.cohorts || []).filter((c) => c.kind === KINDS.PERSON).reduce((n, c) => n + (c.count || 0), 0);
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), people0, people: biospherePopulation(KINDS.PERSON), living: W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id)).length,
    personCohorts, concerted: typeof concertedIntensity === "function" ? concertedIntensity() : null,
    statPerson: (bk.person || 0) - (bk0.person || 0), offspring: globalThis.__off, cohortBirths: globalThis.__coh, materialised: globalThis.__mat,
    made: globalThis.__made, births: globalThis.__events });
})()`;
for (let n = 1; n <= years; n++) {
  const row = JSON.parse(rt.get(aYear));
  console.log(`y${String(row.year).padStart(4)} people ${row.people0}->${row.people} living${row.living} inCohorts${row.personCohorts} concerted${row.concerted} statPerson${row.statPerson} offspring${row.offspring} cohortBirths${row.cohortBirths} materialised${row.materialised} made${JSON.stringify(row.made)}`);
  console.log(`     birth events ${JSON.stringify(row.births)}`);
}
