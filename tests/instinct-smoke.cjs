// Instinct smoke: minds are born with an inherited, varying instinct vector
// instead of one table; founders' output wiring follows their senses; children
// take each instinct gene from a parent; deliberate minds damp unsure impulses;
// and a starving person eats carrion, eats the dead past their own threshold,
// and robs only the weaker of food, all of it chronicled.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const inst = window.ALIFE_INSTINCT_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  for (let i = 0; i < 200; i++) simTick();
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  if (people.length < 4) { fail("too few people: " + people.length); return out; }
  const [A, B, Cc, D] = people;
  // Every mind carries an instinct vector, and they are not all the same.
  const ia = inst.instinct(A), ib = inst.instinct(B);
  if (ia.length !== LTC_ACTIONS.length) fail("no instinct vector");
  if (!ia.some((v) => v !== 0)) fail("instinct is empty");
  if (ia.every((v, i) => v === ib[i])) fail("two founders were born with identical instincts");
  const food = LTC_ACTIONS.indexOf("food"), flee = LTC_ACTIONS.indexOf("flee"), wander = LTC_ACTIONS.indexOf("wander");
  if (!(ia[food] > ia[wander] && ia[flee] > ia[wander])) fail("a person's instinct does not favour food and flight over wandering: " + ia.join(","));
  const genes = inst.genes(A);
  if (!(genes.deliberation >= 0 && genes.deliberation <= LTC_Q && genes.restraint >= 0 && genes.restraint <= LTC_Q)) fail("temperament genes out of range: " + JSON.stringify(genes));
  // A fresh mind's values start from its instinct.
  const c = initCognition(A);
  if (!c.instinctSeeded) fail("the mind was not seeded from instinct");
  // Animals have instincts of their own kind.
  const herb = W.activeIds.find((id) => W.kind[id] === KINDS.HERBIVORE && classifyAlive(id));
  if (herb) { const ih = inst.instinct(herb); if (!(ih[flee] > ih[LTC_ACTIONS.indexOf("work")])) fail("a herbivore's instinct does not favour flight over work"); }
  // Founders' output wiring follows the senses: hunger neurons push food.
  const base = inst.outBase(KINDS.PERSON);
  if (!base.some((v) => v > 300)) fail("the innate output wiring is flat");
  // Children take each instinct gene from one parent (or a mutation of it).
  const feed = (id) => { const q = W.components.chemistry[id].q; q[C.ORGANIC] = Math.max(q[C.ORGANIC], 80); q[C.NUTRIENT] = Math.max(q[C.NUTRIENT], 40); q[C.SOLVENT] = Math.max(q[C.SOLVENT], 160); q[C.INFO] = Math.max(q[C.INFO], 40); q[C.MEMBRANE] = Math.max(q[C.MEMBRANE], 50); q[C.ENERGY] = Math.max(q[C.ENERGY], 400); const l = W.components.life[id]; l.age = Math.max(l.age, 5000); l.integrity = Math.max(l.integrity, 900); W.components.reproduction[id].cooldown = 0; };
  feed(A); feed(B);
  for (const id of [A, B]) { const soc = W.components.social[id]; soc.partnerId = 0; soc.lovers = {}; }
  W.components.social[A].kinGroupId = 9101; W.components.social[B].kinGroupId = 9102;
  const pA = W.components.position[A], pB = W.components.position[B]; pB.x = pA.x; pB.y = pA.y; rebuildSpatialBins();
  const child = window.ALIFE_MATING_DEBUG.conceive(A, B);
  if (child) {
    const ic = inst.instinct(child);
    let fromParent = 0;
    for (let i = 0; i < ic.length; i++) if (ic[i] === ia[i] || ic[i] === ib[i]) fromParent++;
    out.childGenesFromParents = fromParent + "/" + ic.length;
    if (fromParent < ic.length * 0.6) fail("the child's instincts do not come from its parents: " + out.childGenesFromParents);
  } else out.childSkipped = "no room for a child";
  // Deliberation damps an unsure impulse when the body is not in extremity.
  const cd = initCognition(Cc);
  cd.confidence = 0;
  const g = W.components.genome[Cc].controller; g.deliberation = LTC_Q;
  const lf = W.components.life[Cc]; lf.hunger = 20; lf.thirst = 20; lf.threatId = 0;
  advanceLTC(Cc);
  const damped = Math.max(...Array.from(cd.output).map(Math.abs));
  g.deliberation = 0; cd.confidence = 0;
  advanceLTC(Cc);
  const raw = Math.max(...Array.from(cd.output).map(Math.abs));
  out.impulse = { damped, raw };
  if (raw > 0 && !(damped < raw)) fail("a deliberate mind did not damp its unsure impulses: " + JSON.stringify(out.impulse));
  // Hunger past bearing: carrion first.
  const herbCorpseSource = W.activeIds.find((id) => W.kind[id] === KINDS.HERBIVORE && classifyAlive(id) && id !== herb);
  const pD = W.components.position[D];
  if (herbCorpseSource) {
    const cp = W.components.position[herbCorpseSource]; cp.x = pD.x; cp.y = pD.y;
    killEntity(herbCorpseSource, "a fall for the test", 0);
    W.components.chemistry[herbCorpseSource].q[C.ORGANIC] = Math.max(W.components.chemistry[herbCorpseSource].q[C.ORGANIC], 30);
    rebuildSpatialBins();
    const before = W.components.inventory[D].digestive[C.ORGANIC];
    const act = inst.act(D, { hunger: 85, ignoreFood: true });
    out.carrion = act?.act || "none";
    if (out.carrion !== "carrion") fail("a starving person beside carrion did not eat it: " + out.carrion);
    if (!(W.components.inventory[D].digestive[C.ORGANIC] > before)) fail("carrion fed nobody");
    W.components.chemistry[herbCorpseSource].q[C.ORGANIC] = 0;
  }
  // The dead: refused below the person's own threshold, eaten above it.
  const victimSource = people.find((id) => ![A, B, Cc, D].includes(id) && classifyAlive(id));
  if (victimSource) {
    const vp = W.components.position[victimSource]; vp.x = pD.x; vp.y = pD.y;
    killEntity(victimSource, "a fever for the test", 0);
    W.components.chemistry[victimSource].q[C.ORGANIC] = Math.max(W.components.chemistry[victimSource].q[C.ORGANIC], 30);
    rebuildSpatialBins();
    out.threshold = inst.threshold(D);
    if (!(out.threshold > 78 && out.threshold <= 99)) fail("taboo threshold out of range: " + out.threshold);
    const refused = inst.act(D, { hunger: out.threshold - 1, ignoreFood: true });
    if (refused && refused.act === "cannibalism") fail("the dead were eaten below the threshold");
    const ate = inst.act(D, { hunger: 99, ignoreFood: true });
    out.cannibalism = ate?.act || "none";
    if (out.cannibalism !== "cannibalism") fail("a starving person past their threshold did not eat the dead: " + out.cannibalism);
    else {
      out.cannibalSentence = eventSentence(ate.event);
      if (!alertWorthy(ate.event)) fail("cannibalism does not reach the alert feed");
      if (!/Ate of the dead/.test(W.components.identity[D].titles.join("|"))) fail("no title for eating the dead");
      if (!/Ate of the dead/.test(personStory(D))) fail("the story does not tell it");
      if (!/Instinct/.test(mindCard(D))) fail("the Mind card shows no instinct row");
    }
  }
  // Robbery: only the weaker are robbed, and never kin. No corpse is left to eat first.
  for (const o of nearbyIds(D, 2, (o) => W.kind[o] === KINDS.CORPSE)) W.components.chemistry[o].q[C.ORGANIC] = 0;
  const strong = D, weak = Cc;
  const pw = W.components.position[weak]; pw.x = pD.x; pw.y = pD.y; rebuildSpatialBins();
  W.components.inventory[weak].materials[C.ORGANIC] = 20;
  W.components.identity[strong].traits = ["bold", "hardy"]; W.components.identity[weak].traits = ["wary", "frail"];
  W.components.identity[strong].skills.fight = 60; W.components.identity[weak].skills.fight = 0;
  W.components.life[weak].hunger = 90; W.components.life[strong].hunger = 10;
  W.components.genome[strong].controller.restraint = 0;
  out.strength = { strong: +inst.strength(strong).toFixed(2), weak: +inst.strength(weak).toFixed(2) };
  const robbed = inst.act(strong, { hunger: 92, ignoreFood: true });
  out.robbery = robbed?.act || "none";
  if (out.robbery !== "robbery") fail("a strong starving person did not rob a weaker one carrying food: " + out.robbery + " " + JSON.stringify(out.strength));
  else {
    out.robberySentence = eventSentence(robbed.event);
    if (!(W.components.inventory[weak].materials[C.ORGANIC] < 20)) fail("the victim lost no food");
    if (!(relationshipState(weak, strong).grievance > 0)) fail("the victim bears no grievance");
  }
  // The weaker one, starving, does not try it on the stronger.
  W.components.inventory[strong].materials[C.ORGANIC] = 20;
  const refrained = inst.act(weak, { hunger: 92, ignoreFood: true });
  if (refrained && refrained.act === "robbery") fail("a weak person robbed a stronger one");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_INSTINCT_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_INSTINCT_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
