// A world's bulk chemistry (Phase 54 M221): the same physics everywhere, each world's own share of it.
// A star's metals fall with its age (the galaxy's gas is enriched star by star); carbon follows its
// metals; the inner, older worlds condense richer in magnesium, the outer ones in silicon; and the
// oxygen of a living world's air follows its star's light. From these: whether its rock is oxide or
// carbide, poor or rich in metals, rich or poor in silica, its air thin or rich, whether its iron
// rusts — and what hardens its copper. Earth is the Sun's own case: its tables, exactly (SOLAR).
import { dmath } from "../kernel/index.ts";

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
};

/** What a world's chemistry is drawn from: its star's warmth and age, where its orbit lies, three draws in [-1, 1). */
export type ChemistryInputs = {
  readonly temperature: number;
  readonly ageGyr: number;
  /** Where in its star's habitable zone it orbits: 0 its inner edge, 1 its outer. */
  readonly zone: number;
  readonly u: readonly [number, number, number];
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

/** What hardens copper on a world: nickel where its crust is poor in silica, arsenic where poor in metals, else tin. */
export function hardenerOf(silica: SilicaClass, metals: MetalsClass): Hardener {
  if (silica === "low") return "nickel";
  if (metals === "poor") return "arsenic";
  return "tin";
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

/** A world's chemistry from its star and orbit (never the Sun's own tables: those are SOLAR's). */
export function chemistryOf(i: ChemistryInputs): Chemistry {
  const bulk = bulkOf(i);
  return { ...bulk, ...classesOf(bulk), solar: false };
}

/** Whether a chemistry falls in the Sun's classes all over: oxide, and its metals, silica and air as the Sun's. */
export function isSolarClassed(c: Chemistry): boolean {
  return c.carbon === "oxide" && c.metals === "solar" && c.silica === "solar" && c.air === "solar";
}

/** A chemistry's classes as a key ("solar" for the Sun's own). */
export function chemistryKey(c: Chemistry): string {
  return c.solar ? "solar" : `${c.carbon}/${c.metals}/${c.silica}/${c.air}`;
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
