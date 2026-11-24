// A world's life in its own colours (Phase 57): Earth's greens turned to the pigment its star's
// light favours — gold under a hot white star, blue under an orange one, near black under a dim red
// one, the dark amber of methane life — or to bare ground where nothing took hold; and its blood in
// the colour of what carries its breath. Only what is green turns: bark, straw, ripe grain, soil and
// stone stay as they are. Earth's (no look told) is Earth's, untouched.
type Rgb = readonly [number, number, number];

/** How a world's life turns Earth's greens: the hue it turns them to (0 … 1), their lightness and strength against Earth's. */
const TURNS: Readonly<
  Record<string, { readonly hue: number; readonly light: number; readonly strength: number }>
> = {
  carotene: { hue: 0.09, light: 1.12, strength: 1.1 },
  phycocyanin: { hue: 0.55, light: 1, strength: 0.95 },
  bacteriochlorophyll: { hue: 0.8, light: 0.5, strength: 0.55 },
  polyimine: { hue: 0.11, light: 0.72, strength: 0.75 },
  bare: { hue: 0.09, light: 1.08, strength: 0.28 },
};

/** A world's life's colour in a word, for the legends ("golden woods"). */
export const LIFE_WORDS: Readonly<Record<string, string>> = {
  carotene: "golden",
  phycocyanin: "blue",
  bacteriochlorophyll: "black",
  polyimine: "amber",
};

/** Hue, saturation, lightness (each 0 … 1) of a colour. */
function toHsl(c: Rgb): [number, number, number] {
  const [r, g, b] = c,
    hi = Math.max(r, g, b),
    lo = Math.min(r, g, b),
    l = (hi + lo) / 2,
    d = hi - lo;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)),
    h = hi === r ? ((g - b) / d + 6) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

/** A colour of a hue, saturation and lightness (each 0 … 1). */
function fromHsl(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s,
    hh = (((h % 1) + 1) % 1) * 6,
    x = c * (1 - Math.abs((hh % 2) - 1)),
    m = l - c / 2,
    [r, g, b] =
      hh < 1
        ? [c, x, 0]
        : hh < 2
          ? [x, c, 0]
          : hh < 3
            ? [0, c, x]
            : hh < 4
              ? [0, x, c]
              : hh < 5
                ? [x, 0, c]
                : [c, 0, x];
  return [r + m, g + m, b + m];
}

/**
 * A colour of Earth's living green turned to a world's own life's (`look`: its pigment, or "bare"
 * where nothing grows): a green — a hue between yellow-green and blue-green, coloured enough to be
 * leaf or grass — turned to the pigment's hue, lighter or darker as it is; anything else as it is.
 */
export function lifeTint(c: Rgb, look?: string): Rgb {
  const turn = look ? TURNS[look] : undefined;
  if (!turn) return c;
  const [h, s, l] = toHsl(c);
  if (h < 0.17 || h > 0.47 || s < 0.15) return c;
  return fromHsl(
    turn.hue + (h - 0.3) * 0.25,
    Math.min(1, s * turn.strength),
    Math.min(0.92, l * turn.light),
  );
}

/** Blood's colours as a battle shows it: its pools, its spray, a fresh wound, a dried one, a wound's core, raw flesh. */
export type BloodTones = {
  readonly pool: Rgb;
  readonly spray: Rgb;
  readonly wet: Rgb;
  readonly dried: Rgb;
  readonly core: Rgb;
  readonly flesh: Rgb;
};

/**
 * Blood by what carries its breath (Phase 57): iron's red (haem), copper's blue (haemocyanin, its
 * flesh pale as an octopus's), vanadium's green (in acid), and the brown of iron and sulfur.
 */
export const BLOOD_TONES: Readonly<Record<string, BloodTones>> = {
  iron: {
    pool: [0.4, 0.02, 0.03],
    spray: [0.62, 0.03, 0.04],
    wet: [0.55, 0.02, 0.03],
    dried: [0.26, 0.015, 0.02],
    core: [0.12, 0, 0.01],
    flesh: [0.62, 0.1, 0.09],
  },
  copper: {
    pool: [0.05, 0.14, 0.4],
    spray: [0.1, 0.3, 0.68],
    wet: [0.08, 0.24, 0.6],
    dried: [0.05, 0.08, 0.2],
    core: [0.01, 0.02, 0.1],
    flesh: [0.8, 0.78, 0.74],
  },
  vanadium: {
    pool: [0.16, 0.32, 0.06],
    spray: [0.36, 0.62, 0.12],
    wet: [0.28, 0.52, 0.1],
    dried: [0.14, 0.2, 0.05],
    core: [0.04, 0.08, 0.01],
    flesh: [0.66, 0.62, 0.42],
  },
  "iron-sulfur": {
    pool: [0.2, 0.11, 0.04],
    spray: [0.36, 0.2, 0.07],
    wet: [0.3, 0.17, 0.06],
    dried: [0.12, 0.07, 0.03],
    core: [0.04, 0.02, 0.01],
    flesh: [0.52, 0.38, 0.26],
  },
};

/** A blood's colours (iron's red where none is told). */
export function bloodTones(blood?: string): BloodTones {
  return (blood && BLOOD_TONES[blood]) || BLOOD_TONES.iron!;
}
