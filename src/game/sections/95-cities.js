// ═══════════════════════════════════════════════════════════════════════════
// 95. CITIES BEFORE SHIPS — engines, current, and tenements come before the tower
// ═══════════════════════════════════════════════════════════════════════════
// A village that knew the sky, engines, and stewardship could raise a launch
// tower and send a ship away while its people still walked between six-bed
// shelters. Starflight now stands on Combustion Engines, Electricity, and
// Computing as well as Sky Charts, Terrestrial Mechanization, and Planetary
// Stewardship; the launch tower is planned only by a town at the urban stage
// or beyond that knows all six, and a ship leaves only from such a city (the
// god-tools may still force one). The complex terrestrial stage asks for
// Electricity beside stewardship, engines, and waterworks. And cities house
// their people the way cities do: a town at the urban stage that knows masonry
// and has more people than beds raises a Tenement, an eighteen-bed block drawn
// taller and wider than any shelter in its family's style and lit at night
// like the rest of an electric town. Rendering only reads.
const CITY_STAGES = new Set(["urban", "complex terrestrial"]),
  STARFLIGHT_GROUNDWORK = Object.freeze([
    "astronomy",
    "mechanization",
    "planetary_stewardship",
    "combustion",
    "electricity",
    "computing",
  ]),
  TENEMENT_SCALE = 1.4,
  CITIES = { tenementsDrawn: 0, firstWorld: null };
// A city is a town at the urban stage or beyond. The cached stage is read
// first; a town that has not yet been staged is judged on the spot.
function cityStage(place) {
  if (!place || place.ruined || !place.knownProcesses) return false;
  const stage =
    place.stage ||
    (typeof settlementDevelopmentStage === "function" ? settlementDevelopmentStage(place) : "");
  return CITY_STAGES.has(stage);
}
// What still stands between a town and its launch tower, in words.
function launchShortfall(place) {
  if (!place?.knownProcesses) return ["a town"];
  const missing = [];
  if (!cityStage(place)) missing.push("a city at the urban stage");
  for (const t of STARFLIGHT_GROUNDWORK)
    if (!place.knownProcesses.includes(t)) missing.push(technologyDefinition(t)?.name || t);
  return missing;
}
function launchSiteReady(place) {
  return launchShortfall(place).length === 0;
}
// ── Tenements ─────────────────────────────────────────────────────────────────
function housingCapacity(place) {
  let beds = 0;
  for (const b of completedBuildings(place)) beds += BUILDING_DEFS[b.type]?.housing || 0;
  return beds;
}
function wantsTenement(place) {
  if (!place?.knownProcesses || place.ruined) return false;
  if (!place.knownProcesses.includes("masonry") || !cityStage(place)) return false;
  // A city with current builds tower blocks (103), not tenements.
  if (place.knownProcesses.includes("electricity")) return false;
  if (housingCapacity(place) >= settlementPopulation(place)) return false;
  return !W.buildings.some(
    (b) =>
      !b.ruined &&
      b.placeKind === "settlement" &&
      b.placeId === place.id &&
      b.type === "tenement" &&
      !b.complete,
  );
}
const ensurePlacePlansCitiesBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  ensurePlacePlansCitiesBase(place);
  if (!place?.knownProcesses || place.ruined) return;
  if (wantsTenement(place) && activeBuildings(place).length < 6)
    planBuilding(place, "tenement", (place.management?.priorities?.shelter || 5) + 1);
  if (
    CITIES.firstWorld !== W &&
    typeof recordMilestone === "function" &&
    completedBuildings(place, "tenement").length
  ) {
    CITIES.firstWorld = W;
    recordMilestone("first-tenement", "the first tenement", place, {
      evidence: `${settlementPopulation(place)} people needed beds in ${place.name}`,
    });
  }
};
// A tenement is entered, rested in, and returned to like a shelter.
function tenementAsShelter(building) {
  return { ...building, type: "shelter" };
}
const personMayEnterBuildingCitiesBase = personMayEnterBuilding;
personMayEnterBuilding = function (id, building) {
  return personMayEnterBuildingCitiesBase(
    id,
    building?.type === "tenement" ? tenementAsShelter(building) : building,
  );
};
preferredReturnBuilding = function (id) {
  if (W.kind[id] !== KINDS.PERSON) return nearestFriendlyPlace(id);
  const place = nearestFriendlyPlace(id),
    position = W.components.position[id];
  if (!place || !position) return place;
  const priorities = { tenement: 0, shelter: 0, clinic: 1, hall: 2, hearth: 3 };
  return (
    completedBuildings(place)
      .filter((building) => Object.hasOwn(priorities, building.type))
      .sort(
        (left, right) =>
          priorities[left.type] - priorities[right.type] ||
          dist2(position.x, position.y, left.x, left.y) -
            dist2(position.x, position.y, right.x, right.y) ||
          left.id - right.id,
      )[0] || place
  );
};
// ── Rendering: a block drawn in the family's style, taller and wider ──────────
const drawCompletedBuildingCitiesBase = drawCompletedBuilding;
drawCompletedBuilding = function (g, b, s, r, p, now, m) {
  if (b.type !== "tenement") return drawCompletedBuildingCitiesBase(g, b, s, r, p, now, m);
  CITIES.tenementsDrawn++;
  return drawCompletedBuildingCitiesBase(g, tenementAsShelter(b), s, r * TENEMENT_SCALE, p, now, m);
};
if (typeof LIT_TYPES !== "undefined") LIT_TYPES.add("tenement");
// ── Legends: beds and people ───────────────────────────────────────────────────
const renderPlacePageCitiesBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageCitiesBase(id),
    place = W.settlements.find((s) => s.id === id);
  if (!place || !place.knownProcesses) return html;
  const beds = housingCapacity(place),
    people = settlementPopulation(place),
    tenements = completedBuildings(place, "tenement").length,
    text = `${beds} beds for ${people} people${tenements ? `, ${tenements} tenement${tenements === 1 ? "" : "s"}` : ""}`,
    row = `<div class="kv"><span>Housing</span><b>${esc(text)}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
window.ALIFE_CITIES_DEBUG = Object.freeze({
  groundwork: STARFLIGHT_GROUNDWORK.slice(),
  city: (placeId) => cityStage(W.settlements.find((s) => s.id === placeId)),
  shortfall: (placeId) => launchShortfall(W.settlements.find((s) => s.id === placeId)),
  ready: (placeId) => launchSiteReady(W.settlements.find((s) => s.id === placeId)),
  housing: (placeId) => {
    const s = W.settlements.find((x) => x.id === placeId);
    return s
      ? {
          beds: housingCapacity(s),
          people: settlementPopulation(s),
          tenements: completedBuildings(s, "tenement").length,
        }
      : null;
  },
  wants: (placeId) => wantsTenement(W.settlements.find((s) => s.id === placeId)),
  plan: (placeId) => ensurePlacePlans(W.settlements.find((s) => s.id === placeId)),
  drawn: () => CITIES.tenementsDrawn,
  reset: () => {
    CITIES.tenementsDrawn = 0;
  },
});
