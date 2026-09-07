// Aftermath smoke: settlers prefer a ruin within reach, a town raised on a ruin
// inherits part of what the dead town knew, a fallen town's survivors walk to a
// friendly town, and a thin town of a polity receives colonists.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const after = window.ALIFE_AFTERMATH_DEBUG, gran = window.ALIFE_GRANARY_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
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
  const raiseTown = (dx, dy) => {
    const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && !W.components.social[id]?.homePlaceId);
    for (let tries = 0; tries < 60; tries++) {
      const x = clamp(settlement.x + dx + (tries % 6), 3, W.width - 4), y = clamp(settlement.y + dy + Math.floor(tries / 6), 3, W.height - 4), t = idx(x, y);
      if (W.tiles.liquid[t] > WATER_DEPTH.SURFACE || campNear(t, 6) || nearestSettlement(t, 10)) continue;
      const founder = people.pop() || W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
      if (!founder) return null;
      const soc = W.components.social[founder]; if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; }
      const camp = createCamp(t, founder);
      if (!camp) continue;
      for (const type of ["stockpile", "shelter", "hearth"]) complete(camp, type);
      const town = createSettlement(camp.id);
      if (town) return town;
    }
    return null;
  };
  // A second town of the polity that will fall, with crafts and residents.
  const doomed = raiseTown(16, -10);
  if (!doomed) { fail("could not raise the doomed town"); return out; }
  doomed.factionId = settlement.factionId;
  for (const t of ["controlled_fire", "ceramics", "masonry", "storage"]) if (!doomed.knownProcesses.includes(t)) doomed.knownProcesses.push(t);
  const residents = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id)).slice(0, 4);
  for (const id of residents) { const soc = W.components.social[id]; soc.homePlaceKind = "settlement"; soc.homePlaceId = doomed.id; soc.factionId = settlement.factionId; const p = W.components.position[id]; p.x = doomed.x; p.y = doomed.y; }
  rebuildSpatialBins();
  settlement.inventory[C.ORGANIC] = Math.max(settlement.inventory[C.ORGANIC], 300);
  out.refuge = after.refuge(doomed.id);
  if (out.refuge !== settlement.name) fail("the survivors' refuge is not the polity's other town: " + out.refuge);
  // The town falls; its survivors set out for the refuge.
  const ruin = ruinSettlement(doomed, [], "sacked for the test");
  out.ruinEvidence = ruin ? ruin.evidence.slice(-1)[0] : "";
  if (!/set out for/.test(out.ruinEvidence)) fail("the ruin does not send survivors anywhere: " + out.ruinEvidence);
  const refugees = W.events.filter((e) => e.type === "RefugeesEvent").at(-1);
  out.refugees = refugees ? eventSentence(refugees) : "";
  if (!refugees) fail("no RefugeesEvent");
  const walker = residents.find((id) => civilOrderOf(id)?.kind === "migrate");
  if (!walker) fail("no survivor carries a migrate order");
  else {
    const p = W.components.position[walker]; p.x = settlement.x; p.y = settlement.y; rebuildSpatialBins();
    gran.arrivals();
    if (W.components.social[walker].homePlaceId !== settlement.id) fail("the refugee did not settle in the refuge");
  }
  // Settlers prefer the ruin, and the town raised there inherits crafts.
  out.ruinSite = after.ruinSite(settlement.id);
  if (out.ruinSite !== idx(doomed.x, doomed.y)) fail("the ruin was not offered as a settler site: " + out.ruinSite);
  const founder = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && id !== walker);
  const camp = createCamp(idx(doomed.x, doomed.y), founder);
  if (!camp) fail("no camp could be raised on the ruin");
  else {
    for (const type of ["stockpile", "shelter", "hearth"]) complete(camp, type);
    const reborn = createSettlement(camp.id);
    if (!reborn) fail("no town rose on the ruin");
    else {
      out.reborn = { name: reborn.name, from: reborn.resettledFrom, crafts: reborn.knownProcesses.slice() };
      if (reborn.resettledFrom !== doomed.name) fail("the new town does not remember the ruin it rose on");
      if (!reborn.knownProcesses.some((t) => ["controlled_fire", "ceramics", "masonry", "storage"].includes(t))) fail("nothing of the dead town's crafts was found again");
      const rose = W.events.filter((e) => e.type === "SettlementResettledEvent").at(-1);
      out.rose = rose ? eventSentence(rose) : "";
      if (!rose) fail("no SettlementResettledEvent");
      if (!/Raised on/.test(window.ALIFE_LEGENDS_DEBUG.render("place", reborn.id))) fail("the place page does not say what it rose on");
      // A thin town receives colonists from the polity's largest town.
      reborn.factionId = settlement.factionId;
      const crowd = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]?.homePlaceId !== reborn.id);
      let placed = 0;
      for (const id of crowd) { if (placed >= 18) break; const soc = W.components.social[id]; soc.homePlaceKind = "settlement"; soc.homePlaceId = settlement.id; soc.factionId = settlement.factionId; const l = W.components.life[id]; l.hunger = Math.min(l.hunger, 30); l.age = Math.max(l.age, 5000); const p = W.components.position[id]; p.x = clamp(settlement.x + (placed % 5) - 2, 0, W.width - 1); p.y = clamp(settlement.y + Math.floor(placed / 5) - 1, 0, W.height - 1); placed++; }
      rebuildSpatialBins();
      settlement.inventory[C.ORGANIC] = 600; settlement.inventory[C.ENERGY] = 100;
      out.source = after.source(reborn.id);
      const colonists = after.colonists(reborn.id, true);
      out.colonists = colonists ? eventSentence(colonists) : "";
      if (!colonists) fail("no colonists were sent: source " + out.source + " pop " + settlementPopulation(settlement));
    }
  }
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_AFTERMATH_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_AFTERMATH_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
