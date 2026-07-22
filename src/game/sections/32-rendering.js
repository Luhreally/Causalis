// ═══════════════════════════════════════════════════════════════════════════
// 32. RENDER LENSES
// ═══════════════════════════════════════════════════════════════════════════
const ctx = $("#world").getContext("2d", { alpha: false });
const BIOME_COLORS = Object.freeze({
  "Deep Water": "#173b4a",
  "Shallow Water": "#245766",
  Mountain: "#64696c",
  "Ash Waste": "#4d4946",
  "Burned Ground": "#3b302c",
  "Dry Scrub": "#8a704c",
  Desert: "#a58b5c",
  Swamp: "#3f6556",
  Forest: "#345f45",
  "Fertile Basin": "#669052",
  Grassland: "#66844d",
  "Stone Upland": "#74766b",
  "Sand Plain": "#927f58",
});
function resizeCanvas() {
  const c = DOM.canvas,
    dpr = Math.min(2, devicePixelRatio || 1),
    r = c.getBoundingClientRect();
  if (c.width !== Math.floor(r.width * dpr) || c.height !== Math.floor(r.height * dpr)) {
    c.width = Math.max(1, Math.floor(r.width * dpr));
    c.height = Math.max(1, Math.floor(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    c._dpr = dpr;
  }
}
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
function terrainColor(i) {
  const base = BIOME_COLORS[biomeAt(i)] || "#566b55",
    e = W.tiles.elevation[i] / 1000,
    temp = W.tiles.temperature[i] / 10,
    shade = Math.floor((0.48 - e) * 20 + (temp < 0 ? -8 : 0));
  return shade > 0 ? base : darken(base, Math.abs(shade));
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
function renderWorld(now) {
  if (!W) return;
  resizeCanvas();
  if (UI.followId && W.components.position[UI.followId]) {
    const p = W.components.position[UI.followId];
    UI.camera.x = lerp(UI.camera.x, p.x, 0.16);
    UI.camera.y = lerp(UI.camera.y, p.y, 0.16);
  }
  const m = projectionMetrics();
  ctx.fillStyle = "#071016";
  ctx.fillRect(0, 0, m.w, m.h);
  const b = visibleBounds(),
    step = UI.quality === "low" && UI.camera.zoom < 0.7 ? 2 : 1;
  if (UI.view === "top")
    for (let y = b.y0; y <= b.y1; y += step)
      for (let x = b.x0; x <= b.x1; x += step) drawTile(x, y, step);
  else
    for (let sum = b.x0 + b.y0; sum <= b.x1 + b.y1; sum++)
      for (let x = b.x0; x <= b.x1; x++) {
        const y = sum - x;
        if (y < b.y0 || y > b.y1) continue;
        drawTile(x, y, 1);
      }
  drawEntities(now, b);
  drawSelection();
  drawBrushPreview();
  UI.lastRender = now;
}
function drawTile(x, y, step) {
  const i = idx(x, y),
    poly = tilePolygon(x, y);
  polygonPath(poly);
  ctx.fillStyle = terrainColor(i);
  ctx.fill();
  if (UI.view !== "top" && W.tiles.elevation[i] > 620 && UI.quality !== "low") {
    const drop = Math.min(7, W.tiles.elevation[i] / 180) * UI.camera.zoom;
    ctx.beginPath();
    ctx.moveTo(poly[1][0], poly[1][1]);
    ctx.lineTo(poly[2][0], poly[2][1]);
    ctx.lineTo(poly[2][0], poly[2][1] + drop);
    ctx.lineTo(poly[1][0], poly[1][1] + drop);
    ctx.closePath();
    ctx.fillStyle = "#222b2c";
    ctx.fill();
  }
  if (W.tiles.liquid[i] > 140) {
    polygonPath(poly);
    ctx.fillStyle = `rgba(39,127,151,${clamp(W.tiles.liquid[i] / 2200, 0.18, 0.68)})`;
    ctx.fill();
  }
  if (W.tiles.plantOrder[i] > 250 && W.tiles.liquid[i] < 700 && UI.camera.zoom > 0.45) {
    const p = projectTile(x + 0.5, y + 0.5),
      alpha = clamp(W.tiles.plantOrder[i] / 1000, 0.15, 0.75);
    ctx.fillStyle = `rgba(84,150,74,${alpha})`;
    const r = Math.max(1, projectionMetrics().tw * 0.12);
    ctx.beginPath();
    ctx.arc(p.x, p.y - r * 0.3, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (UI.overlay) {
    polygonPath(poly);
    ctx.fillStyle = overlayStyle(UI.overlay, i);
    ctx.fill();
  }
  if (W.tiles.fire[i] > 25) {
    const p = projectTile(x + 0.5, y + 0.5),
      f = clamp(W.tiles.fire[i] / 800, 0, 1),
      r = Math.max(1.2, projectionMetrics().tw * 0.18 * (0.5 + f));
    ctx.fillStyle = hsl(25 + f * 25, 95, 58, 0.75);
    ctx.beginPath();
    ctx.arc(p.x, p.y - r * 0.4, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (
    UI.quality === "high" &&
    UI.view === "top" &&
    W.tiles.owner[i] &&
    ((x < W.width - 1 && W.tiles.owner[i + 1] !== W.tiles.owner[i]) ||
      (y < W.height - 1 && W.tiles.owner[i + W.width] !== W.tiles.owner[i]))
  ) {
    ctx.strokeStyle = W.factions.find((f) => f.id === W.tiles.owner[i])?.color || "#aaa";
    ctx.lineWidth = 0.7;
    polygonPath(poly);
    ctx.stroke();
  }
}
function drawEntities(now, b) {
  const labels = [];
  for (const id of W.activeIds) {
    const p = W.components.position[id],
      k = W.kind[id];
    if (
      !p ||
      p.x < b.x0 - 2 ||
      p.x > b.x1 + 2 ||
      p.y < b.y0 - 2 ||
      p.y > b.y1 + 2 ||
      k === "faction" ||
      k === "culture"
    )
      continue;
    const s = projectTile(p.x + 0.5, p.y + 0.5),
      ident = W.components.identity[id] || {},
      social = W.components.social[id],
      fac = social?.factionId ? W.factions.find((f) => f.id === social.factionId) : null;
    if (k === KINDS.SETTLEMENT || k === KINDS.CAMP || k === "ruin") {
      drawPlace(id, k, s);
      const place =
        W.settlements.find((q) => q.entityId === id) || W.camps.find((q) => q.entityId === id);
      if (UI.labels && place)
        labels.push({
          x: s.x,
          y: s.y - 12,
          text: place.name,
          color: k === "ruin" ? "#94877d" : "#e3d5b6",
        });
      continue;
    }
    if (k === KINDS.ARTIFACT) {
      ctx.fillStyle = "#e2c878";
      ctx.beginPath();
      for (let n = 0; n < 8; n++) {
        const a = (n * Math.PI) / 4,
          r = n % 2 ? 2 : 5;
        ctx.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
      }
      ctx.fill();
      continue;
    }
    const ph = W.components.genome[id] ? phenotype(id) : { size: 1, hue: 0, aggression: 0 },
      life = W.components.life[id],
      r = clamp(2.1 * ph.size * UI.camera.zoom, 1.5, 7),
      ageDim = life ? clamp(1 - life.age / (W.components.body[id].maxAge * 1.8), 0.45, 1) : 0.5;
    color =
      k === KINDS.CORPSE
        ? "#372f31"
        : hsl(ph.hue, k === KINDS.PERSON ? 52 : 64, 42 + ageDim * 20, 1);
    ctx.save();
    if (UI.view !== "top") {
      ctx.fillStyle = "#0005";
      ctx.beginPath();
      ctx.ellipse(s.x + 2, s.y + 3, r * 1.2, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.strokeStyle = fac?.color || "#081015";
    ctx.lineWidth = fac ? 1.4 : 0.65;
    if (k === KINDS.PREDATOR) {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r * 1.5);
      ctx.lineTo(s.x + r * 1.2, s.y + r);
      ctx.lineTo(s.x - r * 1.2, s.y + r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (k === KINDS.HERBIVORE || k === KINDS.CORPSE) {
      ctx.beginPath();
      ctx.ellipse(
        s.x,
        s.y,
        r * 1.15,
        r * (k === KINDS.CORPSE ? 0.45 : 0.9),
        ph.aggression * 0.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
    } else if (k === KINDS.PERSON) {
      ctx.beginPath();
      ctx.arc(s.x, s.y - r * 0.75, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r * 0.15);
      ctx.lineTo(s.x, s.y + r * 1.15);
      ctx.moveTo(s.x - r * 0.8, s.y + r * 0.25);
      ctx.lineTo(s.x + r * 0.8, s.y + r * 0.25);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.4, r * 0.55);
      ctx.stroke();
    }
    if (life?.infected) {
      ctx.fillStyle = "#d381e2";
      ctx.beginPath();
      ctx.arc(s.x + r * 0.6, s.y - r * 0.55, Math.max(1, r * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    if (life?.wounded) {
      ctx.strokeStyle = "#e45f56";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x - r, s.y - r);
      ctx.lineTo(s.x + r, s.y + r);
      ctx.stroke();
    }
    if (ident.notable) {
      ctx.strokeStyle = ident.legendary ? "#f2d276" : "#cfb76f";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 3 + Math.sin(now / 350 + id) * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      if (UI.labels)
        labels.push({
          x: s.x,
          y: s.y - r - 8,
          text: ident.generatedName,
          color: ident.legendary ? "#f2d276" : "#d7c9a9",
        });
    }
    ctx.restore();
  }
  if (labels.length && UI.camera.zoom > 0.55) {
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (const l of labels) {
      const w = ctx.measureText(l.text).width;
      ctx.fillStyle = "#071016c9";
      ctx.fillRect(l.x - w / 2 - 3, l.y - 11, w + 6, 13);
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, l.x, l.y);
    }
  }
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
