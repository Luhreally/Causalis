// Daylight smoke: the day is the year, with noon at High sun and a long night
// at Deep cold flipped by hemisphere; the Time panel names the hour; the night
// fades with speed and vanishes under the setting; at night a rested, fed
// person sleeps and is released from labour while a hungry one and a marcher
// stay up and a fire keeps hands working; herds bed down; sleepers recover
// faster; an electric town lights windows and lamps at night and none at
// noon; and rendering the night leaves the world untouched.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const dl = window.ALIFE_DAYLIGHT_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  // The curve: one day to the year, a long night, hemispheres opposed.
  if (dl.dayTicks !== TICKS_PER_YEAR) fail("a day is not a year");
  // The middle of a run of ticks (circular mean), so plateaus centre properly.
  const centre = (pred) => { let sx = 0, sy = 0; for (let t = 0; t < TICKS_PER_YEAR; t++) if (pred(dl.lightAt(t, 1))) { const a = (t / TICKS_PER_YEAR) * Math.PI * 2; sx += Math.cos(a); sy += Math.sin(a); } return ((Math.round((Math.atan2(sy, sx) / (Math.PI * 2)) * TICKS_PER_YEAR) % TICKS_PER_YEAR) + TICKS_PER_YEAR) % TICKS_PER_YEAR; };
  const noon = centre((l) => l >= 0.999), midnight = centre((l) => l <= 0.001);
  let dark = 0;
  for (let t = 0; t < TICKS_PER_YEAR; t++) if (dl.lightAt(t, 1) <= dl.nightLight) dark++;
  out.noon = noon; out.midnight = midnight; out.darkShare = +(dark / TICKS_PER_YEAR).toFixed(2);
  if (dl.lightAt(noon, 1) < 0.99 || dl.lightAt(midnight, 1) > 0.01) fail("the day has no full noon or full night: " + dl.lightAt(noon, 1) + "/" + dl.lightAt(midnight, 1));
  if (out.darkShare < 0.22 || out.darkShare > 0.4) fail("the night is the wrong length: " + out.darkShare);
  if (dl.lightAt(noon, -1) > 0.05) fail("the south is not dark at the north's noon: " + dl.lightAt(noon, -1));
  out.words = [dl.word(noon, 1), dl.word(midnight, 1)];
  if (out.words[0] !== "Noon" || out.words[1] !== "Night") fail("the hour is misnamed: " + out.words.join("/"));
  const seasonAtNoon = typeof seasonName === "function" ? seasonName(noon, 1) : "";
  out.seasonAtNoon = seasonAtNoon;
  if (seasonAtNoon && seasonAtNoon !== "High sun") fail("noon does not fall at High sun: " + seasonAtNoon);
  // A world to sleep in.
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const keepTick = W.tick, keepSpeed = UI.speed, year = keepTick - (keepTick % TICKS_PER_YEAR) + TICKS_PER_YEAR;
  const townH = dl.hemisphereAt(settlement.x, settlement.y);
  let townMidnight = year, townNoon = year;
  for (let t = year; t < year + TICKS_PER_YEAR; t++) {
    if (dl.lightAt(t, townH) < dl.lightAt(townMidnight, townH)) townMidnight = t;
    if (dl.lightAt(t, townH) > dl.lightAt(townNoon, townH)) townNoon = t;
  }
  out.townHemisphere = +townH.toFixed(2);
  // Night strength follows the clock and fades with speed and the setting.
  UI.speed = 1; dl.set(true);
  UI.camera.x = settlement.x; UI.camera.y = settlement.y;
  W.tick = townMidnight;
  for (let i = 0; i < 60; i++) dl.light();
  out.nightAtMidnight = +dl.night().toFixed(2);
  if (!(out.nightAtMidnight > 0.6)) fail("midnight is not dark: " + out.nightAtMidnight);
  UI.speed = 16;
  out.nightAtSpeed = +dl.night().toFixed(2);
  if (!(out.nightAtSpeed < 0.2)) fail("the night does not fade at high speed: " + out.nightAtSpeed);
  UI.speed = 1; dl.set(false);
  out.nightOff = +dl.night().toFixed(2);
  if (out.nightOff !== 0) fail("the setting does not turn the night off: " + out.nightOff);
  dl.set(true);
  if (!dl.enabled()) fail("the setting did not come back on");
  if (!/Night/.test(seasonLabel())) fail("the Time panel does not name the night: " + seasonLabel());
  // Sleep: a fed, rested person sleeps at night and is released from labour.
  const sleeper = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.life[id] && W.components.position[id] && !W.components.campaign?.[id] && !(W.civilOrders || []).some((o) => o.id === id));
  if (!sleeper) { fail("no person to put to bed"); return out; }
  const life = W.components.life[sleeper], p = W.components.position[sleeper], keep = { hunger: life.hunger, thirst: life.thirst, fatigue: life.fatigue };
  life.hunger = 30; life.thirst = 30; life.fatigue = 60;
  const personH = dl.hemisphereAt(p.x, p.y);
  let personMidnight = year, personNoon = year;
  for (let t = year; t < year + TICKS_PER_YEAR; t++) {
    if (dl.lightAt(t, personH) < dl.lightAt(personMidnight, personH)) personMidnight = t;
    if (dl.lightAt(t, personH) > dl.lightAt(personNoon, personH)) personNoon = t;
  }
  W.tick = personMidnight;
  out.nightAtPerson = dl.nightAt(p.x, p.y);
  out.asleep = dl.asleep(sleeper);
  out.readyAtNight = dl.ready(sleeper);
  out.recovery = dl.recovery(sleeper);
  if (!out.nightAtPerson || !out.asleep) fail("a fed, rested person does not sleep at night");
  if (out.readyAtNight) fail("a sleeper is still called to labour");
  if (out.recovery !== 2) fail("a sleeper does not recover faster: " + out.recovery);
  life.hunger = 80;
  out.hungryAsleep = dl.asleep(sleeper);
  if (out.hungryAsleep) fail("a hungry person sleeps through the night");
  life.hunger = 30;
  // A fire keeps hands up.
  const fireTile = idx(clamp(p.x + 3, 0, W.width - 1), p.y), keepFire = W.tiles.fire[fireTile], keepDebt = life.restDebt;
  life.restDebt = false;
  W.tiles.fire[fireTile] = 120;
  out.fireReady = dl.ready(sleeper);
  W.tiles.fire[fireTile] = keepFire;
  life.restDebt = keepDebt;
  if (!out.fireReady) fail("a fire did not keep the sleeper's hands up");
  // By day nobody sleeps.
  W.tick = personNoon;
  out.asleepAtNoon = dl.asleep(sleeper);
  out.recoveryAtNoon = dl.recovery(sleeper);
  if (out.asleepAtNoon || out.recoveryAtNoon !== 1) fail("the person sleeps at noon");
  // Herds bed down at night too.
  const herd = W.activeIds.find((id) => W.kind[id] === KINDS.HERBIVORE && classifyAlive(id) && W.components.life[id] && W.components.position[id]);
  if (herd) {
    const hl = W.components.life[herd], hp = W.components.position[herd], keepH = { hunger: hl.hunger, thirst: hl.thirst };
    hl.hunger = 30; hl.thirst = 30;
    const hH = dl.hemisphereAt(hp.x, hp.y);
    let herdMidnight = year;
    for (let t = year; t < year + TICKS_PER_YEAR; t++) if (dl.lightAt(t, hH) < dl.lightAt(herdMidnight, hH)) herdMidnight = t;
    W.tick = herdMidnight;
    out.herdAsleep = dl.asleep(herd);
    if (!out.herdAsleep) fail("the herd does not bed down at night");
    hl.hunger = keepH.hunger; hl.thirst = keepH.thirst;
  }
  life.hunger = keep.hunger; life.thirst = keep.thirst; life.fatigue = keep.fatigue;
  // An electric town lights up at night; a fire town glows at its hearths only.
  const complete = (type) => {
    const b = planBuilding(settlement, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === settlement.id && x.type === type && !x.complete);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  complete("shelter"); complete("hall"); complete("hearth");
  for (const t of ["electricity", "controlled_fire"]) if (!settlement.knownProcesses.includes(t)) settlement.knownProcesses.push(t);
  const hashBefore = typeof worldHash === "function" ? worldHash() : null;
  W.tick = townMidnight;
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 3, x: settlement.x, y: settlement.y, now: 5000 });
  for (let i = 0; i < 60; i++) dl.light();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 3, x: settlement.x, y: settlement.y, now: 5100 });
  out.lightsAtNight = dl.lightsDrawn();
  if (!(out.lightsAtNight >= 2)) fail("an electric town at night lit no windows: " + out.lightsAtNight);
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "standard", zoom: 2.5, x: settlement.x, y: settlement.y, now: 5200 });
  W.tick = townNoon;
  for (let i = 0; i < 60; i++) dl.light();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 3, x: settlement.x, y: settlement.y, now: 5300 });
  out.lightsAtNoon = dl.lightsDrawn();
  if (out.lightsAtNoon !== 0) fail("lamps burn at noon: " + out.lightsAtNoon);
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "oblique", quality: "low", zoom: 3, x: settlement.x, y: settlement.y, now: 5400 });
  W.tick = townMidnight;
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
