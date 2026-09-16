// Which plan holds a town's hands.
//
// Phone variety-2's observatory stood at its second stage, stocked, with no
// hands from year 80 to 110 while the town had fifty to sixty people and its
// farm had four. Every worker of a town takes the one open work order that
// scores highest for it (30c, selectWorkOrder), and a worker who cannot source
// the order's want did stockpile labour instead of taking the next order, so
// one plan wanting a rare material held every hand. This presses a world to a
// year and reads, for the named place (the launch site by default), every
// open order with its score for a sample of the town's workers, what each
// order still wants and whether that want is in the worker's hands, the store
// or the ground within reach, whether the order is set aside, how many hands
// each building has, and which order each sampled worker would take.
//
// node scripts/order-probe.cjs <seed:size:complexity> <year> [placeName]
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime();
const [seed = "variety-2", size = "phone", complexity = "lean"] = (process.argv[2] || "variety-2:phone:lean").split(":");
const target = Number(process.argv[3] || 95), placeName = process.argv[4] || "";
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"), year = rt.get("TICKS_PER_YEAR");
for (let i = 0; i < year * 30; i++) tick();
console.log(JSON.stringify({ seed, size, complexity, target, placeName }));
rt.get(`(() => { for (let p = 0; p < 400 && Math.floor(W.tick / TICKS_PER_YEAR) < ${target}; p++) { const state = makeCausalSkipState(); while (Math.floor(W.tick / TICKS_PER_YEAR) < ${target} && !state.done) causalSkipStep(state); } return 1; })()`);
console.log(rt.get(`(() => {
  const spName = (sp) => W.definitions.species[sp]?.name || ("sp" + sp);
  const wanted = ${JSON.stringify(placeName)};
  const place = (wanted ? W.settlements.find((s) => !s.ruined && s.name.startsWith(wanted)) : null) || modernLaunchSite() || W.settlements.find((s) => !s.ruined && s.knownProcesses);
  if (!place) return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), place: null });
  const kind = place.knownProcesses ? "settlement" : "camp";
  const workers = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]?.homePlaceId === place.id && W.components.position[id]).slice(0, 6);
  const hands = {}; for (const id of W.activeIds) { const w = W.components.work?.[id]; if (w?.buildingId) hands[w.buildingId] = (hands[w.buildingId] || 0) + 1; }
  const orders = W.workOrders.filter((o) => o.placeKind === kind && o.placeId === place.id && o.status === "open").map((o) => {
    const b = W.buildings.find((x) => x.id === o.buildingId), m = b ? missingBuildingMaterial(b) : null, worker = workers[0];
    const sourced = m && worker ? { inHand: W.components.inventory[worker]?.materials?.[m.sp] || 0, inStore: place.inventory[m.sp] || 0, storeDrawn: STORE_DRAWN_MATERIALS.includes(m.sp), ground: findResourceTile(worker, m.sp) >= 0 ? "found" : "none" } : null;
    // The hands on this plan: what each is doing, how far from the face it stands, and whether its way there is blocked.
    const crew = b ? W.activeIds.filter((id) => W.components.work?.[id]?.buildingId === b.id && classifyAlive(id)).slice(0, 8).map((id) => { const w = W.components.work[id], p = W.components.position[id]; return { id, task: w.task, phase: String(w.phase || "").slice(0, 60), dist: p ? Math.round(Math.sqrt(dist2(p.x, p.y, b.x, b.y)) * 10) / 10 : null, stuck: w.travelStuckTicks || 0, blockedFace: w.blockedTargetTile === idx(b.x, b.y) && W.tick < (w.blockedUntil || 0) }; }) : [];
    const plot = b ? { x: b.x, y: b.y, fromHall: Math.round(Math.sqrt(dist2(place.x, place.y, b.x, b.y)) * 10) / 10, work: b.workDone + "/" + b.workRequired, reachable: typeof openGroundPlotReachable === "function" ? openGroundPlotReachable(place, b.x, b.y) : null, planned: Math.floor((b.createdTick || 0) / TICKS_PER_YEAR) } : null;
    return { order: o.id, type: b?.type, stage: b?.stage, priority: o.priority, setAside: o.blockedUntil > W.tick ? Math.ceil((o.blockedUntil - W.tick) / TICKS_PER_YEAR * 10) / 10 + "y" : "", hands: hands[o.buildingId] || 0, wants: m ? m.needed + " " + spName(m.sp) : "stocked", sourced, plot, crew, scores: workers.map((id) => +orderPriority(o, place, id).toFixed(1)) };
  }).sort((a, b) => (b.scores[0] || 0) - (a.scores[0] || 0));
  const picks = workers.map((id) => { const o = selectWorkOrder(id, place); const w = W.components.work?.[id]; return { id, order: o?.id || null, type: o ? W.buildings.find((x) => x.id === o.buildingId)?.type : null, task: w?.task, building: w?.buildingId || 0 }; });
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), place: place.name, pop: settlementPopulation(place), workers: workers.length, blockedSoFar: typeof LABOR_BLOCKED !== "undefined" ? LABOR_BLOCKED.count : null, orders, picks }, null, 0);
})()`));
