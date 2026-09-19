// Baseline smoke: the pre-ship road is frozen. Battery causal-origin, lean, is
// generated and stepped eight years, and its world hash must be the one
// recorded here. The sim is deterministic, so any change to what runs before
// the ship (chemistry, weather, the plants, the labour, the press) moves this
// hash and every launch year with it; a change that runs only behind the ship
// (gated on shipHasLeft), or that only renders, leaves it as it is. When this
// fails on purpose: run the launch sweep on both sizes, record the new lists in
// the handoff, and record the new hash here, in the same commit. The guard has
// a limit: a rule that fires only in a grown town, past year eight, leaves the
// hash as it is (the open-ground reach of 128 did), so the sweep, not this
// hash, is the measurement; this catches what changes from generation on, as
// the field gates of 138 did (7a2d4ecb to 6d96cf30, with the sweep rerun), and
// the deep sky of 17 did (6d96cf30 to 6bee0692, the same).
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const BASELINE_HASH = "6bee0692",
  BASELINE_YEARS = 8;

const fixtureSource = String.raw`(() => {
  const out = { failures: [] };
  for (let i = 0; i < TICKS_PER_YEAR * ${BASELINE_YEARS}; i++) simTick();
  out.year = Math.floor(W.tick / TICKS_PER_YEAR);
  out.people = biospherePopulation(KINDS.PERSON);
  out.hash = worldHash();
  out.audit = auditMatter().delta;
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "causal-origin", size: "battery", complexity: "lean" });
const result = sandbox.window.ALIFE_BASELINE_TEST.run();
if (result.audit !== 0) failures.push("matter drifted on the baseline road: " + result.audit);
if (result.hash !== ${JSON.stringify(BASELINE_HASH)}) failures.push("the pre-ship road moved: hash " + result.hash + " where the baseline is ${BASELINE_HASH}; if this is meant, sweep both sizes and record the new hash and lists together");
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_BASELINE_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
