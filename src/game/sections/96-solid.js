// ═══════════════════════════════════════════════════════════════════════════
// 96. SOLID WORLD — roads laid in one stroke, and bodies that stay out of walls
// ═══════════════════════════════════════════════════════════════════════════
// Roads and worn paths were drawn tile by tile inside the terrain pass, so
// every tile's dark road edge was painted over its neighbour's pale surface
// and, in the projected lenses, later tiles buried the segments of earlier
// ones: a road read as a row of cut pieces. The ground's ways are now drawn
// once, after all the terrain and before anything that stands on it: worn
// trails in one stroke, the stone edge of every paved road in one stroke,
// its surface in the next, and the rails and their ties last, in whichever
// lens is active. Bodies became solid at the same time. A step up or down a
// face taller than a walker is a cliff and is not taken; herds and hunters
// do not swim into the deep; a walker beside a building is drawn clear of
// its facade instead of through it; and in the projected lenses a walker
// standing behind a tile face taller than itself is hidden by that face.
// Civil paths route round cliffs. Rendering only reads; the movement rules
// are the simulation's own and are deterministic.
const CLIFF_STEP = 150, // elevation units a walker can climb in one step
  FACADE_PUSH = 0.3, // tiles a body is drawn clear of a neighbouring facade
  TRAIL_WEAR = 260,
  GROUNDWAY_DIRS = [
    [1, 0],
    [0, 1],
    [1, 1],
    [-1, 1],
  ],
  GROUNDWAYS = { segments: 0, tiles: 0, perTile: 0 };
// ── The ground's ways, drawn once ─────────────────────────────────────────────
// The tile pass no longer draws paths; the overlay below draws them all.
drawWornPath = function () {
  GROUNDWAYS.perTile++;
};
function groundwayClass(i, road, traffic, liquid, trails) {
  const r = road ? road[i] : 0;
  if (r === ROAD_RAIL) return 3;
  if (r === ROAD_PAVED) return 2;
  if (trails && traffic[i] > TRAIL_WEAR && liquid[i] <= WATER_DEPTH.SURFACE) return 1;
  return 0;
}
function strokeGroundways(m, list, lone, style, width, dash) {
  if (!list.length && !lone.length) return;
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let n = 0; n < list.length; n += 4) {
    const a = proceduralProjectTile(list[n] + 0.5, list[n + 1] + 0.5, m),
      b = proceduralProjectTile(list[n + 2] + 0.5, list[n + 3] + 0.5, m);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  for (let n = 0; n < lone.length; n += 2) {
    const a = proceduralProjectTile(lone[n] + 0.5, lone[n + 1] + 0.5, m);
    ctx.moveTo(a.x - dash, a.y);
    ctx.lineTo(a.x + dash, a.y);
  }
  ctx.stroke();
}
function drawGroundways(m, v, bounds) {
  const road = W.tiles.road,
    traffic = W.tiles.traffic,
    liquid = W.tiles.liquid,
    zoom = UI.camera.zoom;
  GROUNDWAYS.segments = 0;
  GROUNDWAYS.tiles = 0;
  const trails = !!traffic && zoom >= 0.9 && UI.quality !== "low",
    roads = !!road && zoom >= 0.3;
  if (!trails && !roads) return;
  const width = W.width,
    height = W.height,
    x0 = Math.max(0, bounds.x0 - 1),
    x1 = Math.min(width - 1, bounds.x1 + 1),
    y0 = Math.max(0, bounds.y0 - 1),
    y1 = Math.min(height - 1, bounds.y1 + 1),
    lists = [null, [], [], []],
    lone = [null, [], [], []],
    roadField = roads ? road : null,
    cls = (i) => groundwayClass(i, roadField, traffic, liquid, trails);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * width + x,
        c = cls(i);
      if (!c) continue;
      GROUNDWAYS.tiles++;
      let joined = false;
      for (const [dx, dy] of GROUNDWAY_DIRS) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const cj = cls(ny * width + nx);
        if (!cj) continue;
        // A segment takes the lesser of its ends, so trails run into roads
        // and roads run into rail yards without a seam.
        lists[Math.min(c, cj)].push(x, y, nx, ny);
        joined = true;
      }
      if (!joined) {
        let any = false;
        for (const [dx, dy] of GROUNDWAY_DIRS) {
          const nx = x - dx,
            ny = y - dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && cls(ny * width + nx)) {
            any = true;
            break;
          }
        }
        if (!any) lone[c].push(x, y);
      }
    }
  GROUNDWAYS.segments = (lists[1].length + lists[2].length + lists[3].length) / 4;
  if (!GROUNDWAYS.segments && !lone[1].length && !lone[2].length && !lone[3].length) return;
  const tw = m.tw;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (trails)
    strokeGroundways(m, lists[1], lone[1], hsl(v.mineralHue, 24, 16, 0.3), Math.max(1, tw * 0.22), tw * 0.2);
  if (roads) {
    const w = Math.max(1.2, tw * 0.3);
    strokeGroundways(m, lists[2], lone[2], hsl(36, 14, 34, 0.85), w * 1.35, tw * 0.3);
    strokeGroundways(m, lists[2], lone[2], hsl(40, 18, 66, 0.92), w, tw * 0.3);
    strokeGroundways(m, lists[3], lone[3], hsl(30, 12, 22, 0.9), Math.max(1.2, tw * 0.16), tw * 0.3);
    if (zoom > 2 && lists[3].length) {
      // Ties across the track.
      ctx.strokeStyle = hsl(28, 30, 32, 0.9);
      ctx.lineWidth = Math.max(1, tw * 0.06);
      ctx.beginPath();
      const rails = lists[3];
      for (let n = 0; n < rails.length; n += 4) {
        const a = proceduralProjectTile(rails[n] + 0.5, rails[n + 1] + 0.5, m),
          b = proceduralProjectTile(rails[n + 2] + 0.5, rails[n + 3] + 0.5, m),
          ax = b.x - a.x,
          ay = b.y - a.y,
          len = Math.hypot(ax, ay) || 1,
          tx = (-ay / len) * tw * 0.14,
          ty = (ax / len) * tw * 0.14;
        for (const f of [0.25, 0.5, 0.75]) {
          const cx = a.x + ax * f,
            cy = a.y + ay * f;
          ctx.moveTo(cx - tx, cy - ty);
          ctx.lineTo(cx + tx, cy + ty);
        }
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
const drawEntitiesSolidBase = drawEntitiesProcedural;
drawEntitiesProcedural = function (now, bounds) {
  if (W?.tiles)
    drawGroundways(
      ACTIVE_RENDER_METRICS || projectionMetrics(),
      ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
      bounds,
    );
  drawEntitiesSolidBase(now, bounds);
};
drawEntities = drawEntitiesProcedural;
// ── Solid ground: cliffs and the deep ─────────────────────────────────────────
function walkerKind(id) {
  const k = W.kind[id];
  return k === KINDS.PERSON || k === KINDS.HERBIVORE || k === KINDS.PREDATOR;
}
// A shore step is a bank, not a cliff: water hides its bed.
function cliffBetween(from, to) {
  const liquid = W.tiles.liquid;
  if (liquid[from] > WATER_DEPTH.SURFACE || liquid[to] > WATER_DEPTH.SURFACE) return false;
  return Math.abs(W.tiles.elevation[from] - W.tiles.elevation[to]) > CLIFF_STEP;
}
function terrainStepBlocked(id, fromX, fromY, toX, toY) {
  if (!inside(toX, toY) || !inside(fromX, fromY) || !walkerKind(id)) return false;
  const to = idx(toX, toY),
    from = idx(fromX, fromY),
    liquid = W.tiles.liquid;
  // Herds and hunters do not swim into the deep; one already there may leave it.
  if (W.kind[id] !== KINDS.PERSON && liquid[to] > WATER_DEPTH.DEEP && liquid[from] <= WATER_DEPTH.DEEP)
    return true;
  if (Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY)) !== 1) return false;
  return cliffBetween(from, to);
}
const movementTileBlockedSolidBase = movementTileBlocked;
movementTileBlocked = function (id, x, y) {
  if (movementTileBlockedSolidBase(id, x, y)) return true;
  const p = W.components.position[id];
  return !!p && terrainStepBlocked(id, p.x, p.y, x, y);
};
// Civil paths route round cliffs: the corridor search of section 59 with the
// step rule added between a tile and its parent.
civilPathFind = function (seed, target, factionId = 0, mode = "land") {
  if (!(seed >= 0) || !target) return [];
  const width = W.width,
    parent = new Int32Array(W.tileCount).fill(-1),
    queue = [seed],
    reach = mode === "sea" ? 2 : 3,
    approach = (tile) =>
      Math.max(Math.abs((tile % width) - target.x), Math.abs(((tile / width) | 0) - target.y)),
    [sx, sy] = xy(seed),
    nearShoreOf = (tile, x, y) =>
      Math.max(Math.abs((tile % width) - x), Math.abs(((tile / width) | 0) - y)) <= 6 &&
      campaignTilePassable(tile, factionId, false),
    passable =
      mode === "sea"
        ? (tile) =>
            seaTilePassable(tile) ||
            nearShoreOf(tile, sx, sy) ||
            nearShoreOf(tile, target.x, target.y)
        : (tile) => campaignTilePassable(tile, factionId, false),
    land = mode !== "sea";
  parent[seed] = seed;
  let best = -1,
    bestApproach = Infinity,
    explored = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor],
      d = approach(current);
    if (d < bestApproach) {
      bestApproach = d;
      best = current;
      if (d <= reach) break;
    }
    if (++explored > 24000) break;
    for (const next of neighbors4(current)) {
      if (parent[next] !== -1 || !passable(next)) continue;
      if (land && cliffBetween(current, next)) continue;
      parent[next] = current;
      queue.push(next);
    }
  }
  if (best < 0 || bestApproach > reach) return [];
  const path = [];
  for (let tile = best, guard = 0; guard <= W.tileCount; tile = parent[tile], guard++) {
    path.push(tile);
    if (parent[tile] === tile) break;
  }
  return path.reverse();
};
// ── Solid bodies: clear of facades, hidden behind faces ───────────────────────
const FACADE_CACHE = { world: null, tick: -1, map: new Map() },
  FACADE_OPEN = new Set(["farm", "corral", "wall"]);
function facadePush(x, y) {
  if (FACADE_CACHE.world !== W || FACADE_CACHE.tick !== W.tick) {
    FACADE_CACHE.world = W;
    FACADE_CACHE.tick = W.tick;
    FACADE_CACHE.map.clear();
  }
  const key = y * W.width + x;
  let push = FACADE_CACHE.map.get(key);
  if (push !== undefined) return push;
  push = null;
  if (typeof standingBuildingAtMovementTile === "function" && !standingBuildingAtMovementTile(x, y)) {
    let dx = 0,
      dy = 0;
    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + ox,
        ny = y + oy;
      if (!inside(nx, ny)) continue;
      const b = standingBuildingAtMovementTile(nx, ny);
      if (!b || FACADE_OPEN.has(b.type)) continue;
      dx -= ox * FACADE_PUSH;
      dy -= oy * FACADE_PUSH;
    }
    if (dx || dy)
      push = { dx: clamp(dx, -FACADE_PUSH, FACADE_PUSH), dy: clamp(dy, -FACADE_PUSH, FACADE_PUSH) };
  }
  FACADE_CACHE.map.set(key, push);
  return push;
}
const visualAnchorSolidBase = visualAnchor;
visualAnchor = function (id, p, m, now) {
  const e = visualAnchorSolidBase(id, p, m, now);
  if (!e || !e.s || !p || !walkerKind(id) || W.components.life[id]?.insideBuildingId) return e;
  const push = facadePush(p.x, p.y);
  if (!push) return e;
  const wx = e.wx + push.dx,
    wy = e.wy + push.dy,
    top = UI.view === "top",
    s0 = projectWithMetrics(e.wx, e.wy, top ? 0 : elevationAtSmooth(e.wx, e.wy), m),
    s1 = projectWithMetrics(wx, wy, top ? 0 : elevationAtSmooth(wx, wy), m);
  return { ...e, wx, wy, s: { x: e.s.x + (s1.x - s0.x), y: e.s.y + (s1.y - s0.y) } };
};
// The neighbours nearer the camera than a tile, in the active projected lens.
function frontOffsets(m) {
  if (UI.view === "iso")
    return [
      [1, 0],
      [0, 1],
    ];
  if (UI.view !== "oblique") return [];
  const q = obliqueBasis(m),
    out = [];
  if (q.s < 0) out.push([1, 0]);
  else if (q.s > 0) out.push([-1, 0]);
  if (q.c > 0) out.push([0, 1]);
  else if (q.c < 0) out.push([0, -1]);
  return out;
}
// The height in pixels of the face a step of this size is drawn with (32b).
function faceDropPx(step) {
  const zoom = UI.camera.zoom,
    scale =
      UI.view === "iso" ? 0.013 * zoom : 0.018 * zoom * (1.12 - cameraTilt() * 0.35),
    maxDrop = Math.max(14, zoom * 3.2);
  return clamp(step * scale, 0, maxDrop);
}
function hiddenBehindFace(x, y, m) {
  if (UI.view === "top" || UI.quality === "low" || UI.camera.zoom <= 0.4) return false;
  const e = W.tiles.elevation,
    here = e[idx(x, y)],
    body = m.tw * 0.3;
  for (const [ox, oy] of frontOffsets(m)) {
    const nx = x + ox,
      ny = y + oy;
    if (!inside(nx, ny)) continue;
    const step = e[idx(nx, ny)] - here;
    if (step > 0 && faceDropPx(step) >= body) return true;
  }
  return false;
}
const sceneEntityVisibleSolidBase = sceneEntityVisible;
sceneEntityVisible = function (id, b) {
  if (!sceneEntityVisibleSolidBase(id, b)) return false;
  if (UI.view === "top" || !walkerKind(id)) return true;
  const p = W.components.position[id];
  return !hiddenBehindFace(p.x, p.y, ACTIVE_RENDER_METRICS || projectionMetrics());
};
window.ALIFE_SOLID_DEBUG = Object.freeze({
  cliffStep: CLIFF_STEP,
  facadePush: FACADE_PUSH,
  overlay: () => ({ ...GROUNDWAYS }),
  reset: () => {
    GROUNDWAYS.segments = 0;
    GROUNDWAYS.tiles = 0;
    GROUNDWAYS.perTile = 0;
  },
  stepBlocked: (id, x, y) => {
    const p = W.components.position[id];
    return !!p && terrainStepBlocked(id, p.x, p.y, x, y);
  },
  cliff: (x0, y0, x1, y1) => cliffBetween(idx(x0, y0), idx(x1, y1)),
  push: (x, y) => facadePush(x, y),
  hidden: (x, y) => hiddenBehindFace(x, y, projectionMetrics()),
  path: (fromTile, target, factionId = 0, mode = "land") =>
    civilPathFind(fromTile, target, factionId, mode),
});
