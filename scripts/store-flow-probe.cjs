// Where does a famine town's food go?
//
// The ration-why probe found the meal failing on an empty store thousands of
// times a year in towns whose store read three hundred at the year's end. This
// steps the transit press and, for every town, books the year's flows: bread
// carried in by the effort, crop harvested in, seed sown out, meals eaten out
// (at home and as conserved rations), organic placed into unfinished buildings
// (the skyline drawing on the granary), relief sent to other towns — against
// the store's level sampled every thirty-two ticks (lowest, median, highest,
// and the share of samples at nought).
//
// node scripts/store-flow-probe.cjs <fixture.json.gz> <years> <presses>
const fs = require("node:fs");
const zlib = require("node:zlib");
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  source = process.argv[2] || "tests/fixtures/launch-battery.json.gz",
  years = Number(process.argv[3] || 3),
  presses = Number(process.argv[4] ?? 8);
const year = rt.get("TICKS_PER_YEAR");
(async () => {
  rt.sandbox.localStorage.setItem(
    "causalis.save.launch",
    zlib.gunzipSync(fs.readFileSync(source)).toString("utf8"),
  );
  if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("launch")))
    throw new Error("fixture did not load");
  for (let press = 1; press <= presses; press++) {
    const row = JSON.parse(
      rt.get(
        `(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason, ships: (W.ascensions || []).length }); })()`,
      ),
    );
    console.log(JSON.stringify({ press, ...row }));
    if (row.ships) break;
  }
  const aYear = `(() => {
    const state = globalThis.__state || (globalThis.__state = makeCausalSkipState());
    const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses);
    const book = Object.fromEntries(towns.map((s) => [s.id, { name: s.name.slice(0, 8), samples: [], meals: 0, mealUnits: 0, sown: 0, built: 0, harvest: 0, bread: 0, reliefOut: 0, withdrawn: 0 }]));
    const compBefore = new Map();
    for (const b of W.buildings) if (!b.complete && !b.ruined && b.placeKind === "settlement") compBefore.set(b.id, b.composition[C.ORGANIC] || 0);
    const storeBefore = Object.fromEntries(towns.map((s) => [s.id, s.inventory[C.ORGANIC] || 0]));
    const relief0 = CONTINUING.relief || 0, floor = W.nextEventId, stop = W.tick + ${year};
    // Meals: the store's organic falls while a person's digestive rises, through performFeeding.
    const f = performFeeding; performFeeding = function (id, tile, stride = 1) {
      const soc = W.components.social[id], home = soc?.homePlaceKind === "settlement" ? book[soc.homePlaceId] : null;
      const near = nearestFriendlyPlace(id), nb = near?.knownProcesses ? book[near.id] : null;
      const s1 = home ? W.settlements.find((s) => s.id === soc.homePlaceId) : null, s2 = nb ? near : null;
      const a = s1 ? s1.inventory[C.ORGANIC] : 0, b = s2 ? s2.inventory[C.ORGANIC] : 0;
      const out = f(id, tile, stride);
      if (s1 && s1.inventory[C.ORGANIC] < a) { home.meals++; home.mealUnits += a - s1.inventory[C.ORGANIC]; }
      else if (s2 && s2.inventory[C.ORGANIC] < b) { nb.meals++; nb.mealUnits += b - s2.inventory[C.ORGANIC]; }
      return out;
    };
    const so = sowCultivatedField; sowCultivatedField = function (worker, field, place) { const a = place?.inventory?.[C.ORGANIC] || 0; const out = so(worker, field, place); if (out && place && book[place.id]) book[place.id].sown += Math.max(0, a - (place.inventory[C.ORGANIC] || 0)); return out; };
    while (W.tick < stop && !state.done) {
      causalSkipStep(state);
      if (W.tick % 32 === 0) for (const s of towns) book[s.id].samples.push(s.inventory[C.ORGANIC] || 0);
    }
    performFeeding = f; sowCultivatedField = so;
    if (state.done) globalThis.__state = makeCausalSkipState();
    for (const e of W.events) {
      if (e.id < floor) continue;
      if (e.type === "CropHarvestedEvent") { const bld = W.buildings.find((x) => x.id === e.data?.buildingId); if (bld && book[bld.placeId]) book[bld.placeId].harvest += e.magnitude || 0; }
      if (e.type === "ReliefEvent") { const from = towns.find((s) => s.name === e.data?.from); if (from && book[from.id]) book[from.id].reliefOut += e.data?.amount || 0; }
    }
    for (const b of W.buildings) if (b.placeKind === "settlement" && book[b.placeId] && compBefore.has(b.id)) book[b.placeId].built += Math.max(0, (b.composition[C.ORGANIC] || 0) - compBefore.get(b.id));
    for (const b of W.buildings) if (b.placeKind === "settlement" && book[b.placeId] && !compBefore.has(b.id) && !b.ruined) book[b.placeId].built += b.composition?.[C.ORGANIC] || 0;
    const rows = towns.map((s) => { const k = book[s.id], v = k.samples.slice().sort((x, y) => x - y); return k.name + ":" + settlementPopulation(s) + "p store " + storeBefore[s.id] + "->" + (s.inventory[C.ORGANIC] || 0) + " [min" + (v[0] ?? "-") + " med" + (v[v.length >> 1] ?? "-") + " max" + (v[v.length - 1] ?? "-") + " empty" + Math.round((100 * v.filter((x) => x <= 0).length) / Math.max(1, v.length)) + "%] harvest+" + Math.round(k.harvest) + " meals-" + k.mealUnits + "(" + k.meals + ") sown-" + k.sown + " built-" + k.built + " reliefOut-" + k.reliefOut; });
    return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), relief: (CONTINUING.relief || 0) - relief0, rows });
  })()`;
  for (let n = 0; n < years; n++) {
    const r = JSON.parse(rt.get(aYear));
    console.log("y" + r.year + " bread(relief)+" + r.relief);
    for (const row of r.rows) console.log("   " + row);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
