// Heraldry (Phase 11 M102): a realm's arms — a shield parted one of a few ways in its colour
// and a metal, and a charge: what its seat's land holds (the sea it looks on, its heights,
// its woods, its sands), what its faith holds (fire, plenty, rain…), or one of its own —
// which, its ref chooses. The same realm bears the same arms every time, on everything that
// names it.

type Rgb = readonly [number, number, number];

/** How the shield is parted. */
export type Division =
  "plain" | "pale" | "fess" | "quarterly" | "bend" | "chief" | "chevron" | "saltire";

/** What is borne on it. */
export type Charge =
  | "star"
  | "sun"
  | "moon"
  | "tower"
  | "crown"
  | "tree"
  | "mountain"
  | "waves"
  | "ring"
  | "cross"
  | "flame"
  | "sheaf"
  | "drop";

export type Arms = {
  readonly division: Division;
  /** The field's two tinctures: the realm's colour and a metal, in the order the parting takes them. */
  readonly field: readonly [Rgb, Rgb];
  readonly charge: Charge;
  /** The charge's tincture: the metal, or on a metal field, the colour. */
  readonly tincture: Rgb;
};

/** The two metals: gold and silver. */
export const METALS: readonly Rgb[] = [
  [0.96, 0.78, 0.26],
  [0.92, 0.93, 0.96],
];
const DIVISIONS: readonly Division[] = [
  "plain",
  "pale",
  "fess",
  "quarterly",
  "bend",
  "chief",
  "chevron",
  "saltire",
];
/** What a realm bears when nothing it holds says otherwise. */
const OWN: readonly Charge[] = ["star", "tower", "crown", "ring", "cross", "moon"];

/** A number of a string's own (FNV-1a), for choices made from a ref. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** What a realm holds that may name its charge: its seat's land, its faith. */
export type Holds = { readonly land?: Charge; readonly faith?: Charge };

/**
 * A realm's arms, from its ref and its colour. Its ref chooses what it bears: what its land
 * holds, what its faith holds, or one of its own (its own, too, when the one chosen says
 * nothing). The rule of tinctures is kept: colour on metal, metal on colour.
 */
export function armsFor(ref: string, color: Rgb, holds: Holds = {}): Arms {
  const h = hash(ref),
    metal = METALS[h & 1]!,
    division = DIVISIONS[(h >>> 1) % DIVISIONS.length]!,
    // (A plain field is the colour; a parted one begins with the colour or the metal.)
    first = division === "plain" || ((h >>> 5) & 1) === 0,
    own = OWN[(h >>> 7) % OWN.length]!,
    by = (h >>> 11) % 3;
  return {
    division,
    field: first ? [color, metal] : [metal, color],
    charge: (by === 0 ? holds.land : by === 1 ? holds.faith : undefined) ?? own,
    tincture: first ? metal : color,
  };
}
