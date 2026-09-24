// ═══════════════════════════════════════════════════════════════════════════
// 146. STEADY STEPS — a person does not step straight back onto the tile it
// has just left
// ═══════════════════════════════════════════════════════════════════════════
// The walk was drawn smooth (32d, 111) and still read as indecisive, because
// the steps themselves were: a life re-weighs its needs every tick and chooses
// its next tile greedily, with no memory of the one it came from. The flip
// probe (scratchpad/flip-probe2.cjs) on battery causal-origin at year forty,
// four hundred ticks, a hundred and fifteen people: 32,401 steps, 14,960 of
// them straight back onto the tile before, 46 in a hundred. Nearly half of
// those were civil marches stuck short of a goal they could not reach: a
// caravan two or three tiles from a town's centre, whose core is built solid,
// flipped on 99 steps in a hundred (3,608 of 3,647), a feast-goer on 90, a
// fisher on 98, a walker to the horizon at an obstacle on 94. The rest were
// the work walk (41 in a hundred on the way to work), the field and the work
// face, a worker who stood on its target stepping off it and back, and the
// errands of need.
//
// Every person now remembers the tile it last stepped from, for STEP_MEMORY
// ticks, kept on its life beside the world. The needs of life score that tile
// down by STEP_BACK_PENALTY, so standing still wins over going back unless
// every other way is worse by that much; fleeing, defending and hunting are
// left alone, since a threat is a reason to turn. A worker's step toward its
// work reads the tile as rough ground (STEP_WORKER_STRESS). A march that would
// step back tries another neighbour no farther from its goal, and holds still
// when there is none. And a civil order (a caravan, a feast, a catch, a
// settler, a migrant) has arrived within three tiles of its goal, not two
// (52), since a town's core is built solid and the edge of it is arrival:
// caravans that circled at three tiles until they were overdue come in.
const STEP_MEMORY = 4,
  STEP_BACK_PENALTY = 40,
  STEP_WORKER_STRESS = 25,
  STEP_FREE_GOALS = new Set(["flee", "defend", "hunt"]),
  STEPS = { remembered: 0, scored: 0, worker: 0, rerouted: 0, held: 0 };
let STEP_WORKER = 0;
function stepBackTile(id) {
  const l = W.components.life[id];
  if (!l || !Number.isFinite(l.stepFrom) || W.tick - (l.stepAt ?? -1e9) > STEP_MEMORY) return -1;
  return l.stepFrom;
}
// The memory: every person's move, as the effects resolve it.
const resolveEffectsStepsBase = resolveEffects;
resolveEffects = function () {
  let before = null;
  if (W?.effects?.length)
    for (const e of W.effects) {
      if (e.type !== "MoveEntity" || e.data?.forced) continue;
      const id = e.data?.entityId;
      if (W.kind[id] !== KINDS.PERSON || before?.has(id)) continue;
      const p = W.components.position[id];
      if (p) (before || (before = new Map())).set(id, idx(p.x, p.y));
    }
  resolveEffectsStepsBase();
  if (!before) return;
  for (const [id, from] of before) {
    const p = W.components.position[id],
      l = W.components.life[id];
    if (!p || !l || idx(p.x, p.y) === from) continue;
    l.stepFrom = from;
    l.stepAt = W.tick;
    STEPS.remembered++;
  }
};
// The needs of life: going back costs.
const directionScoreStepsBase = directionScore;
directionScore = function (id, dx, dy, goal) {
  const score = directionScoreStepsBase(id, dx, dy, goal);
  if (!(dx || dy) || score <= -1e8 || W.kind[id] !== KINDS.PERSON || STEP_FREE_GOALS.has(goal))
    return score;
  const back = stepBackTile(id);
  if (back < 0) return score;
  const p = W.components.position[id];
  if (idx(p.x + dx, p.y + dy) !== back) return score;
  STEPS.scored++;
  return score - STEP_BACK_PENALTY;
};
// The walk to work: the tile just left is rough ground for this step only.
const organismHabitatStressStepsBase = organismHabitatStress;
organismHabitatStress = function (id, tile) {
  const base = organismHabitatStressStepsBase(id, tile);
  if (STEP_WORKER !== id || tile !== stepBackTile(id)) return base;
  STEPS.worker++;
  return base + STEP_WORKER_STRESS;
};
const moveWorkerTowardStepsBase = moveWorkerToward;
moveWorkerToward = function (id, tile, ...rest) {
  // A worker whose work lies on the tile it left goes back to it.
  if (W.kind[id] !== KINDS.PERSON || tile === stepBackTile(id))
    return moveWorkerTowardStepsBase(id, tile, ...rest);
  const was = STEP_WORKER;
  STEP_WORKER = id;
  try {
    return moveWorkerTowardStepsBase(id, tile, ...rest);
  } finally {
    STEP_WORKER = was;
  }
};
// The march: another way on, or a halt.
const campaignMarchStepStepsBase = campaignMarchStep;
campaignMarchStep = function (id) {
  const step = campaignMarchStepStepsBase(id),
    p = W.components.position[id];
  if (!p || !step || (!step[0] && !step[1]) || W.kind[id] !== KINDS.PERSON) return step;
  const back = stepBackTile(id);
  if (back < 0 || idx(p.x + step[0], p.y + step[1]) !== back) return step;
  const order = W.components.campaign?.[id];
  if (!order) return step;
  const sails =
      typeof factionHasTech === "function" && factionHasTech(order.factionId, "navigation"),
    here = Math.max(Math.abs(order.x - p.x), Math.abs(order.y - p.y));
  let best = null,
    bestD = Infinity;
  for (let n = 0; n < 8; n++) {
    const [dx, dy] = DIRS[n],
      x = p.x + dx,
      y = p.y + dy;
    if (!inside(x, y)) continue;
    const i = idx(x, y);
    if (
      i === back ||
      (!sails && W.tiles.liquid[i] > WATER_DEPTH.WADE_LIMIT) ||
      W.tiles.fire[i] >= 400
    )
      continue;
    if (typeof movementTileBlocked === "function" && movementTileBlocked(id, x, y)) continue;
    if (Math.max(Math.abs(order.x - x), Math.abs(order.y - y)) > here) continue;
    const d = dist2(x, y, order.x, order.y);
    if (d < bestD) {
      bestD = d;
      best = [dx, dy];
    }
  }
  if (best) {
    STEPS.rerouted++;
    return best;
  }
  STEPS.held++;
  return [0, 0];
};
window.ALIFE_STEPS_DEBUG = Object.freeze({
  counts: () => ({ ...STEPS }),
  back: (id) => stepBackTile(id),
  memory: () => STEP_MEMORY,
  score: (id, dx, dy, goal) => directionScore(id, dx, dy, goal),
  march: (id) => campaignMarchStep(id),
});
