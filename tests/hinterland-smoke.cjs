// Hinterland smoke: a village's field ring stays at seven; a town built out to
// eight tiles lays fields at eleven; a town in famine adopts no homeless
// stranger while a fed one does, and a child of its own people is taken in
// even in famine; and the readings never write the world.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const hinter = window.ALIFE_HINTERLAND_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  // ── The field ring follows the built edge ──
  const mine = W.buildings.filter((b) => b.placeKind === "settlement" && b.placeId === s.id && !b.ruined && !["farm", "corral", "wall", "dock"].includes(b.type));
  const saved = mine.map((b) => [b, b.x, b.y]);
  for (const b of mine) { b.x = clamp(s.x + 1, 0, W.width - 1); b.y = s.y; }
  out.villageCap = hinter.fieldCap(s.id);
  out.villageRing = hinter.farmRing(s.id);
  if (out.villageCap !== 7) fail("a village's field cap is not seven: " + out.villageCap);
  if (!(out.villageRing <= 7)) fail("a village lays fields past seven: " + out.villageRing);
  if (!mine.length) fail("no building to move out");
  else { const dx = s.x + 8 < W.width ? 8 : -8; mine[0].x = s.x + dx; mine[0].y = s.y; }
  const before = worldHash();
  out.cityCap = hinter.fieldCap(s.id);
  out.cityRing = hinter.farmRing(s.id);
  if (worldHash() !== before) fail("reading the field ring wrote the world");
  if (out.cityCap !== 11) fail("a town built out to eight tiles does not cap its fields at eleven: " + out.cityCap);
  if (!(out.cityRing > 7 && out.cityRing <= 11)) fail("a town built out to eight tiles does not lay fields past seven: " + out.cityRing);
  for (const [b, x, y] of saved) { b.x = x; b.y = y; }
  // ── A famine adopts no stranger ──
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.life[id]);
  if (people.length < 3) { fail("too few people"); return out; }
  const [stranger, child, parent] = people;
  const ss = W.components.social[stranger], cs = W.components.social[child], ps = W.components.social[parent];
  const hungers = people.map((id) => W.components.life[id].hunger);
  for (const id of people) { const soc = W.components.social[id]; soc.homePlaceKind = "settlement"; soc.homePlaceId = s.id; W.components.life[id].hunger = 95; }
  ss.homePlaceKind = null; ss.homePlaceId = 0;
  cs.homePlaceKind = null; cs.homePlaceId = 0;
  W.components.identity[child].parents = [parent];
  W.tick++;
  out.famine = !!foodOutlook(s)?.famine;
  if (!out.famine) fail("everyone hungry did not read as famine");
  const refused = hinter.counts().refused;
  adoptInto(stranger, ss, "settlement", s);
  out.strangerInFamine = ss.homePlaceId === s.id;
  if (out.strangerInFamine) fail("a famished town adopted a stranger");
  if (hinter.counts().refused !== refused + 1) fail("the refusal was not counted");
  adoptInto(child, cs, "settlement", s);
  out.childInFamine = cs.homePlaceId === s.id;
  if (!out.childInFamine) fail("a famished town turned away a child of its own people");
  // Fed again: the stranger is taken in.
  for (const id of people) W.components.life[id].hunger = 20;
  const grant = 600;
  s.inventory[C.ORGANIC] = (s.inventory[C.ORGANIC] || 0) + grant;
  W.conservation.playerInput += grant;
  W.tick++;
  out.fed = !foodOutlook(s)?.lean;
  adoptInto(stranger, ss, "settlement", s);
  out.strangerWhenFed = ss.homePlaceId === s.id;
  if (!out.strangerWhenFed) fail("a fed town turned a stranger away");
  people.forEach((id, i) => { W.components.life[id].hunger = hungers[i]; });
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_HINTERLAND_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_HINTERLAND_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
