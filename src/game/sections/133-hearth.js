// ═══════════════════════════════════════════════════════════════════════════
// 133. HEARTH — a town feeds its own wherever its streets run
// ═══════════════════════════════════════════════════════════════════════════
// Rations from a town's store reached its people only within eight tiles of
// the hall (117), the width of a village. A city is wider. On the post-ship
// battery fixture Zephyrford held thirty-eight people and twenty-seven of them
// lived twelve to twenty tiles from its hall, in the blocks the skyline had
// raised at its edge; their hunger sat at seventy-two to ninety-eight while
// the store behind them held a hundred and forty to three hundred and
// sixty-six. Those within eight tiles of the next town's hall ate there
// instead, as the rule allowed, and drained it: Stonespire's twenty went
// hungry two years in three beside an empty store, and its dead were the
// world's dead behind the ship. A town's reach is now the reach of its
// buildings — two tiles past the farthest finished one, never under eight nor
// over twenty-four — and a person eats at home anywhere within it. Nothing
// else about the meal changes: the same one serving, the same flags, the same
// walk for a stranger on barren ground.
//
// Tried and withdrawn (HANDOFF §11): a full meal of three servings at home,
// which drained the store the skyline's blocks draw ORGANIC from and, before
// it spared the seed corn, left the fields fallow — no ship on either seed;
// and counting the granary's residents within this same reach instead of
// seven tiles, which reads a city honestly (Zephyrford's hungry share went
// from nought to two in three) but braked the world — on causal-origin no ship
// in two hundred and ninety years. The readings stay as 82 left them.
const HEARTH_REACH_MIN = 8,
  HEARTH_REACH_MAX = 24,
  HEARTH_REACH_MARGIN = 2;
const HEARTH = { homeMeals: 0 };
let hearthReachCache = { world: null, tick: -1, values: new Map() };
function hearthReach(town) {
  if (!town || town.ruined) return HEARTH_REACH_MIN;
  if (hearthReachCache.world !== W || hearthReachCache.tick !== W.tick)
    hearthReachCache = { world: W, tick: W.tick, values: new Map() };
  if (hearthReachCache.values.has(town.id)) return hearthReachCache.values.get(town.id);
  let far = 0;
  for (const b of W.buildings)
    if (b.placeKind === "settlement" && b.placeId === town.id && b.complete && !b.ruined)
      far = Math.max(far, Math.sqrt(dist2(b.x, b.y, town.x, town.y)));
  const reach = clamp(Math.ceil(far) + HEARTH_REACH_MARGIN, HEARTH_REACH_MIN, HEARTH_REACH_MAX);
  hearthReachCache.values.set(town.id, reach);
  return reach;
}
const homeRationPlaceHearthBase = homeRationPlace;
homeRationPlace = function (id, sp = C.ORGANIC) {
  const soc = W.components.social[id],
    p = W.components.position[id];
  if (soc?.homePlaceKind === "settlement" && p) {
    const home = W.settlements.find((s) => s.id === soc.homePlaceId && !s.ruined);
    if (
      home &&
      (home.inventory?.[sp] || 0) > 0 &&
      !(typeof personIsHostileVisitor === "function" && personIsHostileVisitor(id, home.factionId))
    ) {
      const reach = hearthReach(home);
      if (dist2(p.x, p.y, home.x, home.y) <= reach * reach) {
        HEARTH.homeMeals++;
        return home;
      }
    }
  }
  return homeRationPlaceHearthBase(id, sp);
};
window.ALIFE_HEARTH_DEBUG = Object.freeze({
  reach: (townId) => hearthReach(W.settlements.find((s) => s.id === townId)),
  counts: () => ({ ...HEARTH }),
});
