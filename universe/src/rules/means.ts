// What a people wants done, and how its world says it is done (docs/architecture/first-principles-plan.md,
// F1): an edge, a charge, a barrel, each chosen from candidates with real figures by what each asks of a
// world's numbers, never by the name of its kind. Pure tables and functions. `est` marks a figure reckoned
// here rather than taken from a handbook; a page says so.
import { dmath } from "../kernel/index.ts";
import type { Medium } from "./bodies.ts";
import { machined, type Firearm } from "./firearms.ts";

export type MeansWorld = {
  readonly kelvin: number;
  readonly airBar: number;
  readonly pull: number;
  readonly freeOxygen: boolean;
  readonly medium: Medium;
  readonly bodyFire: boolean;
  readonly rock: boolean;
  readonly groundHolds: readonly string[];
  readonly airHolds: readonly string[];
  readonly seaKgM3: number;
  readonly seaIsWater: boolean;
  readonly ppm: (element: string) => number;
};

export type EdgeStuff = {
  readonly id: string;
  readonly name: string;
  readonly subst: string;
  /** Mohs at a temperature. */ readonly mohs: (kelvin: number) => number;
  /** Fracture toughness as set (MPa m^0.5). */ readonly k1c: number;
  readonly asks: {
    readonly ground?: string;
    readonly belowK?: number;
    readonly notOnLand?: boolean;
  };
  readonly words: string;
  readonly est: boolean;
};
export const EDGE_STUFFS: readonly EdgeStuff[] = [
  // SiC: Mohs 9.25 (rules/matter.ts); K1c 3-4, handbook. Knaps as flint does.
  {
    id: "moissanite",
    name: "moissanite",
    subst: "moissanite",
    mohs: () => 9.25,
    k1c: 3.5,
    asks: { ground: "moissanite" },
    words: "knapped from the carbide of its rock",
    est: false,
  },
  // Macuahuitl: flakes in a spine; flint and obsidian about Mohs 5.5-7, K1c about 1.
  {
    id: "flint",
    name: "flint",
    subst: "flint",
    mohs: () => 6.5,
    k1c: 1,
    asks: { ground: "flint" },
    words: "knapped as Earth's own macuahuitl was",
    est: false,
  },
  // Water ice: Mohs 2 at melting, 6 at -78 C (rules/matter.ts), capped at 6.5 (est). K1c 0.15; bound with
  // fibre about three times that (pykrete, Perutz 1948).
  {
    id: "ice",
    name: "ice",
    subst: "water-ice",
    mohs: (k) => Math.min(6.5, Math.max(0, 2 + (273.15 - k) * 0.051)),
    k1c: 0.45,
    asks: { ground: "water-ice", belowK: 233 },
    words: "knapped in its cold, bound with fibre as pykrete is",
    est: true,
  },
  // Nacre: Mohs 3.5, K1c 3-9; the low end. Kiribati's shark-tooth swords are the proof of teeth on a spine.
  {
    id: "shell",
    name: "shell",
    subst: "shell",
    mohs: () => 3.5,
    k1c: 3,
    asks: { notOnLand: true },
    words: "split from the shelf's great shells",
    est: true,
  },
];

export type Charge = {
  readonly id: string;
  readonly name: string;
  readonly short: string;
  /** Energy released (MJ/kg); gas (mol/kg); flame (K). */
  readonly mj: number;
  readonly mol: number;
  readonly flameK: number;
  /** Past tier: only at works with a current. */ readonly works: boolean;
  readonly asks: {
    readonly freeOxygen?: boolean;
    readonly bodyFire?: boolean;
    readonly air?: readonly string[];
    readonly belowK?: number;
    readonly waterOrIce?: boolean;
    readonly medium?: Medium;
  };
  readonly why: string;
  readonly est: boolean;
};
export const CHARGES: readonly Charge[] = [
  // Black powder: 2.7-3.1 MJ/kg, about 280 L/kg, handbook. (No ppm asks in F1: rocky worlds must read as today.)
  {
    id: "black-powder",
    name: "black powder",
    short: "powder",
    mj: 3,
    mol: 12,
    flameK: 2500,
    works: false,
    asks: { freeOxygen: true, bodyFire: true },
    why: "saltpetre, charcoal and sulphur, which a fire and free oxygen make",
    est: false,
  },
  // Guncotton: about 4.2 MJ/kg, 41 mol/kg, 3100 K, handbook.
  {
    id: "guncotton",
    name: "gun cotton",
    short: "smokeless",
    mj: 4.2,
    mol: 41,
    flameK: 3100,
    works: true,
    asks: { freeOxygen: true, bodyFire: true },
    why: "cotton steeped in nitric acid",
    est: false,
  },
  // C2H2(s) -> 2C + H2: +227 kJ/mol (gas; NIST), 8.7 MJ/kg, about 9% less as a solid; solid below 192 K
  // (triple point). Flame est. Needs no air at all.
  {
    id: "solid-acetylene",
    name: "solid acetylene",
    short: "acetylene",
    mj: 8.7,
    mol: 38.4,
    flameK: 2900,
    works: false,
    asks: { air: ["methane"], belowK: 192 },
    why: "the haze's acetylene, solid in this cold, which comes apart with no air at all",
    est: true,
  },
  // N2H4 -> N2 + 2H2: 1.6 MJ/kg, 94 mol/kg; forms in irradiated ammonia ice (Zheng et al. 2008). Flame est.
  {
    id: "hydrazine",
    name: "hydrazine",
    short: "hydrazine",
    mj: 1.58,
    mol: 93.6,
    flameK: 1100,
    works: false,
    asks: { air: ["ammonia"], belowK: 387 },
    why: "made of its ammonia by sunlight on frost, parted over iron",
    est: true,
  },
  // HCN -> C + N2/2 + H2/2: +135 kJ/mol, 5 MJ/kg, 37 mol/kg; forms in nitrogen and methane air (as on Titan). Flame est.
  {
    id: "hydrogen-cyanide",
    name: "hydrogen cyanide",
    short: "cyanide",
    mj: 5,
    mol: 37,
    flameK: 2800,
    works: false,
    asks: { air: ["methane"], belowK: 330 },
    why: "made of its nitrogen and methane, and needing no oxygen; a poison to us",
    est: true,
  },
  // N2H5N3: +246 kJ/mol, 3.3 MJ/kg, 66.6 mol/kg, all gas. Flame est.
  {
    id: "hydrazinium-azide",
    name: "hydrazinium azide",
    short: "azide",
    mj: 3.3,
    mol: 66.6,
    flameK: 1950,
    works: true,
    asks: { air: ["ammonia"], belowK: 340 },
    why: "a salt of nearly nothing but nitrogen, made with current",
    est: true,
  },
  // C2H2 + O2 -> 2CO + H2: 448 kJ/mol, 7.7 MJ/kg, 51.7 mol/kg. Flame about 3400 K. Oxygen by current.
  {
    id: "oxy-acetylene",
    name: "acetylene with made oxygen",
    short: "oxy-acetylene",
    mj: 7.7,
    mol: 51.7,
    flameK: 3400,
    works: true,
    asks: { air: ["methane"], belowK: 400 },
    why: "acetylene burned rich in oxygen a current has made",
    est: true,
  },
  // 2H2 + O2: 13.4 MJ/kg as steam, 55.5 mol/kg, about 3000 K. Water parted by current, for those who live in it.
  {
    id: "oxyhydrogen",
    name: "gas parted from water",
    short: "parted-gas",
    mj: 13.4,
    mol: 55.5,
    flameK: 3000,
    works: true,
    asks: { waterOrIce: true, medium: "water" },
    why: "water parted by current and burned again behind the dart",
    est: true,
  },
];
/** Interior ballistics' force constant, n R T (MJ/kg): black powder about 0.25, smokeless about 1. */
export const forceOf = (c: Pick<Charge, "mol" | "flameK">) => (c.mol * 8.314 * c.flameK) / 1e6;

export type Barrel = {
  readonly id: string;
  readonly name: string;
  readonly short: string;
  /** Hoop strength as wound or worked (MPa). */ readonly hoop: number;
  readonly works: boolean;
  readonly wound: boolean;
  readonly asks: {
    readonly furnace?: boolean;
    readonly air?: readonly string[];
    readonly copper?: boolean;
  };
  readonly est: boolean;
};
export const BARRELS: readonly Barrel[] = [
  {
    id: "steel",
    name: "steel",
    short: "steel",
    hoop: 800,
    works: true,
    wound: false,
    asks: { furnace: true },
    est: false,
  },
  {
    id: "iron",
    name: "iron",
    short: "iron",
    hoop: 370,
    works: false,
    wound: false,
    asks: { furnace: true },
    est: false,
  },
  // Drawn polymer: UHMWPE fibre 2.4-3.6 GPa; 1.5 GPa at 55% fibre for a first works (est).
  {
    id: "drawn-polymer",
    name: "drawn polymer fibre",
    short: "wound-polymer",
    hoop: 825,
    works: true,
    wound: true,
    asks: { air: ["methane"] },
    est: true,
  },
  // Drawn plant or beast fibre, as rayon: 800 MPa at 55% (est).
  {
    id: "drawn-fibre",
    name: "drawn fibre",
    short: "wound-fibre",
    hoop: 440,
    works: true,
    wound: true,
    asks: {},
    est: true,
  },
  // Cold-drawn copper wire 400 MPa at half fill. Wire-wound guns are real (Longridge, 1855).
  {
    id: "copper-wire",
    name: "copper wire",
    short: "wire-wound",
    hoop: 200,
    works: false,
    wound: true,
    asks: { copper: true },
    est: true,
  },
  // Hand-wound fibre: flax or sinew 500 MPa at 30% fill (est). The leather guns of Gustavus Adolphus are the proof.
  {
    id: "hand-fibre",
    name: "hand-wound fibre",
    short: "wound-fibre",
    hoop: 150,
    works: false,
    wound: true,
    asks: {},
    est: true,
  },
];
/** Thick-walled tube (Lame): what a bore holds of its hoop strength, at twice the bore's width without. */
const LAME = 0.6;

/** Peak pressure each arm wants (MPa, est from period figures) and what each charge is measured against. */
const WANTS_MPA: Readonly<Record<string, number>> = {
  musket: 80,
  rifle: 120,
  repeater: 280,
  autoloader: 340,
  automatic: 340,
};
/** Muzzle speed (m/s) and drag length 2m/(rho Cd A) in Earth's air (m), for each arm's ball, by mass and bore. */
const BALLS: Readonly<Record<string, readonly [number, number]>> = {
  musket: [400, 450],
  rifle: [300, 880],
  repeater: [600, 1500],
  autoloader: [850, 1200],
  automatic: [850, 1400],
};

const has = (held: readonly string[], want?: readonly string[]) =>
  !want || want.every((x) => held.includes(x));
const furnace = (w: MeansWorld) => w.freeOxygen && w.bodyFire;

export function chargeOk(c: Charge, w: MeansWorld): boolean {
  const a = c.asks;
  return (
    (!a.freeOxygen || w.freeOxygen) &&
    (!a.bodyFire || w.bodyFire) &&
    has(w.airHolds, a.air) &&
    (a.belowK === undefined || w.kelvin < a.belowK) &&
    (!a.medium || a.medium === w.medium) &&
    (!a.waterOrIce || w.seaIsWater || w.groundHolds.includes("water-ice"))
  );
}
function best<T>(all: readonly T[], score: (x: T) => number): T | null {
  let b: T | null = null,
    s = -Infinity;
  for (const x of all)
    if (score(x) > s + 1e-12) {
      b = x;
      s = score(x);
    }
  return b;
}
export const chargeFor = (w: MeansWorld, works: boolean): Charge | null =>
  best(
    CHARGES.filter((c) => chargeOk(c, w) && (works || !c.works)),
    forceOf,
  );
export function barrelFor(w: MeansWorld, works: boolean): Barrel {
  return best(
    BARRELS.filter(
      (b) =>
        (works || !b.works) &&
        (!b.asks.furnace || furnace(w)) &&
        has(w.airHolds, b.asks.air) &&
        (!b.asks.copper || (w.rock && w.ppm("Cu") >= 5)),
    ),
    (b) => b.hoop,
  )!;
}
const edgeOk = (e: EdgeStuff, w: MeansWorld) =>
  (!e.asks.ground || w.groundHolds.includes(e.asks.ground)) &&
  (e.asks.belowK === undefined || w.kelvin < e.asks.belowK) &&
  (!e.asks.notOnLand || w.medium !== "land");

/** The same law gives bronze 0.7, iron 0.79, steel 1 against the design table's 0.7, 0.8, 1. */
export function edgeFigure(mohs: number, k1c: number): number {
  return 0.6 * Math.min(1, mohs / 7) + 0.4 * Math.min(1, k1c / 5);
}
export function guardFigure(mohs: number, k1c: number): number {
  return 0.25 + 0.25 * Math.min(1, mohs / 7) + 0.25 * Math.min(1, k1c / 5);
}
export const edgeFor = (w: MeansWorld): EdgeStuff | null =>
  best(
    EDGE_STUFFS.filter((e) => edgeOk(e, w)),
    (e) => edgeFigure(e.mohs(w.kelvin), e.k1c),
  );

/** What this world's air weighs against Earth's at 15 C (ideal gas). */
export const airWeight = (w: Pick<MeansWorld, "airBar" | "kelvin">) =>
  (w.airBar * 288.15) / w.kelvin;

/** Metres a ball goes before it has fallen what it may: drag length L, speed v, flight time t. */
const carries = (L: number, v: number, t: number) => L * dmath.log1p((v * t) / L);

export type GunHere = {
  readonly range: number;
  readonly energy: number;
  readonly charge: Charge;
  readonly barrel: Barrel;
};
/** A gun on a world: its muzzle energy against Earth's, and how far it carries true by air and pull. */
export function gunHere(f: Firearm, w: MeansWorld): GunHere | null {
  const works = machined(f),
    charge = chargeFor(w, works),
    barrel = barrelFor(w, works);
  if (!charge) return null;
  const refuse = CHARGES[f.powder === "black" ? 0 : 1]!,
    ball = BALLS[f.id]!,
    energy =
      Math.min(1, (barrel.hoop * LAME) / WANTS_MPA[f.id]!) *
      Math.min(1, forceOf(charge) / forceOf(refuse)),
    t = (ball[1] / ball[0]) * (dmath.exp(f.range / ball[1]) - 1),
    here = carries(
      ball[1] / airWeight(w),
      ball[0] * dmath.pow(energy, 0.5),
      t / dmath.pow(w.pull, 0.5),
    );
  return { range: f.range * (here / carries(ball[1], ball[0], t)), energy, charge, barrel };
}

/** Arms for a people of the water: water stops a ball within metres. Range against fresh water (APS rifle: 30 m shallow; sound est). */
export const WATER_ARMS = {
  "gas-dart": { rate: 6, range: 30, shock: 0.6, cost: 0.3 },
  "sound-lance": { rate: 30, range: 120, shock: 0.8, cost: 0.55 },
} as const;
/** Long darts: drag scales with the liquid's weight. */
export const waterRange = (id: keyof typeof WATER_ARMS, w: MeansWorld) =>
  (WATER_ARMS[id].range * 1000) / w.seaKgM3;

export type Means = {
  /** The old road: free oxygen and a land or shore people. F1 leaves its figures as Earth's table has them (F4 ends this). */
  readonly earthRoad: boolean;
  readonly edge: EdgeStuff | null;
  readonly handCharge: Charge | null;
  readonly worksCharge: Charge | null;
  readonly handBarrel: Barrel;
  readonly worksBarrel: Barrel;
  /** Why no metal here, in a sentence. */
  readonly noMetal: string;
};
export function meansOf(w: MeansWorld): Means {
  const earthRoad = w.freeOxygen && w.medium !== "water";
  return {
    earthRoad,
    edge: edgeFor(w),
    handCharge: chargeFor(w, false),
    worksCharge: chargeFor(w, true),
    handBarrel: barrelFor(w, false),
    worksBarrel: barrelFor(w, true),
    noMetal: !w.freeOxygen
      ? "Nothing burns in its air, so no furnace can free a metal, and no forge can work one."
      : w.medium === "water"
        ? "No furnace can be lit under water."
        : "",
  };
}
/** A part's figures on this world, for a means-material (null: not to be had). */
export function hereOf(
  id: string,
  m: string,
  w: MeansWorld,
  f?: Firearm,
): { edge?: number; guard?: number; range?: number; shock?: number } | null {
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  if (m === "set edge") {
    const e = edgeFor(w);
    return e
      ? {
          edge: r3(edgeFigure(e.mohs(w.kelvin), e.k1c)),
          guard: r3(guardFigure(e.mohs(w.kelvin), e.k1c)),
        }
      : null;
  }
  if (id in WATER_ARMS) {
    const a = WATER_ARMS[id as keyof typeof WATER_ARMS];
    return { range: r3(waterRange(id as keyof typeof WATER_ARMS, w)), shock: a.shock };
  }
  if (f) {
    const g = gunHere(f, w);
    return g ? { range: r3(g.range), shock: r3(g.energy) } : null;
  }
  return m === "wound works" ? {} : null;
}
/** The world's names for a principle on the way it is done here (null: its own name). */
export function meansName(id: string, m: Means): string | null {
  if (m.earthRoad) return null;
  const c = m.handCharge?.name ?? "a charge",
    b = m.handBarrel.name;
  if (id === "set-edges") return `long blades of ${m.edge?.name ?? "hard"} flakes set in a spine`;
  if (id === "bound-plates") return `plates of ${m.edge?.name ?? "hard stuff"} bound in fibre`;
  if (id === "gunpowder") return `charges of ${c}`;
  if (id === "firearms") return `the gun of ${b}, charged with ${c}`;
  if (id === "rifling") return `the rifled barrel of ${b}`;
  return null;
}
