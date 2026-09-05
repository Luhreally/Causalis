// Observatory smoke: the people bar, alert pairs, and map modes.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const obs = window.ALIFE_OBSERVATORY_DEBUG, living = window.ALIFE_LIVING_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  obs.alerts();
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const faction = settlement.factionId ? W.factions.find((f) => f.id === settlement.factionId) : createFaction(settlement.id);
  if (!faction) { fail("no faction"); return out; }
  const succession = living.forceSuccession(faction.id);
  const eruption = living.erupt();
  const alerts = obs.alerts();
  out.alertTypes = alerts.map((a) => a.type);
  out.ring = obs.ring();
  if (!alerts.some((a) => a.type === "EruptionEvent")) fail("eruption produced no alert");
  const succ = alerts.find((a) => a.type === "SuccessionEvent");
  if (!succ) fail("succession produced no alert");
  else if (!succ.follows) fail("succession alert does not name what it follows");
  else out.follows = succ.follows.text;
  if (alerts.some((a) => /undefined|NaN/.test(a.text))) fail("an alert text contains undefined");
  const people = obs.people();
  out.people = people.map((p) => p.why);
  if (succession?.leaderId && !people.some((p) => p.id === succession.leaderId)) fail("people bar lacks the new Voice");
  const html = obs.renderPeopleBar();
  if (!/data-people="/.test(html) || /undefined|NaN/.test(html)) fail("people bar markup is broken");
  const samples = [];
  for (let i = 0; i < W.tileCount; i += Math.max(1, Math.floor(W.tileCount / 400))) samples.push(i);
  for (const name of ["routes", "season", "species", "history", "territory", "culture"]) {
    const styles = samples.map((i) => obs.overlay(name, i));
    if (styles.some((s) => typeof s !== "string")) fail(name + " overlay returned a non-string");
    out[name + "Painted"] = styles.filter((s) => s !== "transparent").length;
  }
  if (W.terrainGenome.landform.season.amplitude && !out.seasonPainted) fail("season overlay painted nothing on a tilted world");
  if (!out.speciesPainted) fail("species overlay painted nothing");
  if (!out.historyPainted) fail("history overlay painted nothing");
  if (!obs.legend("routes")) fail("routes overlay lacks a legend");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_OBSERVATORY_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_OBSERVATORY_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
