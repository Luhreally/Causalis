// What a town raised, seen (T1): a handful of low parts on the rim of its square, each thing raised in its people's own stuff; and, at a feast, the
// song seen: notes rising over whoever is singing. Units as the village's: a tenth of a unit to the metre. A batch for each mesh and colour a
// town's stones want, none for a town with none: the town's worst is five things of at most nine parts each.
import * as pc from "playcanvas";
import {
  memorialParts,
  memorialsPlaced,
  partAt,
  type MemorialPart,
  type StoneMesh,
  type PlacedMemorial,
} from "../view/index.ts";
import type { VillagePlan } from "../bridge/index.ts";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh, gableMesh, keptMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

const M = 0.1;
/** How many notes rise over a singer, and how long each takes (seconds of the screen's clock). */
const NOTES = 3,
  NOTE_S = 2.4;
const NOTE: Rgb = [1, 0.86, 0.3];

/**
 * Lays a thing raised on the screen, its foot and as high up it as can be seen; gives how high that is, metres. A tall one stood close under
 * goes up past the top of the screen, or over the eye, where it has no place on the screen that means anything.
 */
function seenOf(cam: pc.CameraComponent, p: PlacedMemorial, foot: pc.Vec3, head: pc.Vec3): number {
  cam.worldToScreen(new pc.Vec3(p.x * M, 0, p.z * M), foot);
  cam.worldToScreen(new pc.Vec3(p.x * M, p.high * M, p.z * M), head);
  if (foot.z <= 0 || (head.z > 0 && head.y >= 0)) return p.high;
  // (Depth goes straight along a thing, so where it would pass the eye is known; a little short of that, then halve to the screen's top.)
  let lo = 0,
    hi = head.z > 0 ? p.high : (0.9 * p.high * foot.z) / (foot.z - head.z);
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    cam.worldToScreen(new pc.Vec3(p.x * M, mid * M, p.z * M), head);
    if (head.y < 0) hi = mid;
    else lo = mid;
  }
  cam.worldToScreen(new pc.Vec3(p.x * M, lo * M, p.z * M), head);
  return lo;
}

export class MemorialLayer {
  readonly root = new pc.Entity("memorials");
  private readonly stage: Stage;
  private readonly meshes: Record<StoneMesh, pc.Mesh>;
  private batches: InstancedBatch[] = [];
  private notes: InstancedBatch | null = null;
  /** What was last laid out, for a finger and the look tools. */
  placed: readonly PlacedMemorial[] = [];
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

  /** Lay out a town's stones (none: nothing is made). */
  build(plan: VillagePlan): void {
    for (const b of this.batches) b.destroy();
    this.notes?.destroy();
    this.batches = [];
    this.notes = null;
    this.placed = memorialsPlaced(plan);
    this.parts = 0;
    // A list of parts for each mesh and colour.
    const groups = new Map<
      string,
      { mesh: StoneMesh; colour: Rgb; list: ReturnType<typeof partAt>[] }
    >();
    for (const p of this.placed) {
      const key = plan.seed ^ (p.m.year * 2654435761);
      for (const q of memorialParts(p.m, key) as readonly MemorialPart[]) {
        const colour = (q.tone === "dark" ? p.m.dark : p.m.colour) as Rgb,
          id = `${q.mesh}|${colour.join()}`;
        let g = groups.get(id);
        if (!g) groups.set(id, (g = { mesh: q.mesh, colour, list: [] }));
        g.list.push(partAt(p, q));
        this.parts++;
      }
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
    this.batchesUsed = this.batches.length;
    if (plan.songs?.length) {
      this.notes = new InstancedBatch(this.stage, this.meshes.box, NOTE, NOTES, this.root);
      this.notes.glow([0.7, 0.55, 0.15]);
      this.notes.set(0, () => {});
    }
  }

  /** The notes over a singer now (null: no one sings). `up`: the top of their head (metres). */
  sing(
    at: { readonly x: number; readonly z: number; readonly up: number } | null,
    clock: number,
  ): void {
    const n = this.notes;
    if (!n) return;
    if (!at) {
      n.set(0, () => {});
      return;
    }
    n.set(NOTES, (i, out) => {
      const u = (((clock / NOTE_S + i / NOTES) % 1) + 1) % 1,
        a = clock * 1.3 + i * 2.1;
      out[0] = (at.x + Math.cos(a) * 1.3) * M;
      out[1] = (at.up + 1 + u * 7) * M;
      out[2] = (at.z + Math.sin(a) * 1.3) * M;
      const s = (1.5 - u * 0.4) * M;
      out[3] = out[4] = out[5] = s;
      out[6] = a;
      out[7] = Math.PI / 4;
    });
  }

  /**
   * The thing raised at a point of the screen (null: none), a finger's reach about it: the nearest, by its standing shape on the
   * screen from foot to head and its breadth there. Only what lies in front of the eye: of a tall one stood close under, as much as can be seen.
   */
  at(cam: pc.CameraComponent, x: number, y: number, reach = 16): PlacedMemorial | null {
    let best: PlacedMemorial | null = null,
      bestD = Infinity,
      bestOn = false,
      bestNear = Infinity;
    const foot = new pc.Vec3(),
      head = new pc.Vec3();
    for (const p of this.placed) {
      const seen = seenOf(cam, p, foot, head);
      if (foot.z <= 0 || head.z <= 0) continue;
      // (How far a metre is on the screen, there: from its height.)
      const high = Math.max(8, Math.hypot(foot.x - head.x, foot.y - head.y)),
        half = Math.max(10, (high / Math.max(1, seen)) * p.wide * 0.8) + reach,
        along = Math.max(0, Math.min(1, (y - foot.y) / (head.y - foot.y || 1))),
        cx = foot.x + (head.x - foot.x) * along,
        cy = foot.y + (head.y - foot.y) * along,
        inY = y >= Math.min(foot.y, head.y) - reach && y <= Math.max(foot.y, head.y) + reach,
        d = Math.abs(x - cx);
      if (!inY || d > half) continue;
      // (The finger right on one, the nearest of those to the eye: a stone in front before one behind it. Else only near: the nearest to the finger.)
      const on =
          d <= half - reach && y >= Math.min(foot.y, head.y) && y <= Math.max(foot.y, head.y),
        off = Math.hypot(x - cx, y - cy);
      if (on ? !bestOn || foot.z < bestNear : !bestOn && off < bestD) {
        bestD = off;
        best = p;
        bestOn = on;
        bestNear = foot.z;
      }
    }
    return best;
  }

  /** Whether the body of a thing raised is right under the finger, nearer the eye than `depth`. */
  over(cam: pc.CameraComponent, x: number, y: number, depth: number): boolean {
    const p = this.at(cam, x, y, 0);
    if (!p) return false;
    const d = this.depth(cam, p);
    return d > 0 && d < depth;
  }

  /** How far from the eye a thing raised stands, as `worldToScreen` says it. */
  depth(cam: pc.CameraComponent, p: PlacedMemorial): number {
    const foot = new pc.Vec3();
    cam.worldToScreen(new pc.Vec3(p.x * M, 0, p.z * M), foot);
    return foot.z;
  }

  /** Where each thing raised stands on the screen (the look tools). */
  onScreen(cam: pc.CameraComponent): {
    ref: string;
    form: string;
    x: number;
    y: number;
    footX: number;
    footY: number;
    headY: number;
    worldX: number;
    worldZ: number;
    front: boolean;
  }[] {
    const a = new pc.Vec3(),
      b = new pc.Vec3();
    return this.placed.map((p) => {
      seenOf(cam, p, a, b);
      return {
        ref: p.m.ref,
        form: p.m.form,
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        footX: a.x,
        footY: a.y,
        headY: b.y,
        worldX: p.x,
        worldZ: p.z,
        front: a.z > 0 && b.z > 0,
      };
    });
  }

  /** Whether it is laid out at all (a gate shows the town with it and without). */
  shown(on: boolean): void {
    this.root.enabled = on;
  }
}
