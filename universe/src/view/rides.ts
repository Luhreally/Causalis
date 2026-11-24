// Getting to work (R1, classic 122 and 155): who of a town's people keeps something to go in, who rides a line, and where each of those is at a moment of the
// day. No one is given a new day: a person's day already walks them to work and home, and a car goes the way they walk, when they walk it, wherever the
// walk is too long for feet. What a household keeps stands at their door by night, in the street of a morning, and by where they work by day. A line goes
// its way through the town with those of its riders on their way aboard. All of it reads off the plan: `about` says what this people can go in, read off
// what they are. Pure, but for what it keeps while the plan stands.
import { hashString } from "../kernel/index.ts";
import type { VillagePlan } from "../bridge/index.ts";
import { clearAt, keepOut, route, type Ground } from "./ground.ts";
import { streetDoor } from "./streets.ts";
import { goingsOn } from "./townlife.ts";
import {
  ACTIVITY,
  longWalks,
  tellRides,
  villageSolids,
  oldOfPerson,
  type LongWalk,
  type Moment,
} from "./village.ts";

type Point = { readonly x: number; readonly z: number };

/** A walk shorter than this is walked, whatever they keep (metres). */
export const LONG_WALK = 130;
/** Of a hundred grown who keep nothing of their own, how many ride (host/inspect/road.ts reads the same). */
export const RIDES_IN_100 = 60;
/** The most a line's vehicle shows aboard. */
export const MOST_ABOARD = 12;
/** `about.share` is of homes, and a car goes person by person: a home has more than one who goes to work, so about as many cars come of this much of it. */
const ONE_FOR_A_HOME = 0.65;
/** How far from the door's way a car stands, into the street (metres). */
const KERB = 2.2;
/** A car's reach, as the solids read it (metres). */
export const CAR_REACH = 1.4;
/**
 * How far a car left standing keeps its middle off what stands (metres): half its length and a little, so that turned any way it
 * stands clear of a block's edge and what stands at its corners (view/networks.ts).
 */
const CAR_PARK = 2.6;
/**
 * How far a car is left from where a block's street pieces stand (metres): its half length and breadth (render/towntraffic.ts CAR,
 * 6.3 by 2.85), and how far a piece reaches from its spot on the block's edge (its half breadth, its depth off the block).
 */
const PIECE_CLEAR = 4;
/** And a line's car's turns (COACH, 15 by 3.75): its half length and breadth, and theirs. */
const LINE_PIECE = 8.2;
/** How far a line's way keeps off the blocks (metres): its car's half breadth, a corner piece's reach off the block, a little more. */
const LINE_REACH = 2.5;
/** The reaches a town's rides are routed by: its lines' cars, and its own (Streets ways made ahead for them, render/village.ts). */
export const RIDES_REACHES: readonly number[] = [LINE_REACH, CAR_REACH];

/** A town's own who go in something: its owners (by person, their home), its riders. */
export type Rides = {
  readonly owners: ReadonlyMap<number, Owner>;
  readonly riders: ReadonlySet<number>;
  readonly lines: readonly BusLine[];
};
export type Owner = {
  readonly index: number;
  readonly home: number;
  /** Which colour. */
  readonly tone: number;
  /** Its place at their door. */
  readonly door: Point;
  readonly doorYaw: number;
};
/** A line through the town: its way out and back. */
export type BusLine = { readonly n: number; readonly way: readonly Point[]; readonly long: number };

const unit = (s: string) => (hashString(s) >>> 0) / 4294967296;

const KEPT = new WeakMap<VillagePlan, Rides>();

/** Whether a person of the plan is grown and goes to work. */
function goesToWork(plan: VillagePlan, p: VillagePlan["people"][number]): boolean {
  return !p.child && !oldOfPerson(plan, p) && !p.figure;
}

/** A spot of the street clear of a town's solids, near a point. */
export function parkNear(ground: Ground, p: Point): Point {
  const q = { x: p.x, z: p.z };
  keepOut(ground, q, CAR_PARK);
  // (Nor where a block's hydrant and its box stand: a car's half length and theirs.)
  if (ground.town) {
    ground.town.offPieces(q, PIECE_CLEAR);
    keepOut(ground, q, CAR_PARK);
  }
  return q;
}

/**
 * A line's way between two points: kept a line's car's half breadth and a corner piece's reach off the blocks where its streets are
 * wide enough (LINE_REACH), else as near as a car keeps.
 */
function lineRoute(ground: Ground, a: Point, b: Point): Point[] {
  const wide = route(ground, a, b, LINE_REACH);
  for (let k = 0; k + 1 < wide.length; k++)
    if (ground.town && !ground.town.clear(wide[k]!, wide[k + 1]!, LINE_REACH))
      return route(ground, a, b, CAR_REACH);
  return wide;
}

/** What a town's people keep and ride, read off its plan. */
export function ridesOf(plan: VillagePlan): Rides {
  const had = KEPT.get(plan);
  if (had) return had;
  const run = ridesSteps(plan);
  for (;;) {
    const step = run.next();
    if (step.done) return step.value;
  }
}

/**
 * ridesOf() worked out a way at a time, between which it may be put off (render/village.ts prepare: a great city's lines are
 * a tenth of a second of finding ways on a phone); kept as ridesOf's, the same.
 */
export function* ridesSteps(plan: VillagePlan): Generator<void, Rides, void> {
  const had = KEPT.get(plan);
  if (had) return had;
  const about = plan.about,
    owners = new Map<number, Owner>(),
    riders = new Set<number>(),
    lines: BusLine[] = [];
  if (about && plan.town && (about.own || about.line)) {
    const ground = villageSolids(plan),
      atDoor = new Map<number, number>();
    if (about.own)
      plan.people.forEach((p, i) => {
        const home = plan.homes[p.home];
        if (!home || !goesToWork(plan, p)) return;
        // (Read off the one person and no one else: the plan is read again each year, and for a life begun, with more of their kin in it or fewer, and no car may change hands for that.)
        if (unit(`${plan.ref}|car|${p.ref}`) >= about.share * ONE_FOR_A_HOME) return;
        const k = atDoor.get(p.home) ?? 0;
        atDoor.set(p.home, k + 1);
        // (A second at one door stands along the street from the first.)
        const out = streetDoor(home, 0, undefined, plan.town?.lotSize),
          s = Math.sin(home.yaw),
          c = Math.cos(home.yaw),
          door = parkNear(ground, {
            x: out.x - s * KERB + c * k * PARKED_APART,
            z: out.z - c * KERB - s * k * PARKED_APART,
          });
        owners.set(i, {
          index: i,
          home: p.home,
          tone: Math.floor(unit(`${plan.ref}|tone|${p.ref}`) * 6),
          door,
          doorYaw: home.yaw + Math.PI / 2,
        });
      });
    if (about.line) {
      plan.people.forEach((p, i) => {
        if (!goesToWork(plan, p) || owners.has(i)) return;
        if ((hashString(p.ref) >>> 0) % 100 < RIDES_IN_100) riders.add(i);
      });
      const count = Math.min(3, 1 + Math.floor(plan.town.whole / 1800));
      for (let n = 0; n < count; n++) {
        const a = Math.atan2(plan.road.z, plan.road.x) + (n * Math.PI) / count,
          r = Math.max(120, Math.hypot(plan.road.x, plan.road.z) * 0.9),
          ends = [
            { x: Math.cos(a) * r, z: Math.sin(a) * r },
            { x: 0, z: 0 },
            { x: -Math.cos(a) * r, z: -Math.sin(a) * r },
          ].map((e) => parkNear(ground, e)),
          there = lineRoute(ground, ends[0]!, ends[1]!);
        yield;
        const on = lineRoute(ground, ends[1]!, ends[2]!),
          // (Its turns taken wide of where a block's hydrant and its box stand: a line's car is long.)
          way = [...there, ...on.slice(1)].map((p) => {
            if (!ground.town) return p;
            const q = { x: p.x, z: p.z };
            ground.town.offPieces(q, LINE_PIECE);
            // (Where the street is too narrow to swing wide, as it went.)
            return clearAt(ground, q, CAR_REACH) ? q : p;
          });
        let long = 0;
        for (let k = 0; k + 1 < way.length; k++)
          long += Math.hypot(way[k + 1]!.x - way[k]!.x, way[k + 1]!.z - way[k]!.z);
        if (long > 60) lines.push({ n, way, long });
        yield;
      }
    }
  }
  const made = { owners, riders, lines };
  KEPT.set(plan, made);
  return made;
}

/** Where a car is at a moment, as its owner's day has it. `riding`: on the way with them in it. */
export type CarNow = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly riding: boolean;
};

/** A car's day: its owner's long walks, and where it stands after each, each car its own place. */
type CarDay = {
  readonly walks: readonly LongWalk[];
  readonly spots: readonly { readonly x: number; readonly z: number; readonly yaw: number }[];
};
const CAR_DAYS = new WeakMap<VillagePlan, { day: number; cars: Map<number, CarDay> }>();
/** How far apart cars are parked about one place (metres: a car's breadth and a door's); and the cells a place is known by. */
const PARKED_APART = 4.4;
const PARK_CELL = 16;

/** How far from where people stand together a car is left (metres). */
const MEET_CLEAR = 7;
/** A place to leave a car, moved out from any place people stand together that day to MEET_CLEAR from its middle. */
function clearOfGoings(p: Point, meets: readonly Point[]): Point {
  for (const m of meets) {
    const dx = p.x - m.x,
      dz = p.z - m.z,
      d = Math.hypot(dx, dz);
    if (d >= MEET_CLEAR) continue;
    // (Out the way it already lay from them; straight along x where it lay on them.)
    const k = d > 0.01 ? MEET_CLEAR / d : 0;
    return k ? { x: m.x + dx * k, z: m.z + dz * k } : { x: m.x + MEET_CLEAR, z: m.z };
  }
  return p;
}

/** Where all a town's cars stand through a day: about where their owners stop, no two in one place. */
function carDays(plan: VillagePlan, day: number): Map<number, CarDay> {
  const had = CAR_DAYS.get(plan);
  if (had?.day === day) return had.cars;
  const ground = villageSolids(plan),
    taken = new Map<number, number>(),
    cars = new Map<number, CarDay>();
  // (Where people stand together that day, a meeting, a corner kept, bread given: no car is left among them.)
  const meets = goingsOn(plan, day, ground).map((g) => g.at);
  for (const o of ridesOf(plan).owners.values()) {
    const walks = longWalks(plan, o.index, day, LONG_WALK),
      home = plan.homes[o.home]!;
    cars.set(o.index, {
      walks,
      spots: walks.map((w) => {
        // (Home again: at their door, not where the walk ended by it.)
        if (Math.hypot(w.end.x - home.x, w.end.z - home.z) < 24)
          return { x: o.door.x, z: o.door.z, yaw: o.doorYaw };
        const key = Math.round(w.end.x / PARK_CELL) * 65536 + Math.round(w.end.z / PARK_CELL),
          k = taken.get(key) ?? 0;
        taken.set(key, k + 1);
        // (Out about the place in a widening turn: each the same way apart.)
        const a = k * 2.399963,
          r = PARKED_APART * (0.6 + Math.sqrt(k)),
          q = parkNear(
            ground,
            clearOfGoings({ x: w.end.x + Math.cos(a) * r, z: w.end.z + Math.sin(a) * r }, meets),
          );
        return { x: q.x, z: q.z, yaw: Math.atan2(w.end.x - w.start.x, w.end.z - w.start.z) };
      }),
    });
  }
  CAR_DAYS.set(plan, { day, cars });
  return cars;
}

/** Where a town's cars stand through the day of `t`, worked out ahead and kept (render/village.ts prepare). */
export function carsAhead(plan: VillagePlan, t: number): void {
  carDays(plan, Math.floor(t / 86_400));
}

/** Where each owner's car stands or goes at t, given where their day has them. */
export function carNow(plan: VillagePlan, o: Owner, t: number, fine: boolean): CarNow {
  const day = Math.floor(t / 86_400),
    s = t - day * 86_400,
    car = fine ? carDays(plan, day).get(o.index) : undefined;
  let at = { x: o.door.x, z: o.door.z, yaw: o.doorYaw };
  if (car)
    for (let k = 0; k < car.walks.length; k++) {
      const w = car.walks[k]!;
      if (s < w.from) break;
      if (s < w.to) return { x: 0, z: 0, yaw: 0, riding: true };
      at = car.spots[k]!;
    }
  return { x: at.x, z: at.z, yaw: at.yaw, riding: false };
}

/** Whether a rider of the plan is on their way on a line at t. */
export function aboardNow(plan: VillagePlan, index: number, t: number, fine: boolean): boolean {
  if (!fine) return false;
  const day = Math.floor(t / 86_400),
    s = t - day * 86_400;
  return longWalks(plan, index, day, LONG_WALK).some((w) => s >= w.from && s < w.to);
}

// (A person's day says so.)
tellRides((plan, index) => {
  const rides = ridesOf(plan);
  if (rides.owners.has(index)) return `their ${plan.about?.own ?? "car"}`;
  if (rides.riders.has(index) && rides.lines.length) return `the ${plan.about?.line ?? "bus"}`;
  return null;
});

/** How one goes who is on a long walk at t: what they ride, in a word, or null: on foot. */
export function goesIn(plan: VillagePlan, index: number, t: number, fine: boolean): string | null {
  const rides = ridesOf(plan);
  if (!aboardNow(plan, index, t, fine)) return null;
  if (rides.owners.has(index)) return plan.about?.own ?? null;
  if (rides.riders.has(index) && rides.lines.length) return plan.about?.line ?? null;
  return null;
}

/** Those on their way hidden in what they ride, and told so: a person's moment as the town has it. */
export function rideMoments(plan: VillagePlan, moments: Moment[], t: number, fine: boolean): void {
  const rides = ridesOf(plan);
  if (!fine || (!rides.owners.size && !rides.riders.size)) return;
  const each = (i: number, word: string) => {
    const m = moments[i];
    if (!m || m.activity !== ACTIVITY.walking || m.hidden) return;
    if (!aboardNow(plan, i, t, fine)) return;
    m.hidden = true;
    m.why = `${word}${m.why ? `: ${m.why[0]!.toLowerCase()}${m.why.slice(1)}` : ""}`;
  };
  const own = plan.about?.own ?? null,
    line = plan.about?.line ?? null;
  if (own) for (const i of rides.owners.keys()) each(i, `Going by ${own}`);
  if (line && rides.lines.length) for (const i of rides.riders) each(i, `On the ${line}`);
}

/** How a person gets to work, in a sentence for their card (null: nothing to say). */
export function goesWords(plan: VillagePlan, index: number, day: number): string | null {
  const about = plan.about;
  if (!about) return null;
  const rides = ridesOf(plan),
    far = longWalks(plan, index, day, LONG_WALK).length > 0,
    p = plan.people[index];
  if (!p || p.child) return null;
  if (rides.owners.has(index))
    return far
      ? `Their household keeps a ${about.own}, ${about.drive}: it stands at their door by night, and they go to work in it.`
      : `Their household keeps a ${about.own}, ${about.drive}, though their work is near enough to walk to.`;
  if (rides.riders.has(index) && rides.lines.length)
    return far ? `They ride the ${about.line} to work, with others of the town.` : null;
  if (about.how === "mount" && about.mount)
    return `They walk to their work. For the far trips there is the ${about.mount}'s back.`;
  if (about.how === "swim")
    return "They swim where they go, and their ways through the water are their own.";
  return null;
}

/** Whether a spot is clear for a car (the tally's check: never through a wall). */
export function carClear(plan: VillagePlan, p: Point): boolean {
  return clearAt(villageSolids(plan), p, 0.6);
}
