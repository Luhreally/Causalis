// Skystars smoke: a city with the six crafts of starflight may plan its launch
// tower but no ship leaves until it has a skyline and a working factory; an electric city wants tower blocks as a matter of
// course, one for every thirty people; the causal push raises the skyline and
// the works before the launch tower; and a town that knows a craft without
// its foundations is granted them on load.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const sky = window.ALIFE_SKYSTARS_DEBUG, cities = window.ALIFE_CITIES_DEBUG, skyline = window.ALIFE_SKYLINE_DEBUG, eras = window.ALIFE_ERAS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  if (!s.factionId) createFaction(s.id);
  const grant = (...techs) => { for (const t of techs) if (!s.knownProcesses.includes(t)) s.knownProcesses.push(t); };
  const finish = (b) => { if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; } return b; };
  const planned = (type) => W.buildings.find((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === s.id && b.type === type);
  // A city with every craft of starflight still falls short without a skyline and a works.
  grant("writing", "navigation", "astronomy", "mechanization", "waterworks", "sanitation", "public_works", "planetary_stewardship", "chemistry", "combustion", "electricity", "computing", "masonry", "starflight");
  s.stage = "urban";
  s.stability = Math.max(s.stability || 0, 0.6);
  out.shortfall = sky.shortfall(s.id);
  if (!out.shortfall.some((m) => /skyline/.test(m)) || !out.shortfall.some((m) => /factory/.test(m))) fail("the voyage does not ask for a skyline and a works: " + out.shortfall.join(","));
  if (cities.shortfall(s.id).length) fail("the launch site itself falls short with the six crafts: " + cities.shortfall(s.id).join(","));
  if (!cities.city(s.id)) fail("the fixture town is not a city");
  // Electric cities want towers as a matter of course.
  out.towersWanted = sky.towersWanted(s.id);
  out.wantsTower = skyline.wantsTower(s.id);
  if (!out.wantsTower) fail("an electric city without towers wants none");
  // No ship leaves a city of cottages, even with a launch tower.
  const launchTower = finish(planned("launch_tower") || planBuilding(s, "launch_tower", 9));
  if (!launchTower) { fail("no launch tower could be raised"); return out; }
  out.shipWithoutSkyline = !!eras.launch(s.id, false);
  if (out.shipWithoutSkyline) fail("a ship left a city of cottages");
  // The causal push raises the skyline, then the works, then reports ready.
  out.push1 = sky.push(s.id);
  const tower = planned("tower") || planned("office");
  if (out.push1 !== "skyline" || !tower) fail("the push did not raise a tower or an office: " + out.push1);
  finish(tower);
  out.push2 = sky.push(s.id);
  const factory = planned("factory");
  if (out.push2 !== "works" || !factory) fail("the push did not raise a factory: " + out.push2);
  finish(factory);
  out.push3 = sky.push(s.id);
  if (out.push3 !== "ready") fail("the push does not report ready: " + out.push3);
  out.shortfallAfter = sky.shortfall(s.id);
  if (out.shortfallAfter.length) fail("the voyage still falls short: " + out.shortfallAfter.join(","));
  out.shipWithSkyline = !!eras.launch(s.id, false);
  if (!out.shipWithSkyline) fail("no ship left the city with a skyline and a works");
  // A craft without its foundations is granted them on load.
  const other = W.settlements.find((x) => !x.ruined && x !== s);
  const target = other || s;
  if (other) other.knownProcesses = ["starflight"];
  else s.knownProcesses = ["starflight"];
  out.mended = sky.mend();
  for (const t of ["combustion", "electricity", "computing", "mechanization", "metalworking", "controlled_fire"]) if (!target.knownProcesses.includes(t)) fail("starflight did not bring " + t);
  if (!(out.mended >= 6)) fail("too few foundations were mended: " + out.mended);
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_SKYSTARS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_SKYSTARS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
