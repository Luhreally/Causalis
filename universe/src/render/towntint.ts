// A town mode's overlay (N5) laid on the ground of its lots: each lot a thin plate of its reading's colour, a little
// under its own breadth, in the scene itself. What stands on a lot hides the plate under it, as a building hides the
// ground; the scene's fog takes it far off as it takes the ground. One batch for each shade of the reading (a dozen at
// most), put once when the reading changes; nothing per frame; nothing at all until an overlay is turned on.
import * as pc from "playcanvas";
import { InstancedBatch, boxMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

const M = 0.1,
  /** How high the plate stands (metres): over the lot's ground and its paths, under any wall or body. */
  PLATE_HIGH = 0.12,
  /** How far in from its lot's edges the plate stops (metres a side), so lots side by side read as lots. */
  INSET = 0.35,
  /** How much of the ground shows through (the plate's opacity), and how much of its own light it carries at night. */
  OPACITY = 0.62,
  GLOW = 0.4;

/** One lot as the overlay lays it: its ground (metres from the town's middle) and its shade's place among the shades. */
export type TintLot = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly w: number;
  readonly d: number;
  readonly shade: number;
};

export class TownTintLayer {
  readonly root = new pc.Entity("town-tint");
  private readonly stage: Stage;
  private readonly mesh: pc.Mesh;
  private batches: InstancedBatch[] = [];
  private lots: readonly TintLot[] = [];

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.mesh = keptMesh(boxMesh(stage));
    parent.addChild(this.root);
    this.root.enabled = false;
  }

  /** Lay these lots, each in its shade of these. */
  show(lots: readonly TintLot[], shades: readonly Rgb[]): void {
    this.clear();
    this.lots = lots;
    shades.forEach((color, c) => {
      const these = lots.filter((l) => l.shade === c);
      if (!these.length) return;
      const m = flatMaterial(color, OPACITY, 0);
      const b = new InstancedBatch(this.stage, this.mesh, color, these.length, this.root, m);
      b.glow([color[0] * GLOW, color[1] * GLOW, color[2] * GLOW]);
      b.shadows(false);
      b.set(these.length, (i, out) => {
        const l = these[i]!;
        out[0] = l.x * M;
        out[1] = (PLATE_HIGH / 2) * M;
        out[2] = l.z * M;
        out[3] = Math.max(0.5, l.w - 2 * INSET) * M;
        out[4] = PLATE_HIGH * M;
        out[5] = Math.max(0.5, l.d - 2 * INSET) * M;
        out[6] = l.yaw;
      });
      this.batches.push(b);
    });
    this.root.enabled = this.batches.length > 0;
  }

  clear(): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.lots = [];
    this.root.enabled = false;
  }

  /** How many lots are laid. */
  get count(): number {
    return this.lots.length;
  }

  /**
   * The lot laid under a point of the screen (its place in what was shown; null: none): where the eye's ray through it
   * meets the ground, within which lot's plate.
   */
  pick(x: number, y: number): number | null {
    if (!this.lots.length) return null;
    const cam = this.stage.camera.camera!,
      a = cam.screenToWorld(x, y, cam.nearClip, new pc.Vec3()),
      b = cam.screenToWorld(x, y, cam.farClip, new pc.Vec3());
    if (!(a.y > 0 && b.y < a.y)) return null;
    const k = a.y / (a.y - b.y),
      gx = (a.x + (b.x - a.x) * k) / M,
      gz = (a.z + (b.z - a.z) * k) / M;
    for (let i = 0; i < this.lots.length; i++) {
      const l = this.lots[i]!,
        c = Math.cos(l.yaw),
        s = Math.sin(l.yaw),
        dx = gx - l.x,
        dz = gz - l.z,
        // (Into the lot's own frame: set() turns its plate by yaw about y.)
        u = dx * c - dz * s,
        v = dx * s + dz * c;
      if (Math.abs(u) <= l.w / 2 && Math.abs(v) <= l.d / 2) return i;
    }
    return null;
  }

  /** Where the lots laid stand on the screen, those on it (the look tools). */
  spots(most = 400): { i: number; x: number; y: number; shade: number }[] {
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3(),
      from = new pc.Vec3(),
      out: { i: number; x: number; y: number; shade: number }[] = [];
    for (let i = 0; i < this.lots.length && out.length < most; i++) {
      const l = this.lots[i]!;
      cam.worldToScreen(from.set(l.x * M, PLATE_HIGH * M, l.z * M), at);
      if (at.z > 0) out.push({ i, x: at.x, y: at.y, shade: l.shade });
    }
    return out;
  }
}
