// ═══════════════════════════════════════════════════════════════════════════
// 32i. RENDER — THE SCENE: depth sorting, routes, sieges, banners, overlays, picking
// ═══════════════════════════════════════════════════════════════════════════
// The depth-sorted scene shared by ground, buildings and creatures, trade
// routes, siege and capture visuals, military banners, the civic overlays,
// selection and brush preview, and picking a tile.
// This section was one file of three thousand three hundred lines,
// 32d-spatial-rendering.js, split in six along its own seams on 2026-09-14; the
// composed runtime is unchanged. Everything here reads world state and never
// writes it: visual caches live outside W so the simulation hash and replay
// determinism are untouched by anything drawn.
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
