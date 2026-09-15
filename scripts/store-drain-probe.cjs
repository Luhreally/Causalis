// Where does a famine town's store go in a day?
//
// The hungry-town probe read Stoneford on phone causal-origin at year 118: a
// store of 597 at dawn, nought by the next day, and of the forty-three
// residents drawn on, guts up by four and ten. This generates the seed,
// presses to the ship, steps the press to the year asked for, and then for a
// day (thirty-two ticks) wraps every function the scheduler (16) calls and
// books the named town's organic store before and after each call, so the
// day's outflow is attributed by phase: the artificial-life step (every
// mouth), the settlements step (the daily draw and the cohorts), the factions
// step (militias), the war step (provisions), the migration step, the
// plants' step, the effects. What no phase accounts for is the residual: the
// sections that wrap the tick itself (muck, markets, harvest, roads, ...).
// The people's guts and the world's tiles are read before and after as well.
//
// node scripts/store-drain-probe.cjs <seed:size:complexity> <year> [town]
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  source = process.argv[2] || "causal-origin:battery:lean",
  target = Number(process.argv[3] || 104),
  townName = process.argv[4] || "";
const year = rt.get("TICKS_PER_YEAR");
const [seed, size = "battery", complexity = "lean"] = source.split(":");
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick");
for (let i = 0; i < year * 30; i++) tick();
for (let press = 1; press <= 40; press++) {
  const row = JSON.parse(rt.get(`(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason, ships: (W.ascensions || []).length }); })()`));
  console.log(JSON.stringify({ press, ...row }));
  if (row.ships || row.year >= target) break;
}
rt.get(`(() => { for (let presses = 0; presses < 400 && Math.floor(W.tick / TICKS_PER_YEAR) < ${target}; presses++) { const state = makeCausalSkipState(); while (Math.floor(W.tick / TICKS_PER_YEAR) < ${target} && !state.done) causalSkipStep(state); } return 1; })()`);
const report = `(() => {
  const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses);
  let town = ${JSON.stringify(townName)} ? towns.find((s) => s.name.startsWith(${JSON.stringify(townName)})) : null;
  if (!town) town = towns.slice().sort((a, b) => hungryShare(b) - hungryShare(a))[0];
  if (!town) return JSON.stringify({ error: "no town" });
  const names = ["updateWeatherCycle", "updateEnvironmentalFields", "updatePhysicalSubstrate", "updateArtificialLife", "resolveEffects", "updatePlants", "updateNichePrimaryProduction", "updateReproduction", "updateDiseaseAndDecay", "updateCampaignOrders", "updateSettlements", "updateCohorts", "updateTerritoryCulture", "updateMigration", "updateBiosphereResilience", "updateFactions", "updateDiplomacyAndWar", "updateTechnology", "classifySpecies", "updateHistoricalSignificance", "recordStatistics", "commitDerivedCaches", "updateLongEpoch", "rebuildSpatialBins"];
  const book = {}, originals = {};
  const store = () => town.inventory[C.ORGANIC] || 0;
  for (const name of names) {
    const fn = globalThis[name] || (typeof eval(name) === "function" ? eval(name) : null);
    if (typeof fn !== "function") continue;
    originals[name] = fn;
    const wrapped = function (...args) { const a = store(); const out = fn.apply(this, args); const d = store() - a; if (d) { book[name] = book[name] || { out: 0, in: 0 }; if (d < 0) book[name].out -= d; else book[name].in += d; } return out; };
    eval(name + " = wrapped");
  }
  const members = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]?.homePlaceKind === "settlement" && W.components.social[id].homePlaceId === town.id);
  const guts0 = members.reduce((n, id) => n + (W.components.inventory[id]?.digestive?.[C.ORGANIC] || 0), 0);
  const bodies0 = members.reduce((n, id) => n + (W.components.chemistry[id]?.q[C.ORGANIC] || 0), 0);
  const unitGuts0 = (W.militaryUnits || []).filter((u) => u.active && u.homeSettlementId === town.id).flatMap((u) => u.memberIds).reduce((n, id) => n + (W.components.inventory[id]?.digestive?.[C.ORGANIC] || 0), 0);
  const store0 = store(), o0 = foodOutlook(town);
  const audit0 = auditMatter().delta, tiles0 = (() => { let n = 0; for (let i = 0; i < W.tileCount; i++) n += W.tiles.chem[C.ORGANIC][i]; return n; })();
  let perTick = [];
  for (let i = 0; i < 32; i++) { const a = store(); simTick(); perTick.push(store() - a); }
  for (const name of Object.keys(originals)) eval(name + " = originals[name]");
  const guts1 = members.reduce((n, id) => n + (W.components.inventory[id]?.digestive?.[C.ORGANIC] || 0), 0);
  const bodies1 = members.reduce((n, id) => n + (W.components.chemistry[id]?.q[C.ORGANIC] || 0), 0);
  const unitGuts1 = (W.militaryUnits || []).filter((u) => u.active && u.homeSettlementId === town.id).flatMap((u) => u.memberIds).reduce((n, id) => n + (W.components.inventory[id]?.digestive?.[C.ORGANIC] || 0), 0);
  const tiles1 = (() => { let n = 0; for (let i = 0; i < W.tileCount; i++) n += W.tiles.chem[C.ORGANIC][i]; return n; })();
  const outSum = Object.values(book).reduce((n, b) => n + b.out, 0), inSum = Object.values(book).reduce((n, b) => n + b.in, 0);
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), town: town.name, pop: settlementPopulation(town), members: members.length, residents: granaryResidents(town).length, outlook: { larder: Math.round(o0.larder), hungry: +o0.hungry.toFixed(2), lean: o0.lean, famine: o0.famine }, cap: rationCap(town), seed: seedReserve(town), store: store0 + " -> " + store(), byPhase: book, attributedOut: outSum, attributedIn: inSum, residualOut: (store0 - store()) - (outSum - inSum), memberGuts: guts0 + " -> " + guts1, memberBodies: bodies0 + " -> " + bodies1, unitGuts: unitGuts0 + " -> " + unitGuts1, tilesOrganic: tiles0 + " -> " + tiles1, audit: auditMatter().delta - audit0, perTick });
})()`;
const r = JSON.parse(rt.get(report));
console.log(JSON.stringify(r, null, 1).replace(/\n\s*/g, " "));
