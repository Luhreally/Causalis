// ═══════════════════════════════════════════════════════════════════════════
// 128. OPEN GROUND — the launch tower stands outside a city that is full
// ═══════════════════════════════════════════════════════════════════════════
// The townscape (92) sites an observatory or a launch tower "at the edge": a
// ring two out from the farthest house, searched to twelve tiles from the
// hall, every third row and column kept for lanes, every plot within a tile of
// a standing building refused. A city that has raised its skyline has no such
// plot. Measured on causal-origin small at year seventy-three: Mosshollow held
// sixty-eight buildings, the search considered two hundred and thirty-six
// tiles after lanes and the square, a hundred and forty-nine were built on and
// a hundred and nineteen were water or worse, and none was clear; the base
// siting, which walks ten rings out from a slot beside the hall, found nothing
// either. Starflight is studied at a launch tower, so the town's notes stood
// at eighty-five of ninety for seventy years while the push, which plans the
// facility a study wants, was handed an empty plan every time. A battery-saver
// city of thirty-seven buildings had the same answer.
//
// A launch tower is not a house on a street. When the townscape and the base
// siting both give up on an edge building, the plot is sought ring by ring
// beyond the town's reach, lanes and all, out to where the country begins:
// the nearest clear ground on dry land, deterministic by the same hash the
// townscape uses. Nothing else about where a building goes changes.
const OPEN_GROUND_REACH = 26;
// ── A plot the town can walk to ──────────────────────────────────────────────
// A builder walks one greedy step at a time round standing buildings and
// never across a cliff (96). Measured on causal-origin phone at year fifty-six:
// Lakeford's two stocked tower blocks had fifteen hands assigned and none
// within a tile and a half of the face, every one "moving to the Tower block
// work face" and standing seven tiles off, stuck; the plots lay past ground
// the town could not cross. A plot is only a plot if the hall can reach it:
// the ground a walker can reach from the hall is flooded once a tick per
// town, out to the open-ground reach, stepping the way a walker steps.
const OPEN_GROUND_FLOOD = { world: null, tick: -1, byPlace: new Map() };
function openGroundReachable(place) {
  if (OPEN_GROUND_FLOOD.world !== W || OPEN_GROUND_FLOOD.tick !== W.tick) {
    OPEN_GROUND_FLOOD.world = W;
    OPEN_GROUND_FLOOD.tick = W.tick;
    OPEN_GROUND_FLOOD.byPlace.clear();
  }
  let seen = OPEN_GROUND_FLOOD.byPlace.get(place.id);
  if (seen) return seen;
  seen = new Set();
  const start = idx(place.x, place.y),
    reach = OPEN_GROUND_REACH + 2,
    liquid = W.tiles.liquid,
    queue = [start];
  seen.add(start);
  for (let head = 0; head < queue.length; head++) {
    const tile = queue[head],
      [x, y] = xy(tile);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx,
          ny = y + dy;
        if (!inside(nx, ny) || Math.max(Math.abs(nx - place.x), Math.abs(ny - place.y)) > reach) continue;
        const next = idx(nx, ny);
        if (seen.has(next)) continue;
        if (liquid[next] > WATER_DEPTH.WADE_LIMIT) continue;
        if (typeof cliffBetween === "function" && cliffBetween(tile, next)) continue;
        // A standing building is walked round, not through; the plot itself
        // is never one, so a plot beside a lane is reached from the lane.
        if (typeof standingBuildingAtMovementTile === "function" && standingBuildingAtMovementTile(nx, ny)) continue;
        seen.add(next);
        queue.push(next);
      }
  }
  OPEN_GROUND_FLOOD.byPlace.set(place.id, seen);
  return seen;
}
// A plot is reached if the hall can walk to a tile beside it.
function openGroundPlotReachable(place, x, y) {
  const seen = openGroundReachable(place);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (inside(x + dx, y + dy) && seen.has(idx(x + dx, y + dy))) return true;
  return false;
}
function openGroundPlot(place, type) {
  const footprint = buildingSpatialRadius(type),
    outer = typeof townOuterRing === "function" ? townOuterRing(place) : 3,
    from = Math.max(2, Math.ceil(outer) + 2);
  for (let ring = from; ring <= OPEN_GROUND_REACH; ring++) {
    let best = null,
      bestScore = -Infinity;
    for (let dy = -ring; dy <= ring; dy++)
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = place.x + dx,
          y = place.y + dy;
        if (x < 1 || y < 1 || x >= W.width - 1 || y >= W.height - 1) continue;
        if (!developmentFootprintClear(x, y, footprint) || !buildingTerrainFootprintValid(type, x, y)) continue;
        if (!openGroundPlotReachable(place, x, y)) continue;
        const score = (hashParts(W.seedHash, "site", place.id, x, y) % 7) * 0.05 - (Math.abs(dx) + Math.abs(dy)) * 0.01;
        if (score > bestScore) {
          bestScore = score;
          best = [x, y];
        }
      }
    if (best) return best;
  }
  return null;
}
// The blocks of the modern world are sited the same way when the town is full.
// Measured on causal-origin phone at year fifty-six: Lakeford held eighty-eight
// buildings and two hundred and fifty of the two hundred and fifty-two tiles
// the townscape considered for a tower were built on; the effort's push
// planned nothing there for fifty years, and the second city, Lakehaven,
// with the crafts and thirty people, never got a block either. A tower on
// open ground past the cottages is a tower; a skyline that cannot be sited
// is not one.
const OPEN_GROUND_TYPES = new Set(["tower", "office", "tenement", "factory"]);
const plannedBuildingTileOpenGroundBase = plannedBuildingTile;
plannedBuildingTile = function (place, type, ordinal) {
  const plot = plannedBuildingTileOpenGroundBase(place, type, ordinal);
  if (!place?.knownProcesses) return plot;
  const edge = typeof EDGE_TYPES !== "undefined" && EDGE_TYPES.has(type),
    block = edge || OPEN_GROUND_TYPES.has(type);
  if (!block) return plot;
  // A plot the townscape found past ground the town cannot cross is no plot.
  if (plot && openGroundPlotReachable(place, plot[0], plot[1])) return plot;
  return openGroundPlot(place, type);
};
window.ALIFE_OPEN_GROUND_DEBUG = Object.freeze({
  plot: (placeId, type = "launch_tower") => openGroundPlot(W.settlements.find((s) => s.id === placeId), type),
  reachable: (placeId, x, y) => openGroundPlotReachable(W.settlements.find((s) => s.id === placeId), x, y),
  flooded: (placeId) => openGroundReachable(W.settlements.find((s) => s.id === placeId)).size,
  reach: OPEN_GROUND_REACH,
});
