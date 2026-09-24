// What the world hash spends its time on.
//
// worldHash() walks every array and object of W once a year and cost about
// three hundred milliseconds on a battery-saver city — three-quarters of a
// second of a phone's time in one tick. Before changing what it hashes, this
// says where the time goes: the whole world, then the world with each large
// member emptied in turn (restored after), so the difference is that member's
// share. Run on the launch fixture.
//
// node scripts/perf-hash-probe.cjs [fixture]
const fs = require("node:fs");
const zlib = require("node:zlib");
const path = require("node:path");
const { loadRuntime } = require("./runtime-probe.cjs");

const fixture =
  process.argv[2] || path.join(__dirname, "..", "tests", "fixtures", "launch-battery.json.gz");
const rt = loadRuntime(),
  archive = zlib.gunzipSync(fs.readFileSync(fixture)).toString("utf8");
(async () => {
  rt.sandbox.localStorage.setItem("causalis.save.perf", archive);
  if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("perf")))
    throw new Error("the fixture did not load");
  const time = (label, setup, restore) =>
    rt.get(`(() => {
      ${setup || ""}
      let best = Infinity, hash = "";
      for (let n = 0; n < 4; n++) { const t0 = performance.now(); hash = worldHash(); best = Math.min(best, performance.now() - t0); }
      ${restore || ""}
      return JSON.stringify({ label: ${JSON.stringify(label)}, ms: +best.toFixed(1), hash });
    })()`);
  const rows = [];
  rows.push(JSON.parse(time("whole world")));
  for (const key of [
    "events",
    "historicalIdentities",
    "annals",
    "components",
    "tiles",
    "settlements",
    "activeIds",
    "cohorts",
    "factions",
    "buildings",
  ])
    rows.push(
      JSON.parse(
        time(
          `without ${key}`,
          `const saved = W[${JSON.stringify(key)}]; W[${JSON.stringify(key)}] = Array.isArray(saved) ? [] : {};`,
          `W[${JSON.stringify(key)}] = saved;`,
        ),
      ),
    );
  rows.push(JSON.parse(time("whole world again")));
  const whole = rows[0].ms;
  for (const r of rows)
    console.log(
      `${String(r.ms).padStart(7)} ms  ${r.label.padEnd(30)} ${r.label.startsWith("without") ? `(${(whole - r.ms).toFixed(1)} ms is that member)` : r.hash}`,
    );
  const counts = JSON.parse(
    rt.get(
      `JSON.stringify({ events: W.events.length, identities: Object.keys(W.historicalIdentities || {}).length, annals: (W.annals || []).length, active: W.activeIds.length, strings: (() => { let n = 0, chars = 0; for (const e of W.events) for (const s of e.evidence || []) { n++; chars += String(s).length; } return { n, chars }; })() })`,
    ),
  );
  console.log(JSON.stringify(counts));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
