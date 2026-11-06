// The world acting on its own (N1, Classic 17, 46 and 73): what the ground, the weather and the sky do with no one's hand on them, by
// what a world holds. The rule, the owner's: the greater the fire, the rarer it falls and the more everyone feels it. Every rate here is
// read from what anyone can find in an encyclopedia, and a page says which. Pure tables and functions: the same numbers for a page and
// for history.
//
//   Quakes: Earthquake, Gutenberg-Richter law: some 15 a year of magnitude 7 on Earth, one of 8, ten times as many for each step down.
//   Lightning: Lightning: 44 flashes a second, 2.9 per km² a year on average, 30 and more in the wet tropics, under 1 toward the poles.
//   Fire: Wildfire, Fire ecology: woods burn once in 50 to 300 years, grass in 1 to 5; the worst seasons reach about 200,000 km².
//   Falling stars: Impact event, Chelyabinsk meteor, Tunguska event: a 20 m stone each 60 years or so, a 50 m stone each 1,000, 150 m each 20,000.
//   New mountains: Parícutin, Surtsey: a new cone is a few in a century on Earth, and stands hundreds of metres in its first year.
import { dmath } from "../kernel/index.ts";

export type FaultKind = "convergent" | "transform" | "divergent" | "within";

export const NATURE = {
  quake: {
    /** How many strong shocks (at `least`) a land has a year, by how its plates meet, for a plate of `plateSpeed`. Within a plate: seldom. */
    perYear: { convergent: 0.05, transform: 0.03, divergent: 0.008, within: 0.001 } as Readonly<
      Record<FaultKind, number>
    >,
    /** The share of that a land has by its steps from the meeting: on it, near, a day's ride from it. */
    onIt: 1,
    near: 0.35,
    off: 0.1,
    /** The least magnitude told; each step up is ten times rarer (Gutenberg-Richter's b of 1). */
    least: 6.5,
    /** The greatest each kind of meeting can bring (where plates go under, as the greatest on record; est for the rest). */
    most: { convergent: 9.3, transform: 8.2, divergent: 7.2, within: 7.6 } as Readonly<
      Record<FaultKind, number>
    >,
    /** The magnitude the god's quake is: at its middle, its shares as DISASTER.quake has them (est). */
    godMag: 7.5,
    /** How far from the middle its strength has fallen to about a third (km, est), and past what it lies under the told (share of the god's). */
    nearKm: 20,
    felt: 0.01,
    /** What the god's shares may come to, at most (a town mud-built and at the middle: Tangshan's and Bam's quarter and more). */
    mostDead: 0.25,
    mostHomes: 0.85,
    mostStores: 0.6,
    mostGrief: 0.6,
    /** What of its dead and of its fallen homes a land spared whose every hand has machines (est: Tōhoku's 20,000 against Haiti's). */
    builtSpares: 0.97,
    builtStands: 0.8,
    /** A country's people, spread out and under lower roofs: their share of what a town at that distance takes (est). */
    countryside: 0.4,
    /** How far from the middle a countryside lies on average (km), and a land beside it (km). */
    countryKm: 110,
    besideKm: 300,
    /** From what magnitude the lands beside it feel it. */
    besideFrom: 7.8,
    /** The mean speed of a world's plates (degrees a million years: gen/plates.ts). */
    plateSpeed: 1.15,
    /** Fewer plates than this and the world's crust is one lid: none of them moving against another. */
    leastPlates: 3,
  },
  rise: {
    /** How many new cones a land has a year where one plate goes under another or over a hot place: a few in a century on an Earth (est from Parícutin and Surtsey). */
    perYear: 7e-5,
    /** How high it stands in its first year (metres): Parícutin's 336 is the least, a great cone's the most (est). */
    least: 350,
    most: 1400,
  },
  fire: {
    /** How dry a year is before its woods burn: the world's own line for a drought. */
    dryYear: 0.72,
    /** What a bolt on its woods comes to: how many fires each of a land's flashes a km² a year lights in a dry year, at all woods (est: 1 land in 100 burns in a year at a temperate 4 flashes). */
    lit: 0.02,
    /** Past this much rain a land's woods stay wet even in a dry year (mm), and under this they are dry whatever falls (mm). */
    wetFrom: 2500,
    dryFrom: 1000,
    /** The most patches it can take (each about 110 km across on an Earth), and how much less likely each next one (a season has its end). */
    most: 18,
    fades: 0.1,
    /** The chance it crosses to the next at the full of its fuel, and how much a river takes from it. */
    spread: 0.75,
    river: 0.5,
    /** How much the wind's own way adds, and how much it takes against it. */
    wind: 0.35,
    /** Days it takes to cross a patch, at the full of its fuel: 8 to 25 km a day (est, Wildfire). */
    daysLeast: 5,
    daysMost: 14,
    /** How long the last of it smoulders (days). */
    lastDays: 9,
    /** What it burns of a town it reaches (of its homes) at the most, how many of those in the homes die (est: Paradise's 0.3%, Peshtigo's far worse), and how much a people in stone and brick are spared. */
    mostHomes: 0.55,
    deadOfHomes: 0.03,
    /** The chance a town on a patch it took is reached at all, at no fuel and for each share of it: most fires pass by a town's cleared ground (a few towns a decade on an Earth: Wildfire). */
    reachLeast: 0.05,
    reachFuel: 0.1,
    /** What burns on ground its people have farmed bare: stubble, hedges, a town's edge: as a share of its woods. */
    farmed: 0.15,
    /** A year as dry as a drought, for a land no one keeps a year's rain for: as often as the lands that do have one. */
    dryOften: 0.1,
    /** What of a land's forest stands after all its patches have burned. */
    forestLeft: 0.25,
    /** The most scars kept on a world at once: the oldest go first. */
    mostScars: 500,
  },
  star: {
    /** How far a falling star is seen (km: Chelyabinsk's was seen across some 700). */
    seenKm: 800,
  },
  answer: {
    /** What a ruler's answer takes: how much of its chance is its reach, how much its stores. */
    least: 0.15,
    capacity: 0.55,
    stores: 0.3,
    /** A month's food for the dead's living kin, of the people left in the place. */
    months: 2,
    /** What it comes to, at the greatest stakes: standing lost and won, a land's grief eased. */
    lost: 0.09,
    won: 0.05,
    eased: 0.2,
    /** Under so many dead the realm has no answer to give. */
    leastDead: 30,
  },
} as const;

/** What falls from a world's sky, in order of rarity (a year's chance on an Earth, for the whole world). */
export type StarClass = {
  readonly id: "bright" | "flattening" | "crater";
  readonly metres: number;
  readonly perYear: number;
  /** How far it flattens what stands (km) if it bursts over land: and of the god's meteor, its strength. */
  readonly reachKm: number;
  readonly strength: number;
};
export const STARS: readonly StarClass[] = [
  { id: "bright", metres: 20, perYear: 1 / 60, reachKm: 6, strength: 0.08 },
  { id: "flattening", metres: 50, perYear: 1 / 1000, reachKm: 35, strength: 0.6 },
  { id: "crater", metres: 150, perYear: 1 / 20000, reachKm: 160, strength: 1 },
];

/** How much more a world's sky brings than an Earth's: a young star's system is still clearing; a crowd of worlds stirs more; 1 on an Earth. */
export function skyRate(ageGyr: number, bodies: number): number {
  const young = ageGyr < 1 ? 6 : ageGyr < 2.5 ? 2 : 1;
  return young * dmath.clamp(0.7 + 0.05 * bodies, 0.7, 1.4);
}

/** Whether a stone of that many metres comes down whole through so much air, or bursts in it (a bar of air stops some 60 m of stone, est). */
export function reachesGround(metres: number, airBar: number): boolean {
  return metres >= 60 * dmath.clamp(dmath.pow(Math.max(0, airBar), 0.5), 0, 2.2);
}

/** A magnitude from a draw (0 … 1): rare ones rarer by Gutenberg-Richter, no greater than its kind of meeting can bring. */
export function magnitudeOf(u: number, most: number): number {
  const m = NATURE.quake.least - dmath.log10(Math.max(1e-9, 1 - u));
  return Math.round(Math.min(most, m) * 10) / 10;
}

/** How hard a shock strikes at so many km from its middle, against the god's quake at its own middle (1). */
export function shakeAt(mag: number, km: number): number {
  const q = NATURE.quake;
  return dmath.pow(10, mag - q.godMag) * dmath.pow(q.nearKm / (q.nearKm + Math.max(0, km)), 1.5);
}

/** What that strength takes of a place, by the god's own shares. */
export function shakeShares(
  h: number,
  god: {
    readonly dead: number;
    readonly stores: number;
    readonly blocks: number;
    readonly grief: number;
  },
): {
  readonly dead: number;
  readonly homes: number;
  readonly stores: number;
  readonly grief: number;
} {
  const q = NATURE.quake;
  return {
    dead: Math.min(q.mostDead, god.dead * h),
    homes: Math.min(q.mostHomes, god.blocks * h),
    stores: Math.min(q.mostStores, god.stores * h),
    grief: Math.min(q.mostGrief, god.grief * h),
  };
}

/** How many flashes a km² of a land has in a year, by its warmth (°C) and rain (mm): 25 in the wet tropics, 4 in a temperate land, under 1 in the cold. */
export function flashesOf(warmth: number, wet: number): number {
  const w = dmath.clamp((warmth + 10) / 25, 0, 1.6);
  return Math.round(80 * dmath.pow(Math.max(0, wet) / 1000, 0.7) * w * w) / 10;
}

/** How far a year's rain leaves a land's woods able to burn (0 … 1). */
export function dryness(wet: number, year: number): number {
  const f = NATURE.fire,
    fell = wet * year;
  return dmath.clamp((f.wetFrom - fell) / (f.wetFrom - f.dryFrom), 0, 1);
}

/** The chance a land's woods catch in its dry year: its flashes, its woods, how dry it is, what its air gives a flame. */
export function litChance(flashes: number, woods: number, dry: number, air: number): number {
  return 1 - dmath.exp(-NATURE.fire.lit * flashes * Math.max(0, woods) * dry * air);
}

/** The chance a fire crosses into its next patch, by that patch's fuel, how dry, how many it has taken, the wind, a river in the way. */
export function spreadChance(i: {
  readonly fuel: number;
  readonly dry: number;
  readonly taken: number;
  readonly along: number;
  readonly river: boolean;
  readonly air: number;
}): number {
  const f = NATURE.fire;
  return (
    f.spread *
    i.fuel *
    i.dry *
    i.air *
    dmath.exp(-f.fades * i.taken) *
    (1 + f.wind * dmath.clamp(i.along, -1, 1)) *
    (i.river ? f.river : 1)
  );
}

/** How many days a fire takes to cross a patch. */
export function crossDays(fuel: number, u: number): number {
  const f = NATURE.fire;
  return Math.round(
    f.daysLeast + (f.daysMost - f.daysLeast) * (1 - dmath.clamp(fuel, 0, 1)) * (0.5 + u),
  );
}

/** What a fire takes of a town it comes to: the more for the more of its fuel, the less for a town built of what does not burn. */
export function fireHomes(fuel: number, burning: number): number {
  return dmath.clamp(NATURE.fire.mostHomes * fuel * burning, 0.02, NATURE.fire.mostHomes);
}

/** How deep it goes down in history, by its dead: the greater, the longer kept, and the farther it is told (6 and more, as a window). So many dead is news on any world, however many live; fewer, on a world they were a part of. */
export function natureImportance(dead: number, people: number): number {
  const share = dead / Math.max(1, people);
  if (dead >= 1_000_000 || (dead >= 50000 && share >= 1e-3)) return 7;
  if (dead >= 100_000 || (dead >= 5000 && share >= 2e-4)) return 6;
  return dead >= 500 ? 5 : dead >= 50 ? 4 : 3;
}

/** The stakes of what befell a realm (0 … 1), by its dead. */
export const stakesOf = (dead: number): number =>
  dmath.clamp(dmath.log10(Math.max(1, dead)) / 4.5, 0, 1);

/** The chance a ruler gets help to where it is wanted, by the realm's reach and what it has laid by. */
export function answerChance(capacity: number, stores: number): number {
  const a = NATURE.answer;
  return dmath.clamp(
    a.least + a.capacity * capacity + a.stores * dmath.clamp(stores, 0, 1),
    0,
    0.95,
  );
}

/** What a land's quake rate is: by how its plates meet, its steps from the meeting, how fast they go. */
export function faultRate(kind: FaultKind, steps: number, speed: number): number {
  const q = NATURE.quake,
    near =
      kind === "within" ? 0 : steps <= 1 ? q.onIt : steps <= 3 ? q.near : steps <= 6 ? q.off : 0;
  if (kind === "within" || near === 0) return q.perYear.within;
  return Math.max(
    q.perYear.within,
    q.perYear[kind] * near * dmath.clamp(speed / q.plateSpeed, 0.4, 1.6),
  );
}

/** How many a thing with this many a year's chance comes to in one month, by one draw (Poisson's, to five at the most). */
export function countOf(perMonth: number, u: number): number {
  let n = 0,
    p = dmath.exp(-perMonth),
    sum = p;
  while (u > sum && n < 16) {
    n++;
    p *= perMonth / n;
    sum += p;
  }
  return n;
}

/** How a fire looks by what burns in it: woods' orange, and sulfur's blue under its yellow smoke. */
export function flameLook(sulfur: boolean): {
  readonly flame: readonly [number, number, number];
  readonly smoke: readonly [number, number, number];
} {
  return sulfur
    ? { flame: [0.32, 0.5, 1], smoke: [0.62, 0.58, 0.3] }
    : { flame: [1, 0.48, 0.1], smoke: [0.62, 0.6, 0.58] };
}

/** How many years a land waits, on average, for a shock as great, at its rate of strong ones. */
export function yearsBetween(rate: number, mag: number): number {
  return Math.round(dmath.pow(10, mag - NATURE.quake.least) / Math.max(1e-6, rate));
}
