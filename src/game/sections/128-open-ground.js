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
const plannedBuildingTileOpenGroundBase = plannedBuildingTile;
plannedBuildingTile = function (place, type, ordinal) {
  const plot = plannedBuildingTileOpenGroundBase(place, type, ordinal);
  if (plot || !place?.knownProcesses) return plot;
  if (typeof EDGE_TYPES === "undefined" || !EDGE_TYPES.has(type)) return plot;
  return openGroundPlot(place, type);
};
window.ALIFE_OPEN_GROUND_DEBUG = Object.freeze({
  plot: (placeId, type = "launch_tower") => openGroundPlot(W.settlements.find((s) => s.id === placeId), type),
  reach: OPEN_GROUND_REACH,
});
