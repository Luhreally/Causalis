// A planet as a globe: the sphere grid as one mesh, raised by its relief and
// coloured per cell by the lens, with a marker on the picked place. Only the
// colours change when the lens does; the shape is built once per planet.
// The look (art track A4): low-poly facets — each triangle flat, lit by its own face
// and coloured by the most of its three cells — under a glossy sea, with a glow at the rim.
import * as pc from "playcanvas";
import { nearestCell, sphereGrid, type SphereGrid } from "../kernel/index.ts";
import { globeRadius } from "../view/index.ts";
import { cylinderMesh } from "./batch.ts";
import { billboard, glowMaterial, type GlowStops } from "./glow.ts";
import { flatMaterial, type Stage } from "./stage.ts";

/** The rim of air: clear in the middle (the globe hides it), a blue ring at the edge, fading out. */
const HALO: GlowStops = [
  [0, "rgba(0,0,0,0)"],
  [0.68, "rgba(0,0,0,0)"],
  [0.757, "rgba(120,210,255,0.85)"],
  [0.84, "rgba(60,120,255,0.35)"],
  [1, "rgba(20,40,120,0)"],
];

export class GlobeScene {
  private readonly stage: Stage;
  private grid: SphereGrid | null = null;
  private mesh: pc.Mesh | null = null;
  private entity: pc.Entity | null = null;
  private readonly marker: pc.Entity;
  private positions: Float32Array | null = null;
  /** For each drawn corner, the cell it colours by (three corners a triangle). */
  private corners: Int32Array | null = null;
  private colors: Uint8Array | null = null;
  private readonly sea: pc.Entity;
  private readonly halo: pc.Entity;

  constructor(stage: Stage) {
    this.stage = stage;
    // The sea: a glossy shell at sea level, clear enough to show what a lens paints under it.
    const water = new pc.StandardMaterial();
    water.diffuse = new pc.Color(0.08, 0.28, 0.62);
    water.specular = new pc.Color(0.9, 0.95, 1);
    water.gloss = 0.86;
    water.opacity = 0.38;
    water.blendType = pc.BLEND_NORMAL;
    water.depthWrite = false;
    water.update();
    this.sea = new pc.Entity("sea");
    this.sea.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(
          pc.Mesh.fromGeometry(
            stage.device,
            new pc.SphereGeometry({ radius: 1.0005, latitudeBands: 48, longitudeBands: 96 }),
          ),
          water,
        ),
      ],
    });
    this.sea.enabled = false;
    stage.root.addChild(this.sea);
    // The air: a glow about the rim, a camera-facing disc behind the globe's middle.
    this.halo = billboard(stage, glowMaterial(stage, HALO), 1.32, stage.root);
    this.halo.enabled = false;
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
      // Seabeds a little under the sea's shell, so its gloss lies over them.
      const r = elevation[c]! <= 0 ? 0.997 : globeRadius(elevation[c]!);
      positions[c * 3] = grid.positions[c * 3]! * r;
      positions[c * 3 + 1] = grid.positions[c * 3 + 1]! * r;
      positions[c * 3 + 2] = grid.positions[c * 3 + 2]! * r;
    }
    // Every triangle its own three corners, with its face's normal, wound to face out:
    // facets, not a blur.
    const tris = grid.triangles.length / 3,
      corners = new Int32Array(tris * 3),
      at = new Float32Array(tris * 9),
      normals = new Float32Array(tris * 9),
      indices = new Uint32Array(tris * 3);
    for (let t = 0; t < tris; t++) {
      const o = 9 * t;
      for (let k = 0; k < 3; k++) {
        const cell = grid.triangles[3 * t + k]!;
        corners[3 * t + k] = cell;
        at[o + 3 * k] = positions[3 * cell]!;
        at[o + 3 * k + 1] = positions[3 * cell + 1]!;
        at[o + 3 * k + 2] = positions[3 * cell + 2]!;
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
      const outward = nx * at[o]! + ny * at[o + 1]! + nz * at[o + 2]! >= 0;
      if (!outward) [nx, ny, nz] = [-nx, -ny, -nz];
      const len = Math.hypot(nx, ny, nz) || 1;
      for (let k = 0; k < 3; k++) {
        normals[o + 3 * k] = nx / len;
        normals[o + 3 * k + 1] = ny / len;
        normals[o + 3 * k + 2] = nz / len;
      }
      indices[3 * t] = 3 * t;
      indices[3 * t + 1] = outward ? 3 * t + 1 : 3 * t + 2;
      indices[3 * t + 2] = outward ? 3 * t + 2 : 3 * t + 1;
    }
    const mesh = new pc.Mesh(this.stage.device);
    mesh.setPositions(at);
    mesh.setNormals(normals);
    this.colors = new Uint8Array(tris * 12).fill(128);
    mesh.setColors32(this.colors);
    mesh.setIndices(indices);
    mesh.update();
    const material = new pc.StandardMaterial();
    material.diffuseVertexColor = true;
    material.diffuse = new pc.Color(1, 1, 1);
    // Matte facets: the era's plain lit colour, no sheen.
    material.specular = new pc.Color(0.06, 0.06, 0.08);
    material.gloss = 0.1;
    material.update();
    this.entity?.destroy();
    this.entity = new pc.Entity("globe");
    this.entity.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material)] });
    this.stage.root.addChild(this.entity);
    this.grid = grid;
    this.mesh = mesh;
    this.positions = positions;
    this.corners = corners;
    this.sea.enabled = this.halo.enabled = true;
  }

  set visible(on: boolean) {
    if (this.entity) this.entity.enabled = on;
    this.sea.enabled = this.halo.enabled = on && this.entity !== null;
    if (!on) this.marker.enabled = false;
  }

  get built(): boolean {
    return this.grid !== null;
  }

  /** Recolour the globe (RGBA per cell): each facet the colour most of its three cells have. */
  paint(colors: Uint8Array): void {
    if (!this.mesh || !this.corners || !this.colors) return;
    const cells = new Uint32Array(colors.buffer, colors.byteOffset, colors.length >> 2),
      out = new Uint32Array(this.colors.buffer),
      k = this.corners;
    for (let t = 0; t < k.length; t += 3) {
      const a = cells[k[t]!]!,
        b = cells[k[t + 1]!]!,
        c = cells[k[t + 2]!]!,
        face = a === b || a === c ? a : b === c ? b : a;
      out[t] = out[t + 1] = out[t + 2] = face;
    }
    this.mesh.setColors32(this.colors);
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
