// A people's measure, and their shelter's (asked 2026-11-23: "the realistic physics and measurements of how like the creatures
// should be able to fit in its shelter, like some of these houses are too small for the thing inside it"). From their body as
// their figure is built of it (view/figure.ts): how tall they stand, how long and broad they lie, by their weight as a body grows
// (its height as the cube root of its weight: a body twice as tall is eight times as heavy), with no bounds but the body's own.
// From that, the door they go through upright and the head room over them, a storey's height (its room and its floor's depth),
// and the floor a household must lie on. Ours come to ours: an upright ape of 60 kg stands 1.75 m, its door 2 m, a storey 3 m.
// Every view that draws a people and their homes together draws both at these true measures (render/village.ts, view/town.ts,
// view/townform.ts), so no one is drawn taller than the door they live behind. Pure.
import { figureOf, partExtent, type Figure, type FigureBody } from "./figure.ts";

/** How tall we stand (m): an upright ape of the middle weight, 60 kg. */
export const OUR_STATURE = 1.75;
/** How heavy an upright ape of the middle weight is (kg): the weight a figure's own units are built at. */
const OUR_WEIGHT = 60;
/** How high an upright ape's figure stands in its own units (view/figure.ts upright(): its head's top). */
const UPRIGHT_TOP = 0.545;
/** Metres to one of a figure's own units, at its middle weight. */
export const FIGURE_METRES = OUR_STATURE / UPRIGHT_TOP;
/** A town's units to the metre (render/village.ts M). */
const TOWN_UNIT = 0.1;
/**
 * Over a body's height, as shares of it: the clear height of a door it walks through upright (2 m over our 1.75), the room's clear
 * height over its floor (2.7 m: room to stand and lift a load), and a floor's depth (0.3 m of joists and boards). A floor that
 * carries a body twice as tall carries eight times the weight over a span twice as wide: its depth grows with the body, at least.
 */
const DOOR_OVER = 2 / OUR_STATURE,
  ROOM_OVER = 2.7 / OUR_STATURE,
  FLOOR_DEPTH = 0.3 / OUR_STATURE,
  /** A door's breadth over a body's breadth, and the least (m, of ours). */
  DOOR_WIDE = 1.15;
/** The room one lies in past their own length and breadth (m at our measure): to turn over, to step past. */
const ROOM_ABOUT = 0.25;
/** A home's floor against the floor its household lie on: a hearth, a way between, what they keep. */
const FLOOR_OVER = 2;
/** How many live in a home (rules/dwelling.ts FAMILY_SIZE). */
export const HOUSEHOLD = 4.5;

export type Measures = {
  /** How tall they stand, how long and how broad they are (m). */
  readonly stature: number;
  readonly length: number;
  readonly breadth: number;
  /** The clear height of their door, and its breadth (m). */
  readonly door: number;
  readonly doorWide: number;
  /** A room's clear height over its floor, a floor's depth and a storey's whole height (m). */
  readonly room: number;
  readonly floor: number;
  readonly storey: number;
  /** The floor one of them lies on, and the floor a home of a household must have at the least (m²). */
  readonly rest: number;
  readonly home: number;
  /** Their height against ours (1: ours): what a home's heights are made at. */
  readonly rise: number;
  /** What a town's figure is drawn at: a town's units to a unit of the figure, so it stands its true height in it. */
  readonly drawn: number;
};

/** How a body grows from the middle weight its figure is built at: as the cube root of its weight. */
export function growth(b: Pick<FigureBody, "size"> | null | undefined): number {
  return Math.cbrt(Math.max(0.05, b?.size ?? OUR_WEIGHT) / OUR_WEIGHT);
}

/** A figure's extent in its own units: its top, its length (front to back) and its breadth. */
export function figureExtent(f: Pick<Figure, "parts">): {
  top: number;
  length: number;
  breadth: number;
} {
  let top = 0,
    z0 = Infinity,
    z1 = -Infinity,
    x0 = Infinity,
    x1 = -Infinity;
  for (const p of f.parts) {
    const e = partExtent(p);
    top = Math.max(top, p.y + e[1] / 2);
    // (Turned on its yaw as it may be turned, a part reaches as far as its widest side: read so.)
    const r = Math.max(e[0], e[2]) / 2;
    z0 = Math.min(z0, p.z - r);
    z1 = Math.max(z1, p.z + r);
    x0 = Math.min(x0, p.x - r);
    x1 = Math.max(x1, p.x + r);
  }
  return {
    top: top || UPRIGHT_TOP,
    length: Number.isFinite(z1) ? z1 - z0 : 0.11,
    breadth: Number.isFinite(x1) ? x1 - x0 : 0.26,
  };
}

const KEPT = new Map<string, Measures>();
const keyOf = (b: FigureBody | null | undefined): string =>
  b
    ? `${b.clade}|${b.medium}|${b.symmetry}|${b.manipulators}|${b.limbs}|${b.skin}|${b.size}|${b.folk?.key ?? "-"}|${b.legs ?? "-"}|${b.wings ?? "-"}|${b.hold ?? "-"}|${b.moves ?? "-"}|${b.rays ?? "-"}`
    : "-";

/** A people's measures and their shelter's, from their body (null: ours). */
export function measuresOf(b: FigureBody | null | undefined): Measures {
  const key = keyOf(b);
  const kept = KEPT.get(key);
  if (kept) return kept;
  const e = figureExtent(figureOf(b ?? null)),
    k = growth(b) * FIGURE_METRES,
    stature = e.top * k,
    length = e.length * k,
    breadth = e.breadth * k,
    // (One lies along their length, or their height if they stand taller than they are long.)
    lies = Math.max(stature, length),
    across = Math.max(breadth, Math.min(stature, length)),
    about = (ROOM_ABOUT * stature) / OUR_STATURE,
    rest = (lies + about) * (across + about),
    room = stature * ROOM_OVER,
    floor = stature * FLOOR_DEPTH,
    m: Measures = {
      stature,
      length,
      breadth,
      door: stature * DOOR_OVER,
      doorWide: Math.max(breadth * DOOR_WIDE, (0.9 * stature) / OUR_STATURE),
      room,
      floor,
      storey: room + floor,
      rest,
      home: rest * HOUSEHOLD * FLOOR_OVER,
      rise: stature / OUR_STATURE,
      drawn: (TOWN_UNIT * stature) / e.top,
    };
  if (KEPT.size > 64) KEPT.clear();
  KEPT.set(key, m);
  return m;
}

/** A figure as a town draws it: its scale its true height there (render/village.ts and every layer drawn among its folk). */
export function lifeFigure(f: Figure, b: FigureBody | null | undefined): Figure {
  return { ...f, scale: measuresOf(b).drawn };
}
