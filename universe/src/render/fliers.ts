// The craft that fly a town's sky past our ages (Phase 66): a flat hull in its lane with a light at each
// end, by the screen's clock as the beasts are. Their lanes are the view's (view/town.ts), never history's.
import * as pc from "playcanvas";
import { flierAt, type Flier } from "../view/index.ts";
import { InstancedBatch, boxMesh } from "./batch.ts";
import type { Stage } from "./stage.ts";

/** Units to a metre, as the village's. */
const M = 0.1;
/** What a craft is, in metres: long, broad and high. */
const LONG = 13,
  BROAD = 5,
  HIGH = 2.4;

function lit(r: number, g: number, b: number): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.useLighting = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(r, g, b);
  m.update();
  return m;
}

export class FlierLayer {
  private readonly root: pc.Entity;
  private readonly stage: Stage;
  private hulls: InstancedBatch | null = null;
  private lamps: InstancedBatch | null = null;
  private list: readonly Flier[] = [];

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.root = new pc.Entity("fliers");
    parent.addChild(this.root);
  }

  /** The town's craft, as its plan has them. */
  build(list: readonly Flier[]): void {
    this.list = list;
    if (!list.length) {
      this.hulls?.set(0, () => {});
      this.lamps?.set(0, () => {});
      return;
    }
    const most = 64;
    this.hulls ??= new InstancedBatch(
      this.stage,
      boxMesh(this.stage),
      [0.62, 0.66, 0.72],
      most,
      this.root,
    );
    this.lamps ??= new InstancedBatch(
      this.stage,
      boxMesh(this.stage),
      [1, 0.9, 0.6],
      most,
      this.root,
      lit(1, 0.9, 0.6),
    );
  }

  /** Each where it is by the screen's clock. */
  update(clock: number): void {
    const list = this.list;
    if (!list.length || !this.hulls || !this.lamps) return;
    this.hulls.set(list.length, (i, out) => {
      const f = flierAt(list[i]!, clock);
      out[0] = f.x * M;
      out[1] = f.y * M;
      out[2] = f.z * M;
      out[3] = BROAD * M;
      out[4] = HIGH * M;
      out[5] = LONG * M;
      out[6] = f.yaw;
    });
    this.lamps.set(list.length, (i, out) => {
      const f = flierAt(list[i]!, clock);
      out[0] = f.x * M;
      out[1] = (f.y + HIGH * 0.6) * M;
      out[2] = f.z * M;
      out[3] = BROAD * 0.5 * M;
      out[4] = 0.5 * M;
      out[5] = LONG * 1.06 * M;
      out[6] = f.yaw;
    });
  }

  destroy(): void {
    this.hulls?.destroy();
    this.lamps?.destroy();
    this.root.destroy();
  }
}
