// How long a tick takes on a late, built-up world, and where the time goes.
//
// A mature world runs at twenty-five to forty-five milliseconds a tick, so warp
// caps at two to four times and a phone feels it most. This loads the launch
// fixture (a battery-saver city at year sixty-six with its skyline standing),
// runs a stretch of ticks, and prints the milliseconds per tick. Run it under
// the V8 profiler and hand the profile to perf-summary.cjs to see which
// sections and functions the time is in:
//
//   node --cpu-prof --cpu-prof-dir=$SCRATCH scripts/perf-probe.cjs [ticks] [fixture]
//   node scripts/perf-summary.cjs $SCRATCH/CPU.*.cpuprofile
const fs = require("node:fs");
const zlib = require("node:zlib");
const path = require("node:path");
const { loadRuntime } = require("./runtime-probe.cjs");

const ticks = Number(process.argv[2] || 512),
  fixture =
    process.argv[3] || path.join(__dirname, "..", "tests", "fixtures", "launch-battery.json.gz");
const rt = loadRuntime(),
  archive = zlib.gunzipSync(fs.readFileSync(fixture)).toString("utf8");
(async () => {
  rt.sandbox.localStorage.setItem("causalis.save.perf", archive);
  const loaded = await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("perf");
  if (!loaded) throw new Error("the fixture did not load");
  const tick = rt.get("simTick"),
    year = rt.get("TICKS_PER_YEAR"),
    people = () => rt.get("biospherePopulation(KINDS.PERSON)"),
    tickNow = () => rt.get("W.tick");
  console.log(
    JSON.stringify({
      fixture: path.basename(fixture),
      tick: tickNow(),
      year: Math.floor(tickNow() / year),
      people: people(),
    }),
  );
  // Warm the caches for a season before timing.
  for (let i = 0; i < 64; i++) tick();
  const buckets = [];
  let slowest = 0;
  const started = performance.now();
  for (let i = 0; i < ticks; i++) {
    const t0 = performance.now();
    tick();
    const dt = performance.now() - t0;
    slowest = Math.max(slowest, dt);
    buckets[Math.min(9, Math.floor(dt / 10))] =
      (buckets[Math.min(9, Math.floor(dt / 10))] || 0) + 1;
  }
  const elapsed = performance.now() - started;
  console.log(
    JSON.stringify({
      ticks,
      msPerTick: +(elapsed / ticks).toFixed(2),
      slowestMs: +slowest.toFixed(1),
      histogram10ms: buckets.map((n) => n || 0),
      people: people(),
      tick: tickNow(),
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
