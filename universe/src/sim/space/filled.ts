// Worlds filling (galaxy-plan.md, "Worlds filled"): a colony does not stop at its one hall. For each world a people has
// come to, a number: how many live on it beyond what any land of it holds, grown year by year by their own numbers and by
// those who follow, up to what its air, cold, water and pull allow (rules/filling.ts). And the galaxy does not stop at its
// kept lands: once all are taken, a realm's ship still sails, and the colony it founds is that number alone. A year of all
// this is a little arithmetic for each world, which is why it is a number and not provinces.
import {
  defineEventType,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { cellRef, isProvinceWorld, worldLife, type GalaxyStar } from "../../gen/index.ts";
import {
  BANDS,
  crossingYears,
  cruise,
  fillDone,
  fillNext,
  fillReading,
  fillShare,
  heldReading,
  routeMachines,
  type FillGround,
  type FillReading,
  type LaneRoute,
  type StarDrive,
} from "../../rules/index.ts";
import { loreOf } from "../lore/lore.ts";
import { homePlanet } from "../planet/store.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { COLS, ROWS, type Province } from "../population/model.ts";
import type { PopulationContext } from "../population/systems.ts";
import { COLONISTS, spaceOf, spendMachines } from "./space.ts";
import { FilledStore, bodyKey, filledOf, starKey, type FilledWorld } from "./filled-store.ts";
import { lateOf, remakeKey } from "./late-store.ts";
import { landfallsOf } from "./landfall.ts";
import { folkOf } from "./natives.ts";
import { starSitesOf } from "./stars.ts";
import { STARSHIP_MACHINES, clusterOf, noteFirstJump, worldsOf } from "./voyages.ts";

export const FILLED_EVENTS = {
  sailed: defineEventType("filled.sailed", 4),
  landed: defineEventType("filled.landed", 4),
  world: defineEventType("filled.world", 5),
};

/** Those who follow a colony's first ship, a year, in settlers (est.): a ship's load every so many years. */
const FOLLOW_YEARS = 5;

/** Those who follow, a year: more where the way is shorter (`byDrive` over `years`, by the lanes). */
export const comersBy = (years: number, byDrive: number): number =>
  Math.round(((COLONISTS / FOLLOW_YEARS) * Math.max(years, byDrive)) / Math.max(1, years));

/** A world's ground, kept while it is the same seed. */
const GROUNDS = new Map<string, FillGround | null>();
/** A world's ground as a filling reads it: a body of the home system, or a world of another star. */
export function fillGround(world: World, w: Pick<FilledWorld, "key" | "body" | "star" | "planet">) {
  const key = `${world.seed.text} ${w.key}`;
  let g = GROUNDS.get(key);
  if (g === undefined) {
    if (GROUNDS.size > 2000) GROUNDS.clear();
    const here = homePlanet(world).generated;
    if (w.star) {
      const star = clusterOf(world).find((s: GalaxyStar) => s.ref === w.star);
      g = (star && worldsOf(world, star)[w.planet]) ?? null;
    } else g = here.system.bodies[w.body] ?? null;
    GROUNDS.set(key, g);
  }
  return g;
}

/** The lands of a world (a home-system body's three; a star's world's one). */
export function landsOf(ctx: PopulationContext, w: FilledWorld): number[] {
  const g = ctx.generated;
  if (!isProvinceWorld(g)) return [];
  if (w.body < 0) return w.cell === null ? [] : [w.cell];
  const out: number[] = [];
  g.offworld.sites.forEach((s, i) => {
    if (s.body === w.body) out.push(g.offworld.base + i);
  });
  return out;
}

/** Those a world's lands hold. */
const landPeople = (ctx: PopulationContext, w: FilledWorld): number =>
  landsOf(ctx, w).reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0);

/** How far a world has been remade (Phase 66). */
function remadeOf(ctx: PopulationContext, w: FilledWorld): number {
  const late = lateOf(ctx.world);
  if (!late) return 0;
  if (w.body >= 0) return late.share(remakeKey(w.body, 0));
  return w.cell === null ? 0 : late.share(remakeKey(-1, w.cell));
}

/** The land whose knowledge a world's people go by: its own, else who sent it, else whence it came. */
function knowerOf(ctx: PopulationContext, w: FilledWorld): number {
  const lands = landsOf(ctx, w);
  for (const c of lands) if (ctx.provinces.get(c)?.total()) return c;
  const realm = politiesOf(ctx.world).get(w.realm);
  return realm && realm.ended === null ? realm.seat : w.from;
}

/** What a world can hold now, as its people know how. */
export function readingOf(ctx: PopulationContext, w: FilledWorld): FillReading | null {
  const ground = fillGround(ctx.world, w);
  if (!ground) return null;
  const g = ctx.generated,
    home = g.system.bodies[0]!,
    who = knowerOf(ctx, w);
  const r = fillReading(
    ground,
    g.life.people?.body ?? null,
    home.gravity,
    home.air,
    remadeOf(ctx, w),
    {
      vats: !!loreOf(ctx.world).get(who, "vat-food"),
      towers: !!loreOf(ctx.world).get(who, "world-city"),
    },
  );
  return w.held ? heldReading(r) : r;
}

/** Those who were on a world first and threw its comers back: read once, when they come (Phase 70's own reading). */
function heldBy(ctx: PopulationContext, star: Ref | null, planet: number): string | null {
  if (!star) return null;
  const s = clusterOf(ctx.world).find((x) => x.ref === star),
    f = s ? folkOf(ctx.world, s, planet) : null;
  if (!f) return null;
  const last = landfallsOf(ctx.world, f, worldLife(ctx.generated)).at(-1);
  return last && !last.fight.won ? f.ref : null;
}

/** All of a world's people, now. */
export const peopleOn = (ctx: PopulationContext, w: FilledWorld): number =>
  !w.arrived ? 0 : w.people + landPeople(ctx, w);

/** The world a land stands on, once it has someone on it: added to the store, reckoned up from its founding to now. */
function adopt(ctx: PopulationContext, store: FilledStore, year: number): void {
  const g = ctx.generated;
  if (!isProvinceWorld(g)) return;
  const stars = starSitesOf(ctx.world),
    space = spaceOf(ctx.world),
    founders = new Map<number, Ref>();
  for (const prog of space.all()) for (const c of prog.colonies) founders.set(c.cell, prog.realm);
  g.offworld.sites.forEach((site, i) => {
    const cell = g.offworld.base + i,
      land = ctx.provinces.get(cell);
    if (!land?.total() || land.settledYear === null || !land.arrival) return;
    const ship = site.body < 0 ? stars?.get(cell) : undefined;
    if (site.body < 0 && !ship?.arrived) return;
    const key = ship ? starKey(ship.star, ship.planet) : bodyKey(site.body);
    if (store.get(key)) return;
    const realmRef =
        ship?.realm ?? founders.get(cell) ?? politiesOf(ctx.world).of(cell)?.ref ?? ("" as Ref),
      realm = politiesOf(ctx.world).get(realmRef),
      years = ship ? ship.arrives - ship.departed : 1,
      w: FilledWorld = {
        key,
        body: site.body,
        star: ship?.star ?? null,
        planet: ship?.planet ?? -1,
        cell,
        realm: realmRef,
        name: realm?.town ?? "",
        from: ship?.from ?? realm?.seat ?? cell,
        sailed: ship?.departed ?? land.settledYear,
        arrives: ship?.arrives ?? land.settledYear,
        distance: ship?.distance ?? 0,
        drive: ship?.drive ?? "",
        lanes: ship?.lane?.hops ?? 0,
        comers: comersBy(years, ship?.lane?.byDrive ?? years),
        held: heldBy(ctx, ship?.star ?? null, ship?.planet ?? -1),
        voyage: (ship?.voyage ?? land.arrival) as Ref,
        arrived: (ship?.arrived ?? land.arrival) as Ref,
        people: 0,
        filled: null,
        filledYear: null,
      },
      r = readingOf(ctx, w);
    store.add(w);
    if (!r) return;
    // (A save from before this rule: its people as they would have grown since they came, as it knows now. If that
    // filled it, that is told of no one: it is not news.)
    let n: number = COLONISTS,
      full: number | null = null;
    for (let y = w.arrives; y < year; y++) {
      n = fillNext(n, r, w.comers);
      if (full === null && fillDone(n, r)) full = y + 1;
    }
    w.people = Math.max(0, Math.round(n - landPeople(ctx, w)));
    if (full !== null) {
      w.filled = w.arrived;
      w.filledYear = full;
    }
  });
}

/** A world's year: its ship in, its people grown, and its being filled told once. */
function worldYear(
  ctx: PopulationContext,
  store: FilledStore,
  w: FilledWorld,
  year: number,
): void {
  const { world } = ctx;
  // (Unmade: nothing grows, and no one comes: W6.)
  if (w.gone !== undefined) return;
  if (!w.arrived) {
    if (year < w.arrives) return;
    w.arrived = world.events.emit({
      type: FILLED_EVENTS.landed.type,
      place: cellRef(0, w.from),
      subjects: [w.realm, w.star ?? (w.key as Ref)],
      causes: [
        { ref: w.voyage, role: "trigger", weight: 1 },
        ...(w.star ? [{ ref: w.star, role: "enabler" as const, weight: 0.5 }] : []),
      ],
      data: { realm: w.name, star: w.star, planet: w.planet, distance: w.distance, year },
    });
    w.people = COLONISTS;
    w.held = heldBy(ctx, w.star, w.planet);
    return;
  }
  const r = readingOf(ctx, w);
  if (!r) return;
  const lands = landPeople(ctx, w),
    now = w.people + lands,
    sender = politiesOf(world).get(w.realm),
    comers = sender && sender.ended === null ? w.comers : 0;
  // (Where its lands alone hold more than the world can, nothing is lost: it only stops growing.)
  w.people = Math.max(w.people, Math.round(fillNext(now, r, comers) - lands));
  if (w.filled || !fillDone(w.people + lands, r)) return;
  const whole = r.top >= 0.999,
    people = w.people + lands;
  w.filled = world.events.emit({
    type: FILLED_EVENTS.world.type,
    importance: whole ? (store.first ? 5 : 7) : 4,
    place: cellRef(0, w.cell ?? w.from),
    subjects: [w.realm, w.star ?? (w.key as Ref)],
    causes: [{ ref: w.arrived, role: "trigger", weight: 1 }],
    data: {
      realm: w.name,
      key: w.key,
      people,
      share: Math.round(fillShare(people, r) * 100),
      whole,
      year,
    },
  });
  w.filledYear = year;
  if (whole && !store.first) store.first = w.filled;
}

/** The year of every world with a people on it. Nothing at all until a people has a colony. */
export function filledYear(ctx: PopulationContext, t: SimTime): void {
  const store = filledOf(ctx.world);
  if (!store) return;
  const year = yearOfMoment(t);
  adopt(ctx, store, year);
  for (const w of store.all()) worldYear(ctx, store, w, year);
}

/** The last ship a realm sent to a world no land holds, for the gap between its ships. */
export function lastFarSailed(world: World, realm: Ref): number {
  let last = -Infinity;
  for (const w of filledOf(world)?.all() ?? [])
    if (w.realm === realm && w.cell === null && w.sailed > last) last = w.sailed;
  return last;
}

/** The stars a ship no longer sails for: those a far colony went to (the kept lands' are told by their own store). */
export function farTaken(world: World): readonly string[] {
  const out: string[] = [],
    store = filledOf(world);
  for (const w of store?.all() ?? []) if (w.star && w.cell === null) out.push(w.star);
  // (And a star with a world unmade: W6.)
  if (store?.barred) out.push(...store.barred);
  return out;
}

/**
 * A ship with no kept land left for it: its people aboard are a number from the day it sails, and the world it comes to is
 * a number on the day it comes. What it costs its realm and takes of its land is what any ship takes.
 */
export function sailFar(
  ctx: PopulationContext,
  p: Polity,
  origin: Province,
  drive: StarDrive,
  target: {
    readonly star: GalaxyStar;
    readonly planet: { readonly index: number };
    readonly years: number;
    readonly upkeep: number;
    readonly route?: LaneRoute;
  },
  reasons: Factor[],
  machines: number,
  year: number,
): void {
  const { world } = ctx,
    store = filledOf(world);
  if (!store) return;
  const route = target.route,
    years = Math.ceil(target.years),
    byDrive = Math.round(crossingYears(target.star.distance, drive));
  spendMachines(ctx, p, STARSHIP_MACHINES + (route ? routeMachines(route) : 0));
  const decision = world.decisions.record({
      rule: "filled.sailed",
      subject: p.ref,
      outcome: { star: target.star.ref, planet: target.planet.index, years },
      score: years,
      threshold: 0,
      factors: [
        {
          name: `a star ${target.star.distance.toFixed(1)} light-years out with a world its people could live on, every nearer one taken`,
          value: target.star.distance,
          contribution: 1,
          source: { ref: target.star.ref, role: "enabler" as const, weight: 1 },
        },
        {
          name: route
            ? `${route.hops} lane${route.hops === 1 ? "" : "s"} between the stars, ${years} years on the way`
            : `${drive.words}: ${(cruise(drive) * 100).toFixed(1)} in a hundred of light's speed, ${years} years on the way`,
          value: cruise(drive),
          contribution: 0.8,
          source: null,
        },
        ...reasons,
      ].slice(0, 6),
    }),
    causes: CauseRef[] = [{ ref: decision, role: "trigger", weight: 1 }],
    event = world.events.emit({
      type: FILLED_EVENTS.sailed.type,
      place: cellRef(0, origin.cell),
      subjects: [p.ref, target.star.ref],
      causes,
      data: {
        realm: p.town,
        star: target.star.ref,
        distance: Math.round(target.star.distance * 10) / 10,
        years,
        drive: drive.id,
        ...(route ? { lanes: route.hops, byDrive } : {}),
        year,
      },
    });
  // Those aboard, from the land they leave: grown people, as any ship's.
  let left = COLONISTS;
  for (let r = 0; r < ROWS && left > 0; r++) {
    const band = r % BANDS;
    if (ctx.life.bands[band]! < ctx.life.adulthood || band > 6) continue;
    for (let o = 0; o < COLS && left > 0; o++) {
      const n = Math.min(left, origin.counts.get(r, o));
      if (n <= 0) continue;
      origin.counts.add(r, o, -n);
      left -= n;
    }
  }
  store.add({
    key: starKey(target.star.ref, target.planet.index),
    body: -1,
    star: target.star.ref,
    planet: target.planet.index,
    cell: null,
    realm: p.ref,
    name: p.town,
    from: origin.cell,
    sailed: year,
    arrives: year + years,
    distance: target.star.distance,
    drive: drive.id,
    lanes: route?.hops ?? 0,
    comers: comersBy(years, byDrive),
    held: null,
    voyage: event,
    arrived: null,
    people: 0,
    filled: null,
    filledYear: null,
  });
  if (route)
    noteFirstJump(ctx, p, {
      what: "settlers",
      cell: null,
      star: target.star.ref,
      planet: target.planet.index,
      route,
      drive,
      distance: target.star.distance,
      arrives: year + years,
      thrown: null,
      cause: event,
      year,
    });
}

export function installFilled(world: World): FilledStore {
  const store = world.register(new FilledStore());
  world.addPinner(() => store.pinned());
  return store;
}
