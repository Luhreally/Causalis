// Seafaring smoke: a dock planned at the water's edge, fishers who move the
// shallows' matter into the store without creating any, boats that belong to
// the town, a voyage across deep water that founds a camp on a far shore, the
// harbour rows on the place page, and stable drawing.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const sea = window.ALIFE_SEA_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const faction = settlement.factionId ? W.factions.find((f) => f.id === settlement.factionId) : createFaction(settlement.id);
  if (!faction) { fail("no faction"); return out; }
  const people = entityAtRadius(idx(settlement.x, settlement.y), 8, KINDS.PERSON).filter((id) => classifyAlive(id));
  if (people.length < 4) { fail("too few people at the settlement"); return out; }
  for (const id of people) { W.components.life[id].age = Math.max(W.components.life[id].age, 4000); W.components.life[id].hunger = Math.min(W.components.life[id].hunger || 0, 30); }
  // The fixture shore: a pool of wading-depth water three tiles east of the town,
  // and a deep channel farther out with solid land beyond it.
  const sx = settlement.x, sy = settlement.y, dir = sx + 20 < W.width ? 1 : -1;
  const setWater = (x, y, depth) => { if (inside(x, y)) { const t = idx(x, y); W.tiles.liquid[t] = depth; W.tiles.fire[t] = 0; if (depth > 0) W.tiles.chem[C.ORGANIC][t] = Math.max(W.tiles.chem[C.ORGANIC][t], 60); } };
  for (let dy = -1; dy <= 1; dy++) for (let k = 3; k <= 5; k++) setWater(sx + dir * k, sy + dy, 700);
  for (let dy = -14; dy <= 14; dy++) for (let k = 8; k <= 10; k++) setWater(sx + dir * k, sy + dy, 1500);
  for (let dy = -2; dy <= 2; dy++) for (let k = 13; k <= 17; k++) { const x = sx + dir * k, y = sy + dy; if (inside(x, y)) { const t = idx(x, y); W.tiles.liquid[t] = 0; W.tiles.fire[t] = 0; W.tiles.danger[t] = 0; W.tiles.owner[t] = 0; W.tiles.chem[C.ORGANIC][t] = Math.max(W.tiles.chem[C.ORGANIC][t], 120); W.tiles.chem[C.SOLVENT][t] = Math.max(W.tiles.chem[C.SOLVENT][t], 200); W.tiles.chem[C.MINERAL][t] = Math.max(W.tiles.chem[C.MINERAL][t], 80); W.tiles.plantOrder[t] = Math.max(W.tiles.plantOrder[t], 300); } }
  const matterBefore = totalMatter();
  // A dock is wanted and planned on land at the water's edge.
  out.wantsDock = sea.wantsDock(settlement.id);
  if (!out.wantsDock) fail("a town beside water does not want a dock");
  const dock = sea.planDock(settlement.id);
  if (!dock) { fail("no dock could be planned"); return out; }
  const dockTile = idx(dock.x, dock.y);
  if (W.tiles.liquid[dockTile] > WATER_DEPTH.SHALLOW) fail("the dock stands in the water");
  if (!neighbors4(dockTile).some((t) => W.tiles.liquid[t] > WATER_DEPTH.WADE_LIMIT)) fail("the dock does not touch the water");
  const b = W.buildings.find((x) => x.id === dock.id);
  b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity;
  // Fishing: two fishers, a ground with organic matter, the catch landed in the store.
  const trips = sea.fish(settlement.id);
  out.trips = trips.length;
  if (!trips.length) { fail("no fishing trips began"); return out; }
  if (!W.civilOrders.some((o) => o.kind === "fish")) fail("fishers have no orders");
  if (!sea.aboard(trips[0].personId)) fail("a fisher on the town's business is not aboard its boat");
  for (const trip of trips) { const p = W.components.position[trip.personId], o = W.civilOrders.find((x) => x.id === trip.personId); p.x = o.x; p.y = o.y; }
  rebuildSpatialBins();
  sea.tick();
  const carried = sea.trips().filter((t) => t.phase === "home");
  if (!carried.length || !carried.some((t) => t.carried > 0)) fail("no fisher took anything from the water");
  const storeBefore = settlement.inventory[C.ORGANIC];
  for (const trip of carried) { const p = W.components.position[trip.personId]; p.x = dock.x; p.y = dock.y; }
  rebuildSpatialBins();
  sea.tick();
  if (!(settlement.inventory[C.ORGANIC] > storeBefore)) fail("the catch never reached the store");
  if (totalMatter() !== matterBefore) fail("fishing changed total matter");
  const landed = W.events.filter((e) => e.type === "CatchEvent").at(-1);
  if (!landed) fail("no CatchEvent"); else out.catchSentence = eventSentence(landed);
  if (W.civilOrders.some((o) => o.kind === "fish")) fail("fishing orders were not cleared after landing");
  // Voyage: with navigation the town sends settlers across the deep channel.
  if (!settlement.knownProcesses.includes("navigation")) settlement.knownProcesses.push("navigation");
  out.sails = sea.sails(settlement.id);
  if (!out.sails) fail("a town that knows navigation has no seagoing boats");
  out.site = sea.site(settlement.id);
  if (out.site < 0) fail("no colony site was found across the water");
  else if (sea.waterBetween(idx(sx, sy), out.site) < 3) fail("the colony site is not across water");
  const voyage = sea.voyage(settlement.id);
  if (!voyage) { fail("no voyage launched"); return out; }
  out.voyage = { settlers: voyage.members.length, target: voyage.target };
  if (voyage.members.length < 3) fail("too few settlers sailed");
  if (!voyage.members.every((id) => sea.aboard(id) && hasNavigableWatercraft(id))) fail("settlers are not counted as aboard a boat");
  const voyageEvent = W.events.filter((e) => e.type === "VoyageEvent").at(-1);
  if (!voyageEvent) fail("no VoyageEvent"); else out.voyageSentence = eventSentence(voyageEvent);
  for (let i = 0; i < 24; i++) simTick();
  const [tx, ty] = xy(voyage.target);
  const campsBefore = W.camps.filter((c) => c.active).length;
  for (const id of voyage.members) { const p = W.components.position[id]; if (p) { p.x = tx; p.y = ty; } }
  rebuildSpatialBins();
  sea.tick();
  const colony = W.events.filter((e) => e.type === "ColonyEvent").at(-1);
  if (!colony) fail("landing founded no colony (" + W.events.filter((e) => e.type === "VoyageLostEvent").map((e) => eventSentence(e)).join("; ") + ")");
  else out.colonySentence = eventSentence(colony);
  if (W.camps.filter((c) => c.active).length <= campsBefore) fail("no camp stands on the far shore");
  if (W.civilOrders.some((o) => o.kind === "voyage")) fail("voyage orders were not cleared after landing");
  // Legends and drawing.
  const page = window.ALIFE_LEGENDS_DEBUG.render("place", settlement.id);
  if (!/Harbour/.test(page) || !/seagoing/.test(page)) fail("the place page has no harbour rows");
  const hashBefore = worldHash();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 6, now: 5000 });
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "standard", zoom: 2, now: 5200 });
  if (worldHash() !== hashBefore) fail("rendering the coast changed the world hash");
  for (let i = 0; i < 70; i++) simTick();
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_SEA_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_SEA_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
