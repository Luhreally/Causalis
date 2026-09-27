// A village's day, as the microscope shows it (docs/architecture §9, watch mode):
// where each watched person is at any moment — asleep at home, eating, walking to
// the fields, at work by their trade, playing, resting, gathering in the evening —
// and how hungry and tired they are. A pure function of the plan and the time, with
// keyed variation for each person and day, so the same moment always looks the
// same, the picture moves smoothly at any speed, and watching can never touch
// what happens (the plan is re-read as the years turn, so the dead leave it).
// And what each is at (Phase 9 M86): the fields hoed, sown and reaped by the season, the
// next home built as the village grows, the young drilling in ranks while their realm is
// at war, rings of talk in the square — hot words and a brawl where grievance runs high —
// and what each says, in signs, of what the village's own year has brought. Walkers go
// round the homes and the water, never through them.
import { finish, hashString, mix } from "../kernel/index.ts";
import type { VillagePlan } from "../bridge/index.ts";
import { OCC } from "../rules/index.ts";
import { paceOf } from "./figure.ts";
import { clearOf, keepOut, route, villageGround, type Ground } from "./ground.ts";
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

/**
 * What a person is at (M86): the tools' work of each trade by its season, building, the
 * herd, the gathering, the net, the pick, the hammer, the market's haggling, talk, play,
 * drill and brawl.
 */
export const TASKS = [
  "hoe",
  "sow",
  "reap",
  "herd",
  "gather",
  "fish",
  "dig",
  "hammer",
  "build",
  "haggle",
  "talk",
  "play",
  "drill",
  "brawl",
] as const;
export type Task = (typeof TASKS)[number];

export type Moment = {
  x: number;
  z: number;
  /** Which way they face, in radians. */
  yaw: number;
  activity: Activity;
  /** What they are at, where they are at something (M86). */
  task: Task | null;
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
  task: Task | null;
  /** Which way they face while they stay (toward a ring's middle, a rank's front). */
  face: number | null;
};

/** Where a person works, what they carry there and back, and what they are at there. */
type Work = Point & { to: Carry | null; back: Carry | null; task: Task | null };

/** A keyed stream for one person on one day. */
function dayDraw(ref: string, day: number): (n: number) => number {
  const base = mix(hashString(ref), day);
  return (n) => unit(finish(mix(base, n), 17));
}

/** The share of the year gone (0 … 1) when the fields are ripe and reaped; when they are sown. */
const HARVEST: readonly [number, number] = [0.6, 0.78];
const SOWING: readonly [number, number] = [0.18, 0.34];

/** The square's rings of talk: how many, and how far out from its middle each stands. */
const RINGS = 4,
  RING_OUT = 7,
  RING_R = 2.6;

/** The gap between the ranks and the files of those who drill. */
const DRILL_GAP = 3;

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
    ground = groundFor(plan),
    // (Where they stand to work is clear of every wall.)
    at = (
      x: number,
      z: number,
      to: Carry | null = null,
      back: Carry | null = to,
      task: Task | null = null,
    ): Work => ({ ...clearSpot(ground, { x, z }), to, back, task }),
    // Beside their own home: a doorstep's way out, on a side clear of the walls.
    nearHome = (
      out: number,
      to: Carry | null = null,
      back: Carry | null = to,
      task: Task | null = null,
    ): Work => ({
      ...doorstep(
        ground,
        home,
        angle,
        Math.max(out, (ground.homes[p.home]?.r ?? 5) + PERSON_REACH + 0.8),
      ),
      to,
      back,
      task,
    });
  if (p.child) {
    // Children play near home, or in the square on some days (and bring water from its well).
    return draw(2) < 0.4
      ? at(6 * Math.cos(angle), 6 * Math.sin(angle), null, plan.market ? null : "water", "play")
      : nearHome(8, null, null, "play");
  }
  // The old keep near home: from sixty-two for upright apes, as late in any people's span.
  if (p.age >= (62 * (plan.body?.span ?? 70)) / 70) return nearHome(3);
  // As the village grows, its crafters (and a farmer or two between sowing and harvest)
  // build its next home: out with a beam, round the rising walls.
  const site = plan.life?.site;
  if (
    site &&
    (p.occupation === OCC.crafter ? draw(14) < 0.6 : p.occupation === OCC.farmer && draw(14) < 0.12)
  ) {
    const round = draw(15) * 2 * Math.PI;
    return at(site.x + 9 * Math.cos(round), site.z + 9 * Math.sin(round), "beam", null, "build");
  }
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
        reaping ? "reap" : season >= SOWING[0] && season < SOWING[1] ? "sow" : "hoe",
      );
    }
    case OCC.herder:
      return at(
        plan.pasture.x + plan.pasture.r * 0.8 * (draw(4) - 0.5) * 2,
        plan.pasture.z + plan.pasture.r * 0.8 * (draw(5) - 0.5) * 2,
        "staff",
        "staff",
        "herd",
      );
    case OCC.forager: {
      // By the water, some fish from its shore; the rest gather in the wild.
      if (plan.water && draw(12) < 0.4) {
        const d = Math.hypot(plan.water.x, plan.water.z) || 1,
          shore = d - 205,
          a = Math.atan2(plan.water.z, plan.water.x) + (draw(4) - 0.5) * 0.5;
        return at(shore * Math.cos(a), shore * Math.sin(a), "staff", "fish", "fish");
      }
      const r = plan.wild + draw(4) * 250;
      return at(r * Math.cos(angle), r * Math.sin(angle), "basket", "basket", "gather");
    }
    case OCC.trader:
      // Some days out along the road; others at the market.
      return draw(6) < 0.45
        ? at(plan.road.x * 0.9, plan.road.z * 0.9, "pack")
        : at(10 * Math.cos(angle), 10 * Math.sin(angle), null, "sack", "haggle");
    case OCC.crafter: {
      // In a land that digs, half its crafters dig: their picks out, what they dig back.
      const mine = plan.works?.mine;
      if (mine && draw(12) < 0.5)
        return at(
          mine.x + (draw(4) - 0.5) * 20,
          mine.z + (draw(5) - 0.5) * 20,
          "tool",
          "ore",
          "dig",
        );
      return at(
        14 + 6 * Math.cos(angle),
        -10 + 6 * Math.sin(angle),
        null,
        draw(13) < 0.5 ? "sack" : null,
        "hammer",
      );
    }
    case OCC.leader:
      return at(4 * Math.cos(angle), 4 * Math.sin(angle), null, null, "talk");
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
    ground = groundFor(plan),
    // At home means at the doorstep, where they can be seen: outside the walls (on a side
    // clear of the neighbours' too).
    doorOut = Math.max(7, (ground.homes[p.home]?.r ?? 5) + PERSON_REACH + 0.8),
    at = doorstep(ground, home, home.yaw + (draw(20) - 0.5) * 1.2, doorOut),
    work = workplace(plan, p, draw, day),
    // One day in seven is a day of rest, on a day kept by the village.
    rest = (day + (plan.seed % 7)) % 7 === 0,
    rise = (5.5 + draw(7) * 1.5) * HOUR,
    bed = (21 + draw(8) * 1.5) * HOUR,
    // In the square, a place in one of its rings of talk, facing the ring's middle.
    ring = Math.floor(draw(9) * RINGS),
    ringAt = {
      x: RING_OUT * Math.cos((ring / RINGS) * 2 * Math.PI + 0.4),
      z: RING_OUT * Math.sin((ring / RINGS) * 2 * Math.PI + 0.4),
    },
    life = plan.life,
    // Where grievance runs high, two of the first ring come to blows, face to face.
    brawls = !!life && life.unrest > 0.35 && ring === 0 && draw(18) < life.unrest,
    // (Eight places to a ring, a body's breadth apart.)
    seat = brawls ? (draw(19) < 0.5 ? 0 : Math.PI) : (Math.floor(draw(10) * 8) / 8) * 2 * Math.PI,
    near = brawls ? 0.9 : RING_R,
    square: Point = { x: ringAt.x + near * Math.cos(seat), z: ringAt.z + near * Math.sin(seat) },
    toRing = Math.atan2(ringAt.x - square.x, ringAt.z - square.z),
    // While their realm is at war, the young drill in ranks of an evening, spears in hand.
    drills = !!life?.war && !p.child && p.age >= 16 && p.age < 45 && !(rest && draw(16) < 0.5),
    slot = Math.floor(draw(17) * 16),
    field = drillField(plan),
    rank: Point = {
      x: field.x + ((slot & 3) - 1.5) * DRILL_GAP,
      z: field.z + ((slot >> 2) - 1.5) * DRILL_GAP,
    },
    legs: Leg[] = [];
  const stay = (
    from: number,
    to: number,
    where: Point,
    activity: Activity,
    carry: Carry | null = null,
    task: Task | null = null,
    face: number | null = null,
  ) => {
    if (to > from) legs.push({ from, to, at: where, next: null, activity, carry, task, face });
  };
  // A walk goes round the homes, the water and the rising walls, turning beside each.
  const go = (from: number, a: Point, b: Point, carry: Carry | null = null) => {
    const way = route(ground, a, b, PERSON_REACH);
    let t = from;
    for (let k = 0; k + 1 < way.length; k++) {
      const p = way[k]!,
        q = way[k + 1]!,
        to = t + walkTime(p, q, pace);
      legs.push({
        from: t,
        to,
        at: p,
        next: q,
        activity: ACTIVITY.walking,
        carry,
        task: null,
        face: null,
      });
      t = to;
    }
    return t;
  };
  /** An evening in the square: talk in the rings (or blows), or the drill while at war. */
  const evening = (t: number, until: number): number => {
    if (drills) {
      t = go(t, at, rank, "spear");
      stay(t, until, rank, ACTIVITY.gathering, "spear", "drill", 0);
      return go(until, rank, at, "spear");
    }
    t = go(t, at, square);
    stay(t, until, square, ACTIVITY.gathering, null, brawls ? "brawl" : "talk", toRing);
    return go(until, square, at);
  };
  stay(0, rise, at, ACTIVITY.asleep);
  stay(rise, rise + 0.75 * HOUR, at, ACTIVITY.eating);
  let t = rise + 0.75 * HOUR;
  if (rest || p.age >= 62) {
    stay(
      t,
      17 * HOUR,
      at,
      p.child ? ACTIVITY.playing : ACTIVITY.resting,
      null,
      p.child ? "play" : null,
    );
    t = evening(17 * HOUR, 19.5 * HOUR);
  } else {
    const doing = p.child ? ACTIVITY.playing : ACTIVITY.working,
      far = walkTime(at, work, pace) > 0.6 * HOUR;
    // (Out with what they work with; at work with it in hand; back with what they worked.)
    t = go(t, at, work, work.to);
    // Those who work near home come back to eat at noon; the rest eat where they are.
    if (far) {
      stay(t, 12 * HOUR, work, doing, work.to, work.task);
      stay(12 * HOUR, 12.75 * HOUR, work, ACTIVITY.eating);
      stay(12.75 * HOUR, 17.25 * HOUR, work, doing, work.to, work.task);
      t = go(17.25 * HOUR, work, at, work.back);
    } else {
      stay(t, 12 * HOUR, work, doing, work.to, work.task);
      t = go(12 * HOUR, work, at, work.back);
      stay(t, t + 0.75 * HOUR, at, ACTIVITY.eating);
      t = go(t + 0.75 * HOUR, at, work, work.to);
      stay(t, 17.5 * HOUR, work, doing, work.to, work.task);
      t = go(17.5 * HOUR, work, at, work.back);
    }
    // Some evenings in the square (every evening, for those who drill).
    if ((drills || draw(11) < 0.3) && t < 19 * HOUR) t = evening(t, 20 * HOUR);
  }
  stay(t, Math.max(t, bed - 0.5 * HOUR), at, ACTIVITY.eating);
  stay(Math.max(t, bed - 0.5 * HOUR), bed, at, ACTIVITY.home);
  stay(Math.max(t, bed), DAY, at, ACTIVITY.asleep);
  return legs;
}

// A day's legs, kept while the day lasts: the same person's same day is the same (for
// the plan as it stands: a plan re-read as the years turn keeps its own).
const DAYS = new WeakMap<VillagePlan, Map<string, Leg[]>>();
function legsOf(plan: VillagePlan, index: number, day: number): Leg[] {
  let days = DAYS.get(plan);
  if (!days) DAYS.set(plan, (days = new Map()));
  const key = `${plan.people[index]!.ref}|${day}`;
  let legs = days.get(key);
  if (!legs) {
    if (days.size > 4000) days.clear();
    days.set(key, (legs = dayOf(plan, index, day)));
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
    yaw = leg.face ?? 0;
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
    // A builder faces the walls going up.
    const site = plan.life?.site;
    if (leg.task === "build" && site) yaw = Math.atan2(site.x - x, site.z - z);
  }
  // Round the homes, the water and the rising walls, never through them.
  const at = { x, z };
  keepOut(groundFor(plan), at, PERSON_REACH);
  x = at.x;
  z = at.z;
  // Hunger rises between meals; tiredness through the waking day.
  const meals = legs.filter((l) => l.activity === ACTIVITY.eating && l.to <= s),
    lastMeal = meals.length ? meals[meals.length - 1]!.to : -6 * HOUR,
    woke = legs[0]!.to;
  return {
    x,
    z,
    yaw,
    activity: leg.activity,
    task: leg.task,
    hidden: leg.activity === ACTIVITY.asleep,
    carry: leg.carry,
    hunger: Math.max(0, Math.min(1, (s - lastMeal) / (7 * HOUR))),
    tiredness:
      leg.activity === ACTIVITY.asleep ? 0 : Math.max(0, Math.min(1, (s - woke) / (16 * HOUR))),
  };
}

/** The nearest place to `p` clear of every wall (itself, if it is), a few steps about it. */
function clearSpot(ground: Ground, p: Point): Point {
  const clear = (q: Point) =>
    ground.homes.every((h) => clearOf(h, q) >= PERSON_REACH) &&
    (!ground.lake ||
      Math.hypot(q.x - ground.lake.x, q.z - ground.lake.z) >= ground.lake.r + PERSON_REACH);
  if (clear(p)) return p;
  for (let r = 2; r <= 12; r += 2)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * 2 * Math.PI,
        q = { x: p.x + r * Math.cos(a), z: p.z + r * Math.sin(a) };
      if (clear(q)) return q;
    }
  const q = { ...p };
  keepOut(ground, q, PERSON_REACH);
  return q;
}

// Where the young drill while their realm is at war: open ground just past the homes, off
// the fields, the pasture, the road and the water.
const FIELDS = new WeakMap<VillagePlan, Point>();
function drillField(plan: VillagePlan): Point {
  let f = FIELDS.get(plan);
  if (!f) {
    const ground = groundFor(plan),
      out = ground.homesReach + 22,
      apart = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))),
      fx = plan.fields.reduce((a, q) => a + q.x, 0),
      fz = plan.fields.reduce((a, q) => a + q.z, 0),
      fieldWay = plan.fields.length ? Math.atan2(fz, fx) : Math.PI,
      roadWay = Math.atan2(plan.road.z, plan.road.x);
    let best = { x: out, z: 0 },
      bestScore = -Infinity;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * 2 * Math.PI,
        q = { x: out * Math.cos(a), z: out * Math.sin(a) },
        score =
          Math.min(apart(a, fieldWay), 1.5) +
          Math.min(apart(a, roadWay), 1) +
          Math.min(
            1,
            Math.hypot(q.x - plan.pasture.x, q.z - plan.pasture.z) / (plan.pasture.r + 60),
          ) +
          (ground.lake && Math.hypot(q.x - ground.lake.x, q.z - ground.lake.z) < ground.lake.r + 40
            ? -10
            : 0);
      if (score > bestScore) {
        bestScore = score;
        best = q;
      }
    }
    FIELDS.set(plan, (f = clearSpot(ground, best)));
  }
  return f;
}

/** A doorstep `out` metres from a home toward `way`, turned to the first side clear of every wall. */
function doorstep(ground: Ground, home: Point, way: number, out: number): Point {
  for (let k = 0; k < 12; k++) {
    const a = way + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.55,
      p = { x: home.x + out * Math.cos(a), z: home.z + out * Math.sin(a) };
    if (ground.homes.every((h) => clearOf(h, p) >= PERSON_REACH)) return p;
  }
  return { x: home.x + out * Math.cos(way), z: home.z + out * Math.sin(way) };
}

/** How far a person keeps off a wall (metres: half a figure's breadth as drawn, and a step). */
const PERSON_REACH = 1.2;

// A village's solid ground for its people: its homes, its water, and its rising walls.
const GROUNDS = new WeakMap<VillagePlan, Ground>();
function groundFor(plan: VillagePlan): Ground {
  let g = GROUNDS.get(plan);
  if (!g) {
    const base = villageGround(plan),
      site = plan.life?.site;
    g = site ? { ...base, homes: [...base.homes, { x: site.x, z: site.z, r: 5.5 }] } : base;
    if (site)
      g = {
        ...g,
        homesReach: Math.max(g.homesReach, Math.hypot(site.x, site.z) + 5.5),
      };
    GROUNDS.set(plan, g);
  }
  return g;
}

/** Half a body's breadth: two people's middles come no nearer than twice it (metres). */
export const BODY_R = 0.35;

/**
 * Keep the people in sight out of one another, in place (M90): where two would stand nearer
 * than a body's breadth, each steps half the way apart — out of the way of what stands fixed
 * (`fixed`: a battle's soldiers) the whole way — and none steps into a wall. Each step is
 * taken at once, so a knot of three or four standing on one spot settles in a few passes;
 * the same moments always settle the same way.
 */
export function keepApart(
  plan: VillagePlan,
  moments: Moment[],
  fixed: readonly { readonly x: number; readonly z: number }[] = [],
): void {
  const ground = groundFor(plan),
    gap = 2 * BODY_R,
    // (Each steps a little past the breadth, so a knot settles without creeping.)
    want = gap * 1.06,
    live: number[] = [];
  moments.forEach((m, i) => {
    if (!m.hidden) live.push(i);
  });
  if (live.length + fixed.length < 2) return;
  // (Found by the cell of the ground each stands in, a body's breadth across.)
  const cellOf = (x: number, z: number) =>
    (Math.floor(x / gap) + 32768) * 65536 + (Math.floor(z / gap) + 32768);
  const pinned = new Map<number, number[]>();
  fixed.forEach((f, k) => {
    const key = cellOf(f.x, f.z),
      list = pinned.get(key);
    if (list) list.push(k);
    else pinned.set(key, [k]);
  });
  const moved = new Uint8Array(moments.length);
  /** Step person `i` by (dx, dz). */
  const step = (i: number, dx: number, dz: number) => {
    const m = moments[i]!;
    m.x += dx;
    m.z += dz;
    moved[i] = 1;
  };
  /**
   * The way from a to b, unit long; for two on one spot, a way keyed by the pair, so a knot
   * standing on one spot opens out every way rather than along a line.
   */
  const wayOf = (ax: number, az: number, d: number, key: number): [number, number] =>
    d < 1e-6 ? [Math.cos(key * 2.399963), Math.sin(key * 2.399963)] : [ax / d, az / d];
  for (let pass = 0; pass < 20; pass++) {
    const cells = new Map<number, number[]>();
    for (const i of live) {
      const m = moments[i]!,
        key = cellOf(m.x, m.z),
        list = cells.get(key);
      if (list) list.push(i);
      else cells.set(key, [i]);
    }
    let any = false;
    for (const i of live) {
      const m = moments[i]!,
        cx = Math.floor(m.x / gap),
        cz = Math.floor(m.z / gap);
      for (let ox = -1; ox <= 1; ox++)
        for (let oz = -1; oz <= 1; oz++) {
          const key = (cx + ox + 32768) * 65536 + (cz + oz + 32768);
          // Another person: each steps half the way (each pair once, the lower first).
          for (const j of cells.get(key) ?? []) {
            if (j <= i) continue;
            const o = moments[j]!,
              ax = o.x - m.x,
              az = o.z - m.z,
              d = Math.hypot(ax, az);
            if (d >= gap) continue;
            const half = (want - d) / 2,
              [ux, uz] = wayOf(ax, az, d, i * 31 + j);
            step(i, -ux * half, -uz * half);
            step(j, ux * half, uz * half);
            any = true;
          }
          // What stands fixed: the whole way out of it.
          for (const k of pinned.get(key) ?? []) {
            const f = fixed[k]!,
              ax = m.x - f.x,
              az = m.z - f.z,
              d = Math.hypot(ax, az);
            if (d >= gap) continue;
            const [ux, uz] = wayOf(ax, az, d, i * 31 + k + 7);
            step(i, ux * (want - d), uz * (want - d));
            any = true;
          }
        }
    }
    for (const i of live)
      if (moved[i]) {
        moved[i] = 0;
        keepOut(ground, moments[i]!, PERSON_REACH);
      }
    if (!any) return;
  }
}

/**
 * The signs a village's talk and work are shown in (M86): each topic its year brings, and
 * what each task and want looks like said aloud.
 */
export const SIGNS: Readonly<Record<string, string>> = {
  hunger: "🍞",
  war: "⚔️",
  unrest: "😠",
  grief: "😢",
  flocks: "🐺",
  pests: "🐀",
  fish: "🐟",
  game: "🦌",
  plenty: "🦌",
  drought: "☀️",
  rain: "🌧️",
  baby: "👶",
  learning: "💡",
  building: "🔨",
  faith: "🙏",
  trade: "💰",
  weather: "🌤️",
  food: "🍲",
  gossip: "💬",
  laugh: "😄",
  love: "❤️",
  tired: "😴",
  build: "🔨",
  reap: "🌾",
  sow: "🌱",
  dig: "⛏️",
  drill: "⚔️",
  brawl: "💢",
  play: "😄",
  herd: "🐑",
  haggle: "💰",
};

/**
 * What a person says now, as a sign (or null): the rings of talk turn over what the
 * village's own year has brought, the most pressing most often — hunger, war, grievance, a
 * death, the hunters at the flocks, the grain eaten, a newborn, what was learned; at work,
 * now and then, what they are at; the hungry and the worn out say so. By the screen's
 * clock (`s`, seconds), each person speaking in their turn, a few seconds at a time.
 */
export function sayOf(plan: VillagePlan, index: number, m: Moment, s: number): string | null {
  if (m.hidden) return null;
  const p = plan.people[index]!,
    key = hashString(p.ref),
    beat = Math.floor(s / 2.6 + (key % 97) / 13),
    turn = unit(finish(mix(key, beat), 29)),
    life = plan.life,
    home = plan.homes[p.home]?.household ?? null;
  // (A third of the time, in turns of a few seconds.)
  if (turn > 0.34) return null;
  const pick = unit(finish(mix(key, beat + 7919), 31));
  if (m.task === "talk") {
    if (home && life?.mourning.includes(home) && pick < 0.4) return SIGNS.grief!;
    if (home && life?.newborn.includes(home) && pick < 0.4) return SIGNS.baby!;
    const talk = life?.talk ?? ["weather", "food", "gossip"],
      // The most pressing topics most often.
      topic = talk[Math.floor(pick * pick * talk.length)] ?? "gossip";
    return SIGNS[topic] ?? SIGNS.gossip!;
  }
  if (m.task === "brawl") return pick < 0.5 ? SIGNS.brawl! : SIGNS.unrest!;
  if (m.task === "drill") return pick < 0.3 ? SIGNS.drill! : null;
  if (m.task === "play") return pick < 0.5 ? SIGNS.play! : null;
  if (m.activity === ACTIVITY.walking) {
    if (m.hunger > 0.85) return SIGNS.hunger!;
    if (m.tiredness > 0.9) return SIGNS.tired!;
    return null;
  }
  if (m.task && pick < 0.35) return SIGNS[m.task] ?? null;
  return null;
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
