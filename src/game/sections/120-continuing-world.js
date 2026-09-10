// 120. A CONTINUING WORLD — growing towns can catch their breath; inquiry goes on.
// Labour in a crisis and the pace of having children are different decisions.
// Keep the early growth that gets a small world to its cities. Once it has half
// again the people its modern gate needs, a crowded city keeps a gentler pace
// unless its stores can carry the next generation. The old famine brake remains.
let continuingCensusCache = { world: null, tick: -1, people: 0 };
const CONTINUING = { paced: 0, researchPushes: 0 };
function continuingBirthLimit(id) {
  if (continuingCensusCache.world !== W || continuingCensusCache.tick !== W.tick) {
    continuingCensusCache = { world: W, tick: W.tick, people: modernPeople() };
  }
  if (continuingCensusCache.people < Math.ceil(modernPeopleWanted() * 1.5)) return 5;
  const town = homeSettlementOf(id);
  if (!town || !cityStage(town) || settlementPopulation(town) < urbanGate().local) return 5;
  const outlook = foodOutlook(town);
  return outlook && outlook.food < HASTE_FOOD * 2 ? 2 : 5;
}
const concertedBirthHasteContinuingBase = concertedBirthHaste;
concertedBirthHaste = function (id, life) {
  const base = concertedBirthHasteContinuingBase(id, life);
  if (base > 1 && homeSettlementOf(id)?.causalReliefUntil > W.tick) {
    CONTINUING.reliefPaced = (CONTINUING.reliefPaced || 0) + 1;
    return 1;
  }
  if (base <= 2) return base;
  const limit = continuingBirthLimit(id);
  if (limit < base) CONTINUING.paced++;
  return Math.min(base, limit);
};

// Relief keeps the people already here alive. It is not a harvest surplus to
// hurry another child: feeding a lean town without this distinction previously
// made the overshoot worse. Only cities in famine receive the larger ration.
const modernFeedContinuingBase = modernFeedTheEffort;
modernFeedTheEffort = function (pushes) {
  const towns = worldTowns(), before = new Map(towns.map((s) => [s.id, s.inventory[C.ORGANIC] || 0]));
  modernFeedContinuingBase(pushes);
  for (const s of towns) {
    if (!cityStage(s)) continue;
    const outlook = foodOutlook(s);
    if (!outlook?.famine) continue;
    const want = Math.min(65535, seedReserve(s) + Math.ceil(outlook.pop * 12)),
      actual = Math.max(0, want - (s.inventory[C.ORGANIC] || 0));
    if (!actual) continue;
    s.inventory[C.ORGANIC] += actual;
    causalPushInput(actual);
    s.causalReliefUntil = W.tick + 256;
    CONTINUING.relief = (CONTINUING.relief || 0) + actual;
  }
  return towns.filter((s) => (s.inventory[C.ORGANIC] || 0) > before.get(s.id)).length;
};

// The ship is a beginning. These are actual crafts with materials, facilities,
// prerequisites and effects, not a second progress counter beside the science.
const CONTINUING_CRAFTS = Object.freeze([
  "refrigeration", "hydroponics", "antibiotics", "global_networks",
  "composites", "gene_therapy", "artificial_minds",
  ...BRANCH_ALL_DEFS.filter((d) => d.id.startsWith("frontier_")).map((d) => d.id),
]);
function continuingKnows(id) {
  return W.settlements.some((s) => !s.ruined && s.knownProcesses.includes(id)) ||
    (W.colonies || []).some((c) => (c.knownProcesses || []).includes(id));
}
function continuingResearchTown(id) {
  const depth = (s, tech, seen = new Set()) => {
    if (s.knownProcesses.includes(tech) || seen.has(tech)) return 0;
    seen.add(tech);
    return 1 + (technologyDefinition(tech)?.prior || []).reduce((n, p) => n + depth(s, p, seen), 0);
  };
  return W.settlements.filter((s) => !s.ruined && s.knownProcesses)
    .map((s) => ({ s, missing: depth(s, id) }))
    .sort((a, b) => a.missing - b.missing || b.s.knownProcesses.length - a.s.knownProcesses.length || a.s.id - b.s.id)[0]?.s || null;
}
const causalSkipMicroStagesContinuingBase = causalSkipMicroStages;
causalSkipMicroStages = function () {
  const stages = causalSkipMicroStagesContinuingBase();
  if (!continuingKnows("starflight")) return stages;
  const inquiry = CONTINUING_CRAFTS.map((id) => ({
    key: `inquiry:${id}`, label: technologyDefinition(id)?.name || id,
    done: () => continuingKnows(id),
  }));
  // An expedition's transit years are time for research at home. Retain the
  // colony milestone as well, so arriving still brings news.
  const at = stages.findIndex((s) => s.key === "colony");
  return at < 0 ? [...stages, ...inquiry] : [...stages.slice(0, at), ...inquiry, ...stages.slice(at)];
};
const causalPushTowardContinuingBase = causalPushToward;
causalPushToward = function (target = causalTarget()) {
  if (!target?.key?.startsWith("inquiry:")) return causalPushTowardContinuingBase(target);
  const id = target.key.slice(8), place = continuingResearchTown(id);
  if (!CONTINUING_CRAFTS.includes(id) || !place) return null;
  target.pushes = (target.pushes || 0) + 1;
  modernFeedTheEffort(target.pushes);
  if (causalPushResearch(place, id, target.pushes)) CONTINUING.researchPushes++;
  return target.key;
};
window.ALIFE_CONTINUING_DEBUG = Object.freeze({
  birthLimit: (id) => continuingBirthLimit(id),
  counts: () => ({ ...CONTINUING }),
  crafts: () => CONTINUING_CRAFTS.map((id) => ({ id, known: continuingKnows(id), town: continuingResearchTown(id)?.id || 0 })),
});
