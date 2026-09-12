// ═══════════════════════════════════════════════════════════════════════════
// 114. THE MODERN WORLD — skylines, works, roads, and countryside before the stars
// ═══════════════════════════════════════════════════════════════════════════
// One city with one tower and one factory could send a ship to the stars while
// the rest of the world was villages, and the Causal skip drove straight for
// that ship. A world that leaves for the stars now has to look like one that
// could: two cities at the urban stage, current in three towns, three tower
// blocks or offices, two working factories, a paved road or rail between two
// towns, and a hundred people living in towns, counted across the whole world,
// since a modern world is not one polity's. The Causal skip builds those
// before it reaches for Starflight, raising the second city's civic buildings,
// pushing current into the villages and towers and works into the cities,
// laying the road through the craft that lays roads, and planting the fields
// that let a hundred people live; it never forces births, which a long skip
// turned into famine and war. Skylines grow denser (a tower block
// for every eighteen people, an office for every twenty), and the countryside
// gains its own detail: hedgerows along the fields, hay bales in the fall, a
// scarecrow here and there, and windmills turning over the farms of a people
// that knows the mill. Rendering only reads.
const MODERN_CITIES = 2,
  MODERN_ELECTRIC_TOWNS = 3,
  MODERN_SKYLINE = 28,
  MODERN_HOMES = 12,
  MODERN_WORKS = 2,
  MODERN_PEOPLE = 100,
  MODERN_CITIES_FLOOR = 2,
  MODERN_ELECTRIC_FLOOR = 2,
  MODERN_SKYLINE_FLOOR = 16,
  MODERN_HOMES_FLOOR = 6,
  MODERN_WORKS_FLOOR = 1,
  MODERN_PEOPLE_MIN = 12,
  MODERN_TOWER_PER_PEOPLE = 18,
  MODERN_OFFICE_PER_PEOPLE = 20,
  MODERN_ROAD_STONE = 48,
  MODERN_ROAD_PASSES = 4,
  MODERN_STAGE_KEYS = Object.freeze(["cities", "current", "skyline", "homes", "works", "road", "hundred"]),
  MODERN_LAUNCH_KEYS = new Set(["starflight", "tower", "ascension"]),
  MODERN = { hedgerows: 0, hay: 0, scarecrows: 0, windmills: 0 };
// Fixtures that test the ship itself may waive the modern world; play never does.
let MODERN_WAIVED = false;
// The modern world is counted across every living town; the polity is kept
// only for the roads it can lay.
function polityTownsOf(f) {
  return W.settlements.filter((s) => !s.ruined && s.knownProcesses && (!f || s.factionId === f.id));
}
function worldTowns() {
  return polityTownsOf(null);
}
function modernCities() {
  return worldTowns().filter((s) => typeof cityStage === "function" && cityStage(s));
}
function modernCount(types) {
  let n = 0;
  for (const s of worldTowns()) for (const t of types) n += completedBuildings(s, t).length;
  return n;
}
function modernElectricTowns() {
  return worldTowns().filter((s) => s.knownProcesses.includes("electricity")).length;
}
function modernLink() {
  return (W.roads?.links || []).some((l) => l.complete);
}
// A road is only ever laid between two towns under one flag, and on a small
// world the towns never gather into one. Measured on a battery-saver world at
// year ninety-eight: four towns, four factions, one town each, twenty-one to
// fifty-one tiles apart and every pair well within reach, one of them knowing
// the craft, and not one of them able to pave anything. The world stood a
// single requirement short of its ship for ten presses. A road between
// neighbours is still a road, so the effort that carries the stone carries it
// across a border too.
function modernRoadBetweenStrangers(pushes) {
  if (typeof startRoadLink !== "function" || typeof paveLink !== "function") return false;
  const towns = worldTowns();
  if (towns.length < 2 || !towns.some((s) => s.knownProcesses.includes("road_building")))
    return false;
  if (typeof ensureRoads === "function") ensureRoads();
  let link = (W.roads?.links || []).find((l) => l.kind === "road" && !l.complete && !l.abandoned);
  if (!link) {
    let pair = null,
      near = Infinity;
    for (let i = 0; i < towns.length; i++)
      for (let j = i + 1; j < towns.length; j++) {
        const a = towns[i],
          b = towns[j],
          d = Math.sqrt(dist2(a.x, a.y, b.x, b.y));
        if (d < 4 || d > ROAD_LINK_REACH || roadLinkBetween(a.id, b.id, "road")) continue;
        if (d < near) {
          near = d;
          pair = [a, b];
        }
      }
    if (!pair) return false;
    const f =
      W.factions.find((x) => x.id === pair[0].factionId) ||
      W.factions.find((x) => x.id === pair[1].factionId) ||
      W.factions[0];
    if (!f) return false;
    link = startRoadLink(f, pair[0], pair[1], "road");
  }
  if (!link) return false;
  for (const id of [link.a, link.b]) {
    const town = W.settlements.find((s) => s.id === id);
    if (!town) continue;
    const want = MODERN_ROAD_STONE - (town.inventory[C.MINERAL] || 0);
    if (want > 0) {
      town.inventory[C.MINERAL] += want;
      causalPushInput(want);
    }
  }
  for (let n = 0; n < MODERN_ROAD_PASSES; n++) paveLink(link);
  return true;
}
function modernPeople() {
  return worldTowns().reduce((n, s) => n + settlementPopulation(s), 0);
}
// A hundred people in towns is a hundred on a standard map. A battery-saver
// world is a sixth of that area, and its towns held twenty-three people at year
// sixty-five, so it could never be a modern world and its ship could never
// leave. The gate scales with the map the way the urban gate does (84). It also
// stops a world sitting on the boundary from flickering across it: on a small
// map the skip reported "100 people living in towns" four times in ten presses
// as the count crossed back and forth, and spent those presses on a milestone
// it had already passed.
// What a modern world looks like depends on how much world there is. A standard
// map is the measure: every count falls with the map's area, because people and
// the towns they fill live on land and land is what shrinks, and each holds at
// the floor that keeps its meaning. Two cities, because one city is a one-city
// world. Current in two towns and two blocks, because one of either is not a
// grid or a skyline. One working factory, because one is industry and none is
// not. A battery-saver world is a sixth of a standard map: it reached two
// cities, current in three towns and three tower blocks by year ninety-nine
// with forty people alive, and then died asking for two factories it had no
// hands to staff.
function modernWorldShare() {
  const k = typeof smallWorldFactor === "function" ? smallWorldFactor() : 1;
  return k * k;
}
function modernWant(full, floor) {
  return Math.max(floor, Math.round(full * modernWorldShare()));
}
function modernCitiesWanted() {
  return modernWant(MODERN_CITIES, MODERN_CITIES_FLOOR);
}
function modernElectricWanted() {
  return modernWant(MODERN_ELECTRIC_TOWNS, MODERN_ELECTRIC_FLOOR);
}
// No two worlds raise the same downtown. The sway is fixed by the seed, so a
// world always asks the same of itself, and one world's skyline is a third
// again the size of another's. Earth's own seed sits near the middle of it.
function modernSeedSway() {
  return 0.8 + (hashParts(W.seedHash, "modern-sway") % 41) / 100;
}
function modernSkylineWanted() {
  return Math.round(modernWant(MODERN_SKYLINE, MODERN_SKYLINE_FLOOR) * modernSeedSway());
}
// A downtown is where people live, not only where they work. Apartment blocks
// are counted apart from the towers and offices so a world cannot answer the
// whole skyline with offices nobody sleeps in.
function modernHomesWanted() {
  return Math.round(modernWant(MODERN_HOMES, MODERN_HOMES_FLOOR) * modernSeedSway());
}
function modernWorksWanted() {
  return modernWant(MODERN_WORKS, MODERN_WORKS_FLOOR);
}
// The floor under the people is not a number picked out of the air. A world
// that has to show two cities has to hold the people to fill them, so the
// fewest a modern world can ask for is two cities' worth at that world's own
// urban gate (84). On a battery-saver world that is ten a city, so twenty; on a
// standard map twenty-four a city, so forty-eight, which the hundred covers.
function modernPeopleFloor() {
  const gate = typeof urbanGate === "function" ? urbanGate() : null;
  return Math.max(MODERN_PEOPLE_MIN, (gate?.local || 24) * modernCitiesWanted());
}
function modernPeopleWanted() {
  return modernWant(MODERN_PEOPLE, modernPeopleFloor());
}
function modernShortfall() {
  const missing = [];
  if (modernCities().length < modernCitiesWanted())
    missing.push(`${modernCitiesWanted()} cities at the urban stage`);
  if (modernElectricTowns() < modernElectricWanted())
    missing.push(`current in ${modernElectricWanted()} towns`);
  if (modernCount(["tower", "office"]) < modernSkylineWanted())
    missing.push(`${modernSkylineWanted()} tower blocks or offices`);
  if (modernCount(["tenement"]) < modernHomesWanted())
    missing.push(`${modernHomesWanted()} apartment blocks`);
  if (modernCount(["factory"]) < modernWorksWanted())
    missing.push(`${modernWorksWanted()} working factories`);
  if (!modernLink()) missing.push("a paved road or rail between two towns");
  if (modernPeople() < modernPeopleWanted())
    missing.push(`${modernPeopleWanted()} people living in towns`);
  return missing;
}
function polityOfPlace(place) {
  return place?.factionId ? W.factions.find((f) => f.id === place.factionId) || null : null;
}
// The polity of the largest living town. The causal lead town is not used here:
// finding it asks each town's stage shortfall, which asks the orbital shortfall,
// which would ask for the lead town again without end.
function modernLeadPolity() {
  const top = W.settlements
    .filter((s) => !s.ruined && s.knownProcesses)
    .sort((a, b) => settlementPopulation(b) - settlementPopulation(a) || a.id - b.id)[0];
  return polityOfPlace(top);
}
// ── No ship leaves before the world is modern ────────────────────────────────
const launchShipModernBase = launchShip;
launchShip = function (place, force = false) {
  if (!force && !MODERN_WAIVED && place?.knownProcesses && modernShortfall().length) return null;
  return launchShipModernBase(place, force);
};
const orbitalShortfallModernBase = orbitalShortfall;
orbitalShortfall = function () {
  const missing = orbitalShortfallModernBase();
  for (const m of modernShortfall()) missing.push(m);
  return missing;
};
// ── The Causal skip builds the modern world first ────────────────────────────
function modernStages() {
  return [
    { key: "cities", label: `${modernCitiesWanted()} cities at the urban stage`, done: () => modernCities().length >= modernCitiesWanted() },
    { key: "current", label: `current in ${modernElectricWanted()} towns`, done: () => modernElectricTowns() >= modernElectricWanted() },
    { key: "skyline", label: `${modernSkylineWanted()} tower blocks or offices`, done: () => modernCount(["tower", "office"]) >= modernSkylineWanted() },
    { key: "homes", label: `${modernHomesWanted()} apartment blocks`, done: () => modernCount(["tenement"]) >= modernHomesWanted() },
    { key: "works", label: `${modernWorksWanted()} working factories`, done: () => modernCount(["factory"]) >= modernWorksWanted() },
    { key: "road", label: "a paved road or rail between two towns", done: () => modernLink() },
    { key: "hundred", label: `${modernPeopleWanted()} people living in towns`, done: () => modernPeople() >= modernPeopleWanted() },
  ];
}
const causalSkipMicroStagesModernBase = causalSkipMicroStages;
causalSkipMicroStages = function () {
  const stages = causalSkipMicroStagesModernBase(),
    at = stages.findIndex((s) => s.key === "starflight");
  if (at < 0) return stages;
  const all = [...stages.slice(0, at), ...modernStages(), ...stages.slice(at)];
  // The stage list and the ship disagreed about *where*. "Starflight" counted
  // the craft understood in any town and "a completed Launch tower" a tower
  // standing in any town, while `launchShip` wants both in the one place it
  // leaves from — and a village will happily learn the craft while another
  // village raises the tower, at which point both stages report themselves done
  // and the city that must actually fly has neither. Measured on causal-origin
  // small: the world announced its launch tower at one press and Starflight at
  // the next while the site the effort had chosen held `tower=0 sf=false`
  // throughout, and then the world collapsed with the whole thing still to do.
  // Judged at the site, the effort works on the right town from the start.
  for (const stage of all) {
    if (stage.key === "starflight")
      stage.done = () => !!modernLaunchSite()?.knownProcesses.includes("starflight");
    else if (stage.key === "tower")
      stage.done = () => {
        const site = modernLaunchSite();
        return !!site && completedBuildings(site, "launch_tower").length > 0;
      };
  }
  return all;
};
// A city may hold several towers; the push feeds the site that is not yet
// complete instead of refusing because one already stands. Store-drawn inputs
// (the rare ones, and the foundry's metal, catalyst, and ceramic) reach the
// stores whole, where builders fetch them; common material is placed at the
// work face once the push has gone on a while, as the older pushes do.
function modernSite(place, type) {
  return (
    W.buildings.find((b) => !b.ruined && !b.complete && b.placeKind === "settlement" && b.placeId === place.id && b.type === type) ||
    planBuilding(place, type, 9)
  );
}
function modernSupply(place, type, pushes) {
  const b = modernSite(place, type);
  if (!b) return false;
  return modernSupplySite(place, b, pushes);
}
// A downtown is not one tower at a time. `modernSite` hands back the first
// unfinished block of its kind, so supplying a city ten times over supplied the
// same block ten times: with the skyline set to want forty, worlds raised two
// and stopped. The effort now works on every unfinished block a city has and
// plans another when they are all standing, up to what the skyline still wants.
function modernRaise(place, type, want, pushes) {
  if (!place || want <= 0) return 0;
  let raised = 0;
  for (const b of W.buildings) {
    if (raised >= want) break;
    if (b.ruined || b.complete || b.placeKind !== "settlement" || b.placeId !== place.id) continue;
    if (b.type !== type) continue;
    modernSupplySite(place, b, pushes);
    raised++;
  }
  while (raised < want) {
    const b = planBuilding(place, type, 9);
    if (!b) break;
    modernSupplySite(place, b, pushes);
    raised++;
  }
  return raised;
}
function modernSupplySite(place, b, pushes) {
  if (!place || !b) return false;
  // An existing project keeps its old work order. Supplying a priority-three
  // factory while priority-six towers take every builder left it fully stocked
  // with zero work for decades. The effort must give it the same priority as a
  // new project it commissions, not just deliver another load of material.
  for (const order of W.workOrders)
    if (order.buildingId === b.id && order.status === "open")
      order.priority = Math.max(order.priority || 0, 9);
  const missing = missingBuildingMaterial(b);
  if (!missing) return true;
  const sp = missing.sp,
    drawn = STORE_DRAWN_MATERIALS.includes(sp),
    reserve = drawn ? researchMaterialReserve(place, sp) : 0,
    held = place.inventory[sp] || 0;
  let store = null,
    amount = 0;
  if (drawn && held < missing.needed + reserve) {
    store = place.inventory;
    amount = missing.needed + reserve - held;
  } else if (pushes >= 3) {
    // A tower wants a hundred and seventy stone and a hundred timber; at
    // twenty-four a push a town of ten spent a decade fetching them while its
    // people went hungry. From the third push the work face gets the whole of
    // what is missing, booked as input like every other push.
    store = b.composition;
    amount = missing.needed;
  }
  if (!store) return true;
  amount = Math.min(amount, 65535 - (store[sp] || 0));
  if (amount > 0) {
    store[sp] = (store[sp] || 0) + amount;
    causalPushInput(amount);
    if (store === b.composition) refreshBuildingStage(b);
  }
  return true;
}
// The pushes raise buildings and crafts; they never force births.
function modernPush(key, pushes) {
  const towns = worldTowns().sort((a, b) => settlementPopulation(b) - settlementPopulation(a) || a.id - b.id),
    cities = modernCities();
  if (!towns.length) return null;
  if (key === "cities") {
    const town = towns.find((s) => !cities.includes(s)) || towns[1] || towns[0];
    for (const type of ["hall", "clinic", "shelter", "workshop", "farm"]) if (!completedBuildings(town, type).length) causalPushBuilding(town, type, pushes);
    if (completedBuildings(town).length < 8) causalPushBuilding(town, "shelter", pushes);
    return "cities";
  }
  if (key === "current") {
    // Current is wanted in three towns, so three towns learn it at once: a
    // concerted effort works on every town the goal still needs, not on one at
    // a time while the others wait a decade for their turn.
    let want = modernElectricWanted() - modernElectricTowns();
    for (const town of towns) {
      if (want <= 0) break;
      if (town.knownProcesses.includes("electricity")) continue;
      if (causalPushResearch(town, "electricity", pushes)) want--;
    }
    return "current";
  }
  if (key === "skyline") {
    const list = (cities.length ? cities : towns).slice().sort((a, b) => completedBuildings(a, "tower").length + completedBuildings(a, "office").length - completedBuildings(b, "tower").length - completedBuildings(b, "office").length || a.id - b.id),
      want = Math.max(1, modernSkylineWanted() - modernCount(["tower", "office"]));
    // Every block the skyline still wants is raised at once, shared across the
    // cities, and every city works on all of its unfinished blocks at once.
    let left = want;
    const each = Math.max(1, Math.ceil(want / Math.max(1, list.length)));
    for (const city of list) {
      if (left <= 0) break;
      if (!["electricity", "mechanization", "masonry"].every((t) => city.knownProcesses.includes(t))) {
        for (const t of ["masonry", "mechanization", "electricity"]) if (!city.knownProcesses.includes(t)) causalPushResearch(city, t, pushes);
        continue;
      }
      const type = city.knownProcesses.includes("computing") && placeHasFacility(city, "market") ? "office" : "tower";
      left -= modernRaise(city, type, Math.min(each, left), pushes);
      // Builders who are hungry do not build: a lean city gets a field with its tower.
      if (typeof foodOutlook === "function" && foodOutlook(city)?.lean) causalPushBuilding(city, "farm", pushes);
    }
    return "skyline";
  }
  if (key === "homes") {
    // Apartment blocks go up beside the towers, shared across the cities.
    const list = (cities.length ? cities : towns).slice().sort((a, b) => completedBuildings(a, "tenement").length - completedBuildings(b, "tenement").length || a.id - b.id);
    let leftHomes = Math.max(1, modernHomesWanted() - modernCount(["tenement"]));
    const eachHomes = Math.max(1, Math.ceil(leftHomes / Math.max(1, list.length)));
    for (const city of list) {
      if (leftHomes <= 0) break;
      if (!city.knownProcesses.includes("masonry")) {
        causalPushResearch(city, "masonry", pushes);
        continue;
      }
      leftHomes -= modernRaise(city, "tenement", Math.min(eachHomes, leftHomes), pushes);
    }
    return "homes";
  }
  if (key === "works") {
    const list = (cities.length ? cities : towns).slice().sort((a, b) => completedBuildings(a, "factory").length - completedBuildings(b, "factory").length || a.id - b.id),
      want = Math.max(1, modernWorksWanted() - modernCount(["factory"]));
    let leftWorks = want;
    const eachWorks = Math.max(1, Math.ceil(want / Math.max(1, list.length)));
    for (const city of list) {
      if (leftWorks <= 0) break;
      if (!["electricity", "mechanization"].every((t) => city.knownProcesses.includes(t))) {
        for (const t of ["mechanization", "electricity"]) if (!city.knownProcesses.includes(t)) causalPushResearch(city, t, pushes);
        continue;
      }
      leftWorks -= modernRaise(city, "factory", Math.min(eachWorks, leftWorks), pushes);
    }
    return "works";
  }
  if (key === "road") {
    // A polity that knows the craft lays a road; one that does not learns it
    // first, and two learn it at once rather than one. Paving spends stone from
    // the two towns at the ends of the link and stops dead the moment neither
    // can pay: a link of forty-three tiles stood at three for want of two
    // stone. The effort brings the stone as well as the hands, and lays four
    // passes where it laid one.
    const paver = W.factions.find((f) => f.stability > 0 && factionHasTech(f.id, "road_building") && polityTownsOf(f).length >= 2);
    if (paver && typeof roadPassFor === "function") {
      for (const town of polityTownsOf(paver)) {
        const want = MODERN_ROAD_STONE - (town.inventory[C.MINERAL] || 0);
        if (want > 0) {
          town.inventory[C.MINERAL] = (town.inventory[C.MINERAL] || 0) + want;
          causalPushInput(want);
        }
      }
      for (let n = 0; n < MODERN_ROAD_PASSES; n++) roadPassFor(paver, false, "road");
    } else if (modernRoadBetweenStrangers(pushes)) {
      return "road";
    } else {
      let want = 2;
      for (const town of towns) {
        if (want <= 0) break;
        if (town.factionId && factionHasTech(town.factionId, "road_building")) continue;
        if (causalPushResearch(town, "road_building", pushes)) want--;
      }
    }
    return "road";
  }
  if (key === "hundred") {
    // Fields and stores, so a hundred can live; never forced births.
    for (const town of towns.slice(0, 2)) {
      if (!causalPushBuilding(town, "farm", pushes)) causalPushBuilding(town, "stockpile", pushes);
    }
    return "hundred";
  }
  return null;
}
// A concerted effort that leaves its people hungry reaches nothing. A town in
// famine keeps its fields and its stores and still holds nothing in them: on
// one measured world every lean town held four or five finished fields, two
// stores, and an empty larder, with half its people hungry and no neighbour
// holding a surplus to send. The objective waits on hands that are not there
// while the world shrinks under the skip. The road got its stone; the two
// hungriest towns get their bread the same way, booked as the player's doing.
const MODERN_FED_TOWNS = 2,
  MODERN_RATION = 4;
function modernFeedTheEffort(pushes) {
  if (typeof foodOutlook !== "function") return 0;
  const starving = worldTowns()
    .map((s) => ({ s, outlook: foodOutlook(s) }))
    .filter((x) => x.outlook?.famine)
    .sort((a, b) => b.outlook.hungry - a.outlook.hungry || a.s.id - b.s.id);
  let fed = 0;
  for (const { s, outlook } of starving) {
    if (fed >= MODERN_FED_TOWNS) break;
    const want = Math.round(outlook.pop * MODERN_RATION) - (s.inventory[C.ORGANIC] || 0);
    if (want <= 0) continue;
    s.inventory[C.ORGANIC] += want;
    causalPushInput(want);
    causalPushBuilding(s, "farm", pushes);
    fed++;
  }
  return fed;
}
const causalPushTowardModernBase = causalPushToward;
causalPushToward = function (target = causalTarget()) {
  if (target) modernFeedTheEffort(target.pushes || 1);
  if (target && MODERN_STAGE_KEYS.includes(target.key)) {
    target.pushes = (target.pushes || 0) + 1;
    return modernPush(target.key, target.pushes);
  }
  if (target && MODERN_LAUNCH_KEYS.has(target.key)) {
    target.pushes = (target.pushes || 0) + 1;
    return modernLaunchPush(target.key, target.pushes);
  }
  return causalPushTowardModernBase(target);
};
// A launch tower waits on six understandings, and the objective sought them one
// at a time: combustion, and then, years later, computing, while the rest of the
// polity stood idle. The effort now sets the polity's other towns on what the
// lead city is not working on, and a polity teaches what its towns learn; the
// lead city gets the samples and the fires for the rest of what it lacks and is
// left at work on the first of them.
function modernGroundworkMissing(place) {
  if (!place?.knownProcesses || typeof STARFLIGHT_GROUNDWORK === "undefined") return [];
  return STARFLIGHT_GROUNDWORK.filter((t) => !place.knownProcesses.includes(t));
}
// A ship leaves from one place. The stage list asks the world for a launch
// tower and, separately, for Starflight, and the effort raised the tower
// wherever it happened to be leading and taught the craft to whoever led next,
// so the tower and the understanding could stand in two different towns and
// neither of them could fly. The effort now picks the place a ship would leave
// from and gives it both.
function modernLaunchSite() {
  const towns = worldTowns();
  if (!towns.length) return null;
  // Only a city sends a ship away, so a city outranks a village that happens to
  // hold the tower: the effort raises a second tower in the city rather than
  // wait on a village that may never be one.
  const score = (s) =>
    (typeof cityStage === "function" && cityStage(s) ? 16 : 0) +
    completedBuildings(s, "launch_tower").length * 8 +
    (s.knownProcesses.includes("starflight") ? 4 : 0) +
    (modernGroundworkMissing(s).length ? 0 : 2) +
    ((s.stability || 0) >= 0.35 ? 1 : 0);
  const best = towns
    .slice()
    .sort(
      (a, b) =>
        score(b) - score(a) || settlementPopulation(b) - settlementPopulation(a) || a.id - b.id,
    )[0];
  // A ship leaves from one place, and which place must not move under it. Two
  // cities of nine and twelve people traded the larger population back and
  // forth on a battery-saver world, so a site chosen by size alone changed
  // between presses: the effort taught one town the craft and raised the
  // other's tower, and neither of them could fly. The world remembers the place
  // it chose and keeps it until another is strictly better on its own merits,
  // which size is not one of.
  ensureCausalReached();
  const held = towns.find((t) => t.id === W.causalLaunchSiteId);
  if (held && score(held) >= score(best)) return held;
  W.causalLaunchSiteId = best.id;
  return best;
}
function modernLaunchPush(key, pushes) {
  const site = modernLaunchSite();
  if (!site) return null;
  // Section 110 requires these in the city that launches, not merely somewhere
  // in the world. Mosshollow reached Starflight with a tower and an empty world
  // shortfall while its neighbours held the skyline and works. Supply the
  // site's missing facilities alongside its research, using the same ledger.
  if (!hasSkyline(site)) modernSupply(site, "tower", pushes);
  if (!hasWorks(site)) modernSupply(site, "factory", pushes);
  if (key === "starflight") {
    // The stage counts the craft understood anywhere in the world, so the
    // effort taught it to whichever town happened to be leading. Only the place
    // the ship leaves from can use it, and on a small world that was a
    // different town: one knew how to fly and the other had the tower.
    return causalPushResearch(site, "starflight", pushes) ? "research" : null;
  }
  if (key === "ascension") {
    if (!site.knownProcesses.includes("starflight"))
      return causalPushResearch(site, "starflight", pushes) ? "research" : null;
    // The world's tower may stand in a village that will never be a city, and
    // the stage list counts a tower anywhere as a tower. The place the ship
    // leaves from needs its own.
    if (!completedBuildings(site, "launch_tower").length)
      return modernSupply(site, "launch_tower", pushes) ? "tower" : null;
    // A town in disorder sends nobody anywhere.
    if ((site.stability || 0) < 0.4) site.stability = clamp((site.stability || 0) + 0.03, 0, 1);
    // The world sends a ship on a roll of the dice, a chance in three every two
    // years for each town that understands the craft. That is right for a world
    // left to itself, and wrong for one the player is pressing: a small world
    // can hold every condition for a few years at the very edge of them and
    // slip back before it ever wins the roll. A battery-saver world did exactly
    // that, standing with nothing missing, its tower complete and Starflight
    // understood, for three presses running. When the place is ready and
    // nothing is missing, the effort sends it. `launchShip` checks every
    // condition again for itself, so this can only fire what was already due.
    if (typeof launchShip === "function" && !modernShortfall().length) launchShip(site);
    return "ascension";
  }
  const missing = modernGroundworkMissing(site);
  if (missing.length) {
    // The polity's other towns take up what the site is not working on, and a
    // polity teaches what its towns learn.
    const f = W.factions.find((x) => x.id === site.factionId) || null;
    let n = 1;
    for (const town of polityTownsOf(f)) {
      if (n >= missing.length) break;
      if (town === site) continue;
      if (causalPushResearch(town, missing[n], pushes)) n++;
    }
    for (let k = missing.length - 1; k >= 0; k--) causalPushResearch(site, missing[k], pushes);
    return "research";
  }
  // A launch tower wants its stone and its timber like any other block, and a
  // push hands over only twenty-four of a common material at a time; the tower
  // stage spent nine years fetching them. It is supplied the way a tower block
  // and a factory are, so from the third push the work face gets the whole of
  // what it lacks.
  return modernSupply(site, "launch_tower", pushes) ? "tower" : null;
}
// ── Denser skylines ──────────────────────────────────────────────────────────
const towersWantedModernBase = towersWanted;
towersWanted = function (place) {
  return Math.max(2, Math.floor(settlementPopulation(place) / MODERN_TOWER_PER_PEOPLE), towersWantedModernBase(place));
};
const officesWantedModernBase = officesWanted;
officesWanted = function (place) {
  return Math.max(Math.floor(settlementPopulation(place) / MODERN_OFFICE_PER_PEOPLE), officesWantedModernBase(place));
};
// ── Countryside: hedgerows, hay, scarecrows, windmills ───────────────────────
function drawWindmill(g, s, r, now, still) {
  const post = hsl(30, 30, 30),
    sail = "rgba(240,235,220,0.92)",
    hubY = s.y - r * 1.5,
    spin = still ? 0.4 : now * 0.0012;
  g.strokeStyle = post;
  g.lineWidth = Math.max(1.2, r * 0.1);
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(s.x, s.y + r * 0.1);
  g.lineTo(s.x, hubY);
  g.stroke();
  g.fillStyle = post;
  g.beginPath();
  g.moveTo(s.x - r * 0.22, s.y + r * 0.1);
  g.lineTo(s.x + r * 0.22, s.y + r * 0.1);
  g.lineTo(s.x + r * 0.08, s.y - r * 0.6);
  g.lineTo(s.x - r * 0.08, s.y - r * 0.6);
  g.closePath();
  g.fill();
  g.strokeStyle = sail;
  g.lineWidth = Math.max(1, r * 0.09);
  g.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = spin + (k * Math.PI) / 2;
    g.moveTo(s.x, hubY);
    g.lineTo(s.x + Math.cos(a) * r * 0.85, hubY + Math.sin(a) * r * 0.85);
  }
  g.stroke();
  g.fillStyle = "#3a3330";
  g.beginPath();
  g.arc(s.x, hubY, Math.max(1, r * 0.08), 0, Math.PI * 2);
  g.fill();
}
// Fields are drawn by their own site drawer (42e), which skips the exterior
// pass, so the countryside hangs off the site drawer itself.
const drawBuildingSiteModernBase = drawBuildingSite;
drawBuildingSite = function (g, b, now, m) {
  drawBuildingSiteModernBase(g, b, now, m);
  if (b.type !== "farm" || !b.complete || b.ruined || b.abandoned || b.placeKind !== "settlement" || UI.quality === "low" || UI.camera.zoom < 1.4) return;
  const place = buildingPlace(b);
  if (!place) return;
  const s = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m),
    r = buildingScreenSize(b, m),
    still = ACTIVE_REDUCED_MOTION,
    h1 = visualHash01(b.id, 0x41f),
    h2 = visualHash01(b.id, 0x52e),
    season = typeof groveSeason === "function" ? groveSeason(b.x, b.y) : { fall: 0, bare: 0 };
  g.save();
  // A hedgerow along the field's far edge.
  g.strokeStyle = hsl(112, 40, 26, 0.9);
  g.lineWidth = Math.max(1.4, r * 0.16);
  g.setLineDash([Math.max(1.5, r * 0.18), Math.max(1, r * 0.1)]);
  g.beginPath();
  g.moveTo(s.x - r * 1.05, s.y - r * 0.55);
  g.lineTo(s.x + r * 0.2, s.y - r * 1.05);
  g.stroke();
  g.setLineDash([]);
  MODERN.hedgerows++;
  if (season.fall > 0.4 && place.knownProcesses.includes("agriculture")) {
    g.fillStyle = hsl(42, 55, 62);
    g.strokeStyle = hsl(38, 45, 40);
    g.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.arc(s.x - r * 0.5 + k * r * 0.45, s.y + r * 0.25 - (k % 2) * r * 0.12, Math.max(1.2, r * 0.13), 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    MODERN.hay++;
  }
  if (h1 < 0.34) {
    // A scarecrow.
    const cx = s.x + r * 0.55,
      cy = s.y - r * 0.2;
    g.strokeStyle = hsl(30, 30, 28);
    g.lineWidth = Math.max(1, r * 0.06);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(cx, cy + r * 0.3);
    g.lineTo(cx, cy - r * 0.55);
    g.moveTo(cx - r * 0.3, cy - r * 0.35);
    g.lineTo(cx + r * 0.3, cy - r * 0.35);
    g.stroke();
    g.fillStyle = hsl(40, 60, 60);
    g.beginPath();
    g.arc(cx, cy - r * 0.62, Math.max(1, r * 0.09), 0, Math.PI * 2);
    g.fill();
    MODERN.scarecrows++;
  }
  if (place.knownProcesses.includes("windmills") && h2 < 0.34) {
    drawWindmill(g, { x: s.x - r * 0.7, y: s.y + r * 0.1 }, r * 0.9, now, still);
    MODERN.windmills++;
  }
  g.restore();
};
// ── The skip stops when the world is dying ───────────────────────────────────
// A skip on a target the world could not reach ran its whole horizon, up to
// ninety-six years, while the towns starved and fell; the player came back to a
// handful of people and a page of ruins. The skip now stops when the world's
// people have halved since it began, and says so.
const MODERN_COLLAPSE_SHARE = 0.5,
  MODERN_COLLAPSE_MIN = 20,
  MODERN_COLLAPSE_CHECK = 256;
function modernLivingPeople() {
  return biospherePopulation(KINDS.PERSON);
}
// A skip also runs no longer than twenty-four years at a stretch: the horizon
// of sixty to ninety-six years was set when a skip sought the next epoch, and
// on a stalled modern stage it spent decades while the towns starved. A shorter
// horizon hands the world back with its shortfall named, before the damage.
const MODERN_SKIP_MAX_TICKS = TICKS_PER_YEAR * 24;
// What the world has already reached. Every condition of a modern world is a
// live count, so a world sitting on one of them crosses back and forth: on a
// small map the skip reported "2 cities at the urban stage" four times and "100
// people living in towns" four times in ten presses, and each of those presses
// ended on a milestone the player had already been shown. A stage the world has
// reached once is still worth working toward when it comes undone, but reaching
// it again is not news, so the skip carries on to something that is.
function ensureCausalReached(world = W) {
  if (!world) return [];
  if (!Array.isArray(world.causalReached)) world.causalReached = [];
  if (typeof world.causalLaunchSiteId !== "number") world.causalLaunchSiteId = 0;
  return world.causalReached;
}
function modernRecordReached(state) {
  const key = state?.stopReason === "milestone" ? state.milestone?.key : "";
  if (!key) return false;
  const reached = ensureCausalReached();
  if (reached.includes(key)) return false;
  reached.push(key);
  return true;
}
const restoreWorldDefaultsModernBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldDefaultsModernBase();
  ensureCausalReached(W);
};
const makeCausalSkipStateModernBase = makeCausalSkipState;
makeCausalSkipState = function (limitOverride = 0) {
  const state = makeCausalSkipStateModernBase(limitOverride);
  state.startPeople = modernLivingPeople();
  if (!(limitOverride > 0)) state.limit = Math.min(state.limit, MODERN_SKIP_MAX_TICKS);
  const reached = ensureCausalReached();
  for (const stage of state.pending) if (reached.includes(stage.key)) stage.quiet = true;
  return state;
};
// What a skip cost. The halting guard compares a skip against its own start, so
// a world that loses a tenth of its people every skip never trips it and dies
// quietly over a dozen presses. A skip that ends smaller than it began now says
// so, in people.
const causalSkipResultModernBase = causalSkipResult;
causalSkipResult = function (state) {
  const out = causalSkipResultModernBase(state);
  out.startPeople = state.startPeople || 0;
  out.toll = Math.max(0, out.startPeople - modernLivingPeople());
  return out;
};
const causalSkipStepModernBase = causalSkipStep;
causalSkipStep = function (state) {
  const out = causalSkipStepModernBase(state);
  if (state.done) modernRecordReached(state);
  // The concerted effort turns its hand to the objective twice a year rather
  // than once: the skip was given a shorter horizon, so it must do more within
  // it. The intervention on the half year does the rest of the work (41).
  if (
    !state.done &&
    W.tick % 128 === 64 &&
    typeof concertedIntensity === "function" &&
    concertedIntensity() > 0 &&
    typeof causalPushToward === "function" &&
    causalTarget()
  )
    causalPushToward(causalTarget());
  if (
    !state.done &&
    state.advanced % MODERN_COLLAPSE_CHECK === 0 &&
    (state.startPeople || 0) >= MODERN_COLLAPSE_MIN &&
    modernLivingPeople() < state.startPeople * MODERN_COLLAPSE_SHARE
  ) {
    state.done = true;
    state.stopReason = "collapse";
    state.milestone = {
      type: "CausalMicroStage",
      id: 0,
      tick: W.tick,
      key: "collapse",
      label: `a halving of the world's people (${state.startPeople} to ${modernLivingPeople()}; the skip halts)`,
    };
  }
  return out;
};
// Why the ship did not go. A world reached every condition of the modern stage
// on causal-origin small — the shortfall empty for three presses, its launch
// tower complete and Starflight understood — and no ship left. `launchShip`
// re-checks its own conditions and returns null without saying which one it
// refused on, so from outside the two look identical. This names it.
function modernLaunchBlockers() {
  const site = modernLaunchSite();
  if (!site) return { site: null, blockers: ["no town at all"] };
  const blockers = [],
    towers = completedBuildings(site, "launch_tower").length,
    isCity = typeof cityStage === "function" ? !!cityStage(site) : true,
    stability = +(site.stability || 0).toFixed(2),
    recent =
      typeof ORBIT_RELAUNCH_TICKS === "number"
        ? W.ascensions.filter(
            (a) => a.settlementId === site.id && W.tick - a.tick < ORBIT_RELAUNCH_TICKS,
          ).length
        : 0,
    shortfall = modernShortfall();
  if (!site.knownProcesses.includes("starflight")) blockers.push("the site does not know starflight");
  if (stability < 0.35) blockers.push("stability " + stability + " below 0.35");
  if (!isCity) blockers.push("the site is not a city");
  if (!towers) blockers.push("the site has no completed launch tower");
  if (!hasSkyline(site)) blockers.push("the site has no completed skyline");
  if (!hasWorks(site)) blockers.push("the site has no completed factory");
  if (recent) blockers.push("a ship already left here this generation");
  if (shortfall.length) blockers.push("world shortfall: " + shortfall.join("; "));
  return {
    site: { id: site.id, name: site.name, pop: settlementPopulation(site), stage: site.stage || null },
    sticky: W.causalLaunchSiteId,
    isCity, stability, towers, recent,
    knows: site.knownProcesses.includes("starflight"),
    blockers,
  };
}
window.ALIFE_MODERN_DEBUG = Object.freeze({
  launchBlockers: modernLaunchBlockers,
  living: () => modernLivingPeople(),
  shortfall: () => modernShortfall(),
  stages: () => modernStages().map((s) => ({ key: s.key, label: s.label, done: s.done() })),
  push: (key, pushes = 1) => modernPush(key, pushes),
  supply: (placeId, type, pushes = 1) => modernSupply(W.settlements.find((s) => s.id === placeId), type, pushes),
  towers: (placeId) => towersWanted(W.settlements.find((s) => s.id === placeId)),
  offices: (placeId) => officesWanted(W.settlements.find((s) => s.id === placeId)),
  counts: () => ({ ...MODERN }),
  reached: () => ensureCausalReached().slice(),
  gate: () => modernPeopleWanted(),
  wants: () => ({
    share: +modernWorldShare().toFixed(3),
    cities: modernCitiesWanted(),
    electric: modernElectricWanted(),
    skyline: modernSkylineWanted(),
    homes: modernHomesWanted(),
    sway: +modernSeedSway().toFixed(2),
    works: modernWorksWanted(),
    people: modernPeopleWanted(),
  }),
  people: () => modernPeople(),
  feed: (pushes = 1) => modernFeedTheEffort(pushes),
  site: () => modernLaunchSite()?.name || null,
  siteId: () => (ensureCausalReached(), W.causalLaunchSiteId || 0),
  launchPush: (key = "tower", pushes = 1) => modernLaunchPush(key, pushes),
  groundwork: (placeId = 0) =>
    modernGroundworkMissing(
      placeId
        ? W.settlements.find((x) => x.id === placeId)
        : typeof causalLeadSettlement === "function"
          ? causalLeadSettlement()
          : null,
    ),
  waive: (on = true) => {
    MODERN_WAIVED = !!on;
    return MODERN_WAIVED;
  },
  reset: () => {
    for (const k of Object.keys(MODERN)) MODERN[k] = 0;
  },
});
