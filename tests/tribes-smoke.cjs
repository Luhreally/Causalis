// Tribes smoke: a place that knows neither masonry nor letters nor governance
// wears the tribal age on an Earth-like family: tents (roundhouses once it
// farms), a fire pit, a storage pit with a drying rack once it dries, a work
// ground, and a palisade, all drawn without touching the world; masonry ends
// the age; a village of six with a fire plans a Spirit post that is drawn,
// calms the town, and is the first of its kind in the annals; and a camp wears
// the same age.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const tribes = window.ALIFE_TRIBES_DEBUG, town = window.ALIFE_TOWNSCAPE_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  if (!s.factionId) createFaction(s.id);
  const complete = (place, type) => {
    const b = planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === (place.knownProcesses ? "settlement" : "camp") && x.placeId === place.id && x.type === type);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  const clean = (opts) => { const h0 = worldHash(); window.ALIFE_VISUAL_DEBUG.renderOnly(opts); if (worldHash() !== h0) fail("drawing the tribes changed the world (" + opts.view + ")"); };
  // The tribal age: no masonry, letters, or governance; an Earth-like family.
  s.knownProcesses = s.knownProcesses.filter((t) => !["masonry", "writing", "governance", "agriculture", "drying"].includes(t));
  if (!s.knownProcesses.includes("controlled_fire")) s.knownProcesses.push("controlled_fire");
  town.setFamily(s.id, "earthen");
  out.era = tribes.era(s.id);
  if (!out.era) fail("a fireside village is not in the tribal age");
  for (const type of ["shelter", "hearth", "stockpile", "workshop"]) complete(s, type);
  const wall = complete(s, "wall");
  tribes.reset();
  clean({ view: "iso", quality: "high", zoom: 3, x: s.x, y: s.y, now: 5000 });
  out.nomad = tribes.counts();
  if (!(out.nomad.tents >= 1) || !(out.nomad.firepits >= 1) || !(out.nomad.pits >= 1) || !(out.nomad.workgrounds >= 1)) fail("the tribal camp is not drawn as tents, fire pit, storage pit, and work ground: " + JSON.stringify(out.nomad));
  if (wall && !(out.nomad.palisades >= 1)) fail("the wall is not a palisade");
  if (out.nomad.racks !== 0) fail("a drying rack stands before drying is known");
  // Farming brings roundhouses; drying brings the rack; the camp keeps a midden.
  s.knownProcesses.push("agriculture", "drying");
  tribes.reset();
  clean({ view: "iso", quality: "high", zoom: 3, x: s.x, y: s.y, now: 5100 });
  out.farming = tribes.counts();
  if (!(out.farming.roundhouses >= 1) || out.farming.tents !== 0) fail("farming did not turn tents into roundhouses: " + JSON.stringify(out.farming));
  if (!(out.farming.racks >= 1)) fail("drying brought no rack");
  if (!(out.farming.props >= 1)) fail("no midden by the fire");
  // Masonry ends the age.
  s.knownProcesses.push("masonry");
  tribes.reset();
  clean({ view: "iso", quality: "high", zoom: 3, x: s.x, y: s.y, now: 5200 });
  out.civic = tribes.counts();
  if (tribes.era(s.id) || out.civic.tents + out.civic.roundhouses + out.civic.firepits + out.civic.pits > 0) fail("masonry did not end the tribal age: " + JSON.stringify(out.civic));
  s.knownProcesses = s.knownProcesses.filter((t) => t !== "masonry");
  // A village of six with a fire plans a Spirit post; it is drawn, calms the town, and is the first of its kind.
  const living = () => W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.position[id]);
  for (let n = 0; living().length < 12 && n < 20; n++) createOrganism(KINDS.PERSON, s.x, s.y, makeRng(hashParts(W.seedHash, "tribes-fixture", n), "birth"), []);
  for (const id of living()) { const soc = W.components.social[id], p = W.components.position[id]; soc.homePlaceKind = "settlement"; soc.homePlaceId = s.id; soc.factionId = s.factionId; p.x = s.x; p.y = s.y; }
  rebuildSpatialBins();
  const existing = W.buildings.find((b) => !b.ruined && b.type === "totem" && b.placeKind === "settlement" && b.placeId === s.id);
  out.wantsTotem = tribes.wantsTotem(s.id);
  out.alreadyRaised = !!existing;
  if (!out.wantsTotem && !existing) fail("a fireside village of " + settlementPopulation(s) + " wants no spirit post");
  for (const b of W.buildings) if (!b.ruined && !b.complete && b.placeKind === "settlement" && b.placeId === s.id) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; }
  ensurePlacePlans(s);
  const totem = W.buildings.find((b) => !b.ruined && b.type === "totem" && b.placeKind === "settlement" && b.placeId === s.id);
  if (!totem) { fail("no spirit post was planned"); return out; }
  totem.complete = true; totem.stage = 6; totem.integrity = totem.maxIntegrity; totem.completedTick = W.tick; for (const [sp, n] of totem.requirements || []) totem.composition[sp] = n;
  // Its calm: the town is more restless with the post felled than with it standing.
  totem.ruined = true;
  const unrestWithout = unrestOf(s);
  totem.ruined = false;
  out.unrest = [unrestWithout, unrestOf(s)];
  if (!(unrestOf(s) <= unrestWithout) || (unrestWithout > 0 && !(unrestOf(s) < unrestWithout))) fail("the spirit post does not calm the town: " + out.unrest.join(" -> "));
  tribes.reset();
  clean({ view: "iso", quality: "high", zoom: 3, x: totem.x, y: totem.y, now: 5300 });
  clean({ view: "top", quality: "standard", zoom: 3, x: totem.x, y: totem.y, now: 5400 });
  out.totems = tribes.counts().totems;
  if (!(out.totems >= 2)) fail("the spirit post is not drawn in both lenses: " + out.totems);
  ensurePlacePlans(s);
  if (!(W.milestones || []).some((m) => m.key === "first-totem")) fail("the first spirit post is no milestone");
  // A camp wears the tribal age too.
  const camp = W.camps.find((c) => c.active);
  out.campEra = camp ? tribes.era(camp.id, true) : "no camp";
  if (camp && !out.campEra) fail("a camp is not in the tribal age");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_TRIBES_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_TRIBES_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
