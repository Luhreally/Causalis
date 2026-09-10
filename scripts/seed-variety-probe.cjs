// How different is one world from the next? Prints the design signature for a
// run of seeds and counts how often two of them are the same, which is the
// measure that matters for "no two worlds look alike".
// node scripts/seed-variety-probe.cjs [count]
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(), count = Number(process.argv[2] || 40);
const seeds = ["causal-origin"];
for (let i = 1; i < count; i++) seeds.push("variety-" + i);
const rows = [];
for (const seed of seeds) {
  rt.game.createTestWorld({ seed, size: "battery" });
  rows.push(JSON.parse(rt.get(`(() => {
    const w = worldDesignSignature();
    return JSON.stringify({ seed: W.seed, earth: w.earth, mountain: w.mountain,
      canopyGrammar: w.canopyGrammar, facade: w.facade, carProfile: w.carProfile,
      vehicleGrammar: w.vehicleGrammar, branches: w.branches,
      canopyWidth: +w.canopyWidth.toFixed(2), canopyHeight: +w.canopyHeight.toFixed(2),
      mountainAspect: +w.mountainAspect.toFixed(2), bodyWidth: +w.bodyWidth.toFixed(2),
      limbLength: +w.limbLength.toFixed(2), wheelbase: +w.wheelbase.toFixed(2) });
  })()`)));
}
const key = (r) => [r.mountain, r.canopyGrammar, r.facade, r.carProfile, r.vehicleGrammar, r.branches].join("/");
const seen = new Map();
for (const r of rows) seen.set(key(r), (seen.get(key(r)) || 0) + 1);
const collisions = [...seen.values()].filter((n) => n > 1);
console.log(JSON.stringify({
  seeds: rows.length,
  distinctShapes: seen.size,
  worldsSharingAShape: collisions.reduce((n, v) => n + v, 0),
  largestGroup: Math.max(0, ...collisions),
  mountains: [...new Set(rows.map((r) => r.mountain))],
  canopyGrammars: [...new Set(rows.map((r) => r.canopyGrammar))].length,
  vehicleGrammars: [...new Set(rows.map((r) => r.vehicleGrammar))],
}, null, 1));
console.log(JSON.stringify(rows.slice(0, 6), null, 1));
