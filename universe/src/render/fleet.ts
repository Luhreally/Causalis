// The fleet fight as the render draws it (Phase 67): one fight among the stars, its ships, wrecks,
// beams, missiles, flashes and sparks, as instanced batches under one root. Every matrix is written
// from the script at the time asked for, so the same time always draws the same frame, and scrubbing
// back is exact. The shapes come from view/shiplook.ts and the places from view/fleet.ts; this file
// only draws them, and says how much it drew through `shown`.
import * as pc from "playcanvas";
import type { StarFightPlan } from "../bridge/index.ts";
import {
  LANDERS,
  TOWN_FRAME,
  armLook,
  flameGeometry,
  fleetLooks,
  poseMatrix,
  shipGeometry,
  toWorld,
  wreckGeometry,
  type FleetFrame,
  type FleetNow,
  type FleetScript,
  type ShipClassName,
  type ShipGeometry,
  type ShipNow,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

type V3 = { readonly x: number; readonly y: number; readonly z: number };
/** One batch, the most it may hold, and the triangles each instance of its mesh costs. */
type Lane = { readonly batch: InstancedBatch; readonly cap: number; readonly tris: number };
type Lanes = {
  readonly hulls: Lane[][]; // [side][class]: capital, line, escort (side 0's escorts take the landers)
  readonly wrecks: Lane[][]; // [side][half]
  readonly flames: Lane[]; // [side]
  readonly beams: Lane[]; // [side]
  readonly missiles: Lane[]; // [side]
  readonly trails: Lane[]; // [side]
  readonly flashes: Lane;
  readonly sparks: Lane;
};

const CLASSES: readonly ShipClassName[] = ["capital", "line", "escort"];
const WHITE: Rgb = [1, 1, 1];
const FORWARD_Z: V3 = { x: 0, y: 0, z: 1 };
const NOTHING = {
  ships: 0,
  wrecks: 0,
  beams: 0,
  missiles: 0,
  flashes: 0,
  sparks: 0,
  drawCalls: 0,
  triangles: 0,
};
type Shown = typeof NOTHING;
type Hit = { id: number; x: number; y: number; d: number };

/** The triangles of a mesh: its first primitive's indices, three to a triangle. */
const trisOf = (mesh: pc.Mesh): number => Math.floor((mesh.primitive[0]?.count ?? 0) / 3);

/** A mesh from a view's geometry (kept, as the shared meshes are). */
function meshOf(stage: Stage, g: ShipGeometry): pc.Mesh {
  const mesh = new pc.Mesh(stage.device);
  mesh.setPositions(g.positions);
  mesh.setNormals(g.normals);
  mesh.setColors32(g.colors);
  mesh.setIndices(g.indices);
  mesh.update();
  return keptMesh(mesh);
}

/** A hull: its vertex colours, lit, a little glow of its own. */
function hullMaterial(): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuseVertexColor = true;
  m.gloss = 0.35;
  m.useFog = false;
  m.emissive = new pc.Color(0.1, 0.1, 0.12);
  m.update();
  return m;
}

/** A light: its own colour, unlit, added over what is behind it, in no fog, not written to depth. */
function lightMaterial(c: Rgb): pc.StandardMaterial {
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

/** A tiny vertex-coloured triangle, for readying a hull's shader before the first frame. */
function tinted(stage: Stage): pc.Mesh {
  const mesh = new pc.Mesh(stage.device);
  mesh.setPositions([0, 0, 0, 1e-4, 0, 0, 0, 1e-4, 0]);
  mesh.setNormals([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  mesh.setColors32(new Uint8Array(12).fill(255));
  mesh.setIndices([0, 1, 2]);
  mesh.update();
  return mesh;
}

/** What a fleet is drawn with, to ready ahead of need (as colonyMaterials does for a landing). */
export function fleetMaterials(
  stage: Stage,
): { material: pc.Material; instanced?: boolean; mesh?: pc.Mesh }[] {
  return [
    { material: hullMaterial(), instanced: true, mesh: tinted(stage) },
    { material: hullMaterial(), mesh: tinted(stage) },
    { material: lightMaterial(WHITE), instanced: true, mesh: boxMesh(stage) },
  ];
}

export class FleetLayer {
  readonly root: pc.Entity;
  private readonly stage: Stage;
  private frame: FleetFrame = TOWN_FRAME;
  private lanes: Lanes | null = null;
  private batches: InstancedBatch[] = [];
  private meshes = new Set<pc.Mesh>();
  private materials = new Set<pc.Material>();
  private last: Shown = { ...NOTHING };

  constructor(stage: Stage) {
    this.stage = stage;
    this.root = new pc.Entity("fleet");
    this.root.enabled = false;
    stage.root.addChild(this.root);
  }

  /** One batch under the root, with the mesh and material it owns (freed by clear). */
  private lane(mesh: pc.Mesh, material: pc.Material, capacity: number): Lane {
    this.meshes.add(mesh);
    this.materials.add(material);
    const batch = new InstancedBatch(this.stage, mesh, WHITE, capacity, this.root, material);
    this.batches.push(batch);
    return { batch, cap: batch.capacity, tris: trisOf(mesh) };
  }

  /** Builds the batches for one fight: each side's hulls, wrecks, flames, beams, missiles and trails. */
  build(plan: StarFightPlan, script: FleetScript, frame: FleetFrame): void {
    this.clear();
    this.frame = frame;
    const stage = this.stage,
      looks = fleetLooks(plan.attacker, plan.defender),
      sides = [plan.attacker, plan.defender],
      sideN = [0, 0],
      classN = [
        [0, 0, 0],
        [0, 0, 0],
      ];
    for (const s of script.ships) {
      sideN[s.side] = sideN[s.side]! + 1;
      classN[s.side]![s.cls] = classN[s.side]![s.cls]! + 1;
    }
    const hulls: Lane[][] = [[], []],
      wrecks: Lane[][] = [[], []],
      flames: Lane[] = [],
      beams: Lane[] = [],
      missiles: Lane[] = [],
      trails: Lane[] = [];
    for (const side of [0, 1] as const) {
      const look = looks[side],
        platforms = sides[side]!.sky === "platforms",
        hull = hullMaterial();
      for (const cls of [0, 1, 2] as const) {
        const geometry = shipGeometry(look, platforms ? "platform" : CLASSES[cls]!),
          landers = side === 0 && cls === 2 ? LANDERS : 0;
        hulls[side]!.push(
          this.lane(meshOf(stage, geometry), hull, Math.max(1, classN[side]![cls]! + landers)),
        );
      }
      wrecks[side] = [0, 1].map((half) =>
        this.lane(
          meshOf(stage, wreckGeometry(look, half === 0 ? 0 : 1)),
          hull,
          Math.max(1, sideN[side]!),
        ),
      );
      flames[side] = this.lane(
        meshOf(stage, flameGeometry()),
        lightMaterial(look.engine),
        sideN[side]! + LANDERS,
      );
      const beamColor: Rgb = armLook(sides[side]!.beamArm ?? undefined).beam ?? [1, 0.8, 0.4];
      beams[side] = this.lane(boxMesh(stage), lightMaterial(beamColor), 48);
      missiles[side] = this.lane(boxMesh(stage), flatMaterial([0.85, 0.85, 0.9]), 48);
      trails[side] = this.lane(meshOf(stage, flameGeometry()), lightMaterial([1, 0.7, 0.35]), 48);
    }
    this.lanes = {
      hulls,
      wrecks,
      flames,
      beams,
      missiles,
      trails,
      flashes: this.lane(
        pc.Mesh.fromGeometry(
          stage.device,
          new pc.SphereGeometry({ radius: 0.5, latitudeBands: 4, longitudeBands: 6 }),
        ),
        lightMaterial([1, 0.8, 0.45]),
        64,
      ),
      sparks: this.lane(boxMesh(stage), lightMaterial([1, 0.6, 0.25]), 160),
    };
    this.root.enabled = true;
  }

  /** Writes every batch's matrices for `now`, each batch up to its capacity. Nothing is kept from before. */
  update(now: FleetNow): void {
    const L = this.lanes;
    if (!L) return;
    const frame = this.frame,
      shown: Shown = { ...NOTHING },
      count = (lane: Lane, n: number): void => {
        if (n <= 0) return;
        shown.drawCalls += 1;
        shown.triangles += n * lane.tris;
      };

    // Ships, the landers among them, by side and class.
    const byHull: ShipNow[][][] = [
      [[], [], []],
      [[], [], []],
    ];
    for (const s of now.ships) byHull[s.side]![s.cls]!.push(s);
    for (const side of [0, 1] as const) {
      for (const cls of [0, 1, 2] as const) {
        const lane = L.hulls[side]![cls]!,
          list = byHull[side]![cls]!,
          n = Math.min(list.length, lane.cap);
        lane.batch.setMatrices(n, (m) => {
          for (let i = 0; i < n; i++) {
            const s = list[i]!;
            poseMatrix(m, i * 16, frame, s.p, s.f, s.roll, s.length, s.length, s.length);
          }
        });
        count(lane, n);
        shown.ships += n;
      }
    }

    // Engine flames behind each ship that burns (their nozzle at its rear).
    for (const side of [0, 1] as const) {
      const list = now.ships.filter((s) => s.side === side && s.engine > 0),
        lane = L.flames[side]!,
        n = Math.min(list.length, lane.cap);
      lane.batch.setMatrices(n, (m) => {
        for (let i = 0; i < n; i++) {
          const s = list[i]!,
            len = s.length;
          poseMatrix(
            m,
            i * 16,
            frame,
            {
              x: s.p.x - s.f.x * len * 0.5,
              y: s.p.y - s.f.y * len * 0.5,
              z: s.p.z - s.f.z * len * 0.5,
            },
            s.f,
            0,
            len * 0.24,
            len * 0.24,
            len * (0.25 + 0.75 * s.engine),
          );
        }
      });
      count(lane, n);
    }

    // Wrecks: each broken ship's two halves.
    for (const side of [0, 1] as const) {
      for (const half of [0, 1] as const) {
        const list = now.wrecks.filter((w) => w.side === side && w.part === half),
          lane = L.wrecks[side]![half]!,
          n = Math.min(list.length, lane.cap);
        lane.batch.setMatrices(n, (m) => {
          for (let i = 0; i < n; i++) {
            const w = list[i]!;
            poseMatrix(m, i * 16, frame, w.p, w.f, w.roll, w.length, w.length, w.length);
          }
        });
        count(lane, n);
        shown.wrecks += n;
      }
    }

    // Beams: from the middle of one end to the other.
    for (const side of [0, 1] as const) {
      const list = now.beams.filter((b) => b.side === side),
        lane = L.beams[side]!,
        n = Math.min(list.length, lane.cap);
      lane.batch.setMatrices(n, (m) => {
        for (let i = 0; i < n; i++) {
          const beam = list[i]!,
            dx = beam.b.x - beam.a.x,
            dy = beam.b.y - beam.a.y,
            dz = beam.b.z - beam.a.z;
          poseMatrix(
            m,
            i * 16,
            frame,
            {
              x: (beam.a.x + beam.b.x) / 2,
              y: (beam.a.y + beam.b.y) / 2,
              z: (beam.a.z + beam.b.z) / 2,
            },
            { x: dx, y: dy, z: dz },
            0,
            beam.width,
            beam.width,
            Math.hypot(dx, dy, dz),
          );
        }
      });
      count(lane, n);
      shown.beams += n;
    }

    // Missile heads, and their trails (a flame's pyramid laid behind each).
    for (const side of [0, 1] as const) {
      const list = now.missiles.filter((x) => x.side === side),
        lane = L.missiles[side]!,
        n = Math.min(list.length, lane.cap);
      lane.batch.setMatrices(n, (m) => {
        for (let i = 0; i < n; i++) {
          const x = list[i]!;
          poseMatrix(m, i * 16, frame, x.p, x.f, 0, 0.006, 0.006, 0.02);
        }
      });
      count(lane, n);
      shown.missiles += n;
      const trail = L.trails[side]!,
        nt = Math.min(list.length, trail.cap);
      trail.batch.setMatrices(nt, (m) => {
        for (let i = 0; i < nt; i++) {
          const x = list[i]!;
          poseMatrix(m, i * 16, frame, x.p, x.f, 0, 0.006, 0.006, x.trail);
        }
      });
      count(trail, nt);
    }

    // Flashes: at a hit and at a break.
    const flashes = L.flashes,
      nf = Math.min(now.flashes.length, flashes.cap);
    flashes.batch.setMatrices(nf, (m) => {
      for (let i = 0; i < nf; i++) {
        const f = now.flashes[i]!;
        poseMatrix(m, i * 16, frame, f.p, FORWARD_Z, 0, f.size, f.size, f.size);
      }
    });
    count(flashes, nf);
    shown.flashes = nf;

    // Sparks from each break.
    const sparks = L.sparks,
      ns = Math.min(now.sparks.length, sparks.cap);
    sparks.batch.setMatrices(ns, (m) => {
      for (let i = 0; i < ns; i++) {
        const sp = now.sparks[i]!;
        poseMatrix(m, i * 16, frame, sp.p, sp.f, 0, 0.003, 0.003, sp.length);
      }
    });
    count(sparks, ns);
    shown.sparks = ns;

    this.last = shown;
  }

  /** Frees every batch, mesh and material the fight made; the next build starts fresh. */
  clear(): void {
    for (const b of this.batches) b.destroy();
    for (const m of this.meshes) m.destroy();
    for (const m of this.materials) m.destroy();
    this.batches = [];
    this.meshes.clear();
    this.materials.clear();
    this.lanes = null;
    this.root.enabled = false;
    this.last = { ...NOTHING };
  }

  /** The screen point of a point in the fight's frame (CSS pixels; z is depth, positive in front). */
  private screen(p: V3): { x: number; y: number; z: number } {
    const w = toWorld(this.frame, p);
    return this.stage.camera.camera!.worldToScreen(new pc.Vec3(w.x, w.y, w.z));
  }

  /** The ship or wreck nearest the tap, within `reach` pixels. Landers are not picked. */
  pick(x: number, y: number, now: FleetNow, reach = 28): { id: number; wreck: boolean } | null {
    if (!this.lanes) return null;
    const cands: { id: number; wreck: boolean; p: V3 }[] = [
      ...now.ships.filter((s) => !s.lander).map((s) => ({ id: s.id, wreck: false, p: s.p })),
      ...now.wrecks.map((w) => ({ id: w.id, wreck: true, p: w.p })),
    ];
    let best: { id: number; wreck: boolean } | null = null,
      bestD = reach;
    for (const c of cands) {
      const q = this.screen(c.p);
      if (q.z <= 0) continue;
      const d = Math.hypot(q.x - x, q.y - y);
      if (d <= bestD) {
        bestD = d;
        best = { id: c.id, wreck: c.wreck };
      }
    }
    return best;
  }

  /**
   * The living ship of a class nearest the middle of the screen, inside the screen and clear of the
   * top 80 px and bottom 200 px; else the nearest of any class in that band.
   */
  shipOnScreen(now: FleetNow, cls: 0 | 1 | 2): { id: number; x: number; y: number } | null {
    const W = innerWidth,
      H = innerHeight,
      mx = W / 2,
      my = H / 2;
    let same: Hit | null = null,
      any: Hit | null = null;
    for (const s of now.ships) {
      if (s.lander) continue;
      const q = this.screen(s.p);
      if (q.z <= 0 || q.x < 0 || q.x > W || q.y < 80 || q.y > H - 200) continue;
      const hit: Hit = { id: s.id, x: q.x, y: q.y, d: Math.hypot(q.x - mx, q.y - my) };
      if (!any || hit.d < any.d) any = hit;
      if (s.cls === cls && (!same || hit.d < same.d)) same = hit;
    }
    const found = same ?? any;
    return found ? { id: found.id, x: found.x, y: found.y } : null;
  }

  /** What the last update drew: instances per kind, batches with something in them, and triangles. */
  get shown(): {
    ships: number;
    wrecks: number;
    beams: number;
    missiles: number;
    flashes: number;
    sparks: number;
    drawCalls: number;
    triangles: number;
  } {
    return { ...this.last };
  }
}
