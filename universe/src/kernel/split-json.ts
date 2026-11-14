// A value too large to be one string, written and read as JSON in pieces (2026-11-13: a world of 162 million people
// could not be kept, "Invalid string length": an engine's strings end near half a billion characters, and its save as
// one text was longer). What fits is one text as it always was. What does not is cut where it is too large: a
// container keeps what fits of its children in its own text and leaves the rest out, and each run left out is a
// record of its own, saying where it goes. A reader takes the last text first (the whole, with its holes) and fills
// the holes from the records, last to first, so every hole's container is there before what goes into it. Nothing of
// the value changes: an object's keys stay in their order (every key stays in its own text, a hole's value null
// until filled), an array's places are filled by their numbers.

/** The longest text one piece is let be: well under an engine's longest string. */
export const PIECE_MOST = 96 * 1024 * 1024;

/** Where a record's values go: an array's places from `i`, or an object's `k` keys. */
type Fill =
  | { readonly p: readonly (string | number)[]; readonly i: number; readonly v: unknown[] }
  | { readonly p: readonly (string | number)[]; readonly k: string[]; readonly v: unknown[] };

/** Too long to be one string. */
const TOO_LONG = Symbol("too long");
/** A value's JSON text; "null" for what JSON has no text for; TOO_LONG where an engine's strings end. */
const plain = (value: unknown): string | typeof TOO_LONG => {
  try {
    return JSON.stringify(value) ?? "null";
  } catch (error) {
    if (error instanceof RangeError) return TOO_LONG;
    throw error;
  }
};

/**
 * A value as JSON texts: the records of what was left out, then the whole with its holes, last. One text alone when
 * it fits `most` characters. `emit` is given each text as it is ready, so no more than a piece is held at once.
 */
export async function splitJson(
  value: unknown,
  emit: (text: string) => void | Promise<void>,
  most = PIECE_MOST,
): Promise<void> {
  await emit(await piece(value, [], emit, most, false));
}

async function piece(
  value: unknown,
  path: readonly (string | number)[],
  emit: (text: string) => void | Promise<void>,
  most: number,
  known: boolean,
): Promise<string> {
  // (Whole, where it fits; `known` too large already, it is not tried again.)
  if (!known) {
    const whole = plain(value);
    if (whole !== TOO_LONG && whole.length <= most) return whole;
    if (value === null || typeof value !== "object") {
      if (whole === TOO_LONG)
        throw new RangeError("a single text of a save is longer than an engine's longest string");
      return whole;
    }
  }
  const inlineMost = most >> 2,
    batchMost = most >> 1,
    head = JSON.stringify(path);
  // (What it would be to JSON: its own toJSON's answer.)
  const own =
    typeof (value as { toJSON?: unknown }).toJSON === "function"
      ? (value as { toJSON: () => unknown }).toJSON()
      : value;
  if (own === null || typeof own !== "object") {
    const text = plain(own);
    if (text === TOO_LONG)
      throw new RangeError("a single text of a save is longer than an engine's longest string");
    return text;
  }
  if (Array.isArray(own)) {
    const inline: string[] = [];
    let size = 2,
      full = false,
      batch: string[] = [],
      batchAt = 0,
      batchSize = 0;
    const flush = async () => {
      if (!batch.length) return;
      await emit(`{"p":${head},"i":${batchAt},"v":[${batch.join(",")}]}`);
      batch = [];
      batchSize = 0;
    };
    for (let i = 0; i < own.length; i++) {
      const text = await piece(own[i], [...path, i], emit, most, false);
      if (!full && size + text.length + 1 <= inlineMost) {
        inline.push(text);
        size += text.length + 1;
        continue;
      }
      full = true;
      if (batch.length && batchSize + text.length + 1 > batchMost) await flush();
      if (!batch.length) batchAt = i;
      batch.push(text);
      batchSize += text.length + 1;
    }
    await flush();
    return `[${inline.join(",")}]`;
  }
  const parts: string[] = [];
  let size = 2,
    keys: string[] = [],
    batch: string[] = [],
    batchSize = 0;
  const flush = async () => {
    if (!batch.length) return;
    await emit(`{"p":${head},"k":${JSON.stringify(keys)},"v":[${batch.join(",")}]}`);
    keys = [];
    batch = [];
    batchSize = 0;
  };
  for (const key of Object.keys(own)) {
    const child = (own as Record<string, unknown>)[key];
    // (As JSON has it: what is undefined, a function or a symbol is no key of the text.)
    if (child === undefined || typeof child === "function" || typeof child === "symbol") continue;
    const text = await piece(child, [...path, key], emit, most, false),
      name = JSON.stringify(key);
    if (size + name.length + text.length + 2 <= inlineMost) {
      parts.push(`${name}:${text}`);
      size += name.length + text.length + 2;
      continue;
    }
    // (Its key stays in its place, so the keys keep their order; its value comes in a record.)
    parts.push(`${name}:null`);
    size += name.length + 6;
    if (batch.length && batchSize + text.length + 1 > batchMost) await flush();
    keys.push(key);
    batch.push(text);
    batchSize += text.length + 1;
  }
  await flush();
  return `{${parts.join(",")}}`;
}

/** The value splitJson wrote, from its texts in the order they were written. */
export function joinJson(texts: readonly string[]): unknown {
  if (!texts.length) throw new SyntaxError("no text to read");
  const root = JSON.parse(texts[texts.length - 1]!) as unknown;
  for (let n = texts.length - 2; n >= 0; n--) {
    const fill = JSON.parse(texts[n]!) as Fill;
    let at = root as Record<string | number, unknown>;
    for (const step of fill.p) at = at[step] as Record<string | number, unknown>;
    if (at === null || typeof at !== "object")
      throw new SyntaxError("a record of a split text has nowhere to go");
    if ("k" in fill) fill.k.forEach((key, j) => (at[key] = fill.v[j]));
    else for (let j = 0; j < fill.v.length; j++) at[fill.i + j] = fill.v[j];
  }
  return root;
}

/**
 * What JSON.parse(JSON.stringify(value)) gives, made without the text: for a value whose text would be longer than
 * an engine's longest string.
 */
export function jsonCopy(value: unknown): unknown {
  const copy = (v: unknown, inArray: boolean): unknown => {
    if (
      v !== null &&
      typeof v === "object" &&
      typeof (v as { toJSON?: unknown }).toJSON === "function"
    )
      v = (v as { toJSON: () => unknown }).toJSON();
    if (v === null) return null;
    switch (typeof v) {
      case "number":
        // (As JSON writes it: no sign on a nought.)
        return Number.isFinite(v) ? (v === 0 ? 0 : v) : null;
      case "string":
      case "boolean":
        return v;
      case "bigint":
        throw new TypeError("Do not know how to serialize a BigInt");
      case "object": {
        if (Array.isArray(v)) return v.map((x) => copy(x, true) ?? null);
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(v)) {
          const c = copy((v as Record<string, unknown>)[key], false);
          if (c !== undefined) out[key] = c;
        }
        return out;
      }
      default:
        return inArray ? null : undefined;
    }
  };
  return copy(value, false);
}
