// A region as terrain: the tile grid as one heightmap mesh (1 unit = 1 km),
// coloured per tile by the lens, under a translucent sea at height zero, with a
// marker on the picked tile.
import * as pc from "playcanvas";
import { cylinderMesh } from "./batch.ts";
import { flatMaterial, type Stage } from "./stage.ts";

export class RegionScene {
  private readonly stage: Stage;
  private readonly root = new pc.Entity("region");
  private mesh: pc.Mesh | null = null;
  private size = 0;
  private tileKm = 1;
  private heights: Float32Array | null = null;
  private readonly marker: pc.Entity;
  key: string | null = null;

  constructor(stage: Stage) {
    this.stage = stage;
    stage.root.addChild(this.root);
    this.marker = new pc.Entity("tile-marker");
    this.marker.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(cylinderMesh(stage, 0.5, 6, 12), flatMaterial([1, 1, 1], 0.8)),
      ],
    });
    this.marker.enabled = false;
    this.root.addChild(this.marker);
    this.root.enabled = false;
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  build(key: string, size: number, tileKm: number, heights: Float32Array): void {
    for (const child of [...this.root.children]) if (child !== this.marker) child.destroy();
    const n = size * size,
      positions = new Float32Array(n * 3),
      half = ((size - 1) * tileKm) / 2;
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        const t = j * size + i;
        positions[t * 3] = i * tileKm - half;
        positions[t * 3 + 1] = heights[t]!;
        positions[t * 3 + 2] = j * tileKm - half;
      }
    const indices = new Uint32Array((size - 1) * (size - 1) * 6);
    let k = 0;
    for (let j = 0; j < size - 1; j++)
      for (let i = 0; i < size - 1; i++) {
        const a = j * size + i,
          b = a + 1,
          c = a + size,
          d = c + 1;
        indices[k++] = a;
        indices[k++] = c;
        indices[k++] = b;
        indices[k++] = b;
        indices[k++] = c;
        indices[k++] = d;
      }
    const mesh = new pc.Mesh(this.stage.device);
    mesh.setPositions(positions);
    mesh.setNormals(pc.calculateNormals(Array.from(positions), Array.from(indices)));
    mesh.setColors32(new Uint8Array(n * 4).fill(128));
    mesh.setIndices(indices);
    mesh.update();
    const material = new pc.StandardMaterial();
    material.diffuseVertexColor = true;
    material.gloss = 0.1;
    material.update();
    const terrain = new pc.Entity("terrain");
    terrain.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material)] });
    this.root.addChild(terrain);
    const sea = new pc.Entity("sea");
    sea.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(
          cylinderMesh(this.stage, half * 1.42, 0.02, 48),
          flatMaterial([0.16, 0.36, 0.6], 0.55),
        ),
      ],
    });
    sea.setLocalPosition(0, 0, 0);
    this.root.addChild(sea);
    this.mesh = mesh;
    this.size = size;
    this.tileKm = tileKm;
    this.heights = heights;
    this.key = key;
  }

  paint(colors: Uint8Array): void {
    if (!this.mesh) return;
    this.mesh.setColors32(colors);
    this.mesh.update();
  }

  /** The tile under a screen point (by the ground plane at the tile heights' mean), or null. */
  pick(x: number, y: number): number | null {
    if (!this.heights) return null;
    const cam = this.stage.camera.camera!,
      from = cam.screenToWorld(x, y, cam.nearClip),
      to = cam.screenToWorld(x, y, cam.farClip),
      half = ((this.size - 1) * this.tileKm) / 2;
    // March along the ray until it passes under the terrain.
    const steps = 600;
    for (let s = 0; s <= steps; s++) {
      const f = s / steps,
        px = from.x + (to.x - from.x) * f,
        py = from.y + (to.y - from.y) * f,
        pz = from.z + (to.z - from.z) * f,
        i = Math.round((px + half) / this.tileKm),
        j = Math.round((pz + half) / this.tileKm);
      if (i < 0 || j < 0 || i >= this.size || j >= this.size) continue;
      if (py <= Math.max(0, this.heights[j * this.size + i]!)) return j * this.size + i;
    }
    return null;
  }

  mark(tile: number | null): void {
    this.marker.enabled = tile !== null && this.heights !== null;
    if (tile === null || !this.heights) return;
    const half = ((this.size - 1) * this.tileKm) / 2,
      i = tile % this.size,
      j = Math.floor(tile / this.size);
    this.marker.setLocalPosition(
      i * this.tileKm - half,
      Math.max(0, this.heights[tile]!) + 3,
      j * this.tileKm - half,
    );
  }
}
