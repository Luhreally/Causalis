// Causal push smoke: the skip records what it seeks, pushes the research path
// and the buildings that lead there, keeps matter booked, continues into the
// ages, and successive presses reach successive milestones on a fresh world.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const push = window.ALIFE_CAUSAL_PUSH_DEBUG, skip = window.ALIFE_CAUSAL_SKIP_DEBUG, out = { failures: [], presses: [] }, fail = (m) => out.failures.push(m);
  // Successive presses reach successive milestones without inventing matter.
  let reached = 0;
  for (let i = 0; i < 5; i++) {
    const r = skip.run();
    simTick(); // queued field effects from the general concerted effort land on the next tick
    const drift = auditMatter().delta;
    out.presses.push({ stop: r.stopReason, milestone: r.milestone?.label || null, advanced: r.advanced, drift });
    if (r.stopReason === "milestone" || r.stopReason === "epoch") reached++;
    if (drift !== 0) fail("matter drifted during a push: " + drift);
  }
  if (reached < 4) fail("presses did not reach milestones: " + JSON.stringify(out.presses));
  if (push.target()) fail("the objective was not released after the skip");
  // The research path: a town without storage is steered to storage first on the way to writing.
  const town = W.settlements.find((s) => !s.ruined);
  if (!town) { fail("no town"); return out; }
  town.knownProcesses = town.knownProcesses.filter((t) => !["storage", "writing", "governance"].includes(t));
  out.nextStep = push.nextStep(town.id, "writing");
  if (!(out.nextStep === "storage" || (out.nextStep && out.nextStep !== "writing"))) fail("the research path did not start from the missing prior: " + out.nextStep);
  // A push toward records sets the focus, delivers samples and may grant insight.
  const before = W.conservation.playerInput;
  const acted = push.push("records");
  out.recordsPush = acted;
  if (acted !== "research") fail("the records push did not push research: " + acted);
  if (!town.researchFocus) fail("no research focus was set");
  if (!(W.conservation.playerInput >= before)) fail("player input was not booked");
  const step = technologyDefinition(town.researchFocus);
  if (step && !(step.materials || []).every((sp) => (town.researchInventory?.[sp] || 0) >= 10)) fail("research samples were not delivered for " + town.researchFocus);
  // A push toward a hall plans it and feeds its rare inputs into the stores.
  town.knownProcesses.push("governance");
  const hallPush = push.push("hall");
  out.hallPush = hallPush;
  const hall = W.buildings.find((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === town.id && b.type === "hall");
  if (!hall) fail("the hall push planned no hall: " + hallPush);
  // Beyond the terrestrial stages the skip seeks the ages.
  const saved = W.civilization.stageIndex;
  W.civilization.stageIndex = CIV_STAGE_ORDER.length - 1; W.civilization.stage = CIV_STAGE_ORDER.at(-1);
  out.lateStages = push.stages().map((s) => s.key);
  if (!out.lateStages.includes("starflight") || !out.lateStages.includes("ascension")) fail("no age milestones past the terrestrial stages: " + out.lateStages.join(","));
  const late = push.push("starflight");
  if (late !== "research") fail("the starflight push did not push research: " + late);
  W.civilization.stageIndex = saved; W.civilization.stage = CIV_STAGE_ORDER[saved];
  push.finish();
  simTick();
  if (auditMatter().delta !== 0) fail("matter drifted after the pushes: " + auditMatter().delta);
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_CAUSAL_PUSH_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_CAUSAL_PUSH_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
