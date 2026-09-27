// The whole galaxy, drawn (Phase 8 M80): its stars as one mesh of tiny glowing specks
// (four facets each, in their colours, adding up where they crowd), a glow over the bulge,
// home ringed, and the spot last tapped marked. One draw call for the disk however many
// stars the setting draws.
import * as pc from "playcanvas";
import type { GalaxyPlan } from "../bridge/index.ts";
import { galaxyPoints } from "../view/index.ts";
import { billboard, glowMaterial } from "./glow.ts";
import type { Stage } from "./stage.ts";

/** The stars' material: glowing, unlit, adding up where they crowd (warmed at the start). */
export function galaxyMaterial(): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(1, 1, 1);
  m.emissiveVertexColor = true;
  m.useLighting = false;
  m.blendType = pc.BLEND_ADDITIVE;
  m.depthWrite = false;
  m.cull = pc.CULLFACE_NONE;
  m.update();
  return m;
}

export class GalaxyScene {
  private readonly stage: Stage;
  private readonly root = new pc.Entity("galaxy");
  private disk: pc.Entity | null = null;
  /** For its birth (M89): the disk's mesh, its stars' own colours, and when each is lit (0 … 1). */
  private mesh: pc.Mesh | null = null;
  private colors: Uint8Array | null = null;
  private births: Float32Array | null = null;
  private readonly bulge: pc.Entity;
  private readonly home: pc.Entity;
  private readonly spot: pc.Entity;

  constructor(stage: Stage) {
    this.stage = stage;
    stage.root.addChild(this.root);
    this.bulge = billboard(
      stage,
      glowMaterial(stage, [
        [0, "rgba(255, 228, 170, 0.95)"],
        [0.3, "rgba(255, 196, 120, 0.45)"],
        [1, "rgba(255, 170, 100, 0)"],
      ]),
      1,
      this.root,
    );
    const ring = (color: [number, number, number]) => {
      const mesh = new pc.Mesh(stage.device),
        pts: number[] = [];
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2,
          b = ((k + 1) / 48) * Math.PI * 2;
        pts.push(Math.cos(a), 0, Math.sin(a), Math.cos(b), 0, Math.sin(b));
      }
      mesh.setPositions(pts);
      mesh.update(pc.PRIMITIVE_LINES);
      const m = new pc.StandardMaterial();
      m.diffuse = new pc.Color(0, 0, 0);
      m.emissive = new pc.Color(color[0], color[1], color[2]);
      m.useLighting = false;
      m.update();
      const e = new pc.Entity("ring");
      e.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, m)] });
      this.root.addChild(e);
      return e;
    };
    this.home = ring([0.4, 1, 0.8]);
    this.spot = ring([1, 1, 1]);
    this.spot.enabled = false;
    this.root.enabled = false;
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** Draw the galaxy: `count` stars. */
  build(plan: GalaxyPlan, count: number): void {
    this.disk?.destroy();
    const pts = galaxyPoints(plan, count),
      // Four corners a star (a tiny tetrahedron: a speck from any side).
      size = 0.09,
      corners = [
        [0, size, 0],
        [size, -size * 0.5, size * 0.6],
        [-size, -size * 0.5, size * 0.6],
        [0, -size * 0.5, -size],
      ] as const,
      positions = new Float32Array(count * 12),
      colors = new Uint8Array(count * 16),
      indices = new Uint32Array(count * 12);
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 4; k++) {
        positions[12 * i + 3 * k] = pts.positions[3 * i]! + corners[k]![0];
        positions[12 * i + 3 * k + 1] = pts.positions[3 * i + 1]! + corners[k]![1];
        positions[12 * i + 3 * k + 2] = pts.positions[3 * i + 2]! + corners[k]![2];
        for (let c = 0; c < 4; c++) colors[16 * i + 4 * k + c] = pts.colors[4 * i + c]!;
      }
      const o = 4 * i;
      indices.set([o, o + 1, o + 2, o, o + 2, o + 3, o, o + 3, o + 1, o + 1, o + 3, o + 2], 12 * i);
    }
    const mesh = new pc.Mesh(this.stage.device);
    mesh.setPositions(positions);
    mesh.setColors32(colors);
    mesh.setIndices(indices);
    mesh.update();
    // When each star is lit, as the galaxy is born: the bulge's old stars first, then the
    // disk from the middle outward, each a little before or after its neighbours.
    const R = plan.radius / 1000,
      births = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = pts.positions[3 * i]!,
        z = pts.positions[3 * i + 2]!,
        r = Math.hypot(x, z) / Math.max(1e-6, R),
        jitter = (((i * 2654435761) >>> 0) / 4294967296) * 0.15;
      births[i] = Math.min(0.95, (r < 0.1 ? 0.05 + r * 2 : 0.2 + r * 0.65) + jitter);
    }
    this.mesh = mesh;
    this.colors = colors;
    this.births = births;
    this.disk = new pc.Entity("disk");
    this.disk.addComponent("render", {
      meshInstances: [new pc.MeshInstance(mesh, galaxyMaterial())],
    });
    this.root.addChild(this.disk);
    this.bulge.setLocalScale(R * 0.35, R * 0.35, R * 0.35);
    this.home.setLocalPosition(pts.home.x, 0, pts.home.z);
    this.home.setLocalScale(R * 0.03, 1, R * 0.03);
  }

  /**
   * The galaxy as it is born, `k` from 0 (a dark cloud) to 1 (as it is): each star lit in its
   * turn (M89). At one, the stars as they are.
   */
  emerge(k: number): void {
    const mesh = this.mesh,
      colors = this.colors,
      births = this.births;
    if (!mesh || !colors || !births) return;
    const lit = new Uint8Array(colors.length);
    for (let i = 0; i < births.length; i++) {
      const a = Math.max(0, Math.min(1, (k - births[i]!) / 0.08));
      for (let c = 0; c < 16; c++)
        lit[16 * i + c] = c % 4 === 3 ? colors[16 * i + c]! : Math.round(colors[16 * i + c]! * a);
    }
    mesh.setColors32(lit);
    mesh.update();
    this.bulge.enabled = k > 0.1;
  }

  /** Where on the disk's plane a screen point falls (units), if on it at all. */
  pick(x: number, y: number): { x: number; z: number } | null {
    const cam = this.stage.camera.camera!,
      from = cam.screenToWorld(x, y, cam.nearClip),
      to = cam.screenToWorld(x, y, cam.farClip),
      dy = to.y - from.y;
    if (Math.abs(dy) < 1e-9) return null;
    const k = -from.y / dy;
    if (k < 0 || k > 1) return null;
    return { x: from.x + (to.x - from.x) * k, z: from.z + (to.z - from.z) * k };
  }

  /** Mark the spot tapped (units), or clear it. */
  mark(at: { x: number; z: number } | null, size = 1): void {
    this.spot.enabled = !!at;
    if (!at) return;
    this.spot.setLocalPosition(at.x, 0, at.z);
    this.spot.setLocalScale(size, 1, size);
  }
}
