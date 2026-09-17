// ═══════════════════════════════════════════════════════════════════════════
// 138. FIELD GATES — a townsperson crosses a field, and the effort builds
//      its second city where there is room
// ═══════════════════════════════════════════════════════════════════════════
// A field is a solid body three tiles square (42e): nobody steps on any of
// its nine tiles, and the flood that says what ground a town can walk to
// (128) stops at its hedge. That is right for a herd, which the hedge is
// for, and wrong for the people who planted it: a field has a gate. The
// thirty-seed battery sweep (HANDOFF section 17) read what the wall of fields
// costs. Variety-19's second-city candidate at year 130, Wiliiakhhya, nineteen
// people and a village, wanted a Civic hall to be anything more, and the
// ground its hall could be reached from was two tiles: six fields stood on
// the eight tiles round the town's centre, so the flood was two tiles, the
// effort's push for a second city asked the town for a hall every hundred and
// twenty-eight ticks and was handed nothing, and the world stood at the
// modern gate. A person now walks across a field as across any ground (the
// cliff rule of 96 still holds), a herd or a hunter still does not, and the
// flood of 128 walks the same way.
//
// The gate alone was measured first, and it starved the phone worlds: with a
// field open to anyone, a hungry person's search for food found the richest
// tiles in reach, the standing crops, walked onto them and ate them as
// forage, and the harvest that would have filled the store was gone before it
// ripened. Phone variety-8 buried 63 in its sixties, 58 of them starved, where
// the code before had buried seven; phone variety-3 buried 76 in its eighties
// and nineties, 50 starved, where it had buried 25; the same decades on two
// press schedules, so the road and not the press. A person crossing a field
// does not graze it: to a person's appetite a standing field holds no food
// (tileFood, "omnivore"), so nobody seeks the crops and nobody eats them, and
// the field is the harvest's, as it was when its hedge kept everyone out.
// Grazers read a field as before, and cannot enter it anyway.
//
// The effort also chose its second city as the largest town that was not one,
// and stayed with it however little it could do there: on the same world the
// candidate could site nothing, and on variety-9 the candidate's clinic was
// planned where nobody could walk. Now the push for a second city tries the
// towns in order of size and works on the first where it can plan or supply
// anything the stage still wants; a town where every want is unplannable is
// passed over, and the next town gets the effort. FIELD_GATES counts the
// crossings the rule allowed a person and the towns the effort passed over.
const FIELD_GATES = { crossed: 0, passedOver: 0 };
function fieldAtMovementTile(x, y) {
  const b = typeof standingBuildingAtMovementTile === "function" ? standingBuildingAtMovementTile(x, y) : null;
  return b && b.type === "farm" ? b : null;
}
const movementTileBlockedFieldGatesBase = movementTileBlocked;
movementTileBlocked = function (id, x, y) {
  if (W.kind[id] === KINDS.PERSON && fieldAtMovementTile(x, y)) {
    const p = W.components.position[id];
    if (typeof terrainStepBlocked === "function" && p && terrainStepBlocked(id, p.x, p.y, x, y)) return true;
    FIELD_GATES.crossed++;
    return false;
  }
  return movementTileBlockedFieldGatesBase(id, x, y);
};
const constrainDevelopedMovementFieldGatesBase = constrainDevelopedMovement;
constrainDevelopedMovement = function (id, proposedX, proposedY) {
  if (W.kind[id] === KINDS.PERSON && fieldAtMovementTile(proposedX, proposedY)) {
    const life = W.components.life[id];
    if (life?.insideBuildingId) life.insideBuildingId = 0;
    return { x: proposedX, y: proposedY };
  }
  return constrainDevelopedMovementFieldGatesBase(id, proposedX, proposedY);
};
// A standing field holds no food for a person's appetite.
const tileFoodFieldGatesBase = tileFood;
tileFood = function (i, metabolism = "grazer") {
  if (metabolism === "omnivore" && W?.buildings?.length && i >= 0 && i < W.tileCount) {
    const [x, y] = xy(i);
    if (fieldAtMovementTile(x, y)) return 0;
  }
  return tileFoodFieldGatesBase(i, metabolism);
};
// ── The second city is built where there is room ─────────────────────────────
const MODERN_CITY_STAGE_TYPES = Object.freeze(["hall", "clinic", "shelter", "workshop", "farm"]);
function fieldGatesPushCity(town, pushes) {
  let pushed = 0;
  for (const type of MODERN_CITY_STAGE_TYPES)
    if (!completedBuildings(town, type).length && causalPushBuilding(town, type, pushes)) pushed++;
  if (completedBuildings(town).length < 8 && causalPushBuilding(town, "shelter", pushes)) pushed++;
  return pushed;
}
const modernPushFieldGatesBase = modernPush;
modernPush = function (key, pushes) {
  if (key !== "cities") return modernPushFieldGatesBase(key, pushes);
  const towns = worldTowns().sort((a, b) => settlementPopulation(b) - settlementPopulation(a) || a.id - b.id),
    cities = modernCities(),
    candidates = towns.filter((s) => !cities.includes(s));
  if (!towns.length) return null;
  if (!candidates.length) return modernPushFieldGatesBase(key, pushes);
  for (const town of candidates) {
    if (fieldGatesPushCity(town, pushes) > 0) return "cities";
    FIELD_GATES.passedOver++;
  }
  return "cities";
};
window.ALIFE_FIELD_GATES_DEBUG = Object.freeze({
  counts: () => ({ ...FIELD_GATES }),
  fieldAt: (x, y) => fieldAtMovementTile(x, y)?.id || 0,
  candidates: () => {
    const cities = modernCities();
    return worldTowns()
      .filter((s) => !cities.includes(s))
      .sort((a, b) => settlementPopulation(b) - settlementPopulation(a) || a.id - b.id)
      .map((s) => ({ id: s.id, name: s.name, pop: settlementPopulation(s), stage: s.stage }));
  },
});
