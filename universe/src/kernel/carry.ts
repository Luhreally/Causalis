// What a seed's text can carry besides its name and its acts' few words: a whole text, as one word of an act
// ("~far <word>"). A world of another star entered is made from what was read of it from afar (rules/far.ts), and that
// reading travels in its seed's text, so that the world regenerates from its seed alone as every world does. The word is
// the text's bytes, six bits a letter, in letters, digits, "-" and "_": no space and no "~" an act could break on.
import { seedActs, seedWithoutAct } from "./rng.ts";

/** The act that carries what was read of a world of another star: the one such act there is. */
export const FAR_ACT = "far";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Text as one word. */
export function wordOf(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!,
      b = bytes[i + 1],
      c = bytes[i + 2],
      n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!;
    if (b !== undefined) out += ALPHABET[(n >> 6) & 63]!;
    if (c !== undefined) out += ALPHABET[n & 63]!;
  }
  return out;
}

/** The text a word was made of (null: no such word). */
export function textOf(word: string): string | null {
  const bytes: number[] = [];
  for (let i = 0; i < word.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => (i + k < word.length ? ALPHABET.indexOf(word[i + k]!) : -2));
    if (v.includes(-1) || v[1] === -2) return null;
    const n = (v[0]! << 18) | (v[1]! << 12) | (Math.max(0, v[2]!) << 6) | Math.max(0, v[3]!);
    bytes.push((n >> 16) & 255);
    if (v[2] !== -2) bytes.push((n >> 8) & 255);
    if (v[3] !== -2) bytes.push(n & 255);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return null;
  }
}

/** The text a seed carries under an act's word ("far"), where it carries one (null: none, or not a word). */
export function seedCarried(text: string, act: string): string | null {
  if (!text.includes(` ~${act} `)) return null;
  for (const a of seedActs(text)) {
    const [word, what, more] = a.split(" ");
    if (word !== act || !what || more !== undefined) continue;
    const carried = textOf(what);
    if (carried !== null) return carried;
  }
  return null;
}

/** A seed's text without what it carries under an act's word: its name and its other acts, as they are shown. */
export function seedPlain(text: string, act: string): string {
  return seedCarried(text, act) === null ? text : seedWithoutAct(text, `${act} x`);
}
