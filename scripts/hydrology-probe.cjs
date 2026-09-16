// Where the water goes.
//
// The land dries over a world's life whatever the sky does: battery
// causal-origin's mean moisture fell from 44 at the launch to 22 sixty years
// on with no forced spell, and its plants with it. This generates a world and
// steps it a year at a time, summing every pool the solvent can sit in — the
// land tiles, the lake tiles, the air, the bodies and guts of the living, the
// stores, walls, roads and cohorts — and accounting the year's flows: what the
// rain returned to the ground and what the dry sky lifted from it (the air's
// change under each weather), what each balanced reaction consumed for good
// (photosynthesis, decomposition, mineralization, corrosion — nothing makes
// solvent, so these are the sinks), what irrigation carried, and what the
// year's weather was. The land is read as the transit probe reads it: mean
// moisture, the share under the 16 photosynthesis needs, the plants standing.
// The lakes' spare is the matter above what their depth accounts for, the
// floor irrigation respects: what the sky could lift without a lake losing
// its level.
//
// OFF=breath turns the breathing sky (17) off for an A/B.
//
// node scripts/hydrology-probe.cjs <seed> <size> <complexity> <years>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "battery",
  complexity = process.argv[4] || "lean",
  years = Number(process.argv[5] || 60);
const off = new Set((process.env.OFF || "").split(",").filter(Boolean));
if (off.has("breath")) rt.get("(() => { breatheSurfaceWater = () => 0; return 1; })()");
rt.game.createTestWorld({ seed, size, complexity });
const year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, years, off: [...off] }));
// Every balanced reaction that touches the solvent is accounted by id: the
// units it consumed net of what it gave back.
rt.get(`(() => {
  globalThis.__hydro = { rx: {}, units: {} };
  const base = executeProcess;
  executeProcess = function (id, inv, requested, context) {
    const made = base(id, inv, requested, context);
    if (made) {
      const rx = reactionById(id);
      let net = 0;
      for (const [s, n] of rx.reactants) if (s === C.SOLVENT) net += n;
      for (const [s, n] of rx.products) if (s === C.SOLVENT) net -= n;
      if (net) globalThis.__hydro.rx[id] = (globalThis.__hydro.rx[id] || 0) + net * made;
      globalThis.__hydro.units[id] = (globalThis.__hydro.units[id] || 0) + made;
    }
    return made;
  };
  return 1; })()`);
const aYear = `(() => {
  const H = globalThis.__hydro, rx0 = { ...H.rx }, u0 = { ...H.units };
  const airBy = {}, ticksBy = {};
  const irr0 = window.ALIFE_IRRIGATION_DEBUG ? window.ALIFE_IRRIGATION_DEBUG.counts().moved : 0;
  const stop = W.tick + ${year};
  while (W.tick < stop) {
    const a0 = W.reservoirs.atmosphericSolvent, wn = W.weather.name;
    simTick();
    airBy[wn] = (airBy[wn] || 0) + (W.reservoirs.atmosphericSolvent - a0);
    ticksBy[wn] = (ticksBy[wn] || 0) + 1;
  }
  let land = 0, lake = 0, landTiles = 0, lakeTiles = 0, spare = 0, moist = 0, dry = 0, plants = 0, organic = 0, gas = 0, nutrient = 0, waste = 0, oxidant = 0, tempSum = 0, fertSum = 0, energyT = 0, gMoist = 0, gFert = 0, gHot = 0, gCold = 0, gFlood = 0, gGas = 0, gNut = 0;
  for (let i = 0; i < W.tileCount; i++) {
    const w = W.tiles.chem[C.SOLVENT][i];
    if (W.tiles.liquid[i] > WATER_DEPTH.SURFACE) { lake += w; lakeTiles++; spare += Math.max(0, w - W.tiles.liquid[i]); }
    else { land += w; landTiles++; const m = tileMoisture(i); moist += m; if (m < 16) dry++; plants += W.tiles.plantOrder[i]; const tc = W.tiles.temperature[i] / 10, fe = tileFertility(i); tempSum += tc; fertSum += fe; if (m <= 16) gMoist++; if (fe <= 10) gFert++; if (tc >= 48) gHot++; if (tc <= -8) gCold++; if (W.tiles.liquid[i] >= 1600) gFlood++; if (W.tiles.chem[C.GAS][i] < 2) gGas++; if (W.tiles.chem[C.NUTRIENT][i] < 1) gNut++; }
    organic += W.tiles.chem[C.ORGANIC][i]; energyT += W.tiles.chem[C.ENERGY][i]; gas += W.tiles.chem[C.GAS][i]; nutrient += W.tiles.chem[C.NUTRIENT][i]; waste += W.tiles.chem[C.WASTE][i]; oxidant += W.tiles.chem[C.OXIDANT][i];
  }
  let bodies = 0, nutBodies = 0;
  for (const id of W.activeIds) { const q = W.components.chemistry[id]?.q, inv = W.components.inventory[id]; bodies += (q?.[C.SOLVENT] || 0) + (inv?.materials?.[C.SOLVENT] || 0) + (inv?.digestive?.[C.SOLVENT] || 0); nutBodies += (q?.[C.NUTRIENT] || 0) + (inv?.materials?.[C.NUTRIENT] || 0) + (inv?.digestive?.[C.NUTRIENT] || 0); }
  let places = 0;
  for (const s of W.settlements) places += (s.inventory[C.SOLVENT] || 0) + (s.structure?.composition?.[C.SOLVENT] || 0) + (s.researchInventory?.[C.SOLVENT] || 0);
  for (const c of W.camps) if (c.active) places += (c.inventory[C.SOLVENT] || 0) + (c.structure?.composition?.[C.SOLVENT] || 0) + (c.researchInventory?.[C.SOLVENT] || 0);
  for (const b of W.buildings || []) places += b.composition?.[C.SOLVENT] || 0;
  for (const c of W.cohorts) places += c.chemistryTotals?.[C.SOLVENT] || 0;
  if (W.roads?.matter) places += W.roads.matter[C.SOLVENT] || 0;
  const air = W.reservoirs.atmosphericSolvent, pool = W.reservoirs.primordialPackets?.[C.SOLVENT] || 0;
  const eaten = {}; for (const k of Object.keys(H.rx)) { const d = H.rx[k] - (rx0[k] || 0); if (d) eaten[k] = d; }
  const ran = {}; for (const k of Object.keys(H.units)) { const d = H.units[k] - (u0[k] || 0); if (d) ran[k] = d; }
  const k = (n) => Math.round(n / 1000) + "k";
  return JSON.stringify({
    year: Math.floor(W.tick / TICKS_PER_YEAR), people: biospherePopulation(KINDS.PERSON), herbivores: biospherePopulation(KINDS.HERBIVORE), predators: biospherePopulation(KINDS.PREDATOR),
    total: k(land + lake + air + bodies + places + pool), land: k(land), lake: k(lake), spare: k(spare), air: k(air), bodies: k(bodies), places: k(places), pool: k(pool),
    landTiles, lakeTiles,
    temp: +(tempSum / Math.max(1, landTiles)).toFixed(1), fert: Math.round(fertSum / Math.max(1, landTiles)), gates: { moist: gMoist, fert: gFert, hot: gHot, cold: gCold, flood: gFlood, gas: gGas, nutrient: gNut }, energyTile: k(energyT),
    nutrientBodies: k(nutBodies),
    moist: Math.round(moist / Math.max(1, landTiles)), dry: +(dry / Math.max(1, landTiles)).toFixed(2), plants: k(plants), organic: k(organic), gas: k(gas), nutrient: k(nutrient), waste: k(waste), oxidant: k(oxidant),
    airBy: Object.fromEntries(Object.entries(airBy).map(([n, v]) => [n, k(v)])), weather: ticksBy, eaten: Object.fromEntries(Object.entries(eaten).map(([n, v]) => [n, k(v)])), ran: Object.fromEntries(Object.entries(ran).map(([n, v]) => [n, k(v)])),
    irrigated: k((window.ALIFE_IRRIGATION_DEBUG ? window.ALIFE_IRRIGATION_DEBUG.counts().moved : 0) - irr0),
    audit: auditMatter().delta,
  });
})()`;
for (let n = 0; n < years; n++) {
  const r = JSON.parse(rt.get(aYear));
  console.log(
    `y${r.year} ppl${r.people} fauna${r.herbivores}/${r.predators} water ${r.total} (land ${r.land} lake ${r.lake} spare ${r.spare} air ${r.air} bodies ${r.bodies} places ${r.places} pool ${r.pool}) tiles${r.landTiles}/${r.lakeTiles} moist${r.moist} dry${r.dry} plants${r.plants} temp${r.temp} fert${r.fert} gates${JSON.stringify(r.gates)} energyTile${r.energyTile} organic${r.organic} gas${r.gas} nutrient${r.nutrient} nutrientBodies${r.nutrientBodies} waste${r.waste} oxidant${r.oxidant} air${JSON.stringify(r.airBy)} eaten${JSON.stringify(r.eaten)} ran${JSON.stringify(r.ran)} irrigated${r.irrigated} weather${JSON.stringify(r.weather)}${r.audit ? " AUDIT" + r.audit : ""}`,
  );
}
