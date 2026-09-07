// Markets smoke: price boards read scarcity, a town's specialty is what it
// holds beyond its needs, a coining polity gathers a tithe into its treasury,
// coin buys grain for a hungry town from a foreign town at peace with the
// food really moving and no matter made, coin hires hands at a civic work
// face, a market is planned once coin is known, and the Economy page, the
// index card, and the polity and place rows render; a market stall draws.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const mk = window.ALIFE_MARKET_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const complete = (place, type) => {
    const b = planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeId === place.id && x.type === type && !x.complete);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  // A second town of another polity within purchase reach.
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  let second = null;
  for (let tries = 0; tries < 600 && !second && people.length; tries++) {
    const x = 4 + ((tries * 37 + 11) % (W.width - 8)), y = 4 + ((tries * 23) % (W.height - 8)), t = idx(x, y), d = Math.sqrt(dist2(x, y, settlement.x, settlement.y));
    if (d < 14 || d > 50) continue;
    if (W.tiles.liquid[t] > WATER_DEPTH.SURFACE || campNear(t, 6) || nearestSettlement(t, 10)) continue;
    const founder = people.pop(), soc = W.components.social[founder];
    if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; soc.factionId = 0; }
    const camp = createCamp(t, founder);
    if (!camp) continue;
    for (const type of ["stockpile", "shelter", "hearth"]) complete(camp, type);
    second = createSettlement(camp.id);
  }
  if (!second) { fail("could not raise a second town"); return out; }
  if (!second.factionId || second.factionId === settlement.factionId) { second.factionId = 0; createFaction(second.id); }
  const A = W.factions.find((f) => f.id === settlement.factionId), B = W.factions.find((f) => f.id === second.factionId);
  if (!A || !B || A === B) { fail("the towns do not belong to two polities"); return out; }
  if (typeof ensureTownEconomy === "function") { ensureTownEconomy(settlement); ensureTownEconomy(second); }
  // Prices read scarcity.
  settlement.inventory[C.ORGANIC] = 1; second.inventory[C.ORGANIC] = 500; second.storageCapacity = Math.max(second.storageCapacity || 0, 1200);
  out.priceDear = mk.price(settlement.id, C.ORGANIC); out.priceCheap = mk.price(second.id, C.ORGANIC);
  if (!(out.priceDear >= 2) || mk.word(out.priceDear) !== "dear") fail("grain is not dear where there is none: " + out.priceDear);
  if (!(out.priceCheap <= 0.5) || mk.word(out.priceCheap) !== "cheap") fail("grain is not cheap where it brims: " + out.priceCheap);
  // Specialty is the surplus held beyond need.
  second.inventory[C.ORE] = 300;
  out.specialty = mk.specialty(second.id);
  if (out.specialty !== C.ORE && out.specialty !== C.ORGANIC) fail("the rich town's specialty is neither its ore nor its grain: " + out.specialty);
  // A coining polity gathers a tithe.
  if (!settlement.knownProcesses.includes("currency")) settlement.knownProcesses.push("currency");
  settlement.economy.exchangeCount = (settlement.economy.exchangeCount || 0) + 10;
  out.treasuryBefore = mk.treasury(A.id);
  out.tax = mk.tax(A.id);
  if (!(out.tax >= 5)) fail("ten exchanges yielded no tithe: " + out.tax);
  // Coin buys grain across the border; the food moves and nothing is made.
  A.treasury = 50;
  A.relations[B.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 };
  B.relations[A.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 };
  const matterBefore = totalMatter(), grainBefore = settlement.inventory[C.ORGANIC], sellerBefore = second.inventory[C.ORGANIC], coinBefore = A.treasury;
  const purchase = mk.buy(settlement.id, true);
  if (!purchase) fail("no grain was bought with coin in hand: " + JSON.stringify({ room: placeStorageRemaining(settlement), surplus: materialSurplus(second, C.ORGANIC), price: mk.price(second.id, C.ORGANIC) }));
  else {
    out.purchase = eventSentence(purchase);
    const bought = settlement.inventory[C.ORGANIC] - grainBefore;
    out.bought = bought; out.coinSpent = +(coinBefore - A.treasury).toFixed(1);
    if (!(bought >= 4) || sellerBefore - second.inventory[C.ORGANIC] !== bought) fail("the grain did not move store to store: " + JSON.stringify({ bought, seller: sellerBefore - second.inventory[C.ORGANIC] }));
    if (!(out.coinSpent > 0)) fail("the purchase cost no coin");
    if (totalMatter() !== matterBefore) fail("the purchase created or destroyed matter");
    if (!/bought/.test(out.purchase)) fail("the purchase is not chronicled: " + out.purchase);
    if (bought >= 30 && !alertWorthy(purchase)) fail("a large purchase does not reach the alerts");
  }
  // Coin hires hands at a civic work face.
  A.treasury = 100;
  const hall = planBuilding(settlement, "hall", 5) || W.buildings.find((x) => !x.ruined && x.placeId === settlement.id && x.type === "hall" && !x.complete);
  if (!hall) fail("no hall to hire hands for");
  else {
    const workBefore = hall.workDone, coin = A.treasury;
    out.hired = mk.hire(A.id);
    if (!(out.hired >= 1) || !(hall.workDone > workBefore) || !(A.treasury < coin)) fail("coin hired no hands: " + JSON.stringify({ hired: out.hired, work: hall.workDone - workBefore, coin: coin - A.treasury }));
  }
  // A market is planned once coin is known and the town is big enough.
  out.pop = settlementPopulation(settlement);
  if (out.pop >= 10) { out.marketPlanned = mk.plan(settlement.id); if (!out.marketPlanned) fail("no market was planned in a coining town of " + out.pop); }
  else out.planSkipped = "town too small for a market in this fixture";
  // Pages, the index card, and the stall.
  const page = mk.page();
  if (!/Treasuries/.test(page) || !/Busiest roads/.test(page) || !/Price boards/.test(page)) fail("the Economy page is missing its sections");
  if (!/Economy/.test(renderLegendIndex(""))) fail("the Legends index has no Economy card");
  if (!/Treasury/.test(window.ALIFE_LEGENDS_DEBUG.render("faction", A.id))) fail("the polity page has no treasury row");
  if (!/Specialty/.test(window.ALIFE_LEGENDS_DEBUG.render("place", second.id))) fail("the place page has no specialty row");
  complete(settlement, "market");
  UI.camera.x = settlement.x; UI.camera.y = settlement.y;
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 3, now: 5000 });
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "standard", zoom: 2, now: 5100 });
  if (typeof worldHash === "function" && worldHash() !== worldHash()) fail("rendering the market was not stable");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_MARKET_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_MARKET_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
