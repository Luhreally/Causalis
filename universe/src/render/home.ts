// A home looked into, drawn (Lives L6): its parts in batches by mesh and colour under a root of its own, its people posed as the town
// poses them, its roof lifted off as it opens. Made when it is opened and destroyed when it is closed: a player who never opens one pays
// nothing, and one looking into it pays only for what is on the screen.
import * as pc from "playcanvas";
import type { VillagePlan } from "../bridge/index.ts";
import {
  dressedOn,
  figureOf,
  hairOf,
  limbPitch,
  personGroup,
  seatedSink,
  type HomeDrawn,
  type HomeMesh,
  type HomeParts,
  type HomeSpot,
  type PartShape,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, capsuleMesh, coneMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { lieDown } from "./possess.ts";
import type { Stage } from "./stage.ts";
import { FIGURE_CAPSULE } from "../view/index.ts";

/** How long the roof takes to lift off (seconds), and how far it goes (world units). */
const LID_SECONDS = 1.1,
  LID_RISE = 9;
const M = 0.1;

export class HomeScene {
  private readonly stage: Stage;
  private root: pc.Entity | null = null;
  private lid: pc.Entity | null = null;
  private batches: InstancedBatch[] = [];
  private lidBatches: InstancedBatch[] = [];
  private lidAt = 0;
  private meshes: Record<HomeMesh | PartShape, pc.Mesh> | null = null;
  /** What was drawn, for a finger's picking and the look tools. */
  drawn: HomeDrawn | null = null;
  /** How long it took to build (ms). */
  built = 0;

  constructor(stage: Stage) {
    this.stage = stage;
  }

  get open(): boolean {
    return !!this.root;
  }

  private meshesNow(): Record<HomeMesh | PartShape, pc.Mesh> {
    if (this.meshes) return this.meshes;
    const s = this.stage,
      box = keptMesh(boxMesh(s)),
      cyl = keptMesh(cylinderMesh(s, 0.5, 1, 14)),
      cone = keptMesh(coneMesh(s, 0.5, 1, 10));
    return (this.meshes = {
      box,
      cyl,
      cone,
      capsule: keptMesh(capsuleMesh(s, FIGURE_CAPSULE.radius, FIGURE_CAPSULE.height)),
      cylinder: cyl,
    });
  }

  private fill(parts: HomeParts, under: pc.Entity, list: InstancedBatch[]): void {
    const meshes = this.meshesNow();
    for (const g of parts.groups.values()) {
      const n = g.data.length / 8;
      if (!n) continue;
      const b = new InstancedBatch(
        this.stage,
        meshes[g.mesh],
        [g.color[0], g.color[1], g.color[2]],
        n,
        under,
      );
      if (g.glow) b.glow([g.color[0], g.color[1], g.color[2]]);
      const d = g.data;
      b.set(n, (i, out) => {
        const o = i * 8;
        for (let k = 0; k < 8; k++) out[k] = d[o + k]!;
      });
      list.push(b);
    }
  }

  /** Those in, posed as the town poses them, in their own colours. */
  private people(plan: VillagePlan, drawn: HomeDrawn, under: pc.Entity): void {
    const meshes = this.meshesNow(),
      figure = figureOf(plan.body),
      parts = figure.parts;
    // (By part and colour, so the same part of two of one group is one draw.)
    const groups = new Map<string, { mesh: pc.Mesh; color: readonly number[]; data: number[] }>();
    const out = [0, 0, 0, 1, 1, 1, 0, 0];
    drawn.folk.forEach((f) => {
      if (f.at !== "in") return;
      const p = plan.people[f.index]!,
        group = personGroup(p),
        paint = dressedOn(plan.body, plan.era, Math.min(3, group), plan.colony),
        hair = paint.hairs[hairOf(p.ref, p.age, plan.body?.span ?? 70) % paint.hairs.length]!,
        size = (p.child ? 0.7 : 1) * figure.scale,
        sink = f.lying ? 0 : seatedSink(parts, f.task),
        c = Math.cos(f.yaw),
        s = Math.sin(f.yaw);
      parts.forEach((part) => {
        const pitch = f.lying ? 0 : limbPitch(part, f.task, false, 0.1, f.index),
          hinge = part.pivot ?? 0,
          dy = hinge - hinge * Math.cos(pitch),
          dz = -hinge * Math.sin(pitch),
          px = part.x,
          pz = part.z + dz;
        out[0] = f.x + (px * c + pz * s) * size;
        out[1] = f.y + (part.y + dy - sink) * size;
        out[2] = f.z + (-px * s + pz * c) * size;
        out[3] = part.sx * size;
        out[4] = part.sy * size;
        out[5] = part.sz * size;
        out[6] = f.yaw;
        out[7] = pitch;
        if (f.lying) {
          lieDown(out, part, f.x / M, f.z / M, f.yaw, size, 0);
          out[1]! += f.y;
        }
        const color = part.tone === 3 ? hair : paint.tones[part.tone],
          key = `${part.shape}|${color[0]}|${color[1]}|${color[2]}`;
        let g = groups.get(key);
        if (!g) groups.set(key, (g = { mesh: meshes[part.shape], color, data: [] }));
        g.data.push(...out);
      });
    });
    for (const g of groups.values()) {
      const n = g.data.length / 8,
        b = new InstancedBatch(
          this.stage,
          g.mesh,
          [g.color[0]!, g.color[1]!, g.color[2]!],
          n,
          under,
        ),
        d = g.data;
      b.set(n, (i, o) => {
        for (let k = 0; k < 8; k++) o[k] = d[i * 8 + k]!;
      });
      this.batches.push(b);
    }
  }

  /** Build it: the home's parts, its people, its roof on, ready to lift. */
  show(drawn: HomeDrawn, plan: VillagePlan): void {
    const t0 = performance.now();
    this.close();
    const root = new pc.Entity("home");
    this.stage.root.addChild(root);
    const lid = new pc.Entity("home-lid");
    root.addChild(lid);
    this.fill(drawn.parts, root, this.batches);
    this.people(plan, drawn, root);
    this.fill(drawn.lid, lid, this.lidBatches);
    this.root = root;
    this.lid = lid;
    this.lidAt = 0;
    this.drawn = drawn;
    this.built = performance.now() - t0;
  }

  /** Its roof goes up and away as it opens; then nothing moves here at all. */
  update(dt: number): void {
    if (!this.lid) return;
    this.lidAt += dt;
    const k = Math.min(1, this.lidAt / LID_SECONDS);
    this.lid.setLocalPosition(0, LID_RISE * k * k, 0);
    if (k >= 1) this.dropLid();
  }
  private dropLid(): void {
    for (const b of this.lidBatches) b.destroy();
    this.lidBatches = [];
    this.lid?.destroy();
    this.lid = null;
  }

  /** Whether its roof has come off. */
  get lifted(): boolean {
    return this.open && !this.lid;
  }

  /** What is under a screen point, within a finger's reach: its nearest, a person before a thing, a rug last. */
  pick(x: number, y: number, reach = 34): HomeSpot | null {
    const drawn = this.drawn;
    if (!drawn || !this.root) return null;
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3(),
      from = new pc.Vec3();
    let best: HomeSpot | null = null,
      bestD = reach;
    for (const s of drawn.spots) {
      const p = cam.worldToScreen(from.set(s.x, s.y, s.z), at),
        d = Math.hypot(p.x - x, p.y - y) + s.under;
      if (p.z > 0 && d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  /** Where a thing or a person is on the screen (the look tools, a press). */
  onScreen(s: HomeSpot): { x: number; y: number } | null {
    const p = this.stage.camera.camera!.worldToScreen(new pc.Vec3(s.x, s.y, s.z));
    return p.z > 0 ? { x: p.x, y: p.y } : null;
  }

  close(): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.dropLid();
    this.root?.destroy();
    this.root = null;
    this.drawn = null;
  }
}
