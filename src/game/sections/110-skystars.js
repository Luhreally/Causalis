// ═══════════════════════════════════════════════════════════════════════════
// 110. THE SKYLINE BEFORE THE STARS — no ship leaves a city of cottages
// ═══════════════════════════════════════════════════════════════════════════
// A city could reach Starflight and send a ship away while its skyline was
// still cottages: tower blocks were planned only when beds ran short, offices
// only beside a market, and the Causal skip pushed straight for the launch
// tower. So the first ship rose over a village, and worlds saved under older
// rules kept Starflight without the engines and current it now rests on. Now
// a city that knows Electricity, Mechanization, and masonry raises tower
// blocks as a matter of course, one for every thirty people, and no ship
// leaves until the city has a skyline (a tower block or an office) and a
// working factory; the launch tower may rise meanwhile, and the Causal skip
// raises the skyline and the works first.
// And when a world is loaded, every town that knows a craft without its
// foundations is granted them, so an old world's Starflight brings the
// Combustion Engines and current it always implied, and the cars that come
// with them. Rendering only reads.
const SKYSTARS_TOWER_PER_PEOPLE = 30,
  SKYSTARS_SKYLINE_TYPES = Object.freeze(["tower", "office"]),
  SKYSTARS = { mended: 0 };
function skystarsCount(place, type, includeActive = false) {
  return W.buildings.filter(
    (b) => !b.ruined && b.placeKind === "settlement" && b.placeId === place.id && b.type === type && (includeActive || b.complete),
  ).length;
}
function hasSkyline(place) {
  return SKYSTARS_SKYLINE_TYPES.some((t) => skystarsCount(place, t) > 0);
}
function hasWorks(place) {
  return skystarsCount(place, "factory") > 0;
}
// ── Towers rise with the crowd, not only with the shortage ───────────────────
function towersWanted(place) {
  return Math.max(1, Math.floor(settlementPopulation(place) / SKYSTARS_TOWER_PER_PEOPLE));
}
const wantsTowerSkystarsBase = wantsTower;
wantsTower = function (place) {
  if (wantsTowerSkystarsBase(place)) return true;
  if (!place?.knownProcesses || place.ruined) return false;
  if (typeof cityStage !== "function" || !cityStage(place)) return false;
  if (!["electricity", "mechanization", "masonry"].every((t) => place.knownProcesses.includes(t))) return false;
  return skystarsCount(place, "tower", true) < towersWanted(place);
};
// ── No ship leaves without a skyline and a works ─────────────────────────────
// The launch tower may be planned while the skyline rises; the ship waits.
function voyageShortfall(place) {
  const missing = [];
  if (!place?.knownProcesses) return ["a town"];
  if (!hasSkyline(place)) missing.push("a skyline (a tower block or an office)");
  if (!hasWorks(place)) missing.push("a working factory");
  return missing;
}
// A ship leaves only a city with a skyline and a works, unless forced.
const launchShipSkystarsBase = launchShip;
launchShip = function (place, force = false) {
  if (!force && place?.knownProcesses && (!hasSkyline(place) || !hasWorks(place))) return null;
  return launchShipSkystarsBase(place, force);
};
const orbitalShortfallSkystarsBase = orbitalShortfall;
orbitalShortfall = function () {
  const missing = orbitalShortfallSkystarsBase(),
    towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses && typeof cityStage === "function" && cityStage(s));
  if (towns.length && !towns.some(hasSkyline)) missing.push("raise a skyline (a tower block or an office) in a city");
  if (towns.length && !towns.some(hasWorks)) missing.push("complete a factory in a city");
  return missing;
};
// The Causal skip raises the skyline and the works before the launch tower.
const causalPushTowardSkystarsBase = causalPushToward;
causalPushToward = function (target = causalTarget()) {
  if (target?.key === "voyage" && typeof causalLeadSettlement === "function") {
    const lead = causalLeadSettlement();
    if (lead && typeof cityStage === "function" && cityStage(lead)) {
      const pushes = (target.pushes || 0) + 1;
      if (!hasSkyline(lead) && ["electricity", "mechanization", "masonry"].every((t) => lead.knownProcesses.includes(t))) {
        target.pushes = pushes;
        causalPushBuilding(lead, lead.knownProcesses.includes("computing") && placeHasFacility(lead, "market") ? "office" : "tower", pushes);
        return "skyline";
      }
      if (!hasWorks(lead) && ["electricity", "mechanization"].every((t) => lead.knownProcesses.includes(t))) {
        target.pushes = pushes;
        causalPushBuilding(lead, "factory", pushes);
        return "works";
      }
    }
  }
  return causalPushTowardSkystarsBase(target);
};
// ── Knowledge implies its foundations ────────────────────────────────────────
function mendFoundations(world = W) {
  if (!world?.settlements) return 0;
  let added = 0;
  for (const s of world.settlements) {
    if (s.ruined || !s.knownProcesses) continue;
    const known = new Set(s.knownProcesses),
      queue = s.knownProcesses.slice();
    while (queue.length) {
      const def = technologyDefinition(queue.pop());
      for (const prior of def?.prior || [])
        if (!known.has(prior)) {
          known.add(prior);
          s.knownProcesses.push(prior);
          queue.push(prior);
          added++;
        }
    }
  }
  SKYSTARS.mended += added;
  return added;
}
const restoreWorldSkystarsBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldSkystarsBase();
  if (W) mendFoundations(W);
};
window.ALIFE_SKYSTARS_DEBUG = Object.freeze({
  skyline: (placeId) => hasSkyline(W.settlements.find((s) => s.id === placeId)),
  shortfall: (placeId) => voyageShortfall(W.settlements.find((s) => s.id === placeId)),
  works: (placeId) => hasWorks(W.settlements.find((s) => s.id === placeId)),
  towersWanted: (placeId) => towersWanted(W.settlements.find((s) => s.id === placeId)),
  push: (placeId) => {
    const s = W.settlements.find((x) => x.id === placeId);
    if (!s) return null;
    if (!hasSkyline(s)) return causalPushBuilding(s, s.knownProcesses.includes("computing") && placeHasFacility(s, "market") ? "office" : "tower", 1) ? "skyline" : null;
    if (!hasWorks(s)) return causalPushBuilding(s, "factory", 1) ? "works" : null;
    return "ready";
  },
  mend: () => mendFoundations(W),
  mended: () => SKYSTARS.mended,
});
