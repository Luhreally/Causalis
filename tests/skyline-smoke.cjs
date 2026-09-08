// Skyline smoke: structures are drawn larger than before so a cottage stands
// taller than a person; a city short of beds that knows Electricity raises a
// tower block (and no tenement); a computing city with a market raises an
// office tower that quickens inquiry and pays custom; blocks are drawn in
// storeys and light their windows at night; the first tower and office are
// milestones; and rendering leaves the world untouched.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const sky = window.ALIFE_SKYLINE_DEBUG, pres = window.ALIFE_PRESENCE_DEBUG, cities = window.ALIFE_CITIES_DEBUG, dl = window.ALIFE_DAYLIGHT_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const f = W.factions.find((x) => x.id === settlement.factionId);
  const complete = (type) => {
    const b = planBuilding(settlement, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === settlement.id && x.type === type && !x.complete);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  const know = (...ts) => { for (const t of ts) if (!settlement.knownProcesses.includes(t)) settlement.knownProcesses.push(t); };
  const planned = (type) => W.buildings.find((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === settlement.id && b.type === type);
  const clean = (opts) => { const h0 = worldHash(); window.ALIFE_VISUAL_DEBUG.renderOnly(opts); if (worldHash() !== h0) fail("drawing the skyline changed the world (" + opts.view + ")"); };
  // ── A cottage stands taller than a person ──
  const shelter = W.buildings.find((b) => b.complete && !b.ruined && b.placeKind === "settlement" && b.placeId === settlement.id && b.type === "shelter") || complete("shelter");
  const person = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.position[id]);
  if (!shelter || !person) { fail("no cottage or person to compare"); return out; }
  clean({ view: "iso", quality: "high", zoom: 5, x: settlement.x, y: settlement.y, now: 5000 });
  const house = buildingScreenSize(shelter, projectionMetrics()) * 0.78, body = pres.radius(person) * 2.76;
  out.proportion = +(body / house).toFixed(2);
  if (!(out.proportion < 0.85 && out.proportion > 0.3)) fail("a person is not shorter than a cottage: " + out.proportion);
  if (!(buildingScreenSize(shelter, projectionMetrics()) > buildingScreenSize({ ...shelter, type: "wall" }, projectionMetrics()))) fail("structures were not enlarged over tile geometry");
  // ── A tower block where beds are short and current is known ──
  settlement.stage = "urban";
  know("masonry", "mechanization", "chemistry", "electricity");
  const hidden = [];
  for (const b of W.buildings) if (!b.ruined && b.complete && b.placeKind === "settlement" && b.placeId === settlement.id && (BUILDING_DEFS[b.type]?.housing || 0) > 0) { b.complete = false; hidden.push(b); }
  out.wantsTower = sky.wantsTower(settlement.id);
  out.wantsTenement = cities.wants(settlement.id);
  if (!out.wantsTower) fail("an electric city short of beds wants no tower");
  if (out.wantsTenement) fail("an electric city still wants tenements");
  sky.plan(settlement.id);
  for (const b of hidden) b.complete = true;
  const tower = planned("tower");
  if (!tower) { fail("no tower was planned"); return out; }
  if (BUILDING_DEFS.tower.housing !== 36) fail("a tower does not house thirty-six");
  complete("tower");
  out.towerStoreys = sky.storeys(tower.id);
  if (!(out.towerStoreys >= 8 && out.towerStoreys <= 14)) fail("a tower has the wrong storeys: " + out.towerStoreys);
  // ── Offices where computing is known and a market stands ──
  know("mathematics", "printing", "computing");
  complete("market");
  out.wantsOffice = sky.wantsOffice(settlement.id);
  if (!out.wantsOffice) fail("a computing city with a market wants no office");
  const tempoBefore = researchTempoFactor(settlement);
  sky.plan(settlement.id);
  const office = planned("office");
  if (!office) { fail("no office was planned"); return out; }
  complete("office");
  out.officeStoreys = sky.storeys(office.id);
  if (!(out.officeStoreys >= 7)) fail("an office is too low: " + out.officeStoreys);
  out.tempo = [tempoBefore, researchTempoFactor(settlement)];
  if (!(out.tempo[1] > out.tempo[0])) fail("an office does not quicken inquiry");
  if (f) {
    if (!settlement.knownProcesses.includes("currency")) settlement.knownProcesses.push("currency");
    const before = f.treasury || 0;
    out.custom = collectTaxes(f);
    if (!(f.treasury - before >= 2)) fail("an office pays no custom: " + (f.treasury - before));
  }
  sky.plan(settlement.id);
  const keys = (W.milestones || []).map((m) => m.key);
  if (!keys.includes("first-tower") || !keys.includes("first-office")) fail("the tower and office are not milestones: " + keys.join(","));
  if (!/Skyline/.test(renderLegendPage("place", settlement.id))) fail("the place page has no skyline row");
  // ── Drawn in storeys, lit at night ──
  sky.reset();
  clean({ view: "iso", quality: "high", zoom: 4, x: settlement.x, y: settlement.y, now: 5100 });
  out.blocksDay = sky.counts().blocksDrawn;
  if (!(out.blocksDay >= 2)) fail("the blocks were not drawn: " + out.blocksDay);
  const keepTick = W.tick, h = dl.hemisphereAt(settlement.x, settlement.y), year = W.tick - (W.tick % TICKS_PER_YEAR) + TICKS_PER_YEAR;
  let midnight = year;
  for (let t = year; t < year + TICKS_PER_YEAR; t++) if (dl.lightAt(t, h) < dl.lightAt(midnight, h)) midnight = t;
  W.tick = midnight; UI.speed = 1; dl.set(true);
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 4, x: settlement.x, y: settlement.y, now: 5200 });
  for (let i = 0; i < 60; i++) dl.light();
  sky.reset();
  clean({ view: "iso", quality: "high", zoom: 4, x: settlement.x, y: settlement.y, now: 5300 });
  out.litWindows = sky.counts().litWindows;
  if (!(out.litWindows >= 1)) fail("no windows lit at night");
  clean({ view: "top", quality: "low", zoom: 2, x: settlement.x, y: settlement.y, now: 5400 });
  W.tick = keepTick;
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_SKYLINE_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_SKYLINE_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
