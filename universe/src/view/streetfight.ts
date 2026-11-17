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
  type StreetFight,
  type StreetFightKind,
  type VillagePlan,
} from "../bridge/index.ts";
import { hashText, unitOf } from "./draws.ts";
import { route, villageGround } from "./ground.ts";
import type { VehicleNow } from "./battle.ts";
import type { Watcher } from "./placed.ts";
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
};
type Core = Omit<StreetScript, "bystanders" | "carriers">;

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
  if (town) put({ x: 0, z: 0 }, "square");
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
        r = 3.6 + unitOf(key, 2100 + j, 0) * 1.6;
      return {
        x: c.spot.x + Math.sin(a) * r,
        z: c.spot.z + Math.cos(a) * r,
        from: c.from - 1,
        at: c.from + 2 + unitOf(key, 2200 + j, 0) * Math.max(1, c.to - c.from - 3),
      };
    });
  return {
    ...core,
    bystanders,
    carriers: [f.sides[0].carriers === true, f.sides[1].carriers === true],
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
    const ways = clashes.map((c, k) => {
      const start = cameFrom(cross, c.spot, nx, nz, sign, u(70 + k * 2 + side));
      return route(ground, start, c.spot, REACH);
    });
    for (let m = 0; m < drawn[side]; m++) {
      const k = each[side]![m]!,
        c = clashes[k]!,
        base = ways[k]!,
        // (His place by the clash's: on his side of it, a little apart from the others.)
        back =
          base.length > 1
            ? base[base.length - 2]!
            : { x: c.spot.x + nx * sign, z: c.spot.z + nz * sign },
        bx = back.x - c.spot.x,
        bz = back.z - c.spot.z,
        bl = Math.hypot(bx, bz) || 1,
        across = (u(300 + side * 131 + m) - 0.5) * 3.2,
        // (Each side on its own side of the place, a few steps between them until they close.)
        out = 2.4 + u(400 + side * 131 + m) * 1.8,
        place = {
          x: c.spot.x + (bx / bl) * out - (bz / bl) * across,
          z: c.spot.z + (bz / bl) * out + (bx / bl) * across,
        },
        path = [...base.slice(0, -1), place],
        setOut = c.from - COMES - u(500 + side * 131 + m) * 1.2,
        fight = [c.from + STAND_OFF + u(600 + side * 131 + m) * 0.8, c.to] as const,
        falling = fallers.has(m),
        winner = f.won === side && k === last;
      figures.push({
        side,
        slot: m,
        path,
        face: c.spot,
        from: setOut,
        arrive: c.from,
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
    pool = (quarterOf.length >= 2 ? quarterOf : cross).slice(),
    take: Point[] = [];
  let at: Point = gate;
  const squads = Math.max(1, Math.min(4, pool.length, Math.ceil(drawn[0] / 3)));
  while (take.length < squads && pool.length) {
    pool.sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z));
    const next = pool.shift()!;
    if (take.some((q) => Math.hypot(q.x - next.x, q.z - next.z) < APART)) continue;
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
      const from = 1.5 + j * 5.5,
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
  const meets = falls[1] > 0 || falls[0] > 0 ? take.length : Math.min(2, take.length);
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
      ring = (row / Math.max(1, Math.ceil(drawn[0] / take.length))) * 2 * Math.PI + yaw,
      place = { x: p.x + Math.sin(ring) * 1.8, z: p.z + Math.cos(ring) * 1.8 },
      c = clashes[j],
      falling = soldierFalls.has(m) && !!c;
    figures.push({
      side: 0,
      slot: m,
      path: [...ways[j]!.slice(0, -1), place],
      face: { x: p.x + Math.sin(yaw) * 10, z: p.z + Math.cos(yaw) * 10 },
      from: t.from + row * 0.45,
      arrive: t.arrive + row * 0.45,
      fight: c ? [c.from, c.to] : null,
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
        out = (falls[0] + falls[1] > 0 ? 2.6 : 9) + u(1400 + m) * 1.5,
        across = (u(1500 + m) - 0.5) * 4,
        place = {
          x: c.spot.x + (bx / bl) * out - (bz / bl) * across,
          z: c.spot.z + (bz / bl) * out + (bx / bl) * across,
        },
        fight = [c.from + u(1600 + m) * 0.8, c.to] as const,
        falling = groupFalls.has(m);
      figures.push({
        side: 1,
        slot: m,
        path: [...base.slice(0, -1), place],
        face: c.spot,
        from: c.from - COMES - u(1700 + m),
        arrive: c.from,
        fight: falls[0] + falls[1] > 0 ? fight : null,
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
    facing = Math.atan2(g.face.x - end.x, g.face.z - end.z),
    blink = Math.min(1, (s - g.from) / 0.4);
  if (g.falls !== null && s >= g.falls)
    return { x: end.x, z: end.z, yaw: facing, doing: "fallen", size: 1 };
  if (g.leaves !== null && s >= g.leaves) {
    const k = (s - g.leaves) / GOES;
    if (k >= 1) return null;
    const p = along(g.path, 1 - k);
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
    // (Closed on the place from where he stood off, then a step in and out.)
    const closed = Math.min(1, (s - g.fight[0]) / 1.2),
      reach = Math.hypot(g.face.x - end.x, g.face.z - end.z),
      w = closed * Math.max(0, reach - 1.1) + Math.sin(s * 2.1 + g.slot * 1.7) * 0.35;
    return {
      x: end.x + Math.sin(facing) * w,
      z: end.z + Math.cos(facing) * w,
      yaw: facing,
      doing: "fight",
      size: 1,
    };
  }
  return { x: end.x, z: end.z, yaw: facing, doing: "stand", size: 1 };
}

/** The scene at a second: every slot of both sides (`slots` a side), the posts held by then and their fires; where each side is. */
export function streetAt(script: StreetScript, slots: number, s: number): TownWarScene {
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
    cars: carsAt(script, s),
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
function carsAt(script: StreetScript, s: number): VehicleNow[] {
  const out: VehicleNow[] = [];
  for (const side of [0, 1] as const) {
    if (!script.carriers[side]) continue;
    const seen: Point[] = [];
    for (const g of script.figures) {
      if (g.side !== side || seen.length >= 2) continue;
      if (seen.some((q) => Math.hypot(q.x - g.face.x, q.z - g.face.z) < 4)) continue;
      seen.push(g.face);
      const until = g.leaves !== null ? g.leaves + GOES : script.end;
      if (s < g.from - 1 || s > until) continue;
      const end = g.path[g.path.length - 1]!,
        dx = end.x - g.face.x,
        dz = end.z - g.face.z,
        d = Math.hypot(dx, dz) || 1;
      out.push({
        id: side * 2 + seen.length - 1,
        side,
        x: end.x + (dx / d) * 6,
        y: 0,
        z: end.z + (dz / d) * 6,
        yaw: Math.atan2(-dx, -dz),
        turret: 0,
        recoil: 0,
        knocked: 0,
        burning: 0,
      });
    }
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
        place = { x: last.spot.x + Math.sin(a) * 2.6, z: last.spot.z + Math.cos(a) * 2.6 };
      return {
        index,
        path: [...way.slice(0, -1), place],
        from: script.quiet + 1 + j * 0.3,
        arrive: script.quiet + 7 + j * 0.3,
      };
    }),
    crowd = near(last.spot, 12).map((index, j, all) => {
      const a = (j / Math.max(1, all.length)) * 2 * Math.PI + index * 0.37,
        r = 5.5 + (j % 3) * 1.1,
        x = last.spot.x + Math.sin(a) * r,
        z = last.spot.z + Math.cos(a) * r;
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
export function castAt(cast: StreetCast, s: number): { folk: Watcher[]; downed: Set<number> } {
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
