// A landing on a world of natives, as the render draws it (Phase 70, first slice): those who came and those who met them,
// each in their own bodies, made soldiers in made ones; their landers, their fire, the stones thrown back, what burns. Under
// one root of its own, off the village's and the camp's (render/village.ts build() destroys what is not on its hand-kept
// list). Every frame's matrices are written afresh from the script, so nothing builds up. A tenth of a unit to the metre.
import * as pc from "playcanvas";
import type { LandfallPlan } from "../bridge/index.ts";
import {
  TOWN_FRAME,
  armLook,
  figureOf,
  figurePaint,
  flameGeometry,
  fleetLooks,
  limbPitch,
  poseMatrix,
  shipGeometry,
  type Figure,
  type LandfallFigure,
  type LandfallNow,
  type LandfallScript,
  type PartShape,
  type ShipGeometry,
} from "../view/index.ts";
import { BlazeLayer } from "./blaze.ts";
import { InstancedBatch, boxMesh, capsuleMesh, coneMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

const M = 0.1;
const WHITE: Rgb = [1, 1, 1];
const UP = { x: 0, y: 1, z: 0 };
const NOTHING = {
  landers: 0,
  comers: 0,
  natives: 0,
  fallen: 0,
  bolts: 0,
  stones: 0,
  fires: 0,
  drawCalls: 0,
  triangles: 0,
};
type Lane = { readonly batch: InstancedBatch; readonly cap: number; readonly tris: number };
type Tone = Figure["parts"][number]["tone"];
type Host = { readonly figure: Figure; readonly lanes: readonly Lane[]; readonly scale: number };
type Parts = {
  readonly landers: Lane;
  readonly flames: Lane;
  readonly ramps: Lane;
  readonly flesh: Host;
  readonly made: Host | null;
  readonly natives: Host;
  readonly guns: Lane;
  readonly spears: Lane | null;
  readonly bolts: readonly [Lane, Lane];
  readonly stones: Lane;
  readonly stains: Lane;
};

const SHAPE_MESH: Record<PartShape, (stage: Stage) => pc.Mesh> = {
  capsule: (stage) => capsuleMesh(stage, 0.11, 0.55),
  box: (stage) => boxMesh(stage),
  cylinder: (stage) => cylinderMesh(stage, 0.5, 1, 8),
  cone: (stage) => coneMesh(stage, 0.5, 1, 8),
};
const trisOf = (mesh: pc.Mesh): number => Math.floor((mesh.primitive[0]?.count ?? 0) / 3);

function meshOf(stage: Stage, g: ShipGeometry): pc.Mesh {
  const mesh = new pc.Mesh(stage.device);
  mesh.setPositions(g.positions);
  mesh.setNormals(g.normals);
  mesh.setColors32(g.colors);
  mesh.setIndices(g.indices);
  mesh.update();
  return keptMesh(mesh);
}
function hullMaterial(): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuseVertexColor = true;
  m.gloss = 0.35;
  m.useFog = false;
  m.emissive = new pc.Color(0.1, 0.1, 0.12);
  m.update();
  return m;
}
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
function aglow(color: Rgb, k = 0.35): pc.StandardMaterial {
  const m = flatMaterial(color);
  m.emissive = new pc.Color(color[0] * k, color[1] * k, color[2] * k);
  m.update();
  return m;
}

export class LandfallLayer {
  readonly root: pc.Entity;
  private readonly stage: Stage;
  private parts: Parts | null = null;
  private batches: InstancedBatch[] = [];
  private meshes = new Set<pc.Mesh>();
  private materials = new Set<pc.Material>();
  private last = { ...NOTHING };
  /** A camp alight, as a town burns; built once, with the first film that burns anything. */
  private blaze: BlazeLayer | null = null;

  constructor(stage: Stage) {
    this.stage = stage;
    this.root = new pc.Entity("landfall");
    this.root.enabled = false;
    stage.root.addChild(this.root);
  }

  private lane(mesh: pc.Mesh, material: pc.Material, capacity: number): Lane {
    this.meshes.add(mesh);
    this.materials.add(material);
    const batch = new InstancedBatch(this.stage, mesh, WHITE, capacity, this.root, material);
    this.batches.push(batch);
    return { batch, cap: batch.capacity, tris: trisOf(mesh) };
  }

  /** A host's batches: one for each part of its figure, each in its tone. */
  private host(figure: Figure, cap: number, tone: (t: Tone) => Rgb, glow: number): Host {
    const byShape = new Map<PartShape, pc.Mesh>(),
      shapeMesh = (shape: PartShape): pc.Mesh => {
        let mesh = byShape.get(shape);
        if (!mesh) {
          mesh = keptMesh(SHAPE_MESH[shape](this.stage));
          byShape.set(shape, mesh);
        }
        return mesh;
      };
    return {
      figure,
      scale: figure.scale * 1.05,
      lanes: figure.parts.map((part) =>
        this.lane(shapeMesh(part.shape), aglow(tone(part.tone), glow), cap),
      ),
    };
  }

  /** Builds the batches for one landing. */
  build(plan: LandfallPlan, script: LandfallScript, detail: number): void {
    this.clear();
    const stage = this.stage,
      [r, g, b] = plan.color,
      look = fleetLooks(
        {
          ref: plan.whoRef,
          kind: plan.kind === "home" ? "realm" : "people",
          name: plan.who,
          words: plan.who,
          color: plan.color,
          strength: 1,
          machines: null,
          gravity: plan.gravity,
          medium: "land",
          clade: null,
          drive: "antimatter",
          arm: "beam",
          beamArm: null,
          minds: plan.made > 0,
          sky: "fleet",
        },
        {
          ref: plan.nativesRef,
          kind: "people",
          name: plan.natives,
          words: plan.natives,
          color: [0.5, 0.5, 0.5],
          strength: 1,
          machines: null,
          gravity: plan.gravity,
          medium: "land",
          clade: null,
          drive: "fusion",
          arm: "missile",
          beamArm: null,
          minds: false,
          sky: "none",
        },
      )[0],
      capC = Math.max(1, script.comers.length),
      capN = Math.max(1, script.natives.length),
      bodyC: Rgb = [0.25 + 0.5 * r, 0.25 + 0.5 * g, 0.25 + 0.5 * b],
      darkC: Rgb = [0.15 + 0.35 * r, 0.15 + 0.35 * g, 0.15 + 0.35 * b],
      skinC: Rgb = [0.45 + 0.45 * r, 0.45 + 0.45 * g, 0.45 + 0.45 * b],
      paintC = figurePaint(plan.figure, "modern", 0),
      toneC = (tone: Tone): Rgb =>
        paintC.folk
          ? tone === 5
            ? bodyC
            : paintC.tones[tone]
          : tone === 4
            ? [0.04, 0.04, 0.06]
            : tone === 2
              ? skinC
              : tone === 1 || tone === 3
                ? darkC
                : bodyC,
      steel: Rgb = [0.56 + 0.1 * r, 0.6 + 0.1 * g, 0.66 + 0.1 * b],
      toneM = (tone: Tone): Rgb =>
        tone === 4
          ? [1, 0.25, 0.15]
          : tone === 2
            ? [0.2 + 0.7 * r, 0.2 + 0.7 * g, 0.2 + 0.7 * b]
            : tone === 1 || tone === 3
              ? [0.2, 0.22, 0.26]
              : steel,
      paintN = figurePaint(plan.nativeFigure, "forage", 0),
      toneN = (tone: Tone): Rgb => paintN.tones[tone],
      arm = armLook(plan.arm).beam ?? ([1, 0.85, 0.4] as Rgb),
      armN = armLook(plan.nativeArm).beam ?? ([1, 0.85, 0.4] as Rgb);
    this.parts = {
      landers: this.lane(meshOf(stage, shipGeometry(look, "lander")), hullMaterial(), 4),
      flames: this.lane(meshOf(stage, flameGeometry()), lightMaterial(look.engine), 4),
      ramps: this.lane(boxMesh(stage), flatMaterial(look.dark), 4),
      flesh: this.host(figureOf(plan.figure, detail), capC, toneC, 0.3),
      made: plan.made > 0 ? this.host(figureOf(null, detail), capC, toneM, 0.25) : null,
      natives: this.host(figureOf(plan.nativeFigure, detail), capN, toneN, 0.16),
      guns: this.lane(boxMesh(stage), flatMaterial([0.16, 0.16, 0.2]), capC),
      spears: plan.nativeHolds
        ? this.lane(boxMesh(stage), flatMaterial([0.55, 0.42, 0.26]), capN)
        : null,
      bolts: [
        this.lane(boxMesh(stage), lightMaterial(arm as Rgb), 28),
        this.lane(boxMesh(stage), lightMaterial(armN as Rgb), 12),
      ],
      stones: this.lane(boxMesh(stage), flatMaterial([0.42, 0.4, 0.38]), 14),
      stains: this.lane(
        cylinderMesh(stage, 0.5, 1, 10),
        flatMaterial([0.05, 0.04, 0.05], 0.45),
        capC + capN,
      ),
    };
    if (plan.won && plan.burns) this.blaze ??= new BlazeLayer(stage, this.root);
    this.root.enabled = true;
  }

  /** One host, part by part. */
  private writeHost(
    host: Host,
    list: readonly LandfallFigure[],
    clock: number,
    count: (lane: Lane, n: number) => void,
  ): void {
    const n = list.length;
    host.figure.parts.forEach((part, pi) => {
      const lane = host.lanes[pi]!,
        k = Math.min(n, lane.cap);
      lane.batch.set(k, (q, out) => {
        const f = list[q]!,
          walking =
            f.doing === "out" || f.doing === "run" || f.doing === "flee" || f.doing === "back",
          pace = f.doing === "run" || f.doing === "flee" ? 4 : 2.2,
          pitch = limbPitch(part, null, walking || f.doing === "strike", clock * pace + f.i, f.i),
          hinge = part.pivot ?? 0,
          py = part.y + hinge - hinge * Math.cos(pitch),
          pz = part.z - hinge * Math.sin(pitch),
          c = Math.cos(f.yaw),
          sn = Math.sin(f.yaw),
          s = host.scale;
        if (f.doing === "fallen") {
          out[0] = f.x * M + (part.x * c + py * sn) * s;
          // (Flat to the ground, whatever its body: a low body lying reads as one standing otherwise.)
          out[1] = 0.04 + part.z * s * 0.4;
          out[2] = f.z * M + (-part.x * sn + py * c) * s;
          out[7] = Math.PI / 2;
        } else {
          out[0] = f.x * M + (part.x * c + pz * sn) * s;
          out[1] = py * s;
          out[2] = f.z * M + (-part.x * sn + pz * c) * s;
          out[7] = pitch;
        }
        out[3] = part.sx * s * f.size;
        out[4] = part.sy * s * f.size;
        out[5] = part.sz * s * f.size * (f.doing === "fallen" ? 0.4 : 1);
        out[6] = f.yaw;
      });
      count(lane, k);
    });
  }

  update(now: LandfallNow, script: LandfallScript, clock: number): void {
    const P = this.parts;
    if (!P) return;
    let drawCalls = 0,
      triangles = 0;
    const count = (lane: Lane, n: number): void => {
      if (n <= 0) return;
      drawCalls += 1;
      triangles += n * lane.tris;
    };
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
    // The hosts: those drawn at all, the made in their own bodies.
    const shownC = now.comers.filter((c) => c.size > 0),
      flesh = shownC.filter((c) => !script.comers[c.i]!.made),
      made = shownC.filter((c) => script.comers[c.i]!.made),
      shownN = now.natives.filter((n) => n.size > 0);
    this.writeHost(P.flesh, flesh, clock, count);
    if (P.made) this.writeHost(P.made, made, clock, count);
    this.writeHost(P.natives, shownN, clock, count);
    // Where they lie, dark on the ground.
    const lying = [
        ...shownC.filter((c) => c.doing === "fallen").map((f) => ({ f, s: P.flesh.scale })),
        ...shownN.filter((n) => n.doing === "fallen").map((f) => ({ f, s: P.natives.scale })),
      ],
      nl2 = Math.min(lying.length, P.stains.cap);
    P.stains.batch.set(nl2, (q, out) => {
      const { f, s } = lying[q]!;
      out[0] = f.x * M;
      out[1] = 0.015;
      out[2] = f.z * M;
      out[3] = out[5] = 0.62 * s;
      out[4] = 0.01;
      out[6] = 0;
      out[7] = 0;
    });
    count(P.stains, nl2);
    // What they carry.
    const armed = shownC.filter((c) => c.doing !== "fallen"),
      ng = Math.min(armed.length, P.guns.cap);
    P.guns.batch.set(ng, (q, out) => {
      const r = armed[q]!,
        c = Math.cos(r.yaw),
        sn = Math.sin(r.yaw);
      out[0] = r.x * M + sn * 0.14;
      out[1] = 0.36;
      out[2] = r.z * M + c * 0.14;
      out[3] = 0.035;
      out[4] = 0.035;
      out[5] = 0.42;
      out[6] = r.yaw;
      out[7] = 0;
    });
    count(P.guns, ng);
    if (P.spears) {
      const up = shownN.filter((n) => n.doing !== "fallen"),
        ns = Math.min(up.length, P.spears.cap),
        s = P.natives.scale;
      P.spears.batch.set(ns, (q, out) => {
        const r = up[q]!,
          c = Math.cos(r.yaw),
          sn = Math.sin(r.yaw);
        out[0] = r.x * M + (c * 0.13 + sn * 0.08) * s;
        out[1] = 0.46 * s;
        out[2] = r.z * M + (-sn * 0.13 + c * 0.08) * s;
        out[3] = 0.018 * s;
        out[4] = 0.018 * s;
        out[5] = 0.95 * s;
        out[6] = r.yaw;
        out[7] = r.doing === "run" ? -0.25 : -1.35;
      });
      count(P.spears, ns);
    }
    // The fire: a thin box from one end to the other; thicker the further the eye is, so a shot can be seen.
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
            { x: ((b.ax + b.bx) / 2) * M, y: ((b.ay + b.by) / 2) * M, z: ((b.az + b.bz) / 2) * M },
            { x: dx, y: dy, z: dz },
            0,
            0.022,
            0.022,
            Math.hypot(dx, dy, dz),
          );
        }
      });
      count(lane, n);
      bolts += n;
    }
    const ns = Math.min(now.stones.length, P.stones.cap);
    P.stones.batch.set(ns, (q, out) => {
      const s = now.stones[q]!;
      out[0] = s.x * M;
      out[1] = s.y * M;
      out[2] = s.z * M;
      out[3] = 0.07;
      out[4] = 0.07;
      out[5] = 0.07;
      out[6] = q;
      out[7] = q * 0.7;
    });
    count(P.stones, ns);
    // What burns on a camp's ground, as a town burns: tongues, a hot core, sparks, the smoke rolling off.
    const nb = now.fires.length,
      alight = now.fires.map((f, j) => ({
        lot: -1,
        x: f.x,
        z: f.z,
        yaw: j * 2.399963,
        k: f.size,
        size: 0.7,
        high: 5,
        wide: 5,
      }));
    this.blaze?.update(
      { fires: alight, smoke: alight, dust: [], shake: 0 },
      clock,
      this.stage.quality.motion,
      null,
    );
    this.last = {
      landers: nl,
      comers: shownC.length,
      natives: shownN.length,
      fallen:
        shownC.filter((c) => c.doing === "fallen").length +
        shownN.filter((n) => n.doing === "fallen").length,
      bolts,
      stones: ns,
      fires: nb,
      drawCalls,
      triangles,
    };
  }

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

  /** Where a point of the ground stands on the screen (CSS pixels; null: behind the eye). */
  screen(x: number, z: number, high = 3): { x: number; y: number } | null {
    const q = this.stage.camera.camera!.worldToScreen(new pc.Vec3(x * M, high * M, z * M));
    return q.z > 0 ? { x: q.x, y: q.y } : null;
  }

  get shown(): typeof NOTHING {
    return { ...this.last };
  }
}
