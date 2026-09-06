// Performance smoke: the shortcuts in section 70 give the same answers as the
// long way — random draws hash identically, hemisphere weights match, plans
// refresh once per tick, and a failed site search rests and then clears.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const out = { failures: [] }, fail = (m) => out.failures.push(m);
  // Random draws are bit-for-bit the long formula.
  for (const [tag, tick, id, purpose, attempt] of [["settlers", 12, 3, 0, 0], ["launch", 999, 41, 2, 7], ["x", 0, 0, 0, 0]]) {
    const fast = counterRand(tag, tick, id, purpose, attempt), slow = hashParts(W.seedHash, tag, tick, id, purpose, attempt) / 4294967296;
    if (fast !== slow) fail("counterRand differs from hashParts for " + tag);
  }
  if (counterRand("a") !== hashParts(W.seedHash, "a", 0, 0, 0, 0) / 4294967296) fail("counterRand defaults differ");
  // Hemisphere weights come from the cache and match the formula.
  const g = W.terrainGenome, nx = (7 / (W.width - 1) - 0.5) * 2, ny = (9 / (W.height - 1) - 0.5) * 2;
  const direct = (() => { if (!g || g.climate === "radial" || g.climate === "banded") return 1; const c = Math.cos(g.climateAngle || 0), s = Math.sin(g.climateAngle || 0), axis = g.climate === "latitudinal" || g.climate === "inverted" ? ny : nx * s + ny * c; return (axis >= 0 ? 1 : -1) * (0.35 + 0.65 * Math.min(1, Math.abs(axis) * 1.4)); })();
  const first = seasonHemisphere(7, 9), second = seasonHemisphere(7, 9);
  if (Math.abs(first - direct) > 1e-6 || first !== second) fail("seasonHemisphere cache disagrees with the formula");
  if (!(window.ALIFE_PERF_DEBUG.hemisphereCached() >= 1)) fail("no hemisphere weight was cached");
  // Plans refresh once per tick; a failed site search rests, a success clears the rest.
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  ensurePlacePlans(settlement);
  if (settlement.plansTick !== W.tick) fail("plans were not stamped with the tick");
  const buildingsBefore = W.buildings.length;
  ensurePlacePlans(settlement);
  if (W.buildings.length !== buildingsBefore) fail("a second plan in the same tick planned again");
  // A type with no clear ground anywhere: pretend by asking for a wall on a town boxed in by the map edge.
  const fake = { ...settlement, id: 9999, x: 0, y: 0, buildings: [], knownProcesses: settlement.knownProcesses.slice() };
  const planned = planBuilding(fake, "wall", 3);
  out.edgePlan = !!planned;
  if (!planned && !(fake.siteBackoff.wall > W.tick)) fail("a failed site search did not rest");
  if (planned && fake.siteBackoff.wall) fail("a successful plan left a rest behind");
  const ok = planBuilding(settlement, "hearth", 3);
  out.hearth = !!ok;
  if (ok && settlement.siteBackoff?.hearth) fail("a successful plan kept its rest");
  out.msPerTick = window.ALIFE_PERF_DEBUG.time(20);
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_PERF_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_PERF_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
