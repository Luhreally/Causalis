// ═══════════════════════════════════════════════════════════════════════════
// 59. WAYFINDING — civil travellers follow a found road, by land or by sea
// ═══════════════════════════════════════════════════════════════════════════
// Caravans, envoys, journeys, wedding parties, fishers, and settlers all walk
// under civil orders through the campaign march, which steps greedily toward
// the goal and stalls at the first lake or wall in the way. War columns
// already find a corridor with a breadth-first search; here every civil order
// gets a road of its own, cached on the order and refreshed when the traveller
// strays. Orders marked as sea voyages are sailed instead: the boat is moved
// along a water corridor a few tiles at a time, which is the only way across
// deep water, since walking never enters it. No polity sends anyone where no
// road exists.
const CIVIL_PATH_REFRESH = 384,
  SEA_LEG = 1,
  DEEP_WALK_LIMIT = 1100;
function seaTilePassable(tile) {
  return W.tiles.liquid[tile] > WATER_DEPTH.SHALLOW && W.tiles.fire[tile] < 400;
}
// Breadth-first corridor from one tile to within reach of a target.
function civilPathFind(seed, target, factionId = 0, mode = "land") {
  if (!(seed >= 0) || !target) return [];
  const width = W.width,
    parent = new Int32Array(W.tileCount).fill(-1),
    queue = [seed],
    reach = mode === "sea" ? 2 : 3,
    approach = (tile) =>
      Math.max(Math.abs((tile % width) - target.x), Math.abs(((tile / width) | 0) - target.y)),
    [sx, sy] = xy(seed),
    nearShoreOf = (tile, x, y) =>
      Math.max(Math.abs((tile % width) - x), Math.abs(((tile / width) | 0) - y)) <= 6 &&
      campaignTilePassable(tile, factionId, false),
    // A sea road may begin and end with a short walk to and from the shore.
    passable =
      mode === "sea"
        ? (tile) =>
            seaTilePassable(tile) || nearShoreOf(tile, sx, sy) || nearShoreOf(tile, target.x, target.y)
        : (tile) => campaignTilePassable(tile, factionId, false);
  parent[seed] = seed;
  let best = -1,
    bestApproach = Infinity,
    explored = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor],
      d = approach(current);
    if (d < bestApproach) {
      bestApproach = d;
      best = current;
      if (d <= reach) break;
    }
    if (++explored > 24000) break;
    for (const next of neighbors4(current)) {
      if (parent[next] !== -1 || !passable(next)) continue;
      parent[next] = current;
      queue.push(next);
    }
  }
  if (best < 0 || bestApproach > reach) return [];
  const path = [];
  for (let tile = best, guard = 0; guard <= W.tileCount; tile = parent[tile], guard++) {
    path.push(tile);
    if (parent[tile] === tile) break;
  }
  return path.reverse();
}
function civilReachable(fromTile, target, factionId = 0, mode = "land") {
  return civilPathFind(fromTile, target, factionId, mode).length > 0;
}
function civilPath(order, id) {
  const p = W.components.position[id];
  if (!p) return null;
  const fresh =
    Array.isArray(order.path) &&
    order.pathTick != null &&
    W.tick - order.pathTick < CIVIL_PATH_REFRESH &&
    order.pathX === order.x &&
    order.pathY === order.y;
  if (fresh && campaignRouteIndex(order.path, p.x, p.y).distance <= 4) return order.path;
  order.path = civilPathFind(
    idx(p.x, p.y),
    { x: order.x, y: order.y },
    W.components.social[id]?.factionId || 0,
    order.sea ? "sea" : "land",
  );
  order.pathTick = W.tick;
  order.pathX = order.x;
  order.pathY = order.y;
  return order.path;
}
function civilPassable(id, x, y, sails) {
  if (!inside(x, y)) return false;
  const tile = idx(x, y);
  if (!(sails || W.tiles.liquid[tile] <= WATER_DEPTH.WADE_LIMIT)) return false;
  if (W.tiles.fire[tile] >= 400) return false;
  return !(typeof movementTileBlocked === "function" && movementTileBlocked(id, x, y));
}
const campaignMarchStepWayBase = campaignMarchStep;
campaignMarchStep = function (id) {
  const camp = W.components.campaign?.[id];
  if (!camp || camp.warId) return campaignMarchStepWayBase(id);
  const order = typeof civilOrderOf === "function" ? civilOrderOf(id) : null,
    p = W.components.position[id];
  if (!order || !p) return campaignMarchStepWayBase(id);
  // A boat is sailed by the tick below; the walker aboard holds still.
  if (order.sea) return [0, 0];
  if (Math.max(Math.abs(p.x - order.x), Math.abs(p.y - order.y)) <= 1)
    return campaignMarchStepWayBase(id);
  const path = civilPath(order, id);
  if (!path || path.length < 2) return campaignMarchStepWayBase(id);
  const { index, distance } = campaignRouteIndex(path, p.x, p.y);
  if (distance > 4) return campaignMarchStepWayBase(id);
  const sails = typeof aboardTownBoat === "function" && aboardTownBoat(id),
    ahead = Math.min(path.length - 1, index + (distance > 1 ? 0 : 2)),
    [gx, gy] = xy(path[ahead]),
    dx = Math.sign(gx - p.x),
    dy = Math.sign(gy - p.y);
  if (!dx && !dy) return campaignMarchStepWayBase(id);
  for (const [sx, sy] of [
    [dx, dy],
    [dx, 0],
    [0, dy],
  ])
    if ((sx || sy) && civilPassable(id, p.x + sx, p.y + sy, sails)) return [sx, sy];
  return campaignMarchStepWayBase(id);
};
// ── Sailing ────────────────────────────────────────────────────────────────────
// Runs after the ordinary tick has moved everyone, so the boat has the last word
// on where its passengers are: one tile along the corridor per tick, straight
// out to deep water when boarding.
function sailCivilOrders() {
  let moved = false;
  for (const order of W.civilOrders || []) {
    if (!order.sea) continue;
    const id = order.id,
      p = W.components.position[id];
    if (!p || !classifyAlive(id)) continue;
    if (Math.max(Math.abs(p.x - order.x), Math.abs(p.y - order.y)) <= 1) continue;
    const path = civilPath(order, id);
    if (!path || !path.length) continue;
    const { index, distance } = campaignRouteIndex(path, p.x, p.y);
    if (distance > 6) continue;
    let next;
    if (index >= path.length - 1) next = idx(order.x, order.y);
    else {
      next = path[Math.min(path.length - 1, index + SEA_LEG)];
      // Boarding: from the shore, the boat puts straight out into deep water,
      // where no one can wander back off it between legs.
      if (W.tiles.liquid[idx(p.x, p.y)] < DEEP_WALK_LIMIT)
        for (let k = index + 1; k <= Math.min(path.length - 1, index + 10); k++)
          if (W.tiles.liquid[path[k]] >= DEEP_WALK_LIMIT) {
            next = path[k];
            break;
          }
    }
    const [nx, ny] = xy(next);
    if (nx === p.x && ny === p.y) continue;
    if (W.tiles.fire[next] >= 400) continue;
    p.x = nx;
    p.y = ny;
    p.regionId = regionId(nx, ny);
    const life = W.components.life[id];
    if (life) {
      life.lastEmbodiedMoveTick = W.tick;
      life.insideBuildingId = 0;
    }
    moved = true;
  }
  if (moved) rebuildSpatialBins();
}
const simTickWayBase = simTick;
simTick = function () {
  simTickWayBase();
  if (W?.civilOrders?.length) sailCivilOrders();
};
// No caravan sets out for a town no road reaches; when both towns sail and the
// land gives no road, the caravan goes by sea.
const spawnCaravanWayBase = spawnCaravan;
spawnCaravan = function (from, to, route, cargoSp = -1, cargoAmount = 0) {
  if (!from || !to) return spawnCaravanWayBase(from, to, route, cargoSp, cargoAmount);
  const start = idx(from.x, from.y),
    byLand = civilReachable(start, to, from.factionId || 0),
    bySea =
      !byLand &&
      typeof placeSails === "function" &&
      placeSails(from) &&
      placeSails(to) &&
      civilReachable(start, to, from.factionId || 0, "sea");
  if (!byLand && !bySea) return null;
  const caravan = spawnCaravanWayBase(from, to, route, cargoSp, cargoAmount);
  if (caravan && bySea) {
    caravan.sea = true;
    for (const id of caravan.members) {
      const order = civilOrderOf(id);
      if (order) order.sea = true;
    }
  }
  return caravan;
};
window.ALIFE_WAYFINDING_DEBUG = Object.freeze({
  path: (fromTile, x, y, factionId = 0, mode = "land") =>
    civilPathFind(fromTile, { x, y }, factionId, mode),
  reachable: (fromTile, x, y, factionId = 0, mode = "land") =>
    civilReachable(fromTile, { x, y }, factionId, mode),
  orderPath: (id) =>
    (typeof civilOrderOf === "function" ? civilOrderOf(id)?.path?.slice() : null) || null,
  sail: () => sailCivilOrders(),
});
