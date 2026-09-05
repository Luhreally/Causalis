// Lore smoke: selecting a person yields a story card in the inspector that
// reads their partner, friends, rivals, quarrels, feud, want, and recent
// chronicle in prose, with names that inspect and a button into Legends.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const lore = window.ALIFE_LORE_DEBUG, bonds = window.ALIFE_BONDS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const people = entityAtRadius(idx(settlement.x, settlement.y), 8, KINDS.PERSON).filter((id) => classifyAlive(id));
  if (people.length < 4) { fail("too few people"); return out; }
  for (const id of people) { W.components.life[id].age = Math.max(W.components.life[id].age, 4000); window.ALIFE_CHARACTER_DEBUG.ensure(id); }
  window.ALIFE_CHARACTER_DEBUG.update();
  const a = people[0], b = people[1], c = people.find((id) => id !== a && id !== b && W.components.social[id].kinGroupId !== W.components.social[a].kinGroupId) || people[2];
  // A partner, a friend, a rival and a quarrel, all readable.
  const pb = W.components.position[b], pa = W.components.position[a]; pb.x = pa.x; pb.y = pa.y; rebuildSpatialBins();
  W.components.social[a].partnerId = 0; W.components.social[b].partnerId = 0;
  const bond = formLoveBond(a, b);
  if (!bond) fail("no love bond could be formed");
  bonds.befriend(a, c);
  const d = people.find((id) => ![a, b, c].includes(id));
  if (d) { const pd = W.components.position[d]; pd.x = pa.x; pd.y = pa.y; rebuildSpatialBins(); bonds.antagonize(a, d); bonds.quarrel(a, d); }
  const story = lore.story(a);
  out.length = story.length;
  const name = (id) => W.components.identity[id].generatedName;
  if (!/story-card/.test(story) || !/Story/.test(story)) fail("no story card");
  if (!story.includes(name(b)) || !/partnered with/.test(story)) fail("the story does not name the partner");
  if (!story.includes(name(c)) || !/Fast friends/.test(story)) fail("the story does not name the friend");
  if (d && (!/Rival of/.test(story) || !story.includes(name(d)))) fail("the story does not name the rival");
  if (d && !/quarrel/.test(story)) fail("the story does not mention the quarrel");
  if (!/years old/.test(story)) fail("the story has no age");
  if (!new RegExp('data-legend="life:' + a + '"').test(story)) fail("no button into Legends");
  if (!new RegExp('data-world-target="' + b + '"').test(story)) fail("the partner's name does not inspect them");
  if (!/Lately/.test(story) || !/data-legend="event:/.test(story)) fail("the story has no recent chronicle");
  if (/undefined|NaN/.test(story)) fail("the story contains undefined");
  // Wants and affairs read too.
  const ident = W.components.identity[a];
  if (ident.want && !/Right now they want/.test(story)) fail("the want is not told");
  const affairPartner = people.find((id) => ![a, b].includes(id) && !W.components.social[id].partnerId);
  if (affairPartner) {
    const ev = startAffair(a, affairPartner);
    if (ev && !/secret affair/.test(lore.story(a))) fail("the affair is not told");
  }
  // The inspector itself carries the card.
  selectEntity(a);
  refreshInspector();
  const html = DOM.inspectPane.innerHTML;
  if (!/story-card/.test(html)) fail("the inspector has no story card");
  if (html.indexOf("story-card") > html.indexOf("character-card") && html.includes("character-card")) fail("the story is not first in the inspector");
  // A dead or historical person still renders without throwing.
  out.deadOk = typeof lore.story(999999) === "string";
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_LORE_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_LORE_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
