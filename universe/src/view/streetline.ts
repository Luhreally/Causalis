// Whether a wire strung straight between two poles on a town's streets passes over ground the town keeps for something else
// (2026-11-23: the networks' and the signals' wires were strung to the nearest pole as the crow flies, and half of them ran
// through the houses of the block between). A line may not cross a block's own ground (its yards and homes), a stronghold's
// round as drawn, or a place kept (a market place, a temple's steps). Pure; built once a town's plan, then each line asked.
import { BLOCK_LOTS, onHeld, type HoldPlace, type TownLots } from "../bridge/index.ts";

/** Ground kept: its middle, its turn (as a block's: u along, v across), its length along and depth (metres). */
export type KeptGround = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly w: number;
  readonly d: number;
};

/** How far out a stronghold's ground is drawn, of its round (view/strongholds.ts: its lifted ground 2.1 of its radius across). */
export const HELD_DRAWN = 1.05;
/** The cells (metres a side) the kept ground is sorted by. */
const GRID = 40;

/**
 * The town's blocks as drawn, past those burned (`ash` lots) and those yielded to a stronghold (within `pad` of its round),
 * as ground kept.
 */
export function blockGround(
  lots: TownLots,
  blocks: number,
  ash: number,
  held: readonly HoldPlace[],
  pad: number,
  /** Only those whose middle lies within this round (none: all). */
  within?: { readonly x: number; readonly z: number; readonly r: number },
): KeptGround[] {
  const b = lots.blocks,
    { BLOCK_W, BLOCK_D } = lots.m,
    out: KeptGround[] = [];
  for (let k = 0; k < blocks; k++) {
    if (k * BLOCK_LOTS < ash || !(b.x[k]! === b.x[k]!)) continue;
    if (within && Math.hypot(b.x[k]! - within.x, b.z[k]! - within.z) > within.r) continue;
    if (held.length && onHeld(held, b.x[k]!, b.z[k]!, pad)) continue;
    out.push({ x: b.x[k]!, z: b.z[k]!, yaw: b.yaw[k]!, w: BLOCK_W, d: BLOCK_D });
  }
  return out;
}

/**
 * Whether the line from (x0, z0) to (x1, z1) crosses any ground kept, any stronghold's round as drawn, or any other round
 * thing standing (its middle and radius, metres).
 */
export function lineOver(
  kept: readonly KeptGround[],
  held: readonly HoldPlace[],
  others: readonly { readonly x: number; readonly z: number; readonly r: number }[] = [],
): (x0: number, z0: number, x1: number, z1: number) => boolean {
  const rounds = [...held.map((p) => ({ x: p.x, z: p.z, r: p.r * HELD_DRAWN })), ...others],
    cells = new Map<number, number[]>(),
    key = (gx: number, gz: number) => gx * 65536 + gz;
  kept.forEach((k, n) => {
    const r = Math.hypot(k.w, k.d) / 2;
    for (let gx = Math.floor((k.x - r) / GRID); gx <= Math.floor((k.x + r) / GRID); gx++)
      for (let gz = Math.floor((k.z - r) / GRID); gz <= Math.floor((k.z + r) / GRID); gz++) {
        const list = cells.get(key(gx, gz));
        if (list) list.push(n);
        else cells.set(key(gx, gz), [n]);
      }
  });
  return (x0, z0, x1, z1) => {
    const dx = x1 - x0,
      dz = z1 - z0;
    for (const p of rounds) {
      // (The nearest the line comes to its middle.)
      const t = Math.max(
        0,
        Math.min(1, ((p.x - x0) * dx + (p.z - z0) * dz) / (dx * dx + dz * dz || 1)),
      );
      if (Math.hypot(x0 + t * dx - p.x, z0 + t * dz - p.z) < p.r) return true;
    }
    const seen = new Set<number>();
    for (
      let gx = Math.floor(Math.min(x0, x1) / GRID);
      gx <= Math.floor(Math.max(x0, x1) / GRID);
      gx++
    )
      for (
        let gz = Math.floor(Math.min(z0, z1) / GRID);
        gz <= Math.floor(Math.max(z0, z1) / GRID);
        gz++
      )
        for (const n of cells.get(key(gx, gz)) ?? []) {
          if (seen.has(n)) continue;
          seen.add(n);
          if (crosses(kept[n]!, x0, z0, x1, z1)) return true;
        }
    return false;
  };
}

/** Whether a line crosses a turned box's ground: what is left of it clipped to the box's four sides. */
function crosses(k: KeptGround, x0: number, z0: number, x1: number, z1: number): boolean {
  const c = Math.cos(k.yaw),
    s = Math.sin(k.yaw),
    u0 = (x0 - k.x) * c - (z0 - k.z) * s,
    v0 = (x0 - k.x) * s + (z0 - k.z) * c,
    du = (x1 - k.x) * c - (z1 - k.z) * s - u0,
    dv = (x1 - k.x) * s + (z1 - k.z) * c - v0;
  let t0 = 0,
    t1 = 1;
  for (const [p, q] of [
    [-du, u0 + k.w / 2],
    [du, k.w / 2 - u0],
    [-dv, v0 + k.d / 2],
    [dv, k.d / 2 - v0],
  ] as const) {
    if (p === 0) {
      if (q <= 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 >= t1) return false;
  }
  return true;
}
