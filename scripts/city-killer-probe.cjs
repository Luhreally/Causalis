// What kills a city that has everything?
//
// On causal-origin small a world now holds a stable city of forty, meets every
// condition of the modern stage, completes its launch tower — and then falls
// from a hundred and fourteen people to thirty-eight in two presses. The
// existing probes could not say why: `historicalIdentities` keeps only the
// notable, so it recorded one death in four, and the event log is pruned at
// four thousand two hundred, so counting a whole press loses most of them.
//
// This runs the skip a year at a time through the collapse and collects every
// DeathEvent as it happens, with the cause and the age it happened at, beside
// the city's own food and hunger. A cause with a young average age is a world
// killing its people; a cause with an old one is a world that simply stopped
// replacing them.
//
// node scripts/city-killer-probe.cjs <seed> <size> <complexity> <quiet> <watch>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "small",
  complexity = process.argv[4] || "lean",
  quiet = Number(process.argv[5] || 10),
  watch = Number(process.argv[6] || 10);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, quiet, watch }));
for (let i = 0; i < year * 30; i++) tick();

// Run quietly up to the window, so the watched part is the interesting part.
for (let press = 1; press <= quiet; press++) {
  const row = JSON.parse(
    rt.get(`(() => {
    const r = runCausalSkipForDebug();
    return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR),
      people: modernLivingPeople(), stop: r.stopReason });
  })()`),
  );
  console.log(JSON.stringify({ press, ...row }));
}

rt.get(`(() => { globalThis.__floor = W.nextEventId; return "1"; })()`);

// A year at a time, inside the skip, collecting the dead as they fall.
const aYear = `(() => {
  const state = globalThis.__state || (globalThis.__state = makeCausalSkipState());
  const stop = W.tick + ${year};
  while (W.tick < stop && !state.done) causalSkipStep(state);
  if (state.done) globalThis.__state = makeCausalSkipState();
  const byCause = {};
  for (const e of W.events) {
    if (e.id < globalThis.__floor || e.type !== "DeathEvent") continue;
    if (e.data?.kind !== KINDS.PERSON) continue;
    const cause = String(e.evidence?.[0] || "?").slice(0, 30),
      slot = (byCause[cause] = byCause[cause] || { n: 0, age: 0 });
    slot.n++;
    slot.age += (e.data?.age || 0) / TICKS_PER_YEAR;
  }
  globalThis.__floor = W.nextEventId;
  const towns = W.settlements.filter((s) => !s.ruined)
    .sort((a, b) => settlementPopulation(b) - settlementPopulation(a)).slice(0, 2)
    .map((s) => {
      const residents = granaryResidents(s);
      let hungry = 0, wounded = 0, infected = 0;
      for (const id of residents) {
        const l = W.components.life[id];
        if (!l) continue;
        if (l.hunger > 60) hungry++;
        if (l.wounded) wounded++;
        if (l.infected) infected++;
      }
      return { name: s.name.slice(0, 10), pop: settlementPopulation(s),
        food: +settlementFood(s).toFixed(0), store: s.inventory[C.ORGANIC] || 0,
        hungry: residents.length ? +(hungry / residents.length).toFixed(2) : 0,
        wounded, infected, stability: +(s.stability || 0).toFixed(2) };
    });
  const deaths = Object.entries(byCause)
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 6)
    .map(([k, v]) => k + " x" + v.n + " @" + (v.age / v.n).toFixed(0) + "y");
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR),
    people: modernLivingPeople(), born: W.events.filter((e) => e.type === "BirthEvent").length,
    wars: W.activeWars.filter((w) => !w.ended).length,
    died: Object.values(byCause).reduce((n, v) => n + v.n, 0), deaths, towns });
})()`;

for (let n = 1; n <= watch * 24; n++) {
  const row = JSON.parse(rt.get(aYear));
  const towns = row.towns
    .map((t) => `${t.name} p${t.pop} f${t.food} s${t.store} h${t.hungry} w${t.wounded} i${t.infected} st${t.stability}`)
    .join(" | ");
  console.log(
    `y${String(row.year).padStart(4)} ppl${String(row.people).padStart(4)} died${String(row.died).padStart(4)} wars${row.wars} :: ${row.deaths.join(", ")} :: ${towns}`,
  );
  if (row.people < 12) break;
}
