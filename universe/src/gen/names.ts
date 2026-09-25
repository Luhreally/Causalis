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
