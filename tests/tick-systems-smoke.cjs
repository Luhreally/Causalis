// The tick is a list of named systems (16). Every one is registered, none twice,
// the memo window ends where 70 said, profiling reads without writing, and a
// system switched off is skipped.
const { loadRuntime } = require("../scripts/runtime-probe.cjs");
const { report } = require("./lib/report.cjs");

const failures = [],
  fail = (message) => failures.push(message);
const plain = loadRuntime(),
  timed = loadRuntime();
for (const rt of [plain, timed])
  rt.sandbox.window.ALIFE_DEBUG.createTestWorld({
    seed: "causal-origin",
    size: "battery",
    complexity: "lean",
  });
const debug = timed.sandbox.window.ALIFE_TICK_DEBUG,
  systems = debug.systems(),
  names = systems.map((s) => s.name);
if (systems.length < 57) fail(`only ${systems.length} tick systems are registered`);
if (new Set(names).size !== names.length) fail("two tick systems share a name");
if (!systems.some((s) => s.phase === "calendar") || !systems.some((s) => s.phase === "after"))
  fail("a phase of the tick has no systems");
if (
  debug.memoSpan() !==
  systems.findIndex((s) => s.name === "granary") -
    systems.filter((s) => s.phase === "calendar").length
)
  fail(`the memo window ends at ${debug.memoSpan()}, not before the granary`);
let duplicate = null;
try {
  timed.get('tickSystem("granary", () => {})');
} catch (error) {
  duplicate = error.message;
}
if (!/two tick systems/.test(duplicate || ""))
  fail("a second system of the same name was accepted");

debug.profile(true);
const tickPlain = plain.get("simTick"),
  tickTimed = timed.get("simTick");
for (let i = 0; i < 300; i++) {
  tickPlain();
  tickTimed();
}
const hashPlain = plain.get("worldHash()"),
  hashTimed = timed.get("worldHash()");
if (hashPlain !== hashTimed) fail(`profiling changed the world: ${hashPlain} vs ${hashTimed}`);
const profiled = debug.report();
if (!profiled.some((row) => row.name === "core tick" && row.calls === 300))
  fail("the core tick was not timed");
if (!profiled.some((row) => row.name === "granary" && row.calls === 300))
  fail("a system was not timed");

debug.off("granary");
for (let i = 0; i < 10; i++) tickTimed();
const granary = debug.report().find((row) => row.name === "granary");
if (!granary || granary.calls !== 300) fail("a system switched off still ran");
debug.off("granary", false);
debug.profile(false);

report(
  {
    systems: systems.length,
    calendar: systems.filter((s) => s.phase === "calendar").length,
    memoSpan: debug.memoSpan(),
    hash: hashPlain,
    slowest: profiled.slice(0, 3).map((row) => `${row.name} ${row.msPerCall} ms`),
  },
  failures,
);
