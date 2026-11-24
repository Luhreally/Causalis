// The planet in motion (Round D; the rules are rules/planet.ts). A world's ground follows its climate: the warmth its
// air holds (climate/air.ts: what its peoples burned and cleared), the light its ice no longer throws back, the light its
// star gains as it ages, and the god's warming or cooling (acts/great.ts). Its ice sheets grow by their snow and waste by
// their summers, land by land, a tenth of them a year, each stepped ten years at once; what they lose raises the seas,
// and the seas swell as their deep warms; the land below the risen sea is drowned and the shelf a fallen sea bares is
// land. Melt poured into the seas and a warmer surface weaken their overturning, and the coasts its currents warmed
// (gen/currents.ts) lose that share of it. Its field (rules/planet.ts magnetosphereOf) shelters its ground from its star.
//
// What a land can be lived on and farmed is read through all of it (population/model.ts biomeUnder with a Shift): its
// warmth, its sea, its ice. One row of whole numbers for the world, one small number a tracked land; nothing grows with
// history but the few lands' turns told.
import {
  YEAR,
  Hasher,
  dmath,
  finish,
  hashString,
  mix,
  defineEventType,
  yearOfMoment,
  type CauseRef,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { worldLaws } from "./store.ts";
import {
  BIOME,
  cellRef,
  planetRef,
  worldChemistry,
  worldKindOf,
  type HomeWorld,
} from "../../gen/index.ts";
import {
  DEEP_WARMS,
  ICE,
  KINDS,
  OVERTURN,
  STAR_LIFE,
  albedoWarming,
  burstHarm,
  magnetosphereOf,
  flareThrough,
  iceBalance,
  kelvinPerDegree,
  lightAt,
  overturnOf,
  seaFromIce,
  sheetHeight,
  starLifeOf,
  starLifetime,
  swellOf,
  DOSE_DEATHS,
  cyclesOf,
  summerWarmth,
  type Cycles,
  type Magnetosphere,
  type StarLife,
} from "../../rules/index.ts";
import { divineWarming, groundWarming, starHazard, warmingAct } from "../acts/great.ts";
import { homePlanet } from "./store.ts";
import { AS_MADE, biomeShifted, searedUnder, type Shift } from "../population/model.ts";
import { clusterOf } from "../space/stars.ts";

export const MOTION_EVENTS = {
  /** A land's ice sheet gone, or come. */
  thawed: defineEventType("planet.ice-gone", 4),
  iced: defineEventType("planet.ice-come", 4),
  /** The seas risen or fallen another metre. */
  seas: defineEventType("planet.seas-moved", 4),
  /** A land drowned by the risen sea (a tenth of it and more), or grown by a fallen one. */
  drowned: defineEventType("planet.land-drowned", 5),
  bared: defineEventType("planet.land-bared", 4),
  /** The seas' overturning weakened by half (or come back). */
  overturn: defineEventType("planet.overturn-weakened", 5),
  /** The home star swelling at the end of its life; a star of the cluster ended. */
  swelling: defineEventType("star.swelling", 6),
  ended: defineEventType("star.ended", 6),
  /** The home world grown unfit for its people over half the lands they could once live on. */
  dying: defineEventType("planet.world-dying", 7),
};

/** The world's numbers are kept once in so many years, and at most so many rows (the older half thinned by half). */
export const PAST_EVERY = 25;
const PAST_MOST = 240;
/** A tenth of the tracked lands step each year, each ten years at once. */
export const ICE_STEP = 10;
/** The pace of the ground's warmth toward what its air, ice and star now hold (a share a year: a generation). */
const GROUND_PACE = 1 / 30;
/** The steps a land's reading turns by: a quarter degree, a metre of sea, a twentieth of the overturning. */
export const STEP = { warm: 0.25, sea: 1, overturn: 0.05 } as const;
/** A land drowned or bared by this share of its ground is told. */
const TOLD_SHARE = 0.1;

/** A star of the cluster that ended within the chronicle. */
export type StarEnd = {
  readonly star: Ref;
  readonly year: number;
  readonly how: "white dwarf" | "supernova";
  readonly distance: number;
  readonly event: Ref;
};

export type MotionState = {
  /** The ground's own warmth from the climate (degrees of its climate): what the ice and the biomes answer to. */
  ground: number;
  /** Of it, the ice's light kept and the star's (degrees), as last reckoned. */
  albedo: number;
  star: number;
  /** The seas against as made (m): from ice, from swelling. */
  seaIce: number;
  swell: number;
  /** The overturning (1: as made), and the melt poured in last year (km³ of water). */
  overturn: number;
  melt: number;
  /** The metres told; the weakening told; the turns of the reading (each a new map of the lands). */
  toldSea: number;
  toldOverturn: boolean;
  version: number;
  /** The turn of the reading whose lands were last told; sheets come or gone since the reading last turned. */
  toldVersion: number;
  pending: number;
  /** The home star's swelling told; the home world's dying told. */
  swelling: Ref | null;
  dying: Ref | null;
  /** The event the seas last moved by, and the overturning's. */
  seaEvent: Ref | null;
  overturnEvent: Ref | null;
};

const firstState = (): MotionState => ({
  ground: 0,
  albedo: 0,
  star: 0,
  seaIce: 0,
  swell: 0,
  overturn: 1,
  melt: 0,
  toldSea: 0,
  toldOverturn: false,
  version: 0,
  toldVersion: 0,
  pending: 0,
  swelling: null,
  dying: null,
  seaEvent: null,
  overturnEvent: null,
});

/** A land's turns told: drowned, bared, thawed, iced (each its event, null once eased). */
export type LandTurn = {
  readonly cell: number;
  drowned: Ref | null;
  bared: Ref | null;
  thawed: Ref | null;
  iced: Ref | null;
  /** Its share drowned (+) or bared (−) as last told, thousandths. */
  share: number;
};

function fold(d: [number, number], xs: readonly number[]): void {
  let a = d[0],
    b = d[1];
  for (const x of xs) {
    const lo = x | 0,
      hi = Math.floor(x / 4294967296) | 0;
    a = Math.imul(a ^ lo, 0x01000193) ^ hi;
    b = Math.imul(b + lo + 0x9e3779b9, 0x85ebca6b) ^ (b >>> 13);
  }
  d[0] = a;
  d[1] = b;
}

export class MotionStore implements StateStore {
  readonly name = "planet.motion";
  state: MotionState = firstState();
  /** The fine lands whose ice is kept (ascending), their sheets now and as made (m). */
  cells: Int32Array = new Int32Array(0);
  ice: Uint16Array = new Uint16Array(0);
  made: Uint16Array = new Uint16Array(0);
  readonly lands = new Map<number, LandTurn>();
  ends: StarEnd[] = [];
  /** The world's numbers once in PAST_EVERY years, thinned as they age: [year, ground ×100, sea ×10, ice km² ÷1000, overturning ×100]. */
  past: number[][] = [];
  private readonly digest: [number, number] = [0x811c9dc5, 0];
  /** The reading last made of it (not state: made again from the state when asked). */
  kept: { version: number; god: number; shift: Shift } | null = null;
  /** What was read off the ground as it lay under one surface (not state: read again when the surface is another, and after a load):
   * how far inside its sheets each land lies by warmth, and the seas' area. */
  read: { surface: string; inside: Map<number, Float32Array>; seas: number | null } = {
    surface: "",
    inside: new Map(),
    seas: null,
  };
  readOf(surface: string): { inside: Map<number, Float32Array>; seas: number | null } {
    if (this.read.surface !== surface) this.read = { surface, inside: new Map(), seas: null };
    return this.read;
  }
  /** The reading's turn last counted for the world's dying (not state). */
  dyingSeen = -1;

  get begun(): boolean {
    return this.cells.length > 0 || this.state.version > 0;
  }
  dormant(): boolean {
    return !this.begun;
  }
  note(xs: readonly number[]): void {
    fold(this.digest, xs);
  }
  land(cell: number): LandTurn {
    let l = this.lands.get(cell);
    if (!l)
      this.lands.set(
        cell,
        (l = { cell, drowned: null, bared: null, thawed: null, iced: null, share: 0 }),
      );
    return l;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    const s = this.state;
    for (const r of [s.swelling, s.dying, s.seaEvent, s.overturnEvent]) if (r) out.push(r);
    for (const l of this.lands.values())
      for (const r of [l.drowned, l.bared, l.thawed, l.iced]) if (r) out.push(r);
    for (const e of this.ends) out.push(e.event);
    return out;
  }
  hashInto(h: Hasher): void {
    if (!this.begun) return;
    h.value(this.state).int(this.cells.length).int(this.digest[0]).int(this.digest[1]);
    h.int(this.lands.size).int(this.ends.length).int(this.past.length);
  }
  save(): unknown {
    if (!this.begun) return {};
    return {
      state: this.state,
      cells: [...this.cells],
      ice: [...this.ice],
      made: [...this.made],
      lands: [...this.lands.values()].sort((a, b) => a.cell - b.cell),
      ends: this.ends,
      past: this.past,
      digest: [...this.digest],
    };
  }
  load(state: unknown): void {
    this.read = { surface: "", inside: new Map(), seas: null };
    const s = (state ?? {}) as {
      state?: MotionState;
      cells?: number[];
      ice?: number[];
      made?: number[];
      lands?: LandTurn[];
      ends?: StarEnd[];
      past?: number[][];
      digest?: [number, number];
    };
    this.state = { ...firstState(), ...s.state };
    this.cells = Int32Array.from(s.cells ?? []);
    this.ice = Uint16Array.from(s.ice ?? []);
    this.made = Uint16Array.from(s.made ?? []);
    this.lands.clear();
    for (const l of s.lands ?? []) this.lands.set(l.cell, { ...l });
    this.ends = [...(s.ends ?? [])];
    this.past = (s.past ?? []).map((r) => [...r]);
    this.digest[0] = s.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s.digest?.[1] ?? 0;
    this.kept = null;
    this.dyingSeen = -1;
  }
}

export function motionOf(world: World): MotionStore | null {
  return world.peek<MotionStore>("planet.motion") ?? null;
}

// —— The reading every land is seen through ——————————————————————————————————————————————————————

const quantum = (x: number, step: number) => Math.trunc(x / step) * step || 0;

/** The reading of a world's ground now (AS_MADE on a world whose ground has not moved). */
export function shiftNow(world: World): Shift {
  const god = groundWarming(world, planetRef(0)),
    store = motionOf(world);
  if (!store || !store.begun)
    return god ? { key: `w${god}`, warm: god, sea: 0, overturn: 0, ice: null } : AS_MADE;
  const kept = store.kept;
  if (kept && kept.version === store.state.version && kept.god === god) return kept.shift;
  const s = store.state,
    warm = quantum(god + s.ground, STEP.warm),
    sea = quantum(s.seaIce + s.swell, STEP.sea),
    overturn = quantum(s.overturn - 1, STEP.overturn),
    g = homePlanet(world).generated.fine,
    iceMoved = store.cells.length > 0,
    ice = iceMoved ? new Uint8Array(g.grid.count) : null;
  // (A land's sheet read against its own as made: 1 where one has come, 2 where one has gone, nothing where it stands as
  // it was. Read as sheet or none, every land whose climate made it ice but whose sheet as made was thinner than a sheet
  // turned tundra the first year anything moved: on first light 361 lands opened at once under a cooling.)
  if (ice)
    for (let i = 0; i < store.cells.length; i++) {
      const now = store.ice[i]! >= ICE.thin,
        was = store.made[i]! >= ICE.thin;
      if (now !== was) ice[store.cells[i]!] = now ? 1 : 2;
    }
  const moved = warm || sea || overturn || store.state.version > 0,
    shift: Shift = moved
      ? { key: `w${warm}s${sea}o${overturn}v${s.version}`, warm, sea, overturn, ice }
      : AS_MADE;
  store.kept = { version: s.version, god, shift };
  return shift;
}

// —— The home sky ———————————————————————————————————————————————————————————————————————————————————

const FIELDS = new Map<string, Magnetosphere>();

/** The home world's field (kept by its ground). */
export function homeField(g: HomeWorld): Magnetosphere {
  let f = FIELDS.get(g.ground);
  if (!f) {
    const chem = worldChemistry(g);
    f = magnetosphereOf({
      mass: g.planet.mass,
      radius: g.planet.radius,
      dayHours: g.planet.dayHours,
      ageGyr: Math.min(g.star.ageGyr, 12.6),
      plates: g.planet.plateCount,
      feH: chem.feH,
      orbitAu: g.planet.orbitAu,
      starMass: g.star.mass,
      air: 1,
    });
    FIELDS.set(g.ground, f);
    if (FIELDS.size > 8) FIELDS.delete(FIELDS.keys().next().value!);
  }
  return f;
}

/** The home star's life, `years` into the chronicle. */
export function homeStarLife(g: HomeWorld, years: number): StarLife {
  return starLifeOf(g.star.mass, g.star.ageGyr, g.star.lifetimeGyr, Math.max(0, years));
}

/**
 * What the home sky lays on a land of the home world (1: as Earth's): the sky's particles its field lets reach its
 * ground (a slow toll), a flare of its star let through as its field keeps it off, and a supernova's burst near it.
 */
export function homeSky(world: World): number {
  const g = homePlanet(world).generated,
    field = homeField(g),
    flare = starHazard(world, g.star.ref as Ref).factor,
    store = motionOf(world);
  let k = (1 + DOSE_DEATHS * (field.dose - 1)) * flareThrough(flare, field.shelter);
  if (store?.ends.length) {
    const year = yearOfMoment(world.now);
    for (const e of store.ends)
      if (e.how === "supernova" && year - e.year < STAR_LIFE.burstYears)
        k *= burstHarm(e.distance, field.shelter);
  }
  return k;
}

/**
 * What the cluster's ended stars did to another star's worlds between two years (the sweep, Nature lane): whether that star
 * itself has ended, and the harm of the supernovae near enough to it (rules/planet.ts burstHarm, its worlds' own shelter
 * unknown: reckoned as Earth's), with the years its worlds were under them.
 */
export function starDeathAt(
  world: World,
  star: Ref,
  from: number,
  to: number,
): {
  readonly own: StarEnd | null;
  readonly harm: number;
  readonly years: number;
  readonly burst: StarEnd | null;
} {
  const store = motionOf(world);
  if (!store?.ends.length) return { own: null, harm: 1, years: 0, burst: null };
  const own = store.ends.find((e) => e.star === star && e.year <= to) ?? null,
    stars = clusterOf(world),
    at = stars.find((s) => s.ref === star),
    shelter = 1 - dmath.exp(-4.5);
  let harm = 1,
    years = 0,
    burst: StarEnd | null = null;
  if (at)
    for (const e of store.ends) {
      if (e.how !== "supernova" || e.star === star) continue;
      const s = stars.find((x) => x.ref === e.star);
      if (!s) continue;
      const dx = s.x - at.x,
        dy = s.y - at.y,
        dz = s.z - at.z,
        d = Math.sqrt(dx * dx + dy * dy + dz * dz),
        under = Math.min(to, e.year + STAR_LIFE.burstYears) - Math.max(from, e.year);
      if (under <= 0 || d > 4 * STAR_LIFE.harmLy) continue;
      const k = burstHarm(d, shelter);
      if (k > harm) [harm, years, burst] = [k, under, e];
    }
  return { own, harm, years, burst };
}

/** Whether a star of the cluster has ended in the chronicle (its halls' light gone), and how. */
export function starEnded(world: World, star: Ref): StarEnd | null {
  return motionOf(world)?.ends.find((e) => e.star === star) ?? null;
}

// —— The year ———————————————————————————————————————————————————————————————————————————————————————

// (A world's slow swings, read once off its star, its orbit, its moons and the planets and companion that tug it: kept by digest.)
const CYCLES = new Map<string, Cycles>();
/** A home world's slow swings (rules/cycles.ts): its tilt's nod, its ellipse's breathing, its precession. */
export function homeCycles(g: HomeWorld): Cycles {
  let c = CYCLES.get(g.digest);
  if (c) return c;
  const bodies = g.system.bodies,
    home = bodies[0]!,
    key = hashString(`cycles ${g.ground}`),
    phase = (k: number) => (finish(mix(key, k), 11) / 4294967296) * 2 * Math.PI,
    // (An Earth mass is some three millionths of the Sun's.)
    tuggers = bodies
      .filter((b) => b.index > 0 && b.kind !== "moon")
      .map((b) => ({ mass: b.mass * 3.003e-6, a: b.orbit.a }));
  if (g.system.companion) tuggers.push({ mass: g.system.companion.mass, a: g.system.companion.a });
  c = cyclesOf({
    starMass: g.star.mass,
    orbitAu: g.planet.orbitAu,
    dayHours: g.planet.dayHours,
    ecc: home.orbit.e,
    moons: bodies
      .filter((b) => b.kind === "moon" && b.orbit.around === home.ref)
      .map((b) => ({ mass: b.mass, a: b.orbit.a })),
    tuggers,
    phases: [phase(1), phase(2), phase(3)],
  });
  CYCLES.set(g.digest, c);
  if (CYCLES.size > 8) CYCLES.delete(CYCLES.keys().next().value!);
  return c;
}

/** The kelvin a degree of a world's climate is. */
const kOf = (g: HomeWorld) => kelvinPerDegree(worldKindOf(g));

/** The air's warming (degrees), read by name: the planet does not lean on the climate's module. */
function airWarming(world: World): { warm: number; event: Ref | null } {
  if (!world.hasStore("climate.air")) return { warm: 0, event: null };
  const a = (
    world.store("climate.air") as unknown as { air: { warming: number; lastWarmer: Ref | null } }
  ).air;
  return { warm: a.warming, event: a.lastWarmer };
}

/** The fine lands whose ice is kept: land that bears a sheet as made, or would under the greatest warmth turned. */
function trackedCells(g: HomeWorld): Int32Array {
  const out: number[] = [];
  for (let c = 0; c < g.grid.count; c++)
    if (g.tectonics.elevation[c]! > 0 && g.climate.temperature[c]! < ICE.line + 14) out.push(c);
  return Int32Array.from(out);
}

// (Read off the ground as it now lies and kept in the world's own store, by its surface: a world loaded at any year reads what the
// run that made it read there, and one moved world lends another neither its sheets nor its seas.)
/** How far inside its sheet's edge each fine land lies (km), where its warmth now lies below the line. */
function insideOf(store: MotionStore, g: HomeWorld, warm: number): Float32Array {
  const kept = { by: store.readOf(g.surface ?? "").inside };
  let d = kept.by.get(warm);
  if (d) return d;
  const n = g.grid.count,
    below = (c: number) =>
      g.tectonics.elevation[c]! > 0 && g.climate.temperature[c]! + warm < ICE.line,
    steps = new Int32Array(n).fill(-1),
    queue: number[] = [];
  for (let c = 0; c < n; c++)
    if (!below(c)) {
      steps[c] = 0;
      queue.push(c);
    }
  for (let h = 0; h < queue.length; h++) {
    const c = queue[h]!;
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
      const m = g.grid.neighbours[k]!;
      if (steps[m] === -1) {
        steps[m] = steps[c]! + 1;
        queue.push(m);
      }
    }
  }
  const radiusKm = 6371 * g.planet.radius;
  d = new Float32Array(n);
  for (let c = 0; c < n; c++)
    d[c] = steps[c]! > 0 ? (steps[c]! - 0.5) * radiusKm * Math.sqrt(g.grid.areas[c]!) : 0;
  kept.by.set(warm, d);
  if (kept.by.size > 6) kept.by.delete(kept.by.keys().next().value!);
  return d;
}

/** The area of a fine cell (km²). */
const areaOf = (g: HomeWorld, c: number) => {
  const r = 6371 * g.planet.radius;
  return g.grid.areas[c]! * r * r;
};

function seasKm2(g: HomeWorld): number {
  let a = 0;
  for (let c = 0; c < g.grid.count; c++) if (g.tectonics.elevation[c]! <= 0) a += areaOf(g, c);
  return a;
}

/** Begin a world's motion: its tracked lands and their sheets as made. */
function begin(store: MotionStore, g: HomeWorld): void {
  const cells = trackedCells(g),
    inside = insideOf(store, g, 0),
    ice = new Uint16Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    ice[i] =
      g.climate.temperature[c]! < ICE.line
        ? Math.min(65000, Math.round(sheetHeight(inside[c]!, g.planet.gravity)))
        : 0;
  }
  store.cells = cells;
  store.ice = ice;
  store.made = ice.slice();
}

/** The year of a world's ground: its warmth, a tenth of its ice, its seas, its overturning, its star; and what they did. */
export function motionYear(world: World, t: SimTime, years = 1): void {
  const store = motionOf(world);
  if (!store) return;
  const g = homePlanet(world).generated.fine,
    year = yearOfMoment(t),
    s = store.state,
    k = kOf(g),
    kind = worldKindOf(g);
  if (!store.cells.length) begin(store, g);
  const before = shiftNow(world);

  // The light the world keeps: its ice's (against as made) and its star's, in its climate's degrees.
  let lostKm2 = 0;
  for (let i = 0; i < store.cells.length; i++) {
    const was = store.made[i]! >= ICE.thin,
      is = store.ice[i]! >= ICE.thin;
    if (was !== is) lostKm2 += (was ? 1 : -1) * areaOf(g, store.cells[i]!);
  }
  const face = 4 * Math.PI * (6371 * g.planet.radius) * (6371 * g.planet.radius),
    life = homeStarLife(g, year),
    risen =
      life.stage === "ended"
        ? 0.001 / Math.max(1e-6, lightAt(life.through - 1e-9)) - 1
        : life.risen,
    starK = Math.max(
      -0.95 * (g.planet.meanTemperature + 273.15),
      2.7 * (g.planet.meanTemperature + 273.15) * (dmath.pow(Math.max(0, 1 + risen), 0.25) - 1),
    );
  s.albedo = albedoWarming(lostKm2 / face, g.planet.insolation) / k;
  s.star = starK / k;
  const air = airWarming(world),
    toward = air.warm + s.albedo + s.star,
    pace = 1 - dmath.pow(1 - GROUND_PACE, years);
  s.ground += pace * (toward - s.ground);

  // A tenth of the tracked lands: each steps ten years at once (its snow, its summers, as high as its width bears).
  const god = groundWarming(world, planetRef(0)),
    warm = god + s.ground,
    inside = insideOf(store, g, quantum(warm, STEP.warm)),
    rainK = 1,
    stepped: number[] = [];
  let melt = 0,
    flips = 0;
  // (Its slow swings: the summers of its high latitudes, each hemisphere's, against the year its chronicle opened. rules/cycles.ts.)
  const cycles = homeCycles(g),
    summerN = summerWarmth(cycles, year, true),
    summerS = summerWarmth(cycles, year, false);
  for (let i = 0; i < store.cells.length; i++) {
    const c = store.cells[i]!;
    if ((c + year) % ICE_STEP !== 0 && years < ICE_STEP) continue;
    const lat = g.grid.lat[c]!,
      swung = (lat >= 0 ? summerN : summerS) * Math.abs(dmath.sin(lat)),
      span = years < ICE_STEP ? ICE_STEP : years,
      mean = g.climate.temperature[c]! + warm + swung,
      balance = iceBalance(mean, g.climate.seasonality[c]!, g.climate.precipitation[c]! * rainK, k),
      // (Below the line a sheet grows as its snow lets it; above, it only wastes.)
      b = mean < ICE.line ? Math.max(0, balance) : Math.min(0, balance),
      top = mean < ICE.line ? sheetHeight(inside[c]!, g.planet.gravity) : 0,
      was = store.ice[i]!,
      grown = b >= 0 ? Math.min(Math.max(was, top), was + b * span) : Math.max(0, was + b * span),
      now = Math.min(65000, Math.round(b >= 0 && was <= top ? Math.min(grown, top) : grown));
    if (now === was) continue;
    if (now < was) melt += ((was - now) / 1000) * areaOf(g, c) * (ICE.rhoIce / ICE.rhoLiquid);
    if (now >= ICE.thin !== was >= ICE.thin) flips++;
    store.ice[i] = now;
    stepped.push(c, now);
  }
  if (stepped.length) store.note(stepped);
  // The seas: the ice the sheets have lost against as made, over the seas' area; and their deep's swelling.
  let iceKm3 = 0;
  for (let i = 0; i < store.cells.length; i++)
    iceKm3 += ((store.made[i]! - store.ice[i]!) / 1000) * areaOf(g, store.cells[i]!);
  const read = store.readOf(g.surface ?? "");
  read.seas ??= seasKm2(g);
  const seas = read.seas;
  s.seaIce = seaFromIce(iceKm3, seas);
  const liquid = KINDS[kind].liquid.subst,
    swellTo = swellOf((s.ground + god) * k, liquid);
  s.swell += (1 - dmath.pow(1 - 1 / DEEP_WARMS, years)) * (swellTo - s.swell);
  // The overturning: by the melt poured in and the surface's warming. A tenth of the lands step a year, each by its ten years, so
  // what melted is a year's over the world; on a long step every land steps by all its years, and it is spread over them.
  s.melt = melt;
  const meltSv = (melt * 1e9) / (years < ICE_STEP ? 1 : years) / (365.25 * 86400) / 1e6;
  s.overturn +=
    (1 - dmath.pow(1 - OVERTURN.pace, years)) *
    (overturnOf(meltSv, (s.ground + god) * k) - s.overturn);
  store.note([
    Math.round(s.ground * 1e4),
    Math.round(s.seaIce * 100),
    Math.round(s.swell * 100),
    Math.round(s.overturn * 1e4),
  ]);

  // A new reading where any land's would turn: at once where the warmth, the sea or the overturning steps, and for
  // sheets come or gone, gathered and read once a decade (every land's yield is reckoned again with a new reading).
  const q = (x: number, st: number) => quantum(x, st);
  s.pending += flips;
  if (
    (s.pending > 0 && year % ICE_STEP === 0) ||
    q(warm, STEP.warm) !== before.warm ||
    q(s.seaIce + s.swell, STEP.sea) !== before.sea ||
    q(s.overturn - 1, STEP.overturn) !== before.overturn
  ) {
    s.version++;
    s.pending = 0;
  }
  if (year % PAST_EVERY === 0) {
    let covered = 0;
    for (let i = 0; i < store.cells.length; i++)
      if (store.ice[i]! >= ICE.thin) covered += areaOf(g, store.cells[i]!);
    store.past.push([
      year,
      Math.round((s.ground + god) * 100),
      Math.round((s.seaIce + s.swell) * 10),
      Math.round(covered / 1000),
      Math.round(s.overturn * 100),
    ]);
    if (store.past.length > PAST_MOST) {
      const half = store.past.length >> 1;
      store.past = [
        ...store.past.slice(0, half).filter((_, i) => i % 2 === 0),
        ...store.past.slice(half),
      ];
    }
  }
  tell(world, store, g, year, air.event);
}

/** What the year's turns did, told: the seas' metres, the overturning, the lands drowned, bared, thawed or iced, the stars. */
function tell(
  world: World,
  store: MotionStore,
  g: HomeWorld,
  year: number,
  warmer: Ref | null,
): void {
  const s = store.state,
    shift = shiftNow(world),
    planet = homePlanet(world).generated,
    godAct = warmingAct(world, planetRef(0)),
    why: CauseRef[] = [
      ...(warmer ? [{ ref: warmer, role: "pressure" as const, weight: 0.6 }] : []),
      ...(godAct && divineWarming(world, planetRef(0))
        ? [{ ref: godAct.event, role: "agent" as const, weight: 0.8 }]
        : []),
    ];
  // The seas, each metre.
  const metres = Math.trunc(s.seaIce + s.swell);
  if (metres !== s.toldSea) {
    s.toldSea = metres;
    s.seaEvent = world.events.emit({
      type: MOTION_EVENTS.seas.type,
      causes: [
        ...why,
        ...(s.seaEvent ? [{ ref: s.seaEvent, role: "enabler" as const, weight: 0.3 }] : []),
      ],
      data: {
        metres,
        fromIce: Math.round(s.seaIce * 10) / 10,
        swell: Math.round(s.swell * 10) / 10,
      },
    });
  }
  // The overturning, halved or come back.
  const weak = s.overturn <= 0.5;
  if (weak !== s.toldOverturn) {
    s.toldOverturn = weak;
    s.overturnEvent = world.events.emit({
      type: MOTION_EVENTS.overturn.type,
      causes: [
        ...why,
        ...(s.seaEvent ? [{ ref: s.seaEvent, role: "pressure" as const, weight: 0.4 }] : []),
      ],
      data: { overturn: Math.round(s.overturn * 100), weak },
    });
  }
  // The lands, where the reading turned: their share drowned or bared, their sheets gone or come.
  if (shift.key && (shift.sea || shift.ice) && s.toldVersion !== s.version) {
    s.toldVersion = s.version;
    const f = g,
      byLand = new Map<
        number,
        { area: number; under: number; bared: number; had: number; gone: number; come: number }
      >();
    for (let p = 0; p < planet.offworld.base; p++) {
      const row = { area: 0, under: 0, bared: 0, had: 0, gone: 0, come: 0 };
      for (let k = planet.childOffsets[p]!; k < planet.childOffsets[p + 1]!; k++) {
        const c = planet.children[k]!,
          e = f.tectonics.elevation[c]!,
          a = areaOf(f, c);
        if (e > 0) {
          row.area += a;
          if (e <= shift.sea) row.under += a;
        } else if (shift.sea < 0 && e > shift.sea) row.bared += a;
        const sheet = shift.ice?.[c] ?? 0,
          madeIce = f.climate.biome[c] === BIOME.ice;
        if (madeIce) row.had += a;
        if (madeIce && sheet === 2) row.gone += a;
        if (!madeIce && sheet === 1) row.come += a;
      }
      if (row.area > 0 || row.bared > 0) byLand.set(p, row);
    }
    for (const [p, r] of byLand) {
      const turn = store.lands.get(p),
        share = r.area > 0 ? Math.round((1000 * (r.under - r.bared)) / r.area) : 0,
        place = { ref: cellRef(0, p) as Ref };
      if (share >= 1000 * TOLD_SHARE && !turn?.drowned) {
        const l = store.land(p);
        l.share = share;
        l.drowned = world.events.emit({
          type: MOTION_EVENTS.drowned.type,
          place: place.ref,
          causes: s.seaEvent ? [{ ref: s.seaEvent, role: "trigger", weight: 1 }] : [],
          data: { share: Math.round(share / 10), metres: shift.sea },
        });
      } else if (share <= -1000 * TOLD_SHARE && !turn?.bared) {
        const l = store.land(p);
        l.share = share;
        l.bared = world.events.emit({
          type: MOTION_EVENTS.bared.type,
          place: place.ref,
          causes: s.seaEvent ? [{ ref: s.seaEvent, role: "trigger", weight: 1 }] : [],
          data: { share: Math.round(-share / 10), metres: -shift.sea },
        });
      }
      if (r.had > 0 && r.gone >= r.had / 2 && !turn?.thawed) {
        store.land(p).thawed = world.events.emit({
          type: MOTION_EVENTS.thawed.type,
          place: place.ref,
          causes: why,
          data: { km2: Math.round(r.gone) },
        });
      }
      if (r.come > 0 && r.come >= r.area / 3 && !turn?.iced) {
        store.land(p).iced = world.events.emit({
          type: MOTION_EVENTS.iced.type,
          place: place.ref,
          causes: why,
          data: { km2: Math.round(r.come) },
        });
      }
    }
  }
  // The home world grown unfit: over half the land its people could live on, gone (counted when the reading turns).
  if (shift.key && s.version !== store.dyingSeen) {
    store.dyingSeen = s.version;
    let made = 0,
      now = 0;
    for (let c = 0; c < g.grid.count; c++) {
      if (g.tectonics.elevation[c]! <= 0) continue;
      const b0 = g.climate.biome[c]!;
      if (b0 === BIOME.ice || b0 === BIOME.alpine) continue;
      made++;
      const b = biomeShifted(g, c, shift);
      if (b > BIOME.seaIce && b !== BIOME.ice && b !== BIOME.alpine && !searedUnder(g, c, shift))
        now++;
    }
    if (!s.dying && made > 0 && now <= made / 2)
      s.dying = world.events.emit({
        type: MOTION_EVENTS.dying.type,
        subjects: [planetRef(0) as Ref],
        causes: [
          ...(s.swelling ? [{ ref: s.swelling, role: "trigger" as const, weight: 1 }] : []),
          ...why,
        ],
        data: { now, made },
      });
  }
  // The home star, swelling at the end of its life; the cluster's stars that end.
  const life = homeStarLife(planet, year);
  if (life.stage !== "main" && !s.swelling)
    s.swelling = world.events.emit({
      type: MOTION_EVENTS.swelling.type,
      subjects: [planet.star.ref as Ref],
      causes: [],
      data: { through: Math.round(life.through * 1000) / 10, risen: Math.round(life.risen * 100) },
    });
  if (year % 10 === 0) starEnds(world, store, year);
}

/** The cluster's stars whose lives end by this year (reckoned once a decade; each told once). */
function starEnds(world: World, store: MotionStore, year: number): void {
  const told = new Set(store.ends.map((e) => e.star as string));
  for (const star of clusterOf(world)) {
    if (star.remnant || told.has(star.ref)) continue;
    const life = starLifetime(star.mass, worldLaws(world)?.burn),
      left = (life - star.ageGyr) * 1e9;
    if (left > year) continue;
    const how = star.mass >= STAR_LIFE.supernova ? "supernova" : "white dwarf",
      event = world.events.emit({
        type: MOTION_EVENTS.ended.type,
        subjects: [star.ref],
        causes: [],
        data: { how, distance: Math.round(star.distance * 10) / 10, spectral: star.spectral },
      });
    store.ends.push({ star: star.ref, year, how, distance: star.distance, event });
  }
}

/** Teach a world its ground in motion. */
export function installMotion(world: World): MotionStore {
  const store = world.register(new MotionStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "128.planet.motion", every: YEAR, run: (t) => motionYear(world, t) });
  return store;
}
