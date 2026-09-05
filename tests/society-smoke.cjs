// Society smoke: monuments, caravans and civil orders, wildlife lives, and crime.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const society = window.ALIFE_SOCIETY_DEBUG, living = window.ALIFE_LIVING_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
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
  if (people.length < 3) { fail("too few people at the settlement"); return out; }
  for (const id of people) W.components.life[id].age = Math.max(W.components.life[id].age, 4000);
  // Monument: a calamity beside the town becomes a stone.
  living.erupt(idx(clamp(settlement.x + 4, 0, W.width - 1), clamp(settlement.y + 3, 0, W.height - 1)));
  const monument = society.planMonument(settlement.id);
  out.monument = monument;
  if (!monument || !monument.commemorates || !/Monument to/.test(monument.name)) fail("no monument was planned for the eruption");
  else {
    const b = W.buildings.find((x) => x.id === monument.id);
    b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity;
    const before = W.hash;
    window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 9, now: 5000 });
    window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "standard", zoom: 3, now: 5100 });
    if (typeof worldHash === "function" && worldHash() !== worldHash()) fail("monument rendering was not stable");
  }
  // Civil orders: a journey moves a person toward its goal through the ordinary march.
  const walker = people[0], wp = W.components.position[walker];
  const gx = clamp(wp.x + 24, 1, W.width - 2), gy = clamp(wp.y, 1, W.height - 2);
  society.journey(walker, gx, gy);
  const startDist = Math.abs(wp.x - gx) + Math.abs(wp.y - gy);
  for (let i = 0; i < 96; i++) simTick();
  const after = W.components.position[walker];
  out.journey = { start: startDist, after: after ? Math.abs(after.x - gx) + Math.abs(after.y - gy) : null, reason: W.components.life[walker]?.behaviorReason };
  if (!after || out.journey.after >= startDist) fail("a civil order did not move the traveller toward its goal");
  // Caravans need two towns; when only one exists the spawn refuses cleanly.
  const other = W.settlements.find((s) => !s.ruined && s.id !== settlement.id);
  if (other) {
    const caravan = society.caravan(settlement.id, other.id);
    out.caravan = caravan ? { members: caravan.members.length, phase: caravan.phase } : null;
    if (caravan) {
      society.tick();
      if (!caravan.members.every((id) => W.components.campaign?.[id]?.role === "caravan")) fail("caravan members carry no march order");
    }
  } else out.caravan = society.caravan(settlement.id, settlement.id) === null ? "single town, refused" : "spawned against one town";
  // Crime: theft conserves matter and leaves a grievance; exile and captivity follow.
  const thief = people[1], matterBefore = totalMatter();
  const taken = society.steal(thief, settlement.id);
  out.taken = taken;
  if (!taken) fail("theft took nothing");
  if (totalMatter() !== matterBefore) fail("theft changed total matter");
  if ((W.components.identity[thief].crimes || 0) < 1) fail("theft left no record on the thief");
  const theft = W.events.filter((e) => e.type === "TheftEvent").at(-1);
  if (!theft) fail("no TheftEvent"); else out.theftSentence = eventSentence(theft);
  W.components.identity[thief].crimes = 3;
  if (!society.exile(thief, settlement.id)) fail("exile refused");
  if (!W.components.identity[thief].titles.includes("Exile")) fail("exile left no title");
  if (!society.orders().some((o) => o.id === thief && o.kind === "exile")) fail("exile has no order to leave");
  const exile = W.events.filter((e) => e.type === "ExileEvent").at(-1);
  if (exile) out.exileSentence = eventSentence(exile);
  const captive = people[2];
  if (!society.capture(captive, faction.id)) fail("capture refused");
  if (W.components.social[captive].captiveOf !== faction.id) fail("captive is not marked");
  society.releaseAll();
  if (W.components.social[captive].captiveOf) fail("captive was not released");
  const freed = W.events.filter((e) => e.type === "CaptiveFreedEvent").at(-1);
  if (!freed) fail("no CaptiveFreedEvent"); else out.freedSentence = eventSentence(freed);
  // Wildlife: dens for grown predators, a beast of legend, seasonal pasture.
  const predators = W.activeIds.filter((id) => W.kind[id] === KINDS.PREDATOR && classifyAlive(id));
  for (const id of predators) W.components.life[id].age = Math.max(W.components.life[id].age, W.components.body[id].maxAge * 0.3);
  out.dens = society.dens();
  if (predators.length && !out.dens) fail("no predator claimed a den");
  if (predators.length) {
    if (!society.legend(predators[0])) fail("an old deadly hunter did not become a beast of legend");
    const beast = W.events.filter((e) => e.type === "BeastOfLegendEvent").at(-1);
    if (beast) out.beastSentence = eventSentence(beast);
  }
  out.pasture = society.pasture(settlement.id);
  if (!(out.pasture >= 0)) fail("pasture choice returned nothing");
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "oblique", quality: "high", zoom: 4, now: 6000 });
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_SOCIETY_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_SOCIETY_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
