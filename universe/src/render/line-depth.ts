// What lies beyond the cell held (Live a Line, 2026-11-28: growth you can feel): the larger lives of its world's water,
// drifting far behind the drop's slab, dim and soft as what is out of a microscope's focus: its hunting cells, its cells
// living together and, once its world's first bodies come, the first bodies, each drawn at its true size against the cell
// held, so a player sees what is coming before the line is near their size; those no larger than the line's cell are not
// drawn here (they are in the drop with it). Each in its own kind's colour, a core and a softer halo (two shells, the halo
// fainter: blurred), placed by keyed draws and drifting slowly. Everything here is the mode's own, laid on the stage only
// while a line is lived.
import * as pc from "playcanvas";
import { InstancedBatch } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

/** A larger life of the water: its size (µm) and colour. */
export type Beyond = { readonly size: number; readonly color: Rgb };

/** How many of each drift beyond, how far behind the drop they are (units), and µm to units (view/drop.ts: 12 to 180). */
const EACH = 3,
  BEHIND = 9,
  K = 12 / 180;

export class DepthLayer {
  readonly root = new pc.Entity("line-beyond");
  private readonly mesh: pc.Mesh;
  private readonly batches: { core: InstancedBatch; halo: InstancedBatch; color: string }[] = [];
  private readonly stage: Stage;

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.mesh = pc.Mesh.fromGeometry(
      stage.device,
      new pc.SphereGeometry({ radius: 0.5, latitudeBands: 10, longitudeBands: 14 }),
    );
    parent.addChild(this.root);
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /**
   * The larger lives drawn as they stand at time `t` (s), about the eye's place across (`cx`, units), those larger than
   * `mine` (µm) only.
   */
  update(lives: readonly Beyond[], mine: number, t: number, cx: number, cy: number): void {
    const shown = lives.filter((l) => l.size > mine * 1.6);
    shown.forEach((l, k) => {
      const key = l.color.join(",");
      let b = this.batches[k];
      if (!b || b.color !== key) {
        b?.core.destroy();
        b?.halo.destroy();
        b = {
          core: new InstancedBatch(
            this.stage,
            this.mesh,
            l.color,
            EACH,
            this.root,
            flatMaterial(l.color, 0.2, 0, 0),
          ),
          halo: new InstancedBatch(
            this.stage,
            this.mesh,
            l.color,
            EACH,
            this.root,
            flatMaterial(l.color, 0.07, 0, 0),
          ),
          color: key,
        };
        this.batches[k] = b;
      }
      const at = (i: number) => {
        const u = (n: number) => (Math.sin((k * 7 + i * 13 + n) * 12.9898) * 43758.5453) % 1,
          a = Math.abs(u(1)),
          speed = 0.15 + 0.2 * Math.abs(u(2)),
          span = 26;
        // (Drifting slowly across, wrapping about the eye's place: far off, they pass behind it again and again.)
        const x =
            cx + ((((a * span + t * speed * (u(3) > 0 ? 1 : -1)) % span) + span) % span) - span / 2,
          y = cy + (Math.abs(u(4)) - 0.5) * 9 + Math.sin(t * 0.2 + i) * 0.4;
        return { x, y, z: -BEHIND - Math.abs(u(5)) * 6 };
      };
      const s = l.size * K;
      b.core.set(EACH, (i, out) => {
        const p = at(i);
        out[0] = p.x;
        out[1] = p.y;
        out[2] = p.z;
        out[3] = out[4] = out[5] = s;
        out[6] = out[7] = 0;
      });
      b.halo.set(EACH, (i, out) => {
        const p = at(i);
        out[0] = p.x;
        out[1] = p.y;
        out[2] = p.z;
        out[3] = out[4] = out[5] = s * 1.5;
        out[6] = out[7] = 0;
      });
    });
    for (let k = shown.length; k < this.batches.length; k++) {
      this.batches[k]!.core.set(0, () => {});
      this.batches[k]!.halo.set(0, () => {});
    }
  }
}
