// ═══════════════════════════════════════════════════════════════════════════
// 119. LIVING GROVE — seed, sapling, fruit, and the walking forest
// ═══════════════════════════════════════════════════════════════════════════
// A forest stood where the world was made and hardly moved: a strong canopy
// seeded a neighbouring tile of rich grass one year in twenty, nothing bore
// fruit, and a dry year left every tree as it was. Nature read as scenery.
// Now the forest walks: a mature tree seeds one of the eight tiles round it
// (open ground with grass and moisture, not a street or a house) about one
// year in five where the light is open and seldom where the canopy is thick,
// carrying two packets of its own organic matter as the seed; the seedling is
// a small tree that grows by the same photosynthesis as its parent, and a
// seedling on ground that has dried or been grazed bare withers and is gone
// within a few years, while a grown tree in long drought dies back to a snag
// before it falls. Broadleaves, palms, baobabs, and shrubs bear fruit through
// late summer and fall, drawn on the crown, and a fruiting tile reads as
// richer food to grazers and to people, so herds and gatherers come to the
// groves in season; brambles with berries stand in the grass between. Fruit is
// the tile's own organic matter made easy to reach, not new matter; the seed
// is moved, not made. The pass touches an eighth of the map every thirty-two
// ticks, so no tile is visited more than once a year.
const GROVE_SEED_STRENGTH = 400,
  GROVE_SEED_CHANCE = 0.2,
  GROVE_SAPLING = 80,
  GROVE_SEED_MASS = 2,
  GROVE_SAPLING_ORDER = 24,
  GROVE_WITHER = 60,
  GROVE_DIEBACK = 20,
  GROVE_MIN_MOIST = 20,
  GROVE_MIN_ORDER = 160,
  GROVE_PASS = 32,
  GROVE_SLICES = 8,
  FRUIT_PEAK = 0.47,
  FRUIT_WIDTH = 0.13,
  FRUIT_FOOD = 8,
  FRUIT_SPECIES = Object.freeze({ broadleaf: 1, palm: 0.8, baobab: 0.6, shrub: 0.9 }),
  BRAMBLE_SHARE = 0.1,
  LIVING_GROVE = { saplings: 0, withered: 0, diebacks: 0, fruitDrawn: 0, brambles: 0 };
// ── Seasons of fruit ─────────────────────────────────────────────────────────
function fruitSeasonAt(x, y) {
  if (typeof seasonPhase !== "function" || typeof seasonGenome !== "function" || !seasonGenome()?.amplitude) return 0.5;
  let phase = seasonPhase();
  if (typeof seasonHemisphere === "function" && seasonHemisphere(x, y) < 0) phase = (phase + 0.5) % 1;
  return clamp(1 - Math.abs(phase - FRUIT_PEAK) / FRUIT_WIDTH, 0, 1);
}
function brambleAt(i) {
  const t = W.tiles;
  if (t.featureType?.[i] || t.liquid[i] > 140) return false;
  const p = t.plantOrder[i];
  if (p < 300 || p > 650 || tileMoisture(i) < 30) return false;
  return visualHash01(i, 0xb3a) < BRAMBLE_SHARE;
}
// How much fruit hangs on a tile now: 0 to 1.
function fruitAt(i) {
  const t = W.tiles,
    x = i % W.width,
    y = (i / W.width) | 0;
  if (t.featureType?.[i] === TERRAIN_FEATURE.CANOPY) {
    const v = typeof ACTIVE_PLANET_VISUAL !== "undefined" && ACTIVE_PLANET_VISUAL ? ACTIVE_PLANET_VISUAL : null;
    if (v && !v.earthlike) return 0;
    const share = FRUIT_SPECIES[treeSpeciesAt(i)] || 0;
    if (!share) return 0;
    return share * fruitSeasonAt(x, y) * Math.min(1, (t.featureStrength[i] || 0) / 500);
  }
  return brambleAt(i) ? 0.6 * fruitSeasonAt(x, y) : 0;
}
// A fruiting tile reads as richer food to grazers and to people.
const tileFoodGroveBase = tileFood;
tileFood = function (i, metabolism = "grazer") {
  const v = tileFoodGroveBase(i, metabolism);
  if (metabolism === "predator" || !W?.tiles?.featureType) return v;
  const t = W.tiles;
  if (t.featureType[i] !== TERRAIN_FEATURE.CANOPY && !(t.plantOrder[i] >= 300 && t.plantOrder[i] <= 650)) return v;
  const f = fruitAt(i);
  return f > 0 ? Math.min(100, v + f * FRUIT_FOOD) : v;
};
// ── The walking forest ───────────────────────────────────────────────────────
function groveOpenGround(n) {
  const t = W.tiles;
  if (t.featureType[n] || t.liquid[n] >= 140 || t.fire[n]) return false;
  if (t.plantOrder[n] < GROVE_MIN_ORDER || tileMoisture(n) < GROVE_MIN_MOIST) return false;
  if ((t.habitation?.[n] || 0) > 220 || t.road?.[n]) return false;
  const x = n % W.width,
    y = (n / W.width) | 0;
  if (typeof standingBuildingAtMovementTile === "function" && standingBuildingAtMovementTile(x, y)) return false;
  return true;
}
function groveNeighbours(i) {
  const x = i % W.width,
    y = (i / W.width) | 0,
    out = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx,
        ny = y + dy;
      if (inside(nx, ny)) out.push(ny * W.width + nx);
    }
  return out;
}
// One tree drops its seed: true when a sapling took root.
function groveSeedFrom(i, roll = null) {
  const t = W.tiles;
  if (t.featureType[i] !== TERRAIN_FEATURE.CANOPY || t.featureStrength[i] < GROVE_SEED_STRENGTH) return false;
  const ns = groveNeighbours(i),
    shade = ns.filter((n) => t.featureType[n] === TERRAIN_FEATURE.CANOPY).length / 8,
    year = Math.floor(W.tick / TICKS_PER_YEAR);
  if (roll === null) roll = counterRand("grove-seed", year, i);
  if (roll >= GROVE_SEED_CHANCE * (1 - shade)) return false;
  const pick = Math.floor(counterRand("grove-seed-side", year, i) * ns.length),
    n = ns[pick];
  if (!groveOpenGround(n)) return false;
  const seed = Math.min(GROVE_SEED_MASS, t.chem[C.ORGANIC][i], 65535 - t.chem[C.ORGANIC][n]);
  if (seed < GROVE_SEED_MASS) return false;
  t.chem[C.ORGANIC][i] -= seed;
  t.chem[C.ORGANIC][n] += seed;
  t.featureType[n] = TERRAIN_FEATURE.CANOPY;
  t.featureStrength[n] = GROVE_SAPLING;
  t.plantOrder[n] = u16(t.plantOrder[n] + GROVE_SAPLING_ORDER);
  LIVING_GROVE.saplings++;
  return true;
}
// A seedling on dried or grazed ground withers; a grown tree in drought dies back.
function groveWither(i) {
  const t = W.tiles;
  if (t.featureType[i] !== TERRAIN_FEATURE.CANOPY) return false;
  const moist = tileMoisture(i),
    strength = t.featureStrength[i];
  if (strength < 200 && (moist < 12 || t.plantOrder[i] < 100)) {
    t.featureStrength[i] = Math.max(0, strength - GROVE_WITHER);
    if (t.featureStrength[i] <= 0) {
      t.featureType[i] = 0;
      LIVING_GROVE.withered++;
    }
    return true;
  }
  if (strength >= 200 && moist < 8) {
    t.featureStrength[i] = Math.max(0, strength - GROVE_DIEBACK);
    LIVING_GROVE.diebacks++;
    if (t.featureStrength[i] <= 0) t.featureType[i] = 0;
    return true;
  }
  return false;
}
function updateLivingGrove() {
  if (!W?.tiles?.featureType || W.tick % GROVE_PASS) return 0;
  const slice = Math.floor(W.tick / GROVE_PASS) % GROVE_SLICES,
    rows = Math.ceil(W.height / GROVE_SLICES),
    y0 = slice * rows,
    y1 = Math.min(W.height, y0 + rows);
  let acted = 0;
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < W.width; x++) {
      const i = y * W.width + x;
      if (W.tiles.featureType[i] !== TERRAIN_FEATURE.CANOPY) continue;
      if (groveWither(i)) acted++;
      else if (groveSeedFrom(i)) acted++;
    }
  return acted;
}
const updateFeatureEcologyGroveBase = updateFeatureEcology;
updateFeatureEcology = function () {
  updateFeatureEcologyGroveBase();
  updateLivingGrove();
};
// A dying tree is drawn as a snag before it falls.
const treeSpeciesAtGroveBase = treeSpeciesAt;
treeSpeciesAt = function (i) {
  const t = W.tiles;
  if (t.featureType?.[i] === TERRAIN_FEATURE.CANOPY && t.featureStrength[i] < 120 && t.featureStrength[i] > 0 && tileMoisture(i) < 12) return "snag";
  return treeSpeciesAtGroveBase(i);
};
// ── Fruit on the crown, berries in the grass ─────────────────────────────────
function fruitTone(species) {
  return species === "palm" ? hsl(28, 80, 50) : species === "baobab" ? hsl(70, 60, 55) : species === "shrub" ? hsl(285, 55, 42) : hsl(4, 75, 52);
}
const drawTreeSpeciesGroveBase = drawTreeSpecies;
drawTreeSpecies = function (g, species, p, r, h, v, i, sway, season, detail) {
  drawTreeSpeciesGroveBase(g, species, p, r, h, v, i, sway, season, detail);
  if (!detail || !FRUIT_SPECIES[species] || season.bare) return;
  const f = fruitAt(i);
  if (f < 0.15) return;
  const lean = (visualHash01(i, 0x2b7) - 0.5) * r * 0.5 + sway * 0.4,
    n = 2 + Math.round(f * 4),
    size = Math.max(0.8, r * 0.09);
  let cx, cy, rx, ry;
  if (species === "palm") {
    cx = p.x + lean * 2 + sway;
    cy = p.y - h + r * 0.25;
    rx = r * 0.3;
    ry = r * 0.2;
  } else if (species === "baobab") {
    cx = p.x + lean * 0.3 + sway * 0.3;
    cy = p.y - h * 0.85;
    rx = r * 0.9;
    ry = r * 0.2;
  } else if (species === "shrub") {
    cx = p.x + sway * 0.3;
    cy = p.y - r * 0.3;
    rx = r * 0.8;
    ry = r * 0.3;
  } else {
    cx = p.x + lean;
    cy = p.y - h * 0.72;
    rx = r * 0.65;
    ry = r * 0.45;
  }
  g.save();
  g.fillStyle = fruitTone(species);
  for (let k = 0; k < n; k++) {
    const a = visualHash01(i, 0xf00 + k) * Math.PI * 2,
      d = 0.35 + visualHash01(i, 0xf40 + k) * 0.6;
    g.beginPath();
    g.arc(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, size, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  LIVING_GROVE.fruitDrawn++;
};
const drawTileMotifsLivingGroveBase = drawTileMotifs;
drawTileMotifs = function (x, y, i, p, m, v) {
  drawTileMotifsLivingGroveBase(x, y, i, p, m, v);
  if (UI.quality === "low" || UI.camera.zoom < 1.3 || !brambleAt(i)) return;
  const g = ctx,
    r = Math.max(1.4, m.tw * 0.16),
    cx = p.x + (visualHash01(i, 0x1c1) - 0.5) * m.tw * 0.4,
    cy = p.y + (visualHash01(i, 0x1d1) - 0.5) * m.th * 0.3,
    f = fruitAt(i);
  g.save();
  g.fillStyle = hsl(v.floraHue - 10, 42, 30, 0.92);
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    g.ellipse(cx + (k - 1) * r * 0.55, cy - (k % 2) * r * 0.25, r * 0.55, r * 0.38, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (f > 0.15) {
    g.fillStyle = fruitTone("shrub");
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.arc(cx + (visualHash01(i, 0xc0 + k) - 0.5) * r * 1.4, cy - r * 0.2 - visualHash01(i, 0xd0 + k) * r * 0.4, Math.max(0.7, r * 0.14), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
  LIVING_GROVE.brambles++;
};
window.ALIFE_LIVING_GROVE_DEBUG = Object.freeze({
  seed: (i, roll = 0) => groveSeedFrom(i, roll),
  wither: (i) => groveWither(i),
  pass: () => updateLivingGrove(),
  fruit: (i) => fruitAt(i),
  season: (x, y) => fruitSeasonAt(x, y),
  bramble: (i) => brambleAt(i),
  fruiting: (limit = 12) => {
    const out = [];
    for (let i = 0; i < W.tileCount && out.length < limit; i++) {
      if (W.tiles.featureType?.[i] !== TERRAIN_FEATURE.CANOPY) continue;
      const f = fruitAt(i);
      if (f > 0.5) out.push([i % W.width, (i / W.width) | 0, +f.toFixed(2), treeSpeciesAt(i)]);
    }
    return out;
  },
  open: (i) => groveOpenGround(i),
  counts: () => ({ ...LIVING_GROVE }),
  reset: () => {
    for (const k of Object.keys(LIVING_GROVE)) LIVING_GROVE[k] = 0;
  },
});
