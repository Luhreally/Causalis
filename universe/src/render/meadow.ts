// An age's living world, drawn (Phase 27 M155): a stretch of its land — its ground and grass as
// the age has them, green or frosted or ash-dark, the grass standing as it has grown back or been
// eaten down; its woods in leaf or bare; its pool; the fallen where they lie — and its beasts, each
// lineage drawn from its own body in its coat as the village draws its beasts, posed afresh every
// frame from the meadow the view keeps: grazing heads down, walking, running, stalking low; fliers
// up when they go, swimmers in the pool; a ring about the one followed.
import * as pc from "playcanvas";
import type { BeastPlan } from "../bridge/index.ts";
import {
  MEADOW_CELLS,
  MOST_OF_TONE,
  beastPose,
  buildBody,
  cellMiddle,
  coatOf,
  posed,
  seasonGround,
  seasonKey,
  seasonLeaf,
  seasonWater,
  type BeastPart,
  type Built,
  type GroundSeason,
  type MeadowState,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

/** Units a metre of the meadow, as the village's. */
const M = 0.1;
const FLOATS = 8;
/** How often the grass and woods are drawn again (ms): they change slowly. */
const GROWTH_EVERY = 250;

/** The pool's water. */
const POOL: Rgb = [0.22, 0.46, 0.66];

/** An age's look: its bare ground, its grass from eaten down to lush, its leaves, its water. */
type Look = { dirt: Rgb; grass: readonly [Rgb, Rgb, Rgb, Rgb]; leaf: Rgb; bark: Rgb };
const LOOKS: Readonly<Record<string, Look>> = {
  quiet: {
    dirt: [0.45, 0.36, 0.24],
    grass: [
      [0.5, 0.42, 0.28],
      [0.56, 0.6, 0.3],
      [0.42, 0.62, 0.26],
      [0.3, 0.56, 0.2],
    ],
    leaf: [0.24, 0.48, 0.2],
    bark: [0.36, 0.26, 0.16],
  },
  hothouse: {
    dirt: [0.42, 0.3, 0.18],
    grass: [
      [0.5, 0.38, 0.22],
      [0.45, 0.6, 0.25],
      [0.3, 0.58, 0.18],
      [0.18, 0.5, 0.14],
    ],
    leaf: [0.14, 0.42, 0.14],
    bark: [0.3, 0.2, 0.12],
  },
  icehouse: {
    dirt: [0.82, 0.84, 0.88],
    grass: [
      [0.86, 0.88, 0.92],
      [0.68, 0.72, 0.62],
      [0.56, 0.64, 0.48],
      [0.46, 0.58, 0.4],
    ],
    leaf: [0.32, 0.46, 0.36],
    bark: [0.34, 0.28, 0.22],
  },
  "great volcanism": {
    dirt: [0.24, 0.21, 0.2],
    grass: [
      [0.3, 0.26, 0.22],
      [0.45, 0.46, 0.26],
      [0.42, 0.5, 0.24],
      [0.36, 0.5, 0.22],
    ],
    leaf: [0.3, 0.4, 0.18],
    bark: [0.2, 0.16, 0.14],
  },
  // A desert's ground, sand and sparse yellowed grass (a land of now, Phase 29 M160).
  dry: {
    dirt: [0.78, 0.66, 0.46],
    grass: [
      [0.76, 0.64, 0.44],
      [0.72, 0.64, 0.4],
      [0.66, 0.62, 0.34],
      [0.56, 0.56, 0.28],
    ],
    leaf: [0.42, 0.46, 0.24],
    bark: [0.44, 0.34, 0.22],
  },
  impact: {
    dirt: [0.34, 0.31, 0.28],
    grass: [
      [0.38, 0.34, 0.28],
      [0.5, 0.48, 0.32],
      [0.48, 0.52, 0.3],
      [0.42, 0.5, 0.26],
    ],
    leaf: [0.34, 0.4, 0.24],
    bark: [0.26, 0.22, 0.18],
  },
};

/** A lineage of the meadow as drawn: its body, its three tones' batches and their instances. */
type Drawn = {
  readonly body: Built;
  readonly tones: { batch: InstancedBatch; data: Float32Array; n: number }[];
};

export class MeadowScene {
  readonly root = new pc.Entity("meadow");
  private readonly stage: Stage;
  private readonly box: pc.Mesh;
  private readonly cone: pc.Mesh;
  private readonly cyl: pc.Mesh;
  private readonly ground: pc.Entity;
  private readonly pond: pc.Entity;
  private readonly grass: InstancedBatch[];
  private readonly trunks: InstancedBatch;
  private readonly crowns: InstancedBatch;
  private readonly fallen: InstancedBatch;
  private readonly ring: pc.Entity;
  /** Each lineage drawn, by its ref (those let go from the meadow let go here). */
  private drawn = new Map<string, Drawn>();
  private readonly parts: BeastPart[] = [];
  private look = "";
  /** The season on the ground (a land of now: Phase 30 M164), and its key as last dressed. */
  private seasonNow: GroundSeason | null = null;
  private seasonSeen = "";
  private grownAt = 0;
  private detail = 2;

  constructor(stage: Stage) {
    this.stage = stage;
    this.box = keptMesh(boxMesh(stage));
    this.cone = keptMesh(coneMesh(stage, 0.5, 1, 7));
    this.cyl = keptMesh(cylinderMesh(stage, 0.5, 1, 10));
    const { cols, rows, size } = MEADOW_CELLS;
    this.ground = new pc.Entity("ground");
    this.ground.addComponent("render", {
      meshInstances: [new pc.MeshInstance(this.box, flatMaterial(LOOKS.quiet!.dirt))],
    });
    // (A little wider than the meadow: its edge seen as earth, not as nothing.)
    this.ground.setLocalScale(cols * size * M + 1.2, 0.1, rows * size * M + 1.2);
    this.ground.setLocalPosition(0, -0.05, 0);
    this.root.addChild(this.ground);
    this.grass = LOOKS.quiet!.grass.map(
      (c) => new InstancedBatch(stage, this.box, c, cols * rows, this.root),
    );
    this.trunks = new InstancedBatch(stage, this.cyl, LOOKS.quiet!.bark, 64, this.root);
    this.crowns = new InstancedBatch(stage, this.cone, LOOKS.quiet!.leaf, 64, this.root);
    this.fallen = new InstancedBatch(stage, this.box, [0.5, 0.36, 0.3], 128, this.root);
    this.pond = new pc.Entity("pool");
    this.pond.addComponent("render", {
      meshInstances: [new pc.MeshInstance(this.cyl, flatMaterial(POOL, 0.85, 0.8, 0.3))],
    });
    this.root.addChild(this.pond);
    this.ring = new pc.Entity("followed");
    this.ring.addComponent("render", {
      meshInstances: [new pc.MeshInstance(this.cyl, flatMaterial([1, 0.86, 0.3], 0.8))],
    });
    this.root.addChild(this.ring);
    stage.root.addChild(this.root);
    this.root.enabled = false;
  }

  get visible(): boolean {
    return this.root.enabled;
  }
  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** Built at `detail` (0 … 3). */
  setDetail(detail: number): void {
    this.detail = detail;
  }

  /** A new meadow: its lineages drawn afresh. */
  reset(): void {
    for (const d of this.drawn.values()) for (const t of d.tones) t.batch.destroy();
    this.drawn.clear();
    this.look = "";
    this.grownAt = 0;
  }

  /** The meadow as it stands, its beasts each where it is. */
  update(s: MeadowState, bodies: readonly (BeastPlan | null)[]): void {
    if (!this.root.enabled) return;
    this.dress(s);
    const now = performance.now();
    if (now - this.grownAt >= GROWTH_EVERY) {
      this.grownAt = now;
      this.grow(s);
    }
    // Each lineage come into the meadow drawn from its own body; those let go, let go.
    if (this.drawn.size !== s.kinds.length || s.kinds.some((k) => !this.drawn.has(k.ref))) {
      const refs = new Set(s.kinds.map((k) => k.ref));
      for (const [ref, d] of this.drawn)
        if (!refs.has(ref)) {
          for (const t of d.tones) t.batch.destroy();
          this.drawn.delete(ref);
        }
    }
    for (const k of s.kinds) {
      if (this.drawn.has(k.ref)) continue;
      const plan = bodies[k.lineage],
        coat = coatOf(k.name, false),
        body = buildBody(
          (plan ?? { size: k.size }) as Parameters<typeof buildBody>[0],
          this.detail,
          coat.pattern,
          k.ref.length,
        ),
        most = k.most + 4;
      this.drawn.set(k.ref, {
        body,
        tones: [coat.coat, coat.dark, coat.horn].map((c, tone) => {
          const cap = most * MOST_OF_TONE[tone as 0 | 1 | 2];
          return {
            batch: new InstancedBatch(this.stage, this.box, c, cap, this.root),
            data: new Float32Array(cap * FLOATS),
            n: 0,
          };
        }),
      });
    }
    for (const d of this.drawn.values()) for (const t of d.tones) t.n = 0;
    let lit: { x: number; z: number; r: number } | null = null;
    for (const b of s.beasts) {
      const k = s.kinds[b.kind]!,
        d = this.drawn.get(k.ref);
      if (!d) continue;
      const pose = beastPose(s, b),
        n = posed(d.body, pose, this.parts),
        // (The young smaller, grown as they age.)
        grow = 0.55 + 0.45 * Math.min(1, b.age / Math.max(1, k.grown)),
        c = Math.cos(b.heading),
        sn = Math.sin(b.heading),
        up =
          k.flies && pose.gait > 0
            ? 0.5 + 0.08 * Math.sin(b.phase * 6)
            : k.feed === "swim"
              ? 0.01
              : 0;
      for (let q = 0; q < n; q++) {
        const p = this.parts[q]!,
          t = d.tones[p.tone]!;
        if (t.n >= t.batch.capacity) continue;
        const o = t.n++ * FLOATS,
          a = t.data;
        a[o] = b.x * M + (p.x * c + p.z * sn) * grow;
        a[o + 1] = up + p.y * grow;
        a[o + 2] = b.z * M + (-p.x * sn + p.z * c) * grow;
        a[o + 3] = p.sx * grow;
        a[o + 4] = p.sy * grow;
        a[o + 5] = p.sz * grow;
        a[o + 6] = b.heading + p.yaw;
        a[o + 7] = p.pitch;
      }
      if (b.id === s.chosen) lit = { x: b.x * M, z: b.z * M, r: (k.length * M) / 2 + 0.08 };
    }
    for (const d of this.drawn.values())
      for (const t of d.tones) {
        const a = t.data;
        t.batch.set(t.n, (i, out) => {
          const o = i * FLOATS;
          for (let j = 0; j < FLOATS; j++) out[j] = a[o + j]!;
        });
      }
    this.ring.enabled = !!lit;
    if (lit) {
      this.ring.setLocalPosition(lit.x, 0.07, lit.z);
      this.ring.setLocalScale(lit.r * 2, 0.012, lit.r * 2);
    }
    // The fallen, as long as there is anything of them.
    const fallen = s.carcasses;
    this.fallen.set(Math.min(fallen.length, this.fallen.capacity), (i, out) => {
      // (Lying on its side, smaller than it stood, smaller yet as it is eaten.)
      const f = fallen[i]!,
        l = f.size * M * 0.55 * (0.35 + 0.65 * Math.min(1, f.meat));
      out[0] = f.x * M;
      out[1] = l * 0.12;
      out[2] = f.z * M;
      out[3] = l * 0.4;
      out[4] = l * 0.24;
      out[5] = l;
      out[6] = f.kind * 1.7 + f.x;
    });
  }

  /**
   * The season on the ground of a land of now (Phase 30 M164; null: an age's, none told): snow
   * lying on the ground and the grass, the leaves turned or fallen, the pool frozen over.
   */
  season(s: GroundSeason | null): void {
    const key = s ? seasonKey(s) : "";
    if (key === this.seasonSeen) return;
    this.seasonSeen = key;
    this.seasonNow = s;
  }

  /** The ground, grass, woods and pool in the age's colours (and the season's, where told). */
  private dress(s: MeadowState): void {
    const key = `${s.kindOfAge}|${this.seasonSeen}`;
    if (key === this.look) return;
    this.look = key;
    const look = LOOKS[s.kindOfAge] ?? LOOKS.quiet!,
      sea = this.seasonNow,
      ground = (c: Rgb) => (sea ? seasonGround(c, sea) : c),
      dirt = ground(look.dirt),
      water = sea ? seasonWater(POOL, sea) : POOL,
      paint = (e: pc.Entity, c: Rgb) => {
        const m = e.render!.meshInstances[0]!.material as pc.StandardMaterial;
        m.diffuse.set(c[0], c[1], c[2]);
        m.update();
      };
    paint(this.ground, dirt);
    paint(this.pond, water);
    this.grass.forEach((b, i) => b.recolor(ground(look.grass[i]!)));
    this.trunks.recolor(look.bark);
    this.crowns.recolor(sea ? seasonLeaf(look.leaf, sea) : look.leaf);
    const p = s.pond;
    this.pond.enabled = !!p;
    if (p) {
      this.pond.setLocalPosition(p.x * M, 0.012, p.z * M);
      this.pond.setLocalScale(p.r * 2 * M, 0.03, p.r * 2 * M);
    }
  }

  /** The grass as it stands, cell by cell, in four bands from eaten down to lush; the woods in leaf or bare. */
  private grow(s: MeadowState): void {
    const { size } = MEADOW_CELLS,
      bands: number[][] = [[], [], [], []];
    for (let i = 0; i < s.grass.length; i++) {
      const g = s.grass[i]!;
      if (s.pond) {
        const m = cellMiddle(i);
        if (Math.hypot(m.x - s.pond.x, m.z - s.pond.z) < s.pond.r - 1) continue;
      }
      bands[g < 0.2 ? 0 : g < 0.45 ? 1 : g < 0.7 ? 2 : 3]!.push(i);
    }
    bands.forEach((list, k) => {
      this.grass[k]!.set(list.length, (j, out) => {
        const i = list[j]!,
          m = cellMiddle(i),
          g = s.grass[i]!,
          h = 0.008 + 0.05 * g;
        out[0] = m.x * M;
        out[1] = h / 2;
        out[2] = m.z * M;
        out[3] = size * M * 0.98;
        out[4] = h;
        out[5] = size * M * 0.98;
        out[6] = 0;
      });
    });
    const shrubs = s.shrubs;
    this.trunks.set(shrubs.length, (i, out) => {
      const sh = shrubs[i]!;
      out[0] = sh.x * M;
      out[1] = sh.r * M * 0.35;
      out[2] = sh.z * M;
      out[3] = sh.r * M * 0.18;
      out[4] = sh.r * M * 0.7;
      out[5] = sh.r * M * 0.18;
    });
    this.crowns.set(shrubs.length, (i, out) => {
      const sh = shrubs[i]!,
        // (Browsed bare, its crown thin and small.)
        w = sh.r * M * (0.5 + 0.9 * sh.leaf),
        h = sh.r * M * (0.8 + 1.1 * sh.leaf);
      out[0] = sh.x * M;
      out[1] = sh.r * M * 0.55 + h / 2;
      out[2] = sh.z * M;
      out[3] = w;
      out[4] = h;
      out[5] = w;
      out[6] = i;
    });
  }

  /** The beast nearest a screen point, within a finger's reach (its id), or null. */
  pick(s: MeadowState, x: number, y: number, reach = 30): number | null {
    const cam = this.stage.camera.camera!,
      p = new pc.Vec3(),
      out = new pc.Vec3();
    let best: number | null = null,
      bd = reach * reach;
    for (const b of s.beasts) {
      const k = s.kinds[b.kind]!;
      p.set(b.x * M, k.length * M * 0.25 + (k.flies && b.speed > 0 ? 0.5 : 0), b.z * M);
      cam.worldToScreen(p, out);
      const d = (out.x - x) ** 2 + (out.y - y) ** 2;
      if (out.z > 0 && d < bd) {
        bd = d;
        best = b.id;
      }
    }
    return best;
  }

  /** Where a beast is on the screen (the look tools), or null. */
  onScreen(s: MeadowState, id: number): { x: number; y: number } | null {
    const b = s.beasts.find((x) => x.id === id);
    if (!b) return null;
    const k = s.kinds[b.kind]!,
      out = this.stage.camera.camera!.worldToScreen(
        new pc.Vec3(b.x * M, k.length * M * 0.25, b.z * M),
      );
    return out.z > 0 ? { x: out.x, y: out.y } : null;
  }

  /** Parts drawn of the beasts in all (the look tools). */
  count(): number {
    let n = 0;
    for (const d of this.drawn.values()) for (const t of d.tones) n += t.n;
    return n;
  }
}
