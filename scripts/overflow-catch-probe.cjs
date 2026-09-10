// Catch the caller that deletes a tile's overflow record.
//
// A common species lives in a 16-bit column; anything past 65535 is kept in a
// rare record for that tile. `setTileMatterAmount` drops that record when the
// new value fits in the column, which is right for a caller that means to set
// the total and wrong for one that read only the column. This wraps the setter,
// records the stack of any call that would drop a non-empty record, and prints
// them, so the caller names itself instead of being hunted by cadence.
//
// node scripts/overflow-catch-probe.cjs <seed> <size> <complexity> <presses>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "battery",
  complexity = process.argv[4] || "lean",
  presses = Number(process.argv[5] || 22);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR"),
  started = performance.now();
console.log(JSON.stringify({ seed, size, complexity, presses }));

rt.get(`(() => {
  globalThis.__overflowHits = [];
  const base = setTileMatterAmount;
  setTileMatterAmount = function (tile, species, value) {
    if (species < COMMON_CHEM && globalThis.__overflowHits.length < 6) {
      const previous = W.tiles.chem[species][tile],
        over = W.tiles.rareChem[tileMatterKey(tile, species)] || 0,
        want = Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;
      if (previous === 65535 && over > 0 && want <= 65535)
        globalThis.__overflowHits.push({
          tick: W.tick, tile, species, dropped: over, value: want,
          stack: String(new Error().stack).split("\\n").slice(2, 9).map((s) => s.trim()).join(" << "),
        });
    }
    return base(tile, species, value);
  };
  return "wrapped";
})()`);

for (let press = 1; press <= presses; press++) {
  const row = JSON.parse(
    rt.get(`(() => {
    const r = runCausalSkipForDebug();
    return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason,
      delta: auditMatter().delta, people: modernLivingPeople(),
      hits: globalThis.__overflowHits.length });
  })()`),
  );
  console.log(JSON.stringify({ press, minutes: +((performance.now() - started) / 60000).toFixed(2), ...row }));
  if (row.hits) {
    console.log(rt.get(`JSON.stringify(globalThis.__overflowHits, null, 1)`));
    break;
  }
  if (row.delta !== 0) {
    console.log(JSON.stringify({ note: "drifted with no overflow drop recorded; the loss is elsewhere" }));
    break;
  }
}
