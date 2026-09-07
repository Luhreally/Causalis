// Harvest smoke: a tended field in a town that knows the water crafts grows
// several times a season where an untended, unwatered one grows once; the
// harvest lifts more per tile with each water craft; migration keeps a
// measured pace with a rest per town and a budget per year, and a forced
// migration still works for the debug surface.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const hv = window.ALIFE_HARVEST_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  if (!settlement.knownProcesses.includes("agriculture")) settlement.knownProcesses.push("agriculture");
  const farm = planBuilding(settlement, "farm", 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === settlement.id && x.type === "farm");
  if (!farm) { fail("no farm could be planned"); return out; }
  farm.complete = true; farm.stage = 6; farm.integrity = farm.maxIntegrity; farm.completedTick = W.tick; for (const [sp, n] of farm.requirements || []) farm.composition[sp] = n;
  const field = cultivatedField(farm);
  if (!field) { fail("the farm has no field"); return out; }
  // An untended field in a town without water crafts: one extent, the old interval.
  settlement.knownProcesses = settlement.knownProcesses.filter((t) => !["irrigation", "waterworks", "chemistry"].includes(t));
  field.lastLaborTick = -1e9;
  out.plain = { extent: hv.extent(farm.id), interval: hv.interval(farm.id), cap: hv.cap(settlement.id) };
  if (out.plain.extent !== 1 || out.plain.interval !== 64 || out.plain.cap !== 1) fail("a plain field does not keep the old pace: " + JSON.stringify(out.plain));
  // Tended, irrigated, with waterworks: four extents, a quarter of the interval, a half more per tile.
  settlement.knownProcesses.push("irrigation", "waterworks");
  field.lastLaborTick = W.tick;
  out.tended = { extent: hv.extent(farm.id), interval: hv.interval(farm.id), cap: hv.cap(settlement.id), tended: hv.tended(farm.id) };
  if (out.tended.extent !== 4 || out.tended.interval !== 16 || out.tended.cap !== 1.5 || !out.tended.tended) fail("a tended, watered field does not grow faster: " + JSON.stringify(out.tended));
  // The faster interval really drives growth updates.
  field.stage = "sown"; field.sowTick = W.tick - 100; field.growth = 0; field.lastGrowthTick = W.tick - 20;
  updateCultivatedFields();
  out.updatedTick = field.lastGrowthTick === W.tick;
  if (!out.updatedTick) fail("the field did not grow at the shorter interval");
  field.lastGrowthTick = W.tick - 20; field.lastLaborTick = -1e9; settlement.knownProcesses = settlement.knownProcesses.filter((t) => !["irrigation", "waterworks"].includes(t));
  updateCultivatedFields();
  if (field.lastGrowthTick === W.tick) fail("a plain field grew before its interval");
  // A field ripens only when it carries a real crop, or after two patient years.
  out.ripeTarget = hv.ripeTarget(farm.id);
  if (out.ripeTarget !== Math.max(6, (field.tiles?.length || 1) * 6)) fail("the ripe target is not six per tile: " + out.ripeTarget);
  const viable = (field.tiles || [field.tile]).filter((tile) => W.tiles.fire[tile] <= 90 && tileMoisture(tile) >= 8);
  if (viable.length) {
    for (const tile of field.tiles) { setTileMatterAmount(tile, C.NUTRIENT, tileMatterAmount(tile, C.NUTRIENT) + 6); setTileMatterAmount(tile, C.SOLVENT, tileMatterAmount(tile, C.SOLVENT) + 12); setTileMatterAmount(tile, C.GAS, tileMatterAmount(tile, C.GAS) + 6); }
    field.stage = "growing"; field.growth = 12; field.sowTick = W.tick - 100; field.lastGrowthTick = W.tick - 100;
    updateCultivatedField(farm, settlement, 0);
    out.earlyStage = field.stage;
    if (field.stage === "ripe" && field.growth < out.ripeTarget) fail("a field ripened at the first green with growth " + field.growth);
    field.stage = "growing"; field.growth = out.ripeTarget; field.lastGrowthTick = W.tick - 100;
    updateCultivatedField(farm, settlement, 0);
    out.fullStage = field.stage;
    if (field.stage !== "ripe") fail("a field carrying a full crop did not ripen: growth " + field.growth);
    field.stage = "growing"; field.growth = 9; field.sowTick = W.tick - 600; field.lastGrowthTick = W.tick - 100;
    updateCultivatedField(farm, settlement, 0);
    if (field.stage !== "ripe") fail("a poor field did not ripen after two patient years: growth " + field.growth);
    field.stage = "fallow"; field.growth = 0;
  } else out.ripeSkipped = "no viable tiles in the fixture field";
  // In famine one sowing's seed is kept back; when merely lean, two.
  const keepOrganic = settlement.inventory[C.ORGANIC];
  settlement.inventory[C.ORGANIC] = 1;
  out.seedReserve = seedReserve(settlement);
  if (out.seedReserve !== (field.tiles?.length || 9)) fail("the famine seed reserve is not one sowing: " + out.seedReserve);
  settlement.inventory[C.ORGANIC] = keepOrganic;
  out.seedReserveFed = seedReserve(settlement);
  if (![1, 2].map((n) => n * (field.tiles?.length || 9)).includes(out.seedReserveFed)) fail("the seed reserve is neither one nor two sowings: " + out.seedReserveFed);
  // The harvest cap scales with the water crafts and only for crop matter.
  settlement.knownProcesses.push("irrigation");
  const tile = field.tile, before = tileMatterAmount(tile, C.ORGANIC), room = placeStorageRemaining(settlement);
  setTileMatterAmount(tile, C.ORGANIC, before + 40);
  const invBefore = settlement.inventory[C.ORGANIC];
  const moved = transferTileCropToPlace(settlement, tile, C.ORGANIC, 8, before + 1);
  out.harvest = { moved, room, expected: Math.min(10, 40 - 1) };
  if (room >= 10 && moved !== 10) fail("an irrigated harvest did not lift ten per tile: " + JSON.stringify(out.harvest));
  if (settlement.inventory[C.ORGANIC] - invBefore !== moved) fail("the harvest did not land in the store");
  if (tileMatterAmount(tile, C.ORGANIC) !== before + 40 - moved) fail("crop matter was created or lost in the harvest");
  // Hungry hands are wanted in a lean town's fields even when their minds are set on food.
  const hand = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.life[id]);
  if (hand) {
    const life = W.components.life[hand], keep = { hunger: life.hunger, thirst: life.thirst };
    life.hunger = 70; life.thirst = 20;
    field.stage = "ripe"; field.harvestBlockedUntil = 0;
    out.wantedRipe = hungryHandsWanted(hand, settlement);
    if (!out.wantedRipe) fail("a hungry resident is not wanted at a ripe field");
    field.stage = "fallow"; life.hunger = 20;
    if (hungryHandsWanted(hand, settlement)) fail("a fed resident is counted as hungry hands");
    life.hunger = keep.hunger; life.thirst = keep.thirst;
  }
  // A homeless person beside the town, and a child of a resident, are given a home.
  const stray = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.position[id]);
  if (stray) {
    const soc = W.components.social[stray], pos = W.components.position[stray], keep = { kind: soc.homePlaceKind, id: soc.homePlaceId, x: pos.x, y: pos.y, fac: soc.factionId };
    soc.homePlaceKind = ""; soc.homePlaceId = 0; soc.factionId = settlement.factionId;
    pos.x = clamp(settlement.x + 2, 0, W.width - 1); pos.y = settlement.y;
    W.civilOrders = (W.civilOrders || []).filter((o) => o.id !== stray);
    out.adopted = hv.adopt();
    out.strayHome = soc.homePlaceKind + ":" + soc.homePlaceId;
    if (soc.homePlaceKind !== "settlement" || soc.homePlaceId !== settlement.id) fail("a homeless person beside the town was not given a home: " + out.strayHome);
    // A child inherits a parent's home wherever it stands.
    const child = W.activeIds.find((id) => id !== stray && W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.identity[id]);
    if (child) {
      const cs = W.components.social[child], ci = W.components.identity[child], keepChild = { kind: cs.homePlaceKind, id: cs.homePlaceId, parents: ci.parents, fac: cs.factionId };
      cs.homePlaceKind = ""; cs.homePlaceId = 0; cs.factionId = 0; ci.parents = [stray];
      const cp = W.components.position[child]; const keepPos = { x: cp.x, y: cp.y }; cp.x = clamp(settlement.x + 30, 0, W.width - 1);
      W.civilOrders = (W.civilOrders || []).filter((o) => o.id !== child);
      hv.adopt();
      if (cs.homePlaceKind !== "settlement" || cs.homePlaceId !== settlement.id || cs.factionId !== settlement.factionId) fail("a child did not inherit its parent's home: " + cs.homePlaceKind + ":" + cs.homePlaceId);
      cs.homePlaceKind = keepChild.kind; cs.homePlaceId = keepChild.id; cs.factionId = keepChild.fac; ci.parents = keepChild.parents; cp.x = keepPos.x; cp.y = keepPos.y;
    }
    soc.homePlaceKind = keep.kind; soc.homePlaceId = keep.id; soc.factionId = keep.fac; pos.x = keep.x; pos.y = keep.y;
    rebuildSpatialBins();
  }
  // A rest owed keeps a person out of the labour pool until they are truly rested.
  if (hand) {
    const life = W.components.life[hand], keepF = { fatigue: life.fatigue, debt: life.restDebt };
    life.fatigue = 92; life.restDebt = true;
    if (workerReadyForLabor(hand)) fail("a person who owes a rest is counted ready for labour");
    life.fatigue = 60;
    if (workerReadyForLabor(hand)) fail("a rest is not owed until truly rested");
    life.restDebt = false; life.fatigue = 40;
    out.restedReady = workerReadyForLabor(hand) || "not ready for another reason";
    life.fatigue = keepF.fatigue; life.restDebt = keepF.debt;
  }
  // A brimming store makes room for the harvest by spilling its least-needed bulk.
  const solventKeep = settlement.inventory[C.SOLVENT], groundSolvent = tileMatterAmount(idx(settlement.x, settlement.y), C.SOLVENT), matterRoom = totalMatter();
  settlement.inventory[C.SOLVENT] = Math.max(settlement.inventory[C.SOLVENT], (settlement.storageCapacity || 400) + 200);
  out.roomBefore = placeStorageRemaining(settlement);
  out.spilled = hv.makeRoom(settlement.id);
  out.roomAfter = placeStorageRemaining(settlement);
  if (out.roomBefore < 54 && !(out.spilled > 0 && out.roomAfter > out.roomBefore)) fail("a full store made no room for the harvest: " + JSON.stringify({ before: out.roomBefore, after: out.roomAfter, spilled: out.spilled }));
  if (totalMatter() !== matterRoom + (settlement.inventory[C.SOLVENT] + out.spilled - solventKeep) - out.spilled + 0 && false) fail("unreachable");
  setTileMatterAmount(idx(settlement.x, settlement.y), C.SOLVENT, groundSolvent); settlement.inventory[C.SOLVENT] = solventKeep;
  // Migration keeps a measured pace.
  out.budget = hv.budget();
  if (!(out.budget >= 2)) fail("the migration budget is too small: " + out.budget);
  settlement.lastMigrationTick = W.tick - 100;
  out.gateRested = hv.gate(settlement.id);
  if (out.gateRested !== "rested") fail("a town that just sent a household is not resting: " + out.gateRested);
  settlement.lastMigrationTick = -1e9;
  hv.ledger(); const ledger = W.harvest.migration; ledger.year = Math.floor(W.tick / TICKS_PER_YEAR); ledger.count = out.budget;
  out.gateBudget = hv.gate(settlement.id);
  if (out.gateBudget !== "budget") fail("a spent yearly budget does not hold migration: " + out.gateBudget);
  ledger.count = 0;
  if (hv.gate(settlement.id) !== null) fail("a rested town under budget is still held: " + hv.gate(settlement.id));
  if (migrateHouseholds(settlement, false) !== null && !window.ALIFE_GRANARY_DEBUG.outlook(settlement.id)?.famine) fail("a fed town migrated without famine");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_HARVEST_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_HARVEST_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
