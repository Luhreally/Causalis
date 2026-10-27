// What stands on a village's ground that a walker cannot walk through (Phase 9 M85–M86):
// its water — save to a swimmer — and its homes, each a solid on the ground (a home as long
// as it is built: a core along its length, rounded at its ends; the water and a round home a
// circle); and the push that keeps a walker out of them, to the nearest point of the wall,
// so that passing one is a smooth step around it and never a jump. A walker is kept its own
// reach off them (a beast's half-length as drawn), so its body does not pass into a wall.
// In a town built lot by lot (Phase 23), every block that holds anything and the lengths of its
// walls stand solid too, and a walk goes by its streets (streets.ts).
import { LAKE_R, LOT_D, LOT_W, type VillagePlan } from "../bridge/index.ts";
import { houseLook } from "./village.ts";
import { streetsOf, type Streets } from "./streets.ts";

/**
 * A solid on the ground: its middle and how far its wall stands from its core; a long one's
 * core runs along a unit axis (ax, az), `half` its length each way (0: a circle); a box's core
 * reaches `across` it each way too.
 */
export type Solid = {
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly ax?: number;
  readonly az?: number;
  readonly half?: number;
  readonly across?: number;
};

export type Ground = {
  readonly lake: Solid | null;
  readonly homes: readonly Solid[];
  /** How far out from the middle the homes reach (a walker further out passes none). */
  readonly homesReach: number;
  /** A town's blocks, walls and streets (Phase 23; null: a village's open ground). */
  readonly town?: Streets | null;
};

type Point = { readonly x: number; readonly z: number };

const GROUNDS = new WeakMap<VillagePlan, Ground>();

/** A village's solid ground, from its plan (metres; kept while the plan stands). */
export function villageGround(plan: VillagePlan): Ground {
  const known = GROUNDS.get(plan);
  if (known) return known;
  const g = groundOf(plan);
  GROUNDS.set(plan, g);
  return g;
}

function groundOf(plan: VillagePlan): Ground {
  const lake = plan.water ? { x: plan.water.x, z: plan.water.z, r: LAKE_R } : null;
  if (plan.town) {
    // A town's: its blocks and walls, and the watched homes each its lot's whole footprint (as
    // much as any home on it is built to, wall to wall along its street); what it reaches out
    // to, the town's edge.
    const town = streetsOf(plan.town, lake);
    return {
      lake,
      homes: plan.homes.map((h) => ({
        x: h.x,
        z: h.z,
        r: 0,
        ax: Math.cos(h.yaw),
        az: -Math.sin(h.yaw),
        half: LOT_W / 2 - 0.1,
        across: LOT_D / 2 - 0.8,
      })),
      homesReach: town.edge,
      town,
    };
  }
  const look = houseLook(plan.house),
    // (A house's drawn measures are tenths of its metres; its roof overhangs its walls.)
    long = look.length * 10 * 1.15,
    wide = look.width * 10 * 1.15,
    r = look.round ? Math.max(long, wide) / 2 : Math.min(long, wide) / 2,
    half = look.round ? 0 : Math.abs(long - wide) / 2,
    alongLength = long >= wide,
    homes = plan.homes.map((h) => {
      // (A home's length runs along its own x, turned by its yaw.)
      const c = Math.cos(h.yaw),
        s = Math.sin(h.yaw);
      return alongLength
        ? { x: h.x, z: h.z, r, ax: c, az: -s, half }
        : { x: h.x, z: h.z, r, ax: s, az: c, half };
    });
  let reach = 0;
  for (const h of homes) reach = Math.max(reach, Math.hypot(h.x, h.z) + h.r + h.half);
  return { lake, homes, homesReach: reach, town: null };
}

/** The point of a solid's core nearest (px, pz). */
function coreNear(s: Solid, px: number, pz: number): [number, number] {
  const h = s.half ?? 0,
    w = s.across ?? 0;
  if (!h && !w) return [s.x, s.z];
  const ax = s.ax ?? 1,
    az = s.az ?? 0,
    dx = px - s.x,
    dz = pz - s.z,
    t = Math.max(-h, Math.min(h, dx * ax + dz * az));
  if (!w) return [s.x + ax * t, s.z + az * t];
  // (A box: across its axis too, the axis turned a quarter.)
  const n = Math.max(-w, Math.min(w, -dx * az + dz * ax));
  return [s.x + ax * t - az * n, s.z + az * t + ax * n];
}

/** How far a point stands clear of a solid's wall (less than nothing: inside it). */
export function clearOf(s: Solid, p: Point): number {
  const [cx, cz] = coreNear(s, p.x, p.z),
    d = Math.hypot(p.x - cx, p.z - cz);
  if (d > 0 || !s.across) return d - s.r;
  // (Within a box's core: as deep in as its nearer side is far.)
  const ax = s.ax ?? 1,
    az = s.az ?? 0,
    dx = p.x - s.x,
    dz = p.z - s.z;
  return (
    -Math.min(
      (s.half ?? 0) - Math.abs(dx * ax + dz * az),
      s.across - Math.abs(-dx * az + dz * ax),
    ) - s.r
  );
}

/** Push `p` out of `s` (with `reach` to spare) to the nearest point of its wall, in place. */
export function pushOut(s: Solid, p: { x: number; z: number }, reach: number): void {
  const [cx, cz] = coreNear(s, p.x, p.z),
    r = s.r + reach,
    dx = p.x - cx,
    dz = p.z - cz,
    d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  const d = Math.sqrt(d2);
  if (d < 1e-9) {
    const ax = s.ax ?? 1,
      az = s.az ?? 0;
    if (s.across) {
      // (Within a box's core: out by its nearer side.)
      const ex = p.x - s.x,
        ez = p.z - s.z,
        t = ex * ax + ez * az,
        n = -ex * az + ez * ax,
        h = s.half ?? 0;
      if (h - Math.abs(t) < s.across - Math.abs(n)) {
        const out = (t < 0 ? -1 : 1) * (h + r);
        p.x = s.x + ax * out - az * n;
        p.z = s.z + az * out + ax * n;
      } else {
        const out = (n < 0 ? -1 : 1) * (s.across + r);
        p.x = s.x + ax * t - az * out;
        p.z = s.z + az * t + ax * out;
      }
      return;
    }
    // (On the core itself: out across it.)
    p.x = cx - az * r;
    p.z = cz + ax * r;
    return;
  }
  p.x = cx + (dx / d) * r;
  p.z = cz + (dz / d) * r;
}

/**
 * Keep a walker `reach` metres across out of the water and the homes (in place) — pushed
 * again where homes stand so close that out of one is into the next; in a town, out of its
 * blocks and walls.
 */
export function keepOut(ground: Ground, p: { x: number; z: number }, reach: number): void {
  for (let pass = 0; pass < 3; pass++) {
    const x = p.x,
      z = p.z;
    if (ground.lake) pushOut(ground.lake, p, reach);
    if (p.x * p.x + p.z * p.z < (ground.homesReach + reach) ** 2) {
      homesOut(ground, p, reach);
      ground.town?.keepOut(p, reach);
    }
    if (p.x === x && p.z === z) return;
  }
}

/** Whether a point stands `reach` clear of every wall on the ground and dry. */
export function clearAt(ground: Ground, p: Point, reach: number): boolean {
  if (ground.lake && clearOf(ground.lake, p) < reach) return false;
  if (ground.homes.length <= FEW_HOMES) {
    for (const h of ground.homes) if (clearOf(h, p) < reach) return false;
  } else
    for (const i of homesAbout(ground, p, reach))
      if (clearOf(ground.homes[i]!, p) < reach) return false;
  return !ground.town || ground.town.clearAt(p, reach);
}

/**
 * The homes a walker stands near, found by the cells of the ground each home stands over (Phase
 * 60: a great town under the hand draws 400 people, every one kept out of its homes every frame —
 * on a slowed phone, most of the frame went in walking every home for each). A home further off
 * than its own extent and the walker's reach cannot touch it, so the push and the clearance are
 * the same as walking them all, bit for bit (tests/view/ground-homes.test.ts).
 */
const FEW_HOMES = 24;
/** A cell of the homes' (metres across), and how much more each is looked for over (metres). */
const HOME_CELL = 8,
  HOME_SPARE = 0.01;
type HomeCells = {
  readonly cells: Map<number, number[]>;
  /** The look each home was last found in (none found twice in one), and the looks made. */
  readonly seen: Uint32Array;
  looks: number;
};
const HOME_CELLS = new WeakMap<Ground, HomeCells>();
const about: number[] = [];

function homeCellsOf(ground: Ground): HomeCells {
  const known = HOME_CELLS.get(ground);
  if (known) return known;
  const cells = new Map<number, number[]>();
  ground.homes.forEach((h, i) => {
    // (As far as its core reaches from its middle, and its wall beyond.)
    const extent = Math.hypot(h.half ?? 0, h.across ?? 0) + h.r + HOME_SPARE,
      i1 = Math.floor((h.x + extent) / HOME_CELL),
      j1 = Math.floor((h.z + extent) / HOME_CELL);
    for (let ci = Math.floor((h.x - extent) / HOME_CELL); ci <= i1; ci++)
      for (let cj = Math.floor((h.z - extent) / HOME_CELL); cj <= j1; cj++) {
        const key = (ci + 32768) * 65536 + (cj + 32768),
          list = cells.get(key);
        if (list) list.push(i);
        else cells.set(key, [i]);
      }
  });
  const made = { cells, seen: new Uint32Array(ground.homes.length), looks: 0 };
  HOME_CELLS.set(ground, made);
  return made;
}

/** The homes within `reach` of a point's cells, in their order (the list is reused: read it at once). */
function homesAbout(ground: Ground, p: Point, reach: number): readonly number[] {
  const known = homeCellsOf(ground),
    { cells, seen } = known,
    spare = reach + HOME_SPARE,
    i1 = Math.floor((p.x + spare) / HOME_CELL),
    j1 = Math.floor((p.z + spare) / HOME_CELL);
  // (Its looks counted on; past what a mark holds, every mark cleared and counted from one.)
  if (++known.looks >= 0xffffffff) {
    seen.fill(0);
    known.looks = 1;
  }
  const looks = known.looks;
  about.length = 0;
  for (let ci = Math.floor((p.x - spare) / HOME_CELL); ci <= i1; ci++)
    for (let cj = Math.floor((p.z - spare) / HOME_CELL); cj <= j1; cj++)
      for (const i of cells.get((ci + 32768) * 65536 + (cj + 32768)) ?? [])
        if (seen[i] !== looks) {
          seen[i] = looks;
          about.push(i);
        }
  return about.length > 1 ? about.sort((a, b) => a - b) : about;
}

/**
 * Out of each home a walker stands within, in the homes' order, as walking them all does: those
 * about it; pushed out of one, those about where it now stands, from the next on.
 */
function homesOut(ground: Ground, p: { x: number; z: number }, reach: number): void {
  const homes = ground.homes;
  if (homes.length <= FEW_HOMES) {
    for (const h of homes) pushOut(h, p, reach);
    return;
  }
  for (let from = 0; ;) {
    let moved = -1;
    for (const i of homesAbout(ground, p, reach)) {
      if (i < from) continue;
      const x = p.x,
        z = p.z;
      pushOut(homes[i]!, p, reach);
      if (p.x !== x || p.z !== z) {
        moved = i;
        break;
      }
    }
    if (moved < 0) return;
    from = moved + 1;
  }
}

/** Whether the way from p to q keeps `reach` off a solid's wall. */
export function wayClear(s: Solid, p: Point, q: Point, reach: number): boolean {
  const r = s.r + reach;
  if (!s.across) {
    // (A circle: how near the way comes to its middle.)
    if (!s.half) return toSegment(s.x, s.z, p, q) >= r;
    const [a, b] = coreOf(s);
    return between(p, q, a, b) >= r;
  }
  // A box: in its own frame, the way against its core grown by r on every side (its corners
  // square: a little more than kept off them) — clear if no stretch of it lies within both of
  // the box's slabs at once.
  const ax = s.ax ?? 1,
    az = s.az ?? 0,
    pu = (p.x - s.x) * ax + (p.z - s.z) * az,
    pv = -(p.x - s.x) * az + (p.z - s.z) * ax,
    du = (q.x - s.x) * ax + (q.z - s.z) * az - pu,
    dv = -(q.x - s.x) * az + (q.z - s.z) * ax - pv,
    hu = (s.half ?? 0) + r,
    hv = s.across + r;
  let lo = 0,
    hi = 1;
  if (Math.abs(du) < 1e-12) {
    if (pu <= -hu || pu >= hu) return true;
  } else {
    const t0 = (-hu - pu) / du,
      t1 = (hu - pu) / du;
    lo = Math.max(lo, Math.min(t0, t1));
    hi = Math.min(hi, Math.max(t0, t1));
    if (lo >= hi) return true;
  }
  if (Math.abs(dv) < 1e-12) return pv <= -hv || pv >= hv;
  const t0 = (-hv - pv) / dv,
    t1 = (hv - pv) / dv;
  return Math.max(lo, Math.min(t0, t1)) >= Math.min(hi, Math.max(t0, t1));
}

/** Whether (x, z) is clear of the water by `margin` metres. */
export function dryAt(ground: Ground, x: number, z: number, margin: number): boolean {
  const l = ground.lake;
  return !l || Math.hypot(x - l.x, z - l.z) > l.r + margin;
}

/** The distance from a point to a segment. */
function toSegment(px: number, pz: number, a: Point, b: Point): number {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    len2 = dx * dx + dz * dz,
    t = len2 > 0 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2)) : 0;
  return Math.hypot(px - (a.x + dx * t), pz - (a.z + dz * t));
}

/** A solid's core as a segment (both ends the middle, for a circle). */
function coreOf(s: Solid): [Point, Point] {
  const h = s.half ?? 0,
    ax = s.ax ?? 1,
    az = s.az ?? 0;
  return [
    { x: s.x - ax * h, z: s.z - az * h },
    { x: s.x + ax * h, z: s.z + az * h },
  ];
}

/** The nearest two segments come (nothing, where they cross). */
function between(p: Point, q: Point, a: Point, b: Point): number {
  const cross = (o: Point, u: Point, v: Point) =>
      (u.x - o.x) * (v.z - o.z) - (u.z - o.z) * (v.x - o.x),
    d1 = cross(p, q, a),
    d2 = cross(p, q, b),
    d3 = cross(a, b, p),
    d4 = cross(a, b, q);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(
    toSegment(a.x, a.z, p, q),
    toSegment(b.x, b.z, p, q),
    toSegment(p.x, p.z, a, b),
    toSegment(q.x, q.z, a, b),
  );
}

/** The first solid the way from p to q passes through (not one it starts or ends in). */
function firstHit(ground: Ground, p: Point, q: Point, reach: number): Solid | null {
  const dx = q.x - p.x,
    dz = q.z - p.z,
    len2 = dx * dx + dz * dz;
  let best: Solid | null = null,
    bestT = Infinity;
  // The way's box: a solid whose middle stands further off it than its own reach cannot be
  // hit, and most of a village's homes are far from any one way (so they cost a comparison).
  const x0 = Math.min(p.x, q.x),
    x1 = Math.max(p.x, q.x),
    z0 = Math.min(p.z, q.z),
    z1 = Math.max(p.z, q.z);
  const test = (s: Solid) => {
    const span = s.r + reach + (s.half ?? 0) + (s.across ?? 0);
    if (s.x < x0 - span || s.x > x1 + span || s.z < z0 - span || s.z > z1 + span) return;
    if (clearOf(s, p) < reach || clearOf(s, q) < reach) return;
    if (wayClear(s, p, q, reach)) return;
    const t = len2 > 0 ? ((s.x - p.x) * dx + (s.z - p.z) * dz) / len2 : 0;
    if (t < bestT) {
      bestT = t;
      best = s;
    }
  };
  if (ground.lake) test(ground.lake);
  for (const h of ground.homes) test(h);
  return best;
}

/**
 * A way from `a` to `b` round the solids between, as the points to pass (a walker's
 * `reach` kept off each wall): where the straight way would pass through one, it turns at
 * the wall beside it — a few turns at most. In a town, by its streets.
 */
export function route(ground: Ground, a: Point, b: Point, reach: number): Point[] {
  if (ground.town) return ground.town.route(a, b, reach);
  const way: Point[] = [a, b];
  for (let pass = 0; pass < 4; pass++) {
    let turned = false;
    for (let k = 0; k + 1 < way.length && way.length < 10; k++) {
      const p = way[k]!,
        q = way[k + 1]!,
        s = firstHit(ground, p, q, reach);
      if (!s) continue;
      // Beside the solid, on the side the way passes: out from its core through the way's
      // nearest point to it, a little past its wall.
      const dx = q.x - p.x,
        dz = q.z - p.z,
        len2 = dx * dx + dz * dz || 1,
        t = Math.max(0, Math.min(1, ((s.x - p.x) * dx + (s.z - p.z) * dz) / len2)),
        on = { x: p.x + dx * t, z: p.z + dz * t },
        [cx, cz] = coreNear(s, on.x, on.z);
      let ox = on.x - cx,
        oz = on.z - cz;
      if (Math.hypot(ox, oz) < 1e-6) {
        ox = -dz;
        oz = dx;
      }
      const n = Math.hypot(ox, oz) || 1,
        out = (s.r + reach) * 1.15 + 0.5,
        turn = { x: cx + (ox / n) * out, z: cz + (oz / n) * out };
      // (Clear of any wall beside it, too.)
      keepOut(ground, turn, reach);
      way.splice(k + 1, 0, turn);
      turned = true;
      k++;
    }
    if (!turned) break;
  }
  return way;
}
