// Horizons smoke: on a battery-saver map the urban gate, civic building costs,
// and settler and prospector minimums scale down with the world; a town that
// meets the scaled gate is urban; the stage text and the skip's micro-stage
// carry the scaled numbers; standard worlds keep their original numbers.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const hz = window.ALIFE_HORIZON_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  out.size = [W.width, W.height]; out.scale = hz.scale(); out.gate = hz.gate(); out.settlerMinimum = hz.settlerMinimum();
  if (!(out.scale < 1)) fail("a battery map does not read as a small world: " + out.scale);
  if (!(out.gate.local < 24 && out.gate.local >= 8 && out.gate.network < 32 && out.gate.network >= 12)) fail("the urban gate did not scale down: " + JSON.stringify(out.gate));
  if (out.settlerMinimum !== 12) fail("the settler minimum changed on a small world: " + out.settlerMinimum);
  // The people a modern world needs scale with the map too, or a battery world
  // could never be modern and its ship could never leave.
  // The floor is two cities' worth at this world's own urban gate, never a
  // number of its own: ten a city here, so twenty.
  out.modernGate = window.ALIFE_MODERN_DEBUG.gate();
  out.modernFloor = hz.gate().local * window.ALIFE_MODERN_DEBUG.wants().cities;
  if (!(out.modernGate < 100)) fail("the modern people gate did not scale down: " + out.modernGate);
  if (out.modernGate !== out.modernFloor) fail("the people gate is not two cities' worth of this world: " + out.modernGate + " vs " + out.modernFloor);
  out.modernWants = window.ALIFE_MODERN_DEBUG.wants();
  if (!(out.modernWants.share < 0.25)) fail("a battery map is not read as a small share of a standard one: " + out.modernWants.share);
  if (out.modernWants.works !== 1) fail("a battery world still wants more than one factory: " + out.modernWants.works);
  if (out.modernWants.skyline !== 2 || out.modernWants.electric !== 2) fail("the skyline and current counts did not fall to their floors: " + JSON.stringify(out.modernWants));
  if (out.modernWants.cities !== 2) fail("a world that leaves for the stars should still want two cities: " + out.modernWants.cities);
  if (!window.ALIFE_MODERN_DEBUG.stages().some((x) => x.label === out.modernGate + " people living in towns")) fail("the skip's stage does not carry the scaled gate: " + JSON.stringify(window.ALIFE_MODERN_DEBUG.stages().map((x) => x.label)));
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  // Civic buildings ask for less common material, their rare inputs unchanged.
  out.hall = hz.requirements(settlement.id, "hall");
  const rigid = BUILDING_DEFS.hall.work * 0.18 * 2.2, pigment = out.hall.find(([n]) => n === W.definitions.species[C.PIGMENT].name);
  if (!out.hall.some(([, n]) => n < Math.round(rigid) && n >= 4)) fail("the hall did not get cheaper on a small world: " + JSON.stringify(out.hall) + " vs rigid " + Math.round(rigid));
  if (!pigment || pigment[1] !== 4) fail("the hall's pigment changed: " + JSON.stringify(pigment));
  // Civic buildings also ask for less labour on a small world.
  const hallPlan = planBuilding(settlement, "hall", 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === settlement.id && x.type === "hall");
  if (hallPlan) { ensurePlacePlans(settlement); out.hallWork = { required: hallPlan.workRequired, base: BUILDING_DEFS.hall.work }; if (!(hallPlan.workRequired < BUILDING_DEFS.hall.work)) fail("the hall asks for as much labour as on a standard world: " + JSON.stringify(out.hallWork)); }
  // A town that meets the scaled gate with a hall, a clinic and eight structures is urban.
  const complete = (type) => {
    const b = planBuilding(settlement, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === settlement.id && x.type === type && !x.complete);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  for (const type of ["hall", "clinic", "shelter", "shelter", "farm", "kiln", "workshop", "stockpile", "hearth", "archive"]) complete(type);
  for (const b of W.buildings) if (!b.ruined && b.placeKind === "settlement" && b.placeId === settlement.id && !b.complete) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; }
  if (!settlement.knownProcesses.includes("writing")) settlement.knownProcesses.push("writing");
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  let placed = 0;
  for (const id of people) { if (placed >= out.gate.local) break; const soc = W.components.social[id]; soc.homePlaceKind = "settlement"; soc.homePlaceId = settlement.id; soc.factionId = settlement.factionId; const p = W.components.position[id]; p.x = clamp(settlement.x + (placed % 4) - 2, 0, W.width - 1); p.y = clamp(settlement.y + Math.floor(placed / 4) - 1, 0, W.height - 1); placed++; }
  rebuildSpatialBins();
  out.pop = settlementPopulation(settlement); out.built = completedBuildings(settlement).length;
  out.stage = settlementDevelopmentStage(settlement);
  if (out.pop >= out.gate.local && out.built >= 8 && out.stage !== "urban") fail("a town meeting the scaled gate is not urban: " + JSON.stringify({ pop: out.pop, built: out.built, stage: out.stage }));
  if (out.pop < out.gate.local) out.skippedUrban = "too few people in the fixture world to fill the gate";
  // The stage text and the skip's micro-stage carry the scaled numbers.
  const shortfall = settlementStageShortfall(settlement, "urban");
  out.shortfall = shortfall;
  if (shortfall.some((m) => /\/24|\/32/.test(m))) fail("the shortfall text still uses the standard numbers: " + shortfall.join("; "));
  const metro = causalSkipMicroStages().find((s) => s.key === "metro");
  W.civilization.stageIndex = CIV_STAGE_ORDER.indexOf("civic"); W.civilization.stage = "civic";
  const metroStage = causalSkipMicroStages().find((s) => s.key === "metro");
  out.metroLabel = metroStage ? metroStage.label : "";
  if (!metroStage || !metroStage.label.includes(String(out.gate.local))) fail("the skip's metropolitan stage does not carry the scaled gate: " + out.metroLabel);
  const gate = civilizationGateStatus();
  out.requirement = gate?.requirement || "";
  if (gate?.next === "urban" && /24 local/.test(out.requirement)) fail("the gate text still asks for 24: " + out.requirement);
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "battery" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_SCALE_TEST.run();
for (const f of result.failures) failures.push(f);
// A standard world keeps its original numbers.
game.createTestWorld({ seed: "x3", size: "standard" });
const gate = sandbox.window.ALIFE_HORIZON_DEBUG.gate();
if (gate.local !== 24 || gate.network !== 32) failures.push("a standard world changed its urban gate: " + JSON.stringify(gate));
result.standardGate = gate;
const modernGate = sandbox.window.ALIFE_MODERN_DEBUG.gate();
if (modernGate !== 100) failures.push("a standard world changed the people a modern world needs: " + modernGate);
result.standardModernGate = modernGate;
const standardWants = sandbox.window.ALIFE_MODERN_DEBUG.wants();
result.standardWants = standardWants;
if (standardWants.cities !== 2 || standardWants.electric !== 3 || standardWants.skyline !== 3 || standardWants.works !== 2)
  failures.push("a standard world changed what a modern world asks of it: " + JSON.stringify(standardWants));
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_SCALE_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
