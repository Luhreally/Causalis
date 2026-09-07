// Industry smoke: a completed rail link carries a polity's surplus between its
// towns and records the freight; a factory is planned by a town that knows
// Electricity and Mechanization, smelts stored ore into metal by the balanced
// reaction so matter is conserved, smokes when drawn, and is a milestone; an
// observatory that knows Lenses charts two stars at a look; and a craft
// practised across a completed link or an embassy is one a town may learn or
// read.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const ind = window.ALIFE_INDUSTRY_DEBUG, rd = window.ALIFE_ROADS_DEBUG, orbit = window.ALIFE_ORBIT_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const complete = (place, type) => {
    const b = planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeId === place.id && x.type === type && !x.complete);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  const know = (place, ...ts) => { for (const t of ts) if (!place.knownProcesses.includes(t)) place.knownProcesses.push(t); };
  // A second town of the same polity within road reach and by land.
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  let second = null;
  for (let tries = 0; tries < 600 && !second && people.length; tries++) {
    const x = 4 + ((tries * 37 + 11) % (W.width - 8)), y = 4 + ((tries * 23) % (W.height - 8)), t = idx(x, y), d = Math.sqrt(dist2(x, y, settlement.x, settlement.y));
    if (d < 14 || d > 44) continue;
    if (W.tiles.liquid[t] > WATER_DEPTH.SURFACE || campNear(t, 6) || nearestSettlement(t, 10)) continue;
    if (!civilReachable(idx(settlement.x, settlement.y), { x, y }, settlement.factionId)) continue;
    const founder = people.pop(), soc = W.components.social[founder];
    if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; }
    const camp = createCamp(t, founder);
    if (!camp) continue;
    for (const type of ["stockpile", "shelter", "hearth"]) complete(camp, type);
    second = createSettlement(camp.id);
  }
  if (!second) { fail("could not raise a second town within road reach"); return out; }
  second.factionId = settlement.factionId;
  for (const id of W.activeIds) { const soc = W.components.social[id]; if (soc?.homePlaceKind === "settlement" && soc.homePlaceId === second.id) soc.factionId = settlement.factionId; }
  const faction = W.factions.find((f) => f.id === settlement.factionId);
  if (!faction) { fail("no faction"); return out; }
  for (const t of [settlement, second]) { t.inventory[C.MINERAL] = Math.max(t.inventory[C.MINERAL], 400); t.inventory[C.METAL] = Math.max(t.inventory[C.METAL], 400); }
  // ── Rails carry ──
  let road = null, rail = null;
  for (let passes = 0; passes < 160 && !road?.complete; passes++) { rd.pave(faction.id, "road"); road = rd.links().find((l) => l.kind === "road" && l.factionId === faction.id) || null; }
  if (!road?.complete) { fail("no road was completed for the rail to follow"); return out; }
  for (let passes = 0; passes < 200 && !rail?.complete; passes++) { rd.pave(faction.id, "rail"); rail = rd.links().find((l) => l.kind === "rail" && l.factionId === faction.id) || null; }
  if (!rail?.complete) { fail("no rail link was completed"); return out; }
  settlement.inventory[C.ORGANIC] = Math.max(settlement.inventory[C.ORGANIC], 320);
  second.inventory[C.ORGANIC] = 0;
  // The paving stores were the fixture's; empty the second town's so the train has somewhere to unload.
  second.inventory[C.MINERAL] = 20; second.inventory[C.METAL] = 20;
  const foodBefore = second.inventory[C.ORGANIC], matterBefore = totalMatter();
  out.freight = ind.rail();
  out.secondFood = second.inventory[C.ORGANIC];
  if (!(out.freight > 0)) fail("the rail carried nothing");
  if (!(second.inventory[C.ORGANIC] > foodBefore)) fail("the hungry town received no food by rail");
  if (totalMatter() !== matterBefore) fail("rail freight created or destroyed matter");
  const record = W.exchangeRecords.at(-1);
  if (!record || record.mode !== "rail") fail("the freight was not recorded as rail: " + JSON.stringify(record));
  const freightEvent = W.events.find((e) => e.type === "RailFreightEvent");
  if (!freightEvent) fail("no RailFreightEvent"); else out.freightSentence = eventSentence(freightEvent);
  // ── Knowledge travels along the link ──
  know(second, "wheel");
  settlement.knownProcesses = settlement.knownProcesses.filter((t) => t !== "wheel");
  out.linked = ind.linked(settlement.id);
  if (!out.linked.includes(second.id)) fail("the rail does not link the towns for learning");
  if (!neighborPracticesProcess(settlement, "wheel")) fail("a craft across the rail cannot be learned");
  // ── And across an embassy, with printed records ──
  const keepFaction = second.factionId; second.factionId = 0;
  const rival = createFaction(second.id) || null;
  if (!rival) second.factionId = keepFaction;
  if (rival && rival.id !== faction.id) {
    // The debug listing returns copies; toggle the links themselves.
    const liveLinks = W.roads.links.filter((l) => l.factionId === faction.id && ((l.a === settlement.id && l.b === second.id) || (l.b === settlement.id && l.a === second.id)));
    for (const l of liveLinks) l.complete = false;
    const routes = W.tradeRoutes.filter((r) => (r.a === settlement.id && r.b === second.id) || (r.b === settlement.id && r.a === second.id));
    const keepTrips = routes.map((r) => r.trips); for (const r of routes) r.trips = 0;
    out.linkedWithoutRail = ind.linked(settlement.id).includes(second.id);
    if (out.linkedWithoutRail) fail("towns stay linked without a link");
    makeStatecraftTreaty("embassy", faction, rival);
    out.linkedByEmbassy = ind.linked(settlement.id).includes(second.id);
    if (!out.linkedByEmbassy) fail("an embassy does not link the towns for learning");
    know(second, "printing");
    settlement.knownProcesses = settlement.knownProcesses.filter((t) => t !== "printing");
    out.recorded = processRecorded(settlement, "wheel");
    if (!out.recorded) fail("a printed record does not travel with the embassy");
    for (const l of liveLinks) l.complete = true;
    routes.forEach((r, i) => { r.trips = keepTrips[i]; });
  } else out.embassySkipped = true;
  // ── Factories work ──
  know(settlement, "controlled_fire", "metalworking", "mechanization", "chemistry", "electricity");
  out.wantsFactory = ind.wants(settlement.id);
  if (!out.wantsFactory) fail("an electric town wants no factory");
  ind.plan(settlement.id);
  const factory = W.buildings.find((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === settlement.id && b.type === "factory");
  if (!factory) { fail("no factory was planned"); return out; }
  complete(settlement, "factory");
  settlement.inventory[C.ORE] = 60; settlement.inventory[C.FUEL] = 60;
  const metalBefore = settlement.inventory[C.METAL], oreBefore = settlement.inventory[C.ORE], matterBeforeRun = totalMatter();
  out.made = ind.run(settlement.id);
  if (!(out.made >= 2)) fail("the factory made nothing");
  if (settlement.inventory[C.METAL] !== metalBefore + out.made) fail("the metal made does not match: " + (settlement.inventory[C.METAL] - metalBefore) + " vs " + out.made);
  if (!(settlement.inventory[C.ORE] < oreBefore)) fail("the factory used no ore");
  if (totalMatter() !== matterBeforeRun) fail("the factory created or destroyed matter");
  out.factories = ind.factories(settlement.id);
  if (!out.factories[0]?.workedTick) fail("the factory did not note its work");
  ind.update();
  if (!(W.milestones || []).some((m) => m.key === "first-factory")) fail("no first-factory milestone");
  const hashBefore = typeof worldHash === "function" ? worldHash() : null;
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 4, x: factory.x, y: factory.y, now: 5000 });
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 4, x: factory.x, y: factory.y, now: 5100 });
  if (hashBefore !== null && worldHash() !== hashBefore) fail("drawing the factory changed the world");
  // ── Lenses see ──
  know(settlement, "writing", "navigation", "astronomy");
  settlement.knownProcesses = settlement.knownProcesses.filter((t) => t !== "optics" && t !== "satellites");
  complete(settlement, "observatory");
  const charted = () => orbit.stars().filter((s) => s.chartedTick).length;
  const c0 = charted();
  orbit.chart(false);
  out.chartPlain = charted() - c0;
  know(settlement, "optics");
  const c1 = charted();
  orbit.chart(false);
  out.chartLenses = charted() - c1;
  if (out.chartPlain !== 1) fail("a plain observatory charted " + out.chartPlain + " stars at a look");
  if (out.chartLenses !== 2 && orbit.stars().length - c1 >= 2) fail("Lenses did not double the charting: " + out.chartLenses);
  simTick();
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_INDUSTRY_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_INDUSTRY_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
