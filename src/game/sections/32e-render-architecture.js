// ═══════════════════════════════════════════════════════════════════════════
// 32e. RENDER — ARCHITECTURE: palettes, footprints, walls, roofs and sites
// ═══════════════════════════════════════════════════════════════════════════
// A building's palette and screen size, its footprint, the completed building
// with its wall texture, roof form and function marks, walls, stockpiles,
// waterworks and shrines, cracks, and the site under construction.
// This section was one file of three thousand three hundred lines,
// 32d-spatial-rendering.js, split in six along its own seams on 2026-09-14; the
// composed runtime is unchanged. Everything here reads world state and never
// writes it: visual caches live outside W so the simulation hash and replay
// determinism are untouched by anything drawn.
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
// ── Architecture rendering ─────────────────────────────────────────────────────
// A completed building is drawn from its architecture genome: the layout sets
// the silhouette, the wall form its texture, the roof form its cap, and the
// building type its function marks. Faction colour flies from halls and runs
// along walls. Detail steps with zoom and is skipped entirely at Lean quality.
const OPEN_BUILDING_TYPES = new Set([
  "wall",
  "stockpile",
  "waterworks",
  "corral",
  "farm",
  "shrine",
  "monument",
  "dock",
  "launch_tower",
]);
function buildingDetailLevel() {
  return UI.quality === "low" ? 0 : UI.camera.zoom > 4 ? 2 : UI.camera.zoom > 1.6 ? 1 : 0;
}
function drawCompletedBuilding(g, b, s, r, p, now, m) {
  const a = b.architecture || {},
    layout = a.layout || "rectilinear",
    wallForm = a.wallForm || "stacked plate",
    roofForm = a.roofForm || "pitched",
    type = b.type,
    detail = buildingDetailLevel();
  if (type === "wall") return drawWallSegment(g, b, s, r, p, wallForm, detail, m);
  if (type === "stockpile") return drawStockpileBins(g, b, s, r, p, detail);
  if (type === "waterworks") return drawWaterworksBasin(g, b, s, r, p, now, detail);
  if (type === "shrine") return drawShrineSpire(g, b, s, r, p, now, detail);
  if (type === "monument" && typeof drawMonument === "function")
    return drawMonument(g, b, s, r, p, now, detail);
  if (type === "dock" && typeof drawDock === "function")
    return drawDock(g, b, s, r, p, now, detail);
  if (type === "observatory" && typeof drawObservatory === "function")
    return drawObservatory(g, b, s, r, p, now, detail);
  if (type === "launch_tower" && typeof drawLaunchTower === "function")
    return drawLaunchTower(g, b, s, r, p, now, detail);
  const tall =
      type === "hall"
        ? 1.3
        : type === "archive"
          ? 1.2
          : type === "kiln" || type === "forge"
            ? 1.08
            : type === "hearth"
              ? 0.45
              : 1,
    hw = r * (type === "hall" ? 0.95 : layout === "courtyard" ? 0.88 : 0.82),
    h = r * 0.78 * tall,
    baseY = s.y + r * 0.35,
    topY = baseY - h,
    facade = { x: s.x - hw, y: topY, w: hw * 2, h },
    annexSide = b.orientation % 2 ? 1 : -1;
  g.lineWidth = 1;
  g.strokeStyle = p.dark;
  g.fillStyle = p.base;
  g.beginPath();
  if (layout === "radial") g.roundRect(facade.x, facade.y, facade.w, facade.h, hw * 0.4);
  else if (layout === "hive") {
    g.moveTo(facade.x, topY + h * 0.28);
    g.lineTo(s.x, topY);
    g.lineTo(facade.x + facade.w, topY + h * 0.28);
    g.lineTo(facade.x + facade.w, baseY);
    g.lineTo(facade.x, baseY);
    g.closePath();
  } else if (layout === "terraced") {
    g.rect(facade.x, topY + h * 0.4, facade.w, h * 0.6);
    g.rect(facade.x + hw * 0.35, topY, facade.w - hw * 0.7, h * 0.45);
  } else g.rect(facade.x, facade.y, facade.w, facade.h);
  g.fill();
  g.stroke();
  if (layout === "branching") {
    g.beginPath();
    g.rect(
      annexSide > 0 ? facade.x + facade.w - 1 : facade.x - hw * 0.7 + 1,
      topY + h * 0.38,
      hw * 0.7,
      h * 0.62,
    );
    g.fill();
    g.stroke();
  }
  if (layout === "courtyard" && detail) {
    g.fillStyle = p.dark;
    g.globalAlpha = 0.55;
    g.fillRect(s.x - hw * 0.28, topY + h * 0.3, hw * 0.56, h * 0.7);
    g.globalAlpha = 1;
  }
  if (detail) drawWallTexture(g, wallForm, facade, p, detail);
  drawRoofForm(g, roofForm, s, hw, topY, r, p, layout, tall);
  drawBuildingFunctionMarks(g, b, s, r, p, now, detail, { hw, h, baseY, topY });
  if (detail && b.integrity < b.maxIntegrity * 0.5) drawBuildingCracks(g, b, facade);
}
function drawWallTexture(g, wallForm, f, p, detail) {
  g.save();
  g.beginPath();
  g.rect(f.x, f.y, f.w, f.h);
  g.clip();
  g.strokeStyle = p.dark;
  g.globalAlpha = 0.5;
  g.lineWidth = Math.max(0.6, f.h * 0.02);
  g.beginPath();
  if (wallForm === "stacked plate") {
    const rows = detail > 1 ? 6 : 3;
    for (let n = 1; n < rows; n++) {
      const y = f.y + (f.h * n) / rows;
      g.moveTo(f.x, y);
      g.lineTo(f.x + f.w, y);
      if (detail > 1)
        for (let k = n % 2; k < 5; k += 2) {
          const x = f.x + (f.w * (k + 0.5)) / 5;
          g.moveTo(x, y);
          g.lineTo(x, y + f.h / rows);
        }
    }
  } else if (wallForm === "woven rib") {
    const step = f.w / (detail > 1 ? 6 : 3);
    for (let x = f.x - f.h; x < f.x + f.w + f.h; x += step) {
      g.moveTo(x, f.y + f.h);
      g.lineTo(x + f.h, f.y);
      g.moveTo(x, f.y);
      g.lineTo(x + f.h, f.y + f.h);
    }
  } else if (wallForm === "grown shell") {
    for (let n = 1; n <= (detail > 1 ? 3 : 2); n++) {
      const t = n / 4;
      g.moveTo(f.x, f.y + f.h);
      g.quadraticCurveTo(
        f.x + f.w * t,
        f.y - f.h * 0.2 + f.h * t,
        f.x + f.w,
        f.y + f.h * (1 - t * 0.5),
      );
    }
  } else if (wallForm === "cut prism") {
    g.moveTo(f.x, f.y);
    g.lineTo(f.x + f.w * 0.5, f.y + f.h);
    g.lineTo(f.x + f.w, f.y);
    g.moveTo(f.x + f.w * 0.25, f.y);
    g.lineTo(f.x + f.w * 0.25, f.y + f.h * 0.5);
    g.moveTo(f.x + f.w * 0.75, f.y);
    g.lineTo(f.x + f.w * 0.75, f.y + f.h * 0.5);
  } else {
    const cols = detail > 1 ? 6 : 3,
      rows = detail > 1 ? 4 : 2;
    for (let n = 1; n < cols; n++) {
      const x = f.x + (f.w * n) / cols;
      g.moveTo(x, f.y);
      g.lineTo(x, f.y + f.h);
    }
    for (let n = 1; n < rows; n++) {
      const y = f.y + (f.h * n) / rows;
      g.moveTo(f.x, y);
      g.lineTo(f.x + f.w, y);
    }
  }
  g.stroke();
  if (wallForm === "cut prism") {
    g.fillStyle = p.light;
    g.globalAlpha = 0.28;
    g.beginPath();
    g.moveTo(f.x, f.y);
    g.lineTo(f.x + f.w * 0.5, f.y + f.h);
    g.lineTo(f.x, f.y + f.h);
    g.closePath();
    g.fill();
  }
  g.restore();
}
function drawRoofForm(g, roofForm, s, hw, topY, r, p, layout, tall) {
  g.fillStyle = p.light;
  g.strokeStyle = p.dark;
  g.lineWidth = 1.2;
  const rise = r * 0.5 * (tall > 1.2 ? 1.15 : 1),
    ex = hw * 1.12;
  g.beginPath();
  if (roofForm === "membrane" || layout === "radial")
    g.ellipse(s.x, topY - rise * 0.15, ex, rise * 0.75, 0, Math.PI, Math.PI * 2);
  else if (roofForm === "rib vault") {
    g.moveTo(s.x - ex, topY);
    g.quadraticCurveTo(s.x - ex, topY - rise * 1.3, s.x, topY - rise * 1.3);
    g.quadraticCurveTo(s.x + ex, topY - rise * 1.3, s.x + ex, topY);
  } else if (roofForm === "layered cap") {
    for (let n = 0; n < 3; n++) {
      const w = ex * (1 - n * 0.28),
        y = topY - n * rise * 0.36;
      g.rect(s.x - w, y - rise * 0.3, w * 2, rise * 0.3);
    }
  } else if (roofForm === "open lattice") g.rect(s.x - ex, topY - rise * 0.22, ex * 2, rise * 0.22);
  else {
    g.moveTo(s.x - ex, topY + r * 0.04);
    g.lineTo(s.x, topY - rise);
    g.lineTo(s.x + ex, topY + r * 0.04);
    g.closePath();
  }
  g.fill();
  g.stroke();
  g.beginPath();
  if (roofForm === "rib vault")
    for (const t of [-0.5, 0, 0.5]) {
      g.moveTo(s.x + ex * t, topY);
      g.lineTo(s.x + ex * t * 0.85, topY - rise * (1.2 - Math.abs(t) * 0.5));
    }
  else if (roofForm === "open lattice")
    for (let n = 1; n < 5; n++) {
      const x = s.x - ex + (ex * 2 * n) / 5;
      g.moveTo(x, topY - rise * 0.22);
      g.lineTo(x, topY);
    }
  else if (roofForm === "pitched" && layout !== "radial") {
    g.moveTo(s.x, topY - rise);
    g.lineTo(s.x, topY);
  }
  g.stroke();
}
function drawBuildingFunctionMarks(g, b, s, r, p, now, detail, geo) {
  const { hw, h, baseY, topY } = geo,
    type = b.type,
    flicker = ACTIVE_REDUCED_MOTION ? 0.8 : 0.65 + 0.35 * Math.sin(now * 0.009 + b.id);
  if (type === "hearth") {
    g.fillStyle = hsl(31, 95, 58, 0.85);
    g.beginPath();
    g.arc(s.x, baseY - h * 0.35, Math.max(1.4, r * 0.16 * flicker), 0, Math.PI * 2);
    g.fill();
    if (detail) {
      g.fillStyle = hsl(31, 95, 72, 0.35);
      g.beginPath();
      g.arc(s.x, baseY - h * 0.35, r * 0.32 * flicker, 0, Math.PI * 2);
      g.fill();
    }
  } else if (type === "kiln" || type === "forge") {
    const cx = s.x + hw * 0.55;
    g.fillStyle = p.dark;
    g.fillRect(cx - r * 0.1, topY - r * 0.62, r * 0.2, r * 0.62);
    g.fillStyle = hsl(type === "forge" ? 18 : 30, 92, 55, 0.85 * flicker + 0.1);
    g.fillRect(s.x - r * 0.16, baseY - r * 0.26, r * 0.32, r * 0.2);
  } else if (type === "hall") {
    if (detail) {
      g.strokeStyle = p.light;
      g.lineWidth = Math.max(1, r * 0.06);
      g.beginPath();
      for (const t of [-0.6, -0.2, 0.2, 0.6]) {
        g.moveTo(s.x + hw * t, topY + r * 0.04);
        g.lineTo(s.x + hw * t, baseY);
      }
      g.stroke();
    }
    g.strokeStyle = p.dark;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(s.x, topY - r * 0.55);
    g.lineTo(s.x, topY - r * 1.15);
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(s.x, topY - r * 1.15);
    g.lineTo(s.x + r * 0.34, topY - r * 1.03);
    g.lineTo(s.x, topY - r * 0.9);
    g.closePath();
    g.fill();
  } else if (type === "archive" && detail) {
    g.strokeStyle = p.accent;
    g.lineWidth = Math.max(0.8, r * 0.04);
    g.beginPath();
    for (let n = 1; n <= 3; n++) {
      const y = topY + (h * n) / 4;
      g.moveTo(s.x - hw * 0.6, y);
      g.lineTo(s.x + hw * 0.6, y);
    }
    g.stroke();
  } else if (type === "clinic" && detail) {
    g.fillStyle = p.accent;
    g.fillRect(s.x - r * 0.05, topY + r * 0.06, r * 0.1, r * 0.3);
    g.fillRect(s.x - r * 0.15, topY + r * 0.16, r * 0.3, r * 0.1);
  } else if (type === "workshop" && detail) {
    g.strokeStyle = p.light;
    g.lineWidth = Math.max(1, r * 0.07);
    g.beginPath();
    g.moveTo(s.x - hw, baseY - h * 0.55);
    g.lineTo(s.x - hw - r * 0.42, baseY - h * 0.3);
    g.stroke();
    g.fillStyle = p.accent;
    g.fillRect(s.x - hw - r * 0.36, baseY - h * 0.28, r * 0.28, r * 0.06);
  } else if (type === "shelter" && detail > 1) {
    g.fillStyle = p.dark;
    g.globalAlpha = 0.35;
    g.fillRect(s.x - hw, baseY - r * 0.06, hw * 2, r * 0.06);
    g.globalAlpha = 1;
  }
}
function drawWallSegment(g, b, s, r, p, wallForm, detail, m) {
  const d = worldDirToScreen(1, 0, m || ACTIVE_RENDER_METRICS || projectionMetrics()),
    l = Math.hypot(d.x, d.y) || 1,
    ux = d.x / l,
    uy = d.y / l,
    len = r * 1.05,
    th = Math.max(2, r * 0.34);
  g.strokeStyle = p.light;
  g.lineWidth = th;
  g.lineCap = "butt";
  g.beginPath();
  g.moveTo(s.x - ux * len, s.y - uy * len);
  g.lineTo(s.x + ux * len, s.y + uy * len);
  g.stroke();
  g.strokeStyle = p.dark;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(s.x - ux * len, s.y - uy * len + th * 0.5);
  g.lineTo(s.x + ux * len, s.y + uy * len + th * 0.5);
  g.stroke();
  if (!detail) return;
  g.fillStyle = p.light;
  g.strokeStyle = p.dark;
  const teeth = detail > 1 ? 6 : 4,
    w = (len / teeth) * 0.5;
  for (let n = 0; n <= teeth; n++) {
    const t = n / teeth - 0.5,
      x = s.x + ux * len * 2 * t,
      y = s.y + uy * len * 2 * t - th * 0.5;
    g.beginPath();
    if (wallForm === "woven rib" || wallForm === "cut prism") {
      g.moveTo(x - w * 0.5, y);
      g.lineTo(x, y - th * 0.7);
      g.lineTo(x + w * 0.5, y);
      g.closePath();
    } else if (wallForm === "grown shell") g.arc(x, y, w * 0.5, Math.PI, Math.PI * 2);
    else if (wallForm === "interlocked lattice") {
      g.moveTo(x - w * 0.5, y);
      g.lineTo(x + w * 0.5, y - th * 0.5);
      g.moveTo(x + w * 0.5, y);
      g.lineTo(x - w * 0.5, y - th * 0.5);
      g.stroke();
      continue;
    } else g.rect(x - w * 0.5, y - th * 0.5, w, th * 0.5);
    g.fill();
  }
  g.strokeStyle = p.accent;
  g.lineWidth = Math.max(1, th * 0.18);
  g.beginPath();
  g.moveTo(s.x - ux * len, s.y - uy * len - th * 0.1);
  g.lineTo(s.x + ux * len, s.y + uy * len - th * 0.1);
  g.stroke();
}
function drawStockpileBins(g, b, s, r, p, detail) {
  const heaps = Array.from(b.composition)
    .map((v, sp) => ({ v, sp }))
    .filter((x) => x.v > 0)
    .sort((x, y) => y.v - x.v || x.sp - y.sp)
    .slice(0, 3);
  g.strokeStyle = p.dark;
  g.fillStyle = p.base;
  g.lineWidth = 1;
  g.beginPath();
  g.rect(s.x - r * 0.85, s.y - r * 0.05, r * 1.7, r * 0.42);
  g.fill();
  g.stroke();
  const total = heaps.reduce((acc, x) => acc + x.v, 0) || 1;
  heaps.forEach((heap, n) => {
    const hue = W.definitions.species[heap.sp]?.colorHue ?? 40,
      x = s.x + (n - (heaps.length - 1) / 2) * r * 0.55,
      size = r * (0.2 + 0.3 * Math.sqrt(heap.v / total));
    g.fillStyle = hsl(hue, 55, 52);
    g.beginPath();
    g.ellipse(x, s.y - r * 0.05, size, size * 0.65, 0, Math.PI, Math.PI * 2);
    g.fill();
    if (detail) g.stroke();
  });
  if (!heaps.length) {
    g.fillStyle = p.dark;
    g.globalAlpha = 0.4;
    g.fillRect(s.x - r * 0.7, s.y, r * 1.4, r * 0.3);
    g.globalAlpha = 1;
  }
}
function drawWaterworksBasin(g, b, s, r, p, now, detail) {
  const v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome();
  g.fillStyle = p.base;
  g.strokeStyle = p.dark;
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(s.x, s.y + r * 0.1, r * 0.95, r * 0.5, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = hsl(v.liquidHue, 55, 42, 0.9);
  g.beginPath();
  g.ellipse(s.x, s.y + r * 0.1, r * 0.75, r * 0.36, 0, 0, Math.PI * 2);
  g.fill();
  if (!detail) return;
  g.strokeStyle = hsl(v.liquidHue, 60, 72, 0.6);
  g.lineWidth = 1;
  const ph = ACTIVE_REDUCED_MOTION ? 0.3 : (now * 0.0006) % 1;
  for (let n = 0; n < 2; n++) {
    const t = (ph + n * 0.5) % 1;
    g.beginPath();
    g.ellipse(s.x, s.y + r * 0.1, r * (0.2 + t * 0.5), r * (0.1 + t * 0.24), 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.strokeStyle = p.light;
  g.lineWidth = Math.max(1, r * 0.08);
  g.beginPath();
  g.moveTo(s.x + r * 0.9, s.y);
  g.lineTo(s.x + r * 1.5, s.y - r * 0.25);
  g.stroke();
}
function drawShrineSpire(g, b, s, r, p, now, detail) {
  const pulse = ACTIVE_REDUCED_MOTION ? 0.7 : 0.55 + 0.45 * Math.abs(Math.sin(now * 0.0015 + b.id));
  g.fillStyle = p.base;
  g.strokeStyle = p.dark;
  g.lineWidth = 1;
  for (let n = 0; n < 4; n++) {
    const a = n * (Math.PI / 2) + Math.PI / 4;
    g.beginPath();
    g.ellipse(
      s.x + Math.cos(a) * r * 0.7,
      s.y + r * 0.25 + Math.sin(a) * r * 0.3,
      r * 0.14,
      r * 0.1,
      0,
      0,
      Math.PI * 2,
    );
    g.fill();
    g.stroke();
  }
  g.fillStyle = p.light;
  g.beginPath();
  g.moveTo(s.x - r * 0.28, s.y + r * 0.3);
  g.lineTo(s.x, s.y - r * 1.25);
  g.lineTo(s.x + r * 0.28, s.y + r * 0.3);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = p.accent;
  if (detail) {
    g.globalAlpha = 0.3 * pulse;
    g.beginPath();
    g.arc(s.x, s.y - r * 1.15, r * 0.34, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  g.beginPath();
  g.arc(s.x, s.y - r * 1.15, r * 0.12, 0, Math.PI * 2);
  g.fill();
}
function drawBuildingCracks(g, b, f) {
  g.strokeStyle = "rgba(8,10,14,0.7)";
  g.lineWidth = 1;
  g.beginPath();
  for (let n = 0; n < 2; n++) {
    const x0 = f.x + f.w * (0.3 + n * 0.4),
      j = visualHash01(b.id, 0x77 + n);
    g.moveTo(x0, f.y);
    g.lineTo(x0 + f.w * (j - 0.5) * 0.2, f.y + f.h * 0.4);
    g.lineTo(x0 + f.w * (0.5 - j) * 0.25, f.y + f.h * 0.85);
  }
  g.stroke();
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
  if (b.complete) {
    drawCompletedBuilding(g, b, s, r, p, now, m);
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
