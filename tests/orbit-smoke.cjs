// Orbit smoke: the seed lays down a star catalogue, an observatory charts it,
// the ladder gains orbital and interstellar rungs with honest gates, a ship
// picks a charted star and founds a colony on arrival that the chronicle,
// the Stars page and the polity page all record.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const orbit = window.ALIFE_ORBIT_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  const stars = orbit.stars();
  out.stars = stars.length;
  if (!(stars.length >= 6 && stars.length <= 9)) fail("the catalogue has an odd number of stars: " + stars.length);
  if (stars.some((s) => !s.name || !(s.habitability > 0 && s.habitability < 1) || !(s.distance > 0))) fail("a star is malformed: " + JSON.stringify(stars[0]));
  for (let i = 1; i < stars.length; i++) if (stars[i].distance < stars[i - 1].distance) fail("stars are not sorted by distance");
  // The ladder runs past the ground.
  const order = CIV_STAGE_ORDER;
  out.ladder = order.slice(-3);
  if (order.indexOf("orbital") !== order.indexOf("complex terrestrial") + 1 || order.at(-1) !== "interstellar") fail("the ladder does not run terrestrial -> orbital -> interstellar: " + order.join(","));
  if (civilizationStageGate(order.indexOf("orbital"))) fail("orbital was reached before any ship left");
  if (civilizationStageGate(order.indexOf("interstellar"))) fail("interstellar was reached before any colony");
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const complete = (type) => {
    const b = planBuilding(settlement, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === settlement.id && x.type === type && !x.complete);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  // Nothing is charted without astronomy and an observatory; then the nearest star is.
  if (orbit.chart(false)) fail("a star was charted without an observatory");
  for (const t of ["writing", "navigation", "astronomy", "starflight"]) if (!settlement.knownProcesses.includes(t)) settlement.knownProcesses.push(t);
  complete("observatory");
  const charted = orbit.chart(false);
  out.charted = charted ? eventSentence(charted) : "";
  if (!charted) fail("the observatory charted nothing");
  if (orbit.stars().filter((s) => s.chartedTick).length !== 1) fail("more or fewer than one star was charted");
  if (!orbit.stars().find((s) => s.chartedTick).distance === stars[0].distance) fail("the nearest star was not charted first");
  W.civilization.stageIndex = order.indexOf("complex terrestrial"); W.civilization.stage = "complex terrestrial";
  const gateBefore = civilizationGateStatus();
  out.orbitalGate = gateBefore?.missing || [];
  if (gateBefore?.next !== "orbital" || !out.orbitalGate.some((m) => /Launch tower|first ship/.test(m))) fail("the orbital gate does not say what is missing: " + JSON.stringify(gateBefore));
  // A ship leaves for the charted star.
  complete("launch_tower");
  settlement.stability = Math.max(settlement.stability, 0.6);
  const ascension = orbit.launch(settlement.id, true);
  if (!ascension) { fail("no ship launched"); return out; }
  const voyage = orbit.voyages()[0];
  out.voyage = voyage ? { name: voyage.name, star: voyage.starName, status: voyage.status, years: Math.round((voyage.arriveTick - voyage.departTick) / TICKS_PER_YEAR), crew: voyage.crew.length, crafts: voyage.crafts.length } : null;
  if (!voyage || voyage.status !== "under way" || !voyage.starName) fail("the ship has no destination: " + JSON.stringify(out.voyage));
  if (!civilizationStageGate(order.indexOf("orbital"))) fail("the first ship did not open the orbital stage");
  const between = civilizationGateStatus();
  W.civilization.stageIndex = order.indexOf("orbital"); W.civilization.stage = "orbital";
  const gateMid = civilizationGateStatus();
  out.interstellarGate = gateMid?.missing || [];
  if (gateMid?.next !== "interstellar" || !out.interstellarGate.some((m) => /colony/.test(m))) fail("the interstellar gate does not name the colony to come: " + JSON.stringify(gateMid));
  const stages = causalSkipMicroStages().map((s) => s.key);
  if (!stages.includes("colony")) fail("the skip does not aim at a colony: " + stages.join(","));
  // Arrival founds a colony.
  const founded = orbit.arrive(voyage.id);
  out.founded = founded.length ? eventSentence(founded[0]) : "";
  if (!founded.length) fail("arrival founded no colony");
  const colony = orbit.colonies()[0];
  if (!colony || colony.status !== "founded" || colony.knownProcesses.length !== voyage.crafts.length) fail("the colony is malformed: " + JSON.stringify(colony));
  if (!civilizationStageGate(order.indexOf("interstellar"))) fail("a founded colony did not open the interstellar stage");
  if (founded.length && !alertWorthy(founded[0])) fail("the founding does not reach the alert feed");
  const pop = colony.population; orbit.grow(); W.tick += TICKS_PER_YEAR; orbit.grow();
  out.colonyGrowth = { before: pop, after: orbit.colonies()[0].population };
  const page = window.ALIFE_LEGENDS_DEBUG.render("stars", 0);
  if (!page.includes(colony.name) || !page.includes(voyage.name)) fail("the Stars page does not show the ship and colony");
  const colonyPage = window.ALIFE_LEGENDS_DEBUG.render("colony", colony.id);
  if (!colonyPage.includes(settlement.name)) fail("the colony page does not name its origin");
  if (!/Worlds held/.test(window.ALIFE_LEGENDS_DEBUG.render("faction", settlement.factionId))) fail("the polity page does not count its worlds");
  if (!/The stars/.test(renderLegendIndex(""))) fail("the Legends index has no Stars card");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_ORBIT_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_ORBIT_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
