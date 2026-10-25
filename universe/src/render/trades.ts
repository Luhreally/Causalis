// A town's trades seen at their buildings (Phase 41 M199): its mills' sails turning on their
// hubs, its kilns' mouths aglow while they are fired, and the sparks off the anvil before its
// smithy at each blow of the hammer. Units as the village's: a tenth of a unit to the metre; the
// sparks and the glow sized to its folk, drawn three times a person's size.
import * as pc from "playcanvas";
import type { CivicMotion } from "../view/index.ts";
import { InstancedBatch, boxMesh, keptMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

const M = 0.1;
/** A mill's sails: how many, how long and how broad (metres), how far out from the hub. */
const SAILS = 4,
  SAIL_LONG = 7,
  SAIL_WIDE = 1.7,
  /** Sparks to a blow, and a blow's length (screen seconds). */
  SPARKS = 7,
  BLOW = 0.62;
const CANVAS: Rgb = [0.93, 0.9, 0.82],
  EMBER: Rgb = [1, 0.46, 0.12],
  SPARK: Rgb = [1, 0.8, 0.36];

/** Who is at work at a kiln or a smithy now: where they stand and which way they face (metres). */
export type AtWork = { readonly x: number; readonly z: number; readonly yaw: number } | null;

export class TradesLayer {
  /** Its own entity, kept as the village is laid out again. */
  readonly root = new pc.Entity("trades");
  private readonly stage: Stage;
  private readonly box: pc.Mesh;
  private readonly ember: pc.StandardMaterial;
  private readonly spark: pc.StandardMaterial;
  private batches: InstancedBatch[] = [];
  private sails: InstancedBatch | null = null;
  private glow: InstancedBatch | null = null;
  private sparks: InstancedBatch | null = null;
  /** The mills, kilns and smithies drawn (the town's, as last laid out). */
  works: readonly CivicMotion[] = [];
  /** What was last drawn (the look tools): the first mill's sails' turn, the kilns aglow, the sparks flying. */
  shown = { turn: 0, glowing: 0, sparks: 0 };

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    parent.addChild(this.root);
    // (Held: its batches are made anew each time the town is laid out, and the last of them
    // ending would otherwise destroy it with itself.)
    this.box = keptMesh(boxMesh(stage));
    const lit = (c: Rgb) => {
      const m = new pc.StandardMaterial();
      m.useLighting = false;
      m.diffuse = new pc.Color(0, 0, 0);
      m.emissive = new pc.Color(c[0], c[1], c[2]);
      m.update();
      return m;
    };
    this.ember = lit(EMBER);
    this.spark = lit(SPARK);
  }

  /** The town's mills, kilns and smithies standing (none, a village). */
  build(works: readonly CivicMotion[]): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.works = works;
    const count = (k: CivicMotion["kind"]) => works.filter((w) => w.kind === k).length,
      make = (color: Rgb, n: number, material?: pc.Material) => {
        if (!n) return null;
        const b = new InstancedBatch(this.stage, this.box, color, n, this.root, material);
        this.batches.push(b);
        return b;
      };
    this.sails = make(CANVAS, count("mill") * SAILS);
    this.glow = make(EMBER, count("kiln"), this.ember);
    this.sparks = make(SPARK, count("smithy") * SPARKS, this.spark);
    this.shown = { turn: 0, glowing: 0, sparks: 0 };
  }

  /**
   * Their work now, by the screen's clock `s`: the sails turning (held still where small motions
   * are not drawn); each kiln aglow while one tends it, each smithy's anvil sparking while one
   * strikes at it (`busy`, by the works' order: who is at it, or null).
   */
  update(s: number, motion: boolean, busy: readonly AtWork[]): void {
    const works = this.works,
      clock = motion ? s : 0;
    if (this.sails) {
      const mills = works.filter((w) => w.kind === "mill"),
        r = SAIL_LONG / 2 + 0.4;
      this.sails.set(mills.length * SAILS, (i, out) => {
        const w = mills[Math.floor(i / SAILS)]!,
          k = Math.floor(i / SAILS),
          spin = clock * 0.8 + k * 1.3,
          p = spin + ((i % SAILS) * 2 * Math.PI) / SAILS,
          // (Turned about the hub's axis, which runs out of the mill's front.)
          yaw = w.yaw - Math.PI / 2,
          sy = Math.sin(yaw);
        if (i === 0) this.shown.turn = spin;
        out[0] = (w.x + sy * Math.sin(p) * r) * M;
        out[1] = (w.y + Math.cos(p) * r) * M;
        out[2] = (w.z + Math.cos(yaw) * Math.sin(p) * r) * M;
        out[3] = 0.3 * M;
        out[4] = SAIL_LONG * M;
        out[5] = SAIL_WIDE * M;
        out[6] = yaw;
        out[7] = p;
      });
    }
    // The kilns being fired: their mouths aglow, flickering.
    if (this.glow) {
      const fired = works
        .map((w, k) => ({ w, k }))
        .filter(({ w, k }) => w.kind === "kiln" && busy[k]);
      this.shown.glowing = fired.length;
      this.glow.set(fired.length, (i, out) => {
        const { w, k } = fired[i]!,
          flick = 0.85 + 0.15 * Math.sin(s * 11 + k * 2.3) * Math.sin(s * 3.7 + k);
        out[0] = w.x * M;
        out[1] = w.y * flick * M;
        out[2] = w.z * M;
        out[3] = 1.7 * M;
        out[4] = 1.3 * flick * M;
        out[5] = 0.3 * M;
        out[6] = w.yaw;
      });
    }
    // At each smithy where one strikes: sparks off the anvil before them, flung up and falling.
    if (this.sparks) {
      const anvils: { x: number; z: number; k: number }[] = [];
      works.forEach((w, k) => {
        const at = busy[k];
        if (w.kind !== "smithy" || !at) return;
        anvils.push({ x: at.x + Math.sin(at.yaw) * 2.2, z: at.z + Math.cos(at.yaw) * 2.2, k });
      });
      const n = anvils.length * SPARKS;
      this.shown.sparks = n;
      this.sparks.set(n, (i, out) => {
        const a = anvils[Math.floor(i / SPARKS)]!,
          j = i % SPARKS,
          blow = Math.floor(s / BLOW),
          q = (s / BLOW) % 1,
          turn = j * 2.1 + blow * 1.3 + a.k,
          far = (0.6 + 0.5 * ((j * 7 + blow) % 3)) * q * 2.4,
          size = 0.28 * (1 - q) + 0.05;
        out[0] = (a.x + Math.cos(turn) * far) * M;
        out[1] = (2.6 + q * 3.2 - q * q * 4.4) * M;
        out[2] = (a.z + Math.sin(turn) * far) * M;
        out[3] = out[4] = out[5] = size * M;
        out[6] = turn;
      });
    }
  }

  destroy(): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.root.destroy();
  }
}
