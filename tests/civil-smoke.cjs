// Civil smoke: a polity that knows governance adopts a law code from its
// ideology; feuds cool faster under any code and the blood-price settles a
// cooled one; under fines a robber returns what was taken and under
// banishment a twice-caught robber is driven out; children learn their
// parents' best craft and lore from an archive; and specialist circles calm a
// town and petition the polity when unrest climbs.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const civil = window.ALIFE_CIVIL_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const f = W.factions.find((x) => x.id === settlement.factionId);
  if (!f) { fail("no faction"); return out; }
  const complete = (type) => {
    const b = planBuilding(settlement, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === settlement.id && x.type === type && !x.complete);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.identity[id] && W.components.inventory[id] && W.components.position[id]);
  if (people.length < 3) { fail("too few people"); return out; }
  const houseOf = (id) => W.components.social[id].kinGroupId;
  // ── The law has a code ──
  if (!settlement.knownProcesses.includes("governance")) settlement.knownProcesses.push("governance");
  out.choice = civil.choose(f.id);
  out.adopted = civil.adopt();
  out.law = civil.law(f.id);
  if (!Object.keys(civil.codes()).includes(out.law)) fail("no law code was adopted: " + out.law);
  if (out.law !== out.choice) fail("the adopted code is not the chosen one");
  const lawEvent = W.events.find((e) => e.type === "LawEvent");
  if (!lawEvent) fail("no LawEvent"); else out.lawSentence = eventSentence(lawEvent);
  if (!/Law/.test(renderLegendPage("faction", f.id))) fail("the polity page does not name the law");
  // ── Feuds cool under the law, and the blood-price settles them ──
  const a = people[0], b = people.find((id) => houseOf(id) !== houseOf(a));
  if (!b) { fail("everyone shares one house"); return out; }
  for (const id of [a, b]) { const soc = W.components.social[id]; soc.homePlaceKind = "settlement"; soc.homePlaceId = settlement.id; soc.factionId = f.id; }
  const feud = beginFeud(houseOf(a), houseOf(b), 0, a, b);
  feud.heat = 2;
  updateFeuds();
  out.heatAfter = feud.heat;
  if (feud.ended || !(feud.heat <= 1.7)) fail("the law did not cool the feud: " + feud.heat + " ended " + feud.ended);
  f.law.code = "wergild";
  feud.heat = 1.0; feud.lastTick = W.tick;
  updateFeuds();
  out.feudEnd = feud.endReason || "";
  if (!feud.ended || !/blood-price/.test(feud.endReason)) fail("the blood-price did not settle the cooled feud: " + feud.endReason);
  // ── Fines return what was taken ──
  f.law.code = "fines";
  const pa = W.components.position[a], pb = W.components.position[b];
  pa.x = settlement.x; pa.y = settlement.y; pb.x = settlement.x; pb.y = settlement.y;
  const mouth = W.components.inventory[a].digestive, carried = W.components.inventory[b].materials;
  carried[C.ORGANIC] = 10; mouth[C.ORGANIC] = Math.min(mouth[C.ORGANIC], 100);
  const identA = W.components.identity[a];
  identA.crimes = 0;
  const matterBefore = totalMatter();
  const robbery = robOfFood(a, b, 90);
  out.fined = carried[C.ORGANIC];
  if (!robbery) fail("no robbery happened in the fixture");
  else if (carried[C.ORGANIC] !== 10) fail("the fine did not return the food: " + carried[C.ORGANIC]);
  if (totalMatter() !== matterBefore) fail("the judgement created or destroyed matter");
  const fineEvent = W.events.filter((e) => e.type === "JudgementEvent").at(-1);
  if (!fineEvent || fineEvent.data?.banished) fail("no fine was judged"); else out.fineSentence = eventSentence(fineEvent);
  // ── Banishment drives out the twice-caught ──
  f.law.code = "exile";
  identA.crimes = 1;
  carried[C.ORGANIC] = 10;
  const second = robOfFood(a, b, 90);
  out.crimes = identA.crimes;
  const exiled = (W.civilOrders || []).find((o) => o.id === a && o.kind === "exile");
  if (!second) fail("no second robbery");
  else if (!exiled) fail("a twice-caught robber was not banished");
  const banishEvent = W.events.filter((e) => e.type === "JudgementEvent").at(-1);
  if (banishEvent?.data?.banished) out.banishSentence = eventSentence(banishEvent);
  if (exiled && typeof clearCivilOrder === "function") clearCivilOrder(a);
  // ── Children learn ──
  let child = people.find((id) => id !== a && id !== b && !isAdultPerson(id) && (W.components.identity[id].parents || []).some((p) => classifyAlive(p)));
  const teacher = b;
  if (!child) {
    child = people.find((id) => id !== a && id !== b);
    if (!child) { fail("no one to teach"); return out; }
    W.components.life[child].age = 100;
    W.components.identity[child].parents = [teacher];
  }
  const parentOf = (W.components.identity[child].parents || []).find((p) => classifyAlive(p)) || teacher;
  const parentIdent = characterOf(parentOf);
  for (const k of Object.keys(parentIdent.skills)) parentIdent.skills[k] = 0;
  parentIdent.skills.craft = 60;
  const childIdent = characterOf(child);
  childIdent.skills.craft = 0; childIdent.skills.lore = 0;
  const cs = W.components.social[child]; cs.homePlaceKind = "settlement"; cs.homePlaceId = settlement.id;
  complete("archive");
  out.lessons = civil.teachOne(child);
  out.childCraft = childIdent.skills.craft; out.childLore = childIdent.skills.lore;
  if (!(out.childCraft > 0)) fail("the child learned nothing from the parent's craft");
  if (!(out.childLore > 0)) fail("the child learned no lore from the archive");
  // ── Circles speak ──
  out.calmBefore = civil.calm(settlement.id);
  createObservedInstitution("specialist_circle", settlement.name + " artisan circle", [settlement.id], 0);
  out.calmAfter = civil.calm(settlement.id);
  out.circles = civil.circles(settlement.id);
  if (!(out.calmAfter > out.calmBefore)) fail("a circle did not calm the town");
  if (!out.circles.some((n) => /artisan circle/.test(n))) fail("the circle is not listed");
  if (!/Circles/.test(renderLegendPage("place", settlement.id))) fail("the place page does not name the circles");
  settlement.unrest = 0.5; settlement.lastPetitionTick = -1e9;
  out.petitions = civil.petition();
  if (!(out.petitions >= 1) || !(settlement.unrest < 0.5)) fail("the circle's petition was not heard: " + settlement.unrest);
  const petition = W.events.find((e) => e.type === "PetitionEvent");
  if (!petition) fail("no PetitionEvent"); else out.petitionSentence = eventSentence(petition);
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_CIVIL_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_CIVIL_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
