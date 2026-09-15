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
// it spared the seed corn, left the fields fallow — no ship on either seed.
//
// Behind the ship only (132's shipHasLeft), the granary's residents are the
// members within this same reach: the seven-tile reading of 82 saw six of
// Zephyrford's thirty-eight and called it fed, with a hungry share of nought,
// while the hub kept calling villagers in and households kept migrating toward
// its "fed" store. Honest readings before the ship braked the world — on
// causal-origin no ship in two hundred and ninety years — so the village keeps
// its seven tiles until the ship has gone.
const HEARTH_REACH_MIN = 8,
  HEARTH_REACH_MAX = 24,
  HEARTH_REACH_MARGIN = 2;
const HEARTH = { homeMeals: 0, seedKept: 0 };
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
// The seed corn is not a meal. The granary keeps back enough organic to sow
// the fallow fields (82's seedReserve) from its daily draw, but the meal at
// home (117) took from the store down to nothing, and behind the ship a town
// in famine ate its seed, could not sow, and lay fallow into the next famine:
// on the post-ship battery fixture Zephyrford's store stood at nought for eight
// years with three of six fields fallow and sowing failing a hundred times a
// year. A store at or under its seed reserve feeds nobody at home; the hungry
// forage or walk to a fed store as they did before there were rations.
function hearthSpareFood(home, sp) {
  const held = home.inventory?.[sp] || 0;
  if (sp !== C.ORGANIC || typeof seedReserve !== "function") return held;
  return Math.max(0, held - seedReserve(home));
}
const homeRationPlaceHearthBase = homeRationPlace;
homeRationPlace = function (id, sp = C.ORGANIC) {
  const soc = W.components.social[id],
    p = W.components.position[id];
  if (soc?.homePlaceKind === "settlement" && p) {
    const home = W.settlements.find((s) => s.id === soc.homePlaceId && !s.ruined);
    if (
      home &&
      hearthSpareFood(home, sp) > 0 &&
      !(typeof personIsHostileVisitor === "function" && personIsHostileVisitor(id, home.factionId))
    ) {
      const reach = hearthReach(home);
      if (dist2(p.x, p.y, home.x, home.y) <= reach * reach) {
        HEARTH.homeMeals++;
        return home;
      }
    }
  }
  const place = homeRationPlaceHearthBase(id, sp);
  if (place && hearthSpareFood(place, sp) <= 0) {
    HEARTH.seedKept++;
    return null;
  }
  return place;
};
let hearthResidentsCache = { world: null, tick: -1, values: new Map() };
const granaryResidentsHearthBase = granaryResidents;
granaryResidents = function (place) {
  if (!place || place.ruined || !place.knownProcesses || !shipHasLeft()) return granaryResidentsHearthBase(place);
  if (hearthResidentsCache.world !== W || hearthResidentsCache.tick !== W.tick)
    hearthResidentsCache = { world: W, tick: W.tick, values: new Map() };
  const cached = hearthResidentsCache.values.get(place.id);
  if (cached) return cached.slice();
  const reach = hearthReach(place),
    out = [];
  for (const id of entityAtRadius(idx(place.x, place.y), reach, KINDS.PERSON))
    if (classifyAlive(id) && W.components.social[id]?.homePlaceId === place.id) out.push(id);
  out.sort((a, b) => a - b);
  hearthResidentsCache.values.set(place.id, out);
  return out.slice();
};
window.ALIFE_HEARTH_DEBUG = Object.freeze({
  reach: (townId) => hearthReach(W.settlements.find((s) => s.id === townId)),
  residents: (townId) => granaryResidents(W.settlements.find((s) => s.id === townId)).length,
  counts: () => ({ ...HEARTH }),
});
