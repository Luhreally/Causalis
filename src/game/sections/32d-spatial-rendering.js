// ═══════════════════════════════════════════════════════════════════════════
// 32C½. SPATIAL COHERENCE LAYER — render-only smoothing, facing, depth sorting.
// Reads world state, never writes it: visual caches live outside W so the
// simulation hash and replay determinism are untouched by anything here.
// ═══════════════════════════════════════════════════════════════════════════
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
  const dx = tx - e.x,
    dy = ty - e.y,
    d = Math.hypot(dx, dy);
  let step = 0;
  if (d > 3.4 || UI.speed >= 64) {
    step = Math.min(d, 0.6);
    e.x = tx;
    e.y = ty;
  } else if (d > 1e-4) {
    const f =
      (1 - Math.exp(-dt * (0.004 + 0.0009 * Math.min(UI.speed, 16)))) / (1 + (e.flip || 0) * 0.9);
    e.x += dx * f;
    e.y += dy * f;
    step = d * f;
  }
  if (d > 0.06) {
    const target = Math.atan2(dy, dx),
      turn = ((target - e.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    e.heading += turn * Math.min(1, dt * 0.012);
  }
  e.speed = lerp(e.speed, dt > 0 ? (step / dt) * 1000 : 0, 0.25);
  e.gait += step * 6.2;
  e.moving = e.speed > 0.55;
  const el = UI.view === "top" ? 0 : elevationAtSmooth(e.x, e.y),
    s = projectWithMetrics(e.x, e.y, el, m),
    dir = worldDirToScreen(Math.cos(e.heading), Math.sin(e.heading), m);
  e.s = s;
  e.wx = e.x;
  e.wy = e.y;
  e.screenHeading = Math.atan2(dir.y, dir.x);
  return e;
}
function drawGroundShadow(g, s, r, squash = 0.36, alpha = 0.34) {
  const v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    top = UI.view === "top",
    L = ACTIVE_LIGHT_SCREEN;
  g.fillStyle = hsl(v.voidHue, 45, 4, top ? alpha * 0.5 : alpha);
  g.beginPath();
  g.ellipse(
    s.x + (top ? 0 : -L.x * r * 0.34),
    s.y + (top ? 0 : r * 0.42 - L.y * r * 0.1),
    r * 1.08,
    r * squash,
    0,
    0,
    Math.PI * 2,
  );
  g.fill();
}
function drawTileFlame(x, y, i, m) {
  const p = proceduralProjectTile(x + 0.5, y + 0.5, m),
    f = clamp(W.tiles.fire[i] / 800, 0, 1),
    flick = 1 + Math.sin(ACTIVE_RENDER_NOW * 0.011 + (x * 13 + y * 7)) * 0.14,
    r = Math.max(1.2, m.tw * 0.18 * (0.5 + f)) * flick;
  ctx.fillStyle = hsl(18 + f * 34, 96, 60, 0.82);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - r * 1.25);
  ctx.quadraticCurveTo(p.x + r * 0.8, p.y - r * 0.1, p.x, p.y + r * 0.65);
  ctx.quadraticCurveTo(p.x - r * 0.75, p.y - r * 0.1, p.x, p.y - r * 1.25);
  ctx.fill();
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
  }
  if (id && (W.kind[id] || W.historicalIdentities[id])) selectEntity(id);
  else if (tx >= 0) selectTile(tx);
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
  }
  drawCreatureModelShape(g, m, phase, qualityDetail, { primary, secondary, accent, outline });
  drawLostLimbStumps(g, id, m, qualityDetail, { primary, secondary, accent, outline });
  g.restore();
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
      } else if (W.tiles.liquid[ti] > 820) {
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
  const order = labels.slice().sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.y - b.y),
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
drawEntities = drawEntitiesProcedural;

// Constructed society is a world layer. Places are labels and hearths; their
// actual shelters, workspaces, walls, and roofs are rendered from build state.
function buildingPalette(b) {
  const dominant = Array.from(b.composition)
      .map((v, sp) => ({ v, sp }))
      .sort((a, c) => c.v - a.v || a.sp - c.sp)[0],
    sp = dominant?.v ? dominant.sp : (b.requirements[0]?.[0] ?? C.MINERAL),
    place = buildingPlace(b),
    faction = place?.factionId
      ? W.factions.find((candidate) => candidate.id === place.factionId)
      : null,
    factionHueMatch = String(faction?.color || "").match(/hsl\(\s*(-?[\d.]+)/i),
    factionHue = factionHueMatch ? Number(factionHueMatch[1]) : null,
    materialHue =
      (W.definitions.species[sp]?.colorHue || ACTIVE_PLANET_VISUAL?.mineralHue || 42) +
      (b.architecture?.paletteShift || 0),
    hue = wrapHue(
      factionHue == null ? materialHue : mixHue(materialHue, factionHue, b.ruined ? 0.08 : 0.25),
    ),
    m = materialTrait(sp);
  return {
    sp,
    base: hsl(hue, clamp(38 + m.hardness * 22, 35, 72), clamp(36 + (1 - m.density) * 17, 32, 61)),
    light: hsl(
      hue + 8,
      clamp(42 + m.hardness * 20, 38, 76),
      clamp(52 + (1 - m.brittleness) * 12, 48, 70),
    ),
    dark: hsl(hue - 6, 38, 20),
    accent: faction?.color || hsl(ACTIVE_PLANET_VISUAL?.accentHue || hue + 120, 68, 63),
  };
}
function buildingScreenSize(b, m) {
  const scale =
    b.type === "hall" || b.type === "waterworks"
      ? 1.35
      : b.type === "wall"
        ? 1.25
        : b.type === "corral"
          ? 2.05
          : b.type === "shelter"
            ? 1.05
            : 0.86;
  return Math.max(3.5, m.tw * 0.62 * scale);
}
function buildingFootprintPoints(s, r, view) {
  if (view === "top")
    return [
      [s.x - r, s.y - r * 0.7],
      [s.x + r, s.y - r * 0.7],
      [s.x + r, s.y + r * 0.7],
      [s.x - r, s.y + r * 0.7],
    ];
  if (view === "iso")
    return [
      [s.x, s.y - r * 0.62],
      [s.x + r, s.y],
      [s.x, s.y + r * 0.62],
      [s.x - r, s.y],
    ];
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    q = obliqueBasis(m),
    scale = (r * 0.72) / m.tw,
    vx = [q.xx * scale, q.xy * scale],
    vy = [q.yx * scale, q.yy * scale];
  return [
    [s.x - vx[0] - vy[0], s.y - vx[1] - vy[1]],
    [s.x + vx[0] - vy[0], s.y + vx[1] - vy[1]],
    [s.x + vx[0] + vy[0], s.y + vx[1] + vy[1]],
    [s.x - vx[0] + vy[0], s.y - vx[1] + vy[1]],
  ];
}
function buildingTileFootprintPoints(building, metrics, span = 3) {
  const half = span / 2,
    centerX = building.x + 0.5,
    centerY = building.y + 0.5,
    elevation = W.tiles.elevation[idx(building.x, building.y)] / 1000;
  return [
    projectWithMetrics(centerX - half, centerY - half, elevation, metrics),
    projectWithMetrics(centerX + half, centerY - half, elevation, metrics),
    projectWithMetrics(centerX + half, centerY + half, elevation, metrics),
    projectWithMetrics(centerX - half, centerY + half, elevation, metrics),
  ].map((point) => [point.x, point.y]);
}
function drawBuildingFootprint(
  g,
  s,
  r,
  view,
  fill,
  stroke,
  dashed = false,
  footprintPoints = null,
) {
  const points = footprintPoints || buildingFootprintPoints(s, r, view);
  g.save();
  g.fillStyle = fill;
  g.strokeStyle = stroke;
  g.lineWidth = Math.max(1, r * 0.09);
  if (dashed) g.setLineDash([Math.max(2, r * 0.28), Math.max(2, r * 0.18)]);
  g.beginPath();
  g.moveTo(points[0][0], points[0][1]);
  for (let n = 1; n < points.length; n++) g.lineTo(points[n][0], points[n][1]);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}
function drawBuildingSite(g, b, now, m) {
  const s = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m),
    r = buildingScreenSize(b, m),
    p = buildingPalette(b),
    material = buildingMaterialRatio(b),
    work = clamp(b.workDone / b.workRequired, 0, 1),
    stage = b.complete ? 6 : b.stage;
  g.save();
  if (b.type === "corral" && stage >= 2) {
    const completion = b.complete ? 1 : clamp(work, 0.18, 1),
      points = buildingTileFootprintPoints(b, m, 3),
      gateSide = b.orientation % 4,
      builtSides = Math.max(1, Math.ceil(completion * 4));
    drawBuildingFootprint(g, s, r, UI.view, hsl(95, 34, 28, 0.12), p.dark, false, points);
    g.strokeStyle = p.light;
    g.fillStyle = p.base;
    g.lineWidth = Math.max(1.4, r * 0.1);
    g.lineCap = "round";
    for (let side = 0; side < builtSides; side++) {
      const from = points[side],
        to = points[(side + 1) % 4],
        gate = b.complete && side === gateSide,
        segments = gate
          ? [
              [0, 0.38],
              [0.62, 1],
            ]
          : [[0, 1]];
      for (const [start, end] of segments) {
        g.beginPath();
        g.moveTo(lerp(from[0], to[0], start), lerp(from[1], to[1], start));
        g.lineTo(lerp(from[0], to[0], end), lerp(from[1], to[1], end));
        g.stroke();
      }
      if (gate) {
        g.save();
        g.strokeStyle = p.accent;
        g.lineWidth = Math.max(1.2, r * 0.075);
        g.beginPath();
        g.moveTo(lerp(from[0], to[0], 0.38), lerp(from[1], to[1], 0.38));
        g.lineTo(lerp(from[0], to[0], 0.62), lerp(from[1], to[1], 0.62));
        g.stroke();
        g.restore();
      }
      for (const t of [0, 0.5, 1]) {
        if (gate && t === 0.5) continue;
        const x = lerp(from[0], to[0], t),
          y = lerp(from[1], to[1], t),
          post = Math.max(2, r * 0.17);
        g.fillRect(x - post * 0.25, y - post, post * 0.5, post * 1.25);
      }
    }
    g.restore();
    return;
  }
  if (stage === 0) {
    drawBuildingFootprint(
      g,
      s,
      r,
      UI.view,
      hsl(W.terrainGenome?.baseHue || 35, 15, 28, 0.12),
      p.accent,
      true,
    );
    g.fillStyle = p.accent;
    g.globalAlpha = 0.75;
    const peg = Math.max(2, r * 0.12);
    for (let n = 0; n < 4; n++) {
      const x = s.x + (n < 2 ? -1 : 1) * r,
        y = s.y + (n % 2 ? 1 : -1) * r * 0.7;
      g.fillRect(x - peg * 0.5, y - peg, peg, peg * 2);
    }
    g.restore();
    return;
  }
  drawBuildingFootprint(g, s, r, UI.view, p.dark, p.light, false);
  if (stage === 1) {
    const piles = Math.max(1, Math.ceil(material * 5));
    for (let n = 0; n < piles; n++) {
      const ox = (visualHash01(b.styleSeed, n) - 0.5) * r * 1.3,
        oy = (visualHash01(b.styleSeed ^ 0x71, n) - 0.5) * r * 0.65;
      g.fillStyle = n % 2 ? p.base : p.light;
      g.beginPath();
      g.arc(s.x + ox, s.y + oy, Math.max(1, r * 0.17), 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    return;
  }
  g.fillStyle = p.base;
  g.globalAlpha = 0.9;
  const floorH = Math.max(2, r * 0.18);
  g.fillRect(s.x - r * 0.88, s.y + r * 0.35 - floorH, r * 1.76, floorH);
  const frameProgress = clamp(work * 4, 0, 1),
    wallProgress = clamp(work * 4 - 1, 0, 1),
    roofProgress = clamp(work * 4 - 2.7, 0, 1),
    posts = [
      [-0.82, -0.48],
      [0.82, -0.48],
      [-0.82, 0.48],
      [0.82, 0.48],
    ];
  g.strokeStyle = p.light;
  g.lineWidth = Math.max(1.2, r * 0.12);
  g.lineCap = "square";
  for (let n = 0; n < Math.ceil(posts.length * frameProgress); n++) {
    const [ox, oy] = posts[n];
    g.beginPath();
    g.moveTo(s.x + ox * r, s.y + oy * r * 0.7);
    g.lineTo(s.x + ox * r, s.y + oy * r * 0.7 - r * (0.55 + 0.12 * (n % 2)));
    g.stroke();
  }
  if (frameProgress > 0.35) {
    g.beginPath();
    g.moveTo(s.x - r * 0.82, s.y - r * 0.74);
    g.lineTo(s.x + r * 0.82, s.y - r * 0.74);
    g.stroke();
  }
  if (wallProgress > 0) {
    const segments = 8,
      count = Math.ceil(segments * wallProgress);
    g.fillStyle = p.base;
    g.strokeStyle = p.dark;
    g.lineWidth = 1;
    for (let n = 0; n < count; n++) {
      const side = Math.floor(n / 2),
        along = ((n % 2) - 0.5) * r * 0.78;
      let x = s.x,
        y = s.y;
      if (side === 0) {
        x += along;
        y -= r * 0.38;
      } else if (side === 1) {
        x += r * 0.72;
        y += along * 0.52;
      } else if (side === 2) {
        x += along;
        y += r * 0.38;
      } else {
        x -= r * 0.72;
        y += along * 0.52;
      }
      g.fillRect(x - r * 0.22, y - r * 0.22, r * 0.44, r * 0.35);
      g.strokeRect(x - r * 0.22, y - r * 0.22, r * 0.44, r * 0.35);
    }
  }
  if (roofProgress > 0 || b.complete) {
    g.globalAlpha = clamp(roofProgress + (b.complete ? 1 : 0), 0.12, 1);
    g.fillStyle = p.light;
    g.strokeStyle = p.dark;
    g.lineWidth = 1.2;
    g.beginPath();
    if (b.architecture?.roofForm === "membrane" || b.architecture?.layout === "radial") {
      g.ellipse(s.x, s.y - r * 0.45, r * 0.94, r * 0.48, 0, 0, Math.PI * 2);
    } else {
      g.moveTo(s.x - r, s.y - r * 0.42);
      g.lineTo(s.x, s.y - r * (1.08 + 0.12 * Math.sin(b.styleSeed)));
      g.lineTo(s.x + r, s.y - r * 0.42);
      g.lineTo(s.x + r * 0.72, s.y - r * 0.12);
      g.lineTo(s.x - r * 0.72, s.y - r * 0.12);
      g.closePath();
    }
    g.fill();
    g.stroke();
  }
  if (b.type === "hearth" && b.complete) {
    const flicker = 0.65 + 0.35 * Math.sin(now * 0.009 + b.id);
    g.fillStyle = hsl(31, 95, 58, 0.8);
    g.beginPath();
    g.arc(s.x, s.y - r * 0.2, Math.max(1.4, r * 0.15 * flicker), 0, Math.PI * 2);
    g.fill();
  }
  if (b.type === "wall" && b.complete) {
    g.strokeStyle = p.light;
    g.lineWidth = Math.max(2, r * 0.35);
    g.beginPath();
    g.moveTo(s.x - r, s.y);
    g.lineTo(s.x + r, s.y);
    g.stroke();
  }
  g.restore();
}
const drawBuildingSiteCompleteBase = drawBuildingSite;
drawBuildingSite = function (g, b, now, m) {
  if (!b.ruined) return drawBuildingSiteCompleteBase(g, b, now, m);
  const s = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m),
    r = buildingScreenSize(b, m),
    p = buildingPalette(b);
  g.save();
  drawBuildingFootprint(
    g,
    s,
    r,
    UI.view,
    hsl(W.terrainGenome?.baseHue || 35, 10, 18, 0.72),
    hsl(W.terrainGenome?.baseHue || 35, 12, 36),
    false,
  );
  for (let n = 0; n < 7; n++) {
    const ox = (visualHash01(b.styleSeed ^ 0x91, n) - 0.5) * r * 1.55,
      oy = (visualHash01(b.styleSeed ^ 0x37, n) - 0.5) * r * 0.8,
      size = r * (0.12 + visualHash01(b.styleSeed, n) * 0.2);
    g.fillStyle = n % 2 ? p.dark : p.base;
    g.save();
    g.translate(s.x + ox, s.y + oy);
    g.rotate(visualHash01(n, b.styleSeed) * Math.PI);
    g.fillRect(-size, -size * 0.45, size * 2, size * 0.9);
    g.restore();
  }
  g.strokeStyle = p.light;
  g.lineWidth = Math.max(1, r * 0.1);
  g.beginPath();
  g.moveTo(s.x - r * 0.7, s.y - r * 0.1);
  g.lineTo(s.x + r * 0.35, s.y - r * 0.62);
  g.stroke();
  g.restore();
};
const INTERIOR_BUILDING_TYPES = new Set([
  "stockpile",
  "shelter",
  "hearth",
  "workshop",
  "kiln",
  "forge",
  "clinic",
  "archive",
  "hall",
  "waterworks",
]);
function householdGroups(residents) {
  const residentSet = new Set(residents),
    parent = new Map(residents.map((id) => [id, id])),
    find = (id) => {
      let p = parent.get(id);
      while (p !== parent.get(p)) p = parent.get(p);
      let q = id;
      while (parent.get(q) !== p) {
        const next = parent.get(q);
        parent.set(q, p);
        q = next;
      }
      return p;
    },
    join = (a, b) => {
      if (!residentSet.has(a) || !residentSet.has(b)) return;
      const ra = find(a),
        rb = find(b);
      if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb));
    };
  for (const id of residents) {
    const social = W.components.social[id],
      identity = W.components.identity[id];
    if (social?.partnerId) join(id, social.partnerId);
    for (const child of identity?.children || []) join(id, child);
  }
  const groups = new Map();
  for (const id of residents) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  }
  return Array.from(groups.values())
    .map((ids) => ids.sort((a, b) => a - b))
    .sort((a, b) => a[0] - b[0]);
}
function personFitsInterior(id, b, homeId) {
  const life = W.components.life[id],
    work = W.components.work?.[id],
    behavior = life?.behavior || "",
    activeWork = work && work.task !== "idle" && W.tick - work.handledTick <= 12;
  if (life?.wounded || life?.infected) return b.type === "clinic" || b.id === homeId;
  if (activeWork) {
    if (work.buildingId === b.id) return true;
    if (work.task === "craft") return ["workshop", "forge", "kiln", "archive"].includes(b.type);
    if (work.task === "haul") return b.type === "stockpile";
    return false;
  }
  if (behavior === "rest") return b.id === homeId || b.type === "hearth";
  if (behavior === "socialize") return ["hall", "hearth", "shelter"].includes(b.type);
  if (behavior === "food" || behavior === "water") return b.type === "hearth";
  return b.id === homeId && peekDerivedLife(id).fatigue > 35;
}
function makeInteriorState(bounds) {
  const state = {
      visible: new Set(),
      inside: new Map(),
      homes: new Map(),
      homeByPerson: new Map(),
      households: new Map(),
    },
    enabled = !!UI.camera.cutaway && UI.camera.zoom >= 2.35;
  if (!enabled) return state;
  const visible = W.buildings.filter(
    (b) =>
      b.complete &&
      !b.ruined &&
      INTERIOR_BUILDING_TYPES.has(b.type) &&
      b.x >= bounds.x0 - 2 &&
      b.x <= bounds.x1 + 2 &&
      b.y >= bounds.y0 - 2 &&
      b.y <= bounds.y1 + 2,
  );
  for (const b of visible) {
    state.visible.add(b.id);
    state.inside.set(b.id, []);
    state.homes.set(b.id, []);
  }
  const places = new Map();
  for (const b of visible) {
    const key = `${b.placeKind}:${b.placeId}`;
    if (!places.has(key)) places.set(key, buildingPlace(b));
  }
  for (const place of places.values()) {
    if (!place) continue;
    const residents = localPlaceWorkers(place),
      shelters = completedBuildings(place)
        .filter((b) => b.housing > 0)
        .sort((a, b) => a.id - b.id);
    for (const group of householdGroups(residents)) {
      state.households.set(group[0], group.slice());
      let cursor = 0;
      for (const id of group) {
        let attempts = 0;
        while (shelters.length && attempts < shelters.length) {
          const home = shelters[cursor % shelters.length],
            assigned = state.homes.get(home.id) || [];
          if (assigned.length < Math.max(1, home.housing)) {
            assigned.push(id);
            state.homes.set(home.id, assigned);
            state.homeByPerson.set(id, home.id);
            break;
          }
          cursor++;
          attempts++;
        }
      }
    }
    const interiors = completedBuildings(place).filter((b) => state.visible.has(b.id));
    for (const id of residents) {
      const explicitBuildingId = W.components.life[id]?.insideBuildingId || 0;
      if (explicitBuildingId) {
        const interior = interiors.find((building) => building.id === explicitBuildingId);
        if (interior) {
          state.inside.get(interior.id).push(id);
          ACTIVE_INTERIOR_IDS.add(id);
        }
        continue;
      }
    }
  }
  return state;
}
function drawInteriorFurniture(g, b, s, r, p, homes) {
  const ink = hsl((W.terrainGenome?.baseHue || 35) + 180, 18, 12, 0.86);
  g.strokeStyle = p.dark;
  g.fillStyle = ink;
  g.lineWidth = Math.max(1, r * 0.045);
  const bed = (x, y) => {
    g.fillStyle = p.light;
    g.fillRect(s.x + x * r - r * 0.16, s.y + y * r - r * 0.08, r * 0.32, r * 0.16);
    g.fillStyle = p.accent;
    g.fillRect(s.x + x * r - r * 0.14, s.y + y * r - r * 0.06, r * 0.09, r * 0.12);
  };
  if (b.type === "shelter" || b.type === "clinic") {
    const count = Math.max(2, Math.min(6, homes.length || b.housing || 2));
    for (let n = 0; n < count; n++) bed(((n % 3) - 0.95) * 0.53, (Math.floor(n / 3) - 0.45) * 0.55);
  }
  if (b.type === "hearth" || b.type === "forge" || b.type === "kiln") {
    g.fillStyle = hsl(25, 94, 54, 0.9);
    g.beginPath();
    g.arc(s.x, s.y - r * 0.02, Math.max(2, r * 0.14), 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = p.light;
    g.beginPath();
    g.arc(s.x, s.y - r * 0.02, r * 0.23, 0, Math.PI * 2);
    g.stroke();
  }
  if (["workshop", "forge", "archive"].includes(b.type)) {
    g.fillStyle = p.light;
    g.fillRect(s.x - r * 0.65, s.y - r * 0.1, r * 1.3, r * 0.18);
    g.strokeRect(s.x - r * 0.65, s.y - r * 0.1, r * 1.3, r * 0.18);
    for (let n = 0; n < 4; n++) {
      g.strokeStyle = n % 2 ? p.accent : p.dark;
      g.beginPath();
      g.moveTo(s.x - r * 0.48 + n * r * 0.31, s.y - r * 0.1);
      g.lineTo(s.x - r * 0.36 + n * r * 0.31, s.y - r * 0.36);
      g.stroke();
    }
  }
  if (b.type === "stockpile") {
    for (let n = 0; n < 7; n++) {
      g.fillStyle = n % 2 ? p.base : p.light;
      g.fillRect(
        s.x - r * 0.68 + (n % 4) * r * 0.36,
        s.y - r * 0.36 + Math.floor(n / 4) * r * 0.34,
        r * 0.25,
        r * 0.22,
      );
      g.strokeRect(
        s.x - r * 0.68 + (n % 4) * r * 0.36,
        s.y - r * 0.36 + Math.floor(n / 4) * r * 0.34,
        r * 0.25,
        r * 0.22,
      );
    }
  }
  if (b.type === "hall") {
    g.fillStyle = p.light;
    g.fillRect(s.x - r * 0.64, s.y - r * 0.1, r * 1.28, r * 0.2);
    g.strokeRect(s.x - r * 0.64, s.y - r * 0.1, r * 1.28, r * 0.2);
    g.fillStyle = p.accent;
    g.fillRect(s.x - r * 0.06, s.y - r * 0.65, r * 0.12, r * 0.44);
  }
  g.strokeStyle = p.dark;
  g.beginPath();
  g.moveTo(s.x, s.y - r * 0.54);
  g.lineTo(s.x, s.y + r * 0.46);
  g.stroke();
}
function drawBuildingInterior(g, b, now, m, state) {
  const s = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m),
    r = buildingScreenSize(b, m),
    p = buildingPalette(b),
    inside = state.inside.get(b.id) || [],
    homes = state.homes.get(b.id) || [];
  g.save();
  drawBuildingFootprint(g, s, r, UI.view, p.dark, p.light, false);
  drawBuildingFootprint(
    g,
    s,
    r * 0.88,
    UI.view,
    hsl((W.definitions.species[p.sp]?.colorHue || 40) + 9, 28, 32),
    p.base,
    false,
  );
  g.strokeStyle = p.light;
  g.lineWidth = Math.max(2, r * 0.1);
  g.beginPath();
  g.moveTo(s.x - r * 0.82, s.y - r * 0.43);
  g.lineTo(s.x - r * 0.82, s.y - r * 0.86);
  g.lineTo(s.x + r * 0.82, s.y - r * 0.86);
  g.lineTo(s.x + r * 0.82, s.y - r * 0.43);
  g.stroke();
  drawInteriorFurniture(g, b, s, r, p, homes);
  for (let n = 0; n < inside.length; n++) {
    const id = inside[n],
      life = W.components.life[id],
      work = W.components.work?.[id],
      resting = life?.behavior === "rest",
      crafting = work && work.task === "craft" && W.tick - work.handledTick <= 12,
      scale = clamp(r * 0.115, 2.4, 64),
      fac = W.components.social[id]?.factionId
        ? W.factions.find((f) => f.id === W.components.social[id].factionId)
        : null;
    if (resting && ["shelter", "clinic"].includes(b.type)) {
      const bedCount = Math.max(2, Math.min(6, homes.length || b.housing || 2)),
        bed = n % bedCount,
        bx = s.x + ((bed % 3) - 0.95) * r * 0.53,
        by = s.y + (Math.floor(bed / 3) - 0.45) * r * 0.55;
      g.save();
      g.translate(bx, by);
      g.rotate(1.25);
      g.translate(-bx, -by);
      drawCreatureGlyph(g, id, { x: bx, y: by }, now, fac, scale);
      g.restore();
      continue;
    }
    let pos,
      motion2 = null;
    if (crafting) pos = { x: s.x + (n % 2 ? r * 0.32 : -r * 0.32), y: s.y - r * 0.16 };
    else {
      const wp = Math.floor(now / 2400 + visualHash01(id, 0x77) * 9),
        tfx = (visualHash01(id, 0x100 + (wp % 13)) - 0.5) * 1.15,
        tfy = (visualHash01(id, 0x200 + (wp % 13)) - 0.4) * 0.72;
      let e = INTERIOR_MOTION.get(id);
      if (!e || e.fx === undefined) {
        e = { fx: tfx, fy: tfy };
        INTERIOR_MOTION.set(id, e);
      }
      const ddx = tfx - e.fx,
        ddy = tfy - e.fy,
        dd = Math.hypot(ddx, ddy);
      if (dd > 0.045) {
        e.fx += ddx * 0.055;
        e.fy += ddy * 0.055;
        motion2 = {
          gait: now * 0.011 + (id % 17),
          moving: true,
          screenHeading: Math.atan2(ddy, ddx),
        };
      }
      pos = { x: s.x + e.fx * r, y: s.y + e.fy * r };
    }
    drawCreatureGlyph(g, id, pos, now, fac, scale, false, motion2);
    if (crafting) {
      const tap = Math.sin(now * 0.012 + id) * scale * 0.5;
      g.strokeStyle = p.accent;
      g.lineWidth = Math.max(1, scale * 0.2);
      g.beginPath();
      g.moveTo(pos.x + scale * 0.5, pos.y - scale * 0.2 + tap * 0.3);
      g.lineTo(pos.x + scale * 1.1, pos.y + scale * 0.3);
      g.stroke();
    }
    if (UI.camera.zoom > 8 && UI.labels) {
      const name = W.components.identity[id]?.generatedName || `#${id}`;
      g.font = "9px system-ui";
      g.textAlign = "center";
      g.fillStyle = "#eef4e8";
      g.fillText(name, pos.x, pos.y - r * 0.15);
    }
  }
  if (UI.camera.zoom > 4.5) {
    const household = homes.length
        ? `${homes.length} resident${homes.length === 1 ? "" : "s"}`
        : "shared interior",
      activity = inside.length ? `${inside.length} inside` : "unoccupied";
    g.font = "10px system-ui";
    g.textAlign = "center";
    g.fillStyle = "#071016d9";
    g.fillRect(s.x - r * 0.72, s.y + r * 0.52, r * 1.44, 14);
    g.fillStyle = p.light;
    g.fillText(`${b.name} · ${household} · ${activity}`, s.x, s.y + r * 0.63);
  }
  g.restore();
}
function drawBuildingExteriorDetails(g, b, now, m) {
  if (!b.complete || b.ruined || UI.camera.zoom < 2.1) return;
  const s = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m),
    r = buildingScreenSize(b, m),
    p = buildingPalette(b);
  g.save();
  g.fillStyle = p.dark;
  g.fillRect(s.x - r * 0.12, s.y - r * 0.18, r * 0.24, r * 0.48);
  g.fillStyle = hsl(ACTIVE_PLANET_VISUAL?.accentHue || 45, 62, 72, 0.8);
  for (const x of [-0.52, 0.52]) {
    g.fillRect(s.x + x * r - r * 0.09, s.y - r * 0.38, r * 0.18, r * 0.13);
    g.strokeStyle = p.dark;
    g.strokeRect(s.x + x * r - r * 0.09, s.y - r * 0.38, r * 0.18, r * 0.13);
  }
  if (b.integrity < b.maxIntegrity * 0.75) {
    g.fillStyle = "#0b1015bb";
    g.fillRect(s.x - r * 0.6, s.y + r * 0.56, r * 1.2, 4);
    g.fillStyle = b.integrity < b.maxIntegrity * 0.35 ? "#e0645c" : "#d9b56d";
    g.fillRect(
      s.x - r * 0.6,
      s.y + r * 0.56,
      r * 1.2 * clamp(b.integrity / b.maxIntegrity, 0, 1),
      4,
    );
  }
  if (UI.camera.zoom > 7 && UI.labels) {
    g.font = "10px system-ui";
    g.textAlign = "center";
    g.fillStyle = p.light;
    g.fillText(b.name, s.x, s.y - r * 1.18);
  }
  g.restore();
}
const drawBuildingSiteRoofBase = drawBuildingSite;
drawBuildingSite = function (g, b, now, m) {
  const shakeUntil = BASH_SHAKE.get(b.id),
    shaking = shakeUntil && now < shakeUntil;
  if (shakeUntil && !shaking) BASH_SHAKE.delete(b.id);
  if (shaking) {
    const kk = Math.max(1.2, m.tw * 0.028);
    g.save();
    g.translate(Math.sin(now * 0.09 + b.id * 3) * kk, Math.cos(now * 0.11 + b.id) * kk * 0.6);
  }
  if (UI.view !== "top" && !b.ruined && (b.complete || b.stage > 0)) {
    const sh = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m);
    drawGroundShadow(g, sh, buildingScreenSize(b, m) * 1.02, 0.3, 0.24);
  }
  if (ACTIVE_INTERIOR_STATE?.visible.has(b.id))
    drawBuildingInterior(g, b, now, m, ACTIVE_INTERIOR_STATE);
  else {
    drawBuildingSiteRoofBase(g, b, now, m);
    drawBuildingExteriorDetails(g, b, now, m);
  }
  if (shaking) g.restore();
};
function drawConstructedWorld(now, bounds) {
  ACTIVE_INTERIOR_IDS = new Set();
  ACTIVE_INTERIOR_STATE = makeInteriorState(bounds);
  if (!W.buildings?.length) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    visible = W.buildings
      .filter(
        (b) =>
          b.x >= bounds.x0 - 2 &&
          b.x <= bounds.x1 + 2 &&
          b.y >= bounds.y0 - 2 &&
          b.y <= bounds.y1 + 2,
      )
      .map((b) => ({ b, y: proceduralProjectTile(b.x + 0.5, b.y + 0.5, m, false).y }))
      .sort((a, b) => a.y - b.y || a.b.id - b.b.id);
  for (const entry of visible) drawBuildingSite(ctx, entry.b, now, m);
}
function workTargetPosition(w, m) {
  if (w.buildingId) {
    const b = W.buildings.find((x) => x.id === w.buildingId);
    if (b) return proceduralProjectTile(b.x + 0.5, b.y + 0.5, m);
  }
  if (w.targetTile >= 0) {
    const [x, y] = xy(w.targetTile);
    return proceduralProjectTile(x + 0.5, y + 0.5, m);
  }
  return null;
}
function drawWorkerActivity(now, bounds) {
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome();
  let particles = 0;
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON) continue;
    const p = W.components.position[id],
      w = W.components.work?.[id];
    if (
      !p ||
      !w ||
      W.components.life[id]?.insideBuildingId ||
      w.task === "idle" ||
      W.tick - w.handledTick > 12 ||
      p.x < bounds.x0 - 2 ||
      p.x > bounds.x1 + 2 ||
      p.y < bounds.y0 - 2 ||
      p.y > bounds.y1 + 2
    )
      continue;
    const s = visualAnchor(id, p, m, now).s,
      target = workTargetPosition(w, m),
      phase = now * 0.008 + visualHash01(id, w.actionSerial) * Math.PI * 2,
      r = clamp(m.tw * 0.24, 2, 56),
      materialHue = w.materialId >= 0 ? W.definitions.species[w.materialId]?.colorHue : v.accentHue;
    if (w.task === "haul") {
      ctx.fillStyle = hsl(materialHue, 58, 57);
      ctx.strokeStyle = hsl(materialHue, 35, 22);
      ctx.lineWidth = 1;
      ctx.fillRect(s.x - r * 0.65, s.y - r * 1.55, r * 1.3, r * 0.85);
      ctx.strokeRect(s.x - r * 0.65, s.y - r * 1.55, r * 1.3, r * 0.85);
    }
    if (["mine", "cut", "build", "craft", "raze"].includes(w.task)) {
      const hasTool =
        w.task === "raze"
          ? !!w.toolId ||
            (typeof carriedToolForPurpose === "function" && !!carriedToolForPurpose(id, "war"))
          : !!w.toolId;
      if (hasTool) {
        const a = -1.15 + Math.sin(phase) * 0.95,
          len = r * 1.65,
          ex = s.x + Math.cos(a) * len,
          ey = s.y + Math.sin(a) * len;
        ctx.strokeStyle = w.task === "craft" ? hsl(v.accentHue, 75, 67) : "#d8c7a1";
        ctx.lineWidth = Math.max(1.2, r * 0.22);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - r * 0.25);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.fillStyle =
          w.task === "mine" ? "#b9c8cf" : w.task === "cut" ? hsl(materialHue, 63, 62) : "#e7c56e";
        ctx.beginPath();
        ctx.moveTo(ex - r * 0.32, ey - r * 0.12);
        ctx.lineTo(ex + r * 0.34, ey + r * 0.1);
        ctx.lineTo(ex + r * 0.18, ey + r * 0.34);
        ctx.closePath();
        ctx.fill();
      } else {
        const hx = s.x + r * 0.55,
          hy = s.y + r * 0.72,
          ph2 = Math.sin(phase * 2.2);
        ctx.strokeStyle = hsl(materialHue, 32, 62, 0.85);
        ctx.lineWidth = Math.max(1.2, r * 0.15);
        for (let n2 = 0; n2 < 2; n2++) {
          const sway = (n2 ? -1 : 1) * ph2 * r * 0.24;
          ctx.beginPath();
          ctx.moveTo(hx + sway - r * 0.15, hy - r * 0.16);
          ctx.lineTo(hx + sway + r * 0.09, hy + r * 0.1);
          ctx.stroke();
        }
        for (let n2 = 0; n2 < 3; n2++) {
          const cp = (phase * 0.18 + n2 * 0.34) % 1;
          ctx.fillStyle = hsl(materialHue, 70, 60, 0.85 * (1 - cp));
          const cs = Math.max(1.5, r * 0.15);
          ctx.fillRect(
            hx + (visualHash01(id, 0x60 + n2) - 0.5) * r * 1.2 * cp,
            hy - cp * r * 1.1,
            cs,
            cs,
          );
        }
      }
      if (UI.quality === "high" && UI.camera.zoom > 0.8 && target && particles < 48) {
        for (let n = 0; n < 3; n++) {
          const life = (Math.sin(phase + n * 2.1) + 1) / 2,
            px = target.x + (visualHash01(w.actionSerial, n) - 0.5) * r * 1.4,
            py = target.y - r * 0.2 - life * r;
          ctx.fillStyle = hsl(materialHue + n * 9, 75, 68, 0.75);
          const pv = Math.max(1.5, m.tw * 0.02);
          ctx.fillRect(px, py, pv, pv);
          particles++;
        }
      }
    }
    if (w.task === "guard" && UI.camera.zoom > 1.2) {
      ctx.strokeStyle = hsl(v.accentHue, 55, 72, 0.85);
      ctx.lineWidth = Math.max(1.2, r * 0.2);
      ctx.beginPath();
      ctx.moveTo(s.x - r * 0.5, s.y - r * 2.2);
      ctx.lineTo(s.x - r * 0.5, s.y - r * 1.7);
      ctx.quadraticCurveTo(s.x, s.y - r * 1.35, s.x + r * 0.5, s.y - r * 1.7);
      ctx.lineTo(s.x + r * 0.5, s.y - r * 2.2);
      ctx.closePath();
      ctx.stroke();
    } else if (w.task === "march" && UI.camera.zoom > 1.2) {
      const t2 = VISUAL_MOTION.get(id),
        dirX = Math.cos(t2?.screenHeading ?? 0) >= 0 ? 1 : -1;
      ctx.strokeStyle = hsl(v.accentHue, 75, 72, 0.9);
      ctx.lineWidth = Math.max(1.2, r * 0.2);
      for (let n2 = 0; n2 < 2; n2++) {
        const bx = s.x + dirX * r * (0.35 + n2 * 0.55);
        ctx.beginPath();
        ctx.moveTo(bx - dirX * r * 0.3, s.y - r * 2.2);
        ctx.lineTo(bx, s.y - r * 1.95);
        ctx.lineTo(bx - dirX * r * 0.3, s.y - r * 1.7);
        ctx.stroke();
      }
    }
    if ((UI.overlay === "logistics" || UI.selectedEntity === id) && target) {
      const ldx = target.x - s.x,
        ldy = target.y - s.y,
        llen = Math.hypot(ldx, ldy) || 1,
        maxLen = Math.max(m.w, m.h) * 0.45,
        cut = Math.min(1, maxLen / llen),
        ex = s.x + ldx * cut,
        ey = s.y + ldy * cut;
      ctx.save();
      const lg = ctx.createLinearGradient(s.x, s.y, ex, ey);
      lg.addColorStop(0, hsl(v.accentHue, 72, 67, 0.6));
      lg.addColorStop(1, hsl(v.accentHue, 72, 67, cut < 1 ? 0.02 : 0.28));
      ctx.strokeStyle = lg;
      ctx.setLineDash([3, 3]);
      ctx.lineDashOffset = -now * 0.02;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.restore();
    }
  }
}
const drawPlaceMaterialSocietyBase = drawPlace;
drawPlace = function (id, k, s) {
  const place =
    W.settlements.find((q) => q.entityId === id) || W.camps.find((q) => q.entityId === id);
  if (!place) return drawPlaceMaterialSocietyBase(id, k, s);
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    r = Math.max(1.5, m.tw * 0.18);
  ctx.save();
  ctx.fillStyle = k === "ruin" ? hsl(v.mineralHue, 16, 32) : hsl(v.accentHue, 72, 62);
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#081015";
  ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - r);
  ctx.lineTo(s.x, s.y - r * 3);
  ctx.lineTo(s.x + r * 1.7, s.y - r * 2.35);
  ctx.lineTo(s.x, s.y - r * 1.75);
  ctx.stroke();
  ctx.restore();
};
function combatEventWindow() {
  return Math.max(24, Math.round((UI.speed || 1) * 10));
}
function makeCombatVisualState(bounds) {
  const state = { events: [], actors: new Map(), window: combatEventWindow() },
    limit = Math.max(0, W.events.length - 360);
  for (let n = W.events.length - 1; n >= limit; n--) {
    const e = W.events[n],
      age = W.tick - e.tick;
    if (age < 0 || age > state.window) continue;
    const death = e.type === "DeathEvent",
      combat =
        e.type === "InjuryEvent" ||
        e.type === "KillEvent" ||
        (death &&
          (e.evidence || []).some((v) => /war|predation|killed|injur|combat|siege/i.test(v)));
    if (!death && !combat) continue;
    if (e.location < 0) continue;
    const [x, y] = xy(e.location);
    if (x < bounds.x0 - 3 || x > bounds.x1 + 3 || y < bounds.y0 - 3 || y > bounds.y1 + 3) continue;
    state.events.push({ e, age, combat, death, fade: clamp(1 - age / state.window, 0.12, 1) });
    for (let s = 0; s < e.subjects.length; s++) {
      const id = e.subjects[s];
      if (id)
        state.actors.set(id, {
          event: e,
          role:
            e.type === "InjuryEvent"
              ? s
                ? "attacker"
                : "victim"
              : e.type === "KillEvent"
                ? s
                  ? "victim"
                  : "attacker"
                : "fallen",
        });
    }
  }
  state.events.reverse();
  return state;
}
function bloodVisualHue(id = 0) {
  const chemical = W.definitions.species[C.BLOOD]?.colorHue ?? 352;
  if (!id || !W.components.genome[id]) return chemical;
  return mixHue(chemical, creatureModel(id).accentHue, 0.28);
}
function queuePredationVisual(attacker, victim, tile, damage, lethal, eventId, ranged = 0) {
  const ap = W.components.position[attacker],
    vp = W.components.position[victim];
  if (!ap || !vp) return;
  const now = performance.now(),
    styles = ["BITE", "GRAPPLE", "IMPALE", "COIL & TEAR"],
    lineage = W.components.genome[attacker]?.lineageId || attacker,
    style = ranged
      ? ranged === 3
        ? "BURST"
        : "VOLLEY"
      : styles[hashParts(W.seedHash, "attack-form", lineage) % styles.length],
    chemicalHue = W.definitions.species[C.BLOOD]?.colorHue ?? 352,
    bloodHue = wrapHue(
      chemicalHue +
        (hashParts(W.seedHash, "blood-hue", W.components.genome[victim]?.lineageId || victim) %
          41) -
        20,
    );
  UI.combatVisuals = (UI.combatVisuals || [])
    .filter((v) => v.world === W && now - v.started < v.duration)
    .slice(-35);
  UI.combatVisuals.push({
    world: W,
    attacker,
    victim,
    tile,
    damage,
    lethal,
    eventId,
    started: now,
    duration: (lethal ? 2200 : 1600) / Math.max(1, Math.sqrt(UI.speed || 1)),
    ax: ap.x + 0.5,
    ay: ap.y + 0.5,
    vx: vp.x + 0.5,
    vy: vp.y + 0.5,
    bloodHue,
    style,
    ranged,
  });
}
function drawRealtimePredation(now, bounds) {
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    active = (UI.combatVisuals || []).filter((v) => v.world === W && now - v.started < v.duration);
  UI.combatVisuals = active;
  if (!active.length) return;
  ctx.save();
  for (const v of active) {
    const pa = W.components.position[v.attacker],
      pv = W.components.position[v.victim],
      aliveA = !!(pa && W.components.genome[v.attacker]),
      aliveV = !!(pv && W.components.genome[v.victim]),
      vtx = aliveV ? pv.x + 0.5 : v.vx,
      vty = aliveV ? pv.y + 0.5 : v.vy;
    if (vtx < bounds.x0 - 3 || vtx > bounds.x1 + 3 || vty < bounds.y0 - 3 || vty > bounds.y1 + 3)
      continue;
    const t = clamp((now - v.started) / v.duration, 0, 1),
      wind = clamp(t / 0.07, 0, 1),
      strike = clamp((t - 0.07) / 0.15, 0, 1),
      impact = clamp((t - 0.2) / 0.16, 0, 1),
      recoil = clamp((t - 0.5) / 0.34, 0, 1),
      lunge = clamp(0.06 * wind + 0.85 * strike - 0.4 * recoil, 0, 0.92) * (v.ranged ? 0.12 : 1),
      preyKick = impact * (1 - recoil * 0.45),
      As = aliveA ? visualAnchor(v.attacker, pa, m, now).s : proceduralProjectTile(v.ax, v.ay, m),
      Vs = aliveV ? visualAnchor(v.victim, pv, m, now).s : proceduralProjectTile(v.vx, v.vy, m),
      dx = Vs.x - As.x,
      dy = Vs.y - As.y,
      len = Math.max(1, Math.hypot(dx, dy)),
      ux = dx / len,
      uy = dy / len,
      aw = { x: lerp(As.x, Vs.x, lunge), y: lerp(As.y, Vs.y, lunge) },
      vw = { x: Vs.x + ux * m.tw * 0.07 * preyKick, y: Vs.y + uy * m.tw * 0.07 * preyKick },
      spray = clamp((t - 0.2) / 0.4, 0, 1),
      fade = clamp((1 - t) / 0.24, 0, 1);
    ctx.globalAlpha = 0.2 * (1 - strike) + 0.08;
    ctx.strokeStyle = hsl(creatureModel(v.attacker).primaryHue, 62, 62);
    ctx.lineWidth = Math.max(2, m.tw * 0.05);
    ctx.beginPath();
    ctx.moveTo(As.x, As.y);
    ctx.lineTo(aw.x, aw.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    let rA = 0,
      rV = 0;
    if (W.components.genome[v.victim]) {
      ctx.save();
      ctx.translate(vw.x, vw.y);
      ctx.rotate(impact * (visualHash01(v.eventId, 7) - 0.5) * 0.5);
      ctx.scale(1 + impact * 0.1, 1 - impact * 0.22);
      ctx.translate(-vw.x, -vw.y);
      rV = drawCreatureGlyph(ctx, v.victim, vw, now, null, 0, false, {
        gait: (VISUAL_MOTION.get(v.victim)?.gait || 0) + impact * 1.4,
        moving: impact > 0 && recoil < 1,
        screenHeading: Math.atan2(dy, dx) + Math.PI,
      });
      const victimMotion = VISUAL_MOTION.get(v.victim);
      if (victimMotion) {
        victimMotion.s = vw;
        victimMotion.lastR = rV;
      }
      ctx.restore();
    }
    if (W.components.genome[v.attacker]) {
      rA = drawCreatureGlyph(ctx, v.attacker, aw, now, null, 0, false, {
        gait: (VISUAL_MOTION.get(v.attacker)?.gait || 0) + strike * 2.6,
        moving: t < 0.6,
        screenHeading: Math.atan2(dy, dx),
      });
      const attackerMotion = VISUAL_MOTION.get(v.attacker);
      if (attackerMotion) {
        attackerMotion.s = aw;
        attackerMotion.lastR = rA;
      }
    }
    if (v.ranged && t > 0.05 && t < 0.34) {
      const pt = clamp((t - 0.05) / 0.27, 0, 1),
        lob = v.ranged === 3 ? 0.04 : 0.22,
        px2 = lerp(aw.x, vw.x, pt),
        py2 = lerp(aw.y, vw.y, pt) - Math.sin(pt * Math.PI) * m.tw * lob;
      ctx.strokeStyle = v.ranged === 3 ? "#ffd98c" : "#e8e2c8";
      ctx.lineWidth = Math.max(1.2, m.tw * 0.03);
      ctx.beginPath();
      ctx.moveTo(px2 - ux * m.tw * 0.12, py2 - uy * m.tw * 0.12);
      ctx.lineTo(px2, py2);
      ctx.stroke();
      if (v.ranged === 3 && t < 0.14) {
        ctx.fillStyle = "#ffe9b0";
        ctx.beginPath();
        ctx.arc(
          aw.x + ux * Math.max(rA, 6) * 0.9,
          aw.y + uy * Math.max(rA, 6) * 0.9,
          Math.max(2, m.tw * 0.05) * (1.4 - t / 0.14),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    const r = Math.max(rA, rV, m.tw * 0.22);
    if (t > 0.16 && !v.ranged) {
      ctx.strokeStyle = "#fff1c9";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1.5, r * 0.08);
      for (let n = 0; n < 3; n++) {
        const side = (n - 1) * r * 0.18;
        ctx.beginPath();
        ctx.moveTo(vw.x - ux * r * 0.55 - uy * side, vw.y - uy * r * 0.55 + ux * side);
        ctx.lineTo(vw.x + ux * r * 0.32 - uy * side, vw.y + uy * r * 0.32 + ux * side);
        ctx.stroke();
      }
      ctx.strokeStyle = hsl(v.bloodHue, 88, 56, 0.9);
      ctx.lineWidth = Math.max(2, r * 0.11);
      ctx.beginPath();
      ctx.arc(
        vw.x,
        vw.y,
        r * (0.28 + impact * 0.18),
        Math.atan2(dy, dx) - 1.15,
        Math.atan2(dy, dx) + 1.15,
      );
      ctx.stroke();
    }
    if (spray > 0) {
      ctx.fillStyle = hsl(v.bloodHue, 83, 43, 0.82 * fade + 0.14);
      const drops =
        (v.lethal ? 24 : 15) +
        Math.min(18, Math.floor((v.bloodAmount || 0) * 1.5)) +
        (v.critical ? 10 : 0);
      for (let n = 0; n < drops; n++) {
        const spread = (visualHash01(v.eventId, n) - 0.5) * 2.15,
          travel = r * (0.35 + visualHash01(v.eventId ^ 0x8b, n) * 2.4) * spray,
          side = spread * travel * 0.66,
          gravity = r * 0.72 * spray * spray,
          drop = Math.max(1, r * (0.025 + visualHash01(n, v.eventId) * 0.065) * (1 - spray * 0.35));
        ctx.beginPath();
        ctx.ellipse(
          vw.x + ux * travel - uy * side,
          vw.y + uy * travel + ux * side + gravity,
          drop,
          drop * (0.55 + visualHash01(n, 91) * 0.4),
          spread,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = hsl(v.bloodHue, 74, 24, 0.34 + 0.26 * impact);
      ctx.beginPath();
      ctx.ellipse(
        vw.x,
        vw.y + r * 0.38,
        r * (0.3 + spray * 0.58 + Math.min(0.55, (v.bloodAmount || 0) * 0.025)),
        r * (0.08 + spray * 0.16 + (v.critical ? 0.08 : 0)),
        Math.atan2(dy, dx),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    if (v.severedPart && t > 0.24) {
      const severPhase = clamp((t - 0.24) / 0.48, 0, 1),
        angle = Math.atan2(dy, dx) + (visualHash01(v.eventId, 0x61) - 0.5) * 2.4,
        travel = r * (0.45 + severPhase * 1.25),
        lx = vw.x + Math.cos(angle) * travel,
        ly = vw.y + Math.sin(angle) * travel + r * severPhase * severPhase * 0.72;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(angle + severPhase * 5.2);
      ctx.fillStyle = hsl(creatureModel(v.victim).primaryHue, 45, 36, 0.94);
      ctx.strokeStyle = hsl(v.bloodHue, 86, 34, 0.96);
      ctx.lineWidth = Math.max(1.2, r * 0.08);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-r * 0.32, -r * 0.1, r * 0.64, r * 0.2, r * 0.08);
      else ctx.rect(-r * 0.32, -r * 0.1, r * 0.64, r * 0.2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (v.lethal && t > 0.32) {
      const fragmentPhase = clamp((t - 0.32) / 0.5, 0, 1);
      for (let n = 0; n < (v.critical ? 11 : 7); n++) {
        const a = (visualHash01(v.eventId ^ 0x5f, n) - 0.5) * 2.5 + Math.atan2(dy, dx),
          d = r * (0.25 + visualHash01(v.eventId, n ^ 17) * 1.25) * fragmentPhase,
          sz = r * (0.045 + visualHash01(n, v.eventId ^ 33) * 0.09);
        ctx.fillStyle =
          n % 3 === 0
            ? hsl(creatureModel(v.victim).accentHue, 65, 55, 0.75 * fade + 0.18)
            : hsl(v.bloodHue, 78, n % 2 ? 29 : 42, 0.86 * fade + 0.12);
        ctx.save();
        ctx.translate(vw.x + Math.cos(a) * d, vw.y + Math.sin(a) * d + d * 0.35 * fragmentPhase);
        ctx.rotate(a + fragmentPhase * 4);
        ctx.fillRect(-sz, -sz * 0.45, sz * 2, sz * 0.9);
        ctx.restore();
      }
    }
    ctx.strokeStyle = hsl(v.bloodHue, 82, 62, 0.72 * fade);
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.beginPath();
    ctx.arc(vw.x, vw.y, r * (0.45 + impact * 0.7), 0, Math.PI * 2);
    ctx.stroke();
    if (UI.camera.zoom > 2.2) {
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = `800 ${clamp(Math.round(r * 0.25), 9, 15)}px system-ui`;
      ctx.fillStyle = "#fff1d4";
      ctx.strokeStyle = "#071016dd";
      ctx.lineWidth = 3;
      const label = `${v.style}${v.bodyPart ? ` · ${v.bodyPart.toUpperCase()}` : ""}${v.severedPart ? " · LIMB LOST" : v.lethal ? " · KILL" : " · " + v.damage}`;
      ctx.strokeText(label, vw.x, vw.y - r * 1.05);
      ctx.fillText(label, vw.x, vw.y - r * 1.05);
    }
  }
  ctx.restore();
}
function drawGroundConflictTraces(now, bounds) {
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    bloodHue = bloodVisualHue();
  ctx.save();
  for (const item of ACTIVE_COMBAT_STATE?.events || []) {
    if (!item.death) continue;
    const [x, y] = xy(item.e.location),
      s = proceduralProjectTile(x + 0.5, y + 0.5, m),
      amount = Math.max(1, item.e.magnitude || item.e.subjects.length || 1),
      r = clamp(
        m.tw * (0.12 + Math.log2(amount + 1) * 0.045),
        2,
        Math.max(UI.camera.zoom > 5 ? 28 : 14, m.tw * 0.5),
      );
    ctx.fillStyle = hsl(bloodHue, 72, 25, 0.18 + item.fade * 0.28);
    ctx.beginPath();
    ctx.ellipse(
      s.x,
      s.y + r * 0.28,
      r * (0.8 + visualHash01(item.e.id, 31) * 0.45),
      r * 0.3,
      visualHash01(item.e.id, 97) * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    for (let n = 0; n < Math.min(7, 2 + amount); n++) {
      const a = visualHash01(item.e.id, n) * Math.PI * 2,
        d = r * (0.55 + visualHash01(item.e.id ^ 73, n) * 0.8),
        drop = Math.max(1, r * (0.055 + visualHash01(n, item.e.id) * 0.07));
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d * 0.42, drop, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.CORPSE) continue;
    const p = W.components.position[id];
    if (
      !p ||
      p.x < bounds.x0 - 2 ||
      p.x > bounds.x1 + 2 ||
      p.y < bounds.y0 - 2 ||
      p.y > bounds.y1 + 2
    )
      continue;
    const tile = idx(p.x, p.y),
      signal = tileBlood(tile) + (W.components.chemistry[id]?.q?.[C.BLOOD] || 0),
      corpseAge = Math.max(0, W.tick - (W.components.life[id]?.deathTick ?? W.tick)),
      corpsePoolLife = 48;
    if (corpseAge >= corpsePoolLife) continue;
    if (signal < 2) continue;
    const s = W.components.genome[id]
        ? visualAnchor(id, p, m, ACTIVE_RENDER_NOW || performance.now()).s
        : proceduralProjectTile(p.x + 0.5, p.y + 0.5, m),
      r = clamp(m.tw * (0.15 + Math.log2(signal + 1) * 0.025), 2, Math.max(26, m.tw * 0.5)),
      corpsePoolFade = clamp(1 - corpseAge / corpsePoolLife, 0, 1) ** 1.2;
    ctx.fillStyle = hsl(bloodVisualHue(id), 72, 22, 0.48 * corpsePoolFade);
    ctx.beginPath();
    ctx.ellipse(
      s.x,
      s.y + r * 0.35,
      r,
      r * 0.28,
      visualHash01(id, 0x812) * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  drawSeveredBodyParts(ctx, now, bounds, m);
  ctx.restore();
}
function drawImpactBurst(s, item, now, m) {
  const e = item.e,
    progress = clamp(item.age / 8, 0, 1);
  if (progress >= 1) return;
  const r = clamp(m.tw * (0.22 + progress * 0.28), 4, Math.max(34, m.tw * 0.6)),
    hue = bloodVisualHue(e.subjects[0]);
  ctx.save();
  ctx.strokeStyle = hsl(hue, 82, 66, (1 - progress) * item.fade);
  ctx.lineWidth = Math.max(1, 3 * (1 - progress));
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = hsl(hue, 78, 48, 0.55 * item.fade);
  for (let n = 0; n < 8; n++) {
    const a = visualHash01(e.id, n) * Math.PI * 2,
      d = r * (0.25 + progress),
      drop = Math.max(1, m.tw * 0.025 * (1 - progress));
    ctx.beginPath();
    ctx.arc(
      s.x + Math.cos(a) * d,
      s.y + Math.sin(a) * d * 0.72 - progress * r * 0.24,
      drop,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}
function drawCombatEffects(now, bounds) {
  const m = ACTIVE_RENDER_METRICS || projectionMetrics();
  ctx.save();
  for (const item of ACTIVE_COMBAT_STATE?.events || []) {
    const e = item.e,
      [x, y] = xy(e.location),
      impact = proceduralProjectTile(x + 0.5, y + 0.5, m),
      attacker =
        e.type === "InjuryEvent" ? e.subjects[1] : e.type === "KillEvent" ? e.subjects[0] : 0,
      victim =
        e.type === "InjuryEvent"
          ? e.subjects[0]
          : e.type === "KillEvent"
            ? e.subjects[1]
            : e.subjects[0],
      ap = W.components.position[attacker],
      vp = W.components.position[victim];
    if (ACTIVE_PREDATION_IDS.has(attacker) || ACTIVE_PREDATION_IDS.has(victim)) continue;
    if (item.combat && ap && vp && item.age <= Math.max(8, (UI.speed || 1) * 4)) {
      const a = W.components.genome[attacker]
          ? visualAnchor(attacker, ap, m, now).s
          : proceduralProjectTile(ap.x + 0.5, ap.y + 0.5, m),
        v = W.components.genome[victim]
          ? visualAnchor(victim, vp, m, now).s
          : proceduralProjectTile(vp.x + 0.5, vp.y + 0.5, m),
        swing = Math.sin(now * 0.018 + e.id) * 0.5 + 0.5;
      ctx.strokeStyle = W.components.social[attacker]?.factionId
        ? W.factions.find((f) => f.id === W.components.social[attacker].factionId)?.color ||
          "#f0cf8d"
        : "#f0cf8d";
      ctx.lineWidth = clamp(m.tw * 0.055, 1.2, 14);
      ctx.beginPath();
      ctx.moveTo(lerp(a.x, v.x, 0.18), lerp(a.y, v.y, 0.18) - m.tw * 0.12);
      ctx.quadraticCurveTo(
        lerp(a.x, v.x, 0.55),
        Math.min(a.y, v.y) - m.tw * (0.35 + swing * 0.16),
        v.x,
        v.y,
      );
      ctx.stroke();
      ctx.strokeStyle = "#fff3";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(v.x, v.y);
      ctx.stroke();
    }
    drawImpactBurst(impact, item, now, m);
    if (UI.camera.zoom > 4.5 && item.fade > 0.35) {
      const cause = e.evidence?.[0] || e.type.replace("Event", "");
      ctx.font = "bold 9px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#fff2d0";
      ctx.fillText(cause.toUpperCase().slice(0, 28), impact.x, impact.y - m.tw * 0.45);
    }
  }
  for (const id of W.activeIds) {
    const life = W.components.life[id],
      p = W.components.position[id];
    if (
      !life?.wounded ||
      !p ||
      p.x < bounds.x0 - 2 ||
      p.x > bounds.x1 + 2 ||
      p.y < bounds.y0 - 2 ||
      p.y > bounds.y1 + 2
    )
      continue;
    const s = W.components.genome[id]
        ? visualAnchor(id, p, m, now).s
        : proceduralProjectTile(p.x + 0.5, p.y + 0.5, m),
      health = clamp(peekDerivedLife(id).health / 100, 0, 1),
      r = clamp(m.tw * 0.32, 4, 28),
      off = Math.max(r * 1.25, m.tw * 0.55);
    ctx.fillStyle = "#071016c9";
    ctx.fillRect(s.x - r, s.y - off, r * 2, 4);
    ctx.fillStyle = health > 0.5 ? "#d99c66" : "#e05f5a";
    ctx.fillRect(s.x - r, s.y - off, r * 2 * health, 4);
    ctx.strokeStyle = hsl(bloodVisualHue(id), 75, 55, 0.75);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(s.x - r * 0.55, s.y - r * 0.45);
    ctx.lineTo(s.x + r * 0.55, s.y + r * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}
function factionBattleAnchor(factionId, eventLocation) {
  const [tx, ty] = xy(eventLocation),
    settlements = W.settlements.filter((s) => !s.ruined && s.factionId === factionId);
  return settlements.sort(
    (a, b) => dist2(a.x, a.y, tx, ty) - dist2(b.x, b.y, tx, ty) || a.id - b.id,
  )[0];
}
function drawWarFronts(now, bounds) {
  const wars = W.activeWars.filter((w) => !w.ended),
    m = ACTIVE_RENDER_METRICS || projectionMetrics();
  if (!wars.length) return;
  ctx.save();
  for (const war of wars) {
    const last = eventById(war.lastEventId || war.startEventId),
      location =
        last?.location >= 0
          ? last.location
          : (() => {
              const a = W.factions.find((f) => f.id === war.a),
                s = W.settlements.find((q) => q.id === a?.capitalSettlementId);
              return s ? idx(s.x, s.y) : -1;
            })(),
      fa = W.factions.find((f) => f.id === war.a),
      fb = W.factions.find((f) => f.id === war.b);
    if (location < 0 || !fa || !fb) continue;
    const [x, y] = xy(location),
      a = factionBattleAnchor(fa.id, location),
      b = factionBattleAnchor(fb.id, location);
    if (!a || !b) continue;
    const pa = proceduralProjectTile(a.x + 0.5, a.y + 0.5, m),
      pb = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m),
      front = proceduralProjectTile(x + 0.5, y + 0.5, m),
      pulse = 0.65 + 0.35 * Math.sin(now * 0.006 + war.id);
    ctx.setLineDash([7, 5]);
    ctx.lineDashOffset = -now * 0.012;
    ctx.lineWidth = clamp(m.tw * 0.035, 1, 10);
    const frontLine = (pp, color) => {
      const fdx = pp.x - front.x,
        fdy = pp.y - front.y,
        flen = Math.hypot(fdx, fdy) || 1,
        fcut = Math.min(1, (Math.max(m.w, m.h) * 0.42) / flen),
        fx = front.x + fdx * fcut,
        fy = front.y + fdy * fcut,
        wa = (c, a) =>
          c && c.startsWith("hsl(") && !c.includes("/") ? c.replace(")", ` / ${a})`) : c,
        fg = ctx.createLinearGradient(front.x, front.y, fx, fy);
      fg.addColorStop(0, wa(color, 0.9) || "#f0cf8d");
      fg.addColorStop(1, wa(color, fcut < 1 ? 0.03 : 0.3) || "#f0cf8d");
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.moveTo(front.x, front.y);
      ctx.lineTo(fx, fy);
      ctx.stroke();
    };
    frontLine(pa, fa.color);
    frontLine(pb, fb.color);
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    const lastE = eventById(war.lastEventId || 0);
    if (lastE && W.tick - lastE.tick < Math.max(10, (UI.speed || 1) * 6)) {
      const v0 = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome();
      for (let n = 0; n < 6; n++) {
        const a2 = visualHash01(war.id || 1, n) * Math.PI * 2 + now * 0.0004 * (n % 2 ? 1 : -1),
          d2 = m.tw * (0.3 + visualHash01(n, war.id || 1) * 0.5),
          lift = (now * 0.02 + n * 37) % (m.tw * 0.6),
          px2 = front.x + Math.cos(a2) * d2,
          py2 = front.y + Math.sin(a2) * d2 * 0.5 - lift;
        ctx.fillStyle = hsl(v0.mineralHue, 20, 58, 0.15);
        ctx.beginPath();
        ctx.arc(
          px2,
          py2,
          Math.max(2, m.tw * 0.09 * (0.6 + visualHash01(n, 3) * 0.6)),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    for (const [f, side] of [
      [fa, -1],
      [fb, 1],
    ]) {
      ctx.fillStyle = f.color;
      for (let n = 0; n < Math.min(6, 2 + Math.floor(f.militaryStrength / 18)); n++) {
        const ox = side * (8 + n * 5),
          oy = ((n % 3) - 1) * 5;
        ctx.beginPath();
        ctx.moveTo(front.x + ox, front.y + oy - 5 * pulse);
        ctx.lineTo(front.x + ox + side * 6, front.y + oy);
        ctx.lineTo(front.x + ox, front.y + oy + 5 * pulse);
        ctx.closePath();
        ctx.fill();
      }
    }
    if (UI.labels) {
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const phase =
          war.casualties > 0 || war.contactTurns
            ? `${war.casualties} fallen`
            : war.marches
              ? "forces marching"
              : "mobilizing",
        label = `${fa.name} ⚔ ${fb.name} · ${phase}`;
      const width = ctx.measureText(label).width;
      WAR_LABEL_HITS.push({
        x: front.x - width / 2 - 5,
        y: front.y - 30,
        w: width + 10,
        h: 15,
        id: fa.entityId,
      });
      ctx.fillStyle = "#071016dc";
      ctx.fillRect(front.x - width / 2 - 5, front.y - 30, width + 10, 15);
      ctx.fillStyle = "#f2d9a4";
      ctx.fillText(label, front.x, front.y - 19);
    }
  }
  ctx.restore();
}
const drawEntitiesMaterialSocietyBase = drawEntitiesProcedural;
// One painter's list for everything vertical: terrain features, flames,
// buildings, and creatures share a camera-space depth key so occlusion stays
// correct at any orbit angle. Top-down keeps its flat legacy order.
function drawSceneDepthSorted(now, bounds) {
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    labels = [],
    items = [];
  ACTIVE_INTERIOR_IDS = new Set();
  ACTIVE_INTERIOR_STATE = makeInteriorState(bounds);
  const q = UI.view === "oblique" ? obliqueBasis(m) : null,
    dep = q ? (x, y) => -x * q.s + y * q.c : (x, y) => x + y,
    featureFade = UI.camera.zoom > 10 ? clamp(1 - (UI.camera.zoom - 10) / 46, 0, 1) : 1;
  for (let y = bounds.y0; y <= bounds.y1; y++)
    for (let x = bounds.x0; x <= bounds.x1; x++) {
      const i = idx(x, y);
      if (featureFade > 0.03 && W.tiles.featureType?.[i])
        items.push({ d: dep(x + 0.5, y + 0.5), t: 0, x, y, i });
      if (W.tiles.fire[i] > 25) items.push({ d: dep(x + 0.5, y + 0.5) + 0.02, t: 1, x, y, i });
    }
  if (W.buildings?.length)
    for (const b of W.buildings) {
      if (b.x < bounds.x0 - 2 || b.x > bounds.x1 + 2 || b.y < bounds.y0 - 2 || b.y > bounds.y1 + 2)
        continue;
      items.push({ d: dep(b.x + 0.5, b.y + 0.5) + b.id * 1e-7, t: 2, b });
    }
  for (const id of W.activeIds) {
    if (!sceneEntityVisible(id, bounds)) continue;
    const p = W.components.position[id],
      k = W.kind[id];
    let d;
    if (
      W.components.genome[id] &&
      k !== KINDS.SETTLEMENT &&
      k !== KINDS.CAMP &&
      k !== "ruin" &&
      k !== KINDS.ARTIFACT
    ) {
      const a = visualAnchor(id, p, m, now);
      d = dep(a.wx, a.wy);
    } else d = dep(p.x + 0.5, p.y + 0.5);
    items.push({ d: d + id * 1e-7, t: 3, id });
  }
  items.sort((a, b) => a.d - b.d);
  for (const it of items) {
    if (it.t === 0) {
      const p = proceduralProjectTile(it.x + 0.5, it.y + 0.5, m),
        st = (W.tiles.featureStrength[it.i] || 500) / 1000,
        fa2 = featureFade * (0.55 + 0.45 * st);
      if (fa2 < 1) {
        ctx.save();
        ctx.globalAlpha = fa2;
      }
      if (W.tiles.featureType[it.i] === TERRAIN_FEATURE.CANOPY && UI.camera.zoom > 2.2) {
        const k = Math.min(
            4,
            (st < 0.35 ? 1 : 2) +
              (visualHash01(it.i, 0x31) > 0.5 ? 1 : 0) +
              (UI.camera.zoom > 6 ? 1 : 0),
          ),
          subs = [];
        for (let n = 0; n < k; n++)
          subs.push({
            dx: (visualHash01(it.i, 0x50 + n) - 0.5) * m.tw * 0.72,
            dy: (visualHash01(it.i, 0x90 + n) - 0.5) * m.th * 0.6,
            s: 0.55 + 0.45 * visualHash01(it.i, 0xd0 + n),
          });
        subs.sort((a, b) => a.dy - b.dy);
        for (const sub of subs) drawEcologicalStructure(it.x, it.y, it.i, p, m, v, sub);
      } else drawEcologicalStructure(it.x, it.y, it.i, p, m, v);
      drawStructureIdentity(it.i, p, m, v);
      if (fa2 < 1) ctx.restore();
    } else if (it.t === 1) drawTileFlame(it.x, it.y, it.i, m);
    else if (it.t === 2) drawBuildingSite(ctx, it.b, now, m);
    else drawSceneEntity(it.id, now, m, v, labels);
  }
  drawEntityLabels(labels, v);
}
function placeByEntityId(eid) {
  return (
    W.settlements.find((s) => s.entityId === eid) || W.camps.find((c) => c.entityId === eid) || null
  );
}
function drawTradeRoutes(now, bounds) {
  if (!W.events.length) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    windowTicks = Math.max(64, Math.round((UI.speed || 1) * 24)),
    floor = Math.max(0, W.events.length - 260);
  let drawn = 0;
  ctx.save();
  for (let n = W.events.length - 1; n >= floor && drawn < 8; n--) {
    const e = W.events[n];
    if (e.type !== "ExchangeEvent") continue;
    const age = W.tick - e.tick;
    if (age < 0 || age > windowTicks) continue;
    const pa = placeByEntityId(e.subjects?.[0]),
      pb = placeByEntityId(e.subjects?.[1]);
    if (!pa || !pb) continue;
    const inA =
        pa.x >= bounds.x0 - 3 &&
        pa.x <= bounds.x1 + 3 &&
        pa.y >= bounds.y0 - 3 &&
        pa.y <= bounds.y1 + 3,
      inB =
        pb.x >= bounds.x0 - 3 &&
        pb.x <= bounds.x1 + 3 &&
        pb.y >= bounds.y0 - 3 &&
        pb.y <= bounds.y1 + 3;
    if (!inA && !inB) continue;
    const a = proceduralProjectTile(pa.x + 0.5, pa.y + 0.5, m),
      b = proceduralProjectTile(pb.x + 0.5, pb.y + 0.5, m),
      fade = clamp(1 - age / windowTicks, 0.1, 1);
    ctx.strokeStyle = hsl(v.accentHue, 62, 66, 0.22 * fade);
    ctx.lineWidth = Math.max(1, m.tw * 0.03);
    ctx.setLineDash([2, 6]);
    ctx.lineDashOffset = -now * 0.01;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const frac = (age / windowTicks + now * 0.00035) % 1,
      gx = lerp(a.x, b.x, frac),
      gy = lerp(a.y, b.y, frac);
    ctx.fillStyle = hsl(v.accentHue, 80, 70, 0.85 * fade);
    ctx.beginPath();
    ctx.arc(gx, gy, Math.max(1.6, m.tw * 0.045), 0, Math.PI * 2);
    ctx.fill();
    drawn++;
  }
  ctx.restore();
}
function drawSiegeVisuals(now, bounds) {
  const active = (UI.siegeVisuals || []).filter(
    (v) => v.world === W && now - v.started < v.duration,
  );
  UI.siegeVisuals = active;
  if (!active.length) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    v0 = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome();
  ctx.save();
  for (const sv of active) {
    if (
      sv.x < bounds.x0 - 3 ||
      sv.x > bounds.x1 + 3 ||
      sv.y < bounds.y0 - 3 ||
      sv.y > bounds.y1 + 3
    )
      continue;
    const t = clamp((now - sv.started) / sv.duration, 0, 1),
      s = proceduralProjectTile(sv.x + 0.5, sv.y + 0.5, m),
      power = clamp(sv.amount / 30, 0.3, 1.6),
      fade = 1 - t;
    ctx.strokeStyle = hsl(30, 80, 66, 0.55 * fade);
    ctx.lineWidth = Math.max(1.5, m.tw * 0.06 * (1 - t));
    ctx.beginPath();
    ctx.arc(
      s.x,
      s.y,
      Math.max(3, m.tw * (0.2 + t * 1.1) * power * (sv.bash ? 0.5 : 1)),
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    if (sv.bash) {
      ctx.strokeStyle = hsl(30, 14, 14, 0.85 * fade);
      ctx.lineWidth = Math.max(1, m.tw * 0.03);
      for (let c2 = 0; c2 < 3; c2++) {
        let cx2 = s.x + (visualHash01(sv.x * 7 + c2, sv.y) - 0.5) * m.tw * 0.3,
          cy2 = s.y - (visualHash01(c2, sv.x) - 0.2) * m.tw * 0.3;
        ctx.beginPath();
        ctx.moveTo(cx2, cy2);
        for (let seg = 0; seg < 3; seg++) {
          cx2 += (visualHash01(sv.x + seg, c2 * 31) - 0.5) * m.tw * 0.28;
          cy2 += m.tw * (0.08 + visualHash01(seg, c2) * 0.12);
          ctx.lineTo(cx2, cy2);
        }
        ctx.stroke();
      }
    }
    const shards = sv.collapsed > 0 ? 9 : sv.bash ? 4 : 5;
    for (let n = 0; n < shards; n++) {
      const a = visualHash01(sv.x * 131 + sv.y, n) * Math.PI * 2,
        sp2 = m.tw * (0.2 + visualHash01(n, sv.y) * (sv.collapsed > 0 ? 0.9 : 0.5)) * power,
        dx2 = Math.cos(a) * sp2 * t,
        dy2 = Math.sin(a) * sp2 * t * 0.5 - Math.sin(t * Math.PI) * m.tw * 0.4 * power,
        sz = Math.max(1.5, m.tw * 0.05 * (1 + visualHash01(n, 7)));
      ctx.fillStyle =
        n % 3 ? hsl(v0.mineralHue, 30, 40, 0.85 * fade) : hsl(28, 70, 55, 0.85 * fade);
      ctx.save();
      ctx.translate(s.x + dx2, s.y + dy2);
      ctx.rotate(a + t * 5);
      ctx.fillRect(-sz, -sz * 0.5, sz * 2, sz);
      ctx.restore();
    }
    if (sv.collapsed > 0) {
      ctx.fillStyle = hsl(v0.mineralHue, 15, 50, 0.22 * fade);
      for (let n = 0; n < 5; n++) {
        const puffT = (t * 1.4 + n * 0.17) % 1;
        ctx.beginPath();
        ctx.arc(
          s.x + (visualHash01(n, sv.x) - 0.5) * m.tw * 0.9,
          s.y - puffT * m.tw * 0.7,
          Math.max(2, m.tw * 0.14 * (0.5 + puffT)),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
  ctx.restore();
}
function drawCaptureVisuals(now, bounds) {
  const active = (UI.captureVisuals || []).filter(
    (v) => v.world === W && now - v.started < v.duration,
  );
  UI.captureVisuals = active;
  if (!active.length) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    v0 = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome();
  ctx.save();
  for (const cv of active) {
    if (
      cv.x < bounds.x0 - 3 ||
      cv.x > bounds.x1 + 3 ||
      cv.y < bounds.y0 - 3 ||
      cv.y > bounds.y1 + 3
    )
      continue;
    const t = clamp((now - cv.started) / cv.duration, 0, 1),
      s = proceduralProjectTile(cv.x + 0.5, cv.y + 0.5, m),
      h = Math.max(20, m.tw * 0.9),
      rise = clamp(t / 0.3, 0, 1),
      fade = clamp((1 - t) / 0.3, 0, 1);
    ctx.strokeStyle = hsl(v0.accentHue, 60, 68, 0.7 * Math.min(1, fade + 0.4));
    ctx.lineWidth = Math.max(1.5, m.tw * 0.05);
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(4, m.tw * (0.4 + t * 1.6)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#2c2620";
    ctx.lineWidth = Math.max(1.6, m.tw * 0.05);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x, s.y - h * rise);
    ctx.stroke();
    if (rise > 0.3) {
      const fh = h * rise,
        sway = Math.sin(now * 0.005 + cv.x) * 0.12;
      ctx.fillStyle = cv.color;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - fh);
      ctx.quadraticCurveTo(
        s.x + fh * 0.4,
        s.y - fh + fh * 0.12 + sway * fh,
        s.x + fh * 0.55,
        s.y - fh * 0.74 + sway * fh,
      );
      ctx.lineTo(s.x, s.y - fh * 0.58);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#fff4";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (cv.burned)
      for (let n = 0; n < 3 + cv.razed; n++) {
        const a = visualHash01(n, cv.x * 97 + cv.y) * Math.PI * 2,
          d = m.tw * (0.25 + visualHash01(n, 7) * 0.7),
          puffT = (t * 1.6 + n * 0.13) % 1;
        ctx.fillStyle = hsl(20, 18, 28, 0.3 * (1 - puffT));
        ctx.beginPath();
        ctx.arc(
          s.x + Math.cos(a) * d + puffT * m.tw * 0.1,
          s.y + Math.sin(a) * d * 0.5 - puffT * h * 0.8,
          Math.max(2, m.tw * 0.12 * (0.5 + puffT)),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
  }
  ctx.restore();
}
function drawMilitaryBanners(now, bounds) {
  if (!W.militaryUnits?.length) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics();
  ctx.save();
  for (const unit of W.militaryUnits) {
    if (!unit.active) continue;
    let cx = 0,
      cy = 0,
      n = 0;
    for (const id of unit.memberIds) {
      if (!peekAlive(id)) continue;
      const p = W.components.position[id];
      if (
        !p ||
        p.x < bounds.x0 - 2 ||
        p.x > bounds.x1 + 2 ||
        p.y < bounds.y0 - 2 ||
        p.y > bounds.y1 + 2
      )
        continue;
      cx += p.x;
      cy += p.y;
      n++;
    }
    if (n < 2) continue;
    const s = proceduralProjectTile(cx / n + 0.5, cy / n + 0.5, m),
      f = W.factions.find((x) => x.id === unit.factionId),
      atWar = W.activeWars?.some(
        (w) => !w.ended && (w.a === unit.factionId || w.b === unit.factionId),
      ),
      h = Math.max(16, m.tw * 0.55),
      sway = Math.sin(now * 0.004 + (unit.id || 0)) * (atWar ? 0.16 : 0.06);
    ctx.strokeStyle = "#2c2620";
    ctx.lineWidth = Math.max(1.2, m.tw * 0.035);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x, s.y - h);
    ctx.stroke();
    ctx.fillStyle = f?.color || "#d8c184";
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - h);
    ctx.quadraticCurveTo(
      s.x + h * 0.32,
      s.y - h + h * 0.1 + sway * h,
      s.x + h * 0.46,
      s.y - h * 0.78 + sway * h,
    );
    ctx.lineTo(s.x, s.y - h * 0.62);
    ctx.closePath();
    ctx.fill();
    if (atWar) {
      ctx.strokeStyle = "#fff3";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (UI.camera.zoom > 1.6) {
      ctx.font = `700 ${Math.round(clamp(9 + UI.camera.zoom * 0.3, 9, 13))}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#071016d0";
      const label = `${n}`;
      const wdt = ctx.measureText(label).width;
      ctx.fillRect(s.x - wdt / 2 - 3, s.y - h - 14, wdt + 6, 12);
      ctx.fillStyle = f?.color || "#e8ddc2";
      ctx.fillText(label, s.x, s.y - h - 4);
    }
  }
  ctx.restore();
}
drawEntitiesProcedural = function (now, bounds) {
  ACTIVE_COMBAT_STATE = makeCombatVisualState(bounds);
  ACTIVE_PREDATION_IDS = new Set();
  for (const v of UI.combatVisuals || [])
    if (v.world === W && now - v.started < v.duration) {
      if (W.components.genome[v.attacker] && W.components.position[v.attacker])
        ACTIVE_PREDATION_IDS.add(v.attacker);
      if (W.components.genome[v.victim] && W.components.position[v.victim])
        ACTIVE_PREDATION_IDS.add(v.victim);
    }
  LABEL_HITS = [];
  WAR_LABEL_HITS = [];
  rebuildVisualCrowd(now, bounds);
  drawGroundConflictTraces(now, bounds);
  if (UI.view === "top") {
    drawConstructedWorld(now, bounds);
    drawEntitiesMaterialSocietyBase(now, bounds);
  } else drawSceneDepthSorted(now, bounds);
  drawWorkerActivity(now, bounds);
  drawTradeRoutes(now, bounds);
  drawCombatEffects(now, bounds);
  drawRealtimePredation(now, bounds);
  drawMilitaryBanners(now, bounds);
  drawWarFronts(now, bounds);
  drawSiegeVisuals(now, bounds);
  drawCaptureVisuals(now, bounds);
};
drawEntities = drawEntitiesProcedural;

let CIVIC_OVERLAY_CACHE = null;
function civicOverlayIndex() {
  const key = `${W.tick}:${W.buildings.length}:${W.workOrders.length}`;
  if (CIVIC_OVERLAY_CACHE?.key === key) return CIVIC_OVERLAY_CACHE;
  const construction = new Uint8Array(W.tileCount),
    logistics = new Uint8Array(W.tileCount);
  for (const b of W.buildings) {
    if (b.ruined) continue;
    const i = idx(b.x, b.y);
    construction[i] = Math.max(
      construction[i],
      b.complete ? 100 : Math.round(15 + b.progress * 75),
    );
    if (!b.complete)
      logistics[i] = Math.max(logistics[i], Math.round((1 - buildingMaterialRatio(b)) * 100));
  }
  for (const id of W.activeIds) {
    const w = W.components.work?.[id],
      p = W.components.position[id];
    if (W.kind[id] !== KINDS.PERSON || !w || !p || w.task === "idle" || W.tick - w.handledTick > 8)
      continue;
    logistics[idx(p.x, p.y)] = Math.max(logistics[idx(p.x, p.y)], 65);
  }
  return (CIVIC_OVERLAY_CACHE = { key, construction, logistics });
}
const overlayValueMaterialSocietyBase = overlayValue;
overlayValue = function (name, i) {
  if (name === "construction" || name === "logistics") return civicOverlayIndex()[name][i];
  if (name === "microbial")
    return clamp(
      W.tiles.soilOrder[i] / 9 +
        W.tiles.chem[C.ORGANIC][i] / 14 +
        W.tiles.chem[C.PATHOGEN][i] / 5 +
        (W.tiles.plantOrder[i] > 120 ? 14 : 0) +
        (tileMoisture(i) > 30 ? 10 : 0),
      0,
      100,
    );
  if (name === "macrolife")
    return clamp(
      (tilePopulation(i) * 150 + cohortPopulationAt(i) * 110) / 3 +
        (W.tiles.plantOrder[i] > 420 ? 18 : 0),
      0,
      100,
    );
  return overlayValueMaterialSocietyBase(name, i);
};
const overlayStyleMaterialSocietyBase = overlayStyle;
overlayStyle = function (name, i) {
  const v = overlayValue(name, i),
    a = clamp((v / 100) * 0.72, 0, 0.72);
  if (name === "construction") return hsl(46 + v * 0.18, 82, 58, a);
  if (name === "logistics") return hsl(181 - v * 0.75, 78, 55, a);
  if (name === "microbial") return hsl(150 - v * 0.35, 85, 52, a);
  if (name === "macrolife") return hsl(28 + v * 0.5, 88, 58, a);
  return overlayStyleMaterialSocietyBase(name, i);
};

function drawSelection() {
  if (UI.selectedTile < 0) return;
  const [x, y] = xy(UI.selectedTile),
    poly = tilePolygon(x, y);
  ctx.save();
  polygonPath(poly);
  ctx.strokeStyle = "#f2d276";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}
function drawBrushPreview() {
  if (UI.hoverTile < 0 || UI.tool === "inspect") return;
  ctx.save();
  ctx.strokeStyle = "#fff8";
  ctx.lineWidth = 1;
  for (const i of brushTiles(UI.hoverTile)) {
    const [x, y] = xy(i);
    polygonPath(tilePolygon(x, y));
    ctx.stroke();
  }
  ctx.restore();
}
function pickTile(px, py) {
  if (!W) return -1;
  const m = projectionMetrics();
  if (UI.view === "top") {
    const x = Math.floor(UI.camera.x + (px - m.w / 2) / m.tw),
      y = Math.floor(UI.camera.y + (py - m.h / 2) / m.th);
    return inside(x, y) ? idx(x, y) : -1;
  }
  const anchor = cameraWorldAtScreen(px, py),
    radius = UI.view === "oblique" ? 18 : 8;
  let best = -1,
    bestY = -Infinity;
  for (let y = Math.floor(anchor.y) - radius; y <= Math.ceil(anchor.y) + radius; y++)
    for (let x = Math.floor(anchor.x) - radius; x <= Math.ceil(anchor.x) + radius; x++)
      if (inside(x, y)) {
        const poly = tilePolygon(x, y);
        if (pointInPoly(px, py, poly)) {
          const sy = Math.max(...poly.map((p) => p[1]));
          if (sy > bestY) {
            bestY = sy;
            best = idx(x, y);
          }
        }
      }
  return best;
}
