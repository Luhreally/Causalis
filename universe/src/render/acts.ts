// The god's acts playing on the globe (Phase 12 M106): each kind of mark (a cloud, a raindrop,
// a flame, a thread's bead…) one instanced batch in its colour, a faith's halo one per colour;
// every mark stood upright on the globe's face. Placed anew each frame from the view's marks.
import * as pc from "playcanvas";
import {
  ACT_PARTS,
  ACT_PART_LOOK,
  actBits,
  type ActBit,
  type ActPart,
  type PlacedAct,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Stage } from "./stage.ts";

/** The most marks of one kind drawn at once. */
const MOST = 700;

export class GlobeActs {
  readonly root = new pc.Entity("acts");
  private readonly stage: Stage;
  private readonly box: pc.Mesh;
  private readonly batches = new Map<ActPart, InstancedBatch>();
  private halos = new Map<string, InstancedBatch>();
  private acts: readonly PlacedAct[] = [];
  /** How many marks were drawn at the last update (for the look tools). */
  drawn = 0;

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.box = keptMesh(boxMesh(stage));
    for (const part of ACT_PARTS) {
      if (part === "halo") continue;
      const look = ACT_PART_LOOK[part];
      this.batches.set(
        part,
        new InstancedBatch(
          stage,
          this.box,
          look.color,
          MOST,
          this.root,
          flatMaterial(look.color, look.opacity),
        ),
      );
    }
    parent.addChild(this.root);
  }

  /** The acts to play (placed on the globe). */
  set(acts: readonly PlacedAct[]): void {
    this.acts = acts;
    // A halo for each faith's colour among them.
    const colors = new Set(
      acts.filter((a) => a.kind === "conversion" && a.color).map((a) => a.color!.join(",")),
    );
    for (const [key, b] of this.halos)
      if (!colors.has(key)) {
        b.destroy();
        this.halos.delete(key);
      }
    for (const key of colors)
      if (!this.halos.has(key)) {
        const c = key.split(",").map(Number) as [number, number, number];
        this.halos.set(key, new InstancedBatch(this.stage, this.box, c, 200, this.root));
      }
  }

  /** How many acts are playing. */
  get playing(): number {
    return this.acts.length;
  }

  /** Put every mark where it is at screen time `s` (seconds), the eye `zoom` from the globe's middle. */
  update(s: number, zoom: number): void {
    if (!this.root.enabled) return;
    const bits = actBits(this.acts, s, zoom),
      by = new Map<string, ActBit[]>();
    for (const b of bits) {
      const key = b.part === "halo" ? `halo:${(b.color ?? [1, 1, 1]).join(",")}` : b.part;
      let list = by.get(key);
      if (!list) by.set(key, (list = []));
      list.push(b);
    }
    const place = (batch: InstancedBatch, list: readonly ActBit[]) =>
      batch.setBasis(list.length, (i, out) => {
        const b = list[i]!;
        out[0] = b.at.x;
        out[1] = b.at.y;
        out[2] = b.at.z;
        out[3] = b.size[0];
        out[4] = b.size[1];
        out[5] = b.size[2];
        out[6] = b.up.x;
        out[7] = b.up.y;
        out[8] = b.up.z;
        out[9] = b.ahead.x;
        out[10] = b.ahead.y;
        out[11] = b.ahead.z;
      });
    for (const [part, batch] of this.batches) place(batch, by.get(part) ?? []);
    for (const [key, batch] of this.halos) place(batch, by.get(`halo:${key}`) ?? []);
    this.drawn = bits.length;
  }

  destroy(): void {
    for (const b of [...this.batches.values(), ...this.halos.values()]) b.destroy();
    this.batches.clear();
    this.halos.clear();
  }
}
