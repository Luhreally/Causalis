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
  // A craft another town knows is carried to a town whose facility will not rise, once it has been pushed a long while; a short push does not carry.
  {
    // Any other standing town will do as the source, a town with no crafts yet included; a one-town world makes one of a standing camp (the camp and settlement caps may refuse).
    let other = W.settlements.find((s) => !s.ruined && s.id !== town.id);
    // A one-town world under its settlement cap can raise no second town; the carry is then read on generated worlds with scripts/site-probe.cjs instead.
    if (!other) { const standing = W.camps.find((c) => c.active); if (standing) other = createSettlement(standing.id) || null; }
    if (other && !other.knownProcesses) other.knownProcesses = [];
    if (!other) out.carry = "no second town";
    else {
      // The town holds every prior of Astronomy, so the step is Astronomy itself and its facility is the observatory.
      const grantPriors = (id) => { for (const pr of technologyDefinition(id)?.prior || []) { grantPriors(pr); if (!town.knownProcesses.includes(pr)) town.knownProcesses.push(pr); } };
      grantPriors("astronomy");
      town.knownProcesses = town.knownProcesses.filter((t) => t !== "astronomy");
      const stepId = push.nextStep(town.id, "astronomy"), facility = stepId ? facilityForTechnology(stepId) : null;
      if (stepId !== "astronomy" || !facility) out.carry = "the step to astronomy is " + stepId + " with facility " + facility;
      else if (placeHasFacility(town, facility)) out.carry = "the town already holds its " + facility;
      else {
        if (!other.knownProcesses.includes("astronomy")) other.knownProcesses.push("astronomy");
        const before = W.events.length;
        causalPushResearch(town, "astronomy", 5);
        out.carryShort = town.knownProcesses.includes("astronomy");
        if (out.carryShort) fail("a short push carried astronomy");
        causalPushResearch(town, "astronomy", 24);
        out.carry = town.knownProcesses.includes("astronomy") ? "astronomy" : "not carried";
        if (out.carry === "not carried") fail("a long push did not carry astronomy from " + other.name + " (wants " + facility + ")");
        const ev = W.events.slice(before).find((e) => e.type === "TechAdvanceEvent" && String(e.evidence?.[0] || "").includes("carried its"));
        if (!ev) fail("the carry left no TechAdvanceEvent"); else out.carrySentence = ev.evidence[0];
      }
    }
  }
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
