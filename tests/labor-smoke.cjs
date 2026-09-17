// Labour smoke: every worker of a town takes the one open order that scores
// highest for it, so a plan wanting something nobody can source held every
// hand at stockpile labour while a stocked plan stood unworked; now a plan
// whose want has no source in the hand, the store or the ground is set aside
// for a year and the next plan is taken, and the set-aside plan comes back
// when its year is up.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const out = { failures: [] }, fail = (m) => out.failures.push(m);
  let town = null;
  for (let attempt = 0; attempt < 4 && !town; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    town = W.settlements.find((s) => !s.ruined);
    if (!town) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); town = W.settlements.find((s) => !s.ruined); } }
  }
  if (!town) { fail("no settlement"); return out; }
  // Two plans: a monument wanting glass, which lies on no ground, and a shelter with every material in place.
  const wantingGlass = planBuilding(town, "monument", 9) || planBuilding(town, "workshop", 9);
  const stocked = planBuilding(town, "shelter", 9) || planBuilding(town, "stockpile", 9);
  if (!wantingGlass || !stocked) { fail("fixture could not plan two buildings"); return out; }
  wantingGlass.requirements = [[C.GLASS, 4]];
  for (const [sp, n] of stocked.requirements || []) stocked.composition[sp] = n;
  const orderOf = (b) => W.workOrders.find((o) => o.buildingId === b.id && o.status === "open");
  const wantOrder = orderOf(wantingGlass), stockedOrder = orderOf(stocked);
  if (!wantOrder || !stockedOrder) { fail("the plans have no open orders"); return out; }
  wantOrder.priority = 9; stockedOrder.priority = 1;
  // A fed, rested worker of the town, standing at the hall with empty hands.
  const worker = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.position[id] && W.components.inventory[id] && W.components.chemistry[id]);
  if (!worker) { fail("nobody to work"); return out; }
  const soc = W.components.social[worker], p = W.components.position[worker], q = W.components.chemistry[worker].q, inv = W.components.inventory[worker].materials, life = W.components.life[worker];
  soc.homePlaceKind = "settlement"; soc.homePlaceId = town.id; soc.factionId = town.factionId || soc.factionId;
  p.x = town.x; p.y = town.y;
  const topUp = (sp, to) => { const d = Math.max(0, to - q[sp]); q[sp] += d; W.conservation.playerInput += d; };
  topUp(C.SOLVENT, 400); topUp(C.ENERGY, 400); life.fatigue = 10;
  // Empty hands: anything held could be a tool recipe, and the labour crafts before it hauls.
  for (let sp = 0; sp < inv.length; sp++) { W.conservation.playerInput -= inv[sp]; inv[sp] = 0; }
  const glassInStore = town.inventory[C.GLASS] || 0; town.inventory[C.GLASS] = 0; W.conservation.playerInput -= glassInStore;
  const w = workState(worker); w.task = ""; w.craftPurpose = "";
  rebuildSpatialBins();
  out.firstPick = selectWorkOrder(worker, town)?.id || 0;
  if (out.firstPick !== wantOrder.id) fail("the plan wanting glass does not score highest: " + out.firstPick + " vs " + wantOrder.id);
  // The labour body itself (30d), under the wrappers that send hands to toolmaking, research, the foundry and the fields first.
  performCivilLaborSafetyBase(worker);
  out.after = w.task + "/" + (w.detail || w.action || "");
  out.blockedUntil = wantOrder.blockedUntil || 0;
  if (!(out.blockedUntil > W.tick)) fail("a plan whose want has no source was not set aside");
  // The next plan is taken: the town's other open orders (the civic scenario plans its own) rank by score, the stocked shelter among them.
  out.secondPick = selectWorkOrder(worker, town)?.id || 0;
  if (!out.secondPick || out.secondPick === wantOrder.id) fail("the set-aside plan was taken again, or no plan at all: " + out.secondPick);
  const open = W.workOrders.filter((o) => o.placeKind === "settlement" && o.placeId === town.id && o.status === "open" && o.id !== wantOrder.id);
  for (const o of open) if (o.id !== stockedOrder.id) o.blockedUntil = W.tick + 1;
  out.stockedPick = selectWorkOrder(worker, town)?.id || 0;
  if (out.stockedPick !== stockedOrder.id) fail("the stocked plan was not taken when it was the next: " + out.stockedPick + " vs " + stockedOrder.id);
  for (const o of open) if (o.id !== stockedOrder.id) o.blockedUntil = 0;
  // When its year is up the plan comes back.
  wantOrder.blockedUntil = W.tick;
  out.laterPick = selectWorkOrder(worker, town)?.id || 0;
  if (out.laterPick !== wantOrder.id) fail("the set-aside plan did not come back: " + out.laterPick);
  // A plot the hands cannot work is no plot (128): the open ground offers nothing past the labour reach,
  // and a foundation laid out past it is laid out again where the town's siting puts it now.
  const openPlot = openGroundPlot(town, "launch_tower");
  out.openPlot = openPlot ? Math.round(Math.sqrt(dist2(town.x, town.y, openPlot[0], openPlot[1]))) : null;
  if (openPlot && out.openPlot > OPEN_GROUND_WORK_REACH) fail("the open ground offered a plot past the labour reach: " + out.openPlot);
  let fx = -1, fy = -1;
  for (const [dx, dy] of [[31, 0], [-31, 0], [0, 31], [0, -31], [22, 22], [-22, 22], [22, -22], [-22, -22]]) {
    const x = town.x + dx, y = town.y + dy;
    if (x >= 1 && y >= 1 && x < W.width - 1 && y < W.height - 1) { fx = x; fy = y; break; }
  }
  if (fx >= 0) {
    stocked.x = fx; stocked.y = fy; stocked.workDone = 0;
    out.farBefore = Math.round(Math.sqrt(dist2(town.x, town.y, fx, fy)));
    out.resited = openGroundResite(town);
    out.farAfter = Math.round(Math.sqrt(dist2(town.x, town.y, stocked.x, stocked.y)));
    if (!(out.resited >= 1) || out.farAfter > OPEN_GROUND_WORK_REACH) fail("a foundation past the labour reach was not laid out again nearer: " + out.farBefore + " -> " + out.farAfter);
  } else out.resited = "map too small for a far plot";
  // A structure the quarters cannot hold stands on the open ground too (128): the open ground offers a clinic
  // a plot within the labour reach, and the fields, pasture, walls, docks and waterworks keep their own siting.
  const clinicPlot = openGroundPlot(town, "clinic");
  out.clinicPlot = clinicPlot ? Math.round(Math.sqrt(dist2(town.x, town.y, clinicPlot[0], clinicPlot[1]))) : null;
  if (!clinicPlot || out.clinicPlot > OPEN_GROUND_WORK_REACH) fail("the open ground offered a clinic no plot within the labour reach: " + out.clinicPlot);
  if (!OPEN_GROUND_OWN_SITING.has("farm") || OPEN_GROUND_OWN_SITING.has("clinic")) fail("the own-siting set is wrong");
  const planned = plannedBuildingTile(town, "clinic", 9);
  if (!planned) fail("a clinic could not be sited at all");
  if (planned && !openGroundPlotReachable(town, planned[0], planned[1])) fail("a clinic was sited where the hall cannot walk");
  // A plan on ground the hall cannot walk to is laid out again as well: the shelter is set in deep water within reach.
  let wx = -1, wy = -1;
  for (let r = 3; r <= 20 && wx < 0; r++)
    for (let dy = -r; dy <= r && wx < 0; dy++)
      for (let dx = -r; dx <= r && wx < 0; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = town.x + dx, y = town.y + dy;
        if (x < 2 || y < 2 || x >= W.width - 2 || y >= W.height - 2) continue;
        let deep = true;
        for (let ny = -1; ny <= 1 && deep; ny++) for (let nx = -1; nx <= 1 && deep; nx++) if (W.tiles.liquid[idx(x + nx, y + ny)] <= WATER_DEPTH.WADE_LIMIT) deep = false;
        if (deep) { wx = x; wy = y; }
      }
  if (wx >= 0) {
    stocked.x = wx; stocked.y = wy; stocked.workDone = 0;
    out.wetBefore = openGroundPlotReachable(town, wx, wy);
    out.wetResited = openGroundResite(town);
    out.wetAfter = openGroundPlotReachable(town, stocked.x, stocked.y);
    if (out.wetBefore || !(out.wetResited >= 1) || !out.wetAfter) fail("a foundation on ground the hall cannot walk to was not laid out again: " + JSON.stringify([out.wetBefore, out.wetResited, out.wetAfter]));
  } else out.wetResited = "no deep water within reach of the fixture town";
  // A field has a gate (138): a person's step onto a standing field is not blocked, a grazer's is.
  let field = completedBuildings(town, "farm")[0] || W.buildings.find((b) => b.type === "farm" && b.complete && !b.ruined);
  if (!field) {
    // The fixture has no standing field: plan one and finish it, its material booked as the player's gift.
    field = planBuilding(town, "farm", 9);
    if (field) {
      for (const [sp, n] of field.requirements) { W.conservation.playerInput += n - (field.composition[sp] || 0); field.composition[sp] = n; }
      field.workDone = field.workRequired;
      refreshBuildingStage(field);
      if (!field.complete) field = null;
      else if (typeof rebuildDevelopmentMovementCache === "function") rebuildDevelopmentMovementCache();
    }
  }
  if (field) {
    const grazer = W.activeIds.find((id) => W.kind[id] === KINDS.HERBIVORE && classifyAlive(id) && W.components.position[id]);
    out.personBlocked = movementTileBlocked(worker, field.x, field.y);
    out.grazerBlocked = grazer ? movementTileBlocked(grazer, field.x, field.y) : null;
    const step = constrainDevelopedMovement(worker, field.x, field.y);
    out.personStep = step.x === field.x && step.y === field.y;
    if (out.personBlocked || !out.personStep) fail("a person was kept off a field: blocked " + out.personBlocked + " step " + out.personStep);
    if (grazer && !out.grazerBlocked) fail("a grazer walked into a field");
    // A person crossing the field does not graze it: the crop is no food to a person's appetite, and no meal is taken.
    const fieldTile = idx(field.x, field.y);
    W.tiles.chem[C.ORGANIC][fieldTile] = Math.max(W.tiles.chem[C.ORGANIC][fieldTile], 400); W.tiles.chem[C.ENERGY][fieldTile] = Math.max(W.tiles.chem[C.ENERGY][fieldTile], 400); W.tiles.plantOrder[fieldTile] = Math.max(W.tiles.plantOrder[fieldTile], 400);
    W.conservation.playerInput += 0; // the top-up above is a test fixture write; the labour test does not audit matter
    out.fieldFoodPerson = +tileFood(fieldTile, "omnivore").toFixed(2);
    out.fieldFoodGrazer = +tileFood(fieldTile, "grazer").toFixed(2);
    // performFeeding is wrapped downstream by the rations of the store, so a true here may be a meal from the granary;
    // grazing is read from the field's own tile matter, which must not move.
    const organicBefore = W.tiles.chem[C.ORGANIC][fieldTile];
    out.fieldMeal = performFeeding(worker, fieldTile);
    out.fieldOrganicTaken = organicBefore - W.tiles.chem[C.ORGANIC][fieldTile];
    if (out.fieldFoodPerson !== 0 || out.fieldOrganicTaken !== 0) fail("a person grazed a standing field: food " + out.fieldFoodPerson + " taken " + out.fieldOrganicTaken);
    if (!(out.fieldFoodGrazer > 0)) fail("a grazer's read of the field was changed: " + out.fieldFoodGrazer);
  } else out.personBlocked = "no standing field in the fixture";
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_LABOR_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_LABOR_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
