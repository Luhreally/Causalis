const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const live = () => W.activeIds.filter(id => [KINDS.HERBIVORE, KINDS.PREDATOR, KINDS.PERSON].includes(W.kind[id]) && classifyAlive(id)).sort((a, b) => a - b);
  UI.followId = 0;
  UI.selectedEntity = 0;

  const sourceId = live()[0];
  const sourcePosition = W.components.position[sourceId];
  const sourceGenome = W.components.genome[sourceId];
  sourceGenome.lineageId = hashParts(W.seedHash, "cohort-round-trip-lineage");
  const species = C.SOLVENT;
  const sourceInventory = W.components.inventory[sourceId];
  W.components.chemistry[sourceId].q[species] = 65535;
  sourceInventory.materials[species] = 40000;
  sourceInventory.digestive[species] = 30000;
  const expectedSpeciesMatter = 135535;
  const beforeRoundTripMatter = totalMatter();
  const aggregated = aggregateIntoCohort(sourceId, "focused cohort round-trip");
  const cohort = W.cohorts.find(c => c.lineageId === sourceGenome.lineageId);
  const materializedId = materializeCohort(cohort);
  const materializedInventory = W.components.inventory[materializedId];
  const materializedSpeciesMatter = W.components.chemistry[materializedId].q[species] + materializedInventory.materials[species] + materializedInventory.digestive[species];
  const roundTripMatterDelta = totalMatter() - beforeRoundTripMatter;

  const demographic = cohortFor(KINDS.HERBIVORE, sourcePosition.regionId, 0, hashParts(W.seedHash, "cohort-demographic-lineage"));
  demographic.count = 20;
  demographic.ageBins = [5, 5, 5, 5];
  demographic.maxAge = 128;
  demographic.lastAgeTick = W.tick - 32;
  demographic.ageCarry = [0, 0, 0, 0];
  demographic.health = 1;
  demographic.foodAccess = 1;
  for (let sp = 0; sp < SPECIES_COUNT; sp++) demographic.chemistryTotals[sp] = 20 * (sp === C.SOLVENT ? 100 : sp === C.ORGANIC ? 60 : sp === C.ENERGY ? 45 : 12);
  demographic.geneSums.fill(10);
  demographic.geneSquares.fill(6);
  const demographicTile = idx(...regionCenter(demographic.regionId));
  const beforeAgeMatter = totalMatter();
  const deathsBefore = W.statistics.deaths;
  const agedOut = advanceCohortAges(demographic, demographicTile);
  const ageMatterDelta = totalMatter() - beforeAgeMatter;
  const deathEvent = W.events.at(-1);

  demographic.maxAge = cohortLifeSpan(demographic.kind);
  demographic.ageBins = [0, demographic.count, 0, 0];
  demographic.reproductionRemainder = .99;
  demographic.health = 1;
  demographic.foodAccess = 1;
  const birthsBefore = W.statistics.births;
  const beforeBirthMatter = totalMatter();
  const born = reproduceCohort(demographic, demographicTile);
  const birthMatterDelta = totalMatter() - beforeBirthMatter;
  const birthEvent = W.events.at(-1);

  const damageId = live().find(id => id !== materializedId);
  const damageTile = idx(W.components.position[damageId].x, W.components.position[damageId].y);
  const integrityBefore = W.components.life[damageId].integrity;
  const injuriesBefore = W.components.identity[damageId].injuries;
  const structureBefore = W.tiles.structureOrder[damageTile];
  const soilBefore = W.tiles.soilOrder[damageTile];
  damageAt({entityId: damageId, tile: damageTile, amount: 0});
  const zeroDamageNoOp = W.components.life[damageId].integrity === integrityBefore && W.components.identity[damageId].injuries === injuriesBefore && W.tiles.structureOrder[damageTile] === structureBefore && W.tiles.soilOrder[damageTile] === soilBefore;

  const overflowSpecies = C.WASTE;
  const overflowTile = damageTile;
  setTileMatterAmount(overflowTile, overflowSpecies, 65530);
  const beforeOverflowEffect = totalMatter();
  queueEffect("ModifyField", {tile: overflowTile, chem: overflowSpecies, delta: 40});
  resolveEffects();
  const overflowEffectExact = tileMatterAmount(overflowTile, overflowSpecies) === 65570 && totalMatter() - beforeOverflowEffect === 40;
  const overflowVisibleToWork = resourceAmountAt(overflowTile, overflowSpecies) === 65570;
  const transferTarget = damageId;
  W.components.chemistry[transferTarget].q[overflowSpecies] = 65530;
  const beforeTransferMatter = totalMatter();
  const transferred = resolveTransfer({fromType: "tile", from: overflowTile, toType: "entity", to: transferTarget, amounts: [[overflowSpecies, 20]]});
  const transferCapacityExact = transferred === 5 && W.components.chemistry[transferTarget].q[overflowSpecies] === 65535 && tileMatterAmount(overflowTile, overflowSpecies) === 65565;
  const transferMatterDelta = totalMatter() - beforeTransferMatter;

  const deathId = live().find(id => id !== materializedId && id !== damageId);
  const deathTick = W.tick;
  killEntity(deathId, "focused erased death", 0, true);
  const deathTickRecorded = W.historicalIdentities[deathId]?.lifeSummary?.deathTick === deathTick;

  const synthetic = [];
  for (let n = 0; n < CAPS.corpse + 2; n++) {
    const id = allocEntity(KINDS.CORPSE);
    synthetic.push(id);
    W.components.position[id] = {x: 0, y: 0, regionId: 0};
    W.components.life[id] = {age: CAPS.corpse + 2 - n, deathTick: n, causeOfDeath: "fixture"};
    W.components.identity[id] = {generatedName: "Fixture corpse " + n, deathEventId: 0};
    W.components.chemistry[id] = {q: new Uint16Array(SPECIES_COUNT)};
    W.components.inventory[id] = {materials: new Uint16Array(SPECIES_COUNT), digestive: new Uint16Array(SPECIES_COUNT)};
    W.components.chemistry[id].q[C.MINERAL] = 1;
    W.components.inventory[id].materials[C.ORGANIC] = 2;
    W.components.inventory[id].digestive[C.NUTRIENT] = 3;
  }
  const beforePruneMatter = totalMatter();
  capCorpses();
  const pruneMatterDelta = totalMatter() - beforePruneMatter;
  const remainingCorpses = W.activeIds.filter(id => W.kind[id] === KINDS.CORPSE);
  const oldestPruned = synthetic.slice(0, 2).every(id => !W.kind[id]);
  const newestRetained = synthetic.slice(-2).every(id => W.kind[id] === KINDS.CORPSE);
  const audit = debugCohortInvariants();

  return {
    aggregated,
    materializedId,
    expectedSpeciesMatter,
    materializedSpeciesMatter,
    roundTripMatterDelta,
    agedOut,
    ageMatterDelta,
    deathStatisticDelta: W.statistics.deaths - deathsBefore,
    deathEvent: {type: deathEvent?.type, magnitude: deathEvent?.magnitude},
    born,
    birthMatterDelta,
    birthStatisticDelta: W.statistics.births - birthsBefore,
    birthEvent: {type: birthEvent?.type, magnitude: birthEvent?.magnitude},
    zeroDamageNoOp,
    overflowEffectExact,
    overflowVisibleToWork,
    transferCapacityExact,
    transferMatterDelta,
    deathTickRecorded,
    remainingCorpses: remainingCorpses.length,
    oldestPruned,
    newestRetained,
    pruneMatterDelta,
    audit,
  };
})()`;

const assertions = String.raw`
game.createTestWorld({seed: "cohort-focused", size: "small", lifeDensity: 0.1, harshness: 0.5, variability: 0.5});
const cohortTest = sandbox.window.ALIFE_COHORT_TEST;
if (!cohortTest) throw new Error("Focused cohort test surface did not initialize");
const first = cohortTest.run();
game.createTestWorld({seed: "cohort-focused", size: "small", lifeDensity: 0.1, harshness: 0.5, variability: 0.5});
const repeat = cohortTest.run();
const failures = [];
if (!first.aggregated || !first.materializedId) failures.push("cohort round-trip did not aggregate and materialize");
if (first.materializedSpeciesMatter !== first.expectedSpeciesMatter) failures.push("materialization truncated matter above 65535");
if (first.roundTripMatterDelta !== 0) failures.push("cohort materialization changed total matter");
if (first.agedOut !== 5 || first.deathStatisticDelta < 5 || first.deathEvent.type !== "DeathEvent" || first.deathEvent.magnitude !== 5) failures.push("cohort aging did not reconcile deaths, statistics, and events");
if (first.ageMatterDelta !== 0) failures.push("cohort aging changed total matter");
if (first.born !== 1 || first.birthStatisticDelta !== 1 || first.birthEvent.type !== "BirthEvent" || first.birthEvent.magnitude !== 1) failures.push("cohort reproduction did not reconcile births, statistics, and events");
if (first.birthMatterDelta !== 0) failures.push("cohort reproduction changed total matter");
if (!first.zeroDamageNoOp) failures.push("zero damage mutated authoritative state");
if (!first.overflowEffectExact || !first.overflowVisibleToWork) failures.push("tile matter overflow was clipped or hidden from resource work");
if (!first.transferCapacityExact || first.transferMatterDelta !== 0) failures.push("capacity-limited resource transfer lost or created matter");
if (!first.deathTickRecorded) failures.push("erased corpse did not retain its death tick in history");
if (first.remainingCorpses !== 500 || !first.oldestPruned || !first.newestRetained) failures.push("corpse cap did not prune the oldest-dead corpses");
if (first.pruneMatterDelta !== 0) failures.push("corpse pruning changed total matter");
if (!first.audit.ok) failures.push("cohort count/age-bin invariants failed");
if (JSON.stringify(first) !== JSON.stringify(repeat)) failures.push("focused cohort mechanics were not deterministic");
console.log(JSON.stringify({ok: !failures.length, failures, result: first}, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_COHORT_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
