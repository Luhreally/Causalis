// Many-hands smoke: while the skip's objective is a study, the cities that
// already know the crafts raise the towers, blocks and works the modern world
// wants; a rare input reaches a work face from the third push and not before;
// nothing rises before the modern stages are sought; the people floor grows
// with the crafts of water and machines; every gift is booked; and drawing
// the city never writes the world.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const hands = window.ALIFE_MANY_HANDS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  if (!s.factionId) createFaction(s.id);
  const finish = (b) => { if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) { W.conservation.playerInput += Math.max(0, n - (b.composition[sp] || 0)); b.composition[sp] = n; } } return b; };
  const complete = (place, type) => finish(planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === place.id && x.type === type && !x.complete));
  const grant = (place, ...techs) => { for (const t of techs) if (!place.knownProcesses.includes(t)) place.knownProcesses.push(t); };
  const towers = () => W.buildings.filter((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === s.id && b.type === "tower").length;
  const audit = auditMatter().delta;
  // ── The people floor follows the fields ──
  const farms = () => W.buildings.filter((b) => b.type === "farm" && b.complete && !b.ruined && b.placeKind === "settlement" && W.settlements.some((t) => t.id === b.placeId && !t.ruined)).length;
  out.floorBare = [hands.floor(), farms()];
  if (out.floorBare[0] !== 40 + 2 * out.floorBare[1]) fail("the floor is not forty and two a farm: " + out.floorBare.join(" with farms "));
  grant(s, "agriculture", "irrigation");
  if (hands.floor() !== out.floorBare[0]) fail("a craft alone lifted the floor: " + hands.floor());
  if (!complete(s, "farm")) fail("could not raise a farm");
  out.floorFarmed = [hands.floor(), farms()];
  if (out.floorFarmed[0] !== 40 + 2 * out.floorFarmed[1] || out.floorFarmed[1] !== out.floorBare[1] + 1) fail("a finished farm did not lift the floor by two: " + out.floorBare.join("/") + " -> " + out.floorFarmed.join("/"));
  if (!(hands.capacity() >= out.floorFarmed[0])) fail("the capacity sits under the floor: " + hands.capacity() + " < " + out.floorFarmed[0]);
  // ── Nothing rises before the modern stages are sought ──
  grant(s, "masonry", "mechanization", "electricity");
  for (const type of ["hall", "clinic", "shelter", "shelter", "workshop", "kiln", "stockpile", "hearth"]) complete(s, type);
  s.stage = "urban"; s.stability = Math.max(s.stability || 0, 0.6);
  out.soughtEarly = hands.sought();
  if (out.soughtEarly) fail("the modern stages are sought before the terrestrial ages are done");
  hands.reset();
  out.asideEarly = hands.aside("stewardship", 1);
  if (out.asideEarly !== 0 || towers() !== 0) fail("a tower rose before the modern stages were sought: " + out.asideEarly + ", " + towers());
  // ── Past the terrestrial ages, the city raises its skyline beside the study ──
  const saved = W.civilization.stageIndex;
  W.civilization.stageIndex = CIV_STAGE_ORDER.length - 1; W.civilization.stage = CIV_STAGE_ORDER.at(-1);
  out.soughtLate = hands.sought();
  if (!out.soughtLate) fail("the modern stages are not sought at the last terrestrial age");
  out.asideStudy = hands.aside("stewardship", 1);
  out.towersAside = towers();
  if (!(out.asideStudy > 0 && out.towersAside > 0)) fail("a study objective raised no tower beside it: " + out.asideStudy + ", " + out.towersAside);
  // The objective's own stage is left to the objective: aside on "skyline" plans no more towers.
  out.asideOwn = hands.aside("skyline", 1);
  if (towers() !== out.towersAside) fail("the aside worked the objective's own stage: " + towers() + " vs " + out.towersAside);
  // From the third push the blocks get their material.
  const tower = W.buildings.find((b) => !b.ruined && !b.complete && b.placeKind === "settlement" && b.placeId === s.id && b.type === "tower");
  if (!tower) fail("no unfinished tower to supply");
  else {
    const before = missingBuildingMaterial(tower);
    hands.aside("stewardship", 3);
    const after = missingBuildingMaterial(tower);
    out.towerFed = before && (!after || after.sp !== before.sp || after.needed < before.needed);
    if (!out.towerFed) fail("the third push fed the tower nothing: " + JSON.stringify(before) + " -> " + JSON.stringify(after));
  }
  out.counts = hands.counts();
  if (!(out.counts.aside >= 2 && out.counts.raised > 0)) fail("the tally does not record the work: " + JSON.stringify(out.counts));
  // ── The craft the ship needs is studied under a building stage, at the site ──
  W.causalLaunchSiteId = s.id;
  const focusBefore = s.researchFocus || "";
  out.studied = hands.study("skyline", 1);
  out.focusAfter = s.researchFocus || "";
  if (!(out.studied > 0)) fail("a building objective pushed no study of the ship's groundwork: " + out.studied);
  // The push studies the first step on the way to a groundwork craft, whatever that is here.
  const steps = [...STARFLIGHT_GROUNDWORK, "starflight"].map((t) => causalNextStep(s, t)?.id).filter(Boolean);
  if (!steps.includes(out.focusAfter)) fail("the study was not a step toward the ship's groundwork: " + focusBefore + " -> " + out.focusAfter + " not in " + steps.join(","));
  out.studiedUnderResearch = hands.study("stewardship", 1);
  if (out.studiedUnderResearch !== 0) fail("a research objective had the site studied beside it: " + out.studiedUnderResearch);
  // ── A full city's launch tower finds open ground beyond the town ──
  const ground = window.ALIFE_OPEN_GROUND_DEBUG, plot = ground.plot(s.id, "launch_tower");
  out.openGround = plot;
  if (!plot) fail("no open ground for a launch tower");
  else {
    const ring = Math.max(Math.abs(plot[0] - s.x), Math.abs(plot[1] - s.y));
    if (!(ring >= townOuterRing(s) + 2)) fail("the open ground is inside the town: ring " + ring);
    if (!developmentFootprintClear(plot[0], plot[1], buildingSpatialRadius("launch_tower"))) fail("the open ground is built on");
    if (!buildingTerrainFootprintValid("launch_tower", plot[0], plot[1])) fail("the open ground is not dry land");
  }
  const sited = plannedBuildingTile(s, "launch_tower", W.buildings.filter((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === s.id).length);
  out.sited = sited;
  if (!sited) fail("a launch tower could not be sited at all");
  // ── The effort remembers how long it has worked on an objective ──
  const push = window.ALIFE_CAUSAL_PUSH_DEBUG;
  push.finish();
  push.push("skyline");
  out.pushesFirst = causalTarget()?.pushes;
  push.finish();
  if (causalTarget()) fail("the objective was not released at the end of the press");
  push.push("skyline");
  out.pushesResumed = causalTarget()?.pushes;
  if (!(out.pushesFirst === 1 && out.pushesResumed === 2)) fail("the objective did not resume where it left off: " + out.pushesFirst + " then " + out.pushesResumed);
  push.finish();
  push.push("homes");
  out.pushesOther = causalTarget()?.pushes;
  if (out.pushesOther !== 1) fail("a new objective did not start at one: " + out.pushesOther);
  push.finish();
  // ── A rare input reaches the work face from the third push ──
  grant(s, "writing", "governance");
  const archive = planBuilding(s, "archive", 9);
  if (!archive) fail("no archive could be planned");
  else {
    // The common materials are in; only the rare ones are short.
    for (const [sp, n] of archive.requirements) if (!STORE_DRAWN_MATERIALS.includes(sp)) { W.conservation.playerInput += n - (archive.composition[sp] || 0); archive.composition[sp] = n; }
    const rare = archive.requirements.filter(([sp]) => STORE_DRAWN_MATERIALS.includes(sp));
    if (!rare.length) fail("an archive wants no rare input");
    out.rareBefore = rare.map(([sp, n]) => (archive.composition[sp] || 0) + "/" + n);
    causalPushBuilding(s, "archive", 2);
    out.rareAtTwo = rare.map(([sp, n]) => (archive.composition[sp] || 0) + "/" + n);
    if (rare.some(([sp, n]) => (archive.composition[sp] || 0) >= n)) fail("a rare input reached the face on the second push: " + out.rareAtTwo.join(","));
    causalPushBuilding(s, "archive", 3);
    out.rareAtThree = rare.map(([sp, n]) => (archive.composition[sp] || 0) + "/" + n);
    if (!rare.every(([sp, n]) => (archive.composition[sp] || 0) >= n)) fail("the third push left a rare input short: " + out.rareAtThree.join(","));
    if (missingBuildingMaterial(archive)) fail("the archive still wants material after the third push");
  }
  W.civilization.stageIndex = saved; W.civilization.stage = CIV_STAGE_ORDER[saved];
  // ── Every gift is booked ──
  out.audit = [audit, auditMatter().delta];
  if (auditMatter().delta !== audit) fail("the effort changed total matter: " + out.audit.join(" -> "));
  // ── Drawing never writes ──
  const hash = worldHash();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 3, x: s.x, y: s.y, now: 5000 });
  if (worldHash() !== hash) fail("drawing the city changed the world");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_MANY_HANDS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_MANY_HANDS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
