// A siege's works about a town (2026-11-19, the audit's "a siege is a number"): pure arithmetic from the siege the world keeps
// (sim/war/siege.ts: since when, months of stores left, how far its walls are open, its dead). The besiegers' line is a
// bank of earth about the town on its dry approaches, between their tents and its walls; their approaches go in from it
// toward the walls, further each year the siege has stood; what they throw with stands behind the approaches (guns where
// they fight with them, else engines); and where the walls are open, as much of them lies as rubble as history has open.
// Nothing here is history: where each bank lies is the eye's, keyed by the war, the same each time it is seen.

/** A siege as the world keeps it, for a town at war. */
export type SiegeState = {
  readonly since: number;
  /** Months of food left within. */
  readonly months: number;
  /** How far its walls are open, 0 … 1. */
  readonly breach: number;
  /** The dead of camp and town. */
  readonly dead: number;
  /** Years it has stood. */
  readonly years: number;
};

type Flat = { readonly x: number; readonly z: number };
export type SiegeWorks = {
  readonly state: SiegeState;
  /** Lengths of the besiegers' bank, and of their approaches: where (m), which way they run (rad), how long. */
  readonly banks: readonly (Flat & { readonly yaw: number; readonly long: number })[];
  readonly saps: readonly (Flat & { readonly yaw: number; readonly long: number })[];
  /** What they throw at the walls with: where, facing the town; guns or engines. */
  readonly engines: readonly (Flat & { readonly yaw: number })[];
  readonly guns: boolean;
  /** The walls' rubble where they are open: where, how great a heap (m). */
  readonly rubble: readonly (Flat & { readonly size: number; readonly yaw: number })[];
  /** The middle of the open length of wall (null: its walls stand whole). */
  readonly breachAt: Flat | null;
};

const unit = (a: number, b: number) => {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/** How long a length of bank is, the gap between two, and the most of each thing drawn. */
export const SIEGE_WORKS = {
  bank: 11,
  gap: 4,
  banks: 40,
  saps: 30,
  engines: 6,
  rubble: 14,
} as const;

/**
 * The works of a siege: `arc` is the dry ground about the town at the bank's ring `r` (m from its middle; radians from, and
 * how far round), `wall` how far out its walls' line runs toward a bearing (bridge/wall.ts: the line its walls stand on),
 * `key` the war's.
 */
export function siegeWorks(
  key: number,
  arc: { readonly from: number; readonly span: number },
  r: number,
  wall: (a: number) => number,
  state: SiegeState,
  guns: boolean,
): SiegeWorks {
  const W = SIEGE_WORKS,
    banks: (Flat & { yaw: number; long: number })[] = [],
    saps: (Flat & { yaw: number; long: number })[] = [],
    engines: (Flat & { yaw: number })[] = [],
    rubble: (Flat & { size: number; yaw: number })[] = [],
    whole = arc.span >= 2 * Math.PI - 1e-6,
    n = Math.max(3, Math.min(W.banks, Math.floor((arc.span * r) / (W.bank + W.gap)))),
    step = arc.span / n;
  // The bank: lengths of it round the dry ground, each lying along the ring.
  for (let i = 0; i < n; i++) {
    const a = arc.from + (i + 0.5) * step,
      out = r + (unit(key + 11, i) - 0.5) * 3;
    banks.push({
      x: Math.cos(a) * out,
      z: Math.sin(a) * out,
      // (Along the ring: square to the way out from the town.)
      yaw: Math.atan2(-Math.sin(a), Math.cos(a)),
      long: Math.max(3, Math.min(W.bank, step * r - W.gap)),
    });
  }
  // The middle of the approach the walls are thrown at: the middle of the dry ground.
  const mid = arc.from + arc.span / 2 + (whole ? unit(key, 3) * 2 * Math.PI : 0),
    // (Their approaches go in further each year the siege has stood, and as the walls open.)
    reached = Math.min(0.85, 0.3 + 0.2 * state.years + 0.35 * state.breach),
    // (The open ground between their bank and the walls, where each approach goes in.)
    roomAt = (a: number) => Math.max(0, r - wall(a) - 6),
    room = roomAt(mid);
  for (const way of [-1, 0, 1]) {
    let at = r - 2,
      a = mid + way * Math.min(0.5, arc.span / 6);
    const legs = Math.min(W.saps / 3, Math.max(1, Math.round((roomAt(a) * reached) / 7)));
    for (let k = 0; k < legs; k++) {
      // A leg of it: seven metres nearer, slanting across the way in so no shot from the walls runs along it.
      const slant = k % 2 ? 1 : -1,
        in1 = at - 7,
        a1 = a + (slant * 5) / Math.max(20, in1),
        x0 = Math.cos(a) * at,
        z0 = Math.sin(a) * at,
        x1 = Math.cos(a1) * in1,
        z1 = Math.sin(a1) * in1;
      saps.push({
        x: (x0 + x1) / 2,
        z: (z0 + z1) / 2,
        yaw: Math.atan2(x1 - x0, z1 - z0),
        long: Math.hypot(x1 - x0, z1 - z0) + 0.6,
      });
      at = in1;
      a = a1;
    }
  }
  // What they throw with: behind the approaches' heads, facing the walls.
  const off = Math.max(14, room * (1 - reached) + 10);
  for (let i = 0; i < W.engines; i++) {
    const a = mid + ((i + 0.5) / W.engines - 0.5) * Math.min(1.1, arc.span * 0.5),
      // (Never behind their own bank.)
      stand = Math.min(wall(a) + off, Math.max(wall(a) + 6, r - 4));
    engines.push({
      x: Math.cos(a) * stand,
      z: Math.sin(a) * stand,
      yaw: Math.atan2(-Math.cos(a), -Math.sin(a)),
    });
  }
  // Its walls where they are open: so much of their ring before the approaches lies as rubble.
  const open = Math.max(0, Math.min(1, state.breach)),
    heaps = Math.round(open * W.rubble),
    wide = (open * 46) / Math.max(20, wall(mid));
  for (let i = 0; i < heaps; i++) {
    const a = mid + ((i + 0.5) / heaps - 0.5) * wide,
      out = wall(a) + (unit(key + 23, i) - 0.35) * 3.4;
    rubble.push({
      x: Math.cos(a) * out,
      z: Math.sin(a) * out,
      size: 1.6 + 1.8 * unit(key + 29, i),
      yaw: unit(key + 31, i) * Math.PI,
    });
  }
  return {
    state,
    banks,
    saps,
    engines,
    guns,
    rubble,
    breachAt: heaps ? { x: Math.cos(mid) * wall(mid), z: Math.sin(mid) * wall(mid) } : null,
  };
}

/** A siege in words, for the line a town at war is told by. */
export function siegeWords(s: SiegeState): string {
  const stores =
      s.months <= 0
        ? "its stores gone"
        : `${s.months} ${s.months === 1 ? "month" : "months"} of stores left`,
    walls =
      s.breach >= 0.995
        ? "its walls open"
        : s.breach > 0.005
          ? `its walls ${Math.round(s.breach * 100)}% open`
          : "its walls whole";
  return `besieged since year ${s.since}: ${stores}, ${walls}${s.dead > 0 ? `, ${s.dead.toLocaleString("en-US")} dead of it in camp and town` : ""}`;
}
