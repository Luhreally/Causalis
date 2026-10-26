// A town's crafts seen at their places (Phase 51 M214): its potters' wheels, the kick-bar turning
// and the pot rising on the head as it is thrown; its kilns' boards, with the day's pots drying on
// them unfired; its weavers' looms, the cloth growing down them and the heddle working while the
// weaver works; and the charcoal clamp at each stage of its round, smoking while it smoulders.
// Units as the village's: a tenth of a unit to the metre; the sizes are the folk's, drawn three
// times a person's size.
import * as pc from "playcanvas";
import { BOARD_GAP, BOARD_MOST, boardSlot } from "../view/index.ts";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

const M = 0.1;
/** Sides of the round meshes: the wheels' and the pots', the clamp's cones. */
const CYLINDER_SIDES = 12,
  CONE_SIDES = 10;
/** Puffs of smoke from a lit clamp; the loom weights, a row of them along each loom. */
const PUFFS = 7,
  WEIGHTS = 8;
const TIMBER: Rgb = [0.42, 0.3, 0.18],
  WOOD: Rgb = [0.5, 0.34, 0.2],
  EARTH: Rgb = [0.32, 0.25, 0.18],
  CHARCOAL: Rgb = [0.1, 0.1, 0.1],
  SMOKE: Rgb = [0.82, 0.82, 0.84];
/** Where parts meet (metres): a wheel's head's top, a board's top, a loom's cloth top, its warp's end. */
const HEAD_TOP = 2.84,
  BOARD_TOP = 2.175,
  CLOTH_TOP = 5.75,
  WARP_END = 1.4;
/** A pot's [height, width across] in metres at the folk's size, by its form. */
const POT_SHAPE: Readonly<Record<string, readonly [number, number]>> = {
  "storage jar": [1.3, 0.9],
  "cooking pot": [0.7, 0.8],
  bowl: [0.35, 0.85],
  jug: [0.9, 0.55],
};
/** The shape of a pot of any other form. */
const POT_OTHER: readonly [number, number] = [0.8, 0.7];

/** A potter's wheel now: where it stands, which way its kick-bar runs, whether one throws at it, the pot on it. */
export type WheelAt = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly turning: boolean;
  /** The pot rising on the head: its form, and the share of it thrown so far. */
  readonly pot: { readonly form: string; readonly grown: number } | null;
};

/** A kiln's boards now: where they stand, which way they run, and the pots on them in the order set out. */
export type BoardsAt = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly pots: readonly { readonly form: string }[];
};

/** A loom now: where it stands, which way its cloth runs, how much of it is woven, whether its weaver works it. */
export type LoomAt = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly woven: number;
  readonly weaving: boolean;
};

/**
 * The charcoal clamp now: where it stands; its stage of the round (0 to 5); `built`, the share of
 * its billets stacked; `covered`, the share of its turf laid; whether it smoulders (`lit`); and
 * `heap`, the share of its charcoal left to carry off once it is raked out.
 */
export type ClampAt = {
  readonly x: number;
  readonly z: number;
  readonly stage: number;
  readonly built: number;
  readonly covered: number;
  readonly lit: boolean;
  readonly heap: number;
};

/** A cone standing on the ground: its base across and its height (metres, at the folk's size). */
type Mound = { readonly across: number; readonly high: number };
/** The batches of each craft's parts, made together at the town's layout. */
type Wheels = {
  flywheel: InstancedBatch;
  shaft: InstancedBatch;
  head: InstancedBatch;
  kick: InstancedBatch;
  pot: InstancedBatch;
};
type Boards = {
  plank: InstancedBatch;
  trestle: InstancedBatch;
  body: InstancedBatch;
  neck: InstancedBatch;
};
type Looms = {
  post: InstancedBatch;
  beam: InstancedBatch;
  cloth: InstancedBatch;
  warp: InstancedBatch;
  heddle: InstancedBatch;
  weight: InstancedBatch;
};
type Clamp = {
  wood: InstancedBatch;
  earth: InstancedBatch;
  charcoal: InstancedBatch;
  smoke: InstancedBatch;
};
/** The clamp's cones at its stage, and the height its smoke rises from (the tallest thing drawn). */
type ClampShape = { wood: Mound | null; earth: Mound | null; charcoal: Mound | null; top: number };

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

/** A pot's [height, width across] by its form. */
function potShape(form: string): readonly [number, number] {
  return POT_SHAPE[form] ?? POT_OTHER;
}

/** Whether a pot has a neck on its body (a storage jar's, a jug's). */
function hasNeck(form: string): boolean {
  return form === "storage jar" || form === "jug";
}

/** A fraction of a whole, held between none of it and all of it. */
function fraction(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** The clamp's cones at its stage (none where a cone is not drawn), and where its smoke starts. */
function clampShape(c: ClampAt | null): ClampShape {
  if (!c) return { wood: null, earth: null, charcoal: null, top: 0 };
  if (c.stage <= 0) {
    // (The billets stacked so far, a cone on the ground; none until a few are.)
    const wood =
      c.built < 0.02
        ? null
        : { across: 8 * (0.55 + 0.45 * c.built), high: 4.6 * Math.max(0.12, c.built) };
    return { wood, earth: null, charcoal: null, top: wood?.high ?? 0 };
  }
  if (c.stage === 1) {
    // (The stack whole, and the turf laid over it so far.)
    const wood = { across: 8, high: 4.6 },
      earth = c.covered < 0.02 ? null : { across: 8.6, high: 5 * c.covered };
    return { wood, earth, charcoal: null, top: Math.max(wood.high, earth?.high ?? 0) };
  }
  if (c.stage < 5) return { wood: null, earth: { across: 8.6, high: 5 }, charcoal: null, top: 5 };
  // (The charcoal raked out: a low heap.)
  const charcoal = { across: 9 * (0.5 + 0.5 * c.heap), high: 1.8 * Math.max(0.1, c.heap) };
  return { wood: null, earth: null, charcoal, top: charcoal.high };
}

/** One cone standing on the ground at (x, z), or none (its middle at half its height). */
function standOn(batch: InstancedBatch, cone: Mound | null, x: number, z: number): void {
  const high = cone?.high ?? 0,
    across = cone?.across ?? 0;
  batch.set(cone ? 1 : 0, (_, out) => put(out, x, high / 2, z, across, high, across, 0));
}

export class CraftsLayer {
  /** Its own entity, kept as the village is laid out again. */
  readonly root = new pc.Entity("crafts");
  private readonly stage: Stage;
  private readonly box: pc.Mesh;
  private readonly tube: pc.Mesh;
  private readonly cone: pc.Mesh;
  private readonly smokeMaterial: pc.StandardMaterial;
  private batches: InstancedBatch[] = [];
  private wheels: Wheels | null = null;
  private boards: Boards | null = null;
  private looms: Looms | null = null;
  private clamp: Clamp | null = null;
  /** The most of each the batches hold (the town's, as last laid out). */
  private most = { wheels: 0, boards: 0, looms: 0 };
  /**
   * What was last drawn (the look tools): the wheels, and how many turn; the pots on the boards; the
   * looms, and how many are woven at; the clamp, its stage and whether it smokes.
   */
  shown: {
    wheels: number;
    turning: number;
    pots: number;
    looms: number;
    weaving: number;
    clamp: { stage: number; smoking: boolean } | null;
  } = { wheels: 0, turning: 0, pots: 0, looms: 0, weaving: 0, clamp: null };

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    parent.addChild(this.root);
    // (Held: its batches are made anew each time the town is laid out, and the last of them
    // ending would otherwise destroy the meshes with itself.)
    this.box = keptMesh(boxMesh(stage));
    this.tube = keptMesh(cylinderMesh(stage, 0.5, 1, CYLINDER_SIDES));
    this.cone = keptMesh(coneMesh(stage, 0.5, 1, CONE_SIDES));
    this.smokeMaterial = flatMaterial(SMOKE, 0.55);
  }

  /**
   * The town's wheels, kilns' boards and looms, and whether it has a clamp: each batch sized by its
   * count, and coloured by the raw clay, the fired clay or the cloth given.
   */
  build(
    counts: { wheels: number; boards: number; looms: number; clamp: boolean },
    colours: { raw: Rgb; fired: Rgb; cloth: Rgb },
  ): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    const W = counts.wheels,
      B = counts.boards,
      L = counts.looms,
      make = (mesh: pc.Mesh, color: Rgb, n: number, material?: pc.Material) => {
        const b = new InstancedBatch(this.stage, mesh, color, n, this.root, material);
        this.batches.push(b);
        return b;
      },
      c = colours.cloth,
      // (The warp: the cloth's colour mixed half and half with white.)
      warp: Rgb = [(c[0] + 1) / 2, (c[1] + 1) / 2, (c[2] + 1) / 2];
    this.most = { wheels: W, boards: B, looms: L };
    this.wheels = W
      ? {
          flywheel: make(this.tube, TIMBER, W),
          shaft: make(this.box, TIMBER, W),
          head: make(this.tube, TIMBER, W),
          kick: make(this.box, TIMBER, W),
          pot: make(this.tube, colours.raw, W),
        }
      : null;
    this.boards = B
      ? {
          plank: make(this.box, TIMBER, B),
          trestle: make(this.box, TIMBER, 2 * B),
          body: make(this.tube, colours.raw, B * BOARD_MOST),
          neck: make(this.tube, colours.raw, B * BOARD_MOST),
        }
      : null;
    this.looms = L
      ? {
          post: make(this.box, TIMBER, 2 * L),
          beam: make(this.box, TIMBER, L),
          cloth: make(this.box, colours.cloth, L),
          warp: make(this.box, warp, L),
          heddle: make(this.box, TIMBER, L),
          weight: make(this.box, colours.fired, WEIGHTS * L),
        }
      : null;
    this.clamp = counts.clamp
      ? {
          wood: make(this.cone, WOOD, 1),
          earth: make(this.cone, EARTH, 1),
          charcoal: make(this.cone, CHARCOAL, 1),
          smoke: make(this.box, SMOKE, PUFFS, this.smokeMaterial),
        }
      : null;
    this.shown = { wheels: 0, turning: 0, pots: 0, looms: 0, weaving: 0, clamp: null };
  }

  /**
   * The crafts now, by the screen's clock `s`: each wheel's kick-bar turning and its pot rising on the
   * head as it is thrown; the boards' pots set out to dry; each loom's cloth growing down it and its
   * heddle working while it is woven at; the clamp at its stage, smoking while it is lit. Every batch
   * is set each time (count 0 where nothing is drawn). `motion` false holds the small motions still.
   */
  update(
    s: number,
    motion: boolean,
    now: {
      wheels: readonly WheelAt[];
      boards: readonly BoardsAt[];
      looms: readonly LoomAt[];
      clamp: ClampAt | null;
    },
  ): void {
    const c = now.clamp,
      wheels = now.wheels.slice(0, this.most.wheels),
      boards = now.boards.slice(0, this.most.boards),
      looms = now.looms.slice(0, this.most.looms),
      // (The pots thrown on the wheels, and the pots set out on the boards, each where it stands.)
      thrown = wheels.flatMap((w) => (w.pot ? [{ w, pot: w.pot }] : [])),
      dried = boards.flatMap((b) =>
        b.pots
          .slice(0, BOARD_MOST)
          .map((p, k) => ({ at: boardSlot(b, k), yaw: b.yaw, form: p.form })),
      ),
      necks = dried.filter((p) => hasNeck(p.form));
    this.shown.wheels = wheels.length;
    this.shown.turning = wheels.filter((w) => w.turning).length;
    this.shown.pots = dried.length;
    this.shown.looms = looms.length;
    this.shown.weaving = looms.filter((l) => l.weaving).length;
    this.shown.clamp = this.clamp && c ? { stage: c.stage, smoking: c.lit } : null;

    if (this.wheels) {
      const { flywheel, shaft, head, kick, pot } = this.wheels;
      flywheel.set(wheels.length, (i, out) => {
        const w = wheels[i]!;
        put(out, w.x, 0.35, w.z, 2.4, 0.25, 2.4, w.yaw);
      });
      shaft.set(wheels.length, (i, out) => {
        const w = wheels[i]!;
        put(out, w.x, 1.55, w.z, 0.18, 2.4, 0.18, w.yaw);
      });
      head.set(wheels.length, (i, out) => {
        const w = wheels[i]!;
        put(out, w.x, 2.75, w.z, 1.2, 0.18, 1.2, w.yaw);
      });
      kick.set(wheels.length, (i, out) => {
        const w = wheels[i]!;
        put(out, w.x, 0.5, w.z, 2.2, 0.12, 0.25, w.yaw + (w.turning && motion ? s * 5 : 0));
      });
      pot.set(thrown.length, (i, out) => {
        const { w, pot: p } = thrown[i]!,
          [height, width] = potShape(p.form),
          high = height * (0.25 + 0.75 * p.grown),
          across = width * (1.2 - 0.2 * p.grown);
        // (A lump of clay drawn up into the pot as it is thrown.)
        put(out, w.x, HEAD_TOP + high / 2, w.z, across, high, across, w.yaw);
      });
    }

    if (this.boards) {
      const { plank, trestle, body, neck } = this.boards,
        length = BOARD_MOST * BOARD_GAP + 0.6;
      plank.set(boards.length, (i, out) => {
        const b = boards[i]!;
        put(out, b.x, 2.1, b.z, length, 0.15, 1.3, b.yaw);
      });
      trestle.set(2 * boards.length, (i, out) => {
        const b = boards[Math.floor(i / 2)]!,
          // (One under each end, its outer face flush with the plank's.)
          along = (i % 2 ? 1 : -1) * (length / 2 - 0.15);
        put(
          out,
          b.x + Math.cos(b.yaw) * along,
          1.05,
          b.z - Math.sin(b.yaw) * along,
          0.3,
          2.1,
          1.1,
          b.yaw,
        );
      });
      body.set(dried.length, (i, out) => {
        const p = dried[i]!,
          [height, width] = potShape(p.form);
        put(
          out,
          p.at.x,
          BOARD_TOP + (0.75 * height) / 2,
          p.at.z,
          width,
          0.75 * height,
          width,
          p.yaw,
        );
      });
      neck.set(necks.length, (i, out) => {
        const p = necks[i]!,
          [height, width] = potShape(p.form);
        // (On the body's top, so its bottom sits where the body's top is.)
        put(
          out,
          p.at.x,
          BOARD_TOP + 0.875 * height,
          p.at.z,
          0.45 * width,
          0.25 * height,
          0.45 * width,
          p.yaw,
        );
      });
    }

    if (this.looms) {
      const { post, beam, cloth, warp, heddle, weight } = this.looms,
        woven = looms.filter((l) => l.woven >= 0.02);
      post.set(2 * looms.length, (i, out) => {
        const l = looms[Math.floor(i / 2)]!,
          along = (i % 2 ? 1 : -1) * 2.2;
        put(
          out,
          l.x + Math.cos(l.yaw) * along,
          3,
          l.z - Math.sin(l.yaw) * along,
          0.3,
          6,
          0.3,
          l.yaw,
        );
      });
      beam.set(looms.length, (i, out) => {
        const l = looms[i]!;
        put(out, l.x, 5.9, l.z, 4.8, 0.3, 0.35, l.yaw);
      });
      // (Hung from the beam: its top at the beam's foot, and growing down as it is woven.)
      cloth.set(woven.length, (i, out) => {
        const l = woven[i]!,
          high = fraction(l.woven) * 3.6;
        put(out, l.x, CLOTH_TOP - high / 2, l.z, 4.2, high, 0.1, l.yaw);
      });
      // (Running from the cloth's lower edge down to the weights, whole before any is woven.)
      warp.set(looms.length, (i, out) => {
        const l = looms[i]!,
          edge = CLOTH_TOP - fraction(l.woven) * 3.6;
        put(out, l.x, (edge + WARP_END) / 2, l.z, 4, edge - WARP_END, 0.04, l.yaw);
      });
      heddle.set(looms.length, (i, out) => {
        const l = looms[i]!,
          // (Shifted along the loom while it is woven at.)
          along = motion && l.weaving ? 0.25 * Math.sin(s * 3) : 0;
        put(
          out,
          l.x + Math.sin(l.yaw) * along,
          3.4,
          l.z + Math.cos(l.yaw) * along,
          4.6,
          0.12,
          0.12,
          l.yaw,
        );
      });
      weight.set(WEIGHTS * looms.length, (i, out) => {
        const l = looms[Math.floor(i / WEIGHTS)]!,
          along = -1.9 + ((i % WEIGHTS) * 3.8) / (WEIGHTS - 1);
        put(
          out,
          l.x + Math.cos(l.yaw) * along,
          1.1,
          l.z - Math.sin(l.yaw) * along,
          0.35,
          0.45,
          0.35,
          l.yaw,
        );
      });
    }

    if (this.clamp) {
      const { wood, earth, charcoal, smoke } = this.clamp,
        shape = clampShape(c),
        x = c?.x ?? 0,
        z = c?.z ?? 0;
      standOn(wood, shape.wood, x, z);
      standOn(earth, shape.earth, x, z);
      standOn(charcoal, shape.charcoal, x, z);
      smoke.set(c?.lit ? PUFFS : 0, (j, out) => {
        // (Each puff climbs from the top and spreads as it goes; held still where small motions
        // are not drawn.)
        const age = motion ? (s * 0.12 + j / PUFFS) % 1 : j / PUFFS,
          size = 1.1 + age * 3.4;
        put(
          out,
          x + age * age * 4,
          shape.top + age * 14,
          z + age * age * 1.5,
          size,
          0.8 * size,
          size,
          0,
        );
      });
    }
  }

  /** Destroy its batches and its entity. */
  destroy(): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.wheels = this.boards = this.looms = this.clamp = null;
    this.root.destroy();
  }
}
