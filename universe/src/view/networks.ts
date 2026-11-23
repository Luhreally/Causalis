// A town's water, drains and power drawn as the networks they are (2026-11-22, the audit's "infrastructure as networks"; its page
// is host/inspect/networks.ts): what its plan says its land has (bridge/town.ts TownPlan.nets: water led under its streets and
// drains beside it where its land knows sanitation; wires where its land's power goes by wire, on poles or, in the modern age,
// under the street), laid along the streets about its blocks — the street each block keeps on its own sides, where nothing else
// stands: a cover over the main in the carriageway of one side, a grate at the kerb of two, a hydrant at a corner, a pole on the
// verge of a third side (or a box where the wire is buried), and the wire from each pole to the nearest strung before it, a
// line through the town grown from its power house, never a web. Each thing is fixed to its block, its size and colour the
// world's; the renderer fades each by how far it stands from the eye, by a rank of its own (render/townnets.ts), so a run comes
// and goes by degrees and nothing moves with the eye. Pure: built once with the scene.
import {
  BLOCK_D,
  BLOCK_LOTS,
  BLOCK_W,
  LOT_W,
  NET_BLOCKS,
  holdPlaces,
  laidAt,
  onHeld,
  streetWide,
} from "../bridge/index.ts";
import { HELD_PAD, type TownParts, type TownScene } from "./town.ts";

type Rgb = readonly [number, number, number];

/** Its poles' height (metres) and how far the wire may run from one to the next. */
export const POLE_HIGH = 8;
const WIRE_MOST = 70;

export const NET_TONES = {
  cover: [0.2, 0.2, 0.22] as Rgb,
  grate: [0.12, 0.12, 0.13] as Rgb,
  hydrant: [0.72, 0.16, 0.12] as Rgb,
  pole: [0.36, 0.28, 0.2] as Rgb,
  arm: [0.3, 0.24, 0.18] as Rgb,
  wire: [0.08, 0.08, 0.09] as Rgb,
  box: [0.36, 0.42, 0.36] as Rgb,
} as const;

/** One thing laid: its middle and size (metres), its turn, its colour, and its rank (0 … 1) for the fade. */
export type NetPart = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly yaw: number;
  readonly color: Rgb;
  readonly rank: number;
};
/** What a town's networks lay: boxes and rounds (two batches), and how many of each kind, for its page and the checks. */
export type TownNets = {
  readonly boxes: NetPart[];
  readonly rounds: NetPart[];
  readonly counts: {
    blocks: number;
    covers: number;
    grates: number;
    hydrants: number;
    poles: number;
    wires: number;
    boxes: number;
  };
};

/** A whole number's share in [0, 1), for a block's rank (the plan's own, not history's). */
function rankOf(seed: number, b: number): number {
  let h = (seed ^ Math.imul(b + 1, 0x9e3779b1) ^ 0x51ed27) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A point of a block's ground: `u` along its breadth, `v` across it (metres from its middle), turned with it. */
function at(x: number, z: number, yaw: number, u: number, v: number): [number, number] {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return [x + u * c + v * s, z - u * s + v * c];
}

/** Ground held by something else of the town's networks already, a cell of SPACING a side (one thing a cell). */
const SPACING = 2.5;
/** How far out from a block's edge what stands of its networks stands (metres): inside the strip no walker or car comes into. */
/** How far a corner piece's near sides stand off its block (metres): clear of its walls and fences by more than KEEP_OFF. */
const EDGE = 0.1;
/** Where along its block's long side a corner piece stands (metres from its middle): where its corner lot meets the next. */
export const PIECE_U = BLOCK_W / 2 - LOT_W;
/** A power box's breadth, height and depth (metres): small enough at its corner to keep within a walker's reach of the block. */
const BOX = [0.44, 0.9, 0.34] as const;
/** What stands thinner than this is ground to stand on (a street, a yard, a verge); thicker stands in the way (metres). */
const SLAB = 0.3;
/** What is laid this thin over the ground is a way people go or a mark on a road: nothing of the networks stands on it. */
const TRODDEN = 0.04;
/** How far about what stands in the way a piece keeps off it (metres). */
const KEEP_OFF = 0.08;

/**
 * What else holds a town's streets, for its networks to keep off (the one reading of the ground every layer of the town view
 * lays from): the parts the view lays (its ground with its streets, verges, worn ways, trees, signals and form; its civics and
 * walls), and places held by what the village lays apart (its memorials, its court, its works, the doors cars stand at), as discs.
 */
export type NetsClear = {
  readonly parts: readonly TownParts[];
  readonly keep: readonly { readonly x: number; readonly z: number; readonly r: number }[];
};

type Quad = readonly number[];
type Held = { readonly q: Quad; readonly y0: number; readonly y1: number; readonly thin: boolean };

/** A box's footprint: its four corners (x, z, x, z …), its middle `x, z`, its size `w` × `d`, turned by `yaw` (as at()). */
function quadOf(x: number, z: number, w: number, d: number, yaw: number): Quad {
  const out: number[] = [];
  for (const [a, b] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    const [px, pz] = at(x, z, yaw, (a * w) / 2, (b * d) / 2);
    out.push(px, pz);
  }
  return out;
}

/** Whether two footprints cross by more than `pad` (separating axes). */
function crosses(a: Quad, b: Quad, pad: number): boolean {
  for (const q of [a, b])
    for (let i = 0; i < 4; i++) {
      const x0 = q[2 * i]!,
        z0 = q[2 * i + 1]!,
        x1 = q[(2 * i + 2) % 8]!,
        z1 = q[(2 * i + 3) % 8]!,
        nx = z1 - z0,
        nz = x0 - x1,
        l = Math.hypot(nx, nz);
      if (l < 1e-9) continue;
      let a0 = Infinity,
        a1 = -Infinity,
        b0 = Infinity,
        b1 = -Infinity;
      for (let k = 0; k < 4; k++) {
        const da = (a[2 * k]! * nx + a[2 * k + 1]! * nz) / l,
          db = (b[2 * k]! * nx + b[2 * k + 1]! * nz) / l;
        a0 = Math.min(a0, da);
        a1 = Math.max(a1, da);
        b0 = Math.min(b0, db);
        b1 = Math.max(b1, db);
      }
      if (Math.min(a1, b1) - Math.max(a0, b0) <= -pad) return false;
    }
  return true;
}

/** The parts a town's view lays about some ground, found by cell: what each piece of its networks stands on, and keeps off. */
class StreetReading {
  /** Parts by the cell their middle is in (BUCKET a side): the data they are in and where, read whole only when asked near. */
  private readonly buckets = new Map<number, { data: ArrayLike<number>[]; at: number[] }>();
  /** Parts wider than a cell: few (a whole block's street, a field), each looked at for every ask. */
  private readonly wide: { data: ArrayLike<number>; at: number }[] = [];
  private readonly read = new Map<ArrayLike<number>, Map<number, Held>>();
  private readonly kept = new Map<number, NetsClear["keep"][number][]>();
  private static readonly CELL = 6;
  private static readonly BUCKET = 48;
  constructor(clear: NetsClear, box: { x0: number; x1: number; z0: number; z1: number }) {
    const C = StreetReading.CELL,
      B = StreetReading.BUCKET;
    for (const k of clear.keep) {
      if (k.x + k.r < box.x0 || k.x - k.r > box.x1 || k.z + k.r < box.z0 || k.z - k.r > box.z1)
        continue;
      for (let a = Math.floor((k.x - k.r) / C); a <= Math.floor((k.x + k.r) / C); a++)
        for (let b = Math.floor((k.z - k.r) / C); b <= Math.floor((k.z + k.r) / C); b++) {
          const key = a * 65536 + b;
          let l = this.kept.get(key);
          if (!l) this.kept.set(key, (l = []));
          l.push(k);
        }
    }
    // (One pass over what is laid, its middles only; each part's footprint worked out the first time something is asked near it.)
    for (const parts of clear.parts)
      for (const g of parts.groups.values()) {
        if (g.lamp) continue;
        const d = g.data;
        for (let i = 0; i + 6 < d.length; i += 7) {
          const x = d[i]!,
            z = d[i + 2]!,
            r = 0.5 * (Math.abs(d[i + 3]!) + Math.abs(d[i + 5]!));
          if (x + r < box.x0 || x - r > box.x1 || z + r < box.z0 || z - r > box.z1) continue;
          if (r > B) {
            this.wide.push({ data: d, at: i });
            continue;
          }
          const key = Math.floor(x / B) * 65536 + Math.floor(z / B);
          let l = this.buckets.get(key);
          if (!l) this.buckets.set(key, (l = { data: [], at: [] }));
          l.data.push(d);
          l.at.push(i);
        }
      }
  }
  private held(d: ArrayLike<number>, i: number): Held {
    let m = this.read.get(d);
    if (!m) this.read.set(d, (m = new Map()));
    let h = m.get(i);
    if (!h) {
      const sy = d[i + 4]!;
      h = {
        q: quadOf(d[i]!, d[i + 2]!, d[i + 3]!, d[i + 5]!, d[i + 6]!),
        y0: d[i + 1]! - sy / 2,
        y1: d[i + 1]! + sy / 2,
        thin: sy <= TRODDEN,
      };
      m.set(i, h);
    }
    return h;
  }
  /** What is laid within reach of a footprint: those whose bounds come within it. */
  private near(q: Quad): Held[] {
    const B = StreetReading.BUCKET;
    let x0 = Infinity,
      x1 = -Infinity,
      z0 = Infinity,
      z1 = -Infinity;
    for (let k = 0; k < 4; k++) {
      x0 = Math.min(x0, q[2 * k]!);
      x1 = Math.max(x1, q[2 * k]!);
      z0 = Math.min(z0, q[2 * k + 1]!);
      z1 = Math.max(z1, q[2 * k + 1]!);
    }
    const out: Held[] = [],
      look = (d: ArrayLike<number>, i: number) => {
        const r = 0.5 * (Math.abs(d[i + 3]!) + Math.abs(d[i + 5]!)) + KEEP_OFF,
          x = d[i]!,
          z = d[i + 2]!;
        if (x + r < x0 || x - r > x1 || z + r < z0 || z - r > z1) return;
        out.push(this.held(d, i));
      };
    for (let a = Math.floor((x0 - B) / B); a <= Math.floor((x1 + B) / B); a++)
      for (let b = Math.floor((z0 - B) / B); b <= Math.floor((z1 + B) / B); b++) {
        const l = this.buckets.get(a * 65536 + b);
        if (l) for (let k = 0; k < l.at.length; k++) look(l.data[k]!, l.at[k]!);
      }
    for (const w of this.wide) look(w.data, w.at);
    return out;
  }
  /**
   * Where a piece of this footprint may stand, `high` metres tall (a wire: from `lift` up), and the top of the ground under it
   * (null: something stands there, it is on a way people go and it stands up, or it is in a place held).
   */
  standAt(q: Quad, high: number, lift = -1): number | null {
    let cx = 0,
      cz = 0;
    for (let k = 0; k < 4; k++) {
      cx += q[2 * k]! / 4;
      cz += q[2 * k + 1]! / 4;
    }
    const reach = Math.hypot(q[0]! - cx, q[1]! - cz),
      C = StreetReading.CELL;
    for (let a = Math.floor((cx - reach) / C); a <= Math.floor((cx + reach) / C); a++)
      for (let b = Math.floor((cz - reach) / C); b <= Math.floor((cz + reach) / C); b++)
        for (const k of this.kept.get(a * 65536 + b) ?? [])
          if (Math.hypot(k.x - cx, k.z - cz) < k.r + reach) return null;
    const near = this.near(q).filter((h) => crosses(h.q, q, 0.005));
    let top = 0.3;
    for (const h of near) if (h.y1 - h.y0 <= SLAB && h.y1 <= 0.7 && h.y1 > top) top = h.y1;
    const y0 = lift >= 0 ? lift : top,
      y1 = y0 + high;
    for (const h of near) {
      const ground = h.y1 - h.y0 <= SLAB && h.y1 <= top + 0.001;
      // (A way trodden or a road's mark: what stands keeps off it, what lies flush may lie on it.)
      if (h.thin && high > 0.1 && lift < 0) return null;
      if (ground) continue;
      if (Math.min(h.y1, y1) - Math.max(h.y0, y0) > 0.005 && crosses(h.q, q, KEEP_OFF)) return null;
    }
    return top;
  }
}

/**
 * A town's networks, laid about its blocks nearest `focus` (metres from its square), at most NET_BLOCKS of them. None where its
 * plan has none, or its people live in the water (their water is about them; nothing is led or drained).
 */
export function townNets(
  scene: TownScene,
  focus: { x: number; z: number } = { x: 0, z: 0 },
  clear: NetsClear = { parts: [], keep: [] },
): TownNets {
  const { plan, lots } = scene,
    out: TownNets = {
      boxes: [],
      rounds: [],
      counts: { blocks: 0, covers: 0, grates: 0, hydrants: 0, poles: 0, wires: 0, boxes: 0 },
    },
    nets = plan.nets;
  if (!nets || plan.ways === "swim" || plan.sealed || (!nets.mains && !nets.drains && !nets.power))
    return out;
  const all = Math.ceil(plan.lots / BLOCK_LOTS),
    ash = plan.ash ?? 0,
    held = holdPlaces(plan, lots),
    order: number[] = [];
  for (let b = 0; b < all; b++) {
    if (b * BLOCK_LOTS < ash) continue;
    if (!(lots.blocks.x[b]! === lots.blocks.x[b]!)) continue;
    // (A block of open ground keeps no street: those about walk across it, view/streets.ts.)
    if (!scene.held[b]) continue;
    if (held.length && onHeld(held, lots.blocks.x[b]!, lots.blocks.z[b]!, HELD_PAD)) continue;
    order.push(b);
  }
  const d2 = (b: number) => (lots.blocks.x[b]! - focus.x) ** 2 + (lots.blocks.z[b]! - focus.z) ** 2;
  order.sort((a, b) => d2(a) - d2(b) || a - b);
  if (order.length > NET_BLOCKS) order.length = NET_BLOCKS;
  // (Its wire grows from its power house: the block it stands on first.)
  if (nets.power === "lines") {
    const house = plan.civics.find(
      (c) => (c.kind === "power" || c.kind === "fusion") && c.fell === null,
    );
    if (house) {
      const hb = Math.floor(house.at / BLOCK_LOTS),
        k = order.indexOf(hb);
      if (k > 0) order.unshift(...order.splice(k, 1));
    }
  }
  // (What else holds the ground about the blocks laid on, read once: every piece stands only where nothing else does.)
  let bx0 = Infinity,
    bx1 = -Infinity,
    bz0 = Infinity,
    bz1 = -Infinity;
  for (const b of order) {
    bx0 = Math.min(bx0, lots.blocks.x[b]!);
    bx1 = Math.max(bx1, lots.blocks.x[b]!);
    bz0 = Math.min(bz0, lots.blocks.z[b]!);
    bz1 = Math.max(bz1, lots.blocks.z[b]!);
  }
  const pad = BLOCK_W,
    ground = new StreetReading(clear, {
      x0: bx0 - pad,
      x1: bx1 + pad,
      z0: bz0 - pad,
      z1: bz1 + pad,
    });
  // (One thing a cell of ground: a block turned against its neighbour may bring two of theirs together.)
  const taken = new Set<number>(),
    free = (x: number, z: number): boolean => {
      const k = Math.round(x / SPACING) * 65536 + Math.round(z / SPACING);
      if (taken.has(k)) return false;
      taken.add(k);
      return true;
    };
  // (The signals' poles are where they are: at each of its first blocks' far corners. view/town.ts townSignals.)
  const tops: [number, number, number, number][] = [];
  for (const b of order) {
    const x = lots.blocks.x[b]!,
      z = lots.blocks.z[b]!,
      yaw = lots.blocks.yaw[b]!,
      wide = streetWide(plan.site, b),
      verge = laidAt(plan.site, b)?.verge ?? 0,
      half = wide / 2,
      // (Its carriageway's middle, its kerb, its verge: out from the block's edge.)
      road = verge + 0.62 * (half - verge),
      kerb = verge + 0.14 * (half - verge),
      side = verge > 0 ? verge * 0.5 : 0.3 * half,
      // (Its rank under the most the fade draws whole within its core, so every one near the eye stands whole.)
      rank = 0.8 * rankOf(plan.seed, b),
      top = 0.44;
    out.counts.blocks++;
    // (Each piece: where it may stand of a few places about its block, the first where nothing else is.)
    const place = (
      spots: readonly (readonly [number, number])[],
      w: number,
      d: number,
      high: number,
    ): { x: number; z: number; top: number } | null => {
      for (const [u, v] of spots) {
        const [px, pz] = at(x, z, yaw, u, v),
          top = ground.standAt(quadOf(px, pz, w, d, yaw), high);
        if (top !== null && free(px, pz)) return { x: px, z: pz, top };
      }
      return null;
    };
    // (Toward its corners on its long sides, where its corner lots meet the next (pieceSpots), a piece's near side just out of its
    // edge: as far from any door as a lot is wide, so no one going in or out passes it; kept off by a block's breadth and their
    // own reach from where people stand (view/village.ts PERSON_REACH); wide of where a car turns the corner, and where none is
    // left (view/rides.ts).)
    const corners = (first: number, d: number): (readonly [number, number])[] =>
      [0, 1, 2, 3].map((k) => {
        const c = (first + k) % 4,
          V = BLOCK_D / 2 + EDGE + d / 2;
        return [c === 0 || c === 3 ? -PIECE_U : PIECE_U, c < 2 ? -V : V] as const;
      });
    if (nets.mains) {
      const cover = place(
        [
          [BLOCK_W / 2 + road, BLOCK_D / 4],
          [BLOCK_W / 2 + road, -BLOCK_D / 4],
        ],
        0.9,
        0.9,
        0.01,
      );
      if (cover) {
        // (Flush with the street it lies in: walked and driven over as the street is.)
        out.rounds.push({
          x: cover.x,
          y: cover.top + 0.005,
          z: cover.z,
          sx: 0.9,
          sy: 0.02,
          sz: 0.9,
          yaw,
          color: NET_TONES.cover,
          rank,
        });
        out.counts.covers++;
      }
      // (A hydrant at a corner, where water is led under pressure to its streets.)
      const h = place(corners(0, 0.32), 0.32, 0.32, 0.8);
      if (h) {
        out.rounds.push({
          x: h.x,
          y: h.top + 0.4,
          z: h.z,
          sx: 0.32,
          sy: 0.8,
          sz: 0.32,
          yaw,
          color: NET_TONES.hydrant,
          rank,
        });
        out.counts.hydrants++;
      }
    }
    if (nets.drains)
      for (const s of [-1, 1] as const) {
        const g = place(
          [
            [s * (BLOCK_W / 2 + kerb), -s * (BLOCK_D / 4)],
            [s * (BLOCK_W / 2 + kerb), s * (BLOCK_D / 4)],
          ],
          0.5,
          0.9,
          0.01,
        );
        if (!g) continue;
        out.boxes.push({
          x: g.x,
          y: g.top + 0.005,
          z: g.z,
          sx: 0.5,
          sy: 0.02,
          sz: 0.9,
          yaw,
          color: NET_TONES.grate,
          rank,
        });
        out.counts.grates++;
      }
    if (nets.power) {
      const buried = nets.power === "buried",
        p = buried
          ? place(corners(1, BOX[2]), BOX[0], BOX[2], BOX[1])
          : place(corners(1, 0.26), 0.26, 0.26, POLE_HIGH);
      if (!p) continue;
      if (buried) {
        out.boxes.push({
          x: p.x,
          y: p.top + BOX[1] / 2,
          z: p.z,
          sx: BOX[0],
          sy: BOX[1],
          sz: BOX[2],
          yaw,
          color: NET_TONES.box,
          rank,
        });
        out.counts.boxes++;
      } else {
        out.boxes.push({
          x: p.x,
          y: p.top + POLE_HIGH / 2,
          z: p.z,
          sx: 0.26,
          sy: POLE_HIGH,
          sz: 0.26,
          yaw,
          color: NET_TONES.pole,
          rank,
        });
        // (Its arm across the street side, out over the strip its pole stands in.)
        out.boxes.push({
          x: p.x,
          y: p.top + POLE_HIGH - 0.4,
          z: p.z,
          sx: 0.12,
          sy: 0.12,
          sz: 0.6,
          yaw,
          color: NET_TONES.arm,
          rank,
        });
        tops.push([p.x, p.z, rank, p.top]);
        out.counts.poles++;
      }
    }
  }
  // (The wire from each pole to the nearest strung before it: a line through the town that branches, never a web.)
  // (Strung only where its way is clear at its height: over the street, never through what stands; else to the next nearest.)
  for (let i = 1; i < tops.length; i++) {
    const [x1, z1, rank, top1] = tops[i]!,
      near = tops
        .slice(0, i)
        .map((q, m) => [(q[0] - x1) ** 2 + (q[1] - z1) ** 2, m] as const)
        .filter(([dd]) => dd >= 1 && dd <= WIRE_MOST * WIRE_MOST)
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
        .slice(0, 4);
    let j = -1,
      best = 0;
    for (const [dd, m] of near) {
      const [x0, z0, , top0] = tops[m]!,
        lift = Math.min(top0, top1) + POLE_HIGH - 0.6;
      if (
        ground.standAt(
          quadOf((x0 + x1) / 2, (z0 + z1) / 2, 0.05, Math.sqrt(dd), Math.atan2(x1 - x0, z1 - z0)),
          0.2,
          lift,
        ) === null
      )
        continue;
      j = m;
      best = dd;
      break;
    }
    if (j < 0) continue;
    const [x0, z0, rank0, top0] = tops[j]!,
      len = Math.sqrt(best);
    // (A wire fades with the nearer of its two poles: never strung on from a pole gone.)
    out.boxes.push({
      x: (x0 + x1) / 2,
      y: Math.min(top0, top1) + POLE_HIGH - 0.5,
      z: (z0 + z1) / 2,
      sx: 0.05,
      sy: 0.05,
      sz: len,
      yaw: Math.atan2(x1 - x0, z1 - z0),
      color: NET_TONES.wire,
      rank: Math.max(rank, rank0),
    });
    out.counts.wires++;
  }
  return out;
}
