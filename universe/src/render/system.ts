// The home star's system (Phase 5 M46): the star alight at the middle, each world a
// sphere on its ring, moons about their planets, the picked body ringed. Built once per
// plan; each frame only moves the bodies to where the view says they are. About them, the
// peoples of other stars (Phase 18 M136): their worlds ringed in their colour, their
// satellites and stations, their ships plying, setting out and coming in.
import * as pc from "playcanvas";
import type { SystemPlan } from "../bridge/index.ts";
import {
  MOST_GLINTS,
  STAR_SIZE,
  mirrorBand,
  orbitRings,
  type PeopleSystemMarks,
  type SkyMarks,
  type SystemSpot,
} from "../view/index.ts";
import { InstancedBatch, boxMesh } from "./batch.ts";
import { billboard, glowMaterial } from "./glow.ts";
import { flatMaterial, type Stage } from "./stage.ts";

/** Lumps a world unmade's belt draws on its ring (W6; one draw call, 30 triangles a lump, seen from far off). */
const BELT = 260;

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
  /** The peoples of other stars about the system (M136), pooled. */
  private readonly peopleRings: pc.Entity[] = [];
  private readonly peopleCraft: pc.Entity[] = [];
  private readonly peopleShips: pc.Entity[] = [];
  private peopleMarks: PeopleSystemMarks | null = null;
  private readonly tints = new Map<string, pc.StandardMaterial>();
  /** Its star's mirrors (Phase 66): a band of glints, turning; how many are drawn. */
  private mirrorRoot: pc.Entity | null = null;
  private glints: InstancedBatch | null = null;
  private belt: InstancedBatch | null = null;
  private glintsAt = -1;
  mirrorsShown = 0;

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
    this.glints?.destroy();
    this.belt?.destroy();
    this.belt = null;
    for (const e of [...this.root.children]) if (e !== this.marker) e.destroy();
    this.colonyRings.length = 0;
    this.satellites.length = 0;
    this.stations.length = 0;
    this.peopleRings.length = 0;
    this.peopleCraft.length = 0;
    this.peopleShips.length = 0;
    this.peopleMarks = null;
    this.bodies = [];
    this.mirrorRoot = null;
    this.glints = null;
    this.glintsAt = -1;
    this.mirrorsShown = 0;
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
    // Its corona: a white-hot heart in the star's own hue, fading far out.
    const css = (k: number, a: number) =>
      `rgba(${Math.round(255 * hue[0] * k)},${Math.round(255 * hue[1] * k)},${Math.round(255 * hue[2] * k)},${a})`;
    billboard(
      this.stage,
      glowMaterial(this.stage, [
        [0, "rgba(255,255,255,1)"],
        [0.12, css(1, 0.9)],
        [0.35, css(0.9, 0.35)],
        [1, css(0.6, 0)],
      ]),
      STAR_SIZE * 7,
      this.root,
    );
    for (const b of plan.bodies) {
      const e = new pc.Entity(b.designation);
      e.addComponent("render", {
        meshInstances: [new pc.MeshInstance(sphere, flatMaterial([0.5, 0.5, 0.5]))],
      });
      // (A world unmade has no sphere on its ring: W6.)
      e.enabled = !b.unmade;
      this.root.addChild(e);
      this.bodies.push(e);
    }
    // The planets' orbits, one line mesh; on a world unmade's, its rubble, a thick belt of it right round.
    const lines: number[] = [],
      rings = orbitRings(plan),
      goneRings = plan.bodies
        .filter((b) => b.around < 0)
        .flatMap((b, i) => (b.unmade ? [rings[i]!] : []));
    for (const ring of rings) {
      const n = ring.length / 2;
      for (let k = 0; k < n; k++) {
        const j = (k + 1) % n;
        lines.push(ring[k * 2]!, 0, ring[k * 2 + 1]!, ring[j * 2]!, 0, ring[j * 2 + 1]!);
      }
    }
    if (goneRings.length) {
      const lump = pc.Mesh.fromGeometry(
          this.stage.device,
          new pc.SphereGeometry({ radius: 1, latitudeBands: 3, longitudeBands: 5 }),
        ),
        belt = new InstancedBatch(
          this.stage,
          lump,
          [0.7, 0.42, 0.3],
          BELT * goneRings.length,
          this.root,
        ),
        hash = (i: number, k: number) => {
          const s = Math.sin(i * 51.17 + k * 17.71) * 14634.6345;
          return s - Math.floor(s);
        };
      this.belt = belt;
      belt.glow([0.42, 0.16, 0.07]);
      belt.set(BELT * goneRings.length, (i, out) => {
        const ring = goneRings[Math.floor(i / BELT)]!,
          n = ring.length / 2,
          at = hash(i, 1) * n,
          a = Math.floor(at) % n,
          b = (a + 1) % n,
          f = at - Math.floor(at),
          x = ring[2 * a]! + (ring[2 * b]! - ring[2 * a]!) * f,
          z = ring[2 * a + 1]! + (ring[2 * b + 1]! - ring[2 * a + 1]!) * f,
          out0 = 1 + (hash(i, 2) - 0.5) * 0.16;
        out[0] = x * out0;
        out[1] = (hash(i, 3) - 0.5) * 0.24;
        out[2] = z * out0;
        out[3] = out[4] = out[5] = 0.028 + 0.075 * hash(i, 4) * hash(i, 4);
      });
    }
    const mesh = new pc.Mesh(this.stage.device);
    mesh.setPositions(lines);
    mesh.update(pc.PRIMITIVE_LINES);
    const orbits = new pc.Entity("orbits");
    orbits.addComponent("render", {
      meshInstances: [new pc.MeshInstance(mesh, glow([0.25, 0.62, 0.85]))],
    });
    this.root.addChild(orbits);
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

  /** Its star's mirrors at so many km² (0: none); drawn again only as their number grows. */
  mirrors(km2: number): void {
    const band = mirrorBand(km2),
      n = band.length / 4;
    if (n !== this.glintsAt) {
      this.glintsAt = n;
      this.mirrorsShown = n;
      if (!this.mirrorRoot) {
        this.mirrorRoot = new pc.Entity("mirrors");
        this.root.addChild(this.mirrorRoot);
      }
      this.glints ??= new InstancedBatch(
        this.stage,
        boxMesh(this.stage),
        [1, 0.9, 0.62],
        24 + MOST_GLINTS + 1,
        this.mirrorRoot,
        glow([1, 0.9, 0.62]),
      );
      this.glints.set(n, (i, out) => {
        out[0] = band[i * 4]!;
        out[1] = band[i * 4 + 1]!;
        out[2] = band[i * 4 + 2]!;
        out[3] = 0.16;
        out[4] = 0.016;
        out[5] = 0.1;
        out[6] = band[i * 4 + 3]!;
      });
    }
    // (They go round the star, too slowly to tell one from the next.)
    this.mirrorRoot?.setLocalEulerAngles(0, (performance.now() / 1000) * 1.1, 0);
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

  /**
   * Draw the peoples of other stars about the system: their worlds ringed in their colours,
   * their craft, their ships (and, for a ship on a crossing, the way it has come).
   */
  peoples(m: PeopleSystemMarks): void {
    this.peopleMarks = m;
    const fill = (pool: pc.Entity[], n: number, make: () => pc.Entity) => {
      while (pool.length < n) {
        const e = make();
        this.root.addChild(e);
        pool.push(e);
      }
      pool.forEach((e, i) => (e.enabled = i < n));
    };
    fill(this.peopleRings, m.rings.length, () => this.ringEntity([1, 1, 1]));
    fill(this.peopleCraft, m.craft.length, () => this.dotEntity([1, 1, 1], 0.03));
    fill(this.peopleShips, m.ships.length, () => this.dotEntity([1, 1, 1], 0.05));
    m.rings.forEach((r, i) => {
      const e = this.peopleRings[i]!;
      e.render!.meshInstances[0]!.material = this.tint(r.color);
      e.setLocalPosition(r.x, 0, r.z);
      e.setLocalScale(r.r, r.r, r.r);
    });
    m.craft.forEach((c, i) => {
      const e = this.peopleCraft[i]!;
      e.render!.meshInstances[0]!.material = this.tint(c.color);
      e.setLocalPosition(c.x, 0, c.z);
      e.setLocalScale(c.size, c.size, c.size);
    });
    m.ships.forEach((s, i) => {
      const e = this.peopleShips[i]!,
        size = s.fleet ? 0.11 : 0.08;
      e.render!.meshInstances[0]!.material = this.tint(
        s.fleet ? [1, 0.35 + 0.3 * s.color[1], 0.25] : s.color,
      );
      e.setLocalPosition(s.x, 0.02, s.z);
      e.setLocalScale(size, size, size);
    });
    // The lanes their ships ply, faint; and the way a ship on a crossing has come, behind it.
    const positions: number[] = [],
      colors: number[] = [];
    for (const l of m.lanes) {
      positions.push(l.ax, 0, l.az, l.bx, 0, l.bz);
      colors.push(...l.color, 0.22, ...l.color, 0.06);
    }
    for (const s of m.ships) {
      if (!s.course) continue;
      positions.push(s.fromX, 0, s.fromZ, s.x, 0, s.z);
      const [r, g, b] = s.fleet ? [1, 0.4, 0.3] : s.color;
      colors.push(r, g, b, 0.15, r, g, b, 0.7);
    }
    if (positions.length) this.stage.app.drawLineArrays(positions, colors, true);
  }

  /** The ship of a people of another star nearest a screen point (its event), else its world's people. */
  pickPeople(x: number, y: number): string | null {
    const m = this.peopleMarks;
    if (!m || !this.root.enabled) return null;
    const cam = this.stage.camera.camera!;
    let best: string | null = null,
      bestD = 16;
    for (const s of m.ships) {
      const p = cam.worldToScreen(new pc.Vec3(s.x, 0, s.z));
      const d = Math.hypot(p.x - x, p.y - y);
      if (p.z > 0 && d < bestD) [best, bestD] = [s.ref, d];
    }
    return best;
  }

  /** Where each people's name stands over its world on the screen (and a ship come home). */
  peopleOnScreen(): { key: string; text: string; ref: string; x: number; y: number }[] {
    const m = this.peopleMarks;
    if (!m || !this.root.enabled) return [];
    const cam = this.stage.camera.camera!,
      out: { key: string; text: string; ref: string; x: number; y: number }[] = [];
    for (const n of m.names) {
      const p = cam.worldToScreen(new pc.Vec3(n.x, 0, n.z));
      if (p.z > 0) out.push({ key: n.key, text: n.text, ref: n.ref, x: p.x, y: p.y - 22 });
    }
    return out;
  }

  /** How much of the peoples is drawn now (for the gate). */
  get peopleShown(): { worlds: number; craft: number; ships: number } {
    const m = this.peopleMarks;
    return {
      worlds: m?.rings.length ?? 0,
      craft: m?.craft.length ?? 0,
      ships: m?.ships.length ?? 0,
    };
  }

  private tint(color: readonly [number, number, number]): pc.StandardMaterial {
    const key = color.join(",");
    let m = this.tints.get(key);
    if (!m) this.tints.set(key, (m = glow(color)));
    return m;
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

/**
 * The sky's self-lit shaders, for warming at the start: on a line's bare corners (the
 * orbits, the rings) and on a sphere's (the star, the stars around) — each makes its own.
 */
export function skyMaterials(stage: Stage): { material: pc.Material; mesh: pc.Mesh }[] {
  const line = new pc.Mesh(stage.device);
  line.setPositions([0, 0, 0, 1, 0, 0]);
  line.update(pc.PRIMITIVE_LINES);
  const ball = pc.Mesh.fromGeometry(
    stage.device,
    new pc.SphereGeometry({ radius: 1, latitudeBands: 4, longitudeBands: 6 }),
  );
  return [
    { material: glow([1, 1, 1]), mesh: line },
    { material: glow([1, 1, 1]), mesh: ball },
  ];
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
