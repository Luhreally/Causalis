// A town's buildings kept as columns of numbers, not as an object each (2026-11-15): a world at year 1,500 has a
// million of them, and an object each held 130 bytes of the worker's heap where these hold 18. What reads them reads
// them as before, through Civic: `for (const c of f.civics)`, `.find`, `.some`, `.filter`, `.length`, `.get(i)`.
import { CIVICS, CIVIC_INDEX, type CivicKind } from "../../rules/index.ts";

/** One of a town's other buildings: its first lot, how many it takes, when begun and done, when it fell. */
export interface Civic {
  readonly kind: CivicKind;
  readonly at: number;
  readonly lots: number;
  readonly start: number;
  readonly end: number;
  fell: number | null;
}

/** A standing building's `fell`, as kept. */
export const NO_FALL = -0x80000000;

/** One of a town's buildings as its columns hold it: read and its fall set through them. */
class CivicAt implements Civic {
  private readonly of: Civics;
  /** Where it stands among its town's buildings, until one before it is let go. */
  readonly index: number;
  constructor(of: Civics, index: number) {
    this.of = of;
    this.index = index;
  }
  get kind(): CivicKind {
    return CIVICS[this.of.kinds[this.index]!]!.kind;
  }
  get at(): number {
    return this.of.ats[this.index]!;
  }
  get lots(): number {
    return this.of.spans[this.index]!;
  }
  get start(): number {
    return this.of.starts[this.index]!;
  }
  get end(): number {
    return this.of.ends[this.index]!;
  }
  get fell(): number | null {
    const v = this.of.fells[this.index]!;
    return v === NO_FALL ? null : v;
  }
  set fell(v: number | null) {
    this.of.fells[this.index] = v === null ? NO_FALL : v;
  }
  toJSON(): Civic {
    return plainCivic(this);
  }
}

/** A building as a plain object, its fields in the order a page has always had them. */
export function plainCivic(c: Civic): Civic {
  return { kind: c.kind, at: c.at, lots: c.lots, start: c.start, end: c.end, fell: c.fell };
}

/** A town's buildings, in the order they were begun: columns that grow as it does. */
export class Civics implements Iterable<Civic> {
  length = 0;
  /** Counted up each time buildings are let go (those after them move up). */
  version = 0;
  kinds: Uint8Array;
  ats: Int32Array;
  spans: Uint8Array;
  starts: Int32Array;
  ends: Int32Array;
  fells: Int32Array;

  constructor(room = 0) {
    this.kinds = new Uint8Array(room);
    this.ats = new Int32Array(room);
    this.spans = new Uint8Array(room);
    this.starts = new Int32Array(room);
    this.ends = new Int32Array(room);
    this.fells = new Int32Array(room);
  }

  /** Buildings given as objects, kept as columns. */
  static from(cs: Iterable<Civic>): Civics {
    const out = new Civics();
    for (const c of cs) out.push(c);
    return out;
  }

  private room(n: number): void {
    if (n <= this.kinds.length) return;
    const size = Math.max(n, 4, Math.ceil(this.kinds.length * 1.5));
    const grow = <T extends Uint8Array | Int32Array>(a: T, b: T): T => (b.set(a), b);
    this.kinds = grow(this.kinds, new Uint8Array(size));
    this.ats = grow(this.ats, new Int32Array(size));
    this.spans = grow(this.spans, new Uint8Array(size));
    this.starts = grow(this.starts, new Int32Array(size));
    this.ends = grow(this.ends, new Int32Array(size));
    this.fells = grow(this.fells, new Int32Array(size));
  }

  /** Add a building (its kind by its index in CIVICS); its index. */
  add(
    kind: number,
    at: number,
    lots: number,
    start: number,
    end: number,
    fell: number | null = null,
  ): number {
    const i = this.length;
    this.room(i + 1);
    this.kinds[i] = kind;
    this.ats[i] = at;
    this.spans[i] = lots;
    this.starts[i] = start;
    this.ends[i] = end;
    this.fells[i] = fell === null ? NO_FALL : fell;
    return (this.length = i + 1);
  }

  push(...cs: Civic[]): number {
    for (const c of cs) this.add(CIVIC_INDEX.get(c.kind)!, c.at, c.lots, c.start, c.end, c.fell);
    return this.length;
  }

  get(i: number): Civic | undefined {
    return i >= 0 && i < this.length ? new CivicAt(this, i) : undefined;
  }

  /** Whether the i'th stands. */
  standing(i: number): boolean {
    return this.fells[i] === NO_FALL;
  }

  kindOf(i: number): CivicKind {
    return CIVICS[this.kinds[i]!]!.kind;
  }

  /** Keep only those `keep` says to, in their order; whether any was let go. */
  keep(keep: (i: number) => boolean): boolean {
    let w = 0;
    for (let i = 0; i < this.length; i++) {
      if (!keep(i)) continue;
      if (w !== i) {
        this.kinds[w] = this.kinds[i]!;
        this.ats[w] = this.ats[i]!;
        this.spans[w] = this.spans[i]!;
        this.starts[w] = this.starts[i]!;
        this.ends[w] = this.ends[i]!;
        this.fells[w] = this.fells[i]!;
      }
      w++;
    }
    if (w === this.length) return false;
    this.length = w;
    this.version++;
    return true;
  }

  /** Their columns no longer than they are (a town read back from a save takes no more). */
  fit(): this {
    if (this.kinds.length === this.length) return this;
    const n = this.length;
    this.kinds = this.kinds.slice(0, n);
    this.ats = this.ats.slice(0, n);
    this.spans = this.spans.slice(0, n);
    this.starts = this.starts.slice(0, n);
    this.ends = this.ends.slice(0, n);
    this.fells = this.fells.slice(0, n);
    return this;
  }

  *[Symbol.iterator](): IterableIterator<Civic> {
    for (let i = 0; i < this.length; i++) yield new CivicAt(this, i);
  }
  find(p: (c: Civic, i: number) => unknown): Civic | undefined {
    for (let i = 0; i < this.length; i++) {
      const c = new CivicAt(this, i);
      if (p(c, i)) return c;
    }
    return undefined;
  }
  findIndex(p: (c: Civic, i: number) => unknown): number {
    for (let i = 0; i < this.length; i++) if (p(new CivicAt(this, i), i)) return i;
    return -1;
  }
  some(p: (c: Civic, i: number) => unknown): boolean {
    return this.findIndex(p) >= 0;
  }
  every(p: (c: Civic, i: number) => unknown): boolean {
    return this.findIndex((c, i) => !p(c, i)) < 0;
  }
  filter(p: (c: Civic, i: number) => unknown): Civic[] {
    const out: Civic[] = [];
    for (let i = 0; i < this.length; i++) {
      const c = new CivicAt(this, i);
      if (p(c, i)) out.push(c);
    }
    return out;
  }
  map<T>(f: (c: Civic, i: number) => T): T[] {
    const out: T[] = [];
    for (let i = 0; i < this.length; i++) out.push(f(new CivicAt(this, i), i));
    return out;
  }
  forEach(f: (c: Civic, i: number) => void): void {
    for (let i = 0; i < this.length; i++) f(new CivicAt(this, i), i);
  }
  /** Each as a plain object. */
  toJSON(): Civic[] {
    return this.map((c) => (c as CivicAt).toJSON());
  }
}
