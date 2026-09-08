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
  MODERN_TOWER_PER_PEOPLE = 18,
  MODERN_OFFICE_PER_PEOPLE = 20,
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
function modernShortfall() {
  const missing = [];
  if (modernCities().length < MODERN_CITIES) missing.push(`${MODERN_CITIES} cities at the urban stage`);
  if (modernElectricTowns() < MODERN_ELECTRIC_TOWNS) missing.push(`current in ${MODERN_ELECTRIC_TOWNS} towns`);
  if (modernCount(["tower", "office"]) < MODERN_SKYLINE) missing.push(`${MODERN_SKYLINE} tower blocks or offices`);
  if (modernCount(["factory"]) < MODERN_WORKS) missing.push(`${MODERN_WORKS} working factories`);
  if (!modernLink()) missing.push("a paved road or rail between two towns");
  if (modernPeople() < MODERN_PEOPLE) missing.push(`${MODERN_PEOPLE} people living in towns`);
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
    { key: "hundred", label: `${MODERN_PEOPLE} people living in towns`, done: () => modernPeople() >= MODERN_PEOPLE },
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
    const town = towns.find((s) => !s.knownProcesses.includes("electricity"));
    if (town) causalPushResearch(town, "electricity", pushes);
    return "current";
  }
  if (key === "skyline") {
    const city = (cities.length ? cities : towns).slice().sort((a, b) => completedBuildings(a, "tower").length + completedBuildings(a, "office").length - completedBuildings(b, "tower").length - completedBuildings(b, "office").length || a.id - b.id)[0];
    if (!["electricity", "mechanization", "masonry"].every((t) => city.knownProcesses.includes(t))) {
      for (const t of ["masonry", "mechanization", "electricity"]) if (!city.knownProcesses.includes(t)) causalPushResearch(city, t, pushes);
    } else {
      modernSupply(city, city.knownProcesses.includes("computing") && placeHasFacility(city, "market") ? "office" : "tower", pushes);
      // Builders who are hungry do not build: a lean city gets a field with its tower.
      if (typeof foodOutlook === "function" && foodOutlook(city)?.lean) causalPushBuilding(city, "farm", pushes);
    }
    return "skyline";
  }
  if (key === "works") {
    const city = (cities.length ? cities : towns).slice().sort((a, b) => completedBuildings(a, "factory").length - completedBuildings(b, "factory").length || a.id - b.id)[0];
    if (!["electricity", "mechanization"].every((t) => city.knownProcesses.includes(t))) {
      for (const t of ["mechanization", "electricity"]) if (!city.knownProcesses.includes(t)) causalPushResearch(city, t, pushes);
    } else modernSupply(city, "factory", pushes);
    return "works";
  }
  if (key === "road") {
    // A polity that knows the craft lays a road; one that does not learns it first.
    const paver = W.factions.find((f) => f.stability > 0 && factionHasTech(f.id, "road_building") && polityTownsOf(f).length >= 2);
    if (paver && typeof roadPassFor === "function") roadPassFor(paver, false, "road");
    else causalPushResearch(towns[0], "road_building", pushes);
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
const causalPushTowardModernBase = causalPushToward;
causalPushToward = function (target = causalTarget()) {
  if (target && MODERN_STAGE_KEYS.includes(target.key)) {
    target.pushes = (target.pushes || 0) + 1;
    return modernPush(target.key, target.pushes);
  }
  return causalPushTowardModernBase(target);
};
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
const makeCausalSkipStateModernBase = makeCausalSkipState;
makeCausalSkipState = function (limitOverride = 0) {
  const state = makeCausalSkipStateModernBase(limitOverride);
  state.startPeople = modernLivingPeople();
  return state;
};
const causalSkipStepModernBase = causalSkipStep;
causalSkipStep = function (state) {
  const out = causalSkipStepModernBase(state);
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
  waive: (on = true) => {
    MODERN_WAIVED = !!on;
    return MODERN_WAIVED;
  },
  reset: () => {
    for (const k of Object.keys(MODERN)) MODERN[k] = 0;
  },
});
