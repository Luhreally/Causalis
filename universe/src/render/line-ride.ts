// Live a Line's ride aboard a ship of its realm (2026-11-28): the hull its realm's fights are drawn with (view/shiplook.ts,
// as render/fleet.ts draws it), its drive's flame, the dark between the stars going by, the star it sails for ahead and
// home's behind, seen from Phase 73's eye off the stern (view/fleet.ts rideEye). How far it has come is the crossing's
// own share of its years; nothing here is history. The mode's own, laid on the stage only while a ship is ridden.
import * as pc from "playcanvas";
import type { FightSide } from "../bridge/index.ts";
import { InstancedBatch, boxMesh } from "./batch.ts";
import type { Stage } from "./stage.ts";
import {
  driveColor,
  flameGeometry,
  fleetLook,
  rideEye,
  shipGeometry,
  type ShipGeometry,
  type ShipNow,
} from "../view/index.ts";

/** The specks of the dark going by: how many, how far about the ship they lie (scene units, the hull one long). */
const SPECKS = 220,
  WIDE = 26,
  CLEAR = 7,
  DEEP = 70,
  /** The two stars' distance ahead and behind; how large each is drawn at its nearest and farthest. */
  STAR_AT = 90,
  STAR_NEAR = 9,
  STAR_FAR = 0.7;

/** A unit's draw, from a key: the specks' places, the same each ride. */
const unit = (i: number, k: number) => {
  let h = Math.imul(i + 1, 2654435761) ^ Math.imul(k + 7, 40503);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

function meshOf(stage: Stage, g: ShipGeometry): pc.Mesh {
  const mesh = new pc.Mesh(stage.device);
  mesh.setPositions(g.positions);
  mesh.setNormals(g.normals);
  mesh.setColors32(g.colors);
  mesh.setIndices(g.indices);
  mesh.update();
  return mesh;
}

/** A light of its own colour: unlit, added over what is behind it, not written to depth. */
function glowMaterial(c: readonly [number, number, number]): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.useLighting = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(c[0], c[1], c[2]);
  m.useFog = false;
  m.blendType = pc.BLEND_ADDITIVE;
  m.depthWrite = false;
  m.update();
  return m;
}

export class RideScene {
  readonly root = new pc.Entity("line-ride");
  private readonly stage: Stage;
  private hull: pc.Entity | null = null;
  private flame: pc.Entity | null = null;
  private readonly specks: InstancedBatch;
  private readonly ahead: pc.Entity;
  private readonly behind: pc.Entity;
  private readonly made: { mesh: pc.Mesh; material: pc.Material }[] = [];
  private readonly at: Float32Array = new Float32Array(SPECKS * 3);
  /** The hull's length and its stern (z), in its geometry's units. */
  private long = 1;
  private stern = -0.5;
  private t = 0;
  /** Where the eye stands about the hull (Phase 73's turn and tip). */
  yaw = 0;
  pitch = 0.62;
  /**
   * Where the ship stands in the shot: raised by this share of the screen's height (the room left free of the mode's chrome
   * is not the middle of a phone's screen), and the eye stood back so many times as far (that room is small).
   */
  raise = 0;
  back = 1;

  constructor(stage: Stage) {
    this.stage = stage;
    for (let i = 0; i < SPECKS; i++) {
      // (None within a few hull lengths of the ship's way: a speck by the eye drew as a slab across the shot.)
      const a = unit(i, 0) * Math.PI * 2,
        r = CLEAR + Math.sqrt(unit(i, 1)) * (WIDE - CLEAR);
      this.at[i * 3] = Math.cos(a) * r;
      this.at[i * 3 + 1] = Math.sin(a) * r;
      this.at[i * 3 + 2] = (unit(i, 2) - 0.5) * 2 * DEEP;
    }
    this.specks = new InstancedBatch(
      stage,
      boxMesh(stage),
      [1, 1, 1],
      SPECKS,
      this.root,
      glowMaterial([0.85, 0.9, 1]),
    );
    const ball = (c: readonly [number, number, number]) => {
      const e = new pc.Entity("ride-star"),
        mesh = pc.Mesh.fromGeometry(
          stage.device,
          new pc.SphereGeometry({ radius: 0.5, latitudeBands: 10, longitudeBands: 14 }),
        ),
        material = glowMaterial(c);
      this.made.push({ mesh, material });
      e.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material)] });
      this.root.addChild(e);
      return e;
    };
    this.ahead = ball([1, 0.92, 0.7]);
    this.behind = ball([1, 0.85, 0.55]);
    this.root.enabled = false;
    stage.root.addChild(this.root);
  }

  /** The realm's hull and drive put on (its ships as its fights draw them). */
  ship(side: FightSide): void {
    this.hull?.destroy();
    this.flame?.destroy();
    const look = fleetLook(side),
      g = shipGeometry(look, "capital");
    // (Its bounds: the hull drawn a unit long, its middle at the ship's place.)
    const lo = [Infinity, Infinity, Infinity],
      hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < g.positions.length; i++) {
      const a = i % 3;
      lo[a] = Math.min(lo[a]!, g.positions[i]!);
      hi[a] = Math.max(hi[a]!, g.positions[i]!);
    }
    const mid = (a: number) => (lo[a]! + hi[a]!) / 2;
    this.long = Math.max(1e-3, hi[2]! - lo[2]!);
    this.stern = lo[2]! - mid(2);
    const hullMesh = meshOf(this.stage, g),
      hull = new pc.StandardMaterial();
    hull.diffuseVertexColor = true;
    hull.gloss = 0.35;
    hull.useFog = false;
    hull.emissive = new pc.Color(0.24, 0.24, 0.28);
    hull.update();
    this.made.push({ mesh: hullMesh, material: hull });
    this.hull = new pc.Entity("ride-hull");
    this.hull.addComponent("render", { meshInstances: [new pc.MeshInstance(hullMesh, hull)] });
    this.hull.setLocalScale(1 / this.long, 1 / this.long, 1 / this.long);
    this.hull.setLocalPosition(-mid(0) / this.long, -mid(1) / this.long, -mid(2) / this.long);
    const flameMesh = meshOf(this.stage, flameGeometry()),
      fire = glowMaterial(driveColor(side.drive));
    this.made.push({ mesh: flameMesh, material: fire });
    this.flame = new pc.Entity("ride-flame");
    this.flame.addComponent("render", { meshInstances: [new pc.MeshInstance(flameMesh, fire)] });
    this.root.addChild(this.hull);
    this.root.addChild(this.flame);
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /**
   * A frame: `k` the share of the crossing come (0 … 1), `pace` how fast the dark goes by (1: a year in its own time, more
   * as the years are let go quicker), `burn` the drive's flame (1 when it pushes, at the start and the end; low between).
   */
  frame(dt: number, k: number, pace: number, burn: number): void {
    this.t += dt;
    const go = Math.min(60, 5 * pace) * dt,
      streak = Math.min(6, 0.12 + 0.25 * pace);
    for (let i = 0; i < SPECKS; i++) {
      let z = this.at[i * 3 + 2]! - go;
      if (z < -DEEP) z += 2 * DEEP;
      this.at[i * 3 + 2] = z;
    }
    const a = this.at;
    this.specks.set(SPECKS, (i, out) => {
      out[0] = a[i * 3]!;
      out[1] = a[i * 3 + 1]!;
      out[2] = a[i * 3 + 2]!;
      out[3] = 0.05;
      out[4] = 0.05;
      out[5] = streak;
    });
    const near = (x: number) => STAR_FAR + (STAR_NEAR - STAR_FAR) * x * x * x;
    const s1 = near(Math.max(0, Math.min(1, k))),
      s0 = near(Math.max(0, Math.min(1, 1 - k)) * 0.6);
    this.ahead.setLocalPosition(6, 4, STAR_AT);
    this.ahead.setLocalScale(s1, s1, s1);
    this.behind.setLocalPosition(-8, -3, -STAR_AT);
    this.behind.setLocalScale(s0, s0, s0);
    if (this.flame) {
      const f = 0.25 + 0.75 * burn,
        flicker = 1 + 0.08 * Math.sin(this.t * 31) + 0.05 * Math.sin(this.t * 17.3);
      this.flame.setLocalPosition(0, 0, this.stern / this.long);
      this.flame.setLocalScale(0.16 * f, 0.16 * f, 0.9 * f * flicker);
    }
    if (this.hull) this.hull.setLocalEulerAngles(0, 0, 3 * Math.sin(this.t * 0.4));
    // (The eye: Phase 73's, off the stern and above, turned about the hull by the hand.)
    const me = {
        p: { x: 0, y: 0, z: 0 },
        f: { x: 0, y: 0, z: 1 },
        length: this.back,
      } as ShipNow,
      eye = rideEye(me, this.yaw, this.pitch),
      cam = this.stage.camera,
      // (Aimed at the hull itself, not past it as a fight's ride is: here the ship is the sight. The shot's up as the eye sees
      // it, and how tall the view stands at the ship: the aim lowered to raise the ship into the room left for it.)
      dx = -eye.e.x,
      dy = -eye.e.y,
      dz = -eye.e.z,
      dist = Math.hypot(dx, dy, dz),
      tall = 2 * dist * Math.tan(((cam.camera!.fov / 2) * Math.PI) / 180),
      f = [dx / dist, dy / dist, dz / dist] as const,
      u0 = [eye.up.x, eye.up.y, eye.up.z] as const,
      along = u0[0] * f[0] + u0[1] * f[1] + u0[2] * f[2],
      ux = u0[0] - along * f[0],
      uy = u0[1] - along * f[1],
      uz = u0[2] - along * f[2],
      ul = Math.hypot(ux, uy, uz) || 1,
      down = this.raise * tall;
    cam.setPosition(eye.e.x, eye.e.y, eye.e.z);
    cam.lookAt(
      new pc.Vec3(-(ux / ul) * down, -(uy / ul) * down, -(uz / ul) * down),
      new pc.Vec3(eye.up.x, eye.up.y, eye.up.z),
    );
  }

  destroy(): void {
    this.specks.destroy();
    this.root.destroy();
    for (const m of this.made) {
      m.mesh.destroy();
      m.material.destroy();
    }
  }
}
