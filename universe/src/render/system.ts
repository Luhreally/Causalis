// The home star's system (Phase 5 M46): the star alight at the middle, each world a
// sphere on its ring, moons about their planets, the picked body ringed. Built once per
// plan; each frame only moves the bodies to where the view says they are.
import * as pc from "playcanvas";
import type { SystemPlan } from "../bridge/index.ts";
import { STAR_SIZE, orbitRings, type SkyMarks, type SystemSpot } from "../view/index.ts";
import { flatMaterial, type Stage } from "./stage.ts";

export class SystemScene {
  private readonly stage: Stage;
  private readonly root = new pc.Entity("system");
  private bodies: pc.Entity[] = [];
  private spots: SystemSpot[] = [];
  private readonly marker: pc.Entity;
  private marked: number | null = null;
  private readonly colonyRings: pc.Entity[] = [];
  private readonly satellites: pc.Entity[] = [];
  private readonly stations: pc.Entity[] = [];
  private readonly ringMesh: pc.Mesh;
  private readonly dotMesh: pc.Mesh;

  constructor(stage: Stage) {
    this.stage = stage;
    stage.root.addChild(this.root);
    this.marker = new pc.Entity("system marker");
    const ring = new pc.Mesh(stage.device),
      points: number[] = [];
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2,
        b = ((k + 1) / 48) * Math.PI * 2;
      points.push(Math.cos(a), 0, Math.sin(a), Math.cos(b), 0, Math.sin(b));
    }
    ring.setPositions(points);
    ring.update(pc.PRIMITIVE_LINES);
    this.ringMesh = ring;
    this.dotMesh = pc.Mesh.fromGeometry(
      stage.device,
      new pc.SphereGeometry({ radius: 1, latitudeBands: 6, longitudeBands: 8 }),
    );
    this.marker.addComponent("render", {
      meshInstances: [new pc.MeshInstance(ring, glow([1, 1, 1]))],
    });
    this.marker.enabled = false;
    this.root.addChild(this.marker);
    this.root.enabled = false;
  }

  /** Build the star, a sphere for every body and the planets' rings. */
  build(plan: SystemPlan): void {
    for (const e of [...this.root.children]) if (e !== this.marker) e.destroy();
    this.colonyRings.length = 0;
    this.satellites.length = 0;
    this.stations.length = 0;
    this.bodies = [];
    const sphere = pc.Mesh.fromGeometry(
      this.stage.device,
      new pc.SphereGeometry({ radius: 1, latitudeBands: 16, longitudeBands: 24 }),
    );
    const star = new pc.Entity("star"),
      t = plan.star.temperature,
      // Hotter stars whiter-blue, cooler ones redder.
      hue: [number, number, number] =
        t > 6500
          ? [0.85, 0.9, 1]
          : t > 5200
            ? [1, 0.95, 0.75]
            : t > 3700
              ? [1, 0.8, 0.5]
              : [1, 0.6, 0.4];
    star.addComponent("render", { meshInstances: [new pc.MeshInstance(sphere, glow(hue))] });
    star.setLocalScale(STAR_SIZE, STAR_SIZE, STAR_SIZE);
    this.root.addChild(star);
    for (const b of plan.bodies) {
      const e = new pc.Entity(b.designation);
      e.addComponent("render", {
        meshInstances: [new pc.MeshInstance(sphere, flatMaterial([0.5, 0.5, 0.5]))],
      });
      this.root.addChild(e);
      this.bodies.push(e);
    }
    // The planets' orbits, one line mesh.
    const lines: number[] = [];
    for (const ring of orbitRings(plan)) {
      const n = ring.length / 2;
      for (let k = 0; k < n; k++) {
        const j = (k + 1) % n;
        lines.push(ring[k * 2]!, 0, ring[k * 2 + 1]!, ring[j * 2]!, 0, ring[j * 2 + 1]!);
      }
    }
    const mesh = new pc.Mesh(this.stage.device);
    mesh.setPositions(lines);
    mesh.update(pc.PRIMITIVE_LINES);
    const rings = new pc.Entity("orbits");
    rings.addComponent("render", {
      meshInstances: [new pc.MeshInstance(mesh, glow([0.35, 0.4, 0.5]))],
    });
    this.root.addChild(rings);
    this.spots = [];
  }

  /** Move every body to where it is now; colour and size by the view. */
  update(spots: SystemSpot[]): void {
    this.spots = spots;
    for (const s of spots) {
      const e = this.bodies[s.index];
      if (!e) continue;
      e.setLocalPosition(s.x, 0, s.z);
      e.setLocalScale(s.size, s.size, s.size);
      const m = e.render!.meshInstances[0]!.material as pc.StandardMaterial;
      if (m.diffuse.r !== s.color[0] || m.diffuse.g !== s.color[1] || m.diffuse.b !== s.color[2]) {
        m.diffuse.set(s.color[0], s.color[1], s.color[2]);
        m.update();
      }
    }
    if (this.marked !== null) {
      const s = spots[this.marked];
      if (s) {
        this.marker.setLocalPosition(s.x, 0, s.z);
        const r = s.size * 1.8 + 0.06;
        this.marker.setLocalScale(r, r, r);
      }
    }
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** The body nearest a screen point (within a finger's width), or null. */
  pick(x: number, y: number): number | null {
    const cam = this.stage.camera.camera!,
      scale = this.stage.device.maxPixelRatio;
    let best: number | null = null,
      bestD = 28 * Math.max(1, scale / 2);
    for (const s of this.spots) {
      const p = cam.worldToScreen(new pc.Vec3(s.x, 0, s.z));
      const d = Math.hypot(p.x - x, p.y - y);
      if (p.z > 0 && d < bestD) {
        bestD = d;
        best = s.index;
      }
    }
    return best;
  }

  /** Draw the marks of flight and settlement: rings about settled bodies, satellites and stations about home. */
  marks(m: SkyMarks): void {
    const pools: [pc.Entity[], number, () => pc.Entity][] = [
      [this.colonyRings, m.rings.length, () => this.ringEntity([0.4, 1, 0.5])],
      [this.satellites, m.satellites.length, () => this.dotEntity([0.9, 0.9, 1], 0.035)],
      [this.stations, m.stations.length, () => this.dotEntity([1, 0.85, 0.4], 0.055)],
    ];
    for (const [pool, n, make] of pools) {
      while (pool.length < n) {
        const e = make();
        this.root.addChild(e);
        pool.push(e);
      }
      pool.forEach((e, i) => (e.enabled = i < n));
    }
    m.rings.forEach((r, i) => {
      const e = this.colonyRings[i]!;
      e.setLocalPosition(r.x, 0, r.z);
      e.setLocalScale(r.r, r.r, r.r);
    });
    m.satellites.forEach((p, i) => this.satellites[i]!.setLocalPosition(p.x, 0, p.z));
    m.stations.forEach((p, i) => this.stations[i]!.setLocalPosition(p.x, 0, p.z));
  }

  private ringEntity(color: readonly [number, number, number]): pc.Entity {
    const e = new pc.Entity("halls ring");
    e.addComponent("render", { meshInstances: [new pc.MeshInstance(this.ringMesh, glow(color))] });
    return e;
  }

  private dotEntity(color: readonly [number, number, number], size: number): pc.Entity {
    const e = new pc.Entity("craft");
    e.addComponent("render", { meshInstances: [new pc.MeshInstance(this.dotMesh, glow(color))] });
    e.setLocalScale(size, size, size);
    return e;
  }

  /** Ring a body (or clear the ring). */
  mark(index: number | null): void {
    this.marked = index;
    this.marker.enabled = index !== null;
  }
}

/** A material that shines by itself (the star, the rings): unlit, its own colour. */
function glow(color: readonly [number, number, number]): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(color[0], color[1], color[2]);
  m.useLighting = false;
  m.update();
  return m;
}
