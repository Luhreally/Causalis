// Diplomacy smoke: envoys who carry terms, a marriage that moves a person across
// a border and leaves a claim, tribute paid as real food, vassalage and
// independence, claims at successions, the Legends section, and stable drawing.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const dip = window.ALIFE_DIPLOMACY_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const A = settlement.factionId ? W.factions.find((f) => f.id === settlement.factionId) : createFaction(settlement.id);
  if (!A) { fail("no faction"); return out; }
  let B = W.factions.find((f) => f.id !== A.id && f.stability > 0);
  for (let attempt = 0; attempt < 12 && !B; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    const second = W.settlements.find((s) => !s.ruined && s.id !== settlement.id && !s.factionId);
    if (second) createFaction(second.id);
    B = W.factions.find((f) => f.id !== A.id && f.stability > 0);
  }
  if (!B) { fail("no second polity formed"); return out; }
  const capital = (f) => W.settlements.find((s) => s.id === f.capitalSettlementId);
  const homeA = capital(A), homeB = capital(B);
  if (!homeA || !homeB) { fail("a polity has no capital"); return out; }
  // Both polities have met, and each Voice has grown kin to offer.
  for (const [x, y] of [[A, B], [B, A]]) {
    const rel = x.relations[y.id] || (x.relations[y.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 });
    rel.pressure = Math.max(rel.pressure, 1);
  }
  const grow = (f, home) => {
    const people = entityAtRadius(idx(home.x, home.y), 10, KINDS.PERSON).filter((id) => classifyAlive(id) && W.components.social[id].factionId === f.id);
    for (const id of people) { W.components.life[id].age = Math.max(W.components.life[id].age, 4000); W.components.life[id].hunger = Math.min(W.components.life[id].hunger || 0, 30); }
    if (!f.leaderId || !classifyAlive(f.leaderId)) f.leaderId = people[0] || 0;
    return people;
  };
  const peopleA = grow(A, homeA), peopleB = grow(B, homeB);
  out.people = [peopleA.length, peopleB.length];
  if (peopleA.length < 3 || peopleB.length < 2) { fail("too few people to send anyone"); return out; }
  // Marriage: an envoy carries the offer, the court accepts, a claim is left.
  const kinA = dip.kin(A.id), kinB = dip.kin(B.id);
  out.kin = [kinA.length, kinB.length];
  const envoy = dip.send(A.id, B.id, "marriage");
  if (!envoy) { fail("no envoy could be sent"); return out; }
  if (!W.civilOrders.some((o) => o.id === envoy.personId && o.kind === "envoy")) fail("the envoy has no travel order");
  for (let i = 0; i < 20; i++) simTick();
  out.roadLength = window.ALIFE_WAYFINDING_DEBUG.orderPath(envoy.personId)?.length || 0;
  if (!out.roadLength) fail("the envoy follows no found road");
  const envoyEvent = W.events.filter((e) => e.type === "EnvoyEvent").at(-1);
  if (!envoyEvent) fail("no EnvoyEvent"); else out.envoySentence = eventSentence(envoyEvent);
  for (let i = 0; i < 40; i++) simTick();
  const wedding = dip.arrive(envoy.id, true);
  if (kinA.length && kinB.length) {
    if (!wedding || wedding.type !== "RoyalMarriageEvent") fail("an accepted marriage produced no RoyalMarriageEvent");
    else {
      out.marriageSentence = eventSentence(wedding);
      const m = dip.marriages().at(-1);
      if (!m || W.components.social[m.a].partnerId !== m.b) fail("the spouses are not partnered");
      if (!A.claims.some((c) => c.on === B.id && c.personId === m.a)) fail("the marriage left no claim on the other house");
      if (!W.civilOrders.some((o) => o.id === m.a && o.kind === "wedding")) fail("the bride has no wedding journey");
      if (dip.settle() < 1) fail("the marriage did not settle");
      if (W.components.social[m.a].factionId !== B.id) fail("the spouse did not join the other polity");
      // Successions: a stranger's succession raises a claim; the spouse's own child binds the houses.
      const stranger = peopleB.find((id) => id !== m.b && id !== m.a) || m.b;
      dip.succession(B.id, stranger);
      const claim = W.events.filter((e) => e.type === "SuccessionClaimEvent").at(-1);
      if (!claim) fail("a claim was not pressed at a stranger's succession"); else out.claimSentence = eventSentence(claim);
      if (!(A.relations[B.id].grievance >= 20)) fail("the pressed claim left no grievance");
      dip.succession(B.id, m.a);
      const union = W.events.filter((e) => e.type === "DynasticUnionEvent").at(-1);
      if (!union) fail("the claimant's own succession made no dynastic union"); else out.unionSentence = eventSentence(union);
      if (A.relations[B.id].status !== "allied") fail("the union did not ally the polities");
    }
  } else out.noKin = true;
  // War, then tribute bought with an envoy; the food really moves.
  const war = dip.war(A.id, B.id);
  if (!war) fail("no war could be declared");
  homeA.inventory[C.ORGANIC] = Math.max(homeA.inventory[C.ORGANIC], 200);
  const matterBefore = totalMatter();
  const envoy2 = dip.send(A.id, B.id, "tribute");
  if (!envoy2) { fail("no tribute envoy could be sent"); return out; }
  const treaty = dip.arrive(envoy2.id, true);
  if (!treaty || treaty.type !== "TreatyEvent") fail("tribute produced no TreatyEvent");
  else out.treatySentence = eventSentence(treaty);
  if (!war.ended) fail("tribute did not end the war");
  if (A.relations[B.id].status !== "truce") fail("tribute did not bind a truce");
  const storeBefore = homeB.inventory[C.ORGANIC];
  out.paid = dip.pay();
  if (!out.paid.includes("TributeEvent")) fail("no tribute was paid (" + out.paid.join(",") + ")");
  if (!(homeB.inventory[C.ORGANIC] > storeBefore)) fail("the receiver's store did not grow");
  if (totalMatter() !== matterBefore) fail("tribute changed total matter");
  const tribute = dip.treaties().find((t) => t.kind === "tribute" && t.active);
  if (!tribute || tribute.paid <= 0) fail("the treaty did not record the payment");
  // Vassalage, then independence.
  const vassalEnvoy = dip.send(B.id, A.id, "vassal");
  if (vassalEnvoy) {
    const oath = dip.arrive(vassalEnvoy.id, true);
    if (!oath || oath.type !== "VassalageEvent") fail("vassalage produced no VassalageEvent");
    else out.vassalSentence = eventSentence(oath);
    if (B.overlordId !== A.id || !A.vassalIds.includes(B.id)) fail("the vassal is not recorded");
    dip.enforce();
    const free = dip.independence(B.id);
    if (!free || free.type !== "IndependenceEvent") fail("independence produced no event");
    else out.independenceSentence = eventSentence(free);
    if (B.overlordId) fail("the vassal is still bound after independence");
  } else out.noVassalEnvoy = true;
  // Legends and drawing.
  out.section = dip.section(A.id).length;
  if (!/Diplomacy/.test(window.ALIFE_LEGENDS_DEBUG.render("faction", A.id))) fail("the polity page has no Diplomacy section");
  const hashBefore = worldHash();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 6, now: 5000 });
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "standard", zoom: 2, now: 5200 });
  if (worldHash() !== hashBefore) fail("rendering diplomacy changed the world hash");
  for (let i = 0; i < 130; i++) simTick();
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_DIPLOMACY_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_DIPLOMACY_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
