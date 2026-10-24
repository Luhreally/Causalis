// A town's streets, for its walkers (Phase 23): what stands solid in a town built lot by lot —
// every block that holds anything, the lengths of its walls and their towers — and the ways
// between: each block's corners, out in its streets, joined to the others each can see; its
// gates and the ends of its walls; its square; a ring of ways out about its edge (in a great
// city, its avenues out through its sprawl). A walk is the shortest way through them, pulled
// straight wherever the way is clear — down the streets, round the blocks, out at the gates,
// never through a home — found once for each pair of ways and kept while the plan stands.
import {
  BLOCK_D,
  BLOCK_REACH,
  BLOCK_W,
  GATE_TOWER,
  LOT_D,
  SQUARE,
  WALL_THICK,
  WALL_TOWER,
  blocksHeld,
  lotStates,
  townLots,
  wallRing,
  type TownPlan,
} from "../bridge/index.ts";
import { clearOf, pushOut, route, wayClear, type Solid } from "./ground.ts";
import { AVENUES, AVENUE_HALF, SPRAWL_GAP, avenueWay, sprawlOf } from "./town.ts";

type Point = { readonly x: number; readonly z: number };

/** How far out into the street a block's corner's way stands, each way from its corner (metres). */
const CORNER = 2.5;
/** How far apart two ways may stand and be joined (metres: a block's side and the street past it). */
const SEES = 48;
/** How far a way out, the square's, a gate's looks for the ways it joins (metres). */
const SEES_FAR = 160;
/** The cells the solids are found by, and the ways (metres). */
const CELL = 32;
const WAY_CELL = 48;
/** How far about a solid it is found by the ways (metres: more than a walker keeps off it). */
const PAD = 2;
/** The ways out about a town's edge, where it has no sprawl. */
const OUTS = 32;
/** The steps along a great city's avenues (metres). */
const AVENUE_STEP = 60;
/** The walks kept (between two ways), before they are forgotten. */
const KEPT = 20_000;

const cellKey = (i: number, j: number) => (i + 2048) * 4096 + (j + 2048);

/** How near the way from p to q comes to the square's middle. */
function nearMiddle(p: Point, q: Point): number {
  const dx = q.x - p.x,
    dz = q.z - p.z,
    len2 = dx * dx + dz * dz,
    t = len2 > 0 ? Math.max(0, Math.min(1, -(p.x * dx + p.z * dz) / len2)) : 0;
  return Math.hypot(p.x + dx * t, p.z + dz * t);
}

/** The door of a lot's home on its street (its front, a lot's −v side), `along` it (metres). */
export function streetDoor(
  home: { readonly x: number; readonly z: number; readonly yaw: number },
  along: number,
  out = LOT_D / 2 + 1.9,
): Point {
  const s = Math.sin(home.yaw),
    c = Math.cos(home.yaw);
  return { x: home.x - s * out + c * along, z: home.z - c * out - s * along };
}

/** The ways between a town's solids: their points; those each sees (`to` from `first`), and how far. */
type Ways = {
  readonly x: Float64Array;
  readonly z: Float64Array;
  readonly first: Int32Array;
  readonly to: Int32Array;
  readonly far: Float64Array;
  /** The ways out: those a walk from beyond the town's edge comes in by. */
  readonly outs: readonly number[];
  readonly cells: Map<number, number[]>;
};

/** A town's solid ground and the ways through it (made from its plan; its ways when first walked). */
export class Streets {
  readonly solids: Solid[] = [];
  /** How far out its solids stand (metres from its square's middle). */
  readonly reach: number;
  /** Where its ways out stand: beyond it, open ground (past a great city's sprawl). */
  readonly edge: number;
  private readonly plan: TownPlan;
  private readonly lake: Solid | null;
  private readonly sprawl: { r0: number; r1: number } | null;
  private readonly blocks: { x: number; z: number; t: number }[] = [];
  private readonly wallEnds: Point[] = [];
  private readonly cells = new Map<number, number[]>();
  private stamp: Uint32Array;
  private mark = 0;
  private ways: Ways | null = null;
  private readonly walks = new Map<number, Int32Array | null>();
  private g = new Float64Array(0);
  private came = new Int32Array(0);
  private reached = new Uint32Array(0);
  private shut = new Uint32Array(0);
  private round = 0;
  private heap = new Int32Array(0);
  private fOf = new Float64Array(0);

  constructor(plan: TownPlan, lake: Solid | null) {
    this.plan = plan;
    this.lake = lake;
    const lots = townLots(plan.family, plan.seed, plan.axis, plan.lots, plan.water),
      held = blocksHeld(plan, lotStates(plan)),
      walls = wallRing(plan, lots, held);
    let reach = SQUARE;
    for (let b = 0; b < held.length; b++) {
      if (!held[b]) continue;
      const x = lots.blocks.x[b]!,
        z = lots.blocks.z[b]!,
        t = lots.blocks.yaw[b]!;
      // (A block's length runs along its street, (cos t, −sin t); its depth across.)
      this.solids.push({
        x,
        z,
        r: 0,
        ax: Math.cos(t),
        az: -Math.sin(t),
        half: BLOCK_W / 2,
        across: BLOCK_D / 2,
      });
      this.blocks.push({ x, z, t });
      reach = Math.max(reach, Math.hypot(x, z) + BLOCK_REACH);
    }
    if (walls) {
      const standing = new Set(walls.lengths.map((l) => l.k));
      for (const l of walls.lengths) {
        const ax = Math.cos(l.yaw),
          az = -Math.sin(l.yaw);
        if (l.gate) {
          this.solids.push({
            x: l.x,
            z: l.z,
            r: 0,
            ax,
            az,
            half: GATE_TOWER / 2,
            across: GATE_TOWER / 2,
          });
          // Its two ways through, each side of its tower: a way in and a way out of each.
          for (const side of [-1, 1]) {
            const off = side * (GATE_TOWER / 2 + (l.len / 2 - GATE_TOWER / 2) / 2);
            this.wallEnds.push({ x: l.x + ax * off, z: l.z + az * off });
          }
          continue;
        }
        this.solids.push({ x: l.x, z: l.z, r: 0, ax, az, half: l.len / 2, across: WALL_THICK / 2 });
        if (l.tower) this.solids.push({ x: l.x, z: l.z, r: WALL_TOWER / 2 });
        // Where the wall ends (pulled down, or at the water): a way round its end.
        for (const side of [-1, 1]) {
          const next = (l.k + side + walls.n) % walls.n;
          if (standing.has(next)) continue;
          const off = side * (l.len / 2 + CORNER);
          this.wallEnds.push({ x: l.x + ax * off, z: l.z + az * off });
        }
        reach = Math.max(reach, Math.hypot(l.x, l.z) + WALL_TOWER);
      }
    }
    this.reach = reach;
    this.sprawl = sprawlOf(plan, lots);
    this.edge = Math.max(reach, this.sprawl ? this.sprawl.r1 : 0) + 8;
    this.solids.forEach((s, i) => {
      // (Its turned box's reach each way, and the pad.)
      const ax = Math.abs(s.ax ?? 1),
        az = Math.abs(s.az ?? 0),
        h = s.half ?? 0,
        w = s.across ?? 0,
        ex = ax * h + az * w + s.r + PAD,
        ez = az * h + ax * w + s.r + PAD;
      for (let ci = Math.floor((s.x - ex) / CELL); ci <= Math.floor((s.x + ex) / CELL); ci++)
        for (let cj = Math.floor((s.z - ez) / CELL); cj <= Math.floor((s.z + ez) / CELL); cj++) {
          const k = cellKey(ci, cj),
            list = this.cells.get(k);
          if (list) list.push(i);
          else this.cells.set(k, [i]);
        }
    });
    this.stamp = new Uint32Array(this.solids.length);
  }

  /** The solids found about p within `reach` (each once). */
  private about(p: Point, reach: number, visit: (s: Solid) => void): void {
    if (++this.mark >= 0xffffffff) {
      this.stamp.fill(0);
      this.mark = 1;
    }
    for (let ci = Math.floor((p.x - reach) / CELL); ci <= Math.floor((p.x + reach) / CELL); ci++)
      for (let cj = Math.floor((p.z - reach) / CELL); cj <= Math.floor((p.z + reach) / CELL); cj++)
        for (const k of this.cells.get(cellKey(ci, cj)) ?? []) {
          if (this.stamp[k] === this.mark) continue;
          this.stamp[k] = this.mark;
          visit(this.solids[k]!);
        }
  }

  /**
   * Each solid found in the cells the way from p to q passes through (a solid is found in every
   * cell within its pad of it), once; stopped when `visit` answers true.
   */
  private along(p: Point, q: Point, visit: (s: Solid) => boolean): boolean {
    if (++this.mark >= 0xffffffff) {
      this.stamp.fill(0);
      this.mark = 1;
    }
    const dx = q.x - p.x,
      dz = q.z - p.z,
      i1 = Math.floor(q.x / CELL),
      j1 = Math.floor(q.z / CELL),
      si = dx > 0 ? 1 : -1,
      sj = dz > 0 ? 1 : -1,
      stepX = dx !== 0 ? CELL / Math.abs(dx) : Infinity,
      stepZ = dz !== 0 ? CELL / Math.abs(dz) : Infinity;
    let i = Math.floor(p.x / CELL),
      j = Math.floor(p.z / CELL),
      tx = dx > 0 ? ((i + 1) * CELL - p.x) / dx : dx < 0 ? (i * CELL - p.x) / dx : Infinity,
      tz = dz > 0 ? ((j + 1) * CELL - p.z) / dz : dz < 0 ? (j * CELL - p.z) / dz : Infinity;
    for (let n = 0; n < 4096; n++) {
      for (const k of this.cells.get(cellKey(i, j)) ?? []) {
        if (this.stamp[k] === this.mark) continue;
        this.stamp[k] = this.mark;
        if (visit(this.solids[k]!)) return true;
      }
      if (i === i1 && j === j1) break;
      if (tx < tz) {
        tx += stepX;
        i += si;
      } else {
        tz += stepZ;
        j += sj;
      }
    }
    return false;
  }

  /** Keep a walker `reach` off the blocks and walls (in place). */
  keepOut(p: { x: number; z: number }, reach: number): void {
    if (p.x * p.x + p.z * p.z > (this.reach + reach) ** 2) return;
    const at = { x: p.x, z: p.z };
    this.about(at, reach, (s) => pushOut(s, p, reach));
  }

  /** Whether a point stands `reach` clear of the blocks and walls. */
  clearAt(p: Point, reach: number): boolean {
    if (p.x * p.x + p.z * p.z > (this.reach + reach) ** 2) return true;
    let clear = true;
    this.about(p, reach, (s) => {
      if (clear && clearOf(s, p) < reach) clear = false;
    });
    return clear;
  }

  /**
   * Whether the way from p to q keeps `reach` off every block and wall, out of the water, and
   * out of a great city's sprawl but along one of its avenues.
   */
  clear(p: Point, q: Point, reach: number): boolean {
    if (this.lake && !wayClear(this.lake, p, q, reach)) return false;
    if (this.sprawl && this.acrossSprawl(p, q, reach)) return false;
    if (nearMiddle(p, q) > this.reach + reach) return true;
    return !this.along(p, q, (s) => !wayClear(s, p, q, reach));
  }

  /** Whether the way from p to q crosses a great city's sprawl, but along one of its avenues. */
  private acrossSprawl(p: Point, q: Point, reach: number): boolean {
    const s = this.sprawl!,
      lo = s.r0 + SPRAWL_GAP - 6,
      hi = s.r1 + 6;
    if (Math.max(Math.hypot(p.x, p.z), Math.hypot(q.x, q.z)) <= lo || nearMiddle(p, q) >= hi)
      return false;
    for (let k = 0; k < AVENUES; k++) {
      const a = avenueWay(this.plan, k),
        ux = Math.cos(a),
        uz = Math.sin(a),
        on = (o: Point) =>
          o.x * ux + o.z * uz > 0 && Math.abs(-o.x * uz + o.z * ux) <= AVENUE_HALF - reach;
      if (on(p) && on(q)) return false;
    }
    return true;
  }

  /** A way from a to b by the streets, as the points to pass (`reach` kept off every wall). */
  route(a: Point, b: Point, reach: number): Point[] {
    if (this.clear(a, b, reach)) return [a, b];
    const w = this.waysFor(reach),
      ea = this.entry(w, a, b, reach),
      eb = this.entry(w, b, a, reach);
    if (!ea || !eb) return this.roundLake([a, b], reach);
    const key = ea.way * w.x.length + eb.way;
    let walk = this.walks.get(key);
    if (walk === undefined) {
      if (this.walks.size >= KEPT) this.walks.clear();
      walk = this.search(w, ea.way, eb.way);
      this.walks.set(key, walk);
    }
    if (!walk) return this.roundLake([a, b], reach);
    const points: Point[] = [a, ...ea.lead];
    for (const i of walk) points.push({ x: w.x[i]!, z: w.z[i]! });
    for (let k = eb.lead.length - 1; k >= 0; k--) points.push(eb.lead[k]!);
    points.push(b);
    return this.roundLake(this.pull(points, reach), reach);
  }

  /**
   * The way a walk from p (toward q) joins the streets by, and the points it passes on the way to
   * it: from beyond the edge, a way out it can walk to without crossing the town (else round the
   * edge to the nearest); from within, the way it sees that is shortest on toward q.
   */
  private entry(w: Ways, p: Point, q: Point, reach: number): { way: number; lead: Point[] } | null {
    const lead: Point[] = [];
    if (Math.hypot(p.x, p.z) >= this.edge - 1) {
      let best = -1,
        cost = Infinity;
      for (const o of w.outs) {
        const at = { x: w.x[o]!, z: w.z[o]! };
        if (nearMiddle(at, p) < this.edge - 2) continue;
        const c = Math.hypot(p.x - at.x, p.z - at.z) + Math.hypot(at.x - q.x, at.z - q.z);
        if (c < cost) {
          cost = c;
          best = o;
        }
      }
      if (best >= 0) return { way: best, lead };
      // (Round the edge from its own way to the nearest way out.)
      const way = Math.atan2(p.z, p.x),
        turnTo = (o: number) => {
          const d = Math.atan2(w.z[o]!, w.x[o]!) - way;
          return Math.atan2(Math.sin(d), Math.cos(d));
        };
      let near = -1;
      for (const o of w.outs)
        if (near < 0 || Math.abs(turnTo(o)) < Math.abs(turnTo(near))) near = o;
      if (near < 0) return null;
      const turn = turnTo(near),
        steps = Math.ceil(Math.abs(turn) / 0.2),
        r = this.edge + 2;
      for (let k = 1; k < steps; k++) {
        const a = way + (turn * k) / steps;
        lead.push({ x: r * Math.cos(a), z: r * Math.sin(a) });
      }
      return { way: near, lead };
    }
    // (From inside a wall: out of it first.)
    let from: Point = p;
    if (!this.clearAt(p, reach)) {
      const out = { x: p.x, z: p.z };
      for (let k = 0; k < 3; k++) this.keepOut(out, reach);
      from = out;
      lead.push(out);
    }
    for (const span of [24, 64, 160, 400]) {
      const seen: { i: number; c: number }[] = [];
      this.waysNear(w, from, span, (i, d) =>
        seen.push({ i, c: d + Math.hypot(w.x[i]! - q.x, w.z[i]! - q.z) }),
      );
      seen.sort((u, v) => u.c - v.c || u.i - v.i);
      for (const s of seen)
        if (this.clear(from, { x: w.x[s.i]!, z: w.z[s.i]! }, reach)) return { way: s.i, lead };
    }
    return null;
  }

  /** The ways within `span` of p, and how far each is. */
  private waysNear(w: Ways, p: Point, span: number, visit: (i: number, d: number) => void): void {
    const i0 = Math.floor((p.x - span) / WAY_CELL),
      i1 = Math.floor((p.x + span) / WAY_CELL),
      j0 = Math.floor((p.z - span) / WAY_CELL),
      j1 = Math.floor((p.z + span) / WAY_CELL);
    for (let ci = i0; ci <= i1; ci++)
      for (let cj = j0; cj <= j1; cj++) {
        const list = w.cells.get(cellKey(ci, cj));
        if (!list) continue;
        for (const i of list) {
          const d = Math.hypot(w.x[i]! - p.x, w.z[i]! - p.z);
          if (d <= span) visit(i, d);
        }
      }
  }

  /** Each point passed only where the way past it is not clear: the walk pulled straight. */
  private pull(points: Point[], reach: number): Point[] {
    const out = [points[0]!];
    for (let i = 0; i < points.length - 1;) {
      let j = i + 1;
      while (j + 1 < points.length && this.clear(points[i]!, points[j + 1]!, reach)) j++;
      out.push(points[j]!);
      i = j;
    }
    return out;
  }

  /** Round the water, on any leg of a walk that would cross it (beyond the town's ways). */
  private roundLake(points: Point[], reach: number): Point[] {
    const lake = this.lake;
    if (!lake) return points;
    const out = [points[0]!];
    for (let i = 0; i + 1 < points.length; i++) {
      const p = points[i]!,
        q = points[i + 1]!;
      if (wayClear(lake, p, q, reach)) out.push(q);
      else out.push(...route({ lake, homes: [], homesReach: 0, town: null }, p, q, reach).slice(1));
    }
    return out;
  }

  /** The shortest walk between two ways (A*, by how far each is from the last): its ways in turn. */
  private search(w: Ways, from: number, goal: number): Int32Array | null {
    if (from === goal) return Int32Array.of(from);
    const n = w.x.length;
    // (Its scratch kept from walk to walk, marked afresh for each.)
    if (this.g.length !== n) {
      this.g = new Float64Array(n);
      this.came = new Int32Array(n);
      this.reached = new Uint32Array(n);
      this.shut = new Uint32Array(n);
      this.round = 0;
    }
    if (++this.round >= 0xffffffff) {
      this.reached.fill(0);
      this.shut.fill(0);
      this.round = 1;
    }
    const { g, came, reached, shut, round } = this,
      gx = w.x[goal]!,
      gz = w.z[goal]!,
      heap = this.heap.length >= 4 * n ? this.heap : (this.heap = new Int32Array(4 * n + 16)),
      fOf = this.fOf.length >= 4 * n ? this.fOf : (this.fOf = new Float64Array(4 * n + 16));
    let size = 0;
    const push = (i: number, f: number) => {
      if (size >= heap.length) return;
      let k = size++;
      while (k > 0) {
        const up = (k - 1) >> 1;
        if (fOf[up]! <= f) break;
        heap[k] = heap[up]!;
        fOf[k] = fOf[up]!;
        k = up;
      }
      heap[k] = i;
      fOf[k] = f;
    };
    const pop = (): number => {
      const top = heap[0]!,
        i = heap[--size]!,
        f = fOf[size]!;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1,
          r = l + 1;
        let m = -1,
          mf = f;
        if (l < size && fOf[l]! < mf) {
          m = l;
          mf = fOf[l]!;
        }
        if (r < size && fOf[r]! < mf) m = r;
        if (m < 0) break;
        heap[k] = heap[m]!;
        fOf[k] = fOf[m]!;
        k = m;
      }
      heap[k] = i;
      fOf[k] = f;
      return top;
    };
    g[from] = 0;
    came[from] = -1;
    reached[from] = round;
    push(from, Math.hypot(w.x[from]! - gx, w.z[from]! - gz));
    let found = false;
    while (size > 0) {
      const i = pop();
      if (shut[i] === round) continue;
      if (i === goal) {
        found = true;
        break;
      }
      shut[i] = round;
      for (let e = w.first[i]!; e < w.first[i + 1]!; e++) {
        const j = w.to[e]!,
          c = g[i]! + w.far[e]!;
        if (reached[j] === round && c >= g[j]!) continue;
        reached[j] = round;
        g[j] = c;
        came[j] = i;
        push(j, c + Math.hypot(w.x[j]! - gx, w.z[j]! - gz));
      }
    }
    if (!found) return null;
    const walk: number[] = [];
    for (let i = goal; i >= 0; i = came[i]!) walk.push(i);
    return Int32Array.from(walk.reverse());
  }

  /** The ways, made the first time a walk needs them. */
  private waysFor(reach: number): Ways {
    if (this.ways) return this.ways;
    const xs: number[] = [],
      zs: number[] = [],
      links: [number, number][] = [];
    const put = (x: number, z: number): number => {
      const p = { x, z };
      if (!this.clearAt(p, reach + 0.05) || (this.lake && clearOf(this.lake, p) < reach + 1))
        return -1;
      xs.push(x);
      zs.push(z);
      return xs.length - 1;
    };
    // Each block's corners, out in its streets.
    for (const b of this.blocks) {
      const c = Math.cos(b.t),
        s = Math.sin(b.t);
      for (const u of [-1, 1])
        for (const v of [-1, 1]) {
          const du = u * (BLOCK_W / 2 + CORNER),
            dv = v * (BLOCK_D / 2 + CORNER);
          put(b.x + du * c + dv * s, b.z - du * s + dv * c);
        }
    }
    // Each way through a gate and round a wall's end: within and without.
    const special: number[] = [],
      mark = (i: number) => {
        if (i >= 0) special.push(i);
      };
    for (const e of this.wallEnds) {
      const d = Math.hypot(e.x, e.z) || 1,
        out = WALL_THICK / 2 + CORNER + 1;
      mark(put(e.x + (e.x / d) * out, e.z + (e.z / d) * out));
      mark(put(e.x - (e.x / d) * out, e.z - (e.z / d) * out));
    }
    // The square: its middle and a ring within it.
    mark(put(0, 0));
    for (let k = 0; k < 8; k++)
      mark(
        put(
          (SQUARE - 5) * Math.cos((k / 8) * 2 * Math.PI),
          (SQUARE - 5) * Math.sin((k / 8) * 2 * Math.PI),
        ),
      );
    // The ways out: a great city's avenues, way by way out through its sprawl; else a ring about it.
    const outs: number[] = [];
    if (this.sprawl) {
      for (let k = 0; k < AVENUES; k++) {
        const a = avenueWay(this.plan, k),
          inner = this.reach + 8,
          steps = Math.max(1, Math.ceil((this.edge - inner) / AVENUE_STEP));
        let last = -1;
        for (let m = 0; m <= steps; m++) {
          const r = inner + ((this.edge - inner) * m) / steps,
            i = put(r * Math.cos(a), r * Math.sin(a));
          if (i < 0) break;
          if (last >= 0) links.push([last, i]);
          else mark(i);
          last = i;
          if (m === steps) outs.push(i);
        }
      }
    } else {
      let first = -1,
        last = -1;
      for (let k = 0; k < OUTS; k++) {
        const a = this.plan.axis + (k / OUTS) * 2 * Math.PI,
          i = put(this.edge * Math.cos(a), this.edge * Math.sin(a));
        if (i < 0) {
          last = -1;
          continue;
        }
        outs.push(i);
        mark(i);
        if (last >= 0) links.push([last, i]);
        if (k === 0) first = i;
        last = i;
      }
      if (first >= 0 && last >= 0 && last !== first) links.push([last, first]);
    }
    const n = xs.length,
      cells = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const k = cellKey(Math.floor(xs[i]! / WAY_CELL), Math.floor(zs[i]! / WAY_CELL)),
        list = cells.get(k);
      if (list) list.push(i);
      else cells.set(k, [i]);
    }
    const w0: Ways = {
      x: Float64Array.from(xs),
      z: Float64Array.from(zs),
      first: new Int32Array(1),
      to: new Int32Array(0),
      far: new Float64Array(0),
      outs,
      cells,
    };
    // Which ways are joined (each pair once), and into how many wholes (each by its root).
    const joined = new Set<number>(),
      ends: number[] = [],
      root = Int32Array.from({ length: n }, (_, i) => i),
      top = (i: number): number => {
        while (root[i] !== i) {
          root[i] = root[root[i]!]!;
          i = root[i]!;
        }
        return i;
      },
      link = (i: number, j: number) => {
        const key = i < j ? i * n + j : j * n + i;
        if (i === j || joined.has(key)) return;
        joined.add(key);
        ends.push(i, j);
        root[top(i)] = top(j);
      },
      sees = (i: number, j: number) =>
        this.clear({ x: xs[i]!, z: zs[i]! }, { x: xs[j]!, z: zs[j]! }, reach);
    for (const [i, j] of links) if (sees(i, j)) link(i, j);
    // Each joined to those it sees near it (each pair weighed once, from its lower).
    for (let i = 0; i < n; i++) {
      const x = xs[i]!,
        z = zs[i]!,
        ci = Math.floor(x / WAY_CELL),
        cj = Math.floor(z / WAY_CELL);
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          const list = cells.get(cellKey(ci + di, cj + dj));
          if (!list) continue;
          for (const j of list)
            if (j > i && Math.hypot(xs[j]! - x, zs[j]! - z) <= SEES && sees(i, j)) link(i, j);
        }
    }
    // The ways out, the square's and the walls' (few, standing apart from the blocks' corners):
    // each joined besides to the nearest few it sees further off.
    for (const i of special) {
      const seen: { j: number; d: number }[] = [];
      this.waysNear(w0, { x: xs[i]!, z: zs[i]! }, SEES_FAR, (j, d) => {
        if (j !== i && d > SEES) seen.push({ j, d });
      });
      seen.sort((u, v) => u.d - v.d || u.j - v.j);
      let got = 0;
      for (const c of seen) {
        if (got >= 4) break;
        if (sees(i, c.j)) {
          link(i, c.j);
          got++;
        }
      }
    }
    // A whole cut off from the rest (a lone block far out) joined to it by the nearest way it sees.
    const size = new Map<number, number>();
    for (let i = 0; i < n; i++) size.set(top(i), (size.get(top(i)) ?? 0) + 1);
    let main = -1;
    for (const [r, c] of size) if (main < 0 || c > size.get(main)!) main = r;
    for (let i = 0; i < n; i++) {
      if (top(i) === top(main)) continue;
      for (const span of [SEES * 2.5, SEES * 6]) {
        const seen: { j: number; d: number }[] = [];
        this.waysNear(w0, { x: xs[i]!, z: zs[i]! }, span, (j, d) => {
          if (top(j) === top(main)) seen.push({ j, d });
        });
        seen.sort((u, v) => u.d - v.d || u.j - v.j);
        const near = seen.find((c) => sees(i, c.j));
        if (near) {
          link(i, near.j);
          break;
        }
      }
    }
    const first = new Int32Array(n + 1);
    for (let e = 0; e < ends.length; e++) first[ends[e]! + 1]!++;
    for (let i = 0; i < n; i++) first[i + 1] = first[i + 1]! + first[i]!;
    const to = new Int32Array(ends.length),
      far = new Float64Array(ends.length),
      fill = first.slice(0, n);
    for (let e = 0; e < ends.length; e += 2) {
      const i = ends[e]!,
        j = ends[e + 1]!,
        d = Math.hypot(xs[j]! - xs[i]!, zs[j]! - zs[i]!);
      to[fill[i]!] = j;
      far[fill[i]!++] = d;
      to[fill[j]!] = i;
      far[fill[j]!++] = d;
    }
    this.ways = { ...w0, first, to, far };
    return this.ways;
  }
}

/** A town's streets for its walkers, from its plan (and its water, as the village draws it). */
export function streetsOf(plan: TownPlan, lake: Solid | null): Streets {
  return new Streets(plan, lake);
}
