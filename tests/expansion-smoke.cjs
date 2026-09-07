// Expansion smoke: caps scale with the map, a vast preset exists, and a town
// sends settlers who raise a camp of the same polity, all chronicled.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const ex = window.ALIFE_EXPANSION_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  // Presets and caps.
  if (!SIZE_PRESETS.vast || SIZE_PRESETS.vast[0] !== 300) fail("no vast preset");
  out.caps = ex.caps();
  if (out.caps.person !== 250 || out.caps.faction !== 12) fail("a small map changed the base caps");
  out.vastCaps = ex.scale(300, 180);
  if (!(out.vastCaps.person > 380 && out.vastCaps.faction >= 18 && out.vastCaps.settlement >= 60)) fail("vast caps did not scale up");
  ex.scale(W.width, W.height);
  if (ex.caps().person !== 250) fail("caps did not restore for the small map");
  // A town sends settlers.
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  // Grown, fed residents are the ones a town can spare.
  for (const place of W.settlements) if (!place.ruined) for (const id of entityAtRadius(idx(place.x, place.y), 6, KINDS.PERSON)) { const l = W.components.life[id], soc = W.components.social[id]; if (!l || !soc) continue; l.age = Math.max(l.age, 4000); l.hunger = Math.min(l.hunger || 0, 30); l.wounded = false; soc.factionId = place.factionId; }
  const before = W.camps.filter((c) => c.active).length;
  let expedition = null;
  for (const place of W.settlements) { if (place.ruined) continue; expedition = ex.settle(place.id, true); if (expedition) { settlement = place; break; } }
  if (!expedition) { fail("no settlers could be sent: sites " + W.settlements.map((s) => ex.site(s.id)).join(",")); return out; }
  out.members = expedition.members.length;
  if (out.members < 3) fail("fewer than three settlers");
  if (civilOrderOf(expedition.members[0])?.kind !== "settle") fail("settlers were given no settle order");
  const leaving = W.events.find((e) => e.type === "ExpeditionEvent");
  if (!leaving) fail("no ExpeditionEvent"); else out.leaving = eventSentence(leaving);
  simTick();
  const l = W.components.life[expedition.members[0]];
  if (l?.behavior === "march" && l.behaviorReason !== "walking out to found a new camp") fail("settlers march for the wrong reason: " + l.behaviorReason);
  out.urge = ex.urge(settlement.id);
  if (!(out.urge > 0 && out.urge < 1)) fail("urge out of range");
  // They arrive and raise a camp.
  const [tx, ty] = xy(expedition.target);
  for (const id of expedition.members) { const p = W.components.position[id]; if (p) { p.x = tx; p.y = ty; } }
  ex.tick();
  const done = ex.expeditions().find((e) => e.id === expedition.id);
  if (done.active) fail("the expedition did not end on arrival");
  const camp = W.camps.find((c) => c.id === done.campId);
  if (!camp) { fail("no camp was raised"); return out; }
  if (camp.settledFrom !== settlement.id) fail("the camp does not remember its town");
  if (camp.factionId !== settlement.factionId) fail("the camp belongs to another polity");
  if (W.camps.filter((c) => c.active).length <= before) fail("no new active camp");
  const founded = W.events.find((e) => e.type === "SettlersEvent");
  if (!founded) fail("no SettlersEvent"); else out.founded = eventSentence(founded);
  for (const id of expedition.members) if (civilOrderOf(id)) fail("a settler still carries an order");
  if (!/Settled from/.test(window.ALIFE_LEGENDS_DEBUG.render("camp", camp.id))) fail("the camp page does not say where it was settled from");
  // A prospector fetches a research material from far away and brings it home.
  const oreTile = ex.resourceWithin(settlement.id, C.ORE, 40);
  if (oreTile < 0) { out.prospectSkipped = "no ore within forty tiles"; }
  else {
    const before2 = settlement.inventory[C.ORE];
    const journey = ex.prospect(settlement.id, C.ORE, oreTile);
    if (!journey) fail("no prospector left");
    else {
      out.prospecting = eventSentence(W.events.find((e) => e.type === "ProspectingEvent"));
      if (civilOrderOf(journey.personId)?.kind !== "prospect") fail("the prospector carries no order");
      const [ox, oy] = xy(oreTile), pp = W.components.position[journey.personId];
      pp.x = ox; pp.y = oy;
      ex.tickProspectors();
      const mid = ex.journeys().find((j) => j.id === journey.id);
      if (mid.phase !== "home" || !(mid.carried > 0)) fail("the prospector dug nothing: " + JSON.stringify({ phase: mid.phase, carried: mid.carried }));
      pp.x = settlement.x; pp.y = settlement.y;
      ex.tickProspectors();
      const done = ex.journeys().find((j) => j.id === journey.id);
      if (done.active) fail("the prospector never came home");
      if (!(settlement.inventory[C.ORE] > before2)) fail("the town gained no ore");
      const back = W.events.find((e) => e.type === "ProspectorReturnedEvent");
      if (!back) fail("no ProspectorReturnedEvent"); else out.returned = eventSentence(back);
    }
  }
  // A material wanted for research counts as a deficit, so a neighbour with a surplus sends it.
  const needs = eligibleResearchMaterialNeeds(settlement), targets = economicTargets(settlement),
    need = needs.find((n) => !targets.get(n.sp)) || needs[0];
  if (!need) out.tradeSkipped = "the town wants no research material";
  else {
    settlement.inventory[need.sp] = 0; settlement.researchInventory[need.sp] = 0;
    out.researchWant = W.definitions.species[need.sp].name + (targets.get(need.sp) ? " (also an economic target)" : " (research only)");
    out.researchDeficit = materialDeficit(settlement, need.sp);
    if (!(out.researchDeficit >= need.target)) fail("a research material the town lacks is not a want in trade: " + out.researchDeficit);
    const other = W.settlements.find((s) => !s.ruined && s !== settlement);
    if (other) {
      other.inventory[need.sp] = 40;
      const deal = bestInternalTransfer(other, settlement);
      out.deal = deal ? W.definitions.species[deal.sp].name + " x" + deal.amount : "";
      if (!deal || deal.sp !== need.sp) fail("the neighbour would not send the research material: " + out.deal);
    }
  }
  // A builder fetches pigment a prospector brought home from the stores instead of searching the ground.
  const shrine = planBuilding(settlement, "shrine", 9) || W.buildings.find((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === settlement.id && b.type === "shrine" && !b.complete);
  if (!shrine) out.storesSkipped = "no shrine could be planned";
  else {
    for (const b of activeBuildings(settlement)) if (b !== shrine) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; }
    for (const [sp, n] of shrine.requirements) if (sp !== C.PIGMENT) shrine.composition[sp] = n;
    shrine.composition[C.PIGMENT] = 0;
    settlement.inventory[C.PIGMENT] = 20; settlement.researchInventory[C.PIGMENT] = 10;
    const builder = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && isAdultPerson(id) && W.components.social[id].homePlaceId === settlement.id) || W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && isAdultPerson(id));
    if (!builder) out.storesSkipped = "no builder";
    else {
      const bp = W.components.position[builder]; bp.x = settlement.x; bp.y = settlement.y; rebuildSpatialBins();
      { const q = W.components.chemistry[builder].q; q[C.ORGANIC] = Math.max(q[C.ORGANIC], 80); q[C.NUTRIENT] = Math.max(q[C.NUTRIENT], 40); q[C.SOLVENT] = Math.max(q[C.SOLVENT], 160); q[C.INFO] = Math.max(q[C.INFO], 40); q[C.MEMBRANE] = Math.max(q[C.MEMBRANE], 50); q[C.ENERGY] = Math.max(q[C.ENERGY], 400); const l = W.components.life[builder]; l.integrity = Math.max(l.integrity, 900); }
      const ws0 = workState(builder); ws0.task = "idle"; ws0.targetTile = -1;
      const carried = W.components.inventory[builder].materials, stockBefore = settlement.inventory[C.PIGMENT];
      carried[C.PIGMENT] = 0;
      let drew = false;
      // The bare labor step, under the safety, maintenance and homeostasis wrappers.
      for (let i = 0; i < 6 && !drew; i++) { performCivilLaborSafetyBase(builder); drew = carried[C.PIGMENT] > 0 || shrine.composition[C.PIGMENT] > 0; }
      const ws = workState(builder), order = selectWorkOrder(builder, settlement), nearestPlace = nearestWorkPlace(builder);
      out.stores = { drew, stock: settlement.inventory[C.PIGMENT], carried: carried[C.PIGMENT], placed: shrine.composition[C.PIGMENT], doing: ws.task + "/" + (ws.phase || ""), order: order ? order.type + ":" + order.buildingId : "none", shrineId: shrine.id, nearest: nearestPlace ? nearestPlace.name + "=" + (nearestPlace === settlement) : "none", missing: JSON.stringify(missingBuildingMaterial(shrine)), active: activeBuildings(settlement).map((b) => b.type + (b === shrine ? "*" : "")).join(",") };
      if (!drew) fail("the builder did not draw pigment from the stores: " + JSON.stringify(out.stores));
      if (drew && settlement.inventory[C.PIGMENT] >= stockBefore) fail("the stores did not shrink when pigment was drawn");
    }
  }
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_EXPANSION_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_EXPANSION_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
