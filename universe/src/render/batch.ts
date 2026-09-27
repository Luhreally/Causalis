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

  constructor(
    stage: Stage,
    mesh: pc.Mesh,
    color: Rgb,
    capacity: number,
    parent?: pc.Entity,
    material?: pc.Material,
  ) {
    this.capacity = capacity;
    this.matrices = new Float32Array(capacity * 16);
    this.instance = new pc.MeshInstance(mesh, material ?? flatMaterial(color));
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
   * Replace the instances: `place(i, out)` writes instance i's translation, scale and
   * turn into out ([x, y, z, sx, sy, sz, yaw, pitch]; the pitch tips it about its own
   * x axis before it is turned, as a swinging limb).
   */
  set(count: number, place: (i: number, out: number[]) => void): void {
    const n = Math.min(count, this.capacity),
      t = [0, 0, 0, 1, 1, 1, 0, 0],
      m = this.matrices;
    for (let i = 0; i < n; i++) {
      t[7] = 0;
      place(i, t);
      const [x, y, z, sx, sy, sz, yaw, pitch] = t as [
        number,
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
        cp = Math.cos(pitch),
        sp = Math.sin(pitch),
        o = i * 16;
      // Turned by yaw after tipped by pitch: the columns of Ry·Rx, each scaled.
      m[o] = c * sx;
      m[o + 1] = 0;
      m[o + 2] = -s * sx;
      m[o + 3] = 0;
      m[o + 4] = s * sp * sy;
      m[o + 5] = cp * sy;
      m[o + 6] = c * sp * sy;
      m[o + 7] = 0;
      m[o + 8] = s * cp * sz;
      m[o + 9] = -sp * sz;
      m[o + 10] = c * cp * sz;
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

/**
 * A mesh shared by batches that come and go (a layer rebuilt as the year turns or the
 * setting changes): held, so that the last batch's end does not destroy it with itself.
 */
export function keptMesh(mesh: pc.Mesh): pc.Mesh {
  mesh.incRefCount();
  return mesh;
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

/** A box a unit each way about its middle, its faces square to its axes. */
export function boxMesh(stage: Stage): pc.Mesh {
  return pc.Mesh.fromGeometry(
    stage.device,
    new pc.BoxGeometry({ halfExtents: new pc.Vec3(0.5, 0.5, 0.5) }),
  );
}

/**
 * A gable roof a unit each way about its middle: two slopes meeting at a ridge along x,
 * a triangle at each end. Faceted: each face lit by its own normal.
 */
export function gableMesh(stage: Stage): pc.Mesh {
  const faces: (readonly [number, number, number])[][] = [
    // The slopes (+z, −z) and the ends (−x, +x), each outward.
    [
      [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0.5, 0.5, 0],
      [-0.5, 0.5, 0],
    ],
    [
      [0.5, -0.5, -0.5],
      [-0.5, -0.5, -0.5],
      [-0.5, 0.5, 0],
      [0.5, 0.5, 0],
    ],
    [
      [-0.5, -0.5, -0.5],
      [-0.5, -0.5, 0.5],
      [-0.5, 0.5, 0],
    ],
    [
      [0.5, -0.5, 0.5],
      [0.5, -0.5, -0.5],
      [0.5, 0.5, 0],
    ],
  ];
  const positions: number[] = [],
    normals: number[] = [],
    indices: number[] = [];
  for (const f of faces) {
    const [a, b, c] = f as [(typeof f)[0], (typeof f)[0], (typeof f)[0]],
      u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]],
      n = [
        u[1]! * v[2]! - u[2]! * v[1]!,
        u[2]! * v[0]! - u[0]! * v[2]!,
        u[0]! * v[1]! - u[1]! * v[0]!,
      ],
      len = Math.hypot(n[0]!, n[1]!, n[2]!) || 1,
      base = positions.length / 3;
    for (const p of f) {
      positions.push(p[0], p[1], p[2]);
      normals.push(n[0]! / len, n[1]! / len, n[2]! / len);
    }
    for (let k = 1; k + 1 < f.length; k++) indices.push(base, base + k, base + k + 1);
  }
  const mesh = new pc.Mesh(stage.device);
  mesh.setPositions(positions);
  mesh.setNormals(normals);
  mesh.setIndices(indices);
  mesh.update();
  return mesh;
}
