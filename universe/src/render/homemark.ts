// The home mark (Lives L1): a gold column with a ring at its foot, standing on the home where
// the god's hand is laid in a village. Hidden until set; screen() says where its top stands.
import * as pc from "playcanvas";
import { cylinderMesh } from "./batch.ts";
import { flatMaterial, type Stage } from "./stage.ts";

const M = 0.1; // units per metre, as render/village.ts

export class HomeMark {
  private readonly stage: Stage;
  private readonly root = new pc.Entity("home-mark");
  private readonly column = new pc.Entity("home-mark-column");
  private readonly ring = new pc.Entity("home-mark-ring");
  private top: pc.Vec3 | null = null;

  constructor(stage: Stage) {
    this.stage = stage;
    stage.root.addChild(this.root);
    this.root.addChild(this.column);
    this.root.addChild(this.ring);
    const column = flatMaterial([1, 0.8, 0.25], 0.55);
    column.emissive = new pc.Color(1, 0.72, 0.2);
    column.update();
    this.column.addComponent("render", {
      meshInstances: [new pc.MeshInstance(cylinderMesh(stage, 0.5, 1, 8), column)],
    });
    const ring = flatMaterial([1, 0.8, 0.25], 0.85);
    ring.emissive = new pc.Color(1, 0.72, 0.2);
    ring.update();
    this.ring.addComponent("render", {
      meshInstances: [new pc.MeshInstance(cylinderMesh(stage, 0.5, 1, 24), ring)],
    });
    this.root.enabled = false;
  }

  /** Stand the mark on the home at (x, z) metres, its column `top` metres high. */
  set(x: number, z: number, top: number): void {
    this.root.enabled = true;
    this.root.setLocalPosition(x * M, 0, z * M);
    this.column.setLocalPosition(0, (top * M) / 2, 0);
    this.column.setLocalScale(0.1, top * M, 0.1);
    this.ring.setLocalPosition(0, 0.03, 0);
    this.ring.setLocalScale(1.8, 0.02, 1.8);
    this.top = new pc.Vec3(x * M, top * M, z * M);
  }

  clear(): void {
    this.root.enabled = false;
    this.top = null;
  }

  /** Where the column's top stands on the screen (CSS pixels), or null out of sight. */
  screen(): { x: number; y: number } | null {
    if (!this.top) return null;
    const p = this.stage.camera.camera!.worldToScreen(this.top);
    return p.z > 0 ? { x: p.x, y: p.y } : null;
  }
}
