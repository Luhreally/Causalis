// The shallows seen from within (Live a Line, 2026-11-28: the seabed view). In the sea's ages the meadow is all water, and
// its lives are of the sea: the eye goes under. The floor is the meadow's own ground; the pool's flat face, drawn at the
// ground, is put by, so what walks and crawls there stands on the floor, never on a face of water; the water's face is
// drawn far overhead, seen from below, and the water itself is a blue haze that closes in with distance, as light does
// under water. Our own simple look. Laid in the meadow's frame (render/meadow.ts: 0.1 units a metre); the haze is the
// stage's own fog, its colour given back when the eye leaves the water.
import * as pc from "playcanvas";
import { groundQuadMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

const M = 0.1,
  WATER: Rgb = [0.12, 0.36, 0.44];

export class SeaView {
  private readonly face: pc.Entity;
  private readonly stage: Stage;
  private readonly parent: pc.Entity;
  private kept: { color: pc.Color } | null = null;
  private pool: pc.GraphNode | null = null;
  /** The water's face over the floor now (m; null: not under water), for the look tools. */
  over: number | null = null;

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.parent = parent;
    const m = flatMaterial([0.55, 0.82, 0.86], 0.45, 0.6, 0.3);
    // (Seen from below: both its sides drawn.)
    m.cull = pc.CULLFACE_NONE;
    m.update();
    this.face = new pc.Entity("line-sea-face");
    this.face.addComponent("render", {
      meshInstances: [new pc.MeshInstance(groundQuadMesh(stage), m)],
    });
    this.face.enabled = false;
    parent.addChild(this.face);
  }

  /**
   * Under water (`on`): the pool's face put by, the water's face `over` metres above the floor, `wide` metres across, and
   * the haze from `near` to `far` metres of the eye. Off: as it was.
   */
  update(on: boolean, over: number, wide: number, near: number, far: number): void {
    const fog = this.stage.app.scene.fog,
      pool = (this.pool ??= this.parent.findByName("pool"));
    if (!on) {
      if (this.kept) {
        fog.color.copy(this.kept.color);
        // (Back to no haze, as the mode keeps it: app/line.ts.)
        fog.start = 1e5;
        fog.end = 2e5;
        this.kept = null;
      }
      this.face.enabled = false;
      this.over = null;
      return;
    }
    if (pool instanceof pc.Entity) pool.enabled = false;
    this.face.enabled = true;
    this.over = over;
    this.face.setLocalPosition(0, over * M, 0);
    this.face.setLocalScale((wide / 2) * M, 1, (wide / 2) * M);
    if (!this.kept) this.kept = { color: fog.color.clone() };
    fog.color.set(WATER[0], WATER[1], WATER[2]);
    fog.start = near * M;
    fog.end = far * M;
  }
}
