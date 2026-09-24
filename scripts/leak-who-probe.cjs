// Who gained what nobody lost?
//
// The matter-leak probe names the tick a drift arrives in and which part of
// the ledger moved; when the tick holds no event and the moved record is a
// bare tile's, the mover has to be found by hand. This steps the watched press
// one tick at a time and, at every tick whose audit moves, ranks the entities,
// places, buildings and tiles whose stored matter changed by species, with
// what each entity was doing — so the one that gained sixteen nobody lost is
// named, with its task and its section's own words for it.
//
// node scripts/leak-who-probe.cjs <seed> <size> <complexity> <watchFrom> [presses]
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "variety-8",
  size = process.argv[3] || "phone",
  complexity = process.argv[4] || "lean",
  watchFrom = Number(process.argv[5] || 10),
  presses = Number(process.argv[6] || watchFrom + 1);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, watchFrom, presses }));
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
  const spName = (sp) => W.definitions.species[sp]?.name || ("sp" + sp);
  const snap = () => {
    const ents = new Map();
    for (const id of W.activeIds) {
      const q = W.components.chemistry[id]?.q, inv = W.components.inventory[id];
      if (!q) continue;
      const per = new Float64Array(SPECIES_COUNT);
      for (let s = 0; s < SPECIES_COUNT; s++) per[s] = (q[s] || 0) + (inv?.materials?.[s] || 0) + (inv?.digestive?.[s] || 0);
      ents.set(id, per);
    }
    const places = new Map();
    for (const s of W.settlements) { const per = new Float64Array(SPECIES_COUNT); for (let k = 0; k < SPECIES_COUNT; k++) per[k] = (s.inventory[k] || 0) + (s.structure?.composition?.[k] || 0) + (s.researchInventory?.[k] || 0); places.set("town:" + s.name, per); }
    for (const c of W.camps) if (c.active) { const per = new Float64Array(SPECIES_COUNT); for (let k = 0; k < SPECIES_COUNT; k++) per[k] = (c.inventory[k] || 0) + (c.structure?.composition?.[k] || 0) + (c.researchInventory?.[k] || 0); places.set("camp:" + c.name, per); }
    for (const b of W.buildings || []) { const per = new Float64Array(SPECIES_COUNT); for (let k = 0; k < SPECIES_COUNT; k++) per[k] = b.composition?.[k] || 0; places.set("bld:" + b.type + "#" + b.id, per); }
    const tiles = new Float64Array(SPECIES_COUNT);
    for (let s = 0; s < COMMON_CHEM; s++) { const q = W.tiles.chem[s]; let n = 0; for (let i = 0; i < q.length; i++) n += q[i]; tiles[s] = n; }
    for (const [k, v] of Object.entries(W.tiles.rareChem)) tiles[Number(k.slice(k.lastIndexOf(":") + 1))] += v;
    const reservoirs = new Float64Array(SPECIES_COUNT);
    for (const [k, v] of Object.entries(W.reservoirs || {})) { if (typeof v === "number") reservoirs[0] += v; else if (v && v.length) for (let s = 0; s < v.length && s < SPECIES_COUNT; s++) reservoirs[s] += v[s]; }
    const cohorts = new Float64Array(SPECIES_COUNT);
    for (const c of W.cohorts) for (let s = 0; s < SPECIES_COUNT; s++) cohorts[s] += c.chemistryTotals?.[s] || 0;
    const roads = new Float64Array(SPECIES_COUNT);
    if (W?.roads?.matter) for (let s = 0; s < SPECIES_COUNT && s < W.roads.matter.length; s++) roads[s] += W.roads.matter[s];
    return { ents, places, tiles, reservoirs, cohorts, roads };
  };
  const diff = (a, b) => { const out = []; for (let s = 0; s < SPECIES_COUNT; s++) if (a[s] !== b[s]) out.push(spName(s) + ":" + (b[s] - a[s])); return out; };
  const state = makeCausalSkipState();
  let last = auditMatter().delta;
  const found = [];
  for (let i = 0; i < state.limit && !state.done && found.length < 6; i++) {
    const before = snap(), firstEvent = W.nextEventId;
    causalSkipStep(state);
    const d = auditMatter().delta;
    if (d === last) continue;
    const after = snap(), row = { tick: W.tick, year: Math.floor(W.tick / TICKS_PER_YEAR), change: d - last, entities: [], places: [], tiles: diff(before.tiles, after.tiles), reservoirs: diff(before.reservoirs, after.reservoirs), cohorts: diff(before.cohorts, after.cohorts), roads: diff(before.roads, after.roads), gone: [], born: [], leaked: [], gainers: [] };
    // The species whose world total moved is the leak's species; everyone who gained it is a suspect.
    const total = (snapshot) => { const per = new Float64Array(SPECIES_COUNT); for (const [, v] of snapshot.ents) for (let s = 0; s < SPECIES_COUNT; s++) per[s] += v[s]; for (const [, v] of snapshot.places) for (let s = 0; s < SPECIES_COUNT; s++) per[s] += v[s]; for (let s = 0; s < SPECIES_COUNT; s++) per[s] += snapshot.tiles[s] + snapshot.reservoirs[s] + snapshot.cohorts[s] + snapshot.roads[s]; return per; };
    const tb = total(before), ta = total(after), leakedSpecies = [];
    for (let s = 0; s < SPECIES_COUNT; s++) if (ta[s] !== tb[s]) { row.leaked.push(spName(s) + "(" + s + "):" + (ta[s] - tb[s])); leakedSpecies.push(s); }
    for (const [id, per] of after.ents) { const was = before.ents.get(id); if (!was) continue; for (const s of leakedSpecies) if (per[s] !== was[s]) { const l = W.components.life[id], w = W.components.work?.[id], p = W.components.position[id]; row.gainers.push({ id, kind: W.kind[id], sp: spName(s), delta: per[s] - was[s], at: p ? p.x + "," + p.y : "-", task: w?.task || l?.behavior || "-", why: String(l?.behaviorReason || "").slice(0, 70), q: W.components.chemistry[id]?.q?.[s], dig: W.components.inventory[id]?.digestive?.[s], mat: W.components.inventory[id]?.materials?.[s] }); } }
    for (const [k, per] of after.places) { const was = before.places.get(k); if (!was) continue; for (const s of leakedSpecies) if (per[s] !== was[s]) row.gainers.push({ id: k, sp: spName(s), delta: per[s] - was[s] }); }
    for (const [id, per] of after.ents) {
      const was = before.ents.get(id);
      if (!was) { row.born.push(id); continue; }
      const dd = diff(was, per);
      if (dd.length) {
        const l = W.components.life[id], w = W.components.work?.[id], p = W.components.position[id];
        row.entities.push({ id, kind: W.kind[id], at: p ? p.x + "," + p.y : "-", task: w?.task || l?.behavior || "-", why: String(l?.behaviorReason || "").slice(0, 60), delta: dd });
      }
    }
    for (const [id] of before.ents) if (!after.ents.has(id)) row.gone.push(id);
    for (const [k, per] of after.places) { const was = before.places.get(k); const dd = was ? diff(was, per) : ["new"]; if (dd.length) row.places.push({ k, delta: dd }); }
    for (const [k] of before.places) if (!after.places.has(k)) row.places.push({ k, delta: ["removed"] });
    row.events = W.events.filter((e) => e.id >= firstEvent).map((e) => e.type).slice(0, 8);
    // Keep the rows short: only entities whose total moved by something other than a breath.
    row.entities = row.entities.filter((e) => e.delta.some((x) => Math.abs(Number(x.split(":")[1])) >= 4)).slice(0, 14);
    found.push(row);
    last = d;
  }
  return JSON.stringify(found);
})()`;
const rows = JSON.parse(rt.get(fine));
for (const r of rows) {
  console.log(
    `tick ${r.tick} y${r.year} change ${r.change} LEAKED ${JSON.stringify(r.leaked)} tiles ${JSON.stringify(r.tiles)} reservoirs ${JSON.stringify(r.reservoirs)} cohorts ${JSON.stringify(r.cohorts)} roads ${JSON.stringify(r.roads)} events ${JSON.stringify(r.events)} born ${JSON.stringify(r.born)} gone ${JSON.stringify(r.gone)}`,
  );
  for (const g of r.gainers) console.log(`   GAIN ${JSON.stringify(g)}`);
  for (const e of r.entities)
    console.log(
      `   ent ${e.id} kind${e.kind} @${e.at} ${e.task} "${e.why}" ${JSON.stringify(e.delta)}`,
    );
  for (const p of r.places) console.log(`   ${p.k} ${JSON.stringify(p.delta)}`);
}
