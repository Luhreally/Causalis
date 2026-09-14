// Launch smoke: a battery-saver world archived two presses short of its ship
// (tests/fixtures/launch-battery.json.gz, made by scripts/make-launch-fixture.cjs
// from causal-origin battery lean at press 16, year 66, its launch tower just
// complete) loads with its hash intact, and pressing Causal skip sends the
// first ship away within four presses with matter conserved. The road to a
// launch takes ten minutes from a fresh world; this guards the last stretch of
// it in under a minute, so the fast suite notices when the chain breaks again.
const fs = require("node:fs");
const zlib = require("node:zlib");
const path = require("node:path");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixturePath = path.join(__dirname, "fixtures", "launch-battery.json.gz"),
  archive = zlib.gunzipSync(fs.readFileSync(fixturePath)).toString("utf8");

const assertions = String.raw`
const failures = [];
const saves = sandbox.window.ALIFE_SAVE_DEBUG, skip = sandbox.window.ALIFE_CAUSAL_SKIP_DEBUG, orbit = sandbox.window.ALIFE_ORBIT_DEBUG, modern = sandbox.window.ALIFE_MODERN_DEBUG;
if (!saves || !skip || !orbit || !modern) throw new Error("debug surfaces missing");
(async () => {
  // The archive goes where the game would read it from when the database is absent.
  localStorage.setItem("causalis.save.launch", ARCHIVE);
  const loaded = await saves.load("launch");
  if (!loaded) failures.push("the launch fixture did not load (hash or shape)");
  const presses = [];
  let ships = 0;
  for (let n = 1; n <= 4 && !ships && loaded; n++) {
    const r = skip.run();
    ships = orbit.voyages().length;
    presses.push({ press: n, stop: r.stopReason, milestone: r.milestone?.label || "", drift: r.matter?.delta, ships });
    if (Math.abs(r.matter?.delta || 0) > 0) failures.push("matter drifted during press " + n + ": " + r.matter.delta);
  }
  if (!ships) failures.push("no ship left within four presses: " + JSON.stringify(modern.launchBlockers()));
  console.log(JSON.stringify({ ok: !failures.length, failures, presses }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
`;

const harnessSource = smokeSource.slice(0, harnessEnd);
new Function("require", "ARCHIVE", harnessSource + "\n" + assertions)(require, archive);
