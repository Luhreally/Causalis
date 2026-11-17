// What the ledger's world-wide tables share (asked 2026-11-16: "add the underworld to ledger and whatever else is relevant"): the
// living realms by their people, read once a page build and handed to every tab; the honest line a tab shows where its system has
// kept nothing yet; the "most / least" line under a table; the totals over it; and the bound on how many rows a table lists. Pure
// reads: nothing here is reckoned anew or set down.
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, Line, Span, Stat } from "../../bridge/index.ts";
import { politiesOf, populationContext, type Polity } from "../../sim/index.ts";
import { count, yearNow } from "./words.ts";

/** What every tab of the ledger reads of the realms, once a page build. */
export type LedgerCtx = {
  readonly now: number;
  /** The realms standing, their most peopled first. */
  readonly standing: readonly Polity[];
  /** Each standing realm's people (of the lands it holds now). */
  readonly people: ReadonlyMap<string, number>;
  /** A land's people. */
  readonly peopleOf: (cell: number) => number;
};

/** The ledger's reading of the realms, once a page build. */
export function ledgerCtx(world: World): LedgerCtx {
  const ctx = populationContext(world),
    peopleOf = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    standing = politiesOf(world)
      .all()
      .filter((r) => r.ended === null),
    people = new Map(standing.map((r) => [r.ref, r.members.reduce((n, c) => n + peopleOf(c), 0)]));
  return {
    now: yearNow(world),
    standing: [...standing].sort(
      (a, b) => people.get(b.ref)! - people.get(a.ref)! || (a.ref < b.ref ? -1 : 1),
    ),
    people,
    peopleOf,
  };
}

/** The most rows one of the ledger's new tables lists (its greatest first); the rest are counted under it. */
export const LEDGER_ROWS = 120;

/** What a tab shows where its system has kept nothing yet: one honest line. */
export function honest(words: string): Block[] {
  return [{ type: "text", lines: [[words]] }];
}

/** "The 120 greatest groups of 300 are listed." where a table lists fewer than there are. */
export function listedOf(shown: number, all: number, what: string): Block[] {
  return all > shown
    ? [{ type: "text", lines: [[`The ${count(shown)} ${what} of ${count(all)} are listed.`]] }]
    : [];
}

/** One row's name and its measure, for the "most / least" line. */
export type Ranked = { readonly name: Span; readonly value: number; readonly said: string };

/**
 * The line under a table: which row holds the most of a measure and which the least ("Most smuggled: Avalor (34%) · least:
 * Brin (2%)"). None where fewer than two rows hold a number, or all hold the same.
 */
export function mostLeast(label: string, rows: readonly Ranked[]): Line | null {
  const held = rows.filter((r) => Number.isFinite(r.value));
  if (held.length < 2) return null;
  let most = held[0]!,
    least = held[0]!;
  for (const r of held) {
    if (r.value > most.value) most = r;
    if (r.value < least.value) least = r;
  }
  if (most.value === least.value) return null;
  return [`${label}: `, most.name, ` (${most.said}) · least: `, least.name, ` (${least.said})`];
}

/** The "most / least" lines of a table, as one block (none where no line holds). */
export function mostLeastBlock(lines: readonly (Line | null)[]): Block[] {
  const held = lines.filter((l): l is Line => l !== null);
  return held.length ? [{ type: "text", title: "Most and least", lines: held }] : [];
}

/** A table's totals, as facts over it. */
export function allTold(rows: readonly Stat[], title = "All told"): Block {
  return { type: "facts", title, rows };
}

/** A share as a percentage, to a tenth where it is small ("0.4%", "12%"; "under 0.1%" for a sliver). */
export function pct(x: number): string {
  return x > 0 && x < 0.001
    ? "under 0.1%"
    : x < 0.1
      ? `${+(x * 100).toFixed(1)}%`
      : `${Math.round(x * 100)}%`;
}

/** A share kept in thousandths, as a percentage. */
export const per = (thousandths: number): string => pct(thousandths / 1000);

/** A realm's people-weighted mean of a reading its lands keep (null where none of its lands keeps one). */
export function realmMean(
  lc: LedgerCtx,
  r: Polity,
  read: (cell: number) => number | null | undefined,
): number | null {
  let people = 0,
    sum = 0;
  for (const c of r.members) {
    const v = read(c),
      n = lc.peopleOf(c);
    if (v === null || v === undefined || !n) continue;
    people += n;
    sum += n * v;
  }
  return people > 0 ? sum / people : null;
}

/** A standing realm by its ref (undefined: gone or never). */
export function standingRealm(world: World, ref: Ref | string): Polity | undefined {
  const r = politiesOf(world).get(ref as Ref);
  return r && r.ended === null ? r : undefined;
}

/** The ledger's reading of some realms only (an alliance's members, say), their most peopled first: every tab reads them alone. */
export function ledgerCtxOf(world: World, refs: readonly string[]): LedgerCtx {
  const all = ledgerCtx(world),
    keep = new Set(refs);
  return { ...all, standing: all.standing.filter((r) => keep.has(r.ref)) };
}
