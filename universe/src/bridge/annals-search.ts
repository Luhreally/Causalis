// A search of the years (asked 2026-11-16: "let me type events or names or cities or realms and a lot more on
// the years tab"). The page says what is asked; the host reads the whole log for it (host/inspect/annals-search.ts),
// the minor events the annals leave out included. What is here is pure, so the page and the host fold words alike.
import type { AnnalLine } from "./annals.ts";

/** What a typed filter names: a thing by its name, or a kind of event. */
export type AnnalKey =
  | "realm"
  | "town"
  | "person"
  | "house"
  | "land"
  | "faith"
  | "tongue"
  | "people"
  | "good"
  | "war"
  | "beast"
  | "kind"
  | "about";

/** One filter: a key and the words given it; tapped from a name or a suggestion, the very thing it is. */
export type AnnalFilter = {
  readonly key: AnnalKey;
  readonly value: string;
  readonly ref?: string;
};

/** A search of the years, as asked. */
export type AnnalsAsk = {
  /** Free words (or "phrases"), each to be found somewhere in a line: its words, its kind, its names. */
  readonly words: readonly string[];
  readonly filters: readonly AnnalFilter[];
  /** Only lines of these kinds (ANNAL_KINDS' places); none: any. */
  readonly only: readonly number[];
  readonly from: number | null;
  readonly to: number | null;
};

/** What the page asks the host for: a search, read on from `after` (a cursor the host gave). */
export type AnnalsSearchArgs = AnnalsAsk & {
  /** The page's sitting: what the host reads once for a search (its names) is kept for that long. */
  readonly session: number;
  readonly newest: boolean;
  /** The most lines a page of it holds. */
  readonly limit?: number;
  readonly after?: number | null;
};

/** A line found: as the Years tell a line, and whether the annals would ever tell it themselves. */
export type AnnalFound = AnnalLine & {
  readonly minor: boolean;
  /** What kind of event it is, in words ("A cartel"): what a word asked may have matched. */
  readonly what: string;
};

/** What a search found: its lines by year, in the order asked, and how far the reading went. */
export type AnnalsFound = {
  readonly years: readonly { readonly year: number; readonly lines: readonly AnnalFound[] }[];
  /** Lines that answer: in all the log if `whole`, else those met before the reading stopped. */
  readonly matched: number;
  readonly whole: boolean;
  /** Where "more" reads on from; null: nothing more. */
  readonly next: number | null;
  /** The year the reading came to. */
  readonly reached: number | null;
  /** The words to mark in a line, folded. */
  readonly terms: readonly string[];
  /** How many events were read, and in how long. */
  readonly scanned: number;
  readonly ms: number;
};

/** A thing by its name, offered as a person types. */
export type AnnalName = {
  readonly key: AnnalKey;
  readonly ref: string | null;
  /** The words a filter is given. */
  readonly name: string;
  /** What is shown. */
  readonly title: string;
  readonly icon: string;
  readonly note: string;
};

/** The words a person may type before a colon, and what each filters by. */
export const ANNAL_KEYS: Readonly<Record<string, AnnalKey>> = {
  realm: "realm",
  nation: "realm",
  state: "realm",
  town: "town",
  city: "town",
  village: "town",
  person: "person",
  who: "person",
  ruler: "person",
  name: "person",
  house: "house",
  family: "house",
  dynasty: "house",
  household: "house",
  land: "land",
  place: "land",
  where: "land",
  faith: "faith",
  belief: "faith",
  religion: "faith",
  tongue: "tongue",
  language: "tongue",
  people: "people",
  folk: "people",
  good: "good",
  goods: "good",
  item: "good",
  war: "war",
  beast: "beast",
  species: "beast",
  kind: "kind",
  type: "kind",
  event: "kind",
  about: "about",
};

/** The words for each of the annals' kinds (ANNAL_KINDS' places), for "only firsts", "only:wars". */
export const ANNAL_RANKS: Readonly<Record<string, number>> = {
  war: 0,
  wars: 0,
  fall: 0,
  falls: 0,
  first: 1,
  firsts: 1,
  knowledge: 1,
  sorrow: 2,
  sorrows: 2,
  disaster: 2,
  disasters: 2,
  sickness: 2,
  people: 3,
  rulers: 3,
  ruler: 3,
  star: 4,
  stars: 4,
};

/** Words as they are matched: no case, no accents, one kind of apostrophe. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[‘’`]/g, "'");
}

const WORDY = /[\p{L}\p{N}]/u;
const wordy = (c: string | undefined) => c !== undefined && WORDY.test(c);

/** Whether folded words hold a folded term at the start of a word ("cart" holds in "a cartel", not in "decart"). */
export function holds(text: string, term: string): boolean {
  if (!term) return true;
  for (let at = text.indexOf(term); at >= 0; at = text.indexOf(term, at + 1))
    if (!wordy(text[at - 1]) || !wordy(term[0])) return true;
  return false;
}

/** Whether folded words hold a folded name whole ("asha", not in "ashara"). */
export function holdsWhole(text: string, name: string): boolean {
  if (!name) return false;
  for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + 1))
    if (!wordy(text[at - 1]) && !wordy(text[at + name.length])) return true;
  return false;
}

/** A word as a term: folded, without what stands around it ("war," is war). */
export function termOf(word: string): string {
  return fold(word)
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .trim();
}

/** A year range in a word: "1200-1500", "1200-", "-1500" (to 1500), "-50..30" (years before the first). */
function rangeOf(word: string): [number | null, number | null] | null {
  const m =
    /^(\d{1,6})?\s*(?:-|–|\.\.)\s*(\d{1,6})?$/.exec(word) ??
    /^(-?\d{1,6})?\.\.(-?\d{1,6})?$/.exec(word);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  const a = m[1] === undefined ? null : Number(m[1]),
    b = m[2] === undefined ? null : Number(m[2]);
  return a !== null && b !== null && b < a ? [b, a] : [a, b];
}

const yearOf = (v: string) => (/^-?\d{1,6}$/.test(v.trim()) ? Number(v) : null);

/** The tokens of what is typed: key:"quoted value", key:value, "quoted words", or a word. */
const TOKEN = /([^\s:"]+):"([^"]*)"?|([^\s:"]+):(\S*)|"([^"]*)"?|(\S+)/g;

/**
 * What a person typed, as asked: free words; `key:value` (realm:Asha, town:"New Kirath", kind:war); `only:firsts`
 * or "only firsts"; a year (1250) or a range (1200-1500, from:1200, to:1500, before:, after:); "quoted words" as one.
 */
export function parseAsk(text: string): AnnalsAsk {
  const words: string[] = [],
    filters: AnnalFilter[] = [],
    only = new Set<number>();
  let from: number | null = null,
    to: number | null = null;
  const tokens = [...text.matchAll(TOKEN)];
  for (let i = 0; i < tokens.length; i++) {
    const m = tokens[i]!,
      key = fold(m[1] ?? m[3] ?? ""),
      value = (m[2] ?? m[4] ?? "").trim();
    if (key) {
      if (key === "only" || key === "rank") {
        const r = ANNAL_RANKS[fold(value)];
        if (r !== undefined) only.add(r);
        continue;
      }
      if (key === "year" || key === "in" || key === "years") {
        const range = rangeOf(value),
          y = yearOf(value);
        if (range) [from, to] = range;
        else if (y !== null) from = to = y;
        continue;
      }
      if (key === "from" || key === "after" || key === "since") {
        from = yearOf(value) ?? from;
        continue;
      }
      if (key === "to" || key === "before" || key === "until") {
        to = yearOf(value) ?? to;
        continue;
      }
      const k = ANNAL_KEYS[key];
      if (k) {
        if (value) filters.push({ key: k, value });
        continue;
      }
      // (Not a key: "12:30" or "note:" is words.)
      words.push(m[0]);
      continue;
    }
    if (m[5] !== undefined) {
      if (m[5].trim()) words.push(m[5].trim());
      continue;
    }
    const w = m[6]!,
      next = tokens[i + 1]?.[6];
    // ("only firsts", "only wars": the annals' own kinds.)
    if (fold(w) === "only" && next !== undefined && ANNAL_RANKS[fold(next)] !== undefined) {
      only.add(ANNAL_RANKS[fold(next)]!);
      i++;
      continue;
    }
    const range = rangeOf(w);
    if (range) {
      [from, to] = range;
      continue;
    }
    if (/^\d{1,6}$/.test(w)) {
      from = to = Number(w);
      continue;
    }
    words.push(w);
  }
  if (from !== null && to !== null && to < from) [from, to] = [to, from];
  return { words, filters, only: [...only].sort((a, b) => a - b), from, to };
}

/** Whether a search asks anything at all. */
export function askAnything(a: AnnalsAsk): boolean {
  return (
    a.words.some((w) => termOf(w)) ||
    a.filters.length > 0 ||
    a.only.length > 0 ||
    a.from !== null ||
    a.to !== null
  );
}

/** Two asks as one: a person's chips and what they typed (what is typed has the last word on the years). */
export function joinAsks(a: AnnalsAsk, b: AnnalsAsk): AnnalsAsk {
  return {
    words: [...a.words, ...b.words],
    filters: [...a.filters, ...b.filters],
    only: [...new Set([...a.only, ...b.only])].sort((x, y) => x - y),
    from: b.from ?? a.from,
    to: b.to ?? a.to,
  };
}

/** What key a thing is searched under when its name is tapped, by its ref. */
export function keyOfRef(ref: string): AnnalKey {
  switch (ref.slice(0, ref.indexOf(":"))) {
    case "pol":
    case "rule":
      return "realm";
    case "town":
      return "town";
    case "prsn":
    case "court":
      return "person";
    case "hhold":
      return "house";
    case "cell":
      return "land";
    case "faith":
      return "faith";
    case "lang":
      return "tongue";
    case "good":
      return "good";
    case "war":
      return "war";
    case "spec":
      return "beast";
    case "civ":
      return "people";
    default:
      return "about";
  }
}

/** Where words a search asked for lie in a line's text: [from, to) by the text's own places, none over another. */
export function marksIn(text: string, terms: readonly string[]): [number, number][] {
  let folded = "";
  const from: number[] = [];
  for (let i = 0; i < text.length;) {
    const ch = String.fromCodePoint(text.codePointAt(i)!),
      f = fold(ch);
    for (let k = 0; k < f.length; k++) from.push(i);
    folded += f;
    i += ch.length;
  }
  from.push(text.length);
  const out: [number, number][] = [];
  for (const t of terms) {
    if (!t) continue;
    for (let at = folded.indexOf(t); at >= 0; at = folded.indexOf(t, at + 1)) {
      if (wordy(folded[at - 1]) && wordy(t[0])) continue;
      const a = from[at]!,
        b = Math.max(a + 1, from[at + t.length] ?? text.length);
      out.push([a, b]);
    }
  }
  out.sort((x, y) => x[0] - y[0] || y[1] - x[1]);
  const merged: [number, number][] = [];
  for (const m of out) {
    const last = merged[merged.length - 1];
    if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1]);
    else merged.push([m[0], m[1]]);
  }
  return merged;
}

/** A filter as it is typed back: realm:"New Asha". */
export function filterText(f: AnnalFilter): string {
  return `${f.key}:${/[\s"]/.test(f.value) ? `"${f.value.replace(/"/g, "")}"` : f.value}`;
}
