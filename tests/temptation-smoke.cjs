// Temptation smoke: good courtship becomes a partnership, a thin bond and an
// absent partner make an affair likelier, a witnessed affair wounds and breaks
// the bond, and the wronged partner's rivalry names the affair.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const tempt = window.ALIFE_TEMPTATION_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  for (let i = 0; i < 200; i++) simTick();
  for (const id of W.activeIds) if (W.kind[id] === KINDS.PERSON && classifyAlive(id)) { const l = W.components.life[id]; l.age = Math.max(l.age, 4000); }
  const adults = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && isAdultPerson(id));
  if (adults.length < 4) { fail("too few adults: " + adults.length); return out; }
  const [A, B, Cc, D] = adults;
  for (const id of [A, B, Cc, D]) { const soc = W.components.social[id]; soc.partnerId = 0; }
  // Distinct kin groups so nothing here is family.
  W.components.social[A].kinGroupId = 9001; W.components.social[B].kinGroupId = 9002; W.components.social[Cc].kinGroupId = 9003; W.components.social[D].kinGroupId = 9004;
  const set = (x, y, v) => { const r = relationshipState(x, y); Object.assign(r, v); return r; };
  // Courtship: good but not rare measures make partners.
  set(A, B, { trust: 0.55, affection: 0.55, attraction: 0.5, familiarity: 0.6 }); set(B, A, { trust: 0.55, affection: 0.55, attraction: 0.5, familiarity: 0.6 });
  tempt.court(A, B);
  if (W.components.social[A].partnerId !== B) { fail("good courtship did not make partners"); return out; }
  const bond = W.events.find((e) => e.type === "LoveBondEvent" && e.subjects.includes(A));
  if (!bond) fail("no LoveBondEvent"); else out.bond = eventSentence(bond);
  // Temptation: a thin bond and an absent partner raise the opportunity.
  set(A, Cc, { attraction: 0.7, affection: 0.6, familiarity: 0.5 }); set(Cc, A, { attraction: 0.7, affection: 0.6, familiarity: 0.5 });
  const ab = relationshipState(A, B); ab.commitment = 0.9; ab.affection = 0.9;
  const pA = W.components.position[A], pB = W.components.position[B], pC = W.components.position[Cc];
  pB.x = pA.x; pB.y = pA.y;
  const content = tempt.opportunity(A, Cc);
  ab.commitment = 0.2; ab.affection = 0.2;
  const thin = tempt.opportunity(A, Cc);
  if (!(thin > content)) fail("a thin bond does not tempt more than a strong one");
  pB.x = Math.max(0, Math.min(W.width - 1, pA.x + 20)); pB.y = pA.y;
  const away = tempt.opportunity(A, Cc);
  if (!tempt.away(A)) fail("a partner twenty tiles off does not count as away");
  if (!(away > thin)) fail("an absent partner does not tempt more");
  // The affair itself, then the wronged partner's rivalry names it.
  const betrayal = tempt.affair(A, Cc);
  if (!betrayal) { fail("no affair began"); return out; }
  out.betrayal = eventSentence(betrayal);
  if (!affairBetween(A, Cc)) fail("the affair is not recorded");
  set(B, Cc, { familiarity: 0.4 }); set(Cc, B, { familiarity: 0.4 });
  const contest = rivalContest(B, Cc);
  out.rivalCause = contest ? contest.text : "";
  if (!contest || contest.kind !== "affair" || !out.rivalCause.includes(entityName(A))) fail("the wronged partner's rivalry does not name the affair: " + out.rivalCause);
  // Discovery: the partner stands beside them and sees.
  pB.x = pA.x; pB.y = pA.y; pC.x = pA.x; pC.y = pA.y;
  const jealousBefore = relationshipState(B, A).jealousy || 0;
  updateAffairKnowledge(A);
  const caught = W.events.find((e) => e.type === "CheatingDiscoveredEvent");
  if (!caught) fail("the affair was not discovered when the partner stood beside them");
  else {
    out.caught = eventSentence(caught);
    if (!(relationshipState(B, A).jealousy > jealousBefore)) fail("discovery did not wound the partner");
    if (!W.components.social[B].betrayedBy?.includes(A)) fail("the partner does not remember who betrayed them");
  }
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_TEMPTATION_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_TEMPTATION_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
