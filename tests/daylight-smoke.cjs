// Daylight smoke: the day curve runs midnight to noon and back over sixty-four
// ticks, the night fades with speed and vanishes under the setting, an
// electric town lights windows and street lamps at night, and rendering at
// night and at noon in both lenses leaves the world untouched.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const dl = window.ALIFE_DAYLIGHT_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  // The curve.
  out.curve = [0, 16, 32, 48, 64].map((t) => +dl.lightAt(t).toFixed(3));
  if (out.curve[0] > 0.01 || Math.abs(out.curve[1] - 0.5) > 0.01 || out.curve[2] < 0.99 || Math.abs(out.curve[3] - 0.5) > 0.01 || out.curve[4] > 0.01) fail("the day curve is wrong: " + out.curve.join(","));
  if (dl.dayTicks !== 64) fail("a day is not sixty-four ticks");
  // Night strength follows the clock and fades with speed and the setting.
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const keepTick = W.tick, keepSpeed = UI.speed;
  UI.speed = 1; dl.set(true);
  W.tick = keepTick - (keepTick % 64);
  for (let i = 0; i < 40; i++) dl.light();
  out.nightAtMidnight = +dl.night().toFixed(2);
  if (!(out.nightAtMidnight > 0.9)) fail("midnight is not dark: " + out.nightAtMidnight);
  UI.speed = 64;
  out.nightAtSpeed = +dl.night().toFixed(2);
  if (!(out.nightAtSpeed < 0.2)) fail("the night does not fade at high speed: " + out.nightAtSpeed);
  UI.speed = 1; dl.set(false);
  out.nightOff = +dl.night().toFixed(2);
  if (out.nightOff !== 0) fail("the setting does not turn the night off: " + out.nightOff);
  dl.set(true);
  if (!dl.enabled()) fail("the setting did not come back on");
  // An electric town lights up at night; a fire town glows at its hearths only.
  const complete = (type) => {
    const b = planBuilding(settlement, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === settlement.id && x.type === type && !x.complete);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  complete("shelter"); complete("hall"); complete("hearth");
  for (const t of ["electricity", "controlled_fire"]) if (!settlement.knownProcesses.includes(t)) settlement.knownProcesses.push(t);
  UI.camera.x = settlement.x; UI.camera.y = settlement.y;
  const hashBefore = typeof worldHash === "function" ? worldHash() : null;
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 3, now: 5000 });
  for (let i = 0; i < 40; i++) dl.light();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 3, now: 5100 });
  out.lightsAtNight = dl.lightsDrawn();
  if (!(out.lightsAtNight >= 2)) fail("an electric town at night lit no windows: " + out.lightsAtNight);
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "standard", zoom: 2.5, now: 5200 });
  W.tick = keepTick - (keepTick % 64) + 32;
  for (let i = 0; i < 40; i++) dl.light();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 3, now: 5300 });
  out.lightsAtNoon = dl.lightsDrawn();
  if (out.lightsAtNoon !== 0) fail("lamps burn at noon: " + out.lightsAtNoon);
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "low", zoom: 3, now: 5400 });
  W.tick = keepTick - (keepTick % 64);
  if (hashBefore !== null && worldHash() !== hashBefore) fail("rendering the night changed the world");
  W.tick = keepTick; UI.speed = keepSpeed;
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_DAYLIGHT_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_DAYLIGHT_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
