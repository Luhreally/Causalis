// MurmurHash3 (x86, 32-bit) as an incremental absorber over 32-bit words. Every
// key in the universe — random draws, reference hashes, state fingerprints — is
// built from these three functions, so they are the most load-bearing lines in
// the kernel. Changing them changes every universe.
import { hi32, highWord, lo32, lowWord } from "./bits.ts";

const C1 = 0xcc9e2d51;
const C2 = 0x1b873593;

/** Absorb one 32-bit word into the running hash h. */
export function mix(h: number, word: number): number {
  let k = Math.imul(word | 0, C1);
  k = (k << 15) | (k >>> 17);
  k = Math.imul(k, C2);
  h ^= k;
  h = (h << 13) | (h >>> 19);
  return (Math.imul(h, 5) + 0xe6546b64) | 0;
}

/** Finish a running hash that absorbed `words` words; an unsigned 32-bit result. */
export function finish(h: number, words: number): number {
  h ^= words << 2;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Absorb a safe integer (two words, low then high). */
export function mixInt(h: number, n: number): number {
  return mix(mix(h, lo32(n)), hi32(n));
}

/** Absorb a float64 by its bit pattern (so -0, NaN payloads and 0.1 are exact). */
export function mixFloat(h: number, x: number): number {
  return mix(mix(h, lowWord(x)), highWord(x));
}

/** Hash of a string's UTF-16 code units, pairs of units per word. */
export function hashString(text: string, seed = 0): number {
  let h = seed | 0,
    words = 0;
  for (let i = 0; i < text.length; i += 2) {
    h = mix(h, text.charCodeAt(i) | ((i + 1 < text.length ? text.charCodeAt(i + 1) : 0) << 16));
    words++;
  }
  h = mix(h, text.length);
  return finish(h, words + 1);
}

/**
 * An incremental 64-bit fingerprint: two independent lanes of the same absorber.
 * Used for state hashes and hash-derived references, where 32 bits would collide.
 */
export class Hasher {
  private a = 0x2545f491 | 0;
  private b = 0x6a09e667 | 0;
  private n = 0;
  word(w: number): this {
    this.a = mix(this.a, w);
    this.b = mix(this.b, w ^ 0x5bd1e995);
    this.n++;
    return this;
  }
  int(n: number): this {
    return this.word(lo32(n)).word(hi32(n));
  }
  /** A float by its bits; −0 hashes as 0 and every NaN alike, as saved JSON would have them. */
  float(x: number): this {
    const v = x === 0 ? 0 : x !== x ? NaN : x;
    return this.word(lowWord(v)).word(highWord(v));
  }
  string(text: string): this {
    for (let i = 0; i < text.length; i += 2)
      this.word(text.charCodeAt(i) | ((i + 1 < text.length ? text.charCodeAt(i + 1) : 0) << 16));
    return this.word(text.length);
  }
  bool(v: boolean): this {
    return this.word(v ? 1 : 0);
  }
  /**
   * Any plain JSON-like value, canonically: object keys in sorted order, numbers by
   * their bits, each kind tagged. Never hash JSON.stringify output (its key order is
   * the order the object was built in).
   */
  value(v: unknown): this {
    if (v === null || v === undefined) return this.word(0);
    switch (typeof v) {
      case "boolean":
        return this.word(1).bool(v);
      case "number":
        return this.word(2).float(v);
      case "string":
        return this.word(3).string(v);
      case "object": {
        if (Array.isArray(v)) {
          this.word(4).int(v.length);
          for (const item of v) this.value(item);
          return this;
        }
        const keys = Object.keys(v).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        this.word(5).int(keys.length);
        for (const k of keys) this.string(k).value((v as Record<string, unknown>)[k]);
        return this;
      }
      default:
        throw new Error(`cannot hash a ${typeof v}`);
    }
  }
  /** The two 32-bit lanes of the fingerprint. */
  lanes(): [number, number] {
    return [finish(this.a, this.n), finish(this.b ^ 0x27d4eb2f, this.n)];
  }
  /** Sixteen hex digits. */
  hex(): string {
    const [a, b] = this.lanes();
    return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
  }
}
