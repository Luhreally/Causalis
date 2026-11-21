// What grows on a land, drawn (view/flora.ts says what and where): its woods far off as crowns a tile holds, and near the eye
// each tree, bush, tuft, stone and patch of ground where it stands. A few batches for all of it, each instance its own tone
// (stage.ts tonedMaterial), the season laid over a batch as a whole (its leaves turned, fallen, snowed on), never per frame.
// The near things are laid again only when the eye has gone a third of their reach, or come down or gone up past it, or the
// land's ground is laid anew: built from a lattice fixed on the land, so what was there is there again.
import * as pc from "playcanvas";
import {
  formColor,
  lifeTint,
  nearBudget,
  nearFloraSteps,
  nearReach,
  seasonLeaf,
  seasonNeedle,
  type FloraLand,
  type GroundSeason,
  type NearFlora,
  type NearThing,
  type RegionTree,
} from "../view/index.ts";
import { InstancedBatch, coneMesh, cylinderMesh, keptMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

/** Far crowns' kinds: their shape, breadth and height (a tile's share), and their colour where no reading gives one. */
const FAR_KINDS: readonly {
  kind: RegionTree["kind"];
  cone: boolean;
  w: number;
  h: number;
  color: Rgb;
  form: Parameters<typeof formColor>[1];
}[] = [
  { kind: "conifer", cone: true, w: 0.5, h: 1.05, color: [0.06, 0.4, 0.22], form: "conifer" },
  {
    kind: "broadleaf",
    cone: false,
    w: 0.65,
    h: 0.55,
    color: [0.16, 0.56, 0.18],
    form: "broadleaf",
  },
  { kind: "flat", cone: false, w: 0.95, h: 0.3, color: [0.32, 0.5, 0.15], form: "flat" },
  { kind: "tall", cone: false, w: 0.55, h: 1.05, color: [0.05, 0.38, 0.14], form: "tall" },
  { kind: "parched", cone: false, w: 0.65, h: 0.5, color: [0.52, 0.37, 0.13], form: "broadleaf" },
  { kind: "palm", cone: false, w: 0.55, h: 0.45, color: [0.2, 0.5, 0.2], form: "palm" },
  { kind: "scrub", cone: false, w: 0.55, h: 0.3, color: [0.4, 0.46, 0.2], form: "scrub" },
  { kind: "dead", cone: false, w: 0.4, h: 0.25, color: [0.4, 0.32, 0.24], form: "dead" },
];
const PARCHED: Rgb = [0.52, 0.37, 0.13];

/** How long a frame spends on a laying of the near things, at most (ms): the rest waits for the next frame. */
const LAY_SLICE = 4;
/** How much smaller the far crowns are drawn while the near things are (the eye is close: they are groves past them). */
const FAR_NEAR = 0.55;
/** How close the eye comes before the near things are drawn (its distance, region units), and the most they reach. */
export const NEAR_ON = 18,
  NEAR_MOST = 9;

/**
 * A land's growth drawn: far crowns in two batches (needles and round), near things in five (trunks, cones, balls, tufts,
 * stones) and patches of ground (one), each instance toned.
 */
export class FloraLayer {
  private readonly stage: Stage;
  private readonly root: pc.Entity;
  private readonly cone: pc.Mesh;
  private readonly ball: pc.Mesh;
  private readonly trunk: pc.Mesh;
  private readonly tuft: pc.Mesh;
  private readonly stone: pc.Mesh;
  private readonly patch: pc.Mesh;
  private farCones: InstancedBatch | null = null;
  private farBalls: InstancedBatch | null = null;
  private near: Record<
    "trunks" | "cones" | "balls" | "tufts" | "stones" | "patches",
    InstancedBatch | null
  > = {
    trunks: null,
    cones: null,
    balls: null,
    tufts: null,
    stones: null,
    patches: null,
  };
  private land: FloraLand | null = null;
  private look: string | undefined;
  private parched = false;
  /** The far crowns as last planted (by tile and place), and where the near things stand instead of them. */
  private far: readonly RegionTree[] = [];
  private size = 0;
  private tileKm = 1;
  private heights: Float32Array | null = null;
  private hole: { x: number; z: number; r: number } | null = null;
  /** Where the near things were last laid about, how far, and for which ground. */
  private laidAt: { x: number; z: number; r: number; most: number; ground: number } | null = null;
  private ground = 0;
  private free: (x: number, z: number, r: number) => boolean = () => true;
  private bare: (tile: number) => boolean = () => false;
  private seasonNow: GroundSeason | null = null;
  /** What was last laid near (the look tools). */
  private nearShown: NearFlora | null = null;
  /** The last laying's time (ms), for the budgets. */
  layMs = 0;
  private readonly at = new pc.Vec3();
  private readonly fwd = new pc.Vec3();

  constructor(stage: Stage, root: pc.Entity) {
    this.stage = stage;
    this.root = root;
    this.cone = keptMesh(coneMesh(stage, 0.5, 1, 6));
    this.ball = keptMesh(
      pc.Mesh.fromGeometry(
        stage.device,
        new pc.SphereGeometry({ radius: 0.5, latitudeBands: 3, longitudeBands: 6 }),
      ),
    );
    this.trunk = keptMesh(cylinderMesh(stage, 0.5, 1, 5));
    this.tuft = keptMesh(coneMesh(stage, 0.5, 1, 4));
    this.stone = keptMesh(
      pc.Mesh.fromGeometry(
        stage.device,
        new pc.SphereGeometry({ radius: 0.5, latitudeBands: 2, longitudeBands: 5 }),
      ),
    );
    this.patch = keptMesh(cylinderMesh(stage, 0.5, 1, 7));
  }

  /** A new land's ground: nothing on it yet. */
  reset(size: number, tileKm: number, heights: Float32Array): void {
    this.size = size;
    this.tileKm = tileKm;
    this.heights = heights;
    this.land = null;
    this.far = [];
    this.hole = null;
    this.laidAt = null;
    this.nearShown = null;
    this.farCones?.set(0, () => {});
    this.farBalls?.set(0, () => {});
    for (const b of Object.values(this.near)) b?.set(0, () => {});
  }

  /** Its life's colours (Phase 57), where no reading carries the world's own. */
  lifeLook(look: string | undefined): void {
    this.look = look;
  }

  /** What grows on it as read (null: none read, the far crowns in their kinds' colours alone). */
  setLand(land: FloraLand | null, parched: boolean): void {
    if (land !== this.land || parched !== this.parched) this.laidAt = null;
    this.land = land;
    this.parched = parched;
  }

  /** The ground as its towns, roads and fields have taken it (what nothing grows on), and what has burned bare. */
  setGround(
    free: (x: number, z: number, r: number) => boolean,
    bare: (tile: number) => boolean,
  ): void {
    this.free = free;
    this.bare = bare;
    this.ground++;
    this.laidAt = null;
  }

  /** The far crowns: a low-poly crown for each, on the ground where it stands; those where the near things stand left out. */
  plant(trees: readonly RegionTree[]): void {
    this.far = trees;
    this.drawFar();
  }

  get planted(): number {
    return this.far.length;
  }

  private drawFar(): void {
    const h = this.heights;
    if (!h) return;
    const half = ((this.size - 1) * this.tileKm) / 2,
      cones: RegionTree[] = [],
      balls: RegionTree[] = [],
      hole = this.hole,
      p = this.land?.palette;
    for (const t of this.far) {
      if (hole) {
        const x = ((t.tile % this.size) + t.dx) * this.tileKm - half,
          z = (Math.floor(t.tile / this.size) + t.dz) * this.tileKm - half;
        if ((x - hole.x) ** 2 + (z - hole.z) ** 2 < hole.r * hole.r) continue;
      }
      (t.kind === "conifer" ? cones : balls).push(t);
    }
    // (Seen from near, past where each tree is drawn, a far crown is a grove's, not one tree the size of a grove.)
    const near = hole ? FAR_NEAR : 1;
    const colorOf = (k: (typeof FAR_KINDS)[number]): Rgb =>
      k.kind === "parched" ? PARCHED : p ? formColor(p, k.form) : lifeTint(k.color, this.look);
    const fill = (
      list: RegionTree[],
      b: InstancedBatch | null,
      mesh: pc.Mesh,
    ): InstancedBatch | null => {
      if (!list.length) {
        b?.set(0, () => {});
        return b;
      }
      if (!b || b.capacity < list.length) {
        b?.destroy();
        b = new InstancedBatch(
          this.stage,
          mesh,
          [1, 1, 1],
          Math.max(64, Math.ceil(this.far.length * 1.05)),
          this.root,
          undefined,
          true,
        );
      }
      b.set(list.length, (i, out) => {
        const t = list[i]!,
          k = FAR_KINDS.find((x) => x.kind === t.kind) ?? FAR_KINDS[1]!,
          x = t.tile % this.size,
          z = Math.floor(t.tile / this.size),
          w = k.w * t.size * this.tileKm * near,
          hh = k.h * t.size * this.tileKm * near,
          c = colorOf(k),
          tone = 0.86 + 0.28 * (t.tone ?? 0.5);
        out[0] = (x + t.dx) * this.tileKm - half;
        out[1] = Math.max(0, h[t.tile]!) + hh / 2;
        out[2] = (z + t.dz) * this.tileKm - half;
        out[3] = out[5] = w;
        out[4] = hh;
        out[6] = t.dx * 6;
        out[8] = c[0] * tone;
        out[9] = c[1] * tone;
        out[10] = c[2] * tone;
      });
      return b;
    };
    this.farCones = fill(cones, this.farCones, this.cone);
    this.farBalls = fill(balls, this.farBalls, this.ball);
    this.dress();
  }

  /**
   * Each frame: where the eye looks and how far it is. The near things laid again where it has gone a third of their reach,
   * come down or gone up past it, or the ground was laid anew; hidden when it is far.
   */
  update(camera: pc.Entity, distance: number): void {
    const land = this.land;
    if (!land || !this.heights) return;
    if (distance > NEAR_ON) {
      this.job = null;
      if (this.laidAt) {
        this.laidAt = null;
        this.nearShown = null;
        for (const b of Object.values(this.near)) b?.set(0, () => {});
      }
      if (this.hole) {
        this.hole = null;
        this.drawFar();
      }
      return;
    }
    this.at.copy(camera.getPosition());
    this.fwd.copy(camera.forward).mulScalar(distance);
    const x = this.at.x + this.fwd.x,
      z = this.at.z + this.fwd.z,
      most = Math.min(NEAR_MOST, Math.max(2.5, distance * 1.8)),
      was = this.job?.at ?? this.laidAt;
    if (
      !was ||
      was.ground !== this.ground ||
      Math.hypot(x - was.x, z - was.z) >= was.r / 3 ||
      Math.abs(most - was.most) >= was.most / 3
    ) {
      // A new laying, begun now and carried on a few milliseconds a frame (what stands stays till it is done).
      const budget = this.budgetFor(this.stage.quality.regionTrees),
        reach = nearReach(land, x, z, budget.trees, most);
      this.job = {
        at: { x, z, r: reach, most, ground: this.ground },
        steps: nearFloraSteps(land, x, z, reach, budget, this.free, this.bare, this.parched),
        spent: 0,
      };
    }
    const job = this.job;
    if (!job) return;
    const t0 = performance.now();
    for (;;) {
      const r = job.steps.next();
      if (r.done) {
        this.job = null;
        this.laidAt = job.at;
        this.lay(r.value, job.at);
        break;
      }
      if (performance.now() - t0 > LAY_SLICE) break;
    }
    job.spent += performance.now() - t0;
    this.layMs = job.spent;
  }

  /** What a laying gave, put in the batches; the far crowns where it stands left out. */
  private lay(near: NearFlora, at: { x: number; z: number; r: number }): void {
    this.nearShown = near;
    this.show("trunks", near.trunks, this.trunk, false);
    this.show("cones", near.cones, this.cone, false);
    this.show("balls", near.balls, this.ball, false);
    this.show("tufts", near.tufts, this.tuft, false);
    this.show("stones", near.stones, this.stone, false);
    this.showPatches(near.patches);
    this.hole = { x: at.x, z: at.z, r: at.r * 0.92 };
    this.drawFar();
  }

  /** A laying under way: where it is for, its steps, and the time spent on it (ms). */
  private job: {
    at: { x: number; z: number; r: number; most: number; ground: number };
    steps: Generator<void, NearFlora>;
    spent: number;
  } | null = null;

  /** The near budget for a setting's far crowns, kept while the setting is (none made each frame). */
  private budget: { of: number; is: ReturnType<typeof nearBudget> } | null = null;
  private budgetFor(regionTrees: number): ReturnType<typeof nearBudget> {
    if (this.budget?.of !== regionTrees)
      this.budget = { of: regionTrees, is: nearBudget(regionTrees) };
    return this.budget.is;
  }

  private batchFor(key: keyof FloraLayer["near"], mesh: pc.Mesh, n: number): InstancedBatch {
    let b = this.near[key];
    if (!b || b.capacity < n) {
      b?.destroy();
      b = new InstancedBatch(
        this.stage,
        mesh,
        [1, 1, 1],
        Math.max(64, Math.ceil(n * 1.4)),
        this.root,
        undefined,
        true,
      );
      // (Tufts and patches cast no shadow: too small, and flat.)
      // (Only the crowns cast shadows: tufts, stones, trunks and patches are too small or flat to, and cost a pass.)
      if (key !== "cones" && key !== "balls") b.shadows(false);
      this.near[key] = b;
    }
    return b;
  }

  private show(
    key: "trunks" | "cones" | "balls" | "tufts" | "stones",
    list: readonly NearThing[],
    mesh: pc.Mesh,
    _flat: boolean,
  ): void {
    const b = this.batchFor(key, mesh, list.length);
    b.set(list.length, (i, out) => {
      const t = list[i]!;
      out[0] = t.x;
      out[1] = t.y + t.h / 2;
      out[2] = t.z;
      out[3] = out[5] = t.w;
      out[4] = t.h;
      out[6] = t.yaw;
      out[8] = t.r;
      out[9] = t.g;
      out[10] = t.b;
    });
  }

  private showPatches(list: NearFlora["patches"]): void {
    const b = this.batchFor("patches", this.patch, list.length);
    // (A patch lies on its facet: its up the facet's, a hair over it.)
    b.setBasis(list.length, (i, out) => {
      const t = list[i]!;
      out[0] = t.x + t.nx * 0.004;
      out[1] = t.y + t.ny * 0.004;
      out[2] = t.z + t.nz * 0.004;
      out[3] = t.w;
      out[4] = 0.002;
      out[5] = t.h;
      out[6] = t.nx;
      out[7] = t.ny;
      out[8] = t.nz;
      out[9] = Math.cos(t.yaw);
      out[10] = 0;
      out[11] = Math.sin(t.yaw);
    });
    // (setBasis carries no tone: the patches' colours ride in their matrices' spare row, as set() writes them.)
    this.tonePatches(b, list);
  }

  /** The patches' own colours, written where a toned batch reads them (each matrix's fourth row). */
  private tonePatches(b: InstancedBatch, list: NearFlora["patches"]): void {
    b.tone(list.length, (i) => [list[i]!.r, list[i]!.g, list[i]!.b]);
  }

  /** The season on what grows (null: none told): the broad leaves turned or fallen, snow on them and on the ground. */
  season(s: GroundSeason | null): void {
    this.seasonNow = s;
    this.dress();
  }

  private dress(): void {
    const s = this.seasonNow,
      leaf = this.factor("broadleaf", s, false),
      needle = this.factor("conifer", s, true),
      snow = s?.snow ?? 0;
    this.farCones?.recolor(needle);
    this.farBalls?.recolor(leaf);
    this.near.cones?.recolor(needle);
    this.near.balls?.recolor(leaf);
    this.near.tufts?.recolor(leaf);
    for (const b of [this.near.cones, this.farCones]) b?.toneSnow(snow * 0.5);
    for (const b of [this.near.balls, this.farBalls]) b?.toneSnow(snow * 0.45);
    for (const b of [this.near.tufts, this.near.patches, this.near.stones])
      b?.toneSnow(snow * 0.85);
  }

  /** What the season makes of a form's colour, as a share of it each way (the instances' own tones kept under it). */
  private factor(form: "broadleaf" | "conifer", s: GroundSeason | null, needles: boolean): Rgb {
    if (!s) return [1, 1, 1];
    const base = this.land
        ? formColor(this.land.palette, form)
        : form === "conifer"
          ? FAR_KINDS[0]!.color
          : FAR_KINDS[1]!.color,
      bare = { ...s, snow: 0 },
      c = needles ? seasonNeedle(base, bare) : seasonLeaf(base, bare);
    return [
      c[0] / Math.max(0.02, base[0]),
      c[1] / Math.max(0.02, base[1]),
      c[2] / Math.max(0.02, base[2]),
    ];
  }

  /** What is drawn (the look tools): far crowns, near trees and their parts, tufts, stones, patches, and the near reach. */
  info(): {
    far: number;
    farShown: number;
    near: number;
    trunks: number;
    crowns: number;
    tufts: number;
    stones: number;
    patches: number;
    reach: number;
    layMs: number;
  } {
    const n = this.nearShown;
    return {
      far: this.far.length,
      farShown: (this.farCones?.size ?? 0) + (this.farBalls?.size ?? 0),
      near: n?.trees ?? 0,
      trunks: n?.trunks.length ?? 0,
      crowns: (n?.cones.length ?? 0) + (n?.balls.length ?? 0),
      tufts: n?.tufts.length ?? 0,
      stones: n?.stones.length ?? 0,
      patches: n?.patches.length ?? 0,
      reach: this.hole ? this.hole.r / 0.92 : 0,
      layMs: +this.layMs.toFixed(1),
    };
  }

  /** Every near thing as last laid, where it stands (the claims' counter: none on what the land's ground holds). */
  nearThings(): { x: number; z: number; r: number }[] {
    const n = this.nearShown;
    if (!n) return [];
    const out: { x: number; z: number; r: number }[] = [];
    for (const l of [n.trunks, n.tufts, n.stones])
      for (const t of l) out.push({ x: t.x, z: t.z, r: t.w / 2 });
    for (const l of [n.cones, n.balls]) for (const t of l) out.push({ x: t.x, z: t.z, r: t.w / 2 });
    return out;
  }

  destroy(): void {
    this.farCones?.destroy();
    this.farBalls?.destroy();
    for (const b of Object.values(this.near)) b?.destroy();
  }
}
