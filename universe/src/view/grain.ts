// The grain of a land's ground (render/stage.ts groundMaterial, grainTexture): four fields of smooth noise, tiling, GRAIN_SIZE
// texels square, three about 0.5, the fourth spread evenly over 0 ... 1. Its texels alone, so that what is worked out off the
// ground's look (view/shore.ts: where its shore runs) reads the same grain the screen does.

/** Texels a side of the grain. */
export const GRAIN_SIZE = 128;

let made: Uint8Array | null = null;

/** The grain's texels (RGBA, a row at a time), made once. */
export function grainData(): Uint8Array {
  if (made) return made;
  const n = GRAIN_SIZE,
    cell = 8,
    m = n / cell,
    data = new Uint8Array(n * n * 4);
  let seed = 0x9e3779b9;
  const rand = () => {
    seed = Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) >>> 0;
    seed = (seed + 0x6d2b79f5) >>> 0;
    return ((seed ^ (seed >>> 13)) >>> 0) / 4294967296;
  };
  for (let ch = 0; ch < 4; ch++) {
    const lattice = Array.from({ length: m * m }, rand),
      at = (i: number, j: number) => lattice[(((j % m) + m) % m) * m + (((i % m) + m) % m)]!,
      out = new Float32Array(n * n);
    let lo = Infinity,
      hi = -Infinity,
      sum = 0;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const fx = x / cell,
          fy = y / cell,
          i = Math.floor(fx),
          j = Math.floor(fy),
          u = fx - i,
          v = fy - j,
          su = u * u * (3 - 2 * u),
          sv = v * v * (3 - 2 * v),
          // (Two octaves, the second turned a quarter: no grid's lines.)
          o1 =
            (at(i, j) * (1 - su) + at(i + 1, j) * su) * (1 - sv) +
            (at(i, j + 1) * (1 - su) + at(i + 1, j + 1) * su) * sv,
          gx = (y * 2) / cell,
          gy = (x * 2) / cell,
          k = Math.floor(gx),
          l = Math.floor(gy),
          p = gx - k,
          q = gy - l,
          sp = p * p * (3 - 2 * p),
          sq = q * q * (3 - 2 * q),
          o2 =
            (at(k + 3, l + 5) * (1 - sp) + at(k + 4, l + 5) * sp) * (1 - sq) +
            (at(k + 3, l + 6) * (1 - sp) + at(k + 4, l + 6) * sp) * sq,
          f = o1 * 0.7 + o2 * 0.3;
        out[y * n + x] = f;
        lo = Math.min(lo, f);
        hi = Math.max(hi, f);
        sum += f;
      }
    // (About its mean, at 0.5: a grain finer than a pixel, mipmapped away, leaves the ground its own colour.)
    const mean = sum / (n * n),
      span = Math.max(hi - mean, mean - lo) || 1;
    if (ch < 3)
      for (let t = 0; t < n * n; t++)
        data[4 * t + ch] = Math.round(127.5 + (127 * (out[t]! - mean)) / span);
    else {
      // (The fourth spread evenly over 0 … 1, by its rank: a share of the ground below a level is that level.)
      const order = Array.from(out.keys()).sort((x, y) => out[x]! - out[y]!);
      order.forEach((t, k) => (data[4 * t + 3] = Math.round((255 * (k + 0.5)) / (n * n))));
    }
  }
  made = data;
  return data;
}
