// ═══════════════════════════════════════════════════════════════════════════
// 113. GROVE AND CRAG — trees with species, mountains with faces, ground with grain
// ═══════════════════════════════════════════════════════════════════════════
// Every tree on an Earth-like world was the same three green ellipses on a
// straight trunk, every mountain feature the same triangle, and the ground
// between them carried only its tint and a grain mark. Now the canopy has
// species chosen by the ground it grows from: conifers on cold heights,
// broadleaves in the temperate lowlands, birches where it is cool, willows
// along the water, palms on warm wet shores, baobabs and thorn scrub in the
// dry, and the odd dead snag anywhere. Broadleaves, birches, and willows
// turn in the fall and stand bare in deep cold where it freezes, and all
// crowns lean with the wind. On alien worlds half the plain-crowned canopies
// take new forms: spirals, lanterns, and antler coral. Highland features
// become crags: two or three peaks with a lit face and a shaded face, strata
// on the shade, a snow cap where it is cold or high, and scree at the foot.
// The ground gains marks by biome: grass tufts and flowers, ferns and fallen
// logs, cracks and pebbles, reeds and pools, boulders and lichen, and snow
// where the air is below freezing; tall cliff faces show strata. Rendering
// only reads.
const TREE_SPECIES = Object.freeze(["broadleaf", "conifer", "palm", "birch", "willow", "baobab", "snag", "shrub"]),
  ALIEN_CANOPY_FORMS = Object.freeze(["spiral", "lantern", "coral"]),
  GROVE_MARK_ZOOM = 1.3,
  GROVE_MARK_DENSITY = 0.34,
  GROVE_STRATA_ZOOM = 1.6,
  GROVE = { trees: 0, crags: 0, marks: 0, snow: 0, strata: 0, alien: 0 };
function groveWaterNear(i) {
  const x = i % W.width,
    y = (i / W.width) | 0,
    t = W.tiles;
  return (
    (x > 0 && t.liquid[i - 1] > 140) ||
    (x < W.width - 1 && t.liquid[i + 1] > 140) ||
    (y > 0 && t.liquid[i - W.width] > 140) ||
    (y < W.height - 1 && t.liquid[i + W.width] > 140)
  );
}
// The species a tile grows: cold heights take conifers, warm dry ground
// baobabs and scrub, warm wet shores palms, water's edge willows, cool ground
// birches, and the temperate rest broadleaves, with a dead snag here and there.
function treeSpeciesAt(i) {
  const t = W.tiles,
    temp = t.temperature[i] / 10,
    moist = tileMoisture(i),
    e = t.elevation[i],
    h = visualHash01(i, 0x5e1e),
    water = groveWaterNear(i);
  if (e > 780 || temp < 6) return h < 0.86 ? "conifer" : "snag";
  if (temp > 26 && moist < 35) return h < 0.55 ? "baobab" : h < 0.88 ? "shrub" : "snag";
  if (temp > 24 && (water || moist > 60)) return h < 0.62 ? "palm" : "broadleaf";
  if (water && h < 0.5) return "willow";
  if (temp < 12 && h < 0.5) return "birch";
  if (h < 0.05) return "snag";
  if (h < 0.17) return "conifer";
  if (h < 0.27) return "birch";
  return "broadleaf";
}
// The turn of the leaves: full in the fall, bare in deep cold where it freezes.
function groveSeason(x, y) {
  if (typeof seasonPhase !== "function" || typeof seasonGenome !== "function" || !seasonGenome()?.amplitude) return { fall: 0, bare: 0 };
  let phase = seasonPhase();
  if (typeof seasonHemisphere === "function" && seasonHemisphere(x, y) < 0) phase = (phase + 0.5) % 1;
  const fall = clamp(1 - Math.abs(phase - 0.5) / 0.14, 0, 1),
    winter = clamp(1 - Math.abs(phase - 0.75) / 0.14, 0, 1),
    freezing = W.tiles.temperature[idx(x, y)] / 10 < 4;
  return { fall, bare: freezing ? winter : 0 };
}
function leafTone(v, species, season, i) {
  let hue = v.floraHue + (visualHash01(i, 0x315) - 0.5) * 16,
    light = 38;
  if (species === "conifer") {
    hue -= 12;
    light = 30;
  } else if (species === "birch") light = 46;
  else if (species === "willow") {
    hue += 10;
    light = 44;
  } else if (species === "palm") light = 40;
  else if (species === "baobab" || species === "shrub") {
    hue -= 18;
    light = 34;
  }
  if (season.fall > 0 && ["broadleaf", "birch", "willow"].includes(species)) {
    hue = mixHue(hue, 28, season.fall * 0.85);
    light += season.fall * 8;
  }
  return { hue: wrapHue(hue), light };
}
function drawTrunk(g, p, r, h, lean, tone, dark, width = 0.22) {
  g.strokeStyle = dark;
  g.fillStyle = tone;
  g.beginPath();
  g.moveTo(p.x - r * width, p.y + r * 0.25);
  g.lineTo(p.x + r * width, p.y + r * 0.25);
  g.lineTo(p.x + lean + r * width * 0.45, p.y - h);
  g.lineTo(p.x + lean - r * width * 0.45, p.y - h);
  g.closePath();
  g.fill();
  g.stroke();
}
function drawTreeSpecies(g, species, p, r, h, v, i, sway, season, detail) {
  const leaf = leafTone(v, species, season, i),
    crown = hsl(leaf.hue, 58, leaf.light, 0.96),
    crownLit = hsl(leaf.hue + 12, 62, leaf.light + 14, 0.95),
    crownDark = hsl(leaf.hue - 8, 52, leaf.light - 9, 0.96),
    bark = species === "birch" ? hsl(40, 12, 78) : species === "snag" ? hsl(30, 10, 52) : hsl(v.mineralHue, 38, species === "baobab" ? 44 : 28),
    barkDark = species === "birch" ? hsl(40, 10, 40) : hsl(v.mineralHue, 40, 18),
    L = ACTIVE_LIGHT_SCREEN || { x: -0.6, y: -0.4 },
    lean = (visualHash01(i, 0x2b7) - 0.5) * r * 0.5 + sway * 0.4;
  g.save();
  g.lineWidth = Math.max(1, r * 0.1);
  if (species === "shrub") {
    for (let n = 0; n < 3; n++) {
      g.fillStyle = n === 1 ? crownLit : crown;
      g.beginPath();
      g.ellipse(p.x + (n - 1) * r * 0.5 + sway * 0.3, p.y - r * 0.2 - (n % 2) * r * 0.15, r * 0.55, r * 0.38, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    return;
  }
  if (species === "snag") {
    drawTrunk(g, p, r, h * 0.8, lean, bark, barkDark, 0.16);
    g.strokeStyle = bark;
    g.lineWidth = Math.max(1, r * 0.12);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(p.x + lean * 0.5, p.y - h * 0.45);
    g.lineTo(p.x + lean * 0.5 - r * 0.7, p.y - h * 0.7);
    g.moveTo(p.x + lean * 0.7, p.y - h * 0.6);
    g.lineTo(p.x + lean * 0.7 + r * 0.55, p.y - h * 0.78);
    g.stroke();
    g.restore();
    return;
  }
  if (species === "baobab") {
    drawTrunk(g, p, r, h * 0.62, lean * 0.3, bark, barkDark, 0.42);
    g.strokeStyle = barkDark;
    g.lineWidth = Math.max(1, r * 0.1);
    g.beginPath();
    for (let n = -2; n <= 2; n++) {
      g.moveTo(p.x + lean * 0.3, p.y - h * 0.6);
      g.lineTo(p.x + lean * 0.3 + n * r * 0.5, p.y - h * 0.82);
    }
    g.stroke();
    if (!season.bare) {
      g.fillStyle = crown;
      g.beginPath();
      g.ellipse(p.x + lean * 0.3 + sway * 0.3, p.y - h * 0.85, r * 1.1, r * 0.3, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    return;
  }
  if (species === "palm") {
    g.strokeStyle = bark;
    g.lineWidth = Math.max(1.2, r * 0.17);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(p.x, p.y + r * 0.2);
    g.quadraticCurveTo(p.x + lean * 1.4, p.y - h * 0.5, p.x + lean * 2 + sway, p.y - h);
    g.stroke();
    const top = { x: p.x + lean * 2 + sway, y: p.y - h };
    g.strokeStyle = crownLit;
    g.lineWidth = Math.max(1, r * 0.12);
    for (let n = 0; n < 6; n++) {
      const a = -Math.PI * 0.95 + (n / 5) * Math.PI * 0.9,
        ex = top.x + Math.cos(a) * r * 1.15,
        ey = top.y + Math.sin(a) * r * 0.55 + r * 0.45;
      g.beginPath();
      g.moveTo(top.x, top.y);
      g.quadraticCurveTo(top.x + Math.cos(a) * r * 0.7, top.y - r * 0.25, ex, ey);
      g.stroke();
    }
    if (detail > 1) {
      g.fillStyle = hsl(30, 40, 30);
      g.beginPath();
      g.arc(top.x, top.y + r * 0.12, r * 0.12, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    return;
  }
  if (species === "conifer") {
    drawTrunk(g, p, r, h * 0.35, 0, bark, barkDark, 0.14);
    const tiers = detail > 1 ? 4 : 3,
      snowy = W.tiles.temperature[i] / 10 < 2;
    for (let n = 0; n < tiers; n++) {
      const yTop = p.y - h * (0.45 + (0.55 * (tiers - n)) / tiers),
        yBase = p.y - h * (0.28 + (0.55 * (tiers - n - 1)) / tiers) - r * 0.05,
        w = r * (0.35 + 0.22 * n),
        cx = p.x + sway * (1 - n / tiers) * 0.6;
      g.fillStyle = n % 2 ? crown : crownDark;
      g.beginPath();
      g.moveTo(cx, yTop);
      g.lineTo(cx + w, yBase);
      g.lineTo(cx - w, yBase);
      g.closePath();
      g.fill();
      if (snowy) {
        g.fillStyle = "rgba(240,246,255,0.85)";
        g.beginPath();
        g.moveTo(cx, yTop);
        g.lineTo(cx + w * 0.45, yTop + (yBase - yTop) * 0.45);
        g.lineTo(cx - w * 0.45, yTop + (yBase - yTop) * 0.45);
        g.closePath();
        g.fill();
      }
    }
    g.restore();
    return;
  }
  // Broadleaf, birch, willow: a trunk and a crown (or bare branches in deep cold).
  const slim = species === "birch" ? 0.13 : 0.2;
  drawTrunk(g, p, r, h * (species === "willow" ? 0.7 : 0.62), lean, bark, barkDark, slim);
  if (species === "birch" && detail) {
    g.strokeStyle = barkDark;
    g.lineWidth = Math.max(0.8, r * 0.05);
    g.beginPath();
    for (let n = 1; n <= 3; n++) {
      const y = p.y - h * 0.15 * n;
      g.moveTo(p.x + (lean * n) / 5 - r * slim * 0.9, y);
      g.lineTo(p.x + (lean * n) / 5 + r * slim * 0.4, y);
    }
    g.stroke();
  }
  const cx = p.x + lean + sway,
    cy = p.y - h * 0.72;
  if (season.bare > 0.5) {
    g.strokeStyle = barkDark;
    g.lineWidth = Math.max(0.8, r * 0.07);
    g.lineCap = "round";
    g.beginPath();
    for (let n = -2; n <= 2; n++) {
      g.moveTo(cx, cy + h * 0.12);
      g.lineTo(cx + n * r * 0.42, cy - h * (0.18 + 0.06 * (2 - Math.abs(n))));
    }
    g.stroke();
    g.restore();
    return;
  }
  if (species === "willow") {
    g.fillStyle = crown;
    g.beginPath();
    g.ellipse(cx, cy, r * 0.8, r * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = crownLit;
    g.lineWidth = Math.max(0.8, r * 0.07);
    g.lineCap = "round";
    for (let n = -3; n <= 3; n++) {
      g.beginPath();
      g.moveTo(cx + n * r * 0.25, cy + r * 0.1);
      g.quadraticCurveTo(cx + n * r * 0.38 + sway * 0.4, cy + h * 0.25, cx + n * r * 0.3 + sway * 0.6, cy + h * 0.5);
      g.stroke();
    }
    g.restore();
    return;
  }
  const lobes = species === "birch" ? 2 : detail > 1 ? 4 : 3,
    spread = species === "birch" ? 0.45 : 0.75;
  for (let n = 0; n < lobes; n++) {
    const a = (n / lobes) * Math.PI * 2 + visualHash01(i, 0x9c + n) * 0.6,
      ox = Math.cos(a) * r * spread * 0.55,
      oy = Math.sin(a) * r * spread * 0.35 - r * 0.1,
      lit = ox * L.x + oy * L.y < 0;
    g.fillStyle = lit ? crownLit : n % 2 ? crown : crownDark;
    g.beginPath();
    g.ellipse(cx + ox, cy + oy, r * (species === "birch" ? 0.55 : 0.72), r * (species === "birch" ? 0.42 : 0.56), 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = crownLit;
  g.beginPath();
  g.ellipse(cx - L.x * r * 0.25, cy - Math.abs(L.y) * r * 0.3 - r * 0.15, r * 0.5, r * 0.32, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
// Alien plain-crowned canopies split between the old crown and three new forms.
function drawAlienCanopy(g, form, p, r, h, hue, phase, sway) {
  g.save();
  g.strokeStyle = hsl(hue + 18, 70, 65, 0.9);
  g.fillStyle = hsl(hue, 58, 38, 0.96);
  g.lineWidth = Math.max(1, r * 0.14);
  g.lineCap = "round";
  if (form === "spiral") {
    g.beginPath();
    for (let t = 0; t <= 1.001; t += 0.05) {
      const a = t * Math.PI * 4 + phase,
        rr = r * 0.15 + t * r * 0.7,
        x = p.x + sway * t + Math.cos(a) * rr,
        y = p.y - h * (0.2 + t * 0.75) + Math.sin(a) * rr * 0.4;
      if (t === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  } else if (form === "lantern") {
    g.strokeStyle = hsl(hue, 40, 30, 0.9);
    g.beginPath();
    g.moveTo(p.x, p.y + r * 0.2);
    g.lineTo(p.x + sway, p.y - h * 0.9);
    g.stroke();
    for (let n = 0; n < 4; n++) {
      const a = phase + n * 1.6,
        x = p.x + sway * 0.8 + Math.cos(a) * r * 0.6,
        y = p.y - h * (0.55 + 0.1 * (n % 2));
      g.strokeStyle = hsl(hue, 40, 30, 0.9);
      g.beginPath();
      g.moveTo(p.x + sway * 0.85, p.y - h * 0.85);
      g.lineTo(x, y);
      g.stroke();
      g.fillStyle = hsl(hue + 40, 80, 62, 0.95);
      g.beginPath();
      g.ellipse(x, y + r * 0.2, r * 0.22, r * 0.3, 0, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    // Coral: antler strokes forking upward.
    g.strokeStyle = hsl(hue + 10, 55, 48, 0.95);
    g.lineWidth = Math.max(1, r * 0.16);
    const fork = (x0, y0, len, a, depth) => {
      const x1 = x0 + Math.cos(a) * len,
        y1 = y0 + Math.sin(a) * len;
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      if (depth > 0) {
        fork(x1, y1, len * 0.62, a - 0.5, depth - 1);
        fork(x1, y1, len * 0.62, a + 0.45, depth - 1);
      }
    };
    g.beginPath();
    fork(p.x, p.y + r * 0.2, h * 0.4, -Math.PI / 2 + sway * 0.05, 2);
    g.stroke();
  }
  g.restore();
}
const drawEcologicalStructureGroveBase = drawEcologicalStructure;
drawEcologicalStructure = function (x, y, i, p, m, v, inst = null) {
  const type = W.tiles.featureType?.[i] || 0,
    spec = featureSpecAt(i);
  if (!type || !spec) return drawEcologicalStructureGroveBase(x, y, i, p, m, v, inst);
  if (type === TERRAIN_FEATURE.CANOPY) {
    const plain = !["fungal", "crystal", "ribbon", "fan", "bubble"].includes(spec.form);
    if (!plain) return drawEcologicalStructureGroveBase(x, y, i, p, m, v, inst);
    const at = inst ? { x: p.x + inst.dx, y: p.y + inst.dy } : p,
      strength = (W.tiles.featureStrength[i] || 500) / 1000,
      scale = (spec.scale || 1) * (inst ? inst.s : 1) * (0.82 + visualHash01(i, 0x77 + (inst ? Math.round(inst.s * 100) : 0)) * 0.36),
      r = Math.max(3, m.tw * (0.2 + strength * 0.44)) * scale,
      h = Math.max(5, featureVerticalUnit(m) * (0.7 + strength * 2.4)) * scale,
      sway = windSwayAt(v, x, y) * r * 0.45,
      detail = UI.camera.zoom > 2.2 && UI.quality !== "low" ? 2 : 1;
    if (UI.view !== "top" && UI.camera.zoom < 0.55) return drawEcologicalStructureGroveBase(x, y, i, p, m, v, inst);
    if (UI.view !== "top") {
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.beginPath();
      ctx.ellipse(at.x + r * 0.22, at.y + r * 0.28, r * 0.9, r * 0.28, -0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    if (v.earthlike) {
      drawTreeSpecies(ctx, treeSpeciesAt(i), at, r, h, v, i, sway, groveSeason(x, y), detail);
      GROVE.trees++;
      return;
    }
    const pick = visualHash01(i, 0xa11e);
    if (pick < 0.5) return drawEcologicalStructureGroveBase(x, y, i, p, m, v, inst);
    drawAlienCanopy(ctx, ALIEN_CANOPY_FORMS[Math.floor((pick - 0.5) * 2 * ALIEN_CANOPY_FORMS.length) % ALIEN_CANOPY_FORMS.length], at, r, h, v.floraHue + (spec.hueShift || 0), visualHash01(i, 0xb731) * Math.PI * 2, sway);
    GROVE.alien++;
    return;
  }
  if (type === TERRAIN_FEATURE.HIGHLAND && spec.form !== "mesa" && spec.form !== "arch") {
    if (UI.view !== "top" && UI.camera.zoom < 0.55) return drawEcologicalStructureGroveBase(x, y, i, p, m, v, inst);
    drawCrag(x, y, i, p, m, v, spec, inst);
    return;
  }
  return drawEcologicalStructureGroveBase(x, y, i, p, m, v, inst);
};
// ── Crags: peaks with a lit face, a shaded face, strata, snow, and scree ──────
function drawCrag(x, y, i, p, m, v, spec, inst) {
  const at = inst ? { x: p.x + inst.dx, y: p.y + inst.dy } : p,
    strength = (W.tiles.featureStrength[i] || 500) / 1000,
    scale = (spec.scale || 1) * (inst ? inst.s : 1),
    r = Math.max(3, m.tw * (0.2 + strength * 0.44) * scale),
    h = Math.max(5, featureVerticalUnit(m) * (0.7 + strength * 2.4) * scale) * (spec.form === "blade" ? 1.2 : 1),
    hue = v.mineralHue + (spec.hueShift || 0),
    L = ACTIVE_LIGHT_SCREEN || { x: -0.6, y: -0.4 },
    litLeft = L.x < 0,
    temp = W.tiles.temperature[i] / 10,
    snowy = temp < 2 || W.tiles.elevation[i] > 900,
    peaks = 2 + (visualHash01(i, 0xc4a) < 0.45 ? 1 : 0),
    g = ctx;
  g.save();
  if (UI.view !== "top") {
    g.fillStyle = "rgba(0,0,0,.28)";
    g.beginPath();
    g.ellipse(at.x + r * 0.2, at.y + r * 0.3, r * 1.1, r * 0.3, -0.1, 0, Math.PI * 2);
    g.fill();
  }
  const lit = hsl(hue + 8, 30, 52, 0.98),
    shade = hsl(hue - 6, 28, 33, 0.98),
    edge = hsl(hue + 12, 30, 22, 0.9);
  for (let k = 0; k < peaks; k++) {
    const t = peaks === 1 ? 0.5 : k / (peaks - 1),
      px = at.x + (t - 0.5) * r * 1.3,
      ph = h * (k === Math.floor(peaks / 2) ? 1 : 0.6 + visualHash01(i, 0x3d + k) * 0.25),
      pw = r * (0.55 + 0.25 * visualHash01(i, 0x5d + k)),
      base = at.y + r * 0.42,
      apex = { x: px + (visualHash01(i, 0x7d + k) - 0.5) * r * 0.2, y: base - ph };
    // Lit face and shaded face split at the apex.
    g.fillStyle = litLeft ? lit : shade;
    g.beginPath();
    g.moveTo(px - pw, base);
    g.lineTo(apex.x, apex.y);
    g.lineTo(apex.x + pw * 0.06, base);
    g.closePath();
    g.fill();
    g.fillStyle = litLeft ? shade : lit;
    g.beginPath();
    g.moveTo(apex.x, apex.y);
    g.lineTo(px + pw, base);
    g.lineTo(apex.x - pw * 0.06, base);
    g.closePath();
    g.fill();
    g.strokeStyle = edge;
    g.lineWidth = Math.max(0.8, r * 0.06);
    g.beginPath();
    g.moveTo(px - pw, base);
    g.lineTo(apex.x, apex.y);
    g.lineTo(px + pw, base);
    g.stroke();
    if (UI.camera.zoom > 1.2 && UI.quality !== "low") {
      // Strata on the shaded face.
      g.strokeStyle = hsl(hue, 20, 18, 0.35);
      g.lineWidth = Math.max(0.6, r * 0.035);
      g.beginPath();
      for (let n = 1; n <= 3; n++) {
        const f = n / 4,
          yy = apex.y + (base - apex.y) * f,
          half = pw * f;
        if (litLeft) {
          g.moveTo(apex.x, yy);
          g.lineTo(apex.x + half * 0.9, yy + half * 0.06);
        } else {
          g.moveTo(apex.x - half * 0.9, yy + half * 0.06);
          g.lineTo(apex.x, yy);
        }
      }
      g.stroke();
      GROVE.strata++;
    }
    if (snowy) {
      const f = 0.28;
      g.fillStyle = "rgba(244,248,255,0.92)";
      g.beginPath();
      g.moveTo(apex.x, apex.y);
      g.lineTo(apex.x + pw * f, apex.y + (base - apex.y) * f);
      g.lineTo(apex.x + pw * f * 0.3, apex.y + (base - apex.y) * f * 1.15);
      g.lineTo(apex.x - pw * f * 0.5, apex.y + (base - apex.y) * f * 0.9);
      g.lineTo(apex.x - pw * f, apex.y + (base - apex.y) * f);
      g.closePath();
      g.fill();
      GROVE.snow++;
    }
  }
  if (UI.camera.zoom > 1.6 && UI.quality !== "low") {
    // Scree at the foot.
    g.fillStyle = hsl(hue, 18, 40, 0.8);
    for (let n = 0; n < 4; n++) {
      g.beginPath();
      g.ellipse(at.x + (visualHash01(i, 0xe0 + n) - 0.5) * r * 2.2, at.y + r * (0.36 + visualHash01(i, 0xf0 + n) * 0.16), r * 0.09, r * 0.05, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
  GROVE.crags++;
}
// ── Ground marks by biome ────────────────────────────────────────────────────
function drawGroundMark(x, y, i, p, m, v, biome, seed) {
  const r = Math.max(1.2, m.tw * 0.14),
    g = ctx,
    jx = (visualHash01(i, 0x1a1) - 0.5) * m.tw * 0.5,
    jy = (visualHash01(i, 0x1b1) - 0.5) * m.th * 0.4,
    cx = p.x + jx,
    cy = p.y + jy,
    temp = W.tiles.temperature[i] / 10;
  g.save();
  g.lineCap = "round";
  if (temp < 0 && W.tiles.liquid[i] <= 140) {
    g.fillStyle = "rgba(236,242,250,0.55)";
    g.beginPath();
    g.ellipse(cx, cy, r * 1.6, r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    GROVE.snow++;
  }
  if (biome === "Grassland" || biome === "Fertile Basin") {
    g.strokeStyle = hsl(v.floraHue + 6, 55, 46, 0.75);
    g.lineWidth = Math.max(0.6, r * 0.16);
    g.beginPath();
    for (let n = -1; n <= 1; n++) {
      g.moveTo(cx + n * r * 0.4, cy + r * 0.3);
      g.lineTo(cx + n * r * 0.6, cy - r * 0.7);
    }
    g.stroke();
    if (seed > 0.25 && biome === "Fertile Basin") {
      g.fillStyle = hsl(v.accentHue + (seed - 0.25) * 240, 70, 68, 0.9);
      g.beginPath();
      g.arc(cx + r * 0.7, cy - r * 0.2, r * 0.22, 0, Math.PI * 2);
      g.fill();
    }
  } else if (biome === "Forest") {
    if (seed < 0.17) {
      g.strokeStyle = hsl(v.mineralHue, 30, 26, 0.85);
      g.lineWidth = Math.max(1, r * 0.3);
      g.beginPath();
      g.moveTo(cx - r * 1.1, cy + r * 0.1);
      g.lineTo(cx + r * 1.1, cy - r * 0.2);
      g.stroke();
    } else {
      g.strokeStyle = hsl(v.floraHue - 10, 50, 40, 0.8);
      g.lineWidth = Math.max(0.6, r * 0.12);
      for (let n = -2; n <= 2; n++) {
        g.beginPath();
        g.moveTo(cx, cy + r * 0.3);
        g.quadraticCurveTo(cx + n * r * 0.4, cy - r * 0.3, cx + n * r * 0.9, cy - r * 0.2);
        g.stroke();
      }
    }
  } else if (biome === "Desert" || biome === "Sand Plain") {
    if (seed < 0.2) {
      g.strokeStyle = hsl(v.mineralHue, 25, 30, 0.45);
      g.lineWidth = Math.max(0.5, r * 0.08);
      g.beginPath();
      g.moveTo(cx - r, cy - r * 0.2);
      g.lineTo(cx - r * 0.2, cy + r * 0.1);
      g.lineTo(cx + r * 0.9, cy - r * 0.15);
      g.moveTo(cx - r * 0.2, cy + r * 0.1);
      g.lineTo(cx, cy + r * 0.6);
      g.stroke();
    } else {
      g.fillStyle = hsl(v.mineralHue, 22, 46, 0.85);
      for (let n = 0; n < 3; n++) {
        g.beginPath();
        g.ellipse(cx + (n - 1) * r * 0.6, cy + (n % 2) * r * 0.25, r * 0.22, r * 0.14, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (biome === "Dry Scrub") {
    g.strokeStyle = hsl(v.mineralHue + 20, 40, 52, 0.8);
    g.lineWidth = Math.max(0.6, r * 0.14);
    g.beginPath();
    for (let n = -2; n <= 2; n++) {
      g.moveTo(cx, cy + r * 0.3);
      g.lineTo(cx + n * r * 0.45, cy - r * 0.55);
    }
    g.stroke();
  } else if (biome === "Swamp") {
    g.fillStyle = hsl(v.liquidHue, 45, 26, 0.55);
    g.beginPath();
    g.ellipse(cx, cy + r * 0.2, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = hsl(v.floraHue - 20, 40, 34, 0.9);
    g.lineWidth = Math.max(0.6, r * 0.12);
    g.beginPath();
    for (let n = -1; n <= 1; n++) {
      g.moveTo(cx + n * r * 0.5, cy + r * 0.2);
      g.lineTo(cx + n * r * 0.55, cy - r * 1.1);
    }
    g.stroke();
  } else if (biome === "Mountain" || biome === "Stone Upland") {
    const L = ACTIVE_LIGHT_SCREEN || { x: -0.6, y: -0.4 };
    g.fillStyle = hsl(v.mineralHue, 16, 40, 0.95);
    g.beginPath();
    g.ellipse(cx, cy, r * 0.75, r * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hsl(v.mineralHue + 10, 18, 58, 0.9);
    g.beginPath();
    g.ellipse(cx + L.x * r * 0.25, cy + L.y * r * 0.2 - r * 0.1, r * 0.4, r * 0.24, 0, 0, Math.PI * 2);
    g.fill();
    if (seed > 0.2) {
      g.fillStyle = hsl(v.floraHue + 40, 40, 55, 0.7);
      g.beginPath();
      g.arc(cx - r * 0.9, cy + r * 0.3, r * 0.16, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    g.restore();
    return;
  }
  g.restore();
  GROVE.marks++;
}
const drawTileMotifsGroveBase = drawTileMotifs;
drawTileMotifs = function (x, y, i, p, m, v) {
  drawTileMotifsGroveBase(x, y, i, p, m, v);
  if (UI.quality === "low" || UI.camera.zoom < GROVE_MARK_ZOOM || W.tiles.liquid[i] > 140) return;
  // Sparser at a middle distance, full only up close, for the render budget.
  const density = GROVE_MARK_DENSITY * clamp((UI.camera.zoom - 0.8) / 2.2, 0.35, 1),
    seed = visualHash01(i, 0x77a);
  if (seed > density) return;
  drawGroundMark(x, y, i, p, m, v, biomeAt(i), seed / density);
};
// ── Strata on tall cliff faces (iso and oblique) ─────────────────────────────
const drawTileProceduralGroveBase = drawTileProcedural;
drawTileProcedural = function (x, y) {
  drawTileProceduralGroveBase(x, y);
  if (UI.view === "top" || UI.quality !== "high" || UI.camera.zoom < GROVE_STRATA_ZOOM) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    i = idx(x, y),
    e = W.tiles.elevation[i];
  if (W.tiles.liquid[i] > 140) return;
  const elevationScale = UI.view === "iso" ? 0.013 * UI.camera.zoom : 0.018 * UI.camera.zoom * (1.12 - cameraTilt() * 0.35),
    maxDrop = Math.max(14, UI.camera.zoom * 3.2),
    faces = [
      { elevation: x < W.width - 1 ? W.tiles.elevation[i + 1] : e, a: 1, b: 2 },
      { elevation: y < W.height - 1 ? W.tiles.elevation[i + W.width] : e, a: 2, b: 3 },
    ];
  let poly = null;
  for (const face of faces) {
    const drop = clamp(Math.max(0, e - face.elevation) * elevationScale, 0, maxDrop);
    if (drop < 9) continue;
    if (!poly) poly = proceduralTilePolygon(x, y, m);
    const ax = poly[face.a][0],
      ay = poly[face.a][1],
      bx = poly[face.b][0],
      by = poly[face.b][1],
      lines = Math.min(4, Math.floor(drop / 6));
    ctx.save();
    ctx.strokeStyle = hsl(v.mineralHue, 18, 16, 0.22);
    ctx.lineWidth = Math.max(0.6, drop * 0.05);
    ctx.beginPath();
    for (let n = 1; n <= lines; n++) {
      const f = (n / (lines + 1)) * drop,
        wobble = (visualHash01(i * 7 + n, 0x3c1) - 0.5) * drop * 0.08;
      ctx.moveTo(ax, ay + f + wobble);
      ctx.lineTo(bx, by + f - wobble);
    }
    ctx.stroke();
    ctx.restore();
    GROVE.strata++;
  }
};
window.ALIFE_GROVE_DEBUG = Object.freeze({
  species: (i) => treeSpeciesAt(i),
  speciesCounts: () => {
    const out = {};
    for (let i = 0; i < W.tileCount; i++) if (W.tiles.featureType?.[i] === TERRAIN_FEATURE.CANOPY) out[treeSpeciesAt(i)] = (out[treeSpeciesAt(i)] || 0) + 1;
    return out;
  },
  season: (x, y) => groveSeason(x, y),
  leaf: (species, x, y, i) => leafTone(ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(), species, groveSeason(x, y), i),
  counts: () => ({ ...GROVE }),
  reset: () => {
    for (const k of Object.keys(GROVE)) GROVE[k] = 0;
  },
});
