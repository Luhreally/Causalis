// Transit smoke: while a ship is under way and the colony is what the world
// waits for, the continuing crafts do not stop a press, the press's horizon
// reaches to the arrival, the result says where the ship is, and none of it
// changes the world the ticks would have made anyway.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const transit = window.ALIFE_TRANSIT_DEBUG, skip = window.ALIFE_CAUSAL_SKIP_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  // No ship: nothing to say, and the plan is the ordinary one.
  out.quietBefore = transit.sentence();
  if (out.quietBefore !== "") fail("a sentence with no ship under way: " + out.quietBefore);
  // An orbital world with a ship under way and the crafts still to learn.
  ensureOrbit();
  const saved = W.civilization.stageIndex;
  W.civilization.stageIndex = CIV_STAGE_ORDER.indexOf("orbital"); W.civilization.stage = "orbital";
  s.knownProcesses.push("starflight");
  const voyage = { id: (W.nextVoyageId = (W.nextVoyageId || 1)) , ascensionId: 0, name: s.name + " 1", fromSettlementId: s.id, fromName: s.name,
    factionId: s.factionId || 0, factionName: "", crew: [], crafts: s.knownProcesses.slice(), starId: 1, starName: "Umber Hollow",
    departTick: W.tick - TICKS_PER_YEAR * 10, arriveTick: W.tick + TICKS_PER_YEAR * 20, status: "under way" };
  W.nextVoyageId++;
  W.voyages.push(voyage);
  out.sentence = transit.sentence();
  if (!out.sentence.includes(voyage.name) || !out.sentence.includes("Umber Hollow") || !/arrives in year/.test(out.sentence)) fail("the sentence does not say where the ship is: " + out.sentence);
  const plan = skip.plan();
  out.pending = plan.pending.map((st) => st.key + (st.quiet ? "*" : ""));
  const inquiries = plan.pending.filter((st) => String(st.key).startsWith("inquiry:"));
  if (!inquiries.length) fail("no continuing crafts pending to be quieted: " + out.pending.join(","));
  if (inquiries.some((st) => !st.quiet)) fail("a craft still stops the press with a ship under way: " + out.pending.join(","));
  if (!plan.pending.some((st) => st.key === "colony" && !st.quiet)) fail("the colony is not the loud stage: " + out.pending.join(","));
  out.limit = plan.limit;
  if (!(plan.limit >= voyage.arriveTick - W.tick)) fail("the horizon does not reach the arrival: " + plan.limit + " < " + (voyage.arriveTick - W.tick));
  // The report carries the sentence, and the ticks are the same ticks.
  const hashBefore = worldHash(), tickBefore = W.tick;
  const r = skip.run(64);
  out.note = r.note || "";
  if (!out.note.includes(voyage.name)) fail("the result has no word of the ship: " + out.note);
  if (W.tick !== tickBefore + 64 && !r.milestone) fail("the press did not run its ticks: " + (W.tick - tickBefore));
  W.voyages.pop();
  W.civilization.stageIndex = saved; W.civilization.stage = CIV_STAGE_ORDER[saved];
  s.knownProcesses.pop();
  out.hashChanged = worldHash() !== hashBefore;
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_TRANSIT_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_TRANSIT_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
