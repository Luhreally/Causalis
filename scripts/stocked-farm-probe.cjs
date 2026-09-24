// Why does a stocked farm stand for twenty years with no hands?
//
// The transit probe watched Needlefort, a fed town of seven to nine on
// battery causal-origin, keep a farm at stage two — every material placed,
// no work done — from year eighty-four to a hundred and four. This generates
// the seed, presses to the ship, steps the press to the year asked for, and
// then for the named town (or the town with the oldest unfinished farm)
// reads: its open work orders and their scores for each resident, the
// unfinished buildings (stage, work, missing material), the tools for
// building at the place, and every resident's hunger, thirst, fatigue,
// distance to the site, current work task and phase, whether the labour tick
// would count them healthy, and which order they would choose. Then it steps
// sixty-four ticks and counts who touched the farm.
//
// node scripts/stocked-farm-probe.cjs <seed:size:complexity> <year> [town]
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  source = process.argv[2] || "causal-origin:battery:lean",
  target = Number(process.argv[3] || 84),
  townName = process.argv[4] || "";
const year = rt.get("TICKS_PER_YEAR");
const [seed, size = "battery", complexity = "lean"] = source.split(":");
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick");
for (let i = 0; i < year * 30; i++) tick();
for (let press = 1; press <= 40; press++) {
  const row = JSON.parse(
    rt.get(
      `(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason, ships: (W.ascensions || []).length }); })()`,
    ),
  );
  console.log(JSON.stringify({ press, ...row }));
  if (row.ships || row.year >= target) break;
}
rt.get(
  `(() => { for (let presses = 0; presses < 400 && Math.floor(W.tick / TICKS_PER_YEAR) < ${target}; presses++) { const state = makeCausalSkipState(); while (Math.floor(W.tick / TICKS_PER_YEAR) < ${target} && !state.done) causalSkipStep(state); } return 1; })()`,
);
const report = `(() => {
  const spName = Object.fromEntries(Object.entries(C).map(([k, v]) => [v, k]));
  const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses);
  let town = ${JSON.stringify(townName)} ? towns.find((s) => s.name.startsWith(${JSON.stringify(townName)})) : null;
  if (!town) {
    let oldest = Infinity;
    for (const s of towns) for (const b of W.buildings) if (!b.ruined && !b.complete && b.placeKind === "settlement" && b.placeId === s.id && b.type === "farm" && b.createdTick < oldest) { oldest = b.createdTick; town = s; }
  }
  if (!town) return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), error: "no town with an unfinished farm" });
  const unfinished = W.buildings.filter((b) => !b.ruined && !b.complete && b.placeKind === "settlement" && b.placeId === town.id).map((b) => { const m = missingBuildingMaterial(b); return { id: b.id, type: b.type, stage: b.stage, work: b.workDone + "/" + b.workRequired, age: Math.floor((W.tick - b.createdTick) / TICKS_PER_YEAR), missing: m ? m.needed + " " + spName[m.sp] : null, reachable: typeof openGroundPlotReachable === "function" ? openGroundPlotReachable(town, b.x, b.y) : null, at: [b.x, b.y], liquid: W.tiles.liquid[idx(b.x, b.y)], danger: W.tiles.danger[idx(b.x, b.y)], fire: W.tiles.fire[idx(b.x, b.y)] } });
  const orders = W.workOrders.filter((o) => o.placeKind === "settlement" && o.placeId === town.id && o.status === "open").map((o) => ({ id: o.id, type: o.type, buildingId: o.buildingId, priority: o.priority }));
  const residents = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]?.homePlaceKind === "settlement" && W.components.social[id].homePlaceId === town.id);
  const farm = unfinished.find((b) => b.type === "farm");
  const people = residents.map((id) => {
    const l = derivedLife(id), p = W.components.position[id], w = W.components.work?.[id], ti = idx(p.x, p.y);
    const healthy = l.hunger <= 68 && l.thirst <= 70 && l.fatigue <= 88 && W.tiles.fire[ti] <= 100 && W.tiles.danger[ti] <= 850;
    const place = nearestWorkPlace(id), friendly = nearestFriendlyPlace(id);
    const order = place ? selectWorkOrder(id, place) : null;
    const scores = place ? orders.map((o) => o.type + "#" + o.buildingId + ":" + Math.round(orderPriority(W.workOrders.find((x) => x.id === o.id), place, id))).join(" ") : "";
    return [id, "h" + Math.round(l.hunger) + " t" + Math.round(l.thirst) + " f" + Math.round(l.fatigue), healthy ? "healthy" : "unfit", "age" + Math.round(l.age), "d" + (farm ? Math.round(Math.sqrt(dist2(p.x, p.y, farm.at[0], farm.at[1]))) : "-"), "workPlace=" + (place ? place.name.slice(0, 8) : "none") + " friendly=" + (friendly ? friendly.name.slice(0, 8) : "none"), "task=" + (w ? w.task + " b" + w.buildingId + " handled" + (W.tick - (w.handledTick || 0)) : "-"), "phase=" + String(w?.phase || "").slice(0, 50), "choose=" + (order ? order.type + "#" + order.buildingId : "none"), scores, W.components.campaign?.[id] ? "CAMPAIGN" : "", facilityAssignment(id) ? "FACILITY" : ""].join(" | ");
  });
  const tools = functionalToolsAtPlace(town, "build").length;
  const needs = placeNeedsLabor(town), concerted = concertedIntensity();
  // Sixty-four ticks on: who touched the farm?
  const touched = {};
  const sw = setWorkAction; setWorkAction = function (id, task, phase, tile, mat, bId, tool) { if (farm && bId === farm.id) touched[id] = (touched[id] || 0) + 1; return sw(id, task, phase, tile, mat, bId, tool); };
  const mw = moveWorkerToward; moveWorkerToward = function (id, tile, task, phase, mat, bId, tool) { if (farm && bId === farm.id) touched[id] = (touched[id] || 0) + 1; return mw(id, tile, task, phase, mat, bId, tool); };
  const work0 = farm ? W.buildings.find((b) => b.id === farm.id).workDone : 0;
  for (let i = 0; i < 64; i++) simTick();
  setWorkAction = sw; moveWorkerToward = mw;
  const work1 = farm ? W.buildings.find((b) => b.id === farm.id).workDone : 0;
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), town: town.name, pop: settlementPopulation(town), at: [town.x, town.y], outlook: (({ larder, hungry, lean, famine }) => ({ larder: Math.round(larder), hungry: +hungry.toFixed(2), lean, famine }))(foodOutlook(town)), needsLabor: needs, concerted, buildTools: tools, unfinished, orders, people, touched, farmWork: work0 + "->" + work1 });
})()`;
const r = JSON.parse(rt.get(report));
console.log(
  JSON.stringify({
    year: r.year,
    town: r.town,
    pop: r.pop,
    at: r.at,
    outlook: r.outlook,
    needsLabor: r.needsLabor,
    concerted: r.concerted,
    buildTools: r.buildTools,
    farmWork: r.farmWork,
    touched: r.touched,
    error: r.error,
  }),
);
console.log("unfinished:");
for (const b of r.unfinished || []) console.log("   " + JSON.stringify(b));
console.log("orders:");
for (const o of r.orders || []) console.log("   " + JSON.stringify(o));
console.log("people:");
for (const p of r.people || []) console.log("   " + p);
