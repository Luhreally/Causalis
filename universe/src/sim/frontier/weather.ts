// The home star's weather in play (the Frontier lane; the rules are rules/starweather.ts). Once a year its greatest flare
// is drawn from what kind of star it is and how old (a deep-time path: the greatest of so many years at once), and the
// storm it sends to the home world read: past what its people have known, it raises their deaths as far as its field lets
// it through (population/systems.ts underStar, by frontierSky); past its first harm, it burns the transformers of every
// land that runs on wires, the more near the poles, the less where a watch in orbit gave a warning or a grid was rebuilt
// against the last: its machines burned, its people dead of the months in the dark. A realm hit rebuilds its grids
// against the next. One small record a storm told, a few dozen at most; nothing grows with history.
import {
  YEAR,
  Hasher,
  defineEventType,
  defineStream,
  yearOfMoment,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import {
  G,
  STAR_WEATHER,
  flareRate,
  greatestFlare,
  gridLost,
  flareThrough,
  stormAt,
  stormHarm,
  usualStorm,
} from "../../rules/index.ts";
import { knows } from "../lore/lore.ts";
import { politiesOf } from "../polity/polity.ts";
import { homePlanet } from "../planet/store.ts";
import { homeField } from "../planet/motion.ts";
import { deathsIn } from "../acts/disasters.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import { spaceOf } from "../space/space.ts";
import { fold, gridShare, homeLands, polarOf, refNumber } from "./common.ts";

export const WEATHER_EVENTS = {
  /** A storm from the home star that burned a grid. */
  storm: defineEventType("frontier.storm", 5),
  /** A flare far past the usual, its lights seen far from the poles (and nothing burned: no wires, or none hit). */
  flare: defineEventType("frontier.great-flare", 3),
};

const WEATHER = defineStream("frontier.weather");

/** How many storms told are kept. */
export const STORMS_KEPT = 24;

/** A storm told. */
export type Storm = {
  readonly year: number;
  /** Its flare, in Carringtons at the star; its storm at the world, and the world's usual yearly greatest (×100). */
  readonly flare: number;
  readonly storm: number;
  readonly usual: number;
  /** The lands whose grids it burned, the machines it burned and the dead of the dark. */
  readonly lands: number;
  readonly machines: number;
  readonly dead: number;
  /** The realms it hit. */
  readonly realms: readonly Ref[];
  readonly event: Ref;
};

export type WeatherState = {
  /** The year last stepped to. */
  last: number;
  /** What this year's storm lays on the home world's people's deaths (×1000; 1000: nothing past the usual). */
  harm: number;
  /** All told: storms that burned, machines, dead. */
  storms: number;
  machines: number;
  dead: number;
};

const firstState = (): WeatherState => ({ last: -1, harm: 1000, storms: 0, machines: 0, dead: 0 });

export class WeatherStore implements StateStore {
  readonly name = "frontier.weather";
  state: WeatherState = firstState();
  storms: Storm[] = [];
  /** Realms that rebuilt their grids against storms, and the year. */
  readonly hardened = new Map<Ref, number>();
  private readonly digest: [number, number] = [0x811c9dc5, 0];

  dormant(): boolean {
    return !this.storms.length && !this.hardened.size && this.state.harm === 1000;
  }
  note(xs: readonly number[]): void {
    fold(this.digest, xs);
  }
  tell(s: Storm): void {
    this.storms.push(s);
    if (this.storms.length > STORMS_KEPT) this.storms.shift();
    this.note([s.year, s.flare, s.storm, s.lands, s.machines, s.dead]);
  }
  pinned(): Ref[] {
    return this.storms.map((s) => s.event);
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    h.value(this.state).int(this.storms.length).int(this.hardened.size);
    h.int(this.digest[0]).int(this.digest[1]);
  }
  save(): unknown {
    if (this.dormant() && this.state.last < 0) return {};
    return {
      state: this.state,
      storms: this.storms,
      hardened: [...this.hardened.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
      digest: [...this.digest],
    };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as {
      state?: WeatherState;
      storms?: Storm[];
      hardened?: [Ref, number][];
      digest?: [number, number];
    };
    this.state = { ...firstState(), ...s.state };
    this.storms = [...(s.storms ?? [])];
    this.hardened.clear();
    for (const [r, y] of s.hardened ?? []) this.hardened.set(r, y);
    this.digest[0] = s.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s.digest?.[1] ?? 0;
  }
}

export function weatherOf(world: World): WeatherStore | null {
  return world.hasStore("frontier.weather") ? world.store<WeatherStore>("frontier.weather") : null;
}

/** The home star's flaring now: flares a year at least a Carrington, and the home world's usual yearly greatest storm. */
export function homeWeather(world: World): { rate: number; usual: number; au: number } {
  const g = homePlanet(world).generated,
    year = Math.max(0, yearOfMoment(world.now)),
    rate = flareRate(g.star.mass, g.star.ageGyr + year / 1e9),
    au = g.planet.orbitAu;
  return { rate, usual: usualStorm(rate, au), au };
}

/** What this year's storm lays on the home world's people's deaths (1: nothing past what they know). */
export function weatherHarm(world: World): number {
  return (weatherOf(world)?.state.harm ?? 1000) / 1000;
}

/** A year of the home star's weather (or so many years at once, a deep-time step: their greatest storm). */
export function weatherYear(ctx: PopulationContext, t: SimTime): void {
  const world = ctx.world,
    store = weatherOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    s = store.state,
    years = s.last < 0 ? 1 : Math.max(1, year - s.last);
  s.last = year;
  const g = homePlanet(world).generated,
    { rate, usual, au } = homeWeather(world),
    flare = greatestFlare(world.rng.real(WEATHER, 0, t, 0), rate, years),
    storm = stormAt(flare, au),
    field = homeField(g);
  // (The harm of a span stepped at once is its greatest storm's, for one year: the rest were the usual.)
  // (Its field keeps off what it keeps off of any flare: rules/planet.ts flareThrough. Earth's, nearly all.)
  const harm = Math.round(1000 * flareThrough(stormHarm(storm, usual), field.shelter));
  if (harm !== s.harm) store.note([year, harm]);
  s.harm = harm;
  const bears = Math.max(STAR_WEATHER.gridFrom, STAR_WEATHER.design * usual);
  const tell = Math.max(STAR_WEATHER.gridFrom, STAR_WEATHER.told * usual);
  if (storm < bears * 0.3 && storm < tell) return;
  // The grids it burns, land by land.
  const markets = marketsOf(world),
    space = spaceOf(world),
    base = homeLands(g),
    hit: Ref[] = [];
  let lands = 0,
    machines = 0,
    dead = 0;
  if (storm >= bears * 0.3)
    for (const p of politiesOf(world).living()) {
      const prog = space.of(p.ref),
        warned = !!prog?.satellite && knows(ctx, p.seat, "computing"),
        hardened = store.hardened.has(p.ref);
      let any = false;
      for (const cell of p.members) {
        if (cell >= base) continue;
        const share = gridShare(ctx, cell, knows(ctx, cell, "electricity"));
        if (share <= 0) continue;
        const lost =
          gridLost(storm, polarOf(g, cell), field.dynamo, warned, hardened, usual) * share;
        if (lost < 0.001) continue;
        const m = markets.get(cell),
          burned = m ? m.take("spoiled", G.machines, Math.floor(m.stock[G.machines]! * lost)) : 0,
          people = ctx.provinces.get(cell)?.total() ?? 0,
          fell = deathsIn(ctx, cell, Math.floor(people * lost * STAR_WEATHER.darkDead), t);
        machines += burned;
        dead += fell;
        lands++;
        any = true;
      }
      if (any) hit.push(p.ref);
    }
  if (!hit.length && storm < tell) return;
  const event = world.events.emit({
    type: hit.length ? WEATHER_EVENTS.storm.type : WEATHER_EVENTS.flare.type,
    importance: hit.length ? (dead > 1000 ? 6 : 5) : 3,
    subjects: [g.star.ref as Ref, ...hit.slice(0, 6)],
    place: hit.length ? cellRef(0, politiesOf(world).get(hit[0]!)!.seat) : null,
    causes: [{ ref: g.star.ref as Ref, role: "trigger", weight: 1 }],
    data: {
      flare: Math.round(flare * 100) / 100,
      storm: Math.round(storm * 100) / 100,
      usual: Math.round(usual * 100) / 100,
      lands,
      machines,
      dead,
      field: field.dynamo,
    },
  });
  for (const r of hit) store.hardened.set(r, year);
  if (hit.length) {
    s.storms++;
    s.machines += machines;
    s.dead += dead;
  }
  store.tell({
    year,
    flare: Math.round(flare * 100),
    storm: Math.round(storm * 100),
    usual: Math.round(usual * 100),
    lands,
    machines,
    dead,
    realms: hit,
    event,
  });
  store.note(hit.map(refNumber));
}

/** Teach a world its star's weather. */
export function installWeather(world: World, ctx: () => PopulationContext): WeatherStore {
  const store = world.register(new WeatherStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "206.frontier.weather", every: YEAR, run: (t) => weatherYear(ctx(), t) });
  return store;
}
