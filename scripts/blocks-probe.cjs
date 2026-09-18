// What a skyline waits for.
//
// The modern gate wants a skyline of tower blocks or offices (sixteen or so,
// swayed by the seed) and a row of apartment blocks, raised at the cities by
// the effort's push; the thirty-seed battery sweep left variety-20 at year 227
// fourteen blocks short with 64 people and variety-21 at 445 short of blocks
// and apartments with 69. This presses a world to a year and reads, for every
// living town: its people, stage, whether it is a city, the crafts a block
// wants (masonry, mechanization, electricity, computing), the blocks it has
// finished by kind, the foundry's ledger for metal, catalyst and ceramic
// (demand, stock, short, facility), where a tower, a tenement and a factory
// could stand by its own siting and on the open ground (and, where neither
// finds one, what rejects each candidate tile), and every unfinished block
// with its stage, work, want and where the want is (store, store-drawn,
// ground), its hands with their phases and distances, its order's priority,
// and its plot (distance from the hall, reachable, the year planned). The
// world's wants and counts and the press's target stand beside them.
//
// node scripts/blocks-probe.cjs <seed:size:complexity> <year>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime();
const [seed = "variety-20", size = "battery", complexity = "lean"] = (process.argv[2] || "variety-20:battery:lean").split(":");
const target = Number(process.argv[3] || 150);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"), year = rt.get("TICKS_PER_YEAR");
for (let i = 0; i < year * 30; i++) tick();
console.log(JSON.stringify({ seed, size, complexity, target }));
rt.get(`(() => { for (let p = 0; p < 400 && Math.floor(W.tick / TICKS_PER_YEAR) < ${target}; p++) { const state = makeCausalSkipState(); while (Math.floor(W.tick / TICKS_PER_YEAR) < ${target} && !state.done) causalSkipStep(state); } return 1; })()`);
console.log(rt.get(`(() => {
  const spName = (sp) => W.definitions.species[sp]?.name || ("sp" + sp);
  const BLOCKS = ["tower", "office", "tenement", "factory"];
  const site = typeof modernLaunchSite === "function" ? modernLaunchSite() : null;
  const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses).map((s) => {
    const workers = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]?.homePlaceId === s.id && W.components.position[id]).slice(0, 4);
    const unfinished = W.buildings.filter((b) => !b.ruined && !b.complete && b.placeKind === "settlement" && b.placeId === s.id).map((b) => {
      const m = missingBuildingMaterial(b), order = W.workOrders.find((o) => o.buildingId === b.id && o.status === "open");
      const crew = W.activeIds.filter((id) => W.components.work?.[id]?.buildingId === b.id && classifyAlive(id)).slice(0, 6).map((id) => { const w = W.components.work[id], p = W.components.position[id]; return { task: w.task, phase: String(w.phase || "").slice(0, 50), dist: p ? Math.round(Math.sqrt(dist2(p.x, p.y, b.x, b.y)) * 10) / 10 : null }; });
      return { type: b.type, stage: b.stage, work: b.workDone + "/" + b.workRequired, wants: m ? m.needed + " " + spName(m.sp) : "stocked", sourced: m ? { inStore: s.inventory[m.sp] || 0, storeDrawn: STORE_DRAWN_MATERIALS.includes(m.sp), ground: workers[0] ? (findResourceTile(workers[0], m.sp) >= 0 ? "found" : "none") : null } : null, hands: crew.length, crew, priority: order?.priority ?? null, setAside: !!(order && order.blockedUntil > W.tick), plot: { fromHall: Math.round(Math.sqrt(dist2(s.x, s.y, b.x, b.y)) * 10) / 10, reachable: typeof openGroundPlotReachable === "function" ? openGroundPlotReachable(s, b.x, b.y) : null, planned: Math.floor((b.createdTick || 0) / TICKS_PER_YEAR) } };
    });
    const ordinal = W.buildings.filter((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === s.id).length;
    const plots = {};
    for (const type of ["tower", "tenement", "factory"]) {
      const own = plannedBuildingTile(s, type, ordinal), open = typeof openGroundPlot === "function" ? openGroundPlot(s, type) : null;
      plots[type] = { own: own ? Math.round(Math.sqrt(dist2(s.x, s.y, own[0], own[1]))) : null, open: open ? Math.round(Math.sqrt(dist2(s.x, s.y, open[0], open[1]))) : null, backoff: Math.max(0, (s.siteBackoff?.[type] || 0) - W.tick) };
      if (!own && !open && typeof openGroundReachable === "function") {
        const flood = openGroundReachable(s), footprint = buildingSpatialRadius(type), why = { flood: flood.size, edge: 0, footprint: 0, terrain: 0, unreachable: 0, far: 0, ok: 0 }, reach = typeof OPEN_GROUND_WORK_REACH === "number" ? OPEN_GROUND_WORK_REACH : 26;
        for (let dy = -26; dy <= 26; dy++) for (let dx = -26; dx <= 26; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 2) continue;
          const x = s.x + dx, y = s.y + dy;
          if (x < 1 || y < 1 || x >= W.width - 1 || y >= W.height - 1) { why.edge++; continue; }
          if (!developmentFootprintClear(x, y, footprint)) { why.footprint++; continue; }
          if (!buildingTerrainFootprintValid(type, x, y)) {
            why.terrain++;
            // Which terrain: water, natural water, fire, or a feature by kind and strength.
            const i = idx(x, y), ft = W.tiles.featureType?.[i] || 0, fs = W.tiles.featureStrength?.[i] || 0;
            const kind = W.tiles.liquid[i] > WATER_DEPTH.SHALLOW ? "water" : (W.tiles.hydrologyBase?.[i] ?? 0) > WATER_DEPTH.SHALLOW ? "naturalWater" : W.tiles.fire[i] >= 200 ? "fire" : ft && fs >= 150 ? "feature:" + (Object.entries(TERRAIN_FEATURE).find(([, v]) => v === ft)?.[0] || ft) : "other";
            why.terrainKinds = why.terrainKinds || {}; why.terrainKinds[kind] = (why.terrainKinds[kind] || 0) + 1;
            continue;
          }
          if (dist2(s.x, s.y, x, y) > reach * reach) { why.far++; continue; }
          if (!openGroundPlotReachable(s, x, y)) { why.unreachable++; continue; }
          why.ok++;
        }
        plots[type].why = why;
      }
    }
    const foundry = typeof FOUNDRY_PRODUCTS !== "undefined" ? FOUNDRY_PRODUCTS.map((sp) => { const fac = foundryFacility(s, sp); return { species: spName(sp), demand: foundryDemand(s, sp), stock: foundryStock(s, sp), short: foundryShort(s, sp), facility: fac, hasFacility: fac ? placeHasFacility(s, fac) : null }; }) : null;
    const finished = {}; for (const t of BLOCKS) finished[t] = completedBuildings(s, t).length;
    return { name: s.name, site: s === site, pop: settlementPopulation(s), stage: s.stage, city: typeof cityStage === "function" ? !!cityStage(s) : null, stability: +(s.stability || 0).toFixed(2), crafts: ["masonry", "mechanization", "electricity", "computing"].filter((t) => s.knownProcesses.includes(t)), finished, buildings: completedBuildings(s).length, foundry, plots, unfinished };
  });
  const t = W.civilization?.concertedTarget;
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), target: t ? { key: t.key, pushes: t.pushes, since: Math.floor((t.since || 0) / TICKS_PER_YEAR) } : null, shortfall: modernShortfall(), wants: { skyline: modernSkylineWanted(), homes: modernHomesWanted(), works: modernWorksWanted(), cities: modernCitiesWanted() }, counts: { blocks: modernCount(["tower", "office"]), homes: modernCount(["tenement"]), works: modernCount(["factory"]), cities: modernCities().length }, towns }, null, 0);
})()`));
