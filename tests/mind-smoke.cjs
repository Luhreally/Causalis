// Mind smoke: the controller runs real liquid time-constant neurons with the
// fused solver — bounded for any step, monotone toward the reversal potential,
// integer-deterministic — reversal potentials are inherited, behaviour still
// reads the network, and the Mind card renders.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const mind = window.ALIFE_MIND_DEBUG, Q = mind.q, out = { failures: [] }, fail = (m) => out.failures.push(m);
  // The fused step: stable for any dt, monotone toward A, exact integers.
  let x = 0; const trace = [];
  for (let k = 0; k < 40; k++) { const nx = mind.fused(x, Q, Q, 4096, 1); if (nx < x) fail("the driven neuron fell instead of rising at step " + k); x = nx; trace.push(x); }
  out.trace = trace.slice(0, 6).concat(["…", trace[trace.length - 1]]);
  if (!(x > Q * 0.6 && x <= Q)) fail("a fully driven neuron did not approach its reversal potential (" + x + ")");
  if (mind.fused(0, Q, -Q, 4096, 1) >= 0) fail("an inhibitory neuron did not go negative");
  const huge = mind.fused(Q, Q, -Q, 768, 100000);
  if (huge < -Q || huge > Q || !Number.isInteger(huge)) fail("a huge step left the bounds or the integers (" + huge + ")");
  const quiet = mind.fused(Q, 0, Q, 4096, 8);
  if (!(quiet < Q && quiet > 0)) fail("a quiet neuron did not decay through its leak (" + quiet + ")");
  if (mind.fused(300, 512, 900, 2048, 3) !== mind.fused(300, 512, 900, 2048, 3)) fail("the step is not deterministic");
  // Living creatures carry reversal potentials and stay in bounds.
  for (let i = 0; i < 120; i++) simTick();
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  if (!people.length) { fail("no living people"); return out; }
  let inBounds = true, revOk = true;
  for (const id of people) {
    const rev = mind.rev(id);
    if (rev.length !== 8 || rev.some((v) => Math.abs(v) < Q - 256 || Math.abs(v) > Q)) revOk = false;
    const c = W.components.cognition[id];
    if (c && Array.from(c.state).some((v) => v < -Q || v > Q)) inBounds = false;
  }
  if (!revOk) fail("reversal potentials are missing or out of range");
  if (!inBounds) fail("neuron states left the bounds");
  const stepped = mind.step(people[0]);
  out.state = stepped.state; out.gate = stepped.gate; out.dominant = stepped.dominant;
  if (stepped.gate.length !== 8 || stepped.gate.some((v) => v < 0 || v > Q)) fail("gates are not conductances in [0, Q]");
  // Children inherit each reversal potential from a parent, up to a mutation flip.
  const parent = people[0], p = W.components.position[parent];
  const child = createOrganism(KINDS.PERSON, p.x, p.y, makeRng(hashParts(W.seedHash, "child-m"), "birth"), [parent]);
  const pr = mind.rev(parent), cr = mind.rev(child);
  if (cr.length !== 8 || cr.some((v, i) => Math.abs(v) !== Math.abs(pr[i]))) fail("the child did not inherit its reversal potentials");
  // Behaviour still reads the network, and the Mind card renders.
  for (let i = 0; i < 40; i++) simTick();
  const reasoned = people.filter((id) => classifyAlive(id) && /LTC/.test(W.components.life[id]?.behaviorReason || "")).length;
  out.reasoned = reasoned;
  if (!reasoned) fail("no behaviour reason cites the network");
  const card = mind.card(people[0]);
  if (!/Mind/.test(card) || !/mind-neuron/.test(card) || !/fused solver/.test(card)) fail("the mind card is incomplete");
  if (/undefined|NaN/.test(card)) fail("the mind card contains undefined");
  selectEntity(people[0]); refreshInspector();
  if (!/mind-card/.test(DOM.inspectPane.innerHTML)) fail("the inspector has no mind card");
  // The whole thing is deterministic: two worlds from one seed agree on every neuron.
  const snapshot = people.slice(0, 5).map((id) => Array.from(W.components.cognition[id]?.state || []).join(","));
  out.snapshot = snapshot[0];
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_MIND_TEST.run();
for (const f of result.failures) failures.push(f);
// Determinism across two builds of the same seed.
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const again = sandbox.window.ALIFE_MIND_TEST.run();
if (again.snapshot !== result.snapshot) failures.push("two runs of one seed disagree on neuron states");
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_MIND_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
