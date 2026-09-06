// Wealth smoke: residents are valued and ranked, a town reads its inequality,
// a new richest person is chronicled, standing shows in the story and on
// Legends pages, and the wealth map mode lights where the rich stand.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const wealth = window.ALIFE_WEALTH_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const people = entityAtRadius(idx(settlement.x, settlement.y), 8, KINDS.PERSON).filter((id) => classifyAlive(id) && W.components.social[id].factionId === settlement.factionId);
  if (people.length < 4) { fail("too few residents"); return out; }
  const [a, b] = people;
  W.components.inventory[a].materials[C.METAL] = Math.max(W.components.inventory[a].materials[C.METAL], 40);
  wealth.update();
  out.wealthA = wealth.wealth(a);
  out.standingA = wealth.standing(a);
  if (out.standingA !== "rich") fail("the metal-laden resident is not rich (" + out.standingA + ")");
  out.inequality = wealth.inequality(settlement.id);
  if (!(out.inequality > 0)) fail("the town reads no inequality");
  if (!people.some((id) => wealth.standing(id) === "poor")) fail("no one is poor beside the rich");
  out.line = wealth.line(a);
  if (!/rich/.test(out.line)) fail("the standing line does not say rich");
  // A new richest person is chronicled.
  W.components.inventory[b].materials[C.METAL] = Math.max(W.components.inventory[b].materials[C.METAL], 90);
  wealth.update();
  const fortune = W.events.filter((e) => e.type === "FortuneEvent").at(-1);
  if (!fortune || !fortune.subjects.includes(b)) fail("the new richest person was not chronicled");
  else out.fortuneSentence = eventSentence(fortune);
  // Stories and pages carry standing; the map mode lights the rich.
  if (!/rich/.test(window.ALIFE_LORE_DEBUG.story(b))) fail("the story does not tell the standing");
  if (!/Standing/.test(window.ALIFE_LEGENDS_DEBUG.render("life", b))) fail("the life page has no standing row");
  if (!/Inequality/.test(window.ALIFE_LEGENDS_DEBUG.render("place", settlement.id))) fail("the place page has no inequality row");
  const pb = W.components.position[b], tile = idx(pb.x, pb.y);
  if (!(overlayValue("wealth", tile) > 0)) fail("the wealth overlay is dark where the rich stand");
  if (overlayStyle("wealth", tile) === "transparent") fail("the wealth overlay draws nothing where the rich stand");
  const before = worldHash(), overlay = UI.overlay;
  UI.overlay = "wealth";
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "standard", zoom: 3, now: 5000 });
  UI.overlay = overlay;
  if (worldHash() !== before) fail("rendering the wealth overlay changed the world hash");
  window.ALIFE_BONDS_DEBUG.update();
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_WEALTH_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_WEALTH_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
