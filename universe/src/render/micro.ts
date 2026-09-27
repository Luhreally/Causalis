// The microscope (Phase 9 M89): a drop of the first seas, and what lives in it — cells'
// skins, translucent; their nuclei, dark; their small working parts, bright — each kind a
// batch of spheres, placed afresh every frame from the drop the view gives.
import * as pc from "playcanvas";
import type { CellPart, Drop } from "../view/index.ts";
import { InstancedBatch, keptMesh } from "./batch.ts";
import { flatMaterial, type Stage } from "./stage.ts";

const MOST = 400;

export class MicroScene {
  readonly root = new pc.Entity("drop");
  private readonly skins: InstancedBatch;
  private readonly nuclei: InstancedBatch;
  private readonly bits: InstancedBatch;

  constructor(stage: Stage) {
    const ball = keptMesh(
      pc.Mesh.fromGeometry(
        stage.device,
        new pc.SphereGeometry({ radius: 0.5, latitudeBands: 8, longitudeBands: 12 }),
      ),
    );
    this.skins = new InstancedBatch(
      stage,
      ball,
      [0.46, 0.86, 0.74],
      MOST,
      this.root,
      flatMaterial([0.46, 0.86, 0.74], 0.55, 0.6, 0.3),
    );
    this.nuclei = new InstancedBatch(stage, ball, [0.36, 0.2, 0.5], MOST, this.root);
    this.bits = new InstancedBatch(stage, ball, [1, 0.62, 0.24], MOST, this.root);
    stage.root.addChild(this.root);
    this.root.enabled = false;
  }

  get visible(): boolean {
    return this.root.enabled;
  }
  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** Put everything in the drop where the view says it is now. */
  update(d: Drop): void {
    const place = (batch: InstancedBatch, list: readonly CellPart[]) =>
      batch.set(list.length, (i, out) => {
        const p = list[i]!;
        out[0] = p.x;
        out[1] = p.y;
        out[2] = p.z;
        out[3] = p.sx;
        out[4] = p.sy;
        out[5] = p.sz;
        out[6] = p.yaw;
        out[7] = p.pitch;
      });
    place(this.skins, d.skins.slice(0, MOST));
    place(this.nuclei, d.nuclei.slice(0, MOST));
    place(this.bits, d.bits.slice(0, MOST));
  }
}
