// The living world's stage (Phase 9 M89): the ground of the world, and on it its lineages
// as they arise, each drawn from its own body (view/creature.ts) in its coat's colours,
// walking in place, grown in as it arises and shrunk away as it dies out.
import * as pc from "playcanvas";
import type { BeastPlan } from "../bridge/index.ts";
import {
  MOST_OF_TONE,
  buildBody,
  coatOf,
  limbPitch,
  posed,
  strideOf,
  type BeastPart,
  type Built,
  type Figure,
  type OnStage,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

export class ParadeScene {
  readonly root = new pc.Entity("parade");
  private readonly stage: Stage;
  private readonly box: pc.Mesh;
  private readonly ground: pc.Entity;
  private bodies: Built[] = [];
  private tones: InstancedBatch[][] = [];
  private readonly parts: BeastPart[] = [];
  /** The first people, when they come (a batch a part of their figure). */
  private figure: { f: Figure; batches: InstancedBatch[] } | null = null;

  constructor(stage: Stage) {
    this.stage = stage;
    this.box = keptMesh(boxMesh(stage));
    this.ground = new pc.Entity("ground");
    this.ground.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(cylinderMesh(stage, 1, 0.05, 48), flatMaterial([0.4, 0.62, 0.28])),
      ],
    });
    this.ground.setLocalScale(3.4, 1, 3.4);
    this.ground.setLocalPosition(0, -0.03, 0.6);
    this.root.addChild(this.ground);
    stage.root.addChild(this.root);
    this.root.enabled = false;
  }

  get visible(): boolean {
    return this.root.enabled;
  }
  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** The world's lineages (null: a plant, or none to draw), built at `detail`, the ground's colour. */
  set(
    lineages: readonly { name: string; ref: string; body: BeastPlan | null }[],
    detail: number,
    ground: Rgb,
  ): void {
    for (const tones of this.tones) for (const b of tones) b.destroy();
    this.ground.render!.meshInstances[0]!.material = flatMaterial(ground);
    this.bodies = lineages.map((l) => {
      const coat = coatOf(l.name, false);
      // (Only the beasts come here: a body each, as its plan crossed to the page.)
      return buildBody(
        l.body as Parameters<typeof buildBody>[0],
        detail,
        coat.pattern,
        l.ref.length,
      );
    });
    this.tones = lineages.map((l) => {
      const coat = coatOf(l.name, false);
      return [coat.coat, coat.dark, coat.horn].map(
        (c, tone) =>
          new InstancedBatch(this.stage, this.box, c, MOST_OF_TONE[tone as 0 | 1 | 2], this.root),
      );
    });
  }

  /** The first people's figure on the stage (null: none), in their skin, cloth and hair. */
  people(f: Figure | null): void {
    for (const b of this.figure?.batches ?? []) b.destroy();
    this.figure = f
      ? {
          f,
          batches: f.parts.map(
            (part) =>
              new InstancedBatch(
                this.stage,
                this.box,
                part.tone === 2
                  ? [0.88, 0.66, 0.5]
                  : part.tone === 3
                    ? [0.2, 0.13, 0.08]
                    : part.tone === 4
                      ? [0.07, 0.06, 0.06]
                      : part.tone
                        ? [0.42, 0.3, 0.2]
                        : [0.72, 0.56, 0.36],
                1,
                this.root,
              ),
          ),
        }
      : null;
  }

  /** The people walking on at (x, z) metres on the stage, facing `yaw`, at screen time `s`. */
  placePeople(x: number, z: number, yaw: number, s: number): void {
    const fig = this.figure;
    if (!fig) return;
    const M = 0.1,
      k = 2.4 * fig.f.scale,
      c = Math.cos(yaw),
      sn = Math.sin(yaw);
    fig.f.parts.forEach((part, i) => {
      const pitch = limbPitch(part, null, true, s, 0),
        hinge = part.pivot ?? 0,
        py = part.y + hinge - hinge * Math.cos(pitch),
        pz = part.z - hinge * Math.sin(pitch);
      fig.batches[i]!.set(1, (_, out) => {
        out[0] = x * M + (part.x * c + pz * sn) * k;
        out[1] = py * k;
        out[2] = z * M + (-part.x * sn + pz * c) * k;
        out[3] = part.sx * k;
        out[4] = part.sy * k;
        out[5] = part.sz * k;
        out[6] = yaw;
        out[7] = pitch;
      });
    });
  }

  /** Put each lineage on the stage where the view says, walking in place, at screen time `s`. */
  update(on: readonly OnStage[], s: number): void {
    const shown = new Set(on.map((o) => o.lineage));
    this.tones.forEach((tones, i) => {
      if (!shown.has(i)) for (const b of tones) b.set(0, () => {});
    });
    // (Metres on the stage to its units: a creature a little larger than life, to be seen.)
    const M = 0.1;
    for (const o of on) {
      const body = this.bodies[o.lineage],
        tones = this.tones[o.lineage];
      if (!body || !tones || o.there <= 0.02) continue;
      const fly = body.plan.moves === "fly",
        swim = body.plan.moves === "swim",
        pose = { gait: 1 as const, phase: s * strideOf(body) * 2 * Math.PI, head: 0.2, crouch: 0 },
        n = posed(body, pose, this.parts),
        // Each shown at a size to see (the small larger, the great smaller than life, their
        // order kept): a length between 0.8 and 1.6 units by the log of its weight.
        shown = 0.8 + 0.8 * Math.min(1, Math.log10(body.plan.size + 1) / Math.log10(5001)),
        k = (o.there * shown) / Math.max(0.05, body.length * body.k),
        c = Math.cos(o.yaw),
        sn = Math.sin(o.yaw),
        lift = fly ? 0.35 + 0.05 * Math.sin(s * 2) : swim ? 0.12 : 0,
        counts = [0, 0, 0];
      const lists: BeastPart[][] = [[], [], []];
      for (let q = 0; q < n; q++) lists[this.parts[q]!.tone]!.push(this.parts[q]!);
      lists.forEach((list, tone) => {
        counts[tone] = list.length;
        tones[tone]!.set(list.length, (j, out) => {
          const p = list[j]!;
          out[0] = o.x * M + (p.x * c + p.z * sn) * k;
          out[1] = lift + p.y * k;
          out[2] = o.z * M + (-p.x * sn + p.z * c) * k;
          out[3] = p.sx * k;
          out[4] = p.sy * k;
          out[5] = p.sz * k;
          out[6] = o.yaw + p.yaw;
          out[7] = p.pitch;
        });
      });
    }
  }
}
