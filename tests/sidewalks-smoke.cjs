// Sidewalks smoke: paved tiles form a real graph with nodes and edges, a route
// between two of them runs along the pavement only, a person on foot in a town
// prefers a paved step to an unpaved one, the graph is rebuilt when the paving
// changes and not before, and drawing the streets never writes the world.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const sw = window.ALIFE_SIDEWALK_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  ensureRoads();
  // Pave a straight run of tiles beside the town and let the graph find it.
  const paved = [];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const x = settlement.x + dx, y = settlement.y + dy;
      if (!inside(x, y)) continue;
      const t = idx(x, y);
      if (W.tiles.liquid[t] > WATER_DEPTH.SURFACE) continue;
      W.tiles.road[t] = ROAD_PAVED;
      paved.push(t);
    }
  out.pavedCount = paved.length;
  if (paved.length < 4) { fail("could not pave a run of tiles: " + paved.length); return out; }
  out.graph = sw.rebuild();
  if (!(out.graph.nodes >= paved.length)) fail("the graph did not see the paving: " + JSON.stringify(out.graph));
  if (!(out.graph.edges >= paved.length - 1)) fail("paved tiles in a row have no edges between them: " + out.graph.edges);

  // A route between the ends runs along the pavement and nowhere else.
  // Water can split a paved block, so ask for the longest walk the graph can
  // actually offer and check that one, rather than assuming two corners join.
  let best = null;
  for (const a of paved) for (const b of paved) {
    if (a === b) continue;
    const r = sw.route(a, b);
    if (r && (!best || r.length > best.length)) best = r;
  }
  out.route = best;
  out.routeLength = best ? best.length : 0;
  if (!best || best.length < 3) fail("the pavement joins nothing: longest walk " + out.routeLength);
  else {
    const offPavement = best.filter((t) => roadLevel(t) < ROAD_PAVED);
    if (offPavement.length) fail("the route left the pavement: " + offPavement.length + " steps");
    for (let n = 1; n < best.length; n++) {
      const [ax, ay] = xy(best[n - 1]), [bx, by] = xy(best[n]);
      if (Math.max(Math.abs(ax - bx), Math.abs(ay - by)) !== 1) fail("the route jumps between tiles that do not touch");
    }
  }
  out.offGraph = sw.route(paved[0], idx(1, 1));
  if (out.offGraph) fail("a route was found to a tile with no pavement on it");

  // A person on foot prefers the paved step. Compare the score of a step onto
  // the pavement with the same step onto bare ground beside it.
  const walker = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.position[id]);
  if (!walker) fail("no walker");
  else {
    const p = W.components.position[walker], onto = paved[Math.floor(paved.length / 2)], [px, py] = xy(onto);
    p.x = px; p.y = py + 1;
    if (!inside(p.x, p.y)) { p.y = py - 1; }
    const toPavement = directionScore(walker, 0, py - p.y, null);
    W.tiles.road[onto] = 0;
    sw.rebuild();
    const toBare = directionScore(walker, 0, py - p.y, null);
    W.tiles.road[onto] = ROAD_PAVED;
    sw.rebuild();
    out.pavementBonus = +(toPavement - toBare).toFixed(2);
    out.onPavement = sw.on(px, py);
    if (!(out.pavementBonus > 0)) fail("a walker does not prefer the pavement: " + out.pavementBonus);
    if (!out.onPavement) fail("a paved tile is not on the sidewalk graph");
  }

  // The graph is rebuilt when the paving changes and not on every tick.
  const before = sw.counts().rebuilds;
  sw.graph(); sw.graph(); sw.graph();
  out.idleRebuilds = sw.counts().rebuilds - before;
  if (out.idleRebuilds > 0) fail("the graph was rebuilt with nothing changed: " + out.idleRebuilds);
  W.tiles.road[paved[0]] = 0;
  out.afterRemoval = sw.rebuild();
  if (!(out.afterRemoval.nodes < out.graph.nodes)) fail("lifting a paved tile left the graph unchanged: " + JSON.stringify(out.afterRemoval));

  out.traffic = sw.traffic().length;
  // A street carries its use: the tread already on a tile is what makes a busy
  // pavement read as busy, so wear has to rise with traffic and stop at one.
  const wearTile = paved[1], [wx, wy] = xy(wearTile);
  W.tiles.traffic[wearTile] = 0;
  const quiet = sw.wear(wx, wy);
  W.tiles.traffic[wearTile] = 1300;
  const busy = sw.wear(wx, wy);
  W.tiles.traffic[wearTile] = 60000;
  const saturated = sw.wear(wx, wy);
  out.wear = { quiet, busy, saturated };
  if (!(quiet === 0)) fail("an untrodden street is already worn: " + quiet);
  if (!(busy > quiet)) fail("wear does not rise with traffic: " + busy + " vs " + quiet);
  if (saturated !== 1) fail("wear does not stop at one: " + saturated);
  const hash = worldHash();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 3, x: settlement.x, y: settlement.y, now: 5000 });
  if (worldHash() !== hash) fail("drawing the streets changed the world");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_SIDEWALK_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_SIDEWALK_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
