// Long-run regression baseline: ages, techs, people, towns, wars, deaths, famine acts and tick cost per decade.
// Usage: node scripts/regression-200.cjs <seed> <years> <size>   (npm run regress:200 -- 7 200 small)
const { loadRuntime } = require("./vm-runtime.cjs");
const rt = loadRuntime(), get = rt.get, probe = rt.probe, game = rt.game;
const seed = process.argv[2] || "7", years = Number(process.argv[3] || 200), size = process.argv[4] || "standard";
game.createTestWorld({ seed, size });
const simTick = get("simTick"), W = probe.W(), TPY = get("TICKS_PER_YEAR"), KINDS = get("KINDS");
const firstKnown = {}, t0 = performance.now();
let lastReport = performance.now(), crashed = null;
outer: for (let y = 1; y <= years; y++) {
  for (let i = 0; i < TPY; i++) {
    try { simTick(); } catch (e) { crashed = { year: y, tick: W.tick, error: String(e.stack || e).split("\n").slice(0, 6).join(" | ") }; break outer; }
  }
  const known = new Set();
  for (const s of W.settlements) if (!s.ruined) for (const t of s.knownProcesses) known.add(t);
  for (const t of known) if (firstKnown[t] === undefined) firstKnown[t] = y;
  if (y % 10 === 0) {
    const row = JSON.parse(probe.get(`(() => {
      const people = [], deaths = {}; let hungry = 0, cannibals = 0, robberies = 0;
      for (const id of W.activeIds) if (W.kind[id] === KINDS.PERSON && classifyAlive(id)) { people.push(id); if (derivedLife(id).hunger > 70) hungry++; const ident = W.components.identity[id]; if (ident?.cannibalTick) cannibals++; robberies += ident?.robberies || 0; }
      for (const h of Object.values(W.historicalIdentities || {})) { if (h.lifeKind === KINDS.PERSON) { const c = h.lifeSummary?.causeOfDeath || "?"; deaths[c] = (deaths[c] || 0) + 1; } if (h.cannibalTick) cannibals++; robberies += h.robberies || 0; }
      const top = Object.entries(deaths).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k.replace(/ caused structural failure/, "") + ":" + v).join(", ");
      return JSON.stringify({ people: people.length, hungry, cannibals, robberies, deaths: top, towns: W.settlements.filter((s) => !s.ruined).length, ruined: W.settlements.filter((s) => s.ruined).length, polities: W.factions.filter((f) => f.stability > 0).length, wars: (W.activeWars || []).filter((w) => !w.ended).length, ages: (W.ages || []).map((a) => a.gloss[0]).join(""), ships: (W.ascensions || []).length, ending: W.endingShownTick ? Math.floor(W.endingShownTick / TICKS_PER_YEAR) : 0, events: W.events.length });
    })()`));
    row.y = y; row.techs = known.size; row.msTick = +((performance.now() - lastReport) / (TPY * 10)).toFixed(1);
    lastReport = performance.now();
    console.log(JSON.stringify(row));
  }
}
if (crashed) console.log("CRASH", JSON.stringify(crashed));
console.log("firstKnown", JSON.stringify(Object.fromEntries(Object.entries(firstKnown).sort((a, b) => a[1] - b[1]))));
console.log("ages", JSON.stringify((W.ages || []).map((a) => [a.gloss, Math.floor(a.tick / TPY)])));
console.log(`== ${seed} ${size} ${years} yrs · ${((performance.now() - t0) / (W.tick || 1)).toFixed(2)} ms/tick avg · ${Math.round((performance.now() - t0) / 60000)} min`);
