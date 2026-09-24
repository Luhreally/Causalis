// Why does a town starve beside a full store?
//
// On the post-ship battery fixture, Stonespire's store filled to two hundred
// and forty-nine and stayed there while two in three of its people went
// hungry. Rations go to the granary's residents — people within seven tiles
// of the hall whose home is the town — so this reads, a year at a time, where
// the town's people actually are: their distance from the hall, whether the
// granary counts them, their home, their hunger, what they are doing and
// whether they are indoors, alongside the store.
//
// node scripts/rations-probe.cjs <fixture.json.gz|seed> <town prefix> <years> <presses>
const fs = require("node:fs");
const zlib = require("node:zlib");
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  source = process.argv[2] || "tests/fixtures/launch-battery.json.gz",
  wanted = process.argv[3] || "",
  years = Number(process.argv[4] || 4),
  presses = Number(process.argv[5] ?? 2);
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
    const town = W.settlements.filter((s) => !s.ruined && s.knownProcesses && (!${JSON.stringify(wanted)} || s.name.startsWith(${JSON.stringify(wanted)})))
      .sort((a, b) => settlementPopulation(b) - settlementPopulation(a))[0];
    if (!town) return JSON.stringify({ gone: true });
    const rows = [], hall = idx(town.x, town.y), residents = new Set(granaryResidents(town));
    // Everyone the town counts as its population, and everyone whose home it is.
    const members = new Set();
    for (const id of W.activeIds) {
      if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
      const soc = W.components.social[id], p = W.components.position[id];
      if (!p) continue;
      const near = nearestSettlement(idx(p.x, p.y), 8);
      if (soc?.homePlaceId === town.id || near?.id === town.id) members.add(id);
    }
    const dist = [0, 0, 0, 0, 0], hungerByDist = [[], [], [], [], []];
    let home = 0, elsewhere = 0, noHome = 0, resident = 0, indoors = 0;
    const tasks = {};
    for (const id of members) {
      const soc = W.components.social[id], p = W.components.position[id], l = W.components.life[id];
      const d = Math.sqrt(dist2(p.x, p.y, town.x, town.y)), bucket = d <= 3 ? 0 : d <= 7 ? 1 : d <= 12 ? 2 : d <= 20 ? 3 : 4;
      dist[bucket]++; hungerByDist[bucket].push(Math.round(l.hunger));
      if (soc?.homePlaceKind === "settlement" && soc.homePlaceId === town.id) home++; else if (soc?.homePlaceId) elsewhere++; else noHome++;
      if (residents.has(id)) resident++;
      if (l.insideBuildingId) indoors++;
      const t = W.components.work?.[id]?.task || "idle"; tasks[t] = (tasks[t] || 0) + 1;
    }
    const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : "-");
    return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), town: town.name, pop: settlementPopulation(town), members: members.size, home, elsewhere, noHome, resident, indoors,
      store: town.inventory[C.ORGANIC] || 0, energy: town.inventory[C.ENERGY] || 0, night: typeof nightAt === "function" ? nightAt(town.x, town.y) : null,
      dist, hunger: hungerByDist.map(avg), tasks, outlook: (() => { const o = foodOutlook(town); return o ? { food: Math.round(o.food), larder: Math.round(o.larder), hungry: +o.hungry.toFixed(2), lean: o.lean, famine: o.famine } : null; })() });
  })()`;
  for (let n = 0; n < years * 4; n++) {
    for (let i = 0; i < year / 4; i++) rt.get("simTick()");
    const r = JSON.parse(rt.get(sample));
    if (r.gone) {
      console.log("town gone");
      break;
    }
    console.log(
      `y${r.year} q${n % 4} ${r.town.slice(0, 10)} pop${r.pop} members${r.members} home${r.home} elsewhere${r.elsewhere} noHome${r.noHome} resident${r.resident} indoors${r.indoors} night${r.night ? 1 : 0} store${r.store} energy${r.energy} | by distance [<=3,<=7,<=12,<=20,far] n=${JSON.stringify(r.dist)} hunger=${JSON.stringify(r.hunger)} | outlook ${JSON.stringify(r.outlook)} | tasks ${JSON.stringify(r.tasks)}`,
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
