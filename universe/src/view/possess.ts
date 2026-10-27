// One of a town's people possessed, as the view lays it out (Phase 60; asked for 2026-10-27: "add in
// functionality to possess anything like worldbox/worldfall mod ... make sure it works right in
// mobile"). Taking a body: where the view draws him and those near him now, each with their day's
// way ahead (momentOf, a point every five seconds); the town's solids and the places of its work
// and its stores as the view lays them (the forge before the smithy, the wheels before a kiln, the
// looms before a workshop, the fields, the granary); his trade and the day's thing it makes, as his
// day has it. Then each step's bid from the stick and the eye, those coming near joined each second,
// and the bodies the host steps drawn where it has them — the one possessed at his work, those he
// struck lying where they fell — the rest of the town drawn on at the possession's own clock.
import {
  NO_HAND_BID,
  OCC,
  POSSESS_BOUNDS,
  POSSESS_HZ,
  POSSESS_MOST,
  bidLetters,
  type HandBid,
} from "../rules/index.ts";
import type {
  PossessBody,
  PossessJoin,
  PossessLive,
  PossessNear,
  PossessPlace,
  PossessTakeArgs,
  VillagePlan,
} from "../bridge/index.ts";
import {
  ACTIVITY,
  TASKS,
  momentOf,
  smithedOn,
  thrownOn,
  villageSolids,
  type Moment,
  type Task,
} from "./village.ts";
import { HARVEST } from "./seasons.ts";
import {
  POTTERS,
  beside,
  boardsOf,
  civicDoors,
  loomOf,
  rackOf,
  storeSpots,
  townDay,
  wheelOf,
} from "./errands.ts";
import { figureOf, paceOf, partExtent } from "./figure.ts";
import { clearOf, type Ground, type Solid } from "./ground.ts";
import type { Presence } from "./presence.ts";
import type { Carry } from "./work.ts";

const DAY = 86_400;

/** How far about him the small world takes in bodies at the taking, and as they come near after (m). */
export const NEAR_M = 60,
  JOIN_M = 50;
/** A body's way ahead: a point every five seconds, as many as a way holds (a minute). */
export const WAY_STEP = 5 * POSSESS_HZ;
/** The town's solids and places taken: those within his bounds and a stride more (m). */
const SCENE_M = POSSESS_BOUNDS + 20;
/** A way's point where its body goes in at a door, out of sight (the view's own mark; the host keeps it as given). */
export const OUT_OF_SIGHT = -2;
/** Steps a second: a bid each, a second's sent at a time (rules/possess.ts). */
export const STEPS_PER_SECOND = POSSESS_HZ;
/** A step's bid of nothing: still, nothing done. */
export const STILL_BID: HandBid = NO_HAND_BID;
export type { HandBid };

/** Bids in letters, as the host takes them (three to a step). */
export function lettersOf(bids: readonly HandBid[]): string {
  return bids.map(bidLetters).join("");
}

type Point = { readonly x: number; readonly z: number };
type Person = VillagePlan["people"][number];

/**
 * How tall one of a town's people is drawn (m): their figure's top, as large as the town draws its
 * people (larger than life, as their things are) — what the eye behind one possessed stands off by.
 */
export function drawnHeight(plan: Pick<VillagePlan, "body">): number {
  const f = figureOf(plan.body);
  let top = 0;
  for (const p of f.parts) top = Math.max(top, p.y + partExtent(p)[1] / 2);
  return Math.round(((top * f.scale) / 0.1) * 100) / 100;
}

/** The hand's person a drawn one is (Agent.id; null: not one of the hand's). */
export function agentOf(p: Pick<Person, "ref">): number | null {
  if (!p.ref.startsWith("agent:")) return null;
  const id = Number(p.ref.slice(6));
  return Number.isInteger(id) && id >= 0 ? id : null;
}

const round = (v: number, k = 100) => Math.round(v * k) / k;
/** A drawn moment's task as a way keeps it (TASKS' index; -1 none; OUT_OF_SIGHT gone in). */
const taskOf = (m: Moment): number =>
  m.hidden ? OUT_OF_SIGHT : m.task ? (TASKS as readonly string[]).indexOf(m.task) : -1;

/** Where one is drawn at moment t, as a body is taken. */
function atOf(plan: VillagePlan, index: number, t: number) {
  const m = momentOf(plan, index, t);
  return {
    x: round(m.x),
    z: round(m.z),
    yaw: round(Math.atan2(Math.sin(m.yaw), Math.cos(m.yaw)), 1000),
    task: Math.max(-1, taskOf(m)),
    pace: round(paceOf(plan.body), 1000),
    hidden: m.hidden,
  };
}

/** One's day's way from step `s0` of a possession taken at `from` (world seconds): a point each WAY_STEP, a way's most. */
export function waysOf(plan: VillagePlan, index: number, from: number, s0: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < POSSESS_MOST.ways; k++) {
    const s = s0 + k * WAY_STEP,
      m = momentOf(plan, index, from + s / POSSESS_HZ);
    out.push(
      s,
      round(m.x),
      round(m.z),
      round(Math.atan2(Math.sin(m.yaw), Math.cos(m.yaw)), 1000),
      taskOf(m),
    );
  }
  return out;
}

/** His trade by what his hands make, and the day's thing it makes, as his day has it (else by his work). */
export function tradeOf(
  plan: VillagePlan,
  index: number,
  t: number,
  ground: Ground,
): { trade: string; form: string } {
  const day = Math.floor(t / DAY),
    role = townDay(plan, day, ground).roles[index],
    season = (day % 365) / 365,
    harvest = season >= HARVEST[0] && season < HARVEST[1],
    p = plan.people[index]!;
  switch (role?.kind) {
    case "smith":
      return { trade: "smith", form: smithedOn(plan, index, day) };
    case "kiln":
      return { trade: "potter", form: thrownOn(plan, index, day, 0) };
    case "workshop":
      return { trade: "weaver", form: "cloth" };
    case "reap":
    case "cart":
      return { trade: "farmer", form: "sheaf" };
    case "sow":
    case "hoe":
    case "water":
    case "pull":
      return { trade: "farmer", form: "row" };
  }
  if (p.child) return { trade: "", form: "" };
  if (p.occupation === OCC.farmer && plan.fields.length)
    return { trade: "farmer", form: harvest ? "sheaf" : "row" };
  if (p.occupation === OCC.crafter) return { trade: "smith", form: smithedOn(plan, index, day) };
  return { trade: "", form: "" };
}

/** How far a solid's wall stands from a point (m; less than nothing within it). */
const wallFrom = (s: Solid, p: Point) => clearOf(s, p);

/** The town's solids about a point, the nearest first, as many as a small world holds (seven numbers each). */
export function solidsNear(ground: Ground, at: Point): number[] {
  const all: Solid[] = [...(ground.lake ? [ground.lake] : []), ...ground.homes];
  if (ground.town) all.push(...ground.town.solids);
  return all
    .map((s) => ({ s, d: wallFrom(s, at) }))
    .filter((x) => x.d <= SCENE_M)
    .sort((a, b) => a.d - b.d)
    .slice(0, POSSESS_MOST.solids)
    .flatMap(({ s }) => [
      round(s.x, 1000),
      round(s.z, 1000),
      round(s.r, 1000),
      round(s.ax ?? 1, 1e6),
      round(s.az ?? 0, 1e6),
      round(s.half ?? 0, 1000),
      round(s.across ?? 0, 1000),
    ]);
}

/** Of each kind of workplace, the nearest taken (a great town's fields would crowd out its smithies). */
const NEAREST_OF_KIND = 3;

/**
 * The places of the town's work and stores about a point, the nearest first, as the view lays them:
 * the forge before each of the nearest smithies (a smith's anvil at each of its first five seats)
 * and the rack beside it; the nearest kilns' wheels and their drying boards; the nearest workshops'
 * looms and their doors (a village's workshop by its square); its granary; and its fields, as many
 * as there is room for.
 */
export function placesNear(
  plan: VillagePlan,
  ground: Ground,
  t: number,
  at: Point,
): PossessPlace[] {
  const spots = storeSpots(plan, ground, t),
    doors = civicDoors(plan, t),
    far = (p: Point) => Math.hypot(p.x - at.x, p.z - at.z),
    nearest = <T extends Point>(list: readonly T[], n: number): T[] =>
      list
        .filter((b) => far(b) <= SCENE_M)
        .sort((a, b) => far(a) - far(b))
        .slice(0, Math.max(0, n)),
    smithies = doors.get("smithy")?.length ? doors.get("smithy")! : [spots.smithy],
    kilns = doors.get("kiln") ?? [],
    shops = doors.get("workshop")?.length ? doors.get("workshop")! : [spots.smithy],
    out: PossessPlace[] = [],
    put = (kind: PossessPlace["kind"], p: Point, yaw: number) =>
      out.push({ kind, x: round(p.x), z: round(p.z), yaw: round(yaw, 1000) });
  for (const s of nearest(smithies, NEAREST_OF_KIND)) {
    for (let seat = 0; seat < 5; seat++) put("forge", beside(s, seat, 2.2), s.yaw);
    const rack = rackOf(s);
    put("rack", rack.stand, rack.yaw);
  }
  for (const k of nearest(kilns, NEAREST_OF_KIND)) {
    for (let w = 0; w < POTTERS; w++) {
      const wheel = wheelOf(k, w);
      put("wheel", wheel.stand, wheel.yaw);
    }
    const boards = boardsOf(k);
    put("boards", boards.stand, boards.yaw);
  }
  for (const s of nearest(shops, NEAREST_OF_KIND)) {
    for (let w = 0; w < 4; w++) {
      const loom = loomOf(s, w);
      put("loom", loom.stand, loom.yaw);
    }
    put("shop", s.door, s.yaw);
  }
  put("granary", spots.granary.door, spots.granary.yaw);
  for (const f of nearest(plan.fields, POSSESS_MOST.places - out.length))
    out.push({
      kind: "row",
      x: round(f.x),
      z: round(f.z),
      yaw: round(f.yaw, 1000),
      w: round(f.w),
      d: round(f.d),
    });
  return out
    .filter((p) => far(p) <= SCENE_M)
    .sort((a, b) => far(a) - far(b))
    .slice(0, POSSESS_MOST.places);
}

/**
 * The taking of one of those drawn (null: not one of the hand's people): where he and those near him
 * are drawn at the moment the taking will take hold (`at`, world seconds: the next of the clock held),
 * their ways ahead, his trade, the town's solids and places about him.
 */
export function takeOf(plan: VillagePlan, index: number, at: number): PossessTakeArgs | null {
  const p = plan.people[index],
    id = p ? agentOf(p) : null;
  if (!p || id === null) return null;
  const ground = villageSolids(plan),
    me = atOf(plan, index, at),
    near: { id: number; j: number; a: ReturnType<typeof atOf>; d: number }[] = [];
  plan.people.forEach((q, j) => {
    const qid = agentOf(q);
    if (j === index || qid === null) return;
    const a = atOf(plan, j, at),
      d = Math.hypot(a.x - me.x, a.z - me.z);
    if (a.hidden || d > NEAR_M) return;
    near.push({ id: qid, j, a, d });
  });
  near.sort((a, b) => a.d - b.d || a.id - b.id);
  const { hidden, ...here } = me;
  void hidden;
  return {
    agent: id,
    at: here,
    ...tradeOf(plan, index, at, ground),
    near: near.slice(0, POSSESS_MOST.bodies - 1).map(({ id: qid, j, a }): PossessNear => {
      const { hidden: gone, ...seen } = a;
      void gone;
      return { id: qid, ...seen, ways: waysOf(plan, j, at, 0) };
    }),
    solids: solidsNear(ground, me),
    places: placesNear(plan, ground, at, me),
  };
}

/** Where each trade works, as the small world's places have it. */
const TRADE_KIND: Readonly<Record<string, PossessPlace["kind"]>> = {
  smith: "forge",
  potter: "wheel",
  weaver: "loom",
  farmer: "row",
};

/**
 * One of those drawn as a taking at `t` would have them: their trade and the day's thing, and how
 * far the nearest place of their work stands from them (m; -1: none within their reach).
 */
export function workOf(
  plan: VillagePlan,
  index: number,
  t: number,
): { trade: string; form: string; far: number } {
  const ground = villageSolids(plan),
    work = tradeOf(plan, index, t, ground),
    kind = TRADE_KIND[work.trade];
  if (!kind) return { ...work, far: -1 };
  const m = momentOf(plan, index, t),
    p = placesNear(plan, ground, t, m).find((q) => q.kind === kind);
  return { ...work, far: p ? Math.round(Math.hypot(p.x - m.x, p.z - m.z) * 10) / 10 : -1 };
}

/**
 * Those to join a second of the small world beginning at step `s` (a possession taken at `from`):
 * those of the hand's people drawn within JOIN_M of him and not in it, the nearest first; and those
 * in it whose way runs out within the next twenty seconds, their way given again — as many as a
 * second takes.
 */
export function joinsAt(
  plan: VillagePlan,
  from: number,
  s: number,
  me: Point,
  inWorld: ReadonlyMap<number, number>,
): PossessJoin[] {
  const t = from + s / POSSESS_HZ,
    coming: { id: number; j: number; a: ReturnType<typeof atOf>; d: number }[] = [];
  plan.people.forEach((q, j) => {
    const id = agentOf(q);
    if (id === null) return;
    const lastWay = inWorld.get(id);
    if (lastWay !== undefined && lastWay > s + 20 * POSSESS_HZ) return;
    const a = atOf(plan, j, t),
      d = Math.hypot(a.x - me.x, a.z - me.z);
    if (lastWay === undefined && (a.hidden || d > JOIN_M)) return;
    coming.push({ id, j, a, d });
  });
  // (Their ways reckoned for those that join only: a way is a dozen moments of a day.)
  return coming
    .sort((a, b) => a.d - b.d || a.id - b.id)
    .slice(0, POSSESS_MOST.joins)
    .map(({ id, j, a }) => {
      const { hidden, ...seen } = a;
      void hidden;
      return { id, ...seen, ways: waysOf(plan, j, from, s), when: 0 };
    });
}

/**
 * A step's bid from the stick (x to the right, y ahead, each -1 … 1 as the screen has them; the
 * eye's yaw the way it looks): which way on the ground, at a run or not, and the act (0 none).
 */
export function bidOf(
  stick: { readonly x: number; readonly y: number },
  eyeYaw: number,
  run: boolean,
  act: number,
): HandBid {
  // (The eye looking along (sin yaw, cos yaw), its right is (-cos yaw, sin yaw), as the view draws.)
  const l = Math.min(1, Math.hypot(stick.x, stick.y)),
    k = l > 0 ? l / Math.hypot(stick.x, stick.y) : 0,
    gx = (stick.y * Math.sin(eyeYaw) - stick.x * Math.cos(eyeYaw)) * k,
    gz = (stick.y * Math.cos(eyeYaw) + stick.x * Math.sin(eyeYaw)) * k;
  return { mx: Math.round(31 * gx), mz: Math.round(31 * gz), run, act };
}

/** What a body at its doing is seen at (the view's task), by the trade and the day's thing of the one possessed. */
function doingTask(b: PossessBody, trade: string, form: string): Task | null {
  switch (b.doing) {
    case "work":
      return trade === "smith"
        ? "hammer"
        : trade === "potter"
          ? "throw"
          : trade === "weaver"
            ? "weave"
            : form === "sheaf"
              ? "reap"
              : "hoe";
    case "strike":
    case "fight":
    case "wrestle":
      return "brawl";
    case "listen":
      return "talk";
    case "watch":
      return "watch";
    case "way":
      return b.task >= 0 ? ((TASKS[b.task] as Task | undefined) ?? null) : null;
    case "hand":
      return b.say === "💬" ? "talk" : null;
    default:
      return null;
  }
}

/** What a body is about, in words (its card's line). */
const DOING_WORDS: Readonly<Record<string, string>> = {
  hand: "In the god's hand",
  work: "At work by the god's hand",
  listen: "Hearing a word",
  strike: "Striking",
  wrestle: "Wrestling",
  thrown: "Thrown to the ground",
  down: "Struck down",
  dead: "Dead",
  flee: "Fleeing",
  fight: "Fighting",
  come: "Running to part the brawl",
  watch: "Looking on",
};

/** Whether a body lies on the ground. */
export const lying = (b: Pick<PossessBody, "doing">) =>
  b.doing === "down" || b.doing === "dead" || b.doing === "thrown";

/**
 * A body of the small world as the view draws it, `ahead` seconds past the step the host told of it
 * (carried on at its pace, a tenth of a second at most): where, which way, at what, carrying what.
 */
export function bodyMoment(
  b: PossessBody,
  ahead: number,
  trade: string,
  form: string,
  possessed: boolean,
): Moment {
  const k = Math.max(0, Math.min(0.1, ahead)),
    down = lying(b),
    moving = !down && Math.hypot(b.vx, b.vz) > 0.3,
    gone = b.doing === "way" && b.task === OUT_OF_SIGHT && !moving;
  return {
    x: b.x + (down ? 0 : b.vx * k),
    z: b.z + (down ? 0 : b.vz * k),
    yaw: b.yaw,
    activity: moving ? ACTIVITY.walking : ACTIVITY.resting,
    task: moving ? null : doingTask(b, possessed ? trade : "", form),
    hidden: gone,
    hunger: 0,
    tiredness: 0,
    carry: (b.carry as Carry | null) ?? null,
    why: DOING_WORDS[b.doing] ?? null,
  };
}

/** What the town drawn wants of one of its people possessed (render/village.ts). */
export type PosedHook = {
  /** The moment the town is drawn at, given the clock's. */
  at(t: number): number;
  /** Those of the small world drawn where it has them (in place), their presences carried with them. */
  pose(
    drawn: { moment: Moment; size: number; stride: number }[],
    presence: Map<string, Presence>,
  ): void;
  /** Those drawn lying struck down (the plan's indices). */
  readonly downed: ReadonlySet<number>;
};

/**
 * The small world's bodies laid over the town drawn: the possession's clock (steps since it was
 * taken, at `from`), the host's last word of its bodies and the step it told of, carried on to now;
 * the strides kept by the possession's own clock, so the legs keep pace with the ground covered.
 */
export class PosedBodies implements PosedHook {
  /** The possession's clock: steps since the taking (fractions between). */
  step = 0;
  live: PossessLive | null = null;
  readonly downed = new Set<number>();
  private readonly strides = new Map<number, number>();
  private posedAt = 0;
  private readonly index: ReadonlyMap<number, number>;
  private readonly refs: readonly string[];

  /** The world's moment at the taking; his trade and the day's thing; who he is (Agent.id). */
  readonly from: number;
  readonly trade: string;
  readonly form: string;
  readonly agent: number;

  constructor(plan: VillagePlan, from: number, trade: string, form: string, agent: number) {
    this.from = from;
    this.trade = trade;
    this.form = form;
    this.agent = agent;
    const index = new Map<number, number>();
    plan.people.forEach((p, i) => {
      const id = agentOf(p);
      if (id !== null) index.set(id, i);
    });
    this.index = index;
    this.refs = plan.people.map((p) => p.ref);
  }

  /** Which of those drawn a body is (-1: not drawn). */
  indexOf(id: number): number {
    return this.index.get(id) ?? -1;
  }

  at(): number {
    return this.from + this.step / POSSESS_HZ;
  }

  /** A body as it is drawn now (null: not in the small world). */
  drawnAt(id: number): Moment | null {
    const b = this.live?.bodies.find((x) => x.id === id);
    return b ? bodyMoment(b, this.ahead(), this.trade, this.form, id === this.agent) : null;
  }

  private ahead(): number {
    return this.live ? (this.step - this.live.step) / POSSESS_HZ : 0;
  }

  pose(
    drawn: { moment: Moment; size: number; stride: number }[],
    presence: Map<string, Presence>,
  ): void {
    const live = this.live;
    this.downed.clear();
    if (!live) return;
    const dt = Math.max(0, Math.min(0.25, (this.step - this.posedAt) / POSSESS_HZ)),
      ahead = this.ahead();
    this.posedAt = this.step;
    for (const b of live.bodies) {
      const i = this.index.get(b.id);
      if (i === undefined || !drawn[i]) continue;
      const m = bodyMoment(b, ahead, this.trade, this.form, b.id === this.agent),
        speed = Math.hypot(b.vx, b.vz),
        // (The legs at a walk's pace a stride a second; quicker as they go faster.)
        stride = (this.strides.get(b.id) ?? drawn[i].stride) + dt * Math.max(1, speed / 1.3);
      this.strides.set(b.id, stride);
      if (lying(b)) this.downed.add(i);
      drawn[i] = { moment: m, size: m.hidden ? 0 : 1, stride };
      const p = presence.get(this.refs[i]!);
      if (p) {
        p.x = m.x;
        p.z = m.z;
        p.yaw = m.yaw;
        p.vx = lying(b) ? 0 : b.vx;
        p.vz = lying(b) ? 0 : b.vz;
        p.size = m.hidden ? 0 : 1;
        p.blinking = false;
        p.stride = stride;
      }
    }
  }
}
