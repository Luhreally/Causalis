// A fight of the underworld seen in its town (asked for 2026-11-16: "why cant I click to watch gang wars yet either? like they
// recorded but i cant watch?"; and then: "they must look different from normal wars"). Not a battle: no lines, no fronts, no
// hosts drawn up. A few men at a time in many small places over the scene's span, mostly by night or at dusk — on the edge between
// the two groups' quarters, at the market, at the busiest crossings, where goods come in by the docks or the station or the road —
// while the town goes on about them; the fallen lying where they fell after, and a crowd come to them. Soldiers sent against a
// group are another thing again: squads in their realm's colours going into its quarter street by street from the gate, a post
// left standing at each crossing they take, the group's men met at some of them. The places are read off the town as it is laid
// now — its street graph's crossings, its buildings by their kind, its road in — so a town laid out anew has its own.
//
// Who falls, how many and who holds it at the end are history's (bridge/streetfight.ts), scaled to the figures a side the town
// draws; everything else is the eye's, drawn by the event's ref so it plays the same every time. Never how it was fought. Pure.
import {
  townLots,
  woundStage,
  type BattleNear,
  type BattleSideNear,
  type StreetFight,
  type StreetFightKind,
  type VillagePlan,
} from "../bridge/index.ts";
import { blowOf, sideWounds } from "../rules/index.ts";
import { hashText, unitOf } from "./draws.ts";
import { clearOfHall, marketScene, squareScale } from "./feast.ts";
import { keepOut, route, villageGround } from "./ground.ts";
import { memorialsPlaced } from "./memorial.ts";
import { armLook } from "./arms.ts";
import {
  PLACED_SCALE,
  type Act,
  type BattleField,
  type BattleNow,
  type HostDrawn,
  type Trooper,
  type TrooperNow,
} from "./battle.ts";
import { newBlows, type Blows } from "./blows.ts";
import type { PlacedFrame, Watcher } from "./placed.ts";
import type { TownWarScene } from "./townwar.ts";
import type { Soldier } from "./war.ts";

type Point = { readonly x: number; readonly z: number };

/** Why a place was chosen: what it is in the town. */
export type SpotWhy = "border" | "market" | "crossing" | "docks" | "station" | "gate" | "square";
export type FightSpot = Point & { readonly why: SpotWhy };

/** A place in words, as the scene's line tells where it is now. */
export const SPOT_WORDS: Readonly<Record<SpotWhy, string>> = {
  border: "on the streets between their quarters",
  market: "at the market",
  crossing: "at a crossing",
  docks: "by the docks, where goods come in",
  station: "by the station, where goods come in",
  gate: "where the road comes in",
  square: "in the square",
};

/** How far a figure keeps off the walls on its way (metres); how far apart two places are at the least. */
const REACH = 0.6,
  APART = 14;
/** Seconds: a figure's coming to its place, a clash's length (at the least, and more by a draw), the time between clashes. */
const COMES = 3.2,
  CLASH = 9,
  CLASH_MORE = 5,
  EVERY = 6.5;
/** A survivor's going after its clash (seconds), and how long the scene holds on what is left after the last (seconds). */
/** How long the two sides stand off at a place before they close (seconds). */
const STAND_OFF = 2.6;
/** A man's reach about him (metres, as the town draws its people: larger than life; no two stand nearer than twice it); an arm's length between two who fight; pairs so far apart, so many abreast; how far back each stands off first. */
export const BODY = 0.5;
const ARM = 1.7,
  PAIR_GAP = 2.4,
  PAIRS = 6,
  OFF = 2.6;
/** How long after the one before him each of a file sets out, and comes (seconds). */
const FILE = 0.2;
/** The most of a post's soldiers abreast across a street. */
const CORDON = 3;
const GOES = 4,
  AFTER = 16;
/** A squad's pace into a quarter (metres a second), and the longest it takes to reach its post (seconds). */
const PACE = 2.6,
  LONGEST = 14;
/** The most places a scene's clashes are spread over, and the most of the side's slots it draws (a share). */
/** The share of the day it is seen at: late in the day, the sun low and still up — the town in its own colours, its shadows long. */
export const DUSK = 0.705;
/** The most of a side at a year's preying on a road or a coast: a few, at one place. */
const RAID_MOST = 9;
const MOST_SPOTS = 8,
  DRAWN = 0.8;

/** One man of it, as the scene moves him. */
export type StreetFigure = {
  readonly side: 0 | 1;
  /** His slot among his side's (0 … the slots a side has). */
  readonly slot: number;
  /** His way to his place, its last point his place. */
  readonly path: readonly Point[];
  /** What he faces there. */
  readonly face: Point;
  /** Where he closes to when he fights (his place where absent): face to face with his man, an arm's length off. */
  readonly meet?: Point;
  /** When he sets out, and when he is there (seconds). */
  readonly from: number;
  readonly arrive: number;
  /** When he fights there (null: he stands, as a post does). */
  readonly fight: readonly [number, number] | null;
  /** When he falls (null: he lives), and when he goes back the way he came (null: he holds his place to the end). */
  readonly falls: number | null;
  readonly leaves: number | null;
};

export type StreetClash = {
  readonly spot: FightSpot;
  readonly from: number;
  readonly to: number;
};

export type StreetScript = {
  readonly kind: StreetFightKind;
  /** The share of the day it is seen at. */
  readonly hour: number;
  readonly figures: readonly StreetFigure[];
  readonly clashes: readonly StreetClash[];
  /** The soldiers' posts (army): where, which way, when each is first held. */
  readonly posts: readonly (Point & { readonly yaw: number; readonly at: number })[];
  /** Each side's figures, and of them those who fall: history's men and dead at one scale. */
  readonly drawn: readonly [number, number];
  readonly falls: readonly [number, number];
  /** When the last of it is over, and when the scene ends. */
  readonly quiet: number;
  readonly end: number;
  /** Those of neither side who fall (history's, at the figures' scale): where, and when. */
  readonly bystanders: readonly (Point & { readonly at: number; readonly from: number })[];
  /** Which sides came in armoured carriers (its means say so). */
  readonly carriers: readonly [boolean, boolean];
  /** Whether its town is past the age of engines (its people get about on wheels): a carrier is a plated truck, else a boarded cart. */
  readonly engines: boolean;
};
type Core = Omit<StreetScript, "bystanders" | "carriers" | "engines">;

/** The figures of each side and their fallen, history's numbers at one scale, as many a side as `cap` at the most. */
export function scaled(
  f: StreetFight,
  cap: number,
): { drawn: [number, number]; falls: [number, number] } {
  // (Those who were in it: its men still living there and its dead besides.)
  const men = f.sides.map((s) => Math.max(2, s.men + s.fallen)),
    k = Math.min(1, cap / Math.max(1, ...men)),
    drawn = men.map((m) => Math.max(1, Math.round(m * k))) as [number, number],
    falls = f.sides.map((s, i) =>
      s.fallen > 0 ? Math.min(drawn[i]!, Math.max(1, Math.round(s.fallen * k))) : 0,
    ) as [number, number];
  return { drawn, falls };
}

/**
 * The places in a town a fight of the underworld is seen at, by what they are: the crossings on the edge between the two groups'
 * quarters (each side's quarter the half of the town toward `quarter`, or away), the market, the busiest crossings, where goods
 * come in (the docks, the station, else where the road comes in), the square. Read off its streets and buildings as they are now.
 */
export function fightSpots(plan: VillagePlan, quarter: number): FightSpot[] {
  const ground = villageGround(plan),
    town = plan.town,
    nx = Math.cos(quarter),
    nz = Math.sin(quarter),
    way = Math.atan2(plan.road.z, plan.road.x),
    gate: Point = {
      x: Math.cos(way) * (ground.homesReach + 4),
      z: Math.sin(way) * (ground.homesReach + 4),
    },
    // (The crossings where most streets meet; a village with no streets, the ways before its homes.)
    cross: Point[] = ground.town
      ? ground.town.crossings(REACH, 28, 9)
      : plan.homes.slice(0, 28).map((h) => ({ x: h.x * 0.82, z: h.z * 0.82 })),
    out: FightSpot[] = [],
    put = (p: Point | undefined, why: SpotWhy) => {
      if (!p || out.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < APART)) return;
      out.push({ x: p.x, z: p.z, why });
    },
    nearest = (p: Point): Point | undefined =>
      [...cross].sort(
        (a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
      )[0],
    lots = town ? townLots(town.family, town.seed, town.axis, town.lots, town.water) : null,
    civic = (kind: string): Point | undefined => {
      const c = town?.civics.find((x) => x.kind === kind && x.fell === null && x.at < town.lots);
      if (!c || !lots) return undefined;
      const at = { x: lots.x[c.at]!, z: lots.z[c.at]! },
        near = nearest(at);
      if (near && Math.hypot(near.x - at.x, near.z - at.z) < 60) return near;
      // (No crossing by it: the street before it, out of its own block.)
      const out = { x: at.x, z: at.z };
      ground.town?.keepOut(out, 3);
      return out;
    };
  // (The edge between their quarters: the crossings nearest the line between, the nearer the middle the sooner.)
  for (const p of [...cross]
    .sort(
      (a, b) =>
        Math.abs(a.x * nx + a.z * nz) - Math.abs(b.x * nx + b.z * nz) ||
        Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z),
    )
    .slice(0, 3))
    put(p, "border");
  put(civic("market"), "market");
  for (const p of cross.slice(0, 6)) put(p, "crossing");
  const docks = civic("docks"),
    station = civic("station");
  if (docks) put(docks, "docks");
  if (station) put(station, "station");
  if (!docks && !station) put(gate, "gate");
  // (The square: its open ground toward the road, clear of what stands at its middle.)
  if (town) put({ x: Math.cos(way) * 13, z: Math.sin(way) * 13 }, "square");
  return out.slice(0, MOST_SPOTS);
}

/** Where a side comes from to a place: a crossing of its own quarter not far off, else so far into it from the place. */
function cameFrom(
  cross: readonly Point[],
  spot: Point,
  nx: number,
  nz: number,
  sign: number,
  u: number,
) {
  const own = cross.filter((p) => {
    const d = Math.hypot(p.x - spot.x, p.z - spot.z);
    return (p.x * nx + p.z * nz) * sign > 0 && d > 10 && d < 48;
  });
  return own.length
    ? own[Math.floor(u * own.length) % own.length]!
    : { x: spot.x + nx * sign * 18, z: spot.z + nz * sign * 18 };
}

/** A path's length (metres). */
function lengthOf(path: readonly Point[]): number {
  let n = 0;
  for (let i = 1; i < path.length; i++)
    n += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.z - path[i - 1]!.z);
  return n;
}

/**
 * A fight's script in a town: its places, its clashes and when, every figure's way, place, fight, fall and going — `slots` a side
 * at the most (what the town draws a side as). Drawn by the event's ref, so it plays the same every time.
 */
export function streetScript(f: StreetFight, plan: VillagePlan, slots: number): StreetScript {
  const core = coreScript(f, plan, slots),
    key = hashText(f.event),
    cap = Math.max(2, Math.floor(slots * DRAWN)),
    k = Math.min(1, cap / Math.max(1, ...f.sides.map((x) => Math.max(2, x.men + x.fallen)))),
    n =
      f.others > 0 && core.clashes.length ? Math.max(1, Math.min(6, Math.round(f.others * k))) : 0,
    bystanders = [...Array(n).keys()].map((j) => {
      const c = core.clashes[j % core.clashes.length]!,
        a = unitOf(key, 2000 + j, 0) * 2 * Math.PI,
        // (Out past where the two sides meet, wherever there is room.)
        r = 8 + unitOf(key, 2100 + j, 0) * 3 + j * 0.9,
        at = { x: c.spot.x + Math.sin(a) * r, z: c.spot.z + Math.cos(a) * r };
      standClear(plan, at);
      return {
        x: at.x,
        z: at.z,
        from: c.from - 1,
        at: c.from + 2 + unitOf(key, 2200 + j, 0) * Math.max(1, c.to - c.from - 3),
      };
    });
  // Where each stands off and where each meets his man: no two nearer than a body's width and a hand more, none in what stands
  // in the street (worked out once, as the script is made).
  const ends = core.figures.map((g) => g.path[g.path.length - 1] as { x: number; z: number }),
    meets = core.figures.map(
      (g, i) => (g.meet as { x: number; z: number } | undefined) ?? ends[i]!,
    );
  spread(plan, ends, []);
  spread(
    plan,
    meets.filter((m, i) => m !== ends[i]),
    meets.filter((m, i) => m === ends[i]),
  );
  return {
    ...core,
    bystanders,
    carriers: [f.sides[0].carriers === true, f.sides[1].carriers === true],
    engines: plan.about?.how === "wheels",
  };
}

function coreScript(f: StreetFight, plan: VillagePlan, slots: number): Core {
  const key = hashText(f.event),
    u = (i: number, n = 0) => unitOf(key, i, n),
    ground = villageGround(plan),
    quarter = u(1) * 2 * Math.PI,
    nx = Math.cos(quarter),
    nz = Math.sin(quarter),
    all = fightSpots(plan, quarter),
    // (A raid: where goods come in — the road, the docks — and nowhere else.)
    way = Math.atan2(plan.road.z, plan.road.x),
    comeIn = all.filter((x) => x.why === "gate" || x.why === "docks" || x.why === "station"),
    spots: readonly FightSpot[] =
      f.kind !== "raid"
        ? all
        : comeIn.length
          ? comeIn
          : [
              {
                x: Math.cos(way) * (ground.homesReach + 4),
                z: Math.sin(way) * (ground.homesReach + 4),
                why: "gate",
              },
            ],
    cross = ground.town
      ? ground.town.crossings(REACH, 28, 9)
      : plan.homes.slice(0, 28).map((h) => ({ x: h.x * 0.82, z: h.z * 0.82 })),
    { drawn, falls } = scaled(
      f,
      f.kind === "raid" ? RAID_MOST : Math.max(2, Math.floor(slots * DRAWN)),
    ),
    figures: StreetFigure[] = [],
    clashes: StreetClash[] = [],
    posts: (Point & { yaw: number; at: number })[] = [],
    // (At dusk: the sun low and warm, its windows lit, its streets and who is in them plain to see.)
    hour = DUSK;
  if (!spots.length) {
    return { kind: f.kind, hour, figures, clashes, posts, drawn, falls, quiet: 0, end: AFTER };
  }
  if (f.kind === "army") return armyScript(f, plan, spots, cross, drawn, falls, hour, u, nx, nz);

  // Turf and street: so many small clashes over the places, a few men of each side at each.
  const n = Math.max(
      1,
      Math.min(MOST_SPOTS, spots.length, drawn[0], drawn[1], Math.ceil((drawn[0] + drawn[1]) / 6)),
    ),
    order = [...spots.keys()],
    each: number[][] = [[], []];
  for (let k = 0; k < n; k++) {
    const spot = spots[order[k % order.length]!]!,
      from = 2 + k * EVERY + u(10 + k) * 1.5,
      to = from + CLASH + u(30 + k) * CLASH_MORE;
    clashes.push({ spot, from, to });
  }
  // (Each side's men dealt out over the clashes from a drawn start; its fallen spread the same way.)
  for (const side of [0, 1] as const)
    for (let m = 0; m < drawn[side]; m++) each[side]!.push((m + Math.floor(u(50 + side) * n)) % n);
  const last = clashes.length - 1;
  for (const side of [0, 1] as const) {
    const sign = side === 0 ? 1 : -1,
      // (Who of them falls: spread over the clashes, a draw within each.)
      fallers = new Set<number>(),
      byClash = clashes.map((_, k) =>
        each[side]!.map((c, m) => (c === k ? m : -1)).filter((m) => m >= 0),
      );
    for (let d = 0, k = 0, guard = 0; d < falls[side] && guard < 10_000; guard++, k = (k + 1) % n) {
      const left = byClash[k]!.filter((m) => !fallers.has(m));
      if (!left.length) continue;
      fallers.add(left[Math.floor(u(200 + side * 997 + d) * left.length) % left.length]!);
      d++;
    }
    const starts = clashes.map((c, k) =>
        cameFrom(cross, c.spot, nx, nz, sign, u(70 + k * 2 + side)),
      ),
      others = clashes.map((c, k) =>
        cameFrom(cross, c.spot, nx, nz, -sign, u(70 + k * 2 + (1 - side))),
      ),
      ways = clashes.map((c, k) => route(ground, starts[k]!, c.spot, REACH));
    for (let m = 0; m < drawn[side]; m++) {
      const k = each[side]![m]!,
        c = clashes[k]!,
        base = ways[k]!,
        // (The line the two sides meet across: from the one's way in to the other's.)
        a0 = side === 0 ? starts[k]! : others[k]!,
        a1 = side === 0 ? others[k]! : starts[k]!,
        al = Math.hypot(a0.x - a1.x, a0.z - a1.z),
        ax = al > 1 ? (a0.x - a1.x) / al : nx,
        az = al > 1 ? (a0.z - a1.z) / al : nz,
        rank = byClash[k]!.indexOf(m),
        mine = byClash[k]!.length,
        col = rank % PAIRS,
        row = Math.floor(rank / PAIRS),
        across = (col - (Math.min(PAIRS, mine - row * PAIRS) - 1) / 2) * PAIR_GAP,
        deep = ARM / 2 + row * 2.2,
        meet = {
          x: c.spot.x - az * across + ax * sign * deep,
          z: c.spot.z + ax * across + az * sign * deep,
        },
        place = { x: meet.x + ax * sign * OFF, z: meet.z + az * sign * OFF };
      standClear(plan, meet);
      standClear(plan, place);
      const path = [...base.slice(0, -1), place],
        // (In file down the street: each a step behind the one before.)
        late = Math.min(2.2, rank * FILE),
        setOut = c.from - COMES + late,
        fight = [c.from + STAND_OFF + u(600 + side * 131 + m) * 0.8, c.to] as const,
        falling = fallers.has(m),
        winner = f.won === side && k === last;
      figures.push({
        side,
        slot: m,
        path,
        // (He faces his man across the line.)
        face: { x: meet.x - ax * sign * 2, z: meet.z - az * sign * 2 },
        meet,
        from: setOut,
        arrive: c.from + late,
        fight,
        falls: falling
          ? fight[0] + 1.5 + u(700 + side * 131 + m) * Math.max(0.5, fight[1] - fight[0] - 3)
          : null,
        // (The winner's men at the last of it hold their ground; the rest go back the way they came.)
        leaves: falling || winner ? null : c.to,
      });
    }
  }
  const quiet = clashes.length ? clashes[last]!.to : 0;
  return { kind: f.kind, hour, figures, clashes, posts, drawn, falls, quiet, end: quiet + AFTER };
}

/** Soldiers into a quarter: squads from where the road comes in to a post at each crossing they take; the group's men met at some. */
function armyScript(
  f: StreetFight,
  plan: VillagePlan,
  spots: readonly FightSpot[],
  cross: readonly Point[],
  drawn: [number, number],
  falls: [number, number],
  hour: number,
  u: (i: number, n?: number) => number,
  nx: number,
  nz: number,
): Core {
  const ground = villageGround(plan),
    gate = spots.find((s) => s.why === "gate" || s.why === "docks" || s.why === "station") ?? {
      x: Math.cos(Math.atan2(plan.road.z, plan.road.x)) * (ground.homesReach + 4),
      z: Math.sin(Math.atan2(plan.road.z, plan.road.x)) * (ground.homesReach + 4),
      why: "gate" as const,
    },
    // (The group's quarter: the half of the town away from `quarter`; its crossings taken nearest the gate first, then on.)
    quarterOf = cross.filter((p) => p.x * nx + p.z * nz < 0),
    // (Never in its square, among its market and its people; each post well apart from the next.)
    streets = (quarterOf.length >= 2 ? quarterOf : cross).filter((q) => Math.hypot(q.x, q.z) > 24),
    pool = (streets.length >= 2 ? streets : quarterOf.length >= 2 ? quarterOf : cross).slice(),
    take: Point[] = [];
  let at: Point = gate;
  // (A post for every six of them, eight at the most: no more than a front rank of three and a rank behind at any.)
  const squads = Math.max(1, Math.min(8, pool.length, Math.ceil(drawn[0] / 6)));
  while (take.length < squads && pool.length) {
    pool.sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z));
    const next = pool.shift()!;
    if (take.some((q) => Math.hypot(q.x - next.x, q.z - next.z) < 26)) continue;
    take.push(next);
    at = next;
  }
  if (!take.length) take.push(spots[0]!);
  // Each squad's way: the gate to its post, by the posts before it (street by street).
  const ways: Point[][] = [];
  let way: Point[] = [gate];
  for (const p of take) {
    const leg = route(ground, way[way.length - 1]!, p, REACH);
    way = [...way, ...leg.slice(1)];
    ways.push(way);
  }
  const figures: StreetFigure[] = [],
    clashes: StreetClash[] = [],
    posts: (Point & { yaw: number; at: number })[] = [],
    times = ways.map((w, j) => {
      // (The furthest post taken first: no squad marches through another's cordon.)
      const from = 1.5 + (ways.length - 1 - j) * 4.5,
        go = Math.min(LONGEST, lengthOf(w) / PACE);
      return { from, arrive: from + go };
    });
  take.forEach((p, j) => {
    const prev = ways[j]!.length > 1 ? ways[j]![ways[j]!.length - 2]! : gate;
    posts.push({
      x: p.x,
      z: p.z,
      yaw: Math.atan2(p.x - prev.x, p.z - prev.z),
      at: times[j]!.arrive,
    });
  });
  // (Where the group's men meet them: at the posts, a clash at each in turn once it is held, as many as the dead told need.)
  // (Where the group's men meet them: at so many posts as there are three of its men for, the nearest the road in first.)
  const meets = Math.max(1, Math.min(take.length, Math.ceil(drawn[1] / 3)));
  for (let j = 0; j < meets; j++) {
    const from = times[j]!.arrive + 2 + u(900 + j) * 2;
    clashes.push({
      spot: { x: take[j]!.x, z: take[j]!.z, why: "crossing" },
      from,
      to: from + (falls[0] + falls[1] > 0 ? CLASH + u(910 + j) * CLASH_MORE : 6),
    });
  }
  // The soldiers: dealt out over the squads, each to its post, standing there from then on (some fall where the dead told need).
  const soldierFalls = new Set<number>();
  for (let d = 0; d < falls[0]; d++) {
    const left = [...Array(drawn[0]).keys()].filter(
      (m) => !soldierFalls.has(m) && m % take.length < meets,
    );
    if (!left.length) break;
    soldierFalls.add(left[Math.floor(u(1000 + d) * left.length) % left.length]!);
  }
  for (let m = 0; m < drawn[0]; m++) {
    const j = m % take.length,
      t = times[j]!,
      row = Math.floor(m / take.length),
      p = take[j]!,
      yaw = posts[j]!.yaw,
      // (Stood about the post, facing on into the quarter.)
      // (A cordon across the street: so many abreast, a pace apart, the rest behind them; all facing on into the quarter.)
      about = Math.max(1, Math.ceil(drawn[0] / take.length)),
      abreast = Math.min(CORDON, about),
      col = row % abreast,
      rank = Math.floor(row / abreast),
      side = (col - (abreast - 1) / 2) * 2.2,
      place = {
        x: p.x + Math.cos(yaw) * side - Math.sin(yaw) * rank * 2.3,
        z: p.z - Math.sin(yaw) * side - Math.cos(yaw) * rank * 2.3,
      },
      c = clashes[j],
      falling = soldierFalls.has(m) && !!c;
    figures.push({
      side: 0,
      slot: m,
      path: [...ways[j]!.slice(0, -1), place],
      face: { x: p.x + Math.sin(yaw) * 10, z: p.z + Math.cos(yaw) * 10 },
      from: t.from + row * 0.45,
      arrive: t.arrive + row * 0.45,
      // (The front rank alone in contact; those behind stand, unless one of them is to fall.)
      fight: c && (rank === 0 || falling) ? [c.from, c.to] : null,
      falls: falling ? c.from + 1.5 + u(1100 + m) * Math.max(0.5, c.to - c.from - 3) : null,
      leaves: null,
    });
  }
  // The group's men: come from deeper in their quarter to the posts they meet; some fall, the rest go back.
  const groupFalls = new Set<number>();
  for (let d = 0; d < falls[1]; d++) {
    const left = [...Array(drawn[1]).keys()].filter((m) => !groupFalls.has(m));
    if (!left.length) break;
    groupFalls.add(left[Math.floor(u(1200 + d) * left.length) % left.length]!);
  }
  if (clashes.length)
    for (let m = 0; m < drawn[1]; m++) {
      const k = m % clashes.length,
        c = clashes[k]!,
        start = cameFrom(cross, c.spot, nx, nz, -1, u(1300 + k)),
        base = route(ground, start, c.spot, REACH),
        back = base.length > 1 ? base[base.length - 2]! : start,
        bx = back.x - c.spot.x,
        bz = back.z - c.spot.z,
        bl = Math.hypot(bx, bz) || 1,
        // (Where no one dies of it: they stand off and watch, further back, and go.)
        wide = 0.6,
        there = Math.ceil((drawn[1] - k) / clashes.length),
        rank = Math.floor(m / clashes.length),
        out = wide + (falls[0] + falls[1] > 0 ? OFF + ARM : 9) + Math.floor(rank / 6) * 2.4,
        // (Six abreast across the street; the rest a rank behind them.)
        behind = Math.floor(rank / 6) * 2.4,
        across = ((rank % 6) - (Math.min(6, there) - 1) / 2) * 2.1,
        place = {
          x: c.spot.x + (bx / bl) * out - (bz / bl) * across,
          z: c.spot.z + (bz / bl) * out + (bx / bl) * across,
        },
        meet = {
          x: c.spot.x + (bx / bl) * (wide + ARM + behind) - (bz / bl) * across,
          z: c.spot.z + (bz / bl) * (wide + ARM + behind) + (bx / bl) * across,
        },
        fight = [c.from + STAND_OFF + u(1600 + m) * 0.8, c.to + STAND_OFF] as const,
        falling = groupFalls.has(m);
      figures.push({
        side: 1,
        slot: m,
        path: [...base.slice(0, -1), place],
        face: c.spot,
        ...(falls[0] + falls[1] > 0 ? { meet } : {}),
        from: c.from - COMES + Math.min(2.2, rank * FILE),
        arrive: c.from + Math.min(2.2, rank * FILE),
        // (Six of them in contact at the most; those behind stand, unless one of them is to fall.)
        fight: falls[0] + falls[1] > 0 && (rank < 6 || falling) ? fight : null,
        falls: falling
          ? fight[0] + 1.5 + u(1800 + m) * Math.max(0.5, fight[1] - fight[0] - 3)
          : null,
        leaves: falling ? null : c.to,
      });
    }
  const quiet = Math.max(...times.map((t) => t.arrive), ...clashes.map((c) => c.to));
  return { kind: f.kind, hour, figures, clashes, posts, drawn, falls, quiet, end: quiet + AFTER };
}

/** A point along a path at a share of its length, and the way it runs there. */
function along(path: readonly Point[], k: number): { x: number; z: number; yaw: number } {
  if (path.length < 2) return { x: path[0]?.x ?? 0, z: path[0]?.z ?? 0, yaw: 0 };
  const total = lengthOf(path);
  let left = Math.max(0, Math.min(1, k)) * total;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!,
      b = path[i]!,
      d = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= d || i === path.length - 1) {
      const t = d > 0 ? Math.min(1, left / d) : 1;
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        yaw: Math.atan2(b.x - a.x, b.z - a.z),
      };
    }
    left -= d;
  }
  const b = path[path.length - 1]!;
  return { x: b.x, z: b.z, yaw: 0 };
}

/** One figure at a second of the scene (null: not there). */
export function figureAt(g: StreetFigure, s: number): Omit<Soldier, "side"> | null {
  if (s < g.from) return null;
  const end = g.path[g.path.length - 1]!,
    meet = g.meet ?? end,
    facing = Math.atan2(g.face.x - meet.x, g.face.z - meet.z),
    blink = Math.min(1, (s - g.from) / 0.4);
  if (g.falls !== null && s >= g.falls)
    return { x: meet.x, z: meet.z, yaw: facing, doing: "fallen", size: 1 };
  if (g.leaves !== null && s >= g.leaves) {
    const k = (s - g.leaves) / GOES;
    if (k >= 1) return null;
    const p = along(g.fight && g.meet ? [...g.path.slice(0, -1), g.meet] : g.path, 1 - k);
    return {
      x: p.x,
      z: p.z,
      yaw: p.yaw + Math.PI,
      doing: "fall back",
      size: Math.min(1, (1 - k) * 3),
    };
  }
  if (s < g.arrive) {
    const p = along(g.path, (s - g.from) / Math.max(0.1, g.arrive - g.from));
    return { x: p.x, z: p.z, yaw: p.yaw, doing: "advance", size: blink };
  }
  if (g.fight && s >= g.fight[0] && s < g.fight[1]) {
    // (A step in and out about his place, as those who fight hand to hand do.)
    // (Closed on his man from where he stood off, then a lean in and out, never past the arm's length between.)
    const closed = Math.min(1, (s - g.fight[0]) / 1.2),
      w = Math.sin(s * 2.1 + g.slot * 1.7) * 0.12;
    return {
      x: end.x + (meet.x - end.x) * closed + Math.sin(facing) * w * closed,
      z: end.z + (meet.z - end.z) * closed + Math.cos(facing) * w * closed,
      yaw: facing,
      doing: "fight",
      size: 1,
    };
  }
  // (Once he has closed he holds where he met his man.)
  const at = g.fight && s >= g.fight[0] ? meet : end;
  return { x: at.x, z: at.z, yaw: facing, doing: "stand", size: 1 };
}

/** The scene at a second: every slot of both sides (`slots` a side), the posts held by then and their fires; where each side is. */
export function streetAt(
  script: StreetScript,
  slots: number,
  s: number,
  plan?: VillagePlan,
): TownWarScene {
  const soldiers: Soldier[] = [];
  for (let i = 0; i < 2 * slots; i++)
    soldiers.push({ x: 0, z: 0, yaw: 0, side: i < slots ? 0 : 1, doing: "stand", size: 0 });
  const sum = [
    { x: 0, z: 0, n: 0 },
    { x: 0, z: 0, n: 0 },
  ];
  for (const g of script.figures) {
    if (g.slot >= slots) continue;
    const now = figureAt(g, s);
    if (!now) continue;
    soldiers[g.side * slots + g.slot] = { ...now, side: g.side };
    if (now.doing !== "fallen") {
      sum[g.side]!.x += now.x;
      sum[g.side]!.z += now.z;
      sum[g.side]!.n++;
    }
  }
  const live = soldiers.filter((q) => q.size > 0),
    // (Those closing on their man give way too, should what stands in the street have turned them.)
    moving = live.filter(
      (q) => q.doing === "advance" || q.doing === "fall back" || q.doing === "fight",
    );
  // (No one who fights or stands is ever in what stands in the street, as he closes across it.)
  if (plan)
    for (const q of live) if (q.doing === "fight" || q.doing === "stand") standClear(plan, q);

  for (let pass = 0; pass < (moving.length ? 8 : 0); pass++) {
    for (const q of moving) {
      for (const o of live) {
        if (o === q) continue;
        const dx = q.x - o.x,
          dz = q.z - o.z,
          d = Math.hypot(dx, dz);
        // (Round one who lies there by half as much: he steps by him, not over him.)
        const room = o.doing === "fallen" ? BODY : 2 * BODY;
        if (d >= room + 0.04) continue;
        // (One on the move gives way to one standing; two on the move, each half.)
        const push = (room + 0.05 - d) * (o.doing === q.doing ? 0.55 : 1),
          ux = d > 1e-6 ? dx / d : Math.cos(soldiers.indexOf(q)),
          uz = d > 1e-6 ? dz / d : Math.sin(soldiers.indexOf(q));
        q.x += ux * push;
        q.z += uz * push;
      }
      if (plan) standClear(plan, q);
    }
  }
  const held = script.posts.filter((p) => p.at <= s);
  return {
    soldiers,
    tents: held.map((p) => ({
      x: p.x + Math.sin(p.yaw) * 7 - Math.cos(p.yaw) * 3.2,
      z: p.z + Math.cos(p.yaw) * 7 + Math.sin(p.yaw) * 3.2,
      yaw: p.yaw,
    })),
    fires: [],
    // (A brazier at each post held; a fire lit at each place a clash is seen at, from before it to the end.)
    camp: [
      ...held.map((p) => ({ x: p.x + Math.cos(p.yaw) * 2.4, z: p.z - Math.sin(p.yaw) * 2.4 })),
      ...script.clashes
        .filter((c) => c.from - 6 <= s)
        .map((c) => ({ x: c.spot.x + 3.4, z: c.spot.z - 3.4, lamp: true })),
    ],
    carriers: carriersAt(script, s),
    middles: sum.map((m) =>
      m.n ? { x: m.x / m.n, z: m.z / m.n } : null,
    ) as unknown as TownWarScene["middles"],
  };
}

/** How many of each side have fallen by a second (figures). */
export function fallenBy(script: StreetScript, s: number): [number, number] {
  const out: [number, number] = [0, 0];
  for (const g of script.figures) if (g.falls !== null && g.falls <= s) out[g.side]++;
  return out;
}

/** The clash the eye is on at a second (the latest begun and not long over; null: none yet), or the squad on its way. */
export function streetEye(
  script: StreetScript,
  s: number,
): { at: Point; why: SpotWhy | "post" } | null {
  let best: StreetClash | null = null;
  for (const c of script.clashes) if (c.from - 1.5 <= s && (!best || c.from > best.from)) best = c;
  if (script.kind === "army") {
    // (The squad going in, until the posts' clashes begin.)
    const going = script.figures
      .filter((g) => g.side === 0 && g.from <= s && s < g.arrive)
      .sort((a, b) => b.from - a.from)[0];
    if (going && (!best || s < best.from - 1.5)) {
      const p = figureAt(going, s);
      if (p) return { at: { x: p.x, z: p.z }, why: "post" };
    }
  }
  return best ? { at: best.spot, why: best.spot.why } : null;
}

/** Those of the town come out to the fallen after it: grown, at home that day, from the nearest homes, stood about the place. */
export function crowdAbout(plan: VillagePlan, at: Point, t: number, most = 14): Watcher[] {
  const can = plan.people
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        !p.child &&
        (p.gone === undefined || p.gone > t) &&
        !(p.away ?? []).some((a) => a.from <= t && t < a.until) &&
        !(p.wounds ?? []).some((w) => {
          const s = woundStage(w, t);
          return s === "away" || s === "abed";
        }),
    )
    .map(({ i }) => {
      const h = plan.homes[plan.people[i]!.home];
      return { i, d: h ? Math.hypot(h.x - at.x, h.z - at.z) : Infinity };
    })
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, most);
  return can.map(({ i }, j) => {
    const a = (j / Math.max(1, can.length)) * 2 * Math.PI + i * 0.37,
      r = 5 + (j % 3) * 1.1;
    const x = at.x + Math.sin(a) * r,
      z = at.z + Math.cos(a) * r;
    return { index: i, x, z, yaw: Math.atan2(at.x - x, at.z - z) };
  });
}

/**
 * The way to look at a place from (degrees, as the town's eye turns: it stands off toward sin, cos of it): down the longest open
 * street running from it, `far` metres at the most, so no block stands between the eye and who is there. Of sixteen ways, the
 * most open; the first of them where two are as open.
 */
export function openYaw(plan: VillagePlan, at: Point, far: number): number {
  const town = villageGround(plan).town;
  if (!town) return 30;
  let best = 30,
    most = -1;
  for (let k = 0; k < 16; k++) {
    const yaw = (k / 16) * 360,
      r = (yaw * Math.PI) / 180;
    let open = 0;
    for (let d = 4; d <= far; d += 4) {
      if (!town.clear(at, { x: at.x + Math.sin(r) * d, z: at.z + Math.cos(r) * d }, 0.5)) break;
      open = d;
    }
    if (open > most) {
      most = open;
      best = yaw;
    }
  }
  return best;
}

/** The armoured carriers a side came in (its means say so): one stood behind its men at each of its first two places, while they are there. */
function carriersAt(
  script: StreetScript,
  s: number,
): NonNullable<TownWarScene["carriers"]>[number][] {
  const out: NonNullable<TownWarScene["carriers"]>[number][] = [];
  for (const side of [0, 1] as const) {
    if (!script.carriers[side]) continue;
    // (The first of its men at each place, the two earliest places.)
    const first = new Map<number, StreetFigure>();
    for (const g of script.figures) {
      if (g.side !== side) continue;
      let k = 0,
        near = Infinity;
      script.clashes.forEach((c, i) => {
        const d = Math.hypot(c.spot.x - g.face.x, c.spot.z - g.face.z);
        if (d < near) {
          near = d;
          k = i;
        }
      });
      if (!first.has(k)) first.set(k, g);
    }
    [...first.keys()]
      .sort((x, y) => x - y)
      .slice(0, 2)
      .forEach((k, n) => {
        const g = first.get(k)!,
          until = g.leaves !== null ? g.leaves + GOES : script.end;
        if (s < g.from - 1 || s > until) return;
        const end = g.path[g.path.length - 1]!,
          dx = end.x - g.face.x,
          dz = end.z - g.face.z,
          d = Math.hypot(dx, dz) || 1;
        void n;
        // (Stood well back of its men, its nose to the place.)
        out.push({
          side,
          x: end.x + (dx / d) * 11,
          z: end.z + (dz / d) * 11,
          yaw: Math.atan2(-dx, -dz),
          cart: !script.engines,
        });
      });
  }
  return out;
}

/**
 * Where the eye stands to look at a place (degrees: it stands off toward sin, cos of its yaw, `pitch` down), `far` metres off:
 * the lowest it can stand with no block or wall under its line to the place — each of sixteen ways tried at each height, higher
 * until one is clear. (`clear`: whether one was; straight down over it where none is.)
 */
export function streetView(
  plan: VillagePlan,
  at: Point,
  far: number,
): { yaw: number; pitch: number; clear: boolean } {
  const town = villageGround(plan).town;
  if (!town) return { yaw: 30, pitch: -34, clear: true };
  for (const pitch of [-32, -38, -46, -56, -68, -80]) {
    const run = far * Math.cos((pitch * Math.PI) / 180);
    for (let k = 0; k < 16; k++) {
      const yaw = (k / 16) * 360,
        r = (yaw * Math.PI) / 180;
      if (town.clear(at, { x: at.x + Math.sin(r) * run, z: at.z + Math.cos(r) * run }, 1.6))
        return { yaw, pitch, clear: true };
    }
  }
  return { yaw: 0, pitch: -88, clear: false };
}

/** Those of the town in a scene: who is caught between and falls, who come as its watch after, who gather to the fallen. */
export type StreetCast = {
  readonly caught: readonly {
    readonly index: number;
    readonly x: number;
    readonly z: number;
    readonly from: number;
    readonly at: number;
  }[];
  readonly watch: readonly {
    readonly index: number;
    readonly path: readonly Point[];
    readonly from: number;
    readonly arrive: number;
  }[];
  readonly crowd: readonly Watcher[];
  readonly crowdFrom: number;
};

/** A scene's cast of the town's own people (grown, there that day), drawn once: the nearest homes' to each place. */
export function streetCast(plan: VillagePlan, script: StreetScript, t: number): StreetCast {
  const last = script.clashes[script.clashes.length - 1];
  if (!last) return { caught: [], watch: [], crowd: [], crowdFrom: Infinity };
  const used = new Set<number>(),
    can = plan.people
      .map((p, i) => ({ p, i }))
      .filter(
        ({ p }) =>
          !p.child &&
          (p.gone === undefined || p.gone > t) &&
          !(p.away ?? []).some((a) => a.from <= t && t < a.until) &&
          !(p.wounds ?? []).some((w) => {
            const st = woundStage(w, t);
            return st === "away" || st === "abed";
          }),
      )
      .map(({ i }) => i),
    near = (at: Point, n: number): number[] => {
      const got = can
        .filter((i) => !used.has(i))
        .map((i) => {
          const h = plan.homes[plan.people[i]!.home];
          return { i, d: h ? Math.hypot(h.x - at.x, h.z - at.z) : Infinity };
        })
        .sort((a, b) => a.d - b.d || a.i - b.i)
        .slice(0, n)
        .map((x) => x.i);
      for (const i of got) used.add(i);
      return got;
    },
    caught = script.bystanders.flatMap((b) => near(b, 1).map((index) => ({ index, ...b }))),
    ground = villageGround(plan),
    // (The watch after a fight of gangs: four of the town, from its square to where the last of it was. Soldiers are their own.)
    way = script.kind === "army" ? [] : route(ground, { x: 0, z: 0 }, last.spot, REACH),
    watch = (way.length ? near({ x: 0, z: 0 }, 4) : []).map((index, j) => {
      const a = (j / 4) * 2 * Math.PI,
        place = { x: last.spot.x + Math.sin(a) * 6.5, z: last.spot.z + Math.cos(a) * 6.5 };
      standClear(plan, place);
      return {
        index,
        path: [...way.slice(0, -1), place],
        from: script.quiet + 1 + j * 0.3,
        arrive: script.quiet + 7 + j * 0.3,
      };
    }),
    crowd = near(last.spot, 12).map((index, j, all) => {
      const a = (j / Math.max(1, all.length)) * 2 * Math.PI + index * 0.37,
        r = 8.5 + (j % 3) * 1.3,
        at = { x: last.spot.x + Math.sin(a) * r, z: last.spot.z + Math.cos(a) * r };
      standClear(plan, at);
      const { x, z } = at;
      return {
        index,
        x,
        z,
        yaw: Math.atan2(last.spot.x - x, last.spot.z - z),
        why: "Come out to the fallen",
      };
    });
  return { caught, watch, crowd, crowdFrom: script.quiet + 5 };
}

/** The cast at a second: where each stands (as the town's watchers are placed), and who of them lies fallen. */
export function castAt(
  cast: StreetCast,
  s: number,
  plan?: VillagePlan,
): { folk: Watcher[]; downed: Set<number> } {
  const folk: Watcher[] = [],
    downed = new Set<number>();
  for (const c of cast.caught) {
    if (s < c.from) continue;
    folk.push({
      index: c.index,
      x: c.x,
      z: c.z,
      yaw: 0,
      why: s >= c.at ? "Caught between, and killed" : "Caught between",
    });
    if (s >= c.at) downed.add(c.index);
  }
  for (const w of cast.watch) {
    if (s < w.from) continue;
    const p = along(w.path, (s - w.from) / (w.arrive - w.from));
    // (Round what stands in the street, not through it.)
    if (plan && s < w.arrive) standClear(plan, p);
    folk.push({
      index: w.index,
      x: p.x,
      z: p.z,
      yaw: p.yaw,
      why: "Of the watch, come after it",
      ...(s < w.arrive ? { walking: true } : {}),
    });
  }
  if (s >= cast.crowdFrom) folk.push(...cast.crowd);
  return { folk, downed };
}

type Prop = { readonly x: number; readonly z: number; readonly r: number };
const PROPS = new WeakMap<VillagePlan, readonly Prop[]>();
/** What stands in a town's square to be walked round: its market's stalls, its stones, what stands at its middle. */
function propsOf(plan: VillagePlan): readonly Prop[] {
  const known = PROPS.get(plan);
  if (known) return known;
  const k = squareScale(plan),
    out: Prop[] = [
      ...marketScene(plan).stalls.map((q) => ({ x: q.x, z: q.z, r: 2.4 * k })),
      ...memorialsPlaced(plan).map((m) => ({ x: m.x, z: m.z, r: m.wide + 0.3 })),
      ...(plan.town ? [{ x: 0, z: 0, r: 3 }] : []),
    ];
  PROPS.set(plan, out);
  return out;
}

/**
 * A place moved to where one can stand (in place): off every block and wall, out of the hall, a body's width clear of every stall
 * and stone. A few turns, as moving off one may move onto another.
 */
export function standClear(plan: VillagePlan, p: { x: number; z: number }): void {
  const ground = villageGround(plan),
    props = propsOf(plan);
  for (let turn = 0; turn < 3; turn++) {
    for (const q of props) {
      const dx = p.x - q.x,
        dz = p.z - q.z,
        d = Math.hypot(dx, dz),
        need = q.r + BODY;
      if (d >= need) continue;
      const ux = d > 1e-6 ? dx / d : 1,
        uz = d > 1e-6 ? dz / d : 0;
      p.x = q.x + ux * (need + 0.02);
      p.z = q.z + uz * (need + 0.02);
    }
    for (let n = 0; n < 12 && !clearOfHall(plan, p.x, p.z, BODY); n++) {
      const d = Math.hypot(p.x, p.z) || 1;
      p.x += (p.x / d) * 1.2;
      p.z += (p.z / d) * 1.2;
    }
    keepOut(ground, p, REACH);
  }
}

/** Whether a place can be stood at: off every block and wall, clear of every stall and stone (a little leeway, for a test). */
export function standsClear(plan: VillagePlan, p: Point, leeway = 0.05): boolean {
  const ground = villageGround(plan);
  if (ground.town && !ground.town.clearAt(p, REACH - leeway)) return false;
  return propsOf(plan).every((q) => Math.hypot(p.x - q.x, p.z - q.z) >= q.r + BODY - leeway);
}

/** Places moved apart (in place) until no two are nearer than a body's width and a hand more, nor nearer that to any of `fixed`; each kept where one can stand. */
function spread(
  plan: VillagePlan,
  free: { x: number; z: number }[],
  fixed: readonly Point[],
): void {
  const min = 2 * BODY + 0.14;
  for (let turn = 0; turn < 12; turn++) {
    let moved = false;
    for (let i = 0; i < free.length; i++) {
      const a = free[i]!;
      for (let j = 0; j < free.length + fixed.length; j++) {
        if (j === i) continue;
        const b = j < free.length ? free[j]! : fixed[j - free.length]!,
          dx = a.x - b.x,
          dz = a.z - b.z,
          d = Math.hypot(dx, dz);
        if (d >= min) continue;
        const ux = d > 1e-6 ? dx / d : Math.cos(i * 2.4),
          uz = d > 1e-6 ? dz / d : Math.sin(i * 2.4);
        a.x += ux * (min - d + 0.02);
        a.z += uz * (min - d + 0.02);
        moved = true;
      }
      standClear(plan, a);
    }
    if (!moved) break;
  }
}

/** How wide a ring so many stand about a post in, each a body's width from the next. */
function ringOf(n: number): number {
  return Math.max(1.8, (n * (2 * BODY + 0.35)) / (2 * Math.PI));
}

/** A fight of the streets as a battle is kept: its men a field's, struck as a battle's are (view/blows.ts), each where its script has him. */
export type StreetBattle = {
  readonly field: BattleField;
  readonly blows: Blows;
  /** Where its field lies in the town: at its middle, a metre of it a town's `scale`. */
  readonly frame: PlacedFrame;
  /** Each side's figures shown wounded and living (not told: history counts its dead alone; by the battle's own rule, rules/wounds.ts). */
  readonly wounded: readonly [number, number];
};

/**
 * A fight's men as a battle's field (so they are drawn, struck, bleed and are heard as a battle's are: Phase 55): each of its
 * script's figures one who fought, falling when its script has him fall, struck by the arm the other side carries; every blow,
 * and where he lies after, moved to where the script has him. Null where no figure is known for its people.
 */
export function streetBattle(f: StreetFight, script: StreetScript): StreetBattle | null {
  if (!f.figure) return null;
  const frame: PlacedFrame = { x: 0, z: 0, ux: 1, uz: 0, scale: PLACED_SCALE },
    k = frame.scale,
    key = hashText(f.event),
    side = (i: 0 | 1): BattleSideNear => ({
      ref: f.sides[i].ref,
      name: f.sides[i].name,
      color: f.sides[i].color,
      arms: f.sides[i].arms,
      fielded: script.drawn[i],
      fallen: script.falls[i],
      host: f.sides[i].host,
      kit: f.sides[i].gear,
      // (Its wounded who lived, as a battle reckons them from its dead: struck by the other's arm, against its own guard.
      // Shown, not told; no more than a third of those of it still standing.)
      ...(() => {
        const foe = f.sides[i === 0 ? 1 : 0],
          w = sideWounds(script.falls[i], script.drawn[i], {
            blow: blowOf(foe.host?.arm),
            shock: 0,
            protection: f.sides[i].host?.guard ? 0.4 : 0,
            care: 0,
            size: f.figure?.size ?? 60,
          }),
          most = Math.floor((script.drawn[i] - script.falls[i]) / 3),
          wounded = Math.min(w.wounded, most);
        return wounded > 0 ? { wounded, maimed: Math.min(wounded, w.maimed) } : {};
      })(),
    }),
    near: BattleNear = {
      event: f.event,
      war: f.event,
      title: f.title,
      cell: f.cell,
      land: f.land,
      year: f.year,
      attacker: side(0),
      defender: side(1),
      won: f.won !== 1,
      outcome: "field",
      civil: null,
      hills: false,
      river: false,
      walls: 0,
      town: null,
      figure: f.figure,
      // (No field of its own is ever drawn: it is fought in the town's streets.)
      plan: { seed: f.event, ages: [], lineages: [] } as unknown as BattleNear["plan"],
    },
    troopers: Trooper[] = script.figures.map((g, id) => ({
      id,
      side: g.side,
      file: g.slot,
      rank: 0,
      z: 0,
      bearer: false,
      falls: g.falls,
      by: g.falls !== null ? "blow" : null,
      flees: null,
      pursues: false,
      gate: false,
      u: unitOf(key, 5000 + id, 0),
    })),
    host = (i: 0 | 1): HostDrawn => ({
      n: script.drawn[i],
      files: Math.max(1, script.drawn[i]),
      ranks: 1,
      mounted: null,
      missiles: false,
      stroke: armLook(f.sides[i].host?.arm).stroke,
      falls: script.falls[i],
    }),
    field: BattleField = {
      near,
      per: 1,
      hosts: [host(0), host(1)],
      troopers,
      files: [0, 1].map((i) => troopers.filter((t) => t.side === i).map((t) => [t])),
      arrows: [],
      ladders: [],
      cannon: [],
      beaten: f.won === 1 ? 0 : 1,
      ground: { hill: null, river: null, wall: null },
      meet: 0,
      drive: 0,
      moments: [],
      wings: null,
      placed: true,
      bands: true,
    },
    blows = newBlows(field);
  // Every blow where and when the script has the one struck: where he lies, what is cut off him, and a wounded one's way back
  // (the way he came) moved with it. No one helps one back here: the helped limp off by themselves.
  const made = blows.hits.map((h, was) => {
    const g = script.figures[h.id]!,
      at = g.meet ?? g.path[g.path.length - 1]!,
      before = g.path.length > 1 ? g.path[g.path.length - 2]! : { x: at.x + 1, z: at.z },
      dx = at.x / k - h.x,
      dz = at.z / k - h.z,
      x = h.x + dx,
      z = h.z + dz;
    let lie = h.lie;
    if (lie) {
      // (He lies by where he stood: no further off than a body's length.)
      const lx = lie.x - h.x,
        lz = lie.z - h.z,
        far = Math.hypot(lx, lz),
        most = 1.2 / k,
        c = far > most ? most / far : 1;
      lie = { ...lie, x: x + lx * c, z: z + lz * c };
    }
    let back = h.back,
      when = h.at;
    if (back) {
      // (Struck as he fights; if the script never has him fight, never.)
      const span = g.fight ? Math.max(0.5, g.fight[1] - g.fight[0] - 3) : 0;
      when = g.fight ? g.fight[0] + 1.6 + unitOf(key, 6000 + h.id, 0) * span : Infinity;
      const dt = when - h.at,
        bl = Math.hypot(before.x - at.x, before.z - at.z) || 1,
        dir = { x: (before.x - at.x) / bl, z: (before.z - at.z) / bl },
        far = Math.min(back.far, 9 / k);
      back = {
        way: back.way === "propped" ? "limp" : back.way,
        going: back.going + dt,
        there: back.going + dt + (back.there - back.going) * (far / Math.max(0.01, back.far)),
        from: { x, z },
        dir,
        far,
        helper: -1,
      };
    }
    return {
      was,
      hit: {
        ...h,
        at: when,
        x,
        z,
        facing: Math.atan2(g.face.x - at.x, g.face.z - at.z),
        lie,
        back,
      },
      dx,
      dz,
    };
  });
  made.sort((p, q) => p.hit.at - q.hit.at || p.was - q.was);
  const now = new Map(made.map((m, i) => [m.was, i])),
    of = blows.of.map(() => -1);
  made.forEach((m, i) => {
    of[m.hit.id] = i;
  });
  const moved: Blows = {
    hits: made.map((m) => m.hit),
    of,
    helps: [],
    helping: blows.helping.map(() => -1),
    loose: blows.loose.map((l) => {
      const m = made[now.get(l.hit)!]!;
      return { ...l, hit: now.get(l.hit)!, x: l.x + m.dx, z: l.z + m.dz };
    }),
    dead: blows.dead,
    hurt: blows.hurt,
    maimed: blows.maimed,
  };
  return { field, blows: moved, frame, wounded: [...blows.hurt] as [number, number] };
}

const ACTS: Readonly<Record<Soldier["doing"], Act>> = {
  advance: "march",
  fight: "fight",
  fallen: "fall",
  "fall back": "run",
  stand: "stand",
  drill: "stand",
  fire: "loose",
  prone: "prone",
};

/**
 * The fight at a second as a battle's moment, before its blows are laid on it (view/blows.ts blowsAt does that): each figure of
 * its script where the scene has him (`scene`: streetAt's, `slots` a side), in the field's own metres.
 */
export function streetBattleNow(
  b: StreetBattle,
  script: StreetScript,
  scene: TownWarScene,
  slots: number,
  s: number,
): BattleNow {
  const k = b.frame.scale,
    standing: [number, number] = [0, 0],
    fallen: [number, number] = [0, 0],
    troopers: TrooperNow[] = script.figures.map((g, id) => {
      const q = g.slot < slots ? scene.soldiers[g.side * slots + g.slot] : undefined,
        there = !!q && q.size > 0,
        down = there && q.doing === "fallen";
      if (there) (down ? fallen : standing)[g.side]++;
      return {
        id,
        side: g.side,
        x: there ? q.x / k : 0,
        y: 0,
        z: there ? q.z / k : 0,
        yaw: there ? q.yaw : 0,
        act: there ? ACTS[q.doing] : "stand",
        cycle: s + b.field.troopers[id]!.u * 3,
        down: down ? Math.min(1, (s - (g.falls ?? s)) / 0.6) : 0,
        back: true,
        size: there ? q.size : 0,
        bearer: false,
        crawl: 0,
        gun: undefined,
        hit: undefined,
        since: undefined,
        lost: undefined,
        fell: undefined,
      };
    });
  return {
    s,
    troopers,
    flying: [],
    spent: [],
    blood: [],
    spray: [],
    smoke: [],
    flashes: [],
    cannon: [],
    dust: [],
    standing,
    fallen,
    ladders: [],
    gate: 0,
    burning: 0,
    camp: 0,
    words: "",
  };
}
