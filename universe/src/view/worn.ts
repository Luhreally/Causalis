// The ground a town's people have worn (R1, classic 46's last piece). Read off who walks what, not drawn on all its streets alike: its standing homes, each
// sending so many a day by the shortest way along its streets to the well, the square, the buildings it has of each kind, the fields and the road out, as
// a person's day has them go. Where many ways join the ground wears deepest; a street few go down stays as it was. It comes in as a home ages, so a young
// town is barely marked; what its fallen homes wore goes green again as the years pass, so a shrunken town's old ways fade. Pure: a town's plan in, flat
// pieces of ground out, kept while the plan stands.
import { MinHeap, YEAR } from "../kernel/index.ts";
import { BLOCK_D, BLOCK_LOTS, BLOCK_REACH, BLOCK_W, LOT, SQUARE, STREET } from "../bridge/index.ts";
import type { TownScene } from "./town.ts";

/** A stretch of worn ground: its middle, length and turn, how worn (0 to 4), and how far gone back to green (0 to 1). */
export type WornPiece = {
  readonly x: number;
  readonly z: number;
  readonly len: number;
  readonly yaw: number;
  readonly band: number;
  readonly green: number;
  readonly wear: number;
};

/** How wide each band of wear is (metres). */
export const WORN_WIDE: readonly number[] = [2.6, 3.6, 4.8, 6.2, 8];
/** What a town's ground reads as worn, with the ways that aren't. */
export type Worn = {
  readonly pieces: readonly WornPiece[];
  /** Ways it has (along its streets), those worn past a trace, and homes counted. */
  readonly ways: number;
  readonly worn: number;
  readonly homes: number;
};

/** How long a home takes to wear its way in, and how long its way takes to green over (years). */
const WEAR_IN = 25;
const GREEN_OVER = 30;
/** Of a day's goings per home, the share to each kind of place (the rest in their own street). */
const GOES: Readonly<Record<string, number>> = {
  school: 0.25,
  temple: 0.25,
  shrine: 0.15,
  hall: 0.15,
  market: 0.3,
  workshop: 0.3,
  kiln: 0.15,
  mill: 0.2,
  smithy: 0.2,
  factory: 0.45,
  works: 0.45,
  docks: 0.35,
  hospital: 0.1,
};
const GOES_ELSE = 0.08;
/** Ways out to the fields, about its edge; and how far past the town they run (metres). */
const FIELD_WAYS = 6;
const OUT_PAST = 44;
/** How far two blocks' corners may lie and be one crossing (metres). */
const CROSSING = 13;

/** The share of a town's homes past which a way shows at all, and each band's. */
const BANDS: readonly number[] = [0.02, 0.05, 0.12, 0.3, 0.6];

type Build = {
  x: number[];
  z: number[];
  /** Each way's two ends. */
  a: number[];
  b: number[];
};

const KEPT = new WeakMap<object, Map<number, Worn>>();

/** What a town's ground reads as worn at most `most` pieces, kept while its plan stands. */
export function wornOf(scene: TownScene, most = 1500): Worn {
  let byMost = KEPT.get(scene.plan);
  if (!byMost) KEPT.set(scene.plan, (byMost = new Map()));
  const had = byMost.get(most);
  if (had) return had;
  const made = readWorn(scene, most);
  byMost.set(most, made);
  return made;
}

function readWorn(scene: TownScene, most: number): Worn {
  const { plan, lots, states, held } = scene,
    blocks = Math.ceil(plan.lots / BLOCK_LOTS),
    build: Build = { x: [0], z: [0], a: [], b: [] },
    year = plan.year;
  if (!blocks) return { pieces: [], ways: 0, worn: 0, homes: 0 };
  const halfW = (BLOCK_W + STREET) / 2,
    halfD = (BLOCK_D + STREET) / 2,
    /** A point's way, one to each spot of ground. */
    at = new Map<number, number>(),
    nodeAt = (x: number, z: number) => {
      const key = Math.round(x / 3) * 65536 + Math.round(z / 3);
      let n = at.get(key);
      if (n === undefined) {
        n = build.x.length;
        build.x.push(x);
        build.z.push(z);
        at.set(key, n);
      }
      return n;
    },
    join = (p: number, q: number) => {
      if (p !== q) {
        build.a.push(p);
        build.b.push(q);
      }
    },
    fronts = new Int32Array(blocks).fill(-1),
    backs = new Int32Array(blocks).fill(-1);
  let reach = SQUARE;
  for (let b = 0; b < blocks; b++) {
    if (!held[b]) continue;
    const t = lots.blocks.yaw[b]!,
      c = Math.cos(t),
      s = Math.sin(t),
      bx = lots.blocks.x[b]!,
      bz = lots.blocks.z[b]!,
      point = (u: number, v: number) => nodeAt(bx + u * c + v * s, bz - u * s + v * c),
      ring = [
        point(-halfW, -halfD),
        point(0, -halfD),
        point(halfW, -halfD),
        point(halfW, halfD),
        point(0, halfD),
        point(-halfW, halfD),
      ];
    fronts[b] = ring[1]!;
    backs[b] = ring[4]!;
    for (let k = 0; k < 6; k++) join(ring[k]!, ring[(k + 1) % 6]!);
    reach = Math.max(reach, Math.hypot(bx, bz) + BLOCK_REACH);
  }
  // Blocks laid slightly apart: their corners one crossing. And the square, and the ways out.
  const CELL = CROSSING,
    near = new Map<number, number[]>(),
    keyOf = (x: number, z: number) =>
      Math.floor(x / CELL + 4096) * 16384 + Math.floor(z / CELL + 4096);
  for (let n = 1; n < build.x.length; n++) {
    const k = keyOf(build.x[n]!, build.z[n]!),
      list = near.get(k);
    if (list) list.push(n);
    else near.set(k, [n]);
  }
  const around = (x: number, z: number, r: number, visit: (n: number, d: number) => void) => {
    const span = Math.ceil(r / CELL);
    for (let di = -span; di <= span; di++)
      for (let dj = -span; dj <= span; dj++) {
        for (const n of near.get(keyOf(x + di * CELL, z + dj * CELL)) ?? []) {
          const d = Math.hypot(build.x[n]! - x, build.z[n]! - z);
          if (d <= r) visit(n, d);
        }
      }
  };
  const blockNodes = build.x.length;
  for (let n = 1; n < blockNodes; n++)
    around(build.x[n]!, build.z[n]!, CROSSING, (q) => {
      if (q > n) join(n, q);
    });
  // (The square, from its nearest corners: that's its corners worn.)
  const toSquare: { n: number; d: number }[] = [];
  around(0, 0, SQUARE + 46, (n, d) => toSquare.push({ n, d }));
  toSquare
    .sort((p, q) => p.d - q.d || p.n - q.n)
    .slice(0, 10)
    .forEach((p) => join(0, p.n));
  const outs: number[] = [],
    water = plan.water;
  for (let k = 0; k < FIELD_WAYS; k++) {
    const a = plan.axis + (k * 2 * Math.PI) / FIELD_WAYS,
      x = Math.cos(a) * (reach + OUT_PAST),
      z = -Math.sin(a) * (reach + OUT_PAST);
    if (water && Math.hypot(x - water.x, z - water.z) < water.r + 12) continue;
    const seen: { n: number; d: number }[] = [];
    around(x, z, OUT_PAST + 60, (n, d) => seen.push({ n, d }));
    if (!seen.length) continue;
    const n = build.x.length;
    build.x.push(x);
    build.z.push(z);
    seen
      .sort((p, q) => p.d - q.d || p.n - q.n)
      .slice(0, 2)
      .forEach((p) => join(n, p.n));
    outs.push(n);
  }
  // The ways, each from each end.
  const nodes = build.x.length,
    ways = build.a.length,
    count = new Int32Array(nodes + 1);
  for (let e = 0; e < ways; e++) {
    count[build.a[e]! + 1]!++;
    count[build.b[e]! + 1]!++;
  }
  for (let n = 0; n < nodes; n++) count[n + 1]! += count[n]!;
  const first = count.slice(),
    to = new Int32Array(ways * 2),
    way = new Int32Array(ways * 2),
    fill = first.slice(),
    long = new Float32Array(ways);
  for (let e = 0; e < ways; e++) {
    const p = build.a[e]!,
      q = build.b[e]!;
    long[e] = Math.hypot(build.x[p]! - build.x[q]!, build.z[p]! - build.z[q]!);
    to[fill[p]!] = q;
    way[fill[p]!++] = e;
    to[fill[q]!] = p;
    way[fill[q]!++] = e;
  }
  // Each door's goings, at the way in its street: its age counted; a home fallen goes on showing, less each year.
  const here = new Float32Array(nodes),
    gone = new Float32Array(nodes);
  let homes = 0,
    wellShare = 0,
    wellHomes = 0;
  const ash = plan.ash ?? 0;
  for (let p = 0; p < plan.lots; p++) {
    if (p < ash) continue;
    const what = states.what[p],
      b = Math.floor(p / BLOCK_LOTS),
      door = p % BLOCK_LOTS < 4 ? fronts[b]! : backs[b]!;
    if (door < 0) continue;
    const when = states.began[p]! / YEAR;
    if (what === LOT.home) {
      if (when > year) continue;
      const age = 1 - Math.exp(-(year - when + 1) / WEAR_IN);
      here[door]! += age;
      homes++;
      // (Those high up have water brought to them: a well's for those who walk to it.)
      wellHomes += states.level[p]! >= 4 ? 0 : 1;
      wellShare += states.level[p]! >= 4 ? 0.1 : 1;
    } else if (what === LOT.fallen || what === LOT.razed) {
      gone[door]! += 0.35 * Math.exp(-Math.max(0, year - when) / GREEN_OVER);
    }
  }
  void wellHomes;
  const wear = new Float32Array(ways),
    greening = new Float32Array(ways),
    dist = new Float32Array(nodes),
    parent = new Int32Array(nodes),
    side = new Int32Array(nodes),
    order = new Int32Array(nodes),
    flow = new Float32Array(nodes),
    flowGone = new Float32Array(nodes),
    /** Every door to its nearest of these, each carrying what comes through it. */
    send = (goals: readonly number[], share: number) => {
      if (!goals.length || share <= 0) return;
      dist.fill(Infinity);
      parent.fill(-1);
      side.fill(-1);
      const open = new MinHeap();
      for (const g of goals) {
        dist[g] = 0;
        open.push(0, g);
      }
      let m = 0;
      const done = new Uint8Array(nodes);
      while (open.size) {
        const n = open.pop();
        if (done[n]) continue;
        done[n] = 1;
        order[m++] = n;
        for (let s = first[n]!; s < first[n + 1]!; s++) {
          const q = to[s]!,
            d = dist[n]! + long[way[s]!]!;
          if (d < dist[q]!) {
            dist[q] = d;
            parent[q] = n;
            side[q] = way[s]!;
            open.push(d, q);
          }
        }
      }
      flow.set(here);
      flowGone.set(gone);
      for (let k = m - 1; k >= 0; k--) {
        const n = order[k]!,
          up = parent[n]!;
        if (up < 0) continue;
        wear[side[n]!]! += flow[n]! * share;
        greening[side[n]!]! += flowGone[n]! * share;
        flow[up]! += flow[n]!;
        flowGone[up]! += flowGone[n]!;
      }
    };
  // The well and the square, for all; the fields, where they farm; the road out.
  send([0], homes ? 0.4 + wellShare / homes : 1);
  send(outs, plan.paved ? 0.12 : 0.7);
  if (outs.length) send([outs[0]!, outs[Math.floor(outs.length / 2)]!], 0.15);
  // Each kind of building, each door to its nearest.
  const kinds = new Map<string, number[]>();
  for (const c of plan.civics) {
    if (c.fell !== null || c.start > year) continue;
    const b = Math.floor(c.at / BLOCK_LOTS),
      n = fronts[b] ?? -1;
    if (n < 0) continue;
    const list = kinds.get(c.kind);
    if (list) list.push(n);
    else kinds.set(c.kind, [n]);
  }
  for (const [kind, goals] of [...kinds].sort((p, q) => (p[0] < q[0] ? -1 : 1)))
    send(goals, GOES[kind] ?? GOES_ELSE);
  // How worn, against the town it is: a hamlet's one path can wear as deep as a city's high street, and in a small town only its main ways show.
  const all = Math.max(12, homes),
    small = Math.max(0, Math.min(1, (2000 - homes) / 1800)),
    pieces: WornPiece[] = [],
    bar = (k: number) => BANDS[k]! * (1 + 2.2 * small * (1 - k / BANDS.length));
  let worn = 0;
  for (let e = 0; e < ways; e++) {
    const w = wear[e]!,
      g = greening[e]!,
      share = (w + g) / all;
    if (share < bar(0)) continue;
    worn++;
    let band = 0;
    for (let k = 1; k < BANDS.length; k++) if (share >= bar(k)) band = k;
    const p = build.a[e]!,
      q = build.b[e]!,
      dx = build.x[q]! - build.x[p]!,
      dz = build.z[q]! - build.z[p]!;
    pieces.push({
      x: (build.x[p]! + build.x[q]!) / 2,
      z: (build.z[p]! + build.z[q]!) / 2,
      len: long[e]! + 1,
      yaw: Math.atan2(dx, dz),
      band,
      green: g / (w + g || 1),
      wear: w + g,
    });
  }
  pieces.sort((p, q) => q.wear - p.wear || p.x - q.x || p.z - q.z);
  return { pieces: pieces.slice(0, most), ways, worn, homes };
}

