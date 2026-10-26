// The works' floor seen at its place: a factory hall open to the sky, its machine floor in two rows
// (presses in the front row, lathes behind them), each lathe's carriage sliding along its bed and each
// press's ram stroking while it runs, and the bench just outside the hall's front where the day's last
// parts are set. Each machine's machinist stands 2.6 metres toward the machine's local +z, facing it;
// this layer draws no figures. Units as the village's: a tenth of a unit to the metre; the sizes are
// metres as drawn.
import * as pc from "playcanvas";
import { BENCH_MOST, benchSlot } from "../view/index.ts";
import { InstancedBatch, boxMesh, cylinderMesh, keptMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

const M = 0.1;
/** Sides of the round parts; a quarter turn in radians (the pitch that lays a cylinder flat). */
const CYLINDER_SIDES = 12,
  QUARTER = Math.PI / 2;
/** The hall's floor slab's top, in metres: a machine's pieces stand this far above the ground. */
const SLAB = 0.2;
/** The bench's top, in metres above the ground: the parts stand on it. */
const BENCH_TOP = 2.475;
/** How far apart in phase the machines' motions start: one step for each machine in the works' list (radians). */
const PHASE_STEP = 1.7;
/**
 * A lathe's carriage at rest, in metres along its bed from the middle; a press's ram held up, the
 * height of its middle in the press's frame (metres; the slab's top is added when it is drawn).
 */
const CARRIAGE_REST = 0.2,
  RAM_UP = 4.9;
/** The colours: the lathes' paint, the presses', the steel of the parts, the dark of the chucks and legs, and the bench's wood. */
const MACHINE: Rgb = [0.26, 0.31, 0.28],
  PRESS_PAINT: Rgb = [0.3, 0.36, 0.43],
  STEEL: Rgb = [0.68, 0.7, 0.74],
  DARK: Rgb = [0.18, 0.18, 0.2],
  WOOD: Rgb = [0.5, 0.38, 0.24];

/**
 * The works' floor now, in metres from the town's middle: each machine (its middle, its kind,
 * whether it runs now, the part in it); the bench's middle; the way the works face; the parts set on
 * the bench (the day's last, at most BENCH_MOST), in order.
 */
export type FloorAt = {
  readonly machines: readonly {
    readonly x: number;
    readonly z: number;
    readonly kind: "lathe" | "press";
    readonly running: boolean;
    readonly part: string | null;
  }[];
  readonly bench: { readonly x: number; readonly z: number };
  readonly yaw: number;
  readonly benched: readonly { readonly form: string }[];
};

/** The batches of the floor's parts, made together at the works' layout. */
type Parts = {
  bed: InstancedBatch;
  legs: InstancedBatch;
  headstock: InstancedBatch;
  tailstock: InstancedBatch;
  carriage: InstancedBatch;
  chuck: InstancedBatch;
  work: InstancedBatch;
  base: InstancedBatch;
  columns: InstancedBatch;
  crown: InstancedBatch;
  ram: InstancedBatch;
  flywheel: InstancedBatch;
  sheet: InstancedBatch;
  benchTop: InstancedBatch;
  benchLegs: InstancedBatch;
  benchLaid: InstancedBatch;
  benchUpright: InstancedBatch;
  benchBlock: InstancedBatch;
};

/**
 * A part set on the bench: its shape, and its sizes as `put` takes them (a cylinder's sx and sz are
 * its diameter, and its sy its length or its height).
 */
type BenchPart = { shape: "laid" | "upright" | "block"; sx: number; sy: number; sz: number };

/**
 * How a part on the bench is drawn, by its form: a shaft, an axle or a bolt as a cylinder lying across
 * the bench; a piston or a gear blank as a cylinder standing up; anything else as a box.
 */
function benchPart(form: string): BenchPart {
  switch (form) {
    case "shaft":
    case "axle":
      return { shape: "laid", sx: 0.28, sy: 1.2, sz: 0.28 };
    case "bolt":
      return { shape: "laid", sx: 0.22, sy: 0.5, sz: 0.22 };
    case "piston":
      return { shape: "upright", sx: 0.55, sy: 0.6, sz: 0.55 };
    case "gear blank":
      return { shape: "upright", sx: 0.7, sy: 0.18, sz: 0.7 };
    case "panel":
      return { shape: "block", sx: 0.7, sy: 0.06, sz: 1.1 };
    case "bracket":
      return { shape: "block", sx: 0.5, sy: 0.45, sz: 0.35 };
    case "hinge":
      return { shape: "block", sx: 0.45, sy: 0.06, sz: 0.4 };
    default:
      return { shape: "block", sx: 0.5, sy: 0.3, sz: 0.5 };
  }
}

/** Write one part into a batch's slot: its middle at (x, y, z), its size and its turn (metres). */
function put(
  out: number[],
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  yaw: number,
): void {
  out[0] = x * M;
  out[1] = y * M;
  out[2] = z * M;
  out[3] = sx * M;
  out[4] = sy * M;
  out[5] = sz * M;
  out[6] = yaw;
}

/**
 * The point (lx, lz) metres from (x, z) in a frame turned by yaw: local x runs (cos yaw, −sin yaw)
 * and local z faces (sin yaw, cos yaw), as a part's own axes do.
 */
function turned(
  x: number,
  z: number,
  yaw: number,
  lx: number,
  lz: number,
): { x: number; z: number } {
  return {
    x: x + lx * Math.cos(yaw) + lz * Math.sin(yaw),
    z: z - lx * Math.sin(yaw) + lz * Math.cos(yaw),
  };
}

/**
 * Write a cylinder lying flat: its diameter across, and its length along its own axis. The batch tips
 * a part about its own x (its pitch) before it turns it by its yaw, so a quarter turn of pitch lays the
 * axis flat, and the yaw sets the way it runs: the works' own yaw runs it along local z, and a quarter
 * turn more runs it along local x.
 */
function layFlat(
  out: number[],
  x: number,
  y: number,
  z: number,
  diameter: number,
  length: number,
  yaw: number,
): void {
  put(out, x, y, z, diameter, length, diameter, yaw);
  // (The pitch is the batch's eighth number; `put` writes only the first seven.)
  out[7] = QUARTER;
}

/**
 * The works' floor's layer: its batches made at the works' layout, and all of them set each frame.
 */
export class FloorLayer {
  /** Its own entity, kept as the village is laid out again. */
  readonly root = new pc.Entity("floor");
  private readonly stage: Stage;
  private readonly box: pc.Mesh;
  private readonly tube: pc.Mesh;
  private batches: InstancedBatch[] = [];
  private parts: Parts | null = null;
  /** The most machines of each kind the batches hold (the works', as last laid out). */
  private most = 0;
  /**
   * What was last drawn (the look tools): the lathes and presses drawn, how many of each run, and the
   * parts drawn on the bench.
   */
  shown: {
    lathes: number;
    presses: number;
    turning: number;
    pressing: number;
    benched: number;
  } | null = null;

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    parent.addChild(this.root);
    // (Held: its batches are made anew each time the works are laid out, and the last of them
    // ending would otherwise destroy the meshes with itself.)
    this.box = keptMesh(boxMesh(stage));
    this.tube = keptMesh(cylinderMesh(stage, 0.5, 1, CYLINDER_SIDES));
  }

  /**
   * The works' floor, if it has machines, and as many as it has: a batch for each piece, holding the
   * most its kind may need (a lathe's two legs and a press's two columns come two to a machine). The
   * bench and its parts come with it. `machines` of 0 draws nothing.
   */
  build(machines: number): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.most = machines;
    const make = (mesh: pc.Mesh, color: Rgb, n: number) => {
      const b = new InstancedBatch(this.stage, mesh, color, n, this.root);
      this.batches.push(b);
      return b;
    };
    this.parts =
      machines > 0
        ? {
            bed: make(this.box, MACHINE, machines),
            legs: make(this.box, MACHINE, 2 * machines),
            headstock: make(this.box, MACHINE, machines),
            tailstock: make(this.box, MACHINE, machines),
            carriage: make(this.box, MACHINE, machines),
            chuck: make(this.tube, DARK, machines),
            work: make(this.tube, STEEL, machines),
            base: make(this.box, PRESS_PAINT, machines),
            columns: make(this.box, PRESS_PAINT, 2 * machines),
            crown: make(this.box, PRESS_PAINT, machines),
            ram: make(this.box, PRESS_PAINT, machines),
            flywheel: make(this.tube, DARK, machines),
            sheet: make(this.box, STEEL, machines),
            benchTop: make(this.box, WOOD, 1),
            benchLegs: make(this.box, DARK, 4),
            benchLaid: make(this.tube, STEEL, BENCH_MOST),
            benchUpright: make(this.tube, STEEL, BENCH_MOST),
            benchBlock: make(this.box, STEEL, BENCH_MOST),
          }
        : null;
    this.shown = null;
  }

  /**
   * The works' floor now, by the screen's clock `s`: each lathe's carriage sliding along its bed, and
   * its work in the chuck, while it runs; each press's ram stroking and its sheet under the ram while it
   * runs; the parts set on the bench. Every batch is set each time (count 0 where nothing is drawn, or
   * there is no floor). `motion` false holds the small motions still.
   */
  update(s: number, motion: boolean, now: FloorAt | null): void {
    const p = this.parts;
    if (!now || !p) {
      for (const b of this.batches) b.set(0, () => {});
      this.shown = null;
      return;
    }
    const floor: FloorAt = now,
      yaw = floor.yaw,
      // (Each machine with its phase: a step for each place in the works' list, so none moves in step.)
      placed = floor.machines.map((m, i) => ({ ...m, phase: i * PHASE_STEP })),
      // (No more of a kind than its batches hold.)
      lathes = placed.filter((m) => m.kind === "lathe").slice(0, this.most),
      presses = placed.filter((m) => m.kind === "press").slice(0, this.most),
      turning = lathes.filter((m) => m.running),
      pressing = presses.filter((m) => m.running),
      // (The day's last parts on the bench, at most BENCH_MOST: each with its shape, its slot, and the
      // height its middle stands at.)
      benched = floor.benched.slice(0, BENCH_MOST).map((part, k) => {
        const piece = benchPart(part.form),
          slot = benchSlot(floor, k);
        return {
          ...piece,
          x: slot.x,
          z: slot.z,
          middle: BENCH_TOP + (piece.shape === "laid" ? piece.sx : piece.sy) / 2,
        };
      }),
      laid = benched.filter((b) => b.shape === "laid"),
      upright = benched.filter((b) => b.shape === "upright"),
      block = benched.filter((b) => b.shape === "block"),
      // (The yaw that runs a lying cylinder along local x; the works' own yaw runs it along local z.)
      alongX = yaw + QUARTER,
      // (A point the given metres from a machine's middle, in the works' frame.)
      local = (m: { x: number; z: number }, lx: number, lz: number) =>
        turned(m.x, m.z, yaw, lx, lz);

    // The lathes: the bed, the two legs, the headstock and the tailstock; the carriage, which slides
    // along the bed only while its lathe runs (else it rests); the chuck, and the work in it while the
    // lathe runs.
    p.bed.set(lathes.length, (i, out) => {
      const q = local(lathes[i]!, 0, 0);
      put(out, q.x, 2.35 + SLAB, q.z, 4.6, 0.7, 1.1, yaw);
    });
    p.legs.set(2 * lathes.length, (k, out) => {
      const q = local(lathes[Math.floor(k / 2)]!, k % 2 ? 1.8 : -1.8, 0);
      put(out, q.x, 1 + SLAB, q.z, 0.7, 2, 1, yaw);
    });
    p.headstock.set(lathes.length, (i, out) => {
      const q = local(lathes[i]!, -1.75, 0);
      put(out, q.x, 3.35 + SLAB, q.z, 1.1, 1.3, 1.2, yaw);
    });
    p.tailstock.set(lathes.length, (i, out) => {
      const q = local(lathes[i]!, 1.9, 0);
      put(out, q.x, 3.1 + SLAB, q.z, 0.6, 0.8, 0.8, yaw);
    });
    p.carriage.set(lathes.length, (i, out) => {
      const m = lathes[i]!,
        // (It slides only while its lathe runs, and motion is shown.)
        c =
          m.running && motion
            ? -0.6 + 1.6 * (0.5 + 0.5 * Math.sin(s * 0.6 + m.phase))
            : CARRIAGE_REST,
        q = local(m, c, 0.1);
      put(out, q.x, 2.95 + SLAB, q.z, 0.8, 0.5, 1.3, yaw);
    });
    p.chuck.set(lathes.length, (i, out) => {
      const q = local(lathes[i]!, -1.05, 0);
      layFlat(out, q.x, 3.35 + SLAB, q.z, 0.9, 0.35, alongX);
    });
    p.work.set(turning.length, (i, out) => {
      const q = local(turning[i]!, 0.05, 0);
      layFlat(out, q.x, 3.35 + SLAB, q.z, 0.45, 2.4, alongX);
    });

    // The presses: the base, the two columns and the crown; the ram, which strokes while its press runs
    // (else it is held up); the flywheel on its axle; and the sheet under the ram while the press runs.
    p.base.set(presses.length, (i, out) => {
      const q = local(presses[i]!, 0, 0);
      put(out, q.x, 0.6 + SLAB, q.z, 2.4, 1.2, 2, yaw);
    });
    p.columns.set(2 * presses.length, (k, out) => {
      const q = local(presses[Math.floor(k / 2)]!, k % 2 ? 0.95 : -0.95, 0);
      put(out, q.x, 3.5 + SLAB, q.z, 0.45, 4.6, 0.45, yaw);
    });
    p.crown.set(presses.length, (i, out) => {
      const q = local(presses[i]!, 0, 0);
      put(out, q.x, 6.2 + SLAB, q.z, 2.6, 1, 1.6, yaw);
    });
    p.ram.set(presses.length, (i, out) => {
      const m = presses[i]!,
        // (It strokes only while its press runs, and motion is shown.)
        r = m.running && motion ? 3.6 + 1.3 * Math.cos(s * 2.4 + m.phase) : RAM_UP,
        q = local(m, 0, 0);
      put(out, q.x, r + SLAB, q.z, 1.4, 0.9, 1.2, yaw);
    });
    p.flywheel.set(presses.length, (i, out) => {
      const q = local(presses[i]!, 1.5, 0);
      layFlat(out, q.x, 6 + SLAB, q.z, 2, 0.35, alongX);
    });
    p.sheet.set(pressing.length, (i, out) => {
      const q = local(pressing[i]!, 0, 0);
      put(out, q.x, 1.28 + SLAB, q.z, 1.2, 0.15, 0.9, yaw);
    });

    // The bench stands outside, on the ground (no slab to add): its top, and four legs under its corners.
    p.benchTop.set(1, (_, out) =>
      put(out, floor.bench.x, 2.4, floor.bench.z, 10.2, 0.15, 1.6, yaw),
    );
    p.benchLegs.set(4, (k, out) => {
      const q = turned(floor.bench.x, floor.bench.z, yaw, k % 2 ? 4.8 : -4.8, k < 2 ? -0.6 : 0.6);
      put(out, q.x, 1.15, q.z, 0.3, 2.3, 0.3, yaw);
    });
    // The parts on the bench, each standing on its top: the lying ones run across the bench.
    p.benchLaid.set(laid.length, (i, out) => {
      const b = laid[i]!;
      layFlat(out, b.x, b.middle, b.z, b.sx, b.sy, yaw);
    });
    p.benchUpright.set(upright.length, (i, out) => {
      const b = upright[i]!;
      put(out, b.x, b.middle, b.z, b.sx, b.sy, b.sz, yaw);
    });
    p.benchBlock.set(block.length, (i, out) => {
      const b = block[i]!;
      put(out, b.x, b.middle, b.z, b.sx, b.sy, b.sz, yaw);
    });

    this.shown = {
      lathes: lathes.length,
      presses: presses.length,
      turning: turning.length,
      pressing: pressing.length,
      benched: benched.length,
    };
  }

  /** Destroy its batches and its entity. */
  destroy(): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.parts = null;
    this.root.destroy();
  }
}
