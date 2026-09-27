// A world's beginning, as the genesis shows it (Phase 9 M89) — a look at what the world's
// own generation holds, pure functions of it and the screen's clock. The world forming:
// molten, its crust cooling dark and cracked with fire, its seas rising over the low ground,
// its land greening; then each of its deep ages marking it (an icehouse's ice down from the
// poles, a hothouse's warmth, great volcanism's fires, an impact's flash). The dawn of life
// under the microscope: the first cells dividing, cells with a nucleus, cells together in
// turning colonies, the first bodies. The living world: its lineages arising age by age from
// their own bodies, and passing in the great deaths; then the people.
import type { GenesisPlan } from "../bridge/index.ts";

type Rgb = readonly [number, number, number];

const hash = (a: number, b: number) => {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
const mixRgb = (a: Rgb, b: Rgb, k: number): Rgb => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const MAGMA: Rgb = [1, 0.62, 0.16],
  EMBER: Rgb = [0.62, 0.1, 0.04],
  BASALT: Rgb = [0.2, 0.19, 0.2],
  SEA_DEEP: Rgb = [0.05, 0.14, 0.4],
  SEA_SHALLOW: Rgb = [0.16, 0.38, 0.68];

/**
 * The world as it forms, `k` from 0 (molten) to 1 (as it is): every cell's colour (RGBA),
 * from its height and the colour its land comes to (`land`, the terrain's own colours), the
 * molten world's glow flickering by the screen's clock `s`.
 */
export function formingColors(
  elevation: Float32Array,
  land: Uint8Array,
  k: number,
  s: number,
): Uint8Array {
  const n = elevation.length,
    out = new Uint8Array(n * 4);
  let low = Infinity,
    high = -Infinity;
  for (let c = 0; c < n; c++) {
    low = Math.min(low, elevation[c]!);
    high = Math.max(high, elevation[c]!);
  }
  // The seas rise from the deepest ground to their own level.
  const rising = smooth(0.42, 0.7, k),
    level = low + (0 - low) * rising;
  for (let c = 0; c < n; c++) {
    const e = elevation[c]!,
      flicker = hash(c, Math.floor(s * 6)) * 0.25 + hash(c, 7) * 0.5,
      molten = mixRgb(EMBER, MAGMA, Math.min(1, flicker + 0.2)),
      // Cooling: dark crust, the fire showing in its cracks a while longer.
      crack = hash(c, 11) < 0.12 ? smooth(0.2, 0.55, k) * 0.5 : smooth(0.2, 0.42, k),
      crust = mixRgb(molten, BASALT, crack);
    let rgb: Rgb = crust;
    if (rising > 0 && e < level) {
      const depth = Math.min(1, (level - e) / Math.max(1, level - low));
      rgb = mixRgb(crust, mixRgb(SEA_SHALLOW, SEA_DEEP, depth), smooth(0, 0.08, rising));
    } else if (k > 0.7 && e >= 0) {
      const green = smooth(0.7, 1, k);
      rgb = mixRgb(
        crust,
        [land[c * 4]! / 255, land[c * 4 + 1]! / 255, land[c * 4 + 2]! / 255],
        green,
      );
    }
    // (At the last, every cell as its own lens paints it: seas and land alike.)
    if (k >= 0.999) rgb = [land[c * 4]! / 255, land[c * 4 + 1]! / 255, land[c * 4 + 2]! / 255];
    out[c * 4] = Math.round(rgb[0] * 255);
    out[c * 4 + 1] = Math.round(rgb[1] * 255);
    out[c * 4 + 2] = Math.round(rgb[2] * 255);
    out[c * 4 + 3] = 255;
  }
  void high;
  return out;
}

/**
 * The world in one of its deep ages, `k` of the way through it: its colours (from those it
 * has as it is) marked by what the age was — ice down from the poles in an icehouse, a warm
 * cast in a hothouse, fires breaking out in great volcanism, a flash and a scar in an impact.
 */
export function ageColors(
  base: Uint8Array,
  lat: Float64Array,
  elevation: Float32Array,
  kind: string,
  k: number,
  key: number,
): Uint8Array {
  const out = Uint8Array.from(base),
    n = lat.length,
    swell = Math.sin(Math.PI * Math.max(0, Math.min(1, k)));
  for (let c = 0; c < n; c++) {
    const at = c * 4,
      rgb: Rgb = [base[at]! / 255, base[at + 1]! / 255, base[at + 2]! / 255];
    let next = rgb;
    if (kind === "icehouse") {
      // Ice down from the poles as far as the age's cold reaches.
      const reach = 72 - 34 * swell,
        deg = Math.abs((lat[c]! * 180) / Math.PI);
      if (deg > reach) next = mixRgb(rgb, [0.94, 0.96, 1], smooth(reach, reach + 6, deg));
    } else if (kind === "hothouse") next = mixRgb(rgb, [0.86, 0.72, 0.36], 0.35 * swell);
    else if (kind === "great volcanism") {
      if (elevation[c]! > 0 && hash(c, key) < 0.05 * swell)
        next = mixRgb(rgb, [1, 0.32, 0.06], 0.9);
      else next = mixRgb(rgb, [0.3, 0.26, 0.26], 0.25 * swell);
    } else if (kind === "impact") {
      // A flash over all, then a dark scar about where it struck.
      const flash = Math.max(0, 1 - k * 4),
        strike = Math.floor(hash(key, 3) * n),
        near = Math.abs(lat[c]! - lat[strike]!) < 0.18 && hash(c, key + 1) < 0.6 ? 1 : 0;
      next = mixRgb(mixRgb(rgb, [1, 0.88, 0.6], flash * 0.8), [0.22, 0.16, 0.12], near * swell);
    }
    out[at] = Math.round(next[0] * 255);
    out[at + 1] = Math.round(next[1] * 255);
    out[at + 2] = Math.round(next[2] * 255);
  }
  return out;
}

// —— The dawn of life, under the microscope ————————————————————————————————————

/** A cell's part under the microscope: where (a drop's units), how big, which way. */
export type CellPart = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  yaw: number;
  pitch: number;
};

/** What the microscope shows, by its batches: cells' skins, nuclei, their small parts. */
export type Drop = { skins: CellPart[]; nuclei: CellPart[]; bits: CellPart[] };

/** The dawn's stages: the first cells, cells with a nucleus, cells together, the first bodies. */
export const DAWN = ["first cells", "nucleus", "colonies", "bodies"] as const;
export type Dawn = (typeof DAWN)[number];

const part = (
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  yaw = 0,
  pitch = 0,
): CellPart => ({ x, y, z, sx, sy, sz, yaw, pitch });

/** A drifting place in the drop for thing `i` at screen time `s` (seconds). */
function drift(i: number, s: number, spread: number): { x: number; y: number; z: number } {
  const a = hash(i, 1) * 6.283,
    r = spread * Math.sqrt(hash(i, 2));
  return {
    x: r * Math.cos(a) + Math.sin(s * 0.3 + i) * 0.4,
    y: (hash(i, 3) - 0.5) * spread * 0.5 + Math.sin(s * 0.23 + i * 1.7) * 0.25,
    z: r * Math.sin(a) + Math.cos(s * 0.27 + i * 0.7) * 0.4,
  };
}

/**
 * The drop under the microscope at screen time `s` (seconds into the stage): the first
 * cells, few and small, dividing until the water is full of them; cells a hundred times
 * larger with a nucleus and their small parts, one taking another in; cells together,
 * balls of them turning as one; the first bodies — a worm of cells rippling along, a
 * jelly's bell of cells beating, a sponge's cup.
 */
export function dropOf(stage: Dawn, s: number): Drop {
  const d: Drop = { skins: [], nuclei: [], bits: [] };
  if (stage === "first cells") {
    // Dividing: twice as many every few seconds, each pair splitting apart.
    const n = Math.min(64, Math.floor(2 ** (1 + s / 2.5)));
    for (let i = 0; i < n; i++) {
      const p = drift(i, s, 5),
        born = (Math.log2(i + 1) - 1) * 2.5,
        grow = Math.min(1, Math.max(0.3, (s - born) / 1.5));
      d.skins.push(part(p.x, p.y, p.z, 0.16 * grow, 0.16 * grow, 0.36 * grow, s * 0.2 + i, 0.4));
      d.bits.push(part(p.x, p.y, p.z, 0.06, 0.06, 0.14, s * 0.2 + i, 0.4));
    }
  } else if (stage === "nucleus") {
    for (let i = 0; i < 10; i++) {
      const p = drift(i + 100, s, 5),
        r = 0.55 + 0.2 * hash(i, 9);
      d.skins.push(part(p.x, p.y, p.z, r, r * 0.92, r));
      d.nuclei.push(part(p.x + r * 0.15, p.y, p.z, r * 0.36, r * 0.36, r * 0.36));
      for (let b = 0; b < 4; b++) {
        const a = s * 0.4 + b * 1.57 + i;
        d.bits.push(
          part(
            p.x + Math.cos(a) * r * 0.55,
            p.y + 0.05,
            p.z + Math.sin(a) * r * 0.55,
            0.09,
            0.05,
            0.16,
            a,
          ),
        );
      }
    }
    // One takes another in: a small cell drawn into the first large one.
    const host = drift(100, s, 5),
      k = (s % 8) / 8,
      out = 2.2 * (1 - k);
    d.skins.push(part(host.x + out, host.y, host.z, 0.14, 0.14, 0.3, 0, 0.4));
  } else if (stage === "colonies") {
    // Balls of cells turning as one: each cell a small sphere on the ball's skin.
    for (let c = 0; c < 5; c++) {
      const at = drift(c + 200, s * 0.5, 4.5),
        R = 0.8 + 0.25 * hash(c, 4),
        turn = s * (0.3 + 0.1 * c);
      for (let i = 0; i < 22; i++) {
        // (A sunflower's spiral on the ball.)
        const y = 1 - (2 * (i + 0.5)) / 22,
          r = Math.sqrt(1 - y * y),
          a = i * 2.399963 + turn;
        d.skins.push(
          part(at.x + R * r * Math.cos(a), at.y + R * y, at.z + R * r * Math.sin(a), 0.2, 0.2, 0.2),
        );
      }
      d.nuclei.push(part(at.x, at.y, at.z, R * 0.4, R * 0.4, R * 0.4));
    }
  } else {
    // A worm of cells rippling along.
    const along = (s * 0.5) % 6;
    for (let i = 0; i < 12; i++) {
      const z = -3 + along - i * 0.36,
        x = -1.3 + Math.sin(s * 2.4 - i * 0.7) * 0.3;
      d.skins.push(part(x, 0, z, 0.34 - i * 0.012, 0.3, 0.34, 0, 0));
    }
    // A jelly's bell of cells, beating, its arms of cells trailing.
    const beat = 1 + 0.15 * Math.sin(s * 2.2),
      jy = 1.2 + Math.sin(s * 0.5) * 0.6;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.283;
      d.skins.push(
        part(1.5 + Math.cos(a) * 0.9 * beat, jy, Math.sin(a) * 0.9 * beat, 0.24, 0.18, 0.24),
      );
    }
    d.nuclei.push(part(1.5, jy + 0.12, 0, 0.7 * beat, 0.3, 0.7 * beat));
    for (let arm = 0; arm < 5; arm++)
      for (let i = 1; i <= 4; i++) {
        const a = (arm / 5) * 6.283;
        d.bits.push(
          part(
            1.5 + Math.cos(a) * 0.4,
            jy - i * 0.32,
            Math.sin(a) * 0.4 + Math.sin(s * 1.5 + i + arm) * 0.08,
            0.1,
            0.12,
            0.1,
          ),
        );
      }
    // A sponge's cup of cells, standing on the bottom.
    for (let ring = 0; ring < 5; ring++)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * 6.283 + ring * 0.3,
          r = 0.45 + ring * 0.12;
        d.skins.push(
          part(-0.2 + Math.cos(a) * r, -1.6 + ring * 0.3, 1.8 + Math.sin(a) * r, 0.2, 0.2, 0.2),
        );
      }
  }
  return d;
}

// —— The living world, age by age ——————————————————————————————————————————————

/** A lineage on the parade's stage now: which, where (metres on the stage), which way, how fully there. */
export type OnStage = { lineage: number; x: number; z: number; yaw: number; there: number };

/**
 * The living world at `t` (0 … 1) through its ages: the age now; each lineage that has
 * arisen and not yet died out, on the stage (the latest arisen nearest), coming in as it
 * arises and fading as it dies; `most` on the stage at once.
 */
export function paradeOf(plan: GenesisPlan, t: number, most = 8): { age: number; on: OnStage[] } {
  const ages = Math.max(1, plan.ages.length),
    at = Math.max(0, Math.min(0.9999, t)) * ages,
    age = Math.floor(at),
    within = at - age;
  const living = plan.lineages
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.body && l.arose <= age && (l.died === null || l.died >= age))
    .sort((a, b) => b.l.arose - a.l.arose || a.i - b.i)
    .slice(0, most);
  const on = living.map(({ l, i }, k) => {
    // The newest near the front, the older behind, in a fan.
    const row = Math.floor(k / 4),
      col = (k % 4) - 1.5,
      arriving = l.arose === age ? smooth(0, 0.35, within) : 1,
      leaving = l.died === age ? 1 - smooth(0.55, 0.95, within) : 1;
    return {
      lineage: i,
      // (Metres on the stage: room between them for the largest.)
      x: col * 22 + (row % 2) * 11,
      z: -row * 24 - (1 - arriving) * 30,
      // In profile, each a little turned.
      yaw: Math.PI / 2 + (col - 0.5) * 0.18,
      there: Math.min(arriving, leaving),
    };
  });
  return { age, on };
}

// —— Its words ———————————————————————————————————————————————————————————————————

const KIND_WORDS: Readonly<Record<string, string>> = {
  quiet: "a quiet age",
  hothouse: "a hothouse: the world warm to the poles, the seas high",
  icehouse: "an icehouse: ice down from the poles, the seas low",
  "great volcanism": "an age of great volcanism: the land split and burned",
  impact: "an age ended by a great impact from the sky",
};

/** An age in words: when, and what it was. */
export function ageWords(a: GenesisPlan["ages"][number]): string {
  const when =
    a.from >= 1000 ? `${(a.from / 1000).toFixed(1)} billion` : `${Math.round(a.from)} million`;
  return `${when} years ago — ${KIND_WORDS[a.kind] ?? a.kind}`;
}

/** What the microscope's stages tell. */
export const DAWN_WORDS: Readonly<Record<Dawn, readonly [string, string]>> = {
  "first cells": [
    "The first cells",
    "In warm water rich in what the rocks gave up, a skin closed about a few chemicals that could copy themselves. The first cells: too small to see, eating what the water held, dividing in two, and two again, until the seas were full of them.",
  ],
  nucleus: [
    "Cells with a nucleus",
    "Then one cell took another in and did not eat it: it kept it, and the two lived as one. Cells a hundred times larger, their copying kept in a nucleus, small working parts about it — the stuff every body since is made of.",
  ],
  colonies: [
    "Cells together",
    "Some cells, dividing, did not part: they stayed together, a ball of them turning as one, each doing a little less alone and all doing more together.",
  ],
  bodies: [
    "The first bodies",
    "At last cells that differed — some to move, some to eat, some to feel — made bodies: a worm of cells rippling along the bottom, a jelly's bell beating in the water, a sponge's cup straining it. From these, every creature to come.",
  ],
};
