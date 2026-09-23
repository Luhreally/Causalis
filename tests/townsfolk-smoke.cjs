// Townsfolk smoke: an industrial town keeps its many as a ledger (150). A life
// past the town's budget folds into it with all its matter; a child of two of
// its people over the budget is born into it; the ledger eats from the
// stores, grows hungry without them, works a fallow field, and brings a life
// forward when the named cast runs short; a town counts its ledger among its
// people; and the matter of the world balances through all of it. The machine
// farm (151): the industrial crafts give a field more growth updates,
// chemistry is no water craft, and railways run on steam.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const F = window.ALIFE_FOLK_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  // The scenario's people are young; they are grown here so that they may be folded and bear children.
  for (const id of people) {
    Object.assign(W.components.social[id], { homePlaceKind: "settlement", homePlaceId: s.id });
    const body = W.components.body[id];
    W.components.life[id].age = Math.max(W.components.life[id].age, Math.floor((body?.maxAge || 19200) * 0.3));
  }
  if (!s.knownProcesses.includes("mechanization")) s.knownProcesses.push("mechanization");
  out.era = F.era(s.id);
  if (!out.era) fail("a town that knows mechanization is not of the industrial era");
  const matter = () => auditMatter().delta;
  const m0 = matter();
  // Folded past the budget, with every packet of its matter.
  F.budget(Math.max(1, F.agents(s.id) - 2));
  const before = F.agents(s.id), popBefore = settlementPopulation(s);
  const folded = F.fold(s.id);
  out.folded = folded;
  const ledger = F.ledger(s.id);
  if (!(folded >= 1 && ledger && ledger.count === folded)) fail("the lives past the budget were not folded into the ledger: " + JSON.stringify({ folded, count: ledger?.count }));
  if (F.agents(s.id) !== before - folded) fail("folded lives are still walking");
  if (settlementPopulation(s) !== popBefore) fail("the town lost people by folding them: " + popBefore + " to " + settlementPopulation(s));
  if (matter() !== m0) fail("folding lost or made matter: " + (matter() - m0));
  // A child of two of the town's people, over the budget, is born into the ledger.
  const pair = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]?.homePlaceId === s.id).slice(0, 2);
  if (pair.length === 2) {
    for (const id of pair) { const q = W.components.chemistry[id].q; for (const sp of [C.SOLVENT, C.ORGANIC, C.ENERGY, C.NUTRIENT, C.INFO, C.MEMBRANE, C.FIBER]) q[sp] = Math.max(q[sp], 200); }
    const m1 = matter(), countBefore = F.ledger(s.id).count, agentsBefore = F.agents(s.id);
    const child = createOffspring(KINDS.PERSON, pair, idx(s.x, s.y));
    out.birth = { child, count: F.ledger(s.id).count - countBefore };
    if (child || F.ledger(s.id).count !== countBefore + 1 || F.agents(s.id) !== agentsBefore) fail("a child over the budget was not born into the ledger: " + JSON.stringify(out.birth));
    if (matter() !== m1) fail("the ledger's birth lost or made matter: " + (matter() - m1));
  } else fail("too few people for a birth");
  // The ledger eats from the stores and the matter holds.
  s.inventory[C.ORGANIC] = Math.max(s.inventory[C.ORGANIC], 3000);
  const m2 = matter(), organicBefore = s.inventory[C.ORGANIC];
  F.pass(s.id);
  out.fed = F.ledger(s.id).fed;
  if (!(s.inventory[C.ORGANIC] < organicBefore)) fail("the ledger ate nothing from full stores");
  if (!(out.fed > 0.9)) fail("a ledger beside full stores is not fed: " + out.fed);
  if (matter() !== m2) fail("the ledger's meal lost or made matter: " + (matter() - m2));
  // Without food it goes hungry.
  s.inventory[C.ORGANIC] = 0; s.inventory[C.ENERGY] = 0;
  F.pass(s.id);
  out.hungry = F.ledger(s.id).fed;
  if (!(out.hungry < 0.5)) fail("a ledger beside empty stores is fed: " + out.hungry);
  // The ledger's hands sow a fallow field.
  const farm = W.buildings.find((b) => b.type === "farm" && b.placeId === s.id && b.complete && !b.ruined) ||
    (() => { const b = planBuilding(s, "farm", 9); if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; } return b; })();
  if (farm) {
    const field = cultivatedField(farm);
    field.stage = "fallow";
    s.inventory[C.ORGANIC] = 400; s.inventory[C.NUTRIENT] = 100;
    const ledgerNow = W.townsfolk[String(s.id)];
    ledgerNow.ageBins[1] += 20; ledgerNow.count += 20;
    const sownBefore = F.counts().sown;
    F.pass(s.id);
    out.sown = F.counts().sown - sownBefore;
    ledgerNow.ageBins[1] -= Math.min(20, ledgerNow.ageBins[1]); ledgerNow.count = ledgerNow.ageBins.reduce((a, b) => a + b, 0);
    if (!(out.sown >= 1 || cultivatedField(farm).stage !== "fallow")) fail("the ledger's hands did not sow a fallow field");
  } else fail("no farm to sow");
  // A life comes forward when the named cast runs short.
  F.budget(1000);
  const walking = F.agents(s.id), m3 = matter(), promotedBefore = F.counts().promoted;
  F.pass(s.id);
  out.promoted = F.counts().promoted - promotedBefore;
  if (F.ledger(s.id).count && !(out.promoted >= 1 && F.agents(s.id) === walking + 1)) fail("no life came forward from the ledger: " + JSON.stringify({ promoted: out.promoted, walking, now: F.agents(s.id) }));
  if (matter() !== m3) fail("bringing a life forward lost or made matter: " + (matter() - m3));
  F.budget(40);
  out.population = { town: settlementPopulation(s), world: populationSummary().person, ledger: F.total() };
  if (!(out.population.world >= out.population.ledger)) fail("the world's people do not count the ledger");
  // The machine farm.
  const M = window.ALIFE_MACHINE_FARM_DEBUG;
  const keep = s.knownProcesses.slice();
  s.knownProcesses.push("combustion", "electricity");
  out.extra = M.extra(s.id);
  if (!(out.extra >= 3)) fail("mechanization, combustion and electricity give fewer than three growth updates: " + out.extra);
  s.knownProcesses.push("chemistry");
  out.waterCrafts = harvestTechCount(s);
  if (out.waterCrafts !== 0) fail("chemistry counts as a water craft");
  s.knownProcesses.length = 0; s.knownProcesses.push(...keep);
  out.railways = M.railwaysNeed();
  if (!out.railways.includes("steam_power")) fail("railways do not need steam: " + out.railways.join(","));
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_TOWNSFOLK_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_TOWNSFOLK_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
