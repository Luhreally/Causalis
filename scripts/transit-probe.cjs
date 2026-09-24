// What the effort delivers to the home world during the transit press.
//
// The player lives inside presses, and behind the ship the press runs to the
// colony's arrival. This loads the battery launch fixture, presses to the
// ship, and then steps the transit press a year at a time, recording what the
// concerted effort did in each year — the objectives it pushed, the bread it
// carried and to whom, the field sites it supplied — against every town's
// people, farms (finished and unfinished, with what the unfinished one wants),
// fields by stage, larder, hungry share and store, and the world's births and
// deaths. The muck carted and the courtships are read too.
//
// The world is a fixture (a .json.gz save) or a seed spec "seed:size:complexity"
// generated fresh and run to year thirty as the arc probe does.
//
// OFF=field,draw,cradle,match,roomhunger,reach2,reunite,quota,sky,breath,turn,unload
// switches a lever off for an A/B: the waiting field and hungry hands (137),
// the reach-wide daily draw (133), the courtship and room behind the ship
// (132), the town matching its courted singles, the room judged by the hungry
// share alone, the night rule reaching the whole town, the couple keeping one
// home, the daily meal quota (133), and the strained sky's forced droughts
// and heat waves (91), the breathing sky (17), the press turning to the next
// craft (131), and the hoards coming home (133).
//
// Each year also reads the sky: the strain of industry and the count of
// forced spells (91), and the share of the year's ticks spent in a Drought or
// Heat Wave from any cause; and the land: mean moisture over the land tiles,
// the share of them under the 16 that photosynthesis needs, the plants
// standing on them, their water, and the water held in the air.
//
// node scripts/transit-probe.cjs <fixture.json.gz | seed:size:complexity> <years> <presses>
const fs = require("node:fs");
const zlib = require("node:zlib");
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  source = process.argv[2] || "tests/fixtures/launch-battery.json.gz",
  years = Number(process.argv[3] || 24),
  presses = Number(process.argv[4] ?? 8);
const year = rt.get("TICKS_PER_YEAR");
const off = new Set((process.env.OFF || "").split(",").filter(Boolean));
if (off.has("field"))
  rt.get("(() => { fieldSupplyAll = () => 0; fieldHandsFit = () => null; return 1; })()");
if (off.has("draw")) rt.get("(() => { hearthDraw = () => 0; return 1; })()");
if (off.has("cradle"))
  rt.get("(() => { cradleCourtship = () => 0; cradleRoom = () => null; return 1; })()");
if (off.has("match")) rt.get("(() => { cradleMatch = () => false; return 1; })()");
if (off.has("roomhunger"))
  rt.get(
    "(() => { cradleFed = (outlook, hungry) => !!outlook && outlook.larder >= 10 && hungry <= 0.25; return 1; })()",
  );
if (off.has("reach2")) rt.get("(() => { cradleNightReach = () => 8; return 1; })()");
if (off.has("reunite")) rt.get("(() => { cradleReunite = () => 0; return 1; })()");
if (off.has("quota")) rt.get("(() => { hearthMealQuotaLeft = () => 65535; return 1; })()");
if (off.has("breath")) rt.get("(() => { breatheSurfaceWater = () => 0; return 1; })()");
if (off.has("turn"))
  rt.get("(() => { causalSkipIntervene = causalSkipInterveneTransitBase; return 1; })()");
if (off.has("unload")) rt.get("(() => { hearthUnload = () => 0; return 1; })()");
// The sky's forced weather is part of the launch road, so the switch is
// gated behind the ship: before it the roll is as it was.
if (off.has("sky"))
  rt.get(
    "(() => { const b = strainedWeatherRoll; strainedWeatherRoll = (cycle) => (shipHasLeft() ? null : b(cycle)); return 1; })()",
  );
if (off.size) console.log(JSON.stringify({ off: [...off] }));
(async () => {
  if (/\.gz$/.test(source)) {
    rt.sandbox.localStorage.setItem(
      "causalis.save.launch",
      zlib.gunzipSync(fs.readFileSync(source)).toString("utf8"),
    );
    if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("launch")))
      throw new Error("fixture did not load");
  } else {
    const [seed, size = "battery", complexity = "lean"] = source.split(":");
    rt.game.createTestWorld({ seed, size, complexity });
    const tick = rt.get("simTick");
    for (let i = 0; i < year * 30; i++) tick();
    console.log(JSON.stringify({ seed, size, complexity }));
  }
  for (let press = 1; press <= presses; press++) {
    const row = JSON.parse(
      rt.get(
        `(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason, ships: (W.ascensions || []).length }); })()`,
      ),
    );
    console.log(JSON.stringify({ press, ...row }));
    if (row.ships) break;
  }
  rt.get(`(() => {
    globalThis.__log = { pushes: {}, fed: 0, farmPush: 0, supplied: {} };
    const p = causalPushToward; causalPushToward = function (target = causalTarget()) { const out = p(target); const k = target?.key || "none"; globalThis.__log.pushes[k] = (globalThis.__log.pushes[k] || 0) + 1; return out; };
    const f = modernFeedTheEffort; modernFeedTheEffort = function (pushes) { const out = f(pushes); globalThis.__log.fed += out || 0; return out; };
    const b = causalPushBuilding; causalPushBuilding = function (place, type, pushes) { const out = b(place, type, pushes); if (type === "farm" || type === "stockpile") { globalThis.__log.farmPush++; const k = (place?.name || "?").slice(0, 8) + ":" + type; globalThis.__log.supplied[k] = (globalThis.__log.supplied[k] || 0) + 1; } return out; };
    return 1; })()`);
  const aYear = `(() => {
    const state = globalThis.__state || (globalThis.__state = makeCausalSkipState());
    globalThis.__log = { pushes: {}, fed: 0, farmPush: 0, supplied: {} };
    const births0 = W.statistics.birthsByKind?.person || 0, relief0 = CONTINUING.relief || 0, muck0 = window.ALIFE_MUCK_DEBUG.counts().moved, people0 = biospherePopulation(KINDS.PERSON), stop = W.tick + ${year};
    const cradle0 = window.ALIFE_CRADLE_DEBUG.counts(), field0 = window.ALIFE_FIELD_DEBUG ? window.ALIFE_FIELD_DEBUG.counts() : null;
    let deaths = 0, dry = 0, tPrev = W.tick;
    const causes = {}, floor = W.nextEventId;
    while (W.tick < stop && !state.done) {
      causalSkipStep(state);
      const wn = W.weather?.name;
      if (wn === "Drought" || wn === "Heat Wave") dry += W.tick - tPrev;
      tPrev = W.tick;
    }
    for (const e of W.events) if (e.id >= floor && e.type === "DeathEvent" && e.data?.kind === "person") { deaths++; const k = String(e.evidence?.[0] || "?").slice(0, 18); causes[k] = (causes[k] || 0) + 1; }
    const done = state.done ? state.stopReason : null;
    if (state.done) globalThis.__state = makeCausalSkipState();
    const spName = Object.fromEntries(Object.entries(C).map(([k, v]) => [v, k]));
    const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses).map((s) => {
      const o = foodOutlook(s), farms = W.buildings.filter((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === s.id && x.type === "farm");
      const unfinished = farms.filter((x) => !x.complete).map((x) => { const m = missingBuildingMaterial(x); const hands = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && W.components.work?.[id]?.buildingId === x.id).length; return "s" + x.stage + (m ? " wants " + m.needed + " " + spName[m.sp] : " stocked") + " hands" + hands; });
      const stages = {}; for (const x of farms) if (x.complete) { const fld = cultivatedField(x); if (fld) stages[fld.stage] = (stages[fld.stage] || 0) + 1; }
      const fert = window.ALIFE_MUCK_DEBUG.fields(s.id); const avgFert = fert.length ? Math.round(fert.reduce((n, q) => n + q.fertility, 0) / fert.length) : null;
      // The forage within the town's reach: organic on the ground, in thousands.
      const reach = typeof hearthReach === "function" ? hearthReach(s) : 8; let forage = 0; for (let y = Math.max(0, s.y - reach); y <= Math.min(W.height - 1, s.y + reach); y++) for (let x = Math.max(0, s.x - reach); x <= Math.min(W.width - 1, s.x + reach); x++) if (dist2(x, y, s.x, s.y) <= reach * reach) forage += W.tiles.chem[C.ORGANIC][idx(x, y)];
      return s.name.slice(0, 8) + ":" + settlementPopulation(s) + "p/" + farms.filter((x) => x.complete).length + "f fert" + avgFert + " " + JSON.stringify(stages) + (unfinished.length ? " planned[" + unfinished.join("; ") + "]" : "") + " forage" + Math.round(forage / 1000) + "k larder" + Math.round(o.larder) + " hungry" + o.hungry.toFixed(2) + (o.famine ? "F" : o.lean ? "L" : "") + " store" + (s.inventory[C.ORGANIC] || 0) + " water" + (s.inventory[C.SOLVENT] || 0);
    });
    const townPeople = W.settlements.filter((s) => !s.ruined && s.knownProcesses).reduce((n, s) => n + settlementPopulation(s), 0);
    let landTiles = 0, landDry = 0, moistSum = 0, plants = 0, solvent = 0;
    for (let i = 0; i < W.tileCount; i++) { if (W.tiles.liquid[i] > WATER_DEPTH.SURFACE) continue; landTiles++; const m = tileMoisture(i); moistSum += m; if (m < 16) landDry++; plants += W.tiles.plantOrder[i]; solvent += W.tiles.chem[C.SOLVENT][i]; }
    const land = { moist: Math.round(moistSum / Math.max(1, landTiles)), dryShare: +(landDry / Math.max(1, landTiles)).toFixed(2), plants: Math.round(plants / 1000) + "k", water: Math.round(solvent / 1000) + "k", air: Math.round((W.reservoirs?.atmosphericSolvent || 0) / 1000) + "k" };
    const ships = (W.voyages || []).map((v) => v.status[0] + (v.status === "under way" ? Math.ceil((v.arriveTick - W.tick) / TICKS_PER_YEAR) : "")).join(",");
    const colonies = (W.colonies || []).map((c) => c.status[0] + c.population).join(",");
    const cradle1 = window.ALIFE_CRADLE_DEBUG.counts(), cradle = Object.fromEntries(Object.keys(cradle1).map((k) => [k, cradle1[k] - cradle0[k]]));
    const field1 = field0 ? window.ALIFE_FIELD_DEBUG.counts() : null, field = field1 ? Object.fromEntries(Object.keys(field1).map((k) => [k, Math.round(field1[k] - field0[k])])) : null;
    return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: done, people0, people: biospherePopulation(KINDS.PERSON), townPeople, born: (W.statistics.birthsByKind?.person || 0) - births0, deaths, causes, cradle, field, ships, colonies, relief: (CONTINUING.relief || 0) - relief0, muck: window.ALIFE_MUCK_DEBUG.counts().moved - muck0, sky: W.afternoon ? { strain: +W.afternoon.strain.toFixed(2), spells: W.afternoon.droughts } : null, dry: +(dry / ${year}).toFixed(2), land, log: globalThis.__log, target: causalTarget()?.key || null, known: window.ALIFE_CONTINUING_DEBUG ? window.ALIFE_CONTINUING_DEBUG.crafts().filter((c) => c.known).map((c) => c.id.replace("frontier_", "f_")).join(",") : "", towns });
  })()`;
  for (let n = 0; n < years; n++) {
    const r = JSON.parse(rt.get(aYear));
    console.log(
      `y${r.year} ${r.stop ? "STOP:" + r.stop : ""} ppl${r.people0}->${r.people} (towns ${r.townPeople}) born${r.born} deaths${r.deaths} ${JSON.stringify(r.causes)} cradle${JSON.stringify(r.cradle)} field${JSON.stringify(r.field)} ships[${r.ships}] colonies[${r.colonies}] relief${r.relief} muck${r.muck} sky${JSON.stringify(r.sky)} dry${r.dry} land${JSON.stringify(r.land)} fed${r.log.fed} farmPush${r.log.farmPush} target=${r.target} known[${r.known}] pushes${JSON.stringify(r.log.pushes)} supplied${JSON.stringify(r.log.supplied)}`,
    );
    for (const t of r.towns) console.log("   " + t);
    if (r.people < 6) break;
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
