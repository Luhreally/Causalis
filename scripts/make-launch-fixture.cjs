// Save a world at the modern stage, a few presses short of its ship, as a
// test fixture.
//
// The road to a launch takes ten minutes of wall clock from a fresh world and
// nothing in the fast suite would notice it breaking. Saves are deterministic
// and continue exactly, so a world archived a few presses before its ship can
// be loaded by a smoke test and pressed to the launch in well under a minute.
// This runs the world to the given press, archives it the way the game does
// (`snapshot()` through `saveReplacer`), and writes it gzipped.
//
// node scripts/make-launch-fixture.cjs <seed> <size> <complexity> <presses> <out.json.gz>
const fs = require("node:fs");
const zlib = require("node:zlib");
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "battery",
  complexity = process.argv[4] || "lean",
  presses = Number(process.argv[5] || 14),
  out = process.argv[6] || "tests/fixtures/launch-battery.json.gz";
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
for (let i = 0; i < year * 30; i++) tick();
for (let press = 1; press <= presses; press++) {
  const row = JSON.parse(
    rt.get(
      `(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), people: modernLivingPeople(), stop: r.stopReason, milestone: r.milestone?.label || "", ships: (W.ascensions || []).length, shortfall: modernShortfall() }); })()`,
    ),
  );
  console.log(JSON.stringify({ press, ...row }));
  if (row.ships) throw new Error("the ship already left; archive fewer presses");
}
const archive = rt.get(`JSON.stringify(snapshot(), saveReplacer)`),
  hash = rt.get(`String(W.hash)`),
  tickNow = rt.get(`W.tick`);
const gz = zlib.gzipSync(Buffer.from(archive, "utf8"), { level: 9 });
fs.mkdirSync(require("node:path").dirname(out), { recursive: true });
fs.writeFileSync(out, gz);
console.log(
  JSON.stringify({ out, tick: tickNow, hash, bytes: archive.length, gzipped: gz.length }),
);
