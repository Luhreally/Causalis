// A region as terrain: the tile grid as one heightmap mesh (1 unit = 1 km),
// coloured per tile by the lens, under a translucent sea at height zero, with a
// marker on the picked tile. The look (art track A4): low-poly facets, each triangle
// flat and coloured by the most of its three tiles, under a glossy sea.
import * as pc from "playcanvas";
import type { RegionTree } from "../view/index.ts";
import { InstancedBatch, coneMesh, cylinderMesh } from "./batch.ts";
import { flatMaterial, type Stage } from "./stage.ts";

export class RegionScene {
  private readonly stage: Stage;
  private readonly root = new pc.Entity("region");
  private mesh: pc.Mesh | null = null;
  /** For each drawn corner, the tile it colours by; and the corners' colours. */
  private corners: Int32Array | null = null;
  private colors: Uint8Array | null = null;
  private size = 0;
  private tileKm = 1;
  private heights: Float32Array | null = null;
  private readonly marker: pc.Entity;
  private huts: InstancedBatch | null = null;
  private woods: InstancedBatch[] = [];
  private villageTiles: number[] = [];
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
    // (Batches first: their instance buffers go with them.)
    this.huts?.destroy();
    for (const b of this.woods) b.destroy();
    for (const child of [...this.root.children]) if (child !== this.marker) child.destroy();
    this.huts = null;
    this.woods = [];
    this.villageTiles = [];
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
    // Every triangle its own corners, lit by its own face: facets, not a blur.
    const tris = indices.length / 3,
      corners = new Int32Array(tris * 3),
      at = new Float32Array(tris * 9),
      normals = new Float32Array(tris * 9),
      order = new Uint32Array(tris * 3);
    for (let t = 0; t < tris; t++) {
      const o = 9 * t;
      for (let q = 0; q < 3; q++) {
        const v = indices[3 * t + q]!;
        corners[3 * t + q] = v;
        at[o + 3 * q] = positions[3 * v]!;
        at[o + 3 * q + 1] = positions[3 * v + 1]!;
        at[o + 3 * q + 2] = positions[3 * v + 2]!;
        order[3 * t + q] = 3 * t + q;
      }
      const ux = at[o + 3]! - at[o]!,
        uy = at[o + 4]! - at[o + 1]!,
        uz = at[o + 5]! - at[o + 2]!,
        vx = at[o + 6]! - at[o]!,
        vy = at[o + 7]! - at[o + 1]!,
        vz = at[o + 8]! - at[o + 2]!;
      let nx = uy * vz - uz * vy,
        ny = uz * vx - ux * vz,
        nz = ux * vy - uy * vx;
      // Up, whichever way the triangle winds.
      if (ny < 0) [nx, ny, nz] = [-nx, -ny, -nz];
      const len = Math.hypot(nx, ny, nz) || 1;
      for (let q = 0; q < 3; q++) {
        normals[o + 3 * q] = nx / len;
        normals[o + 3 * q + 1] = ny / len;
        normals[o + 3 * q + 2] = nz / len;
      }
    }
    const mesh = new pc.Mesh(this.stage.device);
    mesh.setPositions(at);
    mesh.setNormals(normals);
    this.colors = new Uint8Array(tris * 12).fill(128);
    mesh.setColors32(this.colors);
    mesh.setIndices(order);
    mesh.update();
    this.corners = corners;
    const material = new pc.StandardMaterial();
    material.diffuseVertexColor = true;
    // Matte facets, as the globe's.
    material.specular = new pc.Color(0.05, 0.05, 0.06);
    material.gloss = 0.1;
    material.update();
    const terrain = new pc.Entity("terrain");
    terrain.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material)] });
    this.root.addChild(terrain);
    const sea = new pc.Entity("sea");
    sea.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(cylinderMesh(this.stage, half * 1.42, 0.02, 48), seaMaterial()),
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

  /** Recolour the terrain (RGBA per tile): each facet the colour most of its three tiles have. */
  paint(colors: Uint8Array): void {
    if (!this.mesh || !this.corners || !this.colors) return;
    const tiles = new Uint32Array(colors.buffer, colors.byteOffset, colors.length >> 2),
      out = new Uint32Array(this.colors.buffer),
      k = this.corners;
    for (let t = 0; t < k.length; t += 3) {
      const a = tiles[k[t]!]!,
        b = tiles[k[t + 1]!]!,
        c = tiles[k[t + 2]!]!,
        face = a === b || a === c ? a : b === c ? b : a;
      out[t] = out[t + 1] = out[t + 2] = face;
    }
    this.mesh.setColors32(this.colors);
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

  /** Where a tile's ground is, in the scene. */
  groundAt(tile: number): pc.Vec3 | null {
    if (!this.heights) return null;
    const half = ((this.size - 1) * this.tileKm) / 2;
    return new pc.Vec3(
      (tile % this.size) * this.tileKm - half,
      Math.max(0, this.heights[tile]!),
      Math.floor(tile / this.size) * this.tileKm - half,
    );
  }

  /** The region's woods: a low-poly crown for each tree, on the ground where it stands. */
  plantTrees(trees: readonly RegionTree[]): void {
    for (const b of this.woods) b.destroy();
    this.woods = [];
    if (!this.heights || !trees.length) return;
    const s = this.stage,
      half = ((this.size - 1) * this.tileKm) / 2,
      kinds = [
        {
          kind: "conifer",
          mesh: coneMesh(s, 0.5, 1, 6),
          color: [0.06, 0.4, 0.22] as const,
          w: 0.5,
          h: 1.05,
        },
        {
          kind: "broadleaf",
          mesh: pc.Mesh.fromGeometry(
            s.device,
            new pc.SphereGeometry({ radius: 0.5, latitudeBands: 3, longitudeBands: 6 }),
          ),
          color: [0.16, 0.56, 0.18] as const,
          w: 0.65,
          h: 0.55,
        },
      ];
    for (const k of kinds) {
      const list = trees.filter((t) => t.kind === k.kind);
      if (!list.length) continue;
      const batch = new InstancedBatch(s, k.mesh, [...k.color], list.length, this.root);
      batch.set(list.length, (i, out) => {
        const t = list[i]!,
          x = t.tile % this.size,
          z = Math.floor(t.tile / this.size);
        out[0] = (x + t.dx) * this.tileKm - half;
        // Sized to the tiles (a tree half a tile across reads as woods at this height).
        const w = k.w * t.size * this.tileKm,
          h = k.h * t.size * this.tileKm;
        out[1] = Math.max(0, this.heights![t.tile]!) + h / 2;
        out[2] = (z + t.dz) * this.tileKm - half;
        out[3] = out[5] = w;
        out[4] = h;
        out[6] = t.dx * 6;
      });
      this.woods.push(batch);
    }
  }

  /** Villages as clusters of huts: more huts for more people. */
  setVillages(villages: readonly { tile: number; population: number }[]): void {
    if (!this.heights) return;
    // (Within the region, so they go and come with it.)
    this.huts ??= new InstancedBatch(
      this.stage,
      cylinderMesh(this.stage, 0.3, 0.42, 4),
      [0.9, 0.76, 0.55],
      2048,
      this.root,
    );
    this.villageTiles = villages.map((v) => v.tile);
    const places: [number, number, number, number][] = [];
    for (const v of villages) {
      const at = this.groundAt(v.tile)!,
        huts = Math.max(1, Math.min(24, Math.round(Math.sqrt(v.population) / 1.6)));
      for (let k = 0; k < huts; k++) {
        const a = k * 2.399963,
          r = 0.62 * Math.sqrt(k + 0.5);
        places.push([at.x + r * Math.cos(a), at.y + 0.21, at.z + r * Math.sin(a), a]);
      }
    }
    this.huts.set(places.length, (i, out) => {
      const [x, y, z, a] = places[i]!;
      out[0] = x;
      out[1] = y;
      out[2] = z;
      out[3] = out[5] = 1;
      out[4] = 1;
      out[6] = a;
    });
  }

  /** Screen positions (CSS pixels) of tiles, for labels; null when behind the camera. */
  screenOf(tiles: readonly number[]): ({ x: number; y: number } | null)[] {
    const cam = this.stage.camera.camera!,
      out: ({ x: number; y: number } | null)[] = [];
    for (const tile of tiles) {
      const at = this.groundAt(tile);
      if (!at) {
        out.push(null);
        continue;
      }
      at.y += 0.9;
      const screen = cam.worldToScreen(at);
      out.push(screen.z > 0 ? { x: screen.x, y: screen.y } : null);
    }
    return out;
  }

  /** The village tile nearest a tile, within `reach` tiles. */
  villageNear(tile: number, reach = 3): number | null {
    const i = tile % this.size,
      j = Math.floor(tile / this.size);
    let best: number | null = null,
      bestD = reach * reach + 1;
    for (const v of this.villageTiles) {
      const di = (v % this.size) - i,
        dj = Math.floor(v / this.size) - j,
        d = di * di + dj * dj;
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
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

/** The materials a region is drawn with, for the stage to warm before a first descent. */
export function regionMaterials(
  stage: Stage,
): { material: pc.Material; instanced?: boolean; mesh?: pc.Mesh }[] {
  const land = new pc.StandardMaterial();
  land.diffuseVertexColor = true;
  land.specular = new pc.Color(0.05, 0.05, 0.06);
  land.gloss = 0.1;
  land.update();
  // The shapes the region and a village are built of (a cylinder's vertices are a cone's,
  // a sphere's and a capsule's too): lit plain, clear, and instanced.
  const shape = cylinderMesh(stage, 0.5, 1, 6);
  return [
    { material: land },
    { material: seaMaterial(), mesh: shape },
    { material: flatMaterial([1, 1, 1], 0.8), mesh: shape },
    { material: flatMaterial([1, 1, 1]), mesh: shape },
    { material: flatMaterial([1, 1, 1]), instanced: true, mesh: shape },
  ];
}

/** The sea over a region: a glossy blue sheet, clear enough to show the shallows. */
function seaMaterial(): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0.08, 0.3, 0.66);
  m.specular = new pc.Color(0.85, 0.92, 1);
  m.gloss = 0.84;
  m.opacity = 0.62;
  m.blendType = pc.BLEND_NORMAL;
  m.depthWrite = false;
  m.update();
  return m;
}
