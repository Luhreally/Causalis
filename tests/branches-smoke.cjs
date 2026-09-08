// Branches smoke: the wide tree is whole (every prior, facility, and material
// real, no cycles), each branch's crafts move the factors they claim to move
// (research, construction, hygiene, harvest, lifespan, fertility, unrest,
// settler urge, defence, taxes, opinion, resilience), a branch craft is learned
// by ordinary research and chronicled, the focus chooser prefers by branch, a
// rare craft opens only once the thing is seen, frontier crafts chain, the
// Technology page lays out the branches, and mastery is a milestone.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const br = window.ALIFE_BRANCHES_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  // The tree is whole.
  const catalog = techCatalog(), ids = new Set(catalog.map((t) => t.id)), defs = br.defs();
  out.catalog = catalog.length; out.branchTechs = defs.length;
  if (!(catalog.length >= 95)) fail("the catalog is thin: " + catalog.length);
  if (ids.size !== catalog.length) fail("duplicate technology ids");
  for (const d of defs) {
    for (const p of d.prior) if (!ids.has(p)) fail(d.id + " has an unknown prior " + p);
    if (!BUILDING_DEFS[d.facility]) fail(d.id + " needs an unknown facility " + d.facility);
    for (const m of d.materials) if (!(m >= 0 && m < SPECIES_COUNT)) fail(d.id + " needs an unknown material " + m);
    if (!["matter", "life", "mind"].includes(d.branch)) fail(d.id + " has no branch");
    if (!(d.threshold > 0)) fail(d.id + " has no threshold");
  }
  const depth = (id, seen) => { if (seen.has(id)) return Infinity; const t = technologyDefinition(id); if (!t) return 0; const next = new Set(seen); next.add(id); return 1 + Math.max(0, ...(t.prior || []).map((p) => depth(p, next))); };
  for (const d of defs) if (!(depth(d.id, new Set()) < 40)) fail(d.id + " has a cyclic prior chain");
  if (!technologyDefinition("frontier_matter_2")?.prior.includes("frontier_matter_1")) fail("frontier crafts do not chain");
  if (!["matter", "life", "mind"].every((b) => defs.filter((d) => d.branch === b).length >= 18)) fail("a branch is thin");
  // A settlement with a faction, a person at home, and a hearth.
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  if (!s.factionId) createFaction(s.id);
  const f = W.factions.find((x) => x.id === s.factionId);
  const complete = (place, type) => {
    const b = planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === place.id && x.type === type);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  complete(s, "hearth");
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.body[id]);
  if (people.length < 2) { fail("too few people"); return out; }
  const [person, other] = people;
  for (const id of [person, other]) { const soc = W.components.social[id]; soc.homePlaceKind = "settlement"; soc.homePlaceId = s.id; }
  const grant = (...techs) => { for (const t of techs) if (!s.knownProcesses.includes(t)) s.knownProcesses.push(t); br.reset(); };
  const revoke = (...techs) => { s.knownProcesses = s.knownProcesses.filter((t) => !techs.includes(t)); br.reset(); };
  // Each branch moves what it claims to move.
  out.research0 = researchTempoFactor(s); grant("oral_tradition", "philosophy", "universities"); out.research1 = researchTempoFactor(s);
  if (!(out.research1 > out.research0)) fail("letters do not quicken inquiry: " + out.research0 + " -> " + out.research1);
  out.build0 = constructionTempoFactor(s); grant("stone_dressing", "pulleys"); out.build1 = constructionTempoFactor(s);
  if (!(out.build1 > out.build0)) fail("stone and cranes do not quicken the work face");
  out.hyg0 = hygieneFactor(person); grant("herbalism", "quarantine"); out.hyg1 = hygieneFactor(person);
  if (!(out.hyg1 < out.hyg0)) fail("herbs and quarantine do not thin the pathogens: " + out.hyg0 + " -> " + out.hyg1);
  out.harvest0 = harvestCapFactor(s); grant("crop_rotation"); out.harvest1 = harvestCapFactor(s);
  if (!(out.harvest1 > out.harvest0)) fail("rotation does not fill the granary");
  out.fert0 = fertilityFactor(person, other); out.life0 = naturalLifespan(person, W.components.body[person]);
  grant("midwifery", "anatomy"); out.fert1 = fertilityFactor(person, other); out.life1 = naturalLifespan(person, W.components.body[person]);
  if (!(out.life1 > out.life0)) fail("midwifery and anatomy do not lengthen lives");
  if (!(out.fert1 >= out.fert0)) fail("midwifery does not ease births");
  out.unrest0 = unrestOf(s); grant("theatre", "jurisprudence"); out.unrest1 = unrestOf(s);
  if (!(out.unrest1 <= out.unrest0) || !(br.effects(s.id).unrest >= 0.07)) fail("theatre and law do not calm the town: " + out.unrest0 + " -> " + out.unrest1);
  out.urge0 = settlerUrge(s); grant("cartography"); out.urge1 = settlerUrge(s);
  if (!(out.urge1 > out.urge0)) fail("maps do not send settlers out");
  out.defense0 = settlementDefense(s); grant("bronze_casting", "iron_smelting"); out.defense1 = settlementDefense(s);
  if (!(br.effects(s.id).defense > 1) || (out.defense0 > 0 && out.defense0 < 100 && !(out.defense1 > out.defense0))) fail("iron does not harden the walls");
  if (!(br.faction(f.id, "military") > 1)) fail("the polity's soldiers carry no bronze or iron");
  // Resilience: the same blow does less to an engineered town.
  const target = completedBuildings(s)[0];
  if (target) {
    const keep = target.integrity;
    grant("arch_vault", "concrete");
    out.dmgEngineered = damageBuiltPlace(s, 120, "test blow");
    target.integrity = keep;
    revoke("arch_vault", "concrete");
    out.dmgPlain = damageBuiltPlace(s, 120, "test blow");
    target.integrity = keep;
    recomputePlaceCapacity(s);
    if (!(out.dmgEngineered < out.dmgPlain)) fail("arch and concrete do not soften the blow: " + out.dmgEngineered + " vs " + out.dmgPlain);
  }
  // Taxes: the census and measures pay coin once the polity coins.
  grant("currency", "weights_measures", "census");
  ensureMarkets(W);
  f.treasury = 0;
  out.coin = collectTaxes(f);
  out.coins = polityCoins(f);
  if (out.coins && !(f.treasury >= 3)) fail("the census and measures pay no coin: " + f.treasury);
  // Opinion: envoys warm another polity, if there is one.
  const otherFaction = W.factions.find((x) => x !== f && x.stability > 0);
  if (otherFaction) {
    grant("diplomatic_corps");
    const op = opinionTarget(f, otherFaction);
    out.opinionReasons = op.reasons.map((r) => r.label);
    if (!op.reasons.some((r) => /envoys/.test(r.label))) fail("envoys do not warm opinion");
  }
  // A branch craft is learned by ordinary research and chronicled.
  revoke("oral_tradition");
  s.inventory[C.FIBER] = Math.max(s.inventory[C.FIBER], 40);
  s.inventory[C.ORGANIC] = Math.max(s.inventory[C.ORGANIC], 40);
  s.stability = Math.max(s.stability, 0.6);
  s.researchProgress = s.researchProgress || {};
  s.researchProgress.oral_tradition = 500;
  s.researchFocus = "oral_tradition";
  updateTechnology();
  out.learned = s.knownProcesses.includes("oral_tradition");
  if (!out.learned) fail("a branch craft was not learned by research");
  const advance = W.events.filter((e) => e.type === "TechAdvanceEvent").at(-1);
  out.advance = advance ? eventSentence(advance) : "";
  if (!advance || advance.data.name !== "Oral Tradition") fail("the discovery was not chronicled: " + out.advance);
  // The focus chooser prefers by branch, and the preference is whole.
  out.preference = br.preference(f.id, s.id);
  if (!(out.preference.matter > 0 && out.preference.life > 0 && out.preference.mind > 0)) fail("the branch preference is not whole");
  const fedFood = settlementFood(s), keepOrganic = s.inventory[C.ORGANIC];
  s.inventory[C.ORGANIC] = 0;
  out.hungryLife = br.preference(f.id, s.id).life;
  s.inventory[C.ORGANIC] = keepOrganic;
  if (settlementFood(s) < 4 && !(out.hungryLife > out.preference.life)) fail("a hungry town does not turn to field and herd: " + out.preference.life + " -> " + out.hungryLife + " (food " + fedFood + ")");
  s.researchFocus = "";
  updateTechnology();
  out.focus = s.researchFocus;
  if (typeof out.focus !== "string") fail("no research focus was chosen");
  // A rare craft opens only once the thing is seen.
  out.gateBefore = br.gateOpen(s.id, "seismic_joinery");
  emitEvent("EarthquakeEvent", { location: idx(s.x, s.y), evidence: ["the ground shook for the test"], importance: 3, data: { magnitude: 1 } });
  out.gateAfter = br.gateOpen(s.id, "seismic_joinery");
  if (!out.gateAfter) fail("an observed earthquake does not open seismic joinery");
  // The page lays out the branches; mastery is a milestone.
  const page = renderLegendPage("technology");
  if (!/Matter/.test(page) || !/Life/.test(page) || !/Mind/.test(page) || !/three branches/.test(page)) fail("the technology page shows no branches");
  for (const d of defs) if (d.branch === "matter" && d.tier <= 3 && !d.rare) grant(d.id);
  out.matterTier = br.tier(s.id, "matter");
  br.mastery();
  if (!(out.matterTier >= 3) || !(W.milestones || []).some((m) => m.key === "branch-matter-3")) fail("mastering the Matter branch is no milestone: tier " + out.matterTier);
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_BRANCHES_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_BRANCHES_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
