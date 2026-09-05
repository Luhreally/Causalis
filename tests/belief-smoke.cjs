// Belief smoke: naming the god, tenets, myths and their drift, rites with
// conserved offerings, prophets, prophecy, and schism.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const belief = window.ALIFE_BELIEF_DEBUG, living = window.ALIFE_LIVING_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const faction = settlement.factionId ? W.factions.find((f) => f.id === settlement.factionId) : createFaction(settlement.id);
  if (!faction) { fail("no faction"); return out; }
  faction.ethos.spiritual = 0.85;
  const culture = W.cultures.find((c) => c.id === faction.cultureId);
  // Three kind acts beside the town: rain, rain, and a blessing.
  UI.brush = 1;
  for (const tool of ["rain", "rain", "bless"]) {
    UI.tool = tool;
    applyTool(idx(clamp(settlement.x + 2, 0, W.width - 1), clamp(settlement.y + 1, 0, W.height - 1)));
    living.omens();
    belief.update();
  }
  UI.tool = "inspect";
  const b = culture.belief;
  out.attention = b.attention; out.favour = b.favour; out.named = b.named; out.god = b.named ? b.name + ", " + b.gloss : "";
  if (b.attention < 3) fail("three witnessed acts did not register as attention");
  if (!b.named) fail("the culture did not name its god after three acts");
  if (b.named && !/Rain|Bountiful/.test(b.gloss)) fail("the epithet does not follow the acts seen: " + b.gloss);
  if (b.favour <= 0) fail("kind acts did not raise favour");
  if (!b.tenets.length) fail("no tenets were derived");
  out.tenets = b.tenets;
  const naming = W.events.filter((e) => e.type === "NamingEvent").at(-1);
  if (!naming) fail("no NamingEvent was chronicled"); else out.namingSentence = eventSentence(naming);
  const omen = W.events.filter((e) => e.type === "OmenEvent").at(-1);
  if (omen) { out.omenSentence = eventSentence(omen); if (b.named && !out.omenSentence.includes(b.name)) fail("omen sentence does not cite the god by name"); }
  if (!b.myths.length) fail("kind acts left no myths");
  else {
    out.myth = { told: b.myths[0].told, truth: b.myths[0].truth };
    const before = b.myths[0].told;
    const retold = belief.retell(culture.id);
    if (!retold.some((m) => m.retellings > 0)) fail("retelling changed no myth");
    if (b.myths[0].told === before && b.myths.every((m) => !m.retellings)) fail("myth text did not drift");
    out.retold = retold[0];
  }
  // Rites: forced in the open, offerings move matter between store and ground.
  const matterBefore = totalMatter(), storeBefore = settlement.inventory[C.ORGANIC];
  const rites = belief.rites(true);
  out.rites = rites;
  if (!rites) fail("no rite was held");
  if (totalMatter() !== matterBefore) fail("rite offerings changed total matter");
  out.offeringMoved = storeBefore - settlement.inventory[C.ORGANIC];
  const rite = W.events.filter((e) => e.type === "RiteEvent").at(-1);
  if (rite) out.riteSentence = eventSentence(rite);
  // A Speaker rises and prophesies.
  const prophet = belief.prophet(culture.id);
  out.prophet = prophet ? entityName(prophet) : null;
  if (!prophet) fail("no prophet was raised");
  else if (!W.components.identity[prophet].titles.some((t) => t.startsWith("Speaker of"))) fail("the prophet has no Speaker title");
  const prophecy = W.events.filter((e) => e.type === "ProphecyEvent").at(-1);
  if (!prophecy) fail("no ProphecyEvent was chronicled"); else out.prophecySentence = eventSentence(prophecy);
  // Schism: the town breaks away as a new culture with its own dialect and the opposite reading.
  const culturesBefore = W.cultures.length, tongueBefore = culture.language.name;
  const childId = belief.schism(culture.id, settlement.id);
  const child = W.cultures.find((c) => c.id === childId);
  out.child = child ? { name: child.name, tongue: child.language?.name, favour: child.belief?.favour, parent: child.parentCultureId } : null;
  if (!child || W.cultures.length !== culturesBefore + 1) fail("schism created no culture");
  else {
    if (!child.language || child.language.parentId !== culture.language.id) fail("the breakaway does not speak a dialect of the parent tongue");
    if (Math.sign(child.belief.favour) !== -Math.sign(b.favour)) fail("the breakaway did not invert the reading");
    if (settlement.cultureId !== child.id) fail("the dissenting town kept the old culture");
    if (!child.belief.named || child.belief.name !== b.name) fail("the breakaway forgot the god's name");
  }
  const schism = W.events.filter((e) => e.type === "SchismEvent").at(-1);
  if (!schism) fail("no SchismEvent was chronicled"); else out.schismSentence = eventSentence(schism);
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_BELIEF_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_BELIEF_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
