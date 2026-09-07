// Technology smoke: the extended tree is in the catalogue with facilities and
// priors, its crafts change inquiry, the work face, and hygiene, printing puts
// a polity's crafts on record, the ladder of ages has Electricity and
// Information rungs and re-tiers old archives, milestones are recorded once,
// and the Technology page and index card render.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const tech = window.ALIFE_TECH_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  const ids = ["wheel", "road_building", "currency", "mathematics", "printing", "optics", "chemistry", "germ_theory", "electricity", "combustion", "railways", "radio", "computing", "satellites", "fusion", "ecological_engineering"];
  const catalog = tech.catalog();
  out.catalog = catalog.length;
  for (const id of ids) if (!catalog.includes(id)) fail("the catalogue lacks " + id);
  if (technologyDefinition("wheel")?.facility !== "workshop" || facilityForTechnology("wheel") !== "workshop") fail("the wheel has no workshop");
  if (!technologyDefinition("computing")?.prior.includes("electricity")) fail("computing does not follow electricity");
  out.ladder = tech.ladder();
  if (out.ladder.length !== 9 || out.ladder[5] !== "Electricity" || out.ladder[6] !== "Information" || out.ladder[8] !== "Stars") fail("the ladder of ages is wrong: " + out.ladder.join(","));
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const know = (...ts) => { for (const t of ts) if (!settlement.knownProcesses.includes(t)) settlement.knownProcesses.push(t); };
  const forget = (...ts) => { settlement.knownProcesses = settlement.knownProcesses.filter((t) => !ts.includes(t)); };
  forget("mathematics", "optics", "printing", "computing", "mechanization", "electricity", "fusion", "sanitation", "germ_theory");
  // Inquiry and the work face.
  out.research = [tech.research(settlement.id)];
  know("mathematics"); out.research.push(tech.research(settlement.id));
  know("printing", "computing"); out.research.push(tech.research(settlement.id));
  if (out.research[0] !== 1 || Math.abs(out.research[1] - 1.2) > 1e-9 || !(out.research[2] > 2 && out.research[2] <= 2.4)) fail("inquiry does not quicken with the crafts: " + JSON.stringify(out.research));
  out.construction = [tech.construction(settlement.id)];
  know("mechanization"); out.construction.push(tech.construction(settlement.id));
  know("electricity"); out.construction.push(tech.construction(settlement.id));
  if (out.construction[0] !== 1 || out.construction[1] !== 1.25 || Math.abs(out.construction[2] - 1.5625) > 1e-9) fail("the work face does not quicken with engines and current: " + JSON.stringify(out.construction));
  // Hygiene at home.
  const resident = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]);
  if (!resident) fail("no resident to test hygiene");
  else {
    const soc = W.components.social[resident]; soc.homePlaceKind = "settlement"; soc.homePlaceId = settlement.id;
    out.hygiene = [tech.hygiene(resident)];
    know("sanitation"); out.hygiene.push(tech.hygiene(resident));
    know("germ_theory"); out.hygiene.push(tech.hygiene(resident));
    if (out.hygiene[0] !== 1 || Math.abs(out.hygiene[1] - 0.6) > 1e-9 || Math.abs(out.hygiene[2] - 0.3) > 1e-9) fail("sanitation and germ theory do not thin the pathogens: " + JSON.stringify(out.hygiene));
  }
  // The ladder of ages.
  forget("computing", "planetary_stewardship");
  out.tier = [tech.tier(settlement.id)];
  if (out.tier[0] !== 5) fail("a town with electricity is not in the Age of Electricity: " + out.tier[0]);
  know("computing"); out.tier.push(tech.tier(settlement.id));
  if (out.tier[1] !== 6) fail("a town with computing is not in the Age of Information: " + out.tier[1]);
  know("planetary_stewardship"); out.tier.push(tech.tier(settlement.id));
  if (out.tier[2] !== 7) fail("stewardship is not the seventh rung: " + out.tier[2]);
  W.ages.push({ tier: 5, gloss: "Stewardship", name: "", tick: W.tick, eventId: 0, place: "", factionId: 0 });
  out.retiered = tech.retier();
  if (out.retiered < 1 || W.ages.at(-1).tier !== 7) fail("an old archive's Stewardship age was not re-tiered: " + JSON.stringify(W.ages.at(-1)));
  W.ages.pop();
  // Printing puts the polity's crafts on record.
  forget("wheel");
  know("printing");
  out.recordedBefore = tech.recorded(settlement.id, "wheel");
  know("wheel");
  out.recordedAfter = tech.recorded(settlement.id, "wheel");
  if (out.recordedBefore || !out.recordedAfter) fail("printing does not put a known craft on record: " + JSON.stringify([out.recordedBefore, out.recordedAfter]));
  forget("wheel");
  // A new craft is eligible for research like any other once its priors, materials, and facility are met.
  know("tools", "ceramics");
  const complete = (type) => {
    const b = planBuilding(settlement, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === settlement.id && x.type === type && !x.complete);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  complete("workshop");
  settlement.inventory[C.FIBER] = Math.max(settlement.inventory[C.FIBER], 12);
  settlement.inventory[C.MINERAL] = Math.max(settlement.inventory[C.MINERAL], 12);
  settlement.stability = Math.max(settlement.stability, 0.6);
  settlement.researchProgress = settlement.researchProgress || {};
  delete settlement.researchProgress.wheel;
  updateTechnology();
  out.wheelProgress = settlement.researchProgress.wheel || 0;
  if (!(out.wheelProgress > 0)) fail("the wheel gathers no research in a town with tools, ceramics, a workshop, fibre, and mineral");
  // Milestones are recorded once and reach the chronicle and the alerts.
  const ev = tech.milestone("test-first", "A test first was passed", settlement.id);
  if (!ev) fail("no milestone was recorded");
  else {
    out.milestone = eventSentence(ev);
    if (!/A test first was passed\./.test(out.milestone)) fail("the milestone sentence is wrong: " + out.milestone);
    if (!alertWorthy(ev)) fail("a milestone does not reach the alerts");
  }
  if (tech.milestone("test-first", "again", settlement.id) !== null) fail("a milestone was recorded twice");
  out.milestones = tech.milestones().length;
  tech.check();
  // The Technology page and its index card.
  const page = tech.page();
  if (!page.includes("The Wheel") || !page.includes("Letters and law") || !page.includes("A test first")) fail("the Technology page is missing crafts or milestones");
  if (!/Technology/.test(renderLegendIndex(""))) fail("the Legends index has no Technology card");
  if (!/The Wheel/.test(window.ALIFE_LEGENDS_DEBUG.render("technology", 0))) fail("the technology page does not render through Legends");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_TECH_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_TECH_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
