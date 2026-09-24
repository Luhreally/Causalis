// What happened while you skipped (159): after a press, the years, the counts
// before and after, the chronicle's notable events and what the next stage
// still needs, written without an undefined and without touching the world.
const { loadRuntime } = require("../scripts/runtime-probe.cjs");
const { report } = require("./lib/report.cjs");

const failures = [];
const rt = loadRuntime(),
  digest = rt.sandbox.window.ALIFE_SKIP_DIGEST_DEBUG;
rt.sandbox.window.ALIFE_DEBUG.createTestWorld({
  seed: "causal-origin",
  size: "battery",
  complexity: "lean",
});
const tick = rt.get("simTick");
for (let i = 0; i < 256; i++) tick();
const before = digest.snapshot();
rt.get("runCausalSkipForDebug(0)");
const after = digest.snapshot(),
  hash = rt.get("worldHash()"),
  html = digest.html(before, "Reached the next stage.");
if (!(after.tick > before.tick)) failures.push("the skip did not advance");
if (!/People/.test(html) || !/(What the chronicle remembers|A quiet stretch)/.test(html))
  failures.push("the digest lacks its counts or its events");
if (/undefined|NaN/.test(html)) failures.push("the digest printed undefined or NaN");
if (rt.get("worldHash()") !== hash) failures.push("writing the digest changed the world");
report(
  { years: [before.tick, after.tick].map((t) => Math.floor(t / 256)), before, after },
  failures,
);
