// A town's water, drains and power drawn (view/networks.ts says what and where): two instanced batches, its boxes and its rounds,
// faded in the vertex shader by how far each thing stands from the eye, each by its block's own rank (stage.ts fadedMaterial, as
// what grows on a land is): within the core all are drawn, past it fewer as the square of the core over the distance, none past
// the reach; one half drawn is drawn at half its size, shrunk to its foot, so a run comes and goes by degrees and nothing moves
// with the eye. Laid once a plan, and again only when the eye has gone far from where it was laid about (its farthest are past
// the reach then, so nothing is seen to come or go); each frame only the eye is told. No shadows: thin and flat, and a pass.
import * as pc from "playcanvas";
import { townNets, type NetPart, type TownNets, type TownScene } from "../view/index.ts";
import { InstancedBatch, boxMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { fadedMaterial, type Stage } from "./stage.ts";

/** Units a metre, as the town's view draws (render/village.ts M). */
const M = 0.1;
/** Within the core (units) all are drawn; past the reach none. */
export const NETS_CORE = 10;
export const NETS_REACH = 26;
/** How far the eye's mark on the ground may go from where the networks were laid about before they are laid again (metres). */
const RELAY = 100;

export class TownNetsLayer {
  readonly root = new pc.Entity("town-nets");
  private readonly stage: Stage;
  private readonly box: pc.Mesh;
  private readonly cyl: pc.Mesh;
  private boxes: InstancedBatch | null = null;
  private rounds: InstancedBatch | null = null;
  private scene: TownScene | null = null;
  private laidAt = { x: 0, z: 0 };
  /** What was laid last (for the checks and the town's page). */
  laid: TownNets["counts"] | null = null;

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.box = keptMesh(boxMesh(stage));
    this.cyl = keptMesh(cylinderMesh(stage, 0.5, 1, 6));
    parent.addChild(this.root);
  }

  /** A town's scene to lay its networks on (null: none), about where the eye looks (metres from its square). */
  build(scene: TownScene | null, focus = { x: 0, z: 0 }): void {
    this.scene = scene;
    this.laidAt = { ...focus };
    const nets = scene ? townNets(scene, focus) : null;
    this.laid = nets?.counts ?? null;
    this.boxes = this.put(this.boxes, this.box, nets?.boxes ?? []);
    this.rounds = this.put(this.rounds, this.cyl, nets?.rounds ?? []);
  }

  /** Where the eye looks on the town (metres from its square): laid again about it once it has gone far. */
  look(x: number, z: number): void {
    if (!this.scene || Math.hypot(x - this.laidAt.x, z - this.laidAt.z) < RELAY) return;
    this.build(this.scene, { x, z });
  }

  /** Each frame: where the eye is (world units). */
  update(eye: pc.Vec3): void {
    const near = [eye.x, eye.y, eye.z, NETS_CORE],
      k = [1, 1, NETS_REACH, 0];
    for (const b of [this.boxes, this.rounds]) {
      if (!b) continue;
      b.param("uNear", near);
      b.param("uNearK", k);
    }
  }

  private put(
    b: InstancedBatch | null,
    mesh: pc.Mesh,
    list: readonly NetPart[],
  ): InstancedBatch | null {
    if (!list.length) {
      b?.set(0, () => {});
      return b;
    }
    if (!b || b.capacity < list.length) {
      b?.destroy();
      b = new InstancedBatch(
        this.stage,
        mesh,
        [1, 1, 1],
        Math.max(64, Math.ceil(list.length * 1.25)),
        this.root,
        fadedMaterial(0.2),
        true,
      );
      b.shadows(false);
    }
    let x0 = Infinity,
      x1 = -Infinity,
      z0 = Infinity,
      z1 = -Infinity,
      y1 = 0;
    b.set(list.length, (i, out) => {
      const p = list[i]!;
      out[0] = p.x * M;
      out[1] = p.y * M;
      out[2] = p.z * M;
      out[3] = p.sx * M;
      out[4] = p.sy * M;
      out[5] = p.sz * M;
      out[6] = p.yaw;
      out[8] = p.color[0];
      out[9] = p.color[1];
      out[10] = p.color[2];
      x0 = Math.min(x0, out[0]);
      x1 = Math.max(x1, out[0]);
      z0 = Math.min(z0, out[2]);
      z1 = Math.max(z1, out[2]);
      y1 = Math.max(y1, out[1] + out[4]);
    });
    b.rank(list.length, (i) => list[i]!.rank);
    // (Bound to where they stand, so that a batch out of the eye's sight is not drawn at all.)
    b.bound([x0 - 4, 0, z0 - 4], [x1 + 4, y1 + 1, z1 + 4]);
    return b;
  }

  destroy(): void {
    this.boxes?.destroy();
    this.rounds?.destroy();
    this.boxes = this.rounds = null;
  }
}
