// Steps smoke (146): a person remembers the tile it last stepped from; the
// needs of life score going back down (not when fleeing), a march that would
// step back takes another way no farther from its goal or holds, and a civil
// order has arrived within three tiles.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const out = { failures: [] }, fail = (m) => out.failures.push(m), steps = window.ALIFE_STEPS_DEBUG;
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.position[id] && W.components.life[id]);
  if (people.length < 2) { fail("too few people"); return out; }
  // A person in open ground, with a passable tile on either side of it.
  const open = (x, y) => inside(x, y) && W.tiles.liquid[idx(x, y)] <= WATER_DEPTH.WADE_LIMIT && W.tiles.fire[idx(x, y)] < 100 && !movementTileBlocked(people[0], x, y);
  let spot = null;
  for (let y = 3; y < W.height - 3 && !spot; y++)
    for (let x = 3; x < W.width - 3 && !spot; x++)
      if (open(x, y) && open(x - 1, y) && open(x + 1, y) && open(x, y - 1) && open(x, y + 1) && open(x + 1, y + 1) && open(x + 1, y - 1)) spot = [x, y];
  if (!spot) { fail("no open ground"); return out; }
  const id = people[0], p = W.components.position[id], l = W.components.life[id], keep = { x: p.x, y: p.y, from: l.stepFrom, at: l.stepAt };
  // ── The memory: a move the effects resolve is remembered ──
  p.x = spot[0] - 1; p.y = spot[1];
  queueEffect("MoveEntity", { entityId: id, x: spot[0], y: spot[1], forced: false }, id);
  l.lastEmbodiedMoveTick = -1e9;
  resolveEffects();
  out.moved = [p.x, p.y];
  if (p.x === spot[0] && p.y === spot[1]) {
    out.back = steps.back(id);
    if (out.back !== idx(spot[0] - 1, spot[1])) fail("the tile stepped from is not remembered: " + out.back);
  } else {
    // The move may be refused (locomotion, crowding); set the memory as the move would have.
    p.x = spot[0]; p.y = spot[1]; l.stepFrom = idx(spot[0] - 1, spot[1]); l.stepAt = W.tick;
    out.back = steps.back(id);
  }
  // ── The needs of life: going back costs; fleeing does not ──
  const backScore = steps.score(id, -1, 0, "return"), stayScore = steps.score(id, 0, 0, "return");
  l.stepAt = W.tick - steps.memory() - 1;
  const freeScore = steps.score(id, -1, 0, "return");
  l.stepAt = W.tick;
  out.scores = [+backScore.toFixed(1), +freeScore.toFixed(1), +stayScore.toFixed(1)];
  if (!(freeScore - backScore >= 39)) fail("stepping back onto the tile just left is not scored down: " + out.scores.join("/"));
  if (Math.abs(steps.score(id, -1, 0, "flee") - directionScoreStepsBase(id, -1, 0, "flee")) > 1e-9) fail("fleeing is scored down for going back");
  // ── The march: another way on, or a halt ──
  const hadOrder = W.components.campaign?.[id];
  W.components.campaign = W.components.campaign || {};
  // A goal due west, through the tile just left: the base march steps back; the steady march must not.
  W.components.campaign[id] = { warId: 0, unitId: 0, factionId: 0, x: spot[0] - 6, y: spot[1], placeId: 0, role: "journey", issuedTick: W.tick };
  const march = steps.march(id);
  out.march = march;
  if (march[0] === -1 && march[1] === 0) fail("a march stepped straight back onto the tile it left");
  if (march[0] || march[1]) {
    const nx = spot[0] + march[0], ny = spot[1] + march[1], here = Math.max(Math.abs(spot[0] - 6 - spot[0]), 0);
    if (Math.max(Math.abs(spot[0] - 6 - nx), Math.abs(spot[1] - ny)) > here) fail("the march's other way went farther from its goal: " + march.join(","));
  }
  // With the memory spent, the march goes straight on to its goal.
  l.stepAt = W.tick - steps.memory() - 1;
  out.marchFree = steps.march(id);
  if (!(out.marchFree[0] === -1)) fail("with the memory spent the march does not step toward its goal: " + out.marchFree.join(","));
  if (hadOrder) W.components.campaign[id] = hadOrder; else delete W.components.campaign[id];
  // ── Arrival within three tiles ──
  const other = people[1], q = W.components.position[other], kq = { x: q.x, y: q.y };
  q.x = spot[0]; q.y = spot[1];
  out.arrived = [orderArrived({ id: other, x: spot[0] + 3, y: spot[1] }), orderArrived({ id: other, x: spot[0] + 4, y: spot[1] })];
  if (!out.arrived[0] || out.arrived[1]) fail("a civil order does not arrive within three tiles and only there: " + out.arrived.join("/"));
  q.x = kq.x; q.y = kq.y;
  p.x = keep.x; p.y = keep.y; l.stepFrom = keep.from; l.stepAt = keep.at;
  out.counts = steps.counts();
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
for (let i = 0; i < 64; i++) game.step(1);
const result = sandbox.window.ALIFE_STEPS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_STEPS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
