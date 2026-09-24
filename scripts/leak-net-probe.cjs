// Which entity's matter changed by an amount its tile did not?
//
// Reactions inside an entity change its species but not its total units, so
// an entity's total moves only by exchange with the ground, a store, or
// another entity. At every tick the audit moves, this lists the entities whose
// total moved, with what they were doing and their tier's stride, against the
// total change of the tile under them and its neighbours — the one whose gain
// no tile paid for is the leak.
//
// node scripts/leak-net-probe.cjs <seed> <size> <complexity> <watchFrom>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "variety-8",
  size = process.argv[3] || "phone",
  complexity = process.argv[4] || "lean",
  watchFrom = Number(process.argv[5] || 10);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, watchFrom }));
for (let i = 0; i < year * 30; i++) tick();
const coarse = `(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason, delta: auditMatter().delta }); })()`;
for (let press = 1; press < watchFrom; press++) {
  const row = JSON.parse(rt.get(coarse));
  console.log(JSON.stringify({ press, ...row }));
  if (row.delta !== 0) {
    console.log("drifted before the watched press");
    process.exit(0);
  }
}
const fine = `(() => {
  const entTotal = () => { const m = new Map(); for (const id of W.activeIds) { const q = W.components.chemistry[id]?.q, inv = W.components.inventory[id]; if (!q) continue; let n = 0; for (let s = 0; s < SPECIES_COUNT; s++) n += (q[s] || 0) + (inv?.materials?.[s] || 0) + (inv?.digestive?.[s] || 0); m.set(id, n); } return m; };
  const tileTotal = () => { const t = new Float64Array(W.tileCount); for (let s = 0; s < COMMON_CHEM; s++) { const q = W.tiles.chem[s]; for (let i = 0; i < q.length; i++) t[i] += q[i]; } for (const [k, v] of Object.entries(W.tiles.rareChem)) t[Number(k.slice(0, k.lastIndexOf(":")))] += v; return t; };
  const placeTotal = () => { const m = new Map(); for (const s of W.settlements) { let n = 0; for (let k = 0; k < SPECIES_COUNT; k++) n += (s.inventory[k] || 0) + (s.structure?.composition?.[k] || 0) + (s.researchInventory?.[k] || 0); m.set("town:" + s.name, n); } for (const c of W.camps) if (c.active) { let n = 0; for (let k = 0; k < SPECIES_COUNT; k++) n += (c.inventory[k] || 0) + (c.structure?.composition?.[k] || 0); m.set("camp:" + c.name, n); } for (const b of W.buildings || []) { let n = 0; for (let k = 0; k < SPECIES_COUNT; k++) n += b.composition?.[k] || 0; m.set("bld:" + b.type + "#" + b.id, n); } let res = 0; for (const v of Object.values(W.reservoirs || {})) { if (typeof v === "number") res += v; else if (v && v.length) for (const x of v) res += x; } m.set("reservoirs", res); let coh = 0; for (const c of W.cohorts) for (const v of c.chemistryTotals || []) coh += v; m.set("cohorts", coh); let rd = 0; if (W?.roads?.matter) for (const v of W.roads.matter) rd += v; m.set("roads", rd); return m; };
  const state = makeCausalSkipState();
  let last = auditMatter().delta;
  const found = [];
  for (let i = 0; i < state.limit && !state.done && found.length < 5; i++) {
    const e0 = entTotal(), t0 = tileTotal(), p0 = placeTotal(), pos0 = new Map();
    for (const id of e0.keys()) { const p = W.components.position[id]; if (p) pos0.set(id, idx(p.x, p.y)); }
    causalSkipStep(state);
    const d = auditMatter().delta;
    if (d === last) continue;
    const e1 = entTotal(), t1 = tileTotal(), p1 = placeTotal();
    const ents = [];
    let entSum = 0, tileSum = 0, placeSum = 0;
    for (let i2 = 0; i2 < W.tileCount; i2++) tileSum += t1[i2] - t0[i2];
    for (const [k, v] of p1) placeSum += v - (p0.get(k) || 0);
    for (const [k, v] of p0) if (!p1.has(k)) placeSum -= v;
    for (const [id, n] of e1) { const was = e0.get(id); if (was === undefined) { ents.push({ id, born: true, net: n }); entSum += n; continue; } if (n !== was) { entSum += n - was; const l = W.components.life[id], w = W.components.work?.[id], p = W.components.position[id], t = pos0.get(id); let near = 0; if (t != null) { const [x, y] = xy(t); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(x + dx, y + dy)) near += t1[idx(x + dx, y + dy)] - t0[idx(x + dx, y + dy)]; } ents.push({ id, kind: W.kind[id], net: n - was, tier: typeof classifyTier === "function" ? classifyTier(id) : "?", at: p ? p.x + "," + p.y : "-", tileNear: near, task: w?.task || l?.behavior || "-", why: String(l?.behaviorReason || "").slice(0, 50) }); } }
    for (const [id, was] of e0) if (!e1.has(id)) { ents.push({ id, gone: true, net: -was }); entSum -= was; }
    ents.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
    const placesMoved = []; for (const [k, v] of p1) { const was = p0.get(k) || 0; if (v !== was) placesMoved.push(k + ":" + (v - was)); }
    found.push({ tick: W.tick, change: d - last, entSum, tileSum, placeSum, ents: ents.slice(0, 24), placesMoved: placesMoved.slice(0, 12) });
    last = d;
  }
  return JSON.stringify(found);
})()`;
const rows = JSON.parse(rt.get(fine));
for (const r of rows) {
  console.log(
    `tick ${r.tick} change ${r.change} entities ${r.entSum} tiles ${r.tileSum} places ${r.placeSum} sum ${r.entSum + r.tileSum + r.placeSum} placesMoved ${JSON.stringify(r.placesMoved)}`,
  );
  for (const e of r.ents) console.log(`   ${JSON.stringify(e)}`);
}
