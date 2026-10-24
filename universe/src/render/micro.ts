// The microscope (Phase 9 M89): a drop of the first seas, and what lives in it — cells'
// skins, translucent; their nuclei, dark; their small working parts, bright — each kind a
// batch of spheres, placed afresh every frame from the drop the view gives. Its living drop
// (Phase 24): a slab of water seen from the side, its surface lit above and its floor below,
// each kind of cell in its own colour, what floats in it, and rings about the cells followed.
import * as pc from "playcanvas";
import type { CellPart, Drop, RoundDrop } from "../view/index.ts";
import { InstancedBatch, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

const MOST = 400;
/** The most of one kind's parts (a crowded drop of small cells, each a rod). */
const MOST_KIND = 900;

export class MicroScene {
  readonly root = new pc.Entity("drop");
  private readonly stage: Stage;
  private readonly ball: pc.Mesh;
  private readonly skins: InstancedBatch;
  private readonly nuclei: InstancedBatch;
  private readonly bits: InstancedBatch;
  /** The living drop's: a batch for each kind, what floats, the rings, its water's bounds. */
  private readonly kinds: { batch: InstancedBatch; color: Rgb }[] = [];
  private readonly motes: InstancedBatch;
  private readonly marks: InstancedBatch;
  private readonly water = new pc.Entity("water");

  constructor(stage: Stage) {
    this.stage = stage;
    const ball = keptMesh(
      pc.Mesh.fromGeometry(
        stage.device,
        new pc.SphereGeometry({ radius: 0.5, latitudeBands: 8, longitudeBands: 12 }),
      ),
    );
    this.ball = ball;
    this.skins = new InstancedBatch(
      stage,
      ball,
      [0.46, 0.86, 0.74],
      MOST,
      this.root,
      flatMaterial([0.46, 0.86, 0.74], 0.55, 0.6, 0.3),
    );
    this.nuclei = new InstancedBatch(stage, ball, [0.36, 0.2, 0.5], MOST, this.root);
    this.bits = new InstancedBatch(stage, ball, [1, 0.62, 0.24], MOST, this.root);
    this.motes = new InstancedBatch(
      stage,
      ball,
      [0.78, 0.9, 0.92],
      MOST,
      this.root,
      flatMaterial([0.78, 0.9, 0.92], 0.5),
    );
    this.marks = new InstancedBatch(
      stage,
      ball,
      [1, 0.88, 0.4],
      64,
      this.root,
      flatMaterial([1, 0.88, 0.4], 0.28, 0.4, 0.4),
    );
    // The water's surface above, lit, and the slide's floor below (12 across, 9 down, 2.4 deep).
    const box = keptMesh(pc.Mesh.fromGeometry(stage.device, new pc.BoxGeometry()));
    const slab = (y: number, h: number, color: Rgb, opacity: number) => {
      const e = new pc.Entity("slab");
      e.addComponent("render", {
        meshInstances: [new pc.MeshInstance(box, flatMaterial(color, opacity, 0.7, 0.4))],
      });
      e.setLocalPosition(0, y, 0);
      e.setLocalScale(12.6, h, 3);
      this.water.addChild(e);
    };
    slab(4.62, 0.12, [0.86, 0.97, 1], 0.32);
    slab(-4.7, 0.2, [0.32, 0.27, 0.2], 0.85);
    this.water.enabled = false;
    this.root.addChild(this.water);
    stage.root.addChild(this.root);
    this.root.enabled = false;
  }

  get visible(): boolean {
    return this.root.enabled;
  }
  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** Put everything in the drop where the view says it is now. */
  update(d: Drop): void {
    place(this.skins, d.skins.slice(0, MOST));
    place(this.nuclei, d.nuclei.slice(0, MOST));
    place(this.bits, d.bits.slice(0, MOST));
    for (const k of this.kinds) place(k.batch, []);
    place(this.motes, []);
    place(this.marks, []);
    this.water.enabled = false;
  }

  /** The living drop, as the view lays it out in the round, each kind in its colour. */
  living(d: RoundDrop, colors: readonly Rgb[]): void {
    place(this.skins, []);
    place(this.bits, []);
    d.kinds.forEach((parts, i) => {
      const color = colors[i] ?? [0.7, 0.9, 0.8];
      let k = this.kinds[i];
      if (!k) {
        k = {
          batch: new InstancedBatch(
            this.stage,
            this.ball,
            color,
            MOST_KIND,
            this.root,
            flatMaterial(color, 0.82, 0.6, 0.35),
          ),
          color,
        };
        this.kinds[i] = k;
      } else if (k.color.some((v, j) => v !== color[j])) {
        k.batch.recolor(color);
        k.color = color;
      }
      place(k.batch, parts.slice(0, MOST_KIND));
    });
    for (let i = d.kinds.length; i < this.kinds.length; i++) place(this.kinds[i]!.batch, []);
    place(this.nuclei, d.nuclei.slice(0, MOST));
    place(this.motes, d.motes.slice(0, MOST));
    place(this.marks, d.marks.slice(0, 64));
    this.water.enabled = true;
  }

  /**
   * The nearest of `at` to a point of the screen (CSS pixels from the canvas's corner), within
   * `reach` pixels; -1 where none is.
   */
  pick(
    x: number,
    y: number,
    at: readonly { x: number; y: number; z: number }[],
    reach = 28,
  ): number {
    const cam = this.stage.camera.camera!,
      p = new pc.Vec3(),
      out = new pc.Vec3();
    let best = -1,
      bd = reach * reach;
    at.forEach((a, i) => {
      p.set(a.x, a.y, a.z);
      cam.worldToScreen(p, out);
      const d = (out.x - x) ** 2 + (out.y - y) ** 2;
      if (out.z > 0 && d < bd) [best, bd] = [i, d];
    });
    return best;
  }
}

function place(batch: InstancedBatch, list: readonly CellPart[]): void {
  batch.set(list.length, (i, out) => {
    const p = list[i]!;
    out[0] = p.x;
    out[1] = p.y;
    out[2] = p.z;
    out[3] = p.sx;
    out[4] = p.sy;
    out[5] = p.sz;
    out[6] = p.yaw;
    out[7] = p.pitch;
  });
}
