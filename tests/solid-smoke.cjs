// Solid-world smoke: roads and rails are drawn as one overlay after the
// terrain in all three lenses (and at low quality and far zoom) without
// touching the world; a cliff taller than a walker blocks the step and civil
// paths route round it; herds do not swim into the deep; a walker beside a
// building is drawn clear of its facade; and in the projected lenses a walker
// behind a taller face is hidden while the top-down lens shows everyone.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const solid = window.ALIFE_SOLID_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  // ── Roads drawn once, in every lens ──
  ensureRoads();
  const road = W.tiles.road, laid = [], land = (t) => W.tiles.liquid[t] <= WATER_DEPTH.SURFACE;
  const lay = (y, level) => { for (let x = Math.max(1, settlement.x - 7); x <= Math.min(W.width - 2, settlement.x + 7); x++) { const t = idx(x, y); if (!land(t) || road[t]) continue; road[t] = level; laid.push(t); } };
  lay(clamp(settlement.y + 3, 1, W.height - 2), ROAD_PAVED);
  lay(clamp(settlement.y - 3, 1, W.height - 2), ROAD_RAIL);
  if (laid.length < 8) { fail("could not lay a test road on land"); return out; }
  const hashBefore = typeof worldHash === "function" ? worldHash() : null;
  for (const view of ["top", "iso", "oblique"]) {
    solid.reset();
    window.ALIFE_VISUAL_DEBUG.renderOnly({ view, quality: "high", zoom: 3, x: settlement.x, y: settlement.y, now: 5000 });
    const o = solid.overlay();
    out[view] = o;
    if (!(o.segments >= 6)) fail(view + " drew too few road segments: " + JSON.stringify(o));
  }
  solid.reset();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "low", zoom: 3, x: settlement.x, y: settlement.y, now: 5100 });
  out.lowQuality = solid.overlay();
  if (!(out.lowQuality.segments >= 6)) fail("Lean quality lost the roads: " + JSON.stringify(out.lowQuality));
  solid.reset();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 0.5, x: settlement.x, y: settlement.y, now: 5200 });
  out.farZoom = solid.overlay();
  if (!(out.farZoom.segments >= 6)) fail("a far camera lost the roads: " + JSON.stringify(out.farZoom));
  if (hashBefore !== null && worldHash() !== hashBefore) fail("drawing the ground's ways changed the world");
  for (const t of laid) road[t] = ROAD_NONE;
  // ── Cliffs block walkers and paths route round them ──
  const elevation = W.tiles.elevation;
  let person = 0, step = null;
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id) || !W.components.position[id] || W.components.life[id]?.insideBuildingId) continue;
    const q = W.components.position[id];
    if (!land(idx(q.x, q.y))) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = q.x + dx, ny = q.y + dy;
      if (!inside(nx, ny) || !land(idx(nx, ny)) || movementTileBlocked(id, nx, ny)) continue;
      step = { x: nx, y: ny }; break;
    }
    if (step) { person = id; break; }
  }
  if (!person) { fail("no person with an open neighbour to test"); return out; }
  const p = W.components.position[person], keep = { x: p.x, y: p.y };
  const j = idx(step.x, step.y), i = idx(p.x, p.y), keepE = elevation[j];
  elevation[j] = elevation[i] + solid.cliffStep + 60 <= 1000 ? elevation[i] + solid.cliffStep + 60 : Math.max(0, elevation[i] - solid.cliffStep - 60);
  out.cliff = solid.cliff(p.x, p.y, step.x, step.y);
  out.cliffBlocked = movementTileBlocked(person, step.x, step.y);
  if (!out.cliff || !out.cliffBlocked) fail("a cliff did not block the step: " + JSON.stringify([out.cliff, out.cliffBlocked]));
  if (directionScore(person, step.x - p.x, step.y - p.y, null) > -1e8) fail("the mind still scores a step up a cliff");
  // A shore step is a bank, not a cliff.
  const keepL = W.tiles.liquid[j];
  W.tiles.liquid[j] = WATER_DEPTH.SURFACE + 20;
  if (solid.cliff(p.x, p.y, step.x, step.y)) fail("a step down a bank into water counted as a cliff");
  W.tiles.liquid[j] = keepL;
  elevation[j] = keepE;
  if (movementTileBlocked(person, step.x, step.y)) fail("the level step stayed blocked after the cliff was removed");
  // Civil paths avoid a cliff line.
  const goalX = clamp(p.x + 6, 1, W.width - 2), goalY = p.y;
  const openPath = solid.path(i, { x: goalX, y: goalY }, 0, "land");
  out.openPath = openPath.length;
  if (openPath.length) {
    // Raise a cliff across the straight line between them and see the path leave it.
    const wallX = p.x + 3, raised = [];
    if (wallX < W.width - 1) {
      for (let y = Math.max(0, p.y - 3); y <= Math.min(W.height - 1, p.y + 3); y++) { const t = idx(wallX, y); if (!land(t)) continue; raised.push([t, elevation[t]]); elevation[t] = Math.min(1000, elevation[t] + solid.cliffStep + 80); }
      const detour = solid.path(i, { x: goalX, y: goalY }, 0, "land");
      out.detour = detour.length;
      const crossesWall = detour.some((t, n) => n > 0 && Math.abs(elevation[t] - elevation[detour[n - 1]]) > solid.cliffStep);
      if (detour.length && crossesWall) fail("a civil path climbed the cliff");
      for (const [t, e] of raised) elevation[t] = e;
    }
  }
  // ── Herds do not swim into the deep ──
  const animal = W.activeIds.find((id) => (W.kind[id] === KINDS.HERBIVORE || W.kind[id] === KINDS.PREDATOR) && classifyAlive(id) && W.components.position[id]);
  if (animal) {
    const ap = W.components.position[animal];
    let n = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = ap.x + dx, ny = ap.y + dy; if (inside(nx, ny) && !movementTileBlocked(animal, nx, ny)) { n = { x: nx, y: ny }; break; } }
    if (n) {
      const t = idx(n.x, n.y), keepDeep = W.tiles.liquid[t];
      W.tiles.liquid[t] = WATER_DEPTH.DEEP + 100;
      out.deepBlocked = movementTileBlocked(animal, n.x, n.y);
      if (!out.deepBlocked) fail("an animal may swim into the deep");
      W.tiles.liquid[t] = keepDeep;
    }
  }
  // ── Drawn clear of a facade ──
  const building = W.buildings.find((b) => b.complete && !b.ruined && b.integrity > 0 && !["farm", "corral", "wall"].includes(b.type) && inside(b.x + 2, b.y) && !standingBuildingAtMovementTile(b.x + 1, b.y) && !standingBuildingAtMovementTile(b.x + 2, b.y));
  if (!building) { fail("no standing building to stand beside"); return out; }
  p.x = building.x + 1; p.y = building.y; p.regionId = regionId(p.x, p.y);
  const life = W.components.life[person], keepInside = life ? life.insideBuildingId : 0;
  if (life) life.insideBuildingId = 0;
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 4, x: building.x, y: building.y, now: 6000 });
  const push = solid.push(p.x, p.y);
  out.push = push;
  if (!push || !(push.dx > 0.2)) fail("no push away from the facade: " + JSON.stringify(push));
  const anchor = visualAnchor(person, p, projectionMetrics(), 6000);
  out.anchorDx = +(anchor.wx - (p.x + 0.5)).toFixed(2);
  if (!(anchor.wx > p.x + 0.6)) fail("the body is drawn through the facade: " + out.anchorDx);
  // ── Hidden behind a taller face in the projected lenses, seen from above ──
  const front = idx(p.x + 1, p.y), keepFront = elevation[front];
  if (inside(p.x + 1, p.y) && !W.buildings.some((b) => b.x === p.x + 1 && b.y === p.y)) {
    elevation[front] = 1000;
    elevation[idx(p.x, p.y)] = Math.min(elevation[idx(p.x, p.y)], 300);
    window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 8, x: p.x, y: p.y, now: 6100 });
    out.hiddenIso = solid.hidden(p.x, p.y);
    out.visibleIso = sceneEntityVisible(person, visibleBounds());
    window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 8, x: p.x, y: p.y, now: 6200 });
    out.hiddenTop = solid.hidden(p.x, p.y);
    if (!out.hiddenIso || out.visibleIso) fail("a walker behind a cliff face is still drawn in the isometric lens");
    if (out.hiddenTop) fail("the top-down lens hides a walker");
    elevation[front] = keepFront;
  }
  p.x = keep.x; p.y = keep.y; p.regionId = regionId(p.x, p.y);
  if (life) life.insideBuildingId = keepInside;
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_SOLID_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_SOLID_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
