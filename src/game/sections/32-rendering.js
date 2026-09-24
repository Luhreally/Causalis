// ═══════════════════════════════════════════════════════════════════════════
// 32. RENDER LENSES
// ═══════════════════════════════════════════════════════════════════════════
const ctx = $("#world").getContext("2d", { alpha: false });
function cameraAngle() {
  return Number.isFinite(UI.camera.angle) ? UI.camera.angle : -0.35;
}
function cameraTilt() {
  return clamp(Number.isFinite(UI.camera.tilt) ? UI.camera.tilt : 0.58, 0.22, 1);
}
function projectionMetrics() {
  const w = DOM.canvas.clientWidth,
    h = DOM.canvas.clientHeight,
    z = UI.camera.zoom;
  if (UI.view === "top") return { w, h, tw: 5.5 * z, th: 5.5 * z };
  if (UI.view === "iso") return { w, h, tw: 10 * z, th: 5 * z };
  return { w, h, tw: 6.4 * z, th: 6.4 * z * cameraTilt() };
}
function obliqueBasis(m) {
  const a = cameraAngle(),
    c = Math.cos(a),
    s = Math.sin(a);
  return { c, s, xx: c * m.tw, xy: -s * m.th, yx: s * m.tw, yy: c * m.th };
}
function projectWithMetrics(x, y, e, m) {
  if (UI.view === "top")
    return { x: m.w / 2 + (x - UI.camera.x) * m.tw, y: m.h / 2 + (y - UI.camera.y) * m.th };
  if (UI.view === "iso")
    return {
      x: m.w / 2 + ((x - UI.camera.x - (y - UI.camera.y)) * m.tw) / 2,
      y: m.h / 2 + ((x - UI.camera.x + (y - UI.camera.y)) * m.th) / 2 - e * 13 * UI.camera.zoom,
    };
  const q = obliqueBasis(m),
    dx = x - UI.camera.x,
    dy = y - UI.camera.y;
  return {
    x: m.w / 2 + (dx * q.c + dy * q.s) * m.tw,
    y:
      m.h / 2 +
      (-dx * q.s + dy * q.c) * m.th -
      e * 18 * UI.camera.zoom * (1.12 - cameraTilt() * 0.35),
  };
}
function projectTile(x, y, withElevation = true) {
  const m = projectionMetrics(),
    e =
      withElevation && W
        ? W.tiles.elevation[
            idx(clamp(Math.floor(x), 0, W.width - 1), clamp(Math.floor(y), 0, W.height - 1))
          ] / 1000
        : 0;
  return projectWithMetrics(x, y, e, m);
}
function tilePolygon(x, y) {
  const m = projectionMetrics(),
    p = projectTile(x + 0.5, y + 0.5);
  if (UI.view === "top")
    return [
      [p.x - m.tw / 2, p.y - m.th / 2],
      [p.x + m.tw / 2, p.y - m.th / 2],
      [p.x + m.tw / 2, p.y + m.th / 2],
      [p.x - m.tw / 2, p.y + m.th / 2],
    ];
  if (UI.view === "iso")
    return [
      [p.x, p.y - m.th / 2],
      [p.x + m.tw / 2, p.y],
      [p.x, p.y + m.th / 2],
      [p.x - m.tw / 2, p.y],
    ];
  const q = obliqueBasis(m),
    hx = q.xx * 0.5,
    hy = q.xy * 0.5,
    kx = q.yx * 0.5,
    ky = q.yy * 0.5;
  return [
    [p.x - hx - kx, p.y - hy - ky],
    [p.x + hx - kx, p.y + hy - ky],
    [p.x + hx + kx, p.y + hy + ky],
    [p.x - hx + kx, p.y - hy + ky],
  ];
}
function polygonPath(poly) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let n = 1; n < poly.length; n++) ctx.lineTo(poly[n][0], poly[n][1]);
  ctx.closePath();
}
function pointInPoly(x, y, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if (
      p[i][1] > y !== p[j][1] > y &&
      x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]
    )
      c = !c;
  }
  return c;
}
function overlayValue(name, i) {
  switch (name) {
    case "elevation":
      return W.tiles.elevation[i] / 10;
    case "temperature":
      return clamp((W.tiles.temperature[i] / 10 + 25) * 1.4, 0, 100);
    case "fire":
      return clamp(W.tiles.fire[i] / 8 + Math.max(0, W.tiles.temperature[i] / 10 - 35), 0, 100);
    case "moisture":
      return tileMoisture(i);
    case "fertility":
      return tileFertility(i);
    case "food":
      return tileFood(i, "omnivore");
    case "blood":
      return tileBlood(i);
    case "fear":
      return tileFear(i);
    case "disease":
      return tileDisease(i);
    case "danger":
      return clamp(W.tiles.danger[i] / 10, 0, 100);
    case "territory":
      return clamp(W.tiles.territory[i] / 10, 0, 100);
    case "culture":
      return clamp(W.tiles.culture[i] / 10, 0, 100);
    case "population":
      return clamp(
        (W.tiles.populationPressure[i] + tilePopulation(i) * 150 + cohortPopulationAt(i) * 110) / 8,
        0,
        100,
      );
    case "resources":
      return tileResource(i);
    default:
      return 0;
  }
}
function overlayStyle(name, i) {
  const v = overlayValue(name, i),
    a = clamp((v / 100) * 0.72, 0, 0.72);
  if (name === "temperature" || name === "fire") return hsl(220 - v * 2.15, 90, 55, a);
  if (name === "moisture") return hsl(195, 85, 52, a);
  if (name === "fertility" || name === "food") return hsl(85 + v * 0.45, 75, 48, a);
  if (name === "blood") return hsl(355, 85, 48, a);
  if (name === "fear" || name === "danger") return hsl(28, 90, 55, a);
  if (name === "disease") return hsl(290, 75, 54, a);
  if (name === "resources") return hsl(48, 90, 55, a);
  if (name === "elevation") return `rgba(245,245,235,${a * 0.7})`;
  if (name === "population") return hsl(175, 90, 55, a);
  if (name === "territory") {
    const f = W.factions.find((x) => x.id === W.tiles.owner[i]);
    return f ? f.color.replace(")", ` / ${a})`).replace("hsl(", "hsl(") : "transparent";
  }
  if (name === "culture") {
    const c = W.tiles.cultureOwner[i];
    return c ? hsl(c * 79, 65, 58, a) : "transparent";
  }
  return "transparent";
}
function visibleBounds() {
  const m = projectionMetrics();
  if (UI.view === "top") {
    const rx = m.w / m.tw / 2 + 3,
      ry = m.h / m.th / 2 + 3;
    return {
      x0: clamp(Math.floor(UI.camera.x - rx), 0, W.width - 1),
      x1: clamp(Math.ceil(UI.camera.x + rx), 0, W.width - 1),
      y0: clamp(Math.floor(UI.camera.y - ry), 0, W.height - 1),
      y1: clamp(Math.ceil(UI.camera.y + ry), 0, W.height - 1),
    };
  }
  const radius = Math.ceil(Math.hypot(m.w / m.tw, m.h / Math.max(1, m.th)) * 0.72) + 22;
  return {
    x0: clamp(Math.floor(UI.camera.x - radius), 0, W.width - 1),
    x1: clamp(Math.ceil(UI.camera.x + radius), 0, W.width - 1),
    y0: clamp(Math.floor(UI.camera.y - radius), 0, W.height - 1),
    y1: clamp(Math.ceil(UI.camera.y + radius), 0, W.height - 1),
  };
}
function drawPlace(id, k, s) {
  const settlement = W.settlements.find((q) => q.entityId === id),
    camp = W.camps.find((q) => q.entityId === id),
    r = k === KINDS.SETTLEMENT ? 7 : k === "ruin" ? 6 : 4;
  ctx.save();
  ctx.translate(s.x, s.y);
  if (k === KINDS.CAMP) {
    ctx.fillStyle = "#ad8658";
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, r);
    ctx.lineTo(-r, r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#f0c77b";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    ctx.fillStyle =
      k === "ruin"
        ? "#504b49"
        : W.factions.find((f) => f.id === settlement?.factionId)?.color || "#c6ae78";
    ctx.fillRect(-r, -r * 0.55, r * 2, r * 1.35);
    ctx.fillStyle = "#172129";
    ctx.fillRect(-r * 0.35, -r * 0.2, r * 0.7, r);
    ctx.fillStyle = k === "ruin" ? "#352f2e" : "#d9c589";
    ctx.beginPath();
    ctx.moveTo(-r - 2, -r * 0.55);
    ctx.lineTo(0, -r * 1.5);
    ctx.lineTo(r + 2, -r * 0.55);
    ctx.fill();
  }
  ctx.restore();
}
