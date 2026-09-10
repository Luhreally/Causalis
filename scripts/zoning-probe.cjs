// Does a town actually zone itself, and does the plan survive contact with the
// world? Prints each town's quarters, what it is short of, how much of what it
// has built stands in the zone meant for it, how many cottages have been bought
// out for blocks, and how much of its housing is still owner-occupied — beside
// the matter audit, because redevelopment knocks buildings down.
//
// node scripts/zoning-probe.cjs <seed> <size> <complexity> <presses>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "small",
  complexity = process.argv[4] || "lean",
  presses = Number(process.argv[5] || 14);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, presses }));
for (let i = 0; i < year * 30; i++) tick();

const report = `(() => {
  const towns = W.settlements.filter((s) => !s.ruined).slice(0, 4).map((s) => {
    const d = window.ALIFE_ZONING_DEBUG.demand(s.id),
      a = window.ALIFE_ZONING_DEBUG.audit(s.id),
      g = window.ALIFE_ZONING_DEBUG.genome(s.id);
    return { name: s.name.slice(0, 11), pop: settlementPopulation(s),
      core: +g.core.toFixed(1), works: g.industry, shops: g.commerce,
      want: window.ALIFE_ZONING_DEBUG.wanted(s.id),
      demand: d ? { r: +d.residential.toFixed(2), i: +d.industry.toFixed(2), c: +d.commercial.toFixed(2) } : null,
      inZone: a ? a.matched + "+" + (a.accepted - a.matched) + "/" + a.total : null,
      owned: s.habitation ? s.habitation.ownedShare : null,
      beds: s.habitation ? s.habitation.beds : null,
      housed: s.habitation ? s.habitation.housed + "/" + s.habitation.residents : null };
  });
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR),
    people: modernLivingPeople(), delta: auditMatter().delta,
    zoning: window.ALIFE_ZONING_DEBUG.counts(),
    ownedAll: (() => { let o = 0, h = 0; for (const s of W.settlements) if (!s.ruined && s.habitation) { o += (s.habitation.owned || 0); h += (s.habitation.homes || 0); } return h ? +(o / h).toFixed(2) : null; })(),
    blocks: W.buildings.filter((b) => b.complete && !b.ruined && ["tower","office"].includes(b.type)).length,
    apts: W.buildings.filter((b) => b.complete && !b.ruined && b.type === "tenement").length,
    cottages: W.buildings.filter((b) => b.complete && !b.ruined && b.type === "shelter").length,
    towns });
})()`;

console.log(JSON.stringify({ press: 0, ...JSON.parse(rt.get(report)) }));
for (let press = 1; press <= presses; press++) {
  rt.get(`(() => { runCausalSkipForDebug(); return "1"; })()`);
  const row = JSON.parse(rt.get(report));
  console.log(JSON.stringify({ press, ...row }));
  if (row.delta !== 0) {
    console.log(JSON.stringify({ note: "matter drifted; stopping" }));
    break;
  }
}
