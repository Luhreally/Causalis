// Why does a battery-saver world raise no tower block?
//
// With every field watered and nobody hungry, causal-origin on the smallest map
// still reached year a hundred and twenty-seven with seven apartment blocks, a
// factory, and not one tower — the skyline stage asks for sixteen and pushes
// them at every city every year. And its people fell from sixty to thirty-four
// meanwhile with the dead all old. This reads both, a year at a time inside
// the skip: for each city, what it knows, what it wants, the unfinished blocks
// and what each is short of, who is working on what; and for every adult in
// the fertile window, the first clause of `canReproduce` that refuses them.
//
// node scripts/skyline-probe.cjs <seed> <size> <complexity> <quiet> <years>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "battery",
  complexity = process.argv[4] || "lean",
  quiet = Number(process.argv[5] || 10),
  years = Number(process.argv[6] || 30);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, quiet, years }));
for (let i = 0; i < year * 30; i++) tick();
for (let press = 1; press <= quiet; press++) {
  const row = JSON.parse(rt.get(`(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), people: modernLivingPeople(), stop: r.stopReason }); })()`));
  console.log(JSON.stringify({ press, ...row }));
}

// Every push the effort makes, and every delivery to a block, as they happen.
rt.get(`(() => {
  globalThis.__pushLog = []; globalThis.__supplyLog = [];
  const pushBase = causalPushToward;
  causalPushToward = function (target = causalTarget()) {
    const out = pushBase(target);
    globalThis.__pushLog.push([W.tick, target?.key || null, target?.pushes || 0, out]);
    return out;
  };
  const supplyBase = modernSupplySite;
  modernSupplySite = function (place, b, pushes) {
    const miss = missingBuildingMaterial(b), before = miss ? (b.composition[miss.sp] || 0) : null;
    const out = supplyBase(place, b, pushes);
    globalThis.__supplyLog.push([W.tick, b.type, b.id, pushes, miss ? miss.sp + ":" + miss.needed : "stocked", miss ? (b.composition[miss.sp] || 0) - before : 0]);
    return out;
  };
  return "1";
})()`);
const aYear = `(() => {
  const state = globalThis.__state || (globalThis.__state = makeCausalSkipState());
  const stop = W.tick + ${year};
  while (W.tick < stop && !state.done) causalSkipStep(state);
  const stateKeys = globalThis.__keys ? null : (globalThis.__keys = Object.keys(state));
  const stopReason = state.done ? state.stopReason : null, pending0 = state.pending?.[0]?.key || null, target = causalTarget();
  if (state.done) globalThis.__state = makeCausalSkipState();
  const pushes = globalThis.__pushLog.splice(0), supplies = globalThis.__supplyLog.splice(0);
  const spName = Object.fromEntries(Object.entries(C).map(([k, v]) => [v, k]));
  const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses)
    .sort((a, b) => settlementPopulation(b) - settlementPopulation(a)).slice(0, 3)
    .map((s) => {
      const blocks = W.buildings.filter((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === s.id && ["tower", "office", "tenement", "factory", "launch_tower"].includes(b.type))
        .map((b) => {
          const miss = b.complete ? null : missingBuildingMaterial(b),
            orders = W.workOrders.filter((o) => o.buildingId === b.id && o.status === "open"),
            hands = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && W.components.work?.[id]?.buildingId === b.id).length;
          return b.type.slice(0, 5) + ":" + (b.complete ? "done" : "s" + b.stage + (miss ? " needs " + miss.needed + " " + spName[miss.sp] : " stocked") + " pri" + (orders[0]?.priority ?? "-") + " hands" + hands);
        });
      const tasks = {};
      for (const id of granaryResidents(s)) { const t = W.components.work?.[id]?.task || "idle"; tasks[t] = (tasks[t] || 0) + 1; }
      return { name: s.name.slice(0, 10), pop: settlementPopulation(s), stage: settlementDevelopmentStage(s),
        city: typeof cityStage === "function" ? !!cityStage(s) : null,
        knows: ["electricity", "mechanization", "masonry", "computing", "road_building", "starflight"].filter((t) => s.knownProcesses.includes(t)).map((t) => t.slice(0, 4)),
        towersWanted: towersWanted(s), wantsTower: wantsTower(s), active: activeBuildings(s).length,
        stock: { stone: s.inventory[C.STONE] || 0, timber: s.inventory[C.FIBER] || 0, metal: s.inventory[C.METAL] || 0, ceramic: s.inventory[C.CERAMIC] || 0 },
        blocks, tasks };
    });
  // Who may have children, and who is refused by what.
  const why = {}, cap = sustainableSexualCapacity(KINDS.PERSON);
  let adults = 0, fertileWindow = 0, ready = 0;
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const l = derivedLife(id), r = W.components.reproduction[id], body = W.components.body[id], ch = W.components.chemistry[id];
    if (!(l && r && body && ch)) continue;
    if (l.age <= body.maturityAge) continue;
    adults++;
    if (l.age >= body.maxAge * 0.62) { why.old = (why.old || 0) + 1; continue; }
    fertileWindow++;
    const q = ch.q, reason =
      r.mode !== "paired" ? "mode" : r.cooldown > 0 ? "cooldown" : l.hunger >= CONCEPTION_HUNGER ? "hunger" :
      l.energy <= 22 ? "energy" : l.health <= 48 ? "health" : q[C.ORGANIC] <= 34 ? "organic" : q[C.NUTRIENT] <= 16 ? "nutrient" :
      q[C.SOLVENT] <= 75 ? "solvent" : q[C.INFO] <= 16 ? "info" : q[C.MEMBRANE] <= 23 ? "membrane" :
      !reproductionDensityAllows(id, KINDS.PERSON) ? "density" : !personHasSafeBirthSite(id) ? "water" : null;
    if (reason) why[reason] = (why[reason] || 0) + 1; else ready++;
  }
  const roads = (W.roads?.links || []).map((l) => l.kind + (l.complete ? " done" : l.abandoned ? " abandoned" : " " + Math.round((l.progress || 0) * 100) + "%"));
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), people: modernLivingPeople(), stateKeys,
    stage: pending0, stop: stopReason, target: target ? target.key + "#" + target.pushes : null,
    pushes: pushes.map((p) => p[1] + "#" + p[2] + "=" + p[3]).join(" "), supplies: supplies.map((x) => x[1].slice(0, 5) + x[2] + "@" + x[3] + " " + x[4] + " +" + x[5]).join(" | "), shortfall: modernShortfall().map((m) => m.slice(0, 22)),
    cap, adults, fertileWindow, ready, why, roads, towns });
})()`;

for (let n = 1; n <= years; n++) {
  const row = JSON.parse(rt.get(aYear));
  if (row.stateKeys) console.log("state keys: " + row.stateKeys.join(","));
  console.log(`y${String(row.year).padStart(4)} ppl${String(row.people).padStart(3)} cap${row.cap} adults${row.adults} window${row.fertileWindow} ready${row.ready} why${JSON.stringify(row.why)} stage=${row.stage} stop=${row.stop} target=${row.target} short=${JSON.stringify(row.shortfall)} roads=${JSON.stringify(row.roads)}`);
  console.log(`     pushes: ${row.pushes || "-"}
     supplies: ${row.supplies || "-"}`);
  for (const t of row.towns)
    console.log(`     ${t.name.padEnd(10)} p${String(t.pop).padStart(3)} ${t.stage.slice(0, 7).padEnd(7)} city${t.city ? 1 : 0} knows${JSON.stringify(t.knows)} towersWanted${t.towersWanted} wants${t.wantsTower ? 1 : 0} active${t.active} stock${JSON.stringify(t.stock)} tasks${JSON.stringify(t.tasks)}\n       blocks ${t.blocks.join(" | ") || "-"}`);
  if (row.people < 6) break;
}
