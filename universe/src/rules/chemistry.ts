// A world's bulk chemistry (Phase 54 M221): the same physics everywhere, each world's own share of it.
// A star's metals fall with its age (the galaxy's gas is enriched star by star); carbon follows its
// metals; the inner, older worlds condense richer in magnesium, the outer ones in silicon; and the
// oxygen of a living world's air follows its star's light. From these: whether its rock is oxide or
// carbide, poor or rich in metals, rich or poor in silica, its air thin or rich, whether its iron
// rusts — and what hardens its copper. Earth is the Sun's own case: its tables, exactly (SOLAR).
import { dmath } from "../kernel/index.ts";
import { carbonRatio, type NovelKind } from "./kinds.ts";
import { UCC_TRACE, crustMultiplier } from "./crust.ts";
import { metalFigures } from "./materials.ts";

export type CarbonClass = "oxide" | "carbon-rich";
export type MetalsClass = "poor" | "solar" | "rich";
export type SilicaClass = "high" | "solar" | "low";
export type AirClass = "thin" | "solar" | "rich";
export type Redox = "oxidised" | "reduced";
/** What hardens a world's copper into its first alloy: tin, arsenic, or nickel. */
export type Hardener = "tin" | "arsenic" | "nickel";

/** A world's bulk: its metals against the Sun's ([Fe/H], dex), carbon to oxygen, magnesium to silicon, its air's oxygen. */
export type Bulk = {
  readonly feH: number;
  readonly cO: number;
  readonly mgSi: number;
  readonly o2: number;
};

export type Chemistry = Bulk & {
  readonly carbon: CarbonClass;
  readonly metals: MetalsClass;
  readonly silica: SilicaClass;
  readonly air: AirClass;
  readonly redox: Redox;
  readonly hardener: Hardener;
  /** Only the Sun's own (SOLAR): Earth's tables, exactly. */
  readonly solar: boolean;
  /** Its kind, where it is not rocky (Phase 56): its own tables over Phase 54's (absent on a rocky world). */
  readonly kind?: NovelKind;
};

/** What a world's chemistry is drawn from: its star's warmth and age, where its orbit lies, three draws in [-1, 1). */
export type ChemistryInputs = {
  readonly temperature: number;
  readonly ageGyr: number;
  /** Where in its star's habitable zone it orbits: 0 its inner edge, 1 its outer. */
  readonly zone: number;
  readonly u: readonly [number, number, number];
  /** Its kind, where it is not rocky, and a draw in [-1, 1) of its disk (a carbon world's C/O): Phase 56. */
  readonly kind?: NovelKind;
  readonly disk?: number;
};

/** The Sun and the Earth: a star of 5,778 K, 4.6 billion years old; an orbit a ninth of the way out. */
export const SUN = { temperature: 5778, ageGyr: 4.6, zone: 0.11 } as const;

/** Where a class begins (the first match wins). */
export const THRESHOLDS = {
  carbonRich: 0.8,
  metalsPoor: -0.2,
  metalsRich: 0.2,
  silicaHigh: 0.85,
  silicaLow: 1.3,
  airThin: 0.176,
  airRich: 0.255,
} as const;

/** The Sun's own chemistry, frozen: Earth's tables, exactly. */
export const SOLAR: Chemistry = Object.freeze({
  feH: 0,
  cO: 0.55,
  mgSi: 1.05,
  o2: 0.2095,
  carbon: "oxide",
  metals: "solar",
  silica: "solar",
  air: "solar",
  redox: "oxidised",
  hardener: "tin",
  solar: true,
});

const clamp = (lo: number, hi: number, x: number) => Math.min(hi, Math.max(lo, x));

/** A world's bulk from its star and orbit. */
export function bulkOf(i: ChemistryInputs): Bulk {
  // (The solar neighbourhood's age–metallicity slope, about −0.06 dex a billion years, with its
  // scatter: about 0 at the Sun's age.)
  const feH = clamp(-1, 0.5, 0.3 - 0.065 * i.ageGyr + 0.12 * i.u[0]),
    // (The Sun's C/O is 0.55; carbon rises with metals.)
    cO = clamp(0.2, 1.2, 0.55 + 0.8 * feH + 0.15 * i.u[1]),
    // (Older stars are richer in the α elements, magnesium among them; it tells most close in.)
    a = clamp(0, 1, (i.ageGyr - 4.6) / 8),
    // (Chondritic Mg/Si is about 1.05; silicon-rich solids condense farther out.)
    mgSi =
      1.05 *
      (1 + 0.5 * (0.11 - i.zone)) *
      (1 + 0.6 * a * Math.max(0, 1 - i.zone / 0.5)) *
      (1 + 0.06 * i.u[2]),
    // (The oxygen of a living world's air follows its star's light.)
    o2 = 0.2095 * clamp(0.72, 1.45, dmath.pow(i.temperature / 5778, 1.5));
  return { feH, cO, mgSi, o2 };
}

/** The hardeners a people may alloy copper with, each by its element, in the order a tie goes. */
export const HARDENER_ELEMENTS: readonly (readonly [Hardener, string])[] = [
  ["tin", "Sn"],
  ["arsenic", "As"],
  ["nickel", "Ni"],
];
/**
 * What of an element its crust holds that never gathers into an ore to dig (ppm, est: 55, a little above Earth's crust's
 * 47): nickel the common silicates take up into their own crystals, gathering only where a crust holds more, in rock poor
 * in silica weathered to garnierite; tin and arsenic leave the silicates for veins and placers.
 */
export const ORE_FLOOR: Readonly<Record<string, number>> = { Sn: 0, As: 0, Ni: 55 };

const HARDENING = new Map<string, Readonly<Record<Hardener, number>>>();
/**
 * Each hardener's worth on a crust of these classes: what it adds to hammered copper's strength at five atoms in a hundred
 * (MPa, Labusch's law over the atoms' sizes and stiffnesses: rules/materials.ts) times what of it the crust holds above
 * what never gathers into ore (ppm, Earth's upper crust moved by the crust's classes: rules/crust.ts).
 */
export function hardenerWorth(
  silica: SilicaClass,
  metals: MetalsClass,
): Readonly<Record<Hardener, number>> {
  const key = `${silica}/${metals}`;
  let w = HARDENING.get(key);
  if (!w) {
    const chem = { solar: false, silica, metals, carbon: "oxide" } as Chemistry,
      copper = metalFigures({ Cu: 1 }, "hammered", 288)!.strength,
      out = {} as Record<Hardener, number>;
    for (const [h, e] of HARDENER_ELEMENTS) {
      const gain = metalFigures({ Cu: 0.95, [e]: 0.05 }, "hammered", 288)!.strength - copper,
        ppm = (UCC_TRACE[e] ?? 0) * crustMultiplier(chem, e);
      out[h] = Math.round(gain * Math.max(0, ppm - (ORE_FLOOR[e] ?? 0)));
    }
    w = out;
    HARDENING.set(key, w);
  }
  return w;
}

/**
 * What hardens copper on a world: the hardener worth most on its crust (hardenerWorth). On Earth's crust tin (its gain the
 * greatest, its share small); where the crust is poor in metals, arsenic, the commoner; where poor in silica, nickel.
 */
export function hardenerOf(silica: SilicaClass, metals: MetalsClass): Hardener {
  const w = hardenerWorth(silica, metals);
  let best: Hardener = HARDENER_ELEMENTS[0]![0];
  for (const [h] of HARDENER_ELEMENTS) if (w[h] > w[best]) best = h;
  return best;
}

/** A bulk's classes (each the first that holds). */
export function classesOf(b: Bulk): Omit<Chemistry, keyof Bulk | "solar"> {
  const carbon: CarbonClass = b.cO >= THRESHOLDS.carbonRich ? "carbon-rich" : "oxide",
    metals: MetalsClass =
      b.feH < THRESHOLDS.metalsPoor ? "poor" : b.feH > THRESHOLDS.metalsRich ? "rich" : "solar",
    silica: SilicaClass =
      b.mgSi < THRESHOLDS.silicaHigh ? "high" : b.mgSi > THRESHOLDS.silicaLow ? "low" : "solar",
    air: AirClass =
      b.o2 < THRESHOLDS.airThin ? "thin" : b.o2 > THRESHOLDS.airRich ? "rich" : "solar",
    redox: Redox = air === "thin" || carbon === "carbon-rich" ? "reduced" : "oxidised";
  return { carbon, metals, silica, air, redox, hardener: hardenerOf(silica, metals) };
}

/**
 * A kind's bulk (Phase 56): a carbon world's C/O is its disk's, and what oxygen it has is bound up in
 * carbon monoxide, almost none free; an ice world's air holds no oxygen at all. A sulfur world's is its
 * star's own.
 */
export function kindBulk(b: Bulk, kind: NovelKind, disk: number): Bulk {
  if (kind === "carbon") return { ...b, cO: carbonRatio(disk), o2: 0.0005 };
  if (kind === "ammonia" || kind === "methane") return { ...b, o2: 0 };
  return b;
}

/** A world's chemistry from its star and orbit (never the Sun's own tables: those are SOLAR's). */
export function chemistryOf(i: ChemistryInputs): Chemistry {
  const bulk = i.kind ? kindBulk(bulkOf(i), i.kind, i.disk ?? 0) : bulkOf(i);
  return { ...bulk, ...classesOf(bulk), solar: false, ...(i.kind ? { kind: i.kind } : {}) };
}

/** Whether a chemistry falls in the Sun's classes all over: oxide, and its metals, silica and air as the Sun's. */
export function isSolarClassed(c: Chemistry): boolean {
  return c.carbon === "oxide" && c.metals === "solar" && c.silica === "solar" && c.air === "solar";
}

/** A chemistry's classes as a key ("solar" for the Sun's own; a kind's, its kind first). */
export function chemistryKey(c: Chemistry): string {
  if (c.solar) return "solar";
  const classes = `${c.carbon}/${c.metals}/${c.silica}/${c.air}`;
  return c.kind ? `${c.kind}:${classes}` : classes;
}

/** Each class in words. */
export const CLASS_WORDS: {
  readonly carbon: Readonly<Record<CarbonClass, string>>;
  readonly metals: Readonly<Record<MetalsClass, string>>;
  readonly silica: Readonly<Record<SilicaClass, string>>;
  readonly air: Readonly<Record<AirClass, string>>;
  readonly redox: Readonly<Record<Redox, string>>;
} = {
  carbon: {
    oxide: "oxygen-rich, as the Sun's",
    "carbon-rich": "carbon-rich: carbides and graphite in its rock",
  },
  metals: {
    poor: "poor in metals",
    solar: "as rich in metals as the Sun",
    rich: "rich in metals",
  },
  silica: {
    high: "rich in silica: pale, quartz-rich rock",
    solar: "of Earth's balance of magnesium and silicon",
    low: "poor in silica: dark, magnesium-rich rock",
  },
  air: {
    thin: "thin in oxygen",
    solar: "as rich in oxygen as Earth's",
    rich: "rich in oxygen",
  },
  redox: {
    oxidised: "its iron rusts red",
    reduced: "nothing rusts: its iron stays black and grey",
  },
};
