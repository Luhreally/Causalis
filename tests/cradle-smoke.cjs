// Cradle smoke: a bond to the dead or the vanished is released, by the
// coupling loop when the survivor is ready and by the sweep for everyone; a
// living partner is judged as before.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const cradle = window.ALIFE_CRADLE_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.position[id] && W.components.life[id]).sort((a, b) => a - b);
  if (people.length < 2) { fail("too few people: " + people.length); return out; }
  for (const id of people) { const soc = W.components.social[id]; soc.homePlaceKind = "settlement"; soc.homePlaceId = s.id; }
  const [a, b] = people;
  // ── The dead and the vanished are mourned ──
  const ghost = 987654321, sa = W.components.social[a], sb = W.components.social[b], pa = W.components.position[a], pb = W.components.position[b];
  sa.partnerId = ghost;
  const widowedBefore = cradle.counts().widowed;
  if (cradle.partnerNear(a)) fail("a ghost counted as a partner near");
  if (sa.partnerId !== 0) fail("the bond to a ghost was not released by the loop: " + sa.partnerId);
  if (cradle.counts().widowed !== widowedBefore + 1) fail("the widowed count did not move");
  sb.partnerId = ghost;
  cradle.mourn();
  if (sb.partnerId !== 0) fail("the bond to a ghost was not released by the sweep: " + sb.partnerId);
  // A living partner is judged by the coupling loop's own rule (76), untouched.
  sa.partnerId = b; sb.partnerId = a;
  out.livingPartner = cradle.partnerNear(a);
  if (sa.partnerId !== b) fail("a living partner was mourned");
  out.livingPartnerBase = matingPartnerNearCradleBase(a, sa, pa, new Set());
  if (out.livingPartner !== out.livingPartnerBase) fail("a living partner is judged differently from the base rule");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_CRADLE_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_CRADLE_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
