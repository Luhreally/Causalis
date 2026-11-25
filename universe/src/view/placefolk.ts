// A place's people laid over the town drawn (town mode): where the host's place has each of them, lot by lot and tick
// by tick (bridge/place.ts PlaceFrame), drawn between ticks by the town's own clock. The town's scene and eye are the
// town view's; only where its people stand is the place's. They walk by the town's own streets, as its walkers do
// (view/ground.ts route); and they are drawn larger than the town view's crowd, to be told apart and tapped on a phone.
//
// How they move between the host's words (asked 2026-11-25: "make the walking animation and their movements more fluid").
// The host says only that one is on the way from a lot to another and how many of its ten-minute ticks are left of how
// many; the least walk is a whole tick, and at the pace a day is watched one of them is a second of the watcher's. So
// what is seen between is the view's own, and it is made a body's:
//   - A walk is shown in the time the host gives it, never longer; where that is more than the way takes at one's own
//     easy pace (view/gait.ts: by the leg, by age, by a load, by a wound's share of one's going where the frame says
//     it), one walks at that pace and is there early. Where it is less, one hurries, as fast as the time left asks.
//   - It begins and ends over a stride's time each, the speed rising and falling smoothly; no one sets off or stops at
//     full pace.
//   - No two set off together because a tick began: each one's start is put off by a share of their own (of the slack
//     where a walk has any, else of at most a second of the watcher's, LATE: there is nothing of the body to reckon
//     that second from; it is how long a tick is seen for at the usual pace), so a walk may end that much after the
//     host has them there.
//   - The way is the street's corners; one goes round them over a stride, their heading the way they are going.
//   - The legs turn by the ground covered at the stride's own length for the speed drawn, swing as wide as that step
//     reaches, the hip rides the legs' arc and the body leans into its speeding up (render/folk.ts poses it).
//   - Where the host's word leaves one somewhere else than they are drawn (a walk never seen at an hour a second, a
//     walk cut short), they are carried there as the town's own crowd is (view/presence.ts SMOOTH), or, too far to
//     cross, go out where they stand and come up where they are; going in at a door and coming out are the same going
//     out and coming up, not a switch.
//   - With the clock stopped everyone stays as they stood, mid-stride.
// Nothing here touches the place: it is what is drawn of it.
import {
  PLACE_ACT,
  PLACE_AT,
  placeFieldOf,
  placeSpread,
  placedId,
  streetDoor,
  townLots,
  type PlaceFrame,
  type TownLots,
  type VillagePlan,
} from "../bridge/index.ts";
import { OCC, lifeFigure } from "../rules/index.ts";
import { figureOf } from "./figure.ts";
import { PULL, agePace, easyPace, hipOf, leanOf, legSwing, strideLength } from "./gait.ts";
import { route, villageGround } from "./ground.ts";
import { STRIDES } from "./motion.ts";
import type { PosedHook } from "./possess.ts";
import { BLINK, FAR, SMOOTH, type Presence } from "./presence.ts";
import { ACTIVITY, type Activity, type Moment, type Task } from "./village.ts";

type Point = { x: number; z: number };

/** How many times the town view's size a place's people are drawn. */
export const PLACED_SIZE = 1.7;
/** The town's units to a metre (render/village.ts M): a figure's scale is in them. */
const UNIT = 0.1;
/**
 * The most a walk's start is put off where it has no slack (seconds of the watcher's): a tick as it is seen at the
 * pace a day is usually watched. Not reckoned from the body.
 */
export const LATE = 1;
/** Slower than this (m/s, drawn) one is standing. */
const MOVING = 0.05;
/** The fastest they turn (radians a second: view/presence.ts TURN). */
const TURN = 9;
/**
 * A load against the body that carries it: the host words the one load it weighs as "a third of their own weight at
 * a time" (host/placeplan.ts); a walk's cost goes as the weight moved, so the pace falls by that much.
 */
const LOAD = 1 / 3;
/** How near a wall one walks by its streets (metres), where its ground does not say. */
const REACH = 0.5;
/** Ways kept (each by who walks it, from where, to where). */
const WAYS_MOST = 2000;

const unit = (h: number) => (h >>> 0) / 4294967296;
/** (The scramble the host places them by too: bridge/place.ts.) */
const spread = placeSpread;

/** What each of a place's doings is drawn as (bridge/place.ts PLACE_ACT's order). */
const DOING: readonly Activity[] = [
  ACTIVITY.home,
  ACTIVITY.asleep,
  ACTIVITY.eating,
  ACTIVITY.working,
  ACTIVITY.walking,
  ACTIVITY.walking,
  ACTIVITY.sheltering,
  ACTIVITY.gathering,
  ACTIVITY.resting,
  ACTIVITY.walking,
  ACTIVITY.abed,
  // (Raising a building, and gone for a load of what it is built of.)
  ACTIVITY.working,
  ACTIVITY.walking,
  // (Fighting a fire; standing to arms in the square.)
  ACTIVITY.working,
  ACTIVITY.gathering,
];

type Way = { readonly points: Point[]; readonly lengths: number[]; readonly whole: number };

/** What one is seen doing where they stand, by what the place has them at and their trade (null: standing). */
function taskOf(act: number, at: number, occupation: number): Task | null {
  switch (act) {
    case PLACE_ACT.work:
      if (at === PLACE_AT.fields) return occupation === OCC.herder ? "herd" : "hoe";
      if (occupation === OCC.crafter) return "hammer";
      return occupation === OCC.trader ? "haggle" : "load";
    case PLACE_ACT.build:
      return "build";
    case PLACE_ACT.brigade:
      return "douse";
    case PLACE_ACT.visit:
      return "talk";
    case PLACE_ACT.mourn:
      return "mourn";
    default:
      return null;
  }
}

/**
 * The share of a way gone at the share `u` of its time, begun and ended over a share `r` of that time each (no more
 * than half): the speed rises from nothing and falls to it as a raised cosine, so neither the speed nor its change
 * jumps.
 */
export function wayGone(u: number, r: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (!(r > 0)) return u;
  const top = 1 / (1 - r),
    rise = (x: number) => top * (x / 2 - (r / (2 * Math.PI)) * Math.sin((Math.PI * x) / r));
  if (u < r) return rise(u);
  if (u > 1 - r) return 1 - rise(1 - u);
  return top * (u - r / 2);
}

const toward = (from: number, to: number, most: number): number => {
  let d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  if (d > most) d = most;
  if (d < -most) d = -most;
  return from + d;
};

type Drawn = { moment: Moment; size: number; stride: number };

export class PlaceBodies implements PosedHook {
  readonly downed = new Set<number>();
  /** The plan's people by who they are in the place (null: not of it, one of the plan's own). */
  readonly ids: readonly (number | null)[];
  frame: PlaceFrame | null = null;
  private now = 0;
  private readonly plan: VillagePlan;
  private readonly lotAt: (lot: number) => Point | null;
  private readonly strides: Float64Array;
  private readonly ways = new Map<string, Way>();
  /** Its town's lots as its plan lays them, for where each one's door stands (null: no town drawn lot by lot). */
  private lots: TownLots | null | undefined;

  /** Where its walls' site is now, the length their line has come to (null: none going up). */
  private readonly wallAt: (t: number) => Point | null;

  /** Their world's pull (m/s²); each one's hip as drawn (m; 0: no leg to walk on), legs' own swing and easy pace (m/s). */
  private readonly pull: number;
  private readonly hips: Float64Array;
  private readonly swings: Float64Array;
  private readonly easy: Float64Array;
  /** The share of their own a start is put off by, and of what is left of a walk first seen late. */
  private readonly late: Float64Array;
  private readonly later: Float64Array;
  /** Where each was last drawn (NaN: not yet), facing, how much of them (0 gone ... 1 whole), going out to come up elsewhere. */
  private readonly px: Float64Array;
  private readonly pz: Float64Array;
  private readonly yaws: Float64Array;
  private readonly grown: Float64Array;
  private readonly out: Uint8Array;
  /** How far each is drawn from where their walk or their stand has them (m): carried off over SMOOTH. */
  private readonly ox: Float64Array;
  private readonly oz: Float64Array;
  /** How fast each is drawn going (m/s), and how far they lean (radians). */
  private readonly going: Float64Array;
  private readonly leans: Float64Array;
  /** The stretch each is on: a stand (1) at a lot, or a walk (2) begun at a moment to a lot. */
  private readonly segKind: Uint8Array;
  private readonly segA: Float64Array;
  private readonly segB: Float64Array;
  /** Each one's walk: the tick it was set off on (NaN: none), from and to, shown from and until (the clock's seconds),
   * the share of it a start and a stop take, half the stretch a corner is gone round over (m), and its way. */
  private readonly wT0: Float64Array;
  private readonly wAt: Int32Array;
  private readonly wTo: Int32Array;
  private readonly wStart: Float64Array;
  private readonly wEnd: Float64Array;
  private readonly wRamp: Float64Array;
  private readonly wHalf: Float64Array;
  private readonly wWay: (Way | null)[];
  /** Where each stands at the lot they were last at. */
  private readonly sAt: Int32Array;
  private readonly sx: Float64Array;
  private readonly sz: Float64Array;
  /** Each one as last drawn: with the clock stopped they stay so. */
  private readonly last: (Drawn | undefined)[];
  /** The screen's clock and the town's when last posed (null: not yet), and the town's seconds to one of the screen's. */
  private clockAt: number | null = null;
  private simAt: number | null = null;
  private pace = 0;

  constructor(
    plan: VillagePlan,
    lotAt: (lot: number) => Point | null,
    wallAt: (t: number) => Point | null = () => null,
  ) {
    this.plan = plan;
    this.lotAt = lotAt;
    this.wallAt = wallAt;
    this.ids = plan.people.map((p, i) => {
      const id = plan.placed ? plan.placed[i] : placedId(p.ref);
      return id === undefined || id === null || id < 0 ? null : id;
    });
    const n = plan.people.length,
      f64 = (fill = 0) => new Float64Array(n).fill(fill);
    this.strides = f64();
    this.pull = PULL * (plan.body?.folk?.gravity || 1);
    this.hips = f64();
    this.swings = f64();
    this.easy = f64();
    this.late = f64();
    this.later = f64();
    this.px = f64(Number.NaN);
    this.pz = f64(Number.NaN);
    this.yaws = f64();
    this.grown = f64();
    this.out = new Uint8Array(n);
    this.ox = f64();
    this.oz = f64();
    this.going = f64();
    this.leans = f64();
    this.segKind = new Uint8Array(n);
    this.segA = f64();
    this.segB = f64();
    this.wT0 = f64(Number.NaN);
    this.wAt = new Int32Array(n);
    this.wTo = new Int32Array(n);
    this.wStart = f64();
    this.wEnd = f64();
    this.wRamp = f64();
    this.wHalf = f64();
    this.wWay = plan.people.map(() => null);
    this.sAt = new Int32Array(n).fill(-2147483648);
    this.sx = f64();
    this.sz = f64();
    this.last = plan.people.map(() => undefined);
    // Each one's body as it is drawn: their own people's figure at its height in a town, a child's the less, and
    // as many times that as a place's people are drawn.
    const bodies = new Map<number, { hip: number; swing: number; span: number }>(),
      bodyOf = (kind: number) => {
        let b = bodies.get(kind);
        if (!b) {
          const body =
              (kind ? plan.peoples?.find((o) => o.kind === kind)?.body : undefined) ?? plan.body,
            figure = lifeFigure(figureOf(body, 0), body),
            legs = hipOf(figure);
          b = {
            hip: (legs.hip * figure.scale) / UNIT,
            swing: legs.swing,
            span: body?.span ?? 70,
          };
          bodies.set(kind, b);
        }
        return b;
      };
    plan.people.forEach((p, i) => {
      const b = bodyOf(p.kind ?? 0),
        id = this.ids[i] ?? i;
      this.hips[i] = b.hip * (p.child ? 0.7 : 1) * PLACED_SIZE;
      this.swings[i] = b.swing;
      this.easy[i] = easyPace(this.hips[i]!, this.pull) * agePace(p.age, b.span);
      this.late[i] = unit(spread(id, 11));
      this.later[i] = unit(spread(id, 12));
    });
  }

  /** Those of the plan the place keeps, for asking where they are. */
  get asked(): number[] {
    return this.ids.filter((id): id is number => id !== null);
  }

  at(t: number): number {
    this.now = t;
    return t;
  }

  /** Where one stands at a lot, the square or the fields: about it, each in a spot of their own. */
  spot(i: number, lot: number): Point {
    const plan = this.plan,
      person = plan.people[i]!,
      id = this.ids[i] ?? i,
      a = unit(spread(id, 1)) * 2 * Math.PI;
    if (lot === PLACE_AT.square) {
      const r = 3 + 9 * unit(spread(id, 2));
      return { x: r * Math.cos(a), z: r * Math.sin(a) };
    }
    if (lot === PLACE_AT.walls) {
      // (At the length of its walls the work has come to, on the town's side of it.)
      const w = this.wallAt(this.now);
      if (w) {
        const far = Math.hypot(w.x, w.z) || 1,
          back = 3 + 4 * unit(spread(id, 8)),
          side = (unit(spread(id, 9)) - 0.5) * 14;
        return {
          x: w.x - (w.x / far) * back - (w.z / far) * side,
          z: w.z - (w.z / far) * back + (w.x / far) * side,
        };
      }
    }
    if (lot === PLACE_AT.fields) {
      // (A herder with the flock, anyone else in a field of their own: the one the host reckons their walk to.)
      const f = plan.fields.length ? plan.fields[placeFieldOf(id, plan.fields.length)]! : null;
      if (person.occupation === 3 || !f) {
        const r = plan.pasture.r * 0.8 * Math.sqrt(unit(spread(id, 4)));
        return { x: plan.pasture.x + r * Math.cos(a), z: plan.pasture.z + r * Math.sin(a) };
      }
      const u = (unit(spread(id, 5)) - 0.5) * f.w * 0.8,
        v = (unit(spread(id, 6)) - 0.5) * f.d * 0.8,
        c = Math.cos(f.yaw),
        s = Math.sin(f.yaw);
      return { x: f.x + u * c + v * s, z: f.z - u * s + v * c };
    }
    // (By its door on the street, a step or two off it: a walk is from door to door, as the host reckons it.)
    const door = lot >= 0 ? this.door(lot) : null;
    if (door) {
      const r = 0.6 + 1.6 * unit(spread(id, 7));
      return { x: door.x + r * Math.cos(a), z: door.z + r * Math.sin(a) };
    }
    const home = plan.homes[person.home],
      at = (lot >= 0 ? this.lotAt(lot) : null) ?? home ?? { x: 0, z: 0 },
      // (Before its door, a few steps off its middle.)
      r = 5.5 + 2.5 * unit(spread(id, 7));
    return { x: at.x + r * Math.cos(a), z: at.z + r * Math.sin(a) };
  }

  /** Where a lot's door stands on its street (bridge/streets.ts streetDoor: the very point the host reckons a walk from). */
  private door(lot: number): Point | null {
    if (this.lots === undefined) {
      const town = this.plan.town;
      this.lots = town
        ? townLots(
            town.family,
            town.seed,
            town.axis,
            town.lots,
            town.water,
            town.site ?? null,
            town.lotSize ?? 1,
          )
        : null;
    }
    const lots = this.lots;
    if (!lots || lot >= lots.x.length) return null;
    return streetDoor(
      { x: lots.x[lot]!, z: lots.z[lot]!, yaw: lots.yaw[lot]! },
      0,
      undefined,
      this.plan.town?.lotSize ?? 1,
    );
  }

  /** The way one walks from a lot to another, by the town's streets. */
  private way(i: number, from: number, to: number): Way {
    const key = `${i}|${from}|${to}`;
    let w = this.ways.get(key);
    if (w) return w;
    const a = this.spot(i, from),
      b = this.spot(i, to);
    let points: Point[];
    try {
      const ground = villageGround(this.plan);
      points = route(ground, a, b, ground.reach ?? REACH);
    } catch {
      points = [a, b];
    }
    if (points.length < 2) points = [a, b];
    const lengths: number[] = [];
    let whole = 0;
    for (let k = 0; k + 1 < points.length; k++) {
      const d = Math.hypot(points[k + 1]!.x - points[k]!.x, points[k + 1]!.z - points[k]!.z);
      lengths.push(d);
      whole += d;
    }
    w = { points, lengths, whole };
    if (this.ways.size >= WAYS_MOST) this.ways.clear();
    this.ways.set(key, w);
    return w;
  }

  /** Where one stands at the lot they are at (kept while they are at it: the walls' site moves on with the work). */
  private stand(i: number, lot: number): void {
    if (this.sAt[i] === lot && lot !== PLACE_AT.walls) return;
    const at = this.spot(i, lot);
    this.sAt[i] = lot;
    this.sx[i] = at.x;
    this.sz[i] = at.z;
  }

  /** A walk taken up: when it is shown from and until, how long its start and stop take, how wide its corners. */
  private begin(
    i: number,
    at: number,
    to: number,
    T0: number,
    trip: number,
    tick: number,
    loaded: boolean,
    lame: number,
  ): void {
    const w = this.way(i, at, to),
      t = this.now,
      span = trip * tick,
      // (Its pace not yet seen: a tick taken for a second of the watcher's, as at the usual pace.)
      pace = this.pace > 0 ? this.pace : tick,
      hip = this.hips[i]!,
      pull = this.pull,
      own =
        (this.easy[i]! * (1 - Math.min(0.75, Math.max(0, lame)))) / (loaded ? 1 + LOAD : 1) ||
        // (No leg to walk on: the host's own pace, the way in the time it gives.)
        w.whole / Math.max(1e-6, span / pace),
      whole = span / pace,
      // (At their own pace: the way, and a stride's time to come up to that pace and down from it.)
      beat = hip > 0 ? strideLength(own, hip, pull) / own : 0,
      easy = w.whole / own + beat,
      shown = Math.min(whole, easy),
      off = this.late[i]! * Math.max(whole - shown, Math.min(tick / pace, LATE)),
      first = T0 + off * pace,
      end = first + shown * pace,
      // (First seen after it should have begun: begun now, or a little on, each by a share of their own of the time
      // left, and done by when it would have been.)
      start = first >= t ? first : Math.min(end, t + this.later[i]! * 0.5 * Math.max(0, end - t)),
      left = (end - start) / pace,
      v = left > 0 ? w.whole / left : 0,
      stride = v > 0 && hip > 0 ? strideLength(v, hip, pull) : 0,
      ramp = left > 0 && stride > 0 ? Math.min(0.5, stride / v / left) : 0.5;
    this.wT0[i] = T0;
    this.wAt[i] = at;
    this.wTo[i] = to;
    this.wStart[i] = start;
    this.wEnd[i] = end;
    this.wRamp[i] = ramp;
    // (A corner is gone round over a stride at the pace the walk comes up to.)
    this.wHalf[i] = hip > 0 && v > 0 ? strideLength(v / (1 - ramp), hip, pull) / 2 : 1;
    this.wWay[i] = w;
  }

  pose(
    drawn: { moment: Moment; size: number; stride: number }[],
    presence: Map<string, Presence>,
    clock: number = performance.now() / 1000,
  ): void {
    const f = this.frame;
    if (!f) return;
    const t = this.now,
      first = this.clockAt === null,
      step = first ? 0 : Math.max(0, Math.min(0.1, clock - this.clockAt!)),
      went = this.simAt === null ? 0 : t - this.simAt;
    this.clockAt = clock;
    this.simAt = t;
    // (The pace the town's clock runs at, as it is seen to.)
    if (step > 0 && went > 0) {
      const now = went / step;
      this.pace = this.pace > 0 ? this.pace + (now - this.pace) * Math.min(1, step / 0.5) : now;
    }
    // (Its clock stopped: everyone as they stood.)
    const held = !first && !(went !== 0),
      ease = step > 0 ? 1 - Math.exp(-step / SMOOTH) : 0,
      carried = step > 0 ? Math.exp(-step / SMOOTH) : 1,
      grow = step / BLINK,
      going = (f as { going?: readonly number[] }).going,
      pull = this.pull,
      A = SPOT_A,
      B = SPOT_B,
      C = SPOT_C;
    let k = -1;
    for (let i = 0; i < this.ids.length; i++) {
      if (this.ids[i] === null) continue;
      k++;
      const at = f.at[k],
        to = f.to[k] ?? PLACE_AT.none,
        eta = f.eta[k] ?? 0,
        trip = f.trip[k] ?? 0,
        act = f.act[k] ?? 0,
        own = drawn[i];
      if (at === undefined || !own) continue;
      if (at === PLACE_AT.none && !f.why[k]) {
        // (Gone since the plan was read: not drawn until it is read again.)
        drawn[i] = { moment: { ...own.moment, hidden: true }, size: 0, stride: own.stride };
        this.grown[i] = 0;
        this.last[i] = undefined;
        continue;
      }
      const was = this.last[i],
        p = presence.get(this.plan.people[i]!.ref);
      if (held && was) {
        drawn[i] = was;
        if (p) {
          p.x = was.moment.x;
          p.z = was.moment.z;
          p.yaw = was.moment.yaw;
          p.vx = 0;
          p.vz = 0;
          p.size = was.size;
          p.blinking = false;
          p.stride = was.stride;
        }
        continue;
      }
      // Their walk: taken up when the host first says it, and gone on with until it is done, though the host has them
      // there already (a start put off ends as much later).
      const walking = eta > 0 && trip > 0;
      if (walking) {
        const T0 = f.t - (trip - eta) * f.tick;
        if (this.wT0[i] !== T0 || this.wAt[i] !== at || this.wTo[i] !== to)
          this.begin(i, at, to, T0, trip, f.tick, !!f.carries[k], going?.[k] ?? 0);
      }
      let w = this.wWay[i] ?? null;
      if (w && !walking && (this.wTo[i] !== at || t >= this.wEnd[i]!)) {
        w = this.wWay[i] = null;
        this.wT0[i] = Number.NaN;
      }
      let x: number, z: number, kind: number, a: number, b: number;
      if (w) {
        const from = this.wStart[i]!,
          until = this.wEnd[i]!,
          s = w.whole * wayGone(until > from ? (t - from) / (until - from) : 1, this.wRamp[i]!),
          // (Round a corner over a stride: where they are is taken with a little of the way just behind and just
          // ahead, none of it at the way's ends.)
          half = Math.min(this.wHalf[i]!, s, w.whole - s);
        along(w, s, B);
        if (half > 0) {
          along(w, s - half, A);
          along(w, s + half, C);
          x = (A.x + 2 * B.x + C.x) / 4;
          z = (A.z + 2 * B.z + C.z) / 4;
        } else {
          x = B.x;
          z = B.z;
        }
        kind = 2;
        a = this.wT0[i]!;
        b = this.wTo[i]!;
      } else {
        this.stand(i, at);
        x = this.sx[i]!;
        z = this.sz[i]!;
        kind = 1;
        a = at;
        b = 0;
      }
      // (Asleep, or indoors getting warm: within, once they are there.)
      const within =
        !w && (act === PLACE_ACT.sleep || act === PLACE_ACT.warm || act === PLACE_ACT.abed);
      let size = this.grown[i]!,
        lx = this.px[i]!,
        lz = this.pz[i]!;
      if (Number.isNaN(lx) || (size <= 0 && !this.out[i])) {
        // (Not drawn till now, or come out of a door: where they are, as they are.)
        lx = x;
        lz = z;
        this.ox[i] = this.oz[i] = 0;
        this.going[i] = this.leans[i] = 0;
        if (Number.isNaN(this.px[i]!)) {
          this.yaws[i] = own.moment.yaw;
          // (The first of them seen are there already: no one comes up out of the ground as the town is entered.)
          if (first && !within) size = 1;
        }
      } else if (kind !== this.segKind[i] || a !== this.segA[i] || b !== this.segB[i]) {
        // (On to another stretch: carried from where they are drawn to where it has them; too far to cross, gone
        // out where they stand to come up where they are.)
        this.ox[i] = lx - x;
        this.oz[i] = lz - z;
        if (Math.hypot(this.ox[i]!, this.oz[i]!) > FAR && size > 0) this.out[i] = 1;
      }
      this.segKind[i] = kind;
      this.segA[i] = a;
      this.segB[i] = b;
      let nx: number, nz: number;
      if (this.out[i]) {
        size = Math.max(0, size - grow);
        nx = lx;
        nz = lz;
        if (size <= 0) {
          this.out[i] = 0;
          this.ox[i] = this.oz[i] = 0;
          nx = x;
          nz = z;
          lx = x;
          lz = z;
        }
      } else {
        size = within ? Math.max(0, size - grow) : Math.min(1, size + grow);
        this.ox[i]! *= carried;
        this.oz[i]! *= carried;
        nx = x + this.ox[i]!;
        nz = z + this.oz[i]!;
      }
      // Their body's walk, by the ground they are drawn to cover: how fast, the stride's turn, how wide, the lean.
      const dx = nx - lx,
        dz = nz - lz,
        far = Math.hypot(dx, dz),
        hip = this.hips[i]!,
        before = this.going[i]!,
        fast = step > 0 ? before + (far / step - before) * ease : before,
        moving = fast > MOVING,
        long = moving && hip > 0 ? strideLength(fast, hip, pull) : 0;
      let yaw = this.yaws[i]!;
      if (step > 0) {
        this.going[i] = fast;
        this.leans[i]! +=
          ((moving ? leanOf((fast - before) / step, pull) : 0) - this.leans[i]!) * ease;
        if (far > MOVING * step) yaw = toward(yaw, Math.atan2(dx, dz), TURN * step);
        if (long > 0) this.strides[i]! += far / long / STRIDES;
        else if (moving) this.strides[i]! += step;
      }
      this.px[i] = nx;
      this.pz[i] = nz;
      this.yaws[i] = yaw;
      this.grown[i] = size;
      const hidden = size <= 0,
        moment: Moment = {
          x: nx,
          z: nz,
          yaw,
          activity: moving || w ? ACTIVITY.walking : (DOING[act] ?? ACTIVITY.home),
          task: moving || w ? null : taskOf(act, at, this.plan.people[i]!.occupation),
          hidden,
          hunger: f.hunger[k] ?? 0,
          tiredness: f.tired[k] ?? 0,
          carry: f.carries[k] ? "sack" : null,
          why: f.why[k] ?? null,
          ...(hip > 0
            ? {
                reach: moving ? legSwing(fast, hip, pull) / this.swings[i]! : 0,
                lean: this.leans[i]!,
              }
            : {}),
        },
        now = { moment, size: size * PLACED_SIZE, stride: this.strides[i]! };
      drawn[i] = now;
      this.last[i] = now;
      if (p) {
        p.x = nx;
        p.z = nz;
        p.yaw = yaw;
        p.vx = 0;
        p.vz = 0;
        p.size = size * PLACED_SIZE;
        p.blinking = false;
        p.stride = this.strides[i]!;
      }
    }
  }
}

const SPOT_A: Point = { x: 0, z: 0 },
  SPOT_B: Point = { x: 0, z: 0 },
  SPOT_C: Point = { x: 0, z: 0 };

/** Where a way has one who has gone `s` metres of it. */
function along(w: Way, s: number, out: Point): void {
  let left = Math.max(0, Math.min(w.whole, s)),
    leg = 0;
  while (leg + 1 < w.lengths.length && left > w.lengths[leg]!) left -= w.lengths[leg++]!;
  const a = w.points[leg]!,
    b = w.points[leg + 1]!,
    share = w.lengths[leg]! > 0 ? Math.min(1, left / w.lengths[leg]!) : 1;
  out.x = a.x + (b.x - a.x) * share;
  out.z = a.z + (b.z - a.z) * share;
}
