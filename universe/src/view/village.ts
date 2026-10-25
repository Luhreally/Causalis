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
// round the homes and the water, never through them; in a town built lot by lot (Phase 23),
// each family's door is on its street, and its walks go by the streets.
// Their work as the town's needs set it (Phase 39 M198, view/errands.ts): errand on errand —
// the sheaves in to the granary and the seed out of it, beams and stone from the yard to every
// home and building rising, timber felled and ore dug for the yard, the household's bread
// fetched home — each moving the town's stores, history's own, copied in each day.
import { finish, hashString, mix } from "../kernel/index.ts";
import { STORE_KINDS, type StoreBook, type StoreKind, type VillagePlan } from "../bridge/index.ts";
import { OCC } from "../rules/index.ts";
import { paceOf } from "./figure.ts";
import { clearAt, clearOf, keepOut, route, villageGround, type Ground } from "./ground.ts";
import { streetDoor } from "./streets.ts";
import { FEAST_HOURS, MARKET_HOURS, feastOn, feastPlace, marketDay, marketScene } from "./feast.ts";
import type { Carry } from "./work.ts";
import {
  HARVEST,
  SOWING,
  WINTER,
  WORKSHOP,
  dayDraw,
  leanOn,
  monthsOf,
  restDay,
  sitesOn,
  storeAt,
  storeFlow,
  storeSpots,
  townDay,
  type Role,
  type RoleKind,
  type TownDay,
} from "./errands.ts";

export { HARVEST, SOWING, restDay };

export const ACTIVITY = {
  asleep: 0,
  home: 1,
  walking: 2,
  working: 3,
  eating: 4,
  playing: 5,
  resting: 6,
  gathering: 7,
  /** Indoors out of a downpour (Phase 30). */
  sheltering: 8,
  /** At a feast in the square (Phase 33). */
  feasting: 9,
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
  "indoors, out of the weather",
  "at the feast in the square",
];

/**
 * What a person is at (M86): the tools' work of each trade by its season, building, the
 * herd, the gathering, the net, the pick, the hammer, the market's haggling, talk, play,
 * drill and brawl; the axe, and a load put down or taken up at a store (Phase 39 M198).
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
  "chop",
  "load",
  "haggle",
  "talk",
  "play",
  "drill",
  "brawl",
  "dance",
  "feast",
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
  /** Out of sight (asleep indoors, or in out of a downpour). */
  hidden: boolean;
  /** 0 fed … 1 hungry; 0 rested … 1 worn out. */
  hunger: number;
  tiredness: number;
  /** What they carry now (M78): their tools out, what they worked back; null, empty-handed. */
  carry: Carry | null;
  /** What they are about, in words — the errand, and what it is for (Phase 39 M198); null, nothing to tell. */
  why: string | null;
};

const DAY = 86_400,
  HOUR = 3_600;

const unit = (h: number) => (h >>> 0) / 4294967296;

type Point = { x: number; z: number };

/** What a stay does to the town's stores as it ends (Phase 39 M198): so much of a kind in, or out. */
export type Effect = { readonly kind: StoreKind; readonly amount: number };

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
  /** What they are about, in words. */
  why: string | null;
  /** What it does to the stores as it ends. */
  effect: Effect | null;
};

/**
 * Where a person works, what they carry there and back, and what they are at there; which way
 * they face at it, where it holds them to it (behind a market stall, facing the square); and
 * what they are about, in words.
 */
type Work = Point & {
  to: Carry | null;
  back: Carry | null;
  task: Task | null;
  face?: number;
  why: string | null;
};

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
 * wares; a trader's pack; a child sent to the well, its bucket. (Their day's one place of
 * work, where the town's needs do not send them about: Phase 39 M198.)
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
      why: string | null = null,
    ): Work => ({ ...clearSpot(ground, { x, z }), to, back, task, why }),
    // Beside their own home: a doorstep's way out, on a side clear of the walls (in a town, on
    // the street before it, a few steps along).
    nearHome = (
      out: number,
      to: Carry | null = null,
      back: Carry | null = to,
      task: Task | null = null,
      why: string | null = null,
    ): Work => ({
      ...(plan.town
        ? clearSpot(ground, streetDoor(home, (draw(21) - 0.5) * Math.min(12, out)))
        : doorstep(
            ground,
            home,
            angle,
            Math.max(out, (ground.homes[p.home]?.r ?? 5) + PERSON_REACH + 0.8),
          )),
      to,
      back,
      task,
      why,
    });
  if (p.child) {
    // Children play near home, or in the square on some days (and bring water from its well).
    return draw(2) < 0.4
      ? at(
          6 * Math.cos(angle),
          6 * Math.sin(angle),
          null,
          plan.market ? null : "water",
          "play",
          plan.market ? "Playing in the square" : "Playing in the square, and bringing water home",
        )
      : nearHome(8, null, null, "play", "Playing near home");
  }
  // The old keep near home: from sixty-two for upright apes, as late in any people's span.
  if (p.age >= (62 * (plan.body?.span ?? 70)) / 70)
    return nearHome(3, null, null, null, "Keeping near home in their old age");
  // As the village grows, its crafters (and a farmer or two between sowing and harvest)
  // build its next home: out with a beam, round the rising walls.
  const site = plan.life?.site;
  if (
    site &&
    (p.occupation === OCC.crafter ? draw(14) < 0.6 : p.occupation === OCC.farmer && draw(14) < 0.12)
  ) {
    const round = draw(15) * 2 * Math.PI;
    return at(
      site.x + 9 * Math.cos(round),
      site.z + 9 * Math.sin(round),
      "beam",
      null,
      "build",
      "Raising the new home",
    );
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
        reaping = season >= HARVEST[0] && season < HARVEST[1],
        sowing = season >= SOWING[0] && season < SOWING[1];
      return at(
        f.x + (draw(4) - 0.5) * f.w * 0.7,
        f.z + (draw(5) - 0.5) * f.d * 0.7,
        "tool",
        reaping ? "sheaf" : "tool",
        reaping ? "reap" : sowing ? "sow" : "hoe",
        reaping ? "Reaping: the harvest is in" : sowing ? "Sowing the field" : "Hoeing the field",
      );
    }
    case OCC.herder:
      return at(
        plan.pasture.x + plan.pasture.r * 0.8 * (draw(4) - 0.5) * 2,
        plan.pasture.z + plan.pasture.r * 0.8 * (draw(5) - 0.5) * 2,
        "staff",
        "staff",
        "herd",
        "Herding the flock",
      );
    case OCC.forager: {
      // By the water, some fish from its shore; the rest gather in the wild.
      if (plan.water && draw(12) < 0.4) {
        const d = Math.hypot(plan.water.x, plan.water.z) || 1,
          shore = d - 205,
          a = Math.atan2(plan.water.z, plan.water.x) + (draw(4) - 0.5) * 0.5;
        return at(
          shore * Math.cos(a),
          shore * Math.sin(a),
          "staff",
          "fish",
          "fish",
          "Fishing from the shore",
        );
      }
      const r = plan.wild + draw(4) * 250;
      return at(
        r * Math.cos(angle),
        r * Math.sin(angle),
        "basket",
        "basket",
        "gather",
        "Gathering what the wild gives",
      );
    }
    case OCC.trader: {
      // On a market day, behind a stall in the square (Phase 33 M175).
      const stalls = marketDay(plan, day) ? marketScene(plan) : null;
      if (stalls?.backs.length) {
        const s = stalls.backs[Math.floor(draw(6) * stalls.backs.length)]!;
        return {
          ...at(s.x, s.z, "sack", "sack", "haggle", "Selling at a stall on the market day"),
          face: s.yaw,
        };
      }
      // Some days out along the road; others at the market.
      return draw(6) < 0.45
        ? at(
            plan.road.x * 0.9,
            plan.road.z * 0.9,
            "pack",
            "pack",
            null,
            "Out along the road with a pack",
          )
        : at(
            10 * Math.cos(angle),
            10 * Math.sin(angle),
            null,
            "sack",
            "haggle",
            "Haggling over wares",
          );
    }
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
          mine.what === "stone"
            ? "Cutting stone at the quarry"
            : `Digging ${mine.what === "coal" ? "coal" : "ore"}`,
        );
      return at(
        WORKSHOP.x + 6 * Math.cos(angle),
        WORKSHOP.z + 6 * Math.sin(angle),
        null,
        draw(13) < 0.5 ? "sack" : null,
        "hammer",
        "At their craft by the market",
      );
    }
    case OCC.leader:
      return at(
        4 * Math.cos(angle),
        4 * Math.sin(angle),
        null,
        null,
        "talk",
        "Talking over the village's business",
      );
    default:
      return at(
        home.x + 5 * Math.cos(angle),
        home.z + 5 * Math.sin(angle),
        null,
        null,
        null,
        "About the house",
      );
  }
}

/** How long a walk takes at a people's own pace. */
function walkTime(a: Point, b: Point, pace: number): number {
  return Math.hypot(b.x - a.x, b.z - a.z) / pace;
}

/** How long a way is, end to end (metres). */
function lengthOf(way: readonly Point[]): number {
  let n = 0;
  for (let k = 0; k + 1 < way.length; k++)
    n += Math.hypot(way[k + 1]!.x - way[k]!.x, way[k + 1]!.z - way[k]!.z);
  return n;
}

/**
 * A step of an errand (Phase 39 M198): a walk to a place, carrying something; or a stay where they
 * are at a task, so many hours — the errand's own work as long as the stint allows (`flex`, from
 * `min` hours up) — and what it does to the stores as it ends.
 */
type Step = {
  readonly to?: Point;
  readonly hours?: number;
  readonly min?: number;
  readonly flex?: boolean;
  readonly task?: Task | null;
  readonly carry: Carry | null;
  readonly why: string | null;
  readonly face?: number | null;
  readonly effect?: Effect | null;
};

/** Where an errand would leave less than this of a stint, its work is drawn out to the stint's end. */
const MIN_ERRAND = 1.4 * HOUR;

/** The trees felled for timber and firewood: those every setting draws, and the nearest of them to a place. */
const FELLED = new WeakMap<VillagePlan, { trees: Tree[]; near: Map<string, Tree[]> }>();

/**
 * A tree to fell near `from` — one of the six nearest it, as `pick` falls — and where to stand at
 * it, facing it (null where the land grows none).
 */
function treeAt(plan: VillagePlan, from: Point, pick: number): (Point & { face: number }) | null {
  let w = FELLED.get(plan);
  if (!w) FELLED.set(plan, (w = { trees: treesOf(plan, 0.35), near: new Map() }));
  if (!w.trees.length) return null;
  const key = `${Math.round(from.x)},${Math.round(from.z)}`;
  let near = w.near.get(key);
  if (!near) {
    const far = (t: Tree) => Math.hypot(t.x - from.x, t.z - from.z);
    near = [...w.trees].sort((a, b) => far(a) - far(b)).slice(0, 6);
    if (w.near.size > 2000) w.near.clear();
    w.near.set(key, near);
  }
  const t = near[Math.min(near.length - 1, Math.floor(pick * near.length))]!,
    d = Math.hypot(from.x - t.x, from.z - t.z) || 1,
    stand = { x: t.x + ((from.x - t.x) / d) * 1.8, z: t.z + ((from.z - t.z) / d) * 1.8 };
  return { ...stand, face: Math.atan2(t.x - stand.x, t.z - stand.z) };
}

/**
 * A person's day as legs: [from, to) in seconds of the day, where, and doing what. `fine`: their
 * work as the town's needs set it, errand on errand (Phase 39 M198), every walk round what stands
 * in the way; else (a town watched growing, a day a frame) their work's one place, walked to
 * straight.
 */
function dayOf(plan: VillagePlan, index: number, day: number, fine: boolean): Leg[] {
  const pace = paceOf(plan.body);
  const p = plan.people[index]!,
    draw = dayDraw(p.ref, day),
    home = plan.homes[p.home]!,
    ground = groundFor(plan),
    // At home means at the doorstep, where they can be seen: outside the walls (on a side
    // clear of the neighbours' too; in a town, on its street before its door).
    doorOut = Math.max(7, (ground.homes[p.home]?.r ?? 5) + PERSON_REACH + 0.8),
    at = plan.town
      ? clearSpot(ground, streetDoor(home, (draw(20) - 0.5) * 5))
      : doorstep(ground, home, home.yaw + (draw(20) - 0.5) * 1.2, doorOut),
    work = workplace(plan, p, draw, day),
    rest = restDay(plan, day),
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
    field = drillGround(plan),
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
    why: string | null = null,
    effect: Effect | null = null,
  ) => {
    if (to > from)
      legs.push({ from, to, at: where, next: null, activity, carry, task, face, why, effect });
  };
  // A walk goes round the homes, the water and the rising walls, turning beside each (straight
  // across, in a town watched growing).
  const wayOf = (a: Point, b: Point): Point[] =>
    fine ? route(ground, a, b, PERSON_REACH) : [a, b];
  const along = (
    from: number,
    way: readonly Point[],
    carry: Carry | null,
    why: string | null,
  ): number => {
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
        why,
        effect: null,
      });
      t = to;
    }
    return t;
  };
  const go = (
    from: number,
    a: Point,
    b: Point,
    carry: Carry | null = null,
    why: string | null = null,
  ) => along(from, wayOf(a, b), carry, why);
  // A feast day (Phase 33 M174): the work done by mid-afternoon, and the evening at the feast —
  // at a table or in the ring about the fire, changing over halfway — until late (the young and
  // the old home sooner).
  const feast = feastOn(plan, day),
    dancesFirst = draw(22) < 0.45,
    seatU = draw(23),
    ringU = draw(24);
  const feasting = (from: number): number => {
    const until = (p.child ? 21 : p.age >= 62 ? 21.5 : FEAST_HOURS.over) * HOUR,
      swap = 19.75 * HOUR,
      first = feastPlace(plan, dancesFirst, dancesFirst ? ringU : seatU),
      then = feastPlace(plan, !dancesFirst, dancesFirst ? seatU : ringU),
      start = Math.max(from, FEAST_HOURS.gather * HOUR),
      dancing = "At the feast: dancing in the ring about the fire",
      eating = "At the feast: at the tables";
    stay(from, start, at, ACTIVITY.home);
    let s = go(start, at, first, null, "To the feast in the square");
    stay(
      s,
      swap,
      first,
      ACTIVITY.feasting,
      null,
      dancesFirst ? "dance" : "feast",
      first.yaw,
      dancesFirst ? dancing : eating,
    );
    s = go(Math.max(s, swap), first, then);
    stay(
      s,
      until,
      then,
      ACTIVITY.feasting,
      null,
      dancesFirst ? "feast" : "dance",
      then.yaw,
      dancesFirst ? eating : dancing,
    );
    return go(Math.max(s, until), then, at, null, "Home from the feast");
  };
  /** An evening in the square: talk in the rings (or blows), or the drill while at war. */
  const evening = (t: number, until: number): number => {
    if (drills) {
      t = go(t, at, rank, "spear", "To the drill, for the war");
      stay(t, until, rank, ACTIVITY.gathering, "spear", "drill", 0, "Drilling for the war");
      return go(until, rank, at, "spear");
    }
    t = go(t, at, square);
    stay(
      t,
      until,
      square,
      ACTIVITY.gathering,
      null,
      brawls ? "brawl" : "talk",
      toRing,
      brawls ? "Come to blows in the square: grievance runs high" : "Talking in the square",
    );
    return go(until, square, at);
  };
  stay(0, rise, at, ACTIVITY.asleep);
  stay(rise, rise + 0.75 * HOUR, at, ACTIVITY.eating);
  let t = rise + 0.75 * HOUR;
  // A market morning (Phase 33 M175): the old and some of the rest go to buy at a stall before
  // the day's work, and come home with what they bought.
  const stalls = marketDay(plan, day) ? marketScene(plan) : null,
    front = stalls?.fronts.length
      ? stalls.fronts[Math.floor(draw(25) * stalls.fronts.length)]!
      : null;
  if (front && !p.child && p.occupation !== OCC.trader && (p.age >= 62 || draw(26) < 0.3)) {
    const open = MARKET_HOURS.buy * HOUR;
    stay(t, open, at, ACTIVITY.home);
    t = go(Math.max(t, open), at, front, null, "To the market");
    const done = Math.max(t, (p.age >= 62 ? 11 : 9.5) * HOUR);
    stay(t, done, front, ACTIVITY.gathering, null, "haggle", front.yaw, "Buying at the market", {
      kind: "grain",
      amount: -1,
    });
    t = go(done, front, at, "sack", "Home with what they bought");
  }
  const town = fine && !rest ? townDay(plan, day, ground) : null,
    role = town?.roles[index];
  if (rest || p.age >= 62) {
    const ease = (feast ? FEAST_HOURS.gather : 17) * HOUR;
    stay(t, ease, at, p.child ? ACTIVITY.playing : ACTIVITY.resting, null, p.child ? "play" : null);
    t = feast ? feasting(Math.max(t, ease)) : evening(Math.max(t, 17 * HOUR), 19.5 * HOUR);
  } else if (town && role && role.kind !== "as-ever") {
    // Their work as the town's needs set it (Phase 39 M198): errand on errand through the morning
    // and the afternoon, their bread eaten where they are at noon; home by the granary on the
    // days they fetch the household's (or bring in the flock's milk).
    const stop = feast ? 15 * HOUR : 17.5 * HOUR;
    let s = errands(t, 12 * HOUR, at, role, town, 0);
    stay(
      s.t,
      Math.max(s.t, 12.75 * HOUR),
      s.at,
      ACTIVITY.eating,
      null,
      null,
      null,
      "Their bread at noon",
    );
    s = errands(Math.max(s.t, 12.75 * HOUR), stop, s.at, role, town, 100);
    t = homeward(s.t, s.at, s.carry, role, town);
    if (feast) t = feasting(t);
    else if ((drills || draw(11) < 0.3) && t < 19 * HOUR) t = evening(t, 20 * HOUR);
  } else {
    const doing = p.child ? ACTIVITY.playing : ACTIVITY.working,
      far = walkTime(at, work, pace) > 0.6 * HOUR,
      // (On a feast day the work is put down by mid-afternoon.)
      stop = feast ? 15 * HOUR : null;
    // (Out with what they work with; at work with it in hand; back with what they worked.)
    t = go(t, at, work, work.to);
    // Those who work near home come back to eat at noon; the rest eat where they are.
    if (far) {
      stay(t, 12 * HOUR, work, doing, work.to, work.task, work.face, work.why);
      stay(Math.max(t, 12 * HOUR), Math.max(t, 12.75 * HOUR), work, ACTIVITY.eating);
      stay(
        Math.max(t, 12.75 * HOUR),
        stop ?? 17.25 * HOUR,
        work,
        doing,
        work.to,
        work.task,
        work.face,
        work.why,
      );
      t = go(Math.max(t, stop ?? 17.25 * HOUR), work, at, work.back);
    } else {
      stay(t, 12 * HOUR, work, doing, work.to, work.task, work.face, work.why);
      t = go(Math.max(t, 12 * HOUR), work, at, work.back);
      stay(t, t + 0.75 * HOUR, at, ACTIVITY.eating);
      t = go(t + 0.75 * HOUR, at, work, work.to);
      stay(t, stop ?? 17.5 * HOUR, work, doing, work.to, work.task, work.face, work.why);
      t = go(Math.max(t, stop ?? 17.5 * HOUR), work, at, work.back);
    }
    // The feast, or some evenings in the square (every evening, for those who drill).
    if (feast) t = feasting(t);
    else if ((drills || draw(11) < 0.3) && t < 19 * HOUR) t = evening(t, 20 * HOUR);
  }
  stay(t, Math.max(t, bed - 0.5 * HOUR), at, ACTIVITY.eating);
  stay(Math.max(t, bed - 0.5 * HOUR), bed, at, ACTIVITY.home);
  stay(Math.max(t, bed), DAY, at, ACTIVITY.asleep);
  return legs;

  /**
   * The errands of a stint of work (Phase 39 M198), from `start` at `from` until `until`: one
   * after another while one fits, its work drawn out to the stint's end where another would not;
   * where they are when it is done, and what they carry.
   */
  function errands(
    from: number,
    until: number,
    start: Point,
    role: Role,
    town: TownDay,
    k0: number,
  ): { t: number; at: Point; carry: Carry | null } {
    let t = from,
      here = start,
      carry: Carry | null = null,
      done = 0;
    for (let k = k0; k < k0 + 16 && t < until - 60; k++) {
      const steps = errandOf(role, town, k);
      if (!steps) break;
      // Each walk's way, and how long the errand takes but for its work.
      const ways: Point[][] = [];
      let fixed = 0,
        pos = here;
      for (const st of steps)
        if (st.to) {
          const way = wayOf(pos, st.to);
          ways.push(way);
          fixed += lengthOf(way) / pace;
          pos = st.to;
        } else if (!st.flex) fixed += (st.hours ?? 0) * HOUR;
      const job = steps.find((st) => st.flex),
        room = until - t - fixed,
        most = (job?.hours ?? 0) * HOUR;
      if (room < (job?.min ?? 0) * HOUR) break;
      const flex = !job ? 0 : room - most < MIN_ERRAND ? Math.min(room, most * 1.8) : most;
      let w = 0;
      pos = here;
      for (const st of steps) {
        if (st.to) {
          t = along(t, ways[w++]!, st.carry, st.why);
          pos = st.to;
          continue;
        }
        const d = st.flex ? flex : (st.hours ?? 0) * HOUR;
        stay(
          t,
          t + d,
          pos,
          ACTIVITY.working,
          st.carry,
          st.task ?? null,
          st.face ?? null,
          st.why,
          st.effect ?? null,
        );
        t += d;
      }
      here = pos;
      const last = steps[steps.length - 1]!;
      carry = last.task === "load" ? null : last.carry;
      done++;
    }
    // (What is left of the stint where nothing more fits, or nothing at all: at their ease.)
    if (t < until && !done) {
      stay(t, until, here, ACTIVITY.resting);
      t = until;
    }
    return { t, at: here, carry };
  }

  /** The k-th errand of a role's day (0 the first of the morning, 100 of the afternoon). */
  function errandOf(role: Role, town: TownDay, k: number): Step[] | null {
    const spots = storeSpots(plan, ground, day * DAY),
      granary = spots.granary,
      yard = spots.yard,
      first = k === 0,
      season = (day % 365) / 365,
      // (The k-th errand's own draws: a stretch of the field, a tree, a spot in the wild.)
      at2 = (a: number, b: number) => [draw(k ? a + k : 4), draw(k ? b + k : 5)] as const;
    switch (role.kind) {
      case "reap": {
        const f = fieldSpot(k);
        return [
          { to: f, carry: "tool", why: "Out to the harvest" },
          {
            flex: true,
            hours: 2.5,
            min: 0.5,
            task: "reap",
            carry: "tool",
            why: "Reaping: the harvest is in",
          },
          { to: granary.door, carry: "sheaf", why: `Bringing the sheaves in to ${granary.words}` },
          {
            hours: 0.08,
            task: "load",
            carry: "sheaf",
            why: `Stacking the sheaves in ${granary.words}`,
            effect: { kind: "grain", amount: 1 },
          },
        ];
      }
      case "sow": {
        const f = fieldSpot(0),
          sowing: Step[] = [
            { to: f, carry: "sack", why: "Out to sow the field" },
            {
              flex: true,
              hours: 7,
              min: 0.25,
              task: "sow",
              carry: "sack",
              why: "Sowing the field with the granary's seed",
            },
          ];
        return first
          ? [
              { to: granary.door, carry: null, why: `To ${granary.words} for seed` },
              {
                hours: 0.08,
                task: "load",
                carry: null,
                why: "Taking seed from the store",
                effect: { kind: "grain", amount: -1 },
              },
              ...sowing,
            ]
          : sowing;
      }
      case "hoe":
        return [
          { to: fieldSpot(k < 100 ? 0 : 1), carry: "tool", why: "Out to the fields" },
          {
            flex: true,
            hours: 7,
            min: 0.25,
            task: "hoe",
            carry: "tool",
            why:
              season >= WINTER || season < SOWING[0]
                ? "Ploughing the muck in for the spring"
                : season >= HARVEST[1]
                  ? "Turning the stubble after the harvest"
                  : "Hoeing between the rows",
          },
        ];
      case "firewood": {
        const tree = treeAt(plan, at, draw(10000 + k));
        if (!tree) return errandOf({ ...role, kind: "hoe" }, town, k);
        return [
          { to: tree, carry: "tool", why: "To the woods for firewood" },
          {
            flex: true,
            hours: 2,
            min: 0.5,
            task: "chop",
            carry: "tool",
            face: tree.face,
            why: "Cutting firewood for the winter",
          },
          { to: at, carry: "log", why: "Bringing the firewood home" },
          { hours: 0.06, task: "load", carry: "log", why: "Stacking the firewood by the door" },
        ];
      }
      case "gather":
      case "forage": {
        const lean = role.kind === "forage",
          a = draw(1) * 2 * Math.PI + (k ? (draw(3000 + k) - 0.5) * 0.5 : 0),
          r = plan.wild + draw(k ? 4000 + k : 4) * 250,
          w = clearSpot(ground, { x: r * Math.cos(a), z: r * Math.sin(a) });
        return [
          {
            to: w,
            carry: "basket",
            why: lean
              ? "Out to the wild: the granary has little to give"
              : "Out to gather in the wild",
          },
          {
            flex: true,
            hours: lean ? 3 : 2.5,
            min: 0.5,
            task: "gather",
            carry: "basket",
            why: lean
              ? "Gathering what the wild gives, the year being lean"
              : "Gathering what the wild gives",
          },
          lean
            ? { to: at, carry: "basket", why: "Home with what the wild gave" }
            : {
                to: granary.door,
                carry: "basket",
                why: `Bringing what the wild gave to ${granary.words}`,
              },
          {
            hours: 0.06,
            task: "load",
            carry: "basket",
            why: lean ? "Into the larder" : `Storing it in ${granary.words}`,
            effect: lean ? null : { kind: "food", amount: 1 },
          },
        ];
      }
      case "fish": {
        if (!plan.water) return errandOf({ ...role, kind: "gather" }, town, k);
        const d = Math.hypot(plan.water.x, plan.water.z) || 1,
          shore = d - 205,
          a = Math.atan2(plan.water.z, plan.water.x) + (draw(k ? 5000 + k : 4) - 0.5) * 0.5,
          w = clearSpot(ground, { x: shore * Math.cos(a), z: shore * Math.sin(a) });
        return [
          { to: w, carry: "staff", why: "Down to the shore to fish" },
          {
            flex: true,
            hours: 3,
            min: 0.5,
            task: "fish",
            carry: "staff",
            why: "Fishing from the shore",
          },
          { to: granary.door, carry: "fish", why: `Bringing the catch to ${granary.words}` },
          {
            hours: 0.08,
            task: "load",
            carry: "fish",
            why: "Laying the catch in the store",
            effect: { kind: "food", amount: 1 },
          },
        ];
      }
      case "herd": {
        const [u, v] = at2(6000, 7000);
        return [
          {
            to: clearSpot(ground, {
              x: plan.pasture.x + plan.pasture.r * 0.8 * (u - 0.5) * 2,
              z: plan.pasture.z + plan.pasture.r * 0.8 * (v - 0.5) * 2,
            }),
            carry: "staff",
            why: "Out to the flock",
          },
          {
            flex: true,
            hours: 7,
            min: 0.25,
            task: "herd",
            carry: "staff",
            why: "Herding the flock",
          },
        ];
      }
      case "build": {
        const site = town.sites[role.site];
        if (!site) return errandOf({ ...role, kind: "workshop" }, town, k);
        const stone = site.stone && plan.works?.mine?.what === "stone" && k % 2 === 1,
          n = site.spots.length,
          spot = n
            ? site.spots[(Math.floor(draw(11000) * n) + k) % n]!
            : clearSpot(ground, { x: site.x + 8, z: site.z }),
          what = stone ? "stone" : "a beam";
        return [
          { to: yard.door, carry: null, why: `To ${yard.words} for ${stone ? "stone" : "timber"}` },
          {
            hours: 0.06,
            task: "load",
            carry: null,
            why: `Taking ${what} from ${yard.words}`,
            effect: { kind: stone ? "stone" : "wood", amount: -1 },
          },
          { to: spot, carry: stone ? "stone" : "beam", why: `Carrying ${what} to ${site.name}` },
          {
            flex: true,
            hours: 2,
            min: 0.5,
            task: "build",
            carry: null,
            face: Math.atan2(site.x - spot.x, site.z - spot.z),
            why: `Raising ${site.name}`,
          },
        ];
      }
      case "cut": {
        const tree = treeAt(plan, yard.door, draw(10000 + k));
        if (!tree) return errandOf({ ...role, kind: "workshop" }, town, k);
        return [
          { to: tree, carry: "tool", why: "Out to fell timber for the builders" },
          {
            flex: true,
            hours: 1.5,
            min: 0.4,
            task: "chop",
            carry: "tool",
            face: tree.face,
            why: "Felling timber for the builders",
          },
          { to: yard.door, carry: "log", why: `Bringing the timber to ${yard.words}` },
          {
            hours: 0.08,
            task: "load",
            carry: "log",
            why: `Stacking the timber in ${yard.words}`,
            effect: { kind: "wood", amount: 1 },
          },
        ];
      }
      case "quarry":
      case "mine": {
        const mine = plan.works?.mine;
        if (!mine) return errandOf({ ...role, kind: "workshop" }, town, k);
        const stone = role.kind === "quarry",
          what = mine.what === "coal" ? "coal" : "ore",
          [u, v] = at2(8000, 9000);
        return [
          {
            to: clearSpot(ground, { x: mine.x + (u - 0.5) * 20, z: mine.z + (v - 0.5) * 20 }),
            carry: "tool",
            why: stone ? "To the quarry" : "To the mine",
          },
          {
            flex: true,
            hours: 2.5,
            min: 0.5,
            task: "dig",
            carry: "tool",
            why: stone ? "Cutting stone at the quarry" : `Digging ${what}`,
          },
          {
            to: yard.door,
            carry: stone ? "stone" : "ore",
            why: stone
              ? `Bringing the stone to ${yard.words}`
              : `Bringing the ${what} up to ${yard.words}`,
          },
          {
            hours: 0.08,
            task: "load",
            carry: stone ? "stone" : "ore",
            why: `Heaping it in ${yard.words}`,
            effect: { kind: stone ? "stone" : "ore", amount: 1 },
          },
        ];
      }
      case "smith":
        return [
          { to: yard.door, carry: null, why: `To ${yard.words} for ore` },
          {
            hours: 0.06,
            task: "load",
            carry: null,
            why: "Taking ore to forge",
            effect: { kind: "ore", amount: -1 },
          },
          { to: spots.smithy.door, carry: "ore", why: `Carrying the ore to ${spots.smithy.words}` },
          {
            flex: true,
            hours: 2.5,
            min: 0.5,
            task: "hammer",
            carry: null,
            why: "Forging tools from the ore",
          },
          { to: granary.door, carry: "tool", why: `Bringing the new tools to ${granary.words}` },
          {
            hours: 0.06,
            task: "load",
            carry: "tool",
            why: "Storing the new tools",
            effect: { kind: "tools", amount: 1 },
          },
        ];
      case "workshop":
      case "mend": {
        const mend = role.kind === "mend",
          a = draw(1) * 2 * Math.PI,
          spot = mend
            ? at
            : clearSpot(ground, {
                x: WORKSHOP.x + 6 * Math.cos(a),
                z: WORKSHOP.z + 6 * Math.sin(a),
              });
        return [
          { to: spot, carry: null, why: mend ? "Home to mend" : "To the workshop" },
          {
            flex: true,
            hours: 7,
            min: 0.25,
            task: "hammer",
            carry: !mend && draw(13) < 0.5 ? "sack" : null,
            why: mend
              ? "Mending tools and fences in the slack season"
              : "At their craft by the market",
          },
        ];
      }
      default:
        return null;
    }
  }

  /** A stretch of their field for the k-th errand: the same field all day, another stretch of it. */
  function fieldSpot(k: number): Point {
    const f = plan.fields[Math.floor(draw(3) * plan.fields.length)] ?? {
      x: 120,
      z: 0,
      w: 30,
      d: 20,
      yaw: 0,
    };
    return clearSpot(ground, {
      x: f.x + (draw(k ? 1000 + k : 4) - 0.5) * f.w * 0.7,
      z: f.z + (draw(k ? 2000 + k : 5) - 0.5) * f.d * 0.7,
    });
  }

  /**
   * Home from the day's work: by the granary on a day they fetch the household's bread — none to
   * be had in a lean year — or bring in the flock's milk.
   */
  function homeward(
    t: number,
    from: Point,
    carry: Carry | null,
    role: Role,
    town: TownDay,
  ): number {
    if (!role.fetch && !role.milk) return go(t, from, at, carry, "Home from the day's work");
    const granary = storeSpots(plan, ground, day * DAY).granary;
    t = go(
      t,
      from,
      granary.door,
      role.milk ? "sack" : carry,
      role.milk ? "Bringing in the flock's milk" : `To ${granary.words} for the household's bread`,
    );
    if (role.milk) {
      stay(
        t,
        t + 0.06 * HOUR,
        granary.door,
        ACTIVITY.working,
        "sack",
        "load",
        null,
        "Leaving the milk in the store",
        {
          kind: "food",
          amount: 1,
        },
      );
      t += 0.06 * HOUR;
    }
    if (!role.fetch) return go(t, granary.door, at, null, "Home from the day's work");
    const bare = town.lean;
    stay(
      t,
      t + 0.06 * HOUR,
      granary.door,
      ACTIVITY.working,
      null,
      "load",
      null,
      bare ? "The granary has nothing to give: the year is lean" : "Taking the household's bread",
      bare ? null : { kind: "grain", amount: -1 },
    );
    t += 0.06 * HOUR;
    return go(
      t,
      granary.door,
      at,
      bare ? null : "sack",
      bare ? "Home empty-handed" : "Home with the household's bread",
    );
  }
}

// A day's legs, kept while the day lasts: the same person's same day is the same (for
// the plan as it stands: a plan re-read as the years turn keeps its own).
const DAYS = new WeakMap<VillagePlan, Map<string, Leg[]>>();
function legsOf(plan: VillagePlan, index: number, day: number, fine: boolean): Leg[] {
  let days = DAYS.get(plan);
  if (!days) DAYS.set(plan, (days = new Map()));
  const key = `${plan.people[index]!.ref}|${day}|${fine ? 1 : 0}`;
  let legs = days.get(key);
  if (!legs) {
    if (days.size > 6000) days.clear();
    days.set(key, (legs = dayOf(plan, index, day, fine)));
  }
  return legs;
}

/**
 * Lay out a day ahead, a few people at a time (Phase 39 M198): up to `most` more of those drawn,
 * and the day's book of the stores once all are laid — so the day's turn finds it ready. Whether
 * it is all laid.
 */
export function prepareDay(plan: VillagePlan, day: number, most: number): boolean {
  const days = DAYS.get(plan);
  let laid = 0;
  for (let i = 0; i < plan.people.length; i++) {
    if (days?.has(`${plan.people[i]!.ref}|${day}|1`)) continue;
    if (laid++ >= most) return false;
    legsOf(plan, i, day, true);
  }
  dayBook(plan, day);
  return true;
}

/** The leg a day's legs have at second s of it (its last, past them). */
function legAt(legs: readonly Leg[], s: number): Leg {
  // (They run in order: the last begun by s, if s is within it.)
  let lo = 0,
    hi = legs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (legs[mid]!.from <= s) lo = mid;
    else hi = mid - 1;
  }
  const l = legs[lo]!;
  if (s >= l.from && s < l.to) return l;
  return legs.find((x) => s >= x.from && s < x.to) ?? legs[legs.length - 1]!;
}

/** When each meal of a day's legs ends, in order (kept with the legs). */
const MEALS = new WeakMap<readonly Leg[], number[]>();
function lastMeal(legs: readonly Leg[], s: number): number {
  let ends = MEALS.get(legs);
  if (!ends) {
    ends = legs.filter((l) => l.activity === ACTIVITY.eating).map((l) => l.to);
    MEALS.set(legs, ends);
  }
  let last = -6 * HOUR;
  for (const e of ends) {
    if (e > s) break;
    last = e;
  }
  return last;
}

/** Whether the town goes hungry on a day (kept: asked for each of its people each frame). */
const LEAN = new WeakMap<VillagePlan, Map<number, boolean>>();
function leanDay(plan: VillagePlan, day: number): boolean {
  let days = LEAN.get(plan);
  if (!days) LEAN.set(plan, (days = new Map()));
  let lean = days.get(day);
  if (lean === undefined) {
    if (days.size > 400) days.clear();
    days.set(day, (lean = leanOn(plan, day)));
  }
  return lean;
}

/** Those at their ease (not at work, nor on their way, nor at the drill) go in out of a downpour. */
function atEase(leg: Leg): boolean {
  return (
    leg.activity === ACTIVITY.home ||
    leg.activity === ACTIVITY.eating ||
    leg.activity === ACTIVITY.playing ||
    leg.activity === ACTIVITY.resting ||
    leg.activity === ACTIVITY.feasting ||
    (leg.activity === ACTIVITY.gathering && leg.task !== "drill")
  );
}

/**
 * Where a watched person is at sim time t, and how they fare. `downpour`: the span of a downpour
 * over the village (world seconds; weather's downpourAt), if one falls — those at their ease in
 * it go home through it and in at their door, and come out again when it is over. `fine`: their
 * day as lived, errand on errand (Phase 39 M198); else as a town watched growing sees it.
 */
export function momentOf(
  plan: VillagePlan,
  index: number,
  t: number,
  downpour: { readonly from: number; readonly to: number } | null = null,
  fine = true,
): Moment {
  const day = Math.floor(t / DAY),
    s = t - day * DAY,
    legs = legsOf(plan, index, day, fine);
  const leg = legAt(legs, s);
  let x = leg.at.x,
    z = leg.at.z,
    yaw = leg.face ?? 0,
    activity: Activity = leg.activity,
    task = leg.task;
  const sheltering = !!downpour && t >= downpour.from && t < downpour.to && atEase(leg);
  if (sheltering) {
    // From where they were at their ease when it came on (or when they came to it, in it), home
    // to their doorstep and in.
    const door = legs[0]!.at,
      went = Math.max(downpour.from, day * DAY + leg.from),
      k = (t - went) / Math.max(1, walkTime(leg.at, door, paceOf(plan.body)));
    task = null;
    if (k < 1) {
      x += (door.x - leg.at.x) * k;
      z += (door.z - leg.at.z) * k;
      yaw = Math.atan2(door.x - leg.at.x, door.z - leg.at.z);
      activity = ACTIVITY.walking;
    } else {
      x = door.x;
      z = door.z;
      activity = ACTIVITY.sheltering;
    }
  } else if (leg.next) {
    const k = (s - leg.from) / Math.max(1, leg.to - leg.from);
    x += (leg.next.x - leg.at.x) * k;
    z += (leg.next.z - leg.at.z) * k;
    yaw = Math.atan2(leg.next.x - leg.at.x, leg.next.z - leg.at.z);
  } else if (leg.activity === ACTIVITY.working && leg.face !== null) {
    // Held to their work (behind a market stall, at a rising wall, at a tree): a step or two along
    // it, facing the way it does.
    const along = Math.sin(s / 600 + index) * (leg.task === "chop" ? 0.2 : 0.7);
    x += Math.cos(leg.face) * along;
    z -= Math.sin(leg.face) * along;
  } else if (
    (leg.activity === ACTIVITY.working && leg.task !== "load") ||
    leg.activity === ACTIVITY.playing
  ) {
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
  const where = { x, z };
  keepOut(groundFor(plan), where, PERSON_REACH);
  x = where.x;
  z = where.z;
  // Hunger rises between meals — sooner in a lean year — and tiredness through the waking day.
  const fed = lastMeal(legs, s),
    woke = legs[0]!.to,
    lean = leanDay(plan, day);
  return {
    x,
    z,
    yaw,
    activity,
    task,
    hidden: activity === ACTIVITY.asleep || activity === ACTIVITY.sheltering,
    carry: sheltering ? null : leg.carry,
    hunger: Math.max(0, Math.min(1, (s - fed) / ((lean ? 4.5 : 7) * HOUR))),
    tiredness:
      leg.activity === ACTIVITY.asleep ? 0 : Math.max(0, Math.min(1, (s - woke) / (16 * HOUR))),
    why: sheltering ? "In out of the downpour" : leg.why,
  };
}

/** A town's stores at a moment (Phase 39 M198), as its day has moved them; and what is going up. */
export type StoresNow = {
  /** What it holds of each kind now. */
  readonly have: StoreBook;
  /** What has come in, and gone out, of each kind since the day began. */
  readonly brought: StoreBook;
  readonly taken: StoreBook;
  /** How many months its grain and other food would last, going as they go. */
  readonly months: number;
  /** How many months each store would last, going as it goes (99 at most). */
  readonly lasts: StoreBook;
  readonly lean: boolean;
  /** Who of those drawn does what today, the most first. */
  readonly doing: readonly { readonly kind: RoleKind; readonly n: number }[];
  /** What is going up today, and how many of those drawn are at work on each. */
  readonly sites: readonly {
    readonly words: string;
    readonly x: number;
    readonly z: number;
    readonly hands: number;
  }[];
};

/** The yard's loads to spare at the day's start, over what its day takes from it. */
const YARD_SPARE = 6;

/** What the yard keeps of a kind with none brought or taken: timber always; stone where it is quarried. */
function yardSpare(plan: VillagePlan, kind: StoreKind): number {
  return kind === "wood" || plan.works?.mine?.what === "stone" ? YARD_SPARE : 0;
}

type DayBook = {
  readonly opening: StoreBook;
  /** What comes in (or goes out) through the day where none of those drawn brings or takes it. */
  readonly smooth: StoreBook;
  readonly events: readonly {
    readonly at: number;
    readonly kind: StoreKind;
    readonly amount: number;
  }[];
};
const BOOKS = new WeakMap<VillagePlan, Map<number, DayBook>>();

/**
 * A day's book of the town's stores: what they held at its start (history's; the yard as much as
 * its day takes from it, and some to spare), and each load brought in or taken through it, those
 * drawn standing for the whole town — history's flow for the day shared among those who bring it
 * (and those who take it), what none of them brings coming in through the day as it does.
 */
function dayBook(plan: VillagePlan, day: number): DayBook {
  let days = BOOKS.get(plan);
  if (!days) BOOKS.set(plan, (days = new Map()));
  const known = days.get(day);
  if (known) return known;
  const raw: { at: number; kind: StoreKind; amount: number }[] = [];
  for (let i = 0; i < plan.people.length; i++)
    for (const l of legsOf(plan, i, day, true))
      if (l.effect) raw.push({ at: l.to, kind: l.effect.kind, amount: l.effect.amount });
  raw.sort((p, q) => p.at - q.at);
  const a = day * DAY,
    opening = {} as Record<StoreKind, number>,
    smooth = {} as Record<StoreKind, number>,
    events: { at: number; kind: StoreKind; amount: number }[] = [];
  for (const kind of STORE_KINDS) {
    const mine = raw.filter((e) => e.kind === kind);
    if (kind === "wood" || kind === "stone") {
      let level = 0,
        low = 0;
      for (const e of mine) {
        level += e.amount;
        low = Math.min(low, level);
      }
      opening[kind] = (mine.length ? YARD_SPARE : yardSpare(plan, kind)) - low;
      smooth[kind] = 0;
      events.push(...mine);
      continue;
    }
    const flow = storeFlow(plan, kind, a, a + DAY),
      ins = mine.filter((e) => e.amount > 0).length,
      outs = mine.length - ins;
    opening[kind] = storeAt(plan, kind, a);
    smooth[kind] = (ins ? 0 : flow.made) - (outs ? 0 : flow.used);
    for (const e of mine)
      events.push({ at: e.at, kind, amount: e.amount > 0 ? flow.made / ins : -flow.used / outs });
  }
  events.sort((p, q) => p.at - q.at);
  const book: DayBook = { opening, smooth, events };
  if (days.size > 40) days.clear();
  days.set(day, book);
  return book;
}

/**
 * A town's stores at moment t (Phase 39 M198): `fine`, as its day's errands have moved them, each
 * load brought or taken a step; else (a town watched growing) as history's books have them. And
 * what is going up on the day, with how many of those drawn are at work on each.
 */
export function storesNow(plan: VillagePlan, t: number, fine = true): StoresNow {
  const day = Math.floor(t / DAY),
    s = t - day * DAY,
    have = {} as Record<StoreKind, number>,
    brought = {} as Record<StoreKind, number>,
    taken = {} as Record<StoreKind, number>,
    ground = groundFor(plan);
  if (fine) {
    const book = dayBook(plan, day);
    for (const k of STORE_KINDS) {
      const part = (book.smooth[k] * s) / DAY;
      have[k] = book.opening[k] + part;
      brought[k] = Math.max(0, part);
      taken[k] = Math.max(0, -part);
    }
    for (const e of book.events) {
      if (e.at > s) break;
      have[e.kind] += e.amount;
      if (e.amount > 0) brought[e.kind] += e.amount;
      else taken[e.kind] -= e.amount;
    }
  } else
    for (const k of STORE_KINDS) {
      const yard = k === "wood" || k === "stone",
        f = yard ? { made: 0, used: 0 } : storeFlow(plan, k, day * DAY, t);
      have[k] = yard ? yardSpare(plan, k) : storeAt(plan, k, t);
      brought[k] = f.made;
      taken[k] = f.used;
    }
  for (const k of STORE_KINDS) have[k] = Math.max(0, have[k]);
  const sites = sitesOn(plan, day, ground),
    town = townDay(plan, day, ground),
    hands = sites.map(() => 0),
    count = new Map<RoleKind, number>(),
    lasts = {} as Record<StoreKind, number>;
  town.roles.forEach((r, i) => {
    if (r.kind === "build" && r.site >= 0) hands[r.site] = (hands[r.site] ?? 0) + 1;
    if (r.kind !== "as-ever" || !plan.people[i]!.child)
      count.set(r.kind, (count.get(r.kind) ?? 0) + 1);
  });
  for (const k of STORE_KINDS) lasts[k] = monthsOf(plan, [k], have[k]);
  return {
    have,
    brought,
    taken,
    months: monthsOf(plan, ["grain", "food"], have.grain + have.food),
    lasts,
    lean: town.lean,
    doing: [...count].map(([kind, n]) => ({ kind, n })).sort((p, q) => q.n - p.n),
    sites: sites.map((x, k) => ({ words: x.words, x: x.x, z: x.z, hands: hands[k]! })),
  };
}

/** The nearest place to `p` clear of every wall (itself, if it is), a few steps about it. */
function clearSpot(ground: Ground, p: Point): Point {
  const clear = (q: Point) => clearAt(ground, q, PERSON_REACH);
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

// Where the young drill while their realm is at war, and its men muster for it (M204): open
// ground just past the homes, off the fields, the pasture, the road and the water.
const FIELDS = new WeakMap<VillagePlan, Point>();
export function drillGround(plan: VillagePlan): Point {
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

/** A village's solid ground for its people: its homes, its water and its rising walls. */
export function villageSolids(plan: VillagePlan): Ground {
  return groundFor(plan);
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
  chop: "🪓",
  load: "📦",
  reap: "🌾",
  sow: "🌱",
  dig: "⛏️",
  drill: "⚔️",
  brawl: "💢",
  play: "😄",
  herd: "🐑",
  haggle: "💰",
  // Visitors from another star (Phase 18 M134), and how the land met them.
  visitors: "🛸",
  wonder: "✨",
  fear: "😨",
  // Bonds and freedoms (Phase 19 M138): the bound among them, a rising, a freedom won.
  bondage: "⛓️",
  rising: "✊",
  freedom: "🕊️",
  // A new law in the realm (Phase 19 M139).
  law: "📜",
  // A sickness among them (Phase 20 M140).
  sickness: "🤒",
  // At a feast (Phase 33 M174): a song as they dance, the food, a cup raised.
  dance: "🎶",
  feast: "🍖",
  cheers: "🍻",
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
  if (m.task === "dance") return pick < 0.6 ? SIGNS.dance! : SIGNS.laugh!;
  if (m.task === "feast")
    return pick < 0.35 ? SIGNS.cheers! : pick < 0.7 ? SIGNS.feast! : SIGNS.laugh!;
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
  // From just past the homes out (the fields are kept clear of trees one by one) — past a
  // town's edge.
  let reach = 40;
  for (const h of plan.homes) reach = Math.max(reach, Math.hypot(h.x, h.z));
  if (plan.town) reach = Math.max(reach, villageGround(plan).homesReach);
  const inner = reach + 25,
    outer = Math.min(1300, inner + 600);
  if (outer < inner + 50) return [];
  const seed = hashText(plan.ref),
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

export function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function unitOf(seed: number, i: number, n: number): number {
  let h = Math.imul(seed ^ Math.imul(i + 1, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(n + 1, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
