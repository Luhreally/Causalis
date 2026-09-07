// Figures smoke: a person's pose follows their task and state (kneeling to
// sow, working with arms raised, fighting, sitting when a rest is owed,
// walking, standing), dress reads standing and the home town's era, children
// are drawn small, posed figures are drawn in the world and in portraits,
// and rendering leaves the world untouched.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const fg = window.ALIFE_FIGURES_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const person = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.life[id] && W.components.work?.[id] && W.components.identity[id]);
  if (!person) { fail("no person"); return out; }
  const life = W.components.life[person], work = W.components.work[person], ident = W.components.identity[person], soc = W.components.social[person];
  const keep = { task: work.task, handled: work.handledTick, debt: life.restDebt, behavior: life.behavior, standing: ident.standing, home: [soc.homePlaceKind, soc.homePlaceId] };
  if (W.components.campaign) delete W.components.campaign[person];
  // Poses follow task and state.
  life.restDebt = false; life.behavior = "wander";
  work.task = "sow"; work.handledTick = W.tick;
  out.kneel = fg.pose(person);
  work.task = "haul";
  out.work = fg.pose(person);
  work.task = "raze";
  out.fight = fg.pose(person);
  work.task = "idle"; life.restDebt = true;
  out.sit = fg.pose(person);
  life.restDebt = false;
  out.stand = fg.pose(person);
  if (out.kneel !== "kneel" || out.work !== "work" || out.fight !== "fight" || out.sit !== "sit" || out.stand !== "stand") fail("poses do not follow the task and state: " + JSON.stringify([out.kneel, out.work, out.fight, out.sit, out.stand]));
  work.task = "idle"; work.handledTick = W.tick - 100;
  if (fg.pose(person) !== "stand") fail("a stale task still poses the figure");
  // Dress reads standing and era.
  ident.standing = "rich";
  soc.homePlaceKind = "settlement"; soc.homePlaceId = settlement.id;
  settlement.knownProcesses = settlement.knownProcesses.filter((t) => !["writing", "mechanization", "electricity"].includes(t));
  out.eraStone = fg.era(person);
  settlement.knownProcesses.push("writing");
  const eraLetters = fg.era(person);
  settlement.knownProcesses.push("mechanization", "electricity");
  W.tick++;
  out.eraElectric = fg.era(person);
  W.tick--;
  if (out.eraStone !== "stone" || eraLetters !== "stone" && eraLetters !== "letters" || out.eraElectric !== "electric") fail("the era of dress does not follow the home town: " + JSON.stringify([out.eraStone, eraLetters, out.eraElectric]));
  const state = fg.state(person);
  out.state = state;
  if (state.standing !== "rich" || state.era !== "electric") fail("the figure state lost its standing or era: " + JSON.stringify(state));
  // Posed figures are drawn in the world and in portraits, and nothing changes.
  work.task = "sow"; work.handledTick = W.tick; life.insideBuildingId = 0;
  const hashBefore = typeof worldHash === "function" ? worldHash() : null;
  const pp = W.components.position[person];
  fg.reset();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 7, x: pp.x, y: pp.y, now: 5000 });
  out.drawnWorld = fg.drawn(); out.callsWorld = fg.calls(); out.tw = +projectionMetrics().tw.toFixed(2); out.lastR = VISUAL_MOTION.get(person)?.lastR ?? null; out.canvas = [DOM.canvas?.width, DOM.canvas?.height]; out.zoom = UI.camera.zoom; out.quality = UI.quality;
  if (!(out.drawnWorld >= 1)) fail("no posed figure was drawn in the world (persons drawn: " + out.callsWorld + ")");
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "standard", zoom: 6, x: pp.x, y: pp.y, now: 5100 });
  fg.reset();
  drawCreatureGlyph(ctx, person, { x: 40, y: 40 }, 5200, null, 18, true, null);
  out.drawnPortrait = fg.drawn();
  if (out.drawnPortrait !== 1) fail("the portrait did not draw the dressed figure: " + out.drawnPortrait);
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "low", zoom: 0.5, now: 5300 });
  if (hashBefore !== null && worldHash() !== hashBefore) fail("drawing figures changed the world");
  work.task = keep.task; work.handledTick = keep.handled; life.restDebt = keep.debt; life.behavior = keep.behavior; ident.standing = keep.standing; soc.homePlaceKind = keep.home[0]; soc.homePlaceId = keep.home[1];
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_FIGURES_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_FIGURES_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
