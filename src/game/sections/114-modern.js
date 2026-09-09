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
  MODERN_SKYLINE = 3,
  MODERN_WORKS = 2,
  MODERN_PEOPLE = 100,
  MODERN_PEOPLE_FLOOR = 24,
  MODERN_TOWER_PER_PEOPLE = 18,
  MODERN_OFFICE_PER_PEOPLE = 20,
  MODERN_ROAD_STONE = 48,
  MODERN_ROAD_PASSES = 4,
  MODERN_STAGE_KEYS = Object.freeze(["cities", "current", "skyline", "works", "road", "hundred"]),
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
function modernPeopleWanted() {
  const k = typeof smallWorldFactor === "function" ? smallWorldFactor() : 1;
  // People live on land, and land is what shrank, so the gate falls with the
  // map's area and not with its edge. Scaling by the edge left a battery world
  // asking for forty, and over a hundred and seven years and eighteen presses
  // its towns held between sixteen and thirty-four.
  return Math.max(MODERN_PEOPLE_FLOOR, Math.round(MODERN_PEOPLE * k * k));
}
function modernShortfall() {
  const missing = [];
  if (modernCities().length < MODERN_CITIES) missing.push(`${MODERN_CITIES} cities at the urban stage`);
  if (modernElectricTowns() < MODERN_ELECTRIC_TOWNS) missing.push(`current in ${MODERN_ELECTRIC_TOWNS} towns`);
  if (modernCount(["tower", "office"]) < MODERN_SKYLINE) missing.push(`${MODERN_SKYLINE} tower blocks or offices`);
  if (modernCount(["factory"]) < MODERN_WORKS) missing.push(`${MODERN_WORKS} working factories`);
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
    { key: "cities", label: `${MODERN_CITIES} cities at the urban stage`, done: () => modernCities().length >= MODERN_CITIES },
    { key: "current", label: `current in ${MODERN_ELECTRIC_TOWNS} towns`, done: () => modernElectricTowns() >= MODERN_ELECTRIC_TOWNS },
    { key: "skyline", label: `${MODERN_SKYLINE} tower blocks or offices`, done: () => modernCount(["tower", "office"]) >= MODERN_SKYLINE },
    { key: "works", label: `${MODERN_WORKS} working factories`, done: () => modernCount(["factory"]) >= MODERN_WORKS },
    { key: "road", label: "a paved road or rail between two towns", done: () => modernLink() },
    { key: "hundred", label: `${modernPeopleWanted()} people living in towns`, done: () => modernPeople() >= modernPeopleWanted() },
  ];
}
const causalSkipMicroStagesModernBase = causalSkipMicroStages;
causalSkipMicroStages = function () {
  const stages = causalSkipMicroStagesModernBase(),
    at = stages.findIndex((s) => s.key === "starflight");
  if (at < 0) return stages;
  return [...stages.slice(0, at), ...modernStages(), ...stages.slice(at)];
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
    let want = MODERN_ELECTRIC_TOWNS - modernElectricTowns();
    for (const town of towns) {
      if (want <= 0) break;
      if (town.knownProcesses.includes("electricity")) continue;
      if (causalPushResearch(town, "electricity", pushes)) want--;
    }
    return "current";
  }
  if (key === "skyline") {
    const list = (cities.length ? cities : towns).slice().sort((a, b) => completedBuildings(a, "tower").length + completedBuildings(a, "office").length - completedBuildings(b, "tower").length - completedBuildings(b, "office").length || a.id - b.id),
      want = Math.max(1, MODERN_SKYLINE - modernCount(["tower", "office"]));
    // Every block the skyline still wants is raised at once, sharing the cities
    // and doubling back on the first when there are fewer cities than blocks.
    for (let n = 0; n < want; n++) {
      const city = list[n % list.length];
      if (!city) break;
      if (!["electricity", "mechanization", "masonry"].every((t) => city.knownProcesses.includes(t))) {
        for (const t of ["masonry", "mechanization", "electricity"]) if (!city.knownProcesses.includes(t)) causalPushResearch(city, t, pushes);
      } else {
        modernSupply(city, city.knownProcesses.includes("computing") && placeHasFacility(city, "market") ? "office" : "tower", pushes);
        // Builders who are hungry do not build: a lean city gets a field with its tower.
        if (typeof foodOutlook === "function" && foodOutlook(city)?.lean) causalPushBuilding(city, "farm", pushes);
      }
    }
    return "skyline";
  }
  if (key === "works") {
    const list = (cities.length ? cities : towns).slice().sort((a, b) => completedBuildings(a, "factory").length - completedBuildings(b, "factory").length || a.id - b.id),
      want = Math.max(1, MODERN_WORKS - modernCount(["factory"]));
    for (let n = 0; n < want; n++) {
      const city = list[n % list.length];
      if (!city) break;
      if (!["electricity", "mechanization"].every((t) => city.knownProcesses.includes(t))) {
        for (const t of ["mechanization", "electricity"]) if (!city.knownProcesses.includes(t)) causalPushResearch(city, t, pushes);
      } else modernSupply(city, "factory", pushes);
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
const MODERN_RATION = 4;
function modernFeedTheEffort(pushes) {
  if (typeof foodOutlook !== "function") return 0;
  // Lean, not only famine. A town reads famine when two of five of its people
  // are hungry; a world can be half hungry and starving to death with only two
  // or three towns over that line. On the world this was measured on, energy
  // depletion was the first cause of death in every late press, sixty-five of a
  // hundred and fifty-six people were hungry, and three towns read famine.
  const starving = worldTowns()
    .map((s) => ({ s, outlook: foodOutlook(s) }))
    .filter((x) => x.outlook?.lean)
    .sort((a, b) => b.outlook.hungry - a.outlook.hungry || a.s.id - b.s.id);
  // Every town in famine, not the two hungriest: on one world five towns were
  // lean and four in famine with seventy of a hundred and seventy-eight people
  // hungry, and feeding two of them left the rest to starve while the effort
  // spent its whole horizon and the world halved. The effort works on every
  // town a goal needs; hunger is no different.
  let fed = 0;
  for (const { s, outlook } of starving) {
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
  if (target && (target.key === "tower" || target.key === "ascension")) {
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
  return towns
    .slice()
    .sort(
      (a, b) =>
        score(b) - score(a) || settlementPopulation(b) - settlementPopulation(a) || a.id - b.id,
    )[0];
}
function modernLaunchPush(key, pushes) {
  const site = modernLaunchSite();
  if (!site) return null;
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
  if (world && !Array.isArray(world.causalReached)) world.causalReached = [];
  return world?.causalReached || [];
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
window.ALIFE_MODERN_DEBUG = Object.freeze({
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
  people: () => modernPeople(),
  feed: (pushes = 1) => modernFeedTheEffort(pushes),
  site: () => modernLaunchSite()?.name || null,
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
