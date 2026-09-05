// Languages smoke: per-world tongues, per-culture dialects, kin family names,
// legacy names on the canonical seed, determinism, and old-save recovery.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const out = { failures: [] }, fail = (m) => out.failures.push(m);
  ensureLanguages();
  const proto = W.protoLanguage;
  out.proto = { name: proto.name, legacy: proto.legacy, consonants: proto.consonants.length, vowels: proto.vowels.length };
  const person = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  if (!person) { fail("no living person"); return out; }
  const p = W.components.position[person];
  const childA = createOrganism(KINDS.PERSON, p.x, p.y, makeRng(hashParts(W.seedHash, "child-a"), "birth"), [person]);
  const childB = createOrganism(KINDS.PERSON, p.x, p.y, makeRng(hashParts(W.seedHash, "child-b"), "birth"), [person]);
  const nameA = W.components.identity[childA].generatedName, nameB = W.components.identity[childB].generatedName;
  out.children = [nameA, nameB];
  if (nameA.split(" ").length !== 2 || nameB.split(" ").length !== 2) fail("person names are not given plus family");
  if (nameA.split(" ")[1] !== nameB.split(" ")[1]) fail("siblings do not share a family name");
  if (nameA === nameB) fail("siblings received identical full names");
  const parentCulture = W.components.social[person].cultureId;
  if (parentCulture && W.components.social[childA].cultureId !== parentCulture) fail("child did not inherit the parent's culture");
  // A camp needs its first shelter, stockpile, and hearth before it can become a town.
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  out.settlementName = settlement.name;
  const faction = settlement.factionId ? W.factions.find((f) => f.id === settlement.factionId) : createFaction(settlement.id);
  if (!faction) { fail("no faction"); return out; }
  const culture = W.cultures.find((c) => c.id === faction.cultureId);
  out.faction = faction.name; out.culture = culture?.name; out.tongue = culture?.language?.name;
  if (!culture?.language) fail("culture has no stored language");
  if (!proto.legacy && culture?.language && culture.language.legacy) fail("alien culture speaks the legacy tongue");
  if (!proto.legacy && culture?.language && !culture.language.parentId) fail("culture tongue is not a dialect of the first tongue");
  if (!proto.legacy && culture && !culture.language.lexicon.polity.some((w) => faction.name.toLowerCase().endsWith(w.toLowerCase()))) fail("polity name does not end in a polity word of its tongue");
  const camp = createCamp(idx(clamp(settlement.x + 12, 1, W.width - 2), clamp(settlement.y + 9, 1, W.height - 2)), person);
  out.campName = camp?.name || null;
  for (const [label, value] of Object.entries({ settlement: settlement.name, faction: faction.name, culture: culture?.name, camp: camp?.name, nameA }))
    if (typeof value === "string" && /undefined|NaN/.test(value)) fail(label + " name contains undefined");
  const speciesKey = Object.keys(W.speciesRegistry)[0];
  if (speciesKey) {
    const s = W.speciesRegistry[speciesKey];
    out.species = s.name;
    if (!proto.legacy) {
      const concept = s.kind === KINDS.PREDATOR ? "hunter" : s.kind === KINDS.HERBIVORE ? "grazer" : "folk";
      if (!proto.lexicon[concept].some((w) => s.name.toLowerCase().endsWith(w.toLowerCase()))) fail("species name does not use the first tongue's class word");
    }
  }
  // Old saves: forget the tongues and let restoration rebuild the same ones.
  const savedProto = JSON.stringify(W.protoLanguage), savedCulture = JSON.stringify(culture.language);
  delete W.protoLanguage; delete culture.language;
  restoreWorldDefaults();
  if (JSON.stringify(W.protoLanguage) !== savedProto) fail("restored first tongue differs from the original");
  if (JSON.stringify(culture.language) !== savedCulture) fail("restored dialect differs from the original");
  out.digest = JSON.stringify([proto.name, nameA, nameB, settlement.name, faction.name, culture.name, camp?.name, out.species]);
  return out;
})()`;

const assertions = String.raw`
const failures = [];
const run = (seed) => { game.createTestWorld({ seed, size: "small" }); controls.createCivicTestScenario(); return sandbox.window.ALIFE_LANGUAGE_TEST.run(); };
const alien = run("x3"), alienAgain = run("x3"), other = run("hollow-crown"), earth = run("causal-origin");
for (const [label, r] of [["x3", alien], ["hollow-crown", other], ["causal-origin", earth]]) for (const f of r.failures) failures.push(label + ": " + f);
if (alien.proto.legacy) failures.push("alien seed x3 uses the legacy tongue");
if (!earth.proto.legacy) failures.push("canonical seed lost its founding word lists");
if (alien.proto.name === other.proto.name) failures.push("two alien seeds share a first tongue name");
if (alien.digest !== alienAgain.digest) failures.push("names were not deterministic across identical runs");
const legacyPattern = /^[A-Z][a-z]+ [A-Z][a-z]+$/;
if (!legacyPattern.test(earth.children[0])) failures.push("canonical seed person name is not a legacy given-plus-family name");
console.log(JSON.stringify({ ok: !failures.length, failures, alien: { proto: alien.proto, children: alien.children, settlement: alien.settlementName, faction: alien.faction, culture: alien.culture, tongue: alien.tongue, camp: alien.campName, species: alien.species }, other: { proto: other.proto, faction: other.faction, species: other.species }, earth: { children: earth.children, faction: earth.faction, species: earth.species } }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_LANGUAGE_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
