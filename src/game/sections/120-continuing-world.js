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
function continuingResearchTown(id, towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses)) {
  const depth = (s, tech, seen = new Set()) => {
    if (s.knownProcesses.includes(tech) || seen.has(tech)) return 0;
    seen.add(tech);
    return 1 + (technologyDefinition(tech)?.prior || []).reduce((n, p) => n + depth(s, p, seen), 0);
  };
  return towns
    .map((s) => ({ s, missing: depth(s, id) }))
    .sort((a, b) => a.missing - b.missing || b.s.knownProcesses.length - a.s.knownProcesses.length || a.s.id - b.s.id)[0]?.s || null;
}
// ── The effort tends the sky ────────────────────────────────────────────────
// Industry lays a strain on the sky (91) that forces droughts and heat waves,
// and a heavy sky is what killed every measured home world behind its ship:
// battery causal-origin's sky reached the cap eighteen years after the launch,
// half its years were forced dry, its plants and crops died with the ground,
// and it starved from year 92 to 20 people by 117 on every variant of every
// lever behind the ship; with the forced spells off it stood at 117 people at
// year 107 with nobody starved. While the sky is hazed or worse (strain at or
// past STRAIN_EASED; the forced spells begin at 0.3, and every measured world
// launches under a sky of about one, so this is from the first press) the
// continuing inquiry leads with the crafts that ease it, Planetary
// Stewardship, Ecological Engineering and then Fusion, and a sky craft is not
// done when one town knows it: every town with engines lays its own strain,
// so the push goes on, town by town, until each straining town knows the
// craft or the sky has cleared. Stewardship is first because it is the prior
// Ecological Engineering needs and the villages never hold it: on battery
// causal-origin the two cities knew it at the launch and the three villages
// that took engines, combustion and current by teaching did not, so the
// craft that eases the sky could reach the cities and no further. Sister towns of a polity teach each other (30f); the push carries
// it across polities: once one town knows a sky craft, a push teaches it to
// a straining town that lacks it and holds the craft's priors and its
// facility, as a sister town would, and researches it only where no town can
// be taught. Without the carrying, the craft reached four or five towns of
// six while combustion and current spread to the rest by teaching, and the
// sky climbed back to the cap on causal-origin by year 94. (Leading only from
// "heavy", one, let ship-c's first twelve-year press chase refrigeration while
// its sky climbed from 0.96 to 1.73.)
const CONTINUING_SKY_CRAFTS = Object.freeze(["planetary_stewardship", "ecological_engineering", "fusion"]),
  CONTINUING_STRAINING = Object.freeze(["mechanization", "combustion", "electricity"]);
function continuingStrainingTowns() {
  return W.settlements.filter((s) => !s.ruined && s.knownProcesses && CONTINUING_STRAINING.some((t) => s.knownProcesses.includes(t)));
}
function continuingSkyStrained() {
  return typeof STRAIN_EASED === "number" && (W.afternoon?.strain || 0) >= STRAIN_EASED;
}
function continuingSkyDone(id) {
  const towns = continuingStrainingTowns();
  if (towns.length && towns.every((s) => s.knownProcesses.includes(id))) return true;
  return (W.afternoon?.strain || 0) < (typeof STRAIN_EASED === "number" ? STRAIN_EASED : 0.5) && continuingKnows(id);
}
function continuingSkyTown(id) {
  return continuingResearchTown(id, continuingStrainingTowns().filter((s) => !s.knownProcesses.includes(id)));
}
// The straining town that lacks a sky craft another town knows, holds its
// priors and its facility, and is taught it: knowledge moves, matter does not.
function continuingTeachSky(id) {
  const tech = technologyDefinition(id),
    source = W.settlements.find((s) => !s.ruined && s.knownProcesses?.includes(id));
  if (!tech || !source) return null;
  const facility = typeof facilityForTechnology === "function" ? facilityForTechnology(id) : null,
    target = continuingStrainingTowns()
      .filter((s) => !s.knownProcesses.includes(id) && (tech.prior || []).every((p) => s.knownProcesses.includes(p)) && (!facility || placeHasFacility(s, facility)))
      .sort((a, b) => settlementPopulation(b) - settlementPopulation(a) || a.id - b.id)[0];
  if (!target) return null;
  target.knownProcesses.push(id);
  target.researchProgress = target.researchProgress || {};
  target.researchProgress[id] = tech.threshold || 24;
  emitEvent("TechAdvanceEvent", {
    subjects: [source.entityId, target.entityId].filter(Boolean),
    location: idx(target.x, target.y),
    factions: [target.factionId].filter(Boolean),
    causes: [source.importantEvents?.at(-1) || W.lastEventByType.TechAdvanceEvent || 0],
    evidence: [`${source.name} carried its ${tech.name} to ${target.name} under the concerted effort`, facility ? `${BUILDING_DEFS[facility].name} reproduced the process locally` : "local practitioners reproduced the process", "knowledge moved; matter did not"],
    importance: 3,
    data: { name: tech.name, process: tech.process || "recorded civic practice", settlement: target.name, source: source.name },
  });
  return target;
}
const causalSkipMicroStagesContinuingBase = causalSkipMicroStages;
causalSkipMicroStages = function () {
  const stages = causalSkipMicroStagesContinuingBase();
  if (!continuingKnows("starflight")) return stages;
  const crafts = continuingSkyStrained() ? [...CONTINUING_SKY_CRAFTS, ...CONTINUING_CRAFTS] : [...CONTINUING_CRAFTS, ...CONTINUING_SKY_CRAFTS],
    inquiry = crafts.map((id) => ({
      key: `inquiry:${id}`, label: technologyDefinition(id)?.name || id,
      done: () => (CONTINUING_SKY_CRAFTS.includes(id) ? continuingSkyDone(id) : continuingKnows(id)),
    }));
  // An expedition's transit years are time for research at home. Retain the
  // colony milestone as well, so arriving still brings news.
  const at = stages.findIndex((s) => s.key === "colony");
  return at < 0 ? [...stages, ...inquiry] : [...stages.slice(0, at), ...inquiry, ...stages.slice(at)];
};
const causalPushTowardContinuingBase = causalPushToward;
causalPushToward = function (target = causalTarget()) {
  if (!target?.key?.startsWith("inquiry:")) return causalPushTowardContinuingBase(target);
  const id = target.key.slice(8), sky = CONTINUING_SKY_CRAFTS.includes(id), place = sky ? continuingSkyTown(id) : continuingResearchTown(id);
  if (!(sky || CONTINUING_CRAFTS.includes(id)) || !place) return null;
  target.pushes = (target.pushes || 0) + 1;
  if (sky) CONTINUING.skyPushes = (CONTINUING.skyPushes || 0) + 1;
  modernFeedTheEffort(target.pushes);
  if (sky && continuingKnows(id) && continuingTeachSky(id)) {
    CONTINUING.skyTaught = (CONTINUING.skyTaught || 0) + 1;
    return target.key;
  }
  if (causalPushResearch(place, id, target.pushes)) CONTINUING.researchPushes++;
  return target.key;
};
window.ALIFE_CONTINUING_DEBUG = Object.freeze({
  birthLimit: (id) => continuingBirthLimit(id),
  counts: () => ({ ...CONTINUING }),
  crafts: () => [...CONTINUING_CRAFTS, ...CONTINUING_SKY_CRAFTS].map((id) => ({ id, known: continuingKnows(id), town: continuingResearchTown(id)?.id || 0 })),
  sky: () => ({ strained: continuingSkyStrained(), straining: continuingStrainingTowns().map((s) => s.name), crafts: CONTINUING_SKY_CRAFTS.map((id) => ({ id, done: continuingSkyDone(id), town: continuingSkyTown(id)?.name || null })) }),
});
