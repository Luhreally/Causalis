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
// passed over, and the next town gets the effort.
//
// And a town with no room makes room. On the same world at year 200 the
// second-city candidate was Yats, thirty-seven people in twenty-eight
// buildings on a walkable pocket of 113 tiles, every one of them built on or
// water or rock, with 193 clear tiles beyond that no one there could walk to;
// it wanted a Civic hall, and the world stood at the gate to year 466. When a
// town cannot site a hall or a clinic its stage wants anywhere it can reach,
// it pulls down a lesser building for the ground, a monument first, then a
// totem, a shrine, a wall, a second stockpile, and the rubble is salvaged as
// rubble already is when a plot is missing (30a queues it); one at a time,
// the next only when the last is cleared, and never a house, a field, a
// workshop or a hall. FIELD_GATES counts the crossings the rule allowed a
// person, the towns the effort passed over, and the buildings pulled down.
const FIELD_GATES = { crossed: 0, passedOver: 0, pulledDown: 0 };
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
// The launch tower too. The thirty phone seeds of section 19 flew four worlds
// late, at 188 to 237, and the site probe read two of them at year 140: the
// launch site knew every craft but Starflight, held its notes at 85.5 of 90,
// the cap the effort holds until the facility stands, and had no launch tower
// planned at all, its siting handing back nothing on a full coast, for fifty
// years, until the world halved and the site moved to a town with room. A
// city makes room for its launch tower as for its hall: the lesser buildings
// first, and if none stands, a tower block, an office or an apartment block,
// since the skyline the gate asks of a full city is the skyline that stands.
const MODERN_CITY_STAGE_TYPES = Object.freeze(["hall", "clinic", "shelter", "workshop", "farm"]),
  ROOM_WANTED_FOR = new Set(["hall", "clinic", "launch_tower"]),
  ROOM_SACRIFICE = Object.freeze(["monument", "totem", "shrine", "wall", "stockpile"]),
  ROOM_SACRIFICE_FOR_TOWER = Object.freeze([...ROOM_SACRIFICE, "tower", "office", "tenement"]);
function roomSacrificesFor(type) {
  return type === "launch_tower" ? ROOM_SACRIFICE_FOR_TOWER : ROOM_SACRIFICE;
}
function townRubbleLeft(town) {
  return W.buildings.some((b) => b.ruined && b.placeKind === "settlement" && b.placeId === town.id && ruinRubble(b) > 0);
}
function makeRoomFor(town, type) {
  if (!town?.knownProcesses || !ROOM_WANTED_FOR.has(type) || townRubbleLeft(town)) return false;
  // A plan of the kind already open is room enough; this is for a town whose siting hands back nothing.
  if (W.buildings.some((b) => !b.ruined && !b.complete && b.placeKind === "settlement" && b.placeId === town.id && b.type === type)) return false;
  for (const kind of roomSacrificesFor(type)) {
    const standing = completedBuildings(town, kind);
    if (!standing.length || (kind === "stockpile" && standing.length < 2)) continue;
    const b = standing.slice().sort((a, c) => dist2(a.x, a.y, town.x, town.y) - dist2(c.x, c.y, town.x, town.y) || a.id - c.id)[0];
    collapseBuilding(b, `pulled down to make room for the ${BUILDING_DEFS[type]?.name || type}`);
    queueRuinSalvage(town);
    FIELD_GATES.pulledDown++;
    return true;
  }
  return false;
}
function fieldGatesPushCity(town, pushes) {
  let pushed = 0;
  for (const type of MODERN_CITY_STAGE_TYPES) {
    if (completedBuildings(town, type).length) continue;
    if (causalPushBuilding(town, type, pushes)) pushed++;
    else if (makeRoomFor(town, type)) pushed++;
  }
  if (completedBuildings(town).length < 8 && causalPushBuilding(town, "shelter", pushes)) pushed++;
  return pushed;
}
// The effort's two paths to a launch tower both hand back nothing when the
// site has no plot: the research push plans the facility a study wants (79)
// and the launch push supplies the tower (114). Either way, the site makes room.
const causalPushBuildingFieldGatesBase = causalPushBuilding;
causalPushBuilding = function (place, type, pushes) {
  const pushed = causalPushBuildingFieldGatesBase(place, type, pushes);
  if (!pushed && type === "launch_tower" && place?.knownProcesses) return makeRoomFor(place, type);
  return pushed;
};
const modernSupplyFieldGatesBase = modernSupply;
modernSupply = function (place, type, pushes) {
  const supplied = modernSupplyFieldGatesBase(place, type, pushes);
  if (!supplied && type === "launch_tower" && place?.knownProcesses) return makeRoomFor(place, type);
  return supplied;
};
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
// ── The road the ground allows ───────────────────────────────────────────────
// The modern world's last want is a paved road or rail between two towns
// (114), laid along a land corridor (88) or, when there is none, ferried
// across the water (136). Variety-19 under the room-making above had its
// second city and its current by year 206 and stood on that one want to year
// 466: its two towns, Yats at the map's western edge and Tsyaiakhhya
// thirty-seven tiles east, both knowing Road Building, had no land corridor
// between them under either flag or none, and no sea corridor either; the
// enclave Yats stands in is walled by water and rock on every side, so no
// road and no ferry could ever join them, and the world asked for one for
// ever. A world asks of itself only what its ground allows: when no two
// living towns can be joined by any corridor, the road is not wanted, and the
// gate closes on everything else. Read once a tick at most, the way the
// hall's flood is.
const ROAD_CORRIDOR = { world: null, tick: -1, joinable: true, checked: 0 };
function modernTownsJoinable() {
  if (ROAD_CORRIDOR.world === W && ROAD_CORRIDOR.tick === W.tick) return ROAD_CORRIDOR.joinable;
  const towns = worldTowns();
  let joinable = false;
  for (let i = 0; i < towns.length && !joinable; i++)
    for (let j = i + 1; j < towns.length && !joinable; j++) {
      const a = towns[i],
        b = towns[j],
        d = Math.sqrt(dist2(a.x, a.y, b.x, b.y));
      if (d < 4 || d > ROAD_LINK_REACH) continue;
      const from = idx(a.x, a.y);
      if (
        civilPathFind(from, b, a.factionId || 0, "land").length >= 2 ||
        civilPathFind(from, b, 0, "land").length >= 2 ||
        civilPathFind(from, b, a.factionId || 0, "sea").length >= 2
      )
        joinable = true;
    }
  ROAD_CORRIDOR.world = W;
  ROAD_CORRIDOR.tick = W.tick;
  ROAD_CORRIDOR.joinable = joinable;
  ROAD_CORRIDOR.checked++;
  return joinable;
}
const modernLinkFieldGatesBase = modernLink;
modernLink = function () {
  if (modernLinkFieldGatesBase()) return true;
  // With fewer than two towns there is nothing to join, once the world has a city to ask it of; a young world
  // is still asked its road, and the gate's other wants say why.
  if (worldTowns().length < 2) return modernCities().length > 0;
  return !modernTownsJoinable();
};
// ── The towns the world has ──────────────────────────────────────────────────
// The gate wants two cities and current in two towns (114). Variety-22 in the
// thirty-seed sweep stood at that gate from year 110 to 409, forty presses and
// all: the second-town probe at year 200 read one living town in the world,
// Nga-pruap, the launch site, twenty-three people in eighty buildings, city,
// current and every craft known, and fifty people more in no town at all; the
// effort's push for a second city had no town to work on and passed over
// nothing for three hundred pushes. A world of one town is asked one city and
// current in one town, as a world of no corridor is asked no road; the people
// the gate wants in towns, its skyline, its works and the ship's own city are
// asked as before. The bound holds only once the world has a city: a young
// world of one village is still asked two, as the scale test asserts, since
// its second town is still to come.
function modernTownsBound(want) {
  const towns = worldTowns().length;
  if (!towns || towns >= want || !modernCities().length) return want;
  return Math.max(1, towns);
}
const modernCitiesWantedTownsBase = modernCitiesWanted;
modernCitiesWanted = function () {
  return modernTownsBound(modernCitiesWantedTownsBase());
};
const modernElectricWantedTownsBase = modernElectricWanted;
modernElectricWanted = function () {
  return modernTownsBound(modernElectricWantedTownsBase());
};
// ── The skyline the ground allows ────────────────────────────────────────────
// The modern gate wants a skyline of fourteen to nineteen tower blocks or
// offices and five or six apartment blocks, swayed by the seed (114), and the
// effort raises them at the cities. The thirty-seed battery sweep left
// variety-20 at year 227 fourteen blocks short with 64 people and variety-21
// at 445 short of blocks and apartments with 69, and the skyline probe read
// both at year 150: no city could site a tower, a tenement or a factory by its
// own siting or on the open ground, and of the tiles within twenty-six of
// variety-20's three towns 991, 1,106 and 962 were water, 851, 789 and 599
// were built on, and none was left; the towns stand on a coast that is nine
// tenths sea within reach, and every dry tile they can walk to carries a
// building. The effort pushed the skyline for a hundred years at towns that
// had nowhere to put it. A world asks of itself only what its ground allows:
// when no city can site another block of a kind, the want for that kind is
// what stands and what is already planned, and the gate closes on the rest.
// The room is a function of the buildings that stand, are planned or lie in
// ruin, and of the ground, which drifts by the year; it is kept beside the
// world, keyed on those counts and the year, so reading it writes nothing to
// the world (the plain-words test holds the reasons to that) and a saved game
// reads the same answer for the same buildings.
const BLOCK_ROOM = { world: null, key: "", kinds: {} };
function modernCityRoomFor(type) {
  let planned = 0,
    complete = 0,
    ruined = 0;
  for (const b of W.buildings) {
    if (b.ruined) ruined++;
    else if (b.complete) complete++;
    else planned++;
  }
  const key = planned + ":" + complete + ":" + ruined + ":" + Math.floor(W.tick / TICKS_PER_YEAR);
  if (BLOCK_ROOM.world !== W || BLOCK_ROOM.key !== key) {
    BLOCK_ROOM.world = W;
    BLOCK_ROOM.key = key;
    BLOCK_ROOM.kinds = {};
  }
  if (type in BLOCK_ROOM.kinds) return BLOCK_ROOM.kinds[type];
  let found = false;
  for (const city of modernCities()) {
    const ordinal = W.buildings.filter((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === city.id).length;
    if (plannedBuildingTile(city, type, ordinal)) {
      found = true;
      break;
    }
  }
  BLOCK_ROOM.kinds[type] = found;
  return found;
}
function modernPlannedCount(types) {
  let n = 0;
  for (const b of W.buildings) if (!b.ruined && !b.complete && b.placeKind === "settlement" && types.includes(b.type)) n++;
  return n;
}
const modernSkylineWantedGroundBase = modernSkylineWanted;
modernSkylineWanted = function () {
  const want = modernSkylineWantedGroundBase(),
    standing = modernCount(["tower", "office"]);
  if (standing >= want || !modernCities().length) return want;
  if (modernCityRoomFor("tower") || modernCityRoomFor("office")) return want;
  FIELD_GATES.skylineBounded = (FIELD_GATES.skylineBounded || 0) + 1;
  return Math.max(1, standing + modernPlannedCount(["tower", "office"]));
};
const modernHomesWantedGroundBase = modernHomesWanted;
modernHomesWanted = function () {
  const want = modernHomesWantedGroundBase(),
    standing = modernCount(["tenement"]);
  if (standing >= want || !modernCities().length) return want;
  if (modernCityRoomFor("tenement")) return want;
  FIELD_GATES.homesBounded = (FIELD_GATES.homesBounded || 0) + 1;
  return Math.max(1, standing + modernPlannedCount(["tenement"]));
};
// ── A world whose towns have fallen founds again ─────────────────────────────
// Once the modern stages are sought and the effort is on, the world founds
// nothing new (127): the ship wants two cities, not five hamlets. That rule
// never allowed for a world whose towns fall. The founding probe read
// variety-22 in the thirty-seed sweep: four towns of 22, 25, 3 and 3 at year
// 53, three of them destroyed by year 114 with thirty to forty-five people
// living in no town at all for sixty years, the world "with no room for
// places" the whole time because the effort was on, and one town left. A
// world with fewer living towns than the gate's cities want, or with a quarter
// of its people homeless, founds again; a world whose towns hold its people
// founds nothing, as before. FIELD_GATES.refounded counts the reads that
// opened the ground.
const HOMELESS_SHARE = 0.25;
function worldTownsFallen() {
  const towns = worldTowns().length,
    wanted = typeof modernCitiesWantedTownsBase === "function" ? modernCitiesWantedTownsBase() : 2;
  if (towns < wanted) return true;
  let people = 0,
    homeless = 0;
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    people++;
    const h = W.components.social[id]?.homePlaceKind;
    if (h !== "settlement" && h !== "camp") homeless++;
  }
  return people >= 8 && homeless >= people * HOMELESS_SHARE;
}
const worldHasRoomForPlacesFieldGatesBase = worldHasRoomForPlaces;
worldHasRoomForPlaces = function () {
  if (worldHasRoomForPlacesFieldGatesBase()) return true;
  if (!W?.settlements || typeof worldHasRoomForPlacesManyHandsBase !== "function" || !worldTownsFallen()) return false;
  const room = worldHasRoomForPlacesManyHandsBase();
  if (room) FIELD_GATES.refounded = (FIELD_GATES.refounded || 0) + 1;
  return room;
};
window.ALIFE_FIELD_GATES_DEBUG = Object.freeze({
  counts: () => ({ ...FIELD_GATES }),
  joinable: () => modernTownsJoinable(),
  fallen: () => worldTownsFallen(),
  roomFor: (type) => modernCityRoomFor(type),
  corridorChecks: () => ROAD_CORRIDOR.checked,
  makeRoom: (placeId, type = "hall") => makeRoomFor(W.settlements.find((s) => s.id === placeId), type),
  fieldAt: (x, y) => fieldAtMovementTile(x, y)?.id || 0,
  candidates: () => {
    const cities = modernCities();
    return worldTowns()
      .filter((s) => !cities.includes(s))
      .sort((a, b) => settlementPopulation(b) - settlementPopulation(a) || a.id - b.id)
      .map((s) => ({ id: s.id, name: s.name, pop: settlementPopulation(s), stage: s.stage }));
  },
});
