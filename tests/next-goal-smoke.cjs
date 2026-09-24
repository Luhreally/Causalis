// The next step in view (160): between presses the line under the Causal skip
// names the next stage and what it still needs, read from the stage gate, and
// reading it writes nothing.
const { loadRuntime } = require("../scripts/runtime-probe.cjs");
const { report } = require("./lib/report.cjs");

const failures = [];
const rt = loadRuntime();
rt.sandbox.window.ALIFE_DEBUG.createTestWorld({
  seed: "causal-origin",
  size: "battery",
  complexity: "lean",
});
const tick = rt.get("simTick");
for (let i = 0; i < 2000; i++) tick();
const hash = rt.get("worldHash()");
rt.get("refreshUI(true)");
const shown = rt.get("DOM.causalSkipStatus.textContent"),
  gate = rt.get("civilizationGateStatus()");
if (!/^Next: /.test(shown) && !/last stage/.test(shown))
  failures.push(`the skip line says "${shown}"`);
if (gate && !shown.toLowerCase().includes(String(gate.next).toLowerCase()))
  failures.push(`the skip line does not name the next stage (${gate.next})`);
if (/undefined|NaN/.test(shown)) failures.push("the skip line printed undefined or NaN");
if (rt.get("worldHash()") !== hash) failures.push("naming the next stage changed the world");
report({ shown }, failures);
