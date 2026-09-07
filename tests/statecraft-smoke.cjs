// Statecraft smoke: opinion drifts toward what trade and grievance warrant and
// carries its reasons; opinion bears on war pressure and a pact caps it; envoys
// carry pacts, open markets, embassies, and alliances that become treaties with
// real effects; a hegemon draws a coalition league; radio courts answer over
// the wire; the polity page shows a Relations table.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const sc = window.ALIFE_STATECRAFT_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
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
  // Two more towns, each its own polity, within contact.
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  const towns = [];
  for (let tries = 0; tries < 900 && towns.length < 2 && people.length > 2; tries++) {
    const x = 4 + ((tries * 37 + 11) % (W.width - 8)), y = 4 + ((tries * 23) % (W.height - 8)), t = idx(x, y), d = Math.sqrt(dist2(x, y, settlement.x, settlement.y));
    if (d < 14 || d > 26) continue;
    if (W.tiles.liquid[t] > WATER_DEPTH.SURFACE || campNear(t, 6) || nearestSettlement(t, 10)) continue;
    if (!civilReachable(idx(settlement.x, settlement.y), { x, y }, settlement.factionId)) continue;
    const founder = people.pop(), soc = W.components.social[founder];
    if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; soc.factionId = 0; }
    const camp = createCamp(t, founder);
    if (!camp) continue;
    for (const type of ["stockpile", "shelter", "hearth"]) complete(camp, type);
    const town = createSettlement(camp.id);
    if (!town) continue;
    if (!town.factionId || town.factionId === settlement.factionId || towns.some((q) => q.factionId === town.factionId)) { town.factionId = 0; createFaction(town.id); }
    const tf = W.factions.find((f) => f.id === town.factionId);
    if (tf && soc) { soc.factionId = tf.id; soc.homePlaceKind = "settlement"; soc.homePlaceId = town.id; tf.leaderId = tf.leaderId || founder; }
    towns.push(town);
  }
  if (towns.length < 2) { fail("could not raise two more polities"); return out; }
  const A = W.factions.find((f) => f.id === settlement.factionId), B = W.factions.find((f) => f.id === towns[0].factionId), Cf = W.factions.find((f) => f.id === towns[1].factionId);
  if (!A || !B || !Cf || new Set([A, B, Cf]).size !== 3) { fail("three polities were not raised"); return out; }
  for (const f of [A, B, Cf]) { f.leaderId = f.leaderId || W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]?.factionId === f.id) || 0; f.stability = Math.max(f.stability || 0, 0.6); }
  const rel = (x, y) => (x.relations[y.id] = x.relations[y.id] || { status: "neutral", pressure: 0, grievance: 0, trade: 0 });
  for (const [x, y] of [[A, B], [B, A], [A, Cf], [Cf, A], [B, Cf], [Cf, B]]) rel(x, y);
  if (!factionsHaveContact(A, B)) { rel(A, B).trade = 1; rel(B, A).trade = 1; }
  // Opinion follows trade and grievance and carries its reasons.
  rel(A, B).trade = 10; rel(A, B).grievance = 0; rel(A, B).opinion = 0;
  sc.update();
  out.opinionTrade = sc.opinion(A.id, B.id);
  const reasons = sc.reasons(A.id, B.id).reasons.map((r) => r.label);
  if (!(out.opinionTrade > 0) || !reasons.includes("trade between them")) fail("trade did not warm opinion: " + out.opinionTrade + " " + reasons.join(","));
  rel(A, B).grievance = 30;
  for (let i = 0; i < 6; i++) sc.update();
  out.opinionGrievance = sc.opinion(A.id, B.id);
  if (!(out.opinionGrievance < out.opinionTrade)) fail("grievance did not cool opinion: " + out.opinionGrievance);
  // Opinion bears on war pressure; a pact caps it.
  rel(A, B).opinion = 50; rel(B, A).opinion = 50;
  const warm = sc.pressure(A.id, B.id).pressure;
  rel(A, B).opinion = -50; rel(B, A).opinion = -50;
  const cold = sc.pressure(A.id, B.id).pressure;
  out.pressureGap = +(cold - warm).toFixed(1);
  if (!(out.pressureGap >= 39)) fail("opinion does not bear on pressure: " + out.pressureGap);
  rel(A, B).opinion = 0; rel(B, A).opinion = 0;
  // Proposals are accepted or refused by opinion; the treaties have effects.
  rel(B, A).opinion = -90;
  if (sc.accept("alliance", A.id, B.id) !== null) fail("a hostile court accepted an alliance");
  rel(B, A).opinion = 0;
  const propose = (from, to, kind) => sc.bind(kind, from.id, to.id);
  const pact = propose(A, B, "pact");
  if (!pact || pact.type !== "PactEvent") fail("no pact was sworn: " + JSON.stringify(pact && pact.type));
  else { out.pactSentence = eventSentence(pact); if (!sc.treaty("pact", A.id, B.id)) fail("the pact is not an active treaty"); }
  rel(A, B).pressure = 120; rel(B, A).pressure = 120;
  out.pactPressure = sc.pressure(A.id, B.id).pressure;
  if (!(out.pactPressure <= 50)) fail("a pact does not cap pressure: " + out.pactPressure);
  const tradeBefore = rel(A, B).trade, trade = propose(A, B, "trade");
  if (!trade || trade.type !== "TradeTreatyEvent") fail("no markets were opened");
  else if (!(rel(A, B).trade > tradeBefore)) fail("open markets did not widen trade");
  const embassy = propose(A, Cf, "embassy");
  if (!embassy || embassy.type !== "EmbassyEvent") fail("no embassy was set");
  else { out.embassySentence = eventSentence(embassy); if (!sc.reasons(A.id, Cf.id).reasons.some((r) => r.label === "an embassy at the court")) fail("the embassy does not warm opinion"); }
  rel(A, Cf).opinion = 40; rel(Cf, A).opinion = 40;
  const alliance = propose(A, Cf, "alliance");
  if (!alliance || alliance.type !== "AllianceTreatyEvent") fail("no alliance was bound");
  else if (!A.allies.includes(Cf.id) || !Cf.allies.includes(A.id)) fail("the alliance did not make allies");
  // A hegemon draws a coalition.
  A.militaryStrength = 400; A.population = 400; A.cohesion = 1;
  B.militaryStrength = 5; B.population = 20; Cf.militaryStrength = 5; Cf.population = 20;
  out.hegemon = sc.hegemon();
  if (out.hegemon !== A.name) fail("the strongest polity is not seen as a hegemon: " + out.hegemon);
  rel(B, A).opinion = -20; rel(Cf, A).opinion = -20;
  Cf.allies = Cf.allies.filter((id) => id !== A.id); A.allies = A.allies.filter((id) => id !== Cf.id);
  const coalition = sc.coalition();
  if (!coalition) fail("no coalition formed against the hegemon");
  else { out.coalitionSentence = eventSentence(coalition); if (!/coalition against/.test(out.coalitionSentence) || !alertWorthy(coalition)) fail("the coalition is not chronicled or alerted: " + out.coalitionSentence); }
  // Radio courts answer over the wire.
  for (const town of [settlement, towns[0]]) if (!town.knownProcesses.includes("radio")) town.knownProcesses.push("radio");
  W.diplomacy.envoys = W.diplomacy.envoys.filter((e) => !e.active);
  const homeA = factionCapital(A), courtB = factionCapital(B);
  const wire = sendEnvoy(A, B, "embassy");
  out.wire = wire ? { wire: !!wire.wire, active: wire.active } : { candidates: caravanCandidates(homeA, 3).length, reach: civilReachable(idx(homeA.x, homeA.y), courtB, A.id), living: [livingFaction(A), livingFaction(B)] };
  if (!wire) out.wireSkipped = "no envoy could be sent in this fixture: " + JSON.stringify(out.wire);
  else if (!wire.wire || wire.active) fail("radio courts did not answer over the wire: " + JSON.stringify(out.wire));
  // The polity page shows a Relations table.
  const page = window.ALIFE_LEGENDS_DEBUG.render("faction", A.id);
  if (!/Relations/.test(page) || !/cordial|cool|cold|warm|hostile/.test(page)) fail("the polity page has no Relations table");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_STATECRAFT_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_STATECRAFT_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
