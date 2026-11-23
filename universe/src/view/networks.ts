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
  NET_BLOCKS,
  holdPlaces,
  laidAt,
  onHeld,
  streetWide,
} from "../bridge/index.ts";
import { HELD_PAD, type TownScene } from "./town.ts";
import { RING_TREE, heightOf, ringStreet, templeGround } from "./townform.ts";
import { HELD_DRAWN, blockGround, lineOver } from "./streetline.ts";

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

/** How far the networks keep off ground the town keeps for something else, past its edge (metres). */
const KEEP_OFF = 1.5;
/** How far out the height a town holds is drawn (view/townform.ts: its mound 34 m across). */
const HEIGHT_R = 17;

/** Ground held by something else of the town's networks already, a cell of SPACING a side (one thing a cell). */
const SPACING = 2.5;

/**
 * A town's networks, laid about its blocks nearest `focus` (metres from its square), at most NET_BLOCKS of them. None where its
 * plan has none, or its people live in the water (their water is about them; nothing is led or drained).
 */
export function townNets(
  scene: TownScene,
  focus: { x: number; z: number } = { x: 0, z: 0 },
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
  // (One thing a cell of ground: a block turned against its neighbour may bring two of theirs together. None on ground the
  // town keeps for something else, though its block is clear of it: a stronghold's or seat's, its market place, its temple's steps.)
  const taken = new Set<number>(),
    place = lots.blocks.place,
    // (Its market place's ground, set 1.5 m about it; its temple's steps: view/townform.ts.)
    temple = templeGround(scene),
    kept = [
      ...(place ? [{ ...place, w: place.w + 3, d: place.d + 3 }] : []),
      ...(temple ? [temple] : []),
    ],
    // (Round things standing on its ground past its blocks: the height it holds, its mound 34 m across; the ring street's trees.)
    height = heightOf(scene),
    rounds = [
      ...(height ? [{ x: height.x, z: height.z, r: HEIGHT_R }] : []),
      ...ringStreet(scene).flatMap((l) =>
        l.tree ? [{ x: l.tree[0], z: l.tree[1], r: RING_TREE / 2 }] : [],
      ),
    ],
    free = (x: number, z: number): boolean => {
      for (const p of rounds) if (Math.hypot(p.x - x, p.z - z) < p.r + KEEP_OFF) return false;
      // (A stronghold's ground is drawn raised a little past its round: view/strongholds.ts.)
      for (const p of held)
        if (Math.hypot(p.x - x, p.z - z) < p.r * HELD_DRAWN + KEEP_OFF) return false;
      for (const k of kept) {
        const c = Math.cos(k.yaw),
          s = Math.sin(k.yaw),
          dx = x - k.x,
          dz = z - k.z;
        if (
          Math.abs(dx * c - dz * s) < k.w / 2 + KEEP_OFF &&
          Math.abs(dx * s + dz * c) < k.d / 2 + KEEP_OFF
        )
          return false;
      }
      const k = Math.round(x / SPACING) * 65536 + Math.round(z / SPACING);
      if (taken.has(k)) return false;
      taken.add(k);
      return true;
    };
  // (The signals' poles are where they are: at each of its first blocks' far corners. view/town.ts townSignals.)
  const tops: [number, number, number][] = [],
    turns: [number, number, number, number][] = [],
    pole = (px: number, pz: number, yaw: number, rank: number): void => {
      out.boxes.push({
        x: px,
        y: 0.3 + POLE_HIGH / 2,
        z: pz,
        sx: 0.26,
        sy: POLE_HIGH,
        sz: 0.26,
        yaw,
        color: NET_TONES.pole,
        rank,
      });
      out.boxes.push({
        x: px,
        y: 0.3 + POLE_HIGH - 0.4,
        z: pz,
        sx: 1.8,
        sy: 0.12,
        sz: 0.12,
        yaw,
        color: NET_TONES.arm,
        rank,
      });
      tops.push([px, pz, rank]);
      out.counts.poles++;
    };
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
    if (nets.mains) {
      // (Down the middle of its end street, between its two rows: a crane over a tall home rising at the row's end stands
      // out beside it, view/town.ts.)
      const [cx, cz] = at(x, z, yaw, BLOCK_W / 2 + road, 0);
      if (free(cx, cz)) {
        out.rounds.push({
          x: cx,
          y: top,
          z: cz,
          sx: 0.9,
          sy: 0.05,
          sz: 0.9,
          yaw,
          color: NET_TONES.cover,
          rank,
        });
        out.counts.covers++;
      }
      // (A hydrant at its near corner, where water is led under pressure to its streets.)
      const [hx, hz] = at(x, z, yaw, -(BLOCK_W / 2 + side), -(BLOCK_D / 2 + side));
      if (free(hx, hz)) {
        out.rounds.push({
          x: hx,
          y: 0.3 + 0.4,
          z: hz,
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
        const [gx, gz] = at(x, z, yaw, s * (BLOCK_W / 2 + kerb), -s * (BLOCK_D / 4));
        if (!free(gx, gz)) continue;
        out.boxes.push({
          x: gx,
          y: top,
          z: gz,
          sx: 0.5,
          sy: 0.05,
          sz: 0.9,
          yaw,
          color: NET_TONES.grate,
          rank,
        });
        out.counts.grates++;
      }
    if (nets.power) {
      const [px, pz] = at(x, z, yaw, BLOCK_W / 8, -(BLOCK_D / 2 + side));
      if (!free(px, pz)) continue;
      if (nets.power === "buried") {
        out.boxes.push({
          x: px,
          y: 0.3 + 0.5,
          z: pz,
          sx: 1.1,
          sy: 1,
          sz: 0.7,
          yaw,
          color: NET_TONES.box,
          rank,
        });
        out.counts.boxes++;
      } else {
        pole(px, pz, yaw, rank);
        // (Two of its corners, for a wire to turn at where no pole can be reached straight: not the near one, its
        // hydrant's, nor the far one, the signals'.)
        for (const [u, v] of [
          [1, -1],
          [-1, 1],
        ] as const) {
          const [cx, cz] = at(x, z, yaw, u * (BLOCK_W / 2 + side), v * (BLOCK_D / 2 + side));
          turns.push([cx, cz, yaw, rank]);
        }
      }
    }
  }
  // (The wire from each pole to the nearest strung before it that it can reach down the streets, over no block's ground, no
  // stronghold's, no temple's steps: a line through the town that branches, never a web, and never through a house.)
  const over =
      tops.length > 1
        ? lineOver([...kept, ...blockGround(lots, all, ash, held, HELD_PAD)], held, rounds)
        : null,
    strung: boolean[] = [],
    // (The nearest pole of those asked that a wire from pole i can reach; -1: none.)
    reach = (i: number, from: number, to: number): number => {
      const [x1, z1] = tops[i]!,
        near: [number, number][] = [];
      for (let m = from; m < to; m++) {
        if (m === i) continue;
        const dd = (tops[m]![0] - x1) ** 2 + (tops[m]![1] - z1) ** 2;
        if (dd >= 1 && dd <= WIRE_MOST ** 2) near.push([dd, m]);
      }
      near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      return near.find(([, m]) => !over!(tops[m]![0], tops[m]![1], x1, z1))?.[1] ?? -1;
    },
    wire = (i: number, j: number): void => {
      const [x1, z1, rank] = tops[i]!,
        [x0, z0, rank0] = tops[j]!;
      strung[i] = strung[j] = true;
      // (A wire fades with the nearer of its two poles: never strung on from a pole gone.)
      out.boxes.push({
        x: (x0 + x1) / 2,
        y: 0.3 + POLE_HIGH - 0.5,
        z: (z0 + z1) / 2,
        sx: 0.05,
        sy: 0.05,
        sz: Math.hypot(x1 - x0, z1 - z0),
        yaw: Math.atan2(x1 - x0, z1 - z0),
        color: NET_TONES.wire,
        rank: Math.max(rank, rank0),
      });
      out.counts.wires++;
    };
  for (let i = 1; i < tops.length; i++) {
    const j = reach(i, 0, i);
    if (j >= 0) wire(i, j);
  }
  // (A pole none strung before it can reach, where the town's blocks turn against each other, takes its wire from the
  // nearest it can reach after it: one wire to a pole with none never closes a ring.)
  const poles = tops.length;
  for (let i = 0; i < poles; i++) {
    if (strung[i]) continue;
    const j = reach(i, 0, poles);
    if (j >= 0) wire(i, j);
  }
  // (One still alone, where no pole stands in a straight line down the streets: its wire turns at a block's corner, a pole
  // set there, to the nearest it can reach from it.)
  for (let i = 0; i < poles; i++) {
    if (strung[i]) continue;
    const [x1, z1] = tops[i]!,
      corners = turns
        .map((c) => [(c[0] - x1) ** 2 + (c[1] - z1) ** 2, c] as const)
        .filter(([dd]) => dd >= 1 && dd <= WIRE_MOST ** 2)
        .sort((a, b) => a[0] - b[0]);
    for (const [, [cx, cz, yaw, rank]] of corners) {
      if (over!(x1, z1, cx, cz)) continue;
      tops.push([cx, cz, rank]);
      const j = reach(tops.length - 1, 0, poles);
      tops.pop();
      if (j < 0 || j === i || !free(cx, cz)) continue;
      pole(cx, cz, yaw, rank);
      wire(i, tops.length - 1);
      wire(tops.length - 1, j);
      break;
    }
  }
  return out;
}
