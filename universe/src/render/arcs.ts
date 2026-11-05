// Rockets' ways over the globe (War past the line, W3): a line from where each left to where it fell, its head flying
// out along it. Under the wars' own root, so it shows with them. On the phone floor, at most 24 ways of 18 lengths
// and 24 heads: 456 instances in 2 draws, and none but while one is shown.
import * as pc from "playcanvas";
import { InstancedBatch, boxMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";
import { ARC_DOTS, MOST_ARCS, type GlobeArc } from "../view/index.ts";

const WAY: Rgb = [1, 0.86, 0.5],
  HOT: Rgb = [1, 0.62, 0.18];

const unlit = (c: Rgb) => {
  const m = new pc.StandardMaterial();
  m.useLighting = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(c[0], c[1], c[2]);
  m.update();
  return m;
};

export class GlobeArcLayer {
  private readonly lengths: InstancedBatch;
  private readonly heads: InstancedBatch;
  /** What was last drawn (the look tools): how many ways, and places along them on a globe of radius 1. */
  shown = 0;
  places: { x: number; y: number; z: number }[] = [];

  constructor(stage: Stage, parent: pc.Entity) {
    const box = boxMesh(stage);
    this.lengths = new InstancedBatch(stage, box, WAY, MOST_ARCS * ARC_DOTS, parent, unlit(WAY));
    this.heads = new InstancedBatch(stage, box, HOT, MOST_ARCS, parent, unlit(HOT));
  }

  update(arcs: readonly GlobeArc[], eye: number): void {
    const parts: { a: GlobeArc["dots"][number]; b: GlobeArc["dots"][number] }[] = [],
      heads: GlobeArc["dots"][number][] = [];
    this.places = [];
    for (const r of arcs) {
      for (let i = 0; i + 1 < r.dots.length; i++) parts.push({ a: r.dots[i]!, b: r.dots[i + 1]! });
      heads.push(r.dots.at(-1)!);
      for (const u of [0.25, 0.5, 0.75])
        this.places.push(r.dots[Math.floor(u * (r.dots.length - 1))]!);
    }
    // (Its width on the screen held as the eye comes in.)
    const wide = Math.max(0.0012, 0.0034 * Math.min(1, eye / 2.6));
    this.shown = arcs.length;
    this.lengths.set(parts.length, (i, out) => {
      const { a, b } = parts[i]!,
        dx = b.x - a.x,
        dy = b.y - a.y,
        dz = b.z - a.z,
        h = Math.hypot(dx, dz);
      out[0] = (a.x + b.x) / 2;
      out[1] = (a.y + b.y) / 2;
      out[2] = (a.z + b.z) / 2;
      out[3] = wide;
      out[4] = wide;
      out[5] = Math.hypot(h, dy) * 1.05;
      out[6] = Math.atan2(dx, dz);
      out[7] = Math.atan2(-dy, h);
    });
    this.heads.set(heads.length, (i, out) => {
      const d = heads[i]!;
      out[0] = d.x;
      out[1] = d.y;
      out[2] = d.z;
      out[3] = wide * 3;
      out[4] = wide * 3;
      out[5] = wide * 3;
      out[6] = 0;
      out[7] = 0;
    });
  }
}
