// A life lived by the god's hand, as the view draws it (Lives L3): the one lived where their chosen block has
// them, those of their house about them at their door, and everywhere else the town as its day has it. When
// nothing is chosen they go by their own day (view/village.ts dayOf), which knows every trade, age and world.
// A walk from where they stand to where the block is, or back into their own day, is drawn so they never jump.
// Pure but for what it remembers of the walk: watching changes nothing.
import type { LifeNow, VillagePlan } from "../bridge/index.ts";
import {
  ACTIVITY,
  TOWN_WELL,
  drillGround,
  momentOf,
  villageSolids,
  type Moment,
  type Task,
} from "./village.ts";
import { civicDoors } from "./errands.ts";
import { marketScene } from "./feast.ts";
import { paceOf } from "./figure.ts";
import { route } from "./ground.ts";
import { goesIn } from "./rides.ts";
import { agentOf, type PosedHook } from "./possess.ts";
import type { Presence } from "./presence.ts";

const DAY = 86_400,
  HOUR = 3600,
  MINUTE = 60,
  REACH = 1.2;

type Point = { readonly x: number; readonly z: number };
/** Where a block is spent, and what is seen there. */
type Spot = Point & {
  readonly task: Task | null;
  readonly activity: number;
  readonly hidden: boolean;
  readonly words: string;
};

/** Where one stands at their door (their own day at its first moment has them there). */
function doorOf(plan: VillagePlan, index: number, t: number): Point {
  const m = momentOf(plan, index, Math.floor(t / DAY) * DAY + 1);
  // (A day away begins away: their door is at their home for all that.)
  const home = m.activity === ACTIVITY.away ? plan.homes[plan.people[index]!.home] : null;
  return home ? { x: home.x, z: home.z } : { x: m.x, z: m.z };
}

/** A place in the square for one (rings about its middle, by who they are). */
function squareSpot(id: number): Point {
  const a = ((id * 2654435761) >>> 0) / 4294967296;
  return {
    x: TOWN_WELL.x + 8 * Math.cos(a * 2 * Math.PI),
    z: TOWN_WELL.z + 8 * Math.sin(a * 2 * Math.PI),
  };
}

/** The door of a building of the town, if it stands. */
function civicAt(plan: VillagePlan, kind: string, t: number): Point | null {
  const doors = civicDoors(plan, t) as ReadonlyMap<string, readonly Point[]>;
  return doors.get(kind)?.[0] ?? null;
}

/** Where the block is spent, by what it is. Null: their own day has them (their work). */
export function spotOf(
  plan: VillagePlan,
  index: number,
  doing: NonNullable<LifeNow["doing"]>,
  t: number,
  targetAt: Point | null,
): Spot | null {
  const id = agentOf(plan.people[index]!) ?? index,
    door = doorOf(plan, index, t),
    at = (p: Point, task: Task | null, activity: number, words: string, hidden = false): Spot => ({
      x: p.x,
      z: p.z,
      task,
      activity,
      hidden,
      words,
    }),
    beside = (p: Point): Point => ({ x: p.x + 1.2, z: p.z + 0.6 });
  switch (doing.what) {
    case "work":
      return plan.people[index]!.figure
        ? at(civicAt(plan, "hall", t) ?? squareSpot(id), "talk", ACTIVITY.working, "Holding court")
        : null;
    case "eat":
      return at(door, null, ACTIVITY.eating, "At bread with their own");
    case "sleep":
      return at(door, null, ACTIVITY.asleep, "Asleep", true);
    case "rest":
      return at(door, null, ACTIVITY.resting, "Sitting a while");
    case "family":
      return at(door, "talk", ACTIVITY.home, "With their own");
    case "square":
      return at(squareSpot(id), "talk", ACTIVITY.gathering, "Seen in the square");
    case "market": {
      const f = marketScene(plan).fronts;
      return at(
        (f.length ? f[id % f.length] : null) ?? squareSpot(id),
        "haggle",
        ACTIVITY.working,
        "At the market",
      );
    }
    case "pray":
      return at(
        civicAt(plan, "temple", t) ?? civicAt(plan, "shrine", t) ?? squareSpot(id),
        "pray",
        ACTIVITY.gathering,
        "At prayer",
      );
    case "teach":
      return at(
        targetAt ? beside(targetAt) : door,
        "talk",
        ACTIVITY.working,
        "Teaching their child",
      );
    case "court":
      return at(
        targetAt ? beside(targetAt) : squareSpot(id),
        "talk",
        ACTIVITY.gathering,
        "Courting",
      );
    case "face":
      return at(
        targetAt ? beside(targetAt) : squareSpot(id),
        "brawl",
        ACTIVITY.gathering,
        "Having it out",
      );
    case "play":
      return at(squareSpot(id), "play", ACTIVITY.playing, "At play");
    case "learn":
      return at(civicAt(plan, "school", t) ?? door, "learn", ACTIVITY.working, "At their learning");
    case "drill":
      return at(drillGround(plan), "drill", ACTIVITY.gathering, "At the drill");
    default:
      return null;
  }
}

/** How fast the clock runs (sim seconds a real second) for what the one lived is at: walks are seen, nights go by. */
/** A ruler's pace (Lives L4; world seconds a second): a month in five seconds, or a month a second. */
export function ruledSpeed(fast: boolean): number {
  return fast ? 30 * DAY : 6 * DAY;
}

export function livedSpeed(walking: boolean, asleep: boolean, fast: boolean): number {
  if (walking) return MINUTE;
  if (asleep) return 3 * HOUR;
  return fast ? 36 * MINUTE : 12 * MINUTE;
}

/** The town's people as a life has them, over the day the town would give them (render/village.ts). */
export class LivedBody implements PosedHook {
  readonly downed = new Set<number>();
  private now = 0;
  private readonly plan: VillagePlan;
  readonly index: number;
  private readonly pace: number;
  private readonly places = new Map<number, number>();
  /** What the body last did on screen: where it is, so a new block walks from there. */
  private here: Point | null = null;
  private yaw = 0;
  private walk: { way: Point[]; from: number; to: number; key: string } | null = null;
  private block: LifeNow["doing"] = null;
  private spot: Spot | null = null;
  private home: readonly number[] = [];
  private stride = 0;
  private strideAt = 0;

  constructor(plan: VillagePlan, index: number, from?: Point) {
    this.plan = plan;
    this.index = index;
    this.pace = Math.max(0.6, paceOf(plan.body));
    this.here = from ?? null;
    plan.people.forEach((p, i) => {
      const id = agentOf(p);
      if (id !== null) this.places.set(id, i);
    });
  }

  /** Who is lived, by their place in the plan: the town draws a line's coach about them when they are aboard. */
  get lived(): number {
    return this.index;
  }

  /** Whether they are walking now, or riding to their work on their own day (so the clock slows to show it). */
  get walking(): boolean {
    return (!!this.walk && this.now < this.walk.to) || this.riding;
  }
  /** Whether what they keep or a line has them now, on their own day's way to work (R1). */
  get riding(): boolean {
    const walkingBack = !!this.walk && this.now < this.walk.to;
    return !this.spot && !walkingBack && goesIn(this.plan, this.index, this.now, true) !== null;
  }
  /** Whether the block now is the night's. */
  get asleep(): boolean {
    return this.block?.what === "sleep" && !this.walking;
  }
  /** Where they are drawn, in metres (null: not yet drawn). */
  get where(): Point | null {
    return this.here;
  }
  get facing(): number {
    return this.yaw;
  }
  /** Whom they eat with or sit with at their door. */
  set household(ids: readonly number[]) {
    this.home = ids;
  }

  /** The block chosen, as the host has it (null: their own day). */
  set doing(d: LifeNow["doing"]) {
    const was = this.block;
    if (d === was || (d && was && d.what === was.what && d.from === was.from)) return;
    this.block = d;
    this.spot = null;
    this.walk = null;
  }

  at(t: number): number {
    this.now = t;
    return t;
  }

  private targetAt(t: number): Point | null {
    const id = this.block?.target ?? -1,
      i = id >= 0 ? this.places.get(id) : undefined;
    if (i === undefined) return null;
    const m = momentOf(this.plan, i, t);
    return { x: m.x, z: m.z };
  }

  /** A walk from where they are to `to`, if they are not there. */
  private walkTo(to: Point, key: string, t: number): void {
    if (this.walk?.key === key) return;
    const from = this.here ?? to;
    if (Math.hypot(from.x - to.x, from.z - to.z) < 1) return;
    const way = route(villageSolids(this.plan), from, to, REACH);
    let long = 0;
    for (let k = 0; k + 1 < way.length; k++)
      long += Math.hypot(way[k + 1]!.x - way[k]!.x, way[k + 1]!.z - way[k]!.z);
    this.walk = { way, from: t, to: t + long / this.pace, key };
  }

  /** Where the walk has them at t. */
  private walked(t: number): { x: number; z: number; yaw: number } | null {
    const w = this.walk;
    if (!w || t >= w.to) return null;
    const speed = this.pace;
    let left = (t - w.from) * speed;
    for (let k = 0; k + 1 < w.way.length; k++) {
      const a = w.way[k]!,
        b = w.way[k + 1]!,
        len = Math.hypot(b.x - a.x, b.z - a.z);
      if (left <= len && len > 0)
        return {
          x: a.x + ((b.x - a.x) * left) / len,
          z: a.z + ((b.z - a.z) * left) / len,
          yaw: Math.atan2(b.x - a.x, b.z - a.z),
        };
      left -= len;
    }
    return null;
  }

  /** The moment they are drawn at t (null: their own day, as the town draws it). */
  private momentAt(t: number): Moment | null {
    const block = this.block && t < this.block.to ? this.block : null,
      figure = !!this.plan.people[this.index]?.figure,
      s = t - Math.floor(t / DAY) * DAY,
      // (A ruler's own day: at their hall through the working hours, not at their door.)
      own = !block && figure && s >= 8 * HOUR && s < 17 * HOUR,
      use = block ?? (own ? { what: "work", from: t, to: t + 1, target: -1 } : null);
    if (use && !this.spot) this.spot = spotOf(this.plan, this.index, use, t, this.targetAt(t));
    const spot = use ? this.spot : null;
    let to: Point;
    if (spot) {
      to = spot;
      this.walkTo(to, `${use!.what}:${use!.from}`, t);
    } else {
      // Their own day: walked back into it, then it has them.
      this.spot = null;
      const m = momentOf(this.plan, this.index, t);
      // (The town's day sends some off down the road by lot: one lived goes only where they choose.)
      if (m.activity === ACTIVITY.away) {
        const door = doorOf(this.plan, this.index, t);
        this.walkTo(door, "home", t);
        const w = this.walked(t);
        if (w)
          return {
            ...w,
            activity: ACTIVITY.walking,
            task: null,
            hidden: false,
            hunger: 0,
            tiredness: 0,
            carry: null,
            why: "Back to their door",
          };
        this.walk = null;
        return {
          x: door.x,
          z: door.z,
          yaw: this.yaw,
          activity: ACTIVITY.home,
          task: null,
          hidden: false,
          hunger: 0,
          tiredness: 0,
          carry: null,
          why: "At home",
        };
      }
      if (!this.walk || t >= this.walk.to) {
        const far = this.here ? Math.hypot(this.here.x - m.x, this.here.z - m.z) : 0;
        if (far < 6 || this.block === null) {
          if (far >= 6 && this.walk === null) this.walkTo(m, `own:${Math.floor(t / 300)}`, t);
          else return null;
        }
      }
      to = m;
    }
    const w = this.walked(t);
    if (w)
      return {
        ...w,
        activity: ACTIVITY.walking,
        task: null,
        hidden: false,
        hunger: 0,
        tiredness: 0,
        carry: null,
        why: spot ? `On the way: ${spot.words.toLowerCase()}` : "Back to their day",
      };
    if (!spot) return null;
    this.walk = null;
    return {
      x: to.x,
      z: to.z,
      yaw: this.yaw,
      activity: spot.activity as Moment["activity"],
      task: spot.task,
      hidden: spot.hidden,
      hunger: 0,
      tiredness: 0,
      carry: null,
      why: spot.words,
    };
  }

  pose(
    drawn: { moment: Moment; size: number; stride: number }[],
    presence: Map<string, Presence>,
  ): void {
    const i = this.index,
      t = this.now,
      own = drawn[i];
    if (!own) return;
    const m = this.momentAt(t),
      dt = Math.max(0, Math.min(0.25, (t - this.strideAt) / 60));
    this.strideAt = t;
    if (m) {
      this.stride += dt;
      drawn[i] = { moment: m, size: m.hidden ? 0 : 1, stride: this.stride };
      const p = presence.get(this.plan.people[i]!.ref);
      if (p) {
        p.x = m.x;
        p.z = m.z;
        p.yaw = m.yaw;
        p.vx = 0;
        p.vz = 0;
        p.size = m.hidden ? 0 : 1;
        p.blinking = false;
        p.stride = this.stride;
      }
      this.here = { x: m.x, z: m.z };
      this.yaw = m.yaw;
    } else {
      // (Hidden in what they ride: where it has them, not where they got in, so the eye goes along.)
      const goes = this.riding ? momentOf(this.plan, i, t) : own.moment;
      this.here = { x: goes.x, z: goes.z };
      this.yaw = goes.yaw;
    }
    // Those of their house about them at their door, while they eat or sit with them.
    const what = this.block?.what;
    if ((what === "eat" || what === "family") && !this.walking && this.here) {
      this.home.forEach((id, k) => {
        const j = this.places.get(id);
        if (j === undefined || j === i || !drawn[j]) return;
        const a = (k / Math.max(1, this.home.length)) * 2 * Math.PI,
          x = this.here!.x + 1.4 * Math.cos(a),
          z = this.here!.z + 1.4 * Math.sin(a),
          face = Math.atan2(this.here!.x - x, this.here!.z - z),
          kin: Moment = {
            x,
            z,
            yaw: face,
            activity: what === "eat" ? ACTIVITY.eating : ACTIVITY.home,
            task: what === "family" ? "talk" : null,
            hidden: false,
            hunger: 0,
            tiredness: 0,
            carry: null,
            why: "With their own",
          };
        drawn[j] = { moment: kin, size: 1, stride: drawn[j]!.stride };
        const q = presence.get(this.plan.people[j]!.ref);
        if (q) {
          q.x = x;
          q.z = z;
          q.yaw = face;
          q.vx = 0;
          q.vz = 0;
          q.size = 1;
          q.blinking = false;
        }
      });
    }
  }
}
