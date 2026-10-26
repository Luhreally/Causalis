// This file splits a count over places (Phase 55, M224). A land's men sent to a battle, the ones
// among them who died and the wounded who lived, are shared out over the land's towns and its
// countryside, and the fallen are listed by place. Every split adds up exactly to what it divides,
// and no place is given more than it can hold: a town sends no more people than it has. Ties in
// the largest-remainder split go to the lower index. Nothing here draws random numbers, so the same
// inputs always give the same split.
import { apportion } from "../kernel/index.ts";

/**
 * A tally counts the men a place sent to a battle, the ones among them who died, and the ones who
 * were hurt and lived.
 */
export type Tally = readonly [sent: number, dead: number, hurt: number];

/**
 * A land gives a side one of these in a battle: its cell, the men it sent to the field, their dead,
 * and their hurt who lived. The fifth element, when kept, packs the land's towns (packTowns), a
 * tally for each settlement in founding order. The list of settlements (SettlementStore.inProvince)
 * only grows, so the first n of today's list are the ones there were that day. Trailing all-zero
 * towns are trimmed, and the countryside is the land less its towns. An absent fifth element means
 * the town tallies were let go (a battle older than FELL_TOWN_YEARS, or one before Phase 55), and
 * an empty one means they were kept and no town sent anyone.
 */
export type LandFell = readonly [
  cell: number,
  sent: number,
  dead: number,
  hurt: number,
  towns?: readonly number[],
];

/**
 * A battle's tally has one row for each place: a town, the countryside of a land, or a land
 * whole.
 */
export type FellRow = {
  readonly cell: number;
  /**
   * The town's index among its land's settlements. It is null for the countryside or the land
   * whole.
   */
  readonly town: number | null;
  /** It is true for a land listed whole, its towns' tallies having been let go. */
  readonly whole: boolean;
  readonly sent: number;
  readonly dead: number;
  readonly hurt: number;
};

/**
 * Split a whole number `total` by `weights`, with no part above its cap (Infinity allows any
 * part). An entry whose weight is not positive gets nothing. What a full entry cannot hold is
 * split again among the rest by weight, until all of it is given or every entry is full, so the
 * parts add up to the smaller of total and the most the positive-weight entries can hold. A cap
 * that is not whole is taken at its floor, which keeps every part whole. The two arrays have one
 * entry per part. Throws RangeError unless total is a non-negative integer. It does not throw when
 * no weight is positive; the parts are then all zero.
 */
export function apportionCapped(
  total: number,
  weights: readonly number[],
  caps: readonly number[],
): number[] {
  if (!Number.isInteger(total) || total < 0)
    throw new RangeError(`apportionCapped needs a non-negative integer, got ${total}`);
  const parts = new Array<number>(weights.length).fill(0),
    room = caps.map((cap) => Math.floor(cap));
  // An entry stays open while it has a positive weight and room under its cap, in index order.
  let open: number[] = [];
  for (let i = 0; i < weights.length; i++) if (weights[i]! > 0 && room[i]! > 0) open.push(i);
  let rest = total;
  while (rest > 0 && open.length > 0) {
    const share = apportion(
      rest,
      open.map((i) => weights[i]!),
    );
    for (let k = 0; k < open.length; k++) {
      const i = open[k]!,
        give = Math.min(share[k]!, room[i]! - parts[i]!);
      parts[i] = parts[i]! + give;
      rest -= give;
    }
    open = open.filter((i) => parts[i]! < room[i]!);
  }
  return parts;
}

/**
 * This splits a land's tally over its towns and its countryside. The men sent are split by
 * people: a town takes up to its own people, and what the towns cannot take goes to the
 * countryside, even when the countryside has no weight. The dead are split by the men each place
 * sent, and no place is given more dead than it sent. The hurt are split by the men who came back
 * (sent less dead), and no place is given more hurt than came back. The parts add up exactly to
 * the totals. Throws RangeError if dead is more than sent, or hurt is more than sent less dead.
 */
export function splitTowns(
  totals: Tally,
  people: readonly number[],
  countryside: number,
): { towns: [number, number, number][]; country: [number, number, number] } {
  const [sent, dead, hurt] = totals;
  if (dead > sent) throw new RangeError(`${dead} dead is more than the ${sent} sent`);
  if (hurt > sent - dead)
    throw new RangeError(`${hurt} hurt is more than the ${sent - dead} who came back`);
  const sentParts = apportionCapped(sent, [...people, countryside], [...people, Infinity]),
    last = sentParts.length - 1;
  // What the towns cannot take, the countryside takes, even when its weight is 0.
  const left = sent - sentParts.reduce((n, x) => n + x, 0);
  sentParts[last] = sentParts[last]! + left;
  const deadParts = apportionCapped(dead, sentParts, sentParts),
    came = sentParts.map((s, i) => s - deadParts[i]!),
    hurtParts = apportionCapped(hurt, came, came);
  const tally = (i: number): [number, number, number] => [
    sentParts[i]!,
    deadParts[i]!,
    hurtParts[i]!,
  ];
  const towns: [number, number, number][] = [];
  for (let k = 0; k < people.length; k++) towns.push(tally(k));
  return { towns, country: tally(last) };
}

/**
 * This packs the towns into one flat list, three numbers to a town, and trims the trailing
 * all-zero towns.
 */
export function packTowns(towns: readonly Tally[]): number[] {
  let end = towns.length;
  while (end > 0 && towns[end - 1]!.every((x) => x === 0)) end--;
  const flat: number[] = [];
  for (let k = 0; k < end; k++) flat.push(...towns[k]!);
  return flat;
}

/**
 * This reads back the towns of a flat list made by packTowns: each run of three numbers is one
 * town's tally.
 */
export function unpackTowns(flat: readonly number[]): [number, number, number][] {
  const towns: [number, number, number][] = [];
  for (let k = 0; k + 2 < flat.length; k += 3) towns.push([flat[k]!, flat[k + 1]!, flat[k + 2]!]);
  return towns;
}

/**
 * This lists every place in the lands, land by land in order. A land whose towns were kept gives a
 * row for each town that sent anyone, in founding order, then a row for its countryside if any of
 * its three counts is above zero. A land whose towns were let go gives one row for the whole land.
 */
export function fellRows(lands: readonly LandFell[]): FellRow[] {
  const rows: FellRow[] = [];
  for (const [cell, sent, dead, hurt, towns] of lands) {
    if (towns === undefined) {
      rows.push({ cell, town: null, whole: true, sent, dead, hurt });
      continue;
    }
    const country: [number, number, number] = [sent, dead, hurt];
    const kept = unpackTowns(towns);
    for (let k = 0; k < kept.length; k++) {
      const [s, d, h] = kept[k]!;
      country[0] -= s;
      country[1] -= d;
      country[2] -= h;
      if (s !== 0 || d !== 0 || h !== 0)
        rows.push({ cell, town: k, whole: false, sent: s, dead: d, hurt: h });
    }
    if (country[0] > 0 || country[1] > 0 || country[2] > 0)
      rows.push({
        cell,
        town: null,
        whole: false,
        sent: country[0],
        dead: country[1],
        hurt: country[2],
      });
  }
  return rows;
}

/**
 * This sums the men sent, the dead and the hurt over all the lands. A land's towns are parts of
 * the land, so they are not added a second time.
 */
export function fellTotals(lands: readonly LandFell[]): [number, number, number] {
  const total: [number, number, number] = [0, 0, 0];
  for (const [, sent, dead, hurt] of lands) {
    total[0] += sent;
    total[1] += dead;
    total[2] += hurt;
  }
  return total;
}
