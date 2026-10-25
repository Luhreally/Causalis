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
import {
  LOT,
  SQUARE,
  STORE_KINDS,
  type StoreBook,
  type StoreKind,
  type VillagePlan,
  type Wonder,
} from "../bridge/index.ts";
import { OCC } from "../rules/index.ts";
import { paceOf } from "./figure.ts";
import { clearAt, clearOf, keepOut, route, villageGround, type Ground } from "./ground.ts";
import { streetDoor } from "./streets.ts";
import { FEAST_HOURS, MARKET_HOURS, feastOn, feastPlace, marketDay, marketScene } from "./feast.ts";
import { FLAMES_S, strikeSpan } from "./town.ts";
import {
  FUNERAL,
  funeralsOf,
  funeralsOn,
  graveyardAt,
  gravesBefore,
  plotAt,
  type Funeral,
  type Graveyard,
} from "./graveyard.ts";
import type { Carry } from "./work.ts";
import { hashText, unitOf } from "./draws.ts";
import { FLOCK_HANDS, herderAt, keepsFlock } from "./flock.ts";
import { ROW_ENDS, ROW_GAP, rowsOf } from "./country.ts";
import {
  REAP_HOURS,
  blightedRow,
  burnSpot,
  cutPoint,
  fieldsNow,
  fieldsWords,
  reapingOn,
  rowPoint,
  stooksOf,
} from "./fields.ts";
import {
  HARVEST,
  SOWING,
  WINTER,
  WORKSHOP,
  beside,
  civicDoors,
  dayDraw,
  leanOn,
  monthsOf,
  oldOf,
  restDay,
  sceneOf,
  sitesOn,
  storeAt,
  storeFlow,
  storeSpots,
  townDay,
  type Role,
  type RoleKind,
  type TownDay,
} from "./errands.ts";

export { HARVEST, SOWING, restDay, hashText, unitOf };

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
  // At the town's own buildings (Phase 41 M199): children at their letters, a hand up now and
  // then; the faithful at prayer; a potter at the wheel; the kiln's fire and the millstones tended.
  "learn",
  "pray",
  "throw",
  "tend",
  // A fire fought (Phase 42 M201): water thrown on it, buckets passed down the line and filled at
  // its water; those come to watch.
  "douse",
  "pass",
  "fill",
  "watch",
  // A funeral (Phase 43 M205): its dead mourned; borne on a bier on the way to the graveyard.
  "mourn",
  "bear",
  // The year in the fields (Phase 44 M206): water poured on a parched row; a blighted crop pulled.
  "water",
  "pull",
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

/** Where a day's legs have them at second s of it. */
function whereAt(legs: readonly Leg[], s: number): Point {
  const l = legAt(legs, s);
  if (!l.next || l.to <= l.from) return l.at;
  const k = Math.max(0, Math.min(1, (s - l.from) / (l.to - l.from)));
  return { x: l.at.x + (l.next.x - l.at.x) * k, z: l.at.z + (l.next.z - l.at.z) * k };
}

/**
 * A day's legs between seconds a and b of it: those within whole, those crossing either end cut
 * there (a walk cut where it had come to, at its own pace; what a cut stay does to the stores, not
 * done).
 */
function cutLegs(legs: readonly Leg[], a: number, b: number): Leg[] {
  const out: Leg[] = [];
  for (const l of legs) {
    if (l.to <= a || l.from >= b) continue;
    const from = Math.max(l.from, a),
      to = Math.min(l.to, b);
    if (to <= from) continue;
    if (from === l.from && to === l.to) {
      out.push(l);
      continue;
    }
    const at = l.next ? whereAt([l], from) : l.at,
      next = l.next ? whereAt([l], to) : null;
    out.push({ ...l, from, to, at, next, effect: null });
  }
  return out;
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
  /** What they are at while at it (at work, if not said: a child's afternoon is at play). */
  readonly activity?: Activity;
  /**
   * Where the work goes on as it is done (Phase 44 M206: a reaper at a field's front as it moves
   * along its rows), by the seconds of the day, and which way they face there; null: as they were.
   */
  readonly follow?: (
    s: number,
  ) => (Point & { readonly face: number; readonly why?: string }) | null;
};

/** At work that moves (a reaper following the front), a leg each so many seconds. */
const FOLLOW_STEP = 300;

/** Where an errand would leave less than this of a stint, its work is drawn out to the stint's end. */
const MIN_ERRAND = 1.4 * HOUR;

// —— The woodlot (Phase 41 M200) ———————————————————————————————————————————————

/**
 * How long a felled tree's stump stands (days), and how long the sapling grown up beside it takes
 * to be a tree to fell again.
 */
export const STUMP_DAYS = 120,
  SAPLING_DAYS = 3 * 365;
/** How long a tree takes to come down (world seconds); the least it lies before the last of it is carried off. */
const FALL_S = 40,
  LIES_S = 2 * HOUR;

/**
 * A town's woodlot: the trees every setting draws (not the scrub), the nearest its yard first;
 * each felled while the town was watched — by where it stood, to the metre, so that it is carried
 * on as the town's plan is read again each year — and the day it came down; and each day's
 * fellers, at which tree (by their place in its people).
 */
type Woodlot = {
  readonly plan: VillagePlan;
  readonly trees: readonly Tree[];
  readonly order: readonly number[];
  readonly felled: Map<string, number>;
  readonly days: Map<number, Map<number, Feller>>;
  /** For firewood: the six nearest a place. */
  readonly near: Map<string, number[]>;
};
const WOODLOTS = new Map<string, Woodlot>();
const treeKey = (t: Tree) => `${Math.round(t.x)},${Math.round(t.z)}`;

function woodlotOf(plan: VillagePlan): Woodlot {
  const was = WOODLOTS.get(plan.ref);
  if (was?.plan === plan) return was;
  const yard = storeSpots(plan, groundFor(plan), 0).yard.door,
    trees = treesOf(plan, 0.35),
    far = (k: number) => Math.hypot(trees[k]!.x - yard.x, trees[k]!.z - yard.z),
    order = trees
      .flatMap((t, k) => (t.kind === "shrub" ? [] : [k]))
      .sort((a, b) => far(a) - far(b));
  if (!was && WOODLOTS.size >= 6) WOODLOTS.clear();
  const w: Woodlot = {
    plan,
    trees,
    order,
    felled: was?.felled ?? new Map(),
    days: new Map(),
    near: new Map(),
  };
  WOODLOTS.set(plan.ref, w);
  return w;
}

/** A feller's tree of the day (its place in the woodlot's trees), and their place about it (0: on the yard's side). */
type Feller = { readonly tree: number; readonly seat: number };

/**
 * How many of the woodlot's trees come down in a day at most — one for every two hundred it has,
 * and one at least, so that the drawn woods stand for the many more the town fells — and how many
 * fell one together. (The rest of the day's fellers go out to the far woods.)
 */
const treesADay = (n: number) => Math.max(1, Math.ceil(n / 200)),
  TO_A_TREE = 3;

/** Whether a tree of the woodlot stands grown on a day (felled that very day, it stood that morning). */
function grownOn(w: Woodlot, k: number, day: number): boolean {
  const was = w.felled.get(treeKey(w.trees[k]!));
  return was === undefined || was >= day || day - was >= STUMP_DAYS + SAPLING_DAYS;
}

/**
 * Each feller's tree on a day (by their place in the town's people): the next grown trees nearest
 * the yard, as many as the woodlot gives a day, one feller to each and then the rest to them in
 * turn, three to a tree — each marked felled that day as it is given. Those left over have none.
 */
function fellersOn(plan: VillagePlan, day: number): ReadonlyMap<number, Feller> {
  const w = woodlotOf(plan),
    known = w.days.get(day);
  if (known) return known;
  const today = new Map<number, Feller>();
  w.days.set(day, today);
  const fellers = townDay(plan, day, groundFor(plan)).roles.flatMap((r, i) =>
      r.kind === "cut" ? [i] : [],
    ),
    trees: number[] = [];
  let cursor = 0;
  for (const i of fellers) {
    if (trees.length >= treesADay(w.order.length)) break;
    while (cursor < w.order.length) {
      const k = w.order[cursor++]!;
      if (!grownOn(w, k, day)) continue;
      trees.push(k);
      today.set(i, { tree: k, seat: 0 });
      w.felled.set(treeKey(w.trees[k]!), day);
      break;
    }
  }
  let turn = 0;
  for (const i of fellers.slice(trees.length)) {
    if (!trees.length || turn >= trees.length * (TO_A_TREE - 1)) break;
    today.set(i, { tree: trees[turn % trees.length]!, seat: 1 + Math.floor(turn / trees.length) });
    turn++;
  }
  for (const d of [...w.days.keys()]) if (d < day - 2) w.days.delete(d);
  return today;
}

/**
 * Where to stand at a tree, coming from a place: a step short of it, facing it — the first on
 * the way's side of it (it falls away from them), those helping a turn round it either side.
 */
function standAt(t: Tree, from: Point, seat = 0): Point & { face: number } {
  const a = Math.atan2(from.z - t.z, from.x - t.x) + [0, 1.25, -1.25][seat % 3]!,
    stand = { x: t.x + Math.cos(a) * 1.8, z: t.z + Math.sin(a) * 1.8 };
  return { ...stand, face: Math.atan2(t.x - stand.x, t.z - stand.z) };
}

/**
 * A tree to cut firewood from near `from` on a day — one of the six nearest it still grown, as
 * `pick` falls — and where to stand at it, facing it (null where the land grows none).
 */
function treeAt(
  plan: VillagePlan,
  from: Point,
  pick: number,
  day: number,
): (Point & { face: number }) | null {
  const w = woodlotOf(plan);
  if (!w.order.length) return null;
  const key = `${Math.round(from.x)},${Math.round(from.z)}`;
  let near = w.near.get(key);
  if (!near) {
    const far = (k: number) => Math.hypot(w.trees[k]!.x - from.x, w.trees[k]!.z - from.z);
    near = [...w.order].sort((a, b) => far(a) - far(b)).slice(0, 12);
    if (w.near.size > 2000) w.near.clear();
    w.near.set(key, near);
  }
  const grown = near.filter((k) => grownOn(w, k, day)).slice(0, 6);
  if (!grown.length) return null;
  return standAt(
    w.trees[grown[Math.min(grown.length - 1, Math.floor(pick * grown.length))]!]!,
    from,
  );
}

// —— The town in trouble (Phase 42 M201) ———————————————————————————————————————————————

/** The well in the middle of a town's square (metres), where its bucket lines draw lacking better water. */
export const TOWN_WELL: Point = { x: 0, z: 0 };

/** Where one of the god's wonders stands in a town (metres): where the hand set it, else by its square. */
export function wonderSpot(plan: VillagePlan, w: Wonder): Point {
  const p =
    w.x !== null && w.z !== null
      ? { x: w.x, z: w.z }
      : w.kind === "spring"
        ? { x: -15, z: 11 }
        : { x: 13, z: -13 };
  return clearSpot(groundFor(plan), p);
}

/** How long after a home catches the alarm is raised (seconds), and how long a fire is fought at most. */
const ALARM_S = 4 * 60,
  FIGHT_S = 4 * HOUR;
/**
 * The most at a fire's bucket line (two of them throwing at the fire), the most come to watch it
 * close by, and the most of the rest who hear it gathered farther back, a crowd.
 */
const LINE_MOST = 14,
  THROWERS = 2,
  WATCHERS = 10,
  CROWD = 24;
/** How many homes a quake threw down are dug through at once, three at each. */
const DUG = 6;
/** How far a bucket line reaches from its water (metres): farther off, they run with their buckets. */
const LINE_REACH = 70;
/** How near a fire a home's water butt is drawn on, where no water is near enough for a line (metres). */
const BUTT_FROM = 16,
  BUTT_TO = 55;
/** How far off one hears the alarm and comes (metres, from their home to the fire). */
const HEARS = 260;
/** How long after one bier the next is taken up and borne off (seconds): a procession, not a crowd. */
const BIER_APART = 20;
/** How long a bier's bearers take to step in and take it up (seconds). */
const TAKE_UP = 6;

/** A way for a bier from a to b: as its town's walkers go (its bearers about it kept off the walls as they are). */
function bierWay(ground: Ground, a: Point, b: Point): Point[] {
  return route(ground, a, b, PERSON_REACH);
}

/** A way's straight runs, each with its start, end, length and direction (none of no length). */
function runsOf(way: readonly Point[]): { a: Point; b: Point; len: number; d: Point }[] {
  const out: { a: Point; b: Point; len: number; d: Point }[] = [];
  for (let k = 0; k + 1 < way.length; k++) {
    const a = way[k]!,
      b = way[k + 1]!,
      len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len > 1e-6) out.push({ a, b, len, d: { x: (b.x - a.x) / len, z: (b.z - a.z) / len } });
  }
  return out;
}

/** The point `along` and `across` from p on a line running d (a unit direction; across, to its right as faced). */
function offWay(p: Point, d: Point, along: number, across: number): Point {
  return { x: p.x + d.x * along + d.z * across, z: p.z + d.z * along - d.x * across };
}

/**
 * A way laid out for walking in step (a bier's bearers): its points, how far along it each lies,
 * the way to its right at each (mitred at its bends), and its length — run on `ahead` past each
 * end, for those who walk it ahead of its middle or behind.
 */
type StepWay = {
  readonly pts: readonly Point[];
  readonly at: readonly number[];
  readonly side: readonly Point[];
  readonly long: number;
};

function stepWay(way: readonly Point[], ahead: number): StepWay {
  const runs = runsOf(way),
    first = runs[0] ?? { a: way[0]!, b: way[0]!, len: 0, d: { x: 0, z: 1 } },
    last = runs.at(-1) ?? first,
    pts: Point[] = [
      { x: first.a.x - first.d.x * ahead, z: first.a.z - first.d.z * ahead },
      first.a,
    ],
    at: number[] = [-ahead, 0];
  let long = 0;
  for (const r of runs) {
    long += r.len;
    pts.push(r.b);
    at.push(long);
  }
  pts.push({ x: last.b.x + last.d.x * ahead, z: last.b.z + last.d.z * ahead });
  at.push(long + ahead);
  // (Its right along each stretch; at a bend, between the two, as far out as keeps them abreast.)
  const right = (k: number): Point => {
      const a = pts[k]!,
        b = pts[k + 1]!,
        l = Math.hypot(b.x - a.x, b.z - a.z);
      return l > 1e-6 ? { x: (b.z - a.z) / l, z: -(b.x - a.x) / l } : { x: 0, z: 0 };
    },
    side = pts.map((_, k): Point => {
      const n1 = k > 0 ? right(k - 1) : right(k),
        n2 = k + 1 < pts.length ? right(k) : n1,
        sx = n1.x + n2.x,
        sz = n1.z + n2.z,
        m = Math.hypot(sx, sz);
      if (m < 0.2) return Math.hypot(n2.x, n2.z) > 0 ? n2 : n1;
      const scale = Math.min(2, 2 / m) / m;
      return { x: sx * scale, z: sz * scale };
    });
  return { pts, at, side, long };
}

/** Where one walking in step stands at `u` metres along a laid-out way, `across` to its right. */
function stepAt(w: StepWay, u: number, across: number): Point {
  let k = 0;
  while (k + 2 < w.pts.length && w.at[k + 1]! < u) k++;
  const a = w.pts[k]!,
    b = w.pts[k + 1]!,
    na = w.side[k]!,
    nb = w.side[k + 1]!,
    span = w.at[k + 1]! - w.at[k]!,
    f = span > 1e-9 ? Math.max(0, Math.min(1, (u - w.at[k]!) / span)) : 0;
  return {
    x: a.x + (b.x - a.x) * f + (na.x + (nb.x - na.x) * f) * across,
    z: a.z + (b.z - a.z) * f + (na.z + (nb.z - na.z) * f) * across,
  };
}

/** How long a walk in step along a way takes at a pace (its middle's length: all of them in step with it). */
function inStepTime(way: readonly Point[], pace: number): number {
  return stepWay(way, 0).long / pace;
}

/** One's part at a fire, or in the rubble, on a day: from when to when (world seconds), where, at what. */
type Stint = {
  readonly from: number;
  readonly until: number;
  readonly at: Point;
  readonly task: Task | null;
  readonly carry: Carry | null;
  readonly face: number;
  readonly activity: Activity;
  /** What they are about there, and on their way to it. */
  readonly why: string;
  readonly to: string;
  /** A runner's water: they go back and forth between it and `at`, filling and throwing. */
  readonly water?: Point;
  /** Filling at a neighbour's water butt (drawn beside them while they fill). */
  readonly butt?: Point;
  /** What they carry on the way to it (a bier borne to the graveyard: Phase 43 M205). */
  readonly walkCarry?: Carry;
  /**
   * Walked to in step with others along a way they share (a bier's bearers): so far along it and
   * across its line, all of them setting off along it at `start` (world seconds).
   */
  readonly inStep?: {
    readonly way: readonly Point[];
    readonly along: number;
    readonly across: number;
    readonly start: number;
  };
};

const FIGHTS = new WeakMap<VillagePlan, Map<number, ReadonlyMap<number, readonly Stint[]>>>();
const NO_FIGHTS: ReadonlyMap<number, readonly Stint[]> = new Map();

/** Where a town's buckets are filled for a fire at a point: the nearest of its water's edge, the god's spring, its well. */
function waterFor(plan: VillagePlan, to: Point): Point {
  const options: Point[] = [TOWN_WELL],
    lake = plan.town?.water;
  if (lake) {
    const d = Math.hypot(to.x - lake.x, to.z - lake.z) || 1;
    options.push({
      x: lake.x + ((to.x - lake.x) / d) * (lake.r + 1.5),
      z: lake.z + ((to.z - lake.z) / d) * (lake.r + 1.5),
    });
  }
  const spring = plan.wonders?.find((w) => w.kind === "spring");
  if (spring) options.push(wonderSpot(plan, spring));
  const far = (p: Point) => Math.hypot(p.x - to.x, p.z - to.z);
  return clearSpot(
    groundFor(plan),
    options.reduce((b, o) => (far(o) < far(b) ? o : b)),
  );
}

/** The point a share `u` (0…1) of the way along a way. */
function alongWay(way: readonly Point[], u: number): Point {
  let left = Math.max(0, Math.min(1, u)) * lengthOf(way);
  for (let k = 0; k + 1 < way.length; k++) {
    const a = way[k]!,
      b = way[k + 1]!,
      d = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= d || k + 2 === way.length) {
      const f = d > 0 ? Math.min(1, left / d) : 0;
      return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
    }
    left -= d;
  }
  return way[0]!;
}

/**
 * Who of a town is at each of its fires on a day, and how (by their place in its people; Phase 42
 * M201, as Classic's townsfolk fought fires with buckets and buried their dead): the alarm raised
 * a few minutes after the first home catches, and the able nearest it come running — two to throw
 * water on the fire where its water reaches it first, the rest a line passing buckets from the
 * water (its edge, the god's spring or the square's well; one filling them there), or running with
 * them where the water lies too far for a line — till its last flames die (four hours at most);
 * the nearest of the rest, of any age, come to watch a while. Where a quake shook homes down, the
 * nearest able dig in the rubble of the first four for those under it, three hours.
 */
function fightsOn(plan: VillagePlan, day: number): ReadonlyMap<number, readonly Stint[]> {
  const struck = plan.town?.struck ?? [],
    // (And its funerals: Phase 43 M205.)
    rites = funeralsOn(plan, day);
  if (!struck.length && !rites.length) return NO_FIGHTS;
  let days = FIGHTS.get(plan);
  if (!days) FIGHTS.set(plan, (days = new Map()));
  const known = days.get(day);
  if (known) return known;
  const out = new Map<number, Stint[]>(),
    // (Each their parts in the order they come; none while another holds them, a walk apart.)
    put = (i: number, st: Stint) => {
      const list = out.get(i) ?? [];
      list.push(st);
      list.sort((a, b) => a.from - b.from);
      out.set(i, list);
    },
    free = (i: number, from: number, until: number) =>
      !(out.get(i) ?? []).some((st) => st.from < until + 900 && st.until + 900 > from);
  for (const d of [...days.keys()]) if (d < day - 2) days.delete(d);
  days.set(day, out);
  const scene = struck.length ? sceneOf(plan, day * DAY) : null,
    span = scene ? strikeSpan(scene) : null,
    start = day * DAY,
    end = start + DAY - 120;
  const ground = groundFor(plan),
    dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z),
    homeOf = (i: number) => plan.homes[plan.people[i]!.home]!,
    able = (i: number) => {
      const p = plan.people[i]!;
      return !p.child && !oldOf(plan, p);
    },
    // (The nearest the place by their homes, of those not at another part meanwhile, living
    // within `reach` of it.)
    nearest = (
      to: Point,
      ok: (i: number) => boolean,
      most: number,
      from: number,
      until: number,
      reach = HEARS,
    ) =>
      plan.people
        .map((_, i) => i)
        .filter((i) => free(i, from, until) && ok(i) && dist(homeOf(i), to) <= reach)
        .sort((a, b) => dist(homeOf(a), to) - dist(homeOf(b), to) || a - b)
        .slice(0, most);
  if (scene && span && span.from <= end && span.until + FLAMES_S >= start) {
    const { states, lots } = scene,
      lotAt = (p: number): Point => ({ x: lots.x[p]!, z: lots.z[p]! });
    struck.forEach((k, s) => {
      const theirs = scene.struck.filter((p) => states.struck[p] === s),
        burning = theirs.filter((p) => states.burns[p] === 1),
        fallen = theirs.filter((p) => states.burns[p] !== 1),
        shaken = k.kind === "quake";
      // (After a quake, those under the rubble first; then its fires.)
      if (shaken) dig();
      if (burning.length) fight();

      /** Its homes alight fought: a bucket line at them, those come to watch. */
      function fight(): void {
        const alarm = states.began[burning[0]!]! + ALARM_S,
          dies = Math.max(...burning.map((p) => states.began[p]! + FLAMES_S)) - 20 * 60,
          from = Math.max(alarm, start),
          until = Math.min(alarm + FIGHT_S, dies, end);
        if (until > from + 600) {
          const well = waterFor(plan, lotAt(burning[0]!)),
            // (Fought where its water reaches it first.)
            target = burning.reduce((b, p) =>
              dist(lotAt(p), well) < dist(lotAt(b), well) ? p : b,
            ),
            T = lotAt(target),
            // (No water near enough for a line: the water butt of the nearest home standing a
            // little way off — on the water's side of the fire, the better.)
            // (Measured as the line would stand: round what is in the way, from the water to
            // the throwers before the fire.)
            lineFrom = (w: Point) => {
              const d = dist(T, w) || 1;
              return lengthOf(
                route(
                  ground,
                  w,
                  clearSpot(ground, {
                    x: T.x + ((w.x - T.x) / d) * 7,
                    z: T.z + ((w.z - T.z) / d) * 7,
                  }),
                  PERSON_REACH,
                ),
              );
            },
            butt =
              dist(T, well) <= LINE_REACH && lineFrom(well) <= LINE_REACH
                ? null
                : (() => {
                    let best: Point | null = null,
                      score = Infinity;
                    for (let p = 0; p < lots.x.length && p < states.what.length; p++) {
                      if (states.what[p] !== LOT.home || states.struck[p]! >= 0) continue;
                      const q = lotAt(p),
                        d = dist(q, T);
                      if (d < BUTT_FROM || d > BUTT_TO) continue;
                      const s = d + 0.25 * dist(q, well);
                      if (s < score) {
                        score = s;
                        best = q;
                      }
                    }
                    if (!best) return null;
                    const d = dist(best, T) || 1;
                    return clearSpot(ground, {
                      x: best.x + ((T.x - best.x) / d) * 6,
                      z: best.z + ((T.z - best.z) / d) * 6,
                    });
                  })(),
            water = butt ?? well,
            gap = dist(T, water) || 1,
            stand = clearSpot(ground, {
              x: T.x + ((water.x - T.x) / gap) * 7,
              z: T.z + ((water.z - T.z) / gap) * 7,
            }),
            face = Math.atan2(T.x - stand.x, T.z - stand.z),
            what = k.kind === "meteor" ? "the fire fallen from the sky" : "the fire",
            crew = nearest(T, able, LINE_MOST, from, until),
            way = route(ground, water, stand, PERSON_REACH),
            line = lengthOf(way) <= LINE_REACH && crew.length > THROWERS + 1;
          crew.forEach((i, j) => {
            // (They come as they hear: a little apart.)
            const come = Math.min(until - 300, from + j * 20);
            if (j < THROWERS) {
              const side = (j === 0 ? -1 : 1) * 1.4,
                at = clearSpot(ground, {
                  x: stand.x + Math.cos(face) * side,
                  z: stand.z - Math.sin(face) * side,
                });
              put(i, {
                from: come,
                until,
                at,
                task: "douse",
                carry: "water",
                face,
                activity: ACTIVITY.working,
                why: `Throwing water on ${what}`,
                to: `Running to ${what}`,
              });
              return;
            }
            if (line) {
              // The line: the first at the water filling, the rest down to the throwers.
              const n = crew.length - THROWERS,
                u = (j - THROWERS) / n,
                at = clearSpot(ground, alongWay(way, u)),
                next = alongWay(way, Math.min(1, u + 1 / n)),
                filling = j === THROWERS;
              put(i, {
                from: come,
                until,
                at,
                task: filling ? "fill" : "pass",
                carry: "water",
                face: Math.atan2(next.x - at.x, next.z - at.z),
                activity: ACTIVITY.working,
                why: filling
                  ? butt
                    ? `Filling buckets at a neighbour's water butt for ${what}`
                    : `Filling buckets for ${what}`
                  : `Passing buckets down the line to ${what}`,
                to: `Running to the bucket line at ${what}`,
                ...(filling && butt ? { butt: { x: at.x + 0.9, z: at.z + 0.9 } } : {}),
              });
              return;
            }
            // (Too far for a line: back and forth with their buckets.)
            put(i, {
              from: come,
              until,
              at: clearSpot(ground, {
                x: stand.x + ((water.x - stand.x) / gap) * 2,
                z: stand.z + ((water.z - stand.z) / gap) * 2,
              }),
              task: "douse",
              carry: "water",
              face,
              activity: ACTIVITY.working,
              why: `Carrying water to ${what}`,
              to: `Running to ${what}`,
              water,
            });
          });
          // Those come to watch, on the water's side of it: the nearest close by, the rest of
          // those who hear it farther back, in rows a dozen long — the town's day stopped for it.
          const toward = Math.atan2(water.x - T.x, water.z - T.z);
          // (After a quake, none stand watching: the rest are at the rubble.)
          nearest(T, () => true, shaken ? 0 : WATCHERS + CROWD, from, until).forEach((i, j) => {
            const row = j < WATCHERS ? 0 : 1 + Math.floor((j - WATCHERS) / 12),
              u = row ? ((j - WATCHERS) % 12) / 11 : j / Math.max(1, WATCHERS - 1),
              a = toward + (u - 0.5) * (row ? 3.2 : 2.6),
              r = row ? 22 + row * 5 + (j % 2) * 1.5 : 16 + (j % 3) * 2.5,
              at = clearSpot(ground, { x: T.x + Math.sin(a) * r, z: T.z + Math.cos(a) * r }),
              come = from + 120 + j * 45;
            if (come >= until - 600) return;
            put(i, {
              from: come,
              until: Math.min(until, come + (50 + (j % 4) * 15) * 60),
              at,
              task: "watch",
              carry: null,
              face: Math.atan2(T.x - at.x, T.z - at.z),
              activity: ACTIVITY.gathering,
              why: `Watching ${what} in dismay`,
              to: `Running to see ${what}`,
            });
          });
        }
      }

      /** Its homes shaken down dug through for those under them, the first thrown down first. */
      function dig(): void {
        if (!fallen.length) return;
        const from = Math.max(states.began[fallen[0]!]! + 90, start),
          until = Math.min(from + 3 * HOUR, end);
        if (until > from + 600)
          for (const p of fallen.slice(0, DUG)) {
            const L = lotAt(p);
            nearest(L, able, 3, from, until).forEach((i, m) => {
              const a = (m / 3) * 2 * Math.PI + p,
                at = clearSpot(ground, { x: L.x + Math.sin(a) * 4.5, z: L.z + Math.cos(a) * 4.5 });
              put(i, {
                from: from + m * 40,
                until,
                at,
                task: "dig",
                carry: null,
                face: Math.atan2(L.x - at.x, L.z - at.z),
                activity: ACTIVITY.working,
                why: "Digging in the rubble for those under it",
                to: "Running to the homes shaken down",
              });
            });
          }
      }
    });
  }
  // Its funerals (Phase 43 M205): the dead borne on biers from their homes (those a strike killed,
  // from the square) to the graveyard, four to a bier, their kin and neighbours after them, one
  // speaking the words over them where the town keeps a faith; a grave dug for each that morning
  // and filled after.
  const yard = rites.length ? graveyardFor(plan) : null,
    told: Rite[] = [];
  if (yard) for (const f of rites) bury(f, yard);
  let byDay = RITES.get(plan);
  if (!byDay) RITES.set(plan, (byDay = new Map()));
  for (const d of [...byDay.keys()]) if (d < day - 2) byDay.delete(d);
  byDay.set(day, told);
  return out;

  function bury(f: Funeral, yard: Graveyard): void {
    const pace = paceOf(plan.body),
      first = plotAt(yard, f.plot),
      // (Another of the town's homes: its lot's, its household's if it is a watched one.)
      lot = f.home === -2 ? homeLotFor(plan, day, f.pick) : null,
      home = lot ? lot.home : f.home,
      // (Gathered before the home's door, or at the square's edge toward the graveyard.)
      door =
        home >= 0
          ? doorOfHome(plan, ground, home)
          : lot
            ? clearSpot(ground, streetDoor(lot, 0))
            : clearSpot(ground, {
                x: (yard.gate.x / (Math.hypot(yard.gate.x, yard.gate.z) || 1)) * (SQUARE - 4),
                z: (yard.gate.z / (Math.hypot(yard.gate.x, yard.gate.z) || 1)) * (SQUARE - 4),
              }),
      gather = f.leaves - FUNERAL.gather,
      // (Facing as the day's stays do: along x = sin, z = cos.)
      out = Math.atan2(first.x - door.x, first.z - door.z),
      down = Math.atan2(Math.cos(yard.way), Math.sin(yard.way)),
      kin =
        home >= 0 ? plan.people.map((_, i) => i).filter((i) => plan.people[i]!.home === home) : [],
      surname = kin.length ? plan.people[kin[0]!]!.name.split(" ").at(-1) : null,
      kind = f.struck ? plan.town?.struck?.find((k) => k.event === f.struck)?.kind : null,
      whose = f.name
        ? f.name
        : kind === "quake"
          ? "the quake's dead"
          : kind === "meteor"
            ? "the dead of the fire from the sky"
            : kind
              ? "the fire's dead"
              : surname
                ? `the ${surname} household's dead`
                : "a neighbour's dead",
      faith = plan.life?.faith ?? null,
      graves = Array.from({ length: f.biers }, (_, b) => plotAt(yard, f.plot + b)),
      // A point by a frame turned `face`: `along` it, `across` it.
      by = (p: Point, face: number, along: number, across: number): Point => ({
        x: p.x + Math.sin(face) * along + Math.cos(face) * across,
        z: p.z + Math.cos(face) * along - Math.sin(face) * across,
      }),
      // Where each bier rests before it is taken up: on the way out from the door toward the
      // graveyard, the first to go the farthest on, the rest one behind another.
      lead = bierWay(ground, door, first),
      leadLong = Math.max(1, lengthOf(lead)),
      rests = graves.map((_, b) =>
        alongWay(lead, Math.min(1, (4.5 + (graves.length - 1 - b) * 10) / leadLong)),
      ),
      // Each bier's way to its grave, its bearers walking in step either side of it; which way
      // it sets off; when they set off with it, a moment after they take it up.
      ways = graves.map((g, b) => bierWay(ground, rests[b]!, g)),
      heads = ways.map((w) => runsOf(w)[0]?.d ?? { x: Math.sin(out), z: Math.cos(out) }),
      starts = graves.map((_, b) => f.leaves + b * BIER_APART + TAKE_UP),
      // (Borne off one after another; come to the graveyard as the last comes, and stood at a while.)
      arrive = Math.max(...ways.map((w, b) => starts[b]! + inStepTime(w, pace))) + 30,
      done = arrive + FUNERAL.stand;
    // The bearers: its kin first, then those living nearest; four to a bier.
    const bearers = [
      ...kin.filter((i) => able(i) && free(i, gather, done)),
      ...nearest(door, (i) => able(i) && !kin.includes(i), 4 * f.biers, gather, done, Infinity),
    ].slice(0, 4 * f.biers);
    bearers.forEach((i, n) => {
      const b = Math.floor(n / 4),
        j = n % 4,
        along = j < 2 ? 2.4 : -2.4,
        across = j % 2 ? 1.3 : -1.3,
        sets = f.leaves + b * BIER_APART,
        way = ways[b]!,
        end = way.at(-1)!,
        // (Stood about it till it is taken up, a step back from where they will bear it; set
        // down by the grave, about it as they bore it.)
        at = clearSpot(ground, offWay(rests[b]!, heads[b]!, along * 1.35, across * 1.8)),
        laid = stepWay(way, Math.abs(along) + 1),
        there = stepAt(laid, laid.long + along, across);
      put(i, {
        from: gather + n * 20,
        until: sets,
        at,
        task: "mourn",
        carry: null,
        face: Math.atan2(rests[b]!.x - at.x, rests[b]!.z - at.z),
        activity: ACTIVITY.gathering,
        why: `Come to bear ${whose} to the graveyard`,
        to: `To the funeral of ${whose}`,
      });
      put(i, {
        from: sets,
        until: done,
        at: there,
        task: "mourn",
        carry: null,
        face: Math.atan2(end.x - there.x, end.z - there.z),
        activity: ACTIVITY.gathering,
        why: `At the grave of ${whose}`,
        to: `Bearing ${whose} to the graveyard`,
        walkCarry: "bier",
        inStep: { way, along, across, start: starts[b]! },
      });
    });
    // One to speak the words over them, where the town keeps a faith: at the bier's head.
    const words = faith
      ? nearest(door, (i) => plan.people[i]!.occupation === OCC.leader, 1, gather, done, Infinity)
      : [];
    for (const i of words) {
      const at = offWay(rests[0]!, heads[0]!, 6.5, 0),
        there = by(graves[0]!, down, -5, 0);
      put(i, {
        from: gather,
        until: f.leaves + 20,
        at,
        task: "pray",
        carry: null,
        face: out + Math.PI,
        activity: ACTIVITY.gathering,
        why: `Come to lead ${whose} to the graveyard`,
        to: `To the funeral of ${whose}`,
      });
      put(i, {
        from: f.leaves + 20,
        until: done,
        at: there,
        task: "pray",
        carry: null,
        face: Math.atan2(graves[0]!.x - there.x, graves[0]!.z - there.z),
        activity: ACTIVITY.gathering,
        why: `Speaking the words of ${faith} over ${whose}`,
        to: `Leading ${whose} to the graveyard`,
      });
    }
    // Its mourners: the rest of its kin, young and old, and its neighbours (the town, for a
    // strike's dead), about the door and then about the grave, on the gate's side.
    const mourners = [
      ...kin.filter((i) => free(i, gather, done)),
      ...nearest(door, (i) => !kin.includes(i), f.struck ? 22 : 8, gather, done, HEARS * 1.5),
    ];
    mourners.forEach((i, m) => {
      const a = out + Math.PI + (((m % 9) - 4) / 4) * 1.4,
        r = 7 + Math.floor(m / 9) * 2.5,
        at = clearSpot(ground, { x: door.x + Math.sin(a) * r, z: door.z + Math.cos(a) * r }),
        g = (((m % 11) - 5) / 5) * 1.6,
        rg = 8 + Math.floor(m / 11) * 2.5,
        there = by(
          graves[Math.min(graves.length - 1, m % graves.length)]!,
          down + Math.PI + g,
          rg,
          0,
        ),
        leave = f.leaves + 30 + m * 4;
      put(i, {
        from: gather + 60 + m * 25,
        until: leave,
        at,
        task: "mourn",
        carry: null,
        face: Math.atan2(door.x - at.x, door.z - at.z),
        activity: ACTIVITY.gathering,
        why: `Mourning ${whose}`,
        to: `To the funeral of ${whose}`,
      });
      put(i, {
        from: leave,
        until: done,
        at: there,
        task: "mourn",
        carry: null,
        face: Math.atan2(graves[0]!.x - there.x, graves[0]!.z - there.z),
        activity: ACTIVITY.gathering,
        why: `Mourning ${whose} at the grave`,
        to: `Following ${whose} to the graveyard`,
      });
    });
    // A grave dug for each that morning, and filled in after, by the one living nearest the
    // graveyard who is free (from anywhere: a great town's may lie far out).
    const digs = graves.map((g, b) => {
      const from = start + FUNERAL.dig + b * 600,
        filled = done + FUNERAL.fill,
        [i] = nearest(g, able, 1, from, filled, Infinity);
      if (i === undefined) return { from, filled };
      const at = by(g, down, 0, 3.2),
        face = Math.atan2(g.x - at.x, g.z - at.z);
      put(i, {
        from,
        until: f.leaves - 600,
        at,
        task: "dig",
        carry: "tool",
        face,
        activity: ACTIVITY.working,
        why: `Digging a grave for ${whose}`,
        to: "To the graveyard, to dig a grave",
      });
      // (Standing by, a little back, spade in hand, while they come and stand at it.)
      const back = by(g, down, -1.5, 6.5);
      put(i, {
        from: f.leaves - 600,
        until: done + 60,
        at: back,
        task: null,
        carry: "tool",
        face: Math.atan2(g.x - back.x, g.z - back.z),
        activity: ACTIVITY.resting,
        why: `Standing by the grave dug for ${whose}`,
        to: "Stepping back from the grave",
      });
      put(i, {
        from: done + 60,
        until: filled,
        at,
        task: "dig",
        carry: "tool",
        face,
        activity: ACTIVITY.working,
        why: `Filling in the grave of ${whose}`,
        to: "To the grave, to fill it in",
      });
      return { from, filled };
    });
    told.push({
      f,
      bearers,
      rests,
      heads: heads.map((d) => Math.atan2(d.x, d.z)),
      ways,
      starts,
      graves,
      down,
      arrive,
      done,
      dug: digs.map((d) => d.from),
      filled: digs.map((d) => d.filled),
    });
  }
}

/**
 * A funeral of a day as its town keeps it (Phase 43 M205): its bearers (four to a bier, in turn),
 * where its biers rest before they are taken up, its graves and which way they lie, when it comes
 * to the graveyard and is done there, and when each grave is begun and filled in.
 */
export type Rite = {
  readonly f: Funeral;
  readonly bearers: readonly number[];
  readonly rests: readonly Point[];
  /** Which way each bier lies at rest (as faces: along x = sin, z = cos), the way it sets off. */
  readonly heads: readonly number[];
  /** Each bier's way to its grave, and when it sets off along it (world seconds). */
  readonly ways: readonly (readonly Point[])[];
  readonly starts: readonly number[];
  readonly graves: readonly Point[];
  readonly down: number;
  readonly arrive: number;
  readonly done: number;
  readonly dug: readonly number[];
  readonly filled: readonly number[];
};
const RITES = new WeakMap<VillagePlan, Map<number, readonly Rite[]>>();

/** A town's funerals of a day (days since the world began), as it keeps them. */
export function ritesOn(plan: VillagePlan, day: number): readonly Rite[] {
  fightsOn(plan, day);
  return RITES.get(plan)?.get(day) ?? [];
}

const STANDING = new WeakMap<VillagePlan, { day: number; lots: readonly number[] }>();

/**
 * One of a town's homes standing on a day (its lot: where, which way its front; the watched
 * household's on it, or -1), `pick` of the way through them; null, a village.
 */
function homeLotFor(
  plan: VillagePlan,
  day: number,
  pick: number,
): (Point & { readonly yaw: number; readonly home: number }) | null {
  const scene = sceneOf(plan, day * DAY);
  if (!scene) return null;
  let known = STANDING.get(plan);
  if (!known || known.day !== day) {
    const { states } = scene,
      t = day * DAY,
      lots: number[] = [];
    for (let p = 0; p < scene.plan.lots; p++)
      if (
        states.what[p] === LOT.home &&
        states.began[p]! + states.takes[p]! <= t &&
        states.struck[p]! < 0
      )
        lots.push(p);
    STANDING.set(plan, (known = { day, lots }));
  }
  if (!known.lots.length) return null;
  const p = known.lots[Math.min(known.lots.length - 1, Math.floor(pick * known.lots.length))]!,
    { lots } = scene,
    at = { x: lots.x[p]!, z: lots.z[p]!, yaw: lots.yaw[p]! },
    home = plan.homes.findIndex((h) => Math.abs(h.x - at.x) < 0.5 && Math.abs(h.z - at.z) < 0.5);
  return { ...at, home };
}

const YARDS = new WeakMap<VillagePlan, Graveyard | null>();

/**
 * A town's graveyard (Phase 43 M205; null: none of its dead told): just past its homes, off its
 * fields, its pasture, its road, its water and the ground its young drill on; its gate toward
 * the town, its rows running back from it, as many as its dead want.
 */
export function graveyardFor(plan: VillagePlan): Graveyard | null {
  if (YARDS.has(plan)) return YARDS.get(plan)!;
  let yard: Graveyard | null = null;
  const rest = plan.rest;
  if (rest) {
    const ground = groundFor(plan),
      out = ground.homesReach + 26,
      // (Its size, wherever it lies: what it must keep clear of, as far as its corners.)
      size = graveyardAt({ x: 0, z: 0 }, 0, rest.graves, rest.perYear),
      wide = Math.hypot(size.w, size.d) / 2,
      apart = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))),
      fx = plan.fields.reduce((a, q) => a + q.x, 0),
      fz = plan.fields.reduce((a, q) => a + q.z, 0),
      fieldWay = plan.fields.length ? Math.atan2(fz, fx) : Math.PI,
      roadWay = Math.atan2(plan.road.z, plan.road.x),
      // (How far a point lies off the road: out from the middle, or both ways through a city.)
      roadOver = (p: Point) => {
        const l = Math.hypot(plan.road.x, plan.road.z) || 1,
          ux = plan.road.x / l,
          uz = plan.road.z / l,
          along = p.x * ux + p.z * uz;
        return along < 0 && !plan.districts ? Math.hypot(p.x, p.z) : Math.abs(p.x * uz - p.z * ux);
      },
      drill = drillGround(plan),
      drillWay = Math.atan2(drill.z, drill.x);
    let best = 0,
      bestScore = -Infinity;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * 2 * Math.PI + 0.13,
        q = { x: out * Math.cos(a), z: out * Math.sin(a) },
        // (Its middle, its rows run back to it and past.)
        mid = { x: (out + size.d / 2) * Math.cos(a), z: (out + size.d / 2) * Math.sin(a) },
        far = { x: (out + size.d) * Math.cos(a), z: (out + size.d) * Math.sin(a) },
        // (Over a field, the pasture or the road: put off.)
        over =
          plan.fields.filter(
            (q) => Math.hypot(q.x - mid.x, q.z - mid.z) < wide + Math.hypot(q.w, q.d) / 2,
          ).length *
            2 +
          (Math.hypot(mid.x - plan.pasture.x, mid.z - plan.pasture.z) < wide + plan.pasture.r
            ? 3
            : 0) +
          (roadOver(mid) < wide ? 3 : 0),
        score =
          -over +
          Math.min(apart(a, fieldWay), 1.5) +
          Math.min(apart(a, roadWay), 1) +
          Math.min(apart(a, drillWay), 1.2) +
          Math.min(
            1,
            Math.hypot(far.x - plan.pasture.x, far.z - plan.pasture.z) / (plan.pasture.r + 60),
          ) +
          (ground.lake &&
          Math.min(
            Math.hypot(q.x - ground.lake.x, q.z - ground.lake.z),
            Math.hypot(mid.x - ground.lake.x, mid.z - ground.lake.z) - wide,
            Math.hypot(far.x - ground.lake.x, far.z - ground.lake.z),
          ) <
            ground.lake.r + 20
            ? -10
            : 0);
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    const gate = clearSpot(ground, { x: out * Math.cos(best), z: out * Math.sin(best) });
    yard = graveyardAt(gate, best, rest.graves, rest.perYear);
  }
  YARDS.set(plan, yard);
  return yard;
}

/**
 * How a town's burying stands at moment t (Phase 43 M205): the biers resting or borne now (where,
 * which way they lie), the graves open (where, which way, how deep dug: 0 … 1), and how many
 * graves have been dug and filled in since the town was founded, so many of them this year.
 */
export function burialNow(
  plan: VillagePlan,
  t: number,
): {
  readonly biers: readonly {
    readonly x: number;
    readonly z: number;
    readonly face: number;
    /** On its bearers' shoulders (theirs, by their places in the plan's people), or set down. */
    readonly borne: boolean;
    readonly bearers: readonly number[];
  }[];
  readonly open: readonly {
    readonly x: number;
    readonly z: number;
    readonly way: number;
    readonly deep: number;
  }[];
  readonly graves: number;
  readonly fresh: number;
  /** Whether the town mourns now: those a fire or a quake killed being buried (gathered till filled in). */
  readonly mourning: boolean;
} {
  const rest = plan.rest,
    yard = graveyardFor(plan);
  if (!rest || !yard) return { biers: [], open: [], graves: 0, fresh: 0, mourning: false };
  const day = Math.floor(t / DAY),
    rites = ritesOn(plan, day),
    biers: { x: number; z: number; face: number; borne: boolean; bearers: readonly number[] }[] =
      [],
    open: { x: number; z: number; way: number; deep: number }[] = [];
  let graves = gravesBefore(plan);
  for (const f of funeralsOf(plan)) if (Math.floor(f.leaves / DAY) < day) graves += f.dead;
  for (const r of rites) {
    r.graves.forEach((g, b) => {
      const dug = r.dug[b]!,
        filled = r.filled[b]!,
        ready = r.f.leaves - 600;
      if (t >= dug && t < filled)
        open.push({
          x: g.x,
          z: g.z,
          way: yard.way,
          deep:
            t < ready
              ? (t - dug) / Math.max(1, ready - dug)
              : t < r.done
                ? 1
                : 1 - (t - r.done) / Math.max(1, filled - r.done),
        });
      // Its bier: before the door till taken up, then on its bearers' shoulders, then set by the
      // grave till it is lowered in.
      const sets = r.f.leaves + b * BIER_APART;
      if (t < r.f.leaves - FUNERAL.gather || t >= r.arrive + FUNERAL.lowered) return;
      const four = r.bearers.slice(b * 4, b * 4 + 4);
      if (t < sets || four.length < 2 || t >= r.arrive) {
        biers.push(
          t < sets
            ? { ...r.rests[b]!, face: r.heads[b]!, borne: false, bearers: [] }
            : { ...g, face: r.down, borne: false, bearers: [] },
        );
        return;
      }
      const ms = four.map((i) => momentOf(plan, i, t));
      biers.push({ ...bierBetween(ms), borne: true, bearers: four });
    });
    if (t >= Math.max(...r.filled)) graves += r.f.dead;
  }
  const mourning = rites.some(
    (r) => r.f.struck !== null && t >= r.f.leaves - FUNERAL.gather && t < Math.max(...r.filled),
  );
  return { biers, open, graves, fresh: graves - gravesBefore(plan), mourning };
}

/**
 * Where a bier is borne between its bearers (Phase 43 M205; the first two at its front, the
 * others behind): amid them, lying from those behind toward those before.
 */
export function bierBetween(
  ms: readonly { readonly x: number; readonly z: number; readonly yaw: number }[],
): {
  x: number;
  z: number;
  face: number;
} {
  const mid = (q: readonly { x: number; z: number }[]) => ({
      x: q.reduce((a, m) => a + m.x, 0) / Math.max(1, q.length),
      z: q.reduce((a, m) => a + m.z, 0) / Math.max(1, q.length),
    }),
    all = mid(ms),
    front = mid(ms.slice(0, 2)),
    back = mid(ms.slice(2));
  return {
    ...all,
    face:
      ms.length > 2 && Math.hypot(front.x - back.x, front.z - back.z) > 0.5
        ? Math.atan2(front.x - back.x, front.z - back.z)
        : (ms[0]?.yaw ?? 0),
  };
}

/** The funerals a town keeps from moment t for so many days (the look tools): when each leaves, comes to the graveyard, is done; its biers and dead; where its first grave is. */
export function funeralsAhead(
  plan: VillagePlan,
  t: number,
  days = 30,
): {
  leaves: number;
  arrive: number;
  done: number;
  filled: number;
  biers: number;
  dead: number;
  bearers: number;
  grave: Point;
  struck: string | null;
  name: string | null;
}[] {
  const out: ReturnType<typeof funeralsAhead> = [],
    day = Math.floor(t / DAY);
  for (let d = day; d < day + days; d++)
    for (const r of ritesOn(plan, d))
      if (r.done > t)
        out.push({
          leaves: r.f.leaves,
          arrive: r.arrive,
          done: r.done,
          filled: Math.max(...r.filled),
          biers: r.f.biers,
          dead: r.f.dead,
          bearers: r.bearers.length,
          grave: r.graves[0]!,
          struck: r.f.struck,
          name: r.f.name,
        });
  return out;
}

/** The neighbours' water butts filled from at a town's fires at moment t (where to draw them; metres). */
export function buttsNow(plan: VillagePlan, t: number): Point[] {
  const out: Point[] = [];
  for (const parts of fightsOn(plan, Math.floor(t / DAY)).values())
    for (const st of parts)
      if (st.butt && t >= st.from - 600 && t < st.until + 600) out.push(st.butt);
  return out;
}

/** Who of a town is at its fires, and how, at moment t (the look tools): by what they are at. */
export function fightNow(plan: VillagePlan, t: number): Record<string, number> {
  const day = Math.floor(t / DAY),
    counts: Record<string, number> = {};
  for (const parts of fightsOn(plan, day).values())
    for (const st of parts)
      if (t >= st.from && t < st.until)
        counts[st.task ?? "by"] = (counts[st.task ?? "by"] ?? 0) + 1;
  return counts;
}

/**
 * What is felled about the town at moment t (Phase 41 M200), by the trees' places in treesOf's
 * (every setting draws these first): those not standing whole — coming down, lying, a stump, a
 * sapling growing; the saplings, how grown; the stumps; and those coming down or lying today: the
 * way each falls (away from its feller), how far over (0 upright … 1 down), how much is left of it
 * (1 … 0, as its logs are carried off). `key` changes as any of it but the falling does.
 */
export type Felling = {
  readonly key: string;
  readonly down: ReadonlySet<number>;
  readonly saplings: ReadonlyMap<number, number>;
  readonly stumps: readonly number[];
  readonly falling: readonly {
    readonly index: number;
    readonly yaw: number;
    readonly over: number;
    readonly left: number;
  }[];
  /** When the next of today's trees comes down (world seconds; null, none more today). */
  readonly next: number | null;
};

/** What came down before a day (kept a day: the stumps and saplings change only as days turn). */
const BEFORE = new WeakMap<
  Woodlot,
  { day: number; size: number; stumps: number[]; saplings: Map<number, number> }
>();

export function fellingNow(plan: VillagePlan, t: number): Felling {
  const w = woodlotOf(plan),
    day = Math.floor(t / DAY),
    s = t - day * DAY;
  let before = BEFORE.get(w);
  if (!before || before.day !== day || before.size !== w.felled.size) {
    const stumps: number[] = [],
      saplings = new Map<number, number>();
    w.trees.forEach((tree, k) => {
      const was = w.felled.get(treeKey(tree));
      if (was === undefined || was >= day) return;
      const since = day - was;
      if (since >= STUMP_DAYS + SAPLING_DAYS) return;
      if (since < STUMP_DAYS) stumps.push(k);
      else saplings.set(k, (since - STUMP_DAYS) / SAPLING_DAYS);
    });
    BEFORE.set(w, (before = { day, size: w.felled.size, stumps, saplings }));
  }
  const down = new Set<number>([...before.stumps, ...before.saplings.keys()]),
    stumps = [...before.stumps],
    falling: { index: number; yaw: number; over: number; left: number }[] = [];
  let next: number | null = null;
  // Today's: standing till the first blows' end (its first feller's), then coming down away from
  // them and lying till the last log is carried off, then a stump.
  const trees = new Map<number, { at: number; gone: number; yaw: number }>();
  for (const [i, f] of w.days.get(day) ?? []) {
    const chops = legsOf(plan, i, day, true).filter((l) => l.task === "chop");
    if (!chops.length) continue;
    const was = trees.get(f.tree),
      first = chops[0]!.to,
      last = chops[chops.length - 1]!.to;
    if (!was) trees.set(f.tree, { at: first, gone: last, yaw: chops[0]!.face ?? 0 });
    else {
      if (f.seat === 0) was.yaw = chops[0]!.face ?? was.yaw;
      was.at = Math.min(was.at, first);
      was.gone = Math.max(was.gone, last);
    }
  }
  for (const [k, { at, gone: cut, yaw }] of trees) {
    const gone = Math.max(cut, at + LIES_S);
    if (s < at) {
      next = Math.min(next ?? Infinity, day * DAY + at);
      continue;
    }
    down.add(k);
    if (s >= gone) {
      stumps.push(k);
      continue;
    }
    const u = Math.min(1, (s - at) / FALL_S);
    falling.push({ index: k, yaw, over: u * u, left: 1 - (0.8 * (s - at)) / (gone - at) });
  }
  return {
    key: `${day}|${down.size}|${stumps.length}`,
    down,
    saplings: before.saplings,
    stumps,
    falling,
    next,
  };
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
        task: carry === "bier" ? "bear" : null,
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
  /**
   * A walk in step with others along a way they share (a bier's bearers, Phase 43 M205), so far
   * along and across its line: run by run at the one pace, turning together at each bend.
   */
  const inStep = (
    from: number,
    st: NonNullable<Stint["inStep"]>,
    carry: Carry | null,
    why: string | null,
  ): number => {
    const w = stepWay(st.way, Math.abs(st.along) + 1),
      // (Where they are as its middle passes each of its points, and at its ends.)
      marks = [
        st.along,
        ...w.at.filter((u) => u > st.along && u < w.long + st.along),
        w.long + st.along,
      ],
      task = carry === "bier" ? "bear" : null;
    for (let k = 0; k + 1 < marks.length; k++) {
      const u0 = marks[k]!,
        u1 = marks[k + 1]!;
      legs.push({
        from: from + (u0 - st.along) / pace,
        to: from + (u1 - st.along) / pace,
        at: stepAt(w, u0, st.across),
        next: stepAt(w, u1, st.across),
        activity: ACTIVITY.walking,
        carry,
        task,
        face: null,
        why,
        effect: null,
      });
    }
    return from + w.long / pace;
  };
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
  stay(rise, rise + 0.75 * HOUR, at, ACTIVITY.eating, null, null, null, "Breakfast at home");
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
    // A day of rest's morning at prayer (Phase 41 M199): most of a town that keeps a temple or a
    // shrine go to it, stand in its rows before its door a while, and come home.
    const doors = rest && fine && plan.town ? civicDoors(plan, day * DAY) : null,
      shrine = doors?.get("temple")?.[0] ?? doors?.get("shrine")?.[0] ?? null;
    if (shrine && draw(27) < 0.7) {
      const start = Math.max(t, (9 + (draw(28) - 0.5) * 0.5) * HOUR),
        place = clearSpot(ground, beside(shrine, Math.floor(draw(29) * 48), 1.2, 2.5, 8)),
        over = 11 * HOUR;
      stay(t, start, at, ACTIVITY.home);
      t = go(start, at, place, null, `To ${shrine.words} on the day of rest`);
      stay(
        t,
        Math.max(t, over),
        place,
        ACTIVITY.gathering,
        null,
        "pray",
        shrine.yaw,
        `At prayer at ${shrine.words}`,
      );
      t = go(Math.max(t, over), place, at, null, `Home from ${shrine.words}`);
    }
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
      stay(
        Math.max(t, 12 * HOUR),
        Math.max(t, 12.75 * HOUR),
        work,
        ACTIVITY.eating,
        null,
        null,
        null,
        "Their bread at noon, where they work",
      );
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
      stay(t, t + 0.75 * HOUR, at, ACTIVITY.eating, null, null, null, "Home to eat at noon");
      t = go(t + 0.75 * HOUR, at, work, work.to);
      stay(t, stop ?? 17.5 * HOUR, work, doing, work.to, work.task, work.face, work.why);
      t = go(Math.max(t, stop ?? 17.5 * HOUR), work, at, work.back);
    }
    // The feast, or some evenings in the square (every evening, for those who drill).
    if (feast) t = feasting(t);
    else if ((drills || draw(11) < 0.3) && t < 19 * HOUR) t = evening(t, 20 * HOUR);
  }
  stay(
    t,
    Math.max(t, bed - 0.5 * HOUR),
    at,
    ACTIVITY.eating,
    null,
    null,
    null,
    "Supper at home, and the evening",
  );
  stay(Math.max(t, bed - 0.5 * HOUR), bed, at, ACTIVITY.home);
  stay(Math.max(t, bed), DAY, at, ACTIVITY.asleep);
  // A fire in the town, or homes shaken down (Phase 42 M201): from wherever the alarm finds them,
  // to their part in it, and back to their day after — each of their parts in it in turn.
  for (const part of (fine ? fightsOn(plan, day).get(index) : undefined) ?? []) breakIn(part);
  return legs;

  /**
   * A bier taken up and borne off (Phase 43 M205): a step in to their place at it, held there
   * till all of them set off together, then in step along its way; when they are there.
   */
  function takeUp(
    st: NonNullable<Stint["inStep"]>,
    s0: number,
    from: Point,
    carry: Carry | null,
    why: string,
  ): number {
    const d = runsOf(st.way)[0]?.d ?? { x: 0, z: 1 },
      place = stepAt(stepWay(st.way, Math.abs(st.along) + 1), st.along, st.across),
      there = go(s0, from, place, null, why),
      begin = Math.max(there, st.start - day * DAY);
    stay(there, begin, place, ACTIVITY.gathering, carry, "bear", Math.atan2(d.x, d.z), why);
    return inStep(begin, st, carry, why);
  }

  /** The day's legs with a part in the town's trouble put in (the legs it takes the place of cut out). */
  function breakIn(part: Stint): void {
    const plain = legs.splice(0),
      s0 = part.from - day * DAY,
      s1 = Math.max(s0, part.until - day * DAY);
    legs.push(...cutLegs(plain, 0, s0));
    let t = part.inStep
      ? takeUp(part.inStep, s0, whereAt(plain, s0), part.walkCarry ?? null, part.to)
      : go(s0, whereAt(plain, s0), part.at, part.walkCarry ?? null, part.to);
    if (part.water) {
      // Back and forth: filled at the water, run to the fire, thrown, and back for more.
      const fire = part.at,
        water = part.water;
      while (t < s1 - 120) {
        t = go(t, fire, water, "bucket", "Back to the water for more");
        stay(t, t + 40, water, ACTIVITY.working, "bucket", "fill", null, "Filling a bucket");
        t = go(t + 40, water, fire, "water", part.why);
        stay(t, t + 15, fire, ACTIVITY.working, "water", "douse", part.face, part.why);
        t += 15;
      }
    } else stay(t, s1, part.at, part.activity, part.carry, part.task, part.face, part.why);
    t = Math.max(t, s1);
    // (Back to where their day has them, a walk on.)
    if (t < DAY - 60) {
      const there = whereAt(plain, Math.min(DAY - 1, t + 240)),
        back = Math.min(DAY - 1, go(t, part.at, there, null, "Back to their day"));
      legs.push(...cutLegs(plain, back, DAY));
    }
  }

  /**
   * At work where it moves on as it is done (Phase 44 M206: a reaper at a field's front), from
   * `from` until `to`: a step to where it is now (where that fits), then on with it, a leg each
   * few minutes; where they are when it is done.
   */
  function following(from: number, to: number, start: Point, st: Step): Point {
    const spot = st.follow!;
    let t = from,
      at = start;
    const first = spot(Math.min(to, from + 30));
    if (first && Math.hypot(first.x - at.x, first.z - at.z) > 0.6) {
      const way = wayOf(at, first);
      if (t + lengthOf(way) / pace < to - 60) {
        t = along(t, way, st.carry, st.why);
        at = first;
      }
    }
    while (t < to - 1) {
      const next = Math.min(to, t + FOLLOW_STEP),
        p = spot(next);
      legs.push({
        from: t,
        to: next,
        at,
        next: p ?? at,
        activity: st.activity ?? ACTIVITY.working,
        carry: st.carry,
        task: st.task ?? null,
        face: p?.face ?? st.face ?? null,
        why: p?.why ?? st.why,
        effect: null,
      });
      if (p) at = p;
      t = next;
    }
    return at;
  }

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
      let w = 0,
        moved = false;
      pos = here;
      for (const st of steps) {
        if (st.to) {
          // (From where the work before it left them, where it took them on along a field's rows.)
          const way = moved ? wayOf(pos, st.to) : ways[w]!;
          w++;
          moved = false;
          t = along(t, way, st.carry, st.why);
          pos = st.to;
          continue;
        }
        const d = st.flex ? flex : (st.hours ?? 0) * HOUR;
        if (st.follow) {
          pos = following(t, t + d, pos, st);
          moved = true;
        } else
          stay(
            t,
            t + d,
            pos,
            st.activity ?? ACTIVITY.working,
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
      doors = civicDoors(plan, day * DAY),
      granary = spots.granary,
      yard = spots.yard,
      first = k === 0,
      season = (day % 365) / 365,
      // (The k-th errand's own draws: a stretch of the field, a tree, a spot in the wild.)
      at2 = (a: number, b: number) => [draw(k ? a + k : 4), draw(k ? b + k : 5)] as const;
    switch (role.kind) {
      case "reap": {
        // (At a field being reaped today, each in their place at its front — two cutting, those
        // after them binding and stooking behind — on along its rows with it: Phase 44 M206.)
        const field = role.place >= 0 ? role.place : -1,
          s = role.seat,
          back = s === 0 ? 0.5 : s === 1 ? 1.5 : s === 2 ? 4.5 : s === 3 ? 7.5 : 9 + (s - 4) * 2.5,
          across = s === 0 ? -1 : s === 1 ? 1 : s === 2 ? 0 : s % 2 ? 0.9 : -0.9,
          follow =
            field >= 0
              ? (sec: number) => cutPoint(plan, field, day * DAY + sec, back, across)
              : undefined,
          // (Where the front will be about when they come to it: the morning's first errand at
          // the working day's start, each after it some hours on.)
          guess = (k < 100 ? REAP_HOURS[0] + 3 * k : 13.5 + 3 * (k - 100)) * HOUR,
          there = follow?.(Math.min(guess, REAP_HOURS[1] * HOUR)),
          f = there ? clearSpot(ground, there) : fieldSpot(k),
          cutting = s < 2;
        return [
          { to: f, carry: "tool", why: "Out to the harvest" },
          {
            flex: true,
            hours: 2.5,
            min: 0.5,
            task: follow && !cutting ? "gather" : "reap",
            carry: "tool",
            why:
              follow && !cutting
                ? "Binding the sheaves behind the reapers"
                : "Reaping: the harvest is in",
            ...(follow ? { follow } : {}),
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
      case "cart": {
        // The harvest carried in (Phase 44 M206): sheaves taken up from a reaped field's stooks
        // and carried to the granary, and back for more.
        const f = plan.fields[role.place];
        if (!f) return errandOf({ ...role, kind: "reap", place: -1 }, town, k);
        // (A stook still standing about when they come to it: the morning's first errand at the
        // working day's start, each after it most of an hour on.)
        const guess = Math.min(
            k < 100 ? REAP_HOURS[0] + 0.75 * k : 13.5 + 0.75 * (k - 100),
            REAP_HOURS[1],
          ),
          t = day * DAY + guess * HOUR,
          stooks = stooksOf(plan, role.place, t, fieldsNow(plan, t)),
          n = Math.max(1, rowsOf(f)),
          spot = clearSpot(
            ground,
            stooks.length
              ? stooks[(role.seat * 7 + k * 3) % stooks.length]!
              : rowPoint(f, (role.seat + k) % n, draw(k ? 9000 + k : 4) * (f.w - 2 * ROW_ENDS), 0),
          );
        return [
          { to: spot, carry: null, why: "Out to the stooks for the sheaves" },
          { hours: 0.15, task: "load", carry: null, why: "Taking up sheaves from the stooks" },
          { to: granary.door, carry: "sheaf", why: `Carrying the sheaves in to ${granary.words}` },
          {
            hours: 0.08,
            task: "load",
            carry: "sheaf",
            why: `Stacking the sheaves in ${granary.words}`,
            effect: { kind: "grain", amount: 1 },
          },
        ];
      }
      case "water": {
        // A dry year (Phase 44 M206): a bucket filled at the water, carried out and poured along a
        // parched row, and back for more.
        const f = plan.fields[role.place];
        if (!f) return errandOf({ ...role, kind: "hoe" }, town, k);
        const n = Math.max(1, rowsOf(f)),
          spot = clearSpot(
            ground,
            rowPoint(
              f,
              (role.seat + k) % n,
              draw(k ? 7000 + k : 4) * (f.w - 2 * ROW_ENDS),
              ROW_GAP / 2,
            ),
          ),
          well = waterFor(plan, spot);
        return [
          { to: well, carry: "bucket", why: "To the water with a bucket: the fields are parched" },
          { hours: 0.05, task: "fill", carry: "bucket", why: "Filling a bucket for the fields" },
          { to: spot, carry: "water", why: "Carrying water out to the parched fields" },
          {
            flex: true,
            hours: 0.3,
            min: 0.1,
            task: "water",
            carry: "water",
            why: "Watering the parched rows",
          },
        ];
      }
      case "pull": {
        // A blight (Phase 44 M206): its crop pulled up along a blighted row, carried to the fire
        // at the field's corner and burned.
        const f = plan.fields[role.place];
        if (!f) return errandOf({ ...role, kind: "hoe" }, town, k);
        const year = fieldsNow(plan, day * DAY + 12 * HOUR),
          taken = Array.from({ length: rowsOf(f) }, (_, j) => j).filter((j) =>
            blightedRow(plan, role.place, j, year.blight),
          ),
          row = taken.length ? taken[(role.seat + k) % taken.length]! : 0,
          spot = clearSpot(
            ground,
            rowPoint(f, row, draw(k ? 8000 + k : 4) * (f.w - 2 * ROW_ENDS), ROW_GAP / 2),
          ),
          fire = clearSpot(ground, burnSpot(f));
        return [
          { to: spot, carry: "tool", why: "Out to the blighted field" },
          {
            flex: true,
            hours: 1.2,
            min: 0.25,
            task: "pull",
            carry: "tool",
            why: "Pulling up the blighted crop",
          },
          { to: fire, carry: "sheaf", why: "Carrying the blighted crop to the fire" },
          {
            hours: 0.05,
            task: "load",
            carry: "sheaf",
            why: "Throwing the blighted crop on the fire",
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
        const tree = treeAt(plan, at, draw(10000 + k), day);
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
        // The flock's day (Phase 46 M208): out to it at the fold, and with it — driving it out,
        // about it as it grazes, bringing it in; among it at the shearing, by its hay in winter.
        // (A great town's other herders are out with its other flocks, on the far pastures.)
        if (keepsFlock(plan) && role.seat >= FLOCK_HANDS) {
          const p = plan.pasture,
            [u, v] = at2(6000, 7000),
            a = Math.atan2(p.z, p.x) + (u - 0.5) * 1.6,
            r = Math.hypot(p.x, p.z) + p.r + 60 + v * 120;
          return [
            {
              to: clearSpot(ground, { x: r * Math.cos(a), z: r * Math.sin(a) }),
              carry: "staff",
              why: "Out to the flocks on the far pastures",
            },
            {
              flex: true,
              hours: 9,
              min: 0.5,
              task: "herd",
              carry: "staff",
              why: "With the flocks on the far pastures",
            },
          ];
        }
        if (keepsFlock(plan)) {
          const seat = role.seat,
            follow = (sec: number) => herderAt(plan, day * DAY + sec, seat),
            first = follow((k < 100 ? 7.1 : 12.9) * HOUR);
          if (first)
            return [
              {
                to: clearSpot(ground, first),
                carry: "staff",
                why: k < 100 ? "Out to the fold for the flock" : "Back out to the flock",
              },
              {
                flex: true,
                hours: 10,
                min: 0.25,
                task: "herd",
                carry: "staff",
                why: "With the flock",
                follow,
              },
            ];
        }
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
        // (Each feller's own tree of the day, the nearest the yard still grown: felled at their
        // first errand, then cut up, a log carried off each time — Phase 41 M200. Where the
        // woodlot is felled bare, out past the wild's edge to the far woods for it.)
        const w = woodlotOf(plan),
          mine = fellersOn(plan, day).get(index),
          a = draw(1) * 2 * Math.PI,
          r = plan.wild + 120 + draw(4) * 200,
          far = clearSpot(ground, { x: r * Math.cos(a), z: r * Math.sin(a) }),
          tree =
            mine === undefined
              ? { ...far, face: Math.atan2(far.x, far.z) }
              : standAt(w.trees[mine.tree]!, yard.door, mine.seat),
          words =
            mine === undefined
              ? (["Out to the far woods for timber", "Felling timber in the far woods"] as const)
              : k > 0
                ? (["Back to the tree they felled", "Cutting the felled tree into logs"] as const)
                : mine.seat === 0
                  ? ([
                      "Out to fell a tree for the builders",
                      "Felling a tree for the builders",
                    ] as const)
                  : ([
                      "Out to help fell a tree for the builders",
                      "Helping to fell a tree for the builders",
                    ] as const);
        return [
          { to: tree, carry: "tool", why: words[0] },
          {
            flex: true,
            hours: 1.5,
            min: 0.4,
            task: "chop",
            carry: "tool",
            face: tree.face,
            why: words[1],
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
      case "smith": {
        const anvil = clearSpot(ground, beside(spots.smithy, Math.max(0, role.seat)));
        return [
          { to: yard.door, carry: null, why: `To ${yard.words} for ore` },
          {
            hours: 0.06,
            task: "load",
            carry: null,
            why: "Taking ore to forge",
            effect: { kind: "ore", amount: -1 },
          },
          { to: anvil, carry: "ore", why: `Carrying the ore to ${spots.smithy.words}` },
          {
            flex: true,
            hours: 2.5,
            min: 0.5,
            task: "hammer",
            carry: null,
            face: spots.smithy.yaw,
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
      }
      case "workshop":
      case "mend": {
        // (A town's crafters at its workshops, where it has them; else by the market.)
        const mend = role.kind === "mend",
          shop = !mend && role.place >= 0 ? doors.get("workshop")?.[role.place] : undefined,
          a = draw(1) * 2 * Math.PI,
          spot = mend
            ? at
            : shop
              ? clearSpot(ground, beside(shop, role.seat))
              : clearSpot(ground, {
                  x: WORKSHOP.x + 6 * Math.cos(a),
                  z: WORKSHOP.z + 6 * Math.sin(a),
                });
        return [
          {
            to: spot,
            carry: null,
            why: mend ? "Home to mend" : shop ? `To ${shop.words}` : "To the workshop",
          },
          {
            flex: true,
            hours: 7,
            min: 0.25,
            task: "hammer",
            carry: !mend && draw(13) < 0.5 ? "sack" : null,
            face: shop?.yaw ?? null,
            why: mend
              ? "Mending tools and fences in the slack season"
              : shop
                ? `At their craft in ${shop.words}`
                : "At their craft by the market",
          },
        ];
      }
      // The potters (Phase 41 M199): the kiln fired with wood from the yard, pots thrown at the
      // wheel by it, and the fired pots brought to the market.
      case "kiln": {
        const kiln = doors.get("kiln")?.[role.place];
        if (!kiln) return errandOf({ ...role, kind: "workshop", place: -1 }, town, k);
        const spot = clearSpot(ground, beside(kiln, role.seat)),
          market = doors.get("market")?.[0] ?? granary;
        if (first)
          return [
            { to: yard.door, carry: null, why: `To ${yard.words} for wood to fire the kiln` },
            {
              hours: 0.06,
              task: "load",
              carry: null,
              why: "Taking wood for the kiln",
              effect: { kind: "wood", amount: -1 },
            },
            { to: spot, carry: "log", why: `Carrying the wood to ${kiln.words}` },
            {
              flex: true,
              hours: 2.5,
              min: 0.5,
              task: "tend",
              carry: null,
              face: kiln.yaw,
              why: `Firing ${kiln.words}`,
            },
          ];
        return k % 2 === 1
          ? [
              { to: spot, carry: null, why: `To ${kiln.words}` },
              {
                flex: true,
                hours: 2,
                min: 0.5,
                task: "throw",
                carry: null,
                face: kiln.yaw,
                why: "Throwing pots at the wheel by the kiln",
              },
            ]
          : [
              { to: spot, carry: null, why: `To ${kiln.words}` },
              {
                hours: 0.1,
                task: "load",
                carry: null,
                face: kiln.yaw,
                why: `Taking the fired pots out of ${kiln.words}`,
              },
              { to: market.door, carry: "pots", why: `Bringing the pots to ${market.words}` },
              {
                hours: 0.06,
                task: "load",
                carry: "pots",
                why: `Setting the pots out at ${market.words}`,
              },
            ];
      }
      // The millers: the granary's grain carried to the mill, ground, and brought back as flour.
      case "mill": {
        const mill = doors.get("mill")?.[role.place];
        if (!mill) return errandOf({ ...role, kind: "workshop", place: -1 }, town, k);
        const spot = clearSpot(ground, beside(mill, role.seat, 2.2));
        return [
          { to: granary.door, carry: null, why: `To ${granary.words} for grain to grind` },
          { hours: 0.06, task: "load", carry: null, why: "Taking a sack of grain for the mill" },
          { to: spot, carry: "sack", why: `Carrying the grain to ${mill.words}` },
          {
            flex: true,
            hours: 2,
            min: 0.5,
            task: "tend",
            carry: null,
            face: mill.yaw,
            why: `Grinding the grain at ${mill.words}`,
          },
          { to: granary.door, carry: "sack", why: `Bringing the flour to ${granary.words}` },
          {
            hours: 0.06,
            task: "load",
            carry: "sack",
            why: `Storing the flour in ${granary.words}`,
          },
        ];
      }
      // The one who teaches: the mornings at the school's door before its rows; the afternoon at
      // their craft.
      case "teach": {
        const school = doors.get("school")?.[role.place];
        if (!school || k >= 100) return errandOf({ ...role, kind: "workshop", place: -1 }, town, k);
        return [
          {
            to: clearSpot(ground, beside(school, 0, 1, 0.8, 1)),
            carry: null,
            why: `To ${school.words}`,
          },
          {
            flex: true,
            hours: 5,
            min: 0.25,
            task: "talk",
            carry: null,
            face: school.yaw + Math.PI,
            why: `Teaching the children their letters at ${school.words}`,
          },
        ];
      }
      // The children: their letters at school in the morning, in its rows; then out to play.
      case "school": {
        const school = doors.get("school")?.[role.place];
        if (!school) return null;
        return k < 100
          ? [
              {
                to: clearSpot(ground, beside(school, role.seat, 1.1, 3, 6)),
                carry: null,
                why: `To ${school.words}`,
              },
              {
                flex: true,
                hours: 5,
                min: 0.25,
                task: "learn",
                carry: null,
                face: school.yaw,
                why: `At their letters at ${school.words}`,
              },
            ]
          : [
              { to: work, carry: null, why: "Out to play, school over" },
              {
                flex: true,
                hours: 6,
                min: 0.25,
                task: "play",
                carry: null,
                activity: ACTIVITY.playing,
                why: "Playing after school",
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
    // (Facing the way they walk; or, turning in step with others at a bend, the way they turn to.)
    yaw = leg.face ?? Math.atan2(leg.next.x - leg.at.x, leg.next.z - leg.at.z);
  } else if (leg.activity === ACTIVITY.working && leg.face !== null) {
    // Held to their work (behind a market stall, at a rising wall, at a tree): a step or two along
    // it, facing the way it does.
    // (A child at their letters keeps their place in the school's rows.)
    const along =
      Math.sin(s / 600 + index) * (leg.task === "chop" ? 0.2 : leg.task === "learn" ? 0 : 0.7);
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

/**
 * A line of a person's day told (Phase 45 M207): from when to when (seconds into the day), what
 * they are about, and how many times over (an errand run again and again: once).
 */
export type DayLine = { readonly from: number; readonly to: number; words: string; times: number };

/**
 * A person's day told (Phase 45 M207): what they are about from midnight to midnight, a line for
 * each thing in turn, the walk to it folded into it; an errand run again and again (the sheaves
 * carried in load after load) one line, with how many times.
 */
export function dayTold(plan: VillagePlan, index: number, day: number, fine = true): DayLine[] {
  const stays: { from: number; to: number; words: string; times: number }[] = [];
  let walked: number | null = null;
  for (const leg of legsOf(plan, index, day, fine)) {
    if (leg.activity === ACTIVITY.walking) {
      walked ??= leg.from;
      continue;
    }
    const words = leg.why ?? sentenceOf(ACTIVITY_WORDS[leg.activity] ?? "about"),
      last = stays.at(-1);
    if (last && last.words === words) last.to = leg.to;
    else stays.push({ from: walked ?? leg.from, to: leg.to, words, times: 1 });
    walked = null;
  }
  if (walked !== null) stays.push({ from: walked, to: DAY, words: "Walking", times: 1 });
  // (The same few things over and over: one line for them all.)
  const out: DayLine[] = [],
    same = (a: number, b: number, n: number) => {
      for (let j = 0; j < n; j++) if (stays[a + j]!.words !== stays[b + j]!.words) return false;
      return true;
    };
  for (let i = 0; i < stays.length;) {
    let run = { n: 1, times: 1 };
    for (let n = 1; n <= 4 && i + 2 * n <= stays.length; n++) {
      let times = 1;
      while (i + (times + 1) * n <= stays.length && same(i, i + times * n, n)) times++;
      if (times > 1 && times * n > run.times * run.n) run = { n, times };
    }
    const first = stays[i]!,
      end = stays[i + run.n * run.times - 1]!;
    out.push({
      from: first.from,
      to: end.to,
      words: stays
        .slice(i, i + run.n)
        .map((x, j) => (j ? x.words[0]!.toLowerCase() + x.words.slice(1) : x.words))
        .join("; "),
      times: run.times,
    });
    i += run.n * run.times;
  }
  return out;
}

/** "at home" as a line begins: "At home". */
const sentenceOf = (words: string) => words[0]!.toUpperCase() + words.slice(1);

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
  /**
   * The year in its fields (Phase 44 M206): in words for its card, and its sign for the line under
   * the bar where it is one to see (null: a fair year with nothing to tell).
   */
  readonly fields: { readonly words: string; readonly sign: string | null } | null;
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
  const words = fieldsWords(plan, t),
    year = fieldsNow(plan, t),
    sign =
      year.blight > 0.05
        ? "🥀 Blight"
        : year.dry > 0.2
          ? "☀️ Parched"
          : year.lush > 0.2 || year.blessed > 0.05
            ? "🌿 Lush"
            : reapingOn(plan, day).length
              ? "🌾 Reaping"
              : null;
  return {
    have,
    brought,
    taken,
    months: monthsOf(plan, ["grain", "food"], have.grain + have.food),
    lasts,
    lean: town.lean,
    doing: [...count].map(([kind, n]) => ({ kind, n })).sort((p, q) => q.n - p.n),
    sites: sites.map((x, k) => ({ words: x.words, x: x.x, z: x.z, hands: hands[k]! })),
    fields: words ? { words, sign } : null,
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

/** Before a home's door, as a funeral gathers there (Phase 43 M205): on its street in a town, else on its doorstep. */
function doorOfHome(plan: VillagePlan, ground: Ground, h: number): Point {
  const home = plan.homes[h]!;
  return plan.town
    ? clearSpot(ground, streetDoor(home, 0))
    : doorstep(ground, home, home.yaw, Math.max(7, (ground.homes[h]?.r ?? 5) + PERSON_REACH + 0.8));
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
  // At a fire in the town (Phase 42 M201): the fire, the water thrown, the buckets passed, the
  // dismay.
  fire: "🔥",
  douse: "💦",
  pass: "🪣",
  fill: "🪣",
  watch: "😨",
  // A funeral (Phase 43 M205): its mourners; its dead borne.
  mourn: "😢",
  bear: "⚰️",
  // The year in the fields (Phase 44 M206): the blight talked of; water poured; the blight pulled.
  blight: "🥀",
  water: "💧",
  pull: "🥀",
};

/**
 * What a person says now, as a sign (or null): the rings of talk turn over what the
 * village's own year has brought, the most pressing most often — hunger, war, grievance, a
 * death, the hunters at the flocks, the grain eaten, a newborn, what was learned; at work,
 * now and then, what they are at; the hungry and the worn out say so. By the screen's
 * clock (`s`, seconds), each person speaking in their turn, a few seconds at a time. While
 * something strikes the town (`struck`: its fire, its homes shaken down), their talk and play
 * turn to it.
 */
export function sayOf(
  plan: VillagePlan,
  index: number,
  m: Moment,
  s: number,
  struck = false,
  mourning = false,
): string | null {
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
  if (
    struck &&
    (m.task === "talk" ||
      m.task === "play" ||
      m.task === "haggle" ||
      m.task === "feast" ||
      m.task === "dance")
  )
    return pick < 0.4 ? SIGNS.fear! : pick < 0.7 ? SIGNS.grief! : SIGNS.fire!;
  // (While the town buries those a strike killed, its talk is of them.)
  if (
    mourning &&
    (m.task === "talk" ||
      m.task === "play" ||
      m.task === "haggle" ||
      m.task === "feast" ||
      m.task === "dance")
  )
    return pick < 0.7 ? SIGNS.grief! : null;
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
