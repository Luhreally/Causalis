// How many people do the fields feed, along the whole road?
//
// Pressing Causal skip from a year-thirty world, this reports after every
// press: the year, the people, the finished farms and the fields by stage,
// the crop reaped during the press and the granaries' organic at its end, the
// hungry share by the seventy line, the children born and the people who died
// during the press, and every town's people against its farms — so the
// food-to-people balance can be read at each stage of the arc, and a cap on
// growth set from what the fields actually carried rather than guessed.
//
// node scripts/food-balance-probe.cjs <seed> <size> <complexity> <presses>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "battery",
  complexity = process.argv[4] || "lean",
  presses = Number(process.argv[5] || 24);
// OFF=reach,hinter,adopt,mourn,seed,ferry,gated turns the named later sections back to their
// bases, for an A/B on the same seed.
const off = new Set(String(process.env.OFF || "").split(",").filter(Boolean));
const resets = {
  reach: "homeRationPlace = homeRationPlaceHearthBase",
  hinter: "zoneTarget = zoneTargetHinterlandBase",
  adopt: "adoptInto = adoptIntoHinterlandBase",
  mourn: "updateCouplings = updateCouplingsCradleBase, matingPartnerNear = matingPartnerNearCradleBase",
  seed: "hearthSpareFood = function (home, sp) { return home.inventory?.[sp] || 0; }",
  ferry: "startRoadLink = startRoadLinkFerryBase",
  gated: "shipHasLeft = function () { return false; }",
};
for (const k of off) { if (!resets[k]) throw new Error("unknown OFF " + k); rt.get("(() => { " + resets[k] + "; return 1; })()"); }
console.log(JSON.stringify({ off: [...off] }));
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, presses }));
for (let i = 0; i < year * 30; i++) tick();
rt.get(`(() => { globalThis.__floor = W.nextEventId; return 1; })()`);
const press = `(() => {
  const births0 = W.statistics.birthsByKind?.person || 0, people0 = biospherePopulation(KINDS.PERSON), tick0 = W.tick;
  const r = runCausalSkipForDebug();
  let harvest = 0, deaths = 0;
  for (const e of W.events) {
    if (e.id < globalThis.__floor) continue;
    if (e.type === "CropHarvestedEvent") harvest += e.magnitude || 0;
    if (e.type === "DeathEvent" && (e.importance || 0) >= 2) deaths++;
  }
  globalThis.__floor = W.nextEventId;
  const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses);
  let farms = 0, store = 0, hungryPeople = 0, townPeople = 0;
  const stages = {}, rows = [];
  for (const s of towns) {
    const f = completedBuildings(s, "farm").length, pop = settlementPopulation(s), o = foodOutlook(s);
    farms += f; store += s.inventory[C.ORGANIC] || 0; townPeople += pop; hungryPeople += (o?.hungry || 0) * pop;
    for (const b of completedBuildings(s, "farm")) { const fld = cultivatedField(b); if (fld) stages[fld.stage] = (stages[fld.stage] || 0) + 1; }
    rows.push(s.name.slice(0, 7) + ":" + pop + "/" + f + (o?.famine ? "F" : o?.lean ? "L" : ""));
  }
  const years = (W.tick - tick0) / TICKS_PER_YEAR;
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), years: +years.toFixed(1), stop: r.stopReason, milestone: (r.milestone?.label || "").slice(0, 30),
    people: biospherePopulation(KINDS.PERSON), people0, farms, perFarm: farms ? +(townPeople / farms).toFixed(1) : null, stages, harvest, harvestPerFarmYear: farms && years ? Math.round(harvest / farms / years) : null,
    store, hungry: townPeople ? +(hungryPeople / townPeople).toFixed(2) : 0, born: (W.statistics.birthsByKind?.person || 0) - births0, deaths, ships: (W.ascensions || []).length, towns: rows });
})()`;
for (let n = 1; n <= presses; n++) {
  const r = JSON.parse(rt.get(press));
  console.log(`p${String(n).padStart(2)} y${String(r.year).padStart(3)} +${r.years}y ${String(r.stop).padEnd(9)} ppl${String(r.people0).padStart(3)}->${String(r.people).padStart(3)} farms${String(r.farms).padStart(2)} (${r.perFarm}/farm) harvest${String(r.harvest).padStart(5)} (${r.harvestPerFarmYear}/farm/yr) store${String(r.store).padStart(4)} hungry${r.hungry} born${r.born} deaths${r.deaths} ships${r.ships} stages${JSON.stringify(r.stages)} towns${JSON.stringify(r.towns)} ${r.milestone}`);
  if (r.people < 6) break;
}
