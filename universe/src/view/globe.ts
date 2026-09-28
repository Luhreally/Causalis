// How a planet looks, as data (docs/architecture §28, §31 lenses): the globe
// frame's fields coloured by a lens. Pure — a lens switch needs no round trip to
// the host, and the same frame always gives the same colours.
import type { FrameMessage } from "../bridge/index.ts";
import type { SphereGrid } from "../kernel/index.ts";
import type { Rgb } from "./sandbox.ts";

export const LENSES = [
  "terrain",
  "people",
  "food",
  "trade",
  "tongues",
  "realms",
  "faiths",
  "height",
  "temperature",
  "rain",
  "plates",
  "resources",
  "life",
  "diplomacy",
  "war",
] as const;
export type Lens = (typeof LENSES)[number];

export const LENS_NAMES: Readonly<Record<Lens, string>> = {
  terrain: "Land",
  people: "People",
  food: "Food",
  trade: "Trade",
  tongues: "Tongues",
  realms: "Realms",
  faiths: "Faiths",
  height: "Height",
  temperature: "Warmth",
  rain: "Rain",
  plates: "Plates",
  resources: "Ores",
  life: "Life",
  diplomacy: "Diplomacy",
  war: "War",
};

/** Each map mode's icon, for the map modes' bar (Phase 10 M96). */
export const LENS_ICONS: Readonly<Record<Lens, string>> = {
  terrain: "🗺️",
  people: "👥",
  food: "🌾",
  trade: "💰",
  tongues: "🗣️",
  realms: "👑",
  faiths: "✨",
  height: "⛰️",
  temperature: "🌡️",
  rain: "🌧️",
  plates: "🧩",
  resources: "⛏️",
  life: "🦌",
  diplomacy: "🤝",
  war: "⚔️",
};

/** How every land stands toward the realm the diplomacy lens is of, in its colours. */
export const STANDING_COLORS: Readonly<Record<string, Rgb>> = {
  self: [1, 0.8, 0.22],
  pact: [0.18, 0.72, 0.3],
  friendly: [0.58, 0.86, 0.5],
  neutral: [0.64, 0.62, 0.56],
  rival: [0.96, 0.56, 0.2],
  war: [0.86, 0.1, 0.12],
};
/** Where the wars are, in the war lens's colours. */
export const WAR_COLORS: Readonly<Record<string, Rgb>> = {
  attacker: [0.86, 0.2, 0.14],
  defender: [0.22, 0.42, 0.9],
  prize: [1, 0.86, 0.22],
  taken: [0.62, 0.12, 0.52],
};

/** What a map mode's colours say: a ramp from low to high, or a key of colours and words. */
export type Legend =
  | {
      readonly kind: "ramp";
      readonly stops: readonly Rgb[];
      readonly low: string;
      readonly high: string;
    }
  | { readonly kind: "keys"; readonly keys: readonly (readonly [Rgb, string])[] };

// Biome colours, in the order of gen's BIOME codes: the bright, saturated earth of an
// early-2000s game (art track A1) — blue seas, green woods, sandy deserts, white ice.
const BIOME_COLORS: readonly Rgb[] = [
  [0.03, 0.12, 0.42],
  [0.05, 0.22, 0.6],
  [0.1, 0.46, 0.76],
  [0.86, 0.94, 1],
  [0.97, 0.98, 1],
  [0.6, 0.66, 0.5],
  [0.12, 0.42, 0.26],
  [0.78, 0.72, 0.54],
  [0.8, 0.76, 0.38],
  [0.24, 0.58, 0.2],
  [0.08, 0.5, 0.3],
  [0.97, 0.82, 0.46],
  [0.86, 0.72, 0.28],
  [0.52, 0.64, 0.16],
  [0.05, 0.5, 0.15],
  [0.62, 0.58, 0.55],
];

export const DEPOSIT_COLORS: readonly Rgb[] = [
  [0.85, 0.45, 0.2],
  [0.98, 0.82, 0.2],
  [0.75, 0.75, 0.8],
  [0.7, 0.25, 0.2],
  [0.15, 0.15, 0.15],
  [0.5, 0.2, 0.6],
  [0.95, 0.95, 0.95],
];

type Stop = readonly [number, Rgb];

function ramp(stops: readonly Stop[], v: number): Rgb {
  if (v <= stops[0]![0]) return stops[0]![1];
  for (let i = 1; i < stops.length; i++) {
    const [x1, c1] = stops[i]!,
      [x0, c0] = stops[i - 1]!;
    if (v <= x1) {
      const t = (v - x0) / (x1 - x0);
      return [
        c0[0] + (c1[0] - c0[0]) * t,
        c0[1] + (c1[1] - c0[1]) * t,
        c0[2] + (c1[2] - c0[2]) * t,
      ];
    }
  }
  return stops[stops.length - 1]![1];
}

const DEPTH: readonly Stop[] = [
  [-9000, [0.03, 0.08, 0.2]],
  [-4000, [0.07, 0.17, 0.36]],
  [-1000, [0.12, 0.3, 0.52]],
  [0, [0.25, 0.5, 0.68]],
];
const HEIGHT: readonly Stop[] = [
  [0, [0.3, 0.55, 0.3]],
  [500, [0.55, 0.65, 0.35]],
  [1500, [0.72, 0.62, 0.38]],
  [3000, [0.55, 0.45, 0.38]],
  [5000, [0.92, 0.92, 0.94]],
];
const WARMTH: readonly Stop[] = [
  [-40, [0.2, 0.25, 0.7]],
  [-10, [0.55, 0.75, 0.95]],
  [0, [0.93, 0.95, 0.97]],
  [15, [0.98, 0.85, 0.45]],
  [30, [0.85, 0.25, 0.15]],
];
const RAIN: readonly Stop[] = [
  [0, [0.66, 0.5, 0.3]],
  [300, [0.86, 0.76, 0.46]],
  [800, [0.45, 0.66, 0.3]],
  [1600, [0.15, 0.5, 0.35]],
  [3000, [0.12, 0.3, 0.7]],
];
const LIFE: readonly (readonly [number, Rgb])[] = [
  [1, [0.5, 0.58, 0.32]],
  [2, [0.25, 0.6, 0.25]],
  [4, [0.08, 0.45, 0.18]],
];

function hue(h: number, s: number, v: number): Rgb {
  const i = Math.floor(h * 6),
    f = h * 6 - i,
    p = v * (1 - s),
    q = v * (1 - f * s),
    t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}

const PEOPLE: readonly Stop[] = [
  [0, [0.95, 0.8, 0.45]],
  [0.5, [0.95, 0.55, 0.25]],
  [2, [0.85, 0.25, 0.2]],
  [8, [0.55, 0.1, 0.25]],
];

// What food costs against its usual worth: cheap is green, dear is red.
/** Goods a land moved in a year (in and out), on a log scale: from a trickle to a great market. */
const TRADE: readonly Stop[] = [
  [0.5, [0.35, 0.45, 0.7]],
  [2, [0.3, 0.75, 0.85]],
  [3.5, [0.95, 0.85, 0.3]],
  [5, [1, 0.45, 0.2]],
];

const FOOD: readonly Stop[] = [
  [0.4, [0.3, 0.72, 0.4]],
  [1, [0.95, 0.85, 0.4]],
  [1.6, [0.92, 0.45, 0.22]],
  [2.5, [0.75, 0.12, 0.18]],
];

/** A biome's colour on the land lens. */
export function biomeColor(biome: number): Rgb {
  return BIOME_COLORS[biome] ?? [0.5, 0.6, 0.35];
}

/**
 * Per-cell RGBA (0–255) for a globe frame under a lens. `values` feeds the lenses
 * that show the people: for "people", people per 100 km²; for "food", what food
 * costs against its usual worth.
 */
export function globeColors(
  frame: FrameMessage,
  lens: Lens,
  values?: ReadonlyMap<number, number>,
  colors?: ReadonlyMap<number, Rgb>,
  grid?: SphereGrid,
  taken?: ReadonlyMap<number, Rgb>,
): Uint8Array {
  const a = frame.arrays,
    elevation = a.elevation!,
    n = elevation.length,
    out = new Uint8Array(n * 4),
    meta = frame.meta as { plates: { continental: boolean }[] };
  for (let c = 0; c < n; c++) {
    const e = elevation[c]!,
      sea = e <= 0,
      biome = a.biome![c]!,
      // People's facts are their province's: each land cell shows its province's.
      province = sea ? -1 : a.province ? a.province[c]! : c;
    let col: Rgb;
    switch (lens) {
      case "terrain":
        col = BIOME_COLORS[biome] ?? [1, 0, 1];
        if (!sea) {
          const lift = Math.min(1, e / 4000) * 0.25;
          col = [
            col[0] + (1 - col[0]) * lift,
            col[1] + (1 - col[1]) * lift,
            col[2] + (1 - col[2]) * lift,
          ];
          if (a.lake![c]) col = [0.2, 0.42, 0.62];
          else if (a.river![c])
            col = [col[0] * 0.55 + 0.1, col[1] * 0.55 + 0.2, col[2] * 0.55 + 0.33];
        } else if (biome !== 3) col = ramp(DEPTH, e);
        break;
      case "height":
        col = sea ? ramp(DEPTH, e) : ramp(HEIGHT, e);
        break;
      case "temperature":
        col = ramp(WARMTH, a.temperature![c]!);
        if (sea) col = [col[0] * 0.8, col[1] * 0.8, col[2] * 0.85];
        break;
      case "rain":
        col = sea ? [0.18, 0.22, 0.3] : ramp(RAIN, a.precipitation![c]!);
        break;
      case "plates": {
        const p = a.plate![c]!,
          continental = meta.plates[p]?.continental ?? false;
        col = hue((p * 0.61803398875) % 1, continental ? 0.45 : 0.7, sea ? 0.55 : 0.9);
        break;
      }
      case "realms":
      case "faiths":
      case "tongues":
      case "diplomacy":
      case "war": {
        const tongue = colors?.get(province);
        if (tongue) {
          // A land taken by force, still resenting it (Phase 11 M104): its taker's colour in
          // shadow, touched with the colour of the realm it was taken from. (Its facets are too
          // few for a grand strategy map's stripes: they would read as a patchwork of realms.)
          const loser = taken?.get(province),
            flat: Rgb = loser
              ? [
                  (tongue[0] * 0.8 + loser[0] * 0.2) * TAKEN,
                  (tongue[1] * 0.8 + loser[1] * 0.2) * TAKEN,
                  (tongue[2] * 0.8 + loser[2] * 0.2) * TAKEN,
                ]
              : tongue;
          // The land's own shading under its colour: lighter as it rises and where little
          // grows, darker in its woods (M104).
          const base = BIOME_COLORS[biome] ?? [0.5, 0.6, 0.35],
            light = (base[0] + base[1] + base[2]) / 3 + Math.min(1, e / 4000) * 0.25,
            k = Math.max(0.82, Math.min(1.08, 0.8 + 0.5 * (light - 0.3)));
          col = [flat[0] * k, flat[1] * k, flat[2] * k];
        } else {
          const base = sea ? ramp(DEPTH, e) : BIOME_COLORS[biome]!,
            grey = (base[0] + base[1] + base[2]) / 3;
          col = sea
            ? [base[0] * 0.7, base[1] * 0.7, base[2] * 0.75]
            : [grey * 0.65, grey * 0.65, grey * 0.6];
        }
        break;
      }
      case "people":
      case "food":
      case "trade": {
        const v = values?.get(province);
        if (v !== undefined && v > 0)
          col =
            lens === "trade"
              ? ramp(TRADE, Math.log10(1 + v))
              : ramp(lens === "people" ? PEOPLE : FOOD, v);
        else {
          const base = sea ? ramp(DEPTH, e) : BIOME_COLORS[biome]!,
            grey = (base[0] + base[1] + base[2]) / 3;
          col = sea
            ? [base[0] * 0.7, base[1] * 0.7, base[2] * 0.75]
            : [grey * 0.65, grey * 0.65, grey * 0.6];
        }
        break;
      }
      case "life": {
        // How many kinds of beast live here: the rich forests and savannas green, the barren grey.
        const d = a.diversity ? a.diversity[c]! : 0;
        col = sea ? [0.12, 0.16, 0.24] : d > 0 ? ramp(LIFE, d) : [0.35, 0.33, 0.3];
        break;
      }
      case "resources": {
        const k = a.deposit![c]!;
        if (k !== 255) col = DEPOSIT_COLORS[k] ?? [1, 0, 1];
        else {
          const base = sea ? ramp(DEPTH, e) : BIOME_COLORS[biome]!,
            grey = (base[0] + base[1] + base[2]) / 3;
          col = [grey * 0.6, grey * 0.6, grey * 0.65];
        }
        break;
      }
    }
    out[c * 4] = Math.round(Math.max(0, Math.min(1, col[0])) * 255);
    out[c * 4 + 1] = Math.round(Math.max(0, Math.min(1, col[1])) * 255);
    out[c * 4 + 2] = Math.round(Math.max(0, Math.min(1, col[2])) * 255);
    out[c * 4 + 3] = 255;
  }
  if (grid && colors && BORDERED.has(lens)) borders(out, frame, colors, grid);
  return out;
}

/** How dark a land taken by force is drawn, still resenting its taking. */
const TAKEN = 0.68;

/** The map modes whose lands are drawn with their borders. */
const BORDERED: ReadonlySet<Lens> = new Set(["realms", "faiths", "tongues", "diplomacy", "war"]);

/**
 * A grand strategy map's borders: where a land meets another of a different colour (another
 * realm, faith, tongue) its edge is drawn dark; where it meets another land of the same, a
 * faint line; the sea's shore needs none.
 */
function borders(
  out: Uint8Array,
  frame: FrameMessage,
  colors: ReadonlyMap<number, Rgb>,
  grid: SphereGrid,
): void {
  const province = frame.arrays.province as Int32Array | undefined,
    elevation = frame.arrays.elevation!;
  if (!province) return;
  const n = elevation.length,
    shade = new Float32Array(n).fill(1);
  for (let c = 0; c < n; c++) {
    if (elevation[c]! <= 0) continue;
    const p = province[c]!,
      mine = colors.get(p);
    let k = 1;
    for (let j = grid.offsets[c]!; j < grid.offsets[c + 1]!; j++) {
      const m = grid.neighbours[j]!;
      if (elevation[m]! <= 0) continue;
      const q = province[m]!;
      if (q === p) continue;
      const theirs = colors.get(q);
      k = Math.min(
        k,
        theirs === mine || (theirs && mine && theirs.every((v, i) => v === mine[i])) ? 0.84 : 0.42,
      );
    }
    shade[c] = k;
  }
  for (let c = 0; c < n; c++) {
    const k = shade[c]!;
    if (k === 1) continue;
    out[c * 4] = Math.round(out[c * 4]! * k);
    out[c * 4 + 1] = Math.round(out[c * 4 + 1]! * k);
    out[c * 4 + 2] = Math.round(out[c * 4 + 2]! * k + (1 - k) * 18);
  }
}

/** What a map mode's colours say, for its legend. */
export function lensLegend(lens: Lens): Legend {
  const stops = (list: readonly Stop[]) => list.map(([, c]) => c);
  switch (lens) {
    case "people":
      return { kind: "ramp", stops: stops(PEOPLE), low: "few", high: "crowded" };
    case "food":
      return { kind: "ramp", stops: stops(FOOD), low: "cheap", high: "dear" };
    case "trade":
      return { kind: "ramp", stops: stops(TRADE), low: "a trickle", high: "a great market" };
    case "height":
      return { kind: "ramp", stops: stops(HEIGHT), low: "lowland", high: "peaks" };
    case "temperature":
      return { kind: "ramp", stops: stops(WARMTH), low: "-40 °C", high: "30 °C" };
    case "rain":
      return { kind: "ramp", stops: stops(RAIN), low: "desert", high: "3 m a year" };
    case "life":
      return { kind: "ramp", stops: LIFE.map(([, c]) => c), low: "few kinds", high: "many" };
    case "diplomacy":
      return {
        kind: "keys",
        keys: [
          [STANDING_COLORS.self!, "the realm"],
          [STANDING_COLORS.pact!, "sworn"],
          [STANDING_COLORS.friendly!, "friendly"],
          [STANDING_COLORS.neutral!, "neutral"],
          [STANDING_COLORS.rival!, "rivals"],
          [STANDING_COLORS.war!, "at war"],
        ],
      };
    case "war":
      return {
        kind: "keys",
        keys: [
          [WAR_COLORS.attacker!, "attacking"],
          [WAR_COLORS.defender!, "defending"],
          [WAR_COLORS.prize!, "fought for"],
          [WAR_COLORS.taken!, "lately taken"],
        ],
      };
    case "realms":
      return {
        kind: "keys",
        keys: [
          [[0.6, 0.6, 0.55], "each realm its colour, its name across its lands"],
          [[0.36, 0.36, 0.33], "in shadow: taken by force, and resenting it"],
        ],
      };
    case "faiths":
      return { kind: "keys", keys: [[[0.6, 0.6, 0.55], "each faith its colour"]] };
    case "tongues":
      return {
        kind: "keys",
        keys: [[[0.6, 0.6, 0.55], "each tongue a shade of its family's hue"]],
      };
    case "resources":
      return {
        kind: "keys",
        keys: DEPOSIT_COLORS.map(
          (c, i) =>
            [c, ["copper", "gold", "tin", "iron", "coal", "oil", "salt"][i] ?? "ore"] as const,
        ),
      };
    case "plates":
      return {
        kind: "keys",
        keys: [
          [[0.8, 0.6, 0.4], "continental plates"],
          [[0.3, 0.5, 0.8], "ocean plates"],
        ],
      };
    default:
      return {
        kind: "keys",
        keys: [
          [[0.24, 0.58, 0.2], "woods"],
          [[0.8, 0.76, 0.38], "grassland"],
          [[0.97, 0.82, 0.46], "desert"],
          [[0.97, 0.98, 1], "ice"],
          [[0.05, 0.22, 0.6], "sea"],
        ],
      };
  }
}

/**
 * How far a cell stands out from the sphere, for relief on the globe (radius 1):
 * the true height over a planet's radius, exaggerated so mountains can be seen
 * (at 25×, an 8 km peak stands 3% proud).
 */
export function globeRadius(
  elevation: number,
  exaggeration = 25,
  planetRadiusM = 6_371_000,
): number {
  return elevation <= 0 ? 1 : 1 + (exaggeration * elevation) / planetRadiusM;
}
