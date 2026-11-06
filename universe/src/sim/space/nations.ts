// Realms among the stars (Phase 72, first slice; galaxy-plan.md, Star nations). A realm holds what it can answer in time: how long a
// word and a fleet take to reach a world, on its own fastest drive or its lanes, against the years its people's own lives give it.
// So lanes let a realm grow, and a realm on slow drives holds only what lies near. What a world cannot make and gets from those who
// hold it ties it down. Distance past answering, a fleet lost, a seat gone, a world grown past those who hold it pull it away, and
// each world goes when it goes, one at a time. A world that goes and cannot make what it needs falls by its own numbers: its dark
// age is what that is, and no state a rule sets. Empire, league and vassal are words a page reads off who is held and how.
import {
  YEAR,
  defineEventType,
  defineStream,
  hashString,
  yearOfMoment,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { cellRef, isProvinceWorld, tongueName, type GalaxyStar } from "../../gen/index.ts";
import {
  GREAT_WORLDS,
  MANY_WORLDS,
  STAR_DRIVES,
  answerYears,
  breakChance,
  chemistryOf,
  crossingYears,
  cruise,
  holdYears,
  makesItsOwn,
  needsMaking,
  owesOf,
  routeYears,
  starDriveFor,
  strainOf,
  worldDefence,
  type LaneRoute,
  type StarDrive,
  type Strain,
} from "../../rules/index.ts";
import { cultureOf } from "../culture/culture.ts";
import { knows } from "../lore/lore.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import type { PopulationContext } from "../population/systems.ts";
import { filledOf, type FilledWorld } from "./filled-store.ts";
import { peopleOn, readingOf } from "./filled.ts";
import { LANE_ROW, laneLawOf, laneMapOf, laneRoute } from "./lanes.ts";
import {
  NationStore,
  nationsOf,
  worldNation,
  type Holding,
  type StarNation,
} from "./nation-store.ts";
import { machinesOfRealm } from "./space.ts";
import { FLEET_MACHINES, type Cause } from "./starwar.ts";
import { clusterOf, worldsOf } from "./voyages.ts";

export const NATION_EVENTS = {
  /** A world goes its own way; the first from a realm of many. */
  left: defineEventType("nation.left", 4),
  firstLeft: defineEventType("nation.first-left", 7),
  joined: defineEventType("nation.joined", 3),
  taken: defineEventType("nation.taken", 5),
  /** The first realm to hold many worlds. */
  greatest: defineEventType("nation.greatest", 7),
  /** A realm of many worlds, at its end. */
  fell: defineEventType("nation.fell", 7),
  dark: defineEventType("nation.dark", 4),
  firstDark: defineEventType("nation.first-dark", 7),
};

const NATION_DRAW = defineStream("space.nations");

/** A world is read once in this many years. */
export const READ_EVERY = 5;
/** The chance, each time it is read, that a world in need goes to those who can bring it what it lacks (est.). */
const JOIN_CHANCE = 0.2;
/** The realms among the stars kept, those long fallen first to go (a save's bound). */
const MOST_KEPT = 48;

/** How a realm reaches: from where, on what, whether it has a fleet to send, and how many its people are. */
export type Seat = {
  readonly star: string | null;
  readonly drive: StarDrive | null;
  readonly lanes: boolean;
  readonly fleet: boolean;
  readonly people: number;
  readonly hold: number;
};

/** How far apart two stars lie. */
function lightYears(world: World, a: string, b: string): number {
  if (a === b) return 0;
  const map = laneMapOf(world),
    p = map.stars[map.at.get(a) ?? 0]!,
    q = map.stars[map.at.get(b) ?? 0]!,
    dx = p.x - q.x,
    dy = p.y - q.y,
    dz = p.z - q.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** A way by lanes between two stars, kept. */
const ROUTES = new Map<string, LaneRoute | null>();
function routeOf(world: World, a: string, b: string): LaneRoute | null {
  const key = `${world.seed.text} ${a} ${b}`;
  let r = ROUTES.get(key);
  if (r === undefined) {
    if (ROUTES.size > 40000) ROUTES.clear();
    ROUTES.set(key, (r = laneRoute(world, a, b)));
  }
  return r;
}

/** How a word and a fleet of a seat reach a star. */
export function answerFrom(
  world: World,
  seat: Seat,
  star: string,
): {
  readonly ly: number;
  readonly word: number;
  readonly fleet: number;
  readonly answer: number;
  readonly hops: number;
} {
  if (!seat.star || !seat.drive) {
    const ly = seat.star ? lightYears(world, seat.star, star) : 0;
    return { ly, word: ly, fleet: Infinity, answer: Infinity, hops: 0 };
  }
  const ly = lightYears(world, seat.star, star),
    drive = crossingYears(ly, seat.drive),
    route = seat.lanes && ly > 0 ? routeOf(world, seat.star, star) : null,
    byLane = route ? routeYears(route, cruise(seat.drive)) : Infinity,
    fleet = Math.min(drive, byLane);
  return { ly, ...answerYears(ly, fleet), hops: byLane < drive ? route!.hops : 0 };
}

/** The star a realm's seat stands at: the home star, or the star of a land away. */
function seatStarOf(ctx: PopulationContext, p: Polity): string {
  const h = nationsOf(ctx.world)?.ofCell(p.seat);
  return h ? (h.star as string) : (ctx.generated.star.ref as string);
}

/** How a realm of the home world reaches now. */
export function seatOfRealm(ctx: PopulationContext, p: Polity): Seat {
  const k = (id: string) => knows(ctx, p.seat, id);
  return {
    star: seatStarOf(ctx, p),
    drive: starDriveFor(k) ?? null,
    lanes: laneLawOf(ctx.world).open && k(LANE_ROW),
    fleet: machinesOfRealm(ctx, p) >= FLEET_MACHINES,
    people: p.members.reduce((s, c) => s + (ctx.provinces.get(c)?.total() ?? 0), 0),
    hold: holdYears(ctx.life.adulthood),
  };
}

/** How a realm reaches now: its seat, and what it knows; a realm of worlds alone, by what its people took with them. */
export function seatOf(ctx: PopulationContext, n: StarNation): Seat {
  const { world } = ctx,
    hold = holdYears(ctx.life.adulthood);
  if (n.realm) {
    const p = politiesOf(world).get(n.realm);
    return p && p.ended === null
      ? seatOfRealm(ctx, p)
      : { star: null, drive: null, lanes: false, fleet: false, people: 0, hold };
  }
  const h = n.seat ? nationsOf(world)?.get(n.seat) : undefined,
    w = n.seat ? filledOf(world)?.get(n.seat) : undefined;
  if (!h || !w || w.gone !== undefined || h.dark)
    return { star: null, drive: null, lanes: false, fleet: false, people: 0, hold };
  const people = peopleOn(ctx, w);
  return {
    star: h.star as string,
    drive: STAR_DRIVES.find((d) => d.id === h.own?.drive) ?? null,
    lanes: !!h.own?.lanes,
    fleet: makesItsOwn(people, false),
    people,
    hold,
  };
}

/** A star's metal, as its light and age give it: a world of it can make machines or it cannot. */
const POOR = new Map<string, boolean>();
export function poorGround(world: World, star: string, planet: number): boolean {
  const key = `${world.seed.text} ${star} ${planet}`;
  let poor = POOR.get(key);
  if (poor === undefined) {
    if (POOR.size > 4000) POOR.clear();
    const s = clusterOf(world).find((x: GalaxyStar) => x.ref === star),
      p = s ? worldsOf(world, s)[planet] : undefined;
    if (!s || !p) poor = false;
    else {
      const inner = Math.sqrt(s.luminosity / 1.1),
        outer = Math.sqrt(s.luminosity / 0.53),
        zone = Math.min(1, Math.max(0, (p.a - inner) / Math.max(1e-6, outer - inner)));
      poor =
        chemistryOf({ temperature: s.temperature, ageGyr: s.ageGyr, zone, u: [0, 0, 0] }).metals ===
        "poor";
    }
    POOR.set(key, poor);
  }
  return poor;
}

/** What is pulling a world away, read now. */
export function strainNow(
  ctx: PopulationContext,
  h: Holding,
  w: FilledWorld,
  n: StarNation,
  seat: Seat,
  year: number,
): { strain: Strain; owes: boolean; way: ReturnType<typeof answerFrom>; people: number } {
  const way = answerFrom(ctx.world, seat, h.star),
    r = readingOf(ctx, w),
    people = peopleOn(ctx, w),
    owes = r ? owesOf(r, people, poorGround(ctx.world, h.star, h.planet)) : false;
  return {
    way,
    owes,
    people,
    strain: strainOf({
      answer: way.answer,
      hold: seat.hold,
      fleet: seat.fleet,
      forcedAgo: h.how === "taken" ? year - h.since : null,
      lostAgo: n.lostFleet === null ? null : year - n.lostFleet,
      people,
      seatPeople: seat.people,
      owes,
    }),
  };
}

/** The realm's own record, made when it first holds a world. */
function nationOfRealm(store: NationStore, p: Polity, year: number): StarNation {
  let n = store.nation(p.ref);
  if (!n) {
    n = {
      ref: p.ref,
      realm: p.ref,
      name: p.town,
      seat: null,
      founded: year,
      event: null,
      worlds: 0,
      greatest: 0,
      greatestYear: year,
      lostFleet: null,
      lost: [],
      fell: null,
    };
    store.addNation(n);
  }
  return n;
}

/** A world gains or loses its holder: the realm's count, its greatest, its fall. */
function recount(
  ctx: PopulationContext,
  store: NationStore,
  n: StarNation,
  year: number,
  cause: Ref | null,
): void {
  const { world } = ctx;
  let worlds = 0;
  for (const h of store.all()) if (h.holder === n.ref) worlds++;
  n.worlds = worlds;
  if (worlds > n.greatest) {
    n.greatest = worlds;
    n.greatestYear = year;
    n.fell = null;
    if (worlds >= GREAT_WORLDS && !store.first.greatest) {
      store.first.greatest = world.events.emit({
        type: NATION_EVENTS.greatest.type,
        place: placeOf(ctx, n),
        subjects: [n.ref],
        causes: cause ? [{ ref: cause, role: "trigger", weight: 1 }] : [],
        data: { realm: n.name, worlds, year },
      });
    }
  }
  // Fallen: of many worlds, one or none left.
  if (n.greatest >= MANY_WORLDS && worlds <= 1 && !n.fell && cause) {
    const event = world.events.emit({
      type: NATION_EVENTS.fell.type,
      place: placeOf(ctx, n),
      subjects: [n.ref],
      causes: [{ ref: cause, role: "trigger", weight: 1 }],
      data: { realm: n.name, greatest: n.greatest, atYear: n.greatestYear, left: worlds, year },
    });
    n.fell = { year, event };
    store.first.fell ??= event;
  }
}

function placeOf(ctx: PopulationContext, n: StarNation): Ref {
  const p = n.realm ? politiesOf(ctx.world).get(n.realm) : undefined;
  if (p) return cellRef(0, p.seat);
  const w = n.seat ? filledOf(ctx.world)?.get(n.seat) : undefined;
  return cellRef(0, w?.cell ?? w?.from ?? 0);
}

/** Why a world goes, as factors of a decision: each part of what pulls it, in numbers. */
function strainFactors(
  n: StarNation,
  s: Strain,
  way: ReturnType<typeof answerFrom>,
  seat: Seat,
  cause: Ref | null,
): Factor[] {
  const out: Factor[] = [];
  if (s.far > 0)
    out.push({
      name:
        way.answer === Infinity
          ? `no word or fleet of ${n.name} can come now`
          : `${Math.round(way.answer)} years for a word and a fleet of ${n.name}, against ${Math.round(seat.hold)} years to answer in${seat.fleet ? "" : "; it has no fleet to send"}`,
      value: way.answer === Infinity ? -1 : way.answer,
      contribution: s.far,
      source: cause ? { ref: cause, role: "pressure", weight: 1 } : null,
    });
  if (s.lost > 0)
    out.push({
      name: `a fleet of ${n.name} lost`,
      value: s.lost,
      contribution: s.lost,
      source: null,
    });
  if (s.force > 0)
    out.push({ name: "held by force", value: s.force, contribution: s.force, source: null });
  if (s.size > 0)
    out.push({
      name: "grown past those who hold it",
      value: s.size,
      contribution: s.size,
      source: null,
    });
  return out.length
    ? out.slice(0, 5)
    : [{ name: "word is always late", value: s.total, contribution: s.total, source: null }];
}

/** A world cut off, if it cannot make what it needs: what it has lacked since is its dark age. */
function goDark(
  ctx: PopulationContext,
  store: NationStore,
  h: Holding,
  w: FilledWorld,
  year: number,
  cause: Ref,
): void {
  const { world } = ctx,
    r = readingOf(ctx, w),
    people = peopleOn(ctx, w),
    poor = poorGround(world, h.star, h.planet);
  // (A world with a land of its own has that land's market and ledger to answer to: what it has, it has by them.)
  if (!r || h.dark || h.cell !== null || !needsMaking(r) || makesItsOwn(people, poor)) return;
  const first = !store.first.dark,
    event = world.events.emit({
      type: first ? NATION_EVENTS.firstDark.type : NATION_EVENTS.dark.type,
      place: cellRef(0, w.cell ?? w.from),
      subjects: [w.star!, w.realm],
      causes: [{ ref: cause, role: "trigger", weight: 1 }],
      data: { realm: w.name, star: w.star, planet: w.planet, people, poor, year },
    });
  h.dark = { since: year, before: people, event, poor };
  store.first.dark ??= event;
}

/** A world goes its own way. */
function leave(
  ctx: PopulationContext,
  store: NationStore,
  h: Holding,
  w: FilledWorld,
  n: StarNation,
  seat: Seat,
  read: ReturnType<typeof strainNow>,
  year: number,
): void {
  const { world } = ctx,
    realms = politiesOf(world),
    p = n.realm ? realms.get(n.realm) : undefined,
    decision = world.decisions.record({
      rule: "nation.left",
      subject: n.ref,
      outcome: { key: h.key },
      score: read.strain.total,
      threshold: 1,
      factors: strainFactors(
        n,
        read.strain,
        read.way,
        seat,
        p?.ended !== null && p ? p.event : null,
      ),
    }),
    first = !store.first.left && n.worlds >= MANY_WORLDS,
    event = world.events.emit({
      type: first ? NATION_EVENTS.firstLeft.type : NATION_EVENTS.left.type,
      place: cellRef(0, w.cell ?? w.from),
      subjects: [n.ref, h.star],
      causes: [{ ref: decision, role: "trigger", weight: 1 }],
      data: {
        realm: n.name,
        star: h.star,
        planet: h.planet,
        people: read.people,
        ly: Math.round(read.way.ly * 10) / 10,
        answer: read.way.answer === Infinity ? null : Math.round(read.way.answer),
        worlds: n.worlds - 1,
        year,
      },
    });
  if (first) store.first.left = event;
  store.noteLost(n, h.index, year, read.people, h.since);
  h.holder = null;
  h.how = "own";
  h.since = year;
  h.event = event;
  h.left = { from: n.ref, year, event };
  h.own = { drive: seat.drive?.id ?? null, lanes: seat.lanes };
  if (h.cell !== null && p && realms.of(h.cell)?.ref === p.ref) realms.leave(p, h.cell);
  goDark(ctx, store, h, w, year, event);
  recount(ctx, store, n, year, event);
}

/** A world in need goes to those within answering who can bring it what it lacks: a realm, or a free world of its own that makes it. */
function seekHolder(
  ctx: PopulationContext,
  store: NationStore,
  h: Holding,
  w: FilledWorld,
  seats: Map<string, Seat>,
  year: number,
  t: SimTime,
): void {
  const { world } = ctx,
    filled = filledOf(world)!;
  let best: { n: StarNation | null; to: Holding | null; seat: Seat; answer: number } | null = null;
  for (const n of store.allNations()) {
    if (!n.worlds && !n.realm) continue;
    const seat = seats.get(n.ref) ?? seatOf(ctx, n);
    seats.set(n.ref, seat);
    if (!seat.star || !seat.fleet) continue;
    const a = answerFrom(world, seat, h.star);
    if (a.answer <= seat.hold && (!best || a.answer < best.answer))
      best = { n, to: null, seat, answer: a.answer };
  }
  // (Else the nearest world of its own that makes what it needs, and knows a way.)
  if (!best) {
    let near: { to: Holding; ly: number } | null = null;
    for (const o of store.all()) {
      if (o === h || o.holder || o.dark || !o.own?.drive) continue;
      const ly = lightYears(world, o.star, h.star);
      if (near && ly >= near.ly) continue;
      const ow = filled.get(o.key);
      if (!ow || ow.gone !== undefined) continue;
      if (!makesItsOwn(peopleOn(ctx, ow), poorGround(world, o.star, o.planet))) continue;
      near = { to: o, ly };
    }
    if (near) {
      const ow = filled.get(near.to.key)!,
        drive = STAR_DRIVES.find((d) => d.id === near!.to.own!.drive) ?? null,
        seat: Seat = {
          star: near.to.star as string,
          drive,
          lanes: near.to.own!.lanes,
          fleet: true,
          people: peopleOn(ctx, ow),
          hold: holdYears(ctx.life.adulthood),
        },
        a = answerFrom(world, seat, h.star);
      if (a.answer <= seat.hold) best = { n: null, to: near.to, seat, answer: a.answer };
    }
  }
  if (!best || !(world.rng.real(NATION_DRAW, h.index, t, 1) < JOIN_CHANCE)) return;
  let n = best.n;
  if (!n && best.to) {
    const ow = filled.get(best.to.key)!;
    // A realm of worlds alone, ruled from the world they came to.
    n = store.nation(worldNation(best.to.index)) ?? null;
    if (!n) {
      n = {
        ref: worldNation(best.to.index),
        realm: null,
        name: nameOfWorld(ctx, ow, best.to.index),
        seat: best.to.key,
        founded: year,
        event: null,
        worlds: 0,
        greatest: 0,
        greatestYear: year,
        lostFleet: null,
        lost: [],
        fell: null,
      };
      store.addNation(n);
    }
    best.to.holder = n.ref;
    best.to.how = "own";
  }
  if (!n) return;
  const event = world.events.emit({
    type: NATION_EVENTS.joined.type,
    place: cellRef(0, w.cell ?? w.from),
    subjects: [n.ref, h.star],
    causes: h.dark ? [{ ref: h.dark.event, role: "trigger", weight: 1 }] : [],
    data: {
      realm: n.name,
      star: h.star,
      planet: h.planet,
      answer: Math.round(best.answer),
      people: peopleOn(ctx, w),
      year,
    },
  });
  h.holder = n.ref;
  h.how = "joined";
  h.since = year;
  h.event = event;
  delete h.dark;
  const p = n.realm ? politiesOf(world).get(n.realm) : undefined;
  if (p && h.cell !== null && !politiesOf(world).of(h.cell)) politiesOf(world).join(p, h.cell);
  recount(ctx, store, n, year, event);
}

/** What a world's own people call their realm, in the tongue of the land they came from. */
function nameOfWorld(ctx: PopulationContext, w: FilledWorld, index: number): string {
  const ways = cultureOf(ctx.world).get(w.from);
  return ways
    ? tongueName(ways.tongue, hashString(`${ctx.world.seed.text} nation ${index}`) >>> 0)
    : `New ${w.name}`;
}

/** Worlds of other stars with someone on them, taken into the record: their sender's while it stands. */
function adopt(ctx: PopulationContext, store: NationStore, year: number): void {
  const { world } = ctx,
    filled = filledOf(world)!,
    realms = politiesOf(world),
    known = store.all().length;
  let index = known;
  for (const w of filled.all()) {
    if (!w.star || !w.arrived || store.get(w.key)) continue;
    const p = realms.get(w.realm),
      alive = !!p && p.ended === null,
      other = w.cell !== null ? realms.of(w.cell) : undefined,
      holder = other ?? (alive ? p : undefined),
      h: Holding = {
        key: w.key,
        star: w.star,
        planet: w.planet,
        cell: w.cell,
        index: index++,
        holder: holder?.ref ?? null,
        how: holder ? "sent" : "own",
        since: w.arrives,
        event: null,
      };
    store.add(h);
    if (holder) {
      const n = nationOfRealm(store, holder, year);
      if (w.cell !== null && !other) realms.join(holder, w.cell);
      recount(ctx, store, n, year, w.arrived);
    } else {
      // (Its sender gone before it came: what its people carried is what they sailed with.)
      h.own = { drive: w.drive || null, lanes: w.lanes > 0 };
      goDark(ctx, store, h, w, year, w.arrived);
    }
  }
}

/** The year of realms among the stars. Nothing at all until a world of another star has someone on it. */
export function nationYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = nationsOf(world),
    filled = filledOf(world);
  if (!store || !filled || filled.dormant() || !isProvinceWorld(ctx.generated)) return;
  const year = yearOfMoment(t);
  adopt(ctx, store, year);
  if (store.dormant()) return;
  const seats = new Map<string, Seat>(),
    seat = (n: StarNation) => {
      let s = seats.get(n.ref);
      if (!s) seats.set(n.ref, (s = seatOf(ctx, n)));
      return s;
    },
    realms = politiesOf(world);
  for (const h of store.all()) {
    if ((h.index + year) % READ_EVERY) continue;
    const w = filled.get(h.key);
    if (!w) continue;
    if (w.gone !== undefined) {
      if (h.holder) {
        const n = store.nation(h.holder);
        h.holder = null;
        if (n) recount(ctx, store, n, year, null);
      }
      continue;
    }
    // (A land's realm is its own to lose: a split, a rising, a realm raised there. The stars' record follows it.)
    if (h.cell !== null) {
      const of = realms.of(h.cell);
      if (of && of.ref !== h.holder) {
        const was = h.holder ? store.nation(h.holder) : undefined;
        h.holder = of.ref;
        h.how = "own";
        h.since = year;
        delete h.dark;
        recount(ctx, store, nationOfRealm(store, of, year), year, null);
        if (was) recount(ctx, store, was, year, null);
        continue;
      }
    }
    if (!h.holder) {
      if (h.dark || owesNow(ctx, h, w)) seekHolder(ctx, store, h, w, seats, year, t);
      continue;
    }
    const n = store.nation(h.holder);
    if (!n) continue;
    const s = seat(n),
      read = strainNow(ctx, h, w, n, s, year);
    if (world.rng.real(NATION_DRAW, h.index, t, 0) < breakChance(read.strain.total))
      leave(ctx, store, h, w, n, s, read, year);
  }
  store.trimFallen(MOST_KEPT);
}

const owesNow = (ctx: PopulationContext, h: Holding, w: FilledWorld): boolean => {
  const r = readingOf(ctx, w);
  return !!r && owesOf(r, peopleOn(ctx, w), poorGround(ctx.world, h.star, h.planet));
};

/** What a realm has to go to war for among the stars: a world it sent that went its own way; a world of no one within its answering; a rival's world nearer it than them. */
export function nationCauses(ctx: PopulationContext, p: Polity, year: number): Cause[] {
  const { world } = ctx,
    store = nationsOf(world),
    filled = filledOf(world);
  if (!store || !filled || store.dormant()) return [];
  const seat = seatOfRealm(ctx, p),
    out: { cause: Cause; rank: number }[] = [];
  for (const h of store.all()) {
    if (h.holder === p.ref) continue;
    const w = filled.get(h.key);
    if (!w || w.gone !== undefined) continue;
    const way = answerFrom(world, seat, h.star);
    if (way.answer === Infinity) continue;
    const people = peopleOn(ctx, w),
      mine = h.left?.from === p.ref,
      near = way.answer <= seat.hold;
    let contribution = 0,
      name = "",
      source: Factor["source"] = null;
    if (mine) {
      contribution = 1;
      name = `a world of its own among the stars, gone its own way (${way.ly.toFixed(1)} light-years out, ${Math.round(way.fleet)} years for a fleet)`;
      source = { ref: h.left!.event, role: "trigger", weight: 1 };
    } else if (!h.holder && near) {
      contribution = 0.7;
      name = `a world of no realm within its answering (${way.ly.toFixed(1)} light-years out, ${Math.round(way.fleet)} years for a fleet)`;
      source = { ref: w.arrived!, role: "enabler", weight: 1 };
    } else if (h.holder && near) {
      const them = store.nation(h.holder),
        theirs = them ? answerFrom(world, seatOf(ctx, them), h.star).answer : Infinity;
      if (theirs < way.answer * 2) continue;
      contribution = 0.5;
      name = `a world of ${them?.name ?? "another"} that lies nearer it than them: ${Math.round(way.answer)} years to answer, against ${theirs === Infinity ? "never" : Math.round(theirs)}`;
      source = { ref: w.arrived!, role: "enabler", weight: 1 };
    } else continue;
    out.push({
      rank: contribution * 1000 - way.answer,
      cause: {
        enemy: h.holder ?? worldNation(h.index),
        star: h.star,
        planet: h.planet,
        distance: way.ly,
        key: h.key,
        defence: () => worldDefence(peopleOn(ctx, w)),
        factor: { name, value: way.ly, contribution, source },
        take: (battle) => takeWorld(ctx, store, h, p, battle, year),
      },
    });
  }
  // (The few it would go for first: all it can weigh in a year.)
  return out
    .sort((a, b) => b.rank - a.rank || (a.cause.key! < b.cause.key! ? -1 : 1))
    .slice(0, 3)
    .map((x) => x.cause);
}

/** The cause of a fleet that has come, if its world can still be fought for. */
export function causeOfFleet(
  ctx: PopulationContext,
  p: Polity,
  key: string,
  enemy: Ref,
  year: number,
): Cause | undefined {
  const { world } = ctx,
    store = nationsOf(world),
    h = store?.get(key),
    w = filledOf(world)?.get(key);
  if (!store || !h || !w || w.gone !== undefined || h.holder === p.ref) return undefined;
  return {
    enemy,
    star: h.star,
    planet: h.planet,
    distance: 0,
    key,
    defence: () => worldDefence(peopleOn(ctx, w)),
    factor: { name: "", value: 0, contribution: 0, source: null },
    take: (battle) => takeWorld(ctx, store, h, p, battle, year),
  };
}

/** A realm's fleet has won a world: it is held, whoever held it. */
function takeWorld(
  ctx: PopulationContext,
  store: NationStore,
  h: Holding,
  p: Polity,
  battle: Ref,
  year: number,
): void {
  const { world } = ctx,
    realms = politiesOf(world),
    w = filledOf(world)!.get(h.key)!,
    was = h.holder ? store.nation(h.holder) : undefined,
    people = peopleOn(ctx, w),
    event = world.events.emit({
      type: NATION_EVENTS.taken.type,
      place: cellRef(0, w.cell ?? w.from),
      subjects: [p.ref, h.star],
      causes: [{ ref: battle, role: "trigger", weight: 1 }],
      data: {
        realm: p.town,
        star: h.star,
        planet: h.planet,
        from: was?.name ?? null,
        back: h.left?.from === p.ref,
        people,
        year,
      },
    });
  if (was) store.noteLost(was, h.index, year, people, h.since);
  if (h.cell !== null) {
    const of = realms.of(h.cell);
    if (of && of.ref !== p.ref) realms.leave(of, h.cell);
    if (realms.of(h.cell)?.ref !== p.ref) realms.join(p, h.cell);
  }
  h.holder = p.ref;
  h.how = "taken";
  h.since = year;
  h.event = event;
  delete h.dark;
  recount(ctx, store, nationOfRealm(store, p, year), year, event);
  if (was) recount(ctx, store, was, year, event);
}

/** A realm's fleet lost: every world it holds sees it. */
export function fleetLost(world: World, realm: Ref, year: number): void {
  const n = nationsOf(world)?.nation(realm);
  if (n) n.lostFleet = year;
}

export function installNations(world: World, ctx: () => PopulationContext): NationStore {
  const store = world.register(new NationStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "204.space.nations", every: YEAR, run: (t) => nationYear(ctx(), t) });
  return store;
}
