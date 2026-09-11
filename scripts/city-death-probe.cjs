// Why does a finished city stop existing?
//
// Every world measured so far raises a downtown and then loses it: on
// causal-origin small, Willowwatch held thirty-three people, a hundred and
// seventy-eight of food, nobody hungry and fifteen tower blocks, and one press
// later it was not in the world at all. The launch gates are never met because
// the city that would meet them dies first, and no probe so far has said what
// killed it.
//
// This watches every settlement across a skip and reports the press in which it
// was ruined or abandoned, the events that named it in that press, and what its
// people died of — so the answer is a cause rather than a cadence.
//
// node scripts/city-death-probe.cjs <seed> <size> <complexity> <presses>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "small",
  complexity = process.argv[4] || "lean",
  presses = Number(process.argv[5] || 20);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, presses }));
for (let i = 0; i < year * 30; i++) tick();

rt.get(`(() => {
  globalThis.__seenTowns = new Map();
  globalThis.__deaths = {};
  for (const s of W.settlements) if (!s.ruined) globalThis.__seenTowns.set(s.id, s.name);
  return "1";
})()`);

const step = `(() => {
  const firstEvent = W.nextEventId,
    before = new Map();
  for (const s of W.settlements)
    if (!s.ruined) before.set(s.id, { name: s.name, pop: settlementPopulation(s),
      food: +settlementFood(s).toFixed(1), blocks: W.buildings.filter((b) => b.complete && !b.ruined &&
        b.placeId === s.id && ["tower","office","tenement"].includes(b.type)).length });
  const deathsBefore = {};
  for (const h of Object.values(W.historicalIdentities || {}))
    if (h.lifeKind === KINDS.PERSON) {
      const c = h.lifeSummary?.causeOfDeath || "?";
      deathsBefore[c] = (deathsBefore[c] || 0) + 1;
    }
  const r = runCausalSkipForDebug();
  // Which towns are gone, and what the world said about them on the way out.
  const lost = [];
  for (const [id, was] of before) {
    const now = W.settlements.find((s) => s.id === id);
    if (now && !now.ruined && settlementPopulation(now) > 0) continue;
    const named = W.events
      .filter((e) => e.id >= firstEvent && (e.data?.place === was.name ||
        e.data?.placeId === id || (e.evidence || []).some((x) => String(x).includes(was.name))))
      .map((e) => e.type + (e.evidence?.[0] ? "[" + String(e.evidence[0]).slice(0, 70) + "]" : ""))
      .slice(0, 6);
    lost.push({ ...was, ruined: !!now?.ruined, gone: !now, events: named });
  }
  const deaths = {};
  for (const h of Object.values(W.historicalIdentities || {}))
    if (h.lifeKind === KINDS.PERSON) {
      const c = h.lifeSummary?.causeOfDeath || "?";
      deaths[c] = (deaths[c] || 0) + 1;
    }
  const newDeaths = Object.entries(deaths)
    .map(([k, v]) => [k, v - (deathsBefore[k] || 0)])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => k.slice(0, 34) + ":" + v);
  const wars = W.activeWars.filter((w) => !w.ended).length;
  // Births against deaths: a world that stops replacing itself dies of old age
  // with full granaries, which looks nothing like a famine in the other probes.
  const births = W.events.filter((e) => e.id >= firstEvent && e.type === "BirthEvent").length,
    died = Object.values(deaths).reduce((n, v) => n + v, 0) -
      Object.values(deathsBefore).reduce((n, v) => n + v, 0),
    adults = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) &&
      typeof isAdultPerson === "function" && isAdultPerson(id)).length,
    fertile = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) &&
      W.components.reproduction?.[id] && (W.components.reproduction[id].cooldown || 0) <= 0).length;
  return JSON.stringify({ births, died, adults, fertile,
    year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason,
    people: modernLivingPeople(), towns: W.settlements.filter((s) => !s.ruined).length,
    wars, delta: auditMatter().delta, deaths: newDeaths, lost });
})()`;

for (let press = 1; press <= presses; press++) {
  const row = JSON.parse(rt.get(step));
  const line = { press, ...row };
  if (!row.lost.length) delete line.lost;
  console.log(JSON.stringify(line));
}
