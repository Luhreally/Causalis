// Where the time went, by section and by function, from a V8 CPU profile.
//
// `node --cpu-prof scripts/perf-probe.cjs` writes a .cpuprofile whose frames
// name lines of the composed runtime (causalis.runtime.js). This sums the
// self time of every frame, maps each line back to its section, and prints
// the sections and the functions that hold the most of it.
//
// node scripts/perf-summary.cjs <profile.cpuprofile> [top]
const fs = require("node:fs");
const { composeRuntime, compositeLineMap, mapCompositeLine } = require("./compose-runtime.cjs");

const file = process.argv[2],
  top = Number(process.argv[3] || 25);
if (!file) {
  console.error("usage: node scripts/perf-summary.cjs <profile.cpuprofile> [top]");
  process.exit(2);
}
const profile = JSON.parse(fs.readFileSync(file, "utf8")),
  nodes = new Map(profile.nodes.map((n) => [n.id, n])),
  self = new Map();
// Samples name a node; the time between consecutive samples is that node's.
const deltas = profile.timeDeltas || [];
for (let i = 0; i < profile.samples.length; i++) {
  const id = profile.samples[i],
    dt = (deltas[i] || 0) / 1000;
  self.set(id, (self.get(id) || 0) + dt);
}
const map = compositeLineMap(composeRuntime({ format: "script" })),
  bySection = new Map(),
  byFunction = new Map();
let total = 0;
for (const [id, ms] of self) {
  const node = nodes.get(id);
  if (!node) continue;
  total += ms;
  const frame = node.callFrame,
    runtime = /causalis\.runtime\.js|index\.inline\.js/.test(frame.url || ""),
    at = runtime ? mapCompositeLine(frame.lineNumber + 1, map) : null,
    section = at
      ? at.name
      : runtime
        ? "composite wrapper"
        : frame.url
          ? "node/" + frame.url.split(/[\\/]/).pop()
          : frame.functionName || "(program)",
    fn = `${frame.functionName || "(anonymous)"}  ${at ? `${at.name}:${at.line}` : section}`;
  bySection.set(section, (bySection.get(section) || 0) + ms);
  byFunction.set(fn, (byFunction.get(fn) || 0) + ms);
}
const rows = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
console.log(`total sampled ${(total / 1000).toFixed(2)} s`);
console.log("\nby section:");
for (const [k, ms] of rows(bySection, top))
  console.log(
    `  ${((100 * ms) / total).toFixed(1).padStart(5)}%  ${(ms / 1000).toFixed(2).padStart(6)} s  ${k}`,
  );
console.log("\nby function (self time):");
for (const [k, ms] of rows(byFunction, top))
  console.log(
    `  ${((100 * ms) / total).toFixed(1).padStart(5)}%  ${(ms / 1000).toFixed(2).padStart(6)} s  ${k}`,
  );
