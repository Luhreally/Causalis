// Cradle smoke: a bond to the dead or the vanished is released, by the
// coupling loop when the survivor is ready and by the sweep for everyone; a
// living partner is judged as before; and only once a ship has left do
// partners lie together at home at night within eight tiles, do the single of
// a town court and get matched by the town within a year and a half (never a
// single with no years of the window ahead), does a couple parted by the
// towns keep one home, and does a town with nobody hungry, its store empty,
// pass the tile-count capacity under the count of its fields.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const cradle = window.ALIFE_CRADLE_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.position[id] && W.components.life[id]).sort((a, b) => a - b);
  if (people.length < 2) { fail("too few people: " + people.length); return out; }
  for (const id of people) { const soc = W.components.social[id]; soc.homePlaceKind = "settlement"; soc.homePlaceId = s.id; }
  const [a, b] = people;
  // ── The dead and the vanished are mourned ──
  const ghost = 987654321, sa = W.components.social[a], sb = W.components.social[b], pa = W.components.position[a], pb = W.components.position[b];
  sa.partnerId = ghost;
  const widowedBefore = cradle.counts().widowed;
  if (cradle.partnerNear(a)) fail("a ghost counted as a partner near");
  if (sa.partnerId !== 0) fail("the bond to a ghost was not released by the loop: " + sa.partnerId);
  if (cradle.counts().widowed !== widowedBefore + 1) fail("the widowed count did not move");
  sb.partnerId = ghost;
  cradle.mourn();
  if (sb.partnerId !== 0) fail("the bond to a ghost was not released by the sweep: " + sb.partnerId);
  // A living partner is judged by the coupling loop's own rule (76), untouched.
  sa.partnerId = b; sb.partnerId = a;
  out.livingPartner = cradle.partnerNear(a);
  if (sa.partnerId !== b) fail("a living partner was mourned");
  out.livingPartnerBase = matingPartnerNearCradleBase(a, sa, pa, new Set());
  if (out.livingPartner !== out.livingPartnerBase) fail("a living partner is judged differently from the base rule");
  // ── Behind the ship: partners at home, the single courting, a town with room ──
  out.beforeShip = cradle.shipHasLeft();
  if (out.beforeShip) fail("a ship has left a world that has none");
  const savedCanReproduce = canReproduce, savedTick = W.tick;
  canReproduce = () => true;
  const put = (p, x, y) => { p.x = clamp(x, 0, W.width - 1); p.y = clamp(y, 0, W.height - 1); };
  const ax = clamp(pa.x, 12, W.width - 13), ay = clamp(pa.y, 2, W.height - 3);
  put(pa, ax, ay);
  const findLight = (night) => { for (let n = 0; n < TICKS_PER_YEAR * 2; n++) { if (nightAt(pa.x, pa.y) === night) return true; W.tick++; } return false; };
  if (!findLight(true)) fail("no night found");
  put(pb, ax + 6, ay);
  out.nightSixBeforeShip = cradle.partnerNear(a);
  if (out.nightSixBeforeShip) fail("partners six tiles apart lay together before any ship had left");
  W.ascensions.push({ id: 1, settlementId: s.id, factionId: s.factionId || 0, buildingId: 0, tile: idx(s.x, s.y), tick: W.tick, eventId: 0, first: true });
  if (!cradle.shipHasLeft()) fail("the ship that left is not seen");
  out.nightSix = cradle.partnerNear(a);
  if (!out.nightSix) fail("partners six tiles apart at home at night are not near behind the ship");
  put(pb, ax + 11, ay);
  if (cradle.partnerNear(a)) fail("partners eleven tiles apart count as near");
  put(pb, ax + 6, ay);
  sb.homePlaceId = s.id + 1000;
  if (cradle.partnerNear(a)) fail("partners of different homes count as near at six tiles");
  sb.homePlaceId = s.id;
  if (!findLight(false)) fail("no day found");
  out.daySix = cradle.partnerNear(a);
  if (out.daySix) fail("partners six tiles apart by day are near");
  put(pb, ax + 3, ay);
  if (!cradle.partnerNear(a)) fail("partners three tiles apart by day are not near");
  canReproduce = savedCanReproduce;
  W.tick = savedTick;
  // The single court, and over years it comes to something.
  const singles = people.slice(0, 2);
  {
    const [c, d] = singles;
    const sc = W.components.social[c], sd = W.components.social[d];
    for (const [id, soc] of [[c, sc], [d, sd]]) if (soc.partnerId) { const o = W.components.social[soc.partnerId]; if (o && o.partnerId === id) o.partnerId = 0; soc.partnerId = 0; }
    for (const id of singles) { const l = W.components.life[id], body = W.components.body[id]; l.age = Math.max(l.age, (body.maturityAge ?? 3840) + 256); }
    sc.factionId = sd.factionId = s.factionId || sc.factionId || 1;
    sc.kinGroupId = 1001; sd.kinGroupId = 1002;
    const pc = W.components.position[c], pd = W.components.position[d];
    put(pc, clamp(s.x - 6, 0, W.width - 1), s.y); put(pd, clamp(s.x + 6, 0, W.width - 1), s.y);
    const attractionBefore = Math.min(sc.relationships?.[d]?.attraction || 0, sd.relationships?.[c]?.attraction || 0);
    const matched0 = cradle.counts().matched;
    // A single near the end of the window is courted but not matched.
    const ld = W.components.life[d], bodyD = W.components.body[d], ageD = ld.age;
    ld.age = Math.floor(bodyD.maxAge * 0.64);
    for (let n = 0; n < 40 && !sc.partnerId; n++) cradle.court();
    out.matchedLate = !!sc.partnerId;
    if (out.matchedLate) fail("the town matched a single with no years of the window ahead");
    ld.age = ageD;
    out.courted = cradle.court();
    if (!(out.courted > 0)) fail("nobody courted");
    let bonded = false, rounds = 1;
    for (let n = 0; n < 400 && !bonded; n++) { cradle.court(); rounds++; bonded = !!sc.partnerId || !!sd.partnerId; }
    out.attractionAfter = +Math.min(sc.relationships?.[d]?.attraction || 0, sd.relationships?.[c]?.attraction || 0).toFixed(2);
    out.bonded = bonded;
    out.rounds = rounds;
    out.matched = cradle.counts().matched - matched0;
    if (!(out.attractionAfter > attractionBefore) && !bonded) fail("courting did not draw two singles of different houses closer: " + attractionBefore + " -> " + out.attractionAfter);
    if (!bonded) fail("four hundred courtships made no partnership: attraction " + out.attractionAfter);
    // The town matches a courted pair within a few rounds of the match's count, not after years.
    if (rounds > cradle.matchCourtings() + 8) fail("the town did not match the courted pair: " + rounds + " rounds for " + cradle.matchCourtings());
    if (out.matched !== 1) fail("the match was not counted: " + out.matched);
    if (sc.partnerId !== d || sd.partnerId !== c) fail("the matched pair are not each other's partner");
  }
  // A couple parted by the towns keeps one home behind the ship: the later-born takes the elder's town.
  {
    const [c, d] = singles, sc = W.components.social[c], sd = W.components.social[d];
    if (sc.partnerId === d && sd.partnerId === c) {
      const elder = Math.min(c, d), younger = Math.max(c, d), se = W.components.social[elder], sy = W.components.social[younger];
      const savedHome = [sy.homePlaceKind, sy.homePlaceId];
      se.homePlaceKind = "settlement"; se.homePlaceId = s.id;
      sy.homePlaceKind = "settlement"; sy.homePlaceId = s.id + 1000;
      W.ascensions.pop();
      out.reunitedBeforeShip = cradle.reunite();
      if (out.reunitedBeforeShip !== 0 || sy.homePlaceId !== s.id + 1000) fail("a parted couple was reunited before any ship had left");
      W.ascensions.push({ id: 1, settlementId: s.id, factionId: s.factionId || 0, buildingId: 0, tile: idx(s.x, s.y), tick: W.tick, eventId: 0, first: true });
      out.reunited = cradle.reunite();
      if (out.reunited !== 1 || sy.homePlaceId !== s.id || sy.homePlaceKind !== "settlement") fail("the later-born did not take the elder's town: " + sy.homePlaceKind + " " + sy.homePlaceId);
      if (se.homePlaceId !== s.id) fail("the elder moved");
      [sy.homePlaceKind, sy.homePlaceId] = savedHome;
    } else fail("no matched pair to part");
  }
  // A town with room passes the capacity gate behind the ship, and is judged as before without one.
  const finish = (bld) => { if (bld) { bld.complete = true; bld.stage = 6; bld.integrity = bld.maxIntegrity; bld.completedTick = W.tick; for (const [sp, n] of bld.requirements || []) { W.conservation.playerInput += Math.max(0, n - (bld.composition[sp] || 0)); bld.composition[sp] = n; } } return bld; };
  const complete = (place, type) => finish(planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === place.id && x.type === type && !x.complete));
  // Fed means nobody hungry, not a full larder: the store is emptied to nothing and the town still has room.
  const hungers = people.map((id) => W.components.life[id].hunger);
  for (const id of people) W.components.life[id].hunger = 20;
  const grant = -(s.inventory[C.ORGANIC] || 0);
  s.inventory[C.ORGANIC] = 0;
  W.conservation.playerInput += grant;
  W.tick++;
  out.larder = Math.round(foodOutlook(s)?.larder ?? -1);
  for (let n = 0; n < 12 && cradle.room(s.id).people >= cradle.room(s.id).cap; n++) { if (!complete(s, "farm")) break; W.tick++; }
  out.room = cradle.room(s.id);
  if (!out.room?.room) fail("a fed town under the count of its fields has no room: " + JSON.stringify(out.room));
  if (!(out.room?.fed) ) fail("a town with nobody hungry did not read as fed with its store empty: " + JSON.stringify(out.room));
  out.allowsRoom = reproductionDensityAllows(a, KINDS.PERSON);
  if (out.allowsRoom !== true) fail("a person of a town with room was refused by the capacity behind the ship");
  W.ascensions.pop();
  W.tick++;
  out.allowsBeforeShip = reproductionDensityAllows(a, KINDS.PERSON);
  out.baseBeforeShip = reproductionDensityAllowsCradleBase(a, KINDS.PERSON);
  if (out.allowsBeforeShip !== out.baseBeforeShip) fail("before any ship the capacity is not the old one: " + out.allowsBeforeShip + " vs " + out.baseBeforeShip);
  people.forEach((id, i) => { W.components.life[id].hunger = hungers[i]; });
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_CRADLE_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_CRADLE_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
