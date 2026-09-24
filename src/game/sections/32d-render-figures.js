// ═══════════════════════════════════════════════════════════════════════════
// 32d. RENDER — FIGURES: motion smoothing, the camera's glide, creatures, labels
// ═══════════════════════════════════════════════════════════════════════════
// Render-only smoothing of motion and facing, the camera glide and orbit, the
// scene target under the pointer, how a person is dressed and a creature drawn,
// scene entities and their labels, and the procedural entity pass.
// This section was one file of three thousand three hundred lines,
// 32d-spatial-rendering.js, split in six along its own seams on 2026-09-14; the
// composed runtime is unchanged. Everything here reads world state and never
// writes it: visual caches live outside W so the simulation hash and replay
// determinism are untouched by anything drawn.
let VISUAL_MOTION = new Map(),
  INTERIOR_MOTION = new Map(),
  BASH_SHAKE = new Map(),
  VISUAL_MOTION_WORLD = null,
  VISUAL_MOTION_PRUNE_TICK = -1,
  ACTIVE_RENDER_NOW = 0,
  ACTIVE_LIGHT_SCREEN = { x: 0.62, y: 0.5 },
  ACTIVE_TILE_SHADE = null,
  ACTIVE_PREDATION_IDS = new Set();
const CAMERA_GLIDE = { zoom: null, px: null, py: null, angle: null, cx: null, cy: null, last: 0 };
// A step takes as long as the walker waited for it. The clock runs a tick
// every hundred milliseconds at 1× and every four hundred at ¼× (38), and on
// a lean world most lives think and step once in eight ticks (21,
// simulationStrideForTier): a step every 0.8 seconds at 1×, every 3.2 at ¼×.
// The anchor used to ease toward the new tile on a fixed curve, a fifth of a
// second to settle whatever the speed, so at ¼× a figure darted for a fifth
// of a second and stood for three: choppy in exact proportion to how slowly
// the player chose to watch. Now a step is a walk from where the figure was
// to where it is going, over the time since its last step, so it arrives as
// the next step lands and is never seen standing between; the crowd's
// shuffle on a tile still tracks moment to moment, and a step across the map
// or at warp speed is still a jump. A walker shuttling between two tiles
// aims between them instead. The walk's pace is measured against the sim's
// speed (a tile a sim-second is a walk at any speed), so the walking pose
// holds at ¼× as it does at 1×.
const MOTION_GLIDE_MIN = 90,
  MOTION_GLIDE_MAX = 4500;
function worldDirToScreen(dx, dy, m) {
  if (UI.view === "top") return { x: dx * m.tw, y: dy * m.th };
  if (UI.view === "iso") return { x: ((dx - dy) * m.tw) / 2, y: ((dx + dy) * m.th) / 2 };
  const q = obliqueBasis(m);
  return { x: (dx * q.c + dy * q.s) * m.tw, y: (-dx * q.s + dy * q.c) * m.th };
}
function elevationAtSmooth(wx, wy) {
  const gx = clamp(wx - 0.5, 0, W.width - 1),
    gy = clamp(wy - 0.5, 0, W.height - 1),
    x0 = Math.floor(gx),
    y0 = Math.floor(gy),
    x1 = Math.min(W.width - 1, x0 + 1),
    y1 = Math.min(W.height - 1, y0 + 1),
    fx = gx - x0,
    fy = gy - y0,
    e = W.tiles.elevation;
  return (
    ((e[y0 * W.width + x0] * (1 - fx) + e[y0 * W.width + x1] * fx) * (1 - fy) +
      (e[y1 * W.width + x0] * (1 - fx) + e[y1 * W.width + x1] * fx) * fy) /
    1000
  );
}
let VISUAL_CROWD = { frame: -1, groups: new Map() };
function featureVerticalUnit(m) {
  return UI.view === "top"
    ? m.th
    : UI.view === "iso"
      ? m.tw * 0.62
      : m.tw * (1.02 - cameraTilt() * 0.3);
}
function rebuildVisualCrowd(now, bounds) {
  VISUAL_CROWD = {
    frame: now,
    groups: new Map(),
    buildingTiles: new Set(
      W.buildings
        ? W.buildings.filter((b) => b.complete && !b.ruined).map((b) => b.y * W.width + b.x)
        : [],
    ),
  };
  if (
    VISUAL_MOTION_PRUNE_TICK !== W.tick &&
    (W.tick % 128 === 0 || VISUAL_MOTION.size > W.activeIds.length + 128)
  ) {
    const active = new Set(W.activeIds);
    for (const cache of [VISUAL_MOTION, INTERIOR_MOTION, BASH_SHAKE])
      for (const id of cache.keys()) if (!active.has(id)) cache.delete(id);
    VISUAL_MOTION_PRUNE_TICK = W.tick;
  }
  for (const id of W.activeIds) {
    const p = W.components.position[id];
    if (!p || !W.components.genome[id]) continue;
    if (p.x < bounds.x0 - 2 || p.x > bounds.x1 + 2 || p.y < bounds.y0 - 2 || p.y > bounds.y1 + 2)
      continue;
    const key = p.y * W.width + p.x;
    let arr = VISUAL_CROWD.groups.get(key);
    if (!arr) VISUAL_CROWD.groups.set(key, (arr = []));
    arr.push(id);
  }
  for (const arr of VISUAL_CROWD.groups.values()) arr.sort((a, b) => a - b);
}
function creatureSpreadOffset(id, p) {
  const key = p.y * W.width + p.x;
  if (VISUAL_CROWD.buildingTiles?.has(key) && !ACTIVE_INTERIOR_IDS.has(id)) {
    const a = visualHash01(id, 0x91f3) * Math.PI * 2;
    return { x: Math.cos(a) * 0.52, y: Math.sin(a) * 0.44, k: 1 };
  }
  const g = VISUAL_CROWD.groups.get(key),
    k = g ? g.length : 1;
  if (!g || k < 2)
    return {
      x: (visualHash01(id, 0xa5f1) - 0.5) * 0.18,
      y: (visualHash01(id, 0x3bd7) - 0.5) * 0.18,
      k: 1,
    };
  const rank = Math.max(0, g.indexOf(id)),
    rot = visualHash01(p.y * W.width + p.x, 0x77c1) * Math.PI * 2,
    a = rot + (rank * Math.PI * 2) / k,
    rad = Math.min(0.34, 0.13 + 0.045 * k);
  return {
    x: Math.cos(a) * rad + (visualHash01(id, 0xa5f1) - 0.5) * 0.07,
    y: Math.sin(a) * rad * 0.85 + (visualHash01(id, 0x3bd7) - 0.5) * 0.07,
    k,
  };
}
function visualAnchor(id, p, m, now) {
  if (VISUAL_MOTION_WORLD !== W) {
    VISUAL_MOTION = new Map();
    INTERIOR_MOTION = new Map();
    VISUAL_MOTION_WORLD = W;
  }
  const o = creatureSpreadOffset(id, p),
    tx = p.x + 0.5 + o.x,
    ty = p.y + 0.5 + o.y;
  let e = VISUAL_MOTION.get(id);
  if (!e) {
    e = {
      x: tx,
      y: ty,
      heading: visualHash01(id, 0x441) * Math.PI * 2,
      gait: visualHash01(id, 0x72) * Math.PI * 2,
      speed: 0,
      moving: false,
      frame: -1,
      s: null,
      wx: tx,
      wy: ty,
      screenHeading: 0,
      tkey: -1,
      pkey: -1,
      flip: 0,
      last: now,
    };
    VISUAL_MOTION.set(id, e);
  }
  if (e.frame === now && e.s) return e;
  e.crowd = o.k;
  const dt = clamp(now - e.last, 0, 240);
  e.last = now;
  e.frame = now;
  const tkey = p.y * W.width + p.x;
  if (e.tkey !== tkey) {
    e.flip = e.pkey === tkey ? Math.min(6, (e.flip || 0) + 2) : Math.max(0, (e.flip || 0) - 1);
    e.pkey = e.tkey;
    e.tkey = tkey;
  }
  if (e.stepTile !== tkey) {
    // A new tile to walk to: the leg begins where the figure stands and takes
    // as long as it waited since the last leg began.
    const since = e.stepAt == null ? MOTION_GLIDE_MIN : now - e.stepAt;
    e.fromX = e.x;
    e.fromY = e.y;
    e.prevTx = e.stepTile === undefined ? tx : e.legTx;
    e.prevTy = e.stepTile === undefined ? ty : e.legTy;
    e.legTx = tx;
    e.legTy = ty;
    e.glide = clamp(since, MOTION_GLIDE_MIN, MOTION_GLIDE_MAX);
    e.stepAt = now;
    e.stepTile = tkey;
  }
  // A shuttling walker aims between the two tiles rather than at the far one.
  const shuttle = (e.flip || 0) >= 2,
    gx = shuttle ? (tx + (e.prevTx ?? tx)) / 2 : tx,
    gy = shuttle ? (ty + (e.prevTy ?? ty)) / 2 : ty,
    dx = gx - e.x,
    dy = gy - e.y,
    d = Math.hypot(dx, dy);
  let step = 0;
  if (d > 3.4 || UI.speed >= 64) {
    step = Math.min(d, 0.6);
    e.x = gx;
    e.y = gy;
    e.fromX = gx;
    e.fromY = gy;
  } else if (d > 1e-4) {
    const u = e.glide > 0 ? clamp((now - e.stepAt) / e.glide, 0, 1) : 1,
      s = u * u * (3 - 2 * u),
      nx = e.fromX + (gx - e.fromX) * s,
      ny = e.fromY + (gy - e.fromY) * s;
    step = Math.hypot(nx - e.x, ny - e.y);
    e.x = nx;
    e.y = ny;
  }
  if (d > 0.06) {
    const target = Math.atan2(dy, dx),
      turn = ((target - e.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    e.heading += turn * Math.min(1, dt * 0.012);
  }
  e.speed = lerp(e.speed, dt > 0 ? (step / dt) * 1000 : 0, 0.25);
  e.pace = e.speed / clamp(UI.speed, 0.125, 1);
  e.gait += step * 6.2;
  e.moving = e.pace > 0.55;
  const el = UI.view === "top" ? 0 : elevationAtSmooth(e.x, e.y),
    s = projectWithMetrics(e.x, e.y, el, m),
    dir = worldDirToScreen(Math.cos(e.heading), Math.sin(e.heading), m);
  e.s = s;
  e.wx = e.x;
  e.wy = e.y;
  e.screenHeading = Math.atan2(dir.y, dir.x);
  return e;
}
// Two stacked ellipses: a wide faint penumbra and a tighter contact shadow.
// One hard-edged ellipse reads as a sticker under the model; the pair reads as
// a body sitting on ground.
function drawGroundShadow(g, s, r, squash = 0.36, alpha = 0.34) {
  const v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    top = UI.view === "top",
    L = ACTIVE_LIGHT_SCREEN,
    cx = s.x + (top ? 0 : -L.x * r * 0.34),
    cy = s.y + (top ? 0 : r * 0.42 - L.y * r * 0.1),
    base = top ? alpha * 0.5 : alpha;
  if (UI.quality !== "low" && r > 2.6) {
    g.fillStyle = hsl(v.voidHue, 45, 5, base * 0.42);
    g.beginPath();
    g.ellipse(cx, cy, r * 1.55, r * squash * 1.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = hsl(v.voidHue, 45, 4, base);
  g.beginPath();
  g.ellipse(cx, cy, r * 1.08, r * squash, 0, 0, Math.PI * 2);
  g.fill();
}
// Fire is the brightest thing in the world and used to be one opaque teardrop.
// Layered tongues over an additive halo let it actually light its surroundings.
function drawTileFlame(x, y, i, m) {
  const p = proceduralProjectTile(x + 0.5, y + 0.5, m),
    now = ACTIVE_RENDER_NOW,
    f = clamp(W.tiles.fire[i] / 800, 0, 1),
    seed = x * 13 + y * 7,
    flick = 1 + Math.sin(now * 0.011 + seed) * 0.14,
    r = Math.max(1.2, m.tw * 0.18 * (0.5 + f)) * flick,
    detail = UI.quality !== "low" && r > 2.4;
  if (detail) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(p.x, p.y - r * 0.3, 0, p.x, p.y - r * 0.3, r * 3.4);
    halo.addColorStop(0, hsl(32 + f * 18, 96, 58, 0.34 + f * 0.2));
    halo.addColorStop(0.45, hsl(22 + f * 14, 92, 48, 0.13));
    halo.addColorStop(1, hsl(18, 90, 40, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(p.x, p.y - r * 0.3, r * 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const tongue = (scale, lean, hue, sat, light, alpha) => {
    const h = r * scale;
    ctx.fillStyle = hsl(hue, sat, light, alpha);
    ctx.beginPath();
    ctx.moveTo(p.x + lean * r * 0.5, p.y - h * 1.25);
    ctx.quadraticCurveTo(p.x + r * 0.8 * scale, p.y - h * 0.1, p.x, p.y + r * 0.65);
    ctx.quadraticCurveTo(
      p.x - r * 0.75 * scale,
      p.y - h * 0.1,
      p.x + lean * r * 0.5,
      p.y - h * 1.25,
    );
    ctx.fill();
  };
  tongue(1, Math.sin(now * 0.009 + seed) * 0.22, 18 + f * 20, 96, 52, 0.8);
  if (!detail) return;
  tongue(0.66, Math.sin(now * 0.013 + seed * 1.7) * 0.3, 38 + f * 18, 98, 66, 0.85);
  tongue(0.34, Math.sin(now * 0.017 + seed * 2.3) * 0.34, 52 + f * 8, 100, 82, 0.9);
  // Embers rise out of anything more than a smoulder.
  if (UI.quality === "high" && f > 0.35) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let n = 0; n < 3; n++) {
      const t = (now * 0.0007 + visualHash01(i, 0x51 + n)) % 1,
        er = Math.max(0.5, r * 0.14 * (1 - t));
      ctx.fillStyle = hsl(30 + n * 10, 95, 70, (1 - t) * 0.5 * f);
      ctx.beginPath();
      ctx.arc(
        p.x + Math.sin(t * 5.2 + n * 2.1 + seed) * r * 0.7,
        p.y - r * 1.2 - t * r * 2.6,
        er,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }
}
function glideZoomStep(zoom, px, py) {
  const m = projectionMetrics(),
    sx = px ?? m.w / 2,
    sy = py ?? m.h / 2,
    before = cameraWorldAtScreen(sx, sy);
  UI.camera.zoom = clamp(zoom, 0.16, 80);
  const after = cameraWorldAtScreen(sx, sy);
  UI.camera.x += before.x - after.x;
  UI.camera.y += before.y - after.y;
  clampCamera();
  refreshCameraControls();
}
function updateCameraGlide(now) {
  const g = CAMERA_GLIDE,
    dt = clamp(now - (g.last || now), 0, 120);
  g.last = now;
  if (g.zoom != null) {
    const ratio = g.zoom / UI.camera.zoom;
    if (Math.abs(Math.log(ratio)) < 0.004) {
      glideZoomStep(g.zoom, g.px, g.py);
      g.zoom = null;
      g.px = null;
      g.py = null;
    } else
      glideZoomStep(
        UI.camera.zoom * Math.exp(Math.log(ratio) * (1 - Math.exp(-dt * 0.014))),
        g.px,
        g.py,
      );
  }
  if (g.angle != null) {
    if (UI.view !== "oblique") g.angle = null;
    else {
      const diff = ((g.angle - cameraAngle() + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (Math.abs(diff) < 0.002) {
        UI.camera.angle =
          ((((g.angle + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
        g.angle = null;
      } else UI.camera.angle = cameraAngle() + diff * (1 - Math.exp(-dt * 0.012));
      refreshCameraControls();
    }
  }
  if (g.cx != null) {
    if (UI.followId) {
      g.cx = null;
      g.cy = null;
    } else {
      const ddx = g.cx - UI.camera.x,
        ddy = g.cy - UI.camera.y;
      if (Math.hypot(ddx, ddy) < 0.02) {
        UI.camera.x = g.cx;
        UI.camera.y = g.cy;
        g.cx = null;
        g.cy = null;
      } else {
        const f = 1 - Math.exp(-dt * 0.01);
        UI.camera.x += ddx * f;
        UI.camera.y += ddy * f;
      }
      clampCamera();
    }
  }
}
function orbitCameraEased(delta) {
  if (!W) return;
  if (UI.view !== "oblique") setView("oblique");
  CAMERA_GLIDE.angle = (CAMERA_GLIDE.angle ?? cameraAngle()) + delta;
  DOM.tooltip.style.display = "none";
}
let LABEL_HITS = [],
  WAR_LABEL_HITS = [];
function pickSceneTarget(px, py) {
  if (!W) return null;
  for (let n = LABEL_HITS.length - 1; n >= 0; n--) {
    const r = LABEL_HITS[n];
    if (r.id && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return { id: r.id };
  }
  for (let n = WAR_LABEL_HITS.length - 1; n >= 0; n--) {
    const r = WAR_LABEL_HITS[n];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return { id: r.id };
  }
  const m = projectionMetrics(),
    q = UI.view === "oblique" ? obliqueBasis(m) : null,
    dep = (x, y) => (UI.view === "top" ? y : UI.view === "iso" ? x + y : -x * q.s + y * q.c);
  let best = null,
    bestDepth = -Infinity;
  for (const [id, e] of VISUAL_MOTION) {
    if (e.frame !== ACTIVE_RENDER_NOW || !e.s || !W.components.position[id] || !W.kind[id])
      continue;
    const rr = Math.max(UI.mobileMode ? 22 : 9, (e.lastR || 8) * 1.2);
    if (Math.abs(px - e.s.x) > rr * 1.4 || Math.abs(py - e.s.y) > rr * 1.6) continue;
    if (Math.hypot(px - e.s.x, py - e.s.y + (e.lastR || 8) * 0.15) > rr * 1.35) continue;
    const depth = dep(e.wx, e.wy) + id * 1e-7;
    if (depth > bestDepth) {
      bestDepth = depth;
      best = id;
    }
  }
  if (best) return { id: best };
  const tile = pickTile(px, py);
  if (tile >= 0) {
    const b = buildingAtTile(tile);
    if (b) {
      const place = buildingPlace(b);
      if (place?.entityId) return { id: place.entityId };
    }
  }
  return null;
}
function focusHistoryTarget(id, tile = -1) {
  if (!W) return;
  let tx = -1;
  const p = id ? W.components.position[id] : null;
  if (p) tx = idx(p.x, p.y);
  else if (id) {
    const f = W.factions.find((x) => x.entityId === id),
      s = f
        ? W.settlements.find((q) => q.id === f.capitalSettlementId && !q.ruined) ||
          W.settlements.find((q) => q.factionId === f.id && !q.ruined)
        : null;
    if (s) tx = idx(s.x, s.y);
  }
  if (tx < 0 && tile >= 0 && tile < W.tileCount) tx = tile;
  if (tx >= 0) {
    const [x, y] = xy(tx);
    UI.followId = 0;
    CAMERA_GLIDE.cx = p ? p.x + 0.5 : x + 0.5;
    CAMERA_GLIDE.cy = p ? p.y + 0.5 : y + 0.5;
    if (UI.camera.zoom < 2.2) {
      CAMERA_GLIDE.zoom = 2.6;
      CAMERA_GLIDE.px = null;
      CAMERA_GLIDE.py = null;
    }
    refreshCameraControls();
    revealWorldOnPhone();
  }
  if (id && (W.kind[id] || W.historicalIdentities[id])) selectEntity(id);
  else if (tx >= 0) selectTile(tx);
}
// What a person wears: a hue from the culture's defining substance, a style
// hashed per culture so neighbouring peoples dress differently, and the
// faction's colour as a mark at the brow. Bands without a culture go plain.
const CULTURE_DRESS_CACHE = new Map();
function personDress(id, fac) {
  const cultureId = W.components.social[id]?.cultureId || 0,
    key = `${W.seedHash}:${cultureId}`;
  let dress = CULTURE_DRESS_CACHE.get(key);
  if (!dress) {
    const v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
      culture = cultureId ? W.cultures.find((c) => c.id === cultureId) : null;
    dress = {
      hue: culture ? chemistryHue(culture.values.substance, v.accentHue) : v.accentHue,
      style: culture
        ? DRESS_STYLES[hashParts(W.seedHash, "dress", cultureId) % DRESS_STYLES.length]
        : "none",
    };
    if (CULTURE_DRESS_CACHE.size > 512) CULTURE_DRESS_CACHE.clear();
    CULTURE_DRESS_CACHE.set(key, dress);
  }
  return { hue: dress.hue, style: dress.style, faction: fac?.color || null };
}
function drawCreatureGlyph(
  g,
  id,
  s,
  now,
  fac = null,
  scaleOverride = 0,
  portrait = false,
  motion = null,
) {
  const ph = peekPhenotype(id),
    life = W.components.life[id],
    m = embodiedVisualModel(id, creatureModel(id)),
    corpse = W.kind[id] === KINDS.CORPSE,
    qualityDetail =
      portrait || (UI.quality === "high" && UI.camera.zoom > 1.25) || UI.camera.zoom > 2.5
        ? 2
        : UI.camera.zoom > 0.62
          ? 1
          : 0,
    r =
      scaleOverride ||
      Math.max(
        2.2,
        (ACTIVE_RENDER_METRICS || projectionMetrics()).tw *
          (0.05 + 0.042 * clamp(ph.size, 0.35, 1.8)),
      ) * (motion?.crowd > 1 ? 1 / (1 + 0.1 * Math.min(motion.crowd - 1, 4)) : 1),
    individual =
      (visualHash01(id, 0x91d) - 0.5) *
      (Number.isFinite(m.individualVariation) ? m.individualVariation : 0) *
      120,
    primary = corpse ? hsl(m.primaryHue, 11, 27) : hsl(m.primaryHue + individual, m.sat, m.light),
    secondary = corpse
      ? hsl(m.secondaryHue, 10, 20)
      : hsl(
          m.secondaryHue + individual * 0.35,
          clamp(m.sat - 7, 35, 72),
          clamp(m.light + 8, 38, 70),
        ),
    accent = corpse ? hsl(m.accentHue, 8, 32) : hsl(m.accentHue, 75, m.glow ? 68 : 58),
    outline = fac?.color || hsl(m.primaryHue, 31, 10),
    dress = !corpse && W.kind[id] === KINDS.PERSON ? personDress(id, fac) : null,
    phase = motion
      ? corpse
        ? motion.gait
        : motion.gait + Math.sin(now * 0.0011 + (id % 97)) * 0.07
      : now * 0.0022 * (0.55 + ph.speed) + visualHash01(id, 0x72) * Math.PI * 2,
    uprightBody = m.topology === "upright" || m.topology === "floater",
    restAngle = visualHash01(id, 0x441) * Math.PI * 2,
    angle = portrait
      ? 0
      : corpse
        ? restAngle
        : uprightBody
          ? 0
          : m.topology === "radial"
            ? restAngle + (motion ? motion.gait * 0.15 : Math.sin(phase * 0.23) * 0.12)
            : motion
              ? motion.screenHeading + (motion.moving ? Math.sin(motion.gait) * 0.05 : 0)
              : restAngle + Math.sin(phase * 0.23) * 0.12,
    lean =
      uprightBody && motion && motion.moving
        ? clamp(Math.cos(motion.screenHeading), -1, 1) * 0.09
        : 0,
    flip = uprightBody && motion && Math.cos(motion.screenHeading) < -0.25 ? -1 : 1,
    hover =
      !corpse && !portrait && !scaleOverride && m.topology === "floater"
        ? r * (0.5 + Math.sin(now * 0.0016 + (id % 53)) * 0.14)
        : 0;
  if (motion) motion.lastR = r;
  if (!portrait && !scaleOverride && r < 3.4) {
    g.fillStyle = primary;
    g.strokeStyle = outline;
    g.lineWidth = 0.8;
    g.beginPath();
    g.ellipse(s.x, s.y, r * 1.15, r * 0.85, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (!corpse && W.kind[id] === KINDS.PREDATOR) {
      g.strokeStyle = hsl(4, 85, 58, 0.75);
      g.lineWidth = 0.9;
      g.beginPath();
      g.ellipse(s.x, s.y, r * 1.5, r * 1.1, 0, 0, Math.PI * 2);
      g.stroke();
    }
    drawEmotionGlyph(g, id, s, r, now, portrait);
    return r;
  }
  g.save();
  drawGroundShadow(
    g,
    s,
    r * (corpse ? 0.92 : 1) * (hover ? 0.78 : 1),
    corpse ? 0.3 : hover ? 0.24 : 0.36,
    corpse ? 0.24 : hover ? 0.2 : 0.34,
  );
  g.translate(s.x, s.y - hover);
  g.rotate(angle + (corpse ? 0.55 : 0) + lean);
  if (corpse) g.scale(1, 0.48);
  g.scale(r * flip, r);
  if (motion && motion.moving && !corpse) {
    const bounce = Math.sin(motion.gait * 2) * 0.045;
    g.scale(1 + bounce, 1 - bounce);
  } else if (motion && !corpse && UI.quality !== "low" && !ACTIVE_REDUCED_MOTION) {
    // Standing bodies still breathe, and a feeding animal dips as it grazes.
    const breath = Math.sin(now * 0.0024 + (id % 31)) * 0.022,
      feeding = life?.behavior === "food" || life?.behavior === "graze",
      dip = feeding ? Math.max(0, Math.sin(now * 0.005 + (id % 23))) * 0.06 : 0;
    g.scale(1 + breath, 1 - breath * 0.6 + dip);
  }
  drawCreatureModelShape(g, m, phase, qualityDetail, {
    primary,
    secondary,
    accent,
    outline,
    dress,
  });
  drawLostLimbStumps(g, id, m, qualityDetail, { primary, secondary, accent, outline });
  g.restore();
  if (!corpse && W.kind[id] === KINDS.PREDATOR) {
    const hunting = !!W.components.life[id]?.preyTargetId,
      pulse = hunting ? 0.5 + 0.5 * Math.sin(now * 0.012 + (id % 17)) : 0;
    g.strokeStyle = hsl(4, 85, 58, hunting ? 0.55 + 0.4 * pulse : 0.4);
    g.lineWidth = hunting ? 1.8 : 1.1;
    g.beginPath();
    g.ellipse(
      s.x,
      s.y + r * 0.34 - hover,
      r * (1.3 + pulse * 0.35),
      r * (0.52 + pulse * 0.14),
      0,
      0,
      Math.PI * 2,
    );
    g.stroke();
  }
  if (life?.infected) {
    g.fillStyle = hsl(294, 72, 67, 0.9);
    g.beginPath();
    g.arc(s.x + r * 0.68, s.y - r * 0.57 - hover, Math.max(1, r * 0.2), 0, Math.PI * 2);
    g.fill();
  }
  if (life?.wounded) {
    g.strokeStyle = "#f06b62";
    g.lineWidth = Math.max(1.2, r * 0.05);
    g.beginPath();
    g.moveTo(s.x - r * 0.75, s.y - r * 0.65 - hover);
    g.lineTo(s.x + r * 0.72, s.y + r * 0.64 - hover);
    g.stroke();
  }
  drawEmotionGlyph(g, id, s, r, now, portrait);
  return r;
}
function sceneEntityVisible(id, b) {
  const p = W.components.position[id],
    k = W.kind[id],
    insideBuildingId = W.components.life[id]?.insideBuildingId || 0,
    insideStandingBuilding =
      insideBuildingId &&
      W.buildings.some(
        (building) =>
          building.id === insideBuildingId &&
          building.complete &&
          !building.ruined &&
          building.integrity > 0,
      );
  return (
    !!p &&
    !insideStandingBuilding &&
    !ACTIVE_INTERIOR_IDS.has(id) &&
    !ACTIVE_PREDATION_IDS.has(id) &&
    k !== "faction" &&
    k !== "culture" &&
    p.x >= b.x0 - 2 &&
    p.x <= b.x1 + 2 &&
    p.y >= b.y0 - 2 &&
    p.y <= b.y1 + 2
  );
}
function drawSceneEntity(id, now, m, v, labels) {
  const p = W.components.position[id],
    k = W.kind[id],
    ident = W.components.identity[id] || {},
    social = W.components.social[id],
    fac = social?.factionId ? W.factions.find((f) => f.id === social.factionId) : null;
  if (k === KINDS.SETTLEMENT || k === KINDS.CAMP || k === "ruin") {
    const s = proceduralProjectTile(p.x + 0.5, p.y + 0.5, m);
    drawPlace(id, k, s);
    const place =
      W.settlements.find((q) => q.entityId === id) || W.camps.find((q) => q.entityId === id);
    if (UI.labels && place)
      labels.push({
        x: s.x,
        y: s.y - 12,
        text: place.name,
        color: k === "ruin" ? hsl(v.mineralHue, 18, 58) : hsl(v.accentHue, 55, 76),
        priority: 3,
        ax: s.x,
        ay: s.y - 4,
        id,
      });
    return;
  }
  if (k === KINDS.ARTIFACT) {
    const s = proceduralProjectTile(p.x + 0.5, p.y + 0.5, m),
      ar = Math.max(2.7, m.tw * 0.16);
    ctx.fillStyle = hsl(v.accentHue, 75, 67);
    ctx.beginPath();
    for (let n = 0; n < 10; n++) {
      const a = (n * Math.PI) / 5,
        r = n % 2 ? ar * 0.4 : ar;
      n
        ? ctx.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r)
        : ctx.moveTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (!W.components.genome[id]) return;
  const motion = visualAnchor(id, p, m, now),
    s = motion.s,
    rr = drawCreatureGlyph(ctx, id, s, now, fac, 0, false, motion),
    legend = ident.legendary,
    followed = UI.followId === id;
  if (k === KINDS.PERSON) {
    const ti = idx(p.x, p.y);
    if (W.tiles.liquid[ti] > 140) {
      const boat = !!(social?.factionId && factionHasTech(social.factionId, "navigation"));
      if (boat && W.tiles.liquid[ti] > 420) {
        const ship =
            factionHasTech(social.factionId, "logistics") ||
            factionHasTech(social.factionId, "waterworks") ||
            factionHasTech(social.factionId, "mechanization"),
          hs = ship ? 1.65 : 1;
        ctx.fillStyle = hsl(v.mineralHue, 38, 30);
        ctx.strokeStyle = hsl(v.mineralHue, 30, 16);
        ctx.lineWidth = Math.max(1, rr * 0.12);
        ctx.beginPath();
        ctx.moveTo(s.x - rr * 1.5 * hs, s.y + rr * 0.35);
        ctx.quadraticCurveTo(s.x, s.y + rr * 1.3 * hs, s.x + rr * 1.5 * hs, s.y + rr * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (ship) {
          ctx.strokeStyle = hsl(v.mineralHue, 30, 20);
          ctx.lineWidth = Math.max(1, rr * 0.1);
          ctx.beginPath();
          ctx.moveTo(s.x + rr * 0.6, s.y + rr * 0.3);
          ctx.lineTo(s.x + rr * 0.6, s.y - rr * 2.2);
          ctx.stroke();
          ctx.fillStyle = fac?.color ? fac.color : hsl(v.accentHue, 45, 72, 0.9);
          ctx.beginPath();
          ctx.moveTo(s.x + rr * 0.6, s.y - rr * 2.2);
          ctx.quadraticCurveTo(s.x - rr * 0.9, s.y - rr * 1.5, s.x + rr * 0.55, s.y - rr * 0.7);
          ctx.closePath();
          ctx.fill();
        }
        if (motion.moving) {
          ctx.strokeStyle = hsl(v.liquidHue, 60, 76, 0.5);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(s.x - rr * 1.7 * hs, s.y + rr * 0.6);
          ctx.lineTo(s.x - rr * 2.6 * hs, s.y + rr * 0.9);
          ctx.moveTo(s.x + rr * 1.7 * hs, s.y + rr * 0.6);
          ctx.lineTo(s.x + rr * 2.6 * hs, s.y + rr * 0.9);
          ctx.stroke();
        }
      } else if (W.tiles.liquid[ti] > WATER_DEPTH.DEEP) {
        const rip = (now * 0.006 + (id % 37)) % 1;
        ctx.strokeStyle = hsl(v.liquidHue, 70, 72, 0.7 * (1 - rip));
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y + rr * 0.3, rr * (0.6 + rip * 1.4), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = hsl(v.liquidHue, 65, 46, 0.45);
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + rr * 0.28, rr * 1.15, rr * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  if (followed) {
    ctx.strokeStyle = "#f2d276";
    ctx.lineWidth = Math.max(1.6, rr * 0.07);
    ctx.beginPath();
    ctx.arc(s.x, s.y, rr + 4 + Math.sin(now / 260) * 1.4, 0, Math.PI * 2);
    ctx.stroke();
    if (UI.labels)
      labels.push({
        x: s.x,
        y: s.y - rr - 9,
        text: ident.generatedName || entityName(id),
        color: "#f2d276",
        priority: 3,
        ax: s.x,
        ay: s.y - rr * 0.4,
        id,
      });
  } else if (ident.notable && !UI.followId) {
    ctx.strokeStyle = legend ? "#f2d276" : hsl(v.accentHue, 61, 66);
    ctx.lineWidth = Math.max(1.4, rr * 0.05);
    ctx.beginPath();
    ctx.arc(s.x, s.y, rr + 3 + Math.sin(now / 350 + id) * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    if (UI.labels)
      labels.push({
        x: s.x,
        y: s.y - rr - 8,
        text: ident.generatedName,
        color: legend ? "#f2d276" : hsl(v.accentHue, 45, 76),
        priority: legend ? 2 : 1,
        ax: s.x,
        ay: s.y - rr * 0.4,
        id,
      });
  }
}
function drawEntityLabels(labels, v) {
  if (!labels.length || UI.camera.zoom <= 0.55) return;
  ctx.save();
  const px = Math.round(clamp(9 + UI.camera.zoom * 0.55, 10, 13));
  ctx.font = `${px}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  // Seen from far off (a tile under nine pixels), the map names its places and
  // the life being followed; every notable person's name as well buried the
  // towns under a pile of names, worst on a phone.
  const overview = (ACTIVE_RENDER_METRICS || projectionMetrics()).tw < 9,
    order = labels
      .filter((l) => !overview || (l.priority || 0) >= 3)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.y - b.y),
    placed = [];
  let drawn = 0;
  for (const l of order) {
    if (drawn >= 40) break;
    const w = ctx.measureText(l.text).width + 8,
      h = px + 5;
    let y = l.y,
      fits = false;
    for (const dy of [0, -h - 3, h + 12]) {
      const top = l.y + dy - h,
        left = l.x - w / 2;
      if (
        !placed.some((r) => left < r.x + r.w && left + w > r.x && top < r.y + r.h && top + h > r.y)
      ) {
        y = l.y + dy;
        placed.push({ x: left, y: top, w, h });
        fits = true;
        break;
      }
    }
    if (!fits) continue;
    if (Math.abs(y - l.y) > 3 && l.ax != null) {
      ctx.strokeStyle = hsl(v.accentHue, 45, 72, 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(l.ax, l.ay);
      ctx.lineTo(l.x, y + 1);
      ctx.stroke();
    }
    if (l.id) LABEL_HITS.push({ x: l.x - w / 2, y: y - h, w, h, id: l.id });
    ctx.fillStyle = hsl(v.voidHue, 55, 5, 0.84);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(l.x - w / 2, y - h, w, h, 4);
    else ctx.rect(l.x - w / 2, y - h, w, h);
    ctx.fill();
    ctx.fillStyle = l.color;
    ctx.fillText(l.text, l.x, y - 2);
    drawn++;
  }
  ctx.restore();
}
function drawEntitiesProcedural(now, b) {
  const labels = [],
    v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    ids = W.activeIds
      .filter((id) => sceneEntityVisible(id, b))
      .sort((a, c) => {
        const ap = W.components.position[a],
          cp = W.components.position[c];
        return ap.y - cp.y || ap.x - cp.x || a - c;
      });
  for (const id of ids) {
    drawSceneEntity(id, now, m, v, labels);
  }
  drawEntityLabels(labels, v);
}
