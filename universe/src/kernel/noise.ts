// Value noise in three dimensions, keyed by a seed word: smooth pseudo-random
// fields for terrain texture, crust and climate variation. Lattice values come
// from the same hash as every other draw; interpolation uses only exact
// operations, so the field is identical on every engine.
import { finish, mix } from "./hash.ts";

function lattice(seed: number, x: number, y: number, z: number): number {
  return finish(mix(mix(mix(seed, x | 0), y | 0), z | 0), 3) / 4294967296;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Smooth noise in [0, 1) at a point. */
export function noise3(seed: number, x: number, y: number, z: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z),
    xf = fade(x - xi),
    yf = fade(y - yi),
    zf = fade(z - zi);
  const c000 = lattice(seed, xi, yi, zi),
    c100 = lattice(seed, xi + 1, yi, zi),
    c010 = lattice(seed, xi, yi + 1, zi),
    c110 = lattice(seed, xi + 1, yi + 1, zi),
    c001 = lattice(seed, xi, yi, zi + 1),
    c101 = lattice(seed, xi + 1, yi, zi + 1),
    c011 = lattice(seed, xi, yi + 1, zi + 1),
    c111 = lattice(seed, xi + 1, yi + 1, zi + 1);
  const x00 = c000 + (c100 - c000) * xf,
    x10 = c010 + (c110 - c010) * xf,
    x01 = c001 + (c101 - c001) * xf,
    x11 = c011 + (c111 - c011) * xf,
    y0 = x00 + (x10 - x00) * yf,
    y1 = x01 + (x11 - x01) * yf;
  return y0 + (y1 - y0) * zf;
}

/** Fractal (layered) noise in [0, 1): `octaves` layers, each twice as fine and half as strong. */
export function fbm3(
  seed: number,
  x: number,
  y: number,
  z: number,
  octaves = 5,
  scale = 1,
): number {
  let sum = 0,
    weight = 0,
    amp = 1,
    freq = scale;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise3(mix(seed, o), x * freq, y * freq, z * freq);
    weight += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / weight;
}
