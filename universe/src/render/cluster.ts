// The cluster (Phase 6 M56): the stars within reach of home, each a small glowing sphere
// where it lies, one instanced batch for each colour; home a brighter mark at the middle;
// the picked star ringed. Built once per plan.
import * as pc from "playcanvas";
import type { ClusterPlan } from "../bridge/index.ts";
import { LY_SCALE, clusterSpec } from "../view/index.ts";
import { InstancedBatch } from "./batch.ts";
import type { Stage } from "./stage.ts";

export class ClusterScene {
  private readonly stage: Stage;
  private readonly root = new pc.Entity("cluster");
  private batches: InstancedBatch[] = [];
  private points: { index: number; x: number; y: number; z: number }[] = [];
  private readonly marker: pc.Entity;
  private readonly sphere: pc.Mesh;
  private readonly ringMesh: pc.Mesh;
  private readonly ships: pc.Entity[] = [];
  private readonly rings: pc.Entity[] = [];

  constructor(stage: Stage) {
    this.stage = stage;
    stage.root.addChild(this.root);
    this.sphere = pc.Mesh.fromGeometry(
      stage.device,
      new pc.SphereGeometry({ radius: 1, latitudeBands: 6, longitudeBands: 8 }),
    );
    const ring = new pc.Mesh(stage.device),
      pts: number[] = [];
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2,
        b = ((k + 1) / 40) * Math.PI * 2;
      pts.push(Math.cos(a), 0, Math.sin(a), Math.cos(b), 0, Math.sin(b));
    }
    ring.setPositions(pts);
    ring.update(pc.PRIMITIVE_LINES);
    this.ringMesh = ring;
    this.marker = new pc.Entity("star marker");
    this.marker.addComponent("render", {
      meshInstances: [new pc.MeshInstance(ring, glow([1, 1, 1]))],
    });
    this.marker.enabled = false;
    this.root.addChild(this.marker);
    this.root.enabled = false;
  }

  build(plan: ClusterPlan): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.points = [];
    for (const group of clusterSpec(plan)) {
      const batch = new InstancedBatch(
        this.stage,
        this.sphere,
        group.color,
        group.stars.length,
        this.root,
        glow(group.color),
      );
      batch.set(group.stars.length, (i, out) => {
        const s = group.stars[i]!;
        out[0] = s.x;
        out[1] = s.y;
        out[2] = s.z;
        out[3] = out[4] = out[5] = s.size;
        out[6] = 0;
      });
      this.batches.push(batch);
      for (const s of group.stars) this.points.push(s);
    }
    // Home: the brightest mark, at the middle.
    const home = new InstancedBatch(
      this.stage,
      this.sphere,
      [1, 0.95, 0.7],
      1,
      this.root,
      glow([1, 0.97, 0.8]),
    );
    home.set(1, (_, out) => {
      out[0] = out[1] = out[2] = 0;
      out[3] = out[4] = out[5] = 0.22;
      out[6] = 0;
    });
    this.batches.push(home);
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** The star nearest a screen point (within a finger's width), or null. */
  pick(x: number, y: number): number | null {
    const cam = this.stage.camera.camera!;
    let best: number | null = null,
      bestD = 22;
    for (const s of this.points) {
      const p = cam.worldToScreen(new pc.Vec3(s.x, s.y, s.z));
      const d = Math.hypot(p.x - x, p.y - y);
      if (p.z > 0 && d < bestD) {
        bestD = d;
        best = s.index;
      }
    }
    return best;
  }

  /** Ships between the stars, and rings about the stars they came down at. */
  voyages(m: {
    readonly ships: readonly { x: number; y: number; z: number }[];
    readonly rings: readonly { x: number; y: number; z: number }[];
  }): void {
    for (const [pool, list, make] of [
      [this.ships, m.ships, () => this.dot([0.6, 1, 0.7], 0.09)],
      [this.rings, m.rings, () => this.ringAt([0.4, 1, 0.5])],
    ] as const) {
      while (pool.length < list.length) {
        const e = make();
        this.root.addChild(e);
        pool.push(e);
      }
      pool.forEach((e, i) => {
        e.enabled = i < list.length;
        const p = list[i];
        if (p) e.setLocalPosition(p.x, p.y, p.z);
      });
    }
  }

  private dot(color: readonly [number, number, number], size: number): pc.Entity {
    const e = new pc.Entity("ship");
    e.addComponent("render", { meshInstances: [new pc.MeshInstance(this.sphere, glow(color))] });
    e.setLocalScale(size, size, size);
    return e;
  }

  private ringAt(color: readonly [number, number, number]): pc.Entity {
    const e = new pc.Entity("settled star");
    e.addComponent("render", {
      meshInstances: [new pc.MeshInstance(this.ringMesh, glow(color))],
    });
    e.setLocalScale(0.28, 0.28, 0.28);
    return e;
  }

  /** Ring a star (or clear the ring). */
  mark(index: number | null, plan: ClusterPlan | null): void {
    this.marker.enabled = index !== null && !!plan;
    if (index === null || !plan) return;
    const s = plan.stars[index]!;
    this.marker.setLocalPosition(s.x * LY_SCALE, s.z * LY_SCALE, s.y * LY_SCALE);
    this.marker.setLocalScale(0.35, 0.35, 0.35);
  }
}

function glow(color: readonly [number, number, number]): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(color[0], color[1], color[2]);
  m.useLighting = false;
  m.update();
  return m;
}
