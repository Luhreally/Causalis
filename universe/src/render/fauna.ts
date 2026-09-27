// The living world about a village, drawn (Phase 8 M77): each lineage's beasts built of
// boxes in its coat, its dark features and its horn — three instanced batches a lineage,
// all its beasts in each — posed afresh every frame from the view's herds and hunts; birds
// wheeling on beating wings, and fish leaping from the water. A village's beasts are a
// handful of draw calls whatever their number.
import * as pc from "playcanvas";
import type { VillagePlan } from "../bridge/index.ts";
import {
  BEAST_SCALE,
  beastsAt,
  birdsAt,
  doingOf,
  faunaOf,
  fishAt,
  posed,
  type BeastNow,
  type BeastPart,
  type BirdNow,
  type Fauna,
  type FishNow,
} from "../view/index.ts";
import { InstancedBatch, boxMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

const M = 0.1; // units per metre, as the village's
/** The most parts of each tone a beast is drawn with: coat, dark features, horn. */
const PER_BEAST = [12, 18, 4] as const;
const FLOATS = 8;

/** A beast looked at: its lineage (ref and name), what it is doing, whether it is of the flocks. */
export type PickedBeast = { ref: string; name: string; doing: string; flock: boolean };

/** Instances gathered for one batch this frame: [x, y, z, sx, sy, sz, yaw, pitch] each. */
type Gathered = { batch: InstancedBatch; data: Float32Array; count: number };

export class FaunaLayer {
  private readonly stage: Stage;
  readonly root = new pc.Entity("fauna");
  private fauna: Fauna | null = null;
  private batches: InstancedBatch[] = [];
  /** Per lineage, its three tones' gathered instances. */
  private tones: Gathered[][] = [];
  private birds: Gathered[] = [];
  /** Dust kicked up behind whatever runs (where small motions are drawn). */
  private dust: Gathered | null = null;
  private fish: Gathered | null = null;
  private readonly beasts: BeastNow[] = [];
  private readonly parts: BeastPart[] = [];
  private readonly birdsNow: BirdNow[] = [];
  private readonly fishNow: FishNow[] = [];
  private readonly box: pc.Mesh;
  /** Beasts, birds and fish drawn at the last update; the beasts alone. */
  private shown = 0;
  private beastCount = 0;

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.box = boxMesh(stage);
    parent.addChild(this.root);
  }

  private gathered(color: Rgb, capacity: number): Gathered {
    const batch = new InstancedBatch(this.stage, this.box, color, Math.max(1, capacity), this.root);
    this.batches.push(batch);
    return { batch, data: new Float32Array(Math.max(1, capacity) * FLOATS), count: 0 };
  }

  /** Lay out what lives about a village: at most `cap` beasts, built at `detail`, with birds and fish if `ambient`. */
  build(plan: VillagePlan, cap: number, detail: number, ambient: boolean): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    const fauna = (this.fauna = faunaOf(plan, cap, detail, ambient));
    // How many beasts of each lineage are ever drawn at once: its herds and its hunters.
    const counts = fauna.species.map(() => 0);
    for (const h of fauna.herds) counts[h.species]! += h.members.length;
    for (const p of fauna.packs) counts[p.species]! += p.members;
    this.tones = fauna.species.map((sp, i) =>
      [sp.coat.coat, sp.coat.dark, sp.coat.horn].map((color, tone) =>
        this.gathered(color, counts[i]! * PER_BEAST[tone as 0 | 1 | 2]),
      ),
    );
    const small = fauna.birds.filter((b) => !b.big).length,
      big = fauna.birds.length - small;
    this.birds = [
      this.gathered([0.14, 0.13, 0.14], small * 3),
      this.gathered([0.36, 0.26, 0.16], big * 3),
    ];
    this.fish = fauna.fish.length ? this.gathered([0.74, 0.8, 0.86], fauna.fish.length) : null;
    this.dust = ambient
      ? this.gathered([0.76, 0.68, 0.52], counts.reduce((a, b) => a + b, 0) * 3)
      : null;
  }

  /** Put every beast, bird and fish where it is at screen time `s` (seconds). */
  update(s: number): void {
    const fauna = this.fauna;
    if (!fauna || !this.root.enabled) return;
    for (const tones of this.tones) for (const g of tones) g.count = 0;
    const n = beastsAt(fauna, s, this.beasts);
    for (let i = 0; i < n; i++) {
      const b = this.beasts[i]!,
        sp = fauna.species[b.species]!,
        count = posed(sp.body, b.pose, this.parts),
        c = Math.cos(b.yaw),
        sn = Math.sin(b.yaw),
        tones = this.tones[b.species]!;
      for (let k = 0; k < count; k++) {
        const p = this.parts[k]!,
          g = tones[p.tone]!;
        if (g.count >= g.batch.capacity) continue;
        const o = g.count++ * FLOATS,
          d = g.data;
        d[o] = b.x * M + p.x * c + p.z * sn;
        d[o + 1] = p.y;
        d[o + 2] = b.z * M - p.x * sn + p.z * c;
        d[o + 3] = p.sx;
        d[o + 4] = p.sy;
        d[o + 5] = p.sz;
        d[o + 6] = b.yaw;
        d[o + 7] = p.pitch;
      }
    }
    for (const tones of this.tones) for (const g of tones) flush(g);
    this.shown = this.beastCount = n;
    // Dust behind the runners: small puffs that drift back, rise and shrink as they age
    // (from every other runner of a herd: a cloud, not a wall).
    if (this.dust) {
      const g = this.dust;
      g.count = 0;
      for (let i = 0; i < n; i++) {
        const b = this.beasts[i]!;
        if (b.pose.gait !== 2 || i % 2) continue;
        const k = fauna.species[b.species]!.body.k,
          fx = Math.sin(b.yaw),
          fz = Math.cos(b.yaw);
        for (let j = 0; j < 2; j++) {
          const age = (s * 2.2 + j / 2 + i * 0.37) % 1,
            back = (0.5 + age * 2) * k * 2,
            side = (((i * 7 + j * 13) % 5) - 2) * 0.1 * k * 2,
            size = (0.3 * (1 - age) + 0.08) * k * 2;
          put(
            g,
            b.x * M - fx * back + fz * side,
            0.03 + age * 0.3 * k * 2,
            b.z * M - fz * back - fx * side,
            size,
            size * 0.7,
            size,
            b.yaw + j,
            0,
          );
        }
      }
      flush(g);
    }
    // Birds: a body and two wings that beat about it.
    const [small, big] = this.birds as [Gathered, Gathered];
    small.count = big.count = 0;
    const birds = birdsAt(fauna, s, this.birdsNow);
    for (let i = 0; i < birds; i++) {
      const b = this.birdsNow[i]!,
        g = b.big ? big : small,
        k = BEAST_SCALE * (b.big ? 2.2 : 2.6),
        span = (b.big ? 1 : 0.34) * k,
        c = Math.cos(b.yaw),
        sn = Math.sin(b.yaw),
        x = b.x * M,
        y = b.y * M,
        z = b.z * M;
      put(
        g,
        x,
        y,
        z,
        (b.big ? 0.22 : 0.1) * k,
        (b.big ? 0.14 : 0.08) * k,
        (b.big ? 0.7 : 0.3) * k,
        b.yaw,
        0,
      );
      for (const side of [1, -1]) {
        // The wing's long side runs out from the body; it beats about the body's length.
        const rx = side * c,
          rz = -side * sn,
          out = Math.cos(b.wing) * span * 0.5,
          up = -Math.sin(b.wing) * span * 0.5;
        put(
          g,
          x + rx * out,
          y + up,
          z + rz * out,
          (b.big ? 0.3 : 0.14) * k,
          0.02 * k,
          span,
          b.yaw + (side * Math.PI) / 2,
          b.wing,
        );
      }
    }
    flush(small);
    flush(big);
    this.shown += birds;
    if (this.fish) {
      const g = this.fish;
      g.count = 0;
      const leaping = fishAt(fauna, s, this.fishNow),
        k = BEAST_SCALE * 2.2;
      for (let i = 0; i < leaping; i++) {
        const f = this.fishNow[i]!;
        put(g, f.x * M, 0.02 + f.y * M, f.z * M, 0.12 * k, 0.7 * k, 0.22 * k, f.yaw, f.pitch);
      }
      flush(g);
      this.shown += leaping;
    }
  }

  /** The beast nearest a screen point, within a finger's reach: its lineage, and what it is doing. */
  pick(x: number, y: number, reach = 30): PickedBeast | null {
    const fauna = this.fauna;
    if (!fauna || !this.root.enabled) return null;
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3(),
      p = new pc.Vec3();
    let best: PickedBeast | null = null,
      bestD = reach * reach;
    for (const b of this.beasts) {
      const sp = fauna.species[b.species];
      if (!sp) continue;
      p.set(b.x * M, sp.body.p.leg * sp.body.k, b.z * M);
      const s = cam.worldToScreen(p, at),
        d = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y);
      if (s.z > 0 && d < bestD) {
        bestD = d;
        best = { ref: sp.ref, name: sp.name, doing: doingOf(sp, b.pose), flock: sp.flock };
      }
    }
    return best;
  }

  /** Every beast as it was last drawn: lineage, niche, where (metres) and what it is doing (for the look tools). */
  now(): { name: string; niche: string; x: number; z: number; doing: string }[] {
    const fauna = this.fauna;
    if (!fauna) return [];
    return this.beasts.slice(0, this.beastCount).map((b) => {
      const sp = fauna.species[b.species]!;
      return { name: sp.name, niche: sp.niche, x: b.x, z: b.z, doing: doingOf(sp, b.pose) };
    });
  }

  /** How many beasts, birds and fish are drawn now (for the look tool and tests). */
  get drawn(): number {
    return this.shown;
  }

  destroy(): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.fauna = null;
  }
}

function put(
  g: Gathered,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  yaw: number,
  pitch: number,
): void {
  if (g.count >= g.batch.capacity) return;
  const o = g.count++ * FLOATS,
    d = g.data;
  d[o] = x;
  d[o + 1] = y;
  d[o + 2] = z;
  d[o + 3] = sx;
  d[o + 4] = sy;
  d[o + 5] = sz;
  d[o + 6] = yaw;
  d[o + 7] = pitch;
}

function flush(g: Gathered): void {
  const d = g.data;
  g.batch.set(g.count, (i, out) => {
    const o = i * FLOATS;
    for (let k = 0; k < FLOATS; k++) out[k] = d[o + k]!;
  });
}
