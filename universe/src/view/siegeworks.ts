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
  /** The bearing of the breach's middle and how wide it is (radians): no length of the walls stands there (null: none). */
  readonly open: { readonly mid: number; readonly wide: number } | null;
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
 * The works of a siege: `arc` is the dry ground about the town at the camp's ring `r` (m from its middle; radians from, and
 * how far round), `wall` how far out its walls' line runs toward a bearing (bridge/wall.ts: the line its walls stand on),
 * `key` the war's. Their bank keeps one distance from the walls all round, as near as the camp's ring lets it come where
 * the walls stand furthest out (out of the walls' reach alike everywhere, the line following the walls' turns); their
 * approaches go in from it as far as the siege has come; what they throw with stands at the approaches' heads.
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
    whole = arc.span >= 2 * Math.PI - 1e-6;
  // (How far out the bank stands from the walls: the camp's ring less where the walls reach furthest over the dry ground.)
  let most = 0;
  for (let k = 0; k <= 48; k++) most = Math.max(most, wall(arc.from + (k / 48) * arc.span));
  const standoff = Math.max(24, r - most),
    bankAt = (a: number) => wall(a) + standoff,
    // (The bank's length round the dry ground, by the line it follows.)
    pointAt = (a: number) => ({ x: Math.cos(a) * bankAt(a), z: Math.sin(a) * bankAt(a) });
  let long = 0;
  for (let k = 0; k < 48; k++) {
    const p = pointAt(arc.from + (k / 48) * arc.span),
      q = pointAt(arc.from + ((k + 1) / 48) * arc.span);
    long += Math.hypot(q.x - p.x, q.z - p.z);
  }
  const n = Math.max(3, Math.min(W.banks, Math.floor(long / (W.bank + W.gap)))),
    step = arc.span / n;
  // The bank: lengths of it round the dry ground, each lying along the walls' line at its standoff.
  for (let i = 0; i < n; i++) {
    const a = arc.from + (i + 0.5) * step,
      out = bankAt(a) + (unit(key + 11, i) - 0.5) * 3,
      p = pointAt(a - step / 2),
      q = pointAt(a + step / 2);
    banks.push({
      x: Math.cos(a) * out,
      z: Math.sin(a) * out,
      // (Along the line it follows, from one end of its stretch to the other.)
      yaw: Math.atan2(q.x - p.x, q.z - p.z),
      long: Math.max(3, Math.min(W.bank, Math.hypot(q.x - p.x, q.z - p.z) - W.gap)),
    });
  }
  // The middle of the approach the walls are thrown at: the middle of the dry ground.
  const mid = arc.from + arc.span / 2 + (whole ? unit(key, 3) * 2 * Math.PI : 0),
    // (Their approaches go in further each year the siege has stood, and as the walls open.)
    reached = Math.min(0.85, 0.3 + 0.2 * state.years + 0.35 * state.breach),
    // (The open ground between their bank and the walls, where each approach goes in.)
    room = Math.max(0, standoff - 8),
    legs = W.saps / 3,
    // (Each leg at least seven metres; as long as the ground the siege has come over asks, in as many legs as are drawn.)
    leg = Math.max(7, (room * reached) / legs),
    count = Math.min(legs, Math.max(1, Math.round((room * reached) / leg)));
  for (const way of [-1, 0, 1]) {
    let a = mid + way * Math.min(0.5, arc.span / 6),
      at = bankAt(a) - 2;
    for (let k = 0; k < count; k++) {
      // A leg of it: nearer the walls, slanting across the way in so no shot from the walls runs along it.
      const slant = k % 2 ? 1 : -1,
        in1 = at - leg,
        a1 = a + (slant * leg * 0.7) / Math.max(20, in1),
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
  // What they throw with: at the approaches' heads, a little behind them, facing the walls.
  const off = Math.max(14, room * (1 - reached) + 12);
  for (let i = 0; i < W.engines; i++) {
    const a = mid + ((i + 0.5) / W.engines - 0.5) * Math.min(1.1, arc.span * 0.5),
      // (Never behind their own bank.)
      stand = Math.min(wall(a) + off, Math.max(wall(a) + 6, bankAt(a) - 4));
    engines.push({
      x: Math.cos(a) * stand,
      z: Math.sin(a) * stand,
      yaw: Math.atan2(-Math.cos(a), -Math.sin(a)),
    });
  }
  // Its walls where they are open: so much of their line before the approaches lies as rubble, and none of it stands there.
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
    open: heaps ? { mid, wide } : null,
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
