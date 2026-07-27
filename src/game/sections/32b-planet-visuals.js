// ═══════════════════════════════════════════════════════════════════════════
// 32B. PROCEDURAL PLANET VISUAL GENOME
// ═══════════════════════════════════════════════════════════════════════════
let PLANET_VISUAL_CACHE = null,
  TILE_VISUAL_CACHE = null,
  TOP_TERRAIN_CACHE = null,
  ACTIVE_RENDER_METRICS = null,
  ACTIVE_PLANET_VISUAL = null,
  ACTIVE_INTERIOR_STATE = null,
  ACTIVE_COMBAT_STATE = null;
let ACTIVE_INTERIOR_IDS = new Set();
const CREATURE_VISUAL_CACHE = new Map();
function wrapHue(v) {
  return ((v % 360) + 360) % 360;
}
function mixHue(a, b, t) {
  const d = ((b - a + 540) % 360) - 180;
  return wrapHue(a + d * t);
}
function visualHash01(id, salt = 0) {
  return mix32((W?.seedHash || 0) ^ Math.imul((id + 1) >>> 0, 0x9e3779b1) ^ salt) / 4294967296;
}
function chemistryHue(species, fallback) {
  return W?.definitions?.species?.[species]?.colorHue ?? fallback;
}
function makePlanetVisualGenome() {
  const terrain = W.terrainGenome || makeTerrainGenome(W),
    key = `${W.seedHash}:${W.width}:${W.height}:${terrain.version || 1}:${W.config?.variability ?? 0.5}:${W.config?.harshness ?? 0.5}:${W.config?.unfiltered ? 1 : 0}`;
  if (PLANET_VISUAL_CACHE?.key === key) return PLANET_VISUAL_CACHE;
  const r = makeRng(W.seed, "planet-visual-genome-v3"),
    earthlike = terrain.earthlike ?? canonicalPlanetSeed(W.seed),
    harmonyModes = [
      [0, 118, 236],
      [0, 148, 214],
      [0, 42, 188],
      [0, 172, 324],
    ],
    harmony = earthlike ? [0, 112, 34] : harmonyModes[r.int(harmonyModes.length)],
    chemicalBase = chemistryHue(C.SOLVENT, r.range(0, 360)),
    base = earthlike ? 198 : mixHue(chemicalBase, r.range(0, 360), 0.45),
    liquidHue = earthlike ? 198 : wrapHue(base + harmony[0]),
    floraTarget = wrapHue(base + harmony[1]),
    mineralTarget = wrapHue(base + harmony[2]),
    floraHue = earthlike ? 112 : mixHue(floraTarget, chemistryHue(C.PIGMENT, floraTarget), 0.32),
    mineralHue = earthlike
      ? 34
      : mixHue(mineralTarget, chemistryHue(C.MINERAL, mineralTarget), 0.28),
    accentHue = earthlike
      ? 43
      : mixHue(wrapHue(base + 155), chemistryHue(C.ENERGY, base + 155), 0.38),
    creatureHue = earthlike
      ? mixHue(floraHue, chemistryHue(C.PIGMENT, floraHue), 0.25)
      : mixHue(wrapHue(floraHue + 38), chemistryHue(C.PIGMENT, floraHue + 38), 0.48),
    floraForms = ["rosette", "filament", "fan", "crystal", "bubble", "branching", "plate"],
    geologyForms = ["veins", "shards", "rings", "pores", "striations", "cells"],
    waterForms = ["ripples", "cells", "slick", "luminous"],
    floraForm = earthlike ? "branching" : floraForms[r.int(floraForms.length)],
    geologyForm = earthlike ? "veins" : geologyForms[r.int(geologyForms.length)],
    waterForm = earthlike ? "ripples" : waterForms[r.int(waterForms.length)],
    lightAngle = earthlike ? -0.72 : r.range(-Math.PI, Math.PI),
    alienness = terrain.alienness ?? (earthlike ? 0.12 : 0.75);
  const palette = {
    "Deep Water": {
      h: liquidHue,
      s: earthlike ? 58 : r.range(45, 69),
      l: earthlike ? 18 : r.range(16, 25),
    },
    "Shallow Water": {
      h: wrapHue(liquidHue - 8),
      s: earthlike ? 55 : r.range(46, 72),
      l: earthlike ? 34 : r.range(30, 43),
    },
    Mountain: {
      h: mineralHue,
      s: earthlike ? 13 : r.range(18, 37),
      l: earthlike ? 48 : r.range(42, 57),
    },
    "Ash Waste": { h: wrapHue(mineralHue - 16), s: 14, l: 30 },
    "Burned Ground": { h: wrapHue(mineralHue - 8), s: 18, l: 20 },
    "Dry Scrub": {
      h: mixHue(mineralHue, floraHue, 0.25),
      s: earthlike ? 34 : r.range(34, 55),
      l: 43,
    },
    Desert: {
      h: mineralHue,
      s: earthlike ? 39 : r.range(38, 61),
      l: earthlike ? 55 : r.range(48, 62),
    },
    Swamp: { h: mixHue(liquidHue, floraHue, 0.56), s: 48, l: 29 },
    Forest: {
      h: wrapHue(floraHue - 9),
      s: earthlike ? 44 : r.range(48, 67),
      l: earthlike ? 29 : r.range(27, 39),
    },
    "Fertile Basin": {
      h: wrapHue(floraHue + 7),
      s: earthlike ? 45 : r.range(45, 64),
      l: earthlike ? 47 : r.range(42, 55),
    },
    Grassland: {
      h: floraHue,
      s: earthlike ? 38 : r.range(42, 62),
      l: earthlike ? 43 : r.range(39, 53),
    },
    "Stone Upland": { h: wrapHue(mineralHue + 8), s: earthlike ? 12 : r.range(17, 34), l: 48 },
    "Sand Plain": {
      h: wrapHue(mineralHue + 3),
      s: earthlike ? 31 : r.range(31, 52),
      l: earthlike ? 50 : r.range(45, 59),
    },
  };
  const names = earthlike
    ? {}
    : {
        "Deep Water": "Abyssal Solvent",
        "Shallow Water": "Littoral Gel",
        Mountain: "Crystal Crown",
        "Ash Waste": "Ash Matrix",
        "Burned Ground": "Reaction Scar",
        "Dry Scrub": "Xeric Fronds",
        Desert: "Glass Dunes",
        Swamp: "Mire Lattice",
        Forest: "Spore Canopy",
        "Fertile Basin": "Nutrient Bloom",
        Grassland: "Producer Steppe",
        "Stone Upland": "Ore Spine",
        "Sand Plain": "Mineral Expanse",
      };
  PLANET_VISUAL_CACHE = {
    key,
    earthlike,
    alienness,
    terrain,
    liquidHue,
    floraHue,
    mineralHue,
    accentHue,
    creatureHue,
    floraForm,
    geologyForm,
    waterForm,
    lightAngle,
    palette,
    names,
    voidHue: wrapHue(base + 208),
    atmosphereHue: mixHue(base, accentHue, 0.35),
  };
  TILE_VISUAL_CACHE = null;
  TOP_TERRAIN_CACHE = null;
  CREATURE_VISUAL_CACHE.clear();
  return PLANET_VISUAL_CACHE;
}
function biomeDisplayName(i) {
  const v = makePlanetVisualGenome(),
    canonical = biomeAt(i);
  return v.names[canonical] || canonical;
}
function proceduralProjectTile(x, y, m, withElevation = true) {
  const e = withElevation
    ? W.tiles.elevation[
        idx(clamp(Math.floor(x), 0, W.width - 1), clamp(Math.floor(y), 0, W.height - 1))
      ] / 1000
    : 0;
  return projectWithMetrics(x, y, e, m);
}
function proceduralTilePolygon(x, y, m) {
  const p = proceduralProjectTile(x + 0.5, y + 0.5, m);
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
function terrainVisualSignature(i) {
  const t = W.tiles;
  let s = t.elevation[i] >>> 3;
  s ^= Math.imul(t.liquid[i] >>> 5, 0x45d9f3b);
  s ^= Math.imul(t.plantOrder[i] >>> 4, 0x119de1f3);
  s ^= Math.imul((t.temperature[i] + 400) >>> 3, 0x3449);
  s ^= Math.imul(t.structureOrder[i] >>> 5, 0x27d4eb2d);
  s ^= Math.imul(t.chem[C.SOLVENT][i] >>> 5, 0x165667b1);
  s ^= Math.imul(t.chem[C.NUTRIENT][i] >>> 5, 0x9e3779b1);
  s ^= Math.imul(t.chem[C.ASH][i] >>> 4, 0x85ebca6b);
  s ^= Math.imul(t.chem[C.TOXIN][i] >>> 5, 0xc2b2ae35);
  s ^= t.fire[i] ? 0x5bd1e995 : 0;
  const [x, y] = xy(i);
  for (const [nx, ny] of [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ]) {
    if (!inside(nx, ny)) continue;
    const ni = idx(nx, ny);
    s ^= Math.imul((t.temperature[ni] + 400) >>> 4, 0x6d2b79f5);
    s ^= Math.imul(t.chem[C.SOLVENT][ni] >>> 6, 0x1b873593);
    s ^= t.fire[ni] ? Math.imul(ni + 1, 0x27d4eb2d) : 0;
  }
  return s | 0;
}
function terrainColorProcedural(i) {
  const v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    cacheKey = `${v.key}:${W.tileCount}`;
  if (!TILE_VISUAL_CACHE || TILE_VISUAL_CACHE.key !== cacheKey) {
    TILE_VISUAL_CACHE = {
      key: cacheKey,
      signatures: new Int32Array(W.tileCount),
      colors: Array(W.tileCount),
    };
    TILE_VISUAL_CACHE.signatures.fill(-2147483648);
  }
  const signature = terrainVisualSignature(i);
  if (TILE_VISUAL_CACHE.signatures[i] === signature && TILE_VISUAL_CACHE.colors[i])
    return TILE_VISUAL_CACHE.colors[i];
  const tone = v.palette[biomeAt(i)] || { h: v.floraHue, s: 35, l: 42 },
    t = W.tiles,
    [x, y] = xy(i),
    left = t.elevation[y * W.width + Math.max(0, x - 1)],
    right = t.elevation[y * W.width + Math.min(W.width - 1, x + 1)],
    up = t.elevation[Math.max(0, y - 1) * W.width + x],
    down = t.elevation[Math.min(W.height - 1, y + 1) * W.width + x],
    lx = Math.cos(v.lightAngle),
    ly = Math.sin(v.lightAngle),
    slope = ((left - right) * lx + (up - down) * ly) / 95,
    grain = (visualHash01(i, 0x731d) - 0.5) * 5.8,
    macro = (noise2(W.seedHash ^ 0x8ab3, x / 9, y / 9) - 0.5) * 4.2,
    temp = t.temperature[i] / 10,
    cold = temp < 0 ? clamp(-temp * 0.32, 0, 12) : 0,
    toxin = clamp(t.chem[C.TOXIN][i] / 800, 0, 1),
    color = hsl(
      tone.h + toxin * 9,
      clamp(tone.s - cold * 0.7 + toxin * 7, 8, 78),
      clamp(tone.l + slope + grain + macro + cold, 9, 78),
      1,
    );
  TILE_VISUAL_CACHE.signatures[i] = signature;
  TILE_VISUAL_CACHE.colors[i] = color;
  return color;
}
function drawCoastEdges(poly, x, y, i, v, m) {
  if (W.tiles.liquid[i] < 140) return;
  const wet = (xx, yy) => inside(xx, yy) && W.tiles.liquid[idx(xx, yy)] >= 140,
    edges = [];
  if (inside(x, y - 1) && !wet(x, y - 1)) edges.push([0, 1]);
  if (inside(x + 1, y) && !wet(x + 1, y)) edges.push([1, 2]);
  if (inside(x, y + 1) && !wet(x, y + 1)) edges.push([2, 3]);
  if (inside(x - 1, y) && !wet(x - 1, y)) edges.push([3, 0]);
  if (!edges.length) return;
  ctx.strokeStyle = hsl(
    v.liquidHue - 18,
    50,
    78,
    0.38 + Math.sin(ACTIVE_RENDER_NOW * 0.0018 + (x + y) * 0.9) * 0.12,
  );
  ctx.lineWidth = clamp(m.tw * 0.09, 0.45, 12);
  ctx.beginPath();
  for (const [a, b] of edges) {
    ctx.moveTo(poly[a][0], poly[a][1]);
    ctx.lineTo(poly[b][0], poly[b][1]);
  }
  ctx.stroke();
}
function drawPlantMotif(p, r, form, hue, detail, phase) {
  ctx.strokeStyle = hsl(hue, 64, 66, 0.7);
  ctx.fillStyle = hsl(hue, 58, 48, 0.72);
  ctx.lineWidth = clamp(r * 0.22, 0.45, 8);
  if (form === "rosette") {
    for (let n = 0; n < detail; n++) {
      const a = (n * Math.PI * 2) / detail + phase,
        dx = Math.cos(a) * r * 0.42,
        dy = Math.sin(a) * r * 0.35;
      ctx.beginPath();
      ctx.ellipse(p.x + dx, p.y + dy, r * 0.52, r * 0.2, a, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (form === "filament" || form === "branching") {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + r * 0.45);
    ctx.quadraticCurveTo(p.x + Math.sin(phase) * r * 0.45, p.y, p.x, p.y - r);
    ctx.stroke();
    if (form === "branching") {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r * 0.25);
      ctx.lineTo(p.x - r * 0.55, p.y - r * 0.65);
      ctx.moveTo(p.x, p.y - r * 0.05);
      ctx.lineTo(p.x + r * 0.55, p.y - r * 0.48);
      ctx.stroke();
    }
  } else if (form === "fan") {
    ctx.beginPath();
    for (let n = -2; n <= 2; n++) {
      ctx.moveTo(p.x, p.y + r * 0.35);
      ctx.lineTo(p.x + n * r * 0.32, p.y - r * (0.65 - Math.abs(n) * 0.07));
    }
    ctx.stroke();
  } else if (form === "crystal") {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - r);
    ctx.lineTo(p.x + r * 0.48, p.y);
    ctx.lineTo(p.x, p.y + r * 0.38);
    ctx.lineTo(p.x - r * 0.48, p.y);
    ctx.closePath();
    ctx.fill();
  } else if (form === "bubble") {
    for (let n = 0; n < detail; n++) {
      const a = phase + n * 2.4,
        rr = r * (0.28 + n * 0.12);
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * r * 0.35, p.y + Math.sin(a) * r * 0.25, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * 0.9, r * 0.42, phase, 0, Math.PI * 2);
    ctx.fill();
  }
}
function drawGeologyMotif(p, r, form, v, phase) {
  ctx.strokeStyle = hsl(v.mineralHue + 18, 44, 67, 0.32);
  ctx.fillStyle = hsl(v.accentHue, 55, 62, 0.25);
  ctx.lineWidth = clamp(r * 0.13, 0.35, 6);
  if (form === "rings") {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.65, 0, Math.PI * 1.55);
    ctx.stroke();
  } else if (form === "shards") {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - r * 0.7);
    ctx.lineTo(p.x + r * 0.42, p.y + r * 0.45);
    ctx.lineTo(p.x - r * 0.38, p.y + r * 0.18);
    ctx.closePath();
    ctx.fill();
  } else if (form === "pores" || form === "cells") {
    ctx.beginPath();
    ctx.arc(p.x - r * 0.25, p.y, r * 0.18, 0, Math.PI * 2);
    ctx.moveTo(p.x + r * 0.55, p.y - r * 0.12);
    ctx.arc(p.x + r * 0.34, p.y - r * 0.12, r * 0.21, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(p.x - r * 0.72, p.y + Math.sin(phase) * r * 0.22);
    ctx.quadraticCurveTo(p.x, p.y - r * 0.48, p.x + r * 0.72, p.y + r * 0.12);
    ctx.stroke();
  }
}
function drawEcologicalStructure(x, y, i, p, m, v, inst = null) {
  const type = W.tiles.featureType?.[i] || 0,
    spec = featureSpecAt(i);
  if (!type || !spec) return;
  if (inst) p = { x: p.x + inst.dx, y: p.y + inst.dy };
  const strength = (W.tiles.featureStrength[i] || 500) / 1000,
    scale = spec.scale || 1,
    r = Math.max(3, m.tw * (0.2 + strength * 0.44) * scale) * (inst ? inst.s : 1),
    h = Math.max(5, featureVerticalUnit(m) * (0.7 + strength * 2.4) * scale) * (inst ? inst.s : 1),
    phase = visualHash01(i, 0xb731) * Math.PI * 2 + (inst ? inst.s * 5 : 0),
    hue =
      (type === TERRAIN_FEATURE.CANOPY
        ? v.floraHue
        : type === TERRAIN_FEATURE.AQUATIC
          ? v.liquidHue
          : type === TERRAIN_FEATURE.GEOTHERMAL
            ? v.accentHue
            : v.mineralHue) + (spec.hueShift || 0);
  if (UI.view !== "top" && UI.camera.zoom < 0.55) {
    ctx.fillStyle = hsl(hue, 48, 32, 0.9);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - h * 0.25, r * 0.75, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.save();
  ctx.lineWidth = Math.max(1, r * 0.12);
  if (UI.view !== "top") {
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.ellipse(p.x + r * 0.22, p.y + r * 0.28, r * 0.9, r * 0.28, -0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  if (type === TERRAIN_FEATURE.CANOPY) {
    ctx.strokeStyle = hsl(v.mineralHue, 42, 26, 0.9);
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + r * 0.25);
    ctx.lineTo(p.x, p.y - h * 0.68);
    ctx.stroke();
    ctx.strokeStyle = hsl(hue + 18, 70, 65, 0.9);
    ctx.fillStyle = hsl(hue, 58, 38, 0.96);
    if (spec.form === "fungal") {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - h * 0.7, r * 1.15, r * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (spec.form === "crystal") {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - h);
      ctx.lineTo(p.x + r * 0.75, p.y - h * 0.46);
      ctx.lineTo(p.x + r * 0.25, p.y - r * 0.05);
      ctx.lineTo(p.x - r * 0.65, p.y - h * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (spec.form === "ribbon" || spec.form === "fan") {
      ctx.lineWidth = Math.max(1, r * 0.16);
      for (let n = -2; n <= 2; n++) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - h * 0.62);
        ctx.quadraticCurveTo(
          p.x + n * r * 0.5,
          p.y - h * (0.85 + Math.abs(n) * 0.05),
          p.x + n * r * 0.72,
          p.y - h * 0.35,
        );
        ctx.stroke();
      }
    } else if (spec.form === "bubble") {
      for (let n = 0; n < 5; n++) {
        const a = phase + n * 2.1,
          rr = r * (0.36 + (n % 2) * 0.12);
        ctx.beginPath();
        ctx.arc(
          p.x + Math.cos(a) * r * 0.48,
          p.y - h * 0.62 + Math.sin(a) * r * 0.28,
          rr,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.stroke();
      }
    } else {
      for (let n = 0; n < 3; n++) {
        ctx.beginPath();
        ctx.ellipse(
          p.x + (n - 1) * r * 0.43,
          p.y - h * (0.62 + 0.1 * (n % 2)),
          r * 0.72,
          r * 0.58,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.stroke();
    }
  } else if (type === TERRAIN_FEATURE.HIGHLAND) {
    ctx.strokeStyle = hsl(hue + 12, 35, 23, 0.9);
    ctx.fillStyle = hsl(hue, 32, 43, 0.98);
    if (spec.form === "mesa") {
      ctx.beginPath();
      ctx.moveTo(p.x - r, p.y + r * 0.35);
      ctx.lineTo(p.x - r * 0.55, p.y - h * 0.72);
      ctx.lineTo(p.x + r * 0.5, p.y - h * 0.72);
      ctx.lineTo(p.x + r, p.y + r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (spec.form === "arch") {
      ctx.lineWidth = Math.max(3, r * 0.48);
      ctx.beginPath();
      ctx.arc(p.x, p.y - r * 0.05, r * 0.72, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = hsl(v.voidHue, 42, 8, 0.95);
      ctx.beginPath();
      ctx.arc(p.x, p.y - r * 0.02, r * 0.34, Math.PI, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - h * (spec.form === "blade" ? 1.2 : 1));
      ctx.lineTo(p.x + r, p.y + r * 0.42);
      ctx.lineTo(p.x - r, p.y + r * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hsl(hue + 22, 28, 60, 0.55);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - h);
      ctx.lineTo(p.x + r * 0.18, p.y - h * 0.35);
      ctx.lineTo(p.x - r * 0.12, p.y - h * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  } else if (type === TERRAIN_FEATURE.CAVERN) {
    ctx.strokeStyle = hsl(hue, 24, 55, 0.9);
    ctx.lineWidth = Math.max(2, r * 0.24);
    ctx.fillStyle = hsl(v.voidHue, 48, 5, 0.98);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - r * 0.05, r * 0.78, r * 0.58, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(p.x + r * 0.78, p.y + r * 0.28);
    ctx.lineTo(p.x - r * 0.78, p.y + r * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (spec.form === "fissure") {
      ctx.strokeStyle = hsl(v.accentHue, 70, 72, 0.75);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r * 0.55);
      ctx.lineTo(p.x - r * 0.12, p.y);
      ctx.lineTo(p.x + r * 0.1, p.y + r * 0.3);
      ctx.stroke();
    }
  } else if (type === TERRAIN_FEATURE.GEOTHERMAL) {
    ctx.strokeStyle = hsl(hue + 22, 64, 73, 0.9);
    ctx.fillStyle = hsl(hue - 18, 32, 35, 0.96);
    for (let n = -1; n <= 1; n++) {
      const ch = h * (0.35 + (n + 2) * 0.12);
      ctx.fillRect(p.x + n * r * 0.42 - r * 0.14, p.y - ch, r * 0.28, ch + r * 0.2);
      ctx.strokeRect(p.x + n * r * 0.42 - r * 0.14, p.y - ch, r * 0.28, ch + r * 0.2);
    }
    ctx.strokeStyle = hsl(hue + 38, 82, 72, 0.72);
    ctx.lineWidth = Math.max(1, r * 0.12);
    for (let n = -1; n <= 1; n++) {
      ctx.beginPath();
      ctx.moveTo(p.x + n * r * 0.42, p.y - h * (0.45 + (n + 2) * 0.12));
      ctx.quadraticCurveTo(
        p.x + n * r * 0.65 + Math.sin(phase + n) * r * 0.3,
        p.y - h * 0.95,
        p.x + n * r * 0.35,
        p.y - h * 1.25,
      );
      ctx.stroke();
    }
  } else if (type === TERRAIN_FEATURE.AQUATIC) {
    ctx.strokeStyle = hsl(hue + 18, 76, 68, 0.9);
    ctx.fillStyle = hsl(hue - 22, 62, 47, 0.86);
    ctx.lineWidth = Math.max(1, r * 0.16);
    for (let n = -2; n <= 2; n++) {
      ctx.beginPath();
      ctx.moveTo(p.x + n * r * 0.2, p.y + r * 0.28);
      ctx.quadraticCurveTo(
        p.x + n * r * 0.44 + Math.sin(phase + n) * r * 0.22,
        p.y - h * 0.38,
        p.x + n * r * 0.5,
        p.y - h * (0.5 + Math.abs(n) * 0.12),
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(
        p.x + n * r * 0.5,
        p.y - h * (0.5 + Math.abs(n) * 0.12),
        r * (spec.form === "sponge" ? 0.28 : 0.16),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = hsl(hue + 30, 78, 72, 0.9);
    ctx.fillStyle = hsl(hue, 54, 48, 0.94);
    const count = spec.form === "monolith" ? 1 : 4;
    for (let n = 0; n < count; n++) {
      const ox = count === 1 ? 0 : (n - 1.5) * r * 0.32,
        hh = count === 1 ? h : h * (0.32 + n * 0.1);
      ctx.beginPath();
      ctx.moveTo(p.x + ox, p.y - hh);
      ctx.lineTo(p.x + ox + r * 0.2, p.y + r * 0.26);
      ctx.lineTo(p.x + ox - r * 0.22, p.y + r * 0.26);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}
function drawStructureIdentity(i, p, m, v) {
  const type = W.tiles.featureType?.[i] || 0,
    spec = featureSpecAt(i);
  if (!type || !spec) return;
  const strength = (W.tiles.featureStrength[i] || 500) / 1000,
    r = Math.max(3, m.tw * (0.18 + strength * 0.34) * (spec.scale || 1)),
    h = Math.max(5, featureVerticalUnit(m) * (0.6 + strength * 2) * (spec.scale || 1)),
    phase = visualHash01(i, 0xc513) * Math.PI * 2,
    hue =
      (type === TERRAIN_FEATURE.AQUATIC
        ? v.liquidHue
        : type === TERRAIN_FEATURE.GEOTHERMAL
          ? v.accentHue
          : v.mineralHue) + (spec.hueShift || 0);
  ctx.save();
  ctx.lineWidth = Math.max(0.7, r * 0.1);
  ctx.strokeStyle = hsl(hue + 32, 76, 73, 0.85);
  ctx.fillStyle = hsl(hue, 58, 48, 0.72);
  if (spec.form === "hive") {
    for (let n = 0; n < 3; n++) {
      ctx.beginPath();
      ctx.ellipse(
        p.x,
        p.y - r * 0.12 - n * r * 0.42,
        r * (0.85 - n * 0.16),
        r * 0.34,
        0,
        Math.PI,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  } else if (spec.form === "shard") {
    for (let n = -1; n <= 1; n++) {
      ctx.beginPath();
      ctx.moveTo(p.x + n * r * 0.36, p.y - h * (0.55 + Math.abs(n) * 0.2));
      ctx.lineTo(p.x + (n + 0.28) * r * 0.38, p.y + r * 0.2);
      ctx.stroke();
    }
  } else if (spec.form === "tube") {
    for (let n = 0; n < 3; n++) {
      ctx.beginPath();
      ctx.ellipse(
        p.x,
        p.y - r * 0.03,
        r * (0.72 - n * 0.17),
        r * (0.48 - n * 0.12),
        0,
        Math.PI,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  } else if (spec.form === "vault") {
    for (let n = -2; n <= 2; n++) {
      ctx.beginPath();
      ctx.moveTo(p.x + n * r * 0.28, p.y + r * 0.2);
      ctx.quadraticCurveTo(p.x + n * r * 0.45, p.y - r * 0.45, p.x + n * r * 0.2, p.y - r * 0.75);
      ctx.stroke();
    }
  } else if (spec.form === "sink") {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * 0.9, r * 0.48, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * 0.48, r * 0.23, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (spec.form === "pore") {
    for (let n = 0; n < 5; n++) {
      const a = phase + n * 2.4;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * r * 0.55, p.y + Math.sin(a) * r * 0.3, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (spec.form === "geyser") {
    ctx.lineWidth = Math.max(1.3, r * 0.2);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x + Math.sin(phase) * r * 0.4, p.y - h, p.x, p.y - h * 1.45);
    ctx.stroke();
  } else if (spec.form === "seep") {
    for (let n = 0; n < 5; n++) {
      const a = phase + n * 1.7;
      ctx.beginPath();
      ctx.arc(
        p.x + Math.cos(a) * r * 0.7,
        p.y + Math.sin(a) * r * 0.26,
        r * (0.09 + n * 0.025),
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  } else if (spec.form === "fumarole") {
    ctx.fillStyle = hsl(hue + 20, 45, 72, 0.28);
    for (let n = 0; n < 4; n++) {
      ctx.beginPath();
      ctx.arc(
        p.x + Math.sin(phase + n) * r * 0.3,
        p.y - h * (0.45 + n * 0.24),
        r * (0.18 + n * 0.08),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else if (spec.form === "lattice") {
    ctx.beginPath();
    for (let n = 0; n < 6; n++) {
      const a = (n * Math.PI) / 3 - Math.PI / 2,
        x = p.x + Math.cos(a) * r * 0.8,
        y = p.y + Math.sin(a) * r * 0.55;
      n ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x - r * 0.8, p.y);
    ctx.lineTo(p.x + r * 0.8, p.y);
    ctx.moveTo(p.x, p.y - r * 0.55);
    ctx.lineTo(p.x, p.y + r * 0.55);
    ctx.stroke();
  } else if (spec.form === "mat") {
    for (let n = 0; n < 4; n++) {
      ctx.beginPath();
      ctx.ellipse(
        p.x + (n - 1.5) * r * 0.28,
        p.y + Math.sin(n + phase) * r * 0.18,
        r * 0.38,
        r * 0.19,
        n * 0.35,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else if (spec.form === "shell") {
    ctx.beginPath();
    for (let n = 0; n < 18; n++) {
      const a = n * 0.62,
        rr = (r * n) / 22,
        px = p.x + Math.cos(a) * rr,
        py = p.y + Math.sin(a) * rr * 0.55;
      n ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
  } else if (spec.form === "glass-coral") {
    for (let n = -2; n <= 2; n++) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + r * 0.2);
      ctx.lineTo(p.x + n * r * 0.28, p.y - h * 0.6);
      ctx.lineTo(p.x + (n + 0.45) * r * 0.34, p.y - h * 0.82);
      ctx.stroke();
    }
  } else if (spec.form === "nodules") {
    for (let n = 0; n < 5; n++) {
      const a = phase + n * 2.2;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * r * 0.58, p.y + Math.sin(a) * r * 0.3, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (spec.form === "vein") {
    ctx.beginPath();
    ctx.moveTo(p.x - r, p.y + r * 0.2);
    ctx.lineTo(p.x - r * 0.3, p.y - r * 0.2);
    ctx.lineTo(p.x + r * 0.1, p.y + r * 0.08);
    ctx.lineTo(p.x + r, p.y - r * 0.35);
    ctx.moveTo(p.x - r * 0.2, p.y - r * 0.16);
    ctx.lineTo(p.x, p.y - r * 0.65);
    ctx.stroke();
  } else if (spec.form === "salt") {
    ctx.beginPath();
    for (let n = 0; n < 12; n++) {
      const a = (n * Math.PI) / 6,
        rr = n % 2 ? r * 0.35 : r;
      ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * 0.6);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}
function drawTileMotifs(x, y, i, p, m, v) {
  const zoom = UI.camera.zoom,
    plant = W.tiles.plantOrder[i],
    liquid = W.tiles.liquid[i],
    seed = visualHash01(i, 0x2e71);
  if (liquid > 140) {
    if (seed < 0.18 && zoom > 0.62) {
      const r = Math.max(0.7, m.tw * 0.17),
        phase = visualHash01(i, 0x11) * Math.PI * 2;
      ctx.strokeStyle = hsl(v.liquidHue - 18, 64, 74, 0.24);
      ctx.lineWidth = clamp(m.tw * 0.055, 0.35, 8);
      ctx.beginPath();
      if (v.waterForm === "cells") {
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      } else {
        ctx.moveTo(p.x - r, p.y);
        ctx.quadraticCurveTo(p.x, p.y - r * 0.5, p.x + r, p.y);
      }
      ctx.stroke();
    }
    return;
  }
  if (plant > 170 && seed < clamp(plant / 3400, 0.04, 0.28) && zoom > 0.55) {
    const r = Math.max(0.8, m.tw * (0.08 + plant / 14000)),
      h = v.floraHue + (visualHash01(i, 0x315) - 0.5) * 18,
      detail = zoom > 1.35 && UI.quality !== "low" ? 5 : 3,
      phase = visualHash01(i, 0x991) * Math.PI * 2;
    drawPlantMotif(p, r, v.floraForm, h, detail, phase);
    if (zoom > 2.5) {
      const extra = 1 + (plant > 900 ? 1 : 0) + (zoom > 6 ? 1 : 0);
      for (let n = 1; n <= extra; n++)
        drawPlantMotif(
          {
            x: p.x + (visualHash01(i, 0x21 + n) - 0.5) * m.tw * 0.72,
            y: p.y + (visualHash01(i, 0x61 + n) - 0.5) * m.th * 0.55,
          },
          r * (0.6 + 0.4 * visualHash01(i, 0xa1 + n)),
          v.floraForm,
          h,
          detail,
          visualHash01(i, 0xe1 + n) * Math.PI * 2,
        );
    }
  } else if (seed > 0.88 && zoom > 0.78) {
    const r = Math.max(0.8, m.tw * 0.16),
      phase = visualHash01(i, 0x711) * Math.PI * 2;
    drawGeologyMotif(p, r, v.geologyForm, v, phase);
  }
}
function drawTileProcedural(x, y) {
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    i = idx(x, y),
    e = W.tiles.elevation[i],
    top = UI.view === "top",
    p = proceduralProjectTile(x + 0.5, y + 0.5, m),
    color = terrainColorProcedural(i);
  let poly = null;
  if (top) {
    ctx.fillStyle = color;
    ctx.fillRect(p.x - m.tw / 2 - 0.35, p.y - m.th / 2 - 0.35, m.tw + 0.7, m.th + 0.7);
  } else {
    poly = proceduralTilePolygon(x, y, m);
    if (UI.quality !== "low" && UI.camera.zoom > 0.4) {
      const elevationScale =
          UI.view === "iso"
            ? 0.013 * UI.camera.zoom
            : 0.018 * UI.camera.zoom * (1.12 - cameraTilt() * 0.35),
        faces = [
          { elevation: y > 0 ? W.tiles.elevation[i - W.width] : 0, a: 0, b: 1, shade: 5 },
          { elevation: x < W.width - 1 ? W.tiles.elevation[i + 1] : 0, a: 1, b: 2, shade: 1 },
          {
            elevation: y < W.height - 1 ? W.tiles.elevation[i + W.width] : 0,
            a: 2,
            b: 3,
            shade: -2,
          },
          { elevation: x > 0 ? W.tiles.elevation[i - 1] : 0, a: 3, b: 0, shade: 3 },
        ];
      for (const face of faces) {
        const drop = Math.max(0, (e - face.elevation) * elevationScale);
        if (drop <= 0.5) continue;
        ctx.beginPath();
        ctx.moveTo(poly[face.a][0], poly[face.a][1]);
        ctx.lineTo(poly[face.b][0], poly[face.b][1]);
        ctx.lineTo(poly[face.b][0], poly[face.b][1] + drop);
        ctx.lineTo(poly[face.a][0], poly[face.a][1] + drop);
        ctx.closePath();
        ctx.fillStyle = hsl(v.mineralHue + face.shade, 29, 16 + e / 100);
        ctx.fill();
      }
    }
    polygonPath(poly);
    ctx.fillStyle = color;
    ctx.fill();
    if (ACTIVE_TILE_SHADE && UI.quality === "high" && UI.camera.zoom > 0.62) {
      const es = ACTIVE_TILE_SHADE;
      ctx.lineWidth = Math.max(0.5, m.tw * 0.05);
      ctx.strokeStyle = "rgba(255,252,238,.05)";
      ctx.beginPath();
      ctx.moveTo(poly[es.li][0], poly[es.li][1]);
      ctx.lineTo(poly[(es.li + 1) % 4][0], poly[(es.li + 1) % 4][1]);
      ctx.stroke();
      ctx.strokeStyle = "rgba(4,10,14,.1)";
      ctx.beginPath();
      ctx.moveTo(poly[es.di][0], poly[es.di][1]);
      ctx.lineTo(poly[(es.di + 1) % 4][0], poly[(es.di + 1) % 4][1]);
      ctx.stroke();
    }
  }
  if (W.tiles.liquid[i] > 140) {
    if (!top) {
      polygonPath(poly);
      const depth = clamp(W.tiles.liquid[i] / 2500, 0, 1);
      ctx.fillStyle = hsl(
        v.liquidHue + (depth - 0.5) * 8,
        70,
        40 - depth * 16,
        0.14 +
          depth * 0.22 +
          Math.sin(ACTIVE_RENDER_NOW * 0.0014 + (x * 131 + y * 57) * 0.61) * 0.03,
      );
      ctx.fill();
    }
    const coast =
      (x && W.tiles.liquid[i - 1] < 140) ||
      (x < W.width - 1 && W.tiles.liquid[i + 1] < 140) ||
      (y && W.tiles.liquid[i - W.width] < 140) ||
      (y < W.height - 1 && W.tiles.liquid[i + W.width] < 140);
    if (coast && UI.quality !== "low") {
      if (!poly) poly = proceduralTilePolygon(x, y, m);
      drawCoastEdges(poly, x, y, i, v, m);
    }
  }
  drawTileMotifs(x, y, i, p, m, v);
  if (top) {
    drawEcologicalStructure(x, y, i, p, m, v);
    drawStructureIdentity(i, p, m, v);
  }
  if (UI.overlay) {
    ctx.fillStyle = overlayStyle(UI.overlay, i);
    if (top) ctx.fillRect(p.x - m.tw / 2, p.y - m.th / 2, m.tw, m.th);
    else {
      polygonPath(poly);
      ctx.fill();
    }
  }
  if (top && W.tiles.fire[i] > 25) drawTileFlame(x, y, i, m);
  if (
    UI.quality === "high" &&
    top &&
    W.tiles.owner[i] &&
    ((x < W.width - 1 && W.tiles.owner[i + 1] !== W.tiles.owner[i]) ||
      (y < W.height - 1 && W.tiles.owner[i + W.width] !== W.tiles.owner[i]))
  ) {
    ctx.strokeStyle =
      W.factions.find((f) => f.id === W.tiles.owner[i])?.color || hsl(v.accentHue, 60, 65);
    ctx.lineWidth = 0.8;
    if (!poly) poly = proceduralTilePolygon(x, y, m);
    polygonPath(poly);
    ctx.stroke();
  }
}
function topTerrainStateKey(v) {
  const cadence = UI.speed >= 128 ? 32 : UI.speed >= 16 ? 16 : UI.speed >= 4 ? 6 : 2;
  return `${v.key}:${Math.floor(W.tick / cadence)}:${W.interventions.length}:${W.weather.started}:${W.hash || ""}:${W.tileCount}`;
}
function drawTopTerrainLayer(m, v) {
  const state = topTerrainStateKey(v);
  if (!TOP_TERRAIN_CACHE || TOP_TERRAIN_CACHE.key !== v.key) {
    const canvas = document.createElement("canvas");
    canvas.width = W.width;
    canvas.height = W.height;
    TOP_TERRAIN_CACHE = {
      key: v.key,
      state: "",
      canvas,
      g: canvas.getContext("2d", { alpha: false }),
    };
  }
  if (TOP_TERRAIN_CACHE.state !== state) {
    const g = TOP_TERRAIN_CACHE.g;
    g.imageSmoothingEnabled = false;
    for (let y = 0; y < W.height; y++)
      for (let x = 0; x < W.width; x++) {
        g.fillStyle = terrainColorProcedural(idx(x, y));
        g.fillRect(x, y, 1, 1);
      }
    TOP_TERRAIN_CACHE.state = state;
  }
  const left = m.w / 2 - UI.camera.x * m.tw,
    top = m.h / 2 - UI.camera.y * m.th;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(TOP_TERRAIN_CACHE.canvas, left, top, W.width * m.tw, W.height * m.th);
}
function drawTopTileDetails(x, y, m, v) {
  const i = idx(x, y),
    p = proceduralProjectTile(x + 0.5, y + 0.5, m);
  let poly = null;
  if (UI.quality !== "low" && W.tiles.liquid[i] > 140) {
    const coast =
      (x && W.tiles.liquid[i - 1] < 140) ||
      (x < W.width - 1 && W.tiles.liquid[i + 1] < 140) ||
      (y && W.tiles.liquid[i - W.width] < 140) ||
      (y < W.height - 1 && W.tiles.liquid[i + W.width] < 140);
    if (coast) {
      poly = proceduralTilePolygon(x, y, m);
      drawCoastEdges(poly, x, y, i, v, m);
    }
  }
  if (UI.quality !== "low") drawTileMotifs(x, y, i, p, m, v);
  drawEcologicalStructure(x, y, i, p, m, v);
  drawStructureIdentity(i, p, m, v);
  if (UI.overlay) {
    ctx.fillStyle = overlayStyle(UI.overlay, i);
    ctx.fillRect(p.x - m.tw / 2, p.y - m.th / 2, m.tw, m.th);
  }
  if (W.tiles.fire[i] > 25) drawTileFlame(x, y, i, m);
  if (
    UI.quality === "high" &&
    W.tiles.owner[i] &&
    ((x < W.width - 1 && W.tiles.owner[i + 1] !== W.tiles.owner[i]) ||
      (y < W.height - 1 && W.tiles.owner[i + W.width] !== W.tiles.owner[i]))
  ) {
    ctx.strokeStyle =
      W.factions.find((f) => f.id === W.tiles.owner[i])?.color || hsl(v.accentHue, 60, 65);
    ctx.lineWidth = 0.8;
    if (!poly) poly = proceduralTilePolygon(x, y, m);
    polygonPath(poly);
    ctx.stroke();
  }
}
function drawLightningFlash(now, m) {
  const flash = UI.lightningVisual;
  if (!flash || now > flash.until) return;
  const [tx, ty] = xy(flash.tile),
    p = proceduralProjectTile(tx + 0.5, ty + 0.5, m),
    duration = Math.max(1, flash.until - flash.startedAt),
    life = clamp((flash.until - now) / duration, 0, 1),
    flicker = 0.55 + 0.45 * Math.abs(Math.sin(now * 0.055));
  ctx.save();
  ctx.fillStyle = `rgba(210,235,255,${life * 0.18 * flicker})`;
  ctx.fillRect(0, 0, m.w, m.h);
  ctx.strokeStyle = `rgba(225,247,255,${0.55 + life * 0.45})`;
  ctx.lineWidth = Math.max(1.5, 3.2 * UI.camera.zoom);
  ctx.shadowColor = "#8ddcff";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  const sx = p.x + (visualHash01(flash.eventId || flash.tile, 0x9a31) - 0.5) * m.w * 0.24;
  ctx.moveTo(sx, -12);
  for (let n = 1; n <= 8; n++) {
    const t = n / 8,
      jitter =
        n === 8 ? 0 : (visualHash01((flash.eventId || 1) * 11 + n, 0x71c3) - 0.5) * 34 * (1 - t),
      x = lerp(sx, p.x, t) + jitter,
      y = lerp(-12, p.y, t);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(130,220,255,${life * 0.8})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(5, (1 - life) * 34), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
function drawProceduralAtmosphere(now, m, v) {
  if (UI.quality === "high" && v.alienness > 0.55) {
    const count = 12 + Math.floor(v.alienness * 16);
    ctx.fillStyle = hsl(v.accentHue, 72, 70, 0.11);
    for (let n = 0; n < count; n++) {
      const a = visualHash01(n, 0x83e1),
        b = visualHash01(n, 0x19af),
        speed = 0.003 + visualHash01(n, 0x331) * 0.008,
        rawX = a * m.w + now * speed * (n % 2 ? 1 : -1),
        rawY = b * m.h + Math.sin(now * 0.0003 + n) * 18,
        x = ((rawX % m.w) + m.w) % m.w,
        y = ((rawY % m.h) + m.h) % m.h,
        r = 0.45 + visualHash01(n, 0x71) * 1.25;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (W.weather.name !== "Clear") {
    const alpha = W.weather.name.includes("Rain")
      ? 0.035
      : W.weather.name === "Heat Wave"
        ? 0.028
        : 0.018;
    ctx.fillStyle = hsl(v.atmosphereHue, 48, 55, alpha);
    ctx.fillRect(0, 0, m.w, m.h);
  }
  drawLightningFlash(now, m);
  if (UI.quality !== "low") {
    const vg = ctx.createRadialGradient(
      m.w / 2,
      m.h / 2,
      Math.min(m.w, m.h) * 0.44,
      m.w / 2,
      m.h / 2,
      Math.max(m.w, m.h) * 0.74,
    );
    vg.addColorStop(0, "rgba(4,9,13,0)");
    vg.addColorStop(1, "rgba(4,9,13,.24)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, m.w, m.h);
  }
  if (UI.view !== "top") {
    const cx = m.w - 34,
      cy = 34,
      nd = worldDirToScreen(0, -1, m),
      nl = Math.hypot(nd.x, nd.y) || 1,
      nx = nd.x / nl,
      ny = nd.y / nl;
    ctx.save();
    ctx.fillStyle = hsl(v.voidHue, 45, 7, 0.6);
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hsl(v.accentHue, 50, 60, 0.45);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = hsl(v.accentHue, 25, 55, 0.6);
    ctx.beginPath();
    ctx.moveTo(cx - nx * 8, cy - ny * 8);
    ctx.lineTo(cx + nx * 4, cy + ny * 4);
    ctx.stroke();
    ctx.fillStyle = hsl(v.accentHue, 72, 72);
    ctx.beginPath();
    ctx.moveTo(cx + nx * 11, cy + ny * 11);
    ctx.lineTo(cx + nx * 3 - ny * 3.6, cy + ny * 3 + nx * 3.6);
    ctx.lineTo(cx + nx * 3 + ny * 3.6, cy + ny * 3 - nx * 3.6);
    ctx.closePath();
    ctx.fill();
    ctx.font = "700 8px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e8ddc2";
    ctx.fillText("N", cx + nx * 20, cy + ny * 20);
    ctx.restore();
  }
}
function drawProjectedTerrain(b, m) {
  if (UI.view === "iso") {
    for (let sum = b.x0 + b.y0; sum <= b.x1 + b.y1; sum++)
      for (let x = b.x0; x <= b.x1; x++) {
        const y = sum - x;
        if (y >= b.y0 && y <= b.y1) drawTileProcedural(x, y);
      }
    return;
  }
  const q = obliqueBasis(m),
    tiles = [];
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++) tiles.push({ x, y, depth: -x * q.s + y * q.c });
  tiles.sort((a, c) => a.depth - c.depth || a.y - c.y || a.x - c.x);
  for (const tile of tiles) drawTileProcedural(tile.x, tile.y);
}
function renderWorldProcedural(now) {
  if (!W) return;
  resizeCanvas();
  ACTIVE_RENDER_NOW = now;
  updateCameraGlide(now);
  if (UI.followId && W.components.position[UI.followId]) {
    const p = W.components.position[UI.followId],
      t = VISUAL_MOTION.get(UI.followId),
      fx = t && Number.isFinite(t.wx) ? t.wx : p.x + 0.5,
      fy = t && Number.isFinite(t.wy) ? t.wy : p.y + 0.5,
      f = Math.min(0.62, 0.16 * Math.max(1, UI.speed * 0.3));
    UI.camera.x = lerp(UI.camera.x, fx, f);
    UI.camera.y = lerp(UI.camera.y, fy, f);
  }
  const m = (ACTIVE_RENDER_METRICS = projectionMetrics()),
    v = (ACTIVE_PLANET_VISUAL = makePlanetVisualGenome());
  {
    const ld = worldDirToScreen(Math.cos(v.lightAngle), Math.sin(v.lightAngle), m),
      ll = Math.hypot(ld.x, ld.y) || 1;
    ACTIVE_LIGHT_SCREEN = { x: ld.x / ll, y: ld.y / ll };
  }
  if (UI.view === "top") ACTIVE_TILE_SHADE = null;
  else {
    const en = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ],
      lx = Math.cos(v.lightAngle),
      ly = Math.sin(v.lightAngle);
    let li = 0,
      di = 0;
    for (let k = 1; k < 4; k++) {
      const dot = en[k][0] * lx + en[k][1] * ly;
      if (dot > en[li][0] * lx + en[li][1] * ly) li = k;
      if (dot < en[di][0] * lx + en[di][1] * ly) di = k;
    }
    ACTIVE_TILE_SHADE = { li, di };
  }
  const bg = ctx.createRadialGradient(
    m.w * 0.56,
    m.h * 0.42,
    0,
    m.w * 0.5,
    m.h * 0.5,
    Math.max(m.w, m.h) * 0.76,
  );
  bg.addColorStop(0, hsl(v.voidHue, 38, 12));
  bg.addColorStop(1, hsl(v.voidHue, 44, 4));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, m.w, m.h);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const b = visibleBounds();
  if (UI.view === "top") {
    drawTopTerrainLayer(m, v);
    if (UI.camera.zoom > 0.48 || UI.overlay)
      for (let y = b.y0; y <= b.y1; y++)
        for (let x = b.x0; x <= b.x1; x++) drawTopTileDetails(x, y, m, v);
  } else drawProjectedTerrain(b, m);
  drawEntitiesProcedural(now, b);
  drawProceduralAtmosphere(now, m, v);
  drawSelection();
  drawBrushPreview();
  UI.lastRender = now;
  ACTIVE_RENDER_METRICS = null;
  ACTIVE_PLANET_VISUAL = null;
}
terrainColor = terrainColorProcedural;
drawTile = drawTileProcedural;
renderWorld = renderWorldProcedural;
