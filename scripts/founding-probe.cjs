// Why a world has one town.
//
// Variety-22 in the thirty-seed sweep of HANDOFF section 18 stood at the
// modern gate with seventy-three people, twenty of them in its one town and
// the rest in no town at all. This presses a world the way the sweeps do and
// reads, press by press: the living towns with their people, stability and
// flag; the camps with their people, their age, and which of the three
// buildings a camp needs to become a town (a shelter, a stockpile, a hearth)
// they have; the people by the kind of place they call home; whether the
// world has room for another place (68: one place for every fourteen people,
// and the camp cap); the towns that could send settlers and why they do not
// (below the settler line, unstable, on cooldown, no site); the expeditions
// under way; and the founding events since the last press. One JSON row per
// press.
//
// node scripts/founding-probe.cjs <seed:size:complexity> <presses>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime();
const [seed = "variety-22", size = "battery", complexity = "lean"] = (
  process.argv[2] || "variety-22:battery:lean"
).split(":");
const presses = Number(process.argv[3] || 40);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
for (let i = 0; i < year * 30; i++) tick();
console.log(JSON.stringify({ seed, size, complexity, presses }));
rt.get(`globalThis.__found = { floor: W.nextEventId }; 1`);
for (let press = 1; press <= presses; press++) {
  const row = rt.get(`(() => {
    const state = makeCausalSkipState();
    while (!state.done) causalSkipStep(state);
    const f = globalThis.__found, events = {};
    for (const e of W.events) { if (e.id < f.floor) continue; if (/Camp|Settle|Settler|Expedition|Found|Abandon|Destroyed/.test(e.type)) events[e.type] = (events[e.type] || 0) + 1; }
    f.floor = W.nextEventId;
    const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
    const byHome = { settlement: 0, camp: 0, none: 0 };
    for (const id of people) { const h = W.components.social[id]?.homePlaceKind; byHome[h === "settlement" || h === "camp" ? h : "none"]++; }
    const towns = W.settlements.filter((s) => !s.ruined).map((s) => {
      const pop = settlementPopulation(s), why = [];
      const line = typeof settlerLine === "function" ? settlerLine() : SETTLER_MIN_POP; if (pop < line) why.push("below settler line " + pop + "/" + line);
      if ((s.stability || 0) < 0.35) why.push("unstable " + (s.stability || 0).toFixed(2));
      if (typeof worldHasRoomForPlaces === "function" && !worldHasRoomForPlaces()) why.push("no room for places");
      if (W.tick - (s.lastSettlersTick || -99999) < SETTLER_COOLDOWN) why.push("cooldown");
      if (W.camps.filter((c) => c.active).length >= CAPS.camp) why.push("camp cap " + CAPS.camp);
      if (W.expeditions?.some((e) => e.active && e.from === s.id)) why.push("expedition out");
      if (!why.length && typeof settlerSite === "function" && settlerSite(s) < 0) why.push("no site");
      return { name: s.name.slice(0, 10), pop, stab: +(s.stability || 0).toFixed(2), faction: s.factionId, city: typeof cityStage === "function" ? !!cityStage(s) : null, settlers: why.length ? why.join("; ") : "could send" };
    });
    const camps = W.camps.filter((c) => c.active).map((c) => { const ti = idx(c.x, c.y), near = entityAtRadius(ti, 6, KINDS.PERSON).filter(classifyAlive).length; return { people: near, age: Math.floor((W.tick - (c.foundedTick || c.createdTick || 0)) / TICKS_PER_YEAR), stable: c.stableTicks, shelter: completedBuildings(c, "shelter").length, stockpile: completedBuildings(c, "stockpile").length, hearth: completedBuildings(c, "hearth").length, integrity: c.structure?.integrity }; });
    return JSON.stringify({ press: ${press}, year: Math.floor(W.tick / TICKS_PER_YEAR), stop: state.done, people: people.length, byHome, towns, ruinedTowns: W.settlements.filter((s) => s.ruined).length, camps, room: typeof worldHasRoomForPlaces === "function" ? worldHasRoomForPlaces() : null, placesPerPeople: typeof PLACE_PEOPLE_PER_TOWN !== "undefined" ? PLACE_PEOPLE_PER_TOWN : null, campCap: CAPS.camp, expeditions: (W.expeditions || []).filter((e) => e.active).length, events, target: causalTarget()?.key || null, ships: W.ascensions.length });
  })()`);
  console.log(row);
  if (/"ships":[1-9]/.test(row)) break;
}
