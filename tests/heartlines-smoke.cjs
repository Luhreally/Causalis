// Heartlines smoke: a child of a secret affair is raised as the partner's, the
// chronicle keeps the secret, the truth comes out and wounds the wronged
// partner, the tree and the lover's house correct themselves, drama reaches
// the alert feed, and the people bar says who is with whom.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const heart = window.ALIFE_HEARTLINES_DEBUG, mating = window.ALIFE_MATING_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  for (let i = 0; i < 200; i++) simTick();
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  if (people.length < 3) { fail("too few people"); return out; }
  const [A, P, L] = people;
  const feed = (id) => { const q = W.components.chemistry[id].q; q[C.ORGANIC] = Math.max(q[C.ORGANIC], 80); q[C.NUTRIENT] = Math.max(q[C.NUTRIENT], 40); q[C.SOLVENT] = Math.max(q[C.SOLVENT], 160); q[C.INFO] = Math.max(q[C.INFO], 40); q[C.MEMBRANE] = Math.max(q[C.MEMBRANE], 50); q[C.ENERGY] = Math.max(q[C.ENERGY], 400); const l = W.components.life[id]; l.age = Math.max(l.age, 5000); l.integrity = Math.max(l.integrity, 900); W.components.reproduction[id].cooldown = 0; };
  for (const id of [A, P, L]) { feed(id); const soc = W.components.social[id]; soc.partnerId = 0; soc.lovers = {}; soc.affairs = []; }
  W.components.social[A].kinGroupId = 9101; W.components.social[P].kinGroupId = 9102; W.components.social[L].kinGroupId = 9103;
  const set = (x, y, v) => Object.assign(relationshipState(x, y), v);
  set(A, P, { trust: 0.6, affection: 0.6, attraction: 0.5, familiarity: 0.6 }); set(P, A, { trust: 0.6, affection: 0.6, attraction: 0.5, familiarity: 0.6 });
  formLoveBond(A, P);
  if (W.components.social[A].partnerId !== P) { fail("no partnership"); return out; }
  // The people bar: partners lately together.
  const pA = W.components.position[A], pL = W.components.position[L], pP = W.components.position[P];
  pP.x = pA.x; pP.y = pA.y; rebuildSpatialBins();
  mating.couple(A, P);
  out.statusWithPartner = heart.status(A);
  if (!/^with /.test(out.statusWithPartner)) fail("the people bar does not say who they are with: " + out.statusWithPartner);
  // A secret affair and a child of it.
  pP.x = Math.max(0, pA.x - 20); rebuildSpatialBins();
  set(A, L, { attraction: 0.7, affection: 0.5, familiarity: 0.5 }); set(L, A, { attraction: 0.7, affection: 0.5, familiarity: 0.5 });
  pL.x = pA.x; pL.y = pA.y; rebuildSpatialBins();
  mating.couple(A, L);
  if (!affairBetween(A, L)) { fail("no affair"); return out; }
  // Nothing recent enough for "with": the affair is a secret.
  W.components.social[A].lovers[L].lastTick -= 100; W.components.social[A].lovers[P].lastTick -= 100;
  out.statusSecret = heart.status(A);
  if (out.statusSecret !== "keeping a secret") fail("the people bar does not hint at the secret: " + out.statusSecret);
  const child = mating.conceive(A, L);
  if (!child) { out.skipped = "no room for a child in this world; parentage untested"; return out; }
  const ident = W.components.identity[child];
  if (ident.secretParentId !== L || ident.presumedParentId !== P) { fail("the child does not carry the secret parentage"); return out; }
  if (!(ident.parents[0] === A && ident.parents[1] === P)) fail("the world does not believe the presumed parents");
  if (!W.components.identity[P].children.includes(child)) fail("the presumed parent does not count the child");
  if (W.components.identity[L].children.includes(child)) fail("the lover openly counts the child");
  const birth = W.events.find((e) => e.type === "BirthEvent" && e.subjects[0] === child);
  out.birth = birth ? eventSentence(birth) : "";
  if (!out.birth.includes(entityName(P)) || out.birth.includes(entityName(L))) fail("the chronicle leaks the secret: " + out.birth);
  if (heart.secrets().length < 1) fail("the secret is not tracked");
  // The truth comes out.
  const grievanceBefore = relationshipState(P, A).grievance || 0;
  const reveal = heart.reveal(child, true);
  if (!reveal) { fail("no revelation"); return out; }
  out.reveal = eventSentence(reveal);
  if (!(ident.parents[1] === L)) fail("the tree did not correct itself");
  if (!W.components.identity[L].children.includes(child)) fail("the lover's line does not gain the child");
  if (W.components.identity[P].children.includes(child)) fail("the presumed parent still counts the child");
  if (!(relationshipState(P, A).grievance > grievanceBefore)) fail("the wronged partner felt nothing");
  if (!W.components.social[P].betrayedBy.includes(A)) fail("the wronged partner does not remember the betrayal");
  if (!/Born of an affair/.test(ident.titles.join("|"))) fail("the child carries no title");
  if (!/Born of .* affair/.test(personStory(child))) fail("the child's story does not tell it");
  if (!heart.alertWorthy(reveal)) fail("the revelation does not reach the alert feed");
  const houseHtml = window.ALIFE_LEGENDS_DEBUG.render("house", 9103);
  if (!/born to this house in secret/.test(houseHtml)) fail("the lover's house does not list the child");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_HEARTLINES_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_HEARTLINES_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
