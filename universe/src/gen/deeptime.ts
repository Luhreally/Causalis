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
import type { Planet } from "./bodies.ts";
import { BOUNDARY, type Tectonics } from "./plates.ts";

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
  return planet.meanTemperature + warmth + spread * (1 / (2 * gamma + 1) - shape);
}

/** Rain by latitude: wet under the rising air of the tropics and the storm tracks, dry between. */
function zonalRain(lat: number, warmth: number): number {
  const d = (Math.abs(lat) * 180) / dmath.PI,
    bell = (x: number) => dmath.exp(-x * x);
  return (250 + 1800 * bell(d / 12) + 900 * bell((d - 50) / 12)) * Math.max(0.5, 1 + warmth / 25);
}

export function makeDeepTime(grid: SphereGrid, rng: Rng, planet: Planet, t: Tectonics): DeepTime {
  // The ages: warmth wanders (a keyed walk that ends near today's climate); the seas
  // rise with warmth; some ages are marked by great events.
  const ages: Age[] = [];
  let warmth = 0;
  for (let k = 0; k < AGES; k++) {
    const last = k === AGES - 1,
      u = rng.real(DEEP, k, 0, 0),
      v = rng.real(DEEP, k, 0, 1),
      w = rng.real(DEEP, k, 0, 2);
    warmth = last ? 0.5 * warmth : Math.max(-8, Math.min(9, 0.55 * warmth + (u - 0.45) * 12));
    const seaLevel = Math.round(22 * warmth + (v - 0.5) * 120),
      kind: AgeKind =
        !last && w < 0.1
          ? "impact"
          : !last && w < 0.22
            ? "great volcanism"
            : warmth > 4
              ? "hothouse"
              : warmth < -3.5
                ? "icehouse"
                : "quiet";
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

  // What each age buried, cell by cell.
  const n = grid.count,
    coal = new Float32Array(n),
    oil = new Float32Array(n),
    coalAge = new Uint8Array(n).fill(255),
    oilAge = new Uint8Array(n).fill(255),
    coalBest = new Float32Array(n),
    oilBest = new Float32Array(n);
  for (const age of ages) {
    const mid = (age.from + age.to) / 2,
      // The older the age, the more of what it buried has since been worn away or cooked.
      kept = 0.6 + (0.4 * age.index) / (AGES - 1);
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
      if (age.forests && high > 0 && high < 250 && warm > 14 && rain > 1200) {
        const g = Math.min(1, (rain - 1200) / 1000) * Math.min(1, (warm - 14) / 10) * sinks * kept;
        coal[c] = coal[c]! + g;
        if (g > coalBest[c]!) {
          coalBest[c] = g;
          coalAge[c] = age.index;
        }
      }
      if (high <= 0 && high > -200 && warm > 16) {
        const g = Math.min(1, (warm - 16) / 10) * 0.8 * sinks * kept;
        oil[c] = oil[c]! + g;
        if (g > oilBest[c]!) {
          oilBest[c] = g;
          oilAge[c] = age.index;
        }
      }
    }
  }
  return { ages, coal, oil, coalAge, oilAge };
}
