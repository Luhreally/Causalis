// Houses smoke: a registry of houses with members living and dead and the
// Voices they held, a family tree grown from the oldest known members, dynasty
// reading on polity pages, and the index, list, and links into house pages.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const houses = window.ALIFE_HOUSES_DEBUG, legends = window.ALIFE_LEGENDS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const faction = settlement.factionId ? W.factions.find((f) => f.id === settlement.factionId) : createFaction(settlement.id);
  if (!faction) { fail("no faction"); return out; }
  const people = entityAtRadius(idx(settlement.x, settlement.y), 8, KINDS.PERSON).filter((id) => classifyAlive(id));
  if (people.length < 3) { fail("too few people"); return out; }
  if (!faction.leaderId || !classifyAlive(faction.leaderId)) { faction.leaderId = people[0]; addRelation(faction.leaderId, faction.entityId, "leads", 1); }
  // A parent, a child, and a grandchild in one house.
  const parent = faction.leaderId, p = W.components.position[parent];
  const child = createOrganism(KINDS.PERSON, p.x, p.y, makeRng(hashParts(W.seedHash, "house-child"), "birth"), [parent]);
  W.components.identity[parent].children.push(child);
  const grandchild = createOrganism(KINDS.PERSON, p.x, p.y, makeRng(hashParts(W.seedHash, "house-grandchild"), "birth"), [child]);
  W.components.identity[child].children.push(grandchild);
  rebuildSpatialBins();
  out.houses = houses.update();
  const kin = W.components.social[parent].kinGroupId;
  const house = houses.house(kin);
  if (!house) { fail("the leader's house was not registered"); return out; }
  out.house = { name: house.name, members: house.members.length, voices: house.voices.length };
  if (!house.name) fail("the house has no name");
  if (![parent, child, grandchild].every((id) => house.members.includes(id))) fail("the family is not all in one house");
  if (!house.voices.some((v) => v.id === parent && v.factionId === faction.id)) fail("the Voice was not recorded for the house");
  // The tree shows three generations with the Voice marked.
  const tree = houses.tree(kin);
  out.treeLength = tree.length;
  if (!/<ul class="tree">/.test(tree)) fail("no tree was grown");
  const depth = (tree.match(/<ul/g) || []).length;
  if (depth < 3) fail("the tree does not show three generations (" + depth + " levels)");
  if (!tree.includes(W.components.identity[grandchild].generatedName)) fail("the grandchild is missing from the tree");
  if (!/♛/.test(tree)) fail("the Voice is not marked in the tree");
  // A second Voice from the same house makes a dynasty.
  const successor = child;
  removeRelation(parent, faction.entityId, "leads");
  addRelation(successor, faction.entityId, "leads", 1);
  faction.leaderId = successor;
  W.components.life[successor].age = 4000;
  houses.update();
  out.dynasty = houses.dynasty(kin);
  if (!out.dynasty || out.dynasty.count < 2) fail("two Voices from one house made no dynasty");
  const factionPage = legends.render("faction", faction.id);
  if (!/Ruling house/.test(factionPage) || !/dynasty/.test(factionPage)) fail("the polity page does not name the ruling dynasty");
  // Pages, index, list, and links.
  const page = houses.page(kin);
  if (!/Family tree/.test(page) || !/Voices held/.test(page)) fail("the house page is incomplete");
  if (!/Houses/.test(legends.render("index", 0))) fail("the Legends index has no houses section");
  if (!/House of/.test(legends.render("list", "houses"))) fail("the houses list is empty");
  if (!new RegExp('data-legend="house:' + kin + '"').test(legends.render("life", parent))) fail("the life page has no family-tree button");
  if (!/house:/.test(window.ALIFE_LORE_DEBUG.story(parent))) fail("the story does not link the house");
  if (!/The house of/.test(legends.render("house", kin))) fail("the legend page router does not route houses");
  // A dead member stays in the tree by name.
  killEntity(grandchild, "a test death", 0);
  const after = houses.tree(kin);
  if (!after.includes(W.historicalIdentities[grandchild]?.generatedName || W.historicalIdentities[grandchild]?.name || "§")) out.deadNote = "the dead grandchild left the record";
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_HOUSES_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_HOUSES_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
