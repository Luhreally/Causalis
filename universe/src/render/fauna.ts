// The living world about a village, drawn (Phase 8 M77): each lineage's beasts built of
// boxes in its coat, its dark features and its horn — three instanced batches a lineage,
// all its beasts in each — posed afresh every frame from the view's herds and hunts; birds
// wheeling on beating wings, and fish leaping from the water. A village's beasts are a
// handful of draw calls whatever their number.
import * as pc from "playcanvas";
import type { VillagePlan } from "../bridge/index.ts";
import {
  MOST_OF_TONE,
  beastsAt,
  birdsAt,
  doingOf,
  faunaOf,
  fishAt,
  posed,
  strideOf,
  type BeastNow,
  type BeastPart,
  type BirdNow,
  type Fauna,
  type FishNow,
  type Pose,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

const M = 0.1; // units per metre, as the village's
/** The most parts of each tone a beast is drawn with: coat, dark features, horn. */
const PER_BEAST = MOST_OF_TONE;
const FLOATS = 8;

/** A beast looked at: its lineage (ref and name), what it is doing, whether it is of the flocks, and which it is. */
export type PickedBeast = {
  ref: string;
  name: string;
  doing: string;
  flock: boolean;
  index: number;
};

/** Instances gathered for one batch this frame: [x, y, z, sx, sy, sz, yaw, pitch] each. */
type Gathered = { batch: InstancedBatch; data: Float32Array; count: number };

export class FaunaLayer {
  private readonly stage: Stage;
  readonly root = new pc.Entity("fauna");
  private fauna: Fauna | null = null;
  private batches: InstancedBatch[] = [];
  /** Per lineage, its three tones' gathered instances. */
  private tones: Gathered[][] = [];
  /** A flier's pose (wings beating) and a swimmer's (tail sweeping), reused. */
  private readonly flying: Pose = { gait: 1, phase: 0, head: 0.2, crouch: 0 };
  private readonly swimming: Pose = { gait: 1, phase: 0, head: 0, crouch: 0 };
  /** Dust kicked up behind whatever runs (where small motions are drawn). */
  private dust: Gathered | null = null;
  private readonly beasts: BeastNow[] = [];
  private readonly parts: BeastPart[] = [];
  private readonly birdsNow: BirdNow[] = [];
  private readonly fishNow: FishNow[] = [];
  private readonly box: pc.Mesh;
  /** The camera's view as it stands this frame, and a creature's bounds tried against it. */
  private readonly frustum = new pc.Frustum();
  private readonly view = new pc.Mat4();
  private readonly viewProjection = new pc.Mat4();
  private readonly sphere = new pc.BoundingSphere();
  /** Beasts, birds and fish about the village at the last update (drawn where in sight); the beasts alone. */
  private shown = 0;
  private beastCount = 0;
  private birdCount = 0;
  private fishCount = 0;

  /** The beast lit as looked at (Phase 10 M93b): a ring on the ground that goes with it. */
  private readonly ring: pc.Entity;
  private lit: number | null = null;

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.box = keptMesh(boxMesh(stage));
    this.ring = new pc.Entity("beast-ring");
    this.ring.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(
          cylinderMesh(stage, 0.5, 0.012, 24),
          flatMaterial([1, 0.92, 0.35], 0.8),
        ),
      ],
    });
    this.ring.enabled = false;
    parent.addChild(this.root);
    // (Under the layer's own root: the village's rebuilds clear what else stands on its ground.)
    this.root.addChild(this.ring);
  }

  /** Light a beast (its place in the herds as laid out), or none. */
  mark(index: number | null): void {
    this.lit = index;
    this.ring.enabled = false;
  }

  /** Light the first beast of a lineage about the village, if any stands there. */
  markLineage(ref: string): boolean {
    const fauna = this.fauna;
    if (!fauna) return false;
    const species = fauna.species.findIndex((s) => s.ref === ref),
      i = this.beasts.slice(0, this.beastCount).findIndex((b) => b.species === species);
    this.mark(i >= 0 ? i : null);
    return i >= 0;
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
    if (fauna.road.species >= 0) counts[fauna.road.species]! += fauna.road.count;
    for (const b of fauna.birds) counts[b.species]!++;
    for (const f of fauna.fish) counts[f.species]!++;
    this.tones = fauna.species.map((sp, i) =>
      [sp.coat.coat, sp.coat.dark, sp.coat.horn].map((color, tone) =>
        this.gathered(color, counts[i]! * PER_BEAST[tone as 0 | 1 | 2]),
      ),
    );
    this.dust = ambient
      ? this.gathered([0.76, 0.68, 0.52], counts.reduce((a, b) => a + b, 0) * 3)
      : null;
  }

  /**
   * One creature, drawn from its body: its parts posed, turned to `yaw`, tipped `tilt` about
   * its middle (a leaping swimmer), at (x, y, z) metres.
   */
  private draw(
    species: number,
    x: number,
    y: number,
    z: number,
    yaw: number,
    tilt: number,
    pose: Pose,
  ): void {
    const sp = this.fauna!.species[species]!,
      count = posed(sp.body, pose, this.parts),
      c = Math.cos(yaw),
      sn = Math.sin(yaw),
      ct = Math.cos(tilt),
      st = Math.sin(tilt),
      mid = sp.body.height * sp.body.k,
      tones = this.tones[species]!;
    for (let k = 0; k < count; k++) {
      const p = this.parts[k]!,
        g = tones[p.tone]!;
      if (g.count >= g.batch.capacity) continue;
      // (Tipped about its middle first, then turned to its way.)
      const py = tilt ? mid + (p.y - mid) * ct - p.z * st : p.y,
        pz = tilt ? (p.y - mid) * st + p.z * ct : p.z,
        o = g.count++ * FLOATS,
        d = g.data;
      d[o] = x * M + p.x * c + pz * sn;
      d[o + 1] = y * M + py;
      d[o + 2] = z * M - p.x * sn + pz * c;
      d[o + 3] = p.sx;
      d[o + 4] = p.sy;
      d[o + 5] = p.sz;
      d[o + 6] = yaw + p.yaw;
      d[o + 7] = p.pitch + tilt;
    }
  }

  /**
   * Whether a creature of `species` at (x, y, z) metres may be seen: within the camera's view,
   * or near enough its edge for its shadow to fall into it (the sun low, a shadow long).
   */
  private inSight(species: number, x: number, y: number, z: number): boolean {
    const b = this.fauna!.species[species]!.body,
      reach = (b.length + b.height + b.neck + b.head + b.tail) * b.k,
      sphere = this.sphere;
    sphere.center.set(x * M, y * M + b.height * b.k * 0.5, z * M);
    sphere.radius = reach * 3 + 0.3;
    return this.frustum.containsSphere(sphere) > 0;
  }

  /** Put every creature where it is at screen time `s` (seconds). */
  update(s: number): void {
    const fauna = this.fauna;
    if (!fauna || !this.root.enabled) return;
    for (const tones of this.tones) for (const g of tones) g.count = 0;
    // (The view as the camera stands now, not as it stood for the last frame drawn.)
    const cam = this.stage.camera;
    this.view.copy(cam.getWorldTransform()).invert();
    this.viewProjection.mul2(cam.camera!.projectionMatrix, this.view);
    this.frustum.setFromMat4(this.viewProjection);
    const n = beastsAt(fauna, s, this.beasts);
    for (let i = 0; i < n; i++) {
      const b = this.beasts[i]!;
      // (Out of sight, not posed: most of a village's beasts are, looking into it.)
      if (!this.inSight(b.species, b.x, 0, b.z)) continue;
      this.draw(b.species, b.x, 0, b.z, b.yaw, 0, b.pose);
    }
    // The fliers, on their wings; the swimmers, leaping.
    const birds = birdsAt(fauna, s, this.birdsNow);
    for (let i = 0; i < birds; i++) {
      const b = this.birdsNow[i]!,
        sp = fauna.species[b.species]!;
      if (!this.inSight(b.species, b.x, b.y, b.z)) continue;
      this.flying.phase = s * strideOf(sp.body) + i * 0.7;
      // (Gliding, its wings held out still.)
      this.flying.gait = b.glide ? 0 : 1;
      this.draw(b.species, b.x, b.y, b.z, b.yaw, 0, this.flying);
    }
    const leaping = fishAt(fauna, s, this.fishNow);
    for (let i = 0; i < leaping; i++) {
      const f = this.fishNow[i]!;
      if (!this.inSight(f.species, f.x, f.y, f.z)) continue;
      this.swimming.phase = s * 6 + i;
      this.draw(f.species, f.x, 0.02 + f.y, f.z, f.yaw, f.pitch - Math.PI / 2, this.swimming);
    }
    for (const tones of this.tones) for (const g of tones) flush(g);
    // The lit beast's ring, under it and as wide as it is long.
    const lit = this.lit === null ? undefined : this.beasts[this.lit];
    this.ring.enabled = !!lit && this.lit! < n;
    if (lit && this.ring.enabled) {
      const b = fauna.species[lit.species]!.body,
        r = Math.max(0.12, b.length * b.k * 0.8);
      this.ring.setLocalPosition(lit.x * M, 0.035, lit.z * M);
      this.ring.setLocalScale(r * 2, 1, r * 2);
    }
    this.shown = n + birds + leaping;
    this.beastCount = n;
    this.birdCount = birds;
    this.fishCount = leaping;
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
      p.set(b.x * M, sp.body.leg * sp.body.k, b.z * M);
      const s = cam.worldToScreen(p, at),
        d = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y);
      if (s.z > 0 && d < bestD) {
        bestD = d;
        best = {
          ref: sp.ref,
          name: sp.name,
          doing: doingOf(sp, b.pose, b.task),
          flock: sp.flock,
          index: this.beasts.indexOf(b),
        };
      }
    }
    // The fliers and the swimmers too (Phase 10 M93): a bird on its wings, a fish leaping.
    const others = (
      list: readonly { species: number; x: number; y: number; z: number }[],
      count: number,
      doing: string,
    ) => {
      for (let i = 0; i < count; i++) {
        const b = list[i]!,
          sp = fauna.species[b.species];
        if (!sp) continue;
        p.set(b.x * M, b.y * M, b.z * M);
        const s = cam.worldToScreen(p, at),
          d = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y);
        if (s.z > 0 && d < bestD) {
          bestD = d;
          best = { ref: sp.ref, name: sp.name, doing, flock: false, index: -1 };
        }
      }
    };
    others(this.birdsNow, this.birdCount, "flying");
    others(this.fishNow, this.fishCount, "leaping from the water");
    return best;
  }

  /**
   * Every creature as it was last drawn — on the ground, in the air, leaping from the water:
   * lineage, niche, where (metres) and what it is doing (for the look tools).
   */
  now(): { name: string; niche: string; x: number; y: number; z: number; doing: string }[] {
    const fauna = this.fauna;
    if (!fauna) return [];
    const one = (species: number, x: number, y: number, z: number, pose: Pose, task: 0 | 1 | 2) => {
      const sp = fauna.species[species]!;
      return { name: sp.name, niche: sp.niche, x, y, z, doing: doingOf(sp, pose, task) };
    };
    return [
      ...this.beasts
        .slice(0, this.beastCount)
        .map((b) => one(b.species, b.x, 0, b.z, b.pose, b.task)),
      ...this.birdsNow
        .slice(0, this.birdCount)
        .map((b) => one(b.species, b.x, b.y, b.z, this.flying, 0)),
      ...this.fishNow
        .slice(0, this.fishCount)
        .map((f) => one(f.species, f.x, f.y, f.z, this.swimming, 0)),
    ];
  }

  /** The road's traffic as laid out (for the works that go with it). */
  get road(): Fauna["road"] | null {
    return this.fauna?.road ?? null;
  }

  /** The species of each lineage drawn (for the works that ride on them). */
  get species(): Fauna["species"] {
    return this.fauna?.species ?? [];
  }

  /** How many beasts, birds and fish are about the village now, each drawn where it may be seen (for the look tool and tests). */
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
