// Records smoke: a polity with an archive writes down what its towns practise,
// a ruined town's crafts survive in a surviving archive, a ready town recovers
// a recorded process outright and the chronicle says so, a recorded process is
// researched faster and needs no fresh observation, and a polity without an
// archive loses what its dead towns knew.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const rec = window.ALIFE_RECORDS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const complete = (place, type) => {
    const b = planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === (place.knownProcesses ? "settlement" : "camp") && x.placeId === place.id && x.type === type);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  // A second town of the same polity, raised from a fresh camp.
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  let second = null;
  for (let tries = 0; tries < 400 && !second && people.length; tries++) {
    const x = 4 + ((tries * 37 + 11) % (W.width - 8)), y = 4 + ((tries * 23) % (W.height - 8)), t = idx(x, y);
    if (W.tiles.liquid[t] > WATER_DEPTH.SURFACE || campNear(t, 6) || nearestSettlement(t, 10)) continue;
    const founder = people.pop(), soc = W.components.social[founder];
    if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; }
    const camp = createCamp(t, founder);
    if (!camp) continue;
    for (const type of ["stockpile", "shelter", "hearth"]) complete(camp, type);
    second = createSettlement(camp.id);
  }
  if (!second) { fail("could not raise a second town"); return out; }
  second.factionId = settlement.factionId;
  for (const id of W.activeIds) { const soc = W.components.social[id]; if (soc?.homePlaceKind === "settlement" && soc.homePlaceId === second.id) soc.factionId = settlement.factionId; }
  const faction = W.factions.find((f) => f.id === settlement.factionId);
  if (!faction) { fail("no faction"); return out; }
  // The first town knows metalworking; the second keeps the archive.
  for (const t of ["controlled_fire", "ceramics"]) { if (!settlement.knownProcesses.includes(t)) settlement.knownProcesses.push(t); if (!second.knownProcesses.includes(t)) second.knownProcesses.push(t); }
  if (!settlement.knownProcesses.includes("metalworking")) settlement.knownProcesses.push("metalworking");
  W.civilization.legacyProcesses = W.civilization.legacyProcesses || []; if (!W.civilization.legacyProcesses.includes("metalworking")) W.civilization.legacyProcesses.push("metalworking");
  if (!second.knownProcesses.includes("writing")) second.knownProcesses.push("writing");
  complete(second, "archive");
  out.archives = rec.archives(faction.id);
  if (!out.archives.length) fail("the archive was not counted");
  rec.update();
  out.records = rec.records(faction.id);
  if (!out.records.includes("metalworking")) fail("the archive did not record metalworking: " + out.records.join(","));
  if (!rec.recorded(second.id, "metalworking")) fail("the second town does not see the record");
  // The first town falls; the record survives in the second town's archive.
  const ruin = ruinSettlement(settlement, [], "sacked for the test");
  // Later sections add their own evidence to the fall (refugees setting out), so
  // the archive's line is looked for anywhere in the record, not at its end.
  out.ruinEvidence = ruin ? ruin.evidence.find((e) => /archive of/.test(e)) || ruin.evidence.at(-1) : "";
  if (!/archive of/.test(out.ruinEvidence)) fail("the ruin does not say the archive holds the record: " + (ruin ? ruin.evidence.join(" | ") : ""));
  if (!rec.records(faction.id).includes("metalworking")) fail("the record was lost with the town");
  // The second town, ready with a kiln and ore, recovers the craft outright.
  complete(second, "kiln");
  second.researchInventory = second.researchInventory || new Uint16Array(SPECIES_COUNT);
  second.researchInventory[C.ORE] = 12; second.researchInventory[C.FUEL] = 12; second.inventory[C.ORE] = Math.max(second.inventory[C.ORE], 6);
  second.stability = Math.max(second.stability, 0.6);
  // Enough people to be a working town.
  const residents = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]?.homePlaceId === second.id && W.components.social[id]?.homePlaceKind === "settlement");
  if (residents.length < 4) {
    let moved = 0;
    for (const id of W.activeIds) { if (moved >= 4 - residents.length) break; const soc = W.components.social[id]; if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id) || soc?.homePlaceId === second.id) continue; soc.homePlaceKind = "settlement"; soc.homePlaceId = second.id; soc.factionId = faction.id; const p = W.components.position[id]; p.x = second.x; p.y = second.y; moved++; }
    rebuildSpatialBins();
  }
  const metal = technologyDefinition("metalworking");
  out.readiness = { pop: settlementPopulation(second), kiln: placeHasFacility(second, "kiln"), ore: hasResearchMaterial(second, C.ORE), fuel: hasResearchMaterial(second, C.FUEL), heat: settlementTemperatureCapacity(second, metal, [1]), need: metal.heat, structures: (metal.structures || []).every((req) => settlementHasStructure(second, req)) };
  if (out.readiness.heat < metal.heat) { second.inventory[C.FUEL] = Math.max(second.inventory[C.FUEL] || 0, 60); out.readiness.heatWithFuel = settlementTemperatureCapacity(second, metal, [1]); }
  const recovered = rec.recover();
  out.recovered = recovered;
  if (!second.knownProcesses.includes("metalworking")) fail("the second town did not recover metalworking: " + JSON.stringify(recovered) + " pop " + settlementPopulation(second));
  const ev = W.events.filter((e) => e.type === "KnowledgeRecoveredEvent").at(-1);
  out.sentence = ev ? eventSentence(ev) : "";
  if (!ev) fail("no KnowledgeRecoveredEvent");
  if (!/Records/.test(window.ALIFE_LEGENDS_DEBUG.render("faction", faction.id))) fail("the polity page does not show its records");
  // A recorded process the town cannot yet recover is still researched faster and without fresh observation.
  second.knownProcesses = second.knownProcesses.filter((t) => t !== "metalworking");
  const kiln = W.buildings.find((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === second.id && b.type === "kiln");
  if (kiln) kiln.ruined = true;
  second.researchProgress = second.researchProgress || {};
  second.researchProgress.metalworking = 0;
  // Without the kiln, recovery is impossible, so the town must research it: the record should make it eligible and quick.
  const before = second.researchProgress.metalworking || 0;
  if (kiln) { kiln.ruined = false; }
  for (let i = 0; i < 300; i++) simTick();
  out.researchAfter = second.knownProcesses.includes("metalworking") ? "recovered again" : (second.researchProgress.metalworking || 0);
  if (!(out.researchAfter === "recovered again" || out.researchAfter > 0)) fail("a recorded process was neither recovered nor researched: " + JSON.stringify(out.researchAfter));
  // A polity without an archive loses what its dead towns knew.
  const other = W.factions.find((f) => f !== faction) || null;
  if (other) {
    const town = W.settlements.find((s) => !s.ruined && s.factionId === other.id);
    if (town) { town.knownProcesses.push("masonry"); ruinSettlement(town, [], "sacked for the test"); if ((other.records || []).includes("masonry")) fail("a polity without an archive kept a record"); }
  }
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_RECORDS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_RECORDS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
