// The aftermath of a heavy blow, drawn from the hit's own key and time. No particles are
// simulated or kept: rewinding and replaying give the same drops, fragments and loose parts.
import type { BattleNow } from "./battle.ts";
import type { Gore } from "./blows.ts";

export const GORE_MOST = 192;
export type GorePiece = {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly r: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly bone: boolean;
};

const unit = (id: number, n: number): number => {
  let h = Math.imul(id ^ 0x51ed27, 0x85ebca6b) ^ Math.imul(n + 17, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  return ((h ^ (h >>> 15)) >>> 0) / 0x1_0000_0000;
};

/** A severed part flies, bounces once, slides a little, then lies still. Metres and seconds. */
export function looseMotion(
  x: number,
  z: number,
  toX: number,
  toZ: number,
  age: number,
  flight: number,
  arc: number,
  yaw: number,
  spin: number,
): { x: number; y: number; z: number; yaw: number; pitch: number } {
  const f = Math.max(0, Math.min(1, age / Math.max(0.01, flight)));
  const after = Math.max(0, age - flight);
  const bounce = Math.min(1, after / 0.45);
  const slide = 1 + 0.18 * (1 - (1 - bounce) ** 2);
  return {
    x: x + (toX - x) * (f < 1 ? f : slide),
    z: z + (toZ - z) * (f < 1 ? f : slide),
    y: f < 1 ? arc * 4 * f * (1 - f) : 0.13 * 4 * bounce * (1 - bounce),
    yaw,
    pitch: Math.PI / 2 + (f < 1 ? spin * (f - 1) : Math.sin(bounce * Math.PI) * 0.35),
  };
}

/** Tissue and small bone fragments from a severing or a blast, bounded across the whole field. */
export function gorePieces(
  id: number,
  x: number,
  z: number,
  age: number,
  blast: boolean,
  out: GorePiece[],
): void {
  if (age < 0 || age > 28 || out.length >= GORE_MOST) return;
  for (let j = 0; j < (blast ? 5 : 3) && out.length < GORE_MOST; j++) {
    const a = unit(id, j * 7) * 2 * Math.PI;
    const speed = (0.7 + 2 * unit(id, j * 7 + 1)) * (blast ? 1.8 : 1);
    const up = 1.6 + 2 * unit(id, j * 7 + 2);
    const landing = (up + Math.sqrt(up * up + 2 * 9.8 * 1.1)) / 9.8;
    const t = Math.min(age, landing);
    out.push({
      id,
      x: x + Math.sin(a) * speed * t,
      z: z + Math.cos(a) * speed * t,
      y: Math.max(0, 1.1 + up * t - 4.9 * t * t),
      r: 0.065 + unit(id, j * 7 + 3) * (blast ? 0.1 : 0.065),
      yaw: a,
      pitch: age < landing ? t * (6 + 8 * unit(id, j * 7 + 4)) : Math.PI / 2,
      bone: j === 0,
    });
  }
}

/** Apply the viewer's setting after a live or cached fight, without changing its bodies or results. */
export function goreAt(now: BattleNow, gore: Gore): BattleNow {
  if (gore === "full") return now;
  return {
    ...now,
    troopers: now.troopers.map((t) => {
      const { lost: _lost, ...whole } = t;
      return whole;
    }),
    blood:
      gore === "none"
        ? []
        : now.blood.filter((_, i) => i % 2 === 0).map((b) => ({ ...b, r: b.r * 0.6 })),
    wounds:
      gore === "none"
        ? []
        : (now.wounds ?? [])
            .filter((w) => w.mark !== "stump")
            .map((w) => ({ ...w, size: w.size * 0.6, bleed: w.bleed * 0.6, spray: 0 })),
    stuck: gore === "none" ? [] : now.stuck,
    limbs: [],
    gibs: [],
    spray: [],
  };
}
