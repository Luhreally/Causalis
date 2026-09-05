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
let ACTIVE_REDUCED_MOTION = false;
const CREATURE_VISUAL_CACHE = new Map();
// How far, in device-independent pixels, each terrain polygon grows past its
// true edge so neighbouring fills overlap instead of leaving an antialiased gap.
const TERRAIN_SEAM_BLEED = 0.75;
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
  harmonizePlanetPalette(palette, base, earthlike);
  const surface = makeSurfaceGenome(terrain, earthlike, alienness, {
    base,
    liquidHue,
    floraHue,
    mineralHue,
    accentHue,
  });
  const fauna = makeFaunaGenome(earthlike);
  PLANET_VISUAL_CACHE = {
    key,
    surface,
    fauna,
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
  SURFACE_TEXTURE_CACHE = null;
  SURFACE_FLORA_MASK = null;
  CREATURE_VISUAL_CACHE.clear();
  return PLANET_VISUAL_CACHE;
}
// ── Surface genome ─────────────────────────────────────────────────────────────
// Everything here is cosmetic and derived only from the seed and the terrain
// genome: the grain a surface is textured with, how its vegetation mixes, which
// way the wind blows, what drifts in the air, what the sky does, and how the
// liquid moves. It is read alongside world state and never written back, so the
// simulation hash and replay determinism are untouched. Its own random stream
// is separate from the palette stream so existing palettes keep their seeds.
let SURFACE_TEXTURE_CACHE = null,
  SURFACE_FLORA_MASK = null;
const SURFACE_GRAINS = Object.freeze([
  "banded",
  "mottled",
  "crystalline",
  "fibrous",
  "scaled",
  "dunes",
  "porous",
]);
function makeSurfaceGenome(terrain, earthlike, alienness, hues) {
  const r = makeRng(W.seed, "planet-surface-genome-v1"),
    t = W.tiles,
    n = W.tileCount,
    stride = Math.max(1, Math.floor(n / 4096));
  // A climate summary decides what the air carries: cold worlds snow, burned
  // worlds shed ash, dry bare worlds raise dust, green worlds loose pollen.
  let temp = 0,
    wet = 0,
    plant = 0,
    ash = 0,
    samples = 0;
  for (let i = 0; i < n; i += stride) {
    temp += t.temperature[i] / 10;
    wet += t.liquid[i] > 140 ? 1 : 0;
    plant += t.plantOrder[i];
    ash += t.chem[C.ASH][i];
    samples++;
  }
  temp /= samples;
  wet /= samples;
  plant /= samples;
  ash /= samples;
  const floraForms = ["rosette", "filament", "fan", "crystal", "bubble", "branching", "plate"],
    cloudForms = ["cumulus", "streak", "veil"],
    grain = earthlike ? "mottled" : SURFACE_GRAINS[r.int(SURFACE_GRAINS.length)],
    grainAngle = r.range(0, Math.PI),
    grainScale = earthlike ? 6 : r.range(3.2, 9),
    grainStrength = earthlike ? 0.42 : r.range(0.38, 0.86),
    floraFormAlt = earthlike
      ? r.next() < 0.5
        ? "fan"
        : "rosette"
      : floraForms[r.int(floraForms.length)],
    floraMix = r.range(0.25, 0.6),
    floraDensity = earthlike ? 1 : r.range(0.7, 1.5),
    wind = { angle: r.range(0, Math.PI * 2), speed: r.range(0.45, 1.6), gust: r.range(0.2, 1) },
    clouds = {
      form: earthlike ? "cumulus" : cloudForms[r.int(cloudForms.length)],
      coverage: clamp((earthlike ? 0.3 : r.range(0.05, 0.6)) + wet * 0.2, 0, 0.75),
      scale: r.range(5, 13),
      speed: r.range(0.5, 1.4),
    },
    roll = r.next(),
    // Thresholds sit inside the range the generator actually produces (mean
    // temperature 11 to 22, liquid fraction 0.2 to 0.7, plant order 140 to 340
    // across sampled seeds) so every kind of air turns up somewhere.
    particleKind =
      temp < 12.5
        ? "snow"
        : ash > 20
          ? "ash"
          : wet < 0.3 && plant < 230
            ? "dust"
            : plant > 260
              ? roll < 0.5
                ? "pollen"
                : "spores"
              : alienness > 0.55 && roll < 0.6
                ? "motes"
                : roll < 0.8
                  ? "pollen"
                  : "none",
    particle = {
      kind: particleKind,
      hue:
        particleKind === "snow"
          ? hues.liquidHue
          : particleKind === "ash"
            ? wrapHue(hues.mineralHue - 10)
            : particleKind === "dust"
              ? hues.mineralHue
              : particleKind === "spores"
                ? wrapHue(hues.floraHue + 30)
                : particleKind === "motes"
                  ? hues.accentHue
                  : wrapHue(hues.accentHue + 20),
      density: r.range(0.6, 1.4),
    },
    sky = {
      aurora: !earthlike && alienness > 0.5 && r.next() < 0.5,
      auroraHue: wrapHue(hues.accentHue + r.range(-40, 40)),
    },
    water = {
      angle: r.range(0, Math.PI * 2),
      speed: r.range(0.6, 1.5),
      amplitude: r.range(0.7, 1.4),
    };
  return {
    grain,
    grainAngle,
    grainScale,
    grainStrength,
    floraFormAlt,
    floraMix,
    floraDensity,
    wind,
    clouds,
    particle,
    sky,
    water,
    climate: { temp: +temp.toFixed(1), wet: +wet.toFixed(2), plant: Math.round(plant) },
  };
}
// ── Fauna morphospace ──────────────────────────────────────────────────────────
// Each world favours a few body plans and shares a family resemblance across
// its creatures: how limbs are built, what a head looks like, tails, skin
// finish, eyes, ornaments, and which patterns occur. Species still differ
// within that space through their genomes. People get an upright form and,
// per culture, a style of dress. Cosmetic only, from its own random stream.
const FAUNA_PLANS = Object.freeze([
  "bilateral",
  "radial",
  "tripod",
  "serpentine",
  "shelled",
  "floater",
  "colonial",
]);
const FAUNA_PATTERNS = Object.freeze([
  "spots",
  "bands",
  "veins",
  "plates",
  "rings",
  "plain",
  "speckle",
  "mosaic",
  "gradient",
  "stripes",
]);
const DRESS_STYLES = Object.freeze(["band", "sash", "cloak", "paint", "collar"]);
function makeFaunaGenome(earthlike) {
  const r = makeRng(W.seed, "planet-fauna-genome-v1"),
    pick = (list) => list[r.int(list.length)],
    planWeights = FAUNA_PLANS.map(() => +Math.pow(r.next(), 2.4).toFixed(3)),
    patterns = [];
  while (patterns.length < 3) {
    const p = pick(FAUNA_PATTERNS);
    if (!patterns.includes(p)) patterns.push(p);
  }
  if (earthlike) {
    planWeights.fill(0);
    planWeights[0] = 1;
  }
  const limbStyle = earthlike
      ? "jointed"
      : pick(["jointed", "tentacle", "stilt", "paddle", "hooked"]),
    headStyle = earthlike ? "bulb" : pick(["none", "bulb", "crest", "beak", "stalks", "hood"]),
    tail = earthlike
      ? r.next() < 0.6
        ? "whip"
        : "none"
      : pick(["none", "whip", "fan", "club", "twin"]),
    skin = earthlike
      ? r.next() < 0.5
        ? "furred"
        : "matte"
      : pick(["matte", "glossy", "iridescent", "translucent", "furred"]),
    eyeStyle = earthlike ? "dot" : pick(["dot", "slit", "compound", "glow", "ring"]),
    ornament = earthlike
      ? r.next() < 0.3
        ? "antlers"
        : "none"
      : pick(["none", "antlers", "fins", "tendrils", "lanterns", "plates"]),
    ornamentChance = +r.range(0.15, 0.6).toFixed(2),
    silhouette = {
      bulk: +r.range(0.8, 1.25).toFixed(2),
      limb: +r.range(0.75, 1.35).toFixed(2),
      neck: +r.range(0, 1).toFixed(2),
    },
    people = {
      form: earthlike ? "biped" : pick(["biped", "tall", "broad", "tripod", "quadruped"]),
      head: earthlike ? "round" : pick(["round", "tall", "crested", "hooded", "split"]),
      uprightShare: earthlike ? 1 : +r.range(0.35, 1).toFixed(2),
    };
  return {
    planWeights,
    patterns: earthlike ? ["spots", "bands", "plain"] : patterns,
    limbStyle,
    headStyle,
    tail,
    skin,
    eyeStyle,
    ornament,
    ornamentChance,
    silhouette,
    people,
  };
}
function reducedMotionPreferred() {
  try {
    return !!document.body?.classList?.contains("reduced-motion");
  } catch (error) {
    return false;
  }
}
// Value noise on a seeded permutation table: cheap enough to sample several
// hundred thousand times while a texture is baked.
function makeGrainNoise(seed) {
  const r = makeRng(seed, "grain-permutation"),
    order = Array.from({ length: 256 }, (_, i) => i),
    perm = new Uint8Array(512);
  for (let i = 255; i > 0; i--) {
    const j = r.int(i + 1),
      swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  for (let i = 0; i < 512; i++) perm[i] = order[i & 255];
  return (x, y) => {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      xf = x - xi,
      yf = y - yi,
      X = xi & 255,
      Y = yi & 255,
      sx = xf * xf * (3 - 2 * xf),
      sy = yf * yf * (3 - 2 * yf),
      a = perm[X + perm[Y]] / 255,
      b = perm[X + 1 + perm[Y]] / 255,
      c = perm[X + perm[Y + 1]] / 255,
      d = perm[X + 1 + perm[Y + 1]] / 255;
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
}
// The grain field in world coordinates, in [-1, 1]: positive lightens, negative
// darkens. Each grammar is a different way of organising the same noise.
function surfaceGrainAt(s, noise, x, y) {
  const k = 1 / s.grainScale,
    ca = Math.cos(s.grainAngle),
    sa = Math.sin(s.grainAngle),
    u = x * ca + y * sa,
    n1 = noise(x * k * 2.3, y * k * 2.3) - 0.5,
    n2 = noise(x * k * 5.1 + 17, y * k * 5.1 + 9) - 0.5;
  switch (s.grain) {
    case "banded":
      return Math.sin(u * k * Math.PI * 2 + n1 * 3) * 0.8 + n2 * 0.4;
    case "fibrous":
      return Math.sin((u + n1 * s.grainScale * 1.6) * k * Math.PI * 3) * 0.7 + n2 * 0.3;
    case "dunes": {
      const phase = (((u * k * 1.4 + n1 * 0.8) % 1) + 1) % 1,
        crest = phase < 0.7 ? phase / 0.7 : 1 - (phase - 0.7) / 0.3;
      return crest * 1.6 - 0.8 + n2 * 0.3;
    }
    case "crystalline": {
      const cs = s.grainScale * 0.9,
        gx = Math.round(x / cs),
        gy = Math.round(y / cs);
      let f1 = 9,
        f2 = 9;
      for (let oy = -1; oy <= 0; oy++)
        for (let ox = -1; ox <= 0; ox++) {
          const cx = gx + ox,
            cy = gy + oy,
            px = (cx + noise(cx * 7.7 + 0.5, cy * 7.7 + 0.5)) * cs,
            py = (cy + noise(cx * 7.7 + 31.5, cy * 7.7 + 5.5)) * cs,
            d = Math.hypot(px - x, py - y) / cs;
          if (d < f1) {
            f2 = f1;
            f1 = d;
          } else if (d < f2) f2 = d;
        }
      return (clamp((f2 - f1) * 3, 0, 1) - 0.55) * 1.6 + n2 * 0.25;
    }
    case "scaled": {
      const cs = s.grainScale * 0.6,
        gx = x / cs,
        gy = y / cs + (Math.floor(x / cs) % 2) * 0.5,
        fx = gx - Math.round(gx),
        fy = gy - Math.round(gy);
      return (0.5 - Math.hypot(fx, fy)) * 2.2 + n2 * 0.3;
    }
    case "porous": {
      const b = noise(x * k * 3.7 + 41, y * k * 3.7 + 3);
      return b > 0.62 ? -((b - 0.62) / 0.38) * 1.4 : n2 * 0.5 + 0.15;
    }
    default:
      return n1 * 1.5 + n2 * 0.8;
  }
}
// The top-down grain texture is baked once per world at a few texels per tile
// and composited over the colour bitmap with an overlay blend. Baking is spread
// across frames so a new world never stalls on its first render.
function surfaceTexture(v) {
  const s = v.surface;
  if (!s) return null;
  const scale = W.tileCount > 20000 ? 3 : 4,
    key = `${v.key}:${scale}`;
  if (!SURFACE_TEXTURE_CACHE || SURFACE_TEXTURE_CACHE.key !== key) {
    const canvas = document.createElement("canvas"),
      width = W.width * scale,
      height = W.height * scale;
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d"),
      image =
        g && typeof g.createImageData === "function" ? g.createImageData(width, height) : null;
    SURFACE_TEXTURE_CACHE = {
      key,
      canvas: image && image.data ? canvas : null,
      g,
      image,
      scale,
      width,
      height,
      row: 0,
      done: !(image && image.data),
      noise: makeGrainNoise(hashParts(W.seedHash, "surface-grain")),
    };
  }
  const cache = SURFACE_TEXTURE_CACHE;
  if (cache.done) return cache;
  const started = performance.now(),
    data = cache.image.data,
    liquid = W.tiles.liquid,
    { width, height, scale: px } = cache;
  while (cache.row < height && performance.now() - started < 4) {
    const py = cache.row,
      ty = Math.min(W.height - 1, (py / px) | 0);
    for (let x = 0; x < width; x++) {
      const tx = Math.min(W.width - 1, (x / px) | 0),
        grain = clamp(surfaceGrainAt(s, cache.noise, x / px, py / px), -1, 1),
        wet = liquid[ty * W.width + tx] > 140,
        alpha = Math.abs(grain) * s.grainStrength * (wet ? 0.28 : 0.62),
        o = (py * width + x) * 4,
        light = grain > 0 ? 255 : 0;
      data[o] = light;
      data[o + 1] = light;
      data[o + 2] = light;
      data[o + 3] = Math.round(clamp(alpha, 0, 1) * 255);
    }
    cache.row++;
  }
  if (cache.row >= height) {
    cache.g.putImageData(cache.image, 0, 0);
    cache.done = true;
  }
  return cache;
}
// Vegetation mixes two motif forms in coherent patches rather than one form
// everywhere; the mask is baked once per world.
function floraMaskCache(v) {
  if (SURFACE_FLORA_MASK && SURFACE_FLORA_MASK.key === v.key) return SURFACE_FLORA_MASK.mask;
  const mask = new Uint8Array(W.tileCount),
    mix = v.surface?.floraMix ?? 0;
  for (let y = 0; y < W.height; y++)
    for (let x = 0; x < W.width; x++)
      if (noise2(W.seedHash ^ 0x3f1d, x / 7, y / 7) < mix) mask[y * W.width + x] = 1;
  SURFACE_FLORA_MASK = { key: v.key, mask };
  return mask;
}
function floraFormAt(v, i) {
  if (!v.surface) return v.floraForm;
  return floraMaskCache(v)[i] ? v.surface.floraFormAlt : v.floraForm;
}
// Wind is a travelling wave across the map: the same phase field sways plant
// motifs and canopy crowns so gusts visibly move through a forest.
function windSwayAt(v, x, y) {
  const s = v.surface;
  if (!s || UI.quality === "low" || ACTIVE_REDUCED_MOTION) return 0;
  const w = s.wind;
  return (
    Math.sin(
      ACTIVE_RENDER_NOW * 0.0011 * w.speed + (x * Math.cos(w.angle) + y * Math.sin(w.angle)) * 0.5,
    ) *
    (0.1 + 0.24 * w.gust)
  );
}
// In projected views the baked texture cannot be draped over a heightfield, so
// a fraction of the tiles near the camera carry one hand-drawn grain mark in
// the grammar's shape instead: a stroke along the banding, a facet, a blotch.
function drawGrainMark(x, y, i, p, m, v) {
  const s = v.surface,
    pick = visualHash01(i, 0x5e3);
  if (!s || pick > 0.35 + s.grainStrength * 0.45) return;
  const cache = terrainToneCache(),
    lum = cache.lum[i] || 40,
    light = visualHash01(i, 0x6a1) > 0.5,
    tone = hsl(
      cache.hue[i] || v.mineralHue,
      clamp((cache.sat[i] || 30) * 0.8, 6, 60),
      light ? clamp(lum + 14, 12, 90) : clamp(lum - 12, 4, 80),
      0.06 + 0.28 * s.grainStrength,
    ),
    r = m.tw * 0.36,
    dir = worldDirToScreen(Math.cos(s.grainAngle), Math.sin(s.grainAngle), m),
    dl = Math.hypot(dir.x, dir.y) || 1,
    dx = dir.x / dl,
    dy = dir.y / dl,
    jx = (visualHash01(i, 0x7b1) - 0.5) * m.tw * 0.4,
    jy = (visualHash01(i, 0x7c1) - 0.5) * m.th * 0.4,
    rot = visualHash01(i, 0x8d1) * Math.PI;
  ctx.strokeStyle = tone;
  ctx.fillStyle = tone;
  ctx.lineWidth = clamp(m.tw * 0.045, 0.5, 2.2);
  ctx.beginPath();
  if (s.grain === "banded" || s.grain === "fibrous" || s.grain === "dunes") {
    ctx.moveTo(p.x + jx - dx * r, p.y + jy - dy * r * 0.6);
    ctx.lineTo(p.x + jx + dx * r, p.y + jy + dy * r * 0.6);
    ctx.stroke();
  } else if (s.grain === "crystalline" || s.grain === "scaled") {
    const sides = s.grain === "scaled" ? 6 : 4,
      rr = r * 0.5;
    for (let n = 0; n < sides; n++) {
      const a = rot + (n * Math.PI * 2) / sides,
        vx = p.x + jx + Math.cos(a) * rr,
        vy = p.y + jy + Math.sin(a) * rr * 0.6;
      if (n) ctx.lineTo(vx, vy);
      else ctx.moveTo(vx, vy);
    }
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.ellipse(p.x + jx, p.y + jy, r * 0.45, r * 0.22, rot, 0, Math.PI * 2);
    ctx.fill();
  }
}
// ── Living sky ─────────────────────────────────────────────────────────────────
// Cloud shadows, wind sweeps, whatever the air carries, and an aurora where the
// planet has one. All live: they run every frame from the wall clock and read
// only weather and the surface genome.
function drawSurfaceWeatherLayers(now, m, v) {
  const s = v.surface;
  if (!s || UI.quality === "low") return;
  const clock = ACTIVE_REDUCED_MOTION ? 0 : now;
  drawCloudShadows(clock, m, v, s);
  if (UI.quality === "high" && UI.camera.zoom > 1.1 && !ACTIVE_REDUCED_MOTION)
    drawWindSweep(clock, m, v, s);
  drawAirborneParticles(clock, m, v, s);
  if (UI.quality === "high" && UI.view !== "top" && s.sky.aurora) drawAurora(clock, m, v, s);
}
function drawCloudShadows(now, m, v, s) {
  const weather = W.weather?.name || "Clear",
    cover = clamp(
      s.clouds.coverage + (/Rain|Storm/.test(weather) ? 0.25 : weather === "Heat Wave" ? -0.15 : 0),
      0,
      0.85,
    ),
    count = Math.round(cover * 8);
  if (!count) return;
  const drift = s.wind.speed * s.clouds.speed * 0.0018,
    wx = Math.cos(s.wind.angle) * drift,
    wy = Math.sin(s.wind.angle) * drift,
    spanX = W.width + 24,
    spanY = W.height + 24,
    alpha = (0.08 + cover * 0.08) * (UI.view === "top" ? 1 : 0.85);
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  for (let n = 0; n < count; n++) {
    const ax = visualHash01(n, 0xc10d) * spanX,
      ay = visualHash01(n, 0xc20d) * spanY,
      cx0 = ((((ax + now * wx) % spanX) + spanX) % spanX) - 12,
      cy0 = ((((ay + now * wy) % spanY) + spanY) % spanY) - 12,
      size = s.clouds.scale * (0.7 + visualHash01(n, 0xc30d) * 0.7),
      lobes = s.clouds.form === "veil" ? 1 : s.clouds.form === "streak" ? 2 : 3;
    for (let k = 0; k < lobes; k++) {
      const ox =
          s.clouds.form === "streak"
            ? (k - 0.5) * size * 0.9 * Math.cos(s.wind.angle)
            : (k - 1) * size * 0.35,
        oy =
          s.clouds.form === "streak"
            ? (k - 0.5) * size * 0.9 * Math.sin(s.wind.angle)
            : (k % 2) * size * 0.25,
        p = proceduralProjectTile(cx0 + ox, cy0 + oy, m, false),
        rx = size * m.tw * (s.clouds.form === "veil" ? 1.6 : 0.65),
        ry = rx * (UI.view === "top" ? 0.7 : 0.42);
      if (p.x < -rx || p.x > m.w + rx || p.y < -ry || p.y > m.h + ry) continue;
      const shade = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rx);
      shade.addColorStop(0, hsl(v.atmosphereHue, 30, 40, alpha));
      shade.addColorStop(0.6, hsl(v.atmosphereHue, 30, 40, alpha * 0.5));
      shade.addColorStop(1, hsl(v.atmosphereHue, 30, 40, 0));
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
function drawWindSweep(now, m, v, s) {
  const d = worldDirToScreen(Math.cos(s.wind.angle), Math.sin(s.wind.angle), m),
    l = Math.hypot(d.x, d.y) || 1,
    ux = d.x / l,
    uy = d.y / l,
    period = Math.max(120, m.tw * 14),
    travel = (now * 0.00025 * s.wind.speed * m.tw * 4) % period,
    len = Math.hypot(m.w, m.h) + period,
    gx0 = m.w / 2 - (ux * len) / 2 + ux * travel,
    gy0 = m.h / 2 - (uy * len) / 2 + uy * travel,
    sweep = ctx.createLinearGradient(gx0, gy0, gx0 + ux * len, gy0 + uy * len),
    bands = Math.max(1, Math.ceil(len / period)),
    a = 0.035 + s.wind.gust * 0.03;
  for (let n = 0; n <= bands; n++) {
    const t0 = n / bands;
    sweep.addColorStop(clamp(t0, 0, 1), hsl(v.accentHue, 40, 80, 0));
    sweep.addColorStop(clamp(t0 + 0.5 / bands, 0, 1), hsl(v.accentHue, 40, 80, a));
    if (n < bands) sweep.addColorStop(clamp(t0 + 0.75 / bands, 0, 1), hsl(v.accentHue, 40, 80, 0));
  }
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, m.w, m.h);
  ctx.restore();
}
function drawAirborneParticles(now, m, v, s) {
  const weather = W.weather?.name || "Clear",
    // Precipitation falls as snow where the ground under the camera is below freezing.
    freezing =
      W.tiles.temperature[
        idx(
          clamp(Math.round(UI.camera.x), 0, W.width - 1),
          clamp(Math.round(UI.camera.y), 0, W.height - 1),
        )
      ] < 0,
    kind = /Rain|Storm/.test(weather) ? (freezing ? "snow" : "rain") : s.particle.kind;
  if (kind === "none") return;
  const quality = UI.quality === "high" ? 1 : 0.55,
    count = Math.round(
      (kind === "rain" ? 90 : kind === "snow" ? 70 : kind === "motes" ? 26 : 40) *
        s.particle.density *
        quality,
    ),
    sd = worldDirToScreen(Math.cos(s.wind.angle), Math.sin(s.wind.angle), m),
    sl = Math.hypot(sd.x, sd.y) || 1,
    dx = sd.x / sl,
    dy = sd.y / sl,
    scale = clamp(UI.camera.zoom * 0.35 + 0.6, 0.7, 2);
  ctx.save();
  if (kind === "motes" || kind === "pollen") ctx.globalCompositeOperation = "lighter";
  for (let n = 0; n < count; n++) {
    const a = visualHash01(n, 0xa11d),
      b = visualHash01(n, 0xa21d),
      c = visualHash01(n, 0xa31d),
      speed =
        (kind === "rain"
          ? 0.55
          : kind === "dust"
            ? 0.16
            : kind === "snow"
              ? 0.045
              : kind === "ash"
                ? 0.035
                : 0.03) *
        (0.7 + c * 0.6) *
        s.wind.speed,
      fall =
        kind === "rain"
          ? 0.9
          : kind === "snow"
            ? 0.35
            : kind === "ash"
              ? -0.12
              : kind === "dust"
                ? 0.05
                : 0.08,
      vx = dx * speed * (kind === "rain" ? 0.35 : 1),
      vy = fall * speed + dy * speed * 0.3,
      sway = kind === "rain" || kind === "dust" ? 0 : Math.sin(now * 0.0012 + n * 1.7) * 6,
      x = (((a * m.w + now * vx + sway) % m.w) + m.w) % m.w,
      y = (((b * m.h + now * vy) % m.h) + m.h) % m.h,
      size =
        (kind === "rain" ? 1 : kind === "snow" ? 1.6 : kind === "motes" ? 1.4 : 1.1) *
        (0.6 + c * 0.9) *
        scale;
    if (kind === "rain") {
      ctx.strokeStyle = hsl(v.liquidHue, 55, 78, 0.28);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - dx * 6 * size, y - 9 * size);
      ctx.stroke();
      continue;
    }
    const pulse = kind === "motes" ? 0.45 + 0.55 * Math.abs(Math.sin(now * 0.002 + n)) : 1,
      alpha =
        (kind === "snow" ? 0.7 : kind === "ash" ? 0.45 : kind === "dust" ? 0.22 : 0.5) * pulse,
      light = kind === "snow" ? 92 : kind === "ash" ? 28 : kind === "dust" ? 64 : 70;
    ctx.fillStyle = hsl(
      s.particle.hue,
      kind === "snow" ? 20 : kind === "ash" ? 12 : 60,
      light,
      alpha,
    );
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function drawAurora(now, m, v, s) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let band = 0; band < 3; band++) {
    const baseY = m.h * (0.06 + band * 0.05),
      amp = m.h * 0.03,
      hue = wrapHue(s.sky.auroraHue + band * 22),
      alpha = 0.05 + 0.03 * Math.abs(Math.sin(now * 0.0004 + band));
    ctx.fillStyle = hsl(hue, 70, 62, alpha);
    ctx.beginPath();
    ctx.moveTo(0, baseY - amp * 2);
    for (let x = 0; x <= m.w; x += m.w / 12)
      ctx.lineTo(x, baseY + Math.sin((x / m.w) * 5 + now * 0.0006 + band) * amp);
    ctx.lineTo(m.w, baseY + m.h * 0.08);
    ctx.lineTo(0, baseY + m.h * 0.08);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
// An alien biome palette is drawn from an independent hue harmony per band, so
// two neighbouring biomes could land on fully saturated complements and the
// world read as a political map. Hue variety is the planet's identity and is
// kept; chroma and value are pulled toward the planet's own key so those hues
// read as materials under one sun. Earth-adjacent palettes are already coherent.
function harmonizePlanetPalette(palette, base, earthlike) {
  if (earthlike) return palette;
  const tones = Object.values(palette),
    keySat = mean(tones.map((t) => t.s)),
    keyLum = mean(tones.map((t) => t.l)),
    // Circular mean of the band hues: the direction the planet already leans.
    keyHue = wrapHue(
      (Math.atan2(
        mean(tones.map((t) => Math.sin((t.h * Math.PI) / 180))),
        mean(tones.map((t) => Math.cos((t.h * Math.PI) / 180))),
      ) *
        180) /
        Math.PI,
    );
  for (const tone of tones) {
    tone.h = mixHue(mixHue(tone.h, keyHue, 0.3), base, 0.1);
    tone.s = clamp(keySat + (tone.s - keySat) * 0.64, 9, 55);
    tone.l = clamp(keyLum + (tone.l - keyLum) * 0.84, 12, 62);
  }
  return palette;
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
// Neighbouring fills antialias against whatever lies behind them, so a
// projected heightfield grows a dark hairline grid where the void shows
// through. Growing each tile by a fraction of a pixel about its own centre
// closes those seams for the cost of four multiplies — far cheaper than
// stroking every polygon, and it does not change the silhouette.
function bleedPolygon(poly, cx, cy, span) {
  const k = 1 + TERRAIN_SEAM_BLEED / Math.max(2, span);
  for (const point of poly) {
    point[0] = cx + (point[0] - cx) * k;
    point[1] = cy + (point[1] - cy) * k;
  }
  return poly;
}
// The half-extent of a tile depends only on the projection, so it is resolved
// once per frame and hung off the metrics rather than recomputed per tile.
function tileBleedSpan(m) {
  if (m.bleedSpan != null && m.bleedView === UI.view) return m.bleedSpan;
  let span;
  if (UI.view === "iso") span = Math.min(m.tw, m.th) / 2;
  else {
    const q = obliqueBasis(m);
    span = Math.min(Math.hypot(q.xx, q.xy), Math.hypot(q.yx, q.yy)) * 0.5;
  }
  m.bleedView = UI.view;
  return (m.bleedSpan = span);
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
    return bleedPolygon(
      [
        [p.x, p.y - m.th / 2],
        [p.x + m.tw / 2, p.y],
        [p.x, p.y + m.th / 2],
        [p.x - m.tw / 2, p.y],
      ],
      p.x,
      p.y,
      tileBleedSpan(m),
    );
  const q = obliqueBasis(m),
    hx = q.xx * 0.5,
    hy = q.xy * 0.5,
    kx = q.yx * 0.5,
    ky = q.yy * 0.5;
  return bleedPolygon(
    [
      [p.x - hx - kx, p.y - hy - ky],
      [p.x + hx - kx, p.y + hy - ky],
      [p.x + hx + kx, p.y + hy + ky],
      [p.x - hx + kx, p.y - hy + ky],
    ],
    p.x,
    p.y,
    tileBleedSpan(m),
  );
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
  // Terrain tones depend on neighbouring biome/elevation state as well as the
  // newer temperature, solvent, and fire fields. Include both sets in the
  // signature so the blended colour cache never lags behind the simulation.
  const coarse = (j) =>
    ((t.elevation[j] >>> 5) | ((t.liquid[j] >>> 7) << 6) | ((t.plantOrder[j] >>> 7) << 12)) >>> 0;
  s ^= Math.imul(coarse(x ? i - 1 : i), 0x7feb352d);
  s ^= Math.imul(coarse(x < W.width - 1 ? i + 1 : i), 0x846ca68b);
  s ^= Math.imul(coarse(y ? i - W.width : i), 0x2545f491);
  s ^= Math.imul(coarse(y < W.height - 1 ? i + W.width : i), 0x9e3779b9);
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
function paletteToneAt(v, i) {
  return v.palette[biomeAt(i)] || { h: v.floraHue, s: 35, l: 42 };
}
// Neighbour-weighted tone. Hard palette steps between adjacent biomes are the
// single largest source of "paint by numbers" flatness; a partial blend keeps
// each biome identifiable while letting the boundary read as a transition.
// Shorelines keep most of their contrast so land and liquid stay legible.
function blendedTerrainTone(v, i, x, y) {
  const base = paletteToneAt(v, i),
    wet = W.tiles.liquid[i] > 140;
  let h = base.h,
    s = base.s,
    l = base.l;
  const pull = (j) => {
    const q = paletteToneAt(v, j),
      w = W.tiles.liquid[j] > 140 === wet ? 0.16 : 0.06;
    h = mixHue(h, q.h, w);
    s += (q.s - s) * w;
    l += (q.l - l) * w;
  };
  if (x) pull(i - 1);
  if (x < W.width - 1) pull(i + 1);
  if (y) pull(i - W.width);
  if (y < W.height - 1) pull(i + W.width);
  return { h, s, l };
}
// Reached several times per tile per frame, so validity is an identity check on
// the genome object rather than a freshly built key string.
function terrainToneCache() {
  const v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome();
  if (
    TILE_VISUAL_CACHE &&
    TILE_VISUAL_CACHE.planet === v &&
    TILE_VISUAL_CACHE.count === W.tileCount
  )
    return TILE_VISUAL_CACHE;
  TILE_VISUAL_CACHE = {
    planet: v,
    count: W.tileCount,
    signatures: new Int32Array(W.tileCount),
    colors: Array(W.tileCount),
    hue: new Float32Array(W.tileCount),
    sat: new Float32Array(W.tileCount),
    lum: new Float32Array(W.tileCount),
  };
  TILE_VISUAL_CACHE.signatures.fill(-2147483648);
  return TILE_VISUAL_CACHE;
}
function terrainColorProcedural(i) {
  const v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    cache = terrainToneCache(),
    signature = terrainVisualSignature(i);
  if (cache.signatures[i] === signature && cache.colors[i]) return cache.colors[i];
  const t = W.tiles,
    x = i % W.width,
    y = (i / W.width) | 0,
    tone = blendedTerrainTone(v, i, x, y),
    e = t.elevation[i],
    left = t.elevation[y * W.width + Math.max(0, x - 1)],
    right = t.elevation[y * W.width + Math.min(W.width - 1, x + 1)],
    up = t.elevation[Math.max(0, y - 1) * W.width + x],
    down = t.elevation[Math.min(W.height - 1, y + 1) * W.width + x],
    lx = Math.cos(v.lightAngle),
    ly = Math.sin(v.lightAngle),
    // Directional key light plus concavity: ridges catch the light, hollows
    // and valley floors collect ambient occlusion.
    lit = clamp(((left - right) * lx + (up - down) * ly) / 58, -9, 9),
    occlusion = clamp(((left + right + up + down) / 4 - e) / 62, -1.1, 1.1),
    // Per-tile grain reads as dither noise once neighbouring tones are close,
    // so most of the variation now comes from coherent multi-scale noise.
    grain = (visualHash01(i, 0x731d) - 0.5) * 2.6,
    macro =
      (noise2(W.seedHash ^ 0x8ab3, x / 9, y / 9) - 0.5) * 4.4 +
      (noise2(W.seedHash ^ 0x51c7, x / 2.7, y / 2.7) - 0.5) * 2.4,
    temp = t.temperature[i] / 10,
    cold = temp < 0 ? clamp(-temp * 0.32, 0, 12) : 0,
    toxin = clamp(t.chem[C.TOXIN][i] / 800, 0, 1),
    // Warm key, cool sky-fill: shaded faces drift toward the atmosphere rather
    // than simply going grey, which is what sells a lit surface.
    hue = mixHue(
      tone.h + toxin * 9,
      lit >= 0 ? v.accentHue : v.atmosphereHue,
      clamp(Math.abs(lit) * 0.017, 0, 0.15),
    ),
    sat = clamp(tone.s - cold * 0.7 + toxin * 7 + lit * 0.9 - occlusion * 2, 8, 78),
    lum = clamp(tone.l + lit + grain + macro + cold - occlusion * 3.4, 8, 80),
    color = hsl(hue, sat, lum, 1);
  cache.signatures[i] = signature;
  cache.colors[i] = color;
  cache.hue[i] = hue;
  cache.sat[i] = sat;
  cache.lum[i] = lum;
  return color;
}
// The projected height difference between two columns leaves a real gap, so a
// face always has to close it. What made the old landscape read as corduroy was
// painting every one of those gaps at a fixed dark mineral tone: a one-unit
// ripple looked exactly like a cliff. The face is now tinted from the tile it
// belongs to and darkened in proportion to the step, so gentle relief melts into
// the surface and only genuine escarpments read as shadowed rock.
function terrainFaceColor(i, drop, shaded) {
  const cache = terrainToneCache();
  if (cache.signatures[i] === -2147483648 || !cache.colors[i]) terrainColorProcedural(i);
  const v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    depth = clamp(drop / 300, 0, 1),
    shade = (shaded ? 0.44 : 0.24) * (0.28 + 0.72 * depth);
  return hsl(
    mixHue(cache.hue[i], shaded ? v.atmosphereHue : v.accentHue, 0.06 + depth * 0.08),
    clamp(cache.sat[i] * (1 - depth * 0.18), 6, 66),
    clamp(cache.lum[i] * (1 - shade), 6, 66),
    1,
  );
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
  const swell = Math.sin(ACTIVE_RENDER_NOW * 0.0018 + (x + y) * 0.9),
    // Surf is a local detail. Held at full strength while zoomed out it becomes
    // a continuous cartoon outline traced around every landmass.
    near = clamp(UI.camera.zoom * 0.75, 0.34, 1),
    // Straight down, a shoreline is a wet margin rather than breaking surf; the
    // bright line is held back so it does not trace a neon outline round a coast.
    plan = UI.view === "top" ? 0.55 : 1,
    path = () => {
      ctx.beginPath();
      for (const [a, b] of edges) {
        ctx.moveTo(poly[a][0], poly[a][1]);
        ctx.lineTo(poly[b][0], poly[b][1]);
      }
      ctx.stroke();
    };
  // Two passes: a wide diffuse wash for the wet margin, then the thin bright
  // break line on top. One flat stroke never reads as surf. The wash is only
  // worth its stroke once a tile is big enough for the margin to be visible.
  if (UI.quality !== "low" && m.tw >= 7) {
    ctx.strokeStyle = hsl(v.liquidHue - 8, 62, 66, (0.16 + swell * 0.05) * near);
    ctx.lineWidth = clamp(m.tw * 0.24, 0.9, 26);
    path();
  }
  ctx.strokeStyle = hsl(v.liquidHue - 18, 50, 80, (0.34 + swell * 0.12) * near * plan);
  ctx.lineWidth = clamp(m.tw * 0.07, 0.45, 7);
  path();
}
// Liquid is otherwise a single flat wash. Depth banding plus a drifting
// specular highlight give the surface a plane and a light source.
function drawWaterSurface(x, y, i, p, m, v, top) {
  // Sub-pixel sparkle is invisible and expensive, so the highlight only exists
  // once a tile is large enough on screen to hold one.
  if (UI.quality === "low" || m.tw < 9) return;
  const now = ACTIVE_RENDER_NOW,
    glitter =
      Math.sin(now * 0.0021 + x * 0.83 + y * 1.27) * Math.cos(now * 0.0013 - x * 0.41 + y * 0.66);
  if (glitter < 0.72) return;
  const depth = clamp(W.tiles.liquid[i] / 2500, 0, 1),
    strength = (glitter - 0.72) / 0.28,
    r = Math.max(0.6, m.tw * 0.17 * (0.5 + strength * 0.7)),
    L = ACTIVE_LIGHT_SCREEN || { x: 0.62, y: 0.5 };
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = hsl(v.liquidHue - 26, 70, 72, 0.1 + strength * 0.16 * (1 - depth * 0.45));
  ctx.beginPath();
  ctx.ellipse(
    p.x - L.x * r * 0.5,
    p.y - (top ? 0 : r * 0.28) - L.y * r * 0.3,
    r,
    r * (top ? 0.62 : 0.3),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
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
    // Crowns lean with the wind field while the trunk stays rooted.
    const crownSway = windSwayAt(v, x, y) * r * 0.45;
    if (crownSway) ctx.translate(crownSway, Math.abs(crownSway) * 0.15);
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
    // Vents breathe: two puffs rise, spread, and fade on the wall clock.
    if (UI.quality !== "low" && !ACTIVE_REDUCED_MOTION) {
      const now = ACTIVE_RENDER_NOW;
      for (let n = 0; n < 2; n++) {
        const t = (((now * 0.00035 * (1 + n * 0.3) + visualHash01(i, 0x9d + n)) % 1) + 1) % 1,
          pr = r * (0.18 + t * 0.5);
        ctx.fillStyle = hsl(hue + 30, 30, 82, (1 - t) * 0.22);
        ctx.beginPath();
        ctx.arc(
          p.x + (n - 0.5) * r * 0.4 + Math.sin(t * 6 + n) * r * 0.25,
          p.y - h * 1.25 - t * h * 1.4,
          pr,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
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
// Worn paths: traffic the simulation records is drawn as darkened ground
// joining neighbouring worn tiles, so trails and roads emerge where feet go.
function drawWornPath(x, y, i, p, m, v) {
  const traffic = W.tiles.traffic;
  if (!traffic || traffic[i] <= 260 || W.tiles.liquid[i] > 140) return;
  const strength = clamp((traffic[i] - 260) / 2400, 0.15, 1),
    cache = terrainToneCache();
  ctx.strokeStyle = hsl(
    v.mineralHue,
    clamp((cache.sat[i] || 30) * 0.6, 8, 40),
    clamp((cache.lum[i] || 40) - 10 - strength * 8, 6, 70),
    0.3 + strength * 0.45,
  );
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1, m.tw * (0.16 + strength * 0.16));
  let drawn = false;
  ctx.beginPath();
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [1, 1],
    [-1, 1],
  ]) {
    const nx = x + dx,
      ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W.width || ny >= W.height) continue;
    const j = ny * W.width + nx;
    if (traffic[j] <= 260 || W.tiles.liquid[j] > 140) continue;
    const q = proceduralProjectTile(nx + 0.5, ny + 0.5, m);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    drawn = true;
  }
  if (!drawn) {
    ctx.moveTo(p.x - m.tw * 0.2, p.y);
    ctx.lineTo(p.x + m.tw * 0.2, p.y);
  }
  ctx.stroke();
}
function drawTileMotifs(x, y, i, p, m, v) {
  drawWornPath(x, y, i, p, m, v);
  const zoom = UI.camera.zoom,
    plant = W.tiles.plantOrder[i],
    liquid = W.tiles.liquid[i],
    seed = visualHash01(i, 0x2e71);
  if (liquid > 140) {
    // Open water used to be a single flat wash with a rare static tick mark, so
    // a close camera saw nothing but a gradient. Ripple density now follows the
    // zoom and the crests drift, which is what makes a surface read as liquid.
    const density = clamp(0.18 + (zoom - 1) * 0.05, 0.18, 0.46);
    if (seed < density && zoom > 0.62) {
      // Crests travel along the planet's own swell direction rather than
      // bobbing independently per tile, so a body of liquid reads as one surface.
      const sw = v.surface?.water,
        r = Math.max(0.7, m.tw * 0.17),
        drift = sw
          ? Math.sin(
              ACTIVE_RENDER_NOW * 0.0016 * sw.speed +
                (x * Math.cos(sw.angle) + y * Math.sin(sw.angle)) * 0.9 +
                seed * 2.1,
            ) *
            r *
            0.28 *
            sw.amplitude
          : Math.sin(ACTIVE_RENDER_NOW * 0.0016 + seed * 31.4) * r * 0.28;
      ctx.strokeStyle = hsl(v.liquidHue - 18, 64, 74, 0.24);
      ctx.lineWidth = clamp(m.tw * 0.055, 0.35, 8);
      ctx.beginPath();
      if (v.waterForm === "cells") {
        ctx.arc(p.x, p.y + drift * 0.4, r, 0, Math.PI * 2);
      } else {
        ctx.moveTo(p.x - r, p.y + drift);
        ctx.quadraticCurveTo(p.x, p.y - r * 0.5 + drift, p.x + r, p.y + drift);
      }
      ctx.stroke();
      if (zoom > 3 && UI.quality !== "low") {
        ctx.strokeStyle = hsl(v.liquidHue - 4, 58, 40, 0.2);
        ctx.beginPath();
        ctx.moveTo(p.x - r * 0.7, p.y - drift * 0.8 + r * 0.55);
        ctx.quadraticCurveTo(
          p.x,
          p.y - drift * 0.8 + r * 0.15,
          p.x + r * 0.7,
          p.y - drift * 0.8 + r * 0.55,
        );
        ctx.stroke();
      }
    }
    return;
  }
  if (
    plant > 170 &&
    seed <
      clamp(
        (plant / 3400) * (UI.quality === "low" ? 1 : (v.surface?.floraDensity ?? 1)),
        0.04,
        UI.quality === "low" ? 0.28 : 0.4,
      ) &&
    zoom > 0.55
  ) {
    const r = Math.max(0.8, m.tw * (0.08 + plant / 14000)),
      h = v.floraHue + (visualHash01(i, 0x315) - 0.5) * 18,
      detail = zoom > 1.35 && UI.quality !== "low" ? 5 : 3,
      form = floraFormAt(v, i),
      phase = visualHash01(i, 0x991) * Math.PI * 2 + windSwayAt(v, x, y);
    drawPlantMotif(p, r, form, h, detail, phase);
    if (zoom > 2.5) {
      const extra = 1 + (plant > 900 ? 1 : 0) + (zoom > 6 ? 1 : 0);
      for (let n = 1; n <= extra; n++)
        drawPlantMotif(
          {
            x: p.x + (visualHash01(i, 0x21 + n) - 0.5) * m.tw * 0.72,
            y: p.y + (visualHash01(i, 0x61 + n) - 0.5) * m.th * 0.55,
          },
          r * (0.6 + 0.4 * visualHash01(i, 0xa1 + n)),
          form,
          h,
          detail,
          visualHash01(i, 0xe1 + n) * Math.PI * 2 + windSwayAt(v, x, y) * 0.8,
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
        maxDrop = Math.max(14, UI.camera.zoom * 3.2),
        faces = [
          { elevation: y > 0 ? W.tiles.elevation[i - W.width] : e, a: 0, b: 1 },
          { elevation: x < W.width - 1 ? W.tiles.elevation[i + 1] : e, a: 1, b: 2 },
          {
            elevation: y < W.height - 1 ? W.tiles.elevation[i + W.width] : e,
            a: 2,
            b: 3,
          },
          { elevation: x > 0 ? W.tiles.elevation[i - 1] : e, a: 3, b: 0 },
        ];
      for (const face of faces) {
        const step = Math.max(0, e - face.elevation),
          drop = clamp(step * elevationScale, 0, maxDrop);
        if (drop <= 0.4) continue;
        ctx.beginPath();
        ctx.moveTo(poly[face.a][0], poly[face.a][1]);
        ctx.lineTo(poly[face.b][0], poly[face.b][1]);
        ctx.lineTo(poly[face.b][0], poly[face.b][1] + drop + TERRAIN_SEAM_BLEED);
        ctx.lineTo(poly[face.a][0], poly[face.a][1] + drop + TERRAIN_SEAM_BLEED);
        ctx.closePath();
        ctx.fillStyle = terrainFaceColor(
          i,
          step,
          ACTIVE_TILE_SHADE ? ACTIVE_TILE_SHADE.di === face.a : face.a === 2,
        );
        ctx.fill();
      }
    }
    polygonPath(poly);
    ctx.fillStyle = color;
    ctx.fill();
    if (ACTIVE_TILE_SHADE && UI.quality === "high" && UI.camera.zoom > 0.62) {
      const es = ACTIVE_TILE_SHADE;
      // Unclamped this scales with the tile, so a close camera paints fat dark
      // rules along every tile edge instead of a hint of surface relief.
      ctx.lineWidth = clamp(m.tw * 0.05, 0.5, 1.8);
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
    if (UI.quality !== "low" && m.tw >= 14 && W.tiles.liquid[i] <= 140)
      drawGrainMark(x, y, i, p, m, v);
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
    drawWaterSurface(x, y, i, p, m, v, top);
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
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(TOP_TERRAIN_CACHE.canvas, left, top, W.width * m.tw, W.height * m.th);
  // The baked grain sits over the colour bitmap; it fades out where tiles are
  // too small on screen for texture to read as anything but noise.
  if (UI.quality !== "low" && m.tw >= 2.5) {
    const texture = surfaceTexture(v);
    if (texture?.done && texture.canvas) {
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = clamp((m.tw - 2) / 8, 0.15, 1) * (UI.quality === "high" ? 1 : 0.8);
      ctx.drawImage(texture.canvas, left, top, W.width * m.tw, W.height * m.th);
      ctx.restore();
    }
  }
}
// Aerial perspective. In every projected view the screen's vertical axis is the
// world's depth axis, so one haze ramp over the finished scene separates far
// ground from near ground — cheaper and more convincing than per-tile fog, and
// it reaches terrain features, buildings, and creatures alike because they are
// all painted into the same depth-sorted list before this runs.
function drawAerialPerspective(m, v) {
  if (UI.view === "top" || UI.quality === "low") return;
  const reach = clamp(1.35 - UI.camera.zoom * 0.055, 0.3, 1),
    horizon = ctx.createLinearGradient(0, 0, 0, m.h);
  horizon.addColorStop(0, hsl(v.atmosphereHue, 42, 56, 0.34 * reach));
  horizon.addColorStop(0.34, hsl(v.atmosphereHue, 38, 44, 0.15 * reach));
  horizon.addColorStop(0.68, hsl(v.atmosphereHue, 34, 30, 0.04 * reach));
  horizon.addColorStop(1, hsl(v.voidHue, 40, 10, 0));
  ctx.fillStyle = horizon;
  ctx.fillRect(0, 0, m.w, m.h);
  if (UI.quality !== "high") return;
  // A soft bloom where the key light meets the horizon anchors the light
  // direction that the terrain shading is already using.
  const L = ACTIVE_LIGHT_SCREEN || { x: 0.62, y: 0.5 },
    gx = m.w * (0.5 - L.x * 0.42),
    gy = m.h * (0.16 - L.y * 0.1),
    glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(m.w, m.h) * 0.55);
  glow.addColorStop(0, hsl(v.accentHue, 70, 66, 0.14 * reach));
  glow.addColorStop(1, hsl(v.accentHue, 70, 60, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, m.w, m.h);
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
    drawWaterSurface(x, y, i, p, m, v, true);
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
  // Clouds and airborne matter sit under the haze so distance dims them too.
  drawSurfaceWeatherLayers(now, m, v);
  drawAerialPerspective(m, v);
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
let PROJECTED_TILE_ORDER = null;
let PROJECTED_FRAME_CACHE = null;
const TERRAIN_FRAME_STATS = { hits: 0, misses: 0 };
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
    key = [b.x0, b.x1, b.y0, b.y1, q.s, q.c].join(":");
  if (
    !PROJECTED_TILE_ORDER ||
    PROJECTED_TILE_ORDER.world !== W ||
    PROJECTED_TILE_ORDER.key !== key
  ) {
    const tiles = [];
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) tiles.push({ x, y, depth: -x * q.s + y * q.c });
    tiles.sort((a, c) => a.depth - c.depth || a.y - c.y || a.x - c.x);
    PROJECTED_TILE_ORDER = { world: W, key, tiles };
  }
  for (const tile of PROJECTED_TILE_ORDER.tiles) drawTileProcedural(tile.x, tile.y);
}
function terrainFrameKey(m) {
  // Only terrain is cached. Creatures, combat, weather, selection, and input
  // remain live. Direct interventions invalidate immediately, including paused.
  const cadence = UI.running && UI.speed >= 16 ? 8 : UI.running && UI.speed >= 4 ? 2 : 1;
  return [
    UI.view,
    UI.quality,
    UI.overlay,
    UI.camera.x,
    UI.camera.y,
    UI.camera.zoom,
    cameraAngle(),
    cameraTilt(),
    UI.camera.cutaway,
    m.w,
    m.h,
    DOM.canvas.width,
    DOM.canvas.height,
    Math.floor(W.tick / cadence),
    W.hash,
    W.interventions.length,
    W.weather.started,
  ].join(":");
}
function renderWorldProcedural(now) {
  if (!W) return;
  resizeCanvas();
  ACTIVE_RENDER_NOW = now;
  ACTIVE_REDUCED_MOTION = reducedMotionPreferred();
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
  const terrainKey = UI.view === "top" ? null : terrainFrameKey(m),
    cached = PROJECTED_FRAME_CACHE,
    maxAge = UI.quality === "high" ? 90 : 140,
    reuse =
      terrainKey &&
      cached?.world === W &&
      cached.key === terrainKey &&
      now >= cached.now &&
      now - cached.now < maxAge;
  const b = visibleBounds();
  if (reuse) {
    ctx.drawImage(cached.canvas, 0, 0, m.w, m.h);
    TERRAIN_FRAME_STATS.hits++;
  } else {
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
    if (UI.view === "top") {
      drawTopTerrainLayer(m, v);
      if (UI.camera.zoom > 0.48 || UI.overlay)
        for (let y = b.y0; y <= b.y1; y++)
          for (let x = b.x0; x <= b.x1; x++) drawTopTileDetails(x, y, m, v);
    } else drawProjectedTerrain(b, m);
    if (terrainKey) {
      const canvas = cached?.canvas || document.createElement("canvas");
      if (canvas.width !== DOM.canvas.width || canvas.height !== DOM.canvas.height) {
        canvas.width = DOM.canvas.width;
        canvas.height = DOM.canvas.height;
      }
      const target = canvas.getContext("2d", { alpha: false });
      target.drawImage(DOM.canvas, 0, 0);
      PROJECTED_FRAME_CACHE = { world: W, key: terrainKey, now, canvas };
      TERRAIN_FRAME_STATS.misses++;
    }
  }
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
