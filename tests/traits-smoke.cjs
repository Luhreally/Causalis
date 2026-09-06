// Traits smoke: polities earn named traits from ethos and deeds, keep them for
// years, lose them with a chronicle line, wear them as tags, and feel them in
// unrest and the ethos they pull on.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const traits = window.ALIFE_TRAITS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const faction = settlement.factionId ? W.factions.find((f) => f.id === settlement.factionId) : createFaction(settlement.id);
  if (!faction) { fail("no faction"); return out; }
  // Ethos earns traits; deeds earn more.
  faction.ethos.expansionist = 0.8; faction.ethos.isolationist = 0.1; faction.ethos.spiritual = 0.75; faction.aggression = 0.7;
  const before = faction.ethos.expansionist;
  out.first = traits.update().find((f) => f.id === faction.id).traits;
  if (!out.first.includes("Expansionist")) fail("an expansionist ethos earned no Expansionist trait");
  if (!out.first.includes("Zealots")) fail("a spiritual ethos earned no Zealots trait");
  if (out.first.length > 3) fail("more than three traits were kept");
  if (!(faction.ethos.expansionist > before)) fail("the Expansionist trait did not pull the ethos its way");
  const gained = W.events.filter((e) => e.type === "TraitGainedEvent" && e.factions.includes(faction.id));
  if (!gained.length) fail("no TraitGainedEvent"); else out.gainedSentence = eventSentence(gained[0]);
  // Traits hold for eight years, then fall away when no longer earned.
  faction.ethos.spiritual = 0.2;
  traits.update();
  if (!faction.traits.includes("Zealots")) fail("a fresh trait fell away before its time");
  faction.traitSince.Zealots = W.tick - TICKS_PER_YEAR * 9;
  traits.update();
  if (faction.traits.includes("Zealots")) fail("an unearned trait stayed past its hold");
  const lost = W.events.filter((e) => e.type === "TraitLostEvent").at(-1);
  if (!lost) fail("no TraitLostEvent"); else out.lostSentence = eventSentence(lost);
  // Opposites do not sit together.
  faction.ethos.isolationist = 0.9; faction.ethos.expansionist = 0.9;
  traits.update();
  if (faction.traits.includes("Expansionist") && faction.traits.includes("Isolationist")) fail("opposite traits were both kept");
  // Tags on the page and the inspector; unrest feels a fractious people.
  if (!/class="tag gold"/.test(window.ALIFE_LEGENDS_DEBUG.render("faction", faction.id))) fail("the polity page shows no trait tags");
  if (!/class="tag gold"/.test(nonLifeInspector(faction.entityId))) fail("the polity inspector shows no trait tags");
  const calm = window.ALIFE_POLITICS_DEBUG.unrest(settlement.id);
  faction.traits = ["Fractious"]; faction.traitSince.Fractious = W.tick;
  const fractious = window.ALIFE_POLITICS_DEBUG.unrest(settlement.id);
  if (!(fractious > calm)) fail("a fractious polity does not simmer more");
  out.stats = traits.stats(faction.id);
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_TRAITS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_TRAITS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
