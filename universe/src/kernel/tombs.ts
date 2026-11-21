// What history keeps of what it has forgotten, held by column: the tombstones (which event or
// decision, when, of what kind, where and of whom) and the summaries (how many of each type in a
// place's decade). As objects a world at 1,500 held 44,000 tombstones in 10 MB and 77,000 summaries
// in 35 MB; nothing reads them but "why", a page and a save, which are given them as they were.
import { codeOf, refOfCode } from "./cold.ts";
import type { DecisionTombstone, Summary, Tombstone } from "./history.ts";
import { Words } from "./pack.ts";
import type { Ref } from "./ref.ts";

/** Past every serial: an id the minter did not write is kept as a word, by this and its number. */
const ODD = 0x100000000;

/** Tombstones by column, in the order laid. */
export class Tombs {
  private n = 0;
  /** Each one's id: ± its serial (kernel/cold.ts codeOf), or ODD and its word's number. */
  private id: number[] = [];
  private t: number[] = [];
  /** An event's type, a decision's rule. */
  private what: number[] = [];
  /** An event's place (−1: none), a decision's subject. */
  private where: number[] = [];
  /** Where each one's subjects end in `subs` (an event's; it starts where the one before ends). */
  private end: number[] = [];
  private subs: number[] = [];
  private words = new Words();
  /** Rows by id, made when first asked for (a reckoning lays thousands at once). */
  private rows: Map<number, number> | null = null;

  get length(): number {
    return this.n;
  }

  private key(id: string): number {
    return codeOf(id) || ODD + this.words.idOf(id);
  }

  add(
    id: Ref,
    t: number,
    what: string,
    where: string | null,
    subjects: readonly string[] | null,
  ): void {
    const key = this.key(id);
    this.id.push(key);
    this.t.push(t);
    this.what.push(this.words.idOf(what));
    this.where.push(where === null ? -1 : this.words.idOf(where));
    if (subjects) for (const s of subjects) this.subs.push(this.words.idOf(s));
    this.end.push(this.subs.length);
    this.rows?.set(key, this.n);
    this.n++;
  }

  /** The row of an id, or −1. */
  rowOf(id: Ref): number {
    if (!this.rows) {
      this.rows = new Map();
      for (let r = 0; r < this.n; r++) this.rows.set(this.id[r]!, r);
    }
    return this.rows.get(this.key(id)) ?? -1;
  }

  private idAt(r: number): Ref {
    const key = this.id[r]!;
    return (key >= ODD ? this.words.wordOf(key - ODD) : refOfCode(key)) as Ref;
  }

  event(r: number): Tombstone {
    const where = this.where[r]!,
      subjects: Ref[] = [];
    for (let k = r ? this.end[r - 1]! : 0; k < this.end[r]!; k++)
      subjects.push(this.words.wordOf(this.subs[k]!) as Ref);
    return {
      id: this.idAt(r),
      t: this.t[r]!,
      type: this.words.wordOf(this.what[r]!),
      place: where < 0 ? null : (this.words.wordOf(where) as Ref),
      subjects,
    };
  }

  decision(r: number): DecisionTombstone {
    return {
      id: this.idAt(r),
      t: this.t[r]!,
      rule: this.words.wordOf(this.what[r]!),
      subject: this.words.wordOf(this.where[r]!) as Ref,
    };
  }

  events(): Tombstone[] {
    const out: Tombstone[] = [];
    for (let r = 0; r < this.n; r++) out.push(this.event(r));
    return out;
  }

  decisions(): DecisionTombstone[] {
    const out: DecisionTombstone[] = [];
    for (let r = 0; r < this.n; r++) out.push(this.decision(r));
    return out;
  }

  /** Let go those of before `before`; how many. (They are laid as things are forgotten, not in the order they happened.) */
  drop(before: number): number {
    let gone = 0;
    for (let r = 0; r < this.n; r++) if (this.t[r]! < before) gone++;
    if (!gone) return 0;
    const old = {
      n: this.n,
      id: this.id,
      t: this.t,
      what: this.what,
      where: this.where,
      end: this.end,
      subs: this.subs,
      words: this.words,
    };
    this.clear();
    // (Laid again, so the words of those let go are let go with them.)
    for (let r = 0; r < old.n; r++) {
      if (old.t[r]! < before) continue;
      const key = old.id[r]!,
        where = old.where[r]!;
      this.id.push(key >= ODD ? ODD + this.words.idOf(old.words.wordOf(key - ODD)) : key);
      this.t.push(old.t[r]!);
      this.what.push(this.words.idOf(old.words.wordOf(old.what[r]!)));
      this.where.push(where < 0 ? -1 : this.words.idOf(old.words.wordOf(where)));
      for (let k = r ? old.end[r - 1]! : 0; k < old.end[r]!; k++)
        this.subs.push(this.words.idOf(old.words.wordOf(old.subs[k]!)));
      this.end.push(this.subs.length);
      this.n++;
    }
    return gone;
  }

  clear(): void {
    this.n = 0;
    this.id = [];
    this.t = [];
    this.what = [];
    this.where = [];
    this.end = [];
    this.subs = [];
    this.words = new Words();
    this.rows = null;
  }

  loadEvents(list: readonly Tombstone[]): void {
    this.clear();
    for (const x of list) this.add(x.id, x.t, x.type, x.place, x.subjects);
  }

  loadDecisions(list: readonly DecisionTombstone[]): void {
    this.clear();
    for (const x of list) this.add(x.id, x.t, x.rule, x.subject, null);
  }
}

/** How many types a decade's key leaves room for. */
const TYPES = 65536;

/** Forgotten events counted by place, decade and type. */
export class Folded {
  /** By place: the count of each decade × TYPES + type's number, in the order first counted. */
  private by = new Map<string, Map<number, number>>();
  private types = new Words();

  add(place: string, decade: number, type: string, n = 1): void {
    const code = this.types.idOf(type);
    if (code >= TYPES) throw new Error("more event types than a summary's key holds");
    const key = decade * TYPES + code;
    let counts = this.by.get(place);
    if (!counts) this.by.set(place, (counts = new Map()));
    counts.set(key, (counts.get(key) ?? 0) + n);
  }

  /** The counts of a few types only, by place and then decade as summaries() has them (none of the rest made up). */
  countsOf(
    types: ReadonlySet<string>,
  ): { place: string; decade: number; type: string; n: number }[] {
    const out: { place: string; decade: number; type: string; n: number }[] = [],
      wanted = new Map<number, string | null>();
    for (const [place, counts] of this.by)
      for (const [key, n] of counts) {
        const decade = Math.floor(key / TYPES),
          code = key - decade * TYPES;
        let type = wanted.get(code);
        if (type === undefined) {
          const word = this.types.wordOf(code);
          wanted.set(code, (type = types.has(word) ? word : null));
        }
        if (type !== null) out.push({ place, decade, type, n });
      }
    return out.sort((a, b) =>
      a.place !== b.place ? (a.place < b.place ? -1 : 1) : a.decade - b.decade,
    );
  }

  /** The summaries, by place and then decade; each one's types in the order first counted. */
  summaries(): Summary[] {
    const out: Summary[] = [];
    for (const [place, counts] of this.by) {
      const byDecade = new Map<number, Summary>();
      for (const [key, n] of counts) {
        const decade = Math.floor(key / TYPES);
        let s = byDecade.get(decade);
        if (!s) {
          byDecade.set(decade, (s = { place, decade, counts: {} }));
          out.push(s);
        }
        s.counts[this.types.wordOf(key - decade * TYPES)] = n;
      }
    }
    return out.sort((a, b) =>
      a.place !== b.place ? (a.place < b.place ? -1 : 1) : a.decade - b.decade,
    );
  }

  clear(): void {
    this.by = new Map();
    this.types = new Words();
  }
}
