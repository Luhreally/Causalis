// Lists packed by column, for saves (docs/architecture §33). The longest parts of a save are
// lists of records of a few kinds (history's events and decisions, a ledger's years, the battles
// of the wars), and written out as JSON each record repeats its keys and spells out its numbers
// among everything else, so gzip finds little to fold. Packed, a list is kept by column: its
// whole numbers as varints in text (or each less the one before, where that is shorter), its
// strings once each in a table (references by their kind and number, each number less the last
// of its kind), its objects of each shape as a column for each key, and its arrays as their
// lengths and their items. Unpacked, it is the list JSON would have given back, value for value
// and key for key: nothing is rounded, reordered or dropped.

/** A list packed by packList. Which fields are present says how its values were kept. */
export type Packed = {
  /** How many values. */
  readonly n: number;
  /** Each value's kind (varints), where they are of more than one. */
  readonly k?: string;
  /** The whole numbers: as varints (`i`), or each less the one before (`d`). */
  readonly i?: string;
  readonly d?: string;
  /** The strings: a table of them, and each one's place in it. */
  readonly s?: StringTable;
  /** The objects: each shape's keys, each object's shape where there are several, each shape's columns. */
  readonly o?: readonly (readonly string[])[];
  readonly g?: string;
  readonly c?: readonly (readonly Packed[])[];
  /** The arrays: their lengths, and their items as a column for each place (`t`) or one list (`e`). */
  readonly a?: string;
  readonly t?: readonly Packed[];
  readonly e?: Packed;
  /** The rest, as they are (numbers not whole or too large, true and false, null). */
  readonly r?: readonly unknown[];
};

/**
 * A column's strings, each once, in the order first met: references (`kind:a:b`, as the minter
 * and the structural refs write them) by their kind and their number less the last of that kind,
 * the rest as text; and each value's place in the table.
 */
type StringTable = {
  /** The kinds of the references, in the order first met. */
  readonly f?: readonly string[];
  /** Each entry's kind (varints), where there are several: f.length for one taken from `w`. */
  readonly h?: string;
  /** Each reference's number less the last of its kind's (signed varints). */
  readonly b?: string;
  /** The entries that are not references. */
  readonly w?: readonly string[];
  /** Each value's place in the table. */
  readonly x: Packed;
};

const INT = 0,
  STR = 1,
  OBJ = 2,
  ARR = 3,
  RAW = 4;

/** Whole numbers kept as varints are at most this large either way (their differences stay safe). */
const MAX_INT = 2 ** 50;
const TWO32 = 4294967296;
/** Arrays no longer than this are kept by place (each place a column), longer ones item by item. */
const TUPLE = 16;

/** Varints in text: the first 32 letters end a number, the next 32 carry on (five bits each, lowest first). */
const DIGITS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const CODES = new Uint8Array(64).map((_, i) => DIGITS.charCodeAt(i));
const VALUE_OF = new Int8Array(128).fill(-1);
for (let i = 0; i < 64; i++) VALUE_OF[DIGITS.charCodeAt(i)] = i;

/** Zigzag: 0, −1, 1, −2 … as 0, 1, 2, 3 … */
function zig(v: number): number {
  return v < 0 ? -2 * v - 1 : 2 * v;
}

/** How many letters a whole number takes as a varint. */
function width(u: number): number {
  let n = 1;
  while (u >= 32) {
    u = Math.floor(u / 32);
    n++;
  }
  return n;
}

/** Varints written into text, a letter at a time. */
class Varints {
  private codes: Uint8Array;
  private n = 0;

  constructor(room = 1024) {
    this.codes = new Uint8Array(Math.max(16, room));
  }

  /** A whole number, zero or more. */
  push(u: number): void {
    if (this.n + 11 > this.codes.length) {
      const grown = new Uint8Array(this.codes.length * 2);
      grown.set(this.codes);
      this.codes = grown;
    }
    while (u >= 32) {
      this.codes[this.n++] = CODES[32 + (u % 32)]!;
      u = Math.floor(u / 32);
    }
    this.codes[this.n++] = CODES[u]!;
  }

  text(): string {
    let out = "";
    for (let at = 0; at < this.n; at += 4096)
      out += String.fromCharCode.apply(
        null,
        this.codes.subarray(at, Math.min(this.n, at + 4096)) as unknown as number[],
      );
    return out;
  }
}

/** The numbers in a text of varints (signed: zigzagged, as zig wrote them). */
function readVarints(text: string, signed: boolean): number[] {
  // (Counted first, by the letters that end a number: A–Z and a–f.)
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 102)) count++;
  }
  const out = new Array<number>(count);
  let value = 0,
    scale = 1,
    at = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i),
      v = c < 128 ? VALUE_OF[c]! : -1;
    if (v < 0) throw new Error(`a packed column has ${JSON.stringify(text[i])} among its numbers`);
    if (v >= 32) {
      value += (v - 32) * scale;
      scale *= 32;
      continue;
    }
    value += v * scale;
    out[at++] = signed ? (value % 2 === 0 ? value / 2 : -(value + 1) / 2) : value;
    value = 0;
    scale = 1;
  }
  if (scale !== 1) throw new Error("a packed column ends inside a number");
  return out;
}

/**
 * An object's keys if JSON keeps it as a plain object, every key with its value (none undefined,
 * a function or a symbol, which JSON leaves out) and none of them `__proto__`; null otherwise,
 * and the object is kept as it is, for JSON to write as it always would.
 */
function plainKeys(v: object): string[] | null {
  const proto = Object.getPrototypeOf(v) as unknown;
  if (proto !== Object.prototype && proto !== null) return null;
  const keys = Object.keys(v);
  for (const key of keys) {
    const x = (v as Record<string, unknown>)[key];
    if (key === "__proto__" || x === undefined || typeof x === "function" || typeof x === "symbol")
      return null;
  }
  return keys;
}

/** Whole numbers into `out`: as themselves or as each less the one before, whichever is shorter. */
function packInts(values: ArrayLike<number>, out: Record<string, unknown>): void {
  let plain = 0,
    steps = 0,
    before = 0;
  for (let j = 0; j < values.length; j++) {
    const v = values[j]!;
    plain += width(zig(v));
    steps += width(zig(v - before));
    before = v;
  }
  const text = new Varints(Math.min(plain, steps));
  before = 0;
  if (steps < plain) {
    for (let j = 0; j < values.length; j++) {
      const v = values[j]!;
      text.push(zig(v - before));
      before = v;
    }
    out.d = text.text();
  } else {
    for (let j = 0; j < values.length; j++) text.push(zig(values[j]!));
    out.i = text.text();
  }
}

function unpackInts(p: Packed): number[] {
  if (p.d === undefined) return readVarints(p.i ?? "", true);
  const values = readVarints(p.d, true);
  for (let j = 1; j < values.length; j++) values[j] = values[j]! + values[j - 1]!;
  return values;
}

/** A reference: `kind:a:b`, its parts written without leading zeros. */
const REF = /^([a-z]{2,5}):(0|[1-9][0-9]{0,9}):(0|[1-9][0-9]{0,9})$/;

function packStrings(values: readonly string[]): StringTable {
  const at = new Map<string, number>(),
    places: number[] = new Array<number>(values.length),
    entries: string[] = [];
  for (let j = 0; j < values.length; j++) {
    const v = values[j]!;
    let p = at.get(v);
    if (p === undefined) {
      at.set(v, (p = entries.length));
      entries.push(v);
    }
    places[j] = p;
  }
  const x: Record<string, unknown> = { n: places.length },
    kinds: string[] = [],
    kindAt = new Map<string, number>(),
    last: number[] = [],
    marks: number[] = [],
    steps = new Varints(entries.length * 2),
    w: string[] = [];
  for (const entry of entries) {
    const m = REF.exec(entry),
      a = m ? Number(m[2]) : 0,
      b = m ? Number(m[3]) : 0,
      number = a * TWO32 + b;
    if (!m || a >= TWO32 || b >= TWO32 || number > MAX_INT) {
      marks.push(-1);
      w.push(entry);
      continue;
    }
    let k = kindAt.get(m[1]!);
    if (k === undefined) {
      kindAt.set(m[1]!, (k = kinds.length));
      kinds.push(m[1]!);
      last.push(0);
    }
    marks.push(k);
    steps.push(zig(number - last[k]!));
    last[k] = number;
  }
  packInts(places, x);
  if (!kinds.length) return { w, x: x as Packed };
  const t: Record<string, unknown> = { f: kinds, b: steps.text(), x };
  if (kinds.length > 1 || w.length) {
    const h = new Varints(marks.length);
    for (const k of marks) h.push(k < 0 ? kinds.length : k);
    t.h = h.text();
  }
  if (w.length) t.w = w;
  return t as StringTable;
}

function unpackStrings(t: StringTable): string[] {
  let entries: readonly string[];
  if (!t.f) entries = t.w ?? [];
  else {
    const kinds = t.f,
      steps = readVarints(t.b ?? "", true),
      marks = t.h !== undefined ? readVarints(t.h, false) : null,
      last = kinds.map(() => 0),
      rest = t.w ?? [],
      made: string[] = [];
    let s = 0,
      r = 0;
    for (let e = 0, count = marks ? marks.length : steps.length; e < count; e++) {
      const k = marks ? marks[e]! : 0;
      if (k >= kinds.length) {
        made.push(rest[r++]!);
        continue;
      }
      const number = (last[k] = last[k]! + steps[s++]!);
      made.push(`${kinds[k]}:${Math.floor(number / TWO32)}:${number % TWO32}`);
    }
    entries = made;
  }
  const places = unpackList(t.x) as number[],
    out = new Array<string>(places.length);
  for (let j = 0; j < places.length; j++) {
    const v = entries[places[j]!];
    if (v === undefined) throw new Error("a packed column names a string it does not hold");
    out[j] = v;
  }
  return out;
}

/**
 * A list of JSON values packed by column (see Packed): unpackList gives back the list that
 * JSON.parse(JSON.stringify(values)) would.
 */
export function packList(values: readonly unknown[]): Packed {
  const n = values.length,
    out: Record<string, unknown> = { n },
    kinds = new Uint8Array(n),
    // (Each object's keys, as they were read: the objects' shapes.)
    shapes: string[][] = [];
  let seen = 0;
  for (let j = 0; j < n; j++) {
    const v = values[j];
    let k = RAW;
    if (typeof v === "number") k = Number.isSafeInteger(v) && Math.abs(v) <= MAX_INT ? INT : RAW;
    else if (typeof v === "string") k = STR;
    else if (typeof v === "object" && v !== null)
      if (Array.isArray(v)) k = ARR;
      else {
        const keys = plainKeys(v);
        if (keys) {
          k = OBJ;
          shapes.push(keys);
        }
      }
    kinds[j] = k;
    seen |= 1 << k;
  }
  if (!n) return out as Packed;
  const one = (seen & (seen - 1)) === 0,
    of = <T>(kind: number): T[] =>
      (one ? values : values.filter((_, j) => kinds[j] === kind)) as T[];
  if (!one) {
    const marks = new Varints(n);
    for (let j = 0; j < n; j++) marks.push(kinds[j]!);
    out.k = marks.text();
  }
  if (seen & (1 << INT)) packInts(of<number>(INT), out);
  if (seen & (1 << STR)) out.s = packStrings(of<string>(STR));
  if (seen & (1 << OBJ)) packObjects(of<Record<string, unknown>>(OBJ), shapes, out);
  if (seen & (1 << ARR)) packArrays(of<unknown[]>(ARR), out);
  if (seen & (1 << RAW)) out.r = of<unknown>(RAW);
  return out as Packed;
}

/** Objects by shape (their keys, in order), each shape's values a column for each key. */
function packObjects(
  objects: readonly Record<string, unknown>[],
  keysOf: readonly string[][],
  out: Record<string, unknown>,
): void {
  const shapes: string[][] = [],
    shapeAt = new Map<string, number>(),
    columns: unknown[][][] = [],
    marks = new Varints(objects.length);
  let last = -1;
  for (let j = 0; j < objects.length; j++) {
    const v = objects[j]!,
      keys = keysOf[j]!;
    let s = last;
    if (s < 0 || !sameKeys(keys, shapes[s]!)) {
      const id = JSON.stringify(keys);
      s = shapeAt.get(id) ?? -1;
      if (s < 0) {
        shapeAt.set(id, (s = shapes.length));
        shapes.push(keys);
        columns.push(keys.map(() => []));
      }
    }
    last = s;
    const cols = columns[s]!;
    for (let q = 0; q < keys.length; q++) cols[q]!.push(v[keys[q]!]);
    marks.push(s);
  }
  out.o = shapes;
  if (shapes.length > 1) out.g = marks.text();
  out.c = columns.map((cols) => cols.map(packList));
}

function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) return false;
  return true;
}

/**
 * Arrays as their lengths and their items: short ones a column for each place (the first items of
 * all, then the second …), as pairs and rows of counts are read; long ones as one list.
 */
function packArrays(arrays: readonly unknown[][], out: Record<string, unknown>): void {
  const lengths = new Varints(arrays.length);
  let most = 0,
    total = 0;
  for (const a of arrays) {
    lengths.push(a.length);
    most = Math.max(most, a.length);
    total += a.length;
  }
  out.a = lengths.text();
  // (A hole is read as undefined, which JSON writes as null, as it would in the array.)
  if (most > TUPLE) {
    const items = new Array<unknown>(total);
    let at = 0;
    for (const a of arrays) for (let j = 0; j < a.length; j++) items[at++] = a[j];
    out.e = packList(items);
    return;
  }
  const places: unknown[][] = Array.from({ length: most }, () => []);
  for (const a of arrays) for (let j = 0; j < a.length; j++) places[j]!.push(a[j]);
  out.t = places.map(packList);
}

/** The values packList packed. */
export function unpackList(p: Packed): unknown[] {
  const n = p.n,
    kinds = p.k !== undefined ? readVarints(p.k, false) : null,
    only = kinds
      ? -1
      : p.i !== undefined || p.d !== undefined
        ? INT
        : p.s
          ? STR
          : p.o
            ? OBJ
            : p.a !== undefined
              ? ARR
              : RAW;
  if (kinds && kinds.length !== n) throw new Error("a packed column's kinds are not its values'");
  const counts = [0, 0, 0, 0, 0];
  if (kinds) for (const k of kinds) counts[k]!++;
  else if (n) counts[only] = n;
  const from = (k: number): unknown[] => {
    if (!counts[k]) return [];
    const got =
      k === INT
        ? unpackInts(p)
        : k === STR
          ? unpackStrings(p.s!)
          : k === OBJ
            ? unpackObjects(p, counts[k])
            : k === ARR
              ? unpackArrays(p)
              : [...(p.r ?? [])];
    if (got.length !== counts[k]) throw new Error("a packed column's values do not add up");
    return got;
  };
  if (!kinds) return from(only);
  const lists = [0, 1, 2, 3, 4].map(from),
    out = new Array<unknown>(n),
    next = [0, 0, 0, 0, 0];
  for (let j = 0; j < n; j++) {
    const k = kinds[j]!;
    out[j] = lists[k]![next[k]!++];
  }
  return out;
}

function unpackObjects(p: Packed, count: number): Record<string, unknown>[] {
  const shapes = p.o!,
    columns = p.c!.map((cols) => cols.map(unpackList)),
    marks = p.g !== undefined ? readVarints(p.g, false) : null,
    next = shapes.map(() => 0),
    out = new Array<Record<string, unknown>>(count);
  for (let j = 0; j < count; j++) {
    const s = marks ? marks[j]! : 0,
      keys = shapes[s]!,
      cols = columns[s]!,
      at = next[s]!++,
      v: Record<string, unknown> = {};
    for (let q = 0; q < keys.length; q++) {
      const key = keys[q]!;
      // (packList never writes it, but read as JSON reads it: a key of its own, not the prototype.)
      if (key === "__proto__")
        Object.defineProperty(v, key, {
          value: cols[q]![at],
          enumerable: true,
          writable: true,
          configurable: true,
        });
      else v[key] = cols[q]![at];
    }
    out[j] = v;
  }
  return out;
}

function unpackArrays(p: Packed): unknown[][] {
  const lengths = readVarints(p.a!, false),
    out = new Array<unknown[]>(lengths.length);
  if (p.e) {
    const all = unpackList(p.e);
    let at = 0;
    for (let j = 0; j < lengths.length; j++) {
      const n = lengths[j]!;
      out[j] = all.slice(at, at + n);
      at += n;
    }
    return out;
  }
  const places = (p.t ?? []).map(unpackList),
    next = places.map(() => 0);
  for (let j = 0; j < lengths.length; j++) {
    const n = lengths[j]!,
      a = new Array<unknown>(n);
    for (let q = 0; q < n; q++) a[q] = places[q]![next[q]!++];
    out[j] = a;
  }
  return out;
}
