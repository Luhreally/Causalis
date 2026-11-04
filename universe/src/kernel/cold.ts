// History grown cold (Phase 63: deep time). A world of thousands of years keeps hundreds of
// thousands of events and decisions it may never read again. Held as objects they were most of
// the heap and most of what the collector had to walk; written out again in every save they were
// most of what a save took. Once they are old, they go into blocks: text, by column (kernel/pack.ts),
// written once and kept as it is in every save after. What a year asks of an old event (when it
// was, of what type, how much it mattered) stays in typed arrays beside them; the rest is read back
// from its block only when someone asks.
//
// Nothing here is history. An event reads back as a save would have given it back, whether or not
// it has gone cold, and when anything goes cold changes nothing a world does. A decision reads back
// as "why" tells it, all that anything reads of one: the sums it weighed to the two places they are
// told in, and in the place of its factors' own values (a double's last digits are most of what a
// decision weighs, and no one reads them) what each came to.
import { packList, unpackList, Words, type Packed } from "./pack.ts";
import type { CauseRef, CauseRole, DecisionRecord, Factor, HistoryEvent } from "./history.ts";
import type { Ref } from "./ref.ts";

/** How many rows a block holds. */
export const COLD_ROWS = 16384;
/** How many blocks may be read back at once, of each part. */
const PARTS_KEPT = 4;
/** A block is written again without its forgotten once one row in this many is. */
const TIDY_SHARE = 16;
/** The largest serial a reference can be read as (codes are ± serials in an Int32Array). */
export const MAX_SERIAL = 0x7fffffff;

/**
 * What a reference is to history's index: +N for event N, −N for decision N, 0 for anything else.
 * Only the text the minter writes ("ev:0:N") is an event's: a ref with a leading zero, or of
 * another kind, is no event or decision, as no lookup by text would find one.
 */
export function codeOf(ref: unknown): number {
  if (typeof ref !== "string") return 0;
  let i: number,
    sign = 1;
  if (ref.charCodeAt(0) === 101 && ref.charCodeAt(1) === 118 && ref.charCodeAt(2) === 58) i = 3;
  else if (
    ref.charCodeAt(0) === 100 &&
    ref.charCodeAt(1) === 101 &&
    ref.charCodeAt(2) === 99 &&
    ref.charCodeAt(3) === 58
  ) {
    i = 4;
    sign = -1;
  } else return 0;
  const n = ref.length;
  if (i >= n) return 0;
  let a = 0,
    start = i;
  for (; i < n; i++) {
    const c = ref.charCodeAt(i);
    if (c === 58) break;
    if (c < 48 || c > 57) return 0;
    a = a * 10 + (c - 48);
  }
  if (i >= n || !plainDigits(ref, start, i) || a >= 4294967296) return 0;
  let b = 0;
  start = ++i;
  for (; i < n; i++) {
    const c = ref.charCodeAt(i);
    if (c < 48 || c > 57) return 0;
    b = b * 10 + (c - 48);
  }
  if (!plainDigits(ref, start, i) || b >= 4294967296) return 0;
  const serial = a * 4294967296 + b;
  return serial >= 1 && serial <= MAX_SERIAL ? sign * serial : 0;
}

/** Whether ref[start, end) is a number as the minter writes one: digits, no leading zero. */
function plainDigits(ref: string, start: number, end: number): boolean {
  const n = end - start;
  return n >= 1 && n <= 10 && (n === 1 || ref.charCodeAt(start) !== 48);
}

/**
 * A run of refs a store hands its reckoning by their codes, in their place among its pins: what it
 * no longer holds as text (and so would have to write out, every decade, to be read back).
 */
export class PinnedCodes {
  readonly codes: readonly number[];

  constructor(codes: readonly number[]) {
    this.codes = codes;
  }
}

/** The text of a code: what codeOf read it from. */
export function refOfCode(code: number): Ref {
  return (code > 0 ? `ev:0:${code}` : `dec:0:${-code}`) as Ref;
}

function text(value: unknown, words: Words): string {
  return JSON.stringify(packList([value], words));
}

function read<T>(part: string, words: Words): T {
  return unpackList(JSON.parse(part) as Packed, words)[0] as T;
}

/** A value's parts packed each on its own: lists of one kind, side by side in one text. */
function textOfLists(lists: readonly (readonly unknown[])[], words: Words): string {
  return JSON.stringify(lists.map((list) => packList(list, words)));
}

/** A part of a block, group by group: a group is read back only when one of its rows is asked for. */
class Groups<T> {
  private readonly packed: readonly Packed[];
  private readonly lists: (readonly T[] | undefined)[] = [];
  private readonly words: Words;
  /** How a group's list as it is kept reads in full. */
  private readonly full: (kept: readonly unknown[], group: number) => readonly T[];

  constructor(
    part: string,
    words: Words,
    full: (kept: readonly unknown[], group: number) => readonly T[],
  ) {
    this.packed = JSON.parse(part) as Packed[];
    this.words = words;
    this.full = full;
  }

  of(group: number): readonly T[] {
    return (this.lists[group] ??= this.full(unpackList(this.packed[group]!, this.words), group));
  }
}

function sameList<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return false;
  return true;
}

/**
 * A group's subjects as kept: a row whose subjects are those of the last with the same first (a
 * war and its two realms, battle after battle) keeps only that first.
 */
function keptSubjects(list: readonly (readonly string[])[]): unknown[] {
  const last = new Map<string, readonly string[]>();
  return list.map((subjects) => {
    if (subjects.length < 2) return subjects;
    const was = last.get(subjects[0]!);
    if (was && sameList(was, subjects)) return subjects[0]!;
    last.set(subjects[0]!, subjects);
    return subjects;
  });
}

function fullSubjects(kept: readonly unknown[]): readonly (readonly Ref[])[] {
  const last = new Map<string, readonly Ref[]>();
  return kept.map((row) => {
    if (typeof row === "string") return last.get(row)!;
    const subjects = row as readonly Ref[];
    if (subjects.length >= 2) last.set(subjects[0]!, subjects);
    return subjects;
  });
}

/**
 * A group's causes that are events or decisions, as kept: a row whose are those of the last with the
 * same first subject (the war each of its battles was fought in) keeps a 0.
 */
function keptKids(
  list: readonly (readonly number[])[],
  subjects: readonly (readonly string[])[],
): unknown[] {
  const last = new Map<string, readonly number[]>();
  return list.map((codes, k) => {
    const first = subjects[k]![0];
    if (first === undefined || !codes.length) return codes;
    const was = last.get(first);
    if (was && sameList(was, codes)) return 0;
    last.set(first, codes);
    return codes;
  });
}

function fullKids(
  kept: readonly unknown[],
  subjects: readonly (readonly string[])[],
): readonly (readonly number[])[] {
  const last = new Map<string, readonly number[]>();
  return kept.map((row, k) => {
    const first = subjects[k]![0];
    if (row === 0) return last.get(first!)!;
    const codes = row as readonly number[];
    if (first !== undefined && codes.length) last.set(first, codes);
    return codes;
  });
}

/** How many rows a field must be in, for it to be worth asking what it goes with. */
const FIELD_LEAST = 4;

/**
 * The string fields of a group's data that go with one of its rows' subjects (a realm's name with
 * the realm, a war's sides with the war), each with which: its value then is written once in a block
 * for as long as it stays the same. Only fields that are strings wherever they are, so that a
 * number in their place can say "as before".
 */
function namedFields(
  data: readonly unknown[],
  subjects: readonly (readonly string[])[],
): [string, number][] {
  const fields = new Map<string, number>();
  for (const d of data) {
    if (d === null || typeof d !== "object" || Array.isArray(d)) continue;
    for (const [f, v] of Object.entries(d)) {
      if (typeof v !== "string") fields.set(f, -1);
      else if (fields.get(f) !== -1) fields.set(f, (fields.get(f) ?? 0) + 1);
    }
  }
  const out: [string, number][] = [];
  for (const [f, rows] of fields) {
    if (rows < FIELD_LEAST) continue;
    let best = -1,
      fewest = Math.floor(rows / 2) + 1;
    next: for (let i = 0; i < 3; i++) {
      const last = new Map<string, unknown>();
      let writes = 0;
      for (let k = 0; k < data.length; k++) {
        const v = (data[k] as Record<string, unknown> | null)?.[f];
        if (v === undefined) continue;
        const subject = subjects[k]![i];
        if (subject === undefined) continue next;
        if (last.get(subject) !== v) {
          writes++;
          last.set(subject, v);
        }
      }
      if (writes < fewest) {
        fewest = writes;
        best = i;
      }
    }
    if (best >= 0) out.push([f, best]);
  }
  return out;
}

/** A block's data as kept: group by group, what its subjects give dropped where it stays the same. */
function keptData(
  groups: readonly {
    readonly data: readonly unknown[];
    readonly subjects: readonly (readonly string[])[];
  }[],
  words: Words,
): string {
  const last = new Map<string, unknown>();
  return JSON.stringify(
    groups.map((g) => {
      const fields = namedFields(g.data, g.subjects);
      if (!fields.length) return [packList(g.data, words), fields];
      const by = new Map(fields),
        rows = g.data.map((d, k) => {
          if (d === null || typeof d !== "object" || Array.isArray(d)) return d;
          const out: Record<string, unknown> = {};
          for (const [f, v] of Object.entries(d)) {
            const i = by.get(f);
            if (i === undefined) {
              out[f] = v;
              continue;
            }
            const key = `${f}|${g.subjects[k]![i]!}`;
            if (last.get(key) === v) out[f] = 0;
            else {
              out[f] = v;
              last.set(key, v);
            }
          }
          return out;
        });
      return [packList(rows, words), fields];
    }),
  );
}

/** What keptData kept, each group's rows in full. */
function fullData(
  part: string,
  words: Words,
  subjectsOf: (group: number) => readonly (readonly string[])[],
): unknown[][] {
  const last = new Map<string, unknown>();
  return (JSON.parse(part) as (readonly [Packed, readonly (readonly [string, number])[]])[]).map(
    ([packed, fields], g) => {
      const rows = unpackList(packed, words);
      if (!fields.length) return rows;
      const subjects = subjectsOf(g);
      for (let k = 0; k < rows.length; k++) {
        const d = rows[k] as Record<string, unknown> | null;
        if (d === null || typeof d !== "object" || Array.isArray(d)) continue;
        for (let n = 0; n < fields.length; n++) {
          const f = fields[n]![0],
            v = d[f];
          if (v === undefined) continue;
          const key = `${f}|${subjects[k]![fields[n]![1]]!}`;
          if (v === 0) d[f] = last.get(key);
          else last.set(key, v);
        }
      }
      return rows;
    },
  );
}

/** Parts read back lately: a few are kept, the oldest let go. Only a cache: nothing depends on it. */
export class Recent<T> {
  private readonly held = new Map<number, T>();

  get(key: number, make: () => T): T {
    const known = this.held.get(key);
    if (known !== undefined) {
      this.held.delete(key);
      this.held.set(key, known);
      return known;
    }
    const made = make();
    if (this.held.size >= PARTS_KEPT) this.held.delete(this.held.keys().next().value!);
    this.held.set(key, made);
    return made;
  }

  forget(key: number): void {
    this.held.delete(key);
  }

  clear(): void {
    this.held.clear();
  }
}

function grownInt32(a: Int32Array, n: number) {
  const b = new Int32Array(n);
  b.set(a);
  return b;
}
function grownFloat64(a: Float64Array, n: number) {
  const b = new Float64Array(n);
  b.set(a);
  return b;
}
function grownUint8(a: Uint8Array, n: number) {
  const b = new Uint8Array(n);
  b.set(a);
  return b;
}
function grownUint16(a: Uint16Array, n: number) {
  const b = new Uint16Array(n);
  b.set(a);
  return b;
}

/** Whether a list is of strings, as a log keeps its subjects. */
function plainRefs(list: unknown): list is readonly string[] {
  return Array.isArray(list) && list.every((x) => typeof x === "string");
}

const ROLES: ReadonlySet<string> = new Set([
  "trigger",
  "enabler",
  "pressure",
  "constraint",
  "agent",
]);

/** One block of events: its parts, each read on its own, and how many of its rows are forgotten. */
type EventBlock = {
  /** Serials, times, types, importances and places: read when a save is loaded. */
  head: string;
  /** Each row's causes that are events or decisions, by code: read when history is first reckoned. */
  kids: string;
  /** Each row's causes' roles and weights, and the refs of those that are neither. */
  causes: string;
  subjects: string;
  data: string;
  rows: number;
  dead: number;
};

type EventHead = {
  readonly s: readonly number[];
  readonly t: readonly number[];
  readonly y: readonly number[];
  readonly i: readonly number[];
  readonly p: readonly number[];
};

/**
 * A cause as a block keeps it: its role and weight, and if it is no event or decision its ref (`x`),
 * or where it is among those of its own row (`i`: 0 its place, else that subject, counted from 1).
 */
type KeptCause = {
  readonly r: string;
  readonly w: number;
  readonly x?: string;
  readonly i?: number;
};

/** A block whose rows have gone into another's (a save leaves it out). */
const EMPTY_BLOCK: EventBlock = {
  head: "",
  kids: "",
  causes: "",
  subjects: "",
  data: "",
  rows: 0,
  dead: 0,
};

/** Each row of a block in turn: which group it falls in (first seen, first numbered), and where in it. */
class GroupPlaces {
  group = 0;
  within = 0;
  private readonly numbers = new Map<number, number>();
  private readonly counts: number[] = [];

  next(type: number): void {
    let g = this.numbers.get(type);
    if (g === undefined) {
      g = this.counts.length;
      this.numbers.set(type, g);
      this.counts.push(0);
    }
    this.group = g;
    this.within = this.counts[g]!++;
  }
}

/** The events gone cold, oldest first: typed arrays by row, and their blocks. */
export class ColdEvents {
  /** Live rows. */
  n = 0;
  serial = new Int32Array(1024);
  t = new Float64Array(1024);
  type = new Int32Array(1024);
  place = new Int32Array(1024);
  importance = new Uint8Array(1024);
  block = new Int32Array(1024);
  local = new Uint16Array(1024);
  /** Which group of its block a row is in (one to a type), and where in it. */
  group = new Uint16Array(1024);
  within = new Uint16Array(1024);
  blocks: EventBlock[] = [];
  words = new Words();
  /** Importances hindsight has raised since their blocks were written, by serial. */
  raised = new Map<number, number>();
  private subjectsOf = new Recent<Groups<readonly Ref[]>>();
  private kidsIn = new Recent<Groups<readonly number[]>>();
  private causesOf = new Recent<Groups<readonly KeptCause[]>>();
  private dataOf = new Recent<readonly (readonly unknown[])[]>();

  private room(n: number): void {
    if (n <= this.serial.length) return;
    const cap = Math.max(n, this.serial.length * 2);
    this.serial = grownInt32(this.serial, cap);
    this.t = grownFloat64(this.t, cap);
    this.type = grownInt32(this.type, cap);
    this.place = grownInt32(this.place, cap);
    this.importance = grownUint8(this.importance, cap);
    this.block = grownInt32(this.block, cap);
    this.local = grownUint16(this.local, cap);
    this.group = grownUint16(this.group, cap);
    this.within = grownUint16(this.within, cap);
  }

  /** The row of serial s (of a ref read by codeOf), or -1. */
  rowOf(s: number): number {
    const serial = this.serial;
    let lo = 0,
      hi = this.n - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1,
        v = serial[mid]!;
      if (v === s) return mid;
      if (v < s) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  }

  /** Whether an event may go cold: as the log writes it, so that it reads back as it was. */
  static fits(e: HistoryEvent, last: number): boolean {
    const s = codeOf(e.id);
    if (s <= last || typeof e.t !== "number" || !Number.isFinite(e.t)) return false;
    if (e.place !== null && typeof e.place !== "string") return false;
    if (!plainRefs(e.subjects) || !Array.isArray(e.causes)) return false;
    for (const c of e.causes) {
      if (!c || typeof c.ref !== "string" || !ROLES.has(c.role) || typeof c.weight !== "number")
        return false;
    }
    return true;
  }

  /** The rows' parts, written as one block's. */
  private write(rows: readonly HistoryEvent[]): EventBlock {
    const words = this.words,
      groups = new Map<
        string,
        { subjects: unknown[]; kids: number[][]; causes: KeptCause[][]; data: unknown[] }
      >(),
      s = new Array<number>(rows.length),
      t = new Array<number>(rows.length),
      y = new Array<number>(rows.length),
      i = new Array<number>(rows.length),
      p = new Array<number>(rows.length);
    for (let k = 0; k < rows.length; k++) {
      const e = rows[k]!;
      s[k] = codeOf(e.id);
      t[k] = e.t;
      y[k] = words.idOf(e.type);
      i[k] = e.importance;
      p[k] = e.place === null ? -1 : words.idOf(e.place);
      let g = groups.get(e.type);
      if (!g) groups.set(e.type, (g = { subjects: [], kids: [], causes: [], data: [] }));
      g.subjects.push(e.subjects);
      g.data.push(e.data);
      const kids: number[] = [],
        kept: KeptCause[] = [];
      for (const c of e.causes) {
        const code = codeOf(c.ref);
        if (code !== 0) {
          kids.push(code);
          kept.push({ r: c.role, w: c.weight });
          continue;
        }
        const at = c.ref === e.place ? 0 : e.subjects.indexOf(c.ref as Ref) + 1;
        kept.push(
          at > 0 || c.ref === e.place
            ? { r: c.role, w: c.weight, i: at }
            : { r: c.role, w: c.weight, x: c.ref },
        );
      }
      g.kids.push(kids);
      g.causes.push(kept);
    }
    const all = [...groups.values()];
    return {
      head: text({ s, t, y, i, p }, words),
      kids: textOfLists(
        all.map((g) => keptKids(g.kids, g.subjects as readonly (readonly string[])[])),
        words,
      ),
      causes: textOfLists(
        all.map((g) => g.causes),
        words,
      ),
      subjects: textOfLists(
        all.map((g) => keptSubjects(g.subjects as readonly (readonly string[])[])),
        words,
      ),
      data: keptData(all as Parameters<typeof keptData>[0], words),
      rows: rows.length,
      dead: 0,
    };
  }

  /** The rows go cold, as a new block (they follow every row already cold). */
  freeze(rows: readonly HistoryEvent[]): void {
    const b = this.blocks.length,
      block = this.write(rows);
    this.blocks.push(block);
    this.room(this.n + rows.length);
    const grouped = new GroupPlaces();
    for (let k = 0; k < rows.length; k++) {
      const e = rows[k]!,
        r = this.n + k;
      this.serial[r] = codeOf(e.id);
      this.t[r] = e.t;
      this.type[r] = this.words.idOf(e.type);
      this.place[r] = e.place === null ? -1 : this.words.idOf(e.place);
      this.importance[r] = e.importance;
      this.block[r] = b;
      this.local[r] = k;
      grouped.next(this.type[r]!);
      this.group[r] = grouped.group;
      this.within[r] = grouped.within;
    }
    this.n += rows.length;
  }

  /** A block's subjects, group by group. */
  private subjectsIn(b: number): Groups<readonly Ref[]> {
    return this.subjectsOf.get(
      b,
      () => new Groups<readonly Ref[]>(this.blocks[b]!.subjects, this.words, fullSubjects),
    );
  }

  /** A row's causes that are events or decisions, by code. */
  kids(row: number): readonly number[] {
    const b = this.block[row]!;
    return this.kidsIn
      .get(
        b,
        () =>
          new Groups<readonly number[]>(this.blocks[b]!.kids, this.words, (kept, group) =>
            fullKids(kept, this.subjectsIn(b).of(group)),
          ),
      )
      .of(this.group[row]!)[this.within[row]!]!;
  }

  subjects(row: number): readonly Ref[] {
    return this.subjectsIn(this.block[row]!).of(this.group[row]!)[this.within[row]!]!;
  }

  causes(row: number): readonly CauseRef[] {
    const b = this.block[row]!,
      codes = this.kids(row),
      list = this.causesOf
        .get(
          b,
          () =>
            new Groups<readonly KeptCause[]>(
              this.blocks[b]!.causes,
              this.words,
              (kept) => kept as readonly (readonly KeptCause[])[],
            ),
        )
        .of(this.group[row]!)[this.within[row]!]!;
    let at = 0;
    return list.map((c): CauseRef => {
      const ref =
        c.x !== undefined
          ? c.x
          : c.i === undefined
            ? refOfCode(codes[at++]!)
            : c.i === 0
              ? this.words.wordOf(this.place[row]!)
              : this.subjects(row)[c.i - 1]!;
      return { ref: ref as Ref, role: c.r as CauseRole, weight: c.w };
    });
  }

  data(row: number): unknown {
    const b = this.block[row]!;
    return this.dataOf.get(b, () =>
      fullData(this.blocks[b]!.data, this.words, (group) => this.subjectsIn(b).of(group)),
    )[this.group[row]!]![this.within[row]!];
  }

  /** A row moved up over the forgotten (a reckoning, walking in order). */
  move(from: number, to: number): void {
    this.serial[to] = this.serial[from]!;
    this.t[to] = this.t[from]!;
    this.type[to] = this.type[from]!;
    this.place[to] = this.place[from]!;
    this.importance[to] = this.importance[from]!;
    this.block[to] = this.block[from]!;
    this.local[to] = this.local[from]!;
    this.group[to] = this.group[from]!;
    this.within[to] = this.within[from]!;
  }

  /** The rows of a block, as a range of rows. */
  private rowsOfBlock(b: number): [number, number] {
    const block = this.block;
    let lo = 0,
      hi = this.n;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (block[mid]! < b) lo = mid + 1;
      else hi = mid;
    }
    const from = lo;
    hi = this.n;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (block[mid]! <= b) lo = mid + 1;
      else hi = mid;
    }
    return [from, lo];
  }

  /**
   * Write again without them, at most `most`, the blocks a share of whose rows are forgotten, each
   * with those after it as far as `rows` fit: what a save keeps and what a read goes through shrink
   * with what is remembered. Returns how many it wrote.
   */
  tidy(most: number, rows: number): number {
    let done = 0;
    for (let b = 0; b < this.blocks.length && done < most; b++) {
      const block = this.blocks[b]!;
      if (block.rows === 0 || block.dead * TIDY_SHARE < block.rows) continue;
      let last = b,
        live = block.rows - block.dead;
      for (; last + 1 < this.blocks.length; last++) {
        const next = this.blocks[last + 1]!;
        if (live + next.rows - next.dead > rows) break;
        live += next.rows - next.dead;
      }
      const from = this.rowsOfBlock(b)[0],
        to = this.rowsOfBlock(last)[1],
        plain: HistoryEvent[] = [];
      for (let r = from; r < to; r++) plain.push(this.plain(r));
      this.blocks[b] = this.write(plain);
      for (let k = b + 1; k <= last; k++) this.blocks[k] = EMPTY_BLOCK;
      const grouped = new GroupPlaces();
      for (let r = from; r < to; r++) {
        this.block[r] = b;
        this.local[r] = r - from;
        grouped.next(this.type[r]!);
        this.group[r] = grouped.group;
        this.within[r] = grouped.within;
        this.raised.delete(this.serial[r]!);
      }
      for (let k = b; k <= last; k++) {
        this.subjectsOf.forget(k);
        this.kidsIn.forget(k);
        this.causesOf.forget(k);
        this.dataOf.forget(k);
      }
      done++;
    }
    return done;
  }

  /** A row as a plain event. */
  plain(r: number): HistoryEvent {
    const place = this.place[r]!;
    return {
      id: refOfCode(this.serial[r]!),
      t: this.t[r]!,
      type: this.words.wordOf(this.type[r]!),
      importance: this.importance[r]!,
      subjects: this.subjects(r),
      place: place < 0 ? null : (this.words.wordOf(place) as Ref),
      causes: this.causes(r),
      data: this.data(r),
    };
  }

  save(): unknown {
    const blocks: unknown[] = [];
    for (let b = 0; b < this.blocks.length; b++) {
      const block = this.blocks[b]!;
      if (block.rows === 0) continue;
      // (Which of its rows are forgotten: those no row now points at.)
      let dead: number[] | undefined;
      if (block.dead) {
        const [from, to] = this.rowsOfBlock(b),
          live = new Uint8Array(block.rows);
        for (let r = from; r < to; r++) live[this.local[r]!] = 1;
        dead = [];
        for (let k = 0; k < block.rows; k++) if (!live[k]) dead.push(k);
      }
      blocks.push(
        dead
          ? [block.head, block.kids, block.causes, block.subjects, block.data, dead]
          : [block.head, block.kids, block.causes, block.subjects, block.data],
      );
    }
    return {
      blocks,
      words: this.words.list,
      raised: [...this.raised].sort((a, b) => a[0] - b[0]),
    };
  }

  load(state: unknown): void {
    const s = state as {
      blocks: readonly (readonly [string, string, string, string, string, number[]?])[];
      words: readonly string[];
      raised: readonly (readonly [number, number])[];
    };
    this.words = new Words(s.words);
    this.raised = new Map(s.raised.map(([a, b]) => [a, b]));
    this.blocks = [];
    this.subjectsOf.clear();
    this.kidsIn.clear();
    this.causesOf.clear();
    this.dataOf.clear();
    this.n = 0;
    for (const [head, kids, causes, subjects, data, dead] of s.blocks) {
      const h = read<EventHead>(head, this.words),
        rows = h.s.length,
        b = this.blocks.length;
      this.blocks.push({ head, kids, causes, subjects, data, rows, dead: dead?.length ?? 0 });
      this.room(this.n + rows);
      const gone = dead ? new Set(dead) : null,
        grouped = new GroupPlaces();
      for (let k = 0; k < rows; k++) {
        grouped.next(h.y[k]!);
        if (gone?.has(k)) continue;
        const r = this.n++;
        this.serial[r] = h.s[k]!;
        this.t[r] = h.t[k]!;
        this.type[r] = h.y[k]!;
        this.place[r] = h.p[k]!;
        this.importance[r] = this.raised.get(h.s[k]!) ?? h.i[k]!;
        this.block[r] = b;
        this.local[r] = k;
        this.group[r] = grouped.group;
        this.within[r] = grouped.within;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Decisions.
// ---------------------------------------------------------------------------

type DecisionBlock = {
  /** Serials, times, rules and subjects. */
  head: string;
  /** Each row's sources that are events or decisions, by code, in the order of its factors. */
  kids: string;
  /** The rest: each rule's outcomes, scores and thresholds, and its factors by name. */
  body: string;
  rows: number;
  dead: number;
};

type DecisionHead = {
  readonly s: readonly number[];
  readonly t: readonly number[];
  readonly y: readonly number[];
  readonly j: readonly Ref[];
};

/** A rule's records in a block. */
type RuleBody = {
  readonly outcome: readonly unknown[];
  readonly threshold: readonly number[];
  /** Each score to two places; 1 where it had to be kept whole, in `whole` (see told). */
  readonly score: readonly number[];
  readonly kept: readonly number[];
  readonly whole: readonly number[];
  /** The lists of its factors' names (by number) its records have, and which each has. */
  readonly lists: readonly (readonly number[])[];
  readonly list: readonly number[];
  /** Its factors by name, each in the order its records come. */
  readonly factors: readonly FactorColumn[];
};

/** A factor of one name, under one rule. */
type FactorColumn = {
  readonly name: number;
  /** Its contribution to two places; 1 where it had to be kept whole, in `whole` (see told). */
  readonly told: readonly number[];
  readonly kept: readonly number[];
  readonly whole: readonly number[];
  /** Its source's role and weight, and what it is if it is no event or decision (0: no source). */
  readonly source: readonly (0 | KeptSource)[];
};

/** A factor's source as a cold record keeps it: `i` is its place in `named` (see there), less one. */
type KeptSource = KeptCause & { readonly i?: number };

/**
 * What a record's outcome names: a source that is no event or decision is mostly one of these (the
 * realm itself, the land it wants, the realm it is against and their rivalry), and need not be
 * written again. Only ever a shorter way to write one: anything else is written as it is.
 */
function named(subject: string, outcome: unknown): string[] {
  const out = [subject];
  if (outcome === null || typeof outcome !== "object" || Array.isArray(outcome)) return out;
  for (const v of Object.values(outcome)) {
    if (typeof v === "number") {
      if (Number.isInteger(v) && v >= 0) out.push(`cell:0:${v}`);
    } else if (typeof v === "string") {
      out.push(v);
      // (As a relation's ref is made: its two sides' numbers, in the order of their refs.)
      const a = subject < v ? subject : v,
        b = subject < v ? v : subject,
        x = a.lastIndexOf(":"),
        y = b.lastIndexOf(":");
      if (x > 0 && y > 0) out.push(`rel:${a.slice(x + 1)}:${b.slice(y + 1)}`);
    }
  }
  return out;
}

/**
 * A sum as a cold record keeps it: to the two places "why" tells it in (causal/why.ts), so that it
 * is told to the letter (with its sign: a sum just under nothing is told "-0.00"). Null where that
 * would not come out the same.
 */
function told(x: number): number | null {
  if (!Number.isFinite(x)) return null;
  const text = x.toFixed(2),
    r = Number(text) + 0;
  return r.toFixed(2) === text && r >= 0 === x >= 0 ? r : null;
}

/**
 * Whether a record's sums, as kept, weigh its sourced factors against each other as they were
 * (a spine of "why" follows the heaviest: a tie must stay a tie, and a lead a lead).
 */
function weighedAlike(factors: readonly Factor[], kept: readonly (number | null)[]): boolean {
  for (let a = 0; a < factors.length; a++) {
    if (!factors[a]!.source) continue;
    const was = Math.abs(factors[a]!.contribution),
      now = Math.abs(kept[a] ?? factors[a]!.contribution);
    for (let b = a + 1; b < factors.length; b++) {
      if (!factors[b]!.source) continue;
      const wasB = Math.abs(factors[b]!.contribution),
        nowB = Math.abs(kept[b] ?? factors[b]!.contribution);
      if (was < wasB !== now < nowB || was > wasB !== now > nowB) return false;
    }
  }
  return true;
}

/** A sum to four places, where two would not weigh a record's factors as they were; or as it was. */
function finer(x: number): number {
  const r = Math.round(x * 10_000) / 10_000 + 0;
  return Number.isFinite(x) && r.toFixed(2) === x.toFixed(2) && r >= 0 === x >= 0 ? r : x;
}

/** The records still warm, as a save keeps them: a block's parts and its words. */
export type WrittenDecisions = readonly [string, string, string, readonly string[]];

/** The cold decisions, oldest first. */
export class ColdDecisions {
  n = 0;
  serial = new Int32Array(1024);
  t = new Float64Array(1024);
  block = new Int32Array(1024);
  local = new Uint16Array(1024);
  blocks: DecisionBlock[] = [];
  words = new Words();
  private heads = new Recent<DecisionHead>();
  private records = new Recent<readonly DecisionRecord[]>();

  private room(n: number): void {
    if (n <= this.serial.length) return;
    const cap = Math.max(n, this.serial.length * 2);
    this.serial = grownInt32(this.serial, cap);
    this.t = grownFloat64(this.t, cap);
    this.block = grownInt32(this.block, cap);
    this.local = grownUint16(this.local, cap);
  }

  rowOf(s: number): number {
    const serial = this.serial;
    let lo = 0,
      hi = this.n - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1,
        v = serial[mid]!;
      if (v === s) return mid;
      if (v < s) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  }

  /** Whether a record may go cold: as the log writes it, so that it reads back as it was. */
  static fits(d: DecisionRecord, last: number): boolean {
    const s = -codeOf(d.id);
    if (s <= last || typeof d.t !== "number" || !Number.isFinite(d.t)) return false;
    if (typeof d.rule !== "string" || typeof d.subject !== "string") return false;
    if (typeof d.score !== "number" || typeof d.threshold !== "number") return false;
    if (!Array.isArray(d.factors)) return false;
    for (const f of d.factors) {
      if (!f || typeof f.name !== "string") return false;
      if (typeof f.contribution !== "number") return false;
      if (f.source !== null) {
        const c = f.source;
        if (!c || typeof c.ref !== "string" || !ROLES.has(c.role) || typeof c.weight !== "number")
          return false;
      }
    }
    return true;
  }

  private write(rows: readonly DecisionRecord[], words = this.words): DecisionBlock {
    const s = new Array<number>(rows.length),
      t = new Array<number>(rows.length),
      y = new Array<number>(rows.length),
      j = new Array<Ref>(rows.length),
      kids = new Array<number[]>(rows.length),
      rules = new Map<
        string,
        {
          outcome: unknown[];
          threshold: number[];
          score: number[];
          kept: number[];
          whole: number[];
          lists: number[][];
          numbers: Map<string, number>;
          list: number[];
          factors: Map<
            string,
            {
              name: number;
              told: number[];
              kept: number[];
              whole: number[];
              source: (0 | KeptSource)[];
            }
          >;
        }
      >();
    for (let k = 0; k < rows.length; k++) {
      const d = rows[k]!;
      s[k] = -codeOf(d.id);
      t[k] = d.t;
      y[k] = words.idOf(d.rule);
      j[k] = d.subject;
      let rule = rules.get(d.rule);
      if (!rule) {
        rule = {
          outcome: [],
          threshold: [],
          score: [],
          kept: [],
          whole: [],
          lists: [],
          numbers: new Map(),
          list: [],
          factors: new Map(),
        };
        rules.set(d.rule, rule);
      }
      rule.outcome.push(d.outcome);
      rule.threshold.push(d.threshold);
      const score = told(d.score);
      if (score !== null) {
        rule.score.push(score);
        rule.kept.push(0);
      } else {
        rule.whole.push(d.score);
        rule.kept.push(1);
      }
      const names: number[] = [],
        codes: number[] = [],
        sums = d.factors.map((f) => told(f.contribution));
      // (Where two places would not weigh them alike, four; failing that, as they were.)
      let known: string[] | undefined,
        whole: readonly number[] | null = null;
      if (!weighedAlike(d.factors, sums)) {
        const fine = d.factors.map((f) => finer(f.contribution));
        whole = weighedAlike(d.factors, fine) ? fine : d.factors.map((f) => f.contribution);
      }
      for (let at = 0; at < d.factors.length; at++) {
        const f = d.factors[at]!,
          name = words.idOf(f.name);
        names.push(name);
        let c = rule.factors.get(f.name);
        if (!c) {
          c = { name, told: [], kept: [], whole: [], source: [] };
          rule.factors.set(f.name, c);
        }
        const sum = whole ? null : sums[at]!;
        if (sum !== null) {
          c.told.push(sum);
          c.kept.push(0);
        } else {
          c.whole.push(whole ? whole[at]! : f.contribution);
          c.kept.push(1);
        }
        if (f.source === null) c.source.push(0);
        else {
          const code = codeOf(f.source.ref);
          if (code !== 0) {
            codes.push(code);
            c.source.push({ r: f.source.role, w: f.source.weight });
          } else {
            const i = (known ??= named(d.subject, d.outcome)).indexOf(f.source.ref);
            c.source.push(
              i >= 0
                ? { r: f.source.role, w: f.source.weight, i }
                : { r: f.source.role, w: f.source.weight, x: f.source.ref },
            );
          }
        }
      }
      const key = names.join(",");
      let list = rule.numbers.get(key);
      if (list === undefined) {
        list = rule.lists.length;
        rule.numbers.set(key, list);
        rule.lists.push(names);
      }
      rule.list.push(list);
      kids[k] = codes;
    }
    return {
      head: text({ s, t, y, j }, words),
      kids: text(kids, words),
      body: JSON.stringify(
        [...rules.values()].map((r) => ({
          outcome: packList(r.outcome, words),
          threshold: packList(r.threshold),
          score: packList(r.score),
          kept: packList(r.kept),
          whole: packList(r.whole),
          lists: packList(r.lists),
          list: packList(r.list),
          factors: [...r.factors.values()].map((c) => ({
            name: c.name,
            told: packList(c.told),
            kept: packList(c.kept),
            whole: packList(c.whole),
            source: packList(c.source, words),
          })),
        })),
      ),
      rows: rows.length,
      dead: 0,
    };
  }

  freeze(rows: readonly DecisionRecord[]): void {
    const b = this.blocks.length;
    this.blocks.push(this.write(rows));
    this.room(this.n + rows.length);
    for (let k = 0; k < rows.length; k++) {
      const r = this.n + k;
      this.serial[r] = -codeOf(rows[k]!.id);
      this.t[r] = rows[k]!.t;
      this.block[r] = b;
      this.local[r] = k;
    }
    this.n += rows.length;
  }

  private headOf(b: number): DecisionHead {
    return this.heads.get(b, () => read<DecisionHead>(this.blocks[b]!.head, this.words));
  }

  /** What a forgotten row leaves behind. */
  ruleOf(row: number): string {
    return this.words.wordOf(this.headOf(this.block[row]!).y[this.local[row]!]!);
  }

  subjectOf(row: number): Ref {
    return this.headOf(this.block[row]!).j[this.local[row]!]!;
  }

  /** Each row's sources that are events or decisions, by code, in a block. */
  kidsOf(b: number): readonly (readonly number[])[] {
    return read<readonly (readonly number[])[]>(this.blocks[b]!.kids, this.words);
  }

  private readBlock(b: number): readonly DecisionRecord[] {
    return this.readParts(this.blocks[b]!, this.headOf(b), this.kidsOf(b), this.words);
  }

  private readParts(
    block: DecisionBlock,
    head: DecisionHead,
    kids: readonly (readonly number[])[],
    words: Words,
  ): DecisionRecord[] {
    const groups = (
        JSON.parse(block.body) as {
          outcome: Packed;
          threshold: Packed;
          score: Packed;
          kept: Packed;
          whole: Packed;
          lists: Packed;
          list: Packed;
          factors: {
            name: number;
            told: Packed;
            kept: Packed;
            whole: Packed;
            source: Packed;
          }[];
        }[]
      ).map((r) => ({
        outcome: unpackList(r.outcome, words),
        threshold: unpackList(r.threshold) as number[],
        score: unpackList(r.score) as number[],
        kept: unpackList(r.kept) as number[],
        whole: unpackList(r.whole) as number[],
        lists: unpackList(r.lists) as number[][],
        list: unpackList(r.list) as number[],
        factors: new Map(
          r.factors.map((c) => [
            c.name,
            {
              told: unpackList(c.told) as number[],
              kept: unpackList(c.kept) as number[],
              whole: unpackList(c.whole) as number[],
              source: unpackList(c.source, words) as (0 | KeptSource)[],
              row: 0,
              sums: 0,
              wholes: 0,
            },
          ]),
        ),
        row: 0,
        scores: 0,
        wholes: 0,
      })),
      groupOf = new Map<number, number>(),
      out = new Array<DecisionRecord>(head.s.length);
    for (let k = 0; k < head.s.length; k++) {
      let g = groupOf.get(head.y[k]!);
      if (g === undefined) {
        g = groupOf.size;
        groupOf.set(head.y[k]!, g);
      }
      const rule = groups[g]!,
        at = rule.row++,
        codes = kids[k]!,
        outcome = rule.outcome[at];
      let next = 0,
        known: string[] | undefined;
      const factors = rule.lists[rule.list[at]!]!.map((name): Factor => {
        const c = rule.factors.get(name)!,
          n = c.row++,
          kept = c.source[n]!,
          contribution = c.kept[n] ? c.whole[c.wholes++]! : c.told[c.sums++]!;
        let source: Factor["source"] = null;
        if (kept) {
          const ref =
            kept.x !== undefined
              ? kept.x
              : kept.i !== undefined
                ? (known ??= named(head.j[k]!, outcome))[kept.i]!
                : refOfCode(codes[next++]!);
          source = { ref: ref as Ref, role: kept.r as CauseRole, weight: kept.w };
        }
        return { name: words.wordOf(name), value: contribution, contribution, source };
      });
      out[k] = {
        id: refOfCode(-head.s[k]!),
        t: head.t[k]!,
        rule: words.wordOf(head.y[k]!),
        subject: head.j[k]!,
        outcome,
        score: rule.kept[at] ? rule.whole[rule.wholes++]! : rule.score[rule.scores++]!,
        threshold: rule.threshold[at]!,
        factors,
      };
    }
    return out;
  }

  /** A row as its record. */
  record(row: number): DecisionRecord {
    const b = this.block[row]!;
    return this.records.get(b, () => this.readBlock(b))[this.local[row]!]!;
  }

  /**
   * The records still warm as a save keeps them: as a block is written, with its own words (a save
   * changes nothing), so that all a save holds of a decision is what "why" tells. Null if one of them
   * would not read back so (then they are saved as they are).
   */
  written(rows: readonly DecisionRecord[]): WrittenDecisions | null {
    if (!rows.length) return null;
    let last = 0;
    for (const d of rows) {
      if (!ColdDecisions.fits(d, last)) return null;
      last = -codeOf(d.id);
    }
    const words = new Words(),
      block = this.write(rows, words);
    return [block.head, block.kids, block.body, words.list];
  }

  /** What `written` wrote. */
  unwritten(kept: WrittenDecisions): DecisionRecord[] {
    const words = new Words(kept[3]),
      head = read<DecisionHead>(kept[0], words),
      kids = read<readonly (readonly number[])[]>(kept[1], words);
    return this.readParts(
      { head: kept[0], kids: kept[1], body: kept[2], rows: head.s.length, dead: 0 },
      head,
      kids,
      words,
    );
  }

  move(from: number, to: number): void {
    this.serial[to] = this.serial[from]!;
    this.t[to] = this.t[from]!;
    this.block[to] = this.block[from]!;
    this.local[to] = this.local[from]!;
  }

  private rowsOfBlock(b: number): [number, number] {
    const block = this.block;
    let lo = 0,
      hi = this.n;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (block[mid]! < b) lo = mid + 1;
      else hi = mid;
    }
    const from = lo;
    hi = this.n;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (block[mid]! <= b) lo = mid + 1;
      else hi = mid;
    }
    return [from, lo];
  }

  /** Write again, at most `most`, the blocks a share of whose rows are forgotten: see ColdEvents.tidy. */
  tidy(most: number, rows: number): number {
    let done = 0;
    for (let b = 0; b < this.blocks.length && done < most; b++) {
      const block = this.blocks[b]!;
      if (block.rows === 0 || block.dead * TIDY_SHARE < block.rows) continue;
      let last = b,
        live = block.rows - block.dead;
      for (; last + 1 < this.blocks.length; last++) {
        const next = this.blocks[last + 1]!;
        if (live + next.rows - next.dead > rows) break;
        live += next.rows - next.dead;
      }
      const from = this.rowsOfBlock(b)[0],
        to = this.rowsOfBlock(last)[1],
        records: DecisionRecord[] = [];
      for (let r = from; r < to; r++) records.push(this.record(r));
      this.blocks[b] = this.write(records);
      for (let k = b + 1; k <= last; k++)
        this.blocks[k] = { head: "", kids: "", body: "", rows: 0, dead: 0 };
      for (let r = from; r < to; r++) {
        this.block[r] = b;
        this.local[r] = r - from;
      }
      for (let k = b; k <= last; k++) {
        this.heads.forget(k);
        this.records.forget(k);
      }
      done++;
    }
    return done;
  }

  save(): unknown {
    const blocks: unknown[] = [];
    for (let b = 0; b < this.blocks.length; b++) {
      const block = this.blocks[b]!;
      if (block.rows === 0) continue;
      let dead: number[] | undefined;
      if (block.dead) {
        const [from, to] = this.rowsOfBlock(b),
          live = new Uint8Array(block.rows);
        for (let r = from; r < to; r++) live[this.local[r]!] = 1;
        dead = [];
        for (let k = 0; k < block.rows; k++) if (!live[k]) dead.push(k);
      }
      blocks.push(
        dead ? [block.head, block.kids, block.body, dead] : [block.head, block.kids, block.body],
      );
    }
    return { blocks, words: this.words.list };
  }

  load(state: unknown): void {
    const s = state as {
      blocks: readonly (readonly [string, string, string, number[]?])[];
      words: readonly string[];
    };
    this.words = new Words(s.words);
    this.blocks = [];
    this.heads.clear();
    this.records.clear();
    this.n = 0;
    for (const [head, kids, body, dead] of s.blocks) {
      const h = read<DecisionHead>(head, this.words),
        rows = h.s.length,
        b = this.blocks.length;
      this.blocks.push({ head, kids, body, rows, dead: dead?.length ?? 0 });
      this.room(this.n + rows);
      const gone = dead ? new Set(dead) : null;
      for (let k = 0; k < rows; k++) {
        if (gone?.has(k)) continue;
        const r = this.n++;
        this.serial[r] = h.s[k]!;
        this.t[r] = h.t[k]!;
        this.block[r] = b;
        this.local[r] = k;
      }
    }
  }
}
