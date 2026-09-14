// ═══════════════════════════════════════════════════════════════════════════
// 32g. RENDER — THE TOWN: the constructed world, work at its faces, the place
// ═══════════════════════════════════════════════════════════════════════════
// The constructed world layer, the position and drawing of a worker's activity
// at a work face, and the place itself.
// This section was one file of three thousand three hundred lines,
// 32d-spatial-rendering.js, split in six along its own seams on 2026-09-14; the
// composed runtime is unchanged. Everything here reads world state and never
// writes it: visual caches live outside W so the simulation hash and replay
// determinism are untouched by anything drawn.
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
