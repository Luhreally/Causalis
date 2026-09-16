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
