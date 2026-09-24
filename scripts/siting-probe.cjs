// Why can the launch site not plan its launch tower?
//
// On causal-origin small the effort sat on Starflight from year seventy-four
// with the site's notes at eighty-five of ninety and "facility launch_tower:
// NO, site none": the push plans the facility a study wants, and the plan came
// back empty, so the town could never study the last five parts itself. This
// runs to the press and asks the siting itself: how many buildings the world
// holds against its cap, the town's outer ring and target ring, how many
// candidate tiles the townscape considered, how many each check refused, and
// what the base siting answers when the townscape gives up.
//
// node scripts/siting-probe.cjs <seed> <size> <complexity> <quiet> [type]
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "small",
  complexity = process.argv[4] || "lean",
  quiet = Number(process.argv[5] || 16),
  type = process.argv[6] || "launch_tower";
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, quiet, type }));
for (let i = 0; i < year * 30; i++) tick();
for (let press = 1; press <= quiet; press++) {
  const row = JSON.parse(
    rt.get(
      `(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), people: modernLivingPeople(), stop: r.stopReason }); })()`,
    ),
  );
  console.log(JSON.stringify({ press, ...row }));
}
console.log(
  rt.get(`(() => {
  const site = modernLaunchSite(), out = { year: Math.floor(W.tick / TICKS_PER_YEAR) };
  if (!site) return JSON.stringify({ ...out, noSite: true });
  const buildings = W.buildings.filter((b) => !b.ruined), kind = "settlement",
    mine = buildings.filter((b) => b.placeKind === kind && b.placeId === site.id),
    plan = townPlan(site), outer = townOuterRing(site, mine), zone = zoneOf(${JSON.stringify(type)}),
    target = zoneTarget(zone, site, plan, mine), footprint = buildingSpatialRadius(${JSON.stringify(type)}),
    reach = Math.min(TOWN_SEARCH, Math.ceil(target) + 5);
  let considered = 0, plaza = 0, lane = 0, offMap = 0, footprintBusy = 0, terrainBad = 0, clear = 0;
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    const x = site.x + dx, y = site.y + dy;
    if (x < 1 || y < 1 || x >= W.width - 1 || y >= W.height - 1) { offMap++; continue; }
    if (isPlazaTile(site, plan, x, y)) { plaza++; continue; }
    if (zone !== "wall" && isLaneTile(site, plan, x, y)) { lane++; continue; }
    considered++;
    const busy = !developmentFootprintClear(x, y, footprint), bad = !buildingTerrainFootprintValid(${JSON.stringify(type)}, x, y);
    if (busy) footprintBusy++;
    if (bad) terrainBad++;
    if (!busy && !bad) clear++;
  }
  const byType = {};
  for (const b of mine) byType[b.type] = (byType[b.type] || 0) + 1;
  const planned = plannedBuildingTile(site, ${JSON.stringify(type)}, mine.length);
  return JSON.stringify({ ...out, site: site.name, pop: settlementPopulation(site), at: [site.x, site.y], map: [W.width, W.height],
    worldBuildings: buildings.length, cap: 480, siteBuildings: mine.length, byType, outer, target, reach, footprint,
    tiles: { offMap, plaza, lane, considered, footprintBusy, terrainBad, clear }, planned,
    fields: (W.fields || []).filter((f) => f.placeId === site.id).length,
    standing: mine.filter((b) => b.type === ${JSON.stringify(type)}).map((b) => (b.complete ? "done" : "s" + b.stage)) }, null, 1);
})()`),
);
