// ═══════════════════════════════════════════════════════════════════════════
// 137. FIELD — the field that waited for water, and the hungry hands that build it
// ═══════════════════════════════════════════════════════════════════════════
// Inside the transit press the effort carried bread to the two hungriest
// famine towns and pushed their farms, and did nothing else for the home
// world. The transit probe watched Zephyrford, a lean city of forty on the
// battery fixture, keep a planned farm at stage nought for seven years: it
// wanted sixteen of water, the town's stores held sixteen, and no hand
// touched it. Builders fetch only the rare inputs (pigment, ink, ore, crystal)
// from the stores and look for water on the ground within nine tiles of where
// they stand; and a lean town's hungry, a quarter to a half of it, are unfit
// for any labour past sixty-eight hunger, so the field that would feed them
// waits on the fed. Two things, behind the ship only:
//   • The effort supplies the waiting field. At each of the press's pushes a
//     farm that has stood unfinished two years in any town has its missing
//     common material (water, nutrient, the rigid and the flexible stuff)
//     placed at the work face, twenty-four at a time, as the push already does
//     for the two famine towns' farms; the matter is the player's input.
//   • Hungry hands build it. A resident too hungry for the labour pool but
//     still on their feet (hunger sixty-eight to ninety-two, the band the
//     granary already lets sow and reap) is wanted at a lean or famine town's
//     unfinished farm: carries its common material from the town's stores and
//     works the face without a tool, within twelve tiles, never gathering.
//   • The waiting field comes first. A farm two years planned outranks every
//     other order of its town in each hand's choice of work, so the pushed
//     skyline no longer takes every builder while the field stands stocked.
//   • The effort sows the fallow field. The fallow probe read Flintholl at
//     year 94: fifteen people, nine fields fallow for up to thirty-seven
//     years, thirty sowings tried by hungry hands and every one refused for
//     want of three seed, the store eaten to nought inside a day. At each push
//     a lean or famine town has up to two of its long-fallow fields sown from
//     the player's input, the seed, nutrient and water a sowing asks for going
//     through the store straight into the ground.
//   • The press tends the home world when it has nothing left to reach for.
//     The effort's bread, the farm pushes, the supply and the sowing all hang
//     on the concerted target, and once the colony is founded and the last
//     craft learned there is none: on battery causal-origin the pushes stopped
//     at year 105 and the world went from eighty-five to twenty-nine by 114,
//     every field fallow again. With no target, behind the ship, the press
//     feeds the famine towns and tends the fields at the same half-year beat.
//   • Hungry hands eat first. Under the concerted effort the labour tick
//     handles every person every tick, and a person it handles skips the
//     behaviour step that would have fed them (21); the granary's hungry-hands
//     rule (82) and this section's send the hungry to the fields up to hunger
//     ninety-two, so a hungry town's people sowed and reaped beside a full
//     store and starved at it: battery causal-origin at year 104 read
//     Flintholl fifteen people, a store of 189, six of seven hungry. Behind the
//     ship a person past seventy hunger with a meal to be had at home is not
//     wanted at any labour and is left to go and eat; hungry hands work the
//     fields only when there is nothing to eat.
//   • A field the town cannot walk to is given up. The ship-c A/B found Ple
//     Chyp's stocked farm untouched for twenty-five years with hungry hands
//     walking toward it a thousand ticks a year and building nothing: the
//     plot lay past ground a walker cannot cross, as the tower blocks of 128
//     once did. Only a plot the hall can reach (128's flood) is first, is
//     supplied, or is built by hungry hands; one it cannot reach, two years
//     planned, falls to rubble and the next is sited on open ground the town
//     can walk to.
const FIELD_WAIT = TICKS_PER_YEAR * 2,
  FIELD_FACE = 24,
  FIELD_CARRY = 8,
  FIELD_HANDS_HUNGER = 92,
  FIELD_FIRST = 200,
  FIELD_HANDS_REACH = 12,
  FIELD_SOW_REST = 64,
  FIELD_SOW_PER_PUSH = 2,
  FIELD_MEAL_HUNGER = 70,
  FIELD = {
    supplied: 0,
    drawn: 0,
    carried: 0,
    built: 0,
    hands: 0,
    first: 0,
    givenUp: 0,
    resited: 0,
    sown: 0,
    tended: 0,
    sentToEat: 0,
  };
function fieldCommon(sp) {
  return (
    sp >= 0 && !(typeof STORE_DRAWN_MATERIALS !== "undefined" && STORE_DRAWN_MATERIALS.includes(sp))
  );
}
function fieldUnfinished(place) {
  if (!place?.knownProcesses || place.ruined) return null;
  return (
    W.buildings
      .filter(
        (b) =>
          !b.ruined &&
          !b.complete &&
          b.placeKind === "settlement" &&
          b.placeId === place.id &&
          b.type === "farm",
      )
      .sort((a, b) => (a.createdTick || 0) - (b.createdTick || 0) || a.id - b.id)[0] || null
  );
}
function fieldWaiting(place) {
  const b = fieldUnfinished(place);
  return b && W.tick - (b.createdTick || 0) >= FIELD_WAIT ? b : null;
}
// A plot the hall can walk to, by the open ground's flood (128); a plot past
// the flood's reach is taken as reachable, since the flood cannot say.
function fieldReachable(place, b) {
  if (!place || !b || typeof openGroundPlotReachable !== "function") return true;
  const reach = typeof OPEN_GROUND_REACH === "number" ? OPEN_GROUND_REACH : 26;
  if (Math.max(Math.abs(b.x - place.x), Math.abs(b.y - place.y)) > reach) return true;
  return openGroundPlotReachable(place, b.x, b.y);
}
// ── A field the town cannot walk to is given up ──────────────────────────────
function fieldGiveUp(place) {
  const b = fieldWaiting(place);
  if (!b || fieldReachable(place, b) || typeof collapseBuilding !== "function") return false;
  collapseBuilding(b, "planned past ground the town could not cross");
  FIELD.givenUp++;
  return true;
}
const plannedBuildingTileFieldBase = plannedBuildingTile;
plannedBuildingTile = function (place, type, ordinal) {
  const plot = plannedBuildingTileFieldBase(place, type, ordinal);
  if (
    type !== "farm" ||
    !plot ||
    !place?.knownProcesses ||
    !shipHasLeft() ||
    typeof openGroundPlotReachable !== "function"
  )
    return plot;
  if (openGroundPlotReachable(place, plot[0], plot[1])) return plot;
  const open = typeof openGroundPlot === "function" ? openGroundPlot(place, "farm") : null;
  if (open) FIELD.resited++;
  return open;
};
// ── The effort supplies the waiting field ────────────────────────────────────
function fieldSupply(place) {
  const b = fieldWaiting(place);
  if (!b || typeof missingBuildingMaterial !== "function" || !fieldReachable(place, b)) return 0;
  let placed = 0;
  for (let guard = 0; guard < 3; guard++) {
    const missing = missingBuildingMaterial(b);
    if (!missing || !fieldCommon(missing.sp)) break;
    const amount = Math.min(missing.needed, FIELD_FACE, 65535 - (b.composition[missing.sp] || 0));
    if (amount <= 0) break;
    b.composition[missing.sp] += amount;
    causalPushInput(amount);
    placed += amount;
    if (amount < missing.needed) break;
  }
  if (placed) {
    refreshBuildingStage(b);
    FIELD.supplied += placed;
  }
  return placed;
}
// ── The effort sows the fallow field ─────────────────────────────────────────
function fieldSow(place) {
  if (
    !place?.knownProcesses ||
    place.ruined ||
    !shipHasLeft() ||
    typeof sowCultivatedField !== "function" ||
    typeof cultivatedField !== "function"
  )
    return 0;
  const outlook = foodOutlook(place);
  if (!outlook || !(outlook.lean || outlook.famine)) return 0;
  const sower = W.activeIds.find(
    (id) =>
      W.kind[id] === KINDS.PERSON &&
      classifyAlive(id) &&
      W.components.social[id]?.homePlaceKind === "settlement" &&
      W.components.social[id].homePlaceId === place.id &&
      W.components.position[id],
  );
  if (sower === undefined) return 0;
  let sown = 0;
  for (const b of completedBuildings(place, "farm")) {
    if (sown >= FIELD_SOW_PER_PUSH) break;
    const field = cultivatedField(b);
    if (!field || field.stage !== "fallow" || W.tick - (field.lastLaborTick || 0) < FIELD_SOW_REST)
      continue;
    const tiles = field.tiles?.length ? field.tiles : [field.tile],
      n = tiles.length;
    let given = 0;
    for (const [sp, amount] of [
      [C.ORGANIC, n],
      [C.NUTRIENT, n],
      [C.SOLVENT, n * 2],
    ]) {
      const add = Math.min(amount, 65535 - (place.inventory[sp] || 0));
      place.inventory[sp] = (place.inventory[sp] || 0) + add;
      given += add;
    }
    causalPushInput(given);
    if (sowCultivatedField(sower, field, place)) {
      sown++;
      FIELD.sown++;
    }
  }
  return sown;
}
function fieldSupplyAll() {
  if (!W?.settlements || !shipHasLeft()) return 0;
  let placed = 0;
  for (const s of W.settlements) {
    if (fieldGiveUp(s)) continue;
    placed += fieldSupply(s);
    fieldSow(s);
  }
  return placed;
}
const causalPushTowardFieldBase = causalPushToward;
causalPushToward = function (target = causalTarget()) {
  const out = causalPushTowardFieldBase(target);
  fieldSupplyAll();
  return out;
};
// ── The press tends the home world when it has nothing left to reach for ────
function fieldTend() {
  if (!W?.settlements || !shipHasLeft()) return 0;
  let done = 0;
  if (typeof modernFeedTheEffort === "function") done += modernFeedTheEffort(1) || 0;
  done += fieldSupplyAll();
  FIELD.tended++;
  return done;
}
const causalSkipStepFieldBase = causalSkipStep;
causalSkipStep = function (state) {
  const out = causalSkipStepFieldBase(state);
  if (!state.done && W.tick % 128 === 64 && !causalTarget() && shipHasLeft()) fieldTend();
  return out;
};
// ── Hungry hands build it ────────────────────────────────────────────────────
function fieldHandsFit(id) {
  if (W.kind[id] !== KINDS.PERSON || !shipHasLeft()) return null;
  const life = W.components.life[id],
    q = W.components.chemistry[id]?.q;
  if (
    !life ||
    !q ||
    life.hunger <= 68 ||
    life.hunger > FIELD_HANDS_HUNGER ||
    life.thirst > 80 ||
    q[C.ENERGY] < 20
  )
    return null;
  const place = nearestFriendlyPlace(id);
  if (!place?.knownProcesses) return null;
  const b = fieldUnfinished(place);
  if (!b || !fieldReachable(place, b)) return null;
  const p = W.components.position[id];
  if (!p || dist2(p.x, p.y, b.x, b.y) > FIELD_HANDS_REACH * FIELD_HANDS_REACH) return null;
  const outlook = foodOutlook(place);
  if (!outlook || !(outlook.lean || outlook.famine)) return null;
  return { place, b };
}
function fieldBuild(id, place, b) {
  const p = W.components.position[id];
  if (!p || !b || b.complete || b.ruined) return false;
  const site = idx(b.x, b.y),
    missing = missingBuildingMaterial(b);
  if (missing) {
    const sp = missing.sp,
      inv = W.components.inventory[id]?.materials;
    if (!inv || !fieldCommon(sp)) return false;
    const name = W.definitions.species[sp].name;
    if (inv[sp] > 0) {
      if (dist2(p.x, p.y, b.x, b.y) > 2)
        return moveWorkerToward(
          id,
          site,
          "haul",
          `hungry hands carrying ${name} to ${b.name}`,
          sp,
          b.id,
          0,
        );
      const amount = Math.min(
        inv[sp],
        missing.needed,
        FIELD_CARRY,
        65535 - (b.composition[sp] || 0),
      );
      if (amount <= 0) return false;
      inv[sp] -= amount;
      b.composition[sp] += amount;
      W.civicMetrics.delivered += amount;
      refreshBuildingStage(b);
      FIELD.carried += amount;
      setWorkAction(id, "haul", `placed ${amount} ${name} at the ${b.name}`, site, sp, b.id, 0);
      return true;
    }
    // The town's own stores, which the labour pool never draws common material from; never the bread.
    const stocked = sp === C.ORGANIC ? 0 : place.inventory[sp] || 0;
    if (stocked > 0) {
      const store = idx(place.x, place.y);
      if (dist2(p.x, p.y, place.x, place.y) > 4)
        return moveWorkerToward(
          id,
          store,
          "haul",
          `fetching ${name} from the stores of ${place.name} for the ${b.name}`,
          sp,
          b.id,
          0,
        );
      const amount = Math.min(stocked, missing.needed, FIELD_CARRY, 65535 - inv[sp]);
      if (amount <= 0) return false;
      place.inventory[sp] -= amount;
      inv[sp] += amount;
      FIELD.drawn += amount;
      setWorkAction(
        id,
        "haul",
        `drew ${amount} ${name} from the stores for the ${b.name}`,
        store,
        sp,
        b.id,
        0,
      );
      return true;
    }
    // Hungry hands do not go gathering: the ground is the fed hands' and the effort's to find.
    return false;
  }
  if (dist2(p.x, p.y, b.x, b.y) > 2)
    return moveWorkerToward(
      id,
      site,
      "build",
      `hungry hands moving to the ${b.name} work face`,
      -1,
      b.id,
      0,
    );
  const effort =
    3 *
    (typeof constructionTempoFactor === "function" ? constructionTempoFactor(place) : 1) *
    (settledPace() ? 4 + 2 * settledPace() : 1);
  b.workDone = Math.min(b.workRequired, b.workDone + effort);
  W.civicMetrics.constructionWork += effort;
  FIELD.built += effort;
  refreshBuildingStage(b);
  setWorkAction(id, "build", `hungry hands raising ${b.name}`, site, -1, b.id, 0);
  return true;
}
// The labour tick asks whether hungry hands are wanted before it sends anyone
// to work; the granary's fields, and now the unfinished farm.
// A meal to be had at home comes before any labour for the hungry.
function fieldMealFirst(id) {
  if (W.kind[id] !== KINDS.PERSON || !shipHasLeft() || typeof homeRationPlace !== "function")
    return false;
  const life = W.components.life[id];
  if (!life || life.hunger <= FIELD_MEAL_HUNGER) return false;
  if (!homeRationPlace(id)) return false;
  FIELD.sentToEat++;
  return true;
}
const hungryHandsWantedFieldBase =
  typeof hungryHandsWanted === "function" ? hungryHandsWanted : () => false;
hungryHandsWanted = function (id, place) {
  if (fieldMealFirst(id)) return false;
  if (hungryHandsWantedFieldBase(id, place)) return true;
  const fit = fieldHandsFit(id);
  return !!fit && fit.place === place;
};
const performCivilLaborFieldBase = performCivilLabor;
performCivilLabor = function (id) {
  if (fieldMealFirst(id)) {
    if (typeof clearStaleWork === "function") clearStaleWork(id);
    return false;
  }
  const fit = fieldHandsFit(id);
  if (!fit) return performCivilLaborFieldBase(id);
  // The granary's own hungry-hands rule first: a ripe or fallow field is the nearer meal.
  if ((W.tick + id) % 2 === 0 && performCivilLaborFieldBase(id)) return true;
  if (fieldBuild(id, fit.place, fit.b)) {
    FIELD.hands++;
    return true;
  }
  return false;
};
// ── The waiting field comes first ────────────────────────────────────────────
// Every hand in a town takes the one order that scores highest, and the
// effort plans its blocks at priority nine: the stocked-farm probe read
// Needleford at year fifty-nine, eleven fed people, a farm two years planned
// and fully stocked at stage two, and every one of them choosing the tower
// block (scores 184 to 209 against the farm's 92 to 110). The farm stood so,
// stocked and untouched, for forty-five years while the town went hungry.
// Behind the ship a farm that has waited two years outranks every other order
// of its town.
const orderPriorityFieldBase = orderPriority;
orderPriority = function (order, place, id) {
  const score = orderPriorityFieldBase(order, place, id);
  if (!order || order.type === "salvage" || !place?.knownProcesses || !shipHasLeft()) return score;
  const b = buildingById(order.buildingId);
  if (
    !b ||
    b.type !== "farm" ||
    b.complete ||
    b.ruined ||
    W.tick - (b.createdTick || 0) < FIELD_WAIT ||
    !fieldReachable(place, b)
  )
    return score;
  FIELD.first++;
  return score + FIELD_FIRST;
};
window.ALIFE_FIELD_DEBUG = Object.freeze({
  unfinished: (townId) => fieldUnfinished(W.settlements.find((s) => s.id === townId)),
  waiting: (townId) => fieldWaiting(W.settlements.find((s) => s.id === townId)),
  supply: (townId) => fieldSupply(W.settlements.find((s) => s.id === townId)),
  supplyAll: () => fieldSupplyAll(),
  reachable: (townId) => {
    const s = W.settlements.find((x) => x.id === townId),
      b = fieldUnfinished(s);
    return b ? fieldReachable(s, b) : null;
  },
  giveUp: (townId) => fieldGiveUp(W.settlements.find((s) => s.id === townId)),
  sow: (townId) => fieldSow(W.settlements.find((s) => s.id === townId)),
  tend: () => fieldTend(),
  mealFirst: (id) => fieldMealFirst(id),
  fit: (id) => fieldHandsFit(id),
  build: (id) => {
    const fit = fieldHandsFit(id);
    return fit ? fieldBuild(id, fit.place, fit.b) : false;
  },
  counts: () => ({ ...FIELD }),
});
