// The town under a raid, as a script of the time (Phase 67, Act 2): four landers come down on a named
// town, raiders come out of them and walk its streets towards the guard, the guard meets them and falls
// back, homes catch fire, and the raiders go back aboard and lift off. Everything drawn is a pure
// function of the script and the time, so scrubbing is exact and no state builds up. Plain data and
// geometry, in metres as the village's plan uses them: no DOM, no playcanvas.
import type { FightRgb, StarFightPlan, VillagePlan } from "../bridge/index.ts";
import { armLook, isGun } from "./arms.ts";
import { keepOut, route, villageGround } from "./ground.ts";
import { figureOf } from "./figure.ts";
import { drillGround } from "./village.ts";
import type { TownWarScene } from "./townwar.ts";
import type { Soldier } from "./war.ts";

/** When each part of the film happens (seconds): the landing, the streets, the burning, the lift-off. */
export const INV = { land: 6, out: 8, meet: 14, back: 34, lift: 40, end: 46 } as const;
export const LANDERS = 4;
/** How far up its route the advance goes, at most (metres). */
export const ADVANCE_M = 140;

type Flat = { readonly x: number; readonly z: number };
type V3 = { x: number; y: number; z: number };

export type InvasionSite = {
  readonly pads: readonly Flat[]; // where the landers set down, 1 to 4
  readonly routes: readonly (readonly Flat[])[]; // one per pad: its way through the streets, at most ADVANCE_M long
  readonly rally: Flat; // where the guard turns out from
  readonly homes: readonly Flat[]; // homes that may burn, at most 64
};
export type InvasionStage = "landing" | "streets" | "burning" | "gone";
export type RaiderNow = {
  readonly i: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly size: number;
  readonly doing: "advance" | "fight" | "fallen" | "back";
};
export type LanderNow = {
  readonly j: number;
  readonly x: number;
  readonly z: number;
  readonly high: number; // metres above the ground
  readonly burn: number; // 0 … 1
  readonly ramp: number; // 0 … 1
  readonly yaw: number;
};
export type BoltNow = {
  readonly side: 0 | 1;
  readonly ax: number;
  readonly ay: number;
  readonly az: number;
  readonly bx: number;
  readonly by: number;
  readonly bz: number;
};
export type InvasionScript = {
  readonly id: string;
  readonly site: InvasionSite;
  readonly each: number;
  readonly raiders: number;
  readonly ranged: boolean; // whether the guard fires at all
  readonly room: number; // how much room a raider's body takes, against an upright ape's
  readonly seed: number;
  readonly fires: readonly { readonly x: number; readonly z: number; readonly ignite: number }[];
};
export type InvasionNow = {
  readonly t: number;
  readonly stage: InvasionStage;
  readonly raiders: readonly RaiderNow[];
  readonly landers: readonly LanderNow[];
  readonly bolts: readonly BoltNow[];
  readonly scene: TownWarScene;
};
export type InvasionEye = {
  readonly e: { x: number; y: number; z: number };
  readonly at: { x: number; y: number; z: number };
};
export type Keep = (p: { x: number; z: number }, reach: number) => void;

const RADII = [0, 28, 40, 55, 70, 90, 115, 140, 170, 200, 240, 280, 320, 380, 440];
const BEAM_DEFAULT: FightRgb = [1, 0.85, 0.4];
const noop: Keep = () => {};

const hashText = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
};
const unit = (a: number, b: number) => {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const smooth = (k: number) => {
  const c = clamp01(k);
  return c * c * (3 - 2 * c);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** How far up its routes the front of the advance has come by time t (metres). */
const front = (t: number) => ADVANCE_M * smooth((t - INV.out) / 26);
const lerpAt = (a: Flat, b: Flat, k: number): Flat => ({
  x: lerp(a.x, b.x, k),
  z: lerp(a.z, b.z, k),
});
const mixV = (a: V3, b: V3, k: number): V3 => ({
  x: lerp(a.x, b.x, k),
  y: lerp(a.y, b.y, k),
  z: lerp(a.z, b.z, k),
});

/** A route's length (metres). */
function lengthOf(path: readonly Flat[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++)
    total += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.z - path[i - 1]!.z);
  return total;
}

/** The point of a list nearest to `p` (null: none). */
function nearestOf(list: readonly Flat[], p: Flat): Flat | null {
  let best: Flat | null = null;
  let bestD = Infinity;
  for (const q of list) {
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

/** The middle of some points (null: none). */
function middleOf(list: readonly Flat[]): Flat | null {
  if (!list.length) return null;
  let x = 0;
  let z = 0;
  for (const q of list) {
    x += q.x;
    z += q.z;
  }
  return { x: x / list.length, z: z / list.length };
}

/**
 * Where the landers set down: open ground clear of the walls, at least 46 m apart, the first at the
 * middle; if none is clear, a row out along `way`, past the reach.
 */
export function padsFrom(
  clear: (p: Flat) => boolean,
  reach: number,
  way: Flat,
  n = LANDERS,
): Flat[] {
  const pads: Flat[] = [];
  for (const r of RADII) {
    const dirs = r === 0 ? 1 : 12;
    for (let k = 0; k < dirs && pads.length < n; k++) {
      const a = k * (Math.PI / 6) + r * 0.01;
      const p = r === 0 ? { x: 0, z: 0 } : { x: Math.cos(a) * r, z: Math.sin(a) * r };
      if (!clear(p) || pads.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < 46)) continue;
      pads.push(p);
    }
    if (pads.length >= n) break;
  }
  if (!pads.length) {
    const len = Math.hypot(way.x, way.z);
    const ux = len > 0 ? way.x / len : 1;
    const uz = len > 0 ? way.z / len : 0;
    for (const off of [0, 0.5, -0.5, 1, -1]) {
      if (pads.length >= n) break;
      const c = Math.cos(off);
      const s = Math.sin(off);
      const R = reach + 24;
      pads.push({ x: (ux * c - uz * s) * R, z: (ux * s + uz * c) * R });
    }
  }
  return pads;
}

/** The path cut to `most` metres along, ending at the point where the cut falls. */
export function trimPath(points: readonly Flat[], most: number): Flat[] {
  if (!points.length) return [];
  const out: Flat[] = [{ x: points[0]!.x, z: points[0]!.z }];
  let left = Math.max(0, most);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len >= left) {
      const k = len > 0 ? left / len : 0;
      out.push({ x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k });
      return out;
    }
    out.push({ x: b.x, z: b.z });
    left -= len;
  }
  return out;
}

/** The point `d` metres along a path (clamped to its ends), and the unit way the path runs there. */
export function pathPoint(
  path: readonly Flat[],
  d: number,
): { x: number; z: number; dx: number; dz: number } {
  let at = 0;
  let end: { x: number; z: number; dx: number; dz: number } | null = null;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (!(len > 0)) continue;
    const dx = (b.x - a.x) / len;
    const dz = (b.z - a.z) / len;
    if (d <= at + len) {
      const k = clamp01((d - at) / len);
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dx, dz };
    }
    at += len;
    end = { x: b.x, z: b.z, dx, dz };
  }
  if (end) return end;
  const p = path[0] ?? { x: 0, z: 0 };
  return { x: p.x, z: p.z, dx: 1, dz: 0 };
}

/** The landing site of a raid on a village: its pads, their ways through the streets, the guard's rally, the homes that may burn. */
export function invasionSite(plan: VillagePlan, fightId: string): InvasionSite {
  const ground = villageGround(plan);
  const h = hashText(fightId);
  const clear = (p: Flat) =>
    ground.town
      ? ground.town.clearAt(p, 9)
      : Math.hypot(p.x, p.z) > ground.homesReach + 9 || Math.hypot(p.x, p.z) < 12;
  const pads = padsFrom(clear, ground.homesReach, plan.road);
  const routes = pads.map((pad, j) => {
    const goal = { x: 0, z: 0 };
    if (Math.hypot(pad.x, pad.z) <= 60) {
      const a = unit(h, j) * 6.283;
      goal.x = Math.cos(a) * 110;
      goal.z = Math.sin(a) * 110;
    }
    keepOut(ground, goal, 2);
    return trimPath(route(ground, pad, goal, 1.2), ADVANCE_M);
  });
  const rally = drillGround(plan);
  const p0 = pads[0]!;
  const homes = plan.homes
    .map((hm, index) => ({ hm, index }))
    .filter(({ hm }) => Math.hypot(hm.x - p0.x, hm.z - p0.z) <= 200)
    .sort((a, b) => unit(h, 100 + a.index) - unit(h, 100 + b.index))
    .slice(0, 64)
    .map(({ hm }) => ({ x: hm.x, z: hm.z }));
  return { pads, routes, rally: { x: rally.x, z: rally.z }, homes };
}

/** The walker's keep-out of a village's walls, water and homes, as the view uses it. */
export function invasionKeep(plan: VillagePlan): Keep {
  const ground = villageGround(plan);
  return (p, reach) => keepOut(ground, p, reach);
}

/** How many raiders land at a detail level (0 … 3). */
export function raidersAt(detail: number): number {
  return [24, 24, 36, 48][Math.max(0, Math.min(3, Math.round(detail) || 0))]!;
}

/** The script of one raid on one town: its seed, whether the guard fires, the homes that burn. */
export function invasionScript(
  plan: StarFightPlan,
  site: InvasionSite,
  each: number,
  raiders: number,
): InvasionScript {
  const landing = plan.landing;
  if (!landing) throw new Error(`invasionScript: ${plan.id} came down on no town`);
  const seed = hashText(plan.id);
  const host = landing.defenders.host;
  const ranged = isGun(host?.arm) || !!armLook(host?.arm).beam;
  const count = site.homes.length
    ? Math.min(site.homes.length, 16, Math.max(4, Math.ceil(landing.razed * site.homes.length)))
    : 0;
  const fires = site.homes
    .slice(0, count)
    .map((h, i) => ({ x: h.x, z: h.z, ignite: 18 + unit(seed, 500 + i) * 18 }));
  const room = figureOf(landing.raiders.body).scale;
  return { id: plan.id, site, each, raiders, ranged, room, seed, fires };
}

/** Lander j at time t: over its pad, how high it is, how much it burns, its ramp, its turn. */
function landerAt(script: InvasionScript, j: number, t: number): LanderNow {
  const pad = script.site.pads[j]!;
  const land = INV.land - (script.site.pads.length - 1 - j) * 0.4;
  const k = clamp01(t / land);
  let high = t < land ? 120 * (1 - k) * (1 - k) : 0;
  let burn = t < land ? 1 : Math.max(0, 1 - (t - land));
  const lift = INV.lift + j * 0.6;
  if (t > lift) {
    const r = t - lift;
    high = 3 * r * r;
    burn = 1;
  }
  const ramp = smooth((t - INV.land) / 1.2) * (1 - smooth((t - (INV.lift - 2)) / 1.5));
  const yaw = unit(script.seed, 600 + j) * 6.283;
  return { j, x: pad.x, z: pad.z, high, burn, ramp, yaw };
}

/** The whole film drawn at time t (clamped to the film): the stage, every raider, lander, bolt and the town's soldiers. */
export function invasionAt(script: InvasionScript, t: number, keep: Keep = noop): InvasionNow {
  const tt = Math.max(0, Math.min(INV.end, t));
  const { site, each, seed } = script;
  const { routes, pads, rally } = site;
  const lens = routes.map(lengthOf);
  const stage: InvasionStage =
    tt < INV.meet ? "landing" : tt < 24 ? "streets" : tt < INV.back ? "burning" : "gone";
  const landers = pads.map((_, j) => landerAt(script, j, tt));
  // The raiders' head on route r at time x, and the yaw from one point to another.
  const headAt = (r: number, x: number) => pathPoint(routes[r]!, Math.min(lens[r]!, front(x)));
  const faceTo = (from: Flat, to: Flat) => Math.atan2(to.x - from.x, to.z - from.z);

  // The guard: slot 2 * each + i of the town's soldiers (side 1), each turning out from the rally onto its route.
  const guard: Soldier[] = [];
  for (let i = 0; i < each; i++) {
    const r = i % routes.length;
    const path = routes[r]!;
    const len = lens[r]!;
    const target = (x: number): Flat => {
      const q = pathPoint(path, Math.min(len, front(x) + 22 * script.room + (i % 4) * 6));
      const o = ((i % 6) - 2.5) * 5;
      return { x: q.x - q.dz * o, z: q.z + q.dx * o };
    };
    const falls = unit(seed, 900 + i) < 0.72;
    const fellAt = 15 + unit(seed, 1000 + i) * 18;
    let p: { x: number; z: number };
    let doing: Soldier["doing"];
    let size: number;
    let facing = tt;
    if (tt < 7) {
      p = { x: rally.x, z: rally.z };
      doing = "advance";
      size = 0;
    } else if (tt < 14) {
      p = lerpAt(rally, target(14), smooth((tt - 7) / 7));
      doing = "advance";
      size = 1;
    } else if (falls && tt >= fellAt) {
      p = target(fellAt);
      doing = "fallen";
      size = 1;
      facing = fellAt;
    } else if (tt < 33) {
      p = target(tt);
      doing = "fight";
      size = 1;
    } else {
      p = lerpAt(target(33), rally, smooth((tt - 33) / 6));
      doing = "fall back";
      size = 1 - smooth((tt - 37) / 2);
    }
    if (doing !== "fallen") keep(p, 1.2);
    const head = headAt(r, facing);
    guard.push({
      x: p.x,
      z: p.z,
      yaw: doing === "fall back" ? faceTo(head, p) : faceTo(p, head),
      side: 1,
      doing,
      size,
    });
  }
  const liveGuard = guard.filter((g) => g.size > 0 && g.doing !== "fallen");

  // The raiders, all of them (drawn or not): up their route rank by rank, then back to their ships.
  const raiderNows: RaiderNow[] = [];
  for (let i = 0; i < script.raiders; i++) {
    const r = i % routes.length;
    const rank = Math.floor(i / routes.length);
    const path = routes[r]!;
    const len = lens[r]!;
    const emerge = INV.land + 0.5 + rank * 0.35;
    const dAt = (x: number) => Math.max(0, Math.min(len, front(x)) - rank * 9 * script.room);
    const falls = unit(seed, 700 + i) < 0.15;
    const fellAt = 16 + unit(seed, 800 + i) * 16;
    // Its place `d` metres up the route, in its file across it, kept off the walls.
    const place = (d: number) => {
      const q = pathPoint(path, d);
      const o = ((i % 3) - 1) * 6 * script.room;
      const p = { x: q.x - q.dz * o, z: q.z + q.dx * o };
      keep(p, 1.2);
      return { x: p.x, z: p.z, dx: q.dx, dz: q.dz };
    };
    if (tt < emerge) {
      const pad = pads[r]!;
      const q = pathPoint(path, 0);
      raiderNows.push({
        i,
        x: pad.x,
        z: pad.z,
        yaw: Math.atan2(q.dx, q.dz),
        size: 0,
        doing: "advance",
      });
    } else if (falls && tt >= fellAt) {
      const q = place(dAt(fellAt));
      raiderNows.push({ i, x: q.x, z: q.z, yaw: Math.atan2(q.dx, q.dz), size: 1, doing: "fallen" });
    } else if (tt < INV.back) {
      const q = place(dAt(tt));
      const near = liveGuard.some((g) => Math.hypot(g.x - q.x, g.z - q.z) <= 45);
      raiderNows.push({
        i,
        x: q.x,
        z: q.z,
        yaw: Math.atan2(q.dx, q.dz),
        size: 1,
        doing: near ? "fight" : "advance",
      });
    } else {
      const d = dAt(INV.back) * (1 - smooth((tt - INV.back) / (INV.lift - 1 - INV.back)));
      const q = place(d);
      raiderNows.push({
        i,
        x: q.x,
        z: q.z,
        yaw: Math.atan2(-q.dx, -q.dz),
        size: d < 1.5 && tt > INV.back + 1 ? 0 : 1,
        doing: "back",
      });
    }
  }
  const liveRaiders = raiderNows.filter((r) => r.size > 0 && r.doing !== "fallen");

  // Shots: the raiders' from their fighters to the guard, then the guard's to the raiders (if it has guns).
  const bolts: BoltNow[] = [];
  let fromRaiders = 0;
  for (const rd of raiderNows) {
    if (fromRaiders >= 16) break;
    if (rd.doing !== "fight" || Math.floor(tt * 6 + unit(seed, 1100 + rd.i) * 6) % 4 !== 0)
      continue;
    const target = nearestOf(liveGuard, rd);
    if (!target) continue;
    bolts.push({ side: 0, ax: rd.x, ay: 3.2, az: rd.z, bx: target.x, by: 3, bz: target.z });
    fromRaiders++;
  }
  if (script.ranged) {
    let fromGuard = 0;
    for (let i = 0; i < guard.length && fromGuard < 8; i++) {
      const g = guard[i]!;
      if (g.doing !== "fight" || Math.floor(tt * 6 + unit(seed, 1200 + i) * 6) % 5 !== 0) continue;
      const target = nearestOf(liveRaiders, g);
      if (!target) continue;
      bolts.push({ side: 1, ax: g.x, ay: 3.2, az: g.z, bx: target.x, by: 3, bz: target.z });
      fromGuard++;
    }
  }

  // The town's soldiers: 4 × each slots. Side 0 (the raiders) is never drawn here; the guard is slot 2 * each + i.
  const soldiers: Soldier[] = [];
  for (let k = 0; k < 4 * each; k++)
    soldiers.push({ x: 0, z: 0, yaw: 0, side: k < 2 * each ? 0 : 1, doing: "advance", size: 0 });
  guard.forEach((g, i) => {
    soldiers[2 * each + i] = g;
  });
  const scene: TownWarScene = {
    soldiers,
    tents: [],
    fires: script.fires
      .filter((f) => f.ignite <= tt)
      .map((f) => ({ x: f.x, z: f.z, size: smooth((tt - f.ignite) / 3) })),
    camp: [],
    middles: [middleOf(liveRaiders), middleOf(liveGuard)],
  };
  return { t: tt, stage, raiders: raiderNows, landers, bolts, scene };
}

/**
 * The camera by time t: four shots (the landers close, the streets, the guard's line, the ships).
 * Each edge is a 1.5 s blend across it, both shots evaluated at the same t, so nothing jumps.
 */
export function invasionEye(script: InvasionScript, t: number): InvasionEye {
  const tt = Math.max(0, Math.min(INV.end, t));
  const path0 = script.site.routes[0]!;
  const P = script.site.pads[0]!;
  const len0 = lengthOf(path0);
  const far = path0[path0.length - 1]!;
  const span = Math.hypot(far.x - P.x, far.z - P.z);
  const w = span > 0 ? { x: (far.x - P.x) / span, z: (far.z - P.z) / span } : { x: 1, z: 0 };
  const s = { x: -w.z, z: w.x };
  const shot = (k: number, u: number): InvasionEye => {
    if (k === 0)
      return {
        e: { x: P.x - w.x * 150 + s.x * 60, y: 110, z: P.z - w.z * 150 + s.z * 60 },
        at: { x: P.x, y: 6 + landerAt(script, 0, u).high * 0.6, z: P.z },
      };
    if (k === 1)
      return {
        e: { x: P.x - w.x * 110 + s.x * 45, y: 120, z: P.z - w.z * 110 + s.z * 45 },
        at: { x: P.x + w.x * 10, y: 2, z: P.z + w.z * 10 },
      };
    if (k === 2) {
      const F = pathPoint(path0, Math.min(len0, front(u)));
      const sway = 30 * Math.sin(u * 0.12);
      return {
        e: { x: F.x - w.x * 100 + s.x * sway, y: 150, z: F.z - w.z * 100 + s.z * sway },
        at: { x: F.x + w.x * 15, y: 2, z: F.z + w.z * 15 },
      };
    }
    return {
      e: { x: P.x - w.x * 170 + s.x * 90, y: 170, z: P.z - w.z * 170 + s.z * 90 },
      at: { x: P.x, y: 30, z: P.z },
    };
  };
  const edges = [6, 14, 34];
  for (let b = 0; b < edges.length; b++) {
    const edge = edges[b]!;
    if (tt >= edge - 0.75 && tt < edge + 0.75) {
      const k = smooth((tt - (edge - 0.75)) / 1.5);
      const from = shot(b, tt);
      const to = shot(b + 1, tt);
      return { e: mixV(from.e, to.e, k), at: mixV(from.at, to.at, k) };
    }
  }
  return shot(tt < 6 ? 0 : tt < 14 ? 1 : tt < 34 ? 2 : 3, tt);
}

/** The caption under the film at time t. Empty when the fight came down on no town. */
export function invasionWords(plan: StarFightPlan, t: number): string {
  const L = plan.landing;
  if (!L) return "";
  if (t < INV.meet)
    return `Year ${plan.year}. ${L.raiders.name}, ${L.raiders.kind}, come down on ${L.townName}.`;
  if (t < 24) return `${L.townName} meets them in its streets.`;
  if (t < INV.back)
    return `A tenth of the homes of its land burn. ${L.dead.toLocaleString("en")} die there, the record says.`;
  return `They strike and go, as the record has it: they took nothing, and ${L.townName}'s realm stands. Drawn as it stands now, year ${plan.nowYear}.`;
}

/** The colour of each side's bolts: its beam arm's, else the default. */
export function boltColors(plan: StarFightPlan): readonly [FightRgb, FightRgb] {
  return [
    armLook(plan.attacker.beamArm ?? undefined).beam ?? BEAM_DEFAULT,
    armLook(plan.landing?.defenders.host?.arm).beam ?? BEAM_DEFAULT,
  ];
}
