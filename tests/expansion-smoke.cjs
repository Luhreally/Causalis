// Expansion smoke: caps scale with the map, a vast preset exists, and a town
// sends settlers who raise a camp of the same polity, all chronicled.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const ex = window.ALIFE_EXPANSION_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  // Presets and caps.
  if (!SIZE_PRESETS.vast || SIZE_PRESETS.vast[0] !== 300) fail("no vast preset");
  out.caps = ex.caps();
  if (out.caps.person !== 250 || out.caps.faction !== 12) fail("a small map changed the base caps");
  out.vastCaps = ex.scale(300, 180);
  if (!(out.vastCaps.person > 380 && out.vastCaps.faction >= 18 && out.vastCaps.settlement >= 60)) fail("vast caps did not scale up");
  ex.scale(W.width, W.height);
  if (ex.caps().person !== 250) fail("caps did not restore for the small map");
  // A town sends settlers.
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  // Grown, fed residents are the ones a town can spare.
  for (const place of W.settlements) if (!place.ruined) for (const id of entityAtRadius(idx(place.x, place.y), 6, KINDS.PERSON)) { const l = W.components.life[id], soc = W.components.social[id]; if (!l || !soc) continue; l.age = Math.max(l.age, 4000); l.hunger = Math.min(l.hunger || 0, 30); l.wounded = false; soc.factionId = place.factionId; }
  const before = W.camps.filter((c) => c.active).length;
  let expedition = null;
  for (const place of W.settlements) { if (place.ruined) continue; expedition = ex.settle(place.id, true); if (expedition) { settlement = place; break; } }
  if (!expedition) { fail("no settlers could be sent: sites " + W.settlements.map((s) => ex.site(s.id)).join(",")); return out; }
  out.members = expedition.members.length;
  if (out.members < 3) fail("fewer than three settlers");
  if (civilOrderOf(expedition.members[0])?.kind !== "settle") fail("settlers were given no settle order");
  const leaving = W.events.find((e) => e.type === "ExpeditionEvent");
  if (!leaving) fail("no ExpeditionEvent"); else out.leaving = eventSentence(leaving);
  simTick();
  const l = W.components.life[expedition.members[0]];
  if (l?.behavior === "march" && l.behaviorReason !== "walking out to found a new camp") fail("settlers march for the wrong reason: " + l.behaviorReason);
  out.urge = ex.urge(settlement.id);
  if (!(out.urge > 0 && out.urge < 1)) fail("urge out of range");
  // They arrive and raise a camp.
  const [tx, ty] = xy(expedition.target);
  for (const id of expedition.members) { const p = W.components.position[id]; if (p) { p.x = tx; p.y = ty; } }
  ex.tick();
  const done = ex.expeditions().find((e) => e.id === expedition.id);
  if (done.active) fail("the expedition did not end on arrival");
  const camp = W.camps.find((c) => c.id === done.campId);
  if (!camp) { fail("no camp was raised"); return out; }
  if (camp.settledFrom !== settlement.id) fail("the camp does not remember its town");
  if (camp.factionId !== settlement.factionId) fail("the camp belongs to another polity");
  if (W.camps.filter((c) => c.active).length <= before) fail("no new active camp");
  const founded = W.events.find((e) => e.type === "SettlersEvent");
  if (!founded) fail("no SettlersEvent"); else out.founded = eventSentence(founded);
  for (const id of expedition.members) if (civilOrderOf(id)) fail("a settler still carries an order");
  if (!/Settled from/.test(window.ALIFE_LEGENDS_DEBUG.render("camp", camp.id))) fail("the camp page does not say where it was settled from");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_EXPANSION_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_EXPANSION_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
