// How a world dies before the gate.
//
// Two of thirty battery worlds died before their ship in the thirty-seed
// sweep of HANDOFF section 18: variety-18 to thirteen people and no town by
// year 726, variety-21 from sixty-nine to eleven with one apartment block to
// go, and variety-20 would have died at nine but for the skyline bound. This
// presses a world the way the sweeps do and reads, press by press: the year,
// the people and the people in towns, the births since the last press, the
// deaths since the last press by cause (the first line of each death's
// evidence), the ages of the dead (young, grown, old), the living towns with
// their people, stability, hungry share and food outlook, the camps, the
// people who belong to no place, the strain of the sky and the dry share of
// the year, and the press's target. One JSON row per press.
//
// node scripts/death-probe.cjs <seed:size:complexity> <presses>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime();
const [seed = "variety-18", size = "battery", complexity = "lean"] = (
  process.argv[2] || "variety-18:battery:lean"
).split(":");
const presses = Number(process.argv[3] || 40);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
for (let i = 0; i < year * 30; i++) tick();
console.log(JSON.stringify({ seed, size, complexity, presses }));
rt.get(
  `globalThis.__death = { births: W.statistics.birthsByKind?.person || 0, floor: W.nextEventId }; 1`,
);
for (let press = 1; press <= presses; press++) {
  const row = rt.get(`(() => {
    const state = makeCausalSkipState();
    let dry = 0, ticks = 0;
    while (!state.done) { causalSkipStep(state); ticks++; if (W.weather && /Drought|Heat Wave/.test(W.weather.name)) dry++; }
    const d = globalThis.__death, causes = {}, ages = { young: 0, grown: 0, old: 0 };
    let deaths = 0;
    for (const e of W.events) {
      if (e.id < d.floor || e.type !== "DeathEvent" || e.data?.kind !== "person") continue;
      deaths++;
      const k = String(e.evidence?.[0] || "?").slice(0, 24); causes[k] = (causes[k] || 0) + 1;
      const age = e.data?.age ?? e.data?.ageYears ?? null;
      if (age != null) { if (age < 14) ages.young++; else if (age < 50) ages.grown++; else ages.old++; }
    }
    const births = (W.statistics.birthsByKind?.person || 0) - d.births;
    d.births = W.statistics.birthsByKind?.person || 0; d.floor = W.nextEventId;
    const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
    const byHome = { settlement: 0, camp: 0, none: 0 };
    for (const id of people) { const h = W.components.social[id]?.homePlaceKind; byHome[h === "settlement" || h === "camp" ? h : "none"]++; }
    const towns = W.settlements.filter((s) => !s.ruined).map((s) => { const o = typeof foodOutlook === "function" ? foodOutlook(s) : null; return { name: s.name.slice(0, 10), pop: settlementPopulation(s), stab: +(s.stability || 0).toFixed(2), hungry: o ? +(o.hungry || 0).toFixed(2) : null, lean: !!o?.lean, famine: !!o?.famine, farms: completedBuildings(s, "farm").length, store: s.inventory[C.ORGANIC] || 0 }; });
    return JSON.stringify({ press: ${press}, year: Math.floor(W.tick / TICKS_PER_YEAR), stop: state.done, people: people.length, byHome, births, deaths, causes, ages, towns, camps: W.camps.filter((c) => c.active).length, ruinedTowns: W.settlements.filter((s) => s.ruined).length, strain: W.afternoon ? +W.afternoon.strain.toFixed(2) : null, dry: +(dry / Math.max(1, ticks)).toFixed(2), target: causalTarget()?.key || null, ships: W.ascensions.length });
  })()`);
  console.log(row);
  if (/"ships":[1-9]/.test(row)) break;
}
