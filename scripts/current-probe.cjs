// What a second town waits for.
//
// The modern gate wants two cities and current in two towns, and the thirty-
// seed battery sweep left two worlds standing at it for sixty years: variety-9
// at year 140 with a second town of thirteen that never became a city, and
// variety-19 at 165 with a second town of twenty-four, urban, that never
// learned electricity, the press's target "cities" or "current" throughout.
// This presses a world to a year and reads, for every living town, its
// people, stage and stage shortfall, what it knows of the road to electricity
// (the craft and every prior, found from the definitions), the progress and
// threshold of each step it lacks, whether the step's facility stands, the
// research focus, the unfinished buildings with their hands, and the press's
// target with its pushes; the world's modern wants and shortfall beside them.
//
// node scripts/current-probe.cjs <seed:size:complexity> <year>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime();
const [seed = "variety-19", size = "battery", complexity = "lean"] = (
  process.argv[2] || "variety-19:battery:lean"
).split(":");
const target = Number(process.argv[3] || 130);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
for (let i = 0; i < year * 30; i++) tick();
console.log(JSON.stringify({ seed, size, complexity, target }));
rt.get(
  `(() => { for (let p = 0; p < 400 && Math.floor(W.tick / TICKS_PER_YEAR) < ${target}; p++) { const state = makeCausalSkipState(); while (Math.floor(W.tick / TICKS_PER_YEAR) < ${target} && !state.done) causalSkipStep(state); } return 1; })()`,
);
console.log(
  rt.get(`(() => {
  const spName = (sp) => W.definitions.species[sp]?.name || ("sp" + sp);
  const chain = [], seen = new Set();
  const walk = (id) => { if (seen.has(id)) return; seen.add(id); const t = technologyDefinition(id); if (!t) return; for (const p of t.prior || []) walk(p); chain.push(id); };
  walk("electricity");
  const site = modernLaunchSite();
  const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses).map((s) => {
    const lacks = chain.filter((id) => !s.knownProcesses.includes(id)).map((id) => {
      const t = technologyDefinition(id), facility = facilityForTechnology(id);
      return { id, progress: +((s.researchProgress?.[id] || 0).toFixed(1)), threshold: researchThreshold(t), priorsKnown: (t.prior || []).every((p) => s.knownProcesses.includes(p)), facility, hasFacility: facility ? placeHasFacility(s, facility) : null, materials: (t.materials || []).map((sp) => spName(sp) + ":" + (s.researchInventory?.[sp] || 0) + "/" + (s.inventory[sp] || 0)) };
    });
    const next = CIV_STAGE_ORDER[CIV_STAGE_ORDER.indexOf(s.stage) + 1] || null;
    const unfinished = W.buildings.filter((b) => !b.ruined && !b.complete && b.placeKind === "settlement" && b.placeId === s.id).map((b) => { const m = missingBuildingMaterial(b); let hands = 0; for (const id of W.activeIds) if (W.components.work?.[id]?.buildingId === b.id) hands++; return b.type + " s" + b.stage + (m ? " wants " + m.needed + " " + spName(m.sp) : " stocked") + " hands" + hands; });
    // Where a hall or a clinic the stage wants could stand: the town's own siting, and the open ground.
    const ordinal = W.buildings.filter((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === s.id).length;
    const plots = {};
    for (const type of ["hall", "clinic", "workshop", "forge"]) {
      if (completedBuildings(s, type).length) continue;
      const own = plannedBuildingTile(s, type, ordinal), open = typeof openGroundPlot === "function" ? openGroundPlot(s, type) : null;
      plots[type] = { own: own ? Math.round(Math.sqrt(dist2(s.x, s.y, own[0], own[1]))) : null, open: open ? Math.round(Math.sqrt(dist2(s.x, s.y, open[0], open[1]))) : null, backoff: Math.max(0, (s.siteBackoff?.[type] || 0) - W.tick) };
      // Why the open ground is empty: the hall's walkable flood, and what rejects each candidate ring by ring.
      if (!open && typeof openGroundReachable === "function") {
        const flood = openGroundReachable(s), footprint = buildingSpatialRadius(type), why = { flood: flood.size, tiles: 0, edge: 0, footprint: 0, terrain: 0, unreachable: 0, far: 0, ok: 0 }, reach = typeof OPEN_GROUND_WORK_REACH === "number" ? OPEN_GROUND_WORK_REACH : 26;
        for (let dy = -26; dy <= 26; dy++) for (let dx = -26; dx <= 26; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 2) continue;
          const x = s.x + dx, y = s.y + dy; why.tiles++;
          if (x < 1 || y < 1 || x >= W.width - 1 || y >= W.height - 1) { why.edge++; continue; }
          if (!developmentFootprintClear(x, y, footprint)) { why.footprint++; continue; }
          if (!buildingTerrainFootprintValid(type, x, y)) { why.terrain++; continue; }
          if (dist2(s.x, s.y, x, y) > reach * reach) { why.far++; continue; }
          if (!openGroundPlotReachable(s, x, y)) { why.unreachable++; continue; }
          why.ok++;
        }
        // What blocks the flood at the hall: the eight tiles round it.
        why.ring1 = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const x = s.x + dx, y = s.y + dy, i = idx(x, y), b = standingBuildingAtMovementTile(x, y); why.ring1.push(b ? b.type : W.tiles.liquid[i] > WATER_DEPTH.WADE_LIMIT ? "water" : (typeof cliffBetween === "function" && cliffBetween(idx(s.x, s.y), i)) ? "cliff" : "open"); }
        plots[type].why = why;
      }
    }
    return { name: s.name, site: s === site, pop: settlementPopulation(s), stage: s.stage, city: typeof cityStage === "function" ? !!cityStage(s) : null, stageShortfall: next ? settlementStageShortfall(s, next) : [], stability: +(s.stability || 0).toFixed(2), knowsOnChain: chain.filter((id) => s.knownProcesses.includes(id)), lacks, focus: s.researchFocus || null, unfinished, buildings: completedBuildings(s).length, plots };
  });
  const t = W.civilization?.concertedTarget;
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), chain, target: t ? { key: t.key, pushes: t.pushes, since: Math.floor((t.since || 0) / TICKS_PER_YEAR) } : null, shortfall: modernShortfall(), wants: { cities: modernCitiesWanted(), electric: modernElectricWanted() }, carried: typeof CAUSAL_CARRIED !== "undefined" ? CAUSAL_CARRIED.count : null, towns }, null, 0);
})()`),
);
