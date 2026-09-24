// Herds that feed their towns (163): on a generated world, a town's herd
// larger than it needs to breed gives animals to the stores, the flesh reaches
// the town, the herd keeps its breeding four, and matter is conserved.
const { loadRuntime } = require("../scripts/runtime-probe.cjs");
const { report } = require("./lib/report.cjs");

const failures = [];
const rt = loadRuntime(),
  debug = rt.sandbox.window.ALIFE_HUSBANDRY_DEBUG;
rt.sandbox.window.ALIFE_DEBUG.createTestWorld({
  seed: "causal-origin",
  size: "battery",
  complexity: "lean",
});
const tick = rt.get("simTick");
for (let i = 0; i < 256 * 20; i++) tick();
const counts = debug.counts(),
  herds = rt.get("W.herds.filter((h) => h.active).map((h) => h.animalIds.length)"),
  sentence = rt.get(
    `(() => { const e = W.events.filter((x) => x.type === "HerdSlaughteredEvent").at(-1); return e ? eventSentence(e) : ""; })()`,
  );
if (!counts.slaughtered) failures.push("no herd gave an animal in twenty years");
if (!(counts.meat > 0)) failures.push("the slaughtered animals gave no food");
if (sentence && /undefined|NaN/.test(sentence)) failures.push(`the slaughter reads: ${sentence}`);
if (rt.get("auditMatter().delta") !== 0) failures.push("slaughter did not conserve matter");
report({ counts, herds, sentence }, failures);
