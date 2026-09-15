// Why do a hungry town's fields stand fallow?
//
// On battery causal-origin the cradle carried the home world to ninety and
// then it starved from year ninety-four: Yewwatch held twenty-four people on
// five fields, four of them fallow, and Flintholl fourteen on nine fields
// mostly fallow, for years. The granary's hungry-hands rule (82) sends the
// hungry to sow when the stores are lean and the seed is there. This
// generates the seed, presses to the ship, steps the press to the year asked
// for, and then for sixty-four ticks counts, for every town with a fallow
// field: the residents by hunger band and by what the labour tick did with
// them (wanted as hungry hands, sent to civil labour, refused), the calls to
// performFarmLabor and what they returned, the sowings tried and refused with
// the seed in the store against the seed a sowing needs, the fields' stages
// and each fallow field's last-labour tick, and whether a farm's access tile
// can be reached.
//
// node scripts/fallow-probe.cjs <seed:size:complexity> <year>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  source = process.argv[2] || "causal-origin:battery:lean",
  target = Number(process.argv[3] || 96);
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
  const book = {};
  for (const s of towns) {
    const farms = completedBuildings(s, "farm"), fields = farms.map((b) => cultivatedField(b)).filter(Boolean);
    if (!fields.some((f) => f.stage === "fallow")) continue;
    book[s.id] = { name: s.name.slice(0, 9), pop: settlementPopulation(s), farms: farms.length, stages: {}, fallowIdle: [], store: s.inventory[C.ORGANIC] || 0, seed: seedReserve(s), needSeed: fields.filter((f) => f.stage === "fallow").map((f) => Math.max(1, Math.ceil((f.tiles?.length || 1) / 3))), outlook: (({ larder, hungry, lean, famine }) => ({ larder: Math.round(larder), hungry: +hungry.toFixed(2), lean, famine }))(foodOutlook(s)), hunger: { under56: 0, "56-68": 0, "69-92": 0, over92: 0 }, wanted: 0, labour: 0, labourTrue: 0, farmLabor: 0, farmLaborTrue: 0, sowTried: 0, sowDone: 0, sowRefusedSeed: 0, sowRefusedStage: 0, access: {} };
    for (const f of fields) { book[s.id].stages[f.stage] = (book[s.id].stages[f.stage] || 0) + 1; if (f.stage === "fallow") book[s.id].fallowIdle.push(W.tick - (f.lastLaborTick || 0)); }
    for (const b of farms) { const fld = cultivatedField(b); if (!fld || fld.stage !== "fallow") continue; const worker = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]?.homePlaceId === s.id); book[s.id].access[b.id] = worker !== undefined ? !!farmLaborAccessTile(worker, b) : null; }
    const members = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]?.homePlaceId === s.id);
    for (const id of members) { const h = derivedLife(id).hunger; const k = h < 56 ? "under56" : h <= 68 ? "56-68" : h <= 92 ? "69-92" : "over92"; book[s.id].hunger[k]++; }
  }
  const townOf = (id) => { const p = nearestFriendlyPlace(id); return p && book[p.id] ? book[p.id] : null; };
  const hw = hungryHandsWanted; hungryHandsWanted = function (id, place) { const out = hw(id, place); if (out && place && book[place.id]) book[place.id].wanted++; return out; };
  const pcl = performCivilLabor; performCivilLabor = function (id) { const t = townOf(id); const out = pcl(id); if (t) { t.labour++; if (out) t.labourTrue++; } return out; };
  const pfl = performFarmLabor; performFarmLabor = function (id) { const t = townOf(id); const out = pfl(id); if (t) { t.farmLabor++; if (out) t.farmLaborTrue++; } return out; };
  const sow = sowCultivatedField; sowCultivatedField = function (worker, field, place) { const t = place && book[place.id]; if (t) { t.sowTried++; if (!field || field.stage !== "fallow") t.sowRefusedStage++; else if ((place.inventory[C.ORGANIC] || 0) < Math.max(1, Math.ceil((field.tiles?.length || 1) / 3))) t.sowRefusedSeed++; } const out = sow(worker, field, place); if (out && t) t.sowDone++; return out; };
  for (let i = 0; i < 64; i++) simTick();
  hungryHandsWanted = hw; performCivilLabor = pcl; performFarmLabor = pfl; sowCultivatedField = sow;
  for (const s of towns) if (book[s.id]) { book[s.id].storeAfter = s.inventory[C.ORGANIC] || 0; const stages = {}; for (const b of completedBuildings(s, "farm")) { const f = cultivatedField(b); if (f) stages[f.stage] = (stages[f.stage] || 0) + 1; } book[s.id].stagesAfter = stages; }
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), night: typeof nightAt === "function" ? nightAt(W.width >> 1, W.height >> 1) : null, concerted: concertedIntensity(), towns: Object.values(book) });
})()`;
const r = JSON.parse(rt.get(report));
console.log(JSON.stringify({ year: r.year, night: r.night, concerted: r.concerted }));
for (const t of r.towns) console.log("   " + JSON.stringify(t));
