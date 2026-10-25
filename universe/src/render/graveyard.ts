// A town's graveyard seen (Phase 43 M205; asked for 2026-10-25: "...work on bringing back og
// causlisis like town/country game play and sim like the depth the og game had ... and just
// actions of stuff yk"): its low stone wall about it, its roofed gate toward the town, yews in its
// corners, its paths; row on row of graves — stones greying, sinking and leaning as the years go,
// a few fallen, wooden crosses among them that lean and rot away; a mound of bare earth and a
// new cross on each of this year's; the graves open today, their earth heaped beside them, and
// the dead on their biers — before their door, on their bearers' shoulders, set by the grave.
// Units as the village's: a tenth of a unit to the metre; sized as its folk are drawn.
import * as pc from "playcanvas";
import { PLOT, plotAt, plotsOf, sectionsOf, yardPoint, type Graveyard } from "../view/index.ts";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh, gableMesh, keptMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

const M = 0.1;
/** The wall about it (metres): how high, how thick; the gate's half width; the lych-gate's posts' height. */
const WALL_H = 1.8,
  WALL_T = 0.9,
  GATE_HALF = 2.4,
  LYCH_H = 4.2;
/** How far its track runs out toward the town from its gate (metres: to the town's edge, and a little into it). */
const TRACK = 30;
/** Its grass's top (metres): what lies on it stands on this. */
const GRASS_TOP = 0.23;
/** The most graves open at once, and biers borne at once, drawn. */
const MOST_OPEN = 12,
  MOST_BIERS = 12;
/** A stone's age (years) by which it is weathered, old, ancient; a wooden cross's by which it has rotted away; a mound's by which it has sunk level. */
const AGES = [8, 30, 80] as const,
  CROSS_ROTS = 25,
  MOUND_SINKS = 30;

const GRASS: Rgb = [0.33, 0.45, 0.26],
  SNOW: Rgb = [0.92, 0.93, 0.96],
  PATH: Rgb = [0.68, 0.64, 0.56],
  WALL: Rgb = [0.58, 0.56, 0.51],
  TIMBER: Rgb = [0.36, 0.25, 0.16],
  TILE: Rgb = [0.5, 0.32, 0.24],
  YEW: Rgb = [0.13, 0.27, 0.16],
  BARK: Rgb = [0.33, 0.22, 0.14],
  STONES: readonly Rgb[] = [
    [0.82, 0.81, 0.78],
    [0.68, 0.68, 0.64],
    [0.55, 0.57, 0.5],
    [0.44, 0.47, 0.4],
  ],
  NEW_WOOD: Rgb = [0.66, 0.53, 0.36],
  OLD_WOOD: Rgb = [0.47, 0.44, 0.4],
  EARTH: Rgb = [0.42, 0.3, 0.2],
  MOUND: Rgb = [0.38, 0.5, 0.29],
  PIT: Rgb = [0.16, 0.11, 0.08],
  BIER: Rgb = [0.45, 0.31, 0.19],
  SHROUD: Rgb = [0.93, 0.92, 0.88];

/** A grave's own draw (0 … 1): the same grave, the same stone. */
function draw(k: number, n: number): number {
  let x = Math.imul((k * 7 + n) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** How the burying stands now, as the village shows it: the open graves, the biers (borne: where their bearers are), the graves dug and filled. */
export type BurialShown = {
  readonly open: readonly {
    readonly x: number;
    readonly z: number;
    readonly way: number;
    readonly deep: number;
  }[];
  readonly biers: readonly {
    readonly x: number;
    readonly z: number;
    readonly face: number;
    readonly borne: boolean;
  }[];
  readonly graves: number;
  /** The first of this year's graves (those after it fresh). */
  readonly freshFrom: number;
  /** Its dead a year: how fast its graves age. */
  readonly perYear: number;
};

export class GraveyardLayer {
  /** Its own entity, kept as the village is laid out again. */
  readonly root = new pc.Entity("graveyard");
  private readonly stage: Stage;
  private readonly box: pc.Mesh;
  private readonly gable: pc.Mesh;
  private readonly cone: pc.Mesh;
  private readonly drum: pc.Mesh;
  private batches: InstancedBatch[] = [];
  private grass: InstancedBatch | null = null;
  private stones: InstancedBatch[] = [];
  private arches: InstancedBatch[] = [];
  private crosses: [InstancedBatch, InstancedBatch] | null = null;
  private mounds: [InstancedBatch, InstancedBatch] | null = null;
  private pits: InstancedBatch | null = null;
  private heaps: InstancedBatch | null = null;
  private planks: InstancedBatch | null = null;
  private shrouds: InstancedBatch | null = null;
  private poles: InstancedBatch | null = null;
  private legs: InstancedBatch | null = null;
  private snow = 0;
  /** The graves drawn (their count and the first fresh), so they are laid out again only as they change. */
  private gravesKey = "";
  /** The graveyard drawn (null: none). */
  yard: Graveyard | null = null;
  /** What was last drawn (the look tools). */
  shown = {
    stones: 0,
    fallen: 0,
    crosses: 0,
    fresh: 0,
    mounds: 0,
    open: 0,
    heaps: 0,
    biers: 0,
    borne: 0,
  };

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    parent.addChild(this.root);
    // (Held: its batches are made anew each time the village is laid out, and the last of them
    // ending would otherwise destroy them with itself.)
    this.box = keptMesh(boxMesh(stage));
    this.gable = keptMesh(gableMesh(stage));
    this.cone = keptMesh(coneMesh(stage, 0.5, 1, 10));
    this.drum = keptMesh(cylinderMesh(stage, 0.5, 1, 14));
  }

  /** The snow lying (0 … 1): its grass whitened as the ground about it is. */
  season(snow: number): void {
    this.snow = snow;
    this.grass?.recolor(this.grassNow());
  }

  private grassNow(): Rgb {
    const s = Math.min(1, Math.max(0, this.snow));
    return [
      GRASS[0] + (SNOW[0] - GRASS[0]) * s,
      GRASS[1] + (SNOW[1] - GRASS[1]) * s,
      GRASS[2] + (SNOW[2] - GRASS[2]) * s,
    ];
  }

  /** Lay out a town's graveyard (null: none): its ground, paths, wall, gate and yews; its graves as they come. */
  build(yard: Graveyard | null): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.grass =
      this.pits =
      this.heaps =
      this.planks =
      this.shrouds =
      this.poles =
      this.legs =
        null;
    this.stones = [];
    this.arches = [];
    this.crosses = this.mounds = null;
    this.gravesKey = "";
    this.yard = yard;
    this.shown = {
      stones: 0,
      fallen: 0,
      crosses: 0,
      fresh: 0,
      mounds: 0,
      open: 0,
      heaps: 0,
      biers: 0,
      borne: 0,
    };
    if (!yard) return;
    const make = (mesh: pc.Mesh, color: Rgb, n: number) => {
        const b = new InstancedBatch(this.stage, mesh, color, Math.max(1, n), this.root);
        this.batches.push(b);
        return b;
      },
      { w, d, way } = yard,
      // (Turned so a part's x runs along the rows, back from the gate; or across them.)
      vYaw = -way,
      uYaw = Math.atan2(-Math.cos(way), -Math.sin(way)),
      at = (u: number, v: number) => yardPoint(yard, u, v),
      /** A box laid along the rows: its middle at (u, v), so long back, so wide across, so high, from `y` up. */
      slab = (
        out: number[],
        u: number,
        v: number,
        long: number,
        wide: number,
        high: number,
        y: number,
      ) => {
        const p = at(u, v);
        out[0] = p.x * M;
        out[1] = (y + high / 2) * M;
        out[2] = p.z * M;
        out[3] = long * M;
        out[4] = high * M;
        out[5] = wide * M;
        out[6] = vYaw;
      };
    // Its grass, a little above the ground about it.
    this.grass = make(this.box, this.grassNow(), 1);
    this.grass.set(1, (_, out) => slab(out, 0, d / 2, d, w, 0.06, GRASS_TOP - 0.06));
    // Its paths: a track out to it from the town, in at the gate, along its front, up each
    // section's middle.
    const middles = sectionsOf(yard),
      paths = make(this.box, PATH, 3 + middles.length);
    paths.set(3 + middles.length, (i, out) => {
      if (i === 2 + middles.length) slab(out, 0, -TRACK / 2, TRACK, PLOT.path, 0.05, 0.1);
      else if (i === 0) slab(out, 0, PLOT.rim / 2, PLOT.rim, PLOT.path, 0.05, GRASS_TOP - 0.03);
      else if (i === 1)
        slab(out, 0, PLOT.rim + PLOT.path / 2, PLOT.path, w - 2 * PLOT.rim, 0.05, GRASS_TOP - 0.03);
      else {
        const from = PLOT.rim + PLOT.path,
          to = d - PLOT.rim;
        slab(out, middles[i - 2]!, (from + to) / 2, to - from, PLOT.path, 0.05, GRASS_TOP - 0.03);
      }
    });
    // Its wall: about it, open at its gate.
    const walls = make(this.box, WALL, 5),
      side = w / 2 - GATE_HALF;
    walls.set(5, (i, out) => {
      if (i === 0) slab(out, 0, d - WALL_T / 2, WALL_T, w, WALL_H, 0);
      else if (i < 3)
        slab(out, (i === 1 ? -1 : 1) * (w / 2 - WALL_T / 2), d / 2, d, WALL_T, WALL_H, 0);
      else
        slab(out, (i === 3 ? -1 : 1) * (GATE_HALF + side / 2), WALL_T / 2, WALL_T, side, WALL_H, 0);
    });
    // Its lych-gate: two posts, a beam across, a little roof.
    const posts = make(this.box, TIMBER, 3);
    posts.set(3, (i, out) => {
      if (i < 2) slab(out, (i ? 1 : -1) * (GATE_HALF + 0.2), WALL_T / 2, 0.6, 0.6, LYCH_H, 0);
      else slab(out, 0, WALL_T / 2, 0.45, 2 * GATE_HALF + 1, 0.35, LYCH_H - 0.4);
    });
    const roof = make(this.gable, TILE, 1);
    roof.set(1, (_, out) => {
      const p = at(0, WALL_T / 2);
      out[0] = p.x * M;
      out[1] = (LYCH_H + 1.1) * M;
      out[2] = p.z * M;
      out[3] = (2 * GATE_HALF + 2.4) * M;
      out[4] = 2.2 * M;
      out[5] = 4 * M;
      out[6] = uYaw;
    });
    // Its yews: in its back corners, and one inside its gate.
    const yews = [
        { u: -(w / 2 - 5), v: d - 5 },
        { u: w / 2 - 5, v: d - 5 },
        { u: -(GATE_HALF + 5), v: 5 },
      ],
      trunks = make(this.drum, BARK, yews.length),
      crowns = make(this.cone, YEW, yews.length * 2);
    trunks.set(yews.length, (i, out) => {
      const p = at(yews[i]!.u, yews[i]!.v);
      out[0] = p.x * M;
      out[1] = 1.3 * M;
      out[2] = p.z * M;
      out[3] = out[5] = 1.1 * M;
      out[4] = 2.6 * M;
    });
    crowns.set(yews.length * 2, (i, out) => {
      const y = yews[i >> 1]!,
        p = at(y.u, y.v),
        low = i % 2 === 0;
      out[0] = p.x * M;
      out[1] = (low ? 2 + 2.6 : 4.5 + 3.5) * M;
      out[2] = p.z * M;
      out[3] = out[5] = (low ? 7.6 : 5.6) * M;
      out[4] = (low ? 5.2 : 7) * M;
    });
    // Its graves, as many as it holds (drawn as they come), and today's open ones and biers.
    const cap = plotsOf(yard);
    this.stones = STONES.map((c) => make(this.box, c, cap));
    this.arches = STONES.map((c) => make(this.drum, c, cap));
    this.crosses = [make(this.box, NEW_WOOD, cap * 2), make(this.box, OLD_WOOD, cap * 2)];
    this.mounds = [make(this.gable, EARTH, cap), make(this.gable, MOUND, cap)];
    this.pits = make(this.box, PIT, MOST_OPEN);
    this.heaps = make(this.cone, EARTH, MOST_OPEN);
    this.planks = make(this.box, BIER, MOST_BIERS);
    this.shrouds = make(this.box, SHROUD, MOST_BIERS);
    this.poles = make(this.box, BIER, MOST_BIERS * 2);
    this.legs = make(this.box, BIER, MOST_BIERS * 4);
  }

  /** The graves and the burying now: the graves laid out again as they change; the open graves and biers each frame (a bier borne held up at `held` metres). */
  update(b: BurialShown, held: number): void {
    const yard = this.yard;
    if (!yard) return;
    const key = `${b.graves}|${b.open.length}|${b.freshFrom}|${b.perYear.toFixed(2)}`;
    if (key !== this.gravesKey) {
      this.gravesKey = key;
      this.lay(yard, b);
    }
    const vYaw = -yard.way,
      U = { x: -Math.sin(yard.way), z: Math.cos(yard.way) },
      open = b.open.slice(0, MOST_OPEN),
      dug = open.filter((o) => o.deep > 0.02);
    this.pits!.set(dug.length, (i, out) => {
      const o = dug[i]!;
      out[0] = o.x * M;
      out[1] = (GRASS_TOP + 0.03) * M;
      out[2] = o.z * M;
      out[3] = 4.4 * M;
      out[4] = 0.04 * M;
      out[5] = 2.2 * M;
      out[6] = vYaw;
    });
    this.heaps!.set(dug.length, (i, out) => {
      const o = dug[i]!,
        high = 0.2 + 1.7 * o.deep;
      out[0] = (o.x + U.x * 3.6) * M;
      out[1] = (GRASS_TOP + high / 2) * M;
      out[2] = (o.z + U.z * 3.6) * M;
      out[3] = 4.2 * M;
      out[4] = high * M;
      out[5] = 2.6 * M;
      out[6] = vYaw;
    });
    const biers = b.biers.slice(0, MOST_BIERS),
      top = (q: (typeof biers)[number]) => (q.borne ? held : 1.0);
    this.planks!.set(biers.length, (i, out) => {
      const q = biers[i]!;
      out[0] = q.x * M;
      out[1] = top(q) * M;
      out[2] = q.z * M;
      out[3] = 1.8 * M;
      out[4] = 0.25 * M;
      out[5] = 6 * M;
      out[6] = q.face;
    });
    this.shrouds!.set(biers.length, (i, out) => {
      const q = biers[i]!;
      out[0] = q.x * M;
      out[1] = (top(q) + 0.5) * M;
      out[2] = q.z * M;
      out[3] = 1.4 * M;
      out[4] = 0.75 * M;
      out[5] = 5 * M;
      out[6] = q.face;
    });
    this.poles!.set(biers.length * 2, (i, out) => {
      const q = biers[i >> 1]!,
        side = i % 2 ? 1.05 : -1.05;
      out[0] = (q.x + Math.cos(q.face) * side) * M;
      out[1] = (top(q) - 0.12) * M;
      out[2] = (q.z - Math.sin(q.face) * side) * M;
      out[3] = out[4] = 0.2 * M;
      out[5] = 7.6 * M;
      out[6] = q.face;
    });
    const resting = biers.filter((q) => !q.borne);
    this.legs!.set(resting.length * 4, (i, out) => {
      const q = resting[i >> 2]!,
        j = i % 4,
        along = j < 2 ? 2.3 : -2.3,
        across = j % 2 ? 0.65 : -0.65,
        s = Math.sin(q.face),
        c = Math.cos(q.face);
      out[0] = (q.x + s * along + c * across) * M;
      out[1] = 0.45 * M;
      out[2] = (q.z + c * along - s * across) * M;
      out[3] = out[5] = 0.2 * M;
      out[4] = 0.9 * M;
    });
    this.shown.open = dug.length;
    this.shown.heaps = dug.length;
    this.shown.biers = biers.length;
    this.shown.borne = biers.length - resting.length;
  }

  /**
   * Its graves laid out: the oldest it holds to the newest — but those whose plots are dug again
   * today, full as it is — each by its age, its own stone or cross.
   */
  private lay(yard: Graveyard, b: BurialShown): void {
    const cap = plotsOf(yard),
      from = Math.max(0, b.graves + b.open.length - cap),
      per = Math.max(0.05, b.perYear),
      way = yard.way,
      uYaw = Math.atan2(-Math.cos(way), -Math.sin(way)),
      vYaw = -way,
      V = { x: Math.cos(way), z: Math.sin(way) },
      stones: {
        x: number;
        z: number;
        tip: number;
        high: number;
        arch: boolean;
        fallen: boolean;
      }[][] = STONES.map(() => []),
      crosses: { x: number; z: number; tip: number }[][] = [[], []],
      mounds: { x: number; z: number; high: number }[][] = [[], []];
    for (let k = from; k < b.graves; k++) {
      const p = plotAt(yard, k),
        age = (b.graves - 1 - k) / per,
        fresh = k >= b.freshFrom,
        // (The stone or cross at its head, the far end from the gate; the mound before it.)
        head = { x: p.x + V.x * (PLOT.deep / 2 - 0.6), z: p.z + V.z * (PLOT.deep / 2 - 0.6) },
        mid = { x: p.x - V.x * 0.3, z: p.z - V.z * 0.3 };
      if (fresh) {
        mounds[0]!.push({ ...mid, high: 0.5 });
        crosses[0]!.push({ ...head, tip: (draw(k, 1) - 0.5) * 0.06 });
        continue;
      }
      if (age < MOUND_SINKS)
        mounds[1]!.push({ ...mid, high: Math.max(0.1, 0.32 * (1 - age / MOUND_SINKS)) });
      if (draw(k, 2) < 0.35) {
        // A wooden cross: leaning more as it ages, rotted away at last.
        if (age < CROSS_ROTS)
          crosses[age < 2 ? 0 : 1]!.push({
            ...head,
            tip: (draw(k, 3) - 0.5) * (0.08 + Math.min(0.6, age / 40)),
          });
        continue;
      }
      // A stone: greying, sinking and leaning with its years; now and then fallen.
      const fallen = age > 60 && draw(k, 4) < 0.1,
        sink = 1 - Math.min(0.35, age / 300),
        arch = draw(k, 5) >= 0.3,
        bucket = age < AGES[0] ? 0 : age < AGES[1] ? 1 : age < AGES[2] ? 2 : 3;
      stones[bucket]!.push({
        ...head,
        tip: fallen
          ? (draw(k, 6) < 0.5 ? 1 : -1) * (Math.PI / 2 - 0.04)
          : (draw(k, 6) - 0.5) * (0.06 + Math.min(0.4, age / 250)),
        high: (arch ? 1.5 : 2) * sink,
        arch,
        fallen,
      });
    }
    // (A stone tipped by `tip` toward the gate stands at its base: its middle, its top's, so far.)
    const tipped = (q: { x: number; z: number; tip: number }, up: number) => ({
      x: q.x - V.x * up * Math.sin(q.tip),
      y: GRASS_TOP + up * Math.cos(q.tip),
      z: q.z - V.z * up * Math.sin(q.tip),
    });
    let shown = 0,
      fell = 0;
    stones.forEach((list, s) => {
      shown += list.length;
      fell += list.filter((q) => q.fallen).length;
      this.stones[s]!.set(list.length, (i, out) => {
        const q = list[i]!,
          c = tipped(q, q.high / 2 + (q.fallen ? 0.35 : 0));
        out[0] = c.x * M;
        out[1] = c.y * M;
        out[2] = c.z * M;
        out[3] = 1.5 * M;
        out[4] = q.high * M;
        out[5] = 0.35 * M;
        out[6] = uYaw;
        out[7] = q.tip;
      });
      const arched = list.filter((q) => q.arch);
      this.arches[s]!.set(arched.length, (i, out) => {
        const q = arched[i]!,
          c = tipped(q, q.high + (q.fallen ? 0.35 : 0));
        out[0] = c.x * M;
        out[1] = c.y * M;
        out[2] = c.z * M;
        out[3] = out[5] = 1.5 * M;
        out[4] = 0.35 * M;
        out[6] = uYaw;
        out[7] = Math.PI / 2 + q.tip;
      });
    });
    crosses.forEach((list, s) => {
      this.crosses![s]!.set(list.length * 2, (i, out) => {
        const q = list[i >> 1]!,
          bar = i % 2 === 1,
          c = tipped(q, bar ? 1.85 : 1.3);
        out[0] = c.x * M;
        out[1] = c.y * M;
        out[2] = c.z * M;
        out[3] = (bar ? 1.5 : 0.3) * M;
        out[4] = (bar ? 0.28 : 2.6) * M;
        out[5] = 0.28 * M;
        out[6] = uYaw;
        out[7] = q.tip;
      });
    });
    mounds.forEach((list, s) => {
      this.mounds![s]!.set(list.length, (i, out) => {
        const q = list[i]!;
        out[0] = q.x * M;
        out[1] = (GRASS_TOP + q.high / 2 - 0.02) * M;
        out[2] = q.z * M;
        out[3] = 4 * M;
        out[4] = q.high * M;
        out[5] = 2 * M;
        out[6] = vYaw;
      });
    });
    this.shown.stones = shown;
    this.shown.fallen = fell;
    this.shown.crosses = crosses[0]!.length + crosses[1]!.length;
    this.shown.fresh = mounds[0]!.length;
    this.shown.mounds = mounds[0]!.length + mounds[1]!.length;
  }
}
