// Granary smoke: farms and stores scale with the people they feed, lean stores
// stretch the rations, a hungry town's neighbour sends relief by the load,
// starving households walk to a fed town and settle there, hungry towns send
// settlers sooner, births slow in famine, and the chronicle and place page say so.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const gran = window.ALIFE_GRANARY_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
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
  // A second town of the same polity, well fed, within reach.
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  let second = null;
  for (let tries = 0; tries < 400 && !second && people.length; tries++) {
    const x = clamp(settlement.x + 14 + (tries % 7), 3, W.width - 4), y = clamp(settlement.y - 12 + Math.floor(tries / 7) * 3, 3, W.height - 4), t = idx(x, y);
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
  // Farms and stores scale with population: pretend the first town holds forty.
  const residents = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  let placed = 0;
  for (const id of residents) { if (placed >= 12) break; const soc = W.components.social[id]; if (soc?.homePlaceId === second.id) continue; soc.homePlaceKind = "settlement"; soc.homePlaceId = settlement.id; soc.factionId = settlement.factionId; const l = W.components.life[id]; l.age = Math.max(l.age, 5000); const p = W.components.position[id]; p.x = clamp(settlement.x + (placed % 4) - 2, 0, W.width - 1); p.y = clamp(settlement.y + Math.floor(placed / 4) - 1, 0, W.height - 1); placed++; }
  rebuildSpatialBins();
  const before = gran.plan(settlement.id);
  out.outlook = gran.outlook(settlement.id);
  out.plan = gran.plan(settlement.id);
  const wantFarms = Math.min(6, Math.ceil(out.outlook.pop / 8));
  if (!(out.plan.farms >= Math.min(wantFarms, 2) || out.plan.active >= 6)) fail("farms did not scale with population: " + JSON.stringify(out.plan) + " pop " + out.outlook.pop);
  // Lean stores stretch the rations; famine stretches them thin.
  settlement.inventory[C.ORGANIC] = 0; settlement.inventory[C.ENERGY] = 0;
  for (const t of [idx(settlement.x, settlement.y), ...neighbors4(idx(settlement.x, settlement.y))]) { setTileMatterAmount(t, C.ORGANIC, 0); setTileMatterAmount(t, C.ENERGY, 0); }
  out.famineOutlook = gran.outlook(settlement.id);
  out.ration = gran.ration(settlement.id);
  if (!out.famineOutlook.famine) fail("an empty store is not a famine: " + JSON.stringify(out.famineOutlook));
  if (out.ration !== 8) fail("famine rations were not stretched: " + out.ration);
  if (!/famine/.test(gran.word(settlement.id))) fail("the place page word is not famine");
  // Relief: the fed neighbour sends a caravan-load.
  second.inventory[C.ORGANIC] = 400; second.inventory[C.ENERGY] = 60; second.inventory[C.SOLVENT] = 400;
  second.storageCapacity = Math.max(second.storageCapacity || 0, 900); settlement.storageCapacity = Math.max(settlement.storageCapacity || 0, 600);
  out.donor = gran.donor(settlement.id);
  if (out.donor !== second.name) fail("the fed neighbour was not chosen as donor: " + out.donor);
  const relief = gran.relief(settlement.id);
  out.relief = relief ? eventSentence(relief) : "";
  if (!relief) fail("no relief was sent");
  if (!(settlement.inventory[C.ORGANIC] > 0)) fail("relief moved no food");
  if (relief && !alertWorthy(relief)) fail("relief does not reach the alert feed");
  // Migration: starving households walk to the fed town and settle there.
  settlement.inventory[C.ORGANIC] = 0;
  const walkers = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]?.homePlaceId === settlement.id && isAdultPerson(id)).slice(0, 3);
  for (const id of walkers) { W.components.life[id].hunger = 90; }
  const migration = gran.migrate(settlement.id);
  out.migration = migration ? eventSentence(migration) : "";
  if (!migration) fail("no household set out for the fed town: target " + gran.target(settlement.id) + " movers " + JSON.stringify(gran.movers(settlement.id).slice(0, 4)));
  else {
    const mover = migration.subjects[0], order = civilOrderOf(mover);
    if (!order || order.kind !== "migrate") fail("the mover carries no migrate order");
    else {
      const p = W.components.position[mover]; p.x = second.x; p.y = second.y; rebuildSpatialBins();
      gran.arrivals();
      const soc = W.components.social[mover];
      if (soc.homePlaceId !== second.id) fail("the migrant did not settle in the fed town");
      if (civilOrderOf(mover)) fail("the migrant's order was not cleared on arrival");
    }
  }
  // Seed corn is kept back from the daily draw while fields lie fallow.
  for (const b of W.buildings) if (!b.ruined && b.placeKind === "settlement" && b.placeId === settlement.id && b.type === "farm" && !b.complete) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
  for (const b of completedBuildings(settlement, "farm")) cultivatedField(b);
  out.seedReserve = gran.seedReserve(settlement.id);
  // A field is sown with seed alone when the stores hold no nutrient.
  const farmBuilding = completedBuildings(settlement, "farm")[0], field = farmBuilding ? cultivatedField(farmBuilding) : null;
  if (field) {
    settlement.inventory[C.NUTRIENT] = 0; settlement.inventory[C.ORGANIC] = Math.max(settlement.inventory[C.ORGANIC], 40); settlement.inventory[C.SOLVENT] = Math.max(settlement.inventory[C.SOLVENT], 4);
    const sower = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
    const sown = sowCultivatedField(sower, field, settlement);
    out.sown = { sown, stage: field.stage };
    if (!sown || field.stage !== "sown") fail("a field with seed but no nutrient was not sown: " + JSON.stringify(out.sown));
    const targets = new Map(essentialStockTargets(settlement));
    out.nutrientTarget = targets.get(C.NUTRIENT);
    if (!(out.nutrientTarget >= 26)) fail("the nutrient target does not rise with farms: " + out.nutrientTarget);
  }
  if (completedBuildings(settlement, "farm").length && !(out.seedReserve >= 9)) fail("no seed corn is kept back for the fallow fields: " + out.seedReserve);
  // Hungry towns send settlers sooner.
  out.urgeHungry = gran.urge(settlement.id);
  settlement.inventory[C.ORGANIC] = 900; settlement.inventory[C.ENERGY] = 200;
  for (const id of W.activeIds) if (W.kind[id] === KINDS.PERSON && W.components.social[id]?.homePlaceId === settlement.id) W.components.life[id].hunger = 10;
  out.urgeFed = gran.urge(settlement.id);
  if (!(out.urgeHungry > out.urgeFed)) fail("hunger did not raise the settler urge: " + JSON.stringify({ hungry: out.urgeHungry, fed: out.urgeFed }));
  // Births answer the stores.
  const pair = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]?.homePlaceId === settlement.id && isAdultPerson(id)).slice(0, 2);
  if (pair.length === 2) {
    const fed = fertilityFactor(pair[0], pair[1]);
    settlement.inventory[C.ORGANIC] = 0; settlement.inventory[C.ENERGY] = 0;
    for (const id of W.activeIds) if (W.kind[id] === KINDS.PERSON && W.components.social[id]?.homePlaceId === settlement.id) W.components.life[id].hunger = 90;
    const starving = fertilityFactor(pair[0], pair[1]);
    for (const id of W.activeIds) if (W.kind[id] === KINDS.PERSON && W.components.social[id]?.homePlaceId === settlement.id) W.components.life[id].hunger = 10;
    out.fertility = { fed, starving };
    if (!(starving < fed)) fail("famine did not slow births: " + JSON.stringify(out.fertility));
    // The granary paces the concerted haste: one fed person hurries the next
    // child while the town is provisioned, and keeps the ordinary pace once a
    // quarter of the neighbours go hungry, however full that one belly is.
    const person = pair[0], residents = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]?.homePlaceId === settlement.id);
    const hungerWas = residents.map((id) => W.components.life[id].hunger);
    W.civilization.concertedEffortLevel = 2;
    W.civilization.concertedEffortUntil = W.tick + 512;
    // The famine test above emptied the stores; fill them again for the fed case.
    settlement.storageCapacity = Math.max(settlement.storageCapacity || 150, placeStorageUsed(settlement) + 500);
    { const want = 400 - (settlement.inventory[C.ORGANIC] || 0); if (want > 0) { settlement.inventory[C.ORGANIC] += want; W.conservation.playerInput += want; } }
    for (const id of residents) W.components.life[id].hunger = 10;
    out.foodFed = Math.round(settlementFood(settlement));
    out.hasteFed = gran.haste(person);
    out.paceFed = gran.pace(settlement.id);
    for (const id of residents) if (id !== person) W.components.life[id].hunger = 80;
    W.components.life[person].hunger = 10;
    W.tick++; // the town's reading is taken once a tick
    out.hasteHungryTown = gran.haste(person);
    out.paceHungryTown = gran.pace(settlement.id);
    residents.forEach((id, n) => { W.components.life[id].hunger = hungerWas[n]; });
    W.civilization.concertedEffortLevel = 0;
    W.civilization.concertedEffortUntil = 0;
    if (!(out.hasteFed > 1)) fail("a provisioned town does not hurry the next child: " + out.hasteFed);
    if (!(out.hasteHungryTown <= 1)) fail("a hungry town still hurries the next child: " + out.hasteHungryTown);
  }
  if (!/Granaries/.test(window.ALIFE_LEGENDS_DEBUG.render("place", settlement.id))) fail("the place page shows no granary row");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_GRANARY_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_GRANARY_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
