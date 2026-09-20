// ═══════════════════════════════════════════════════════════════════════════
// 140. MAP LENSES — every lens paints, in one palette, with its edges drawn
// ═══════════════════════════════════════════════════════════════════════════
// The panel is called "Map lenses" and offers twenty-six of them, and on a
// fresh install a player saw four. The simple controls that the experience
// section turns on by default (45, compact-controls) hid every lens but
// fertility, moisture, polities and population behind "All controls", so
// elevation, temperature, cultures, alliances and the rest were not missing
// from the world, only from the panel. That rule is gone: the tools stay
// compact, the lenses do not, and they stand in five groups instead of one
// grid of twenty-six.
//
// What the lenses painted when they were found was thin. Screenshots of a
// battery world at year fourteen, in the top-down lens at zoom 1.7, read:
// elevation as a white wash with no bands, no contours and the sea washed
// too; temperature as one flat green over land and sea alike, since twenty
// degrees fell on green in a hue ramp that started at blue and the sea was
// tinted the same as the shore; cultures as a tint too faint to see, its
// alpha the culture pressure over a thousand fading to nothing at the edge of
// a town's reach; polities as a soft blob in the polity's colour with its
// border a one-pixel stair in the top-down lens alone, and only at the high
// render detail, so on the default detail there were no borders at all; and
// that same polity border drawn under every other lens, so the culture lens
// showed the polity's line and not the culture's.
//
// One palette now. A scalar lens is a ramp of hue stops over its value, with
// an alpha that rises from a faint tint at nothing to a firm one at full, so
// a lens reads everywhere it applies and the land still shows through; the
// lenses that mean nothing at sea (fertility, works, wealth, the people) let
// the sea through at a third of the alpha, and those that do mean something
// there (temperature, moisture, the season) paint it. Elevation is a map in
// its own right: hypsometric bands from lowland green through khaki, tan and
// brown to grey and white, the sea in four blues by depth, and contour lines
// where the band changes. A categorical lens (polities, alliances, cultures)
// fills each tile in its category's colour at one legible alpha and draws its
// own edges, in every lens and at every detail, as a dark line under a
// coloured one, and two colours where two polities meet; a claim that runs
// out over the sea, past wading depth, lets the water through at a third of
// the fill, while a town's own shallows keep its colour. The map
// badge names what the colours are: the polities, blocs or peoples with the
// most ground, each with its swatch.
//
// Two lenses read the world against itself. The first temperature ramp ran
// from twenty-five below to forty-five above on every world, and a temperate
// world sat in its middle everywhere, one green from coast to summit; the
// ramp now runs from this world's coldest ground to its warmest, so blue is
// the cold of this world and red its heat, wherever they fall. The first
// elevation bands were fixed heights, and a highland world was tan and white
// with a sliver of green; the bands now fall at set shares of the land's
// tiles, the lowest fifth green and the highest fortieth white, so every
// world wears the whole ramp. Both are read once a while and kept beside the
// world, since reading a lens writes nothing to it.
//
// And the political lenses are a map mode, not a tint. Asked for after the
// first pass: vivid, animated, the quality of the grand-strategy games'
// political maps. Under polities, blocs and cultures the land that no one
// holds is veiled dark and the sea a little, and a holding is painted at
// more than half strength, so the map reads as claims first and ground
// second; the borders are thick, a dark line with a light line inside it;
// each polity's name stands across its land in spaced capitals sized to its
// holding, and its capital is ringed; a light runs along every border, a
// front between two polities at war is a moving red-and-white line, and the
// lens comes in with a dip when it is switched. The names and the motion are
// drawn every frame over the cached terrain, from the edge list the cached
// pass keeps, so the cost is a stroke of the borders and a few words; at
// lean detail the light runs every other frame.
const LENS = { fills: 0, edges: 0, legend: 0, legendAt: 0, labels: 0, shimmer: 0, fronts: 0, switchedAt: 0, frame: 0 };
const LENS_EDGE_LIST = { world: null, key: "", name: "", segments: [], fronts: [], labels: [] };
const LENS_VEIL_LAND = "rgba(8,14,20,0.38)",
  LENS_VEIL_SEA = "rgba(8,14,20,0.16)",
  LENS_FILL_ALPHA = 0.58,
  LENS_SWITCH_MS = 320,
  LENS_LABEL_MIN_TILES = 10;
const LENS_RANGE = { world: null, key: "", temperature: null, bands: null };
const LENS_GROUPS = Object.freeze([
  ["Land", ["elevation", "temperature", "moisture", "fertility", "fire", "season"]],
  ["Life", ["food", "microbial", "macrolife", "species", "blood", "fear", "disease", "danger"]],
  ["Peoples", ["territory", "culture", "alliances", "population", "belief", "unrest"]],
  ["Works", ["resources", "construction", "logistics", "routes", "wealth"]],
  ["Story", ["history"]],
]);
// Hue ramps over the lens value, as [t, hue, saturation, lightness] stops.
const LENS_RAMPS = Object.freeze({
  temperature: [
    [0, 232, 85, 56],
    [0.3, 200, 80, 55],
    [0.5, 118, 60, 48],
    [0.7, 55, 85, 55],
    [0.85, 25, 90, 55],
    [1, 2, 88, 52],
  ],
  moisture: [
    [0, 38, 55, 58],
    [0.45, 175, 60, 50],
    [1, 215, 85, 46],
  ],
  fertility: [
    [0, 40, 45, 42],
    [0.5, 88, 60, 44],
    [1, 128, 75, 40],
  ],
  food: [
    [0, 45, 50, 44],
    [0.5, 92, 65, 46],
    [1, 135, 78, 42],
  ],
  fire: [
    [0, 44, 90, 58],
    [0.5, 22, 95, 55],
    [1, 2, 95, 48],
  ],
  blood: [
    [0, 355, 70, 52],
    [1, 350, 90, 42],
  ],
  fear: [
    [0, 40, 85, 58],
    [1, 12, 92, 52],
  ],
  danger: [
    [0, 36, 88, 58],
    [1, 4, 92, 50],
  ],
  disease: [
    [0, 300, 60, 60],
    [1, 282, 80, 46],
  ],
  resources: [
    [0, 52, 80, 60],
    [1, 42, 95, 50],
  ],
  population: [
    [0, 178, 75, 58],
    [1, 165, 92, 46],
  ],
  construction: [
    [0, 50, 75, 62],
    [1, 38, 90, 52],
  ],
  logistics: [
    [0, 185, 70, 58],
    [1, 170, 88, 48],
  ],
  microbial: [
    [0, 155, 70, 56],
    [1, 135, 88, 46],
  ],
  macrolife: [
    [0, 32, 80, 60],
    [1, 18, 92, 50],
  ],
  season: [
    [0, 212, 85, 58],
    [0.5, 200, 20, 60],
    [1, 22, 85, 58],
  ],
});
// The lenses that mean nothing at sea let it through; the rest paint it.
const LENS_LAND_ONLY = new Set([
  "fertility",
  "food",
  "blood",
  "fear",
  "danger",
  "disease",
  "resources",
  "population",
  "construction",
  "logistics",
  "macrolife",
]);
const LENS_ELEVATION = Object.freeze({
  shares: [0.2, 0.4, 0.55, 0.7, 0.82, 0.92, 0.975],
  land: [
    [118, 46, 36],
    [96, 48, 44],
    [70, 46, 50],
    [46, 42, 53],
    [30, 36, 46],
    [18, 22, 42],
    [0, 0, 62],
    [0, 0, 92],
  ],
  depths: [WATER_DEPTH.SHALLOW, WATER_DEPTH.WADE_LIMIT, WATER_DEPTH.DEEP],
  water: [
    [195, 70, 62],
    [205, 76, 48],
    [215, 82, 36],
    [226, 86, 24],
  ],
});
function lensRamp(stops, t) {
  t = clamp(t, 0, 1);
  let a = stops[0],
    b = stops[stops.length - 1];
  for (let k = 0; k < stops.length - 1; k++)
    if (t >= stops[k][0] && t <= stops[k + 1][0]) {
      a = stops[k];
      b = stops[k + 1];
      break;
    }
  const span = b[0] - a[0] || 1,
    u = clamp((t - a[0]) / span, 0, 1);
  return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
}
function lensWater(i) {
  return W.tiles.liquid[i] > WATER_DEPTH.SURFACE;
}
// The sea a lens lets through: water past wading depth, not a town's shallows.
function lensSea(i) {
  return W.tiles.liquid[i] > WATER_DEPTH.WADE_LIMIT;
}
// The world's own spread of heights and heats, read once every few hundred
// ticks: the land's elevations sorted for the band thresholds, and the
// temperature between its half-percentiles so a single hot spring does not
// set the scale.
function lensWorldRange() {
  const key = `${W.tileCount}:${Math.floor(W.tick / 256)}:${W.interventions?.length || 0}`;
  if (LENS_RANGE.world === W && LENS_RANGE.key === key) return LENS_RANGE;
  const land = [],
    temps = new Float32Array(W.tileCount);
  for (let i = 0; i < W.tileCount; i++) {
    if (!lensWater(i)) land.push(W.tiles.elevation[i]);
    temps[i] = W.tiles.temperature[i];
  }
  land.sort((a, b) => a - b);
  temps.sort();
  const at = (arr, share) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(share * arr.length))] : 0),
    bands = LENS_ELEVATION.shares.map((s) => at(land, s));
  for (let k = 1; k < bands.length; k++) if (bands[k] <= bands[k - 1]) bands[k] = bands[k - 1] + 1;
  const lo = at(temps, 0.005),
    hi = Math.max(at(temps, 0.995), lo + 10);
  LENS_RANGE.world = W;
  LENS_RANGE.key = key;
  LENS_RANGE.bands = bands;
  LENS_RANGE.temperature = [lo, hi];
  return LENS_RANGE;
}
function lensElevationBand(i) {
  if (lensWater(i)) {
    const d = W.tiles.liquid[i],
      depths = LENS_ELEVATION.depths;
    return -1 - (d > depths[2] ? 3 : d > depths[1] ? 2 : d > depths[0] ? 1 : 0);
  }
  const e = W.tiles.elevation[i],
    bands = lensWorldRange().bands;
  let k = 0;
  while (k < bands.length && e >= bands[k]) k++;
  return k;
}
function lensElevationStyle(i) {
  const band = lensElevationBand(i);
  if (band < 0) {
    const [h, s, l] = LENS_ELEVATION.water[-1 - band];
    return hsl(h, s, l, 0.55);
  }
  const [h, s, l] = LENS_ELEVATION.land[Math.min(band, LENS_ELEVATION.land.length - 1)];
  return hsl(h, s, l, 0.6);
}
// A stable, well-spread colour for each people: the golden angle round the
// wheel by the culture's place in the roll, so kin peoples do not share a hue.
function lensCultureColour(cultureId) {
  const k = (W.cultures || []).findIndex((c) => c.id === cultureId);
  return hsl((k < 0 ? cultureId * 79 : 40 + k * 137.508) % 360, 62, 60);
}
function lensColourWithAlpha(colour, a) {
  const alpha = +clamp(a, 0, 1).toFixed(3);
  if (!colour) return "transparent";
  if (/^hsla\(/.test(colour)) return colour.replace(/,\s*[0-9.]+\)$/, `,${alpha})`);
  if (/^hsl\(/.test(colour) && !colour.includes("/")) return colour.replace(")", ` / ${alpha})`);
  return colour;
}
function lensBlocKey(i) {
  const owner = W.tiles.owner?.[i];
  if (!owner) return 0;
  const leader = typeof blocLeader === "function" ? blocLeader(owner) : null;
  return leader ? leader.id : owner;
}
// The category a tile belongs to under a lens, or 0; and that category's colour.
function lensCategoryAt(name, i) {
  if (name === "territory") return W.tiles.owner?.[i] || 0;
  if (name === "alliances") return lensBlocKey(i);
  if (name === "culture") return W.tiles.cultureOwner?.[i] || 0;
  if (name === "elevation") return lensElevationBand(i);
  return null;
}
function lensCategoryColour(name, key) {
  if (name === "territory" || name === "alliances") {
    const f = W.factions.find((x) => x.id === key);
    return f?.color || null;
  }
  if (name === "culture") return lensCultureColour(key);
  return null;
}
function lensCategoryName(name, key) {
  if (name === "territory" || name === "alliances") return W.factions.find((x) => x.id === key)?.name || "";
  if (name === "culture") return (W.cultures || []).find((c) => c.id === key)?.name || "";
  return "";
}
const overlayStyleLensBase = overlayStyle;
overlayStyle = function (name, i) {
  const ramp = LENS_RAMPS[name];
  if (ramp) {
    let t = clamp(overlayValue(name, i) / 100, 0, 1);
    if (name === "temperature") {
      const [lo, hi] = lensWorldRange().temperature;
      t = clamp((W.tiles.temperature[i] - lo) / (hi - lo), 0, 1);
    }
    const even = name === "temperature" || name === "moisture" || name === "season",
      [h, s, l] = lensRamp(ramp, t);
    let a = even ? 0.42 + 0.22 * Math.abs(2 * t - 1) : 0.16 + 0.56 * t;
    if (LENS_LAND_ONLY.has(name) && lensSea(i)) a *= 0.3;
    LENS.fills++;
    return hsl(h, s, l, a);
  }
  if (name === "elevation") {
    LENS.fills++;
    return lensElevationStyle(i);
  }
  if (name === "territory" || name === "alliances" || name === "culture") {
    const key = lensCategoryAt(name, i);
    LENS.fills++;
    if (!key) return lensSea(i) ? LENS_VEIL_SEA : LENS_VEIL_LAND;
    const strength =
        name === "culture"
          ? clamp((W.tiles.culture?.[i] || 0) / 650, 0, 1)
          : clamp((W.tiles.territory?.[i] || 0) / 800, 0, 1),
      alone = name === "alliances" && typeof blocSize === "function" && blocSize(W.tiles.owner[i]) < 2,
      a = (LENS_FILL_ALPHA - 0.08 + 0.1 * strength) * (alone ? 0.6 : 1) * (lensSea(i) ? 0.34 : 1);
    return lensColourWithAlpha(lensCategoryColour(name, key), a);
  }
  return overlayStyleLensBase(name, i);
};
// ── The edges of a lens ──────────────────────────────────────────────────────
// Drawn after the terrain of every lens, from the same tile polygons the tiles
// are drawn with, so the line sits on the tile's own edge in the isometric and
// free lenses too. A dark line under a coloured one; where two categories
// meet, each side's colour, inset toward its own tile.
function lensEdgeInset(p1, p2, cx, cy, k) {
  return [
    [p1[0] + (cx - p1[0]) * k, p1[1] + (cy - p1[1]) * k],
    [p2[0] + (cx - p2[0]) * k, p2[1] + (cy - p2[1]) * k],
  ];
}
function lensStrokeEdge(a, b, colour, width, under) {
  if (under) {
    ctx.strokeStyle = under;
    ctx.lineWidth = width + 1.6;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  LENS.edges++;
}
function lensLighter(colour) {
  if (!colour) return "#fff";
  const m = colour.match(/^hsla?\(\s*([0-9.]+)[ ,]+([0-9.]+)%[ ,]+([0-9.]+)%/);
  return m ? hsl(+m[1], Math.min(100, +m[2] + 6), Math.min(92, +m[3] + 18)) : colour;
}
function lensAtWar(a, b) {
  return !!(a && b && a !== b && typeof factionsAtWar === "function" && factionsAtWar(a, b));
}
function drawLensEdges(b, m) {
  const name = UI.overlay;
  if (!name || !W || lensCategoryAt(name, 0) === null) return 0;
  const contour = name === "elevation",
    width = contour ? clamp(0.5 + m.tw * 0.03, 0.6, 1.4) : clamp(1.4 + m.tw * 0.09, 1.6, 4.2),
    under = contour ? null : "rgba(6,12,18,0.82)",
    contourColour = "rgba(20,28,36,0.5)",
    keep = !contour,
    segments = [],
    fronts = [],
    polys = new Map(),
    polyOf = (x, y) => {
      const k = y * W.width + x;
      let p = polys.get(k);
      if (!p) {
        p = proceduralTilePolygon(x, y, m);
        polys.set(k, p);
      }
      return p;
    },
    centre = (p) => [(p[0][0] + p[2][0]) / 2, (p[0][1] + p[2][1]) / 2];
  let drawn = 0;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++) {
      const i = idx(x, y),
        key = lensCategoryAt(name, i);
      for (const [dx, dy, c0, c1] of [
        [1, 0, 1, 2],
        [0, 1, 2, 3],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (nx >= W.width || ny >= W.height) continue;
        const nkey = lensCategoryAt(name, idx(nx, ny));
        if (nkey === key) continue;
        const poly = polyOf(x, y),
          edge = [poly[c0], poly[c1]];
        if (contour) {
          lensStrokeEdge(edge[0], edge[1], contourColour, width, null);
          drawn++;
          continue;
        }
        const mine = key ? lensCategoryColour(name, key) : null,
          theirs = nkey ? lensCategoryColour(name, nkey) : null;
        if (mine && theirs) {
          const [cx, cy] = centre(poly),
            npoly = polyOf(nx, ny),
            [ncx, ncy] = centre(npoly),
            a = lensEdgeInset(edge[0], edge[1], cx, cy, 0.14),
            t = lensEdgeInset(edge[0], edge[1], ncx, ncy, 0.14);
          lensStrokeEdge(a[0], a[1], mine, width, under);
          lensStrokeEdge(t[0], t[1], theirs, width, under);
          lensStrokeEdge(a[0], a[1], lensLighter(mine), width * 0.4, null);
          lensStrokeEdge(t[0], t[1], lensLighter(theirs), width * 0.4, null);
          if (keep && name !== "culture" && lensAtWar(W.tiles.owner?.[i], W.tiles.owner?.[idx(nx, ny)])) fronts.push(edge);
        } else {
          const colour = mine || theirs;
          lensStrokeEdge(edge[0], edge[1], colour, width, under);
          lensStrokeEdge(edge[0], edge[1], lensLighter(colour), width * 0.4, null);
        }
        if (keep) segments.push(edge);
        drawn++;
      }
    }
  ctx.restore();
  if (keep) {
    LENS_EDGE_LIST.world = W;
    LENS_EDGE_LIST.name = name;
    LENS_EDGE_LIST.key = `${name}:${b.x0}:${b.y0}:${b.x1}:${b.y1}:${m.w}:${m.h}:${UI.camera.zoom}`;
    LENS_EDGE_LIST.segments = segments;
    LENS_EDGE_LIST.fronts = fronts;
    LENS_EDGE_LIST.labels = lensLabelsFor(name, m);
  }
  if (drawn && performance.now() - LENS.legendAt > 1500) lensRefreshLegend();
  return drawn;
}
// ── Names across the land, and the motion of the lens ────────────────────────
// A polity's name stands at the middle of its holding, in spaced capitals
// sized to the holding, with its capital ringed; the counting pass that feeds
// the legend feeds this too.
function lensLabelsFor(name, m) {
  if (name !== "territory" && name !== "alliances" && name !== "culture") return [];
  const sums = new Map();
  for (let y = 0; y < W.height; y++)
    for (let x = 0; x < W.width; x++) {
      const i = y * W.width + x,
        key = lensCategoryAt(name, i);
      if (!key || lensSea(i)) continue;
      let s = sums.get(key);
      if (!s) sums.set(key, (s = { key, n: 0, sx: 0, sy: 0, left: Infinity, right: -Infinity }));
      s.n++;
      s.sx += x + 0.5;
      s.sy += y + 0.5;
      // The holding's own span on the screen, tile by tile, so the name fits it in every lens.
      const at = proceduralProjectTile(x + 0.5, y + 0.5, m, false);
      if (at.x < s.left) s.left = at.x;
      if (at.x > s.right) s.right = at.x;
    }
  const labels = [];
  for (const s of sums.values()) {
    if (s.n < LENS_LABEL_MIN_TILES) continue;
    const text = lensCategoryName(name, s.key);
    if (!text) continue;
    // The name fits the holding: its size is the holding's width on the screen over the name's length.
    const at = proceduralProjectTile(s.sx / s.n, s.sy / s.n, m),
      spanX = s.right - s.left + m.tw,
      px = clamp(Math.round((spanX * 0.7) / (text.length * 0.78)), 11, 40),
      f = name === "culture" ? null : W.factions.find((x) => x.id === s.key),
      cap = f && typeof factionCapital === "function" ? factionCapital(f) : null;
    labels.push({ key: s.key, text: text.toUpperCase(), x: clamp(at.x, px * text.length * 0.4, m.w - px * text.length * 0.4), y: clamp(at.y, px, m.h - px), px, tiles: s.n, colour: lensCategoryColour(name, s.key), capital: cap ? proceduralProjectTile(cap.x + 0.5, cap.y + 0.5, m) : null });
  }
  return labels.sort((a, b) => b.tiles - a.tiles).slice(0, 12);
}
function drawLensLabels(labels) {
  if (!labels.length) return 0;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  let drawn = 0;
  for (const l of labels) {
    ctx.font = `600 ${l.px}px system-ui, sans-serif`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${Math.round(l.px * 0.18)}px`;
    ctx.lineWidth = Math.max(2, l.px * 0.22);
    ctx.strokeStyle = "rgba(4,8,12,0.78)";
    ctx.strokeText(l.text, l.x, l.y);
    ctx.fillStyle = lensLighter(l.colour);
    ctx.fillText(l.text, l.x, l.y);
    if (l.capital) {
      const r = Math.max(3, l.px * 0.28);
      ctx.lineWidth = Math.max(1.2, r * 0.35);
      ctx.strokeStyle = "rgba(4,8,12,0.8)";
      ctx.beginPath();
      ctx.arc(l.capital.x, l.capital.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = lensLighter(l.colour);
      ctx.lineWidth = Math.max(0.8, r * 0.18);
      ctx.beginPath();
      ctx.arc(l.capital.x, l.capital.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawn++;
  }
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.restore();
  LENS.labels += drawn;
  return drawn;
}
// The motion: a light running along the borders, a red-and-white line moving
// along a front, and the dip when the lens is switched. Drawn every frame
// from the cached pass's edge list; nothing here reads the tiles.
function drawLensMotion(now, m) {
  const name = UI.overlay;
  if (!name || !W) return 0;
  LENS.frame++;
  let drawn = 0;
  if (LENS_EDGE_LIST.world === W && LENS_EDGE_LIST.name === name && LENS_EDGE_LIST.segments.length) {
    const lean = UI.quality === "low",
      run = !lean || LENS.frame % 2 === 0;
    ctx.save();
    ctx.lineCap = "round";
    if (run) {
      ctx.strokeStyle = "rgba(255,250,235,0.34)";
      ctx.lineWidth = clamp(0.8 + m.tw * 0.04, 0.9, 2.2);
      ctx.setLineDash([9, 27]);
      ctx.lineDashOffset = -((now / 26) % 36);
      ctx.beginPath();
      for (const [a, b] of LENS_EDGE_LIST.segments) {
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
      LENS.shimmer++;
      drawn++;
    }
    if (LENS_EDGE_LIST.fronts.length) {
      const w = clamp(2 + m.tw * 0.12, 2.4, 6);
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(240,235,225,0.92)";
      ctx.lineWidth = w;
      ctx.beginPath();
      for (const [a, b] of LENS_EDGE_LIST.fronts) {
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(214,40,40,0.95)";
      ctx.setLineDash([w * 2.2, w * 2.2]);
      ctx.lineDashOffset = -((now / 40) % (w * 4.4));
      ctx.stroke();
      LENS.fronts++;
      drawn++;
    }
    ctx.restore();
    drawn += drawLensLabels(LENS_EDGE_LIST.labels);
  }
  const since = now - LENS.switchedAt;
  if (LENS.switchedAt && since >= 0 && since < LENS_SWITCH_MS) {
    const t = since / LENS_SWITCH_MS;
    ctx.fillStyle = `rgba(2,6,10,${(0.42 * (1 - t) * (1 - t)).toFixed(3)})`;
    ctx.fillRect(0, 0, m.w, m.h);
    drawn++;
  }
  return drawn;
}
// ── The legend in the map badge ──────────────────────────────────────────────
function lensLegendEntries(name, limit = 6) {
  const counts = new Map();
  for (let i = 0; i < W.tileCount; i++) {
    const key = lensCategoryAt(name, i);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, limit)
    .map(([key, tiles]) => ({ key, tiles, name: lensCategoryName(name, key), colour: lensCategoryColour(name, key) }));
}
function lensLegendHTML(name) {
  const def = OVERLAY_DEFS.find((d) => d[0] === name),
    entries = lensLegendEntries(name);
  if (!entries.length)
    return `${esc(def ? def[1] : titleCase(name))} · ${name === "culture" ? "no people has settled yet" : "no polity holds ground yet"}`;
  return (
    esc(def ? def[1] : titleCase(name)) +
    entries
      .map(
        (e) =>
          `<span class="lens-swatch" style="--c:${esc(e.colour || "#888")}"></span>${esc(e.name || "unnamed")}`,
      )
      .join("")
  );
}
function lensRefreshLegend() {
  const name = UI.overlay;
  if (!DOM.mapOverlay || !W) return;
  if (name !== "territory" && name !== "alliances" && name !== "culture") return;
  LENS.legendAt = performance.now();
  LENS.legend++;
  DOM.mapOverlay.innerHTML = lensLegendHTML(name);
}
const setOverlayLensBase = setOverlay;
setOverlay = function (name) {
  setOverlayLensBase(name);
  LENS.switchedAt = UI.overlay ? performance.now() : 0;
  if (!DOM.mapOverlay) return;
  if (UI.overlay === "elevation")
    DOM.mapOverlay.textContent = "Elevation · the land's lowest fifth green to its highest fortieth white, four blues by depth, contours where the band changes";
  else if (UI.overlay === "temperature") DOM.mapOverlay.textContent = "Temperature · this world's coldest ground blue to its warmest red, over land and sea";
  else if (UI.overlay === "moisture") DOM.mapOverlay.textContent = "Moisture · tan dry to blue wet";
  lensRefreshLegend();
};
// ── The panel: every lens, in groups ─────────────────────────────────────────
const buildControlsLensBase = buildControls;
buildControls = function () {
  buildControlsLensBase();
  if (!DOM.overlayGrid) return;
  const known = new Set(LENS_GROUPS.flatMap(([, ids]) => ids)),
    extra = OVERLAY_DEFS.map(([id]) => id).filter((id) => !known.has(id)),
    groups = extra.length ? [...LENS_GROUPS, ["More", extra]] : LENS_GROUPS,
    button = (id) => {
      const def = OVERLAY_DEFS.find((d) => d[0] === id);
      return def
        ? `<button class="overlay-btn" data-overlay="${id}"><span class="dot" style="color:${overlayLegendColor(id) || "#9eafb1"}"></span> ${esc(def[1])}</button>`
        : "";
    };
  DOM.overlayGrid.innerHTML = groups
    .map(([title, ids]) => `<div class="overlay-group">${esc(title)}</div>` + ids.map(button).join(""))
    .join("");
};
const overlayLegendColorLensBase = overlayLegendColor;
overlayLegendColor = function (id) {
  return (
    overlayLegendColorLensBase(id) ||
    { alliances: "#f3a3c8", belief: "#9fd88f", wealth: "#e8c46a", unrest: "#e0645c", species: "#b07fff", routes: "#e0b060", season: "#7fb0ff", history: "#ffd27f" }[id] ||
    "#9eafb1"
  );
};
window.ALIFE_LENS_DEBUG = Object.freeze({
  counts: () => ({ ...LENS }),
  groups: () => LENS_GROUPS.map(([t, ids]) => [t, [...ids]]),
  style: (name, i) => overlayStyle(name, i),
  category: (name, i) => lensCategoryAt(name, i),
  band: (i) => lensElevationBand(i),
  range: () => ({ bands: [...lensWorldRange().bands], temperature: [...lensWorldRange().temperature] }),
  legend: (name = UI.overlay) => lensLegendEntries(name),
  labels: (name = UI.overlay) => lensLabelsFor(name, projectionMetrics()).map((l) => ({ key: l.key, text: l.text, tiles: l.tiles, px: l.px, capital: !!l.capital })),
  motion: (now = performance.now()) => drawLensMotion(now, projectionMetrics()),
  edgeList: () => ({ name: LENS_EDGE_LIST.name, segments: LENS_EDGE_LIST.segments.length, fronts: LENS_EDGE_LIST.fronts.length, labels: LENS_EDGE_LIST.labels.length }),
  edges: (name) => {
    const was = UI.overlay;
    UI.overlay = name;
    const n = drawLensEdges(visibleBounds(), projectionMetrics());
    UI.overlay = was;
    return n;
  },
});
