// Presence smoke: walkers are drawn near twice as tall so a figure is legible
// at the zooms a town is watched from; a working figure carries its tool or
// load; plain heads have hair; a person out of doors at night in a town that
// knows fire carries a torch and none at noon; and rendering leaves the world
// untouched.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const pres = window.ALIFE_PRESENCE_DEBUG, figs = window.ALIFE_FIGURES_DEBUG, dl = window.ALIFE_DAYLIGHT_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  if (!(pres.scale("person") > 1.5) || !(pres.scale("herbivore") > 1.2)) fail("walkers are not drawn taller");
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const person = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.life[id] && W.components.work?.[id] && W.components.position[id] && !W.components.campaign?.[id]);
  if (!person) { fail("no person"); return out; }
  const life = W.components.life[person], work = W.components.work[person], p = W.components.position[person];
  const keep = { x: p.x, y: p.y, inside: life.insideBuildingId, task: work.task, handled: work.handledTick, hunger: life.hunger, thirst: life.thirst, tick: W.tick };
  // Legible at zoom three: the figure radius clears the dot rule where the old scale did not.
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 3, x: p.x, y: p.y, now: 5000 });
  out.radiusIso3 = +pres.radius(person).toFixed(2);
  const base3 = projectionMetrics().tw * (0.05 + 0.042 * clamp(peekPhenotype(person).size, 0.35, 1.8));
  out.baseIso3 = +base3.toFixed(2);
  if (!(out.radiusIso3 >= 3.4) || !(out.radiusIso3 > base3 * 1.3)) fail("the figure is not drawn larger: " + out.radiusIso3 + " vs base " + out.baseIso3);
  // A working figure carries its tool or load.
  life.insideBuildingId = 0; life.hunger = 30; life.thirst = 30;
  if (!settlement.knownProcesses.includes("controlled_fire")) settlement.knownProcesses.push("controlled_fire");
  // Every render is checked on its own: the fixture moves the person and its task between them.
  const clean = (opts) => { const h0 = worldHash(); window.ALIFE_VISUAL_DEBUG.renderOnly(opts); if (worldHash() !== h0) fail("drawing figures changed the world (" + opts.view + " " + opts.zoom + ")"); };
  const drawWith = (task) => {
    work.task = task; work.handledTick = W.tick;
    pres.reset(); figs.reset();
    clean({ view: "iso", quality: "high", zoom: 6, x: p.x, y: p.y, now: 5100 });
    return { ...pres.counts(), figures: figs.drawn() };
  };
  out.haul = drawWith("haul");
  out.cut = drawWith("cut");
  out.harvest = drawWith("harvest");
  out.idle = drawWith("idle");
  if (!(out.haul.figures >= 1)) fail("no figure was drawn at zoom six");
  if (!(out.haul.tools >= 1) || !(out.cut.tools >= 1) || !(out.harvest.tools >= 1)) fail("working figures carry no tools: " + JSON.stringify([out.haul.tools, out.cut.tools, out.harvest.tools]));
  out.head = creatureModel(person).personHead || "round";
  const standing = W.components.identity[person]?.standing;
  if (out.head === "round" && standing !== "rich" && standing !== "prosperous" && !(out.idle.hair >= 1)) fail("a plain head has no hair");
  // A torch at night out of doors where fire is known, and none at noon.
  p.x = settlement.x; p.y = settlement.y;
  const h = dl.hemisphereAt(p.x, p.y), year = W.tick - (W.tick % TICKS_PER_YEAR) + TICKS_PER_YEAR;
  let midnight = year, noon = year;
  for (let t = year; t < year + TICKS_PER_YEAR; t++) { if (dl.lightAt(t, h) < dl.lightAt(midnight, h)) midnight = t; if (dl.lightAt(t, h) > dl.lightAt(noon, h)) noon = t; }
  W.tick = midnight;
  out.torchKind = pres.torch(person);
  pres.reset();
  clean({ view: "iso", quality: "high", zoom: 4, x: p.x, y: p.y, now: 5200 });
  out.torchesNight = pres.counts().torches;
  if (out.torchKind !== "torch" || !(out.torchesNight >= 1)) fail("no torch at night: " + out.torchKind + " " + out.torchesNight);
  W.tick = noon;
  pres.reset();
  clean({ view: "iso", quality: "high", zoom: 4, x: p.x, y: p.y, now: 5300 });
  out.torchesNoon = pres.counts().torches;
  if (out.torchesNoon !== 0) fail("torches burn at noon: " + out.torchesNoon);
  clean({ view: "top", quality: "low", zoom: 2, x: p.x, y: p.y, now: 5400 });
  W.tick = keep.tick;
  p.x = keep.x; p.y = keep.y; life.insideBuildingId = keep.inside; work.task = keep.task; work.handledTick = keep.handled; life.hunger = keep.hunger; life.thirst = keep.thirst;
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_PRESENCE_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_PRESENCE_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
