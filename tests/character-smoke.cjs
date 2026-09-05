// Character smoke: traits at birth, wants chosen and fulfilled, skills that grow
// from deeds with adept titles, the combat bonus, and the inspector card.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const character = window.ALIFE_CHARACTER_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  for (let i = 0; i < 200; i++) simTick();
  out.people = character.ensureAll();
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  if (!people.length) { fail("no living people"); return out; }
  const traitNames = new Set(Object.keys(character.traits));
  for (const id of people.slice(0, 20)) {
    const traits = W.components.identity[id].traits || [];
    if (traits.length < 2 || traits.length > 3) fail("person " + id + " has " + traits.length + " traits");
    if (traits.some((t) => !traitNames.has(t))) fail("unknown trait on person " + id);
  }
  out.sampleTraits = people.slice(0, 4).map((id) => W.components.identity[id].traits);
  out.traitSpread = new Set(people.flatMap((id) => W.components.identity[id].traits || [])).size;
  if (out.traitSpread < 4) fail("traits show almost no variety across people");
  // Newborns record a birthplace.
  const parent = people[0], p = W.components.position[parent];
  const child = createOrganism(KINDS.PERSON, p.x, p.y, makeRng(hashParts(W.seedHash, "child-c"), "birth"), [parent]);
  if (W.components.identity[child].birthTile !== idx(p.x, p.y)) fail("newborn has no birthplace");
  if (!W.components.identity[child].traits?.length) fail("newborn has no traits");
  // Wants: adults choose one; a fulfilled want is chronicled. The fixture world is
  // young, so a few founders are aged to maturity first.
  for (const id of people.slice(0, 8)) W.components.life[id].age = Math.max(W.components.life[id].age, 4000);
  out.wanting = character.update();
  if (!out.wanting) fail("no adult chose a want");
  const seeker = people.find((id) => W.components.identity[id].want?.id === "partner");
  if (seeker) {
    const other = people.find((id) => id !== seeker);
    W.components.social[seeker].partnerId = other;
    character.update();
    const ident = W.components.identity[seeker];
    if (ident.want?.id === "partner") fail("a partnered person still wants a partner");
    if (!(ident.fulfilled || []).includes("partner")) fail("fulfilled want was not recorded");
    const aspiration = W.events.filter((e) => e.type === "AspirationEvent").at(-1);
    if (!aspiration) fail("no AspirationEvent chronicled"); else out.aspiration = eventSentence(aspiration);
  } else out.note = "no partner-seeker to fulfil";
  // Skills grow from deeds and earn titles.
  const crafter = people[1] || people[0];
  character.grant(crafter, "craft", 20);
  character.grant(crafter, "craft", 25);
  const skills = W.components.identity[crafter].skills;
  out.craft = skills.craft;
  if (skills.craft < 40) fail("skill did not accumulate");
  if (!W.components.identity[crafter].titles.some((t) => t === "Adept Crafter")) fail("adept title missing");
  const mastery = W.events.filter((e) => e.type === "MasteryEvent").at(-1);
  if (!mastery) fail("no MasteryEvent chronicled"); else out.mastery = eventSentence(mastery);
  character.grant(crafter, "fight", 50);
  out.fightBonus = character.fightBonus(crafter);
  if (out.fightBonus < 2) fail("fight skill gives no strike bonus");
  const card = character.card(crafter);
  out.cardLength = card.length;
  if (!/Character/.test(card) || !/Craft/.test(card) || /undefined|NaN/.test(card)) fail("character card is broken");
  out.digest = JSON.stringify(people.slice(0, 12).map((id) => W.components.identity[id].traits));
  return out;
})()`;

const assertions = String.raw`
const failures = [];
const run = () => { game.createTestWorld({ seed: "x3", size: "small" }); return sandbox.window.ALIFE_CHARACTER_TEST.run(); };
const first = run(), second = run();
for (const f of first.failures) failures.push(f);
if (first.digest !== second.digest) failures.push("traits were not deterministic across identical runs");
delete first.digest;
console.log(JSON.stringify({ ok: !failures.length, failures, result: first }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_CHARACTER_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
