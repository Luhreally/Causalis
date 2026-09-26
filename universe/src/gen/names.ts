// Place names (Phase 1): a small syllable grammar keyed by a culture's seed, so a
// people's places sound alike and every name is a pure function of its key.
// Phase 2's languages replace this with phonologies.
import { finish, mix } from "../kernel/index.ts";

const ONSETS = [
  "",
  "b",
  "d",
  "f",
  "g",
  "h",
  "k",
  "l",
  "m",
  "n",
  "p",
  "r",
  "s",
  "t",
  "v",
  "w",
  "br",
  "dr",
  "gr",
  "kr",
  "st",
  "th",
  "sh",
  "tr",
];
const VOWELS = ["a", "e", "i", "o", "u", "ae", "ai", "ea", "ou", "y"];
const CODAS = ["", "", "n", "r", "l", "s", "th", "m", "nd", "rn", "st", "v", "ck"];
const ENDINGS = ["", "", "", "ey", "on", "ath", "wick", "ford", "mere", "holt", "ar", "is", "en"];

function pick<T>(list: readonly T[], h: number): T {
  return list[h % list.length]!;
}

/**
 * A culture's phonology is a subset of the syllable parts, so its names share a sound;
 * `key` picks one name in that style.
 */
export function placeName(culture: number, key: number): string {
  const onsets = ONSETS.filter((_, i) => (finish(mix(culture, i), 1) & 3) !== 0),
    vowels = VOWELS.filter((_, i) => (finish(mix(culture ^ 0x5a5a, i), 1) & 3) !== 0),
    codas = CODAS.filter((_, i) => (finish(mix(culture ^ 0xa5a5, i), 1) & 1) === 0 || i < 2);
  let h = finish(mix(mix(culture, key), 0x51ed), 2);
  const syllables = 1 + (h % 2) + ((h >>> 3) % 3 === 0 ? 1 : 0);
  let name = "";
  for (let s = 0; s < syllables; s++) {
    h = finish(mix(h, s), 3);
    name +=
      pick(onsets.length ? onsets : ONSETS, h) + pick(vowels.length ? vowels : VOWELS, h >>> 8);
    if (s === syllables - 1) name += pick(codas.length ? codas : CODAS, h >>> 16);
  }
  h = finish(mix(h, 0x77), 4);
  name += pick(ENDINGS, h);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const FEMININE = ["a", "e", "i", "ia", "ea", "wen", "ys", "et"];
const MASCULINE = ["", "n", "r", "l", "th", "d", "k", "s", "m"];

/** A given name in a culture's sound; `sex` 0 takes a feminine ending, 1 a masculine one. */
export function personName(culture: number, key: number, sex: number): string {
  const vowels = VOWELS.filter((_, i) => (finish(mix(culture ^ 0x5a5a, i), 1) & 3) !== 0),
    onsets = ONSETS.filter((_, i) => (finish(mix(culture, i), 1) & 3) !== 0);
  let h = finish(mix(mix(culture ^ 0x3c3c, key), sex), 2);
  const syllables = 1 + (h % 2);
  let name = "";
  for (let s = 0; s < syllables; s++) {
    h = finish(mix(h, s), 3);
    name +=
      pick(onsets.length ? onsets : ONSETS, h) + pick(vowels.length ? vowels : VOWELS, h >>> 8);
  }
  h = finish(mix(h, 0x99), 4);
  name += pick(sex === 0 ? FEMININE : MASCULINE, h);
  if (name.length < 3) name += pick(sex === 0 ? FEMININE : MASCULINE, h >>> 8) || "an";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * A tongue (docs/architecture §19): which of the syllable parts its speakers use,
 * as bitmasks, and the seed that picks names in it. Tongues drift — a sound lost
 * or gained — and borrow from their neighbours, so names near each other sound
 * alike and names far apart drift apart.
 */
export type Tongue = {
  readonly onsets: number;
  readonly vowels: number;
  readonly codas: number;
  readonly endings: number;
  readonly seed: number;
};

const PARTS = [ONSETS.length, VOWELS.length, CODAS.length, ENDINGS.length] as const;
const FIELDS = ["onsets", "vowels", "codas", "endings"] as const;

function maskOf(n: number, keep: (i: number) => boolean): number {
  let m = 0;
  for (let i = 0; i < n; i++) if (keep(i)) m |= 1 << i;
  return m;
}

function chosen<T>(list: readonly T[], mask: number): T[] {
  const out = list.filter((_, i) => (mask >>> i) & 1);
  return out.length ? out : [...list];
}

/** The tongue of a culture's first people: the same sounds placeName gives it. */
export function cradleTongue(culture: number): Tongue {
  return {
    onsets: maskOf(ONSETS.length, (i) => (finish(mix(culture, i), 1) & 3) !== 0),
    vowels: maskOf(VOWELS.length, (i) => (finish(mix(culture ^ 0x5a5a, i), 1) & 3) !== 0),
    codas: maskOf(CODAS.length, (i) => (finish(mix(culture ^ 0xa5a5, i), 1) & 1) === 0 || i < 2),
    endings: maskOf(ENDINGS.length, () => true),
    seed: culture,
  };
}

/** A place's name in a tongue (in the cradle tongue, exactly placeName's). */
export function tongueName(t: Tongue, key: number): string {
  const onsets = chosen(ONSETS, t.onsets),
    vowels = chosen(VOWELS, t.vowels),
    codas = chosen(CODAS, t.codas),
    endings = chosen(ENDINGS, t.endings);
  let h = finish(mix(mix(t.seed, key), 0x51ed), 2);
  const syllables = 1 + (h % 2) + ((h >>> 3) % 3 === 0 ? 1 : 0);
  let name = "";
  for (let s = 0; s < syllables; s++) {
    h = finish(mix(h, s), 3);
    name += pick(onsets, h) + pick(vowels, h >>> 8);
    if (s === syllables - 1) name += pick(codas, h >>> 16);
  }
  h = finish(mix(h, 0x77), 4);
  name += pick(endings, h);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** How a people name their speech, after its stem: "Kurnic", "Bregrish". */
const SPEECH_ENDINGS = ["ic", "ish", "an", "ese", "i", "ian", "ar", "en"];

/** A language's name in its own tongue: a stem of one or two syllables and a speech ending. */
export function languageName(t: Tongue, key: number): string {
  const onsets = chosen(ONSETS, t.onsets),
    vowels = chosen(VOWELS, t.vowels),
    codas = chosen(CODAS, t.codas).filter((c) => c.length > 0);
  let h = finish(mix(mix(t.seed ^ 0x1a2b, key), 0x5eec), 2);
  const two = h % 3 === 0;
  let stem = "";
  // A second syllable only after a short first, so names stay short enough to say.
  for (let s = 0; s < 2 && (s === 0 || (two && stem.length <= 2)); s++) {
    h = finish(mix(h, s), 3);
    stem += pick(onsets, h) + pick(vowels, h >>> 8);
  }
  h = finish(mix(h, 0x61), 4);
  // A stem that ends in a vowel takes a consonant before the ending, where the tongue has one.
  if (codas.length) stem += pick(codas, h >>> 4);
  const name = stem + pick(SPEECH_ENDINGS, h >>> 12);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** A person's given name in a tongue. */
export function tonguePersonName(t: Tongue, key: number, sex: number): string {
  const vowels = chosen(VOWELS, t.vowels),
    onsets = chosen(ONSETS, t.onsets);
  let h = finish(mix(mix(t.seed ^ 0x3c3c, key), sex), 2);
  const syllables = 1 + (h % 2);
  let name = "";
  for (let s = 0; s < syllables; s++) {
    h = finish(mix(h, s), 3);
    name += pick(onsets, h) + pick(vowels, h >>> 8);
  }
  h = finish(mix(h, 0x99), 4);
  name += pick(sex === 0 ? FEMININE : MASCULINE, h);
  if (name.length < 3) name += pick(sex === 0 ? FEMININE : MASCULINE, h >>> 8) || "an";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** A sound lost or gained: `u` picks which part and which sound. A part never empties. */
export function shiftTongue(t: Tongue, u: number): Tongue {
  const f = Math.floor(u * 4) % 4,
    field = FIELDS[f]!,
    bit = Math.floor(((u * 4) % 1) * PARTS[f]!),
    flipped = t[field] ^ (1 << bit);
  return flipped ? { ...t, [field]: flipped } : t;
}

/** One sound taken from a neighbour's tongue, where the two differ; `u` picks which. */
export function borrowSound(t: Tongue, from: Tongue, u: number): Tongue {
  const diffs: [number, number][] = [];
  FIELDS.forEach((field, f) => {
    const d = t[field] ^ from[field];
    for (let i = 0; i < PARTS[f]!; i++) if ((d >>> i) & 1) diffs.push([f, i]);
  });
  if (!diffs.length) return t;
  const [f, i] = diffs[Math.floor(u * diffs.length) % diffs.length]!,
    field = FIELDS[f]!,
    next = (t[field] & ~(1 << i)) | (from[field] & (1 << i));
  return next ? { ...t, [field]: next } : t;
}

/**
 * The speech many lands share: each sound kept where those who have it outweigh those
 * who do not (weights, say, by people), named by `seed`. A part never empties.
 */
export function commonTongue(
  tongues: readonly Tongue[],
  weights: readonly number[],
  seed: number,
): Tongue {
  const total = weights.reduce((a, b) => a + b, 0),
    out = { onsets: 0, vowels: 0, codas: 0, endings: 0, seed };
  FIELDS.forEach((field, f) => {
    let mask = 0;
    for (let i = 0; i < PARTS[f]!; i++) {
      let have = 0;
      tongues.forEach((t, k) => {
        if ((t[field] >>> i) & 1) have += weights[k]!;
      });
      if (2 * have > total) mask |= 1 << i;
    }
    out[field] = mask || tongues[0]![field];
  });
  return out;
}

/** How alike two tongues sound: the share of sounds they agree on (1 = the same). */
export function tongueLikeness(a: Tongue, b: Tongue): number {
  const differ =
    bits((a.onsets ^ b.onsets) & MASKS[0]!) +
    bits((a.vowels ^ b.vowels) & MASKS[1]!) +
    bits((a.codas ^ b.codas) & MASKS[2]!) +
    bits((a.endings ^ b.endings) & MASKS[3]!);
  return (SOUNDS - differ) / SOUNDS;
}

/** Each part's sounds as a mask, and how many sounds there are in all. */
const MASKS = PARTS.map((n) => (n >= 32 ? -1 : (1 << n) - 1)),
  SOUNDS = PARTS.reduce((s, n) => s + n, 0);

/** How many bits of a 32-bit word are set. */
function bits(v: number): number {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24) & 0xff;
}
