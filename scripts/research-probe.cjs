// Why does the effort's research never finish on a small world?
//
// On battery causal-origin the skip's objective sat on "stewardship" from year
// a hundred and nineteen to a hundred and twenty-six, pushing research
// thirty-two times, while the tower blocks the modern gate wanted stood
// unsupplied; a push lifts notes to ninety-five in a hundred of the threshold
// and the town must find the rest itself. This reads, a year at a time inside
// the skip, what the effort is pushing and why the town does not close it: the
// lead town the push goes to, the step the tech resolves to, the facility that
// step wants and whether it stands, the materials it wants and whether the
// town holds them, notes against threshold, and the town's stability and hands.
//
// node scripts/research-probe.cjs <seed> <size> <complexity> <quiet> <years> [tech]
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "battery",
  complexity = process.argv[4] || "lean",
  quiet = Number(process.argv[5] || 11),
  years = Number(process.argv[6] || 6),
  techId = process.argv[7] || "planetary_stewardship";
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, quiet, years, techId }));
for (let i = 0; i < year * 30; i++) tick();
for (let press = 1; press <= quiet; press++) {
  const row = JSON.parse(
    rt.get(
      `(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), people: modernLivingPeople(), stop: r.stopReason }); })()`,
    ),
  );
  console.log(JSON.stringify({ press, ...row }));
}
const aYear = `(() => {
  const state = globalThis.__state || (globalThis.__state = makeCausalSkipState());
  const stop = W.tick + ${year};
  while (W.tick < stop && !state.done) causalSkipStep(state);
  const stopReason = state.done ? state.stopReason : null, pending0 = state.pending?.[0]?.key || null, target = causalTarget();
  if (state.done) globalThis.__state = makeCausalSkipState();
  const spName = Object.fromEntries(Object.entries(C).map(([k, v]) => [v, k]));
  const lead = causalLeadSettlement();
  const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses)
    .sort((a, b) => settlementPopulation(b) - settlementPopulation(a)).slice(0, 3)
    .map((s) => {
      const step = causalNextStep(s, ${JSON.stringify(techId)}),
        facility = step ? facilityForTechnology(step.id) : null,
        standing = facility ? W.buildings.filter((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === s.id && b.type === facility) : [],
        site = standing.find((b) => !b.complete),
        miss = site ? missingBuildingMaterial(site) : null,
        prog = step ? (s.researchProgress?.[step.id] || 0) : 0,
        thr = step ? researchThreshold(step) : 0,
        priorsMissing = step ? (step.prior || []).filter((p) => !s.knownProcesses.includes(p)) : [],
        mats = step ? (step.materials || []).map((m) => spName[m] + (hasResearchMaterial(s, m) ? "+" : "-") + (s.researchInventory?.[m] || 0)) : [],
        hands = entityAtRadius(idx(s.x, s.y), 8, KINDS.PERSON).filter((id) => workState(id).task === "craft" || W.components.cognition[id]?.dominant === "work").length;
      return { name: s.name.slice(0, 10), pop: settlementPopulation(s), lead: lead === s, stab: +(s.stability || 0).toFixed(2),
        knows: s.knownProcesses.length, focus: s.researchFocus || null, step: step ? step.id : "KNOWN",
        facility, has: facility ? placeHasFacility(s, facility) : null,
        site: site ? "s" + site.stage + (miss ? " needs " + miss.needed + " " + spName[miss.sp] : " stocked") : (standing.length ? "done" : "none"),
        priorsMissing, mats, notes: +prog.toFixed(1) + "/" + thr, hands, near: entityAtRadius(idx(s.x, s.y), 8, KINDS.PERSON).length };
    });
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), people: modernLivingPeople(), stage: pending0, stop: stopReason,
    target: target ? target.key + "#" + target.pushes : null, shortfall: modernShortfall().map((m) => m.slice(0, 22)), towns });
})()`;
for (let n = 1; n <= years; n++) {
  const row = JSON.parse(rt.get(aYear));
  console.log(
    `y${String(row.year).padStart(4)} ppl${String(row.people).padStart(3)} stage=${row.stage} stop=${row.stop} target=${row.target} short=${JSON.stringify(row.shortfall)}`,
  );
  for (const t of row.towns)
    console.log(
      `     ${t.name.padEnd(10)} p${String(t.pop).padStart(3)}${t.lead ? " LEAD" : "     "} stab${t.stab} knows${t.knows} focus=${t.focus} step=${t.step} facility=${t.facility}:${t.has ? "has" : "NO"} site=${t.site} priorsMissing=${JSON.stringify(t.priorsMissing)} mats=${JSON.stringify(t.mats)} notes=${t.notes} hands${t.hands}/${t.near}`,
    );
  if (row.people < 6) break;
}
