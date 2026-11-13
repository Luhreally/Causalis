// The town under a raid as the render draws it (Phase 67, Act 2): the four landers with their flames
// and ramps, the raiders in their own bodies, their guns, and the bolts between them. The batches sit
// under one root of their own (not the village's, which re-lays its children). Every frame's matrices
// are written afresh from the script at this time, so scrubbing is exact and nothing builds up. Units
// are the village's: a tenth of a unit to the metre.
import * as pc from "playcanvas";
import type { StarFightPlan } from "../bridge/index.ts";
import {
  LANDERS,
  TOWN_FRAME,
  boltColors,
  figureOf,
  figurePaint,
  flameGeometry,
  fleetLooks,
  limbPitch,
  poseMatrix,
  raidersAt,
  shipGeometry,
  type Figure,
  type InvasionNow,
  type PartShape,
  type ShipGeometry,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, capsuleMesh, coneMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

/** A tenth of a unit to the metre. */
const M = 0.1;
const WHITE: Rgb = [1, 1, 1];
const UP = { x: 0, y: 1, z: 0 };
const NOTHING = { landers: 0, raiders: 0, bolts: 0, drawCalls: 0, triangles: 0 };
type Lane = { readonly batch: InstancedBatch; readonly cap: number; readonly tris: number };
type Tone = Figure["parts"][number]["tone"];
/** The batches the town's film is drawn with, made by build for one raid. */
type Parts = {
  readonly landers: Lane;
  readonly flames: Lane;
  readonly ramps: Lane;
  readonly figure: Figure;
  readonly raiders: Lane[]; // one per figure part
  readonly guns: Lane;
  readonly bolts: [Lane, Lane]; // the raiders' bolts, then the guard's
  readonly cap: number; // raidersAt(detail)
};

const SHAPE_MESH: Record<PartShape, (stage: Stage) => pc.Mesh> = {
  capsule: (stage) => capsuleMesh(stage, 0.11, 0.55),
  box: (stage) => boxMesh(stage),
  cylinder: (stage) => cylinderMesh(stage, 0.5, 1, 8),
  cone: (stage) => coneMesh(stage, 0.5, 1, 8),
};

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

/** A visitor's colour, lit as anything is, and a little aglow besides (as the visitors are drawn). */
function aglow(color: Rgb): pc.StandardMaterial {
  const m = flatMaterial(color);
  m.emissive = new pc.Color(color[0] * 0.35, color[1] * 0.35, color[2] * 0.35);
  m.update();
  return m;
}

export class InvasionLayer {
  readonly root: pc.Entity;
  private readonly stage: Stage;
  private parts: Parts | null = null;
  private batches: InstancedBatch[] = [];
  private meshes = new Set<pc.Mesh>();
  private materials = new Set<pc.Material>();
  private last: typeof NOTHING = { ...NOTHING };

  constructor(stage: Stage) {
    this.stage = stage;
    this.root = new pc.Entity("invasion");
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

  /** Builds the town's batches for one raid: the landers, their people in their own bodies, the guns, the bolts. */
  build(plan: StarFightPlan, detail: number): void {
    this.clear();
    const L = plan.landing;
    if (!L) return;
    const stage = this.stage,
      look = fleetLooks(plan.attacker, plan.defender)[0],
      cap = raidersAt(detail),
      figure = figureOf(L.raiders.body, detail),
      paint = figurePaint(L.raiders.body, "modern", 0),
      [r, g, b] = L.raiders.color,
      body: Rgb = [0.25 + 0.5 * r, 0.25 + 0.5 * g, 0.25 + 0.5 * b],
      dark: Rgb = [0.15 + 0.35 * r, 0.15 + 0.35 * g, 0.15 + 0.35 * b],
      skin: Rgb = [0.45 + 0.45 * r, 0.45 + 0.45 * g, 0.45 + 0.45 * b],
      // (The tones as the visitors take them: their own look where a people has one.)
      toneOf = (tone: Tone): Rgb =>
        paint.folk
          ? tone === 5
            ? body
            : paint.tones[tone]
          : tone === 4
            ? [0.04, 0.04, 0.06]
            : tone === 2
              ? skin
              : tone === 1 || tone === 3
                ? dark
                : body,
      byShape = new Map<PartShape, pc.Mesh>(),
      shapeMesh = (shape: PartShape): pc.Mesh => {
        let mesh = byShape.get(shape);
        if (!mesh) {
          mesh = keptMesh(SHAPE_MESH[shape](stage));
          byShape.set(shape, mesh);
        }
        return mesh;
      },
      colors = boltColors(plan);
    this.parts = {
      landers: this.lane(meshOf(stage, shipGeometry(look, "lander")), hullMaterial(), LANDERS),
      flames: this.lane(meshOf(stage, flameGeometry()), lightMaterial(look.engine), LANDERS),
      ramps: this.lane(boxMesh(stage), flatMaterial(look.dark), LANDERS),
      figure,
      raiders: figure.parts.map((part) =>
        this.lane(shapeMesh(part.shape), aglow(toneOf(part.tone)), cap),
      ),
      guns: this.lane(boxMesh(stage), flatMaterial([0.2, 0.2, 0.24]), cap),
      bolts: [
        this.lane(boxMesh(stage), lightMaterial(colors[0]), 16),
        this.lane(boxMesh(stage), lightMaterial(colors[1]), 8),
      ],
      cap,
    };
    this.root.enabled = true;
  }

  /** Writes every batch for the time `now` (and the screen's `clock` for limbs). Nothing is kept from before. */
  update(now: InvasionNow, clock: number): void {
    const P = this.parts;
    if (!P) return;
    let drawCalls = 0,
      triangles = 0;
    const count = (lane: Lane, n: number): void => {
      if (n <= 0) return;
      drawCalls += 1;
      triangles += n * lane.tris;
    };

    // The landers: hulls nose up on their own yaw, flames while they burn, ramps while they stand.
    const ls = now.landers,
      nl = Math.min(ls.length, P.landers.cap);
    P.landers.batch.setMatrices(nl, (m) => {
      for (let j = 0; j < nl; j++) {
        const l = ls[j]!;
        poseMatrix(
          m,
          j * 16,
          TOWN_FRAME,
          { x: l.x * M, y: l.high * M + 1.1, z: l.z * M },
          UP,
          l.yaw,
          2.2,
          2.2,
          2.2,
        );
      }
    });
    count(P.landers, nl);

    const burning = ls.filter((l) => l.burn !== 0),
      nf = Math.min(burning.length, P.flames.cap);
    P.flames.batch.setMatrices(nf, (m) => {
      for (let j = 0; j < nf; j++) {
        const l = burning[j]!;
        poseMatrix(
          m,
          j * 16,
          TOWN_FRAME,
          { x: l.x * M, y: l.high * M + 0.05, z: l.z * M },
          UP,
          l.yaw,
          0.9,
          0.9,
          1.6 * l.burn,
        );
      }
    });
    count(P.flames, nf);

    const ramps = ls.filter((l) => l.ramp !== 0 && l.high <= 0),
      nr = Math.min(ramps.length, P.ramps.cap);
    P.ramps.batch.set(nr, (q, out) => {
      const l = ramps[q]!;
      out[0] = l.x * M + Math.sin(l.yaw) * 1.1;
      out[1] = 0.05;
      out[2] = l.z * M + Math.cos(l.yaw) * 1.1;
      out[3] = 0.5;
      out[4] = 0.05;
      out[5] = 0.9 * l.ramp;
      out[6] = l.yaw;
      out[7] = 0;
    });
    count(P.ramps, nr);

    // The raiders, in their own bodies: one batch per part of the figure, each raider's limbs swung
    // by its own slot (its index, so a gait does not jump when another raider comes or goes).
    const alive = now.raiders.filter((r) => r.size > 0),
      nR = Math.min(alive.length, P.cap),
      scale = P.figure.scale * 1.05;
    P.figure.parts.forEach((part, pi) => {
      const lane = P.raiders[pi]!;
      lane.batch.set(nR, (q, out) => {
        const r = alive[q]!,
          slot = r.i,
          walking = r.doing === "advance" || r.doing === "back",
          pitch = limbPitch(part, null, walking, clock * 2.2 + slot, slot),
          hinge = part.pivot ?? 0,
          py = part.y + hinge - hinge * Math.cos(pitch),
          pz = part.z - hinge * Math.sin(pitch),
          c = Math.cos(r.yaw),
          sn = Math.sin(r.yaw);
        if (r.doing === "fallen") {
          out[0] = r.x * M + (part.x * c + py * sn) * scale;
          out[1] = 0.04 + part.z * scale;
          out[2] = r.z * M + (-part.x * sn + py * c) * scale;
          out[7] = Math.PI / 2;
        } else {
          out[0] = r.x * M + (part.x * c + pz * sn) * scale;
          out[1] = py * scale;
          out[2] = r.z * M + (-part.x * sn + pz * c) * scale;
          out[7] = pitch;
        }
        out[3] = part.sx * scale * r.size;
        out[4] = part.sy * scale * r.size;
        out[5] = part.sz * scale * r.size;
        out[6] = r.yaw;
      });
      count(lane, nR);
    });

    // Their guns, carried at the hip of each raider still on its feet.
    const armed = alive.filter((r) => r.doing !== "fallen"),
      ng = Math.min(armed.length, P.guns.cap);
    P.guns.batch.set(ng, (q, out) => {
      const r = armed[q]!,
        c = Math.cos(r.yaw),
        sn = Math.sin(r.yaw);
      out[0] = r.x * M + sn * 0.12;
      out[1] = 0.33;
      out[2] = r.z * M + c * 0.12;
      out[3] = 0.03;
      out[4] = 0.03;
      out[5] = 0.3;
      out[6] = r.yaw;
      out[7] = 0;
    });
    count(P.guns, ng);

    // The bolts, each a thin box from one end to the other.
    let bolts = 0;
    for (const side of [0, 1] as const) {
      const lane = P.bolts[side],
        list = now.bolts.filter((b) => b.side === side),
        n = Math.min(list.length, lane.cap);
      lane.batch.setMatrices(n, (m) => {
        for (let q = 0; q < n; q++) {
          const b = list[q]!,
            dx = (b.bx - b.ax) * M,
            dy = (b.by - b.ay) * M,
            dz = (b.bz - b.az) * M;
          poseMatrix(
            m,
            q * 16,
            TOWN_FRAME,
            {
              x: ((b.ax + b.bx) / 2) * M,
              y: ((b.ay + b.by) / 2) * M,
              z: ((b.az + b.bz) / 2) * M,
            },
            { x: dx, y: dy, z: dz },
            0,
            0.035,
            0.035,
            Math.hypot(dx, dy, dz),
          );
        }
      });
      count(lane, n);
      bolts += n;
    }

    this.last = { landers: nl, raiders: nR, bolts, drawCalls, triangles };
  }

  /** Frees every batch, mesh and material the town's film made; the next build starts fresh. */
  clear(): void {
    for (const b of this.batches) b.destroy();
    for (const m of this.meshes) m.destroy();
    for (const m of this.materials) m.destroy();
    this.batches = [];
    this.meshes.clear();
    this.materials.clear();
    this.parts = null;
    this.root.enabled = false;
    this.last = { ...NOTHING };
  }

  /** The screen point of a point in the town's metres (CSS pixels; z is depth, positive in front). */
  private screen(x: number, y: number, z: number): { x: number; y: number; z: number } {
    return this.stage.camera.camera!.worldToScreen(new pc.Vec3(x, y, z));
  }

  /** The raider nearest the tap (about its middle, within `reach` pixels); else a lander within 60 px. */
  pick(
    x: number,
    y: number,
    now: InvasionNow,
    reach = 26,
  ): { raider: number; d: number } | { lander: number } | null {
    if (!this.parts) return null;
    let best: { raider: number; d: number } | null = null,
      bestD = reach;
    for (const r of now.raiders) {
      if (r.size <= 0 || r.doing === "fallen") continue;
      const q = this.screen(r.x * M, 0.3, r.z * M);
      if (q.z <= 0) continue;
      const d = Math.hypot(q.x - x, q.y - y);
      if (d <= bestD) {
        bestD = d;
        best = { raider: r.i, d };
      }
    }
    if (best) return best;
    let lander: { lander: number } | null = null,
      landerD = 60;
    for (const l of now.landers) {
      const q = this.screen(l.x * M, l.high * M + 1.1, l.z * M);
      if (q.z <= 0) continue;
      const d = Math.hypot(q.x - x, q.y - y);
      if (d <= landerD) {
        landerD = d;
        lander = { lander: l.j };
      }
    }
    return lander;
  }

  /**
   * The raider on its feet nearest the middle of the screen, inside the screen and clear of the top
   * 80 px and bottom 200 px.
   */
  raiderOnScreen(now: InvasionNow): { i: number; x: number; y: number } | null {
    if (!this.parts) return null;
    const W = innerWidth,
      H = innerHeight,
      mx = W / 2,
      my = H / 2;
    let best: { i: number; x: number; y: number; d: number } | null = null;
    for (const r of now.raiders) {
      if (r.size <= 0 || r.doing === "fallen") continue;
      const q = this.screen(r.x * M, 0.3, r.z * M);
      if (q.z <= 0 || q.x < 0 || q.x > W || q.y < 80 || q.y > H - 200) continue;
      const d = Math.hypot(q.x - mx, q.y - my);
      if (!best || d < best.d) best = { i: r.i, x: q.x, y: q.y, d };
    }
    return best ? { i: best.i, x: best.x, y: best.y } : null;
  }

  /** What the last update drew: landers, raiders on their feet or walking, bolts, batches, triangles. */
  get shown(): {
    landers: number;
    raiders: number;
    bolts: number;
    drawCalls: number;
    triangles: number;
  } {
    return { ...this.last };
  }
}
