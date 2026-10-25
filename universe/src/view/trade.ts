// The road's trade (Phase 48 M210; asked for 2026-10-25: "...work on bringing back og causlisis
// like town/country game play and sim like the depth the og game had ... and just actions of stuff
// yk"): a town's traders take its land's goods down the road to the lands it trades with, and
// bring back what those lands send it — what, and with whom, by its land's trade last year (the
// plan's `trade`, its share of it). A trader loads at the store the goods are kept in of a morning,
// sets out along the road, is away a night or two, and comes back of an afternoon to unload what
// they bring at the store it goes to. Pure: the same town, trader and day, the same trip, wherever
// it is looked at from.
import type { TradeGood, VillagePlan } from "../bridge/index.ts";
import { OCC } from "../rules/index.ts";
import { hashText, unitOf } from "./draws.ts";
import { marketDay } from "./feast.ts";
import { restDay } from "./seasons.ts";

/** How many days from one setting out to the next, by the trader (one of these). */
const ROUND = [5, 6, 7, 8] as const;
/** When a trader sets out of a morning (hours), and between when they come back. */
export const SET_OUT = 7.4;
export const COME_BACK: readonly [number, number] = [13.5, 16];

/** A trader's trip down the road and back. */
export type Trip = {
  /** The days it sets out and comes back (days since the world began). */
  readonly out: number;
  readonly back: number;
  /** The town of the land it goes to (its market town, or its greatest). */
  readonly land: string;
  /** What they take there, and what they bring back (null: nothing that way). */
  readonly take: TradeGood | null;
  readonly bring: TradeGood | null;
  /** When they come in on the day they come back (seconds into the day). */
  readonly home: number;
};

const SEATS = new WeakMap<VillagePlan, Map<number, number>>();

/** Which of the town's traders a person is (in the plan's order), or -1: none. */
export function traderSeat(plan: VillagePlan, index: number): number {
  let seats = SEATS.get(plan);
  if (!seats) {
    seats = new Map();
    let n = 0;
    plan.people.forEach((p, i) => {
      if (p.occupation === OCC.trader && !p.child) seats!.set(i, n++);
    });
    SEATS.set(plan, seats);
  }
  return seats.get(index) ?? -1;
}

/** One of `xs` picked by `u` (0 … 1), the more of it the likelier. */
function pick<T extends { readonly count: number }>(xs: readonly T[], u: number): T | null {
  const all = xs.reduce((a, x) => a + x.count, 0);
  if (all <= 0) return null;
  let left = u * all;
  for (const x of xs) if ((left -= x.count) < 0) return x;
  return xs.at(-1) ?? null;
}

/**
 * The trip the seat-th of a town's traders is on, a day, and how far into it — setting out,
 * away the whole day, or coming back — or null on a day they are at home. A trader sets out once a
 * round (never on a day of rest or a market day: then they stay), with the land picked by the
 * town's trade, the more it sends there or brings from there the likelier.
 */
export function tripOn(
  plan: VillagePlan,
  seat: number,
  day: number,
): { readonly trip: Trip; readonly part: "out" | "away" | "back" } | null {
  const trade = plan.trade;
  if (seat < 0 || !trade || (!trade.out.length && !trade.in.length)) return null;
  const key = hashText(`trader ${plan.ref} ${seat}`),
    round = ROUND[key % ROUND.length]!,
    off = (key >>> 3) % round,
    n = Math.floor((day + off) / round),
    out = n * round - off + 1;
  if (day < out || restDay(plan, out) || marketDay(plan, out)) return null;
  const away = unitOf(key, n, 1) < 0.5 ? 1 : 2,
    back = out + away;
  if (day > back) return null;
  // (The land: by all that goes there and comes from there.)
  const lands = new Map<string, number>();
  for (const g of [...trade.out, ...trade.in])
    lands.set(g.land, (lands.get(g.land) ?? 0) + g.count);
  const land = pick(
    [...lands].map(([land, count]) => ({ land, count })),
    unitOf(key, n, 2),
  )!.land;
  const trip: Trip = {
    out,
    back,
    land,
    take: pick(
      trade.out.filter((g) => g.land === land),
      unitOf(key, n, 3),
    ),
    bring: pick(
      trade.in.filter((g) => g.land === land),
      unitOf(key, n, 4),
    ),
    home: (COME_BACK[0] + (COME_BACK[1] - COME_BACK[0]) * unitOf(key, n, 5)) * 3600,
  };
  return { trip, part: day === out ? "out" : day === back ? "back" : "away" };
}

/** Which of the town's stores a good is kept in. */
export function storeOfGood(good: string): "granary" | "smithy" | "yard" {
  return good === "grain" || good === "meat" || good === "wild"
    ? "granary"
    : good === "copper" || good === "coal" || good === "tools" || good === "machines"
      ? "smithy"
      : "yard";
}
