// ═══════════════════════════════════════════════════════════════════════════
// 116. FARMLAND — the countryside drawn as farmland
// ═══════════════════════════════════════════════════════════════════════════
// A field was a dark plot of furrows with one dashed hedge along its far edge,
// and a pasture an empty fence, so the belt of fields the town plan lays
// beyond the last houses read as a scatter of boxes rather than a countryside.
// Here every field is bounded on all four sides in the town's manner: the
// Earth-like families keep hedgerows, drystone walls, or post-and-rail fences
// by the stone and timber they build with, and the other families raise
// ridges, pickets, or cairns; a gap in the boundary faces the town. One field
// in five is an orchard, its trees in rows. A field far from the houses gets a
// shed at its corner; a town that knows engines raises a silo by one field in
// three and one that knows combustion leaves a tractor at the gate; a winter
// field lies under frost; and a pasture shows the stock the town has penned or,
// when the pen is empty, its trough and hay rack. Rendering reads the world and
// writes nothing.
const FARMLAND_ORCHARD_SHARE = 0.2,
  FARMLAND_SHED_DISTANCE = 4,
  FARMLAND_SILO_SHARE = 0.34,
  FARMLAND_TRACTOR_SHARE = 0.34,
  FARMLAND_MIN_ZOOM = 1.4,
  FARMLAND = { boundaries: 0, orchards: 0, sheds: 0, silos: 0, tractors: 0, frost: 0, stock: 0, troughs: 0 };
// The boundary a town keeps round its fields, from its family and materials.
function farmlandBoundaryStyle(place) {
  if (!place) return "hedge";
  const family = typeof townPlan === "function" ? townPlan(place)?.family || "earthen" : "earthen",
    a = makeArchitectureGenome(place),
    roll = hashParts(W.seedHash, "farmland-boundary", place.id) % 3;
  if (family === "earthen") {
    if (a.rigid === C.MINERAL && roll === 0) return "drystone";
    if (roll === 1) return "fence";
    return "hedge";
  }
  if (family === "hive" || family === "burrow") return "ridge";
  if (family === "spire" || family === "lattice") return "pickets";
  return "cairns";
}
function farmlandMark(g, style, x, y, r, p, k) {
  switch (style) {
    case "hedge":
      g.fillStyle = hsl(112, 42, 17 + (k % 3) * 3, 0.96);
      g.beginPath();
      g.ellipse(x, y - r * 0.06, r * 0.14, r * 0.1, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = hsl(104, 45, 34, 0.9);
      g.beginPath();
      g.ellipse(x - r * 0.03, y - r * 0.1, r * 0.07, r * 0.045, 0, 0, Math.PI * 2);
      g.fill();
      break;
    case "drystone":
      g.fillStyle = k % 2 ? p.dark : p.base;
      g.fillRect(x - r * 0.09, y - r * 0.08, r * 0.18, r * 0.08);
      break;
    case "fence":
      g.strokeStyle = hsl(32, 35, 30);
      g.lineWidth = Math.max(1, r * 0.035);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y - r * 0.16);
      g.stroke();
      break;
    case "ridge":
      g.fillStyle = hsl(W.terrainGenome?.baseHue || 35, 30, 30, 0.85);
      g.beginPath();
      g.ellipse(x, y, r * 0.12, r * 0.05, 0, 0, Math.PI * 2);
      g.fill();
      break;
    case "pickets":
      g.strokeStyle = p.accent;
      g.lineWidth = Math.max(1, r * 0.03);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (k % 2 ? r * 0.03 : -r * 0.03), y - r * 0.2);
      g.stroke();
      break;
    default:
      g.fillStyle = p.dark;
      g.beginPath();
      g.moveTo(x - r * 0.07, y);
      g.lineTo(x, y - r * 0.12);
      g.lineTo(x + r * 0.07, y);
      g.closePath();
      g.fill();
  }
}
// The boundary runs along all four edges, with a gate on the side facing the town.
function drawFieldBoundary(g, b, place, points, r, p) {
  const style = farmlandBoundaryStyle(place),
    dx = place.x - b.x,
    dy = place.y - b.y,
    gateSide = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 3 : 1) : dy < 0 ? 0 : 2,
    perSide = Math.max(3, Math.min(9, Math.round(r / 5)));
  if (style === "fence") {
    g.strokeStyle = hsl(32, 35, 34);
    g.lineWidth = Math.max(1, r * 0.03);
    for (let side = 0; side < 4; side++) {
      const from = points[side],
        to = points[(side + 1) % 4],
        spans = side === gateSide ? [[0, 0.36], [0.64, 1]] : [[0, 1]];
      for (const [a, c] of spans) {
        g.beginPath();
        g.moveTo(lerp(from[0], to[0], a), lerp(from[1], to[1], a) - r * 0.1);
        g.lineTo(lerp(from[0], to[0], c), lerp(from[1], to[1], c) - r * 0.1);
        g.stroke();
      }
    }
  }
  let k = 0;
  for (let side = 0; side < 4; side++) {
    const from = points[side],
      to = points[(side + 1) % 4];
    for (let n = 0; n <= perSide; n++) {
      const t = n / perSide;
      if (side === gateSide && t > 0.36 && t < 0.64) continue;
      if (n === perSide && side < 3) continue;
      farmlandMark(g, style, lerp(from[0], to[0], t), lerp(from[1], to[1], t), r, p, k++);
    }
  }
  FARMLAND.boundaries++;
  return style;
}
function drawOrchard(g, points, r, season, seed) {
  const bare = season.bare > 0.5;
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      const [x, y] = cropQuadPoint(points, 0.2 + col * 0.3, 0.2 + row * 0.3),
        size = r * (0.11 + visualHash01(seed + row * 3 + col, 0x77) * 0.04);
      g.strokeStyle = hsl(28, 30, 28);
      g.lineWidth = Math.max(1, r * 0.025);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y - size * 1.1);
      g.stroke();
      if (bare) continue;
      g.fillStyle = season.fall > 0.4 ? hsl(30 + (row + col) * 6, 62, 48) : hsl(108, 40, 32 + (row + col) * 2);
      g.beginPath();
      g.arc(x, y - size * 1.4, size, 0, Math.PI * 2);
      g.fill();
      if (!bare && season.fall < 0.4 && (row + col) % 2 === 0) {
        g.fillStyle = hsl(8, 70, 52);
        g.beginPath();
        g.arc(x + size * 0.4, y - size * 1.2, Math.max(0.6, size * 0.2), 0, Math.PI * 2);
        g.fill();
      }
    }
  FARMLAND.orchards++;
}
function drawFieldShed(g, x, y, r, p) {
  const w = r * 0.42,
    h = r * 0.26;
  g.fillStyle = p.dark;
  g.fillRect(x - w / 2, y - h, w, h);
  g.fillStyle = p.accent;
  g.beginPath();
  g.moveTo(x - w * 0.58, y - h);
  g.lineTo(x, y - h - r * 0.18);
  g.lineTo(x + w * 0.58, y - h);
  g.closePath();
  g.fill();
  g.fillStyle = hsl(30, 25, 18);
  g.fillRect(x - w * 0.12, y - h * 0.7, w * 0.24, h * 0.7);
  FARMLAND.sheds++;
}
function drawSilo(g, x, y, r, p) {
  const w = r * 0.26,
    h = r * 0.62;
  g.fillStyle = p.base;
  g.fillRect(x - w / 2, y - h, w, h);
  g.fillStyle = p.light;
  g.fillRect(x - w / 2, y - h, w * 0.3, h);
  g.fillStyle = p.dark;
  g.beginPath();
  g.ellipse(x, y - h, w / 2, w * 0.3, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.strokeStyle = p.dark;
  g.lineWidth = Math.max(0.8, r * 0.015);
  for (let n = 1; n < 4; n++) {
    g.beginPath();
    g.moveTo(x - w / 2, y - (h * n) / 4);
    g.lineTo(x + w / 2, y - (h * n) / 4);
    g.stroke();
  }
  FARMLAND.silos++;
}
function drawTractor(g, x, y, r, hue) {
  const L = r * 0.42,
    body = hsl(hue, 60, 44),
    dark = hsl(hue, 40, 22);
  g.fillStyle = "rgba(6,6,10,0.3)";
  g.beginPath();
  g.ellipse(x, y + r * 0.02, L * 0.6, r * 0.05, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = body;
  g.fillRect(x - L * 0.45, y - r * 0.2, L * 0.7, r * 0.14);
  g.fillRect(x - L * 0.35, y - r * 0.36, L * 0.3, r * 0.18);
  g.fillStyle = hsl(205, 50, 74, 0.9);
  g.fillRect(x - L * 0.3, y - r * 0.34, L * 0.2, r * 0.1);
  g.strokeStyle = dark;
  g.lineWidth = Math.max(0.8, r * 0.02);
  g.beginPath();
  g.moveTo(x + L * 0.15, y - r * 0.2);
  g.lineTo(x + L * 0.15, y - r * 0.4);
  g.stroke();
  g.fillStyle = dark;
  g.beginPath();
  g.arc(x - L * 0.32, y - r * 0.02, r * 0.12, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(x + L * 0.28, y, r * 0.075, 0, Math.PI * 2);
  g.fill();
  FARMLAND.tractors++;
}
function drawPasture(g, b, points, r, p) {
  const herd = (W.herds || []).find((h) => h.active && h.enclosureBuildingId === b.id),
    head = herd ? Math.min(6, (herd.animalIds || herd.memberIds || []).length || 0) : 0;
  if (head > 0) {
    for (let n = 0; n < head; n++) {
      const [x, y] = cropQuadPoint(points, 0.2 + visualHash01(b.id + n, 0x88) * 0.6, 0.2 + visualHash01(b.id + n, 0x99) * 0.6);
      g.fillStyle = hsl(30 + n * 7, 25, 40 + (n % 2) * 18);
      g.beginPath();
      g.ellipse(x, y - r * 0.06, r * 0.1, r * 0.065, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(x + r * 0.09, y - r * 0.09, r * 0.04, 0, Math.PI * 2);
      g.fill();
      FARMLAND.stock++;
    }
    return;
  }
  const [tx, ty] = cropQuadPoint(points, 0.3, 0.7),
    [hx, hy] = cropQuadPoint(points, 0.72, 0.3);
  g.fillStyle = p.dark;
  g.fillRect(tx - r * 0.16, ty - r * 0.09, r * 0.32, r * 0.09);
  g.fillStyle = hsl(W.terrainGenome?.liquidHue || 195, 50, 55, 0.9);
  g.fillRect(tx - r * 0.13, ty - r * 0.08, r * 0.26, r * 0.04);
  g.strokeStyle = hsl(30, 30, 32);
  g.lineWidth = Math.max(0.8, r * 0.025);
  g.beginPath();
  g.moveTo(hx - r * 0.12, hy);
  g.lineTo(hx - r * 0.06, hy - r * 0.22);
  g.lineTo(hx + r * 0.06, hy - r * 0.22);
  g.lineTo(hx + r * 0.12, hy);
  g.stroke();
  g.fillStyle = hsl(42, 55, 60);
  g.beginPath();
  g.ellipse(hx, hy - r * 0.14, r * 0.07, r * 0.05, 0, 0, Math.PI * 2);
  g.fill();
  FARMLAND.troughs++;
}
const drawBuildingSiteFarmlandBase = drawBuildingSite;
drawBuildingSite = function (g, b, now, m) {
  drawBuildingSiteFarmlandBase(g, b, now, m);
  if (!b.complete || b.ruined || b.abandoned || b.placeKind !== "settlement" || UI.quality === "low" || UI.camera.zoom < FARMLAND_MIN_ZOOM) return;
  if (b.type !== "farm" && b.type !== "corral") return;
  const place = buildingPlace(b);
  if (!place) return;
  const points = buildingTileFootprintPoints(b, m, 3),
    r = buildingScreenSize(b, m),
    p = buildingPalette(b),
    season = typeof groveSeason === "function" ? groveSeason(b.x, b.y) : { fall: 0, bare: 0 };
  g.save();
  if (b.type === "corral") {
    drawPasture(g, b, points, r, p);
    g.restore();
    return;
  }
  const h1 = visualHash01(b.id, 0x611),
    h2 = visualHash01(b.id, 0x722),
    h3 = visualHash01(b.id, 0x833),
    far = Math.max(Math.abs(b.x - place.x), Math.abs(b.y - place.y)) >= FARMLAND_SHED_DISTANCE;
  if (season.bare > 0.5) {
    g.fillStyle = hsl(200, 25, 82, 0.2 + season.bare * 0.18);
    g.beginPath();
    g.moveTo(points[0][0], points[0][1]);
    for (let n = 1; n < 4; n++) g.lineTo(points[n][0], points[n][1]);
    g.closePath();
    g.fill();
    FARMLAND.frost++;
  }
  if (h1 < FARMLAND_ORCHARD_SHARE && place.knownProcesses.includes("agriculture")) drawOrchard(g, points, r, season, b.styleSeed || b.id);
  drawFieldBoundary(g, b, place, points, r, p);
  if (far && h2 < 0.5) {
    const [x, y] = cropQuadPoint(points, 0.9, 0.1);
    drawFieldShed(g, x, y, r, p);
  }
  if (place.knownProcesses.includes("mechanization") && h3 < FARMLAND_SILO_SHARE) {
    const [x, y] = cropQuadPoint(points, 0.1, 0.12);
    drawSilo(g, x, y, r, p);
  }
  if (place.knownProcesses.includes("combustion") && h2 >= 0.5 && h2 < 0.5 + FARMLAND_TRACTOR_SHARE) {
    const [x, y] = cropQuadPoint(points, 0.82, 0.88),
      f = place.factionId ? W.factions.find((c) => c.id === place.factionId) : null,
      hueMatch = String(f?.color || "").match(/hsl\(\s*(-?[\d.]+)/i);
    drawTractor(g, x, y, r, hueMatch ? Number(hueMatch[1]) : 8);
  }
  g.restore();
};
window.ALIFE_FARMLAND_DEBUG = Object.freeze({
  style: (placeId) => farmlandBoundaryStyle(W.settlements.find((s) => s.id === placeId)),
  counts: () => ({ ...FARMLAND }),
  reset: () => {
    for (const k of Object.keys(FARMLAND)) FARMLAND[k] = 0;
  },
});
