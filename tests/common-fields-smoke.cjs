// Common-fields smoke: a farm hand whose own town has no fields reaps a
// neighbouring town's ripe field within six tiles and carries the crop home,
// then sows the bare field from their own seed when the stores hold seed to
// spare; a fallen town's abandoned ripe farm is listed for reaping; matter is
// conserved throughout.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const common = window.ALIFE_COMMON_FIELDS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  if (!s.factionId) createFaction(s.id);
  const f = W.factions.find((x) => x.id === s.factionId);
  const finish = (b) => { if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; } return b; };
  const complete = (place, type) => finish(planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === (place.knownProcesses ? "settlement" : "camp") && x.placeId === place.id && x.type === type && !x.complete));
  const freeFounder = () => {
    const id = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && !W.components.social[id]?.homePlaceId) || W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
    if (id) { const soc = W.components.social[id]; if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; } }
    return id;
  };
  const raiseTown = (cx, cy) => {
    for (let tries = 0; tries < 60; tries++) {
      const x = clamp(cx + (tries % 6), 3, W.width - 4), y = clamp(cy + Math.floor(tries / 6), 3, W.height - 4), t = idx(x, y);
      if (W.tiles.liquid[t] > WATER_DEPTH.SURFACE || campNear(t, 6) || nearestSettlement(t, 10)) continue;
      const founder = freeFounder(); if (!founder) return null;
      const camp = createCamp(t, founder); if (!camp) continue;
      for (const type of ["stockpile", "shelter", "hearth"]) complete(camp, type);
      const town = createSettlement(camp.id);
      if (town) { town.factionId = f.id; return town; }
    }
    return null;
  };
  // Two towns of one polity: B keeps a farm, C keeps none.
  const b = raiseTown(s.x + 14, s.y - 10), c = raiseTown(s.x + 14, s.y + 4);
  if (!b || !c) { fail("could not raise the towns"); return out; }
  for (const t of ["agriculture"]) for (const town of [b, c]) if (!town.knownProcesses.includes(t)) town.knownProcesses.push(t);
  const farm = complete(b, "farm");
  if (!farm) { fail("no farm at the neighbour"); return out; }
  const field = cultivatedField(farm);
  if (!field) { fail("no field record"); return out; }
  // Ripen it: a crop of twelve on every tile above the baseline, booked as input.
  field.stage = "ripe"; field.matureTick = W.tick; field.sowTick = W.tick - 200; field.growth = 20; field.harvestBlockedUntil = 0;
  for (const tile of field.tiles) { setTileMatterAmount(tile, C.ORGANIC, tileMatterAmount(tile, C.ORGANIC) + 12); W.conservation.playerInput += 12; }
  // A fed hand of C stands at the farm's access tile.
  const worker = createOrganism(KINDS.PERSON, farm.x, farm.y, makeRng(hashParts(W.seedHash, "common-fields", 1), "birth"), []);
  if (!worker) { fail("no worker"); return out; }
  const soc = W.components.social[worker], p = W.components.position[worker], q = W.components.chemistry[worker].q;
  soc.homePlaceKind = "settlement"; soc.homePlaceId = c.id; soc.factionId = f.id;
  for (const sp of [C.ENERGY, C.SOLVENT]) { const want = 400 - q[sp]; if (want > 0) { q[sp] += want; W.conservation.playerInput += want; } }
  const access = farmLaborAccessTile(worker, farm);
  if (!access) { fail("no access tile"); return out; }
  p.x = access.x; p.y = access.y; rebuildSpatialBins();
  c.storageCapacity = Math.max(c.storageCapacity || 150, placeStorageUsed(c) + 300);
  out.own = nearestFriendlyPlace(worker)?.id; if (out.own !== c.id) fail("the hand's own town is not C: " + out.own);
  out.candidates = common.candidates(worker);
  if (!out.candidates.some((x) => x.building === farm.id && x.stage === "ripe")) fail("the neighbour's ripe field is not a candidate: " + JSON.stringify(out.candidates));
  const matter0 = totalMatter(), store0 = c.inventory[C.ORGANIC] || 0;
  out.reaped = common.work(worker);
  out.carried = (c.inventory[C.ORGANIC] || 0) - store0;
  out.stageAfterReap = field.stage;
  if (!(out.reaped && out.carried >= 9 && field.stage === "fallow")) fail("the neighbour's field was not reaped home: " + JSON.stringify([out.reaped, out.carried, field.stage]));
  if (totalMatter() !== matter0) fail("reaping did not conserve matter");
  out.reapReason = W.components.life[worker].behaviorReason || "";
  if (!/reaped a neighbour/.test(out.reapReason)) fail("no reason names the neighbour's harvest: " + out.reapReason);
  // Seed to spare: the hand sows the bare field from C's store.
  { const want = 40 - (c.inventory[C.ORGANIC] || 0); if (want > 0) { c.inventory[C.ORGANIC] += want; W.conservation.playerInput += want; } }
  field.lastLaborTick = W.tick - 200;
  const matter1 = totalMatter(), seed0 = c.inventory[C.ORGANIC];
  out.sown = common.work(worker);
  out.seedUsed = seed0 - c.inventory[C.ORGANIC];
  out.stageAfterSow = field.stage;
  if (!(out.sown && field.stage === "sown" && out.seedUsed >= field.tiles.length)) fail("the bare field was not sown from the hand's own seed: " + JSON.stringify([out.sown, field.stage, out.seedUsed]));
  if (totalMatter() !== matter1) fail("sowing did not conserve matter");
  // A fallen town's abandoned ripe farm is listed for reaping.
  const farm2 = complete(b, "farm");
  if (farm2) {
    const field2 = cultivatedField(farm2);
    field2.stage = "ripe"; field2.matureTick = W.tick; field2.sowTick = W.tick - 200; field2.growth = 20; field2.harvestBlockedUntil = 0;
    for (const tile of field2.tiles) { setTileMatterAmount(tile, C.ORGANIC, tileMatterAmount(tile, C.ORGANIC) + 12); W.conservation.playerInput += 12; }
    farm2.abandoned = true;
    const a2 = farmLaborAccessTile(worker, farm2); if (a2) { p.x = a2.x; p.y = a2.y; rebuildSpatialBins(); }
    out.abandonedListed = common.candidates(worker).some((x) => x.building === farm2.id && x.stage === "ripe");
    if (!out.abandonedListed) fail("an abandoned ripe farm is not listed for reaping");
    farm2.abandoned = false;
  }
  out.counts = common.counts();
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_COMMON_FIELDS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_COMMON_FIELDS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
