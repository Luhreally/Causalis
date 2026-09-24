// Why do a lean town's fallow fields go unsown with grain in the store?
//
// On battery causal-origin the field-yield probe read sown 0–1 a year at
// Flinthollow from year sixty-one to sixty-five with two to six hundred organic
// in the store and seven to eleven fields fallow. Sowing wants only as much
// seed as the field has tiles, so the store is not the reason. This runs to
// the press and then, a year at a time inside the skip, wraps the farm labour
// and counts what happens to it: how many hands reached it, how many found no
// field to work, no access tile, a field too recently worked, or a sowing that
// returned false — beside the town's fields by stage, its store, and its hands
// by fitness (fit for labour under 42d's bar, hungry under 82's, or neither).
//
// node scripts/sowing-probe.cjs <seed> <size> <complexity> <quiet> <years>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "battery",
  complexity = process.argv[4] || "lean",
  quiet = Number(process.argv[5] || 12),
  years = Number(process.argv[6] || 10);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, quiet, years }));
for (let i = 0; i < year * 30; i++) tick();
for (let press = 1; press <= quiet; press++) {
  const row = JSON.parse(
    rt.get(
      `(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), people: modernLivingPeople(), stop: r.stopReason }); })()`,
    ),
  );
  console.log(JSON.stringify({ press, ...row }));
}
// Wrap the farm labour so every call is accounted for.
rt.get(`(() => {
  globalThis.__farm = { calls: 0, noPlace: 0, noField: 0, noAccess: 0, sowed: 0, sowFailed: 0, harvested: 0, tended: 0, walked: 0, other: 0 };
  const base = performFarmLabor;
  performFarmLabor = function (workerId) {
    const f = globalThis.__farm;
    f.calls++;
    const place = nearestFriendlyPlace(workerId);
    if (!place) { f.noPlace++; return base(workerId); }
    const before = W.components.work?.[workerId]?.task;
    const fields = completedBuildings(place, "farm").map(cultivatedField).filter(Boolean),
      field = fields.find((c) => (c.stage === "ripe" && W.tick >= (c.harvestBlockedUntil || 0)) || (c.stage !== "ripe" && W.tick - c.lastLaborTick >= 12));
    if (!field) { f.noField++; return base(workerId); }
    const building = W.buildings.find((b) => b.id === field.buildingId), access = building ? farmLaborAccessTile(workerId, building) : null;
    if (!access) { f.noAccess++; return base(workerId); }
    const stage = field.stage, out = base(workerId), after = W.components.work?.[workerId];
    if (after?.task === "travel" || (after?.task && after.task !== before && /moving|carrying|going/.test(String(after.phase || "")))) f.walked++;
    else if (stage === "fallow") { if (field.stage === "sown") f.sowed++; else f.sowFailed++; }
    else if (stage === "ripe") f.harvested++;
    else if (out) f.tended++;
    else f.other++;
    return out;
  };
  return "1";
})()`);
const aYear = `(() => {
  const state = globalThis.__state || (globalThis.__state = makeCausalSkipState());
  const stop = W.tick + ${year};
  while (W.tick < stop && !state.done) causalSkipStep(state);
  if (state.done) globalThis.__state = makeCausalSkipState();
  const town = W.settlements.filter((s) => !s.ruined && s.knownProcesses).sort((a, b) => settlementPopulation(b) - settlementPopulation(a))[0];
  if (!town) return JSON.stringify({ gone: true });
  const fields = completedBuildings(town, "farm").map(cultivatedField).filter(Boolean),
    stages = {}, idle = [];
  for (const f of fields) { stages[f.stage] = (stages[f.stage] || 0) + 1; if (f.stage === "fallow") idle.push(W.tick - (f.lastLaborTick || 0)); }
  let fit = 0, hungryHands = 0, unfit = 0, near = 0;
  for (const id of granaryResidents(town)) {
    const l = derivedLife(id), q = W.components.chemistry[id]?.q;
    if (!l || !q) continue;
    near++;
    if (l.hunger <= 56 && l.thirst <= 62 && l.fatigue <= 79 && q[C.ENERGY] >= 125) fit++;
    else if (l.hunger > 56 && l.hunger <= 92 && l.thirst <= 80 && q[C.ENERGY] >= 20) hungryHands++;
    else unfit++;
  }
  const f = { ...globalThis.__farm };
  for (const k of Object.keys(globalThis.__farm)) globalThis.__farm[k] = 0;
  const sown = W.events.filter((e) => e.type === "CropSownEvent" && e.id >= (globalThis.__floor || 0) && W.buildings.some((b) => b.id === e.data?.buildingId && b.placeId === town.id)).length;
  globalThis.__floor = W.nextEventId;
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), town: town.name.slice(0, 10), pop: settlementPopulation(town),
    store: town.inventory[C.ORGANIC] || 0, fields: fields.length, stages, fallowIdleTicks: idle.sort((a, b) => a - b).slice(0, 6),
    hands: { residents: near, fit, hungryHands, unfit }, farm: f, sownEvents: sown,
    hungry: typeof hungryShare === "function" ? +hungryShare(town).toFixed(2) : null,
    outlook: typeof foodOutlook === "function" ? (() => { const o = foodOutlook(town); return o ? (o.famine ? "famine" : o.lean ? "lean" : "fed") : null; })() : null });
})()`;
for (let n = 1; n <= years; n++) {
  const row = JSON.parse(rt.get(aYear));
  if (row.gone) {
    console.log("no town");
    break;
  }
  console.log(JSON.stringify(row));
}
