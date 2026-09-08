// Cities smoke: starflight stands on engines, current, and computing; a village
// plans no launch tower and launches no ship however much it knows while a
// city at the urban stage does both; the complex terrestrial stage asks for
// Electricity; and a city short of beds raises a tenement that people may
// rest in, that is drawn in both lenses without touching the world, and that
// the annals keep as a milestone.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const cities = window.ALIFE_CITIES_DEBUG, eras = window.ALIFE_ERAS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const grant = (...techs) => { for (const t of techs) if (!settlement.knownProcesses.includes(t)) settlement.knownProcesses.push(t); };
  const planned = (type) => W.buildings.find((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === settlement.id && b.type === type);
  const finish = (b) => { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; return b; };
  // Starflight stands on the industrial techs.
  const prior = technologyDefinition("starflight").prior;
  out.prior = prior.slice();
  for (const t of ["combustion", "electricity", "computing", "astronomy", "planetary_stewardship"]) if (!prior.includes(t)) fail("starflight does not require " + t);
  // A village plans no tower however much it knows.
  grant("writing", "navigation", "astronomy", "mechanization", "waterworks", "sanitation", "public_works", "planetary_stewardship");
  simTick();
  settlement.stage = "village";
  out.shortfallVillage = cities.shortfall(settlement.id);
  cities.plan(settlement.id);
  if (planned("launch_tower")) fail("a village planned a launch tower");
  grant("chemistry", "combustion", "electricity", "computing");
  cities.plan(settlement.id);
  if (planned("launch_tower")) fail("a village with engines planned a launch tower");
  if (!out.shortfallVillage.includes("a city at the urban stage")) fail("the shortfall does not name the city: " + out.shortfallVillage.join(","));
  if (!out.shortfallVillage.some((s) => /Combustion|Electricity|Computing/.test(s))) fail("the shortfall does not name the industrial techs: " + out.shortfallVillage.join(","));
  // A city plans it, and only a city launches.
  settlement.stage = "urban";
  if (!cities.city(settlement.id)) fail("the urban stage is not a city");
  if (cities.shortfall(settlement.id).length) fail("a city knowing the groundwork still falls short: " + cities.shortfall(settlement.id).join(","));
  cities.plan(settlement.id);
  const tower = planned("launch_tower");
  if (!tower) { fail("the city planned no launch tower"); return out; }
  finish(tower);
  settlement.stability = Math.max(settlement.stability || 0, 0.6);
  grant("starflight");
  settlement.stage = "village";
  if (eras.launch(settlement.id, false)) fail("a ship left a village");
  settlement.stage = "urban";
  // This fixture tests the city gate, not the modern world (114), which is waived here.
  window.ALIFE_MODERN_DEBUG.waive(true);
  // No ship leaves a city of cottages (110): a tower block and a factory stand first.
  for (const type of ["tower", "factory"]) { const b = planned(type) || planBuilding(settlement, type, 9); if (b) finish(b); else fail("no " + type + " could be raised for the launch"); }
  const ship = eras.launch(settlement.id, false);
  if (!ship) fail("no ship left the city");
  out.ship = !!ship;
  // The complex terrestrial stage asks for Electricity.
  const waterworks = planned("waterworks") || planBuilding(settlement, "waterworks", 9);
  if (!waterworks) fail("no waterworks could be planned"); else finish(waterworks);
  settlement.knownProcesses = settlement.knownProcesses.filter((t) => t !== "electricity");
  out.stageWithoutCurrent = settlementDevelopmentStage(settlement);
  if (out.stageWithoutCurrent === "complex terrestrial") fail("complex terrestrial came without Electricity");
  grant("electricity");
  out.stageWithCurrent = settlementDevelopmentStage(settlement);
  if (waterworks && out.stageWithCurrent !== "complex terrestrial") fail("complex terrestrial did not come with Electricity: " + out.stageWithCurrent);
  // A city short of beds raises a tenement (a city with current raises tower blocks instead, 103).
  settlement.stage = "urban";
  grant("masonry");
  settlement.knownProcesses = settlement.knownProcesses.filter((t) => t !== "electricity");
  const housing = cities.housing(settlement.id);
  out.housing = housing;
  // Beds run short by felling homes (not by un-finishing them, which would fill the active-site cap), and stray sites are finished first.
  for (const b of W.buildings) if (!b.ruined && !b.complete && b.placeKind === "settlement" && b.placeId === settlement.id && b.type !== "tenement") finish(b);
  const hidden = [];
  if (housing.beds >= housing.people)
    for (const b of W.buildings) if (!b.ruined && b.complete && b.placeKind === "settlement" && b.placeId === settlement.id && (BUILDING_DEFS[b.type]?.housing || 0) > 0) { b.ruined = true; hidden.push(b); }
  recomputePlaceCapacity(settlement);
  out.wants = cities.wants(settlement.id);
  if (!out.wants) fail("a city short of beds wants no tenement: " + JSON.stringify(cities.housing(settlement.id)));
  cities.plan(settlement.id);
  for (const b of hidden) b.ruined = false;
  recomputePlaceCapacity(settlement);
  const tenement = planned("tenement");
  if (!tenement) { fail("no tenement was planned"); return out; }
  if (!(BUILDING_DEFS.tenement.housing >= BUILDING_DEFS.shelter.housing * 3)) fail("a tenement houses too few");
  const bedsBefore = cities.housing(settlement.id).beds;
  finish(tenement);
  out.bedsAfter = cities.housing(settlement.id).beds;
  if (out.bedsAfter !== bedsBefore + BUILDING_DEFS.tenement.housing) fail("the tenement added the wrong number of beds: " + bedsBefore + " -> " + out.bedsAfter);
  // A resting person may enter it, and returns to it as to a shelter.
  const person = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.life[id]);
  if (person) {
    const life = W.components.life[person], keep = life.behavior;
    life.behavior = "rest";
    out.mayEnter = personMayEnterBuilding(person, tenement);
    life.behavior = keep;
    if (!out.mayEnter) fail("a resting person may not enter a tenement");
  }
  // Drawn in both lenses, and the world is untouched.
  const hashBefore = typeof worldHash === "function" ? worldHash() : null;
  cities.reset();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 3, x: tenement.x, y: tenement.y, now: 5000 });
  out.drawnTop = cities.drawn();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "standard", zoom: 2.5, x: tenement.x, y: tenement.y, now: 5100 });
  out.drawnBoth = cities.drawn();
  if (!(out.drawnTop >= 1) || !(out.drawnBoth >= 2)) fail("the tenement was not drawn in both lenses: " + out.drawnTop + "/" + out.drawnBoth);
  if (hashBefore !== null && worldHash() !== hashBefore) fail("drawing the tenement changed the world");
  // The annals keep the first.
  cities.plan(settlement.id);
  if (!(W.milestones || []).some((m) => m.key === "first-tenement")) fail("no first-tenement milestone");
  const page = renderLegendPage ? renderLegendPage("place", settlement.id) : "";
  out.housingRow = /Housing/.test(page);
  if (!out.housingRow) fail("the place page shows no housing row");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_CITIES_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_CITIES_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
