// Trends (158): a chart for each measure, on a readable scale, from the
// samples 29 keeps; reading them writes nothing.
const { loadRuntime } = require("../scripts/runtime-probe.cjs");
const { report } = require("./lib/report.cjs");

const failures = [];
const rt = loadRuntime(),
  trends = rt.sandbox.window.ALIFE_TRENDS_DEBUG;
rt.sandbox.window.ALIFE_DEBUG.createTestWorld({
  seed: "causal-origin",
  size: "battery",
  complexity: "lean",
});
const tick = rt.get("simTick");
for (let i = 0; i < 128 * 6; i++) tick();
const before = rt.get("worldHash()"),
  html = trends.html(),
  cards = (html.match(/class="trend-card"/g) || []).length;
if (cards !== trends.series().length)
  failures.push(`${cards} trend cards for ${trends.series().length} measures`);
if (/NaN|undefined/.test(html)) failures.push("a trend card printed NaN or undefined");
for (const [max, top] of [
  [0, 1],
  [7, 10],
  [12, 20],
  [86, 100],
  [126, 200],
  [0.4, 0.5],
  [2400, 2500],
])
  if (trends.top(max) !== top)
    failures.push(`the scale over ${max} tops at ${trends.top(max)}, not ${top}`);
if (rt.get("worldHash()") !== before) failures.push("drawing the trends changed the world");
report({ cards, samples: rt.get("W.statistics.history.length") }, failures);
