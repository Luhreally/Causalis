// Finery smoke: a polity with an empty treasury or a war raises a heavy tithe
// that doubles what the markets yield and strains its towns, and eases it when
// the need passes; grain the treasury buys is relief the town remembers; and a
// town with a market and well-off households buys finery from a town with a
// surplus, contenting the well-off and calming the town, with matter conserved.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const fin = window.ALIFE_FINERY_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const f = W.factions.find((x) => x.id === settlement.factionId);
  if (!f) { fail("no faction"); return out; }
  const complete = (place, type) => {
    const b = planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeId === place.id && x.type === type && !x.complete);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  // A second town of the same polity nearby, to sell.
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  let seller = null;
  for (let tries = 0; tries < 600 && !seller && people.length; tries++) {
    const x = 4 + ((tries * 37 + 11) % (W.width - 8)), y = 4 + ((tries * 23) % (W.height - 8)), t = idx(x, y), d = Math.sqrt(dist2(x, y, settlement.x, settlement.y));
    if (d < 12 || d > 40) continue;
    if (W.tiles.liquid[t] > WATER_DEPTH.SURFACE || campNear(t, 6) || nearestSettlement(t, 10)) continue;
    const founder = people.pop(), soc = W.components.social[founder];
    if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; }
    const camp = createCamp(t, founder);
    if (!camp) continue;
    for (const type of ["stockpile", "shelter", "hearth"]) complete(camp, type);
    seller = createSettlement(camp.id);
  }
  if (!seller) { fail("could not raise a seller town"); return out; }
  seller.factionId = f.id;
  if (!settlement.knownProcesses.includes("currency")) settlement.knownProcesses.push("currency");
  // ── The tithe ──
  complete(settlement, "market");
  f.treasury = 100;
  if (W.activeWars) for (const w of W.activeWars) if (!w.ended && (w.a === f.id || w.b === f.id)) w.ended = W.tick;
  fin.update();
  out.policyRich = fin.policy(f.id);
  if (out.policyRich !== "light") fail("a rich polity at peace tithes heavily");
  const lightCoin = collectTaxes(f);
  f.treasury = 0;
  fin.update();
  out.policyPoor = fin.policy(f.id);
  if (out.policyPoor !== "heavy") fail("an empty treasury did not raise the tithe");
  const titheEvent = W.events.find((e) => e.type === "TitheEvent");
  if (!titheEvent) fail("no TitheEvent"); else out.titheSentence = eventSentence(titheEvent);
  const before = f.treasury, heavyCoin = collectTaxes(f);
  out.coins = [lightCoin, heavyCoin, f.treasury - before];
  if (!(heavyCoin >= 2 * lightCoin) || f.treasury - before !== heavyCoin) fail("a heavy tithe did not double the yield: " + out.coins.join(","));
  out.strain = fin.strain(settlement.id);
  const unrestHeavy = unrestOf(settlement);
  fin.set(f.id, "light");
  const unrestLight = unrestOf(settlement);
  out.unrest = [unrestHeavy, unrestLight];
  if (!(out.strain > 0) || !(unrestHeavy > unrestLight)) fail("the heavy tithe is not felt: " + out.unrest.join("/"));
  if (!/Tithe/.test(renderLegendPage("faction", f.id))) fail("the polity page does not name the tithe");
  // ── Relief ──
  seller.inventory[C.ORGANIC] = Math.max(seller.inventory[C.ORGANIC], 400);
  settlement.inventory[C.ORGANIC] = 0;
  f.treasury = 200;
  const unrestBeforeRelief = unrestOf(settlement);
  const purchase = buyGrain(settlement, f, true);
  out.relief = fin.relief(settlement.id);
  if (!purchase) fail("the treasury bought no grain");
  else if (!(out.relief > 0) || !(unrestOf(settlement) < unrestBeforeRelief)) fail("relief did not calm the town: " + unrestBeforeRelief + " -> " + unrestOf(settlement));
  // ── Finery ──
  const residents = townResidents(settlement).filter((id) => W.components.identity[id]);
  if (residents.length < 3) { fail("too few residents for finery"); return out; }
  const keepStanding = residents.slice(0, 3).map((id) => W.components.identity[id].standing);
  W.components.identity[residents[0]].standing = "rich";
  W.components.identity[residents[1]].standing = "prosperous";
  W.components.identity[residents[2]].standing = "prosperous";
  out.demand = fin.demand(settlement.id);
  if (out.demand < 3) fail("the well-off households are not counted: " + out.demand);
  seller.inventory[C.PIGMENT] = 200;
  settlement.inventory[C.PIGMENT] = 0;
  const pigmentBefore = settlement.inventory[C.PIGMENT], matterBefore = totalMatter(), treasuryBefore = f.treasury;
  out.bought = fin.buyFor(settlement.id);
  if (!out.bought) fail("the town bought no finery");
  else {
    if (!(settlement.inventory[C.PIGMENT] > pigmentBefore)) fail("no finery arrived");
    if (!(f.treasury < treasuryBefore)) fail("the finery cost nothing");
    if (totalMatter() !== matterBefore) fail("finery created or destroyed matter");
    const finery = W.events.find((e) => e.type === "FineryEvent");
    if (!finery) fail("no FineryEvent"); else out.finerySentence = eventSentence(finery);
    if (!/Finery/.test(renderLegendPage("place", settlement.id))) fail("the place page does not show the finery");
    if (fin.buyFor(settlement.id)) fail("finery was bought twice in a year");
  }
  residents.slice(0, 3).forEach((id, n) => { W.components.identity[id].standing = keepStanding[n]; });
  simTick();
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_FINERY_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_FINERY_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
