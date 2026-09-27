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
import { paceOf } from "./figure.ts";
import type { Carry } from "./work.ts";

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
  /** What they carry now (M78): their tools out, what they worked back; null, empty-handed. */
  carry: Carry | null;
};

const DAY = 86_400,
  HOUR = 3_600;

const unit = (h: number) => (h >>> 0) / 4294967296;

type Point = { x: number; z: number };
type Leg = {
  from: number;
  to: number;
  at: Point;
  next: Point | null;
  activity: Activity;
  carry: Carry | null;
};

/** Where a person works, and what they carry there and back. */
type Work = Point & { to: Carry | null; back: Carry | null };

/** A keyed stream for one person on one day. */
function dayDraw(ref: string, day: number): (n: number) => number {
  const base = mix(hashString(ref), day);
  return (n) => unit(finish(mix(base, n), 17));
}

/** The share of the year gone (0 … 1) when the fields are ripe and reaped. */
const HARVEST: readonly [number, number] = [0.6, 0.78];

/**
 * Where a person works, by their trade, and what they carry there and back (M78): a
 * farmer's tool out and back, or sheaves in the harvest; a herder's staff; a forager's
 * basket, or a fisher's catch by the water; a miner's pick out and ore back; a crafter's
 * wares; a trader's pack; a child sent to the well, its bucket.
 */
function workplace(
  plan: VillagePlan,
  p: VillagePlan["people"][number],
  draw: (n: number) => number,
  day: number,
): Work {
  const home = plan.homes[p.home]!,
    angle = draw(1) * 2 * Math.PI,
    at = (x: number, z: number, to: Carry | null = null, back: Carry | null = to): Work => ({
      x,
      z,
      to,
      back,
    });
  if (p.child) {
    // Children play near home, or in the square on some days (and bring water from its well).
    return draw(2) < 0.4
      ? at(6 * Math.cos(angle), 6 * Math.sin(angle), null, plan.market ? null : "water")
      : at(home.x + 8 * Math.cos(angle), home.z + 8 * Math.sin(angle));
  }
  // The old keep near home: from sixty-two for upright apes, as late in any people's span.
  if (p.age >= (62 * (plan.body?.span ?? 70)) / 70)
    return at(home.x + 3 * Math.cos(angle), home.z + 3 * Math.sin(angle));
  switch (p.occupation) {
    case OCC.farmer: {
      const f = plan.fields[Math.floor(draw(3) * plan.fields.length)] ?? {
          x: 120,
          z: 0,
          w: 30,
          d: 20,
          yaw: 0,
        },
        season = (day % 365) / 365,
        reaping = season >= HARVEST[0] && season < HARVEST[1];
      return at(
        f.x + (draw(4) - 0.5) * f.w * 0.7,
        f.z + (draw(5) - 0.5) * f.d * 0.7,
        "tool",
        reaping ? "sheaf" : "tool",
      );
    }
    case OCC.herder:
      return at(
        plan.pasture.x + plan.pasture.r * 0.8 * (draw(4) - 0.5) * 2,
        plan.pasture.z + plan.pasture.r * 0.8 * (draw(5) - 0.5) * 2,
        "staff",
      );
    case OCC.forager: {
      // By the water, some fish from its shore; the rest gather in the wild.
      if (plan.water && draw(12) < 0.4) {
        const d = Math.hypot(plan.water.x, plan.water.z) || 1,
          shore = d - 205,
          a = Math.atan2(plan.water.z, plan.water.x) + (draw(4) - 0.5) * 0.5;
        return at(shore * Math.cos(a), shore * Math.sin(a), "staff", "fish");
      }
      const r = plan.wild + draw(4) * 250;
      return at(r * Math.cos(angle), r * Math.sin(angle), "basket");
    }
    case OCC.trader:
      // Some days out along the road; others at the market.
      return draw(6) < 0.45
        ? at(plan.road.x * 0.9, plan.road.z * 0.9, "pack")
        : at(10 * Math.cos(angle), 10 * Math.sin(angle), null, "sack");
    case OCC.crafter: {
      // In a land that digs, half its crafters dig: their picks out, what they dig back.
      const mine = plan.works?.mine;
      if (mine && draw(12) < 0.5)
        return at(mine.x + (draw(4) - 0.5) * 20, mine.z + (draw(5) - 0.5) * 20, "tool", "ore");
      return at(
        14 + 6 * Math.cos(angle),
        -10 + 6 * Math.sin(angle),
        null,
        draw(13) < 0.5 ? "sack" : null,
      );
    }
    case OCC.leader:
      return at(4 * Math.cos(angle), 4 * Math.sin(angle));
    default:
      return at(home.x + 5 * Math.cos(angle), home.z + 5 * Math.sin(angle));
  }
}

/** How long a walk takes at a people's own pace. */
function walkTime(a: Point, b: Point, pace: number): number {
  return Math.hypot(b.x - a.x, b.z - a.z) / pace;
}

/** A person's day as legs: [from, to) in seconds of the day, where, and doing what. */
function dayOf(plan: VillagePlan, index: number, day: number): Leg[] {
  const pace = paceOf(plan.body);
  const p = plan.people[index]!,
    draw = dayDraw(p.ref, day),
    home = plan.homes[p.home]!,
    // At home means at the doorstep, where they can be seen: outside the walls.
    door = home.yaw + (draw(20) - 0.5) * 1.2,
    at: Point = { x: home.x + 7 * Math.cos(door), z: home.z + 7 * Math.sin(door) },
    work = workplace(plan, p, draw, day),
    // One day in seven is a day of rest, on a day kept by the village.
    rest = (day + (plan.seed % 7)) % 7 === 0,
    rise = (5.5 + draw(7) * 1.5) * HOUR,
    bed = (21 + draw(8) * 1.5) * HOUR,
    square: Point = { x: (draw(9) - 0.5) * 16, z: (draw(10) - 0.5) * 16 },
    legs: Leg[] = [];
  const stay = (
    from: number,
    to: number,
    where: Point,
    activity: Activity,
    carry: Carry | null = null,
  ) => {
    if (to > from) legs.push({ from, to, at: where, next: null, activity, carry });
  };
  const go = (from: number, a: Point, b: Point, carry: Carry | null = null) => {
    const to = from + walkTime(a, b, pace);
    legs.push({ from, to, at: a, next: b, activity: ACTIVITY.walking, carry });
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
      far = walkTime(at, work, pace) > 0.6 * HOUR;
    // (Out with what they work with; at work with it in hand; back with what they worked.)
    t = go(t, at, work, work.to);
    // Those who work near home come back to eat at noon; the rest eat where they are.
    if (far) {
      stay(t, 12 * HOUR, work, doing, work.to);
      stay(12 * HOUR, 12.75 * HOUR, work, ACTIVITY.eating);
      stay(12.75 * HOUR, 17.25 * HOUR, work, doing, work.to);
      t = go(17.25 * HOUR, work, at, work.back);
    } else {
      stay(t, 12 * HOUR, work, doing, work.to);
      t = go(12 * HOUR, work, at, work.back);
      stay(t, t + 0.75 * HOUR, at, ACTIVITY.eating);
      t = go(t + 0.75 * HOUR, at, work, work.to);
      stay(t, 17.5 * HOUR, work, doing, work.to);
      t = go(17.5 * HOUR, work, at, work.back);
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

// A day's legs, kept while the day lasts: the same person's same day is the same.
const DAYS = new Map<string, Leg[]>();
function legsOf(plan: VillagePlan, index: number, day: number): Leg[] {
  const key = `${plan.ref}|${plan.seed}|${paceOf(plan.body)}|${plan.people[index]!.ref}|${plan.people[index]!.home}|${day}`;
  let legs = DAYS.get(key);
  if (!legs) {
    if (DAYS.size > 4000) DAYS.clear();
    DAYS.set(key, (legs = dayOf(plan, index, day)));
  }
  return legs;
}

/** Where a watched person is at sim time t, and how they fare. */
export function momentOf(plan: VillagePlan, index: number, t: number): Moment {
  const day = Math.floor(t / DAY),
    s = t - day * DAY,
    legs = legsOf(plan, index, day);
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
    carry: leg.carry,
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

type Rgb = readonly [number, number, number];

/** How a house looks, from its design: wall and roof colours, its shape, and its roof's rise. */
export type HouseLook = {
  readonly wall: Rgb;
  readonly roof: Rgb;
  /** Round huts and tents are drawn round; the rest four-square. */
  readonly round: boolean;
  /** Long houses are drawn long; courtyard houses wide and low-walled. */
  readonly length: number;
  readonly width: number;
  /** The roof's rise over half the house's width (0 for flat). */
  readonly rise: number;
  readonly tent: boolean;
  /** How tall its walls are against a common house's; how far off the ground it stands; no roof at all. */
  readonly height: number;
  readonly raised: number;
  readonly open: boolean;
};

// Walls and roofs in the bright, clean colours of the era's games (art track A3).
const WALL: Readonly<Record<string, Rgb>> = {
  tent: [0.78, 0.62, 0.42],
  wattle: [0.9, 0.8, 0.58],
  timber: [0.66, 0.42, 0.24],
  mudbrick: [0.92, 0.7, 0.44],
  brick: [0.8, 0.36, 0.24],
  stone: [0.78, 0.78, 0.74],
  "reef-walls": [0.98, 0.6, 0.54],
  "shell-walls": [0.98, 0.95, 0.84],
  burrow: [0.62, 0.46, 0.3],
};
const ROOF: Readonly<Record<string, Rgb>> = {
  thatch: [0.86, 0.68, 0.3],
  turf: [0.34, 0.6, 0.2],
  flat: [0.84, 0.66, 0.44],
  tile: [0.82, 0.28, 0.16],
  vault: [0.8, 0.8, 0.76],
  "kelp-canopy": [0.24, 0.58, 0.3],
  mound: [0.58, 0.44, 0.28],
  open: [0.98, 0.6, 0.54],
};

export function houseLook(house: VillagePlan["house"]): HouseLook {
  const tent = house.walls === "tent",
    form = house.form,
    // Round: huts, tents, towers, hives, nests and warrens; long: long houses and great halls.
    round = tent || ["round", "shell-tower", "hive", "nest", "warren"].includes(form),
    long = form === "long" || form === "great-hall",
    court = form === "court",
    domed = form === "hive" || house.roof === "mound";
  return {
    wall: WALL[house.walls] ?? WALL.wattle!,
    roof: tent ? WALL.tent! : (ROOF[house.roof] ?? ROOF.thatch!),
    round,
    tent,
    length: form === "great-hall" ? 1.7 : long ? 1.15 : court ? 0.9 : form === "warren" ? 1.1 : 0.7,
    width: form === "great-hall" ? 1 : long ? 0.5 : court ? 0.9 : form === "warren" ? 1.1 : 0.55,
    // A dome rises high over its walls; a flat roof not at all.
    rise: domed ? 1.4 : Math.tan((house.pitch * Math.PI) / 180),
    height:
      form === "shell-tower"
        ? 3
        : form === "great-hall"
          ? 1.8
          : form === "warren" || house.walls === "burrow"
            ? 0.4
            : 1,
    raised: form === "nest" || form === "tree-house" ? 0.5 : 0,
    open: house.roof === "open",
  };
}

/** A tree about a village: its kind, where it stands (metres from the middle), how tall. */
export type Tree = {
  readonly kind: "conifer" | "broadleaf" | "palm" | "shrub";
  readonly x: number;
  readonly z: number;
  /** Its height against a common tree's (about fifteen metres). */
  readonly size: number;
};

/** How many trees stand about a village and of what kind, by its land (gen's BIOME codes). */
const WOODS: readonly (readonly [number, number, number, number])[] = [
  // conifer, broadleaf, palm, shrub
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 14],
  [150, 10, 0, 10],
  [0, 0, 0, 14],
  [4, 18, 0, 20],
  [25, 125, 0, 10],
  [120, 70, 0, 10],
  [0, 0, 8, 10],
  [0, 30, 4, 20],
  [0, 110, 10, 16],
  [0, 170, 40, 10],
  [60, 0, 0, 20],
  [0, 0, 0, 0],
];
const TREE_KINDS = ["conifer", "broadleaf", "palm", "shrub"] as const;

/**
 * The trees about a village (art track A3): as many and of the kinds its land grows,
 * standing in the ring beyond its homes and fields, clear of the fields, the road, the
 * pasture and the water. A pure function of the plan (the same village, the same trees).
 */
export function treesOf(plan: VillagePlan, share = 1): Tree[] {
  const woods = WOODS[plan.biome] ?? [0, 0, 0, 0],
    // (A setting may draw fewer or more of them: `share` of the land's count.)
    total = Math.round(woods.reduce((a, b) => a + b, 0) * share);
  if (!total) return [];
  // From just past the homes out (the fields are kept clear of trees one by one).
  let reach = 40;
  for (const h of plan.homes) reach = Math.max(reach, Math.hypot(h.x, h.z));
  const inner = reach + 25,
    outer = Math.min(1300, inner + 600),
    seed = hashText(plan.ref),
    roadLen = Math.hypot(plan.road.x, plan.road.z) || 1,
    rx = plan.road.x / roadLen,
    rz = plan.road.z / roadLen,
    clear = (x: number, z: number) => {
      // Off the road (it runs through a city both ways), out of the pasture and the water.
      const along = x * rx + z * rz,
        off = Math.abs(-x * rz + z * rx);
      if (off < 18 && (plan.districts ? true : along > 0)) return false;
      if (Math.hypot(x - plan.pasture.x, z - plan.pasture.z) < plan.pasture.r + 8) return false;
      if (plan.water && Math.hypot(x - plan.water.x, z - plan.water.z) < 230) return false;
      for (const f of plan.fields) {
        const dx = x - f.x,
          dz = z - f.z,
          c = Math.cos(f.yaw),
          s = Math.sin(f.yaw),
          u = dx * c - dz * s,
          v = dx * s + dz * c;
        if (Math.abs(u) < f.w / 2 + 6 && Math.abs(v) < f.d / 2 + 6) return false;
      }
      return true;
    };
  const out: Tree[] = [];
  let k = 0;
  for (let i = 0; out.length < total && i < total * 4; i++) {
    const u = unitOf(seed, i, 0),
      a = i * 2.399963 + u * 0.6,
      r = inner + (outer - inner) * Math.sqrt(unitOf(seed, i, 1)),
      x = r * Math.cos(a),
      z = r * Math.sin(a);
    if (!clear(x, z)) continue;
    // Kinds in their shares, dealt in turn.
    let pick = (k++ * 7919) % total,
      kind = 0;
    while (pick >= woods[kind]!) pick -= woods[kind++]!;
    out.push({ kind: TREE_KINDS[kind]!, x, z, size: 0.75 + 0.5 * unitOf(seed, i, 2) });
  }
  return out;
}

function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function unitOf(seed: number, i: number, n: number): number {
  let h = Math.imul(seed ^ Math.imul(i + 1, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(n + 1, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
