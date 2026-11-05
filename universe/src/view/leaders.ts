// Lives L1 and L2 as the page reads them: how a realm's wealth is shaded on the map, the four ways it
// is weighed and what each reads as in words, and where a key figure's eye stands in the town they
// live in (from their home's lot and that lot's level). Pure: the same book and plan give the same
// numbers; nothing here is kept.
import {
  lotStates,
  townLots,
  worthWords,
  type VillagePlan,
  type WealthBook,
  type WealthLand,
  type WealthMeasure,
  type WealthRow,
} from "../bridge/index.ts";

export const WEALTH_CHOICES: readonly (readonly [WealthMeasure, string, string])[] = [
  ["head", "🧑", "Wealth a head"],
  ["all", "💰", "Wealth in all"],
  ["made", "⚒️", "What its lands made last year, a head"],
  ["land", "🏘️", "Each land's own stores, a head, whatever its realm"],
];

/** How high a home of each level stands (m): view/town.ts LEVELS' h. */
const HOME_HEIGHT = [2.4, 3.4, 9, 15, 30, 72, 300];

/** The measures of a realm, each a realm's value on it. */
const MEASURED: Readonly<Record<Exclude<WealthMeasure, "land">, (r: WealthRow) => number>> = {
  head: (r) => r.head,
  all: (r) => r.worth,
  made: (r) => r.madeHead,
};

/** The 5th and 95th places of a spread of values, in log10 (both 0 when none is above nothing). */
export function wealthSpread(values: readonly number[]): { lo: number; hi: number } {
  const s = values
    .filter((v) => v > 0)
    .map((v) => Math.log10(v))
    .sort((a, b) => a - b);
  if (s.length === 0) return { lo: 0, hi: 0 };
  return {
    lo: s[Math.floor((s.length - 1) * 0.05)]!,
    hi: s[Math.floor((s.length - 1) * 0.95)]!,
  };
}

/**
 * A value's place on a spread: 0 the poorest, 1 the richest. Nothing (no more than nothing) is 0,
 * and a spread of no width puts every value at 0.5.
 */
function shadeOf(v: number, spread: { lo: number; hi: number }): number {
  if (v <= 0) return 0;
  if (spread.hi <= spread.lo) return 0.5;
  return Math.min(1, Math.max(0, (Math.log10(v) - spread.lo) / (spread.hi - spread.lo)));
}

/** Each land's shade on the map, by cell: 0…1, or -1 for a land of no realm. */
export function wealthShades(book: WealthBook, measure: WealthMeasure): Map<number, number> {
  const shades = new Map<number, number>();
  if (measure === "land") {
    const per = (l: WealthLand): number => l.worth / Math.max(1, l.people),
      spread = wealthSpread(book.lands.map((l) => per(l)));
    for (const l of book.lands) shades.set(l.cell, shadeOf(per(l), spread));
    return shades;
  }
  const value = MEASURED[measure],
    spread = wealthSpread(book.realms.filter((r) => !r.few).map((r) => value(r)));
  for (const l of book.lands) {
    const realm = l.realm < 0 ? undefined : book.realms[l.realm];
    shades.set(l.cell, realm ? shadeOf(value(realm), spread) : -1);
  }
  return shades;
}

/** What the page says of a measure: the least and the greatest realm of those of many people. */
export function wealthNote(book: WealthBook, measure: WealthMeasure): string {
  if (measure === "land") return "Each land's own stores, a head.";
  const rows = book.realms.filter((r) => !r.few),
    first = rows[0];
  if (!first) return "No realm stands yet to weigh.";
  const value = MEASURED[measure];
  let least = first,
    great = first;
  for (const r of rows) {
    if (value(r) < value(least)) least = r;
    if (value(r) > value(great)) great = r;
  }
  const w = worthWords;
  if (measure === "head")
    return `A head: ${w(least.head)} in ${least.short} to ${w(great.head)} in ${great.short}.`;
  if (measure === "all")
    return `In all: ${w(least.worth)} in ${least.short} to ${w(great.worth)} in ${great.short}.`;
  return `Made last year, a head: ${w(least.madeHead)} in ${least.short} to ${w(great.madeHead)} in ${great.short}.`;
}

/**
 * Where a key figure's eye stands for one of a plan's homes: metres from the village's middle,
 * how far back and how steep, and how high the top of the home is. A plan with no such home (none
 * to be had) is looked at from its middle, the square.
 */
export function figureEye(
  plan: Pick<VillagePlan, "town" | "homes">,
  home: number,
): {
  readonly x: number;
  readonly z: number;
  readonly distance: number;
  readonly pitch: number;
  readonly top: number;
} {
  const h = plan.homes[home] ?? { x: 0, z: 0 };
  let level = 1;
  const t = plan.town;
  if (t) {
    const lots = townLots(t.family, t.seed, t.axis, t.lots, t.water),
      states = lotStates(t);
    for (let p = 0; p < lots.x.length; p++) {
      if (lots.x[p] !== h.x || lots.z[p] !== h.z) continue;
      if (states.level[p]! >= 0) level = states.level[p]!;
      break;
    }
  }
  const height = HOME_HEIGHT[level] ?? 3.4;
  return {
    x: h.x,
    z: h.z,
    // (Far enough to see the home in its street: at this the screen is about fifty metres across.)
    distance: Math.max(16, (height + 8) * 0.16),
    pitch: -52,
    top: height + 14,
  };
}
