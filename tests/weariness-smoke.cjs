// War-weariness smoke: fighting tires a polity, a tired or busy polity feels
// less pressure toward new wars, wars with no battle peter out, and rivalries
// name the person or craft actually contested.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const weary = window.ALIFE_WEARINESS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  for (const t of W.settlements) if (!t.ruined && !t.factionId && W.factions.length < 3) createFaction(t.id);
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  while (W.factions.length < 3 && people.length) {
    const founder = people.pop();
    let tile = -1;
    for (let tries = 0; tries < 400 && tile < 0; tries++) {
      const x = 4 + ((tries * 37 + 11) % (W.width - 8)), y = 4 + ((tries * 23) % (W.height - 8)), t = idx(x, y);
      if (W.tiles.liquid[t] <= WATER_DEPTH.SURFACE && !campNear(t, 6) && !nearestSettlement(t, 10)) tile = t;
    }
    if (tile < 0) break;
    const soc = W.components.social[founder];
    if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; soc.factionId = 0; }
    const camp = createCamp(tile, founder);
    if (!camp) continue;
    for (const type of ["stockpile", "shelter", "hearth"]) {
      const b = planBuilding(camp, type, 5) || W.buildings.find((x) => !x.ruined && x.placeKind === "camp" && x.placeId === camp.id && x.type === type);
      if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; }
    }
    const town = createSettlement(camp.id);
    if (town) createFaction(town.id);
  }
  const living = W.factions.filter((f) => f.stability > 0);
  if (living.length < 3) { fail("could not raise three polities"); return out; }
  const [A, B, Cc] = living;
  // Contact and a baseline pressure reading before any war.
  for (const [p, q] of [[A, B], [B, A], [A, Cc], [Cc, A], [B, Cc], [Cc, B]]) { const rel = relationOf(p, q); rel.pressure = 30; rel.trade = 1; }
  const rested = weary.pressure(A.id, Cc.id).pressure;
  // A fights B; its appetite for a war with C falls, and it tires.
  const war = window.ALIFE_DIPLOMACY_DEBUG.war(A.id, B.id);
  if (!war) { fail("no war"); return out; }
  weary.update();
  if (!(weary.weariness(A.id) > 0)) fail("fighting did not tire the polity");
  out.appetite = weary.appetite(A.id, Cc.id);
  if (!(out.appetite < 1)) fail("a polity at war keeps its full appetite for another");
  const busy = weary.pressure(A.id, Cc.id).pressure;
  if (!(busy < rested)) fail("pressure toward a third polity did not fall: " + rested + " -> " + busy);
  // Two wars: a third stays below the brink.
  const war2 = window.ALIFE_DIPLOMACY_DEBUG.war(A.id, Cc.id);
  if (!war2) { fail("no second war"); return out; }
  endWar(war2, A, Cc, "a peace for the test");
  war2.ended = W.tick;
  const D = W.factions.find((f) => f.stability > 0 && f !== A && f !== B && f !== Cc);
  if (D) { relationOf(A, D).pressure = 150; relationOf(D, A).pressure = 150; }
  // A war without a battle for three years peters out.
  const stale = window.ALIFE_DIPLOMACY_DEBUG.war(B.id, Cc.id);
  if (!stale) { fail("no stale war"); return out; }
  stale.casualties = 0; stale.started = W.tick - TICKS_PER_YEAR * 4;
  weary.update();
  if (!stale.ended) fail("a war with no battle did not peter out");
  const ended = W.events.filter((e) => e.type === "WarEndedEvent").at(-1);
  if (ended) out.endedReason = ended.evidence?.[0];
  // Weary peoples end a long war.
  A.weariness = 0.6; B.weariness = 0.6; war.turns = 8;
  weary.update();
  if (!war.ended) fail("two weary peoples kept fighting");
  // Weariness feeds unrest and fades in peace.
  const calm = unrestOf(settlement); A.weariness = 1; const tired = unrestOf(settlement); A.weariness = 0.6;
  if (!(tired > calm)) fail("weariness does not feed unrest");
  const before = A.weariness; weary.update(); if (!(A.weariness < before)) fail("weariness does not fade in peace");
  if (!/War-weariness/.test(window.ALIFE_LEGENDS_DEBUG.render("faction", A.id))) fail("the polity page does not show weariness");
  // Rivalry causes name the contested person or craft.
  const adults = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && isAdultPerson(id));
  if (adults.length < 3) { out.rivalrySkipped = "too few adults"; return out; }
  const [x, y, z] = adults;
  for (const id of [x, y, z]) { const soc = W.components.social[id]; soc.partnerId = 0; }
  relationshipState(x, z).attraction = 0.9; relationshipState(y, z).attraction = 0.9;
  const measure = { feud: null, grievance: 0, contest: rivalContest(x, y), proudPair: 0, dominanceClash: 0, jealousy: 0 };
  out.belovedCause = rivalryCause(x, y, measure);
  if (!measure.contest || measure.contest.kind !== "beloved" || !out.belovedCause.includes(entityName(z))) fail("two people courting the same person are not rivals over that person: " + out.belovedCause);
  // Diffuse attraction to a popular person is no quarrel: only a strong, shared, strongest pull is.
  relationshipState(x, z).attraction = 0.45; relationshipState(y, z).attraction = 0.45;
  if (rivalContest(x, y)) fail("two people mildly drawn to the same person were made rivals");
  relationshipState(x, z).attraction = 0; relationshipState(y, z).attraction = 0;
  const ix = characterOf(x), iy = characterOf(y);
  ix.skills.craft = 20; iy.skills.craft = 18; ix.skills.build = 2; iy.skills.build = 2;
  const craft = rivalContest(x, y);
  out.craftCause = craft ? craft.text : "";
  if (!craft || craft.kind !== "craft" || !/finer crafter/.test(out.craftCause)) fail("two would-be masters of one craft are not rivals over it: " + out.craftCause);
  iy.skills.craft = 2; iy.skills.build = 20;
  if (rivalContest(x, y)) fail("masters of different crafts were made rivals");
  ix.want = { id: "partner", since: W.tick }; iy.want = { id: "partner", since: W.tick };
  iy.skills.craft = 2;
  if (rivalContest(x, y)) fail("two people who merely both want a partner were made rivals");
  // Siblings over what a parent just left behind.
  const w = adults.find((id) => ![x, y, z].includes(id));
  if (w) {
    ix.parents = [w]; iy.parents = [w];
    killEntity(w, "a fever for the test", 0);
    const heirs = rivalContest(x, y);
    out.inheritanceCause = heirs ? heirs.text : "";
    if (!heirs || heirs.kind !== "inheritance") fail("siblings did not contest the inheritance: " + out.inheritanceCause);
    ix.parents = []; iy.parents = [];
  }
  // Two workers on the same ground.
  const wx = workState(x), wy = workState(y);
  wx.task = "mine"; wy.task = "mine"; wx.targetTile = 77; wy.targetTile = 77; wx.materialId = C.ORE;
  const ground = rivalContest(x, y);
  out.groundCause = ground ? ground.text : "";
  if (!ground || ground.kind !== "ground") fail("two miners on one ground were not rivals: " + out.groundCause);
  wx.task = "idle"; wy.task = "idle"; wx.targetTile = -1; wy.targetTile = -1;
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_WEARINESS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_WEARINESS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
