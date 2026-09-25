// Distance between two float64s in units in the last place (for accuracy tests).
const F = new Float64Array(1);
const I = new BigInt64Array(F.buffer);

function ordered(x: number): bigint {
  F[0] = x;
  const bits = I[0]!;
  return bits < 0n ? -(bits & 0x7fffffffffffffffn) : bits;
}

export function ulps(a: number, b: number): number {
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) && Number.isNaN(b) ? 0 : Infinity;
  if (a === b) return 0;
  const d = ordered(a) - ordered(b);
  return Number(d < 0n ? -d : d);
}

/** Inputs spread over many magnitudes, from a fixed integer generator. */
export function spread(count: number, scale: number, seed: number, positive = false): number[] {
  const out: number[] = [];
  let s = seed >>> 0;
  for (let i = 0; i < count; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const x = (s / 4294967296 - 0.5) * 2 * scale;
    out.push(positive ? Math.abs(x) : x);
  }
  return out;
}
