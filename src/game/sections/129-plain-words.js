// ═══════════════════════════════════════════════════════════════════════════
// 129. PLAIN WORDS — the skip says what is stopping it, not only what it wants
// ═══════════════════════════════════════════════════════════════════════════
// A press that ends on its horizon tells the player what the next stage still
// needs: "16 tower blocks or offices · a paved road or rail between two
// towns". Every fault found on the road to a launch sat behind one of those
// lines for years — two blocks stocked with fifteen hands assigned and none
// able to reach the face; a launch tower that could not be sited in a full
// city; a site studying Starflight at eighty-five notes of ninety with no
// tower to study it at; a city two-thirds hungry — and every one was visible
// only through a probe. The same readings now follow each shortfall in
// parentheses, in the words a player can act on.
//
// Everything here reads. The gate status is shown in the world pane as well
// as at the end of a press, so nothing in it may write the world: the launch
// site is read from the held id rather than chosen, and no plot is sought.
// A reading that fails for any reason leaves the line as it was.
const PLAIN_WORDS_HUNGRY = 0.25,
  PLAIN_WORDS_STUCK = 8;
function plainWordsTowns() {
  return W.settlements.filter((s) => !s.ruined && s.knownProcesses);
}
function plainWordsSite() {
  const towns = plainWordsTowns(),
    held = towns.find((t) => t.id === W.causalLaunchSiteId);
  if (held) return held;
  return towns
    .filter((t) => typeof cityStage === "function" && cityStage(t))
    .sort((a, b) => settlementPopulation(b) - settlementPopulation(a) || a.id - b.id)[0] || towns[0] || null;
}
function plainWordsSpecies(sp) {
  return (W.definitions?.species?.[sp]?.name || "material").toLowerCase();
}
// The state of an unfinished block: what it lacks, or who is on it.
function plainWordsBlock(b) {
  const missing = typeof missingBuildingMaterial === "function" ? missingBuildingMaterial(b) : null;
  if (missing) return `needs ${missing.needed} ${plainWordsSpecies(missing.sp)}`;
  let assigned = 0,
    near = 0,
    stuck = 0;
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON) continue;
    const w = W.components.work?.[id];
    if (!w || w.buildingId !== b.id) continue;
    assigned++;
    const p = W.components.position[id];
    if (p && dist2(p.x, p.y, b.x, b.y) <= 2) near++;
    if ((w.travelStuckTicks || 0) >= PLAIN_WORDS_STUCK || (w.blockedUntil || 0) > W.tick) stuck++;
  }
  if (!assigned) return "stocked, nobody is working on it";
  if (!near && stuck) return `stocked, ${assigned} hands cannot reach it`;
  return `stocked, ${assigned} hand${assigned === 1 ? "" : "s"} at work`;
}
function plainWordsBlocks(types, wanted) {
  const towns = plainWordsTowns(),
    standing = towns.reduce((n, s) => n + types.reduce((m, t) => m + completedBuildings(s, t).length, 0), 0),
    rising = W.buildings.filter(
      (b) => !b.ruined && !b.complete && b.placeKind === "settlement" && types.includes(b.type) && towns.some((s) => s.id === b.placeId),
    );
  if (!rising.length)
    return `${standing} of ${wanted} standing; none is rising — no city has planned one, which usually means no plot is free`;
  const first = rising.slice().sort((a, b) => b.stage - a.stage || a.id - b.id)[0],
    city = towns.find((s) => s.id === first.placeId);
  return `${standing} of ${wanted} standing, ${rising.length} rising; the furthest along, at ${city?.name || "a city"}, ${plainWordsBlock(first)}`;
}
function plainWordsHunger() {
  let worst = null;
  for (const s of plainWordsTowns()) {
    const share = typeof hungryShare === "function" ? hungryShare(s) : 0;
    if (share > PLAIN_WORDS_HUNGRY && (!worst || share > worst.share)) worst = { s, share };
  }
  return worst ? `${worst.s.name} is ${Math.round(worst.share * 10)} in 10 hungry` : null;
}
function plainWordsCities() {
  const gate = typeof urbanGate === "function" ? urbanGate().local : 24,
    towns = plainWordsTowns().sort((a, b) => settlementPopulation(b) - settlementPopulation(a) || a.id - b.id).slice(0, 2);
  if (!towns.length) return "no town stands";
  return `${towns.map((s) => `${s.name} holds ${settlementPopulation(s)}`).join(", ")}; a city is ${gate}`;
}
function plainWordsRoad() {
  const links = W.roads?.links || [],
    open = links.find((l) => !l.complete && !l.abandoned);
  if (open) return `a road of ${open.path?.length || 0} tiles is ${open.paved || 0} tiles laid`;
  const towns = plainWordsTowns();
  if (!towns.some((s) => s.knownProcesses.includes("road_building"))) return "no town knows road building yet";
  return "no road has been started";
}
function plainWordsStudy(site, techId) {
  if (!site || typeof causalNextStep !== "function") return null;
  const step = causalNextStep(site, techId);
  if (!step) return `${site.name} knows it`;
  const facility = typeof facilityForTechnology === "function" ? facilityForTechnology(step.id) : null,
    notes = site.researchProgress?.[step.id] || 0,
    threshold = typeof researchThreshold === "function" ? researchThreshold(step) : step.threshold || 0,
    lacks = facility && !placeHasFacility(site, facility) ? `, and has no ${facility.replace(/_/g, " ")} to study it at` : "";
  return `${site.name} is on ${step.name || step.id}, ${Math.round(notes)} of ${threshold} notes${lacks}`;
}
function plainWordsTower(site) {
  if (!site) return "no site";
  const rising = W.buildings.find((b) => !b.ruined && !b.complete && b.placeKind === "settlement" && b.placeId === site.id && b.type === "launch_tower");
  if (rising) return `${site.name}'s tower ${plainWordsBlock(rising)}`;
  return `none is planned at ${site.name}, which usually means no plot is free`;
}
function plainWordsShip(site) {
  if (!site) return "no site";
  const why = [];
  if (!site.knownProcesses.includes("starflight")) why.push("does not know Starflight");
  if ((site.stability || 0) < 0.35) why.push(`stands at stability ${(site.stability || 0).toFixed(2)}`);
  if (typeof cityStage === "function" && !cityStage(site)) why.push("is not a city");
  if (typeof hasSkyline === "function" && !hasSkyline(site)) why.push("has no tower block of its own");
  if (typeof hasWorks === "function" && !hasWorks(site)) why.push("has no factory of its own");
  return why.length ? `${site.name} ${why.join(", ")}` : `${site.name} is ready; the world's own shortfalls hold it`;
}
function plainWordsFor(line) {
  const site = plainWordsSite();
  let why = null;
  if (/tower blocks or offices/.test(line)) why = plainWordsBlocks(["tower", "office"], typeof modernSkylineWanted === "function" ? modernSkylineWanted() : "?");
  else if (/apartment blocks/.test(line)) why = plainWordsBlocks(["tenement"], typeof modernHomesWanted === "function" ? modernHomesWanted() : "?");
  else if (/working factor/.test(line)) why = plainWordsBlocks(["factory"], typeof modernWorksWanted === "function" ? modernWorksWanted() : "?");
  else if (/people living in towns/.test(line)) why = plainWordsHunger() || `towns hold ${plainWordsTowns().reduce((n, s) => n + settlementPopulation(s), 0)}`;
  else if (/cities at the urban stage/.test(line)) why = plainWordsCities();
  else if (/paved road or rail/.test(line)) why = plainWordsRoad();
  else if (/[Ss]tarflight/.test(line)) why = plainWordsStudy(site, "starflight");
  else if (/[Ll]aunch tower/.test(line)) why = plainWordsTower(site);
  else if (/launch the first ship/.test(line)) why = plainWordsShip(site);
  else if (/Planetary Stewardship|Mechanization|Electricity|Astronomy/.test(line)) {
    const tech = /Stewardship/.test(line) ? "planetary_stewardship" : /Mechanization/.test(line) ? "mechanization" : /Electricity/.test(line) ? "electricity" : "astronomy";
    why = plainWordsStudy(site, tech);
  }
  return why ? `${line} (${why})` : line;
}
const civilizationGateStatusPlainBase = civilizationGateStatus;
civilizationGateStatus = function () {
  const gate = civilizationGateStatusPlainBase();
  if (!gate || !Array.isArray(gate.missing) || !W?.settlements) return gate;
  try {
    gate.missing = gate.missing.map((line) => (typeof line === "string" ? plainWordsFor(line) : line));
  } catch {
    // A reading that fails leaves the lines as they were.
  }
  return gate;
};
window.ALIFE_PLAIN_WORDS_DEBUG = Object.freeze({
  explain: (line) => plainWordsFor(String(line)),
  site: () => plainWordsSite()?.name || null,
  hunger: () => plainWordsHunger(),
  blocks: (types = ["tower", "office"], wanted = 16) => plainWordsBlocks(types, wanted),
});
