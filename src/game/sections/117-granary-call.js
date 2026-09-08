// ═══════════════════════════════════════════════════════════════════════════
// 117. GRANARY CALL — the hungry walk home to a fed store
// ═══════════════════════════════════════════════════════════════════════════
// A hungry person chose "food" and stepped toward whatever the ground offered
// within a tile or two; rations from the town stores reach only those within
// eight tiles of a friendly place. So a gatherer, a field hand, or a herder
// caught hungry beyond that ring on stripped late-game ground foraged outward
// and starved within sight of a granary that held food, and the famine
// diagnostics counted them one by one: far from every town, seeking food.
// Now a hungry person on barren ground whose nearest friendly town holds food
// in its stores walks toward that town instead of the next tile of scrub, and
// eats its rations on arrival. A town with an empty store still sends its
// people foraging, and a person with food underfoot eats it. Two neighbours of
// the same fault: the people of an occupied town kept their old flag and so
// were strangers to their own granary, starving beside it for years, and the
// pull of the city marched villagers into a hub whose stores were already
// bare. A person now eats at home whatever flag flies over the hall, unless
// they came as an enemy; and the hub calls no one while its stores are lean.
// And the hungry do not march: a fighter past the hunger gate is not counted
// among a polity's fieldable fighters, so a starving polity neither starts a
// war nor is marched against until it has eaten; without this, scarcity fed
// war and war fed scarcity until the towns were empty.
const GRANARY_CALL_HUNGER = 52,
  GRANARY_CALL_MARCH_HUNGER = 60,
  GRANARY_CALL_STOCK = 12,
  GRANARY_CALL_NEAR = 8,
  GRANARY_CALL_REACH = 48,
  GRANARY_CALL_GROUND = 3,
  GRANARY_CALL = { steps: 0, arrivals: 0, homeMeals: 0, homeDrinks: 0, pullsHeld: 0 };
function granaryCallPlace(id) {
  if (W.kind[id] !== KINDS.PERSON) return null;
  const l = W.components.life[id],
    p = W.components.position[id];
  if (!l || !p || l.hunger < GRANARY_CALL_HUNGER) return null;
  if (tileFood(idx(p.x, p.y), "omnivore") >= GRANARY_CALL_GROUND) return null;
  const place = nearestFriendlyPlace(id);
  if (!place || (place.inventory?.[C.ORGANIC] || 0) < GRANARY_CALL_STOCK) return null;
  const d = Math.sqrt(dist2(p.x, p.y, place.x, place.y));
  if (d <= GRANARY_CALL_NEAR || d > GRANARY_CALL_REACH) return null;
  return place;
}
// The open step that shortens the walk most.
function granaryCallStep(id, place) {
  const p = W.components.position[id];
  let best = null,
    bestD = dist2(p.x, p.y, place.x, place.y);
  for (const [dx, dy] of DIRS) {
    if (!dx && !dy) continue;
    const x = p.x + dx,
      y = p.y + dy;
    if (!inside(x, y)) continue;
    const i = idx(x, y);
    if (W.tiles.liquid[i] > WATER_DEPTH.WADE_LIMIT || W.tiles.fire[i] > 200) continue;
    if (typeof movementTileBlocked === "function" && movementTileBlocked(id, x, y)) continue;
    const d = dist2(x, y, place.x, place.y);
    if (d < bestD) {
      bestD = d;
      best = [dx, dy];
    }
  }
  return best;
}
const bestDirectionGranaryBase = bestDirection;
bestDirection = function (id, goal) {
  if (goal === "food") {
    const place = granaryCallPlace(id);
    if (place) {
      const step = granaryCallStep(id, place);
      if (step) {
        GRANARY_CALL.steps++;
        const l = W.components.life[id];
        if (l) l.behaviorReason = `walking to the stores of ${place.name}`;
        return step;
      }
    }
  }
  return bestDirectionGranaryBase(id, goal);
};
// ── Rations at home, whatever flag flies over the hall ───────────────────────
// Home first; failing that, any fed town within the ration ring that the
// person has not come to as an enemy: a neighbour of the same polity feeds a
// hungry visitor whose own store stands empty.
function homeRationPlace(id, sp = C.ORGANIC) {
  const soc = W.components.social[id],
    p = W.components.position[id];
  if (!soc || !p) return null;
  const near = GRANARY_CALL_NEAR * GRANARY_CALL_NEAR,
    hostile = (s) => typeof personIsHostileVisitor === "function" && personIsHostileVisitor(id, s.factionId),
    home = soc.homePlaceKind === "settlement" ? W.settlements.find((s) => s.id === soc.homePlaceId && !s.ruined) : null;
  if (home && dist2(p.x, p.y, home.x, home.y) <= near && !hostile(home) && (home.inventory?.[sp] || 0) > 0) return home;
  let best = null,
    bestD = near + 1;
  for (const s of W.settlements) {
    if (s.ruined || !(s.inventory?.[sp] > 0)) continue;
    const d = dist2(p.x, p.y, s.x, s.y);
    if (d > near || d >= bestD || hostile(s)) continue;
    if (soc.factionId && s.factionId && s.factionId !== soc.factionId && s !== home) continue;
    best = s;
    bestD = d;
  }
  return best;
}
const performFeedingGranaryBase = performFeeding;
performFeeding = function (id, tile, stride = 1) {
  if (performFeedingGranaryBase(id, tile, stride)) return true;
  if (W.kind[id] !== KINDS.PERSON) return false;
  const home = homeRationPlace(id);
  if (!home) return false;
  const digestive = W.components.inventory[id].digestive;
  let moved = 0;
  for (const [sp, limit] of [[C.ORGANIC, 18], [C.ENERGY, 10], [C.NUTRIENT, 8], [C.CATALYST, 2]]) {
    const amount = Math.min(limit * stride, home.inventory[sp] || 0, 65535 - digestive[sp]);
    home.inventory[sp] -= amount;
    digestive[sp] += amount;
    moved += amount;
  }
  if (!moved) return false;
  W.components.life[id].behaviorReason = `ate rations at home in ${home.name}, whatever flag flies there`;
  GRANARY_CALL.homeMeals++;
  return true;
};
const performDrinkingGranaryBase = performDrinking;
performDrinking = function (id, tile, stride = 1) {
  if (performDrinkingGranaryBase(id, tile, stride)) return true;
  if (W.kind[id] !== KINDS.PERSON) return false;
  const home = homeRationPlace(id, C.SOLVENT);
  if (!home || !home.inventory[C.SOLVENT]) return false;
  const body = W.components.chemistry[id].q,
    amount = Math.min(42 * stride, home.inventory[C.SOLVENT], 65535 - body[C.SOLVENT]);
  if (!amount) return false;
  home.inventory[C.SOLVENT] -= amount;
  body[C.SOLVENT] += amount;
  W.components.life[id].behaviorReason = `drank at home in ${home.name}, whatever flag flies there`;
  GRANARY_CALL.homeDrinks++;
  return true;
};
// ── The hub calls no one while its stores are lean ───────────────────────────
function hubStoresLean(f) {
  if (typeof urbanHub !== "function" || typeof foodOutlook !== "function") return false;
  const hub = urbanHub(f);
  if (!hub) return false;
  // Lean by the granary's own reckoning (food short or a quarter hungry), not
  // by the store alone: a fed hub often keeps its food in the fields and the
  // ground rather than the granary, and a store clause held seven pulls in ten.
  return !!foodOutlook(hub)?.lean;
}
const urbanPullGranaryBase = urbanPull;
urbanPull = function (f, force = false) {
  if (!force && hubStoresLean(f)) {
    GRANARY_CALL.pullsHeld++;
    return null;
  }
  return urbanPullGranaryBase(f, force);
};
// ── The hungry do not march ──────────────────────────────────────────────────
const factionFieldableFightersGranaryBase = factionFieldableFighters;
factionFieldableFighters = function (faction) {
  if (!faction) return 0;
  let fighters = 0;
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    if ((W.components.social[id]?.factionId || 0) !== faction.id) continue;
    const l = W.components.life[id];
    if (!l || l.hunger > GRANARY_CALL_MARCH_HUNGER || l.thirst > GRANARY_CALL_MARCH_HUNGER) continue;
    const locomotion = typeof embodiedCapability === "function" ? embodiedCapability(id).locomotion : 1;
    if (locomotion >= 0.42) fighters++;
  }
  return fighters;
};
window.ALIFE_GRANARY_CALL_DEBUG = Object.freeze({
  fieldable: (factionId) => factionFieldableFighters(W.factions.find((f) => f.id === factionId)),
  home: (id) => homeRationPlace(id)?.id || 0,
  lean: (factionId) => hubStoresLean(W.factions.find((f) => f.id === factionId)),
  place: (id) => granaryCallPlace(id)?.id || 0,
  step: (id) => {
    const place = granaryCallPlace(id);
    return place ? granaryCallStep(id, place) : null;
  },
  counts: () => ({ ...GRANARY_CALL }),
  reset: () => {
    for (const k of Object.keys(GRANARY_CALL)) GRANARY_CALL[k] = 0;
  },
});
