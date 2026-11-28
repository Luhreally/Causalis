// The line's courting and its nest, in the creature stage (Live a Line, 2026-11-28: mates and nest). Our own simple look:
// hearts rising off the pair while they court, then a nest where they made it. On land a ring of twigs on the ground,
// its eggs in it. In the shallows only the eggs on the bed, which is the sea's, and the young are the sea's. All of it lies
// on the ground (y 0, the meadow's), never on water unless the line lives there (the nest's place is chosen so:
// app/line-creature.ts). Laid in the meadow's own frame (render/meadow.ts: 0.1 units a metre).
import * as pc from "playcanvas";
import { InstancedBatch, ballMesh, cylinderMesh } from "./batch.ts";
import type { Stage } from "./stage.ts";

const M = 0.1,
  TWIGS = 12,
  EGGS = 4,
  HEARTS = 6,
  CRUMBS = 7,
  /** How long a bite's crumbs fly (s). */
  BITE = 0.55;

export type NestDrawn = {
  /** A bite just taken: at the mouth (m), how long since (s), the body's drawn size (m), its heading; null: none. */
  readonly bite?: {
    x: number;
    z: number;
    t: number;
    size: number;
    heading: number;
    y: number;
  } | null;
  /** The pair's middle while they court (m), or null. */
  readonly court: { x: number; z: number; t: number; size: number } | null;
  /** The nest (m), its size (the line's body length, m), its eggs, whether under water. */
  readonly nest: {
    x: number;
    z: number;
    size: number;
    eggs: number;
    wet: boolean;
    /** Laid on the sea's floor (the shallows seen from within: render/line-sea.ts), not afloat on a pool. */
    bed: boolean;
  } | null;
};

export class LineNest {
  private readonly twigs: InstancedBatch;
  private readonly eggs: InstancedBatch;
  private readonly hearts: InstancedBatch;
  private readonly crumbs: InstancedBatch;

  constructor(stage: Stage, parent: pc.Entity) {
    const rod = cylinderMesh(stage, 0.5, 1, 6),
      ball = ballMesh(stage, 0.5, 6);
    this.twigs = new InstancedBatch(stage, rod, [0.45, 0.33, 0.2], TWIGS, parent);
    this.eggs = new InstancedBatch(stage, ball, [0.93, 0.9, 0.8], EGGS, parent);
    this.hearts = new InstancedBatch(stage, ball, [1, 0.45, 0.62], HEARTS, parent);
    this.crumbs = new InstancedBatch(stage, ball, [0.62, 0.78, 0.36], CRUMBS, parent);
  }

  update(d: NestDrawn): void {
    const n = d.nest;
    if (n) {
      const r = n.size * 0.55 * M,
        w = Math.max(0.004, n.size * 0.06 * M);
      // (Its twigs lie on the ground, each tangent to the ring and resting on it: y is its own half-thickness.)
      this.twigs.set(n.wet ? 0 : TWIGS, (i, out) => {
        const a = (i / TWIGS) * Math.PI * 2 + (i % 2) * 0.2;
        out[0] = n.x * M + Math.cos(a) * r;
        out[1] = w / 2;
        out[2] = n.z * M + Math.sin(a) * r;
        out[3] = out[5] = w;
        out[4] = r * 0.9;
        out[6] = -a;
        out[7] = Math.PI / 2;
      });
      const e = Math.max(0.006, n.size * 0.16 * M);
      this.eggs.set(Math.min(EGGS, n.eggs), (i, out) => {
        const a = i * 2.4;
        out[0] = n.x * M + Math.cos(a) * r * 0.35;
        // (On the ground; a water life's float, as spawn does, just above the pool's face: render/meadow.ts 0.027.)
        out[1] = n.wet && !n.bed ? 0.027 + e * 0.3 : e * 0.55;
        out[2] = n.z * M + Math.sin(a) * r * 0.35;
        out[3] = out[5] = e;
        out[4] = e * 1.25;
      });
    } else {
      this.twigs.set(0, () => {});
      this.eggs.set(0, () => {});
    }
    const c = d.court;
    if (c) {
      const h = Math.max(0.01, c.size * 0.12 * M);
      // (Each heart rises a body's height above the pair and fades by shrinking, the next after it.)
      this.hearts.set(HEARTS, (i, out) => {
        const p = (c.t * 0.6 + i / HEARTS) % 1;
        out[0] = c.x * M + Math.sin(i * 2.1 + c.t) * c.size * 0.2 * M;
        out[1] = c.size * (0.8 + p * 0.9) * M;
        out[2] = c.z * M + Math.cos(i * 1.7) * c.size * 0.2 * M;
        out[3] = out[4] = out[5] = h * (1 - p * 0.8);
      });
    } else this.hearts.set(0, () => {});
    // (A bite: crumbs thrown up and out from the mouth, falling back and shrinking away, none below the ground.)
    const b = d.bite;
    if (b && b.t < BITE) {
      const p = b.t / BITE,
        c = Math.max(0.004, b.size * 0.07 * M) * (1 - p * 0.7);
      this.crumbs.set(CRUMBS, (i, out) => {
        const a = b.heading + (i / CRUMBS - 0.5) * 2.4,
          out1 = b.size * 0.5 * p * M;
        out[0] = b.x * M + Math.sin(a) * out1;
        out[1] = Math.max(
          c / 2,
          b.y * M + b.size * M * (0.6 * p - 1.1 * p * p) * (0.6 + (i % 3) * 0.2),
        );
        out[2] = b.z * M + Math.cos(a) * out1;
        out[3] = out[4] = out[5] = c;
      });
    } else this.crumbs.set(0, () => {});
  }

  destroy(): void {
    this.twigs.destroy();
    this.eggs.destroy();
    this.hearts.destroy();
    this.crumbs.destroy();
  }
}
