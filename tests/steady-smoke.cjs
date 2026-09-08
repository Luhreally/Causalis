// Steady smoke: a walker weighing two directions no longer flips its face
// every few frames, a crowd offset eases instead of jumping when the tile's
// company changes, a caravan under a motor polity is drawn as a truck and a
// journey as a car, a motor town keeps cars parked by its hall, motor
// caravans carry more, and trucks run road freight between two towns of a
// polity for fuel (none without fuel), conserving matter; rendering leaves
// the world untouched.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const steady = window.ALIFE_STEADY_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  if (!s.factionId) createFaction(s.id);
  const f = W.factions.find((x) => x.id === s.factionId);
  const complete = (place, type) => {
    const b = planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === (place.knownProcesses ? "settlement" : "camp") && x.placeId === place.id && x.type === type);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  const clean = (opts) => { const h0 = worldHash(); window.ALIFE_VISUAL_DEBUG.renderOnly(opts); if (worldHash() !== h0) fail("rendering changed the world (" + opts.view + ")"); };
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.position[id] && !W.components.life[id]?.insideBuildingId);
  if (people.length < 3) { fail("too few people"); return out; }
  const [walker, c1, c2] = people;
  for (const id of [walker, c1, c2]) { const soc = W.components.social[id]; soc.factionId = f.id; soc.homePlaceKind = "settlement"; soc.homePlaceId = s.id; }
  // A walker weighing two directions: its tile toggles every hundred milliseconds; its face holds.
  const p = W.components.position[walker], x0 = clamp(s.x + 3, 2, W.width - 3), y0 = clamp(s.y, 2, W.height - 3);
  p.x = x0; p.y = y0; rebuildSpatialBins();
  steady.reset();
  let now = 9000;
  for (let frame = 0; frame < 60; frame++) {
    if (frame % 6 === 0) { p.x = frame % 12 === 0 ? x0 : x0 + 1; rebuildSpatialBins(); }
    clean({ view: "iso", quality: "high", zoom: 4, x: x0, y: y0, now });
    now += 16;
  }
  out.flips = steady.counts().flips;
  if (out.flips > 1) fail("a wavering walker still flips its face: " + out.flips + " flips in a second");
  out.facing = steady.facing(walker);
  if (![1, -1].includes(out.facing)) fail("no facing is kept for the walker");
  // A crowd offset eases when the tile's company changes.
  const q1 = W.components.position[c1], q2 = W.components.position[c2], cx = clamp(s.x - 3, 2, W.width - 3), cy = clamp(s.y + 2, 2, W.height - 3);
  q1.x = cx; q1.y = cy; q2.x = cx + 2; q2.y = cy; rebuildSpatialBins();
  clean({ view: "top", quality: "high", zoom: 4, x: cx, y: cy, now });
  now += 16;
  clean({ view: "top", quality: "high", zoom: 4, x: cx, y: cy, now });
  const before = steady.offset(c1);
  q2.x = cx; rebuildSpatialBins();
  now += 16;
  clean({ view: "top", quality: "high", zoom: 4, x: cx, y: cy, now });
  const after = steady.offset(c1);
  out.offsetStep = +Math.hypot(after.x - before.x, after.y - before.y).toFixed(3);
  if (!(out.offsetStep < 0.06)) fail("a crowd offset jumps when company arrives: " + out.offsetStep);
  // Cars and trucks: a caravan under a motor polity is a truck, a journey a car; both are drawn.
  for (const t of ["wheel", "combustion"]) if (!s.knownProcesses.includes(t)) s.knownProcesses.push(t);
  issueCivilOrder(c1, "caravan", cx + 6, cy, { placeId: s.id });
  issueCivilOrder(c2, "journey", cx + 6, cy + 1, {});
  out.kinds = [steady.motorKind(c1), steady.motorKind(c2)];
  if (out.kinds[0] !== "truck" || out.kinds[1] !== "car") fail("caravan and journey are not truck and car: " + out.kinds.join("/"));
  steady.reset();
  clean({ view: "iso", quality: "high", zoom: 3, x: cx, y: cy, now: now + 16 });
  out.drawn = steady.counts();
  if (!(out.drawn.trucks >= 1) || !(out.drawn.cars >= 1)) fail("no truck or car was drawn: " + JSON.stringify(out.drawn));
  clearCivilOrder(c1); clearCivilOrder(c2);
  // A motor town keeps cars parked by its hall.
  complete(s, "hall");
  out.parkedSpots = steady.parkedSpots(s.id);
  steady.reset();
  clean({ view: "iso", quality: "high", zoom: 3, x: s.x, y: s.y, now: now + 32 });
  out.parked = steady.counts().parked;
  if (!(out.parkedSpots >= 1) || !(out.parked >= 1)) fail("no cars are parked by the hall: " + out.parkedSpots + "/" + out.parked);
  // Trucks run road freight for fuel between two towns of the polity.
  let other = W.settlements.find((x) => !x.ruined && x !== s);
  if (!other) {
    const founder = people[3] || walker, soc = W.components.social[founder]; if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; }
    for (let tries = 0; tries < 40 && !other; tries++) {
      const tx = clamp(s.x + 14 + (tries % 5), 3, W.width - 4), ty = clamp(s.y - 8 + Math.floor(tries / 5), 3, W.height - 4), t = idx(tx, ty);
      if (W.tiles.liquid[t] > WATER_DEPTH.SURFACE || campNear(t, 6) || nearestSettlement(t, 10)) continue;
      const camp = createCamp(t, founder); if (!camp) continue;
      for (const type of ["stockpile", "shelter", "hearth"]) complete(camp, type);
      other = createSettlement(camp.id);
    }
  }
  if (!other) { fail("no second town for the road"); return out; }
  other.factionId = f.id;
  initializeImplicitSociety(W);
  ensureRoads();
  const link = { id: 9001, factionId: f.id, a: s.id, b: other.id, kind: "road", complete: true, path: [idx(s.x, s.y), idx(other.x, other.y)], tiles: 2, completedEventId: 0 };
  W.roads.links.push(link);
  s.inventory[C.ORGANIC] = 900; s.inventory[C.FUEL] = 40; other.inventory[C.ORGANIC] = 0; other.storageCapacity = Math.max(other.storageCapacity || 0, 5000);
  const tile = idx(s.x, s.y); if (tileMatterAmount(tile, C.OXIDANT) < 20) setTileMatterAmount(tile, C.OXIDANT, 20);
  const mineralBefore = other.inventory[C.ORGANIC], fuelBefore = s.inventory[C.FUEL], matterBefore = totalMatter();
  out.tonnage = steady.freight();
  out.fuelBurned = fuelBefore - s.inventory[C.FUEL];
  if (!(out.tonnage > 0) || !(other.inventory[C.ORGANIC] > mineralBefore)) fail("trucks carried nothing: " + out.tonnage);
  if (!(out.fuelBurned > 0)) fail("the trucks burned no fuel");
  if (totalMatter() !== matterBefore) fail("road freight did not conserve matter: " + matterBefore + " -> " + totalMatter());
  const ev = W.events.filter((e) => e.type === "RoadFreightEvent").at(-1);
  out.freightSentence = ev ? eventSentence(ev) : "";
  if (!ev) fail("no RoadFreightEvent");
  s.inventory[C.FUEL] = 0; other.inventory[C.FUEL] = 0;
  out.dryTonnage = steady.freight();
  if (out.dryTonnage !== 0) fail("trucks ran without fuel: " + out.dryTonnage);
  // Motor caravans carry more, when there is anything to barter.
  const offer = bestBarter(s, other);
  out.motored = offer ? !!offer.motored : "no offer";
  if (offer && !offer.motored) fail("a motor polity's caravan carries no more than a cart");
  W.roads.links = W.roads.links.filter((l) => l !== link);
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_STEADY_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_STEADY_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
