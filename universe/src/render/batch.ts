// Hardware-instanced batches: one mesh, one material, many copies in one draw
// call, placed by a buffer of per-instance matrices. Crowds, forests, buildings
// and fleets are drawn this way; entities exist only for the batch, never per
// simulated thing.
import * as pc from "playcanvas";
import { flatMaterial, toneOf, tonedMaterial, type Rgb, type Stage } from "./stage.ts";
import { BEAST_SHAPES } from "../view/index.ts";

/** From how great an upload a batch is given a fresh store first (bytes: a few thousand instances). */
const ORPHAN_BYTES = 1 << 18;

export class InstancedBatch {
  readonly capacity: number;
  private readonly matrices: Float32Array;
  private readonly buffer: pc.VertexBuffer;
  private readonly instance: pc.MeshInstance;
  private readonly entity: pc.Entity;
  private readonly toned: boolean;
  private count = 0;

  constructor(
    stage: Stage,
    mesh: pc.Mesh,
    color: Rgb,
    capacity: number,
    parent?: pc.Entity,
    material?: pc.Material,
    /** Each instance carries its own colour (stage.ts tonedMaterial): set() reads it from out[8 … 10]; `color` is not used. */
    toned = false,
  ) {
    this.capacity = capacity;
    this.toned = toned;
    this.matrices = new Float32Array(capacity * 16);
    this.instance = new pc.MeshInstance(
      mesh,
      material ?? (toned ? tonedMaterial() : flatMaterial(color)),
    );
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
   * Each instance's rank (0 … 1), carried in its matrix's last corner for a faded material (stage.ts fadedMaterial), with how
   * high its foot stands over the ground (`liftOf`, region units: a crown on its trunk), in 256ths, as twice a whole number
   * over it: 1 + rank + 2 * round(lift * 256).
   */
  rank(count: number, rankOf: (i: number) => number, liftOf?: (i: number) => number): void {
    const n = Math.min(count, this.count),
      m = this.matrices;
    for (let i = 0; i < n; i++)
      m[i * 16 + 15] =
        1 + Math.min(0.9999, rankOf(i)) + 2 * Math.round(Math.max(0, liftOf?.(i) ?? 0) * 256);
    this.upload(n);
  }

  /** A uniform of its material (a faded material's point and reach). */
  param(name: string, value: number[]): void {
    this.instance.material.setParameter(name, value);
  }

  /** How far its instances are whitened (0 … 1: snow on a toned batch of roofs). */
  toneSnow(k: number): void {
    this.instance.material.setParameter("uToneSnow", k);
  }

  /**
   * Bound it to the box its instances stand in (`lo` … `hi`, in its parent's units), so that it is not drawn at all where
   * that box is out of the eye's sight (by default an instanced batch is drawn wherever it is).
   */
  bound(lo: readonly number[], hi: readonly number[]): void {
    const box = (this.bounds ??= new pc.BoundingBox());
    if (!(hi[0]! >= lo[0]!)) {
      this.instance.cull = false;
      return;
    }
    box.center.set((lo[0]! + hi[0]!) / 2, (lo[1]! + hi[1]!) / 2, (lo[2]! + hi[2]!) / 2);
    box.halfExtents.set((hi[0]! - lo[0]!) / 2, (hi[1]! - lo[1]!) / 2, (hi[2]! - lo[2]!) / 2);
    this.instance.setCustomAabb(box);
    this.instance.cull = true;
  }
  private bounds: pc.BoundingBox | null = null;

  /** Whether it is drawn at all (what lies under snow: grass). */
  drawn(on: boolean): void {
    if (this.entity.enabled !== on) this.entity.enabled = on;
  }

  /** Whether it casts shadows (fire, smoke and dust: not). */
  shadows(on: boolean): this {
    if (this.entity.render) this.entity.render.castShadows = on;
    return this;
  }

  /** What it glows as, drawn in a material of its own light. */
  glow(color: Rgb): void {
    const m = this.instance.material as pc.StandardMaterial;
    m.emissive.set(color[0], color[1], color[2]);
    m.update();
  }

  /**
   * Replace the instances: `place(i, out)` writes instance i's translation, scale and
   * turn into out ([x, y, z, sx, sy, sz, yaw, pitch]; the pitch tips it about its own
   * x axis before it is turned, as a swinging limb).
   */
  set(count: number, place: (i: number, out: number[]) => void): void {
    const n = Math.min(count, this.capacity),
      t = [0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1],
      m = this.matrices,
      toned = this.toned;
    for (let i = 0; i < n; i++) {
      t[7] = 0;
      place(i, t);
      placeInstance(m, i * 16, t, toned);
    }
    this.count = n;
    this.upload(n);
    this.instance.instancingCount = n;
  }

  /**
   * Replace the instances by their matrices written straight into the batch (`write(m)` writes the
   * first `count` of them, sixteen numbers each, as set() lays them out): for a town's people,
   * posed part by part and kept from frame to frame (render/folk.ts).
   */
  setMatrices(count: number, write: (m: Float32Array) => void): void {
    const n = Math.min(count, this.capacity);
    write(this.matrices);
    this.count = n;
    this.upload(n);
    this.instance.instancingCount = n;
  }

  /**
   * Send the first `n` instances to the GPU, and only those: a batch is sized for the most it
   * may hold, and most frames it holds far fewer (a village's beasts out of sight, a herd at
   * rest), so sending the whole of it every frame sent mostly nothing.
   */
  private upload(n: number): void {
    const impl = (this.buffer as unknown as { impl?: { bufferId?: WebGLBuffer | null } }).impl,
      gl = (this.buffer.device as unknown as { gl?: WebGL2RenderingContext }).gl;
    if (!gl || !impl?.bufferId) {
      this.buffer.setData(this.matrices);
      return;
    }
    if (!n) return;
    // (The buffer's store is this very array, so a restored context re-sends it whole.)
    gl.bindBuffer(gl.ARRAY_BUFFER, impl.bufferId);
    // (A great batch is given a fresh store before it is written: written into the store the frame before is still drawing
    // from, the driver waits for that frame to be drawn, and a land's towns, laid again as the year turns, held a phone's
    // frame a second and more so: 2026-11-20. Its old store goes when that frame is done with it.)
    if (n * 64 >= ORPHAN_BYTES) gl.bufferData(gl.ARRAY_BUFFER, this.capacity * 64, gl.DYNAMIC_DRAW);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.matrices, 0, n * 16);
  }

  /**
   * Replace the instances, each stood on its own up and turned to its own ahead (a mark on
   * a globe): `place(i, out)` writes [x, y, z, sx, sy, sz, upx, upy, upz, aheadx, aheady,
   * aheadz]; its x runs across, its y up, its z ahead.
   */
  setBasis(count: number, place: (i: number, out: number[]) => void): void {
    const n = Math.min(count, this.capacity),
      t = [0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1],
      m = this.matrices;
    for (let i = 0; i < n; i++) {
      place(i, t);
      const [x, y, z, sx, sy, sz, ux, uy, uz, ax, ay, az] = t as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      // Ahead, square to up; across, square to both.
      const d = ax * ux + ay * uy + az * uz;
      let fx = ax - d * ux,
        fy = ay - d * uy,
        fz = az - d * uz;
      const fl = Math.hypot(fx, fy, fz) || 1;
      fx /= fl;
      fy /= fl;
      fz /= fl;
      const rx = uy * fz - uz * fy,
        ry = uz * fx - ux * fz,
        rz = ux * fy - uy * fx,
        o = i * 16;
      m[o] = rx * sx;
      m[o + 1] = ry * sx;
      m[o + 2] = rz * sx;
      m[o + 3] = 0;
      m[o + 4] = ux * sy;
      m[o + 5] = uy * sy;
      m[o + 6] = uz * sy;
      m[o + 7] = 0;
      m[o + 8] = fx * sz;
      m[o + 9] = fy * sz;
      m[o + 10] = fz * sz;
      m[o + 11] = 0;
      m[o + 12] = x;
      m[o + 13] = y;
      m[o + 14] = z;
      m[o + 15] = 1;
    }
    this.count = n;
    this.upload(n);
    this.instance.instancingCount = n;
  }

  /**
   * A toned batch's instances' colours written again (the first `count`, each `colorOf(i)`), where set() writes them: for
   * instances laid by setBasis, which writes none.
   */
  tone(count: number, colorOf: (i: number) => readonly [number, number, number]): void {
    if (!this.toned) return;
    const n = Math.min(count, this.count),
      m = this.matrices;
    for (let i = 0; i < n; i++) {
      const c = colorOf(i),
        o = i * 16;
      m[o + 3] = toneOf(c[0]);
      m[o + 7] = toneOf(c[1]);
      m[o + 11] = toneOf(c[2]);
    }
    this.upload(n);
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
 * One instance's matrix written into `m` at `o` from [x, y, z, sx, sy, sz, yaw, pitch, r, g, b], as InstancedBatch.set()
 * lays it out (its colour only for a batch toned instance by instance): for a layer that works its instances out over
 * frames and puts them all at once (render/town.ts PartBatches.showOver).
 */
export function placeInstance(
  m: Float32Array,
  o: number,
  t: readonly number[],
  toned: boolean,
): void {
  const x = t[0]!,
    y = t[1]!,
    z = t[2]!,
    sx = t[3]!,
    sy = t[4]!,
    sz = t[5]!,
    yaw = t[6]!,
    pitch = t[7]!;
  const c = Math.cos(yaw),
    s = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  // Turned by yaw after tipped by pitch: the columns of Ry·Rx, each scaled.
  m[o] = c * sx;
  m[o + 1] = 0;
  m[o + 2] = -s * sx;
  m[o + 3] = toned ? toneOf(t[8]!) : 0;
  m[o + 4] = s * sp * sy;
  m[o + 5] = cp * sy;
  m[o + 6] = c * sp * sy;
  m[o + 7] = toned ? toneOf(t[9]!) : 0;
  m[o + 8] = s * cp * sz;
  m[o + 9] = -sp * sz;
  m[o + 10] = c * cp * sz;
  m[o + 11] = toned ? toneOf(t[10]!) : 0;
  m[o + 12] = x;
  m[o + 13] = y;
  m[o + 14] = z;
  m[o + 15] = 1;
}

/**
 * A mesh shared by batches that come and go (a layer rebuilt as the year turns or the
 * setting changes): held, so that the last batch's end does not destroy it with itself.
 */
export function keptMesh(mesh: pc.Mesh): pc.Mesh {
  mesh.incRefCount();
  return mesh;
}

/**
 * The plain shapes are made once a stage for each size asked and given again after, held as a kept mesh is. A scene
 * made them afresh at every building of itself, and one no batch came to use (a pine where no conifer stands, a
 * figure's cone where none wears one) was never destroyed: nothing destroys a mesh but the last thing drawn of it.
 * Each visit to a land and its town left some seventeen such buffers on the card for good (2026-11-15). Past
 * SHAPES_KEPT sizes (a ring of a town's own width, say) a shape is made as it was, and goes with what draws it.
 */
const SHAPES = new WeakMap<Stage, Map<string, pc.Mesh>>();
const SHAPES_KEPT = 256;
/** Every shape given out shared: never destroyed by one who was handed it (see dropMesh). */
const SHARED = new WeakSet<pc.Mesh>();
/**
 * A mesh a layer was handed and is done with: destroyed, unless it is a shared plain shape another
 * layer may be drawing (a fight's or a landing's clear destroyed the stage's one box, and every batch
 * of it after drew from buffers gone: "reading 'impl'", 2026-11-15).
 */
export function dropMesh(mesh: pc.Mesh): void {
  if (!SHARED.has(mesh)) mesh.destroy();
}
function shape(stage: Stage, key: string, make: () => pc.Mesh): pc.Mesh {
  let kept = SHAPES.get(stage);
  if (!kept) SHAPES.set(stage, (kept = new Map()));
  const had = kept.get(key);
  if (had) return had;
  const mesh = make();
  if (kept.size >= SHAPES_KEPT) return mesh;
  kept.set(key, keptMesh(mesh));
  SHARED.add(mesh);
  return mesh;
}
/** How many plain shapes a stage keeps (for a gate to weigh). */
/** A flat ring about the middle, from `inner` out to `outer` (units), facing up. */
export function ringMesh(stage: Stage, inner: number, outer: number, sides = 48): pc.Mesh {
  return shape(stage, `ring|${inner}|${outer}|${sides}`, () => {
    const positions: number[] = [],
      normals: number[] = [],
      indices: number[] = [];
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * 2 * Math.PI,
        c = Math.cos(a),
        sn = Math.sin(a);
      positions.push(inner * c, 0, inner * sn, outer * c, 0, outer * sn);
      normals.push(0, 1, 0, 0, 1, 0);
    }
    for (let k = 0; k < sides; k++) {
      const i = 2 * k;
      indices.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
    }
    const mesh = new pc.Mesh(stage.device);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setIndices(indices);
    mesh.update();
    return mesh;
  });
}

export function shapesKept(stage: Stage): number {
  return SHAPES.get(stage)?.size ?? 0;
}

export function capsuleMesh(stage: Stage, radius: number, height: number): pc.Mesh {
  return shape(stage, `capsule|${radius}|${height}`, () =>
    pc.Mesh.fromGeometry(stage.device, new pc.CapsuleGeometry({ radius, height, sides: 8 })),
  );
}

/** A cone (a pyramid, with few sides): for pitched roofs, round roofs and tents. */
export function coneMesh(stage: Stage, radius: number, height: number, sides: number): pc.Mesh {
  return shape(stage, `cone|${radius}|${height}|${sides}`, () =>
    pc.Mesh.fromGeometry(
      stage.device,
      // (One band up its side: its sides are straight, so more bands only add faces no one sees.)
      new pc.ConeGeometry({
        baseRadius: radius,
        peakRadius: 0,
        height,
        heightSegments: 1,
        capSegments: sides,
      }),
    ),
  );
}

/** A ball of few faces. */
export function ballMesh(stage: Stage, radius: number, bands = 6): pc.Mesh {
  return shape(stage, `ball|${radius}|${bands}`, () =>
    pc.Mesh.fromGeometry(
      stage.device,
      new pc.SphereGeometry({ radius, latitudeBands: bands, longitudeBands: bands * 2 }),
    ),
  );
}

/**
 * A cone's or a cylinder's sides alone, no caps (`top` 0: a cone's, its faces meeting at its peak), shaded as a cone's or a
 * cylinder's are: for what stands on the ground with its ends hidden (a trunk in its crown, a tuft of grass), half the faces.
 */
export function sidesMesh(
  stage: Stage,
  radius: number,
  top: number,
  height: number,
  sides: number,
): pc.Mesh {
  return shape(stage, `sides|${radius}|${top}|${height}|${sides}`, () => {
    const positions: number[] = [],
      normals: number[] = [],
      uvs: number[] = [],
      indices: number[] = [],
      slope = Math.atan2(radius - top, height);
    for (let i = 0; i <= 1; i++)
      for (let j = 0; j <= sides; j++) {
        // (As PlayCanvas's own cone lays its sides: render/batch.ts coneMesh.)
        const theta = (j / sides) * 2 * Math.PI - Math.PI,
          s = Math.sin(theta),
          c = Math.cos(theta),
          r = i ? top : radius;
        positions.push(s * r, i ? height / 2 : -height / 2, c * r);
        normals.push(s * Math.cos(slope), Math.sin(slope), c * Math.cos(slope));
        uvs.push(j / sides, 1 - i);
      }
    for (let j = 0; j < sides; j++) {
      const first = j,
        second = j + 1,
        third = sides + 1 + j,
        fourth = sides + 2 + j;
      indices.push(first, second, third);
      if (top > 0) indices.push(second, fourth, third);
    }
    const mesh = new pc.Mesh(stage.device);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setUvs(0, uvs);
    mesh.setIndices(indices);
    mesh.update(pc.PRIMITIVE_TRIANGLES);
    return mesh;
  });
}

export function cylinderMesh(stage: Stage, radius: number, height: number, sides = 24): pc.Mesh {
  return shape(stage, `cylinder|${radius}|${height}|${sides}`, () =>
    pc.Mesh.fromGeometry(
      stage.device,
      new pc.CylinderGeometry({ radius, height, heightSegments: 1, capSegments: sides }),
    ),
  );
}

/** A box a unit each way about its middle, its faces square to its axes. */
export function boxMesh(stage: Stage): pc.Mesh {
  return shape(stage, "box", () =>
    pc.Mesh.fromGeometry(
      stage.device,
      new pc.BoxGeometry({ halfExtents: new pc.Vec3(0.5, 0.5, 0.5) }),
    ),
  );
}

/**
 * A gable roof a unit each way about its middle: two slopes meeting at a ridge along x,
 * a triangle at each end. Faceted: each face lit by its own normal.
 */
export function gableMesh(stage: Stage): pc.Mesh {
  return shape(stage, "gable", () => gableMade(stage));
}
/** The gable's faces, each its corners in order about its outward side (gableMesh; render/compound.ts lays them again). */
export const GABLE_FACES: readonly (readonly (readonly [number, number, number])[])[] = [
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
function gableMade(stage: Stage): pc.Mesh {
  const positions: number[] = [],
    normals: number[] = [],
    indices: number[] = [];
  for (const f of GABLE_FACES) {
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

/** A faceted mesh of a solid's corners and faces (each face lit by its own normal). */
export function facetedMesh(
  stage: Stage,
  solid: {
    readonly corners: readonly (readonly [number, number, number])[];
    readonly faces: readonly (readonly number[])[];
  },
): pc.Mesh {
  const positions: number[] = [],
    normals: number[] = [],
    indices: number[] = [];
  for (const f of solid.faces) {
    const a = solid.corners[f[0]!]!,
      b = solid.corners[f[1]!]!,
      c = solid.corners[f[2]!]!,
      u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]],
      n = [
        u[1]! * v[2]! - u[2]! * v[1]!,
        u[2]! * v[0]! - u[0]! * v[2]!,
        u[0]! * v[1]! - u[1]! * v[0]!,
      ],
      len = Math.hypot(n[0]!, n[1]!, n[2]!) || 1,
      base = positions.length / 3;
    for (const i of f) {
      const p = solid.corners[i]!;
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

/** The meshes beasts are built of, one for each of their shapes (view/creature.ts BEAST_SHAPES), kept for each stage. */
const BEAST_MESHES = new WeakMap<Stage, pc.Mesh[]>();
export function beastMeshes(stage: Stage, box: pc.Mesh): readonly pc.Mesh[] {
  let kept = BEAST_MESHES.get(stage);
  if (!kept) {
    kept = BEAST_SHAPES.map((s, i) => (i === 0 ? box : keptMesh(facetedMesh(stage, s))));
    BEAST_MESHES.set(stage, kept);
  }
  return kept[0] === box ? kept : [box, ...kept.slice(1)];
}
