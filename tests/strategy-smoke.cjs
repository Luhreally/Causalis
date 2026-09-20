// Strategy smoke (143): the columns of a polity on one objective wait for
// each other within reach of it (the rally), and a defending column at least
// as strong as the column coming meets it on the road (the interception);
// both are phases in 42c's ladder, with words for the fighters, and a rally
// is not a stall.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const out = { failures: [] }, fail = (m) => out.failures.push(m);
  let town = null;
  for (let attempt = 0; attempt < 4 && !town; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    town = W.settlements.find((s) => !s.ruined);
    if (!town) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); town = W.settlements.find((s) => !s.ruined); } }
  }
  if (!town) { fail("no settlement"); return out; }
  if (!town.factionId) createFaction(town.id);
  if (!town.factionId) { fail("the town has no polity"); return out; }
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.position[id] && W.components.social[id] && W.components.life[id]);
  if (people.length < 9) { fail("too few people: " + people.length); return out; }
  // An enemy polity of the ledger only: six fighters lent to it, three to the town, all restored after.
  const ENEMY = 7777,
    lent = people.slice(0, 9),
    saved = lent.map((id) => { const s = W.components.social[id], p = W.components.position[id]; return { id, f: s.factionId, role: s.militaryRole, unit: s.unitId, x: p.x, y: p.y }; }),
    put = (id, x, y) => { W.components.position[id].x = clamp(x, 0, W.width - 1); W.components.position[id].y = clamp(y, 0, W.height - 1); },
    column = (id, factionId, memberIds, home, objective, phase) => ({ id, factionId, homeSettlementId: home, memberIds, training: 1, supply: 0.8, morale: 0.7, objectiveSettlementId: objective, formedTick: W.tick - 200, lastBattleTick: -1, phase, phaseDetail: "", phaseTick: W.tick, lastProgressTick: W.tick, stalledTicks: 0, active: true });
  for (const id of lent.slice(0, 6)) W.components.social[id].factionId = ENEMY;
  for (const id of lent.slice(6, 9)) W.components.social[id].factionId = town.factionId;
  for (const id of lent) { W.components.social[id].militaryRole = "militia"; W.components.social[id].unitId = 0; }
  const near = column(910001, ENEMY, lent.slice(0, 3), 0, town.id, "marching"),
    far = column(910002, ENEMY, lent.slice(3, 6), 0, town.id, "marching"),
    guard = column(910003, town.factionId, lent.slice(6, 9), town.id, town.id, "guarding"),
    war = { id: 910, a: ENEMY, b: town.factionId, attackerId: ENEMY, started: W.tick - 100, ended: 0, casualties: 0, wounded: 0, attackPlan: { attackerId: ENEMY, targetSettlementId: town.id, launchedTick: W.tick - 50, minimumFighters: 2 } },
    savedUnits = W.militaryUnits.slice(), savedWars = W.activeWars.slice();
  W.militaryUnits = [near, far, guard]; W.activeWars = [war];
  // A road with room: the near column about seven tiles out, the far one about fifteen, on passable
  // ground, out of contact, in whichever of eight directions the small fixture world allows.
  const at = (ux, uy, k) => [town.x + Math.round(ux * k), town.y + Math.round(uy * k)],
    passable = (ux, uy, k) => { const [x, y] = at(ux, uy, k); return x >= 1 && y >= 1 && x < W.width - 1 && y < W.height - 1 && campaignTilePassable(idx(x, y), ENEMY, false); },
    place = (ux, uy, nearK, farK) => {
      const [nx, ny] = at(ux, uy, nearK), [nx2, ny2] = at(ux, uy, nearK + 1), [fx, fy] = at(ux, uy, farK), [fx2, fy2] = at(ux, uy, farK + 1);
      put(lent[0], nx, ny); put(lent[1], nx2, ny2); put(lent[2], nx, ny);
      put(lent[3], fx, fy); put(lent[4], fx2, fy2); put(lent[5], fx, fy);
      put(lent[6], town.x, town.y); put(lent[7], town.x, town.y); put(lent[8], town.x, town.y);
    };
  let road = null;
  out.roads = [];
  const sq = Math.SQRT1_2;
  for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [sq, sq], [-sq, sq], [sq, -sq], [-sq, -sq]]) {
    const nearK = [7, 8, 6].find((k) => passable(ux, uy, k) && passable(ux, uy, k + 1) && passable(ux, uy, Math.round(k * 0.5))),
      farK = [15, 14, 13, 16, 17, 12].find((k) => passable(ux, uy, k) && passable(ux, uy, k + 1));
    if (!nearK || !farK) { out.roads.push([+ux.toFixed(2), +uy.toFixed(2), "no ground at " + (nearK || "near") + "/" + (farK || "far")]); continue; }
    place(ux, uy, nearK, farK);
    const contact = militaryContact(near, war) || militaryContact(guard, war);
    if (contact) { out.roads.push([+ux.toFixed(2), +uy.toFixed(2), "contact " + contact.kind + " " + contact.name]); continue; }
    road = [ux, uy, nearK, farK]; break;
  }
  try {
    if (!road) { fail("no road with room on the fixture world"); return out; }
    out.road = road.map((v) => +v.toFixed(2));
    const [ux, uy, nearK, farK] = road;
    // The rally: the near column holds for the far one; the far one does not hold.
    const nearGeometry = unitGeometry(near, town);
    out.nearDistance = +nearGeometry.distance.toFixed(1);
    out.behind = warColumnsBehind(near, town, nearGeometry.distance);
    out.rally = warRallyHolds(near, town, nearGeometry);
    if (!out.rally || !out.behind.includes(far.id)) fail("the near column does not hold for the far one: " + JSON.stringify([out.rally, out.behind, out.nearDistance]));
    if (warRallyHolds(far, town, unitGeometry(far, town))) fail("the far column holds too");
    // Patience: half a year on, it goes alone and does not wait again for this objective.
    near.rally.since = W.tick - RALLY_PATIENCE;
    out.afterPatience = warRallyHolds(near, town, nearGeometry);
    if (out.afterPatience) fail("the column waited past its patience");
    near.rally = null;
    // The far column come up within the gap: no hold.
    for (const id of lent.slice(3, 6)) put(id, ...at(ux, uy, nearK + 3));
    out.closedUp = warRallyHolds(near, town, nearGeometry);
    if (out.closedUp) fail("the column held for a column already within the gap");
    place(ux, uy, nearK, farK);
    near.rally = null;
    // The interception: the town's column, the stronger, meets the near column on the road; the town stays its objective.
    guard.training = 10; guard.supply = 1; near.training = 0; near.supply = 0.5;
    const chosen = militaryObjective(guard);
    out.meet = chosen.target && chosen.target.road ? { x: chosen.target.x - town.x, y: chosen.target.y - town.y, name: chosen.target.name, id: chosen.target.id } : null;
    if (!out.meet) fail("the defender does not meet the column on the road: " + JSON.stringify(chosen.target ? { id: chosen.target.id, name: chosen.target.name } : null));
    else {
      const along = out.meet.x * ux + out.meet.y * uy;
      if (along < 2 || along > INTERCEPT_OUT || out.meet.id >= 0) fail("the meeting point is not on the road to the enemy: " + JSON.stringify(out.meet));
    }
    if (guard.objectiveSettlementId !== town.id) fail("the road took the town's place as the column's objective");
    // A weaker column holds its wall.
    guard.training = 0; guard.supply = 0.3; near.training = 10; near.supply = 1;
    const weak = militaryObjective(guard);
    out.weakHolds = !(weak.target && weak.target.road);
    if (!out.weakHolds) fail("a weaker column sallied out");
    guard.training = 10; guard.supply = 1; near.training = 0; near.supply = 0.5;
    // The ladder (42c): one update sets the phases and the fighters' words.
    while (W.tick % 4) W.tick++;
    updateMilitaryMovement();
    out.phases = { near: near.phase, far: far.phase, guard: guard.phase };
    if (near.phase !== "rallying") fail("the near column's phase is not rallying: " + near.phase + " (" + near.phaseDetail + ")");
    if (guard.phase !== "intercepting" && guard.phase !== "engaged") fail("the defender's phase is not intercepting: " + guard.phase + " (" + guard.phaseDetail + ")");
    if (near.stalledTicks !== 0) fail("the rally counted as a stall");
    const speaker = lent.slice(0, 3).find((id) => workState(id).task === "march");
    out.nearWord = speaker ? W.components.life[speaker].behaviorReason || "" : "(no fighter on the march)";
    if (!speaker || !/rally/.test(out.nearWord)) fail("the fighter's words do not name the rally: " + out.nearWord);
    const marcher = lent.slice(6, 9).find((id) => workState(id).task === "march");
    out.guardWord = marcher ? W.components.life[marcher].behaviorReason || "" : "(no fighter on the march)";
    if (!marcher || !/road/.test(out.guardWord)) fail("the defender's words do not name the road: " + out.guardWord);
    out.debug = window.ALIFE_WARSTRAT_DEBUG.counts();
  } finally {
    W.militaryUnits = savedUnits; W.activeWars = savedWars;
    for (const s of saved) { const soc = W.components.social[s.id]; soc.factionId = s.f; soc.militaryRole = s.role; soc.unitId = s.unit; put(s.id, s.x, s.y); }
  }
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_STRATEGY_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_STRATEGY_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
