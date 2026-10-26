// A town's foundry seen at its place (Phase 51 M215): its cupola on a brick base, the blast glowing
// at its top with the smoke going up over it while it blows; its charging platform on two legs, and
// the stockpile of pig iron and coke at the platform's foot; the spout and its trough, the iron
// running in it while it taps; the moulds on the floor, the iron cooling in each as its glow fails;
// and the castings stacked at the stack. Units as the village's: a tenth of a unit to the metre; the
// sizes are metres as drawn, the cupola's top about fifteen metres up.
import * as pc from "playcanvas";
import { InstancedBatch, boxMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

const M = 0.1;
/** Sides of the round parts; the puffs of smoke from a blowing cupola; the castings a pile holds. */
const CYLINDER_SIDES = 12,
  PUFFS = 6,
  CASTINGS = 18;
/** Where the platform's middle stands from the cupola's, away from the spout; the shaft's half-breadth (metres). */
const PLATFORM_FROM = 4.5,
  SHAFT_R = 2.1;
/** A mould's iron cools over this many seconds from its pour; its glow is none once below a twentieth. */
const COOL_SECONDS = 7200,
  GLOW_LEAST = 0.05;
const BRICK: Rgb = [0.48, 0.24, 0.18],
  IRON: Rgb = [0.24, 0.24, 0.26],
  SAND: Rgb = [0.36, 0.3, 0.24],
  COKE: Rgb = [0.14, 0.13, 0.13],
  PIG: Rgb = [0.4, 0.33, 0.3],
  MOLTEN: Rgb = [1, 0.5, 0.1],
  SMOKE: Rgb = [0.3, 0.29, 0.3];

/**
 * The foundry now, in metres from the town's middle: its cupola's middle, its spout's mouth and its
 * stack's middle; the way the yard faces; whether the cupola blows and the spout taps; its moulds;
 * and how many castings are stacked at the stack.
 */
export type FoundryAt = {
  readonly cupola: { readonly x: number; readonly z: number };
  readonly spout: { readonly x: number; readonly z: number };
  readonly stock: { readonly x: number; readonly z: number };
  readonly stack: { readonly x: number; readonly z: number };
  readonly yaw: number;
  readonly blowing: boolean;
  readonly tapping: boolean;
  /**
   * Each mould: its place, its form (the flask is drawn the same whatever it is), and the seconds
   * since its iron was poured (null: empty, the casting broken out or not poured yet).
   */
  readonly moulds: readonly {
    readonly x: number;
    readonly z: number;
    readonly form: string | null;
    readonly since: number | null;
  }[];
  readonly stacked: number;
};

/** The batches of the foundry's parts, made together at the town's layout. */
type Parts = {
  base: InstancedBatch;
  shaft: InstancedBatch;
  band: InstancedBatch;
  deck: InstancedBatch;
  legs: InstancedBatch;
  trough: InstancedBatch;
  run: InstancedBatch;
  mouth: InstancedBatch;
  blast: InstancedBatch;
  smoke: InstancedBatch;
  pig: InstancedBatch;
  coke: InstancedBatch;
  flask: InstancedBatch;
  cast: InstancedBatch;
  pour: InstancedBatch;
  castings: InstancedBatch;
};

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

/** The foundry's layer: its batches made at the town's layout, and all of them set each frame. */
export class FoundryLayer {
  /** Its own entity, kept as the village is laid out again. */
  readonly root = new pc.Entity("foundry");
  private readonly stage: Stage;
  private readonly box: pc.Mesh;
  private readonly tube: pc.Mesh;
  private readonly molten: pc.StandardMaterial;
  private readonly smokeMaterial: pc.StandardMaterial;
  private batches: InstancedBatch[] = [];
  private parts: Parts | null = null;
  /** The most moulds the batches hold (the town's, as last laid out). */
  private most = 0;
  /**
   * What was last drawn (the look tools): whether the cupola blows and the spout taps; the moulds
   * poured, and how many glow as their iron cools; the castings drawn.
   */
  shown: {
    blowing: boolean;
    tapping: boolean;
    poured: number;
    glowing: number;
    stacked: number;
  } | null = null;

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    parent.addChild(this.root);
    // (Held: its batches are made anew each time the town is laid out, and the last of them
    // ending would otherwise destroy the meshes with itself.)
    this.box = keptMesh(boxMesh(stage));
    this.tube = keptMesh(cylinderMesh(stage, 0.5, 1, CYLINDER_SIDES));
    const lit = (c: Rgb) => {
      const m = new pc.StandardMaterial();
      m.useLighting = false;
      m.diffuse = new pc.Color(0, 0, 0);
      m.emissive = new pc.Color(c[0], c[1], c[2]);
      m.update();
      return m;
    };
    this.molten = lit(MOLTEN);
    // (See-through, so the sky shows through the smoke.)
    this.smokeMaterial = flatMaterial(SMOKE, 0.6);
  }

  /**
   * The town's foundry, if it has one, and as many moulds as it has: each part sized by what it is,
   * the moulds and their glows by the count of moulds, and the castings by the most a pile holds.
   */
  build(has: boolean, moulds: number): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.most = moulds;
    const make = (mesh: pc.Mesh, color: Rgb, n: number, material?: pc.Material) => {
      const b = new InstancedBatch(this.stage, mesh, color, n, this.root, material);
      this.batches.push(b);
      return b;
    };
    this.parts = has
      ? {
          base: make(this.box, BRICK, 1),
          shaft: make(this.tube, IRON, 1),
          band: make(this.tube, BRICK, 1),
          deck: make(this.box, IRON, 1),
          legs: make(this.box, IRON, 2),
          trough: make(this.box, IRON, 1),
          run: make(this.box, MOLTEN, 1, this.molten),
          mouth: make(this.box, MOLTEN, 1, this.molten),
          blast: make(this.tube, MOLTEN, 1, this.molten),
          smoke: make(this.box, SMOKE, PUFFS, this.smokeMaterial),
          pig: make(this.box, PIG, 1),
          coke: make(this.box, COKE, 1),
          flask: make(this.box, SAND, moulds),
          cast: make(this.box, IRON, moulds),
          pour: make(this.box, MOLTEN, moulds, this.molten),
          castings: make(this.box, IRON, CASTINGS),
        }
      : null;
    this.shown = null;
  }

  /**
   * The foundry now, by the screen's clock `s`: the blast flickering at the cupola's top, its smoke
   * going up over it, while it blows; the iron running in the trough and the spout's mouth glowing
   * while it taps; each mould's iron glowing less as it cools; the castings stacked. Every batch is
   * set each time (count 0 where nothing is drawn, or there is no foundry). `motion` false holds the
   * small motions still.
   */
  update(s: number, motion: boolean, now: FoundryAt | null): void {
    const p = this.parts;
    if (!now || !p) {
      for (const b of this.batches) b.set(0, () => {});
      this.shown = null;
      return;
    }
    const at: FoundryAt = now;
    const { cupola, spout } = at;
    const { base, shaft, band, deck, legs, trough, run, mouth, blast, smoke } = p;
    const { pig, coke, flask, cast, pour, castings } = p;
    // (The way the spout lies from the cupola: the trough's turn, and the platform's and the foot's.)
    const spoutYaw = Math.atan2(spout.x - cupola.x, spout.z - cupola.z),
      platform = turned(cupola.x, cupola.z, spoutYaw, 0, -PLATFORM_FROM),
      stock = at.stock,
      // (The trough from the shaft's foot out to the spout's lip.)
      reach = Math.hypot(spout.x - cupola.x, spout.z - cupola.z),
      long = Math.max(0.5, reach - SHAFT_R + 0.3),
      mid = turned(cupola.x, cupola.z, spoutYaw, 0, (SHAFT_R + reach) / 2),
      midX = mid.x,
      midZ = mid.z,
      moulds = at.moulds.slice(0, this.most),
      // (A mould glows while its iron cools: less each second, and not at all once nearly cold.)
      glowing = moulds.flatMap((m) => {
        if (m.since === null || m.since >= COOL_SECONDS) return [];
        const k = 1 - m.since / COOL_SECONDS;
        return k < GLOW_LEAST ? [] : [{ m, k }];
      }),
      stacked = Math.min(Math.max(0, at.stacked), CASTINGS),
      // (The flickers of the blast and of the spout's glow, held still where small motions are not drawn.)
      blastFlick = motion ? 0.8 + 0.2 * Math.sin(s * 11) : 1,
      mouthFlick = motion ? 0.8 + 0.2 * Math.sin(s * 7) : 1;

    // The cupola on its brick base, its shaft and the band near its top.
    base.set(1, (_, out) => put(out, cupola.x, 0.8, cupola.z, 6.5, 1.6, 6.5, spoutYaw));
    shaft.set(1, (_, out) => put(out, cupola.x, 8.1, cupola.z, 4.2, 13, 4.2, spoutYaw));
    band.set(1, (_, out) => put(out, cupola.x, 13.8, cupola.z, 4.6, 0.5, 4.6, spoutYaw));
    // Its charging platform on two legs, the legs at the platform's outer corners.
    deck.set(1, (_, out) => put(out, platform.x, 7, platform.z, 5, 0.4, 4, spoutYaw));
    legs.set(2, (i, out) => {
      const leg = turned(platform.x, platform.z, spoutYaw, i ? 2.5 : -2.5, -2);
      put(out, leg.x, 3.5, leg.z, 0.4, 7, 0.4, spoutYaw);
    });
    // The spout and its trough, the iron running in it and the spout's mouth glowing while it taps.
    trough.set(1, (_, out) => put(out, midX, 1.9, midZ, 0.9, 0.6, long, spoutYaw));
    run.set(at.tapping ? 1 : 0, (_, out) =>
      put(out, midX, 2.25, midZ, 0.5, 0.12, long - 0.2, spoutYaw),
    );
    // (The iron falling from the lip into the ladle below it.)
    mouth.set(at.tapping ? 1 : 0, (_, out) =>
      put(out, spout.x, 1.5, spout.z, 0.4 * mouthFlick, 0.9, 0.4 * mouthFlick, spoutYaw),
    );
    // The blast at the cupola's top, and the smoke going up over it while it blows.
    blast.set(at.blowing ? 1 : 0, (_, out) =>
      put(out, cupola.x, 14.7, cupola.z, 3.4, 0.3 * blastFlick, 3.4, 0),
    );
    smoke.set(at.blowing ? PUFFS : 0, (j, out) => {
      // (Each puff climbs from the top and spreads as it goes; held still where small motions are not drawn.)
      const age = motion ? (s * 0.15 + j / PUFFS) % 1 : j / PUFFS,
        size = 1.6 + age * 4.5;
      put(
        out,
        cupola.x + age * age * 5,
        15 + age * 22,
        cupola.z + age * age * 2,
        size,
        0.8 * size,
        size,
        0,
      );
    });
    // The stockpile at the platform's foot: the pig iron and the coke, three metres apart.
    pig.set(1, (_, out) => {
      const heap = turned(stock.x, stock.z, at.yaw, -1.5, 0);
      put(out, heap.x, 0.6, heap.z, 3, 1.2, 2, at.yaw);
    });
    coke.set(1, (_, out) => {
      const heap = turned(stock.x, stock.z, at.yaw, 1.5, 0);
      put(out, heap.x, 0.7, heap.z, 3, 1.4, 2.6, at.yaw);
    });
    // The moulds on the floor, each with its iron cooling in it while it glows.
    flask.set(moulds.length, (i, out) => {
      const m = moulds[i]!;
      put(out, m.x, 0.45, m.z, 3.6, 0.9, 2.4, at.yaw);
    });
    // (A casting's dark riser at the top of each mould that holds one; the glow over it while hot.)
    const holding = moulds.filter((m) => m.since !== null);
    cast.set(holding.length, (i, out) => {
      const m = holding[i]!;
      put(out, m.x, 0.94, m.z, 1.4, 0.1, 0.8, at.yaw);
    });
    pour.set(glowing.length, (i, out) => {
      const { m, k } = glowing[i]!;
      put(out, m.x, 1.0, m.z, 2.4 * k, 0.08 * k, 1.4 * k, at.yaw);
    });
    // The castings at the stack: three across and two deep a layer, six a layer.
    castings.set(stacked, (k, out) => {
      const row = Math.floor(k / 3) % 2,
        layer = Math.floor(k / 6),
        piece = turned(at.stack.x, at.stack.z, at.yaw, -1.8 + 1.8 * (k % 3), row ? 0.7 : -0.7);
      put(out, piece.x, 0.3 + 0.62 * layer, piece.z, 1.6, 0.6, 1.2, at.yaw);
    });

    this.shown = {
      blowing: at.blowing,
      tapping: at.tapping,
      poured: moulds.filter((m) => m.since !== null).length,
      glowing: glowing.length,
      stacked,
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
