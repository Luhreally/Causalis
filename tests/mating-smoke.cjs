// Mating smoke: people couple by choice, partners first, never kin; a partnered
// person coupling with another is an affair; only some couplings conceive; the
// chronicle and the person's story say who lay with whom.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const mating = window.ALIFE_MATING_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  for (let i = 0; i < 200; i++) simTick();
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  if (people.length < 4) { fail("too few people: " + people.length); return out; }
  const [A, B, Cc, D] = people;
  // Four fertile adults, all in different houses except D who is A's kin.
  const feed = (id) => { const q = W.components.chemistry[id].q; q[C.ORGANIC] = Math.max(q[C.ORGANIC], 80); q[C.NUTRIENT] = Math.max(q[C.NUTRIENT], 40); q[C.SOLVENT] = Math.max(q[C.SOLVENT], 160); q[C.INFO] = Math.max(q[C.INFO], 40); q[C.MEMBRANE] = Math.max(q[C.MEMBRANE], 50); q[C.ENERGY] = Math.max(q[C.ENERGY], 400); const l = W.components.life[id]; l.age = Math.max(l.age, 5000); l.integrity = Math.max(l.integrity, 900); const r = W.components.reproduction[id]; r.cooldown = 0; r.mode = "paired"; };
  for (const id of [A, B, Cc, D]) { feed(id); const soc = W.components.social[id]; soc.partnerId = 0; soc.lovers = {}; }
  W.components.social[A].kinGroupId = 9001; W.components.social[B].kinGroupId = 9002; W.components.social[Cc].kinGroupId = 9003; W.components.social[D].kinGroupId = 9001;
  const pA = W.components.position[A];
  const put = (id, dx) => { const p = W.components.position[id]; p.x = Math.max(0, Math.min(W.width - 1, pA.x + dx)); p.y = pA.y; rebuildSpatialBins(); };
  const set = (x, y, v) => { const r = relationshipState(x, y); Object.assign(r, v); return r; };
  // Kin standing beside A with strong attraction are never chosen.
  put(D, 1); put(B, 30); put(Cc, 30);
  set(A, D, { attraction: 0.9, familiarity: 0.8 }); set(D, A, { attraction: 0.9, familiarity: 0.8 });
  if (mating.choose(A)) fail("kin were chosen as a mate");
  // Partners couple first.
  put(D, 30); put(B, 1);
  set(A, B, { trust: 0.6, affection: 0.6, attraction: 0.5, familiarity: 0.6 }); set(B, A, { trust: 0.6, affection: 0.6, attraction: 0.5, familiarity: 0.6 });
  formLoveBond(A, B);
  if (W.components.social[A].partnerId !== B) { fail("no partnership"); return out; }
  if (mating.choose(A) !== B) fail("a partner beside them was not chosen");
  const before = mating.couplings();
  const fertile = canReproduce(A) && canReproduce(B);
  if (fertile) mating.update(); else { out.naturalSkipped = "the fixture town is at its carrying capacity or has no safe birth site; coupling forced"; mating.couple(A, B); }
  const coupled = W.events.find((e) => e.type === "MatingEvent" && e.subjects.includes(A) && e.subjects.includes(B));
  if (!coupled) fail("partners beside each other did not couple"); else { out.partners = eventSentence(coupled); if (!coupled.data.partners) fail("the coupling of partners was not marked as such"); }
  if (!(mating.couplings() > before)) fail("couplings were not counted");
  if (!mating.lovers(A)[B]) fail("lovers are not remembered");
  // A conception adds a child of both parents.
  const childrenBefore = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON).length;
  W.components.reproduction[A].cooldown = 0; W.components.reproduction[B].cooldown = 0;
  const child = mating.conceive(A, B);
  const born = W.events.filter((e) => e.type === "BirthEvent").at(-1);
  if (child == null && !born) fail("no conception");
  if (born && !(born.subjects.includes(A) && born.subjects.includes(B))) fail("the birth does not name both parents");
  // A partnered person coupling with a lover is an affair.
  put(B, 30); put(Cc, 1);
  set(A, Cc, { attraction: 0.7, affection: 0.5, familiarity: 0.5 }); set(Cc, A, { attraction: 0.7, affection: 0.5, familiarity: 0.5 });
  feed(A); feed(Cc);
  if (mating.choose(A) !== Cc) fail("a strongly drawn lover beside them was not chosen: " + mating.choose(A));
  const betrayalsBefore = W.events.filter((e) => e.type === "BetrayalEvent").length;
  if (canReproduce(A) && canReproduce(Cc)) mating.update(); else mating.couple(A, Cc);
  const secret = W.events.find((e) => e.type === "MatingEvent" && e.subjects.includes(A) && e.subjects.includes(Cc));
  if (!secret) fail("the lovers did not couple");
  else { out.secret = eventSentence(secret); if (!secret.data.secret) fail("the coupling was not marked secret"); }
  if (!(W.events.filter((e) => e.type === "BetrayalEvent").length > betrayalsBefore)) fail("the coupling did not start an affair");
  if (!affairBetween(A, Cc)) fail("the affair is not recorded");
  // Without any bond or attraction, two adults do not couple.
  put(Cc, 30); put(D, 30);
  const E = people.find((id) => ![A, B, Cc, D].includes(id) && classifyAlive(id));
  if (E) { feed(E); W.components.social[E].partnerId = 0; W.components.social[E].kinGroupId = 9005; put(E, 1); set(A, E, { attraction: 0.1 }); set(E, A, { attraction: 0.1 }); if (mating.choose(A) === E) fail("a stranger with no attraction was chosen"); }
  // The story says who they have lain with.
  const story = personStory(A);
  if (!/Has lain with/.test(story)) fail("the story does not say who they lay with");
  out.lovers = Object.keys(mating.lovers(A)).length;
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_MATING_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_MATING_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
