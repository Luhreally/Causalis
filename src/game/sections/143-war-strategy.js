// ── 143. War strategy: the rally and the interception ────────────────────────
// What the columns did not do (the war probe on battery causal-origin, HANDOFF
// section 24): the columns of one polity on one objective arrived apart, each
// assaulting the gate as it came (five columns of The Lake League on one gate
// of The Thorn Concord at year 58, three of them assaulting while one still
// marched), and a defender waited at home for a column it could see coming.
// Two rules, both the world's own to use:
//   The rally. An attacking column of a launched campaign within RALLY_REACH
//   tiles of its objective and not yet at the gate holds where it stands while
//   another column of its polity on the same objective (two or more fighters,
//   whether it has left home yet or not) is RALLY_GAP tiles or more behind it
//   and within RALLY_FAR of the objective; it holds for RALLY_PATIENCE ticks
//   at most, and once its patience is out it goes on alone and does not wait
//   again for that objective. The hold is a phase ("rallying", decided in
//   42c's ladder before contact, since a town's fields put a column in contact
//   long before the hall; a field or a wall in reach is held over, an enemy
//   formation or the town itself is not), not a stall: the stalled count is
//   cleared while it holds, so a column that waits is not sent rerouting or
//   home, and no combat is resolved for a column that holds.
//   The interception. A defending column whose war has an enemy column within
//   INTERCEPT_REACH tiles of the town it guards, nearer that town than its own
//   home (it has left home toward us), and whose
//   strength is at least INTERCEPT_ODDS of that column's, marches to meet it
//   on the road: its target becomes a point on the line from the town to the
//   enemy, INTERCEPT_OUT tiles out at most and half the distance at least (a
//   "road" target carried over the town the base chose; the town stays the
//   column's objectiveSettlementId, so the tab and the lens still name it).
//   The point holds while the enemy has not moved three tiles, so the route
//   is not replotted every four ticks. A weaker column holds its wall.
// Both are sim rules, so the launch sweep on both sizes is in the commit.
const WARSTRAT = { rallies: 0, held: 0, released: 0, intercepts: 0 };
// `let`, so a probe can lift a rule for an A/B (RALLY_REACH 0 turns the rally off, INTERCEPT_REACH 0 the interception).
let RALLY_REACH = 9,
  RALLY_NEAR = 3.5,
  RALLY_GAP = 5,
  RALLY_FAR = 30,
  RALLY_PATIENCE = 128,
  INTERCEPT_REACH = 14,
  INTERCEPT_OUT = 6,
  INTERCEPT_ODDS = 0.9;
function warOfFaction(factionId) {
  return W.activeWars.find((w) => !w.ended && (w.a === factionId || w.b === factionId)) || null;
}
// The columns of the polity behind this one on the same objective: two or more
// fighters, left home or not, RALLY_GAP tiles or more farther from the objective
// than this column and within RALLY_FAR of it.
function warColumnsBehind(unit, objective, distance) {
  const behind = [];
  for (const sibling of W.militaryUnits) {
    if (!sibling.active || sibling === unit || sibling.factionId !== unit.factionId) continue;
    if (sibling.objectiveSettlementId !== objective.id) continue;
    const g = unitGeometry(sibling, objective);
    if (g.members.length < 2) continue;
    if (g.distance >= distance + RALLY_GAP && g.distance <= RALLY_FAR) behind.push(sibling.id);
  }
  return behind;
}
function warRallyHolds(unit, objective, geometry) {
  if (!objective || objective.road || !geometry || !unit.active) return false;
  const war = warOfFaction(unit.factionId);
  if (!war || war.attackerId !== unit.factionId || !war.attackPlan?.launchedTick) return false;
  if (geometry.distance > RALLY_REACH || geometry.distance <= RALLY_NEAR) {
    if (unit.rally?.holding) unit.rally.holding = false;
    return false;
  }
  const rally = unit.rally && unit.rally.objectiveId === objective.id ? unit.rally : null;
  if (rally && W.tick - rally.since >= RALLY_PATIENCE) {
    if (rally.holding) {
      rally.holding = false;
      WARSTRAT.released++;
    }
    return false;
  }
  const behind = warColumnsBehind(unit, objective, geometry.distance);
  if (!behind.length) {
    if (rally?.holding) {
      rally.holding = false;
      WARSTRAT.released++;
    }
    return false;
  }
  if (!rally) {
    unit.rally = { objectiveId: objective.id, since: W.tick, holding: true, waitingFor: behind };
    WARSTRAT.rallies++;
  } else {
    rally.holding = true;
    rally.waitingFor = behind;
  }
  WARSTRAT.held++;
  return true;
}
function warInterceptTarget(unit, war, town) {
  if (!war || !town || !unit.active || war.attackerId === unit.factionId || INTERCEPT_REACH <= 0) {
    unit.intercept = null;
    return null;
  }
  const enemyId = war.attackerId;
  let best = null,
    bestDistance = Infinity;
  for (const enemy of W.militaryUnits) {
    if (!enemy.active || enemy.factionId !== enemyId) continue;
    const g = unitGeometry(enemy, town);
    if (g.members.length < 2 || g.distance > INTERCEPT_REACH || g.distance < 1) continue;
    // A column that has left home toward us: nearer this town than its own.
    const enemyHome = W.settlements.find((s) => s.id === enemy.homeSettlementId && !s.ruined);
    if (enemyHome && g.distance >= Math.hypot(g.x - enemyHome.x, g.y - enemyHome.y)) continue;
    if (g.distance < bestDistance) {
      bestDistance = g.distance;
      best = { enemy, g };
    }
  }
  if (!best || militaryUnitStrength(unit) < militaryUnitStrength(best.enemy) * INTERCEPT_ODDS) {
    unit.intercept = null;
    return null;
  }
  const last = unit.intercept;
  let point;
  if (
    last &&
    last.enemyId === best.enemy.id &&
    last.townId === town.id &&
    Math.hypot(best.g.x - last.enemyX, best.g.y - last.enemyY) < 3
  )
    point = last;
  else {
    const out = Math.min(INTERCEPT_OUT, bestDistance * 0.5),
      dx = best.g.x - town.x,
      dy = best.g.y - town.y,
      len = Math.hypot(dx, dy) || 1,
      x = clamp(Math.round(town.x + (dx / len) * out), 0, W.width - 1),
      y = clamp(Math.round(town.y + (dy / len) * out), 0, W.height - 1);
    if (!campaignTilePassable(idx(x, y), unit.factionId, false)) {
      unit.intercept = null;
      return null;
    }
    point = unit.intercept = {
      enemyId: best.enemy.id,
      townId: town.id,
      enemyX: best.g.x,
      enemyY: best.g.y,
      x,
      y,
      since: W.tick,
    };
    WARSTRAT.intercepts++;
  }
  // A negative id, one per tile, so the route cache (42a) replots when the point moves.
  return {
    id: -(1 + idx(point.x, point.y)),
    x: point.x,
    y: point.y,
    name: `${town.name} road`,
    road: true,
    townId: town.id,
    factionId: town.factionId,
  };
}
const militaryObjectiveStrategyBase = militaryObjective;
militaryObjective = function (unit) {
  const chosen = militaryObjectiveStrategyBase(unit);
  if (!chosen.war || !chosen.target) {
    unit.intercept = null;
    return chosen;
  }
  const road = warInterceptTarget(unit, chosen.war, chosen.target);
  return road ? { war: chosen.war, target: road, home: chosen.home } : chosen;
};
window.ALIFE_WARSTRAT_DEBUG = Object.freeze({
  counts: () => ({ ...WARSTRAT }),
  rallies: () =>
    (W.militaryUnits || [])
      .filter((u) => u.active && u.rally?.holding)
      .map((u) => ({
        id: u.id,
        objective: u.rally.objectiveId,
        since: u.rally.since,
        waitingFor: u.rally.waitingFor,
      })),
  intercepts: () =>
    (W.militaryUnits || [])
      .filter((u) => u.active && u.intercept)
      .map((u) => ({ id: u.id, ...u.intercept })),
});
