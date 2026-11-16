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

/**
 * A run of lots changed together: [what, first lot, end lot (exclusive), first year, last year, level, design] (see
 * fabric.ts). Readers are given each as such a list, a copy: a town's own work goes over its runs' columns.
 */
export type Change = [
  what: number,
  from: number,
  to: number,
  start: number,
  end: number,
  level: number,
  design: number,
];

/** The numbers of a run. */
export const RUN = 7;
/** A run's slot and its incarnation, told as one number: what a town's settling keeps of a run it is to go over. */
const SLOTS = 0x400000;

/**
 * A town's runs (2026-11-15): each in a slot of seven numbers, and the slots in the order of their lots. A run let go
 * gives back its slot for another, and its incarnation counts on, so what was kept of it (a handle) tells it is gone.
 * A great town has ten thousand runs; a world at 1,500 three quarters of a million, a list of seven each held 117 bytes.
 */
export class Runs implements Iterable<Change> {
  /** How many runs stand. */
  length = 0;
  /** The slots, in the order of their runs' lots. */
  order: Int32Array;
  /** Seven numbers a slot. */
  d: Int32Array;
  /** Each slot's incarnation. */
  gen: Int32Array;
  /** Slots ever taken. */
  private top = 0;
  private free: number[] = [];

  constructor(room = 0) {
    this.order = new Int32Array(room);
    this.d = new Int32Array(room * RUN);
    this.gen = new Int32Array(room);
  }

  /** Runs given as lists, in the order given. */
  static from(cs: Iterable<readonly number[]>): Runs {
    const out = new Runs();
    for (const c of cs) out.push(c);
    return out;
  }

  /** A slot's k'th number. */
  v(s: number, k: number): number {
    return this.d[s * RUN + k]!;
  }
  /** Set a slot's k'th number. */
  w(s: number, k: number, x: number): void {
    this.d[s * RUN + k] = x;
  }
  /** The slot of the i'th run. */
  slot(i: number): number {
    return this.order[i]!;
  }

  /** A slot taken for a run, not yet among the town's (insert puts it there). */
  alloc(
    what: number,
    from: number,
    to: number,
    start: number,
    end: number,
    level: number,
    design: number,
  ): number {
    let s = this.free.pop();
    if (s === undefined) {
      s = this.top++;
      if (s >= this.gen.length) {
        const size = Math.max(4, Math.ceil(this.gen.length * 1.5), s + 1),
          d = new Int32Array(size * RUN),
          gen = new Int32Array(size);
        d.set(this.d);
        gen.set(this.gen);
        this.d = d;
        this.gen = gen;
      }
    }
    const o = s * RUN,
      d = this.d;
    d[o] = what;
    d[o + 1] = from;
    d[o + 2] = to;
    d[o + 3] = start;
    d[o + 4] = end;
    d[o + 5] = level;
    d[o + 6] = design;
    return s;
  }

  /** A slot given back: what was kept of its run tells it gone. */
  release(s: number): void {
    this.gen[s]!++;
    this.free.push(s);
  }

  /** A slot's run as one number, for keeping (see alive). */
  handle(s: number): number {
    return this.gen[s]! * SLOTS + s;
  }
  /** The slot of a run kept (see handle). */
  slotOf(h: number): number {
    return h % SLOTS;
  }
  /** Whether a run kept stands still (was not let go, nor joined into another). */
  alive(h: number): boolean {
    const s = h % SLOTS;
    return this.gen[s] === (h - s) / SLOTS;
  }

  private room(n: number): void {
    if (n <= this.order.length) return;
    const order = new Int32Array(Math.max(n, 4, Math.ceil(this.order.length * 1.5)));
    order.set(this.order.subarray(0, this.length));
    this.order = order;
  }

  /** Slot s put at position i of the order. */
  insert(i: number, s: number): void {
    this.room(this.length + 1);
    this.order.copyWithin(i + 1, i, this.length);
    this.order[i] = s;
    this.length++;
  }

  /** The runs at positions [i, j) put in place of `keep` (slots), those not kept let go. */
  replace(i: number, j: number, keep: readonly number[]): void {
    for (let k = i; k < j; k++) {
      const s = this.order[k]!;
      if (!keep.includes(s)) this.release(s);
    }
    const grow = keep.length - (j - i);
    if (grow > 0) this.room(this.length + grow);
    this.order.copyWithin(i + keep.length, j, this.length);
    for (let k = 0; k < keep.length; k++) this.order[i + k] = keep[k]!;
    this.length += grow;
  }

  /** The run at position i let go. */
  removeAt(i: number): void {
    this.release(this.order[i]!);
    this.order.copyWithin(i, i + 1, this.length);
    this.length--;
  }

  /** Keep only the runs `keep` says to, in their order; the others let go. */
  keep(keep: (s: number) => boolean): void {
    let w = 0;
    for (let i = 0; i < this.length; i++) {
      const s = this.order[i]!;
      if (keep(s)) this.order[w++] = s;
      else this.release(s);
    }
    this.length = w;
  }

  /** The runs these (slots) in this order, those no longer among them let go. */
  become(slots: readonly number[]): void {
    const kept = new Set(slots);
    for (let i = 0; i < this.length; i++)
      if (!kept.has(this.order[i]!)) this.release(this.order[i]!);
    this.room(slots.length);
    for (let k = 0; k < slots.length; k++) this.order[k] = slots[k]!;
    this.length = slots.length;
  }

  /** The runs sorted by their first lots (a save from before kept them in the order they were made). */
  sortByLots(): void {
    const sorted = [...this.order.subarray(0, this.length)].sort(
      (a, b) => this.v(a, 1) - this.v(b, 1),
    );
    this.order.set(sorted);
  }

  /** The slots no more than the runs (a town read back takes no more). */
  fit(): this {
    if (this.free.length || this.top !== this.length || this.order.length === this.length)
      return this;
    this.order = this.order.slice(0, this.length);
    this.d = this.d.slice(0, this.length * RUN);
    this.gen = this.gen.slice(0, this.length);
    return this;
  }

  /** A run put after the last (its lots after theirs): its slot. */
  push(c: readonly number[]): number {
    const s = this.alloc(c[0]!, c[1]!, c[2]!, c[3]!, c[4]!, c[5]!, c[6]!);
    this.insert(this.length, s);
    return s;
  }

  /** The i'th run, as a list (a copy). */
  get(i: number): Change | undefined {
    if (i < 0 || i >= this.length) return undefined;
    const o = this.order[i]! * RUN,
      d = this.d;
    return [d[o]!, d[o + 1]!, d[o + 2]!, d[o + 3]!, d[o + 4]!, d[o + 5]!, d[o + 6]!];
  }

  *[Symbol.iterator](): IterableIterator<Change> {
    for (let i = 0; i < this.length; i++) yield this.get(i)!;
  }
  find(p: (c: Change, i: number) => unknown): Change | undefined {
    for (let i = 0; i < this.length; i++) {
      const c = this.get(i)!;
      if (p(c, i)) return c;
    }
    return undefined;
  }
  some(p: (c: Change, i: number) => unknown): boolean {
    return this.find(p) !== undefined;
  }
  every(p: (c: Change, i: number) => unknown): boolean {
    return !this.some((c, i) => !p(c, i));
  }
  filter(p: (c: Change, i: number) => unknown): Change[] {
    const out: Change[] = [];
    for (let i = 0; i < this.length; i++) {
      const c = this.get(i)!;
      if (p(c, i)) out.push(c);
    }
    return out;
  }
  map<T>(f: (c: Change, i: number) => T): T[] {
    const out: T[] = [];
    for (let i = 0; i < this.length; i++) out.push(f(this.get(i)!, i));
    return out;
  }
  reduce<T>(f: (acc: T, c: Change, i: number) => T, start: T): T {
    let acc = start;
    for (let i = 0; i < this.length; i++) acc = f(acc, this.get(i)!, i);
    return acc;
  }
  slice(from = 0, to = this.length): Change[] {
    const out: Change[] = [];
    const a = from < 0 ? Math.max(0, this.length + from) : from,
      b = to < 0 ? this.length + to : Math.min(to, this.length);
    for (let i = a; i < b; i++) out.push(this.get(i)!);
    return out;
  }
  /** Each as a list. */
  toJSON(): Change[] {
    return this.slice();
  }
}
