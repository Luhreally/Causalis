// Hardware-instanced batches: one mesh, one material, many copies in one draw
// call, placed by a buffer of per-instance matrices. Crowds, forests, buildings
// and fleets are drawn this way; entities exist only for the batch, never per
// simulated thing.
import * as pc from "playcanvas";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

export class InstancedBatch {
  readonly capacity: number;
  private readonly matrices: Float32Array;
  private readonly buffer: pc.VertexBuffer;
  private readonly instance: pc.MeshInstance;
  private readonly entity: pc.Entity;
  private count = 0;

  constructor(stage: Stage, mesh: pc.Mesh, color: Rgb, capacity: number, parent?: pc.Entity) {
    this.capacity = capacity;
    this.matrices = new Float32Array(capacity * 16);
    this.instance = new pc.MeshInstance(mesh, flatMaterial(color));
    const format = pc.VertexFormat.getDefaultInstancingFormat(stage.device);
    this.buffer = new pc.VertexBuffer(stage.device, format, capacity, {
      usage: pc.BUFFER_DYNAMIC,
      data: this.matrices,
    });
    this.instance.setInstancing(this.buffer);
    this.instance.instancingCount = 0;
    this.entity = new pc.Entity("batch");
    this.entity.addComponent("render", { meshInstances: [this.instance] });
    (parent ?? stage.root).addChild(this.entity);
  }

  /** Change the colour of every instance. */
  recolor(color: Rgb): void {
    const m = this.instance.material as pc.StandardMaterial;
    m.diffuse.set(color[0], color[1], color[2]);
    m.update();
  }

  /**
   * Replace the instances: `place(i, out)` writes instance i's translation and
   * scale into out ([x, y, z, sx, sy, sz, yaw]).
   */
  set(count: number, place: (i: number, out: number[]) => void): void {
    const n = Math.min(count, this.capacity),
      t = [0, 0, 0, 1, 1, 1, 0],
      m = this.matrices;
    for (let i = 0; i < n; i++) {
      place(i, t);
      const [x, y, z, sx, sy, sz, yaw] = t as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      const c = Math.cos(yaw),
        s = Math.sin(yaw),
        o = i * 16;
      m[o] = c * sx;
      m[o + 1] = 0;
      m[o + 2] = -s * sx;
      m[o + 3] = 0;
      m[o + 4] = 0;
      m[o + 5] = sy;
      m[o + 6] = 0;
      m[o + 7] = 0;
      m[o + 8] = s * sz;
      m[o + 9] = 0;
      m[o + 10] = c * sz;
      m[o + 11] = 0;
      m[o + 12] = x;
      m[o + 13] = y;
      m[o + 14] = z;
      m[o + 15] = 1;
    }
    this.count = n;
    this.buffer.setData(this.matrices);
    this.instance.instancingCount = n;
  }

  get size(): number {
    return this.count;
  }

  destroy(): void {
    this.entity.destroy();
    this.buffer.destroy();
  }
}

export function capsuleMesh(stage: Stage, radius: number, height: number): pc.Mesh {
  return pc.Mesh.fromGeometry(stage.device, new pc.CapsuleGeometry({ radius, height, sides: 8 }));
}

/** A cone (a pyramid, with few sides): for pitched roofs, round roofs and tents. */
export function coneMesh(stage: Stage, radius: number, height: number, sides: number): pc.Mesh {
  return pc.Mesh.fromGeometry(
    stage.device,
    new pc.ConeGeometry({ baseRadius: radius, peakRadius: 0, height, capSegments: sides }),
  );
}

export function cylinderMesh(stage: Stage, radius: number, height: number, sides = 24): pc.Mesh {
  return pc.Mesh.fromGeometry(
    stage.device,
    new pc.CylinderGeometry({ radius, height, capSegments: sides }),
  );
}
