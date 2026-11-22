// What grows about a town, drawn in its own view (view/townflora.ts says what and where): its ground one mesh, coloured point
// by point from its land's reading (the tiles' colours blended, greener by its water, trodden about its streets), and its
// trees, tufts and stones in five toned batches. Built once a plan; the season and a dry year laid over it as its
// other ground is (its vertex colours made again, its batches' leaves turned), never per frame.
import * as pc from "playcanvas";
import { FLORA_NAMES, wetGround, type VillagePlan } from "../bridge/index.ts";
import {
  FAIR_YEAR,
  formColor,
  grassTint,
  seasonGround,
  seasonLeaf,
  seasonNeedle,
  townBudget,
  townCanopyAt,
  townEdge,
  townFloraSteps,
  townGroundAt,
  townGroundOf,
  townHeld,
  townRiseAt,
  townWaterAt,
  TOWN_CORE,
  clearAt,
  villageGround,
  type GroundSeason,
  type NearThing,
  type TownFlora,
} from "../view/index.ts";
import { InstancedBatch, coneMesh, keptMesh, sidesMesh } from "./batch.ts";
import { SNOW_HIDES } from "./flora.ts";
import type { Rgb, Stage } from "./stage.ts";

/** Units a metre, as the town's view draws (render/village.ts M). */
const M = 0.1;
/** How long a frame spends laying what grows about a town, at most (ms). */
const LAY_SLICE = 4;
/** The ground mesh's rings and spokes; its rings past its own ground, and how far they reach (units: past the eye's far clip). */
const RINGS = 30,
  SPOKES = 72,
  OUTER = 14,
  FAR = 1400;
/**
 * What grows about a town drawn in pieces of at most PIECE things each, the ground halved and halved again across its
 * longer side: each piece its own batch bound to where its things stand, so that those out of the eye's sight (or the
 * shadows' reach) are not drawn at all.
 */
export const PIECE = 360;

/** Things cut into pieces of at most PIECE, each a compact patch of the ground (halved across its longer side, at its middle thing). */
export function floraPieces(list: readonly NearThing[]): NearThing[][] {
  if (list.length <= PIECE) return list.length ? [list.slice()] : [];
  let x0 = Infinity,
    x1 = -Infinity,
    z0 = Infinity,
    z1 = -Infinity;
  for (const t of list) {
    x0 = Math.min(x0, t.x);
    x1 = Math.max(x1, t.x);
    z0 = Math.min(z0, t.z);
    z1 = Math.max(z1, t.z);
  }
  const along = x1 - x0 >= z1 - z0 ? "x" : "z",
    sorted = list.slice().sort((a, b) => a[along] - b[along]),
    half = sorted.length >> 1;
  return [...floraPieces(sorted.slice(0, half)), ...floraPieces(sorted.slice(half))];
}

export class TownFloraLayer {
  readonly root = new pc.Entity("town-flora");
  private readonly stage: Stage;
  private readonly cone: pc.Mesh;
  private readonly ball: pc.Mesh;
  private readonly trunk: pc.Mesh;
  private readonly tuft: pc.Mesh;
  private readonly stone: pc.Mesh;
  private ground: pc.Entity | null = null;
  private groundMesh: pc.Mesh | null = null;
  /** Each vertex's own colour, and the colours as last painted. */
  private base: Float32Array | null = null;
  private open: Float32Array | null = null;
  /** Its vertices on open water: no season nor dry year on them. */
  private still: Uint8Array | null = null;
  private painted: Uint8Array | null = null;
  /** Its ground's facets in all, and those of its own (out to its radius, before its rings to the far clip). */
  private allOf = 0;
  private ownOf = 0;
  private onlyOwn = false;

  /**
   * Its ground drawn out to its own edge alone, where its land is drawn past it (render/farland.ts), or out to the far clip as
   * its land's heights and colours read about it (not one drawn over the other).
   */
  ownOnly(on: boolean): void {
    this.onlyOwn = on;
    const p = this.groundMesh?.primitive[0];
    if (!p) return;
    const count = on ? this.ownOf : this.allOf;
    if (p.count !== count) p.count = count;
  }
  /** Each kind's batches, a piece of the ground each (the middle, then the wedges). */
  private batches: Record<"trunks" | "cones" | "balls" | "tufts" | "stones", InstancedBatch[]> = {
    trunks: [],
    cones: [],
    balls: [],
    tufts: [],
    stones: [],
  };
  private leafBase: Rgb = [0.2, 0.5, 0.2];
  private needleBase: Rgb = [0.1, 0.4, 0.2];
  private shown: TownFlora | null = null;
  private plan: VillagePlan | null = null;
  /** What the last laying was laid by (floraKey). */
  private key = "";
  /** The last building's time (ms): its ground, and the frames' share of laying what grows on it. */
  buildMs = 0;
  layMs = 0;
  /** A laying under way (carried a few milliseconds a frame), the time spent on it, and its setting's budget. */
  private job: { steps: Generator<void, TownFlora>; spent: number } | null = null;
  /** The season and the dry year last told, laid again over what a laying puts in new batches. */
  private told: { s: GroundSeason | null; dry: number } = { s: null, dry: 0 };

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    parent.addChild(this.root);
    this.cone = keptMesh(coneMesh(stage, 0.5, 1, 6));
    this.ball = keptMesh(
      pc.Mesh.fromGeometry(
        stage.device,
        new pc.SphereGeometry({ radius: 0.5, latitudeBands: 3, longitudeBands: 6 }),
      ),
    );
    // (A trunk's ends are in its crown and the ground, a tuft's foot in the ground: their sides alone.)
    this.trunk = keptMesh(sidesMesh(stage, 0.5, 0.5, 1, 5));
    this.tuft = keptMesh(sidesMesh(stage, 0.5, 0, 1, 4));
    this.stone = keptMesh(
      pc.Mesh.fromGeometry(
        stage.device,
        new pc.SphereGeometry({ radius: 0.5, latitudeBands: 2, longitudeBands: 5 }),
      ),
    );
  }

  /**
   * A town's ground and what grows on it (`radius`: how far its ground is drawn, units; `share`: the setting's share of
   * trees). Whether it drew any: a plan with no reading draws none, and its plain ground stays.
   */
  build(plan: VillagePlan, radius: number, share: number): boolean {
    const t0 = performance.now();
    // (A town's plan is read again and again as its clock runs: what grows about it is laid again only when what it is
    // laid by has changed: its ground's reading, its edge, its fields, pasture, road and water, the setting.)
    const edge = townEdge(plan),
      key = floraKey(plan, edge, radius, share);
    if (key === this.key && this.ground) {
      this.plan = plan;
      this.buildMs = performance.now() - t0;
      return true;
    }
    this.clear();
    this.key = key;
    this.plan = plan;
    const g = townGroundOf(plan);
    if (!g) {
      this.job = null;
      this.shown = null;
      for (const list of Object.values(this.batches)) for (const b of list) b.set(0, () => {});
      return false;
    }
    // The ground: rings closer near the middle, where the eye is; and past its own, its land's ground out to where no eye
    // sees, its heights rising as its land's do (no edge to the world at any zoom the eye may take).
    const rings = RINGS + 1 + OUTER,
      n = rings * SPOKES + 1,
      flat = radius / M,
      positions = new Float32Array(n * 3),
      base = new Float32Array(n * 3),
      open = new Float32Array(n),
      water = new Uint8Array(n),
      put = (k: number, x: number, z: number) => {
        positions[k * 3] = x;
        positions[k * 3 + 1] = townRiseAt(g, x / M, z / M, flat) * M;
        positions[k * 3 + 2] = z;
        const c = townGroundAt(g, plan, x / M, z / M, edge);
        base[k * 3] = c[0];
        base[k * 3 + 1] = c[1];
        base[k * 3 + 2] = c[2];
        water[k] = townWaterAt(g, x / M, z / M) ? 1 : 0;
        // (A dry year browns the grass, not the woods' shade nor the water: how much of the ground lies open.)
        open[k] = water[k] ? 0 : 1 - 0.92 * townCanopyAt(g, x / M, z / M);
      };
    put(0, 0, 0);
    for (let r = 1; r <= rings; r++) {
      const rr =
        r <= RINGS + 1
          ? radius * Math.pow((r - 1 + 0.35) / (RINGS + 0.35), 1.7)
          : radius * Math.pow(FAR / radius, (r - RINGS - 1) / OUTER);
      for (let a = 0; a < SPOKES; a++) {
        const an = (a / SPOKES) * Math.PI * 2 + (r % 2) * (Math.PI / SPOKES);
        put(1 + (r - 1) * SPOKES + a, rr * Math.cos(an), rr * Math.sin(an));
      }
    }
    const indices: number[] = [];
    for (let a = 0; a < SPOKES; a++) indices.push(0, 1 + ((a + 1) % SPOKES), 1 + a);
    for (let r = 0; r < rings - 1; r++)
      for (let a = 0; a < SPOKES; a++) {
        const i0 = 1 + r * SPOKES + a,
          i1 = 1 + r * SPOKES + ((a + 1) % SPOKES),
          j0 = 1 + (r + 1) * SPOKES + a,
          j1 = 1 + (r + 1) * SPOKES + ((a + 1) % SPOKES);
        indices.push(i0, i1, j0, i1, j1, j0);
      }
    const normals = pc.calculateNormals([...positions], indices);
    const mesh = new pc.Mesh(this.stage.device);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    this.painted = new Uint8Array(n * 4).fill(255);
    mesh.setColors32(this.painted);
    mesh.setIndices(indices);
    mesh.update();
    const m = new pc.StandardMaterial();
    m.diffuseVertexColor = true;
    m.specular = new pc.Color(0.04, 0.04, 0.04);
    m.gloss = 0.1;
    // (Under all else that lies on the ground, as its plain ground was: set back in depth.)
    m.depthBias = 3;
    m.slopeDepthBias = 3;
    m.update();
    const e = new pc.Entity("town-ground");
    e.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, m)] });
    e.render!.castShadows = false;
    e.setLocalPosition(0, 0.004, 0);
    this.root.addChild(e);
    this.ground = e;
    this.groundMesh = mesh;
    this.allOf = indices.length;
    this.ownOf = SPOKES * 3 + RINGS * SPOKES * 6;
    this.ownOnly(this.onlyOwn);
    this.base = base;
    this.open = open;
    this.still = water;
    this.paint(this.told.s, this.told.dry);
    this.leafBase = formColor(g.palette, "broadleaf");
    this.needleBase = formColor(g.palette, "conifer");
    // What stands on it: laid over the next frames (what stood before stands till then), a few milliseconds each.
    this.job = {
      steps: townFloraSteps(g, plan, (radius / M) * 0.98, townBudget(share), edge),
      spent: 0,
    };
    this.buildMs = performance.now() - t0;
    this.update();
    return true;
  }

  /** Each frame: a laying under way carried on, LAY_SLICE ms at most; once done, what it laid shown. */
  update(): void {
    const job = this.job;
    if (!job) return;
    const t0 = performance.now();
    for (;;) {
      const r = job.steps.next();
      if (r.done) {
        this.job = null;
        const f = r.value;
        this.shown = f;
        this.show("trunks", f.trunks, this.trunk);
        this.show("cones", f.cones, this.cone);
        this.show("balls", f.balls, this.ball);
        this.show("tufts", f.tufts, this.tuft);
        this.show("stones", f.stones, this.stone);
        // (A batch made anew for more has none of the season on it.)
        this.season(this.told.s, this.told.dry);
        break;
      }
      if (performance.now() - t0 > LAY_SLICE) break;
    }
    job.spent += performance.now() - t0;
    this.layMs = job.spent;
  }

  /** Whether a laying is under way. */
  get laying(): boolean {
    return !!this.job;
  }

  private show(
    key: keyof TownFloraLayer["batches"],
    list: readonly NearThing[],
    mesh: pc.Mesh,
  ): void {
    const batches = this.batches[key],
      cut = floraPieces(list);
    // (Batches past the pieces this laying has, let go.)
    for (const b of batches.splice(cut.length)) b.destroy();
    cut.forEach((piece, k) => {
      let b = batches[k];
      if (!b || b.capacity < piece.length) {
        b?.destroy();
        b = new InstancedBatch(
          this.stage,
          mesh,
          [1, 1, 1],
          Math.max(64, Math.ceil(piece.length * 1.3)),
          this.root,
          undefined,
          true,
        );
        // (Only the crowns cast shadows, as on the land: a trunk's, a tuft's and a stone's are too small to see, and cost a pass.)
        if (key !== "cones" && key !== "balls") b.shadows(false);
        batches[k] = b;
      }
      const lo = [Infinity, Infinity, Infinity],
        hi = [-Infinity, -Infinity, -Infinity];
      b.set(piece.length, (i, out) => {
        const t = piece[i]!;
        out[0] = t.x * M;
        out[1] = (t.y + t.h / 2) * M;
        out[2] = t.z * M;
        out[3] = out[5] = t.w * M;
        out[4] = t.h * M;
        out[6] = t.yaw;
        out[8] = t.r;
        out[9] = t.g;
        out[10] = t.b;
        lo[0] = Math.min(lo[0]!, (t.x - t.w) * M);
        lo[1] = Math.min(lo[1]!, t.y * M);
        lo[2] = Math.min(lo[2]!, (t.z - t.w) * M);
        hi[0] = Math.max(hi[0]!, (t.x + t.w) * M);
        hi[1] = Math.max(hi[1]!, (t.y + t.h) * M);
        hi[2] = Math.max(hi[2]!, (t.z + t.w) * M);
      });
      // (Bound to where its things stand, in the layer's own units: out of the eye's sight, not drawn.)
      b.bound(lo, hi);
    });
  }

  /** The ground's own colour at a point (metres from the square), as last built (null: none built). */
  colourAt(x: number, z: number): Rgb | null {
    const plan = this.plan,
      g = plan && this.ground ? townGroundOf(plan) : null;
    return g && plan ? townGroundAt(g, plan, x, z, townEdge(plan)) : null;
  }

  /** The season and the year in the fields (how dry, 0 … 1) on its ground and what grows on it. */
  season(s: GroundSeason | null, dry: number): void {
    this.told = { s, dry };
    this.paint(s, dry);
    const ratio = (base: Rgb, c: Rgb): Rgb => [
      c[0] / Math.max(0.02, base[0]),
      c[1] / Math.max(0.02, base[1]),
      c[2] / Math.max(0.02, base[2]),
    ];
    const bare = s ? { ...s, snow: 0 } : null,
      leaf = bare ? ratio(this.leafBase, seasonLeaf(this.leafBase, bare)) : ([1, 1, 1] as Rgb),
      needle = bare
        ? ratio(this.needleBase, seasonNeedle(this.needleBase, bare))
        : ([1, 1, 1] as Rgb),
      snow = s?.snow ?? 0;
    const each = (key: keyof TownFloraLayer["batches"], f: (b: InstancedBatch) => void) =>
      this.batches[key].forEach(f);
    each("balls", (b) => b.recolor(leaf));
    each("cones", (b) => b.recolor(needle));
    // (As on the land, render/flora.ts: needles dark under snow, bare crowns twigs, grass under the snow.)
    each("balls", (b) => b.toneSnow(Math.min(1, snow * 0.45 + (s ? (1 - s.leaf) * 0.3 : 0))));
    each("cones", (b) => b.toneSnow(snow * 0.35));
    each("tufts", (b) => b.toneSnow(Math.min(1, snow * 1.6)));
    each("tufts", (b) => b.drawn(snow < SNOW_HIDES));
    each("stones", (b) => b.toneSnow(snow * 0.7));
  }

  private paint(s: GroundSeason | null, dry: number): void {
    const base = this.base,
      out = this.painted,
      mesh = this.groundMesh;
    if (!base || !out || !mesh) return;
    const year = { ...FAIR_YEAR, dry };
    for (let k = 0; k * 3 < base.length; k++) {
      let c: Rgb = [base[k * 3]!, base[k * 3 + 1]!, base[k * 3 + 2]!];
      if (dry > 0) {
        const d = grassTint(c, year),
          o = this.open?.[k] ?? 1;
        c = [c[0] + (d[0] - c[0]) * o, c[1] + (d[1] - c[1]) * o, c[2] + (d[2] - c[2]) * o];
      }
      if (s && !this.still?.[k]) c = seasonGround(c, s);
      out[k * 4] = Math.max(0, Math.min(255, Math.round(c[0] * 255)));
      out[k * 4 + 1] = Math.max(0, Math.min(255, Math.round(c[1] * 255)));
      out[k * 4 + 2] = Math.max(0, Math.min(255, Math.round(c[2] * 255)));
    }
    mesh.setColors32(out);
    mesh.update();
  }

  /** What it draws (the look tools): trees, tufts, stones, and whether its ground is its land's. */
  info(): {
    cover: string;
    ground: boolean;
    trees: number;
    tufts: number;
    stones: number;
    buildMs: number;
    layMs: number;
    laying: boolean;
  } {
    const f = this.shown;
    const w = this.plan?.landFlora,
      mid = w ? (w.half * (2 * w.half + 1) + w.half) * 5 : -1;
    return {
      cover: w ? `${FLORA_NAMES[w.tiles[mid]!] ?? "water"} canopy ${w.tiles[mid + 1]}` : "",
      ground: !!this.ground,
      trees: f?.trees ?? 0,
      tufts: f?.tufts.length ?? 0,
      stones: f?.stones.length ?? 0,
      buildMs: +this.buildMs.toFixed(1),
      layMs: +this.layMs.toFixed(1),
      laying: !!this.job,
    };
  }

  /** Every thing as last laid (metres from the square), for the look tools' count of what stands where it may not. */
  things(): { x: number; z: number; r: number }[] {
    const f = this.shown;
    if (!f) return [];
    return [...f.trunks, ...f.balls, ...f.cones, ...f.tufts, ...f.stones].map((t) => ({
      x: t.x,
      z: t.z,
      r: t.w / 2,
    }));
  }

  /**
   * How many things stand where they may not, by what holds the ground (the look tools; must be none): a field, the pasture,
   * the water, the town's built ground (its middle, its homes and blocks), its road out, what else it keeps on its open ground (townHeld). Read exactly (no margin), apart from how they were laid.
   */
  onTaken(): Record<string, number> {
    const plan = this.plan,
      out: Record<string, number> = { field: 0, pasture: 0, water: 0, town: 0, road: 0, held: 0 };
    if (!plan) return out;
    const edge = townEdge(plan),
      ground = villageGround(plan),
      held = townHeld(plan),
      len = Math.hypot(plan.road.x, plan.road.z) || 1,
      rx = plan.road.x / len,
      rz = plan.road.z / len;
    for (const t of this.things()) {
      const { x, z } = t;
      if (
        plan.fields.some((f) => {
          const c = Math.cos(f.yaw),
            s = Math.sin(f.yaw),
            u = (x - f.x) * c - (z - f.z) * s,
            v = (x - f.x) * s + (z - f.z) * c;
          return Math.abs(u) < f.w / 2 && Math.abs(v) < f.d / 2;
        })
      )
        out.field!++;
      if (Math.hypot(x - plan.pasture.x, z - plan.pasture.z) < plan.pasture.r) out.pasture!++;
      if (wetGround(plan.landWater, x, z)) out.water!++;
      if (Math.hypot(x, z) < Math.min(edge, TOWN_CORE) || !clearAt(ground, t, 0.01)) out.town!++;
      if (held.some((h) => Math.hypot(x - h.x, z - h.z) < h.r)) out.held!++;
      const along = x * rx + z * rz;
      if (Math.abs(-x * rz + z * rx) < 4 && (plan.districts || along > 0) && along < len)
        out.road!++;
    }
    return out;
  }

  private clear(): void {
    this.key = "";
    this.ground?.destroy();
    this.groundMesh?.destroy();
    this.ground = null;
    this.groundMesh = null;
    this.base = null;
    this.painted = null;
  }

  destroy(): void {
    this.clear();
    this.job = null;
    this.shown = null;
    for (const list of Object.values(this.batches)) for (const b of list) b.destroy();
    this.root.destroy();
  }
}

/** What a town's growth is laid by, as a key: its ground's reading, edge, fields, pasture, road, water, and the setting. */
function floraKey(plan: VillagePlan, edge: number, radius: number, share: number): string {
  const w = plan.landFlora;
  let sum = 0;
  if (w) for (let k = 0; k < w.tiles.length; k++) sum = (sum * 31 + w.tiles[k]!) % 1000000007;
  for (const f of plan.fields)
    sum = (sum * 31 + Math.round(f.x * 7 + f.z * 13 + f.w + f.d + f.yaw * 100)) % 1000000007;
  return `${plan.ref}|${sum}|${plan.fields.length}|${Math.round(edge)}|${plan.pasture.x},${plan.pasture.z},${plan.pasture.r}|${plan.road.x},${plan.road.z}|${plan.water ? `${plan.water.x},${plan.water.z}` : ""}|${plan.landWater?.wet?.cells.length ?? 0}|${!!plan.districts}|${radius}|${share}|${plan.kind}|${plan.lifeLook ?? ""}`;
}
