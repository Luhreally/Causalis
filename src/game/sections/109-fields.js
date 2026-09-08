// ═══════════════════════════════════════════════════════════════════════════
// 109. THE FIELDS OF THE CITY — a great town feeds, houses, and governs its crowd
// ═══════════════════════════════════════════════════════════════════════════
// The pull of the city drew sixty-seven people into one town on the Earth-like
// seed, and then the town shrank back to a hamlet: its granary would plan no
// more than eight farms, enough for fifty mouths, its hall waited on Recorded
// Governance that came a century late, and without a hall the town was never
// a city, so it never raised a tenement however many slept rough. Now the
// granary plans farms for the crowd it has (one for every six people, up to
// twenty-four, land permitting); a town of two dozen that knows letters raises
// a hall and takes its civic stage; and a crowded town that knows masonry
// raises tenements whether or not the annals yet call it a city. Rendering
// only reads.
const FIELDS_HALL_POP = 24,
  FIELDS_TENEMENT_POP = 36,
  FIELDS_ACTIVE_CAP = 6;
function fieldsCount(place, type) {
  return W.buildings.filter((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === place.id && b.type === type).length;
}
// A town of two dozen that knows letters keeps a hall.
const ensurePlacePlansFieldsBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  ensurePlacePlansFieldsBase(place);
  if (!place?.knownProcesses || place.ruined || place.active === false) return;
  if (
    place.knownProcesses.includes("writing") &&
    !place.knownProcesses.includes("governance") &&
    settlementPopulation(place) >= FIELDS_HALL_POP &&
    !fieldsCount(place, "hall") &&
    activeBuildings(place).length < FIELDS_ACTIVE_CAP
  )
    planBuilding(place, "hall", Math.max(3, place.management?.priorities?.governance || 3));
};
// A crowded masonry town raises tenements before the annals call it a city.
const wantsTenementFieldsBase = wantsTenement;
wantsTenement = function (place) {
  if (wantsTenementFieldsBase(place)) return true;
  if (!place?.knownProcesses || place.ruined || !place.knownProcesses.includes("masonry")) return false;
  if (place.knownProcesses.includes("electricity")) return false;
  const pop = settlementPopulation(place);
  if (pop < FIELDS_TENEMENT_POP || housingCapacity(place) >= pop) return false;
  return !W.buildings.some((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === place.id && b.type === "tenement" && !b.complete);
};
window.ALIFE_FIELDS_DEBUG = Object.freeze({
  desiredFarms: (placeId) => {
    const s = W.settlements.find((x) => x.id === placeId);
    return s ? clamp(Math.ceil(settlementPopulation(s) / GRANARY_PEOPLE_PER_FARM), 1, GRANARY_MAX_FARMS) : 0;
  },
  farms: (placeId) => fieldsCount(W.settlements.find((x) => x.id === placeId) || { id: 0 }, "farm"),
  maxFarms: () => GRANARY_MAX_FARMS,
  wantsHall: (placeId) => {
    const s = W.settlements.find((x) => x.id === placeId);
    return !!s && s.knownProcesses.includes("writing") && settlementPopulation(s) >= FIELDS_HALL_POP;
  },
});
