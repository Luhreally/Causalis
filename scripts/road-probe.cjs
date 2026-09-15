// Why does a fed world of a hundred and twenty never finish a road?
//
// Phone ship-b sat from year 105 to 119 with every modern want met but "a
// paved road or rail between two towns". This presses until the road is the
// only shortfall (or the press budget runs out) and then reports every road
// link the world has — its two ends, polity, tiles, how many are paved, whether
// it is complete or abandoned, when it was begun — with the stone and metal in
// the stores at both ends, the crafts the polities hold, and the towns.
//
// node scripts/road-probe.cjs <seed> <size> <complexity> <presses>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "ship-b",
  size = process.argv[3] || "phone",
  complexity = process.argv[4] || "lean",
  presses = Number(process.argv[5] || 24);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, presses }));
for (let i = 0; i < year * 30; i++) tick();
const press = `(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason, people: biospherePopulation(KINDS.PERSON), ships: (W.ascensions || []).length, shortfall: modernShortfall() }); })()`;
const roads = `(() => {
  const name = (id) => W.settlements.find((s) => s.id === id)?.name || ("#" + id);
  const links = (W.roads?.links || []).map((l) => {
    const a = W.settlements.find((s) => s.id === l.a), b = W.settlements.find((s) => s.id === l.b);
    return { kind: l.kind, a: name(l.a), b: name(l.b), polity: W.factions.find((f) => f.id === l.factionId)?.name || l.factionId, tiles: l.path?.length, paved: l.paved, complete: !!l.complete, abandoned: !!l.abandoned,
      begun: Math.floor((l.startedTick || 0) / TICKS_PER_YEAR), aStock: a ? { mineral: a.inventory[C.MINERAL] || 0, metal: a.inventory[C.METAL] || 0, ruined: !!a.ruined } : null, bStock: b ? { mineral: b.inventory[C.MINERAL] || 0, metal: b.inventory[C.METAL] || 0, ruined: !!b.ruined } : null,
      wet: (l.path || []).filter((t) => W.tiles.liquid[t] > 140).length, deep: (l.path || []).filter((t) => W.tiles.liquid[t] > WATER_DEPTH.WADE_LIMIT).length };
  });
  const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses).map((s) => ({ name: s.name, pop: settlementPopulation(s), polity: W.factions.find((f) => f.id === s.factionId)?.name || s.factionId, mineral: s.inventory[C.MINERAL] || 0, metal: s.inventory[C.METAL] || 0, x: s.x, y: s.y }));
  const polities = W.factions.filter((f) => !f.dissolved).map((f) => ({ name: f.name, towns: towns.filter((t) => t.polity === f.name).length, road: typeof factionHasTech === "function" ? factionHasTech(f.id, "road_building") : null, rail: typeof factionHasTech === "function" ? factionHasTech(f.id, "railways") : null }));
  return JSON.stringify({ reach: typeof ROAD_LINK_REACH === "number" ? ROAD_LINK_REACH : null, cost: typeof ROAD_COST === "number" ? ROAD_COST : null, cadence: typeof ROAD_PASS_CADENCE === "number" ? ROAD_PASS_CADENCE : null, links, towns, polities });
})()`;
for (let n = 1; n <= presses; n++) {
  const r = JSON.parse(rt.get(press));
  console.log(JSON.stringify({ press: n, ...r }));
  if (r.ships) break;
}
const r = JSON.parse(rt.get(roads));
console.log("reach", r.reach, "cost", r.cost, "cadence", r.cadence);
for (const p of r.polities) console.log("polity", JSON.stringify(p));
for (const t of r.towns) console.log("town", JSON.stringify(t));
for (const l of r.links) console.log("link", JSON.stringify(l));
