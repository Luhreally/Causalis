// A town's court, seen (J1): a handful of low parts on the rim of its square, and on its day a flag up over it. Units as the village's: a tenth of a unit to the metre. A
// batch for each mesh and colour, none for a town with none; those it hears, judges and holds are the town's own people, drawn by their day.
import * as pc from "playcanvas";
import {
  courtPartAt,
  courtParts,
  courtPlaced,
  courtSitting,
  type CourtPlaced,
} from "../view/index.ts";
import type { VillagePlan } from "../bridge/index.ts";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh, gableMesh, keptMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

const M = 0.1;
const FLAG: Rgb = [0.72, 0.16, 0.13];

export class CourtLayer {
  readonly root = new pc.Entity("court");
  private readonly stage: Stage;
  private readonly meshes: Record<"box" | "cyl" | "cone" | "gable", pc.Mesh>;
  private batches: InstancedBatch[] = [];
  private flag: InstancedBatch | null = null;
  private flying = false;
  /** Where it stands, for a finger and the look tools (null: no court). */
  placed: CourtPlaced | null = null;
  parts = 0;
  batchesUsed = 0;

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    parent.addChild(this.root);
    this.meshes = {
      box: keptMesh(boxMesh(stage)),
      cyl: keptMesh(cylinderMesh(stage, 0.5, 1, 10)),
      cone: keptMesh(coneMesh(stage, 0.5, 1, 8)),
      gable: keptMesh(gableMesh(stage)),
    };
  }

  build(plan: VillagePlan): void {
    for (const b of this.batches) b.destroy();
    this.flag?.destroy();
    this.batches = [];
    this.flag = null;
    this.flying = false;
    this.parts = 0;
    this.placed = courtPlaced(plan);
    const court = plan.court,
      place = this.placed;
    if (!court || !place) {
      this.batchesUsed = 0;
      return;
    }
    const groups = new Map<
      string,
      {
        mesh: "box" | "cyl" | "cone" | "gable";
        colour: Rgb;
        list: ReturnType<typeof courtPartAt>[];
      }
    >();
    for (const q of courtParts(plan)) {
      const colour = (q.tone === "dark" ? court.wood : court.colour) as Rgb,
        id = `${q.mesh}|${colour.join()}`;
      let g = groups.get(id);
      if (!g) groups.set(id, (g = { mesh: q.mesh, colour, list: [] }));
      g.list.push(courtPartAt(place, q));
      this.parts++;
    }
    for (const g of groups.values()) {
      const b = new InstancedBatch(
        this.stage,
        this.meshes[g.mesh],
        g.colour,
        g.list.length,
        this.root,
      );
      b.set(g.list.length, (i, out) => {
        const q = g.list[i]!;
        out[0] = q.x * M;
        out[1] = q.y * M;
        out[2] = q.z * M;
        out[3] = q.sx * M;
        out[4] = q.sy * M;
        out[5] = q.sz * M;
        out[6] = q.yaw;
        out[7] = q.tip;
      });
      this.batches.push(b);
    }
    // (Only those who raise a bench raise a flag: it has a pole to fly from there.)
    if (court.form === "magistrate" || court.form === "bench" || court.form === "kin") {
      this.flag = new InstancedBatch(this.stage, this.meshes.box, FLAG, 1, this.root);
      this.flag.set(0, () => {});
    }
    this.batchesUsed = this.batches.length + (this.flag ? 1 : 0);
  }

  /** The flag up while it sits (asked every frame: it only moves when that turns). */
  update(plan: VillagePlan, t: number): void {
    const place = this.placed,
      flag = this.flag;
    if (!place || !flag) return;
    const on = !!courtSitting(plan, t);
    if (on === this.flying) return;
    this.flying = on;
    if (!on) {
      flag.set(0, () => {});
      return;
    }
    flag.set(1, (_i, out) => {
      const q = courtPartAt(place, {
        mesh: "box",
        tone: "main",
        u: -4,
        y: 12.6,
        v: -2.4,
        sx: 5,
        sy: 2.6,
        sz: 0.2,
      });
      out[0] = q.x * M;
      out[1] = q.y * M;
      out[2] = q.z * M;
      out[3] = q.sx * M;
      out[4] = q.sy * M;
      out[5] = q.sz * M;
      out[6] = q.yaw;
      out[7] = 0;
    });
  }

  /** Whether a point of the screen lies on it (a finger's reach about it). */
  at(cam: pc.CameraComponent, x: number, y: number, reach = 12): boolean {
    const p = this.placed;
    if (!p) return false;
    // (From behind its bench out to its rail and side to side, and up its board: the box of that on the screen, wherever the eye is.)
    const c = Math.cos(p.yaw),
      s = Math.sin(p.yaw),
      out = new pc.Vec3();
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const [u, v, up] of [
      [-p.wide, -3 * p.scale, 0],
      [p.wide, -3 * p.scale, 0],
      [-p.wide, 12 * p.scale, 0],
      [p.wide, 12 * p.scale, 0],
      [0, 0, p.high],
    ] as const) {
      cam.worldToScreen(
        new pc.Vec3((p.x + c * u + s * v) * M, up * M, (p.z - s * u + c * v) * M),
        out,
      );
      if (out.z <= 0) return false;
      x0 = Math.min(x0, out.x);
      x1 = Math.max(x1, out.x);
      y0 = Math.min(y0, out.y);
      y1 = Math.max(y1, out.y);
    }
    return x >= x0 - reach && x <= x1 + reach && y >= y0 - reach && y <= y1 + reach;
  }

  /** Where it stands on the screen (the look tools). */
  onScreen(cam: pc.CameraComponent): {
    footX: number;
    footY: number;
    headY: number;
    worldX: number;
    worldZ: number;
    yaw: number;
    front: boolean;
  } | null {
    const p = this.placed;
    if (!p) return null;
    const a = new pc.Vec3(),
      b = new pc.Vec3(),
      c = Math.cos(p.yaw),
      s = Math.sin(p.yaw),
      v = 6 * p.scale,
      mx = p.x + s * v,
      mz = p.z + c * v;
    cam.worldToScreen(new pc.Vec3(mx * M, 0, mz * M), a);
    cam.worldToScreen(new pc.Vec3(mx * M, p.high * M, mz * M), b);
    return {
      footX: a.x,
      footY: a.y,
      headY: b.y,
      worldX: mx,
      worldZ: mz,
      yaw: p.yaw,
      front: a.z > 0 && b.z > 0,
    };
  }

  shown(on: boolean): void {
    this.root.enabled = on;
  }
}
