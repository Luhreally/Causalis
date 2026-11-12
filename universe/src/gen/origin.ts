// How life began on a world, read from the world (B2 of the life plan, docs/architecture/asks-2026-11-12-plan.md
// Part B; the reading itself is rules/origin.ts): a home world's numbers as its first life met them — its seas and
// ice, the heat through its ground, its moons' and star's tides, its star's light, what its rock and air hold — and
// what is so already (whether it lives, whether its life eats light, whether its air holds free oxygen now); and a
// world of another star, or of the home star's own, from what is known of it.
//
// A pure reading keyed on the world's digest, kept for the last few worlds asked of: never stored, never hashed, and
// nothing in history reads it, so no world's history, name or save changes. The tree of life's step "the air fills
// with oxygen" is dated by it (gen/evolution.ts), which only its pages and the genesis tell.
import {
  KINDS,
  airChange,
  readOrigin,
  warmthPace,
  type AirRead,
  type LifeWorld,
  type Origin,
  type OriginGround,
} from "../rules/index.ts";
import { dmath } from "../kernel/index.ts";
import { starAgeGyr, worldKindOf } from "./bodies.ts";
import { worldChemistry } from "./chemistry.ts";
import { worldLife } from "./life.ts";
import type { HomeWorld } from "./homeworld.ts";
import type { Elsewhere, LifeGround, LifeStar } from "./elsewhere.ts";

/** The Moon's tide on Earth (its mass in Earths over its distance cubed, thousands of km), the Sun's 0.46 of it. */
const MOON_TIDE = 0.0123 / (384.4 * 384.4 * 384.4);
const SUN_SHARE = 0.46;
/** A star's tide on a world, against the Sun's on Earth: its mass over its distance cubed (AU). */
const starTide = (mass: number, a: number) => mass / (a * a * a);

/**
 * Its tides' rise and fall, Earth's 1: its moons' and its star's. A world so near a small star that its tide has
 * locked one face to it feels no rise and fall from the star.
 */
export function tidesOf(
  moons: readonly { mass: number; a: number }[],
  star: number,
  a: number,
): number {
  const fromMoons = moons.reduce((s, m) => s + m.mass / (m.a * m.a * m.a), 0) / MOON_TIDE,
    sun = starTide(star, a),
    locked = sun > 30;
  return (fromMoons + (locked ? 0 : SUN_SHARE * sun)) / (1 + SUN_SHARE);
}

/**
 * The heat coming up through a world's ground now, Earth's 1 (an estimate): what its rock makes, for each square
 * metre, follows its mass over its face (its pull, at a rocky density) and falls as its rock's heat runs down (by e
 * in some three billion years); a world kneaded by a near star's tides (a sulfur-volcano world's) has more.
 */
export function heatOf(gravity: number, ageGyr: number, kneaded: boolean): number {
  return gravity * dmath.exp(-(ageGyr - 4.5) / 3) * (kneaded ? 3 : 1);
}

/** A home world's ground, as its first life met it. */
export function originGround(g: HomeWorld): OriginGround {
  const kind = worldKindOf(g),
    facts = KINDS[kind],
    life = worldLife(g),
    chem = worldChemistry(g),
    home = g.system.bodies.find((b) => b.kind === "home"),
    moons = g.system.bodies
      .filter((b) => b.kind === "moon" && b.orbit.around === g.planet.ref)
      .map((b) => ({ mass: b.mass, a: b.orbit.a })),
    age = starAgeGyr(g.star),
    t = g.climate.temperature,
    alive = g.life.species.length > 0,
    haze = kind === "methane" || kind === "carbon",
    pressure = home?.pressure ?? facts.body.pressure;
  let frozen = 0;
  for (let c = 0; c < g.grid.count; c++) if (t[c]! < -10) frozen++;
  const sea = g.planet.oceanFraction,
    ice = Math.min(1 - sea, frozen / g.grid.count),
    heat = heatOf(g.planet.gravity, age, kind === "sulfur");
  return {
    family: life.family,
    acid: kind === "sulfur",
    liquid: facts.liquid.name,
    sea,
    ice,
    underIce: false,
    iceFloor: !!facts.iceCrust,
    celsius: g.planet.meanTemperature,
    pressure,
    gravity: g.planet.gravity,
    heat,
    tides: tidesOf(moons, g.star.mass, g.planet.orbitAu),
    light: g.planet.insolation,
    // (A methane world's haze lets about a tenth of its light down, as Titan's does.)
    ground: g.planet.insolation * (haze && kind === "methane" ? 0.1 : 1),
    starK: g.star.temperature,
    pigment: life.pigment,
    ageGyr: age,
    iron:
      (chem.metals === "poor" ? 0.6 : chem.metals === "rich" ? 1.5 : 1) *
      (chem.carbon === "carbon-rich" ? 0.6 : 1),
    sulfur: kind === "sulfur" ? 3 : 0.7 + 0.3 * Math.min(3, heat),
    co2: kind === "rocky" || kind === "sulfur" || kind === "ammonia",
    ammonia: life.family === "ammonia",
    haze,
    hydrogenAir: life.breath === "hydrogen",
    o2: facts.burns ? chem.o2 : 0,
    level: alive ? "bodies" : "none",
    eatsLight: alive && life.pigment !== "polyimine",
    oxygen: facts.burns,
  };
}

/** The dawn's dates a world's origin is told by (millions of years ago): its first cells, its light-eaters. */
export type DawnDates = {
  readonly cells: number;
  readonly light: number;
  /** The latest its air can have changed: its first cells together, too large to live without oxygen. */
  readonly floor: number;
  /** When its tree tells the air changed (the step's own date, which this agrees with). */
  readonly air?: number;
};

/**
 * When a home world's air came to hold oxygen, from its light-eaters' coming (`light`) and no later than its first
 * cells together (`floor`), both millions of years ago: what the tree of life's step is dated by.
 */
export function homeAir(g: HomeWorld, light: number, floor: number): AirRead {
  const o = originGround(g);
  return airChange(o, o.oxygen && o.family === "water" && o.eatsLight ? light : null, floor);
}

/** A world's origin, read whole: its ground, its places and trades, its air's change, and its dates. */
export type WorldOrigin = Origin & {
  readonly ground: OriginGround;
  readonly air: AirRead;
  readonly dates: DawnDates | null;
  /** Its first seas' small lives (the dawn's drop): its first life on its grain where it was rock-fed. */
  readonly dawnSmall: Origin["small"];
};

const KEPT = new Map<string, WorldOrigin>();

/** Why no liquid lasts on a lifeless home world, where its warmth says so (as its pages tell it). */
function liquidWhy(g: HomeWorld): string | null {
  if (g.life.species.length) return null;
  const at = g.planet.climate ?? g.planet.meanTemperature;
  return at < -15
    ? "its seas froze over before life took hold"
    : at > 60
      ? "too hot for its seas to hold life's chemistry together"
      : null;
}

/** A home world's origin, kept by its digest. `dates`: its tree's dawn (the tree's own steps, whose air this dates). */
export function homeOrigin(g: HomeWorld, dates: DawnDates | null): WorldOrigin {
  const key = `${g.digest} ${dates ? `${dates.cells} ${dates.light} ${dates.floor} ${dates.air}` : "-"}`,
    kept = KEPT.get(key);
  if (kept) return kept;
  const ground = originGround(g),
    why = liquidWhy(g),
    read = readOrigin(ground, why),
    reckoned = airChange(
      ground,
      dates && ground.oxygen && ground.family === "water" && ground.eatsLight ? dates.light : null,
      dates?.floor ?? 0,
    ),
    // (As its tree tells it: the same reckoning, a year moved where two of its steps would fall together.)
    air =
      reckoned.at !== null && dates?.air !== undefined ? { ...reckoned, at: dates.air } : reckoned,
    out: WorldOrigin = {
      ...read,
      ground,
      air: ground.level === "none" && ground.oxygen ? abiotic(air) : air,
      dates,
      dawnSmall: readOrigin(ground, why, true).small,
    };
  if (KEPT.size >= 32) KEPT.delete(KEPT.keys().next().value!);
  KEPT.set(key, out);
  return out;
}

/** A lifeless world whose air holds oxygen: none of life's making. */
function abiotic(air: AirRead): AirRead {
  return {
    ...air,
    at: null,
    held: false,
    words:
      "no life made it; its star's light splits water high in its air, and the hydrogen escapes to space (an estimate)",
  };
}

/**
 * A world of another star, or of the home star's own, from what is known of it: its water and warmth, its air's
 * weight, its pull, its star's light and age, and how far its life came (gen/elsewhere.ts). Its life is of water, as
 * every such world's is told; its light-eaters split it where its seas are lit, and their oxygen is in its air (as
 * its people's pages say).
 */
export function elsewhereGround(
  star: LifeStar & { readonly temperature: number; readonly mass: number },
  w: LifeGround & { readonly mass?: number },
  life: Elsewhere,
): OriginGround {
  const seas = w.water === "seas",
    underIce = w.water === "ice",
    age = Math.min(star.ageGyr, 12.6),
    lit = life.small.includes("light"),
    light = star.luminosity / (w.a * w.a),
    level = life.level === "people" ? "bodies" : life.level,
    heat = heatOf(w.gravity, age, false);
  return {
    family: "water",
    acid: false,
    liquid: "water",
    sea: seas ? 0.6 : 0,
    ice: underIce ? 0.9 : seas && w.temperature < 0 ? 0.3 : 0.05,
    underIce,
    iceFloor: false,
    celsius: w.temperature,
    pressure: w.pressure,
    gravity: w.gravity,
    heat,
    tides: tidesOf([], star.mass, w.a),
    light,
    ground: underIce ? 0 : light,
    starK: star.temperature,
    pigment: lit ? pigmentFor(star.temperature) : null,
    ageGyr: age,
    iron: 1,
    sulfur: 0.7 + 0.3 * Math.min(3, heat),
    co2: true,
    ammonia: false,
    haze: false,
    hydrogenAir: false,
    o2: lit ? 0.21 : 0,
    level,
    eatsLight: lit,
    oxygen: lit,
    ways: life.small,
  };
}

/** A pigment by a star's warmth, as a water world's life's is (rules/biochem.ts's edges). */
function pigmentFor(k: number): OriginGround["pigment"] {
  return k >= 6300
    ? "carotene"
    : k >= 5300
      ? "chlorophyll"
      : k >= 3900
        ? "phycocyanin"
        : "bacteriochlorophyll";
}

/** A world elsewhere's origin: its first cells and bodies' dates its own, its light-eaters soon after its first cells. */
export function elsewhereOrigin(
  key: string,
  star: LifeStar & { readonly temperature: number; readonly mass: number },
  w: LifeGround,
  life: Elsewhere,
): WorldOrigin {
  const kept = KEPT.get(`elsewhere ${key}`);
  if (kept) return kept;
  const ground = elsewhereGround(star, w, life),
    cells = life.cellsAgo !== null ? Math.round(life.cellsAgo * 1000) : null,
    dates: DawnDates | null =
      cells !== null
        ? {
            cells,
            light: Math.round(cells * 0.9),
            floor: life.bodiesAgo !== null ? Math.round(life.bodiesAgo * 1000) : 0,
          }
        : null,
    // (Why no liquid lasts there, where that is why it is lifeless: as gen/elsewhere.ts tells it.)
    liquid =
      (w.water === "seas" && w.temperature > -15 && w.temperature < 95) ||
      (w.water === "ice" && w.temperature > -90),
    why = life.level === "none" && !liquid ? life.because : null,
    read = readOrigin(ground, why),
    out: WorldOrigin = {
      ...read,
      ground,
      air: airChange(ground, dates && ground.oxygen ? dates.light : null, dates?.floor ?? 0),
      dates,
      dawnSmall: readOrigin(ground, why, true).small,
    };
  if (KEPT.size >= 32) KEPT.delete(KEPT.keys().next().value!);
  KEPT.set(`elsewhere ${key}`, out);
  return out;
}

// —— A world as its living things read it (B3–B5) ——————————————————————————————————————————————————

/** Whether one face of a world is locked to its star by the star's tide (its mass over its distance cubed, against the Sun's on Earth). */
export function lockedTo(starMass: number, a: number): boolean {
  return starTide(starMass, a) > 30;
}

/** A liquid's density at its world's warmth, kg/m³ (water 1,000; liquid ammonia 680; methane 450; an oil 850). */
const LIQUID_DENSITY: Readonly<Record<string, number>> = {
  water: 1000,
  ammonia: 680,
  methane: 450,
  oil: 850,
};

/**
 * A world's numbers as its living things meet them, from its ground (rules/origin.ts): what its life is made of and
 * runs on as though it lived (its light-eaters' trade, its rock-eaters', its eaters'), its air's weight and oxygen.
 * Its land's shares are read from its cells where its cells are known (gen/living.ts); here, none.
 */
export function lifeWorldOf(
  o: OriginGround,
  extra: { readonly locked: boolean; readonly bone: string; readonly shell: string },
): LifeWorld {
  const living: OriginGround = { ...o, level: "bodies", eatsLight: o.pigment !== null && o.pigment !== "polyimine" },
    read = readOrigin(living),
    rock = read.trades
      .filter((t) => t.kind === "rock" && t.open)
      .reduce((a, t) => Math.max(a, t.power), 0),
    eat = read.eaters,
    // (A mole of its air: hydrogen's and helium's where its air is hydrogen (an estimate), carbon dioxide's under a
    // crushing air, else nitrogen's and oxygen's.)
    airMolar = o.hydrogenAir ? 4 : o.pressure > 5 ? 40 : 29;
  return {
    gravity: o.gravity,
    pressure: o.pressure,
    airMolar,
    o2: o.o2 * o.pressure,
    celsius: o.celsius,
    sea: o.sea,
    ice: o.ice,
    land: Math.max(0, 1 - o.sea - o.ice),
    starK: o.starK,
    light: o.ground,
    heat: o.heat,
    locked: extra.locked,
    liquid: o.family,
    conducts: o.family === "water" || o.family === "ammonia",
    liquidDensity: LIQUID_DENSITY[o.family] ?? 1000,
    bone: extra.bone,
    shell: extra.shell,
    lightPower: read.light?.power ?? 0,
    rockPower: rock,
    eatPower15: eat?.power15 ?? 0,
    eatPower: eat?.power ?? 0,
    eatTrade: eat?.id ?? "ferment",
    pace: warmthPace(o.celsius) / warmthPace(15),
    lands: { grass: 0, wood: 0, tall: 0, desert: 0, cold: 0, rivers: 0, shelf: 0.1, vents: 0.02 },
  };
}

/** A home world before its life (its ground, climate and seas made), as B3–B5 read it. */
export type ProtoWorld = Omit<HomeWorld, "life" | "digest" | "deposits"> & { readonly ground: string };

/** A home world's ground before its life, as though it lived (its first life's needs read from it). */
export function protoGround(p: ProtoWorld): OriginGround {
  const g = { ...p, life: { species: [] }, digest: p.ground, deposits: [] } as unknown as HomeWorld;
  return originGround(g);
}

/**
 * Why no liquid lasts on a world before its life (B5), read from its cells (its warmth in its liquid's own degrees): a
 * liquid lasts where any of its sea is open, or its sea lies frozen over ground warm enough to keep water under the ice
 * (an estimate: a fifth of Earth's heat through its ground), or its seas are not all too hot. Else why not.
 */
export function protoLiquidWhy(p: Pick<HomeWorld, "planet" | "climate" | "grid" | "tectonics"> & { readonly star?: HomeWorld["star"] }): string | null {
  const n = p.grid.count,
    t = p.climate.temperature,
    e = p.tectonics.elevation;
  let sea = 0,
    open = 0,
    boiling = 0;
  for (let c = 0; c < n; c++) {
    if (e[c]! > 0) continue;
    sea++;
    if (t[c]! > 0 && t[c]! < 95) open++;
    if (t[c]! >= 95) boiling++;
  }
  if (sea < n * 0.005) return "no sea lies on it to hold life's first chemistry";
  if (open >= n * 0.002) return null;
  if (boiling > sea / 2) return "too hot for its seas to hold life's chemistry together";
  const heat = heatOf(p.planet.gravity, p.star ? starAgeGyr(p.star) : 4.5, p.planet.kind === "sulfur");
  return heat >= 0.2 ? null : "its seas froze to the floor before life took hold";
}

/** A home world's numbers as its life reads them, before its life (B3). */
export function protoLifeWorld(p: ProtoWorld): LifeWorld {
  const g = { ...p, life: { species: [] }, digest: p.ground, deposits: [] } as unknown as HomeWorld,
    life = worldLife(g);
  return lifeWorldOf(protoGround(p), {
    locked: lockedTo(p.star.mass, p.planet.orbitAu),
    bone: life.bone,
    shell: life.shell,
  });
}
