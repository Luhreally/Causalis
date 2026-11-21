// What grows on a land, drawn (view/flora.ts says what and where): one forest, near and far. Each near thing (tree, tuft,
// stone, patch of ground) has its one place, kind, size, colour and rank, fixed on the land; about the point the eye looks
// at, all of a kind are drawn within its core, past it fewer (the same ones, by rank: as many on the screen however far),
// none past its reach. Where the trees end, the far clumps stand instead, each a stand of crowns of the same forms and
// colours. All of it is faded by degrees in the shader (stage.ts fadedMaterial) by where each thing stands, so nothing pops
// and nothing moves as the eye does; pieces of the land are laid (a few milliseconds a frame) only as finely as it needs.
// The season is laid over a batch as a whole (its leaves turned, fallen, snowed on), never per frame.
import * as pc from "playcanvas";
import {
  FORM_SIZE,
  NEAR_CHUNK,
  TRUNK,
  formColor,
  lifeTint,
  nearBudget,
  nearChunk,
  seasonLeaf,
  seasonNeedle,
  type FloraLand,
  type GroundSeason,
  type NearFlora,
  type NearKeep,
  type NearThing,
  type RegionTree,
} from "../view/index.ts";
import { InstancedBatch, coneMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { fadedMaterial, type Rgb, type Stage } from "./stage.ts";

/** Far clumps' kinds: the form whose trees they are, and their colour where no reading gives one. */
const FAR_KINDS: readonly {
  kind: RegionTree["kind"];
  color: Rgb;
  form: Parameters<typeof formColor>[1];
}[] = [
  { kind: "conifer", color: [0.06, 0.4, 0.22], form: "conifer" },
  { kind: "broadleaf", color: [0.16, 0.56, 0.18], form: "broadleaf" },
  { kind: "flat", color: [0.32, 0.5, 0.15], form: "flat" },
  { kind: "tall", color: [0.05, 0.38, 0.14], form: "tall" },
  { kind: "parched", color: [0.52, 0.37, 0.13], form: "broadleaf" },
  { kind: "palm", color: [0.2, 0.5, 0.2], form: "palm" },
  { kind: "scrub", color: [0.4, 0.46, 0.2], form: "scrub" },
  { kind: "dead", color: [0.4, 0.32, 0.24], form: "dead" },
];
const PARCHED: Rgb = [0.52, 0.37, 0.13];

/** How deep snow lies (0 … 1) before the grass under it is no longer drawn. */
export const SNOW_HIDES = 0.35;
/** How long a frame spends on laying pieces of the near things, at most (ms): the rest waits for the next frame. */
const LAY_SLICE = 4;
/** How close the eye comes before the near things are drawn at all (its distance, region units); from NEAR_FROM of it in, wholly. */
export const NEAR_ON = 18;
const NEAR_FROM = 0.7;
/** How far the eye may go before a piece of land is laid finer than it is then drawn (region units). */
const MARGIN = 0.4;
/** Trees a square unit of a thick wood holds near (the lattice's, in groves), for reckoning how many a core draws. */
const THICK = 115;
/** The thinnest share a piece is laid at short of none (its fewest: the lowest ranks). */
const LEAST = 1 / 256;

type Field = keyof NearKeep;
const FIELDS: readonly Field[] = ["trees", "tufts", "stones", "patches"];
/** Each kind's core, as a share of the trees' (render: the core within which all of a kind are drawn, from the eye), and its
 * reach about the ground under the eye (region units). */
const FIELD: Record<Field, { share: number; out: number }> = {
  trees: { share: 1, out: 9 },
  tufts: { share: 0.63, out: 2.6 },
  stones: { share: 2.3, out: 9 },
  patches: { share: 2.7, out: 9 },
};

/**
 * The trees' core for a budget of trees drawn and the eye's height over the ground: drawn by their distance from the eye as
 * keep = (core / d)^2, a thick wood about it shows about the budget (at the most `most`: the eye high, the land drawn
 * uniformly simpler, never by where on the screen).
 */
export function coreFor(trees: number, height: number, reach: number, most: number): number {
  const H = Math.max(0.05, height),
    far = reach * reach + H * H,
    count = (c: number) =>
      THICK *
      Math.PI *
      (c > H ? c * c - H * H + c * c * Math.log(far / (c * c)) : c * c * Math.log(far / (H * H)));
  let lo = 0.2,
    hi = most;
  if (count(hi) <= trees) return hi;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (count(mid) > trees) hi = mid;
    else lo = mid;
  }
  return lo;
}

const BATCH_FIELD = {
  trunks: "trees",
  cones: "trees",
  balls: "trees",
  tufts: "tufts",
  stones: "stones",
  patches: "patches",
} as const;
type NearKey = keyof typeof BATCH_FIELD;

/** A piece of land as laid: its number, at what share of each kind, and what that laid. */
type Piece = { ci: number; cj: number; keep: NearKeep; got: NearFlora };

/** A far clump's crowns about its middle (of its breadth): where each stands, and its height of the tallest's. */
const SPOTS: readonly [number, number, number][] = [
  ...[0.4, 2.0, 3.4, 4.9].map((a, k): [number, number, number] => [
    Math.cos(a) * (0.22 + 0.08 * (k % 2)),
    Math.sin(a) * (0.22 + 0.08 * (k % 2)),
    [1, 0.84, 0.92, 0.78][k]!,
  ]),
];
/** A clump's crown, of its breadth: as broad as one tree's crown near (FORM_SIZE) at the least. */
const SPOT_W = 0.27;
/** How much of a clump's square its crowns cover (seen from above). */
const SPOTS_COVER = (SPOTS.length * Math.PI * SPOT_W * SPOT_W) / 4;
/** How much of a wood the far clumps cover, seen from above, as much as its crowns do (the ground under them their shade). */
const FAR_FILL = 0.3;

/**
 * A far clump's mesh, a unit across and high about its middle: four crowns (needles: cones; broad: balls) or their trunks,
 * standing on its foot, each as a near tree's would be drawn in its shape.
 */
function clumpMesh(stage: Stage, part: "cone" | "ball" | "trunk"): pc.Mesh {
  const positions: number[] = [],
    indices: number[] = [];
  for (const [ox, oz, hs] of SPOTS) {
    const base = positions.length / 3,
      foot = -0.5,
      top = -0.5 + hs;
    if (part === "cone") {
      const n = 5,
        r = SPOT_W / 2;
      positions.push(ox, top, oz);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        positions.push(ox + Math.cos(a) * r, foot, oz + Math.sin(a) * r);
      }
      for (let k = 0; k < n; k++) indices.push(base, base + 1 + ((k + 1) % n), base + 1 + k);
    } else if (part === "ball") {
      const n = 5,
        r = SPOT_W / 2,
        mid = (foot + top) / 2,
        half = (top - foot) / 2;
      positions.push(ox, top, oz);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        positions.push(ox + Math.cos(a) * r, mid + half * 0.15, oz + Math.sin(a) * r);
      }
      positions.push(ox, foot, oz);
      for (let k = 0; k < n; k++) {
        const a = base + 1 + k,
          b = base + 1 + ((k + 1) % n);
        indices.push(base, b, a, base + n + 1, a, b);
      }
    } else {
      const n = 4,
        r = (SPOT_W * 0.12) / 2;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + 0.4;
        positions.push(ox + Math.cos(a) * r, foot, oz + Math.sin(a) * r);
        positions.push(ox + Math.cos(a) * r, top, oz + Math.sin(a) * r);
      }
      for (let k = 0; k < n; k++) {
        const a = base + k * 2,
          b = base + ((k + 1) % n) * 2;
        indices.push(a, a + 1, b + 1, a, b + 1, b);
      }
    }
  }
  const mesh = new pc.Mesh(stage.device);
  mesh.setPositions(positions);
  mesh.setNormals(pc.calculateNormals(positions, indices));
  mesh.setIndices(indices);
  mesh.update();
  return mesh;
}

/** A far clump's trees' size, of a near tree of their form's (by its own size). */
function farScale(t: RegionTree): number {
  return 0.75 + 0.5 * Math.max(0, Math.min(1, (t.size - 0.2) / 0.3));
}

/** 0 below a, 1 above b, eased between. */
function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * A land's growth drawn: far clumps in three batches (needles, broad crowns, trunks), near things in five (trunks, cones,
 * balls, tufts, stones) and patches of ground (one), each instance toned, all faded by where they stand.
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
  private readonly clump: Record<"cone" | "ball" | "trunk", pc.Mesh>;
  private farCones: InstancedBatch | null = null;
  private farBalls: InstancedBatch | null = null;
  private farTrunks: InstancedBatch | null = null;
  private near: Record<NearKey, InstancedBatch | null> = {
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
  /** The far clumps as last planted. */
  private far: readonly RegionTree[] = [];
  private size = 0;
  private tileKm = 1;
  private heights: Float32Array | null = null;
  private free: (x: number, z: number, r: number) => boolean = () => true;
  private bare: (tile: number) => boolean = () => false;
  private seasonNow: GroundSeason | null = null;
  /** The pieces laid, by their number; those to lay (nearest first); whether the batches wait on what was laid. */
  private readonly pieces = new Map<number, Piece>();
  private queue: { key: number; ci: number; cj: number; keep: NearKeep; d: number }[] = [];
  private dirty = false;
  private framesDirty = 0;
  /** Where the pieces were last asked for, and for which ground. */
  private askedAt: { x: number; y: number; z: number; core: number; ground: number } | null = null;
  private ground = 0;
  /** The trees' core now (from the eye's height and the setting), and the eye's height over the ground under it. */
  private core = 1;
  private eyeHeight = 1;
  /** How much the near things are drawn (by the eye's distance), and the point it looks at. */
  private nearOn = 0;
  /** How far the far clumps have given way to the near trees about the point looked at (eased), and when last told. */
  private farGives = 0;
  private toldAt = 0;
  private readonly eye = { x: 0, y: 0, z: 0 };
  /** This frame's laying (ms), for the budgets. */
  layMs = 0;
  private readonly at = new pc.Vec3();
  private readonly lists: Record<NearKey, NearThing[]> = {
    trunks: [],
    cones: [],
    balls: [],
    tufts: [],
    stones: [],
    patches: [],
  };

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
    this.clump = {
      cone: keptMesh(clumpMesh(stage, "cone")),
      ball: keptMesh(clumpMesh(stage, "ball")),
      trunk: keptMesh(clumpMesh(stage, "trunk")),
    };
  }

  /** A new land's ground: nothing on it yet. */
  reset(size: number, tileKm: number, heights: Float32Array): void {
    this.size = size;
    this.tileKm = tileKm;
    this.heights = heights;
    this.land = null;
    this.far = [];
    this.clearNear();
    for (const b of [this.farCones, this.farBalls, this.farTrunks]) b?.set(0, () => {});
  }

  private clearNear(): void {
    this.pieces.clear();
    this.queue = [];
    this.askedAt = null;
    this.dirty = false;
    for (const b of Object.values(this.near)) b?.set(0, () => {});
  }

  /** Its life's colours (Phase 57), where no reading carries the world's own. */
  lifeLook(look: string | undefined): void {
    this.look = look;
  }

  /** What grows on it as read (null: none read, the far clumps in their kinds' colours alone). */
  setLand(land: FloraLand | null, parched: boolean): void {
    if (land !== this.land || parched !== this.parched) this.clearNear();
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
    // (Every piece laid again as it is, nearest first; what stood stands till then.)
    this.ground++;
  }

  /** The far clumps: four crowns for each, on the ground where it stands, spread over as much of its tile as its woods cover. */
  plant(trees: readonly RegionTree[]): void {
    this.far = trees;
    this.drawFar();
  }

  get planted(): number {
    return this.far.length;
  }

  /** The land's height at a point (region units), on its facets as the ground is drawn; at sea, the sea's top. */
  private heightAt(x: number, z: number): number {
    const s = this.size,
      tk = this.tileKm,
      h = this.heights!,
      half = ((s - 1) * tk) / 2,
      fi = Math.max(0, Math.min(s - 1 - 1e-9, (x + half) / tk)),
      fj = Math.max(0, Math.min(s - 1 - 1e-9, (z + half) / tk)),
      i = Math.floor(fi),
      j = Math.floor(fj),
      u = fi - i,
      v = fj - j,
      a = h[j * s + i]!,
      b = h[j * s + i + 1]!,
      c = h[(j + 1) * s + i]!,
      d = h[(j + 1) * s + i + 1]!,
      y = u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
    return Math.max(0, y);
  }

  private drawFar(): void {
    const h = this.heights;
    if (!h) return;
    const half = ((this.size - 1) * this.tileKm) / 2,
      cones: RegionTree[] = [],
      balls: RegionTree[] = [],
      trunks: RegionTree[] = [],
      p = this.land?.palette;
    const kindOf = (t: RegionTree) => FAR_KINDS.find((x) => x.kind === t.kind) ?? FAR_KINDS[1]!;
    for (const t of this.far) {
      const f = FORM_SIZE[kindOf(t).form];
      if (f.crown === "cone") cones.push(t);
      else if (f.crown === "ball") balls.push(t);
      if (f.trunk > 0) trunks.push(t);
    }
    // (How many clumps stand on each tile, and how much of it its woods cover: the clumps of a thick wood spread over it.)
    const onTile = new Map<number, number>(),
      canopy = this.land?.read.canopy;
    for (const t of this.far) onTile.set(t.tile, (onTile.get(t.tile) ?? 0) + 1);
    const colorOf = (k: (typeof FAR_KINDS)[number]): Rgb =>
      k.kind === "parched" ? PARCHED : p ? formColor(p, k.form) : lifeTint(k.color, this.look);
    const fill = (
      list: RegionTree[],
      b: InstancedBatch | null,
      mesh: pc.Mesh,
      part: "crown" | "trunk",
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
          fadedMaterial(),
          true,
        );
        b.param("uNearK", [-1, 0, 0, 0]);
        if (part === "trunk") b.shadows(false);
      }
      b.set(list.length, (i, out) => {
        const t = list[i]!,
          k = kindOf(t),
          f = FORM_SIZE[k.form],
          // (Its trees as tall as a near tree of its form, by its own size; its crowns as broad as the stand they stand for, so a
          // wood far off reads as one, and as the eye comes near they give way to the trees of that stand, of the same height.)
          s = farScale(t),
          // (Spread over as much of its tile as its share of the tile's woods covers: a thick wood far off reads as one.)
          spread = canopy
            ? Math.sqrt(
                ((canopy[t.tile]! / 255) * this.tileKm * this.tileKm * FAR_FILL) /
                  (SPOTS_COVER * (onTile.get(t.tile) ?? 1)),
              )
            : t.size * this.tileKm * 0.6,
          w = Math.max((f.w * s) / SPOT_W, Math.min(spread, this.tileKm * 0.45)),
          trunk = f.trunk * s,
          ch = f.h * s * 1.25,
          x = ((t.tile % this.size) + t.dx) * this.tileKm - half,
          z = (Math.floor(t.tile / this.size) + t.dz) * this.tileKm - half,
          y = this.heightAt(x, z),
          tone = part === "trunk" ? 1 : 0.86 + 0.28 * (t.tone ?? 0.5),
          c = part === "trunk" ? (k.form === "dead" ? colorOf(k) : TRUNK) : colorOf(k);
        out[0] = x;
        out[2] = z;
        out[3] = out[5] = w;
        if (part === "trunk") {
          out[1] = y + trunk / 2;
          out[4] = trunk;
        } else {
          out[1] = (trunk > 0 ? y + trunk * 0.85 : y - ch * 0.25) + ch / 2;
          out[4] = ch;
        }
        out[6] = t.dx * 6;
        out[8] = c[0] * tone;
        out[9] = c[1] * tone;
        out[10] = c[2] * tone;
      });
      return b;
    };
    // (A clump's crowns shrink as they fade to their trees' foot, with their trunks.)
    const lift = (list: RegionTree[], b: InstancedBatch | null, crown: boolean) =>
      b?.rank(
        list.length,
        () => 0,
        (i) => (crown ? FORM_SIZE[kindOf(list[i]!).form].trunk * 0.85 * farScale(list[i]!) : 0),
      );
    this.farCones = fill(cones, this.farCones, this.clump.cone, "crown");
    this.farBalls = fill(balls, this.farBalls, this.clump.ball, "crown");
    this.farTrunks = fill(trunks, this.farTrunks, this.clump.trunk, "trunk");
    lift(cones, this.farCones, true);
    lift(balls, this.farBalls, true);
    this.dress();
  }

  /**
   * Each frame: where the eye is and how far from what it looks at. The pieces of land about it laid as finely as they need (a
   * few milliseconds a frame, nearest first, what stood standing till then); every batch told where the eye is (nothing else
   * moves: as in true perspective, what is farther from the eye is drawn simpler, so moving the eye along at one height
   * changes nothing on the ground but what comes onto the screen and goes off it).
   */
  update(camera: pc.Entity, distance: number): void {
    const land = this.land;
    this.layMs = 0;
    if (!land || !this.heights) return;
    this.nearOn = 1 - smooth(NEAR_ON * NEAR_FROM, NEAR_ON, distance);
    this.at.copy(camera.getPosition());
    this.eye.x = this.at.x;
    this.eye.y = this.at.y;
    this.eye.z = this.at.z;
    this.eyeHeight = Math.max(0.05, this.at.y - this.heightAt(this.at.x, this.at.z));
    const trees = nearBudget(this.stage.quality.regionTrees).trees;
    // (About three eighths of the setting's trees drawn at once, as many as the land close drew before: the pieces about the eye
    // are laid finer than drawn, so what comes in as it moves is there to fade in.)
    this.core = coreFor(
      trees * 0.375,
      this.eyeHeight,
      FIELD.trees.out,
      2.3 * Math.sqrt(trees / 3600),
    );
    if (distance > NEAR_ON * 1.15) {
      if (this.pieces.size || this.queue.length) this.clearNear();
    } else {
      const was = this.askedAt;
      if (
        !was ||
        was.ground !== this.ground ||
        Math.hypot(this.eye.x - was.x, this.eye.y - was.y, this.eye.z - was.z) > MARGIN / 4 ||
        this.core > was.core * 1.05 ||
        this.core < was.core / 1.3
      )
        this.ask(!!was && was.ground !== this.ground);
      this.layFor(land);
    }
    this.tell();
  }

  /** A kind's core and its reach from the eye, now. */
  private field(f: Field): { core: number; reach: number } {
    return {
      core: this.core * FIELD[f].share,
      reach: Math.hypot(FIELD[f].out, this.eyeHeight),
    };
  }

  /** What share of a kind a piece needs laid, its nearest edge `d` from the eye (0: none). */
  private need(f: Field, d: number): number {
    const { core, reach } = this.field(f),
      at = Math.max(0, d - MARGIN);
    if (at > reach) return 0;
    const want = Math.min(1, (1.3 * core * core) / Math.max(1e-6, at * at));
    return want >= 1 ? 1 : Math.max(LEAST, 2 ** Math.ceil(Math.log2(want)));
  }

  /**
   * The pieces about the eye, as they must now be laid: those laid too thinly, or not at all, or far more finely than they
   * need, asked for (`all`: every one, the ground laid anew); those past every reach let go.
   */
  private ask(all: boolean): void {
    const { x, y, z } = this.eye,
      // (A piece's ground may stand a little over the ground under the eye.)
      over = Math.max(0, this.eyeHeight - 0.3),
      reach = Math.max(...FIELDS.map((f) => FIELD[f].out)) + MARGIN + NEAR_CHUNK,
      c0 = Math.floor((x - reach) / NEAR_CHUNK),
      c1 = Math.floor((x + reach) / NEAR_CHUNK),
      d0 = Math.floor((z - reach) / NEAR_CHUNK),
      d1 = Math.floor((z + reach) / NEAR_CHUNK),
      queue: typeof this.queue = [],
      seen = new Set<number>();
    for (let cj = d0; cj <= d1; cj++)
      for (let ci = c0; ci <= c1; ci++) {
        const dx = Math.max(ci * NEAR_CHUNK - x, 0, x - (ci + 1) * NEAR_CHUNK),
          dz = Math.max(cj * NEAR_CHUNK - z, 0, z - (cj + 1) * NEAR_CHUNK),
          d = Math.hypot(dx, dz, over),
          key = (ci + 32768) * 65536 + (cj + 32768),
          keep: NearKeep = {
            trees: this.need("trees", d),
            tufts: this.need("tufts", d),
            stones: this.need("stones", d),
            patches: this.need("patches", d),
          },
          has = this.pieces.get(key);
        if (FIELDS.every((f) => keep[f] === 0)) continue;
        seen.add(key);
        if (has && !all) {
          // (Laid finely enough, and not more than twice as finely as it now needs: left as it is.)
          const fine = FIELDS.every((f) => has.keep[f] >= keep[f]),
            thick = FIELDS.some((f) => has.keep[f] > Math.max(keep[f], LEAST) * 2);
          if (fine && !thick) continue;
        }
        queue.push({ key, ci, cj, keep, d });
      }
    for (const key of this.pieces.keys())
      if (!seen.has(key)) {
        this.pieces.delete(key);
        this.dirty = true;
      }
    queue.sort((a, b) => a.d - b.d);
    this.queue = queue;
    this.askedAt = { x, y, z, core: this.core, ground: this.ground };
  }

  /** A few milliseconds of the pieces asked for, laid; the batches made again when the laying is done (or every few frames). */
  private layFor(land: FloraLand): void {
    const t0 = performance.now();
    let n = 0;
    while (n < this.queue.length) {
      const q = this.queue[n++]!;
      this.pieces.set(q.key, {
        ci: q.ci,
        cj: q.cj,
        keep: q.keep,
        got: nearChunk(land, q.ci, q.cj, q.keep, this.free, this.bare, this.parched),
      });
      this.dirty = true;
      if (performance.now() - t0 > LAY_SLICE) break;
    }
    if (n) this.queue = this.queue.slice(n);
    if (this.dirty && (!this.queue.length || ++this.framesDirty >= 4)) this.fill();
    this.layMs = performance.now() - t0;
  }

  /** The near batches made from every piece laid. */
  private fill(): void {
    this.dirty = false;
    this.framesDirty = 0;
    const L = this.lists;
    for (const k of Object.keys(L) as NearKey[]) L[k].length = 0;
    for (const p of this.pieces.values()) {
      const g = p.got;
      for (const t of g.trunks) L.trunks.push(t);
      for (const t of g.cones) L.cones.push(t);
      for (const t of g.balls) L.balls.push(t);
      for (const t of g.tufts) L.tufts.push(t);
      for (const t of g.stones) L.stones.push(t);
      for (const t of g.patches) L.patches.push(t);
    }
    this.show("trunks", L.trunks, this.trunk);
    this.show("cones", L.cones, this.cone);
    this.show("balls", L.balls, this.ball);
    this.show("tufts", L.tufts, this.tuft);
    this.show("stones", L.stones, this.stone);
    this.showPatches(L.patches as NearFlora["patches"]);
    this.dress();
  }

  /** Every batch told where the eye is, how near it is to what it looks at, and its kind's core and reach. */
  private tell(): void {
    const { x, y, z } = this.eye,
      on = this.nearOn;
    for (const k of Object.keys(this.near) as NearKey[]) {
      const b = this.near[k];
      if (!b) continue;
      const f = this.field(BATCH_FIELD[k]);
      b.param("uNear", [x, y, z, f.core]);
      b.param("uNearK", [1, on, f.reach, 0]);
    }
    // (Where the eye looks the far clumps give way to the trees: eased, and not before most of the pieces about it are laid, so
    // an eye set down somewhere new sees the clumps till the trees stand.)
    const trees = this.field("trees"),
      now = performance.now(),
      dt = Math.min(0.1, Math.max(0, (now - this.toldAt) / 1000)),
      want = this.pieces.size && this.queue.length < 24 ? on : 0;
    this.toldAt = now;
    this.farGives += (want - this.farGives) * Math.min(1, dt * 8);
    if (Math.abs(want - this.farGives) < 0.002) this.farGives = want;
    for (const b of [this.farCones, this.farBalls, this.farTrunks]) {
      b?.param("uNear", [x, y, z, trees.core]);
      b?.param("uNearK", [-1, this.farGives, trees.reach, 0]);
    }
  }

  private batchFor(key: NearKey, mesh: pc.Mesh, n: number): InstancedBatch {
    let b = this.near[key];
    if (!b || b.capacity < n) {
      b?.destroy();
      b = new InstancedBatch(
        this.stage,
        mesh,
        [1, 1, 1],
        Math.max(64, Math.ceil(n * 1.4)),
        this.root,
        fadedMaterial(),
        true,
      );
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
    // (A crown shrinks as it fades to its tree's foot, not its own: with its trunk, the tree whole.)
    b.rank(
      list.length,
      (i) => list[i]!.u ?? 0,
      (i) => list[i]!.lift ?? 0,
    );
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
    b.tone(list.length, (i) => [list[i]!.r, list[i]!.g, list[i]!.b]);
    b.rank(list.length, (i) => list[i]!.u ?? 0);
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
    // (Seen in a winter on a boreal land: needles stay dark under their snow, as a wood in snow reads; a broad crown with its
    // leaves fallen is twigs, grey and light, not a dark ball; grass is under the snow.)
    const twigs = s ? (1 - s.leaf) * 0.3 : 0;
    for (const b of [this.near.cones, this.farCones]) b?.toneSnow(snow * 0.35);
    for (const b of [this.near.balls, this.farBalls]) b?.toneSnow(Math.min(1, snow * 0.45 + twigs));
    // (Grass under the snow: drawn whitened, its little cones read dark in their own shade, so not drawn once it lies.)
    this.near.tufts?.toneSnow(Math.min(1, snow * 1.6));
    this.near.tufts?.drawn(snow < SNOW_HIDES);
    for (const b of [this.near.patches, this.near.stones]) b?.toneSnow(snow * 0.85);
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

  /** What is drawn (the look tools): far clumps, near trees and their parts, tufts, stones, patches as laid, the trees' reach. */
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
    pieces: number;
    waiting: number;
  } {
    let trees = 0,
      trunks = 0,
      crowns = 0,
      tufts = 0,
      stones = 0,
      patches = 0;
    for (const p of this.pieces.values()) {
      trees += p.got.trees;
      trunks += p.got.trunks.length;
      crowns += p.got.cones.length + p.got.balls.length;
      tufts += p.got.tufts.length;
      stones += p.got.stones.length;
      patches += p.got.patches.length;
    }
    return {
      far: this.far.length,
      farShown: (this.farCones?.size ?? 0) + (this.farBalls?.size ?? 0),
      near: trees,
      trunks,
      crowns,
      tufts,
      stones,
      patches,
      reach: this.pieces.size ? FIELD.trees.out : 0,
      layMs: +this.layMs.toFixed(1),
      pieces: this.pieces.size,
      waiting: this.queue.length,
    };
  }

  /** Every near thing as laid, where it stands (the claims' counter: none on what the land's ground holds). */
  nearThings(): { x: number; z: number; r: number }[] {
    const out: { x: number; z: number; r: number }[] = [];
    for (const p of this.pieces.values()) {
      const n = p.got;
      for (const l of [n.trunks, n.tufts, n.stones, n.cones, n.balls])
        for (const t of l) out.push({ x: t.x, z: t.z, r: t.w / 2 });
    }
    return out;
  }

  /**
   * Every near thing as laid and how much of it is drawn now, as the shader reckons it (the look tools: the same thing in the
   * same place each time, and what comes and goes between two frames).
   */
  nearLaid(): {
    kind: string;
    x: number;
    z: number;
    y: number;
    w: number;
    h: number;
    drawn: number;
  }[] {
    const out: {
      kind: string;
      x: number;
      z: number;
      y: number;
      w: number;
      h: number;
      drawn: number;
    }[] = [];
    for (const p of this.pieces.values())
      for (const k of ["trunks", "cones", "balls", "tufts", "stones", "patches"] as const) {
        const f = this.field(BATCH_FIELD[k]);
        for (const t of p.got[k]) {
          // (From the instance's middle, as the shader reckons it: a patch lies flat, the rest stand on their foot.)
          const cy = k === "patches" ? t.y : t.y + t.h / 2,
            d = Math.hypot(t.x - this.eye.x, cy - this.eye.y, t.z - this.eye.z),
            keep = Math.min(1, (f.core * f.core) / Math.max(d * d, 1e-6)),
            u = t.u ?? 0,
            drawn =
              Math.max(0, Math.min(1, (keep - u) / (0.2 * keep + 1e-4))) *
              (1 - smooth(f.reach * 0.8, f.reach, d)) *
              this.nearOn;
          out.push({ kind: k, x: t.x, z: t.z, y: t.y, w: t.w, h: t.h, drawn });
        }
      }
    return out;
  }

  /** Where the eye is, its height over the ground, the trees' core, and how much the near things are drawn (the look tools). */
  nearFocus(): { x: number; z: number; y: number; height: number; core: number; on: number } {
    return {
      x: this.eye.x,
      z: this.eye.z,
      y: this.eye.y,
      height: this.eyeHeight,
      core: this.core,
      on: this.nearOn,
    };
  }

  destroy(): void {
    this.farCones?.destroy();
    this.farBalls?.destroy();
    this.farTrunks?.destroy();
    for (const b of Object.values(this.near)) b?.destroy();
  }
}
