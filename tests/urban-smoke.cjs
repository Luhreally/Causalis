// Urban smoke: once a polity knows letters, its largest town (a hall preferred)
// is the pull of the city; a yearly pull sends a few villagers walking to it as
// migrants who take it as their home on arrival, never draining a village
// below its floor; the pull is chronicled and counted on the town's page; and
// the great town sends out fewer settlers than it would as a village.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const urban = window.ALIFE_URBAN_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let hub = null;
  for (let attempt = 0; attempt < 4 && !hub; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    hub = W.settlements.find((s) => !s.ruined);
    if (!hub) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); hub = W.settlements.find((s) => !s.ruined); } }
  }
  if (!hub) { fail("no settlement"); return out; }
  if (!hub.factionId) createFaction(hub.id);
  const f = W.factions.find((x) => x.id === hub.factionId);
  const complete = (place, type) => {
    const b = planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === (place.knownProcesses ? "settlement" : "camp") && x.placeId === place.id && x.type === type);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  const freeFounder = () => {
    const id = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && !W.components.social[id]?.homePlaceId) || W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
    if (id) { const soc = W.components.social[id]; if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; } }
    return id;
  };
  const raiseTown = (cx, cy) => {
    for (let tries = 0; tries < 60; tries++) {
      const x = clamp(cx + (tries % 6), 3, W.width - 4), y = clamp(cy + Math.floor(tries / 6), 3, W.height - 4), t = idx(x, y);
      if (W.tiles.liquid[t] > WATER_DEPTH.SURFACE || campNear(t, 6) || nearestSettlement(t, 10)) continue;
      const founder = freeFounder();
      if (!founder) return null;
      const camp = createCamp(t, founder);
      if (!camp) continue;
      for (const type of ["stockpile", "shelter", "hearth"]) complete(camp, type);
      const town = createSettlement(camp.id);
      if (town) return town;
    }
    return null;
  };
  const village = raiseTown(hub.x + 12, hub.y - 6);
  if (!village) { fail("could not raise the village"); return out; }
  village.factionId = f.id;
  // People: most at the hub, a dozen at the village, all of the polity; the small world is topped up.
  const living = () => W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.position[id]);
  for (let n = 0; living().length < 34 && n < 40; n++) createOrganism(KINDS.PERSON, hub.x, hub.y, makeRng(hashParts(W.seedHash, "urban-fixture", n), "birth"), []);
  const people = living();
  out.people = people.length;
  if (people.length < 24) { fail("too few people: " + people.length); return out; }
  people.forEach((id, i) => {
    const soc = W.components.social[id], p = W.components.position[id], target = i < 12 ? village : hub;
    soc.homePlaceKind = "settlement"; soc.homePlaceId = target.id; soc.factionId = f.id;
    p.x = clamp(target.x + (i % 3) - 1, 1, W.width - 2); p.y = clamp(target.y + (Math.floor(i / 3) % 3) - 1, 1, W.height - 2);
    const life = W.components.life[id]; if (life) { life.hunger = Math.min(life.hunger, 30); life.wounded = false; }
    const body = W.components.body[id]; if (body && life) life.age = Math.max(life.age, body.maxAge * 0.3);
    clearStaleWork(id);
    if (typeof clearCivilOrder === "function") clearCivilOrder(id);
  });
  rebuildSpatialBins();
  out.hubPop = settlementPopulation(hub); out.villagePop = settlementPopulation(village);
  // The age of the city: letters and a hall; beds to spare at the hub.
  for (const t of W.settlements) if (t.factionId === f.id) t.knownProcesses = t.knownProcesses.filter((x) => !["writing", "governance", "census", "public_works"].includes(x));
  out.ageBefore = urban.age(f.id);
  hub.knownProcesses.push("writing");
  out.ageWithLetters = urban.age(f.id);
  if (!out.ageWithLetters) fail("letters do not open the age of the city");
  if (!hub.knownProcesses.includes("governance")) hub.knownProcesses.push("governance");
  complete(hub, "hall");
  for (let n = 0; n < 4; n++) complete(hub, "shelter");
  hub.inventory[C.ORGANIC] = Math.max(hub.inventory[C.ORGANIC], 400);
  out.ageAfter = urban.age(f.id);
  if (out.ageBefore) fail("the age of the city came before letters");
  if (!out.ageAfter) fail("governance does not open the age of the city");
  out.hub = urban.hub(f.id);
  if (out.hub !== hub.id) fail("the largest town with a hall is not the hub: " + out.hub);
  out.room = urban.room(hub.id);
  out.beds = housingCapacity(hub);
  // The pull: villagers are sent as migrants, the village keeps its floor.
  const ev = urban.pull(f.id, true);
  if (!ev) { fail("no pull happened"); return out; }
  out.pull = eventSentence(ev);
  const movers = ev.subjects.filter((id) => id !== hub.entityId);
  out.movers = movers.length;
  if (!(movers.length >= 1) || movers.length > 2) fail("the pull took the wrong number: " + movers.length);
  for (const id of movers) {
    const order = civilOrderOf(id);
    if (!order || order.kind !== "migrate" || order.placeId !== hub.id) fail("a mover carries no migrate order to the hub");
  }
  if (!(settlementPopulation(village) >= 8)) fail("the village was drained below its floor");
  if (!(hub.urbanIn >= movers.length)) fail("the hub does not count who it drew in");
  // Arrival: they take the city as their home.
  for (const id of movers) { const p = W.components.position[id]; p.x = hub.x; p.y = hub.y; }
  rebuildSpatialBins();
  updateMigrations();
  for (const id of movers) if (W.components.social[id].homePlaceId !== hub.id) fail("a migrant did not take the city as home");
  // The page counts them; the great town sends out fewer settlers.
  if (!/Drawn in/.test(renderLegendPage("place", hub.id))) fail("the hub's page shows no migrants");
  out.urgeHub = settlerUrge(hub);
  const keepKnown = hub.knownProcesses.slice();
  hub.knownProcesses = hub.knownProcesses.filter((t) => !["writing", "governance"].includes(t));
  out.urgeVillageAge = settlerUrge(hub);
  hub.knownProcesses = keepKnown;
  if (!(out.urgeHub < out.urgeVillageAge)) fail("the great town sends out as many settlers as a village: " + out.urgeHub + " vs " + out.urgeVillageAge);
  // A hungry or restless hub pulls nobody without force.
  const keepFood = hub.inventory[C.ORGANIC];
  hub.inventory[C.ORGANIC] = 0;
  for (const id of W.activeIds) if (W.kind[id] === KINDS.PERSON && W.components.social[id]?.homePlaceId === village.id) { const life = W.components.life[id]; if (life) life.hunger = 20; }
  village.lastUrbanTick = -1e9;
  out.hungryPull = settlementFood(hub) < 5 ? urban.pull(f.id, false) : "skipped";
  hub.inventory[C.ORGANIC] = keepFood;
  if (out.hungryPull && out.hungryPull !== "skipped") fail("a hungry hub still pulled villagers in");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_URBAN_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_URBAN_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
