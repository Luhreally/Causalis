// Deep time (docs/architecture §18, §24): the planet's history before anyone lived to
// see it, in ages of twenty-five million years back from now. Each age has its sea
// level and its warmth — a hothouse with its lowlands drowned, an icehouse with the
// seas drawn down into ice — and some are marked by great events: floods of lava, a
// great stone falling from the sky. Every cell's place in an age follows its plate's
// rotation back through time, so a land that lies in the cold north today may once
// have lain under the equator, and its climate in that age is read from where it lay.
// Where warm, wet, low land grew swamp forests and warm shallow seas bloomed with
// plankton, and the ground was sinking so that what died was buried, carbon gathered:
// that is where coal and oil lie now, and each seam remembers the age that laid it.
import { defineStream, dmath, type Rng, type SphereGrid } from "../kernel/index.ts";
import { climateMean, type Planet } from "./bodies.ts";
import { BOUNDARY, type Tectonics } from "./plates.ts";
import { demandMm, demandOf, lightGrowth, warmGrowth, wetGrowth } from "../rules/index.ts";

const DEEP = defineStream("gen.deeptime");

/** Ages, oldest first, each this many million years long; the last runs to the present. */
export const AGES = 16;
export const AGE_MY = 25;

export const AGE_KINDS = ["quiet", "hothouse", "icehouse", "great volcanism", "impact"] as const;
export type AgeKind = (typeof AGE_KINDS)[number];

export type Age = {
  readonly index: number;
  /** Millions of years ago, its start and its end. */
  readonly from: number;
  readonly to: number;
  /** Sea level against today's, metres; the world's warmth against today's, °C. */
  readonly seaLevel: number;
  readonly warmth: number;
  readonly kind: AgeKind;
  /** Whether forests grew on land (land plants arise after the first age). */
  readonly forests: boolean;
};

export type DeepTime = {
  readonly ages: readonly Age[];
  /** Carbon buried from swamp forests (coal) and from shallow-sea plankton (oil), per cell. */
  readonly coal: Float32Array;
  readonly oil: Float32Array;
  /** The age that buried the most of each, per cell (255: none). */
  readonly coalAge: Uint8Array;
  readonly oilAge: Uint8Array;
};

/** Where a cell lay `myAgo` million years ago: its position turned back about its plate's pole. */
export function pastPosition(
  grid: SphereGrid,
  t: Tectonics,
  cell: number,
  myAgo: number,
): [number, number, number] {
  const plate = t.plates[t.plate[cell]!]!,
    [kx, ky, kz] = plate.pole,
    x = grid.positions[3 * cell]!,
    y = grid.positions[3 * cell + 1]!,
    z = grid.positions[3 * cell + 2]!,
    // Plates drift less steadily than they move now: on average, a share of today's rate.
    angle = (-plate.speed * DRIFT * myAgo * dmath.PI) / 180,
    c = dmath.cos(angle),
    s = dmath.sin(angle),
    dot = kx * x + ky * y + kz * z;
  // Rodrigues' rotation of p about the unit pole k.
  return [
    x * c + (ky * z - kz * y) * s + kx * dot * (1 - c),
    y * c + (kz * x - kx * z) * s + ky * dot * (1 - c),
    z * c + (kx * y - ky * x) * s + kz * dot * (1 - c),
  ];
}

/** How far plates drifted on average, against their present speed. */
const DRIFT = 0.4;

/** The latitude a cell lay at, `myAgo` million years ago (radians). */
export function pastLatitude(grid: SphereGrid, t: Tectonics, cell: number, myAgo: number): number {
  const y = pastPosition(grid, t, cell, myAgo)[1];
  return dmath.asin(Math.max(-1, Math.min(1, y)));
}

/** A zone's mean temperature (the climate model's latitude law: see climate.ts) with the age's warmth. */
function zonal(planet: Planet, lat: number, warmth: number): number {
  const spread = 60 * (1 - (0.9 * planet.tilt) / 90),
    gamma = 1.4,
    s = dmath.sin(lat),
    shape = dmath.pow(s * s, gamma);
  return climateMean(planet) + warmth + spread * (1 / (2 * gamma + 1) - shape);
}

/** Rain by latitude: wet under the rising air of the tropics and the storm tracks, dry between. */
function zonalRain(lat: number, warmth: number): number {
  const d = (Math.abs(lat) * 180) / dmath.PI,
    bell = (x: number) => dmath.exp(-x * x);
  return (250 + 1800 * bell(d / 12) + 900 * bell((d - 50) / 12)) * Math.max(0.5, 1 + warmth / 25);
}

/**
 * The deep past, its ages made as `made` says where the god's hand laid an act on them at the
 * world's dawn (Phase 24: an age's index, and the kind it was made): an age made warm or cold
 * is as warm or cold as such an age is, and the ages after it wander on from there.
 */
export function makeDeepTime(
  grid: SphereGrid,
  rng: Rng,
  planet: Planet,
  t: Tectonics,
  made: ReadonlyMap<number, AgeKind> = new Map(),
  /** What grew in each age, for what it buried (null: bury nothing yet: buryCarbon is called once its life is known). */
  producers: Producers | null = EARTH_PRODUCERS,
): DeepTime {
  // The ages: warmth wanders (a keyed walk that ends near today's climate); the seas
  // rise with warmth; some ages are marked by great events.
  const ages: Age[] = [];
  let warmth = 0;
  for (let k = 0; k < AGES; k++) {
    const last = k === AGES - 1,
      u = rng.real(DEEP, k, 0, 0),
      v = rng.real(DEEP, k, 0, 1),
      w = rng.real(DEEP, k, 0, 2),
      act = made.get(k);
    warmth = last ? 0.5 * warmth : Math.max(-8, Math.min(9, 0.55 * warmth + (u - 0.45) * 12));
    if (act === "hothouse") warmth = Math.max(warmth, 5);
    else if (act === "icehouse") warmth = Math.min(warmth, -4.5);
    else if (act === "quiet") warmth = Math.max(-3, Math.min(3.5, warmth));
    const seaLevel = Math.round(22 * warmth + (v - 0.5) * 120),
      kind: AgeKind =
        act ??
        (!last && w < 0.1
          ? "impact"
          : !last && w < 0.22
            ? "great volcanism"
            : warmth > 4
              ? "hothouse"
              : warmth < -3.5
                ? "icehouse"
                : "quiet");
    ages.push({
      index: k,
      from: (AGES - k) * AGE_MY,
      to: (AGES - k - 1) * AGE_MY,
      seaLevel,
      warmth: Math.round(warmth * 10) / 10,
      kind,
      forests: k >= 1,
    });
  }

  const n = grid.count,
    deep: DeepTime = {
      ages,
      coal: new Float32Array(n),
      oil: new Float32Array(n),
      coalAge: new Uint8Array(n).fill(255),
      oilAge: new Uint8Array(n).fill(255),
    };
  if (producers) buryCarbon(grid, planet, t, deep, producers);
  return deep;
}

/**
 * What grew in each age, for what it buried (breadth round, 2026-11-23): the first age that had growth on its land (null: none
 * ever did), and the first that had it in its seas. Coal is the buried growth of a land's swamps, oil the buried bloom of its
 * warm shallow seas; a world where nothing lived buried neither, and one whose land was bare till late buried coal only since.
 */
export type Producers = { readonly land: number | null; readonly sea: number | null };

/**
 * What a swamp and a sea's bloom bury (est., set so first light's ages bury as much coal and oil in all as they did by the old
 * swamp-forest thresholds): a land is waterlogged past this rain against its demand, wholly so this much past it; a sea blooms
 * past this share of its warmth's growth.
 */
export const BURY = {
  coal: 1.54,
  oil: 1.08,
  logged: 1.2,
  loggedSpan: 1.5,
  bloomFrom: 0.6,
} as const;

/** As the old ages always had it: the seas alive from the first, the land from the second (land plants after the first age). */
export const EARTH_PRODUCERS: Producers = { land: 1, sea: 0 };

/**
 * What each age buried, cell by cell, into `deep`'s arrays (they start empty): only where that age had growth to bury (its
 * producers), only on sinking ground, the older the less kept.
 */
export function buryCarbon(
  grid: SphereGrid,
  planet: Planet,
  t: Tectonics,
  deep: DeepTime,
  producers: Producers,
  /** As made before this round (a world kept so: rules/carbon.ts groundKept): the old swamp-forest and warm-sea thresholds. */
  kept = false,
): void {
  const { ages, coal, oil, coalAge, oilAge } = deep,
    light = lightGrowth(planet.insolation),
    demand = demandOf(planet.insolation),
    n = grid.count,
    coalBest = new Float32Array(n),
    oilBest = new Float32Array(n);
  for (const age of ages) {
    const mid = (age.from + age.to) / 2,
      // The older the age, the more of what it buried has since been worn away or cooked.
      keptShare = 0.6 + (0.4 * age.index) / (AGES - 1),
      landGrew = age.forests && producers.land !== null && age.index >= producers.land,
      seaGrew = producers.sea !== null && age.index >= producers.sea;
    if (!landGrew && !seaGrew) continue;
    for (let c = 0; c < n; c++) {
      // Only sinking ground keeps what it buries: continental crust off the rising belts
      // (rifts most of all); ocean floor is carried down and lost.
      if (!t.crust[c]) continue;
      const rising = t.boundary[c] === BOUNDARY.convergent && t.toBoundary[c]! <= 2,
        rift = t.boundary[c] === BOUNDARY.divergent && t.toBoundary[c]! <= 3,
        sinks = (rising ? 0.2 : 1) * (rift ? 1.4 : 1);
      const lat = pastLatitude(grid, t, c, mid),
        high = t.elevation[c]! - age.seaLevel,
        warm = zonal(planet, lat, age.warmth) - 6.5 * (Math.max(0, high) / 1000),
        rain = zonalRain(lat, age.warmth);
      // (Coal: what its swamps grew, kept from rotting where the ground stood waterlogged, its rain far past what its warmth
      // draws off: a warm swamp's or a cold bog's. rules/biomes.ts.)
      const moist = rain / demandMm(warm, demand),
        logged = dmath.clamp((moist - BURY.logged) / BURY.loggedSpan, 0, 1);
      if (
        kept
          ? landGrew && high > 0 && high < 250 && warm > 14 && rain > 1200
          : landGrew && high > 0 && high < 250 && logged > 0
      ) {
        const grew = Math.min(warmGrowth(warm), wetGrowth(rain / demand)) * light,
          g = kept
            ? Math.min(1, (rain - 1200) / 1000) * Math.min(1, (warm - 14) / 10) * sinks * keptShare
            : BURY.coal * grew * logged * sinks * keptShare;
        coal[c] = coal[c]! + g;
        if (g > coalBest[c]!) {
          coalBest[c] = g;
          coalAge[c] = age.index;
        }
      }
      // (Oil: the bloom of its shallow seas, as warm as their growth is and as bright as its sky, buried where they lay still.)
      const bloom = dmath.clamp((warmGrowth(warm) - BURY.bloomFrom) / (1 - BURY.bloomFrom), 0, 1);
      if (seaGrew && high <= 0 && high > -200 && (kept ? warm > 16 : bloom > 0)) {
        const g = kept
          ? Math.min(1, (warm - 16) / 10) * 0.8 * sinks * keptShare
          : BURY.oil * bloom * light * sinks * keptShare;
        oil[c] = oil[c]! + g;
        if (g > oilBest[c]!) {
          oilBest[c] = g;
          oilAge[c] = age.index;
        }
      }
    }
  }
}
