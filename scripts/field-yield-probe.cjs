// What do a town's fields actually yield, and what state are they in?
//
// On battery Flinthollow held thirty people and seven farms, its store went
// from two hundred and sixty-one to nothing in three years and stayed there
// for thirty, and the carrying curve said a town of seven with nearly five
// farms was still nine in ten hungry. The farm *count* is not the problem.
// Either the fields do not ripen, or they ripen and are not reaped, or they
// are reaped and the crop is small. This reads all three, a year at a time,
// inside the skip so the concerted effort's pull on the hands is included:
// harvests and the matter they moved (from the event's own magnitude), the
// store before and after, and the ground under every field — moisture,
// fertility, plant order, organic, water and nutrient — because photosynthesis
// on a field tile wants moisture over sixteen and fertility over ten and its
// reactants present, and a stripped tile has none of them.
//
// node scripts/field-yield-probe.cjs <seed> <size> <complexity> <quiet> <years>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "battery",
  complexity = process.argv[4] || "lean",
  quiet = Number(process.argv[5] || 3),
  years = Number(process.argv[6] || 30);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, quiet, years,
  world: JSON.parse(rt.get(`(() => {
    let water = 0, land = 0;
    for (let i = 0; i < W.tileCount; i++) if (W.tiles.liquid[i] > WATER_DEPTH.SURFACE) water++; else land++;
    return JSON.stringify({ w: W.width, h: W.height, wetBias: W.terrainGenome?.wetBias ?? null,
      baseTemp: W.terrainGenome?.baseTemperature ?? null, land, water, plantEfficiency: W.laws.plantEfficiency, solarFlux: W.laws.solarFlux });
  })()`)) }));
for (let i = 0; i < year * 30; i++) tick();
for (let press = 1; press <= quiet; press++) rt.get(`(() => { runCausalSkipForDebug(); return "1"; })()`);
rt.get(`(() => { globalThis.__floor = W.nextEventId; return "1"; })()`);

const aYear = `(() => {
  const state = globalThis.__state || (globalThis.__state = makeCausalSkipState());
  const town = W.settlements.filter((s) => !s.ruined)
    .sort((a, b) => settlementPopulation(b) - settlementPopulation(a))[0];
  if (!town) return JSON.stringify({ gone: true });
  const storeBefore = town.inventory[C.ORGANIC] || 0, stop = W.tick + ${year};
  while (W.tick < stop && !state.done) causalSkipStep(state);
  if (state.done) globalThis.__state = makeCausalSkipState();
  let harvests = 0, moved = 0, sown = 0, failed = 0, matured = 0;
  for (const e of W.events) {
    if (e.id < globalThis.__floor) continue;
    const mine = e.data?.buildingId != null
      ? W.buildings.some((b) => b.id === e.data.buildingId && b.placeId === town.id)
      : (e.evidence || []).some((x) => String(x).includes(town.name));
    if (!mine) continue;
    if (e.type === "CropHarvestedEvent") { harvests++; moved += e.magnitude || 0; }
    else if (e.type === "CropSownEvent") sown++;
    else if (e.type === "CropFailedEvent") failed++;
    else if (e.type === "FieldMaturedEvent") matured++;
  }
  globalThis.__floor = W.nextEventId;
  // The ground under the fields.
  const fields = (W.fields || []).filter((f) => f.placeId === town.id),
    stages = {}, g = { n: 0, moist: 0, fert: 0, order: 0, organic: 0, water: 0, nutrient: 0, dry: 0, barren: 0 };
  for (const f of fields) {
    stages[f.stage] = (stages[f.stage] || 0) + 1;
    const [fx, fy] = xy(f.tile);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!inside(fx + dx, fy + dy)) continue;
      const i = idx(fx + dx, fy + dy), m = tileMoisture(i), fe = tileFertility(i);
      g.n++; g.moist += m; g.fert += fe; g.order += W.tiles.plantOrder[i];
      g.organic += W.tiles.chem[C.ORGANIC][i]; g.water += W.tiles.chem[C.SOLVENT][i]; g.nutrient += W.tiles.chem[C.NUTRIENT][i];
      if (m <= 16) g.dry++; if (fe <= 10) g.barren++;
    }
  }
  const avg = (k) => (g.n ? +(g[k] / g.n).toFixed(1) : null);
  const residents = granaryResidents(town);
  let hungry = 0;
  for (const id of residents) if ((W.components.life[id]?.hunger || 0) > 60) hungry++;
  const waterTechs = ["irrigation", "waterworks", "chemistry"].filter((t) => town.knownProcesses.includes(t));
  // Whether irrigation actually fired, and whether there was any water for it
  // to carry: the counters since last year, how many of the town's fields have
  // a source within reach, and how much those sources could spare.
  const irr = window.ALIFE_IRRIGATION_DEBUG, ic = irr ? irr.counts() : null;
  if (irr) irr.reset();
  const ifields = irr ? irr.fields(town.id) : [], withSource = ifields.filter((f) => f.sources > 0).length;
  let spare = 0;
  if (fields.length) {
    const [fx0, fy0] = xy(fields[0].tile);
    for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++)
      if (inside(fx0 + dx, fy0 + dy)) spare += irr ? irr.spare(fx0 + dx, fy0 + dy) : 0;
  }
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), town: town.name.slice(0, 11),
    irrigation: ic ? { moved: ic.moved, fields: ic.fieldsWatered, tiles: ic.tilesWatered, dryLeft: ic.dryLeft, withSource, of: ifields.length, spare } : null,
    weather: W.weather.name, waterTechs, townWater: town.inventory[C.SOLVENT] || 0,
    pop: settlementPopulation(town), farms: completedBuildings(town, "farm").length, fields: fields.length,
    stages, harvests, moved, sown, failed, matured,
    store: [storeBefore, town.inventory[C.ORGANIC] || 0],
    hungry: residents.length ? +(hungry / residents.length).toFixed(2) : 0,
    ground: { tiles: g.n, moist: avg("moist"), fert: avg("fert"), order: avg("order"), organic: avg("organic"),
      water: avg("water"), nutrient: avg("nutrient"), dry: g.dry, barren: g.barren } });
})()`;

for (let n = 1; n <= years; n++) {
  const row = JSON.parse(rt.get(aYear));
  if (row.gone) { console.log("no town left"); break; }
  const gd = row.ground;
  console.log(
    `y${String(row.year).padStart(4)} ${row.town.padEnd(11)} ${String(row.weather).padEnd(10).slice(0, 10)} tech${row.waterTechs.length} tw${String(row.townWater).padStart(4)} pop${String(row.pop).padStart(3)} farms${row.farms} fields${row.fields} ${JSON.stringify(row.stages)} | harv${String(row.harvests).padStart(3)} moved${String(row.moved).padStart(5)} sown${row.sown} fail${row.failed} | store ${row.store[0]}->${row.store[1]} hungry${row.hungry} | irr ${row.irrigation ? `moved${row.irrigation.moved} f${row.irrigation.fields}/${row.irrigation.withSource}src/${row.irrigation.of} dryLeft${row.irrigation.dryLeft} spare${row.irrigation.spare}` : "-"} | ground moist${gd.moist} fert${gd.fert} order${gd.order} org${gd.organic} h2o${gd.water} nut${gd.nutrient} dry${gd.dry}/${gd.tiles} barren${gd.barren}`,
  );
}
