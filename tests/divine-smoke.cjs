// Divine acts smoke: the five instruments that act on people and polities —
// marking a chosen one, whispering knowledge, a sign in the sky, a truce, and
// discord — each recorded as an intervention, read as an omen, chronicled, and
// drawn without touching the world.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const divine = window.ALIFE_DIVINE_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const faction = settlement.factionId ? W.factions.find((f) => f.id === settlement.factionId) : createFaction(settlement.id);
  if (!faction) { fail("no faction"); return out; }
  const culture = W.cultures.find((c) => c.id === faction.cultureId);
  const home = idx(settlement.x, settlement.y);
  const people = entityAtRadius(home, 8, KINDS.PERSON).filter((id) => classifyAlive(id));
  if (people.length < 3) { fail("too few people at the settlement"); return out; }
  for (const id of people) W.components.life[id].age = Math.max(W.components.life[id].age, 4000);
  const matterBefore = totalMatter();
  if (!TOOL_DEFS.some((t) => t[0] === "anoint") || TOOL_DEFS.filter((t) => divine.tools.includes(t[0])).length !== 5) fail("the five divine tools are not all in TOOL_DEFS");
  // Mark a chosen one.
  const chosen = people[0], cp = W.components.position[chosen];
  UI.brush = 1;
  const chosenEvent = divine.act("anoint", idx(cp.x, cp.y));
  if (!chosenEvent || chosenEvent.type !== "ChosenEvent") fail("anointing produced no ChosenEvent");
  else out.chosenSentence = eventSentence(chosenEvent);
  const ident = W.components.identity[chosen];
  if (!ident.chosen || !ident.titles.some((t) => /^Chosen of/.test(t)) || !ident.notable) fail("the chosen one carries no mark");
  if (UI.selectedEntity !== chosen) fail("anointing did not select the chosen one");
  if (!W.interventions.some((i) => i.tool === "anoint")) fail("anointing was not recorded as an intervention");
  // Whisper knowledge: the next learnable process arrives; the ledger records it.
  const before = settlement.knownProcesses.length, next = divine.whisperable(settlement.id);
  const whisper = divine.act("whisper", home);
  if (!whisper || whisper.type !== "WhisperEvent") fail("whisper produced no WhisperEvent");
  else out.whisperSentence = eventSentence(whisper);
  if (settlement.knownProcesses.length !== before + 1 || settlement.knownProcesses.at(-1) !== next) fail("the whispered process was not learned");
  if (!W.technologies.some((t) => t.divine && t.definitionId === next)) fail("the technology ledger has no divine entry");
  if (!W.events.some((e) => e.type === "TechAdvanceEvent" && e.data?.settlement === settlement.name)) fail("no TechAdvanceEvent accompanied the whisper");
  // A sign in the sky is seen by the town and read as awe.
  const aweBefore = culture?.belief?.awe || 0;
  const sign = divine.act("sign", idx(clamp(settlement.x + 3, 0, W.width - 1), settlement.y));
  if (!sign || sign.type !== "SkySignEvent" || sign.importance < 4) fail("the sign was not seen");
  else out.signSentence = eventSentence(sign);
  if (culture && !(culture.belief.awe > aweBefore)) fail("the sign left no awe");
  if (!divine.visuals().some((v) => v.kind === "sign")) fail("no sky sign visual was queued");
  // Truce and discord need a second polity; with one, both refuse cleanly.
  let other = W.factions.find((f) => f.id !== faction.id);
  for (let attempt = 0; attempt < 10 && !other; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    const second = W.settlements.find((s) => !s.ruined && s.id !== settlement.id && !s.factionId);
    if (second) createFaction(second.id);
    other = W.factions.find((f) => f.id !== faction.id && f.stability > 0);
  }
  if (other) {
    // The polities have met, so each is within the other's reach.
    for (const [x, y] of [[faction, other], [other, faction]]) {
      const rel = x.relations[y.id] || (x.relations[y.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 });
      rel.pressure = Math.max(rel.pressure, 1);
    }
    const refusedBefore = W.interventions.length;
    const discord = divine.act("discord", home);
    const partnerId = discord ? discord.factions.find((f) => f !== faction.id) : other.id;
    out.discord = { partner: partnerId, contact: factionsHaveContact(faction, other), nearest: nearestFaction(home)?.id, self: faction.id };
    if (!discord || discord.type !== "DiscordEvent") fail("discord produced no DiscordEvent");
    else out.discordSentence = eventSentence(discord);
    const rel = faction.relations[partnerId];
    if (!rel || rel.grievance < 30 || rel.status !== "hostile") fail("discord left the polities at peace");
    const truce = divine.act("truce", home);
    if (!truce || truce.type !== "DivineTruceEvent") fail("truce produced no DivineTruceEvent");
    else out.truceSentence = eventSentence(truce);
    const after = faction.relations[partnerId];
    if (!after || after.status !== "truce" || !(after.truceUntil > W.tick)) fail("the truce did not bind");
  } else {
    out.singlePolity = true;
    const recorded = W.interventions.length;
    if (divine.act("truce", home)) fail("a truce was bound with no other polity");
    if (divine.act("discord", home)) fail("discord was sown with no other polity");
    if (W.interventions.length !== recorded) fail("a refused act was recorded as an intervention");
  }
  if (totalMatter() !== matterBefore) fail("divine acts changed total matter");
  // The omen path reads the acts through the ordinary intervention record.
  for (let i = 0; i < 140; i++) simTick();
  const omens = W.events.filter((e) => e.type === "OmenEvent" && divine.tools.includes(e.data?.tool));
  out.omens = omens.map((e) => e.data.tool + ":" + e.data.reading);
  if (!omens.length) fail("no omen was read from the divine acts");
  // Rendering with a chosen one, a whisper, and a sign on screen is stable.
  const hashBefore = worldHash();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 6, now: 5000 });
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "standard", zoom: 2, now: 5200 });
  if (worldHash() !== hashBefore) fail("rendering divine visuals changed the world hash");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_DIVINE_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_DIVINE_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
