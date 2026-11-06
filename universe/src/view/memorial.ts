// What a town raised, placed and shaped (T1): where each stands on the rim of its square, off its streets, its bunting's poles, its market's
// stalls, its hall, its well and the god's wonders; and the handful of low parts each is made of. Pure: the same plan, the same stones in the
// same places. A town keeps five at most and has room on its square's rim for eight, so a stone never has to go out into a road. Parts are
// in metres, as a town's.
import type { Memorial, VillagePlan } from "../bridge/index.ts";
import { SQUARE } from "../bridge/index.ts";
import { clearOfHall, marketScene, squareScale, FEAST } from "./feast.ts";
import { clearAt, villageGround } from "./ground.ts";
import { wonderAsked } from "./village.ts";

export type StoneMesh = "box" | "cyl" | "cone" | "gable";
/** Its main stuff, its darker stuff (its cut faces or lit names), or what lies under it. */
export type PartTone = "main" | "dark";
export type MemorialPart = {
  readonly mesh: StoneMesh;
  readonly tone: PartTone;
  /** Its middle, along its front, up, and back from it (metres from the stone's foot). */
  readonly u: number;
  readonly y: number;
  readonly v: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  /** A turn about its own up, and a lean. */
  readonly yaw?: number;
  readonly tip?: number;
};

/** A thing placed: where it stands, which way it faces (toward the square's middle) and how large it is drawn. */
export type PlacedMemorial = {
  readonly m: Memorial;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly scale: number;
  /** How high it stands, and how far it reaches to each side along its front (metres), for a finger. */
  readonly high: number;
  readonly wide: number;
};

/** The most parts one thing raised is made of: a town's worst is five of these. */
export const MOST_STONE_PARTS = 9;

const unit = (seed: number, n: number): number => {
  let x = Math.imul((seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

const box = (
  tone: PartTone,
  u: number,
  y: number,
  v: number,
  sx: number,
  sy: number,
  sz: number,
  more: Partial<MemorialPart> = {},
): MemorialPart => ({ mesh: "box", tone, u, y, v, sx, sy, sz, ...more });
const cyl = (
  tone: PartTone,
  u: number,
  y: number,
  v: number,
  sx: number,
  sy: number,
  sz: number,
  more: Partial<MemorialPart> = {},
): MemorialPart => ({ mesh: "cyl", tone, u, y, v, sx, sy, sz, ...more });
const cone = (
  tone: PartTone,
  u: number,
  y: number,
  v: number,
  sx: number,
  sy: number,
  sz: number,
): MemorialPart => ({ mesh: "cone", tone, u, y, v, sx, sy, sz });

/** The parts of a thing raised, at its own size: its shape from what it is, its lean from how old. */
export function memorialParts(m: Memorial, key: number): readonly MemorialPart[] {
  const s = m.size,
    // (Old stones lean: a hand's breadth in five hundred years, no more than it would take to fall.)
    lean = Math.min(0.16, m.age / 3500) * (unit(key, 2) < 0.5 ? -1 : 1);
  switch (m.form) {
    case "stone": {
      const h = 15 * s;
      return [
        box("dark", 0, 0.5, 0, 7.5, 1, 6),
        box("main", 0, h / 2 + 0.6, 0, 3.8, h, 2.2, { tip: lean }),
        box("main", 0, h + 1.2, 0, 2.8, 2.2, 1.7, { tip: lean }),
        box("dark", 0, h * 0.55, 1.15, 2.6, h * 0.42, 0.14, { tip: lean }),
        box("main", -3.1, 0.9, 1.4, 1.5, 1.6, 1.3),
        box("main", 2.9, 0.7, -1.6, 1.4, 1.2, 1.2),
      ];
    }
    case "slab": {
      const h = 18 * s;
      return [
        box("main", 0, 0.5, 0, 8, 1, 5),
        box("main", 0, h / 2 + 1, 0, 5.4, h, 0.9),
        box("dark", 0, h * 0.62, 0.5, 3.6, h * 0.5, 0.1),
        box("dark", 0, 1.1, 2.7, 5.4, 0.16, 0.16),
      ];
    }
    case "wall": {
      const l = Math.min(15.5, 10 + 3.2 * s),
        h = 5.5 + 2.5 * s;
      return [
        box("dark", 0, 0.35, 0, l + 1.6, 0.7, 3.2),
        box("main", 0, h / 2 + 0.7, 0, l, h, 1.1),
        box("main", 0, h + 0.95, 0, l + 0.8, 0.5, 1.5),
        box("dark", -l * 0.31, h * 0.56, 0.58, l * 0.26, h * 0.68, 0.1),
        box("dark", 0, h * 0.56, 0.58, l * 0.26, h * 0.68, 0.1),
        box("dark", l * 0.31, h * 0.56, 0.58, l * 0.26, h * 0.68, 0.1),
      ];
    }
    case "stump": {
      const h = 9 * s;
      return [
        cyl("dark", 0, 0.32, 0, 13, 0.14, 13),
        cyl("main", 0, h / 2 + 0.3, 0, 4.2, h, 4.2),
        cone("main", 0, h + 1.2, 0, 3.6, 2.6, 3.6),
        box("main", 2.8, h * 0.72, 0.2, 4.4, 0.8, 0.8, { yaw: 0.4, tip: 0 }),
        box("main", -2.6, h * 0.5, -0.6, 3.6, 0.7, 0.7, { yaw: 2.2 }),
        box("main", 0.6, 0.8, 3.8, 1, 0.9, 5, { yaw: 0.7 }),
        box("main", -4, 0.7, 1.7, 1, 0.8, 3.8, { yaw: 2.1 }),
      ];
    }
    case "tomb": {
      const w = 9 * s,
        d = 6 * s,
        h = 5.5 * s;
      return [
        box("dark", 0, 0.4, 0, w + 4, 0.8, d + 3.6),
        box("main", 0, 1.2, 0, w + 2, 0.8, d + 1.8),
        box("main", 0, 1.6 + h / 2, 0, w, h, d),
        {
          mesh: "gable",
          tone: "main",
          u: 0,
          y: 1.6 + h + (2.8 * s) / 2,
          v: 0,
          sx: w + 1,
          sy: 2.8 * s,
          sz: d + 1,
        },
        box("dark", 0, 1.6 + h * 0.42, d / 2 + 0.06, w * 0.3, h * 0.72, 0.12),
        box("dark", -w / 2 - 0.1, 1.6 + h / 2, d / 2 + 0.05, 0.8, h, 0.8),
        box("dark", w / 2 + 0.1, 1.6 + h / 2, d / 2 + 0.05, 0.8, h, 0.8),
      ];
    }
    case "ring": {
      const out: MemorialPart[] = [cyl("dark", 0, 0.3, 0, 11, 0.12, 11)];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * 2 * Math.PI,
          h = 4.5 + 3 * unit(key, i + 10);
        out.push(
          box("main", Math.cos(a) * 5, h / 2 + 0.3, Math.sin(a) * 5, 1.6, h, 1.1, {
            yaw: a,
            tip: lean * 1.5,
          }),
        );
      }
      return out;
    }
    case "column": {
      const h = 9.5 * s;
      return [
        box("dark", 0, 0.5, 0, 7, 1, 7),
        cyl("main", 0, h / 2 + 1, 0, 3, h, 3),
        cyl("main", 2.4, 1.9, 2.4, 3, 2.6, 3, { tip: Math.PI / 2 - 0.05, yaw: 0.8 }),
        box("main", -3, 1.3, 1.8, 1.8, 0.8, 1.4, { yaw: 0.5 }),
      ];
    }
    case "cairn": {
      const h = 10 * s;
      return [
        cone("main", 0, h / 2 + 0.2, 0, 9 * s, h, 9 * s),
        box("main", 4.4 * s, 0.9, 1.3, 2.2, 1.8, 2, { yaw: 0.5 }),
        box("main", -4.2 * s, 0.8, -1, 2, 1.6, 1.8, { yaw: 1.2 }),
        box("main", 0.8, 0.8, 4.2 * s, 2, 1.6, 1.8, { yaw: 2.2 }),
        box("dark", -1, 0.7, -4.4 * s, 1.8, 1.4, 1.6, { yaw: 0.2 }),
        box("dark", 0, h + 0.5, 0, 1.5, 1.2, 1.4, { yaw: 0.9 }),
      ];
    }
    case "heap": {
      const out: MemorialPart[] = [];
      for (let i = 0; i < 5; i++) {
        const h = 3 + 2.2 * s * (0.6 + unit(key, i + 20));
        out.push(
          cone(
            i % 2 ? "dark" : "main",
            (i - 2) * 3.2,
            h / 2 + 0.2,
            unit(key, i + 30) - 0.5,
            4,
            h,
            4,
          ),
        );
      }
      return out;
    }
    case "barrow": {
      const h = 7 * s,
        w = 13 * s,
        out: MemorialPart[] = [cone("main", 0, h / 2 + 0.2, 0, w, h, w)];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 2 * Math.PI + 0.3;
        out.push(
          box("dark", (Math.cos(a) * w) / 2, 0.7, (Math.sin(a) * w) / 2, 1.3, 1.2, 1.1, { yaw: a }),
        );
      }
      return out;
    }
    case "pillar": {
      const out: MemorialPart[] = [];
      let y = 0.3;
      for (let i = 0; i < 6; i++) {
        const h = (2 + 0.9 * unit(key, i + 40)) * s,
          w = (i % 2 ? 2.4 : 3.5) * (1 - i * 0.06) + s * 0.4;
        out.push(cyl(i % 2 ? "dark" : "main", 0, y + h / 2, 0, w, h, w));
        y += h;
      }
      out.push(cone("main", 0, y + 1, 0, 3.2, 2.4, 3.2));
      return out;
    }
    case "reef": {
      const out: MemorialPart[] = [];
      for (let i = 0; i < 4; i++) {
        const h = 3 + 2.6 * s * (0.5 + unit(key, i + 50));
        out.push(cyl("main", (i - 1.5) * 3.8, h / 2 + 0.2, 0, 2.5, h, 2.5));
        out.push(cone("dark", (i - 1.5) * 3.8, h + 0.9, 0, 3.4, 1.8, 3.4));
      }
      return out;
    }
    case "dome": {
      const h = 6 * s;
      return [
        cyl("dark", 0, 0.5, 0, 12, 1, 12),
        cone("main", 0, h / 2 + 1, 0, 11, h, 11),
        cyl("main", 0, h + 1.2, 0, 2.5, 1.6, 2.5),
        cone("dark", 0, h + 2.6, 0, 3.2, 1.6, 3.2),
      ];
    }
  }
}

/** How high a thing raised stands and how far it reaches each way along its front, its own parts'. */
function reachOf(parts: readonly MemorialPart[]): { high: number; wide: number } {
  let high = 1,
    wide = 1;
  for (const p of parts) {
    high = Math.max(high, p.y + p.sy / 2);
    wide = Math.max(wide, Math.abs(p.u) + p.sx / 2);
  }
  return { high, wide };
}

/** How much higher a city raises what it raises: to stand among its towers. */
function cityScale(plan: VillagePlan): number {
  let level = 0;
  for (const r of plan.town?.runs ?? []) if (r[0]! <= 1) level = Math.max(level, r[5] ?? 0);
  return level >= 4 ? 1.75 : level >= 3 ? 1.35 : 1;
}

const PLACED = new WeakMap<VillagePlan, readonly PlacedMemorial[]>();

/** Where a town's stones stand: the greatest on the rim of the square, in the gaps between its bunting's poles, facing its middle. */
export function memorialsPlaced(plan: VillagePlan): readonly PlacedMemorial[] {
  const known = PLACED.get(plan);
  if (known) return known;
  const list = plan.memorials ?? [],
    out: PlacedMemorial[] = [];
  if (list.length) {
    const k = squareScale(plan),
      r = (SQUARE - 2.6) * k,
      big = k * cityScale(plan),
      ground = villageGround(plan),
      stalls = marketScene(plan).stalls,
      // (Where each was set: where it ends up asks what stands here, this among them.)
      wonders = (plan.wonders ?? []).map(wonderAsked),
      taken: { x: number; z: number; wide: number }[] = [],
      rimStep = (2 * Math.PI) / FEAST.poles,
      // (In the gaps between the poles (they stand at half steps); first where it faces the road in, then about.)
      road = Math.atan2(plan.road.z, plan.road.x);
    const slots = Array.from({ length: FEAST.poles * 2 }, (_, i) => {
      const a = i * (rimStep / 2),
        // (Every second slot lies on a pole's line: a little further out, past it, or kept for last.)
        offPole = i % 2 === 0;
      return { a, offPole, near: Math.abs(Math.atan2(Math.sin(a - road), Math.cos(a - road))) };
    }).sort((p, q) => Number(q.offPole) - Number(p.offPole) || p.near - q.near || p.a - q.a);
    [...list]
      .sort((a, b) => b.size - a.size || (a.ref < b.ref ? -1 : 1))
      .forEach((m) => {
        const key = plan.seed ^ (m.year * 2654435761),
          parts = memorialParts(m, key),
          own = reachOf(parts),
          wide = own.wide * k * 0.82;
        // (On the rim; where it is full, a little further in; then closer beside its neighbours: what a town lists, stands.)
        for (const s of [
          ...slots.map((q) => ({ ...q, ring: r, gap: 0.92 })),
          ...slots.map((q) => ({ ...q, ring: r * 0.76, gap: 0.92 })),
          ...slots.map((q) => ({ ...q, ring: r, gap: 0.6 })),
        ]) {
          const x = s.ring * Math.cos(s.a),
            z = s.ring * Math.sin(s.a);
          if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < (t.wide + wide) * s.gap)) continue;
          // (Its breadth runs along the rim, and the stalls stand well in from it: it is only what reaches in toward them that counts.)
          if (stalls.some((q) => Math.hypot(q.x - x, q.z - z) < 3.2 * k + wide * 0.15)) continue;
          if (wonders.some((q) => Math.hypot(q.x - x, q.z - z) < 7 + wide * 0.6)) continue;
          if (!clearOfHall(plan, x, z, wide * 0.7)) continue;
          if (!clearAt(ground, { x, z }, Math.min(4, wide * 0.5))) continue;
          taken.push({ x, z, wide });
          // (Its face toward the middle: a part's front, v up, looks at the square.)
          const yaw = Math.atan2(-x, -z);
          out.push({
            m,
            x,
            z,
            yaw,
            // (Walls keep to the rim; what stands up may rise with the city about it.)
            scale:
              k *
              0.82 *
              (m.form === "wall" || m.form === "reef" || m.form === "heap"
                ? Math.min(big / k, 1.15)
                : big / k),
            high:
              own.high *
              k *
              0.82 *
              (m.form === "wall" || m.form === "reef" || m.form === "heap"
                ? Math.min(big / k, 1.15)
                : big / k),
            wide,
          });
          return;
        }
      });
  }
  PLACED.set(plan, out);
  return out;
}

/** A part at its place in a town (metres): its world position and its turn. */
export function partAt(
  p: PlacedMemorial,
  q: MemorialPart,
): {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  yaw: number;
  tip: number;
} {
  const c = Math.cos(p.yaw),
    s = Math.sin(p.yaw),
    u = q.u * p.scale,
    v = q.v * p.scale;
  return {
    x: p.x + c * u + s * v,
    y: q.y * p.scale,
    z: p.z - s * u + c * v,
    sx: q.sx * p.scale,
    sy: q.sy * p.scale,
    sz: q.sz * p.scale,
    yaw: p.yaw + (q.yaw ?? 0),
    tip: q.tip ?? 0,
  };
}

/** How many parts a town's stones come to. */
export function partsOf(plan: VillagePlan): number {
  return memorialsPlaced(plan).reduce(
    (n, p) => n + memorialParts(p.m, plan.seed ^ (p.m.year * 2654435761)).length,
    0,
  );
}
