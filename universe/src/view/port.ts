// A colony's port (Phase 71, first slice), laid out from what history holds of it: as many pads as its runs want, its yards stacked
// with what has come in, its craft in the colours of those who run them, each coming down on its flame, standing, and going up again.
// One unit is ten metres, as in the town. A busy port is one with few pads empty; a port whose runs have ended stands cold, with
// nothing on its pads and its stacks left where they stood. Pure: the same plan and moment, the same port.
import type { PortPlan } from "../bridge/index.ts";

/** The room a port takes beyond its town (units). */
export const PORT_ROOM = 54;
/** How far apart its pads stand, and how wide a pad is (units). */
const PAD_GAP = 14;
const PAD_R = 5;

const hash = (seed: number, i: number, k: number): number => {
  const s = Math.sin(seed * 12.9898 + i * 78.233 + k * 37.719) * 43758.5453;
  return s - Math.floor(s);
};

export type PortBox = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
  readonly h: number;
  readonly d: number;
  readonly tone: number;
};

export type PortLayout = {
  /** Its middle (units, from the town's), and the way its rows run. */
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly width: number;
  readonly depth: number;
  readonly pads: readonly { readonly x: number; readonly z: number; readonly r: number }[];
  readonly sheds: readonly PortBox[];
  readonly crates: readonly PortBox[];
  readonly paint: readonly PortBox[];
  readonly tower: { readonly x: number; readonly z: number };
};

/** Where things stand in the port, from its own middle. */
export function portLayout(plan: PortPlan, seed: number, flat: number): PortLayout {
  const way = hash(seed, 1, 3) * 2 * Math.PI,
    out = Math.min(flat + PORT_ROOM * 0.56, 352),
    rows = Math.max(1, Math.ceil(plan.pads / 3)),
    cols = Math.min(3, Math.max(plan.pads, 1)),
    width = Math.max(30, cols * PAD_GAP + 8),
    depth = rows * PAD_GAP + 22,
    pads: { x: number; z: number; r: number }[] = [];
  for (let i = 0; i < plan.pads; i++) {
    const col = i % 3,
      row = Math.floor(i / 3);
    pads.push({
      x: (col - (cols - 1) / 2) * PAD_GAP,
      z: -depth / 2 + 6 + PAD_R + row * PAD_GAP,
      r: PAD_R,
    });
  }
  // Its sheds along its back; its yard in front of them, as high as what has come in.
  const backZ = depth / 2 - 5.5,
    sheds: PortBox[] = [];
  for (let i = 0; i < plan.sheds; i++)
    sheds.push({
      x: (i - (plan.sheds - 1) / 2) * 11,
      y: 2 + (i % 2) * 0.4,
      z: backZ,
      w: 9.6,
      h: 4 + (i % 2) * 0.8,
      d: 8,
      tone: i,
    });
  const crates: PortBox[] = [];
  for (let i = 0; i < plan.stacks; i++) {
    const c = i % 72,
      layer = Math.floor(i / 72),
      col = c % 18,
      row = Math.floor(c / 18);
    crates.push({
      x: (col - 8.5) * 1.5 + 0.1 * (hash(seed, i, 8) - 0.5),
      y: 0.42 + layer * 0.8,
      z: backZ - 5.4 - row * 2.5,
      w: 1.3,
      h: 0.76,
      d: 2.2,
      tone: Math.floor(hash(seed, c, 9) * 3),
    });
  }
  // What is painted on its apron: its lanes, wide enough to read from up high.
  const paint: PortBox[] = pads.flatMap((p) => [
    { x: p.x, y: 0.2, z: p.z, w: 0.36, h: 0.02, d: 2 * PAD_R * 0.86, tone: 0 },
    { x: p.x, y: 0.2, z: p.z, w: 2 * PAD_R * 0.86, h: 0.02, d: 0.36, tone: 0 },
  ]);
  return {
    x: Math.cos(way) * out,
    z: Math.sin(way) * out,
    yaw: -way + Math.PI / 2,
    width,
    depth,
    pads,
    sheds,
    crates,
    paint,
    tower: { x: width / 2 - 2.5, z: -depth / 2 + 3 },
  };
}

/** A craft at a pad at a moment: how high, how hard it burns, who it is (null: the pad stands empty). */
export type CraftNow = {
  readonly caller: number;
  readonly high: number;
  readonly burn: number;
};

const FALL = 7,
  LIFT = 7;

/**
 * Pad `i`'s craft at `wall` seconds. Each pad keeps its own round: down, standing to unload, up, and a wait for the next. A busier port
 * waits less, so that more pads hold a ship at any moment; a port whose runs have ended has none.
 */
export function craftAt(plan: PortPlan, i: number, wall: number): CraftNow | null {
  if (plan.quiet || !plan.callers.length) return null;
  const stand = 26 + 18 * hash(9, i, 1),
    wait = Math.max(3, 60 / Math.max(1, plan.busy)) * (0.7 + 0.6 * hash(9, i, 2)),
    round = FALL + stand + LIFT + wait,
    off = hash(9, i, 3) * round,
    n = Math.floor((wall + off) / round),
    at = (wall + off) % round,
    caller = plan.callers[(i + n) % plan.callers.length]!;
  if (at > FALL + stand + LIFT) return null;
  const who = plan.callers.indexOf(caller);
  if (at < FALL) {
    const k = 1 - at / FALL;
    return { caller: who, high: 60 * k * k, burn: 0.45 + 0.55 * (1 - k) };
  }
  if (at < FALL + stand) return { caller: who, high: 0, burn: 0 };
  const k = (at - FALL - stand) / LIFT;
  return { caller: who, high: 60 * k * k, burn: 0.6 + 0.4 * k };
}

/** A cart between a pad and the sheds at a moment, along the apron (from the port's middle). */
export function portCartAt(
  layout: PortLayout,
  i: number,
  wall: number,
): { readonly x: number; readonly z: number; readonly yaw: number } {
  const pad = layout.pads[i % Math.max(1, layout.pads.length)] ?? { x: 0, z: 0 },
    backZ = layout.depth / 2 - 10,
    run = (wall * (0.05 + 0.03 * hash(5, i, 1)) + hash(5, i, 2)) % 1,
    k = run < 0.5 ? run * 2 : 2 - run * 2,
    lane = (hash(5, i, 3) - 0.5) * 3;
  return {
    x: pad.x + lane,
    z: pad.z + (backZ - pad.z) * k,
    yaw: run < 0.5 ? 0 : Math.PI,
  };
}
