// Plain-words smoke: a shortfall line comes back with a reason a player can act
// on; the reasons are read from the world, not chosen for it; reading them
// writes nothing; and a line the section does not understand comes back as it
// was.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const words = window.ALIFE_PLAIN_WORDS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  const grant = (place, ...techs) => { for (const t of techs) if (!place.knownProcesses.includes(t)) place.knownProcesses.push(t); };
  grant(s, "masonry", "mechanization", "electricity");
  s.stage = "urban";
  W.causalLaunchSiteId = s.id;
  // A tower planned and stocked with nobody on it.
  const tower = planBuilding(s, "tower", 9);
  if (!tower) fail("no tower could be planned");
  else for (const [sp, n] of tower.requirements) { W.conservation.playerInput += n - (tower.composition[sp] || 0); tower.composition[sp] = n; }
  if (tower) refreshBuildingStage(tower);
  const hash = worldHash(), audit = auditMatter().delta;
  out.skyline = words.explain("16 tower blocks or offices");
  if (!/standing/.test(out.skyline) || !out.skyline.includes(s.name) || !/stocked, nobody/.test(out.skyline)) fail("the skyline line does not say what the block lacks: " + out.skyline);
  out.people = words.explain("20 people living in towns");
  if (!/hungry|towns hold/.test(out.people)) fail("the people line says nothing about hunger or towns: " + out.people);
  out.cities = words.explain("2 cities at the urban stage");
  if (!out.cities.includes(s.name) || !/a city is \d+/.test(out.cities)) fail("the cities line does not name the towns and the gate: " + out.cities);
  out.road = words.explain("a paved road or rail between two towns");
  if (!/road/.test(out.road) || out.road === "a paved road or rail between two towns") fail("the road line has no reason: " + out.road);
  out.study = words.explain("develop Starflight");
  if (!out.study.includes(s.name) || !/notes/.test(out.study)) fail("the study line does not say where the site stands: " + out.study);
  out.tower = words.explain("complete a Launch tower");
  if (!out.tower.includes(s.name)) fail("the tower line does not name the site: " + out.tower);
  out.ship = words.explain("launch the first ship");
  if (!out.ship.includes(s.name)) fail("the ship line does not name the site: " + out.ship);
  out.unknown = words.explain("something the section has never heard of");
  if (out.unknown !== "something the section has never heard of") fail("an unknown line was changed: " + out.unknown);
  // The gate status itself carries the reasons, and reading it writes nothing.
  const saved = W.civilization.stageIndex;
  W.civilization.stageIndex = CIV_STAGE_ORDER.indexOf("complex terrestrial"); W.civilization.stage = "complex terrestrial";
  const gate = civilizationGateStatus();
  W.civilization.stageIndex = saved; W.civilization.stage = CIV_STAGE_ORDER[saved];
  out.gate = gate ? gate.missing.slice(0, 4) : null;
  if (!gate || !gate.missing.some((m) => /\(/.test(m))) fail("the gate status carries no reason: " + JSON.stringify(out.gate));
  if (worldHash() !== hash) fail("reading the reasons changed the world");
  if (auditMatter().delta !== audit) fail("reading the reasons changed total matter");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_PLAIN_WORDS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_PLAIN_WORDS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
