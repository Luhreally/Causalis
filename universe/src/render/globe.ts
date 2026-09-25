// A planet as a globe: the sphere grid as one mesh, raised by its relief and
// coloured per cell by the lens, with a marker on the picked place. Only the
// colours change when the lens does; the shape is built once per planet.
import * as pc from "playcanvas";
import { nearestCell, sphereGrid, type SphereGrid } from "../kernel/index.ts";
import { globeRadius } from "../view/index.ts";
import { cylinderMesh } from "./batch.ts";
import { flatMaterial, type Stage } from "./stage.ts";

export class GlobeScene {
  private readonly stage: Stage;
  private grid: SphereGrid | null = null;
  private mesh: pc.Mesh | null = null;
  private entity: pc.Entity | null = null;
  private readonly marker: pc.Entity;
  private positions: Float32Array | null = null;

  constructor(stage: Stage) {
    this.stage = stage;
    this.marker = new pc.Entity("marker");
    this.marker.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(cylinderMesh(stage, 0.012, 0.08, 12), flatMaterial([1, 1, 1])),
      ],
    });
    this.marker.enabled = false;
    stage.root.addChild(this.marker);
  }

  /** Build the globe for a grid frequency and relief (once per planet). */
  build(frequency: number, elevation: Float32Array): void {
    const grid = sphereGrid(frequency),
      n = grid.count,
      positions = new Float32Array(n * 3);
    for (let c = 0; c < n; c++) {
      const r = globeRadius(elevation[c]!);
      positions[c * 3] = grid.positions[c * 3]! * r;
      positions[c * 3 + 1] = grid.positions[c * 3 + 1]! * r;
      positions[c * 3 + 2] = grid.positions[c * 3 + 2]! * r;
    }
    const indices = new Uint32Array(grid.triangles);
    const mesh = new pc.Mesh(this.stage.device);
    mesh.setPositions(positions);
    mesh.setNormals(pc.calculateNormals(Array.from(positions), Array.from(indices)));
    mesh.setColors32(new Uint8Array(n * 4).fill(128));
    mesh.setIndices(indices);
    mesh.update();
    const material = new pc.StandardMaterial();
    material.diffuseVertexColor = true;
    material.diffuse = new pc.Color(1, 1, 1);
    material.gloss = 0.15;
    material.update();
    this.entity?.destroy();
    this.entity = new pc.Entity("globe");
    this.entity.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material)] });
    this.stage.root.addChild(this.entity);
    this.grid = grid;
    this.mesh = mesh;
    this.positions = positions;
  }

  set visible(on: boolean) {
    if (this.entity) this.entity.enabled = on;
    if (!on) this.marker.enabled = false;
  }

  get built(): boolean {
    return this.grid !== null;
  }

  /** Recolour the globe (RGBA per cell). */
  paint(colors: Uint8Array): void {
    if (!this.mesh) return;
    this.mesh.setColors32(colors);
    this.mesh.update();
  }

  /** The cell under a screen point, or null when the point misses the globe. */
  pick(x: number, y: number): number | null {
    if (!this.grid) return null;
    const cam = this.stage.camera.camera!,
      from = cam.screenToWorld(x, y, cam.nearClip),
      to = cam.screenToWorld(x, y, cam.farClip);
    const dx = to.x - from.x,
      dy = to.y - from.y,
      dz = to.z - from.z,
      a = dx * dx + dy * dy + dz * dz,
      b = 2 * (from.x * dx + from.y * dy + from.z * dz),
      c = from.x * from.x + from.y * from.y + from.z * from.z - 1.01 * 1.01,
      disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = (-b - Math.sqrt(disc)) / (2 * a);
    return nearestCell(this.grid, from.x + dx * s, from.y + dy * s, from.z + dz * s);
  }

  /** Mark a place (or clear the mark). */
  mark(cell: number | null): void {
    this.marker.enabled = cell !== null && this.positions !== null;
    if (cell === null || !this.positions || !this.grid) return;
    const p = this.positions,
      x = p[cell * 3]!,
      y = p[cell * 3 + 1]!,
      z = p[cell * 3 + 2]!;
    this.marker.setLocalPosition(x * 1.02, y * 1.02, z * 1.02);
    // Stand the marker along the surface normal.
    const up = new pc.Vec3(x, y, z).normalize(),
      q = new pc.Quat();
    const axis = new pc.Vec3().cross(pc.Vec3.UP, up),
      angle = Math.acos(Math.max(-1, Math.min(1, up.y)));
    if (axis.length() > 1e-6) q.setFromAxisAngle(axis.normalize(), (angle * 180) / Math.PI);
    this.marker.setLocalRotation(q);
  }
}
