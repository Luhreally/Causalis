// Fields smoke: the granary plans farms for the crowd a town has (one per six
// people, well past the old cap of eight), a town of two dozen that knows
// letters plans a hall without governance, and a crowded masonry town wants a
// tenement before the annals call it a city.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const fields = window.ALIFE_FIELDS_DEBUG, cities = window.ALIFE_CITIES_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  if (!s.factionId) createFaction(s.id);
  const complete = (b) => { if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; } return b; };
  const living = () => W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.position[id]);
  for (let n = 0; living().length < 60 && n < 80; n++) createOrganism(KINDS.PERSON, s.x, s.y, makeRng(hashParts(W.seedHash, "fields-fixture", n), "birth"), []);
  living().forEach((id, i) => { const soc = W.components.social[id], p = W.components.position[id]; soc.homePlaceKind = "settlement"; soc.homePlaceId = s.id; soc.factionId = s.factionId; p.x = clamp(s.x + (i % 5) - 2, 1, W.width - 2); p.y = clamp(s.y + (Math.floor(i / 5) % 5) - 2, 1, W.height - 2); });
  rebuildSpatialBins();
  out.pop = settlementPopulation(s);
  if (out.pop < 40) { fail("the town is too small for the test: " + out.pop); return out; }
  // Farms for the crowd: well past eight, land permitting.
  out.maxFarms = fields.maxFarms();
  out.desired = fields.desiredFarms(s.id);
  if (!(out.maxFarms >= 16) || !(out.desired > 8)) fail("the granary still caps farms at eight: " + out.maxFarms + " / " + out.desired);
  for (let round = 0; round < 12; round++) {
    ensurePlacePlans(s);
    for (const b of W.buildings) if (!b.ruined && !b.complete && b.placeKind === "settlement" && b.placeId === s.id) complete(b);
  }
  out.farms = fields.farms(s.id);
  const blocked = !planBuilding(s, "farm", 3);
  out.blocked = blocked;
  if (!(out.farms > 8) && !blocked) fail("fewer than nine farms were planned with land to spare: " + out.farms);
  if (!(out.farms >= 4)) fail("too few farms for a town of " + out.pop + ": " + out.farms);
  // A hall at letters.
  s.knownProcesses = s.knownProcesses.filter((t) => t !== "governance");
  if (!s.knownProcesses.includes("writing")) s.knownProcesses.push("writing");
  for (const b of W.buildings) if (b.type === "hall" && b.placeKind === "settlement" && b.placeId === s.id) b.ruined = true;
  out.wantsHall = fields.wantsHall(s.id);
  ensurePlacePlans(s);
  const hall = W.buildings.find((b) => !b.ruined && b.type === "hall" && b.placeKind === "settlement" && b.placeId === s.id);
  if (!out.wantsHall || !hall) fail("a town of two dozen with letters planned no hall");
  // A tenement before the annals call it a city.
  if (!s.knownProcesses.includes("masonry")) s.knownProcesses.push("masonry");
  s.knownProcesses = s.knownProcesses.filter((t) => t !== "electricity");
  s.stage = "village";
  // Half the homes fall to rubble so beds run short without leaving sites half-built (which would fill the active cap).
  let felled = 0;
  for (const b of W.buildings) if (!b.ruined && b.complete && b.placeKind === "settlement" && b.placeId === s.id && (BUILDING_DEFS[b.type]?.housing || 0) > 0 && felled++ % 2 === 0) { b.ruined = true; b.complete = false; }
  recomputePlaceCapacity(s);
  out.beds = housingCapacity(s);
  out.city = cities.city(s.id);
  out.wantsTenement = cities.wants(s.id);
  if (out.city) fail("the fixture town counts as a city already");
  if (!out.wantsTenement) fail("a crowded masonry village wants no tenement");
  cities.plan(s.id);
  if (!W.buildings.some((b) => !b.ruined && b.type === "tenement" && b.placeKind === "settlement" && b.placeId === s.id)) fail("no tenement was planned for the crowded village");
  // Past eight cottages the crowded masonry town plans no more of them.
  while (W.buildings.filter((b) => !b.ruined && b.type === "shelter" && b.placeKind === "settlement" && b.placeId === s.id).length < fields.shelterCap()) { const b = planBuilding(s, "shelter", 3); if (!b) break; complete(b); }
  out.shelters = W.buildings.filter((b) => !b.ruined && b.type === "shelter" && b.placeKind === "settlement" && b.placeId === s.id).length;
  if (out.shelters >= fields.shelterCap() && planBuilding(s, "shelter", 3)) fail("a crowded masonry town still plans a " + (out.shelters + 1) + "th cottage");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_FIELDS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_FIELDS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
