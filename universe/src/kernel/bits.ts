// Exact access to the bits of a float64 and to the 32-bit halves of safe integers.
// Typed-array views follow the platform's byte order, so the word order is found
// once at load; everything built on these is identical on every engine.
const F64 = new Float64Array(1);
const U32 = new Uint32Array(F64.buffer);
const LITTLE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const HI = LITTLE ? 1 : 0;
const LO = LITTLE ? 0 : 1;

export const TWO32 = 4294967296;
export const TWO53 = 9007199254740992;

/** The high 32 bits of a float64's IEEE-754 pattern (sign, exponent, top of the mantissa). */
export function highWord(x: number): number {
  F64[0] = x;
  return U32[HI]!;
}

/** The low 32 bits of a float64's IEEE-754 pattern. */
export function lowWord(x: number): number {
  F64[0] = x;
  return U32[LO]!;
}

/** The float64 whose IEEE-754 pattern is hi:lo. */
export function fromWords(hi: number, lo: number): number {
  U32[HI] = hi >>> 0;
  U32[LO] = lo >>> 0;
  return F64[0]!;
}

/** The float64 with the same low word as x and the given high word. */
export function withHighWord(x: number, hi: number): number {
  F64[0] = x;
  U32[HI] = hi >>> 0;
  return F64[0]!;
}

/** Sixteen hex digits of a float64's bit pattern: how golden vectors record numbers. */
export function f64Hex(x: number): string {
  F64[0] = x;
  return U32[HI]!.toString(16).padStart(8, "0") + U32[LO]!.toString(16).padStart(8, "0");
}

/** The float64 recorded by f64Hex. */
export function hexF64(hex: string): number {
  return fromWords(parseInt(hex.slice(0, 8), 16), parseInt(hex.slice(8, 16), 16));
}

/** Low 32 bits of an integer (two's complement for negatives), as an unsigned value. */
export function lo32(n: number): number {
  return (n - Math.floor(n / TWO32) * TWO32) >>> 0;
}

/** High bits of an integer above the low 32, as an unsigned 32-bit value. */
export function hi32(n: number): number {
  return Math.floor(n / TWO32) >>> 0;
}
