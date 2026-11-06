// A town's money laid over it (Lives L6): each home a block of the colour of what it can spend, its lot a plate of the same, so a street reads as a
// street from as far as the eye goes. Put once when it is asked for and when the town's year turns; nothing per frame; nothing at all until it is
// turned on. Its own light, so that it reads at night as by day.
import * as pc from "playcanvas";
import { InstancedBatch, boxMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

const M = 0.1;

/** One home as the lens lays it: where it stands, its colour's place, whether it is let. */
export type MoneyHome = {
  readonly n: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
  /** The plate's own measures: its lot. */
  readonly pw: number;
  readonly pd: number;
  readonly colour: number;
  readonly let: boolean;
};

export class TownMoneyLayer {
  readonly root = new pc.Entity("town-money");
  private readonly stage: Stage;
  private readonly mesh: pc.Mesh;
  private batches: InstancedBatch[] = [];
  private homes: readonly MoneyHome[] = [];

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.mesh = keptMesh(boxMesh(stage));
    parent.addChild(this.root);
    this.root.enabled = false;
  }

  /** Lay these homes in these colours. */
  show(homes: readonly MoneyHome[], colours: readonly Rgb[], top: Rgb): void {
    this.clear();
    this.homes = homes;
    const bath = (color: Rgb, n: number, place: (i: number, out: number[]) => void) => {
      if (n === 0) return;
      const m = flatMaterial(color),
        b = new InstancedBatch(this.stage, this.mesh, color, n, this.root, m);
      b.glow([color[0] * 0.55, color[1] * 0.55, color[2] * 0.55]);
      b.set(n, place);
      this.batches.push(b);
    };
    colours.forEach((color, c) => {
      const these = homes.filter((h) => h.colour === c);
      bath(color, these.length * 2, (i, out) => {
        const h = these[i >> 1]!,
          plate = i % 2 === 0;
        out[0] = h.x * M;
        out[1] = (plate ? 0.15 : h.h / 2) * M;
        out[2] = h.z * M;
        out[3] = (plate ? h.pw : h.w) * M;
        out[4] = (plate ? 0.3 : h.h) * M;
        out[5] = (plate ? h.pd : h.d) * M;
        out[6] = h.yaw;
      });
    });
    const lets = homes.filter((h) => h.let);
    bath(top, lets.length, (i, out) => {
      const h = lets[i]!;
      out[0] = h.x * M;
      out[1] = (h.h + 0.25) * M;
      out[2] = h.z * M;
      out[3] = h.w * 0.72 * M;
      out[4] = 0.5 * M;
      out[5] = h.d * 0.72 * M;
      out[6] = h.yaw;
    });
    this.root.enabled = true;
  }

  clear(): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.homes = [];
    this.root.enabled = false;
  }

  /** The home nearest a point of the screen, its block as the eye sees it (null: none within reach). */
  pick(x: number, y: number, reach = 22): number | null {
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3(),
      from = new pc.Vec3();
    let best: number | null = null,
      bestD = reach * reach;
    for (const h of this.homes) {
      cam.worldToScreen(from.set(h.x * M, (h.h / 2) * M, h.z * M), at);
      if (at.z <= 0) continue;
      const d = (at.x - x) * (at.x - x) + (at.y - y) * (at.y - y);
      if (d < bestD) {
        bestD = d;
        best = h.n;
      }
    }
    return best;
  }

  /** Where the homes stand on the screen, those on it (the look tools). */
  spots(most = 400): { n: number; x: number; y: number; colour: number }[] {
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3(),
      from = new pc.Vec3(),
      out: { n: number; x: number; y: number; colour: number }[] = [];
    for (const h of this.homes) {
      cam.worldToScreen(from.set(h.x * M, (h.h / 2) * M, h.z * M), at);
      if (at.z > 0) out.push({ n: h.n, x: at.x, y: at.y, colour: h.colour });
      if (out.length >= most) break;
    }
    return out;
  }
}
