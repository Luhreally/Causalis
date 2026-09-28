// The god's acts as they play on the globe (Phase 12 M106), as data: for each act in force or
// done lately, the marks that show it where it falls, moving by the screen's clock — clouds and
// the rain under them, a sun's glare over a drought, golden motes rising from a blessed harvest
// and dark ones settling on a blight, a green pall turning over a plague, white crosses rising
// from the healed, a pillar of light over the inspired, flames and smoke on a burning town, a
// spring's water leaping, a glint over a shrine; between two realms a thread — red set at war,
// white at peace, gold made friends, violet in discord; a land rising in a ring of red, a land
// turned in a halo of its faith's colour. Each fades as its time runs out. Pure.
import type { ActKindShown, ActMark } from "../bridge/index.ts";
import type { SphereGrid } from "../kernel/index.ts";
import { globeRadius } from "./globe.ts";

type Vec = { x: number; y: number; z: number };

/** The kinds of mark drawn, each one colour (a faith's halo, by its colour, apart). */
export const ACT_PARTS = [
  "cloud",
  "streak",
  "glare",
  "haze",
  "gold",
  "dust",
  "pall",
  "cross",
  "pillar",
  "flame",
  "ember",
  "smoke",
  "water",
  "glint",
  "red",
  "white",
  "violet",
  "halo",
  "rubble",
  "crack",
  "green",
  "wisp",
] as const;
export type ActPart = (typeof ACT_PARTS)[number];

/** Each part's colour (a halo's is its faith's) and whether it is seen through. */
export const ACT_PART_LOOK: Readonly<
  Record<ActPart, { color: readonly [number, number, number]; opacity: number }>
> = {
  cloud: { color: [0.86, 0.88, 0.92], opacity: 0.9 },
  streak: { color: [0.62, 0.8, 1], opacity: 1 },
  glare: { color: [1, 0.72, 0.2], opacity: 1 },
  haze: { color: [0.92, 0.5, 0.18], opacity: 0.55 },
  gold: { color: [1, 0.84, 0.26], opacity: 1 },
  dust: { color: [0.3, 0.24, 0.12], opacity: 1 },
  pall: { color: [0.52, 0.66, 0.18], opacity: 0.5 },
  cross: { color: [0.94, 0.98, 1], opacity: 1 },
  pillar: { color: [1, 0.94, 0.62], opacity: 0.6 },
  flame: { color: [1, 0.46, 0.08], opacity: 1 },
  ember: { color: [1, 0.86, 0.3], opacity: 1 },
  smoke: { color: [0.36, 0.34, 0.36], opacity: 0.6 },
  water: { color: [0.36, 0.7, 1], opacity: 1 },
  glint: { color: [1, 1, 0.94], opacity: 1 },
  red: { color: [0.92, 0.12, 0.1], opacity: 1 },
  white: { color: [0.96, 0.96, 1], opacity: 1 },
  violet: { color: [0.62, 0.22, 0.86], opacity: 1 },
  halo: { color: [1, 1, 1], opacity: 1 },
  rubble: { color: [0.52, 0.44, 0.34], opacity: 0.8 },
  crack: { color: [0.12, 0.09, 0.08], opacity: 1 },
  green: { color: [0.36, 0.9, 0.46], opacity: 1 },
  wisp: { color: [0.3, 0.1, 0.38], opacity: 0.6 },
};

/** A mark of an act now: where, which way is up and which ahead, its size along its own axes. */
export type ActBit = {
  readonly part: ActPart;
  readonly at: Vec;
  readonly up: Vec;
  readonly ahead: Vec;
  readonly size: readonly [number, number, number];
  /** A halo's colour (its faith's). */
  readonly color?: readonly [number, number, number];
};

/** An act placed on the globe: its ground, its way up and two ways along the ground. */
export type PlacedAct = {
  readonly kind: ActKindShown;
  readonly ground: Vec;
  readonly up: Vec;
  readonly east: Vec;
  readonly north: Vec;
  /** The other end of a thread between two realms (its ground). */
  readonly to: Vec | null;
  readonly color: readonly [number, number, number] | null;
  readonly left: number;
  /** A number of its own, so no two play in step. */
  readonly key: number;
  readonly event: string;
};

const norm = (v: Vec): Vec => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};
const add = (a: Vec, b: Vec, k = 1): Vec => ({
  x: a.x + b.x * k,
  y: a.y + b.y * k,
  z: a.z + b.z * k,
});
const cross = (a: Vec, b: Vec): Vec => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const frac = (x: number) => x - Math.floor(x);
/** A number in [0, 1) of its own for a key and an index. */
const hash = (a: number, b: number) => {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/** The spot of a grid nearest a direction (for its ground's height). */
function nearest(grid: SphereGrid, v: Vec): number {
  const p = grid.positions;
  let best = 0,
    bestD = -Infinity;
  for (let c = 0; c < p.length / 3; c++) {
    const d = p[c * 3]! * v.x + p[c * 3 + 1]! * v.y + p[c * 3 + 2]! * v.z;
    if (d > bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Each act's ground on the globe (at the height of the land under it) and its ways about it. */
export function placeActs(
  marks: readonly ActMark[],
  grid: SphereGrid,
  elevation: Float32Array,
): PlacedAct[] {
  const ground = (a: readonly [number, number, number]): Vec => {
    const u = norm({ x: a[0], y: a[1], z: a[2] }),
      r = globeRadius(Math.max(0, elevation[nearest(grid, u)] ?? 0)) * 1.004;
    return { x: u.x * r, y: u.y * r, z: u.z * r };
  };
  return marks.map((m, i) => {
    const g = ground(m.at),
      up = norm(g),
      east = norm(
        Math.abs(up.y) < 0.95 ? cross({ x: 0, y: 1, z: 0 }, up) : cross({ x: 1, y: 0, z: 0 }, up),
      ),
      north = cross(up, east);
    let key = 0;
    for (const ch of m.event) key = (Math.imul(key, 31) + ch.charCodeAt(0)) >>> 0;
    return {
      kind: m.kind,
      ground: g,
      up,
      east,
      north,
      to: m.to ? ground(m.to) : null,
      color: m.color,
      left: m.left,
      key: key + i,
      event: m.event,
    };
  });
}

/**
 * Every mark of every act at screen time `s` (seconds), at most `most`; `zoom` the eye's
 * distance from the globe's middle (its radius 1): marks are drawn larger seen from afar, so an
 * act reads from orbit, and not so large that it hides its land seen close.
 */
export function actBits(acts: readonly PlacedAct[], s: number, zoom = 2.2, most = 1400): ActBit[] {
  const out: ActBit[] = [],
    scale = Math.max(0.7, Math.min(1.6, zoom / 2.2));
  for (const a of acts) {
    bitsOf(a, s, scale, out);
    if (out.length >= most) break;
  }
  return out.slice(0, most);
}

function bitsOf(a: PlacedAct, s: number, scale: number, out: ActBit[]): void {
  const k = scale * (0.45 + 0.55 * Math.max(0, Math.min(1, a.left))),
    { up, east, north } = a,
    // A point about the act's ground: `e` east and `n` north (globe units), `h` up.
    at = (e: number, n: number, h: number): Vec =>
      add(add(add(a.ground, east, e * k), north, n * k), up, h * k),
    bit = (
      part: ActPart,
      p: Vec,
      sx: number,
      sy: number,
      sz: number,
      ahead: Vec = north,
      color?: readonly [number, number, number],
    ) =>
      out.push({
        part,
        at: p,
        up,
        ahead,
        size: [sx * k, sy * k, sz * k],
        ...(color ? { color } : {}),
      }),
    // A number of its own for the act and a mark (so its marks scatter, the same each frame).
    r = (i: number) => hash(a.key, i),
    spread = 0.045;
  switch (a.kind) {
    case "rain":
    case "drought": {
      if (a.kind === "rain") {
        // Clouds drifting over the land, each a heap of puffs, and the rain falling from them.
        for (let i = 0; i < 5; i++) {
          const turn = s * 0.08 + i * 1.26,
            e = Math.cos(turn) * spread * 0.5 + (r(i) - 0.5) * 0.02,
            n = Math.sin(turn) * spread * 0.5 + (r(i + 5) - 0.5) * 0.02;
          for (let j = 0; j < 3; j++) {
            const size = 0.009 + 0.008 * r(i * 3 + j + 90);
            bit(
              "cloud",
              at(e + (j - 1) * 0.008, n + (r(i * 3 + j) - 0.5) * 0.008, 0.048 + 0.004 * j),
              size,
              size * 0.7,
              size,
            );
          }
        }
        for (let i = 0; i < 28; i++) {
          const fall = frac(s * 1.1 + r(i + 10)),
            e = (r(i + 40) - 0.5) * spread * 1.3,
            n = (r(i + 70) - 0.5) * spread * 1.3;
          bit("streak", at(e, n, 0.044 * (1 - fall)), 0.0016, 0.014, 0.0016);
        }
      } else {
        // The sun's glare over the land, and heat rising off it.
        const pulse = 1 + 0.12 * Math.sin(s * 2 + a.key);
        bit("glare", at(0, 0, 0.07), 0.024 * pulse, 0.024 * pulse, 0.024 * pulse);
        for (let i = 0; i < 12; i++) {
          const rise = frac(s * 0.35 + r(i)),
            e = (r(i + 20) - 0.5) * spread * 1.3,
            n = (r(i + 50) - 0.5) * spread * 1.3;
          bit("haze", at(e, n, 0.004 + 0.03 * rise), 0.008 * (1 - rise), 0.004, 0.008 * (1 - rise));
        }
      }
      return;
    }
    case "bounty":
    case "blight": {
      // Motes rising golden from a blessed harvest; dark ones settling on a blighted one.
      const part: ActPart = a.kind === "bounty" ? "gold" : "dust";
      for (let i = 0; i < 16; i++) {
        const t = frac(s * 0.3 + r(i)),
          h = a.kind === "bounty" ? 0.004 + 0.045 * t : 0.05 - 0.046 * t,
          e = (r(i + 30) - 0.5) * spread * 1.3 + (a.kind === "blight" ? 0.01 * Math.sin(s + i) : 0),
          n = (r(i + 60) - 0.5) * spread * 1.3,
          size = 0.005 * (a.kind === "bounty" ? 1 - t * 0.7 : 0.6 + t * 0.4);
        bit(part, at(e, n, h), size, size, size);
      }
      return;
    }
    case "plague": {
      // A green pall turning low over the land.
      for (let i = 0; i < 9; i++) {
        const turn = s * 0.25 + (i * Math.PI * 2) / 9,
          reach = spread * (0.35 + 0.35 * r(i)),
          e = Math.cos(turn) * reach,
          n = Math.sin(turn) * reach,
          swell = 1 + 0.2 * Math.sin(s * 1.3 + i);
        bit("pall", at(e, n, 0.014 + 0.008 * r(i + 9)), 0.022 * swell, 0.012, 0.022 * swell);
      }
      return;
    }
    case "healing": {
      // White crosses rising from the healed.
      for (let i = 0; i < 8; i++) {
        const t = frac(s * 0.25 + r(i)),
          e = (r(i + 30) - 0.5) * spread * 1.2,
          n = (r(i + 60) - 0.5) * spread * 1.2,
          p = at(e, n, 0.006 + 0.04 * t),
          size = 0.009 * (1 - t * 0.6);
        bit("cross", p, size * 0.3, size, size * 0.3);
        bit("cross", add(p, up, size * 0.12 * k), size * 0.3, size * 0.3, size, east);
      }
      return;
    }
    case "inspiration": {
      // A pillar of light, and motes climbing it.
      const pulse = 1 + 0.25 * Math.sin(s * 3 + a.key);
      bit("pillar", at(0, 0, 0.06), 0.006 * pulse, 0.12, 0.006 * pulse);
      for (let i = 0; i < 6; i++) {
        const t = frac(s * 0.5 + i / 6);
        bit(
          "glint",
          at(Math.cos(i + s) * 0.01, Math.sin(i + s) * 0.01, 0.12 * t),
          0.004,
          0.004,
          0.004,
        );
      }
      return;
    }
    case "fire": {
      // Flames on the town, embers and smoke going up from it.
      for (let i = 0; i < 10; i++) {
        const e = (r(i) - 0.5) * 0.022,
          n = (r(i + 10) - 0.5) * 0.022,
          flick = 0.7 + 0.5 * Math.abs(Math.sin(s * 9 + i * 1.7));
        bit("flame", at(e, n, 0.008 * flick), 0.008, 0.018 * flick, 0.008);
        bit("ember", at(e * 0.8, n * 0.8, 0.015 * flick), 0.004, 0.009 * flick, 0.004);
      }
      for (let i = 0; i < 6; i++) {
        const t = frac(s * 0.3 + r(i + 20)),
          drift = 0.014 * t,
          size = 0.005 + 0.009 * t;
        bit(
          "smoke",
          at(drift + (r(i + 30) - 0.5) * 0.008, drift * 0.5, 0.026 + 0.05 * t),
          size,
          size,
          size,
        );
      }
      return;
    }
    case "spring": {
      // Water leaping up and falling back.
      for (let i = 0; i < 12; i++) {
        const t = frac(s * 0.6 + i / 12),
          turn = (i * Math.PI * 2) / 12,
          out1 = 0.014 * t,
          h = 0.004 + 0.04 * t * (1 - t);
        bit("water", at(Math.cos(turn) * out1, Math.sin(turn) * out1, h), 0.003, 0.004, 0.003);
      }
      return;
    }
    case "shrine": {
      // A glint rising over the shrine.
      for (let i = 0; i < 4; i++) {
        const t = frac(s * 0.4 + i / 4);
        bit(
          "glint",
          at(0, 0, 0.01 + 0.05 * t),
          0.004 * (1 - t) + 0.001,
          0.004 * (1 - t) + 0.001,
          0.004 * (1 - t) + 0.001,
        );
      }
      bit("gold", at(0, 0, 0.005), 0.005, 0.01, 0.005);
      return;
    }
    case "quake": {
      // The ground shaken: dust thrown up and settling, cracks opening, the land trembling.
      const shake = Math.sin(s * 40 + a.key) * 0.0015 * Math.max(0, a.left - 0.3);
      for (let i = 0; i < 10; i++) {
        const t = frac(s * 0.5 + r(i)),
          e = (r(i + 20) - 0.5) * spread * 1.2 + shake,
          n = (r(i + 40) - 0.5) * spread * 1.2;
        bit("rubble", at(e, n, 0.003 + 0.025 * t * (1 - t)), 0.007, 0.005, 0.007);
      }
      for (let i = 0; i < 6; i++) {
        const turn = r(i + 60) * Math.PI,
          e = (r(i + 70) - 0.5) * spread,
          n = (r(i + 80) - 0.5) * spread;
        bit("crack", at(e + shake, n, 0.001), 0.0025, 0.002, 0.03, {
          x: east.x * Math.cos(turn) + north.x * Math.sin(turn),
          y: east.y * Math.cos(turn) + north.y * Math.sin(turn),
          z: east.z * Math.cos(turn) + north.z * Math.sin(turn),
        });
      }
      return;
    }
    case "meteor": {
      // Fire from the sky: first the fall, a blazing stone and its trail; then the land
      // smouldering, embers and smoke going up.
      if (a.left > 0.95) {
        const fall = (1 - a.left) / 0.05,
          h = 0.25 * (1 - fall),
          side = 0.12 * (1 - fall);
        bit("flame", at(side, 0, h), 0.014, 0.014, 0.014);
        for (let i = 1; i < 8; i++)
          bit(
            "ember",
            at(side + i * 0.012, 0, h + i * 0.025),
            0.009 - i * 0.001,
            0.009 - i * 0.001,
            0.009 - i * 0.001,
          );
      }
      for (let i = 0; i < 8; i++) {
        const t = frac(s * 0.25 + r(i)),
          e = (r(i + 20) - 0.5) * spread * 0.8,
          n = (r(i + 40) - 0.5) * spread * 0.8,
          size = 0.006 + 0.012 * t;
        bit("smoke", at(e + 0.01 * t, n, 0.008 + 0.06 * t), size, size, size);
      }
      for (let i = 0; i < 6; i++) {
        const flick = 0.6 + 0.4 * Math.abs(Math.sin(s * 7 + i * 1.9));
        bit(
          "ember",
          at((r(i + 60) - 0.5) * 0.03, (r(i + 70) - 0.5) * 0.03, 0.003),
          0.004,
          0.004 * flick,
          0.004,
        );
      }
      return;
    }
    case "crater": {
      // The crater a meteor left: a dark ring and its hollow, for ever.
      for (let i = 0; i < 14; i++) {
        const turn = (i * Math.PI * 2) / 14;
        bit(
          "crack",
          at(Math.cos(turn) * 0.018, Math.sin(turn) * 0.018, 0.002),
          0.006,
          0.004,
          0.006,
        );
      }
      bit("crack", at(0, 0, -0.001), 0.026, 0.002, 0.026);
      return;
    }
    case "flood": {
      // The river risen: water spread over the fields, rippling.
      for (let i = 0; i < 9; i++) {
        const e = (r(i) - 0.5) * spread * 1.3,
          n = (r(i + 20) - 0.5) * spread * 1.3,
          swell = 1 + 0.15 * Math.sin(s * 1.6 + i);
        bit("water", at(e, n, 0.002), 0.02 * swell, 0.0015, 0.016 * swell);
      }
      return;
    }
    case "bless":
    case "curse": {
      // A realm blessed: gold rising over its seat; cursed: dark wisps turning over it.
      for (let i = 0; i < 12; i++) {
        const t = frac(s * 0.3 + r(i)),
          turn = s * 0.4 + (i * Math.PI * 2) / 12,
          reach = 0.012 + 0.012 * r(i + 12);
        bit(
          a.kind === "bless" ? "gold" : "wisp",
          at(Math.cos(turn) * reach, Math.sin(turn) * reach, 0.01 + 0.04 * t),
          a.kind === "bless" ? 0.004 : 0.01,
          a.kind === "bless" ? 0.004 : 0.006,
          a.kind === "bless" ? 0.004 : 0.01,
        );
      }
      return;
    }
    case "war":
    case "peace":
    case "friendship":
    case "discord":
    case "settle":
    case "union": {
      if (!a.to) return;
      // A thread between the two places, arched over the globe, a pulse running along it:
      // red set at war, white at peace, gold made friends or one, violet in discord, green the
      // way settlers went.
      const part: ActPart =
          a.kind === "war"
            ? "red"
            : a.kind === "peace"
              ? "white"
              : a.kind === "friendship" || a.kind === "union"
                ? "gold"
                : a.kind === "settle"
                  ? "green"
                  : "violet",
        from = a.ground,
        to = a.to,
        steps = 40,
        run = frac(s * 0.35 + (a.key % 97) / 97);
      for (let i = 0; i <= steps; i++) {
        const f = i / steps,
          mid = {
            x: from.x + (to.x - from.x) * f,
            y: from.y + (to.y - from.y) * f,
            z: from.z + (to.z - from.z) * f,
          },
          lift =
            1.01 +
            0.08 *
              Math.sin(Math.PI * f) *
              Math.min(1, Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) * 2),
          u = norm(mid),
          // (Discord's thread is jagged.)
          jag = a.kind === "discord" ? (i % 2 ? 0.006 : -0.006) : 0,
          p = add({ x: u.x * lift, y: u.y * lift, z: u.z * lift }, east, jag),
          near = Math.abs(f - run) < 0.05,
          size = (near ? 0.009 : 0.0048) * k;
        out.push({ part, at: p, up: u, ahead: north, size: [size, size, size] });
      }
      return;
    }
    case "rising": {
      // A ring of red widening from the land, again and again.
      for (let w = 0; w < 2; w++) {
        const t = frac(s * 0.4 + w * 0.5),
          reach = 0.008 + 0.04 * t;
        for (let i = 0; i < 14; i++) {
          const turn = (i * Math.PI * 2) / 14;
          bit(
            "red",
            at(Math.cos(turn) * reach, Math.sin(turn) * reach, 0.004),
            0.004 * (1 - t) + 0.001,
            0.008 * (1 - t) + 0.002,
            0.004 * (1 - t) + 0.001,
          );
        }
      }
      return;
    }
    case "ways": {
      // A people's ways pushed: bright motes spiralling up over the land.
      for (let i = 0; i < 14; i++) {
        const t = frac(s * 0.35 + i / 14),
          turn = s * 1.2 + i * 2.4,
          reach = 0.006 + 0.02 * t;
        bit(
          i % 2 ? "gold" : "glint",
          at(Math.cos(turn) * reach, Math.sin(turn) * reach, 0.006 + 0.05 * t),
          0.004,
          0.004,
          0.004,
        );
      }
      return;
    }
    case "tongue":
    case "faith": {
      // A land taught a tongue, or a faith founded there: a ring in its colour, rising again and
      // again; for a faith, a pillar of it too.
      const color = a.color ?? [1, 1, 1];
      for (let w = 0; w < 2; w++) {
        const t = frac(s * 0.3 + w * 0.5);
        for (let i = 0; i < 16; i++) {
          const turn = (i * Math.PI * 2) / 16 + s * 0.3;
          bit(
            "halo",
            at(Math.cos(turn) * 0.024, Math.sin(turn) * 0.024, 0.004 + 0.04 * t),
            0.004 * (1 - t) + 0.001,
            0.004 * (1 - t) + 0.001,
            0.004 * (1 - t) + 0.001,
            north,
            color,
          );
        }
      }
      if (a.kind === "faith") bit("halo", at(0, 0, 0.04), 0.004, 0.08, 0.004, north, color);
      return;
    }
    case "conversion": {
      // A halo of the faith's colour turning over the land.
      const color = a.color ?? [1, 1, 1];
      for (let i = 0; i < 16; i++) {
        const turn = s * 0.6 + (i * Math.PI * 2) / 16;
        bit(
          "halo",
          at(Math.cos(turn) * 0.024, Math.sin(turn) * 0.024, 0.03),
          0.004,
          0.004,
          0.004,
          north,
          color,
        );
      }
      bit("halo", at(0, 0, 0.018), 0.003, 0.03, 0.003, north, color);
      return;
    }
  }
}
