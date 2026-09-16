// What the launch site is missing.
//
// A world whose wants are all met can still run whole horizons with "the site
// does not know starflight" and "the site has no completed launch tower": on
// phone causal-origin the site held those two blockers from year 73 to year
// 265 while its people fell from 61 to 12. This presses a generated world to
// a year and reads the site: its people and stability, what it knows of the
// starflight chain and the next step the push would take, whether it holds
// the facility that step wants and what its unfinished buildings still wait
// for, its store of the scarce materials, its research progress on the chain,
// and the world's wants, so the blocker is named rather than inferred.
//
// node scripts/site-probe.cjs <seed:size:complexity> <year>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime();
const [seed = "causal-origin", size = "phone", complexity = "lean"] = (process.argv[2] || "causal-origin:phone:lean").split(":");
const target = Number(process.argv[3] || 100);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"), year = rt.get("TICKS_PER_YEAR");
for (let i = 0; i < year * 30; i++) tick();
console.log(JSON.stringify({ seed, size, complexity, target }));
rt.get(`(() => { for (let p = 0; p < 400 && Math.floor(W.tick / TICKS_PER_YEAR) < ${target}; p++) { const state = makeCausalSkipState(); while (Math.floor(W.tick / TICKS_PER_YEAR) < ${target} && !state.done) causalSkipStep(state); } return 1; })()`);
console.log(rt.get(`(() => {
  const spName = (sp) => W.definitions.species[sp]?.name || ("sp" + sp);
  const site = modernLaunchSite();
  if (!site) return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), site: null });
  const chain = ["astronomy", "starflight"], known = chain.filter((t) => site.knownProcesses.includes(t));
  const step = typeof causalNextStep === "function" ? causalNextStep(site, "starflight") : null;
  const facility = step && typeof facilityForTechnology === "function" ? facilityForTechnology(step.id) : null;
  const unfinished = W.buildings.filter((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === site.id && !b.complete).map((b) => { const m = typeof missingBuildingMaterial === "function" ? missingBuildingMaterial(b) : null; return b.type + " s" + b.stage + (m ? " wants " + m.needed + " " + spName(m.sp) : " stocked") + " hands" + W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && W.components.work?.[id]?.buildingId === b.id).length; });
  const finished = {}; for (const b of W.buildings) if (!b.ruined && b.complete && b.placeKind === "settlement" && b.placeId === site.id) finished[b.type] = (finished[b.type] || 0) + 1;
  const store = {}; for (const sp of [C.ORGANIC, C.FIBER, C.MINERAL, C.METAL, C.ORE, C.FUEL, C.CERAMIC, C.CATALYST, C.CRYSTAL, C.GLASS, C.INFO, C.PIGMENT]) store[spName(sp)] = site.inventory[sp] || 0;
  const progress = {}; for (const t of [...(step ? [step.id] : []), ...chain]) progress[t] = { progress: +(site.researchProgress?.[t] || 0).toFixed(1), threshold: typeof researchThreshold === "function" && typeof technologyDefinition === "function" ? researchThreshold(technologyDefinition(t) || {}) : null };
  const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses).map((s) => s.name.slice(0, 9) + ":" + settlementPopulation(s) + (s.id === site.id ? "*" : "") + " f" + s.factionId + " " + (s.stage || "") + " knows[" + chain.filter((t) => s.knownProcesses.includes(t)).join(",") + "]" + " towers" + completedBuildings(s, "launch_tower").length + " obs" + completedBuildings(s, "observatory").length + " blocks" + (completedBuildings(s, "tower").length + completedBuildings(s, "office").length));
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), site: { name: site.name, pop: settlementPopulation(site), stability: +(site.stability || 0).toFixed(2), stage: site.stage, faction: site.factionId, known, step: step ? { id: step.id, heat: step.heat || 0, materials: (step.materials || []).map(spName) } : null, facility, hasFacility: facility ? placeHasFacility(site, facility) : null, unfinished, finished, store, progress, focus: site.researchFocus || null }, blockers: modernLaunchBlockers().blockers, wants: window.ALIFE_MODERN_DEBUG.wants(), target: causalTarget()?.key || null, towns }, null, 0);
})()`));
