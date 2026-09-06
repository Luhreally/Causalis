// Calamity smoke: a quake near a town leaves a calamity that raises unrest and
// fades over time, and a struck capital can cost the Voice its seat.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const cal = window.ALIFE_CALAMITY_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const faction = settlement.factionId ? W.factions.find((f) => f.id === settlement.factionId) : createFaction(settlement.id);
  if (!faction) { fail("no faction"); return out; }
  faction.capitalSettlementId = settlement.id;
  // A quake two tiles from the town is felt there.
  const calm = window.ALIFE_POLITICS_DEBUG.unrest(settlement.id);
  const ev = quake(idx(Math.min(W.width - 2, settlement.x + 2), settlement.y), 1.2);
  if (!ev) { fail("no quake"); return out; }
  cal.update();
  out.state = cal.state(settlement.id);
  if (!(out.state.calamity > 0) || out.state.kind !== "quake") fail("the quake left no calamity on the town");
  const shaken = window.ALIFE_POLITICS_DEBUG.unrest(settlement.id);
  if (!(shaken > calm)) fail("calamity did not raise unrest");
  const struck = W.events.find((e) => e.type === "CalamityEvent");
  if (!struck) fail("no CalamityEvent"); else out.struckSentence = eventSentence(struck);
  if (!/Calamity/.test(window.ALIFE_LEGENDS_DEBUG.render("place", settlement.id))) fail("the place page does not show the calamity");
  // It fades.
  const before = cal.state(settlement.id).calamity;
  cal.fade();
  if (!(cal.state(settlement.id).calamity < before)) fail("calamity did not fade");
  // A struck capital can lose its Voice.
  if (!faction.leaderId) {
    const near = entityAtRadius(idx(settlement.x, settlement.y), 8, KINDS.PERSON).filter(classifyAlive);
    if (near.length) faction.leaderId = near[0];
  }
  for (const id of entityAtRadius(idx(settlement.x, settlement.y), 8, KINDS.PERSON)) { const soc = W.components.social[id], l = W.components.life[id]; if (soc) { soc.factionId = faction.id; soc.homePlaceKind = "settlement"; soc.homePlaceId = settlement.id; } if (l) l.age = Math.max(l.age, 4000); }
  const voice = faction.leaderId;
  if (!voice) { out.blameSkipped = "no Voice to blame"; return out; }
  cal.strike(settlement.id, "quake", 0.9);
  cal.blame(true);
  const blamed = W.events.find((e) => e.type === "BlamedVoiceEvent");
  if (!blamed) fail("a struck capital did not blame its Voice (leader " + voice + ", candidates " + entityAtRadius(idx(settlement.x, settlement.y), 8, KINDS.PERSON).length + ")");
  else {
    out.blamedSentence = eventSentence(blamed);
    if (faction.leaderId === voice) fail("the blamed Voice kept the seat");
  }
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_CALAMITY_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_CALAMITY_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
