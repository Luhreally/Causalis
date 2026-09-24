// Who keeps moving into the hub?
//
// Behind the ship Zephyrford grew from thirty-one to forty-five people in
// eight years with two children born, on six fields that fed fifteen. This
// watches, a year at a time, every change of home among the living — from
// which town to which — and which mechanism made it: the urban pull's civil
// order, the granary's migration of households, the harvest section's
// adoption of the homeless, a settler party, or something else.
//
// node scripts/inflow-probe.cjs <fixture.json.gz|seed> <years> <presses>
const fs = require("node:fs");
const zlib = require("node:zlib");
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  source = process.argv[2] || "tests/fixtures/launch-battery.json.gz",
  years = Number(process.argv[3] || 6),
  presses = Number(process.argv[4] ?? 2);
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
  rt.get(`(() => {
    globalThis.__moves = {};
    const tally = (k) => { globalThis.__moves[k] = (globalThis.__moves[k] || 0) + 1; };
    if (typeof adoptInto === "function") { const b = adoptInto; adoptInto = function (id, soc, kind, place) { tally("adopt:" + (place?.name || "?").slice(0, 8)); return b(id, soc, kind, place); }; }
    if (typeof settleMigrant === "function") { const b = settleMigrant; settleMigrant = function (id, order) { tally("migrate:" + (W.settlements.find((s) => s.id === order?.placeId)?.name || "?").slice(0, 8)); return b(id, order); }; }
    if (typeof issueCivilOrder === "function") { const b = issueCivilOrder; issueCivilOrder = function (id, kind, x, y, extra) { if (kind === "migrate") tally("order-migrate:" + (W.settlements.find((s) => s.id === extra?.placeId)?.name || "?").slice(0, 8)); if (kind === "settle" || kind === "found") tally("order-" + kind); return b(id, kind, x, y, extra); }; }
    return 1; })()`);
  const snapshot = () =>
    JSON.parse(
      rt.get(
        `JSON.stringify(Object.fromEntries(W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id)).map((id) => [id, W.components.social[id]?.homePlaceId || 0])))`,
      ),
    );
  const names = JSON.parse(
    rt.get(
      `JSON.stringify(Object.fromEntries(W.settlements.map((s) => [s.id, s.name.slice(0, 8)])))`,
    ),
  );
  let before = snapshot();
  for (let n = 0; n < years; n++) {
    rt.get(
      `(() => { globalThis.__moves = {}; for (let i = 0; i < ${year}; i++) simTick(); return 1; })()`,
    );
    const after = snapshot(),
      changes = {},
      births = [];
    for (const [id, home] of Object.entries(after)) {
      if (!(id in before)) {
        births.push(names[home] || home);
        continue;
      }
      if (before[id] !== home) {
        const k =
          (names[before[id]] || before[id] || "none") + "->" + (names[home] || home || "none");
        changes[k] = (changes[k] || 0) + 1;
      }
    }
    const moves = JSON.parse(rt.get("JSON.stringify(globalThis.__moves)"));
    const pops = JSON.parse(
      rt.get(
        `JSON.stringify(W.settlements.filter((s) => !s.ruined && s.knownProcesses).map((s) => s.name.slice(0, 8) + ":" + settlementPopulation(s)))`,
      ),
    );
    console.log(
      `y${JSON.parse(rt.get("Math.floor(W.tick / TICKS_PER_YEAR)"))} pops ${pops.join(" ")}\n     home changes ${JSON.stringify(changes)} newcomers ${JSON.stringify(births)}\n     mechanisms ${JSON.stringify(moves)}`,
    );
    before = after;
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
