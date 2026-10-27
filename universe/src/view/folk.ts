// A people's own look (Phase 34 M176–M177, asked for 2026-10-24: "the people or like humans of
// the aliens worlds all look the same the people dont like procedurally made of the world etc or
// have an alien look"): made of their world. Their body's plan sets how they stand — upright, or
// stooped on long arms as climbers are, low on four legs or six, a mantle over a ring of arms, an
// egg of a body on two long legs — and how many arms they have (four for four-handed climbers).
// What their forebears grew, as the tree of life has them, they bear still: a crest, horns, a
// tail, a long neck, feelers, one eye or three or four, a spotted or striped hide. Their planet's
// pull makes them tall and slight where it pulls lightly, low and broad where it pulls hard. Their
// hide is coloured by what covers it (fur in earth colours, scales green or ochre or blue, shells
// red or violet, feathers any colour at all, bare skin anything from green to violet), by the land
// they rose in (pale on the ice, sand-coloured in the deserts, greener in the rainforests,
// sea-blue by the water) and by their star (pale under a hot white star, dark purples under a dim
// red one, to drink what light there is); their eyes stand out against it. A key of their own
// keeps any two worlds' peoples apart. Their clothes go over their hide, in their group's colour.
// What their life is made of shows (Phase 57): a shell hardened with iron sulfide is black, with
// opal milky as glass, with ice white; bare skin is flushed with blood that is not red.
// Earth's people are its upright apes, as ever: no look. Pure: the same facts, the same people.
import type { FolkFacts } from "../bridge/index.ts";
import { BLOOD_TONES } from "./biochem.ts";

type Rgb = readonly [number, number, number];

/** How a people stands. */
export type Stance = "upright" | "stooped" | "low" | "mantle" | "strider";

/** A people's look, made of their world. */
export type FolkLook = {
  readonly stance: Stance;
  /** Their build against an upright ape's: legs and body drawn out (taller), broader (girth), the head. */
  readonly tall: number;
  readonly girth: number;
  readonly head: number;
  readonly headShape: "box" | "round" | "long";
  /** How far the face comes forward (0 … 1), and whether as a beak. */
  readonly snout: number;
  readonly beak: boolean;
  /** Neck and tail, 0 … 1. */
  readonly neck: number;
  readonly tail: number;
  readonly arms: 2 | 4;
  /** A crest (0 … 1), horns (or tusks), eyes, feelers, ears (0 … 1), the hide's markings. */
  readonly crest: number;
  readonly horns: 0 | 1 | 2;
  readonly tusks: boolean;
  readonly eyes: 1 | 2 | 3 | 4;
  readonly feelers: boolean;
  readonly ears: number;
  readonly pattern: "plain" | "spots" | "stripes";
  /** Their hide, its lighter underside and face, its darker limbs, their markings, their eyes. */
  readonly hide: Rgb;
  readonly under: Rgb;
  readonly shade: Rgb;
  readonly mark: Rgb;
  /** The markings' shades, one for each of the upright apes' hairs (each person's own; grey last, for the old). */
  readonly marks: readonly Rgb[];
  readonly eye: Rgb;
};

/** What of a body the look needs. */
type LookBody = {
  readonly clade: string;
  readonly medium: string;
  readonly symmetry: string;
  readonly manipulators: string;
  readonly limbs: number;
  readonly skin: string;
  readonly folk?: FolkFacts | null;
};

/** A keyed share in [0, 1). */
function unitOf(key: number, n: number): number {
  let h = (key ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** A colour from its hue (degrees), saturation and lightness (0 … 1). */
export function hsl(h: number, s: number, l: number): Rgb {
  const hh = (((h % 360) + 360) % 360) / 60,
    c = (1 - Math.abs(2 * l - 1)) * s,
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

/** Hue `a` turned toward `b` by k (the shorter way round). */
function toward(a: number, b: number, k: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * k;
}

/**
 * Bare skin flushed with what flows under it, where its blood is not red (Phase 57): a quarter of
 * the way to its blood's colour, as Earth's lips and cheeks are with haem — blue with copper,
 * green with vanadium, brown with iron and sulfur. Fur, scales, feathers and shells hide it.
 */
function flushed(c: Rgb, blood: string | undefined): Rgb {
  const b = blood ? BLOOD_TONES[blood]?.spray : undefined;
  return b
    ? [c[0] + 0.25 * (b[0] - c[0]), c[1] + 0.25 * (b[1] - c[1]), c[2] + 0.25 * (b[2] - c[2])]
    : c;
}

/** How many markings' shades a look has: as many as the upright apes' hairs (five, and grey). */
export const MARK_SHADES = 6;

/** A people's look, made of their world (null: no facts — Earth's upright apes, or a kind's plain figure). */
export function folkLook(b: LookBody | null): FolkLook | null {
  const f = b?.folk;
  if (!b || !f) return null;
  const u = (n: number) => unitOf(f.key, n),
    fore = f.forebears,
    grows = new Set(fore?.grows ?? []),
    radial = b.symmetry === "radial" || b.manipulators === "tentacles";
  const stance: Stance = radial
    ? "mantle"
    : b.clade === "strider" || b.skin === "feathers"
      ? "strider"
      : b.clade === "shaggy"
        ? "stooped"
        : b.clade === "ape"
          ? "upright"
          : "low";
  // Their build, by their planet's pull (lightly pulled, tall and slight; hard, low and broad).
  const g = f.gravity,
    tall = clamp(1.3 - 0.3 * g, 0.78, 1.32) * (0.92 + 0.16 * u(1)),
    girth = clamp(0.7 + 0.3 * g, 0.78, 1.35) * (0.9 + 0.2 * u(2));
  // What their forebears grew.
  const crest =
      grows.has("crest") || grows.has("mane") || grows.has("spines")
        ? 0.6 + 0.4 * u(3)
        : u(3) < 0.2
          ? 0.45
          : 0,
    horned = grows.has("horns") || grows.has("wide-horns") || grows.has("antlers"),
    horns: 0 | 1 | 2 = horned ? (u(4) < 0.25 ? 1 : 2) : u(4) < 0.1 ? 1 : 0,
    tusks = grows.has("tusks") || (b.clade === "trunk" && u(5) < 0.6),
    beak = grows.has("beak") || b.skin === "feathers",
    eyesOf = fore?.eyes ?? -1,
    eyes: 1 | 2 | 3 | 4 =
      eyesOf === 0
        ? 1
        : eyesOf >= 4
          ? 4
          : eyesOf === 2
            ? u(6) < 0.15
              ? 3
              : 2
            : u(6) < 0.12
              ? 1
              : u(6) < 0.25
                ? 3
                : u(6) < 0.37
                  ? 4
                  : 2,
    feelers = !!fore?.feelers || b.clade === "burrower" || (!fore && u(7) < 0.15),
    pattern: FolkLook["pattern"] =
      fore?.pattern === "spots" || fore?.pattern === "stripes"
        ? fore.pattern
        : !fore && u(8) > 0.6
          ? u(8) > 0.8
            ? "stripes"
            : "spots"
          : "plain",
    neck0 = fore?.neck ?? 0.5 * u(9),
    tail0 = fore?.tail ?? 0.6 * u(10);
  const neck = stance === "strider" ? 0.5 + 0.5 * neck0 : clamp(neck0, 0, 1),
    tail =
      b.clade === "crawler"
        ? Math.max(0.5, tail0)
        : stance === "strider"
          ? 0.4 + 0.4 * tail0
          : b.clade === "ape"
            ? tail0 * 0.7
            : tail0,
    ears =
      b.skin === "fur"
        ? 0.4 + 0.6 * u(11)
        : b.clade === "trunk"
          ? 0.6 + 0.4 * u(11)
          : b.skin === "skin" && u(11) < 0.3
            ? 0.3
            : 0,
    snout = beak
      ? 0.5 + 0.4 * u(12)
      : b.skin === "fur"
        ? 0.25 + 0.5 * u(12)
        : b.skin === "scales"
          ? 0.35 + 0.5 * u(12)
          : b.skin === "shell"
            ? 0
            : 0.25 * u(12),
    headShape: FolkLook["headShape"] =
      stance === "strider" ? "round" : u(13) < 0.35 ? "box" : u(13) < 0.72 ? "round" : "long";
  // Their hide: by what covers it, then the land they rose in, then their star's light.
  let h: number, s: number, l: number;
  switch (b.skin) {
    case "fur":
      h = 18 + 32 * u(20) + (u(21) - 0.5) * 20;
      s = 0.22 + 0.3 * u(22);
      l = 0.26 + 0.3 * u(23);
      break;
    case "scales":
      h = u(20) < 0.45 ? 90 + 90 * u(21) : u(20) < 0.75 ? 35 + 30 * u(21) : 205 + 70 * u(21);
      s = 0.32 + 0.3 * u(22);
      l = 0.3 + 0.2 * u(23);
      break;
    case "feathers":
      h = 360 * u(20);
      s = 0.5 + 0.35 * u(22);
      l = 0.42 + 0.18 * u(23);
      break;
    case "shell":
      h = u(20) < 0.55 ? 340 + 60 * u(21) : u(20) < 0.8 ? 260 + 50 * u(21) : 170 + 40 * u(21);
      s = 0.45 + 0.3 * u(22);
      l = 0.3 + 0.18 * u(23);
      break;
    default:
      h = 130 + 220 * u(20);
      s = 0.2 + 0.35 * u(22);
      l = 0.34 + 0.26 * u(23);
  }
  // A shell hardened with what is not lime (Phase 57): iron sulfide black and lustrous, as the
  // scaly-foot snail's scales are; opal milky as glass; ice white and faintly blue. A shell of lime
  // keeps its pigments' colours, as Earth's crabs' do.
  if (b.skin === "shell" && f.shell === "greigite") {
    s = 0.06 + 0.08 * u(22);
    l = 0.13 + 0.06 * u(23);
  } else if (b.skin === "shell" && f.shell === "opal") {
    s = 0.04 + 0.06 * u(22);
    l = 0.68 + 0.1 * u(23);
  } else if (b.skin === "shell" && f.shell === "ice") {
    h = 196 + 14 * u(21);
    s = 0.24 + 0.1 * u(22);
    l = 0.76 + 0.08 * u(23);
  }
  if (f.warmth < -3) {
    // (Pale on the ice: white fur, the rest washed out.)
    if (b.skin === "fur") {
      l = 0.68 + 0.2 * u(24);
      s *= 0.5;
    } else {
      l += 0.08;
      s *= 0.75;
    }
  }
  if (f.biome === 11 || f.biome === 7 || (f.rain < 350 && f.warmth > 12)) {
    h = toward(h, 38, 0.45);
    s *= 0.85;
    l += 0.08;
  }
  if ((f.biome === 14 || f.biome === 10) && b.skin !== "feathers") {
    h = toward(h, 120, 0.25);
    s *= 1.1;
  }
  if (b.medium === "water" || b.medium === "shore") h = toward(h, 195, 0.3);
  if (f.star < 3900) {
    // (Under a dim red star, the dark of what would drink its light.)
    h = toward(h, 290, 0.35);
    l *= 0.78;
    s *= 1.05;
  } else if (f.star > 6600) {
    // (Under a hot white one, pale against its glare.)
    s *= 0.62;
    l = 0.82 * l + 0.16;
  }
  s = clamp(s, 0.08, 0.9);
  l = clamp(l, 0.12, 0.88);
  // Their markings: a colour against the hide (or its own darker points, on many furred peoples).
  const dark = b.skin === "fur" && u(25) < 0.5,
    hm = dark ? h : h + 150 + 60 * u(26),
    sm = dark ? s : 0.55 + 0.3 * u(27),
    lm = dark ? l * 0.55 : 0.38 + 0.2 * u(28),
    marks: Rgb[] = [];
  for (let k = 0; k < MARK_SHADES - 1; k++)
    marks.push(hsl(hm + (k - 2) * 8, sm, clamp(lm * (0.8 + 0.1 * k), 0.08, 0.9)));
  marks.push(hsl(hm, sm * 0.25, 0.7));
  return {
    stance,
    tall,
    girth,
    head: 0.82 + 0.45 * u(14),
    headShape,
    snout,
    beak,
    neck,
    tail: clamp(tail, 0, 1),
    arms: b.limbs >= 4 && !radial && stance !== "low" ? 4 : 2,
    crest,
    horns,
    tusks,
    eyes,
    feelers,
    ears,
    pattern,
    hide: hsl(h, s, l),
    under: flushed(
      hsl(h, s * 0.55, Math.min(0.9, l + 0.2)),
      b.skin === "skin" ? f.blood : undefined,
    ),
    shade: hsl(h, s * 0.95, l * 0.72),
    mark: marks[2]!,
    marks,
    eye: f.star > 6600 ? [0.06, 0.05, 0.08] : hsl(h + 180 + 70 * u(29), 0.85, l < 0.4 ? 0.62 : 0.5),
  };
}
