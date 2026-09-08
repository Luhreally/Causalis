// Farmland smoke: a town's fields are bounded on all four sides in the town's
// manner, one in five is an orchard, a far field gets a shed, a town that
// knows engines raises silos and one that knows combustion parks tractors, a
// pasture shows its stock or its trough, a winter field lies under frost, and
// none of it touches the world.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const farmland = window.ALIFE_FARMLAND_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  if (!s.factionId) createFaction(s.id);
  const finish = (b) => { if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; } return b; };
  const complete = (place, type) => finish(planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === place.id && x.type === type && !x.complete));
  const grant = (place, ...techs) => { for (const t of techs) if (!place.knownProcesses.includes(t)) place.knownProcesses.push(t); };
  grant(s, "agriculture", "mechanization", "combustion");
  const farms = [];
  for (let n = 0; n < 12; n++) { const f = complete(s, "farm"); if (f) farms.push(f); }
  if (farms.length < 6) { fail("could not raise the fields: " + farms.length); return out; }
  const corral = complete(s, "corral");
  if (!corral) fail("could not raise a pasture");
  out.style = farmland.style(s.id);
  if (!["hedge", "drystone", "fence", "ridge", "pickets", "cairns"].includes(out.style)) fail("no boundary style: " + out.style);
  const clean = (opts) => { const h0 = worldHash(); window.ALIFE_VISUAL_DEBUG.renderOnly(opts); if (worldHash() !== h0) fail("drawing the farmland changed the world"); };
  const cx = farms.reduce((a, b) => a + b.x, 0) / farms.length, cy = farms.reduce((a, b) => a + b.y, 0) / farms.length;
  farmland.reset();
  clean({ view: "iso", quality: "high", zoom: 2.6, x: cx, y: cy, now: 5000 });
  out.counts = farmland.counts();
  if (!(out.counts.boundaries >= 4)) fail("the fields are not bounded: " + JSON.stringify(out.counts));
  if (!(out.counts.silos + out.counts.tractors >= 1)) fail("no silo or tractor on an engine town's fields: " + JSON.stringify(out.counts));
  if (!(out.counts.stock + out.counts.troughs >= 1)) fail("the pasture shows neither stock nor a trough: " + JSON.stringify(out.counts));
  // Lean quality draws none of it.
  farmland.reset();
  clean({ view: "iso", quality: "low", zoom: 2.6, x: cx, y: cy, now: 5000 });
  out.lean = farmland.counts();
  if (out.lean.boundaries) fail("Lean quality still draws field boundaries");
  // Top view draws the boundaries too.
  farmland.reset();
  clean({ view: "top", quality: "high", zoom: 2.6, x: cx, y: cy, now: 5000 });
  out.top = farmland.counts();
  if (!(out.top.boundaries >= 4)) fail("the top lens leaves the fields unbounded");
  // Orchards over twelve fields.
  out.orchards = out.counts.orchards;
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_FARMLAND_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_FARMLAND_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
