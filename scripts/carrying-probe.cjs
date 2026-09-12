// How many mouths does a field actually feed?
//
// The granary plans one farm for every six people (`GRANARY_PEOPLE_PER_FARM`),
// and towns starve anyway: Flinthollow held twenty-eight people and seven farms
// — more than the rule asks for — with seventy-nine in a hundred hungry. Either
// the rule's six is wrong or the food never reaches the mouths, and the way to
// tell them apart is to look at every town in the world at once and ask where
// hunger actually crosses zero.
//
// This records every standing town at every press — its people, its fields, its
// stores, and how many of its residents are hungry — and buckets them by fields
// per head, so the answer is a curve rather than an anecdote. It changes
// nothing; it only reads.
//
// node scripts/carrying-probe.cjs <seed> <size> <complexity> <presses>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "small",
  complexity = process.argv[4] || "lean",
  presses = Number(process.argv[5] || 16);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, presses }));
for (let i = 0; i < year * 30; i++) tick();

const survey = `(() => {
  const rows = [];
  for (const s of W.settlements) {
    if (s.ruined) continue;
    const pop = settlementPopulation(s);
    if (pop < 4) continue;
    const farms = completedBuildings(s, "farm").length,
      residents = granaryResidents(s);
    let hungry = 0;
    for (const id of residents) {
      const l = W.components.life[id];
      if (l && l.hunger > 60) hungry++;
    }
    // What the fields around this town are actually carrying, as opposed to how
    // many farm buildings stand: a field with nothing ripe on it feeds no one.
    let ripe = 0, fields = 0;
    for (const f of W.fields || []) {
      if (f.placeId !== s.id) continue;
      fields++;
      if (f.stage === "ripe" || f.stage === "mature") ripe++;
    }
    rows.push({ pop, farms, fields, ripe,
      stored: s.inventory[C.ORGANIC] || 0,
      hungry: residents.length ? +(hungry / residents.length).toFixed(2) : 0,
      perHead: +(farms / Math.max(1, pop)).toFixed(3) });
  }
  // The big towns in their own right. The buckets say more fields do not mean
  // less hunger, which means the constraint is not how much is grown — so the
  // interesting reading is what a large town grows, stores, harvests and eats,
  // side by side, rather than an average over hamlets.
  const big = rows.filter((r) => r.pop >= 18).sort((a, b) => b.pop - a.pop).slice(0, 3);
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR),
    people: modernLivingPeople(), harvested: globalThis.__harvested || 0, big, rows });
})()`;
// What the fields actually delivered between one press and the next, read off
// the harvest events rather than inferred from the stores.
const harvestSince = `(() => {
  const from = globalThis.__eventFloor || 0;
  let moved = 0, harvests = 0;
  for (const e of W.events) {
    if (e.id < from || e.type !== "CropHarvestedEvent") continue;
    harvests++;
    const m = /^(\d+) crop matter/.exec(String(e.evidence?.[0] || ""));
    if (m) moved += Number(m[1]);
  }
  globalThis.__eventFloor = W.nextEventId;
  return JSON.stringify({ harvests, moved });
})()`;

const all = [];
rt.get(`(() => { globalThis.__eventFloor = W.nextEventId; return "1"; })()`);
for (let press = 1; press <= presses; press++) {
  rt.get(`(() => { runCausalSkipForDebug(); return "1"; })()`);
  const harvest = JSON.parse(rt.get(harvestSince));
  const row = JSON.parse(rt.get(survey));
  for (const r of row.rows) all.push({ press, year: row.year, ...r });
  console.log(
    JSON.stringify({ press, year: row.year, people: row.people, towns: row.rows.length,
      harvests: harvest.harvests, harvested: harvest.moved, big: row.big }),
  );
}

// The curve: hunger against fields per head.
const buckets = new Map();
for (const r of all) {
  const key = Math.min(10, Math.round(r.perHead * 20)); // 0.05 wide
  const b = buckets.get(key) || { n: 0, hungry: 0, pop: 0, farms: 0, stored: 0 };
  b.n++;
  b.hungry += r.hungry;
  b.pop += r.pop;
  b.farms += r.farms;
  b.stored += r.stored;
  buckets.set(key, b);
}
console.log("--- hunger against farms per head ---");
for (const key of [...buckets.keys()].sort((a, b) => a - b)) {
  const b = buckets.get(key);
  console.log(
    JSON.stringify({
      farmsPerHead: +(key / 20).toFixed(2),
      mouthsPerFarm: key ? +(20 / key).toFixed(1) : null,
      towns: b.n,
      hungry: +(b.hungry / b.n).toFixed(2),
      avgPop: Math.round(b.pop / b.n),
      avgFarms: +(b.farms / b.n).toFixed(1),
      avgStored: Math.round(b.stored / b.n),
    }),
  );
}
