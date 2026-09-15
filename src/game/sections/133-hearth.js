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
const HEARTH = { homeMeals: 0, seedKept: 0, drawn: 0, seedHidden: 0 };
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
// Behind the ship only: kept before it, on battery causal-origin the village
// stores sat under the reserve half the time, nobody ate at home, and the ship
// that left at year 58 with the rule off never left with it on (HANDOFF §12).
function hearthSpareFood(home, sp) {
  const held = home.inventory?.[sp] || 0;
  if (sp !== C.ORGANIC || typeof seedReserve !== "function" || !shipHasLeft()) return held;
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
// ── The daily draw reaches the whole town (behind the ship) ─────────────────
// The granary's daily draw (30e) hands the store, down to the seed reserve, to
// whoever stands within eight tiles of the hall, filling each gut to
// twenty-four: the store is at its reserve by the time any meal at home is
// asked for, and the ration-why probe counted the hungry of Stonespire and
// Zephyrford failing that meal four thousand times a year on an empty store
// while the store's samples read twenty to three hundred. A city's residents
// twelve to twenty tiles out were never in the draw at all, and the draw fed
// the neighbouring town's people who happened to stand near the hall. Behind
// the ship, after the draw, the town's own members within its reach and
// beyond the eight tiles draw the same ration by the same rule, and so do the
// near ones the draw refused as hostile visitors for the flag they kept
// through a conquest: a member takes the town's flag, as the near ones
// already do, and is no stranger at their own hall.
const HEARTH_DRAW_FILL = 24,
  HEARTH_DRAW_NEAR = 8;
function hearthDraw(s) {
  if (!s || s.ruined || !s.knownProcesses || typeof rationCap !== "function") return 0;
  const cap = rationCap(s),
    seed = typeof seedReserve === "function" ? seedReserve(s) : 0,
    near2 = HEARTH_DRAW_NEAR * HEARTH_DRAW_NEAR;
  let drawn = 0;
  for (const id of granaryResidents(s)) {
    const p = W.components.position[id];
    if (!p) continue;
    const soc = W.components.social[id],
      // The base draw refuses a member under another flag as a hostile visitor; the
      // hungry-town probe found two of Flintholl's twelve at hunger ninety-eight six
      // tiles from a store of a hundred and fifty, refused so for years.
      refused = typeof personIsHostileVisitor === "function" && !!s.factionId && personIsHostileVisitor(id, s.factionId);
    if (dist2(p.x, p.y, s.x, s.y) <= near2 && !refused) continue;
    if (soc && s.factionId && soc.factionId !== s.factionId && !soc.unitId) soc.factionId = s.factionId;
    const digestive = W.components.inventory[id]?.digestive;
    if (!digestive) continue;
    const food = Math.min(cap, Math.max(0, HEARTH_DRAW_FILL - digestive[C.ORGANIC]), Math.max(0, (s.inventory[C.ORGANIC] || 0) - seed), 65535 - digestive[C.ORGANIC]);
    if (food <= 0) continue;
    s.inventory[C.ORGANIC] -= food;
    digestive[C.ORGANIC] += food;
    drawn += food;
  }
  if (drawn) HEARTH.drawn += drawn;
  return drawn;
}
const updateSettlementsHearthBase = updateSettlements;
updateSettlements = function () {
  updateSettlementsHearthBase();
  if (W?.settlements && shipHasLeft()) for (const s of W.settlements) hearthDraw(s);
};
// ── A full store gives a full ration ────────────────────────────────────────
// The granary stretches the daily ration as the stores run low: eighteen a
// day, twelve when lean, eight in famine. But "famine" is also read from the
// hungry share, so a town whose people were hungry for any other reason was
// put on eight a day with a store of two hundred behind them, and eight a day
// is under what a working body burns (a serving of eighteen carries a worker
// some fifty ticks): the hungry-town probe on battery causal-origin at year
// 104 read Flintholl at four in five hungry beside a store of 189, and the
// transit probe at 103 read it at every soul hungry beside 156, nine fields
// ripe. The ration is the store above the seed reserve shared out equally,
// up to eighteen a head, and never under the granary's own figure: with 168
// to share among twelve, fourteen each rather than eight. The store-drain
// probe (battery causal-origin, year 104) had read that store emptied in one
// tick by two eaters at a stride of eight while ten went without. Behind the
// ship, like the rest of this section: with the rule everywhere the launch
// road changed (see 41).
const HEARTH_RATION_FULL = 18;
const rationCapHearthBase = rationCap;
rationCap = function (place) {
  const base = rationCapHearthBase(place);
  if (!place?.knownProcesses || place.ruined || base >= HEARTH_RATION_FULL || !shipHasLeft()) return base;
  const residents = Math.max(1, granaryResidents(place).length),
    spare = Math.max(0, (place.inventory[C.ORGANIC] || 0) - (typeof seedReserve === "function" ? seedReserve(place) : 0));
  return Math.max(base, Math.min(HEARTH_RATION_FULL, Math.floor(spare / residents)));
};
// ── The seed is kept from every mouth (behind the ship) ─────────────────────
// The seed guard above chooses whether the meal at home is served, and the
// daily draw stops at the reserve; the meal itself (117) then takes up to
// eighteen of whatever the store holds, the emergency ration of a starving
// walker (30d) takes eight from any friendly store within twelve tiles, and
// the conserved rations of 30d take from the nearest place. The fallow probe
// on battery causal-origin at year 94 read Flintholl: fifteen people, nine
// fields all fallow for up to thirty-seven years, a store of 189 eaten to
// nought inside a day, and thirty sowings tried by hungry hands and every one
// refused for want of three seed. Behind the ship the seed reserve is hidden
// from every meal while it is eaten and put back after: the mouths get what
// is above it, and the fields get sown.
let hearthHiding = null;
function hearthHideSeed(place, fn) {
  if (!place || place.ruined || !place.knownProcesses || !shipHasLeft() || typeof seedReserve !== "function" || hearthHiding === place) return fn();
  const held = place.inventory[C.ORGANIC] || 0,
    hidden = Math.min(held, seedReserve(place));
  if (hidden <= 0) return fn();
  place.inventory[C.ORGANIC] -= hidden;
  const was = hearthHiding;
  hearthHiding = place;
  try {
    return fn();
  } finally {
    hearthHiding = was;
    place.inventory[C.ORGANIC] += hidden;
    HEARTH.seedHidden++;
  }
}
const performFeedingHearthBase = performFeeding;
performFeeding = function (id, tile, stride = 1) {
  if (W.kind[id] !== KINDS.PERSON || !shipHasLeft()) return performFeedingHearthBase(id, tile, stride);
  const near = typeof nearestFriendlyPlace === "function" ? nearestFriendlyPlace(id) : null,
    home = typeof homeRationPlace === "function" ? homeRationPlace(id) : null;
  return hearthHideSeed(near?.knownProcesses ? near : null, () => hearthHideSeed(home && home !== near ? home : null, () => performFeedingHearthBase(id, tile, stride)));
};
const runMetabolismHearthBase = runMetabolism;
runMetabolism = function (id, tier) {
  if (W.kind[id] !== KINDS.PERSON || !shipHasLeft() || (W.components.chemistry[id]?.q[C.ENERGY] ?? 99) >= 18) return runMetabolismHearthBase(id, tier);
  const place = typeof nearestFriendlyPlace === "function" ? nearestFriendlyPlace(id) : null;
  return hearthHideSeed(place?.knownProcesses ? place : null, () => runMetabolismHearthBase(id, tier));
};
window.ALIFE_HEARTH_DEBUG = Object.freeze({
  reach: (townId) => hearthReach(W.settlements.find((s) => s.id === townId)),
  residents: (townId) => granaryResidents(W.settlements.find((s) => s.id === townId)).length,
  draw: (townId) => hearthDraw(W.settlements.find((s) => s.id === townId)),
  hideSeed: (townId, fn) => hearthHideSeed(W.settlements.find((s) => s.id === townId), fn),
  counts: () => ({ ...HEARTH }),
});
