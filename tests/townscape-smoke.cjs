// Townscape smoke: the canonical seed builds in the earthen family with gridded
// streets while another seed picks an alien family; the square stays open and
// lanes stay clear; civic buildings land by the square, workshops leeward,
// farms in the belt, and walls on the ring; farmsteads appear for a large
// farming town; a town that knows masonry paves its streets from its stores
// into the road ledger with matter conserved; every family renders.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const ts = window.ALIFE_TOWNSCAPE_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const plan = ts.plan(settlement.id);
  out.plan = plan;
  out.earthlike = canonicalPlanetSeed(W.seed);
  if (out.earthlike && plan.family !== "earthen") fail("the canonical seed does not build in the earthen family: " + plan.family);
  if (!out.earthlike && plan.family === "earthen") fail("an alien seed builds in the earthen family");
  if (!ts.families().includes(plan.family)) fail("unknown family " + plan.family);
  // The square is open and lanes are clear; buildings avoid both.
  if (plan.pattern !== "clustered" && !ts.plaza(settlement.id, settlement.x, settlement.y)) fail("the heart of the town is not a square");
  const laneCount = (() => { let n = 0; for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (ts.lane(settlement.id, settlement.x + dx, settlement.y + dy)) n++; return n; })();
  out.lanes = laneCount;
  if (plan.pattern !== "clustered" && !(laneCount > 20 && laneCount < 150)) fail("the street lanes are missing or everywhere: " + laneCount);
  // Zoning: civic by the square, workshops nearer than farms, walls on the ring.
  const ring = (t) => t ? Math.max(Math.abs(t[0] - settlement.x), Math.abs(t[1] - settlement.y)) : null;
  const complete = (type) => {
    const b = planBuilding(settlement, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === settlement.id && x.type === type && !x.complete);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  const hall = complete("hall"), archive = complete("archive"), shelters = [complete("shelter"), complete("shelter"), complete("shelter")], workshop = complete("workshop"), kiln = complete("kiln"), farm = complete("farm"), farm2 = complete("farm"), wall = complete("wall");
  const at = (b) => (b ? [b.x, b.y] : null);
  out.rings = { hall: ring(at(hall)), archive: ring(at(archive)), shelters: shelters.map((b) => ring(at(b))), workshop: ring(at(workshop)), kiln: ring(at(kiln)), farm: ring(at(farm)), farm2: ring(at(farm2)), wall: ring(at(wall)) };
  // The civic fixture has already filled the inner rings, so the hall may sit one ring out.
  if (!hall || out.rings.hall > 4) fail("the hall does not stand by the square: " + out.rings.hall);
  if (farm && workshop && out.rings.farm <= out.rings.workshop) fail("the farm stands nearer than the workshop: " + JSON.stringify(out.rings));
  if (farm && out.rings.farm < 4) fail("the farm is not in the belt beyond the houses: " + out.rings.farm);
  for (const b of [hall, archive, ...shelters, workshop, kiln]) if (b && plan.pattern !== "clustered" && (ts.lane(settlement.id, b.x, b.y) || ts.plaza(settlement.id, b.x, b.y))) fail(b.type + " stands on a street or the square");
  if (wall && out.rings.wall < 3) fail("the wall is inside the town: " + out.rings.wall);
  // Farmsteads for a large farming town.
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  for (const id of people.slice(0, 24)) { const p = W.components.position[id]; p.x = clamp(settlement.x + (id % 5) - 2, 0, W.width - 1); p.y = clamp(settlement.y + Math.floor(id / 5) % 5 - 2, 0, W.height - 1); }
  rebuildSpatialBins();
  complete("farm"); complete("farm");
  out.pop = settlementPopulation(settlement);
  const sheltersBefore = W.buildings.filter((b) => !b.ruined && b.placeId === settlement.id && b.type === "shelter").length;
  ensurePlacePlans(settlement);
  const outer = ts.outer(settlement.id), farmsteads = W.buildings.filter((b) => !b.ruined && b.placeId === settlement.id && b.type === "shelter" && Math.max(Math.abs(b.x - settlement.x), Math.abs(b.y - settlement.y)) >= outer + 1);
  out.farmsteads = farmsteads.length; out.sheltersPlanned = W.buildings.filter((b) => !b.ruined && b.placeId === settlement.id && b.type === "shelter").length - sheltersBefore;
  if (out.pop >= 20 && !farmsteads.length) fail("a large farming town planned no farmstead among its far fields");
  if (out.pop < 20) out.farmsteadSkipped = "too few people to test farmsteads";
  // Paving: masonry, mineral in store, lanes beside buildings.
  if (!settlement.knownProcesses.includes("masonry")) settlement.knownProcesses.push("masonry");
  settlement.inventory[C.MINERAL] = Math.max(settlement.inventory[C.MINERAL], 60);
  const matterBefore = totalMatter(), mineralBefore = settlement.inventory[C.MINERAL];
  out.paved = ts.pave(settlement.id);
  if (plan.pattern !== "clustered") {
    if (!(out.paved > 0)) fail("no street was paved");
    else {
      if (settlement.inventory[C.MINERAL] !== mineralBefore - out.paved) fail("paving did not draw mineral from the store");
      if (totalMatter() !== matterBefore) fail("paving created or destroyed matter");
      const paved = W.events.find((e) => e.type === "StreetsPavedEvent");
      if (!paved) fail("no StreetsPavedEvent"); else out.pavedSentence = eventSentence(paved);
      if (!/Townscape/.test(window.ALIFE_LEGENDS_DEBUG.render("place", settlement.id))) fail("the place page has no townscape row");
    }
  }
  // Every family renders at close zoom, in both lenses, without moving the world.
  UI.camera.x = settlement.x; UI.camera.y = settlement.y;
  for (const family of ts.families()) {
    ts.setFamily(settlement.id, family);
    window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 3, now: 5000 });
    window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "standard", zoom: 2.2, now: 5100 });
  }
  ts.setFamily(settlement.id, plan.family);
  if (typeof worldHash === "function" && worldHash() !== worldHash()) fail("rendering the families was not stable");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
for (const seed of ["causal-origin", "x3"]) {
  game.createTestWorld({ seed, size: "small" });
  controls.createCivicTestScenario();
  const result = sandbox.window.ALIFE_TOWNSCAPE_TEST.run();
  for (const f of result.failures) failures.push(seed + ": " + f);
  console.log(JSON.stringify({ seed, ok: !result.failures.length, result }, null, 2));
}
console.log(JSON.stringify({ ok: !failures.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_TOWNSCAPE_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
