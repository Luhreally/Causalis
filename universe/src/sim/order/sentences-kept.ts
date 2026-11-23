// What the world keeps of those its courts sentence and hold (sim/order/sentences.ts; the rules are rules/sentences.ts), and what the
// older systems read of it. One row a land a court holds: those it holds now (in its prison and at its works), the mean of their
// terms, those of its gangs' young held, and its last two reckonings of sentences, each a year's rate of its people (a million);
// and of each land, the years its court put any to death, kept as long as a town's people are read back (host/roster.ts), so who
// died of it in a year gone by does not change. Bounded by the lands a world has and the years kept. This file reaches only the
// kernel and the rules, so any system can read it.
import { Hasher, type StateStore, type World } from "../../kernel/index.ts";
import { SENTENCE } from "../../rules/index.ts";

/** A land's row: those held now, of them at labour, their mean term (tenths of a year), its gangs' young held this year, the share of those brought held. */
export const SENT_ROW = {
  inside: 0,
  labour: 1,
  term: 2,
  gangHeld: 3,
  gangShare: 4,
  /** The year its last reckoning runs to. */
  until: 5,
} as const;
/** Each year kept: its year, and a million of its people brought, fined, held, put to labour, put to death, found not guilty. */
export const SENT_YEAR = {
  year: 0,
  brought: 1,
  fined: 2,
  held: 3,
  labour: 4,
  death: 5,
  acquitted: 6,
} as const;
// (Its last two reckonings, each its first year and a year's rates.)
const HEAD = 6,
  YEAR_W = 7,
  NONE = -1e9;
export const SENT_WIDTH = HEAD + YEAR_W * 2;

/** A land's year of sentences, read back: rates of its people (a million). */
export type SentYear = {
  readonly year: number;
  readonly brought: number;
  readonly fined: number;
  readonly held: number;
  readonly labour: number;
  readonly death: number;
  readonly acquitted: number;
};

export const SENTENCES_STORE = "order.sentences";

export class SentencesStore implements StateStore {
  readonly name = SENTENCES_STORE;
  private readonly rows = new Map<number, number[]>();
  /** A land's years with any put to death: [year, a million of its people] one after another, the eldest first. */
  private readonly dead = new Map<number, number[]>();
  private digest = "";
  /** What its years did since the world was loaded, for a probe's count (world totals, heads). Never saved. */
  readonly tally = { brought: 0, fined: 0, held: 0, labour: 0, death: 0, acquitted: 0 };

  dormant(): boolean {
    return this.rows.size === 0 && this.digest === "";
  }
  row(cell: number): readonly number[] | undefined {
    return this.rows.get(cell);
  }
  /** A land's row to write (made where it has none). */
  ensure(cell: number): number[] {
    let r = this.rows.get(cell);
    if (!r) {
      this.rows.set(cell, (r = new Array<number>(SENT_WIDTH).fill(0)));
      // (No reckoning yet in either slot.)
      r[HEAD + SENT_YEAR.year] = NONE;
      r[HEAD + YEAR_W + SENT_YEAR.year] = NONE;
    }
    return r;
  }
  drop(cell: number): void {
    this.rows.delete(cell);
  }
  cells(): number[] {
    return [...this.rows.keys()].sort((a, b) => a - b);
  }
  /** Each land's row, in no set order (for work whose result does not hang on the order: each row its own). */
  eachRow(fn: (cell: number, row: number[]) => void): void {
    for (const [c, r] of this.rows) fn(c, r);
  }
  /** A land's reckoning of `span` years from y.year, each a year as y (the one before it kept as the last), and its dead where any. */
  noteSpan(cell: number, span: number, y: SentYear): void {
    const r = this.ensure(cell),
      at = HEAD;
    // (The one before it is kept as the last.)
    for (let i = 0; i < YEAR_W; i++) r[HEAD + YEAR_W + i] = r[HEAD + i]!;
    r[SENT_ROW.until] = y.year + span;
    r[at + SENT_YEAR.year] = y.year;
    r[at + SENT_YEAR.brought] = Math.round(y.brought);
    r[at + SENT_YEAR.fined] = Math.round(y.fined);
    r[at + SENT_YEAR.held] = Math.round(y.held);
    r[at + SENT_YEAR.labour] = Math.round(y.labour);
    r[at + SENT_YEAR.death] = Math.round(y.death);
    r[at + SENT_YEAR.acquitted] = Math.round(y.acquitted);
    if (Math.round(y.death) > 0) {
      let d = this.dead.get(cell);
      if (!d) this.dead.set(cell, (d = []));
      d.push(y.year, Math.round(y.death));
      while (d.length && d[0]! + SENTENCE.every <= y.year - SENTENCE.deadKept) d.splice(0, 2);
    }
  }
  /** A land's year as kept (null: not of its last two reckonings, or none sentenced). */
  yearOf(cell: number, year: number): SentYear | null {
    const r = this.rows.get(cell);
    if (!r) return null;
    // (Its last reckoning runs from its year to the row's `until`; the one before it to the last's year.)
    const last = r[HEAD + SENT_YEAR.year]!,
      before = r[HEAD + YEAR_W + SENT_YEAR.year]!,
      at =
        last !== NONE && last <= year && year < r[SENT_ROW.until]!
          ? HEAD
          : before !== NONE && before <= year && year < last
            ? HEAD + YEAR_W
            : -1;
    if (at < 0) return null;
    return {
      year,
      brought: r[at + SENT_YEAR.brought]!,
      fined: r[at + SENT_YEAR.fined]!,
      held: r[at + SENT_YEAR.held]!,
      labour: r[at + SENT_YEAR.labour]!,
      death: r[at + SENT_YEAR.death]!,
      acquitted: r[at + SENT_YEAR.acquitted]!,
    };
  }
  /** Those a land's court put to death in a year (a million of its people; 0: none, or not kept). */
  deathAt(cell: number, year: number): number {
    const d = this.dead.get(cell);
    if (!d) return 0;
    // (Each kept is a reckoning's first year and its dead a year, for SENTENCE.every years.)
    for (let i = d.length - 2; i >= 0; i -= 2)
      if (d[i]! <= year) return year < d[i]! + SENTENCE.every ? d[i + 1]! : 0;
    return 0;
  }
  /** Lands whose dead are kept for years gone by, let go of where the last is past what is kept. */
  forget(year: number): void {
    for (const [c, d] of [...this.dead]) {
      while (d.length && d[0]! + SENTENCE.every <= year - SENTENCE.deadKept) d.splice(0, 2);
      if (!d.length) this.dead.delete(c);
    }
  }
  /** The year folded into the digest: the rows it wrote (`changed`, lowest first so the same after a save), the rest as they were. */
  fold(year: number, changed: readonly number[]): void {
    const h = new Hasher().string(this.digest).int(year).int(this.rows.size);
    for (const c of [...changed].sort((a, b) => a - b)) {
      const r = this.rows.get(c);
      h.int(c)
        .int(r ? r[SENT_ROW.inside]! : -1)
        .int(r ? r[SENT_ROW.labour]! : -1);
    }
    this.digest = h.hex();
  }
  pinned(): never[] {
    return [];
  }
  hashInto(h: Hasher): void {
    h.int(this.rows.size).int(this.dead.size).string(this.digest);
  }
  save(): unknown {
    return {
      rows: this.cells().map((c) => [c, ...this.rows.get(c)!]),
      dead: [...this.dead.keys()].sort((a, b) => a - b).map((c) => [c, ...this.dead.get(c)!]),
      digest: this.digest,
    };
  }
  load(state: unknown): void {
    const s = state as { rows?: number[][]; dead?: number[][]; digest?: string } | null;
    this.rows.clear();
    this.dead.clear();
    for (const [c, ...r] of s?.rows ?? []) this.rows.set(c!, r);
    for (const [c, ...d] of s?.dead ?? []) this.dead.set(c!, d);
    this.digest = s?.digest ?? "";
  }
  /** What a probe counts: the lands kept, those held now, the year's totals. */
  summary(): Record<string, number> {
    let inside = 0,
      labour = 0;
    for (const r of this.rows.values()) {
      inside += r[SENT_ROW.inside]!;
      labour += r[SENT_ROW.labour]!;
    }
    return {
      lands: this.rows.size,
      inside,
      inLabour: labour,
      deadLands: this.dead.size,
      ...this.tally,
    };
  }
}

export function sentencesOf(world: World): SentencesStore | null {
  return world.peek<SentencesStore>(SENTENCES_STORE) ?? null;
}

/** Those a land's court holds now (heads), of them at labour, and their mean term in years; null where no court sentences there. */
export function prisonIn(
  world: World,
  cell: number,
): { inside: number; labour: number; term: number } | null {
  const r = sentencesOf(world)?.row(cell);
  return r
    ? { inside: r[SENT_ROW.inside]!, labour: r[SENT_ROW.labour]!, term: r[SENT_ROW.term]! / 10 }
    : null;
}

/** Of a land's gangs' young brought, the share held or put to labour (1 where no court sentences there). */
export function gangHeldShareIn(world: World, cell: number): number {
  const r = sentencesOf(world)?.row(cell);
  return r ? r[SENT_ROW.gangShare]! / 1000 : 1;
}
