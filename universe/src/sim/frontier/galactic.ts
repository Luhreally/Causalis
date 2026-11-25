// The galaxy's fire in play (the Frontier lane; the rules are rules/galactic.ts). Once a decade (a world's own year of ten),
// the span since last is drawn at once (a deep-time path: a decade or ten thousand years alike): whether a great star died
// near enough to harm the home world, where it lay, a burst of gamma rays aimed this way, and the new stars seen by eye.
// A burst presses on every land under it for its years: on the home world's by its distance and its field's shelter,
// on halls under other stars by their own distance from it (frontierSky), and on the home world's fields (frontierFields).
// A dozen new stars kept, and the last burst; nothing grows with history.
import {
  Hasher,
  Rng,
  dmath,
  YEAR,
  defineEventType,
  defineStream,
  yearOfMoment,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { LOCAL_DENSITY, makeGalaxy, type Galaxy } from "../../gen/index.ts";
import {
  GALACTIC,
  ROGUE,
  roguePass,
  roguePassRate,
  STAR_LIFE,
  burstDistance,
  burstHarm,
  fieldsUnderBurst,
  gammaRate,
  guestRate,
  supernovaRate,
} from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";
import { homeFieldAt } from "../planet/motion.ts";
import type { PopulationContext } from "../population/systems.ts";
import { fold } from "./common.ts";
import { shieldUnder, tellShield } from "./shield.ts";

export const GALACTIC_EVENTS = {
  /** A great star died, or a white dwarf blew up, near enough to harm the world. */
  supernova: defineEventType("frontier.near-supernova", 7),
  /** A world cast out of its own system passed close, shaking the far cloud or stirring the belt. */
  rogue: defineEventType("frontier.rogue-passed", 6),
  /** A burst of gamma rays struck the world. */
  gamma: defineEventType("frontier.gamma-burst", 7),
  /** A new star seen in the sky by eye: a great star dying far off. */
  guest: defineEventType("frontier.guest-star", 3),
};

const GALAXY_STREAM = defineStream("frontier.galaxy");

/** How often the galaxy is read (years), and how many new stars are kept. */
export const GALACTIC_STEP = 10;
export const GUESTS_KEPT = 12;

export type Burst = {
  readonly year: number;
  readonly kind: "supernova" | "white dwarf" | "gamma";
  /** Light-years from home, and its direction (a unit vector in the cluster's frame). */
  readonly distance: number;
  readonly dir: readonly [number, number, number];
  /** What it lays on the home world's deaths (×1000), and the years it lasts. */
  readonly harm: number;
  readonly years: number;
  readonly event: Ref;
};

export type Guest = { readonly year: number; readonly kly: number; readonly event: Ref };

/** A rogue world's pass: how close (AU), how many more stones it sends and until when, whether it stirred the home world's orbit. */
export type Rogue = {
  readonly year: number;
  readonly au: number;
  readonly times: number;
  readonly until: number;
  readonly orbit: boolean;
  readonly event: Ref;
};

export class GalacticStore implements StateStore {
  readonly name = "frontier.galactic";
  /** The year last read. */
  last = -1;
  burst: Burst | null = null;
  guests: Guest[] = [];
  rogue: Rogue | null = null;
  private readonly digest: [number, number] = [0x811c9dc5, 0];

  dormant(): boolean {
    return !this.burst && !this.guests.length && !this.rogue;
  }
  note(xs: readonly number[]): void {
    fold(this.digest, xs);
  }
  pinned(): Ref[] {
    return [
      ...(this.burst ? [this.burst.event] : []),
      ...(this.rogue ? [this.rogue.event] : []),
      ...this.guests.map((g) => g.event),
    ];
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    h.int(this.last).value(this.burst).value(this.rogue).int(this.guests.length);
    h.int(this.digest[0]).int(this.digest[1]);
  }
  save(): unknown {
    if (this.dormant() && this.last < 0) return {};
    return {
      last: this.last,
      burst: this.burst,
      guests: this.guests,
      rogue: this.rogue,
      digest: [...this.digest],
    };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as {
      last?: number;
      burst?: Burst | null;
      guests?: Guest[];
      rogue?: Rogue | null;
      digest?: [number, number];
    };
    this.last = s.last ?? -1;
    this.burst = s.burst ?? null;
    this.guests = [...(s.guests ?? [])];
    this.rogue = s.rogue ?? null;
    this.digest[0] = s.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s.digest?.[1] ?? 0;
  }
}

export function galacticOf(world: World): GalacticStore | null {
  return world.peek<GalacticStore>("frontier.galactic") ?? null;
}

/** The galaxy home lies in (a pure function of the seed, kept while it is the same). */
const GALAXIES = new Map<string, Galaxy>();
export function galaxyOf(world: World): Galaxy {
  const key = world.seed.text;
  let g = GALAXIES.get(key);
  if (!g) {
    if (GALAXIES.size > 8) GALAXIES.clear();
    GALAXIES.set(key, (g = makeGalaxy(new Rng(world.seed))));
  }
  return g;
}

/** The galaxy's fire about home: near supernovae a year, gamma bursts, new stars seen. */
export function galacticRates(world: World): { supernova: number; gamma: number; guest: number } {
  const g = galaxyOf(world);
  return {
    supernova: supernovaRate(g, GALACTIC.reachLy),
    gamma: gammaRate(g),
    guest: guestRate(g),
  };
}

/** The burst pressing on the world now (null: none). */
export function burstNow(world: World): Burst | null {
  const b = galacticOf(world)?.burst;
  if (!b) return null;
  return yearOfMoment(world.now) - b.year < b.years ? b : null;
}

/** What a burst lays on the deaths of halls under a star so far from home (its point in the cluster's frame: ly). */
export function burstAt(world: World, x: number, y: number, z: number): number {
  const b = burstNow(world);
  if (!b) return 1;
  if (b.kind === "gamma") return b.harm / 1000;
  const bx = b.dir[0] * b.distance - x,
    by = b.dir[1] * b.distance - y,
    bz = b.dir[2] * b.distance - z,
    d = Math.sqrt(bx * bx + by * by + bz * bz);
  return d > GALACTIC.reachLy ? 1 : burstHarm(d, 0.3);
}

/** What the burst leaves of the home world's fields (1: none). */
export function burstFields(world: World): number {
  const b = burstNow(world);
  return b ? fieldsUnderBurst(b.harm / 1000) : 1;
}

/** What the burst lays on the home world's people's deaths (1: none). */
export function burstHarmNow(world: World): number {
  return (burstNow(world)?.harm ?? 1000) / 1000;
}

/** The galaxy's decade: what fell in the span since it was last read. */
export function galacticYear(ctx: PopulationContext, t: SimTime): void {
  const world = ctx.world,
    store = galacticOf(world);
  if (!store) return;
  const year = yearOfMoment(t);
  if (store.last >= 0 && year - store.last < GALACTIC_STEP) return;
  const span = store.last < 0 ? GALACTIC_STEP : year - store.last;
  store.last = year;
  const rates = galacticRates(world),
    u = (n: number) => world.rng.real(GALAXY_STREAM, year, n, 0),
    g = homePlanet(world).generated,
    field = homeFieldAt(g, yearOfMoment(world.now));
  // New stars seen by eye: one a span at most is told.
  if (u(0) < 1 - dmath.exp(-rates.guest * span)) {
    const event = world.events.emit({
      type: GALACTIC_EVENTS.guest.type,
      causes: [],
      data: { kly: Math.round(10 + 190 * u(1)) / 10 },
    });
    store.guests.push({ year, kly: Math.round(10 + 190 * u(1)) / 10, event });
    if (store.guests.length > GUESTS_KEPT) store.guests.shift();
    store.note([year, 1]);
  }
  rogueSpan(world, store, year, span, u);
  if (burstNow(world)) return;
  const sn = u(2) < 1 - dmath.exp(-rates.supernova * span),
    gamma = !sn && u(3) < 1 - dmath.exp(-rates.gamma * span);
  if (!sn && !gamma) return;
  // Where it lay: a distance by the volume within reach, a direction even over the sphere.
  const distance = sn ? burstDistance(u(4), GALACTIC.reachLy) : 3000 + 7000 * u(4),
    zc = 2 * u(5) - 1,
    phi = 2 * Math.PI * u(6),
    rxy = Math.sqrt(Math.max(0, 1 - zc * zc)),
    dir: [number, number, number] = [rxy * dmath.cos(phi), rxy * dmath.sin(phi), zc],
    white = sn && u(7) < GALACTIC.whiteShare,
    harm = sn
      ? burstHarm(distance, field.shelter)
      : 1 + (GALACTIC.burstHarm - 1) * (1 - 0.3 * field.shelter),
    kind: Burst["kind"] = gamma ? "gamma" : white ? "white dwarf" : "supernova",
    event = world.events.emit({
      type: gamma ? GALACTIC_EVENTS.gamma.type : GALACTIC_EVENTS.supernova.type,
      subjects: [g.planet.ref as Ref],
      causes: [],
      data: { kind, distance: Math.round(distance * 10) / 10, harm: Math.round(harm * 100) / 100 },
    });
  store.burst = {
    year,
    kind,
    distance,
    dir,
    harm: Math.round(harm * 1000),
    years: gamma ? GALACTIC.burstYears : STAR_LIFE.burstYears,
    event,
  };
  store.note([year, Math.round(distance), Math.round(harm * 1000)]);
  tellShield(world, shieldUnder(world, harm, 1), event, store.burst.years);
}

/** How many more stones fall on the home world for a rogue's pass, in a year (1: none presses). */
export function rogueStir(world: World, year: number): number {
  const r = galacticOf(world)?.rogue;
  return r && year >= r.year && year < r.until ? r.times : 1;
}

/** Rogue worlds a year passing close enough to shake the far cloud, about home. */
export const rogueRate = (): number => roguePassRate(LOCAL_DENSITY, ROGUE.cloudAu);

/** A span's rogue worlds: the nearest pass of the span, if any came within the far cloud. */
function rogueSpan(
  world: World,
  store: GalacticStore,
  year: number,
  span: number,
  u: (n: number) => number,
): void {
  const p = 1 - dmath.exp(-rogueRate() * span);
  if (!(u(8) < p)) return;
  // (How close: as many in each ring as its area holds, within the cloud.)
  const au = ROGUE.cloudAu * Math.sqrt(Math.max(1e-12, u(9))),
    pass = roguePass(au);
  if (pass.years <= 0) return;
  // (A pass inside a stirring that still presses stirs no more than the stronger of the two.)
  const now = rogueStir(world, year);
  if (now >= pass.times) return;
  const event = world.events.emit({
    type: GALACTIC_EVENTS.rogue.type,
    importance: pass.orbit ? 7 : au <= ROGUE.beltAu ? 7 : 5,
    causes: [],
    data: { au: Math.round(au), times: pass.times, orbit: pass.orbit, years: pass.years },
  });
  store.rogue = {
    year,
    au: Math.round(au),
    times: pass.times,
    until: year + pass.years,
    orbit: pass.orbit,
    event,
  };
  store.note([year, Math.round(au), 7]);
}

/** Teach a world the galaxy's fire. */
export function installGalactic(world: World, ctx: () => PopulationContext): GalacticStore {
  const store = world.register(new GalacticStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "208.frontier.galactic", every: YEAR, run: (t) => galacticYear(ctx(), t) });
  return store;
}
