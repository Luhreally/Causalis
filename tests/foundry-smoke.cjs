// Foundry smoke: metal, catalyst, and ceramic are drawn from the town stores
// like the rare inputs; a tower site whose stone and timber are in wants metal
// next; the forge smelts ore and fuel into metal for that site, conserving
// matter; a builder at the stores draws the metal for the tower; and when the
// stores hold neither metal nor ore, the builder seeks ore on the ground, digs
// it, and hauls it home for the forge, while the town's feedstock list names
// it for the gatherers.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const foundry = window.ALIFE_FOUNDRY_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m), name = (sp) => W.definitions.species[sp].name;
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  if (!s.factionId) createFaction(s.id);
  const finish = (b) => { if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; } return b; };
  const complete = (place, type) => finish(planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === place.id && x.type === type && !x.complete));
  const grant = (place, ...techs) => { for (const t of techs) if (!place.knownProcesses.includes(t)) place.knownProcesses.push(t); };
  // Metal, catalyst, and ceramic are drawn from the stores.
  out.drawn = foundry.drawn().map(name);
  for (const sp of [C.METAL, C.CATALYST, C.CERAMIC]) if (!foundry.drawn().includes(sp)) fail("not drawn from the stores: " + name(sp));
  grant(s, "controlled_fire", "metalworking", "masonry", "mechanization", "electricity", "ceramics");
  s.stage = "urban";
  const forge = complete(s, "forge");
  if (!forge) { fail("could not raise a forge"); return out; }
  // A tower site whose stone and timber are in wants metal next.
  const tower = planBuilding(s, "tower", 9);
  if (!tower) { fail("could not plan a tower"); return out; }
  for (const [sp, n] of tower.requirements) if (sp !== C.METAL && sp !== C.CATALYST) tower.composition[sp] = n;
  refreshBuildingStage(tower);
  const missing = missingBuildingMaterial(tower);
  out.missing = missing ? name(missing.sp) : "";
  if (!missing || missing.sp !== C.METAL) fail("the tower does not want metal first: " + out.missing);
  if (!W.workOrders.some((o) => o.status === "open" && o.buildingId === tower.id)) fail("no work order for the tower");
  // The forge smelts for the site: ore and fuel in the stores, no metal.
  s.storageCapacity = Math.max(s.storageCapacity || 150, placeStorageUsed(s) + 400);
  const spare = idx(clamp(s.x + 4, 1, W.width - 2), clamp(s.y + 4, 1, W.height - 2));
  const ground = (sp, n) => { setTileMatterAmount(spare, sp, tileMatterAmount(spare, sp) + n); };
  ground(C.METAL, s.inventory[C.METAL]); s.inventory[C.METAL] = 0;
  const topUp = (sp, n) => { const want = n - (s.inventory[sp] || 0); if (want > 0) { s.inventory[sp] += want; W.conservation.playerInput += want; } };
  topUp(C.ORE, 12); topUp(C.FUEL, 12);
  const worker = createOrganism(KINDS.PERSON, forge.x, forge.y, makeRng(hashParts(W.seedHash, "foundry-fixture", 1), "birth"), []);
  if (!worker) { fail("no worker"); return out; }
  const soc = W.components.social[worker], p = W.components.position[worker];
  soc.homePlaceKind = "settlement"; soc.homePlaceId = s.id; soc.factionId = s.factionId;
  p.x = forge.x; p.y = forge.y; rebuildSpatialBins();
  // People are born hungry; a fed worker, booked as input.
  { const q = W.components.chemistry[worker].q; for (const sp of [C.ENERGY, C.SOLVENT]) { const want = 400 - q[sp]; if (want > 0) { q[sp] += want; W.conservation.playerInput += want; } } }
  out.ready = workerReadyForLabor(worker);
  if (!out.ready) fail("the fed worker is not ready for labour");
  out.wants = foundry.wants(s.id);
  const metalWant = out.wants.find((w) => w.species === name(C.METAL));
  if (!(metalWant && metalWant.short >= 24 && metalWant.facility === "forge")) fail("the town does not know its tower wants metal from the forge: " + JSON.stringify(metalWant));
  const matter0 = totalMatter();
  let runs = 0;
  for (let i = 0; i < 12 && s.inventory[C.METAL] < 4; i++) runs += foundry.run(s.id);
  out.smelted = s.inventory[C.METAL]; out.oreLeft = s.inventory[C.ORE]; out.runs = runs;
  if (!(out.smelted >= 2)) fail("the forge did not smelt for the tower (" + (W.components.life[worker].behaviorReason || "") + ")");
  if (totalMatter() !== matter0) fail("smelting did not conserve matter: " + matter0 + " -> " + totalMatter());
  // A builder at the stores draws the metal for the site.
  topUp(C.METAL, 30 + researchMaterialReserve(s, C.METAL));
  const matter1 = totalMatter();
  p.x = s.x; p.y = s.y; rebuildSpatialBins();
  const inv = W.components.inventory[worker].materials, carried0 = inv[C.METAL];
  let drew = 0;
  for (let i = 0; i < 4 && drew <= 0; i++) { performCivilLabor(worker); drew = inv[C.METAL] - carried0; }
  out.drew = drew; out.drawReason = W.components.life[worker].behaviorReason || "";
  if (!(drew > 0)) fail("the builder did not draw metal from the stores for the tower (" + out.drawReason + ")");
  if (totalMatter() !== matter1) fail("drawing from the stores did not conserve matter");
  // Neither metal nor ore in the stores, ore on the ground: the builder seeks it, digs it, hauls it home.
  ground(C.METAL, inv[C.METAL]); inv[C.METAL] = 0;
  ground(C.METAL, s.inventory[C.METAL]); s.inventory[C.METAL] = 0;
  ground(C.ORE, s.inventory[C.ORE]); s.inventory[C.ORE] = 0;
  const oreTile = idx(clamp(s.x + 2, 1, W.width - 2), s.y);
  setTileMatterAmount(oreTile, C.ORE, tileMatterAmount(oreTile, C.ORE) + 30); W.conservation.playerInput += 30;
  const matter2 = totalMatter();
  const w = workState(worker); w.resourceTiles = {}; w.resourceTile = -1; w.resourceSpecies = -1; w.resourceRetry = {};
  out.seek = foundry.labor(worker); out.seekReason = W.components.life[worker].behaviorReason || "";
  if (!(out.seek && /smelt/.test(out.seekReason))) fail("the builder did not seek ore for the forge: " + out.seekReason);
  // Standing on the seam, the builder digs.
  { const [tx, ty] = xy(w.targetTile >= 0 ? w.targetTile : oreTile); p.x = tx; p.y = ty; rebuildSpatialBins(); }
  out.dig = foundry.labor(worker); out.dug = inv[C.ORE]; out.digReason = W.components.life[worker].behaviorReason || "";
  if (!(out.dig && out.dug > 0)) fail("the builder did not dig ore for the forge: " + out.digReason);
  const short = 8 - inv[C.ORE];
  if (short > 0) { setTileMatterAmount(oreTile, C.ORE, tileMatterAmount(oreTile, C.ORE) - short); inv[C.ORE] += short; }
  p.x = s.x; p.y = s.y; rebuildSpatialBins();
  const stored = () => (s.inventory[C.ORE] || 0) + (s.researchInventory?.[C.ORE] || 0), storeOre0 = stored();
  out.haul = foundry.labor(worker); out.hauled = stored() - storeOre0;
  if (!(out.haul && out.hauled > 0)) fail("the builder did not haul the ore home: " + (W.components.life[worker].behaviorReason || ""));
  if (totalMatter() !== matter2) fail("digging and hauling did not conserve matter: " + matter2 + " -> " + totalMatter());
  // The gatherers' feedstock list names ore for the tower.
  const want2 = foundry.wants(s.id).find((x) => x.species === name(C.METAL));
  out.feedstock = want2 ? want2.feedstock : [];
  if (!out.feedstock.includes(name(C.ORE))) fail("the feedstock list does not name ore: " + out.feedstock.join(","));
  out.counts = foundry.counts();
  if (!(out.counts.runs >= 1 && out.counts.dug >= 1 && out.counts.hauled >= 1)) fail("the foundry counts are off: " + JSON.stringify(out.counts));
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_FOUNDRY_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_FOUNDRY_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
