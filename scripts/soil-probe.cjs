// Where has the soil's goodness gone?
//
// Behind the ship the fields of the old towns sit at a fertility of ten, the
// line under which nothing grows, with a third of the nutrient a fresh town's
// fields hold; the towns starve on six farms. Farming carries nutrient off the
// field into the granary and the people, and the people leave it where they
// stand — on the streets and in the blocks, not on the fields. This reads, per
// town, the ground under the fields against the ground under the town: nutrient,
// waste, ash, toxin, moisture and the fertility they make, per tile and in total.
//
// node scripts/soil-probe.cjs <fixture.json.gz|seed> <presses> <years>
const fs = require("node:fs");
const zlib = require("node:zlib");
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  source = process.argv[2] || "tests/fixtures/launch-battery.json.gz",
  presses = Number(process.argv[3] ?? 2),
  years = Number(process.argv[4] || 1);
const year = rt.get("TICKS_PER_YEAR");
(async () => {
  if (fs.existsSync(source)) {
    rt.sandbox.localStorage.setItem(
      "causalis.save.launch",
      zlib.gunzipSync(fs.readFileSync(source)).toString("utf8"),
    );
    if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("launch")))
      throw new Error("fixture did not load");
  } else {
    rt.game.createTestWorld({ seed: source, size: "battery", complexity: "lean" });
    const tick = rt.get("simTick");
    for (let i = 0; i < year * 30; i++) tick();
  }
  for (let press = 1; press <= presses; press++) rt.get("runCausalSkipForDebug()");
  const sample = `(() => {
    const rows = [];
    for (const s of W.settlements) {
      if (s.ruined || !s.knownProcesses) continue;
      const fieldTiles = new Set();
      for (const f of W.fields || []) if (f.placeKind === "settlement" && f.placeId === s.id) for (const t of f.tiles || [f.tile]) fieldTiles.add(t);
      const reach = typeof hearthReach === "function" ? hearthReach(s) : 8, r2 = reach * reach;
      const sum = () => ({ n: 0, nut: 0, waste: 0, ash: 0, toxin: 0, organic: 0, moist: 0, fert: 0 });
      const field = sum(), town = sum(), wild = sum();
      const add = (g, i) => { g.n++; g.nut += W.tiles.chem[C.NUTRIENT][i]; g.waste += W.tiles.chem[C.WASTE][i]; g.ash += W.tiles.chem[C.ASH][i]; g.toxin += W.tiles.chem[C.TOXIN][i]; g.organic += W.tiles.chem[C.ORGANIC][i]; g.moist += tileMoisture(i); g.fert += tileFertility(i); };
      for (let y = Math.max(0, s.y - reach - 6); y <= Math.min(W.height - 1, s.y + reach + 6); y++)
        for (let x = Math.max(0, s.x - reach - 6); x <= Math.min(W.width - 1, s.x + reach + 6); x++) {
          const i = idx(x, y);
          if (W.tiles.liquid[i] > WATER_DEPTH.WADE_LIMIT) continue;
          if (fieldTiles.has(i)) add(field, i);
          else if (dist2(x, y, s.x, s.y) <= r2) add(town, i);
          else add(wild, i);
        }
      const avg = (g) => g.n ? { n: g.n, nut: Math.round(g.nut / g.n), waste: Math.round(g.waste / g.n), ash: Math.round(g.ash / g.n), toxin: Math.round(g.toxin / g.n), organic: Math.round(g.organic / g.n), moist: Math.round(g.moist / g.n), fert: +(g.fert / g.n).toFixed(1), totalNut: g.nut, totalWaste: g.waste } : null;
      rows.push({ name: s.name.slice(0, 10), pop: settlementPopulation(s), farms: completedBuildings(s, "farm").length, reach, field: avg(field), town: avg(town), wild: avg(wild) });
    }
    return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), rows });
  })()`;
  for (let n = 0; n < years; n++) {
    if (n) for (let i = 0; i < year; i++) rt.get("simTick()");
    const r = JSON.parse(rt.get(sample));
    console.log("y" + r.year);
    for (const t of r.rows)
      console.log(
        `  ${t.name.padEnd(10)} pop${String(t.pop).padStart(3)} farms${t.farms} reach${t.reach}\n     fields ${JSON.stringify(t.field)}\n     town   ${JSON.stringify(t.town)}\n     wild   ${JSON.stringify(t.wild)}`,
      );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
