// What the gated levers actually do behind the ship.
//
// Loads the battery launch fixture, presses to the ship, and then, a year at
// a time, reports what the sections gated on the ship have done — the muck
// carted, the courtships and widowings, the room passes — against every
// town's people, farms, field fertility, larder, hungry share and store, and
// the world's births, so a lever that is switched on but moving nothing is
// told from one that moves and does not help.
//
// node scripts/postship-probe.cjs <fixture.json.gz> <years> <presses>
const fs = require("node:fs");
const zlib = require("node:zlib");
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  source = process.argv[2] || "tests/fixtures/launch-battery.json.gz",
  years = Number(process.argv[3] || 8),
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
        `(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason, ships: (W.ascensions || []).length, shipHasLeft: shipHasLeft() }); })()`,
      ),
    );
    console.log(JSON.stringify({ press, ...row }));
    if (row.ships) break;
  }
  const sample = `(() => {
    const births0 = W.statistics.birthsByKind?.person || 0, muck0 = window.ALIFE_MUCK_DEBUG.counts().moved, court0 = window.ALIFE_CRADLE_DEBUG.counts().courted, room0 = window.ALIFE_CRADLE_DEBUG.counts().roomPasses;
    for (let i = 0; i < ${year}; i++) simTick();
    const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses).map((s) => {
      const o = foodOutlook(s), fields = window.ALIFE_MUCK_DEBUG.fields(s.id), fert = fields.length ? +(fields.reduce((n, f) => n + f.fertility, 0) / fields.length).toFixed(1) : null;
      return s.name.slice(0, 8) + ":" + settlementPopulation(s) + "p/" + completedBuildings(s, "farm").length + "f fert" + fert + " larder" + Math.round(o.larder) + " hungry" + o.hungry.toFixed(2) + (o.famine ? "F" : o.lean ? "L" : "") + " store" + (s.inventory[C.ORGANIC] || 0) + " residents" + granaryResidents(s).length + " reach" + hearthReach(s);
    });
    return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), people: biospherePopulation(KINDS.PERSON), born: (W.statistics.birthsByKind?.person || 0) - births0, muck: window.ALIFE_MUCK_DEBUG.counts().moved - muck0, courted: window.ALIFE_CRADLE_DEBUG.counts().courted - court0, roomPasses: window.ALIFE_CRADLE_DEBUG.counts().roomPasses - room0, widowed: window.ALIFE_CRADLE_DEBUG.counts().widowed, relief: CONTINUING.relief || 0, towns });
  })()`;
  for (let n = 0; n < years; n++) {
    const r = JSON.parse(rt.get(sample));
    console.log(
      `y${r.year} ppl${r.people} born${r.born} muck${r.muck} courted${r.courted} roomPasses${r.roomPasses} widowed${r.widowed} relief${r.relief}`,
    );
    for (const t of r.towns) console.log("   " + t);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
