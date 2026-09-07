// Bonds smoke: friendships and rivalries declared from measured relationships,
// quarrels between rivals, feuds between houses that weigh on polities and end
// in marriage, plus the inspector card, Legends pages, and stable rendering.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const bonds = window.ALIFE_BONDS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
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
  if (people.length < 5) { fail("too few people at the settlement"); return out; }
  for (const id of people) { W.components.life[id].age = Math.max(W.components.life[id].age, 4000); window.ALIFE_CHARACTER_DEBUG.ensure(id); }
  // Two people in different houses, standing together.
  const houseOf = (id) => W.components.social[id].kinGroupId;
  // A pair whose houses hold no feud and who contest nothing, so trust alone decides.
  const noFeud = (x, y) => !(W.feuds || []).some((f) => !f.ended && f.key === feudKey(houseOf(x), houseOf(y)));
  const a = people[0], b = people.find((id) => houseOf(id) !== houseOf(a) && noFeud(a, id) && !rivalContest(a, id));
  if (!b) { fail("everyone shares one house"); return out; }
  const pa = W.components.position[a], pb = W.components.position[b];
  pb.x = pa.x; pb.y = pa.y; rebuildSpatialBins();
  out.house = [bonds.house(a), bonds.house(b)];
  if (out.house.some((h) => !h || /undefined/.test(h))) fail("house names are missing");
  // Friendship from trust and affection.
  out.friend = bonds.befriend(a, b);
  if (out.friend !== "friend") fail("high trust and affection did not become a friendship (" + out.friend + ")");
  const friendship = W.events.filter((e) => e.type === "FriendshipEvent").at(-1);
  if (!friendship) fail("no FriendshipEvent"); else out.friendSentence = eventSentence(friendship);
  if (!(bonds.bonds(a)?.friends || []).includes(b)) fail("friend list does not hold the friend");
  if (!relationsOf(a, "friend_of").some((e) => e.to === b)) fail("no friend_of relation edge");
  // Rivalry from grievance and jealousy; the friendship ends first.
  out.rival = bonds.antagonize(a, b);
  if (out.rival !== "rival") fail("grievance did not become a rivalry (" + out.rival + ")");
  if (!W.events.some((e) => e.type === "EstrangementEvent")) fail("no EstrangementEvent when the friendship soured");
  const rivalry = W.events.filter((e) => e.type === "RivalryEvent").at(-1);
  if (!rivalry) fail("no RivalryEvent"); else out.rivalSentence = eventSentence(rivalry);
  if (relationsOf(a, "friend_of").some((e) => e.to === b)) fail("friend_of edge survived the rivalry");
  // A quarrel leaves a grievance on both.
  const matterBefore = totalMatter();
  const q = bonds.quarrel(a, b);
  if (!q) fail("quarrel refused"); else out.quarrelSentence = eventSentence(q);
  if (totalMatter() !== matterBefore) fail("a quarrel changed total matter");
  // A killing between houses starts a feud with a page, a card, and polity grievance.
  const c = people.find((id) => id !== a && id !== b && houseOf(id) === houseOf(a)) || a;
  const feud = bonds.feud(b, c, q?.id || 0);
  if (!feud) { fail("a killing between houses started no feud"); return out; }
  out.feud = { names: feud.names, heat: feud.heat, deaths: feud.deaths };
  const feudEvent = W.events.filter((e) => e.type === "FeudEvent").at(-1);
  if (!feudEvent) fail("no FeudEvent"); else out.feudSentence = eventSentence(feudEvent);
  if (feudEvent && feudEvent.importance < 4) fail("a feud beginning is not alert-worthy");
  out.card = bonds.card(a);
  if (!/Bonds/.test(out.card) || !/Feud/.test(out.card)) fail("the bonds card does not show the feud");
  out.page = bonds.page(feud.id).length;
  if (!/House of/.test(bonds.page(feud.id))) fail("the feud page has no houses");
  const index = window.ALIFE_LEGENDS_DEBUG.render("index", 0);
  if (!/Feuds/.test(index)) fail("the Legends index lists no feuds");
  if (!/House/.test(window.ALIFE_LEGENDS_DEBUG.render("life", a))) fail("the life page has no house row");
  // Feud members meet as rivals; a marriage between the houses ends the feud.
  bonds.updateFeuds();
  const d = people.find((id) => id !== c && id !== a && houseOf(id) === houseOf(a) && !W.components.social[id].partnerId) || a;
  const e = people.find((id) => id !== b && houseOf(id) === houseOf(b) && !W.components.social[id].partnerId) || b;
  for (const id of [d, e]) W.components.social[id].partnerId = 0;
  const ended = bonds.marriage(d, e);
  if (!ended) fail("a marriage between the houses did not end the feud");
  else out.endedSentence = eventSentence(ended);
  if (!W.feuds.find((f) => f.id === feud.id)?.ended) fail("the feud is still active after the marriage");
  // Rendering with bonds on screen is stable and writes nothing.
  const hashBefore = worldHash();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 9, now: 5000 });
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "standard", zoom: 3, now: 5100 });
  if (worldHash() !== hashBefore) fail("rendering bonds changed the world hash");
  out.summary = bonds.update();
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_BONDS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_BONDS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
