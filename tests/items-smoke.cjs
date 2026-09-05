// Items smoke: every equipment form maps to a silhouette, models render to SVG
// and canvas without touching the world, compounds get glyphs, and the
// inventory, artifact inspector, artifact page, and chemistry lists carry them.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const items = window.ALIFE_ITEMS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  for (let i = 0; i < 200; i++) simTick();
  // Every form in the equipment vocabulary lands on a silhouette.
  const forms = ["war edge", "tension caster", "burst caster", "cutter", "impact pick", "collection scoop", "building maul", "sinew tension caster", "torsion shard sling", "barbed bone reach-spear", "gravity-knot maul", "flaked crescent edge", "weighted cord sling", "hooked thrusting staff", "sealed flex-vessel bucket", "fired shell bucket", "overlapping gravity scales", "lashed plank raft", "woven reed shield", "domed shell helm"];
  const caps = { "war edge": ["war", "cut"], "tension caster": ["war", "ranged"], "burst caster": ["war", "ranged", "powder"], cutter: ["cut", "build"], "impact pick": ["mine", "build"], "collection scoop": ["gather"], "building maul": ["build"], "sealed flex-vessel bucket": ["carry_liquid"], "fired shell bucket": ["carry_liquid"], "overlapping gravity scales": ["armor", "helmet"], "lashed plank raft": ["watercraft"], "woven reed shield": ["shield"], "domed shell helm": ["helmet"] };
  const seen = new Set();
  for (const form of forms) { const s = items.silhouette({ form, capabilities: caps[form] || ["war"] }); if (!items.silhouettes.includes(s)) fail("form '" + form + "' has no silhouette (" + s + ")"); seen.add(s); }
  out.silhouettes = [...seen];
  if (seen.size < 10) fail("too few distinct silhouettes across the vocabulary");
  // A real crafted tool, or a synthetic one, renders both ways.
  let artifact = W.artifacts.find((a) => a.tool);
  if (!artifact) {
    const person = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
    const inv = W.components.inventory[person].materials; inv[C.MINERAL] = Math.max(inv[C.MINERAL], 4); inv[C.FIBER] = Math.max(inv[C.FIBER], 4);
    artifact = createPersonalTool(person, { head: C.MINERAL, binding: C.FIBER, purpose: "war" });
  }
  if (!artifact) { fail("no tool to model"); return out; }
  const model = items.model(artifact.id);
  out.model = model && { silhouette: model.silhouette, hue: model.headHue, quality: model.quality };
  if (!model) fail("the tool has no model");
  const svg = items.svg(artifact.id, 40);
  if (!/<svg/.test(svg) || !/<path|<ellipse/.test(svg)) fail("the tool model renders no SVG");
  if (/NaN|undefined/.test(svg)) fail("the SVG contains NaN or undefined");
  // Compounds: every species has a glyph.
  let glyphs = 0;
  for (let sp = 0; sp < SPECIES_COUNT; sp++) { const g = items.chemSvg(sp, 16); if (/<svg/.test(g) && !/NaN/.test(g)) glyphs++; }
  out.glyphs = glyphs;
  if (glyphs !== SPECIES_COUNT) fail("not every compound has a glyph (" + glyphs + ")");
  const topologies = new Set(); for (let sp = 0; sp < SPECIES_COUNT; sp++) topologies.add(items.chem(sp).topology);
  out.topologies = [...topologies];
  // The owner's inventory shows the model; the artifact inspector and page carry a portrait.
  const owner = artifact.ownerId;
  if (owner && W.components.life[owner]) {
    const panel = personInventoryPanel(owner);
    if (!/item-glyph/.test(panel)) fail("the inventory panel shows no item model");
    if (!/chem-glyph/.test(panel) && Array.from(W.components.inventory[owner].materials).some((v) => v > 0)) fail("carried materials show no compound glyphs");
  }
  if (!/item-portrait/.test(nonLifeInspector(artifact.entityId))) fail("the artifact inspector has no portrait");
  if (!/item-portrait/.test(window.ALIFE_LEGENDS_DEBUG.render("artifact", artifact.id))) fail("the artifact page has no portrait");
  const settlement = W.settlements.find((s) => !s.ruined);
  if (settlement && !/chem-glyph/.test(chemistryRows(settlement.inventory, 6))) fail("chemistry rows carry no glyphs");
  // Worn and carried on screen without changing the world.
  const before = worldHash();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 8, now: 5000 });
  if (owner && W.components.life[owner]) { const g = document.createElement("canvas").getContext("2d"); drawCreatureGlyph(g, owner, { x: 100, y: 100 }, 5000, null, 32, true); }
  if (worldHash() !== before) fail("rendering items changed the world hash");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_ITEMS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_ITEMS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
