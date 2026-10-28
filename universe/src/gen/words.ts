// A people's words for things (Phase 58): each meaning (rules/names.ts) a root, coined once by the
// first language of a family, kept by its daughters in their own sounds (a sound a tongue has lost
// becomes the nearest it has, the same way every time), and now and then replaced by one of their
// own; a thing's name its roots joined as its family joins them. A word taken from another people
// is their word in the taker's sounds. Pure functions of the tongue, its line and the meanings,
// keyed by hashes of their own: nothing is stored, and no stream is read.
import { finish, hashString, mix } from "../kernel/index.ts";
import { MEANINGS, coloursAt, type Colour } from "../rules/index.ts";
import { SYLLABLE_PARTS, type Tongue } from "./names.ts";

/** The share of a family's roots each daughter tongue replaces with one of its own. */
export const REPLACED = 0.2;
/** The share of names whose marks a daughter tongue chooses afresh (it names the thing by another of its likenesses). */
export const RECHOSEN = 0.15;

/** A root as coined: its syllables' beginnings and vowels, and the sound that closes it. */
export type Root = {
  readonly syllables: readonly (readonly [string, string])[];
  readonly coda: string;
};

/** A root as a tongue says it, and its meaning. */
export type SaidRoot = Root & { readonly meaning: string; readonly text: string };

/** A word as a tongue says it: its letters, and its roots in the order said. */
export type Said = { readonly text: string; readonly roots: readonly SaidRoot[] };

/** How a family joins its words: its kind of thing first or last, what joins them, its colours, how often a name takes two marks. */
export type Speech = {
  readonly headFirst: boolean;
  readonly glue: "" | "-" | "'";
  readonly colours: readonly Colour[];
  /** The share of names that take two marks (the rest take one). */
  readonly two: number;
};

/** A tongue's line: the world's seed (every tongue of a world keeps its cradle's) and the languages from its family's first to it, by index. */
export type Lineage = { readonly seed: number; readonly line: readonly number[] };

/** The sounds a sound becomes in a tongue without it, the nearest first. */
const NEAR: Readonly<Record<string, readonly string[]>> = {
  // Beginnings.
  "<": ["h", "w"],
  b: ["p", "v", "br", "m"],
  d: ["t", "th", "dr"],
  f: ["v", "p", "th", "h"],
  g: ["k", "gr", "h"],
  h: ["<", "f", "k"],
  k: ["g", "kr", "h"],
  l: ["r", "n"],
  m: ["n", "b"],
  n: ["m", "l"],
  p: ["b", "f"],
  r: ["l", "<"],
  s: ["sh", "th", "st"],
  t: ["d", "th", "tr", "st"],
  v: ["f", "b", "w"],
  w: ["v", "<", "h"],
  br: ["b", "p", "r"],
  dr: ["d", "tr", "r"],
  gr: ["g", "kr", "r"],
  kr: ["k", "gr", "tr"],
  st: ["s", "t", "sh"],
  th: ["t", "s", "d", "f"],
  sh: ["s", "th"],
  tr: ["t", "dr", "kr"],
  // Vowels.
  a: ["ae", "ai", "ea", "o"],
  e: ["ea", "i", "ae", "a"],
  i: ["y", "e", "ai"],
  o: ["ou", "u", "a"],
  u: ["ou", "o", "y"],
  ae: ["a", "e", "ai"],
  ai: ["a", "i", "ae"],
  ea: ["e", "a", "ae"],
  ou: ["o", "u"],
  y: ["i", "e", "u"],
  // Closings.
  ">": ["n", "r"],
  rn: ["r", "n"],
  nd: ["n", "rn"],
  ck: [">", "st", "s"],
  // (n, r, l, s, th, m, st, v close as they begin, or open.)
};
const CLOSE_NEAR: Readonly<Record<string, readonly string[]>> = {
  n: ["m", "nd", "rn", "l"],
  r: ["rn", "l", ">"],
  l: ["r", "n", ">"],
  s: ["st", "th", ">"],
  th: ["s", "st", ">"],
  m: ["n", ">"],
  st: ["s", "th"],
  v: ["th", "s", ">"],
};

const { onsets: ONSETS, vowels: VOWELS, codas: CODAS } = SYLLABLE_PARTS;
/** A root's parts as coined: simple vowels twice as often as the joined ones; an open close one time in five. */
const COIN_VOWELS = ["a", "e", "i", "o", "u", "a", "e", "i", "o", "u", "ae", "ai", "ea", "ou", "y"],
  COIN_CODAS = ["", "", "", "n", "r", "l", "s", "th", "m", "nd", "rn", "st", "v", "ck"];
/** Where the meanings that name a kind of thing end (MEANINGS begins with them). */
const HEADS = MEANINGS.indexOf("black");

/** The sounds a tongue keeps of each part (an open beginning "<", an open close ">"). */
function kept(t: Tongue): { onsets: Set<string>; vowels: Set<string>; codas: Set<string> } {
  const of = (list: readonly string[], mask: number, open: string) => {
    const out = new Set<string>();
    list.forEach((x, i) => {
      if ((mask >>> i) & 1) out.add(x || open);
    });
    if (!out.size) for (const x of list) out.add(x || open);
    return out;
  };
  return {
    onsets: of(ONSETS, t.onsets, "<"),
    vowels: of(VOWELS, t.vowels, ""),
    codas: of(CODAS, t.codas, ">"),
  };
}

/** A sound as a tongue says it: itself, else the nearest it keeps, else the nearest in its list. */
function fit(
  sound: string,
  have: Set<string>,
  near: Readonly<Record<string, readonly string[]>>,
  list: readonly string[],
  open: string,
): string {
  if (have.has(sound)) return sound;
  for (const n of near[sound] ?? []) if (have.has(n)) return n;
  const at = Math.max(0, list.indexOf(sound === open ? "" : sound));
  let best = "",
    far = Infinity;
  list.forEach((x, i) => {
    const s = x || open;
    if (have.has(s) && Math.abs(i - at) < far) [best, far] = [s, Math.abs(i - at)];
  });
  return best;
}

/** A root in a tongue's own sounds. */
function sayRoot(r: Root, t: Tongue, meaning: string): SaidRoot {
  const k = kept(t),
    syllables = r.syllables.map(
      ([o, v]) =>
        [fit(o || "<", k.onsets, NEAR, ONSETS, "<"), fit(v, k.vowels, NEAR, VOWELS, "")] as const,
    ),
    coda = fit(r.coda || ">", k.codas, { ...NEAR, ...CLOSE_NEAR }, CODAS, ">"),
    open = (s: string) => (s === "<" || s === ">" ? "" : s),
    said = syllables.map(([o, v]) => [open(o), v] as const);
  return {
    syllables: said,
    coda: open(coda),
    meaning,
    text: said.map(([o, v]) => o + v).join("") + open(coda),
  };
}

/** A key's draw in [0, 1): a hash of the seed, a language, a thing and a purpose. */
function unit(seed: number, key: number, thing: string, purpose: number): number {
  return finish(mix(mix(mix(seed ^ purpose, key), hashString(thing)), purpose), 3) / 2 ** 32;
}

/** A root coined by a language for a meaning (`salt`: tried again, where it fell on one taken). */
function coin(seed: number, key: number, meaning: string, salt: number): Root {
  let h = finish(mix(mix(mix(seed ^ 0x6e616d, key), hashString(meaning)), salt), 3);
  const head = MEANINGS.indexOf(meaning as never) < HEADS,
    two = (h % 100) / 100 < (head ? 0.2 : 0.08),
    syllables: [string, string][] = [];
  for (let s = 0; s < (two ? 2 : 1); s++) {
    h = finish(mix(h, s + 1), 2);
    // (A second syllable begins with a sound: no two vowels run together within a root.)
    const onsets = s === 0 ? ONSETS : ONSETS.slice(1);
    syllables.push([onsets[h % onsets.length]!, COIN_VOWELS[(h >>> 8) % COIN_VOWELS.length]!]);
  }
  h = finish(mix(h, 0x63), 2);
  // (A root of one bare vowel is too slight to hear: it closes with a sound.)
  const codas = !two && syllables[0]![0] === "" ? COIN_CODAS.slice(3) : COIN_CODAS;
  return { syllables, coda: codas[h % codas.length]! };
}

const proto = (r: Root) => r.syllables.map(([o, v]) => `${o}.${v}`).join("|") + `|${r.coda}`;

/**
 * Every meaning's root in a tongue's line: the first of its family coins them all, each one apart
 * from the others; each daughter keeps its mother's but for a share it replaces.
 */
export function rootsOf(l: Lineage): ReadonlyMap<string, Root> {
  const out = new Map<string, Root>(),
    used = new Set<string>();
  l.line.forEach((key, depth) => {
    for (const m of MEANINGS) {
      if (depth > 0 && unit(l.seed, key, m, 0x7e91) >= REPLACED) continue;
      const was = out.get(m);
      if (was) used.delete(proto(was));
      let r = coin(l.seed, key, m, 0);
      for (let salt = 1; used.has(proto(r)) && salt < 64; salt++) r = coin(l.seed, key, m, salt);
      out.set(m, r);
      used.add(proto(r));
    }
  });
  return out;
}

/** How a tongue's family joins its words (its daughters gain a colour now and then). */
export function speechOf(l: Lineage): Speech {
  const h = finish(mix(mix(l.seed ^ 0x5bee, l.line[0] ?? 0), 0x1f), 2);
  let stage = 3 + (h % 6);
  for (const key of l.line.slice(1))
    if (unit(l.seed, key, "colours", 0x2c01) < 0.25) stage = Math.min(8, stage + 1);
  const g = (h >>> 12) % 20;
  return {
    headFirst: (h >>> 8) % 10 < 3,
    glue: g < 14 ? "" : g < 18 ? "-" : "'",
    colours: coloursAt(stage, ((h >>> 24) & 1) === 1),
    two: 0.25 + ((h >>> 20) % 4) * 0.1,
  };
}

/**
 * The marks a tongue names a thing by, of its likenesses (the most telling first): mostly the most
 * telling, one or two as its family names things; chosen by the first of its family, and afresh now
 * and then down its line. In the order of `marks`.
 */
export function marksChosen(
  l: Lineage,
  thing: string,
  marks: readonly string[],
  speech: Speech,
): string[] {
  if (!marks.length) return [];
  let key = l.line[0] ?? 0;
  for (const k of l.line.slice(1)) if (unit(l.seed, k, thing, 0xc401) < RECHOSEN) key = k;
  const u = unit(l.seed, key, thing, 0x3a7c),
    w = unit(l.seed, key, thing, 0x3a7d),
    first = marks.length < 2 || w < 0.62 ? 0 : marks.length < 3 || w < 0.9 ? 1 : 2,
    picked = [first];
  if (marks.length >= 2 && u < speech.two) picked.push(first === 0 ? 1 : 0);
  return picked.sort((a, b) => a - b).map((i) => marks[i]!);
}

/** Every way to name a thing by one or two of its marks, the chosen first (for a name not taken). */
export function marksTried(chosen: readonly string[], marks: readonly string[]): string[][] {
  const out: string[][] = [[...chosen]],
    seen = new Set([chosen.join("+")]),
    add = (xs: string[]) => {
      const k = xs.join("+");
      if (!seen.has(k)) {
        seen.add(k);
        out.push(xs);
      }
    };
  const top = marks.slice(0, 4);
  for (const m of top) add([m]);
  for (let i = 0; i < top.length; i++)
    for (let j = i + 1; j < top.length; j++) add([top[i]!, top[j]!]);
  return out;
}

/** Roots joined as a family joins them: run together (an ugly cluster's close dropped, a vowel meeting a vowel kept apart), or with a mark between. */
function joined(roots: readonly SaidRoot[], glue: Speech["glue"], link: string): string {
  // (A long word clips its first roots to their first syllable, as compounds wear down.)
  const clip = roots.reduce((n, r) => n + r.syllables.length, 0) > 3,
    clipped = (r: SaidRoot, last: boolean) =>
      clip && !last && r.syllables.length > 1 ? r.syllables[0]!.join("") : r.text;
  if (glue !== "") {
    const text = roots.map((r, i) => clipped(r, i === roots.length - 1)).join(glue);
    return text.length < 3 ? text + link : text;
  }
  let text = "";
  roots.forEach((r, i) => {
    const next = roots[i + 1],
      body = (clip && next ? r.syllables.slice(0, 1) : r.syllables).map(([o, v]) => o + v).join("");
    let part = body;
    if (!next) part += r.coda;
    else {
      const onset = next.syllables[0]![0];
      if (onset === "") part += r.coda || link;
      else if (r.coda && r.coda !== "ck" && r.coda.length + onset.length <= 2) part += r.coda;
    }
    // (A letter said twice where two roots meet is said once.)
    if (text && part && text[text.length - 1] === part[0]) part = part.slice(1);
    text += part;
  });
  // (A word of a sound or two is too slight to hear: it closes with the tongue's joining sound.)
  return text.length < 3 ? text + link : text;
}

/** The close a tongue joins two vowels with: the first of n, r, l, s it keeps. */
function linkOf(t: Tongue): string {
  const k = kept(t).codas;
  return ["n", "r", "l", "s", "m", "th"].find((c) => k.has(c)) ?? "n";
}

/**
 * A name in a tongue: its kind's root and its marks' (`meanings`: the marks, then the kind), said in
 * its sounds and joined as its family joins them.
 */
export function wordOf(
  t: Tongue,
  roots: ReadonlyMap<string, Root>,
  speech: Speech,
  meanings: readonly string[],
): Said {
  const said = meanings.map((m) => sayRoot(roots.get(m) ?? coin(0, 0, m, 0), t, m)),
    order =
      speech.headFirst && said.length > 1 ? [said[said.length - 1]!, ...said.slice(0, -1)] : said;
  return { text: joined(order, speech.glue, linkOf(t)), roots: order };
}

/** A word taken from another people: their sounds as the taker says them, run together as one word. */
export function fittedWord(word: Said, t: Tongue): Said {
  const roots = word.roots.map((r) => sayRoot(r, t, r.meaning));
  return { text: joined(roots, "", linkOf(t)), roots };
}
