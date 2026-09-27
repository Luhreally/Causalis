// A world in depth, painted (Phase 8 M81): its seas deep blue and its ice white, its bare
// ground by its warmth and its rock (the reds of iron, the tans of dust, the greys of a
// moon's dust, the ochres of a world baked under a crushing air), lighter on the heights
// and darker in its craters' floors; a giant's clouds in bands — warm ones in creams and
// browns, cold ones in blues — and its storm. A pure function of what the host sends.
import { sphereGrid } from "../kernel/index.ts";
import type { WorldGlobe } from "../bridge/index.ts";

type Rgb = readonly [number, number, number];

const mix = (a: Rgb, b: Rgb, k: number): Rgb => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

/**
 * A world's ground by its warmth, its air and its tint: baked yellow under a crushing air,
 * scorched grey-brown where the star beats on bare rock, the greys of a moon's dust, rust
 * and ochre on a cold world with a breath of air, frosted grey beyond.
 */
export function groundOf(w: Pick<WorldGlobe, "kind" | "air" | "tint">, t: number): Rgb {
  const thin = w.air === "none" || w.air === "trace";
  if (w.air === "crushing" && t > 150) return mix([0.86, 0.64, 0.28], [0.92, 0.76, 0.42], w.tint);
  if (thin && t > 60) return mix([0.36, 0.32, 0.29], [0.48, 0.42, 0.36], w.tint);
  if (w.kind === "moon") return mix([0.44, 0.43, 0.42], [0.58, 0.55, 0.5], w.tint);
  if (t > -120) return mix([0.66, 0.3, 0.16], [0.72, 0.52, 0.32], w.tint);
  return mix([0.5, 0.48, 0.47], [0.6, 0.52, 0.46], w.tint);
}

/** A giant's bands: warm giants in creams and browns, cold ones in blues. */
export function bandsOf(w: Pick<WorldGlobe, "kind" | "temperature">): readonly Rgb[] {
  const cold = w.kind === "ice giant" || (w.temperature[0] ?? 0) < -170;
  return cold
    ? [
        [0.52, 0.74, 0.86],
        [0.44, 0.64, 0.8],
        [0.62, 0.82, 0.9],
        [0.48, 0.7, 0.84],
      ]
    : [
        [0.88, 0.8, 0.64],
        [0.72, 0.52, 0.36],
        [0.93, 0.89, 0.8],
        [0.64, 0.44, 0.3],
        [0.82, 0.68, 0.5],
      ];
}

/** A living world's land by its warmth and rain: tundra, taiga, forest, grass, desert. */
export function livingOf(t: number, rain: number): Rgb {
  if (t < -8) return [0.66, 0.66, 0.6];
  if (t < 4) return [0.24, 0.38, 0.26];
  if (rain < 280) return [0.82, 0.72, 0.48];
  if (rain < 700) return t > 18 ? [0.62, 0.62, 0.3] : [0.42, 0.58, 0.28];
  return t > 20 ? [0.12, 0.5, 0.18] : [0.2, 0.5, 0.24];
}

/**
 * Paint a world: RGBA a cell, as the globe takes it. `year` is the chronicle's now: a
 * people's cities show their lights once they have come to electronics.
 */
export function worldColors(w: WorldGlobe, year = Infinity): Uint8Array {
  const grid = sphereGrid(w.frequency),
    n = grid.count,
    out = new Uint8Array(n * 4),
    put = (c: number, rgb: Rgb) => {
      out[4 * c] = Math.round(Math.max(0, Math.min(1, rgb[0])) * 255);
      out[4 * c + 1] = Math.round(Math.max(0, Math.min(1, rgb[1])) * 255);
      out[4 * c + 2] = Math.round(Math.max(0, Math.min(1, rgb[2])) * 255);
      out[4 * c + 3] = 255;
    };
  if (w.kind === "giant" || w.kind === "ice giant") {
    const palette = bandsOf(w),
      cold = palette[0]![2] > palette[0]![0];
    for (let c = 0; c < n; c++) {
      const x = grid.positions[3 * c]!,
        y = grid.positions[3 * c + 1]!,
        z = grid.positions[3 * c + 2]!,
        lat = Math.asin(Math.max(-1, Math.min(1, y))),
        lon = Math.atan2(z, x),
        // The bands, their edges stirred by the winds between them.
        stir = 0.35 * Math.sin(lon * 3 + lat * 9 + w.tint * 10) * Math.cos(lon * 5 - lat * 4),
        band = Math.floor(((y + 1) / 2) * w.bands + stir),
        base = palette[((band % palette.length) + palette.length) % palette.length]!;
      let rgb = base;
      if (w.storm) {
        const dlat = lat - w.storm.lat,
          dlon =
            Math.atan2(Math.sin(lon - w.storm.lon), Math.cos(lon - w.storm.lon)) * Math.cos(lat),
          // An oval, wider than tall.
          d = Math.hypot(dlat * 1.8, dlon) / w.storm.size;
        if (d < 1) rgb = mix(cold ? [0.92, 0.95, 0.98] : [0.78, 0.36, 0.24], base, d * d);
      }
      put(c, rgb);
    }
    return out;
  }
  // Rocky worlds and moons: the relief's spread sets the shading.
  let lo = Infinity,
    hi = -Infinity;
  for (let c = 0; c < n; c++) {
    lo = Math.min(lo, w.elevation[c]!);
    hi = Math.max(hi, w.elevation[c]!);
  }
  const span = Math.max(1, hi - lo);
  for (let c = 0; c < n; c++) {
    const e = w.elevation[c]!,
      t = w.temperature[c]!,
      height = (e - lo) / span;
    // A hollow among its neighbours (a crater's floor) darker, a rise lighter.
    let around = 0,
      k = 0;
    for (let j = grid.offsets[c]!; j < grid.offsets[c + 1]!; j++, k++)
      around += w.elevation[grid.neighbours[j]!]!;
    const hollow = Math.max(-1, Math.min(1, (e - around / Math.max(1, k)) / 900));
    if (w.cover[c] === 1) {
      // Seas: deeper, darker.
      put(c, mix([0.06, 0.2, 0.46], [0.16, 0.42, 0.7], Math.min(1, Math.max(0, 1 + e / 3000))));
      continue;
    }
    if (w.cover[c] === 2) {
      put(c, mix([0.8, 0.86, 0.92], [0.97, 0.98, 1], height));
      continue;
    }
    // A people's lights, by the coasts where cities stand, once they have them.
    if (w.people && year >= w.people.electronics) {
      let coast = false;
      for (let j = grid.offsets[c]!; j < grid.offsets[c + 1]!; j++)
        if (w.cover[grid.neighbours[j]!] === 1) coast = true;
      const hash = Math.sin(c * 12.9898 + w.tint * 78.233) * 43758.5453;
      if (coast && hash - Math.floor(hash) < 0.22) {
        put(c, [1, 0.97, 0.82]);
        continue;
      }
    }
    // Bare ground (or, on a living world, its green): lighter on the heights, darker in the hollows.
    const ground = mix(
      w.living ? livingOf(t, w.precipitation[c] ?? 0) : groundOf(w, t),
      [1, 1, 1],
      0.2 * (height - 0.5),
    );
    put(
      c,
      hollow < 0 ? mix(ground, [0, 0, 0], -0.35 * hollow) : mix(ground, [1, 1, 1], 0.12 * hollow),
    );
  }
  return out;
}
