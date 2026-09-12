// Generated-world measurement, with no fixture or granted technology.
// node scripts/continuing-city-probe.cjs <seed> <size> <complexity> <presses>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(), seed = process.argv[2] || "causal-origin";
rt.game.createTestWorld({ seed, size: process.argv[3] || "battery", complexity: process.argv[4] || "lean" });
const tick = rt.get("simTick"), year = rt.get("TICKS_PER_YEAR"), started = performance.now();
console.log(JSON.stringify({ seed, size: process.argv[3] || "battery", complexity: process.argv[4] || "lean" }));
for (let i = 0; i < year * 30; i++) tick();
let afterLaunch = 0;
for (let press = 1; press <= +(process.argv[5] || 40); press++) {
  const row = JSON.parse(rt.get(`(() => {
    const result = runCausalSkipForDebug(), towns = W.settlements.filter((s) => !s.ruined);
    return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: result.stopReason,
      milestone: result.milestone?.label || "", people: modernLivingPeople(), townPeople: modernPeople(),
      ships: (W.ascensions || []).length, colonies: (W.colonies || []).length,
      shortfall: modernShortfall(), toll: result.toll || 0, matterDelta: auditMatter().delta,
      continuing: window.ALIFE_CONTINUING_DEBUG?.counts(),
      homes: towns.map((s) => ({ name: s.name, ...s.habitation, food: +settlementFood(s).toFixed(1), hungry: +hungryShare(s).toFixed(2) })),
      routes: (W.publicTransport?.routes || []).length, journeys: W.publicTransport?.journeys || 0,
      launch: window.ALIFE_MODERN_DEBUG.launchBlockers(),
      blocks: modernCount(["tower", "office"]), apts: modernCount(["tenement"]), works: modernCount(["factory"]),
      wants: window.ALIFE_MODERN_DEBUG?.wants?.(),
      crafts: typeof CONTINUING_CRAFTS !== "undefined" ? CONTINUING_CRAFTS.filter(continuingKnows) : [],
    });
  })()`));
  console.log(JSON.stringify({ press, minutes: +((performance.now() - started) / 60000).toFixed(2), ...row }));
  if (row.matterDelta !== 0) throw new Error(`Matter drift: ${row.matterDelta}`);
  if (row.ships && ++afterLaunch >= 6) break;
}
