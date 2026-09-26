// A village's day, as the microscope shows it (docs/architecture §9, watch mode):
// where each watched person is at any moment — asleep at home, eating, walking to
// the fields, at work by their trade, playing, resting, gathering in the evening —
// and how hungry and tired they are. A pure function of the plan and the time, with
// keyed variation for each person and day, so the same moment always looks the
// same, the picture moves smoothly at any speed, and watching can never touch
// what happens (the plan is re-read as the years turn, so the dead leave it).
import { finish, hashString, mix } from "../kernel/index.ts";
import type { VillagePlan } from "../bridge/index.ts";
import { OCC } from "../rules/index.ts";

export const ACTIVITY = {
  asleep: 0,
  home: 1,
  walking: 2,
  working: 3,
  eating: 4,
  playing: 5,
  resting: 6,
  gathering: 7,
} as const;
export type Activity = (typeof ACTIVITY)[keyof typeof ACTIVITY];

export const ACTIVITY_WORDS: readonly string[] = [
  "asleep",
  "at home",
  "walking",
  "at work",
  "eating",
  "playing",
  "resting",
  "with the others in the square",
];

export type Moment = {
  x: number;
  z: number;
  /** Which way they face, in radians. */
  yaw: number;
  activity: Activity;
  /** Out of sight (asleep indoors). */
  hidden: boolean;
  /** 0 fed … 1 hungry; 0 rested … 1 worn out. */
  hunger: number;
  tiredness: number;
};

const DAY = 86_400,
  HOUR = 3_600,
  WALK = 1.25;

const unit = (h: number) => (h >>> 0) / 4294967296;

type Point = { x: number; z: number };
type Leg = { from: number; to: number; at: Point; next: Point | null; activity: Activity };

/** A keyed stream for one person on one day. */
function dayDraw(ref: string, day: number): (n: number) => number {
  const base = mix(hashString(ref), day);
  return (n) => unit(finish(mix(base, n), 17));
}

/** Where a person works, by their trade. */
function workplace(
  plan: VillagePlan,
  p: VillagePlan["people"][number],
  draw: (n: number) => number,
): Point {
  const home = plan.homes[p.home]!,
    angle = draw(1) * 2 * Math.PI;
  if (p.child) {
    // Children play near home, or in the square on some days.
    return draw(2) < 0.4
      ? { x: 6 * Math.cos(angle), z: 6 * Math.sin(angle) }
      : { x: home.x + 8 * Math.cos(angle), z: home.z + 8 * Math.sin(angle) };
  }
  if (p.age >= 62) return { x: home.x + 3 * Math.cos(angle), z: home.z + 3 * Math.sin(angle) };
  switch (p.occupation) {
    case OCC.farmer: {
      const f = plan.fields[Math.floor(draw(3) * plan.fields.length)] ?? {
        x: 120,
        z: 0,
        w: 30,
        d: 20,
        yaw: 0,
      };
      return { x: f.x + (draw(4) - 0.5) * f.w * 0.7, z: f.z + (draw(5) - 0.5) * f.d * 0.7 };
    }
    case OCC.herder:
      return {
        x: plan.pasture.x + plan.pasture.r * 0.8 * (draw(4) - 0.5) * 2,
        z: plan.pasture.z + plan.pasture.r * 0.8 * (draw(5) - 0.5) * 2,
      };
    case OCC.forager: {
      const r = plan.wild + draw(4) * 250;
      return { x: r * Math.cos(angle), z: r * Math.sin(angle) };
    }
    case OCC.trader:
      // Some days out along the road; others at the market.
      return draw(6) < 0.45
        ? { x: plan.road.x * 0.9, z: plan.road.z * 0.9 }
        : { x: 10 * Math.cos(angle), z: 10 * Math.sin(angle) };
    case OCC.crafter:
      return { x: 14 + 6 * Math.cos(angle), z: -10 + 6 * Math.sin(angle) };
    case OCC.leader:
      return { x: 4 * Math.cos(angle), z: 4 * Math.sin(angle) };
    default:
      return { x: home.x + 5 * Math.cos(angle), z: home.z + 5 * Math.sin(angle) };
  }
}

function walkTime(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.z - a.z) / WALK;
}

/** A person's day as legs: [from, to) in seconds of the day, where, and doing what. */
function dayOf(plan: VillagePlan, index: number, day: number): Leg[] {
  const p = plan.people[index]!,
    draw = dayDraw(p.ref, day),
    home = plan.homes[p.home]!,
    // At home means at the doorstep, where they can be seen: outside the walls.
    door = home.yaw + (draw(20) - 0.5) * 1.2,
    at: Point = { x: home.x + 7 * Math.cos(door), z: home.z + 7 * Math.sin(door) },
    work = workplace(plan, p, draw),
    // One day in seven is a day of rest, on a day kept by the village.
    rest = (day + (plan.seed % 7)) % 7 === 0,
    rise = (5.5 + draw(7) * 1.5) * HOUR,
    bed = (21 + draw(8) * 1.5) * HOUR,
    square: Point = { x: (draw(9) - 0.5) * 16, z: (draw(10) - 0.5) * 16 },
    legs: Leg[] = [];
  const stay = (from: number, to: number, where: Point, activity: Activity) => {
    if (to > from) legs.push({ from, to, at: where, next: null, activity });
  };
  const go = (from: number, a: Point, b: Point) => {
    const to = from + walkTime(a, b);
    legs.push({ from, to, at: a, next: b, activity: ACTIVITY.walking });
    return to;
  };
  stay(0, rise, at, ACTIVITY.asleep);
  stay(rise, rise + 0.75 * HOUR, at, ACTIVITY.eating);
  let t = rise + 0.75 * HOUR;
  if (rest || p.age >= 62) {
    stay(t, 17 * HOUR, at, p.child ? ACTIVITY.playing : ACTIVITY.resting);
    t = go(17 * HOUR, at, square);
    stay(t, 19.5 * HOUR, square, ACTIVITY.gathering);
    t = go(19.5 * HOUR, square, at);
  } else {
    const doing = p.child ? ACTIVITY.playing : ACTIVITY.working,
      far = walkTime(at, work) > 0.6 * HOUR;
    t = go(t, at, work);
    // Those who work near home come back to eat at noon; the rest eat where they are.
    if (far) {
      stay(t, 12 * HOUR, work, doing);
      stay(12 * HOUR, 12.75 * HOUR, work, ACTIVITY.eating);
      stay(12.75 * HOUR, 17.25 * HOUR, work, doing);
      t = go(17.25 * HOUR, work, at);
    } else {
      stay(t, 12 * HOUR, work, doing);
      t = go(12 * HOUR, work, at);
      stay(t, t + 0.75 * HOUR, at, ACTIVITY.eating);
      t = go(t + 0.75 * HOUR, at, work);
      stay(t, 17.5 * HOUR, work, doing);
      t = go(17.5 * HOUR, work, at);
    }
    // Some evenings in the square.
    if (draw(11) < 0.3 && t < 19 * HOUR) {
      t = go(t, at, square);
      stay(t, 20 * HOUR, square, ACTIVITY.gathering);
      t = go(20 * HOUR, square, at);
    }
  }
  stay(t, Math.max(t, bed - 0.5 * HOUR), at, ACTIVITY.eating);
  stay(Math.max(t, bed - 0.5 * HOUR), bed, at, ACTIVITY.home);
  stay(Math.max(t, bed), DAY, at, ACTIVITY.asleep);
  return legs;
}

/** Where a watched person is at sim time t, and how they fare. */
export function momentOf(plan: VillagePlan, index: number, t: number): Moment {
  const day = Math.floor(t / DAY),
    s = t - day * DAY,
    legs = dayOf(plan, index, day);
  const leg = legs.find((l) => s >= l.from && s < l.to) ?? legs[legs.length - 1]!;
  let x = leg.at.x,
    z = leg.at.z,
    yaw = 0;
  if (leg.next) {
    const k = (s - leg.from) / Math.max(1, leg.to - leg.from);
    x += (leg.next.x - leg.at.x) * k;
    z += (leg.next.z - leg.at.z) * k;
    yaw = Math.atan2(leg.next.x - leg.at.x, leg.next.z - leg.at.z);
  } else if (leg.activity === ACTIVITY.working || leg.activity === ACTIVITY.playing) {
    // At work they move about a little: a few steps this way and that.
    const w = s / 600 + index;
    x += Math.sin(w) * (leg.activity === ACTIVITY.playing ? 3 : 1.5);
    z += Math.cos(w * 0.7) * (leg.activity === ACTIVITY.playing ? 3 : 1.5);
    yaw = w;
  }
  // Hunger rises between meals; tiredness through the waking day.
  const meals = legs.filter((l) => l.activity === ACTIVITY.eating && l.to <= s),
    lastMeal = meals.length ? meals[meals.length - 1]!.to : -6 * HOUR,
    woke = legs[0]!.to;
  return {
    x,
    z,
    yaw,
    activity: leg.activity,
    hidden: leg.activity === ACTIVITY.asleep,
    hunger: Math.max(0, Math.min(1, (s - lastMeal) / (7 * HOUR))),
    tiredness:
      leg.activity === ACTIVITY.asleep ? 0 : Math.max(0, Math.min(1, (s - woke) / (16 * HOUR))),
  };
}

/** People by what they do: those who work the land, the makers and carriers, the leaders, the young. */
export function personGroup(p: VillagePlan["people"][number]): number {
  if (p.child) return 3;
  if (p.occupation === OCC.leader) return 2;
  if (p.occupation === OCC.crafter || p.occupation === OCC.trader) return 1;
  return 0;
}
