// Waiting-field smoke: a farm planned three years ago and still at stage
// nought is counted as waiting, and reading it never writes the world; before
// any ship has left the effort supplies nothing; behind the ship one push
// places its first missing common material at the face, booked as the
// player's input, and a farm planned this year is left to the builders; a
// resident at hunger eighty beside a lean town's stocked farm raises it, and
// one at the hall draws the farm's water from the town's own stores; before
// the ship the same hands stand aside as they always did; the waiting farm's
// order outranks a tower block's behind the ship and not before, and a farm
// planned this year is not raised; a farm the town cannot walk to is neither
// first nor built by hungry hands nor sited again behind the ship, and two
// years planned it falls to rubble; the effort sows a lean town's long-fallow
// field behind the ship and not before, and tends it again when the press has
// no objective left; and the matter audit stays at nought throughout.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const field = window.ALIFE_FIELD_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  if (!s.knownProcesses.includes("agriculture")) s.knownProcesses.push("agriculture");
  const b = W.buildings.find((x) => !x.ruined && !x.complete && x.placeKind === "settlement" && x.placeId === s.id && x.type === "farm") || planBuilding(s, "farm", 9);
  if (!b) { fail("could not plan a farm"); return out; }
  const auditBefore = auditMatter().delta;
  // An empty face, planned three years ago.
  for (const [sp] of b.requirements) { W.conservation.playerInput -= b.composition[sp] || 0; b.composition[sp] = 0; }
  b.workDone = 0;
  refreshBuildingStage(b);
  b.createdTick = W.tick - 3 * TICKS_PER_YEAR;
  const hashBefore = worldHash();
  if (field.waiting(s.id) !== b) fail("the three-year farm is not counted as waiting");
  if (worldHash() !== hashBefore) fail("reading the waiting field wrote the world");
  // Before the ship the effort supplies nothing.
  out.supplyBeforeShip = field.supplyAll();
  if (out.supplyBeforeShip !== 0) fail("the field was supplied before any ship had left: " + out.supplyBeforeShip);
  const ship = { id: 1, settlementId: s.id, factionId: s.factionId || 0, buildingId: 0, tile: idx(s.x, s.y), tick: W.tick, eventId: 0, first: true };
  W.ascensions.push(ship);
  W.tick++;
  const missing0 = missingBuildingMaterial(b), input0 = W.conservation.playerInput;
  out.supply = field.supply(s.id);
  out.supplied = missing0 ? [W.definitions.species[missing0.sp].name, missing0.needed] : null;
  if (!(out.supply > 0)) fail("the waiting field was not supplied behind the ship");
  if (W.conservation.playerInput - input0 !== out.supply) fail("the supply was not booked as the player's input: " + (W.conservation.playerInput - input0) + " vs " + out.supply);
  if (missing0 && (b.composition[missing0.sp] || 0) < Math.min(missing0.needed, 24)) fail("the first missing material did not reach the face: " + b.composition[missing0.sp]);
  // A farm planned this year is left to the builders.
  b.createdTick = W.tick;
  out.supplyFresh = field.supply(s.id);
  if (out.supplyFresh !== 0) fail("a farm planned this year was supplied: " + out.supplyFresh);
  b.createdTick = W.tick - 3 * TICKS_PER_YEAR;
  // The waiting field comes first: its order outranks a tower block's behind the ship, and only then.
  {
    const order = W.workOrders.find((o) => o.status === "open" && o.buildingId === b.id);
    const who = W.activeIds.find((x) => W.kind[x] === KINDS.PERSON && classifyAlive(x) && W.components.position[x]);
    if (!order || who === undefined) fail("no open order for the farm, or nobody to score it");
    else {
      const tower = planBuilding(s, "tower", 9), towerOrder = tower ? W.workOrders.find((o) => o.status === "open" && o.buildingId === tower.id) : null;
      out.farmScore = Math.round(orderPriority(order, s, who));
      out.towerScore = towerOrder ? Math.round(orderPriority(towerOrder, s, who)) : null;
      if (towerOrder && !(out.farmScore > out.towerScore)) fail("the waiting farm did not outrank the tower block behind the ship: " + out.farmScore + " vs " + out.towerScore);
      W.ascensions.pop();
      W.tick++;
      out.farmScoreBeforeShip = Math.round(orderPriority(order, s, who));
      if (!(out.farmScoreBeforeShip <= out.farmScore - 100)) fail("the farm's order was raised before any ship had left: " + out.farmScoreBeforeShip + " vs " + out.farmScore);
      b.createdTick = W.tick;
      W.ascensions.push(ship);
      W.tick++;
      out.farmScoreFresh = Math.round(orderPriority(order, s, who));
      if (!(out.farmScoreFresh <= out.farmScore - 100)) fail("a farm planned this year was raised above the rest: " + out.farmScoreFresh + " vs " + out.farmScore);
      b.createdTick = W.tick - 3 * TICKS_PER_YEAR;
      if (tower) { const at = W.buildings.indexOf(tower); if (at >= 0) W.buildings.splice(at, 1); if (towerOrder) towerOrder.status = "cancelled"; }
    }
  }
  // Hungry hands: a resident at hunger eighty, thirst seventy, of a town whose bread is gone.
  const id = W.activeIds.find((x) => W.kind[x] === KINDS.PERSON && classifyAlive(x) && W.components.social[x] && W.components.position[x] && W.components.chemistry[x] && W.components.inventory[x]);
  if (id === undefined) { fail("no person"); W.ascensions.pop(); return out; }
  const soc = W.components.social[id], p = W.components.position[id], q = W.components.chemistry[id].q, inv = W.components.inventory[id].materials;
  const saved = { home: [soc.homePlaceKind, soc.homePlaceId, soc.factionId], pos: [p.x, p.y], energy: q[C.ENERGY], solvent: q[C.SOLVENT] };
  soc.homePlaceKind = "settlement"; soc.homePlaceId = s.id; soc.factionId = s.factionId;
  W.conservation.playerInput += 100 - q[C.ENERGY]; q[C.ENERGY] = 100;
  if (q[C.SOLVENT] < 150) { W.conservation.playerInput += 150 - q[C.SOLVENT]; q[C.SOLVENT] = 150; }
  if (W.components.campaign?.[id]) delete W.components.campaign[id];
  // The town is lean because its people are hungry: every resident at hunger eighty.
  const residents = granaryResidents(s).filter((x) => x !== id && W.components.chemistry[x]),
    savedEnergy = residents.map((x) => [x, W.components.chemistry[x].q[C.ENERGY]]);
  for (const [x, e] of savedEnergy) { W.conservation.playerInput += 100 - e; W.components.chemistry[x].q[C.ENERGY] = 100; derivedLife(x); }
  // The granary's own field rule works even ticks; the farm is raised on the odd ones.
  W.tick += ((W.tick + id) % 2 === 0) ? 1 : 2;
  // The face fully stocked: only the work remains.
  for (const [sp, n] of b.requirements) { W.conservation.playerInput += Math.max(0, n - (b.composition[sp] || 0)); b.composition[sp] = n; }
  refreshBuildingStage(b);
  p.x = clamp(b.x + 1, 0, W.width - 1); p.y = b.y;
  rebuildSpatialBins();
  derivedLife(id);
  out.hunger = Math.round(W.components.life[id].hunger);
  const outlook = foodOutlook(s);
  out.lean = !!(outlook && (outlook.lean || outlook.famine));
  if (!out.lean) fail("the emptied town is not lean: " + JSON.stringify(outlook));
  if (nearestFriendlyPlace(id) !== s) fail("the person's nearest friendly place is not the town");
  out.fitBehindShip = !!field.fit(id);
  if (!out.fitBehindShip) fail("hungry hands were not fit for the farm behind the ship (hunger " + out.hunger + ")");
  out.wanted = hungryHandsWanted(id, s);
  if (!out.wanted) fail("the labour tick did not want the hungry hands");
  const work0 = b.workDone;
  out.labour = performCivilLabor(id);
  if (!out.labour) fail("hungry hands did no labour on the stocked farm");
  if (!(b.workDone > work0)) fail("the stocked farm's work did not advance: " + work0 + " -> " + b.workDone);
  if (W.components.work?.[id]?.buildingId !== b.id) fail("the hungry hands' work is not the farm: " + JSON.stringify(W.components.work?.[id]?.task));
  // The farm's water, from the town's own stores, by a hand at the hall.
  W.conservation.playerInput -= b.composition[C.SOLVENT]; b.composition[C.SOLVENT] = 0;
  refreshBuildingStage(b);
  const water0 = s.inventory[C.SOLVENT] || 0;
  W.conservation.playerInput += 16 - water0; s.inventory[C.SOLVENT] = 16;
  const carried0 = inv[C.SOLVENT];
  W.conservation.playerInput -= carried0; inv[C.SOLVENT] = 0;
  p.x = s.x; p.y = s.y;
  rebuildSpatialBins();
  W.tick += 2;
  derivedLife(id);
  out.draw = performCivilLabor(id);
  out.drawn = inv[C.SOLVENT];
  if (!out.draw) fail("hungry hands did not draw the farm's water from the stores");
  if (out.drawn !== 8 || s.inventory[C.SOLVENT] !== 8) fail("the water did not move from the stores to the hands: hands " + out.drawn + " store " + s.inventory[C.SOLVENT]);
  // Before the ship the same hands stand aside as they always did.
  W.ascensions.pop();
  W.tick += 2;
  derivedLife(id);
  out.fitBeforeShip = !!field.fit(id);
  if (out.fitBeforeShip) fail("hungry hands were fit for the farm before any ship had left");
  clearStaleWork(id);
  out.labourBeforeShip = performCivilLabor(id);
  if (out.labourBeforeShip) fail("hungry hands laboured before any ship had left: " + JSON.stringify(W.components.work?.[id]?.phase));
  // A plot the town cannot walk to: no first place, no hungry hands, and, two years planned, given up for rubble;
  // and a farm sited behind the ship on such ground is sited again on open ground or not at all.
  {
    W.ascensions.push(ship);
    W.tick += 2;
    derivedLife(id);
    const reachableBase = openGroundPlotReachable;
    openGroundPlotReachable = () => false;
    out.reachable = field.reachable(s.id);
    if (out.reachable !== false) fail("the farm read as reachable with every plot barred: " + out.reachable);
    const order = W.workOrders.find((o) => o.status === "open" && o.buildingId === b.id);
    out.farmScoreBarred = order ? Math.round(orderPriority(order, s, id)) : null;
    if (order && out.farmScore !== undefined && !(out.farmScoreBarred <= out.farmScore - 100)) fail("a farm the town cannot walk to still came first: " + out.farmScoreBarred + " vs " + out.farmScore);
    out.fitBarred = !!field.fit(id);
    if (out.fitBarred) fail("hungry hands were fit for a farm the town cannot walk to");
    out.plotBarred = plannedBuildingTile(s, "farm", W.buildings.filter((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === s.id).length);
    if (out.plotBarred !== null) fail("a farm was sited behind the ship on ground the town cannot cross: " + JSON.stringify(out.plotBarred));
    const buildingsBefore = W.buildings.length;
    out.givenUp = field.giveUp(s.id);
    if (!out.givenUp || !b.ruined) fail("the farm the town cannot walk to was not given up");
    if (order && order.status === "open") fail("the given-up farm's order stayed open");
    if (W.buildings.length !== buildingsBefore) fail("giving up the farm removed a building from the world");
    openGroundPlotReachable = reachableBase;
    W.ascensions.pop();
  }
  // Put the world back the way it was, matter and all.
  W.conservation.playerInput -= inv[C.SOLVENT] - carried0; inv[C.SOLVENT] = carried0;
  W.conservation.playerInput -= (s.inventory[C.SOLVENT] || 0) - water0; s.inventory[C.SOLVENT] = water0;
  W.conservation.playerInput -= 100 - saved.energy; q[C.ENERGY] = saved.energy;
  W.conservation.playerInput -= q[C.SOLVENT] - saved.solvent; q[C.SOLVENT] = saved.solvent;
  for (const [x, e] of savedEnergy) { W.conservation.playerInput -= 100 - e; W.components.chemistry[x].q[C.ENERGY] = e; derivedLife(x); }
  [soc.homePlaceKind, soc.homePlaceId, soc.factionId] = saved.home; [p.x, p.y] = saved.pos;
  rebuildSpatialBins();
  // The effort sows a lean town's long-fallow field behind the ship, and not before.
  {
    const finish = (bld) => { if (bld) { bld.complete = true; bld.stage = 6; bld.integrity = bld.maxIntegrity; bld.completedTick = W.tick; for (const [sp, n] of bld.requirements || []) { W.conservation.playerInput += Math.max(0, n - (bld.composition[sp] || 0)); bld.composition[sp] = n; } } return bld; };
    const farm2 = finish(planBuilding(s, "farm", 9)), fld = farm2 ? cultivatedField(farm2) : null;
    if (!fld) fail("could not raise a finished farm with a field to sow");
    else {
      fld.stage = "fallow"; fld.lastLaborTick = W.tick - 200;
      for (const [x, e] of savedEnergy) { W.conservation.playerInput += 100 - e; W.components.chemistry[x].q[C.ENERGY] = 100; derivedLife(x); }
      W.conservation.playerInput += 100 - q[C.ENERGY]; q[C.ENERGY] = 100; derivedLife(id);
      W.tick++;
      out.sowBeforeShip = field.sow(s.id);
      if (out.sowBeforeShip !== 0 || fld.stage !== "fallow") fail("the effort sowed before any ship had left: " + out.sowBeforeShip);
      W.ascensions.push(ship);
      W.tick++;
      const input0 = W.conservation.playerInput;
      out.sown = field.sow(s.id);
      out.sowInput = W.conservation.playerInput - input0;
      if (out.sown !== 1 || fld.stage !== "sown") fail("the effort did not sow the lean town's fallow field: " + out.sown + " " + fld.stage);
      if (!(out.sowInput > 0)) fail("the sowing was not booked as the player's input");
      // With no objective left, the press tends the home world at its half-year beat: the field is sown again.
      fld.stage = "fallow"; fld.lastLaborTick = W.tick - 200;
      const target = W.civilization.concertedTarget;
      W.civilization.concertedTarget = null;
      W.tick++;
      out.tended = field.tend();
      if (fld.stage !== "sown") fail("the press with no target did not tend the fallow field: " + fld.stage);
      W.civilization.concertedTarget = target;
      W.ascensions.pop();
      fld.stage = "fallow"; fld.lastLaborTick = W.tick - 200;
      W.tick++;
      out.tendedBeforeShip = field.tend();
      if (out.tendedBeforeShip !== 0 || fld.stage !== "fallow") fail("the press tended the home world before any ship had left");
      W.ascensions.push(ship);
      for (const [x, e] of savedEnergy) { W.conservation.playerInput -= 100 - e; W.components.chemistry[x].q[C.ENERGY] = e; derivedLife(x); }
      W.conservation.playerInput -= 100 - saved.energy; q[C.ENERGY] = saved.energy; derivedLife(id);
    }
  }
  out.audit = auditMatter().delta - auditBefore;
  if (out.audit !== 0) fail("the matter audit moved: " + out.audit);
  out.counts = field.counts();
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_WAITING_FIELD_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_WAITING_FIELD_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
