// Find the tick where matter conservation breaks, and say what happened in it.
//
// A full audit walks every tile and every entity, so auditing from tick zero to
// a failure at year 128 is not affordable. This runs the world coarsely, one
// audit per press, until the press before the one that drifts, then steps that
// press one tick at a time with an audit after each and reports the first
// changes together with the events that landed in the same tick.
//
// node scripts/matter-leak-probe.cjs <seed> <size> <complexity> <watchFrom> [presses]
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "ship-b",
  size = process.argv[3] || "small",
  complexity = process.argv[4] || "lean",
  watchFrom = Number(process.argv[5] || 15),
  presses = Number(process.argv[6] || watchFrom + 3);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR"),
  started = performance.now();
const at = () => +((performance.now() - started) / 60000).toFixed(2);
console.log(JSON.stringify({ seed, size, complexity, watchFrom, presses }));
for (let i = 0; i < year * 30; i++) tick();

const coarse = `(() => {
  const r = runCausalSkipForDebug();
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason,
    milestone: r.milestone?.label || "", delta: auditMatter().delta, people: modernLivingPeople() });
})()`;

for (let press = 1; press < watchFrom; press++) {
  const row = JSON.parse(rt.get(coarse));
  console.log(JSON.stringify({ press, minutes: at(), ...row }));
  if (row.delta !== 0) {
    console.log(JSON.stringify({ note: "drifted before the watched press; rerun with a lower watchFrom" }));
    process.exit(0);
  }
}

// One tick at a time, reporting every tick whose audit moves — and which part
// of the ledger moved, which names the system far faster than reading every
// handler on the tick's cadence.
const BUCKETS = `(() => {
  const b = { reservoirs: 0, tileChem: 0, tileRare: 0, entities: 0, camps: 0,
    settlements: 0, cohorts: 0, buildings: 0, research: 0, roads: 0 };
  for (const v of Object.values(W.reservoirs || {})) {
    if (typeof v === "number") b.reservoirs += v; else if (v) for (const n of v) b.reservoirs += n;
  }
  for (const q of W.tiles.chem) for (let i = 0; i < q.length; i++) b.tileChem += q[i];
  for (const v of Object.values(W.tiles.rareChem)) b.tileRare += v;
  for (const id of W.activeIds) {
    const q = W.components.chemistry[id]?.q, inv = W.components.inventory[id];
    if (q) for (const v of q) b.entities += v;
    if (inv) { for (const v of inv.materials || []) b.entities += v; for (const v of inv.digestive || []) b.entities += v; }
  }
  for (const c of W.camps) if (c.active) { for (const v of c.inventory) b.camps += v; for (const v of c.structure.composition) b.camps += v; }
  for (const s of W.settlements) { for (const v of s.inventory) b.settlements += v; for (const v of s.structure.composition) b.settlements += v; }
  for (const c of W.cohorts) for (const v of c.chemistryTotals) b.cohorts += v;
  for (const x of W.buildings || []) for (const v of x.composition || []) b.buildings += v;
  for (const place of [...(W.camps || []), ...(W.settlements || [])]) for (const v of place.researchInventory || []) b.research += v;
  if (W?.roads?.matter) for (const v of W.roads.matter) b.roads += v;
  return b;
})()`;
const fine = `(() => {
  const state = makeCausalSkipState();
  let last = auditMatter().delta;
  const found = [];
  for (let i = 0; i < state.limit && !state.done && found.length < 8; i++) {
    const firstEvent = W.nextEventId;
    const before = ${BUCKETS};
    causalSkipStep(state);
    const d = auditMatter().delta;
    if (d !== last) {
      const after = ${BUCKETS};
      const moved = {};
      for (const k of Object.keys(after)) if (after[k] !== before[k]) moved[k] = after[k] - before[k];
      found.push({
        moved,
        tick: W.tick, year: Math.floor(W.tick / TICKS_PER_YEAR), from: last, to: d, change: d - last,
        mod: { c8: W.tick % 8, c16: W.tick % 16, c32: W.tick % 32, c128: W.tick % 128, c256: W.tick % 256 },
        events: W.events.filter((e) => e.id >= firstEvent)
          .map((e) => e.type + (e.evidence?.[0] ? "[" + String(e.evidence[0]).slice(0, 44) + "]" : ""))
          .slice(0, 12),
      });
      last = d;
    }
  }
  while (!state.done) causalSkipStep(state);
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: state.stopReason,
    milestone: state.milestone?.label || "", delta: auditMatter().delta,
    people: modernLivingPeople(), found });
})()`;

for (let press = watchFrom; press <= presses; press++) {
  const report = JSON.parse(rt.get(fine));
  console.log(JSON.stringify({ press, minutes: at(), ...report }));
  if (report.found.length) break;
}
