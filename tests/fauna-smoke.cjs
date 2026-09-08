// Fauna smoke: on the Earth-like seed a herbivore and a predator take the
// side-view quadruped form, are drawn as such in both lenses without touching
// the world, keep their lineage's pattern in the label, and people are left
// as they were; on an alien seed a many-legged beast keeps its old form.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const fauna = window.ALIFE_FAUNA_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  for (let i = 0; i < 64; i++) simTick();
  const herb = W.activeIds.find((id) => W.kind[id] === KINDS.HERBIVORE && classifyAlive(id) && W.components.position[id]),
    pred = W.activeIds.find((id) => W.kind[id] === KINDS.PREDATOR && classifyAlive(id) && W.components.position[id]),
    person = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  if (!herb || !pred) { fail("no beasts to draw"); return out; }
  out.herb = fauna.model(herb); out.pred = fauna.model(pred);
  if (!out.herb?.sideView || out.herb.personForm !== "quadruped" || out.herb.role !== KINDS.HERBIVORE) fail("the herbivore is not a side-view quadruped: " + JSON.stringify(out.herb));
  if (!out.pred?.sideView || out.pred.personForm !== "quadruped" || out.pred.role !== KINDS.PREDATOR) fail("the predator is not a side-view quadruped: " + JSON.stringify(out.pred));
  if (!/Grazer/.test(out.herb?.label || "") || !/Hunter/.test(out.pred?.label || "")) fail("the labels do not name grazer and hunter");
  if (person) { const pm = creatureModel(person); if (pm.faunaRole || pm.personForm === "quadruped") fail("a person was turned into a beast"); }
  const clean = (opts) => { const h0 = worldHash(); window.ALIFE_VISUAL_DEBUG.renderOnly(opts); if (worldHash() !== h0) fail("drawing fauna changed the world (" + opts.view + ")"); };
  const hp = W.components.position[herb], pp = W.components.position[pred];
  fauna.reset();
  clean({ view: "iso", quality: "high", zoom: 6, x: hp.x, y: hp.y, now: 5000 });
  out.isoHerb = fauna.counts();
  if (!(out.isoHerb.herbivores >= 1)) fail("no herbivore was drawn side-on: " + JSON.stringify(out.isoHerb));
  fauna.reset();
  clean({ view: "top", quality: "high", zoom: 6, x: pp.x, y: pp.y, now: 5100 });
  out.topPred = fauna.counts();
  if (!(out.topPred.predators >= 1)) fail("no predator was drawn side-on: " + JSON.stringify(out.topPred));
  // Fleeing and hunting stretch the stride without error; the young are small.
  const life = W.components.life[herb], keep = life.behavior;
  life.behavior = "flee";
  clean({ view: "iso", quality: "high", zoom: 8, x: hp.x, y: hp.y, now: 5200 });
  life.behavior = keep;
  clean({ view: "oblique", quality: "low", zoom: 2, x: hp.x, y: hp.y, now: 5300 });
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const alienSource = String.raw`(() => {
  const fauna = window.ALIFE_FAUNA_DEBUG, out = { failures: [] };
  for (let i = 0; i < 32; i++) simTick();
  const beasts = W.activeIds.filter((id) => (W.kind[id] === KINDS.HERBIVORE || W.kind[id] === KINDS.PREDATOR) && classifyAlive(id)).map((id) => fauna.model(id)).filter(Boolean);
  out.forms = beasts.slice(0, 12).map((m) => [m.appendages, m.sideView]);
  const manyLegged = beasts.filter((m) => m.appendages > 4);
  if (manyLegged.some((m) => m.sideView)) out.failures.push("a many-legged beast was drawn side-on");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "causal-origin", size: "small" });
const result = sandbox.window.ALIFE_FAUNA_TEST.run();
for (const f of result.failures) failures.push(f);
game.createTestWorld({ seed: "x3", size: "small" });
const alien = sandbox.window.ALIFE_FAUNA_TEST.alien();
for (const f of alien.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result, alien }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_FAUNA_TEST=Object.freeze({run:()=>${fixtureSource},alien:()=>${alienSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
