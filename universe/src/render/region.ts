// A region as terrain: the tile grid as one heightmap mesh (1 unit = 1 km),
// coloured per tile by the lens, under a translucent sea at height zero, with a
// marker on the picked tile. The look (art track A4): low-poly facets, each triangle
// flat and coloured by the most of its three tiles, under a glossy sea. Its towns
// drawn from their fabric, their fields and roads (Phase 25 M150), the woods cleared
// from them; a town not yet built (no fabric) a knot of huts.
import * as pc from "playcanvas";
import type { LandPlan } from "../bridge/index.ts";
import {
  facetWet,
  REGION_RELIEF,
  kindWater,
  seasonKey,
  runToEnd,
  treesClear,
  type FloraLand,
  type GroundSeason,
  type LandGround,
  type RegionTree,
} from "../view/index.ts";
import { LandLayer } from "./land.ts";
import { FloraLayer } from "./flora.ts";
import { WildfireLayer, wildfireMaterials } from "./wildfire.ts";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh, gableMesh } from "./batch.ts";
import { flatMaterial, grainTexture, groundMaterial, type Rgb, type Stage } from "./stage.ts";
import { windowMaterial } from "./village.ts";

/**
 * How a land's ground lies, tile by tile, read off its heights and waters alone (no light: the sun moves, this does not), worked
 * out once a land: `shade`, how much of the sky a dry tile sees (a hollow or a valley's floor darker, a ridge or a crest lighter,
 * a steep face a little darker), a factor about 1; `depth`, how deep a wet tile reads (0 at the shore … 1 far out): the sea by how
 * far below its sheet its bed lies and how far it is from any shore, a lake by how far from its shores, a river shallow.
 */
export function groundRelief(
  size: number,
  tileKm: number,
  heights: Float32Array,
  water: Uint8Array,
): Relief {
  const n = size * size,
    shade = new Float32Array(n).fill(1),
    depth = new Float32Array(n),
    rock = new Float32Array(n),
    far = new Int32Array(n).fill(-1),
    queue = new Int32Array(n);
  let head = 0,
    tail = 0;
  // (How far each wet tile is from the nearest dry one, in steps of a tile either way or across: a walk out from every shore.)
  for (let t = 0; t < n; t++)
    if (!water[t]) {
      far[t] = 0;
      queue[tail++] = t;
    }
  while (head < tail) {
    const t = queue[head++]!,
      i = t % size,
      j = (t - i) / size;
    for (const [di, dj] of STEPS) {
      const x = i + di,
        y = j + dj;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const u = y * size + x;
      if (far[u]! >= 0) continue;
      far[u] = far[t]! + 1;
      queue[tail++] = u;
    }
  }
  const h = (i: number, j: number) =>
    heights[Math.min(size - 1, Math.max(0, j)) * size + Math.min(size - 1, Math.max(0, i))]!;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const t = j * size + i,
        w = water[t]!;
      if (w) {
        // (A land with no shore at all reads as open water.)
        const d = far[t]! < 0 ? 8 : far[t]!;
        // (The sea's bed is drawn no deeper than its sheet's 60 metres below, view/region.ts regionHeights, so all of it
        // as deep: how far out it lies is its depth as seen.)
        depth[t] =
          w === 1
            ? clamp01((d - 0.5) / 5)
            : w === 3
              ? 0.85 * clamp01((d - 0.5) / 3)
              : 0.45 * clamp01((d - 1) / 3);
        continue;
      }
      // (How far it stands below its neighbours' mean, and how steep: in the scene's units, its relief as drawn.)
      const here = heights[t]!,
        mean =
          (h(i - 1, j - 1) +
            h(i, j - 1) +
            h(i + 1, j - 1) +
            h(i - 1, j) +
            h(i + 1, j) +
            h(i - 1, j + 1) +
            h(i, j + 1) +
            h(i + 1, j + 1)) /
          8,
        hollow = mean - here,
        slope = Math.hypot(h(i + 1, j) - h(i - 1, j), h(i, j + 1) - h(i, j - 1)) / (2 * tileKm);
      shade[t] =
        (1 - SKY_HOLLOW * Math.tanh(hollow / SKY_DEPTH)) *
        (1 - SKY_STEEP * Math.min(1, slope / 1.5));
      // (A face as steep as it stands drawn holds no snow nor soil: its rock shows.)
      // (As steep as drawn, and high: a mountain's face, not a low hill's, whose slope as drawn is the same.)
      const r = clamp01((slope - ROCK_FROM) / (ROCK_TO - ROCK_FROM)),
        up = clamp01((here - ROCK_LOW) / (ROCK_HIGH - ROCK_LOW));
      rock[t] = r * r * (3 - 2 * r) * up;
    }
  // (Scree: what a face sheds lies at its foot, a dry tile below a neighbour whose rock shows, as much as its rock, less its own.)
  const scree = new Float32Array(n);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const t = j * size + i;
      if (water[t] || rock[t]! >= 1) continue;
      let foot = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const x = i + di,
            y = j + dj;
          if ((!di && !dj) || x < 0 || y < 0 || x >= size || y >= size) continue;
          const u = y * size + x;
          if (heights[u]! > heights[t]! + SCREE_BELOW) foot = Math.max(foot, rock[u]!);
        }
      scree[t] = SCREE_MOST * foot * (1 - rock[t]!);
    }
  return { shade, depth, rock, scree };
}

/** How a land's ground lies (groundRelief). */
export type Relief = {
  readonly shade: Float32Array;
  readonly depth: Float32Array;
  readonly rock: Float32Array;
  readonly scree: Float32Array;
};

/**
 * How a land's ground takes the light at each tile's corner of its facets: `normal`, the ground's smooth bend there (x, y, z a
 * tile, off its neighbours' heights), and `facet`, how much a mountain's it is (0 … 1), by how much its heights rise and fall
 * about it (BEND_FROM … BEND_TO, scene units): rolling ground lit as it rolls, not facet by facet, a mountain by its facets.
 */
export function groundBend(
  size: number,
  tileKm: number,
  heights: Float32Array,
): { normal: Float32Array; facet: Float32Array } {
  const n = size * size,
    normal = new Float32Array(n * 3),
    facet = new Float32Array(n),
    h = (i: number, j: number) =>
      heights[Math.min(size - 1, Math.max(0, j)) * size + Math.min(size - 1, Math.max(0, i))]!;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const t = j * size + i,
        dx = (h(i + 1, j) - h(i - 1, j)) / (2 * tileKm),
        dz = (h(i, j + 1) - h(i, j - 1)) / (2 * tileKm),
        l = Math.hypot(dx, 1, dz);
      normal[3 * t] = -dx / l;
      normal[3 * t + 1] = 1 / l;
      normal[3 * t + 2] = -dz / l;
      let lo = Infinity,
        hi = -Infinity;
      for (let dj = -BEND_REACH; dj <= BEND_REACH; dj++)
        for (let di = -BEND_REACH; di <= BEND_REACH; di++) {
          const v = h(i + di, j + dj);
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      const f = clamp01((hi - lo - BEND_FROM) / (BEND_TO - BEND_FROM));
      facet[t] = f * f * (3 - 2 * f);
    }
  return { normal, facet };
}
/** How far about a tile (tiles) its rise and fall is read, and how much of it (scene units) is rolling ground's at most, and a
 * mountain's at least. */
const BEND_REACH = 2,
  BEND_FROM = 4,
  BEND_TO = 8;

/** How steep (rise over run, as drawn) a face begins to show its rock, and shows it whole. */
const ROCK_FROM = 0.45,
  ROCK_TO = 1.3;
/** How high (scene units: 9 to a km, view/region.ts REGION_RELIEF) a face begins to show its rock, and shows it whole. */
const ROCK_LOW = 4,
  ROCK_HIGH = 10;

/** The rock itself is drawn facet by facet by the ground's shader (stage.ts groundMaterial, the same steepness and height); its
 * scree here: how far below the face's tile (scene units) a tile lies at its foot, how much of it at most, and its colour, a pale
 * stony grey with a little of the tile's own (0 … 255; not over snow, which lies on it). */
const SCREE_BELOW = 0.5,
  SCREE_MOST = 0.7;
const SCREE: Rgb = [132, 127, 118],
  SCREE_OWN = 0.2;

/** The eight ways from a tile to its neighbours: a wet tile's corner on dry ground is at the shore, as its sides are (a facet
 * of the ground that touches dry ground touches it at no more than a tile's step, so the sea's sheet never comes in across one). */
const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;
/** How much darker a hollow (lighter a crest) reads at most, and how deep a hollow is for most of that (scene units); and a
 * steep face's darkening at most. */
const SKY_HOLLOW = 0.22,
  SKY_DEPTH = 0.7,
  SKY_STEEP = 0.1;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** A sand a shallow's bed shows through it. */
const BED: Rgb = [0.77, 0.71, 0.52];
/** Scratch texels for groundTexels' lie of the ground, kept between paints (two: the land's and its crowns'). */
const SCRATCH: Uint8ClampedArray[] = [];
function scratch(k: number, length: number): Uint8ClampedArray {
  let a = SCRATCH[k];
  if (!a || a.length !== length) SCRATCH[k] = a = new Uint8ClampedArray(length);
  return a;
}
/** A shallow's light, a little greener. */
const SHOAL: Rgb = [0, 0.06, 0.02];

/**
 * A wet tile's colour by how deep it reads (0 … 1, groundRelief): its shallows lighter, their bed showing through, its deeps
 * darker; ice (a pale water) as it is.
 */
export function waterAtDepth(c: Rgb, depth: number): Rgb {
  const out: [number, number, number] = [0, 0, 0];
  waterInto(c[0], c[1], c[2], depth, out, 0, 1);
  return out;
}

/** waterAtDepth's colour (0 … 1 each way in) written into `out` from `at`, scaled by `scale` (255: a texel's). */
function waterInto(
  r: number,
  g: number,
  b: number,
  depth: number,
  out: { [k: number]: number },
  at: number,
  scale: number,
): void {
  const ice = Math.min(1, Math.max(0, (Math.min(r, g, b) - 0.45) / 0.3));
  for (let k = 0; k < 3; k++) {
    const c = k === 0 ? r : k === 1 ? g : b,
      shallow = c + (BED[k]! - c) * 0.15 + SHOAL[k]!,
      deep = c * 0.55,
      v =
        depth < 0.3
          ? shallow + (c - shallow) * (depth / 0.3)
          : c + (deep - c) * ((depth - 0.3) / 0.7),
      w = c + (v - c) * (1 - ice);
    out[at + k] = scale === 1 ? w : Math.round(Math.min(1, w) * scale);
  }
}

/**
 * A land's tiles as its ground's shader reads them (a texel a tile; stage.ts groundMaterial): `land` the land's colours and its
 * woods' cover (alpha 255 less it, as given), `water` the water's colours and how wet (alpha 255 on water, 0 on land). Each
 * carried a texel past its own tiles (the mean of its neighbours of its kind), so that, blended between the four texels about
 * a point, land is blended only with land and water only with water. `crowns` the colour of its woods' crowns seen from above
 * (`canopy`, a tile's; none given, its ground's darkened), carried over the water as the land is.
 */
export function groundTexels(
  colors: Uint8Array,
  wet: Uint8Array,
  size: number,
  land: Uint8Array,
  water: Uint8Array,
  canopy: Uint8Array | null = null,
  crowns: Uint8Array | null = null,
  relief: Relief | null = null,
): void {
  const n = size * size,
    dim = canopy ? 1 : 0.7;
  let src: Uint8Array | Uint8ClampedArray = colors,
    top: Uint8Array | Uint8ClampedArray = canopy ?? colors;
  // (The lie of the ground on its colours first: a dry tile as much of the sky as it sees, a wet one its depth. Clamped and
  // rounded as written.)
  if (relief) {
    const lit = scratch(0, colors.length),
      litTop = canopy ? scratch(1, canopy.length) : lit;
    lit.set(colors);
    if (canopy) litTop.set(canopy);
    const { shade, scree, depth } = relief;
    for (let t = 0; t < n; t++) {
      const q = 4 * t;
      if (wet[t] !== 0) {
        waterInto(
          colors[q]! / 255,
          colors[q + 1]! / 255,
          colors[q + 2]! / 255,
          depth[t]!,
          lit,
          q,
          255,
        );
        continue;
      }
      const k = shade[t]!,
        // (No scree seen where snow lies.)
        r =
          scree[t]! *
          (1 - clamp01((Math.min(colors[q]!, colors[q + 1]!, colors[q + 2]!) - 160) / 50));
      if (r > 0) {
        // (Its crowns the same: scree over them as over the ground, so the ground the shader takes out from under them stays
        // the ground's, stage.ts groundMaterial.)
        for (let c = 0; c < 3; c++) {
          const face = (1 - SCREE_OWN) * SCREE[c]! + SCREE_OWN * colors[q + c]!;
          lit[q + c] = (colors[q + c]! + (face - colors[q + c]!) * r) * k;
          if (canopy) litTop[q + c] = (canopy[q + c]! + (face - canopy[q + c]!) * r) * k;
        }
      } else
        for (let c = 0; c < 3; c++) {
          lit[q + c] = colors[q + c]! * k;
          if (canopy) litTop[q + c] = canopy[q + c]! * k;
        }
    }
    src = lit;
    top = litTop;
  }
  for (let t = 0; t < n; t++) {
    const w = wet[t] !== 0;
    for (let c = 0; c < 3; c++) {
      land[4 * t + c] = src[4 * t + c]!;
      water[4 * t + c] = src[4 * t + c]!;
      if (crowns) crowns[4 * t + c] = Math.round(top[4 * t + c]! * dim);
    }
    // (Over the water, how deep it reads: the sea's sheet comes in by it, nothing where the shore is; over the sea alone, the one under it.)
    if (crowns) crowns[4 * t + 3] = wet[t] === 1 && relief ? Math.round(255 * relief.depth[t]!) : 0;
    land[4 * t + 3] = w ? 255 : src[4 * t + 3]!;
    water[4 * t + 3] = w ? 255 : 0;
  }
  // (A tile of the other kind takes its neighbours' of this kind: the shore's colours, either side.)
  const sum = new Float64Array(4),
    over = new Float64Array(3);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const t = j * size + i,
        w = wet[t] !== 0;
      sum[0] = sum[1] = sum[2] = sum[3] = 0;
      over[0] = over[1] = over[2] = 0;
      let k = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const x = i + di,
            y = j + dj;
          if ((di === 0 && dj === 0) || x < 0 || y < 0 || x >= size || y >= size) continue;
          const u = y * size + x;
          if ((wet[u] !== 0) === w) continue;
          for (let c = 0; c < 4; c++) sum[c] = sum[c]! + src[4 * u + c]!;
          for (let c = 0; c < 3; c++) over[c] = over[c]! + top[4 * u + c]!;
          k++;
        }
      if (!k) continue;
      const to = w ? land : water;
      for (let c = 0; c < 3; c++) to[4 * t + c] = Math.round(sum[c]! / k);
      // (A wood's cover and its crowns carried over the water with its colour.)
      if (w) {
        land[4 * t + 3] = Math.round(sum[3]! / k);
        if (crowns)
          for (let c = 0; c < 3; c++) crowns[4 * t + c] = Math.round((over[c]! / k) * dim);
      }
    }
}

/** How long a frame lays on at a land's plan being laid over frames (ms): the rest of a phone's frame is the drawing's. */
const LAY_BUDGET = 4;

export class RegionScene {
  private readonly stage: Stage;
  private readonly root = new pc.Entity("region");
  private mesh: pc.Mesh | null = null;
  /** For each drawn corner, the tile it colours by; and the corners' colours. */
  private corners: Int32Array | null = null;
  private colors: Uint8Array | null = null;
  /** The land as it is, a texel a tile, read by the ground's own shader (stage.ts groundMaterial): the land's colours and its
   * woods' cover (alpha 255 less it), carried a texel over the water; the water's, and how wet (alpha), a texel over the land. */
  private landTex: pc.Texture | null = null;
  private waterTex: pc.Texture | null = null;
  /** Its woods' crowns seen from above, a texel a tile. */
  private crownTex: pc.Texture | null = null;
  private grain: pc.Texture | null = null;
  private groundLook: pc.StandardMaterial | null = null;
  private size = 0;
  private tileKm = 1;
  private heights: Float32Array | null = null;
  private readonly marker: pc.Entity;
  private huts: InstancedBatch | null = null;
  /** What grows on it: its woods far off, each tree, tuft and stone near the eye (render/flora.ts). */
  readonly flora: FloraLayer;
  private readonly floraRoot = new pc.Entity("flora");
  /** The ground the flora was last told of (a new one for each laying of the land), and the fire's woods as then. */
  private floraFree: ((x: number, z: number, r: number) => boolean) | undefined | null = null;
  private floraFire = "";
  /** The season it was last dressed in (Phase 30 M164). */
  private seasonSeen = "";
  private villageTiles: number[] = [];
  /** The land's ground as its towns, roads and fields read it; and what is drawn on it. */
  private ground: LandGround | null = null;
  /** How its ground lies (groundRelief), worked out once a land. */
  private lie: Relief | null = null;
  readonly land: LandLayer;
  /** What burns on it, and its scars (N1). */
  readonly fire: WildfireLayer;
  /** The clock's pace when last drawn: how a fire's own clock is read at a plan's coming. */
  private firePace = 0;
  /** Every tree of the woods, and the clearings made in them for the towns (by their key). */
  private trees: readonly RegionTree[] = [];
  /** The sheet of its sea. */
  private seaSheet: pc.Entity | null = null;
  /** The colour of the sea a land is built with: its world's kind's (Phase 56). */
  private seaColour: Rgb = SEA;
  private cleared = "";
  key: string | null = null;

  constructor(stage: Stage) {
    this.stage = stage;
    stage.root.addChild(this.root);
    this.marker = new pc.Entity("tile-marker");
    this.marker.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(cylinderMesh(stage, 0.5, 6, 12), flatMaterial([1, 1, 1], 0.8)),
      ],
    });
    this.marker.enabled = false;
    this.root.addChild(this.marker);
    this.land = new LandLayer(stage, this.root);
    this.root.addChild(this.floraRoot);
    this.flora = new FloraLayer(stage, this.floraRoot);
    // (Under the land's own root: a new land's building leaves it standing, and resets it.)
    this.fire = new WildfireLayer(stage, this.land.root);
    this.root.enabled = false;
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  build(
    key: string,
    size: number,
    tileKm: number,
    heights: Float32Array,
    water: Uint8Array = new Uint8Array(size * size),
    fertility: Uint8Array = new Uint8Array(size * size).fill(128),
  ): void {
    // (Batches first: their instance buffers go with them.)
    this.huts?.destroy();
    for (const child of [...this.root.children])
      if (child !== this.marker && child !== this.land.root && child !== this.floraRoot)
        child.destroy();
    this.huts = null;
    this.villageTiles = [];
    this.trees = [];
    this.cleared = "";
    this.ground = { size, tileKm, heights, water, fertility };
    const lie = (this.lie = groundRelief(size, tileKm, heights, water));
    this.land.reset(this.ground);
    this.fire.reset(this.ground);
    this.flora.reset(size, tileKm, heights);
    this.floraFree = null;
    this.floraFire = "";
    const n = size * size,
      positions = new Float32Array(n * 3),
      half = ((size - 1) * tileKm) / 2;
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        const t = j * size + i;
        positions[t * 3] = i * tileKm - half;
        // (The sea's floor drawn below its sheet, the deeper the farther out, so the sheet is never cut by a bed at or above it
        // where it shows: where it comes in by how deep the water reads, nothing else draws it a line. Its heights as they are
        // for all else, heightAt.)
        positions[t * 3 + 1] =
          water[t] === 1
            ? Math.min(heights[t]!, -SEA_FLOOR - SEA_FLOOR_DEEP * lie.depth[t]!)
            : heights[t]!;
        positions[t * 3 + 2] = j * tileKm - half;
      }
    const indices = new Uint32Array((size - 1) * (size - 1) * 6);
    let k = 0;
    for (let j = 0; j < size - 1; j++)
      for (let i = 0; i < size - 1; i++) {
        const a = j * size + i,
          b = a + 1,
          c = a + size,
          d = c + 1;
        indices[k++] = a;
        indices[k++] = c;
        indices[k++] = b;
        indices[k++] = b;
        indices[k++] = c;
        indices[k++] = d;
      }
    // Every triangle its own corners, lit by its own face: facets, not a blur. A facet whose three tiles are not all
    // water or all land is cut into each tile's own share of it (to the middles of its sides and its own middle), each
    // share coloured as its tile is: water is drawn where a tile is water and only as far as that tile goes, so a lone
    // lake tile is a small lake and a river a band as broad as its tiles (view/land.ts facetWet reads the same shares).
    const base = indices.length / 3,
      wetTile = (v: number) => water[v]! !== 0;
    let tris = 0;
    for (let t = 0; t < base; t++) {
      const w = wetTile(indices[3 * t]!),
        mixed = wetTile(indices[3 * t + 1]!) !== w || wetTile(indices[3 * t + 2]!) !== w;
      tris += mixed ? 6 : 1;
    }
    const corners = new Int32Array(tris * 3),
      at = new Float32Array(tris * 9),
      normals = new Float32Array(tris * 9),
      order = new Uint32Array(tris * 3),
      P = new Float64Array(21),
      // (Each corner's light: the ground's smooth bend there and how much a mountain's it is, groundBend; its sides' and own
      // middles' the means of theirs.)
      bend = groundBend(size, tileKm, heights),
      B = new Float64Array(21),
      M = new Float64Array(7);
    let n3 = 0;
    const emit = (
      owner: readonly [number, number, number],
      a: number,
      b: number,
      c: number,
      nx: number,
      ny: number,
      nz: number,
    ) => {
      const o = 9 * n3;
      for (let q = 0; q < 3; q++) {
        const e = q === 0 ? a : q === 1 ? b : c,
          from = e * 3,
          f = M[e]!,
          x = B[from]! + (nx - B[from]!) * f,
          y = B[from + 1]! + (ny - B[from + 1]!) * f,
          z = B[from + 2]! + (nz - B[from + 2]!) * f,
          l = Math.hypot(x, y, z) || 1;
        at[o + 3 * q] = P[from]!;
        at[o + 3 * q + 1] = P[from + 1]!;
        at[o + 3 * q + 2] = P[from + 2]!;
        normals[o + 3 * q] = x / l;
        normals[o + 3 * q + 1] = y / l;
        normals[o + 3 * q + 2] = z / l;
        corners[3 * n3 + q] = owner[q]!;
        order[3 * n3 + q] = 3 * n3 + q;
      }
      n3++;
    };
    for (let t = 0; t < base; t++) {
      const v0 = indices[3 * t]!,
        v1 = indices[3 * t + 1]!,
        v2 = indices[3 * t + 2]!;
      // (Its corners 0 … 2, the middles of its sides 3 (0–1), 4 (1–2), 5 (2–0), its own middle 6.)
      for (let q = 0; q < 3; q++) {
        const v = q === 0 ? v0 : q === 1 ? v1 : v2;
        P[3 * q] = positions[3 * v]!;
        P[3 * q + 1] = positions[3 * v + 1]!;
        P[3 * q + 2] = positions[3 * v + 2]!;
        B[3 * q] = bend.normal[3 * v]!;
        B[3 * q + 1] = bend.normal[3 * v + 1]!;
        B[3 * q + 2] = bend.normal[3 * v + 2]!;
        M[q] = bend.facet[v]!;
      }
      for (let d = 0; d < 3; d++) {
        P[9 + d] = (P[d]! + P[3 + d]!) / 2;
        P[12 + d] = (P[3 + d]! + P[6 + d]!) / 2;
        P[15 + d] = (P[6 + d]! + P[d]!) / 2;
        P[18 + d] = (P[d]! + P[3 + d]! + P[6 + d]!) / 3;
        B[9 + d] = (B[d]! + B[3 + d]!) / 2;
        B[12 + d] = (B[3 + d]! + B[6 + d]!) / 2;
        B[15 + d] = (B[6 + d]! + B[d]!) / 2;
        B[18 + d] = (B[d]! + B[3 + d]! + B[6 + d]!) / 3;
      }
      M[3] = (M[0]! + M[1]!) / 2;
      M[4] = (M[1]! + M[2]!) / 2;
      M[5] = (M[2]! + M[0]!) / 2;
      M[6] = (M[0]! + M[1]! + M[2]!) / 3;
      const ux = P[3]! - P[0]!,
        uy = P[4]! - P[1]!,
        uz = P[5]! - P[2]!,
        vx = P[6]! - P[0]!,
        vy = P[7]! - P[1]!,
        vz = P[8]! - P[2]!;
      let nx = uy * vz - uz * vy,
        ny = uz * vx - ux * vz,
        nz = ux * vy - uy * vx;
      // Up, whichever way the triangle winds.
      if (ny < 0) [nx, ny, nz] = [-nx, -ny, -nz];
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const w = wetTile(v0);
      if (wetTile(v1) === w && wetTile(v2) === w) {
        emit([v0, v1, v2], 0, 1, 2, nx, ny, nz);
        continue;
      }
      emit([v0, v0, v0], 0, 3, 6, nx, ny, nz);
      emit([v0, v0, v0], 0, 6, 5, nx, ny, nz);
      emit([v1, v1, v1], 1, 4, 6, nx, ny, nz);
      emit([v1, v1, v1], 1, 6, 3, nx, ny, nz);
      emit([v2, v2, v2], 2, 5, 6, nx, ny, nz);
      emit([v2, v2, v2], 2, 6, 4, nx, ny, nz);
    }
    const mesh = new pc.Mesh(this.stage.device);
    mesh.setPositions(at);
    mesh.setNormals(normals);
    this.colors = new Uint8Array(tris * 12).fill(128);
    mesh.setColors32(this.colors);
    mesh.setIndices(order);
    mesh.update();
    this.corners = corners;
    // Matte facets, as the globe's; the land as it is blended tile into tile on them (stage.ts groundMaterial).
    this.landTex?.destroy();
    this.waterTex?.destroy();
    this.crownTex?.destroy();
    const tileTexture = () =>
      new pc.Texture(this.stage.device, {
        width: size,
        height: size,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      });
    this.landTex = tileTexture();
    this.waterTex = tileTexture();
    this.crownTex = tileTexture();
    this.grain ??= grainTexture(this.stage);
    const material = groundMaterial(this.landTex, this.waterTex, this.crownTex, this.grain);
    this.groundLook = material;
    const terrain = new pc.Entity("terrain");
    terrain.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material)] });
    this.root.addChild(terrain);
    const sea = new pc.Entity("sea");
    sea.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(
          cylinderMesh(this.stage, half * 1.42, 0.02, 48),
          seaMaterial(this.seaColour, this.crownTex),
        ),
      ],
    });
    sea.setLocalPosition(0, 0, 0);
    this.root.addChild(sea);
    this.seaSheet = sea;
    this.mesh = mesh;
    this.size = size;
    this.tileKm = tileKm;
    this.heights = heights;
    this.key = key;
  }

  /** A people of the water's land: its sea thinner, to show their towns and a lens's colours under it. */
  clearSea(clear: boolean): void {
    if (!this.seaSheet) return;
    const m = this.seaSheet.render!.meshInstances[0]!.material as pc.StandardMaterial,
      opacity = clear ? CLEAR_SEA : SEA_OPACITY;
    if (m.opacity === opacity) return;
    m.opacity = opacity;
    m.update();
  }

  /** Its world's kind (Phase 56): a land's sea is its liquid's, from the next land built. */
  kind(kind: string): void {
    this.seaColour = kindWater(kind)?.sea ?? SEA;
  }

  /** Its world's life's colours (Phase 57): its woods' leaves, from the next woods planted. */
  lifeLook(look: string | undefined): void {
    this.flora.lifeLook(look);
  }

  /** The land's ground as its roads read it (null: none built), for the ways its hosts go by (M203). */
  get landGround(): LandGround | null {
    return this.ground;
  }

  /**
   * Recolour the terrain (RGBA per tile): each facet the colour most of its three tiles have. (A facet with water and land
   * in it was cut into each tile's share when the mesh was made, and each share's three corners are its one tile.) `blend`
   * (the land as it is, its alpha 255 less its woods' cover): the tiles blended into each other on the ground, land with
   * land and water with water, the shore wavering between, no tile a flat polygon with hard straight sides (stage.ts
   * groundMaterial); a map's lens keeps its facets, and its borders.
   */
  paint(colors: Uint8Array, blend = false, canopy: Uint8Array | null = null): void {
    if (!this.mesh || !this.corners || !this.colors) return;
    const look = this.groundLook,
      g = this.ground;
    if (look && this.landTex && this.waterTex && this.crownTex && g) {
      if (blend) {
        const land = this.landTex.lock() as Uint8Array,
          water = this.waterTex.lock() as Uint8Array,
          crowns = this.crownTex.lock() as Uint8Array;
        groundTexels(colors, g.water, g.size, land, water, canopy, crowns, this.lie);
        this.landTex.unlock();
        this.waterTex.unlock();
        this.crownTex.unlock();
      }
      const map = [((g.size - 1) * g.tileKm) / 2, g.tileKm, g.size, blend ? 1 : 0];
      look.setParameter("uTileMap", map);
      look.setParameter("uTileMapLie", map);
      this.seaSheet?.render!.meshInstances[0]!.material.setParameter("uTileMap", map);
      // (The land as it is read off its textures alone: its facets' colours wait for a map's lens.)
      if (blend) return;
    }
    const tiles = new Uint32Array(colors.buffer, colors.byteOffset, colors.length >> 2),
      out = new Uint32Array(this.colors.buffer),
      k = this.corners;
    for (let t = 0; t < k.length; t += 3) {
      const a = tiles[k[t]!]!,
        b = tiles[k[t + 1]!]!,
        c = tiles[k[t + 2]!]!,
        face = a === b || a === c ? a : b === c ? b : a;
      out[t] = out[t + 1] = out[t + 2] = face;
    }
    this.mesh.setColors32(this.colors);
    this.mesh.update();
  }

  /** The tile under a screen point (by the ground plane at the tile heights' mean), or null. */
  pick(x: number, y: number): number | null {
    if (!this.heights) return null;
    const cam = this.stage.camera.camera!,
      from = cam.screenToWorld(x, y, cam.nearClip),
      to = cam.screenToWorld(x, y, cam.farClip),
      half = ((this.size - 1) * this.tileKm) / 2;
    // March along the ray until it passes under the terrain.
    const steps = 600;
    for (let s = 0; s <= steps; s++) {
      const f = s / steps,
        px = from.x + (to.x - from.x) * f,
        py = from.y + (to.y - from.y) * f,
        pz = from.z + (to.z - from.z) * f,
        i = Math.round((px + half) / this.tileKm),
        j = Math.round((pz + half) / this.tileKm);
      if (i < 0 || j < 0 || i >= this.size || j >= this.size) continue;
      if (py <= Math.max(0, this.heights[j * this.size + i]!)) return j * this.size + i;
    }
    return null;
  }

  /** The ground's height (above the sea) at a point of the scene, by its nearest tile. */
  heightAt(x: number, z: number): number {
    if (!this.heights) return 0;
    // (On the facets, as the ground is drawn: read off the nearest tile, an eye set on it stepped up and down as it went.)
    const s = this.size,
      h = this.heights,
      half = ((s - 1) * this.tileKm) / 2,
      fi = Math.max(0, Math.min(s - 1 - 1e-9, (x + half) / this.tileKm)),
      fj = Math.max(0, Math.min(s - 1 - 1e-9, (z + half) / this.tileKm)),
      i = Math.floor(fi),
      j = Math.floor(fj),
      u = fi - i,
      v = fj - j,
      a = h[j * s + i]!,
      b = h[j * s + i + 1]!,
      c = h[(j + 1) * s + i]!,
      d = h[(j + 1) * s + i + 1]!;
    return Math.max(
      0,
      u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v),
    );
  }

  /** Whether a point of the scene is over the sea (its nearest tile below the sea's level). */
  seaAt(x: number, z: number): boolean {
    return !!this.heights && this.heights[this.tileAt(x, z)]! < 0;
  }

  /** The ground under a screen point (by the tile it falls on), for zooming toward it. */
  pointAt(x: number, y: number): pc.Vec3 | null {
    const t = this.pick(x, y);
    return t === null ? null : this.groundAt(t);
  }

  /** The tile at a point of the scene. */
  tileAt(x: number, z: number): number {
    const half = ((this.size - 1) * this.tileKm) / 2,
      i = Math.max(0, Math.min(this.size - 1, Math.round((x + half) / this.tileKm))),
      j = Math.max(0, Math.min(this.size - 1, Math.round((z + half) / this.tileKm)));
    return j * this.size + i;
  }

  /** Where a tile's ground is, in the scene. */
  groundAt(tile: number): pc.Vec3 | null {
    if (!this.heights) return null;
    const half = ((this.size - 1) * this.tileKm) / 2;
    return new pc.Vec3(
      (tile % this.size) * this.tileKm - half,
      Math.max(0, this.heights[tile]!),
      Math.floor(tile / this.size) * this.tileKm - half,
    );
  }

  /**
   * A land's towns and roads at moment t (M150): each town with a fabric drawn from it, the rest
   * as huts; the woods cleared from the towns and their fields.
   */
  setTowns(plan: LandPlan, t: number, spread = false): void {
    if (!spread) {
      this.laying = null;
      this.next = null;
      runToEnd(this.townsLaying(plan, t));
      return;
    }
    // (One under way is laid to its end, the newest plan then: a laying broken off at each plan's coming, the plans coming
    // faster than one is laid, never came to draw the land anew at all. Begun at the next frame, within its budget.)
    if (this.laying && this.layingOn === this.ground) {
      if (this.next) this.layingsPassed++;
      this.next = { plan, t };
      return;
    }
    this.begin(plan, t);
  }

  private begin(plan: LandPlan, t: number): void {
    this.laying = this.townsLaying(plan, t);
    this.layingOn = this.ground;
    this.layingSince = performance.now();
  }

  /** When the laying under way was begun, and how many plans were passed over for a newer one while it was laid (for a check). */
  private layingSince = 0;
  layingsPassed = 0;

  /** A land's plan being laid over frames (setTowns spread), on whose ground, and the newest plan come meanwhile. */
  private laying: Generator<void, void> | null = null;
  private layingOn: unknown = null;
  private next: { plan: LandPlan; t: number } | null = null;

  /**
   * Each frame: a land's plan being laid (setTowns spread) laid on for a few milliseconds, a step at a time, then the
   * newest come meanwhile; dropped if its land is left. Whether any was left to lay.
   */
  layOn(budget = LAY_BUDGET): boolean {
    if (!this.laying) return false;
    if (this.layingOn !== this.ground) {
      this.laying = null;
      this.next = null;
      return false;
    }
    const t0 = performance.now();
    for (let run: Generator<void, void> | null = this.laying; run; run = this.laying) {
      if (run.next().done) {
        // (How long a land's plan took to be laid, from its coming: the land's checks read it.)
        performance.measure("region.laid", { start: this.layingSince });
        this.laying = null;
        const next = this.next;
        this.next = null;
        if (!next) return true;
        this.begin(next.plan, next.t);
      }
      if (performance.now() - t0 >= budget) break;
    }
    return true;
  }

  private *townsLaying(plan: LandPlan, t: number): Generator<void, void> {
    this.clearSea(!!plan.undersea);
    if (!this.ground) return;
    yield* this.land.laying(plan, t);
    const drawn = this.land.drawn();
    this.setVillages(plan.towns, drawn);
    // (What has burned stands bare: at a plan's coming at most, so a fire costs a planting a second while it moves.)
    this.fire.set(plan.burns ?? [], t, this.firePace);
    yield;
    const clearings = this.land.clearings(),
      key = `${clearings.map((c) => `${c.x.toFixed(1)},${c.z.toFixed(1)},${c.r.toFixed(1)}`).join(";")}|${this.fire.woodKey}`;
    if (key !== this.cleared) {
      this.cleared = key;
      this.flora.plant(this.fire.standing(treesClear(this.ground, this.trees, clearings)));
    }
    this.floraGround();
  }

  /** What grows near the eye told of the ground as laid (towns, roads, fields, camps, water) and what has burned bare. */
  private floraGround(): void {
    const g = this.ground,
      free = this.land.groundFree;
    if (!g || (free === this.floraFree && this.fire.woodKey === this.floraFire)) return;
    this.floraFree = free;
    this.floraFire = this.fire.woodKey;
    this.flora.setGround(free ?? ((x, z) => !facetWet(g, x, z)), this.fire.bareAt);
  }

  /** How many trees its woods were planted with, as last told (E1: gate 99 reads this beside the pixels). */
  /**
   * The land's relief and waters as built (the look tools): its highest ground (km), its tiles of sea, river and lake, and
   * where to look at them (x, z): its peak, and the shore of its sea and of a lake nearest its middle (null: none).
   */
  relief(): {
    rocky: number;
    shade: [number, number];
    high: number;
    sea: number;
    river: number;
    lake: number;
    peak: [number, number];
    coast: [number, number] | null;
    lakeShore: [number, number] | null;
  } | null {
    const g = this.ground;
    if (!g) return null;
    const { size, tileKm, heights, water } = g,
      half = ((size - 1) * tileKm) / 2,
      at = (t: number): [number, number] => [
        (t % size) * tileKm - half,
        Math.floor(t / size) * tileKm - half,
      ],
      wet = [0, 0, 0, 0],
      shore: (number | null)[] = [null, null, null, null],
      near = [Infinity, Infinity, Infinity, Infinity];
    let peak = 0;
    for (let t = 0; t < heights.length; t++) {
      if (heights[t]! > heights[peak]!) peak = t;
      const w = water[t]!;
      wet[w] = (wet[w] ?? 0) + 1;
      if (!w) continue;
      const i = t % size,
        j = Math.floor(t / size);
      if (i < 1 || j < 1 || i >= size - 1 || j >= size - 1) continue;
      if (!water[t - 1] || !water[t + 1] || !water[t - size] || !water[t + size]) {
        const d = Math.hypot(i - size / 2, j - size / 2);
        if (d < near[w]!) {
          near[w] = d;
          shore[w] = t;
        }
      }
    }
    // (How its ground's lie came out: the share of its dry tiles showing rock, and its darkest and lightest shade.)
    const lie = this.lie;
    let rocky = 0,
      dry = 0,
      dark = 1,
      light = 1;
    if (lie)
      for (let t = 0; t < heights.length; t++)
        if (!water[t]) {
          dry++;
          rocky += lie.rock[t]!;
          dark = Math.min(dark, lie.shade[t]!);
          light = Math.max(light, lie.shade[t]!);
        }
    return {
      rocky: dry ? rocky / dry : 0,
      shade: [dark, light],
      high: heights[peak]! / REGION_RELIEF,
      sea: wet[1]!,
      river: wet[2]!,
      lake: wet[3]!,
      peak: at(peak),
      coast: shore[1] === null ? null : at(shore[1]!),
      lakeShore: shore[3] === null ? null : at(shore[3]!),
    };
  }

  get treesPlanted(): number {
    return this.trees.length;
  }

  /**
   * The region's woods: a low-poly crown for each far tree, on the ground where it stands (none in a town's clearing, none
   * burned), and what grows on the land as read (render/flora.ts draws the near things from it).
   */
  plantTrees(trees: readonly RegionTree[], land: FloraLand | null = null, parched = false): void {
    this.trees = trees;
    this.flora.setLand(land, parched);
    this.flora.plant(
      this.fire.standing(
        this.ground ? treesClear(this.ground, trees, this.land.clearings()) : trees,
      ),
    );
    this.floraGround();
  }

  /**
   * Each frame, on a land: what burns on it at moment t. Whether its ground must be painted again (a few times a second at most),
   * its colours going through `fire.scarred`.
   */
  burnsNow(t: number, pace: number, distance: number, running: boolean): boolean {
    this.firePace = pace;
    // (What grows near the eye, laid again only as the eye moves on: render/flora.ts.)
    this.flora.update(this.stage.camera, distance);
    return this.fire.update(t, pace, running);
  }

  /** Where snow lies on the land's heights (view/region.ts snowLine; null: nowhere): what grows over it under it. */
  snowLine(line: readonly [number, number] | null): void {
    this.flora.snowLine(line);
  }

  /** The season on the land's woods (null: none told): the broad leaves turned or fallen, snow on them. */
  season(s: GroundSeason | null): void {
    const key = s ? seasonKey(s) : "";
    if (key === this.seasonSeen) return;
    this.seasonSeen = key;
    this.flora.season(s);
  }

  /** Villages as clusters of huts, more huts for more people — but those `drawn` from their fabric. */
  setVillages(
    villages: readonly { ref?: string; tile: number; population: number }[],
    drawn: ReadonlySet<string> = new Set(),
  ): void {
    if (!this.heights) return;
    // (Within the region, so they go and come with it.)
    this.huts ??= new InstancedBatch(
      this.stage,
      cylinderMesh(this.stage, 0.3, 0.42, 4),
      [0.9, 0.76, 0.55],
      2048,
      this.root,
    );
    this.villageTiles = villages.map((v) => v.tile);
    const places: [number, number, number, number][] = [];
    for (const v of villages) {
      if (v.ref && drawn.has(v.ref)) continue;
      const at = this.groundAt(v.tile)!,
        huts = Math.max(1, Math.min(24, Math.round(Math.sqrt(v.population) / 1.6)));
      for (let k = 0; k < huts; k++) {
        const a = k * 2.399963,
          r = 0.62 * Math.sqrt(k + 0.5);
        places.push([at.x + r * Math.cos(a), at.y + 0.21, at.z + r * Math.sin(a), a]);
      }
    }
    this.huts.set(places.length, (i, out) => {
      const [x, y, z, a] = places[i]!;
      out[0] = x;
      out[1] = y;
      out[2] = z;
      out[3] = out[5] = 1;
      out[4] = 1;
      out[6] = a;
    });
  }

  /** Screen positions (CSS pixels) of tiles, for labels; null when behind the camera. */
  screenOf(
    tiles: readonly number[],
    /** Each tile's town, where it has one: its name stands over its square as the land draws it (view/land.ts townMiddle). */
    towns?: readonly (string | undefined)[],
  ): ({ x: number; y: number } | null)[] {
    const cam = this.stage.camera.camera!,
      out: ({ x: number; y: number } | null)[] = [];
    for (let k = 0; k < tiles.length; k++) {
      const tile = tiles[k]!,
        at = this.townGround(tile, towns?.[k]);
      if (!at) {
        out.push(null);
        continue;
      }
      at.y += 0.9;
      const screen = cam.worldToScreen(at);
      out.push(screen.z > 0 ? { x: screen.x, y: screen.y } : null);
    }
    return out;
  }

  /** The village tile nearest a tile, within `reach` tiles. */
  villageNear(tile: number, reach = 3): number | null {
    const i = tile % this.size,
      j = Math.floor(tile / this.size);
    let best: number | null = null,
      bestD = reach * reach + 1;
    for (const v of this.villageTiles) {
      const di = (v % this.size) - i,
        dj = Math.floor(v / this.size) - j,
        d = di * di + dj * dj;
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  mark(tile: number | null, town?: string): void {
    this.marker.enabled = tile !== null && this.heights !== null;
    if (tile === null || !this.heights) return;
    const at = this.townGround(tile, town)!;
    this.marker.setLocalPosition(at.x, at.y + 3, at.z);
  }

  /** Where a tile's town stands on the ground (its square as the land draws it), else the tile's middle. */
  private townGround(tile: number, town?: string): pc.Vec3 | null {
    const d = town ? this.land.townAt(town) : null;
    return d ? new pc.Vec3(d.x, this.heightAt(d.x, d.z), d.z) : this.groundAt(tile);
  }
}

/** The materials a region is drawn with, for the stage to warm before a first descent. */
export function regionMaterials(
  stage: Stage,
): { material: pc.Material; instanced?: boolean; mesh?: pc.Mesh }[] {
  const land = new pc.StandardMaterial();
  land.diffuseVertexColor = true;
  land.specular = new pc.Color(0.05, 0.05, 0.06);
  land.gloss = 0.1;
  land.update();
  // The shapes the region and a village are built of (a cylinder's vertices are a cone's,
  // a sphere's and a capsule's too): lit plain, clear, and instanced.
  const shape = cylinderMesh(stage, 0.5, 1, 6);
  return [
    { material: land },
    { material: seaMaterial(), mesh: shape },
    { material: flatMaterial([1, 1, 1], 0.8), mesh: shape },
    { material: flatMaterial([1, 1, 1]), mesh: shape },
    { material: flatMaterial([1, 1, 1]), instanced: true, mesh: shape },
    // (A gable roof's vertices differ: its shader too.)
    { material: flatMaterial([1, 1, 1]), instanced: true, mesh: gableMesh(stage) },
    // A village's boxes, and its smoke: instanced, and clear (M77–78).
    { material: flatMaterial([1, 1, 1]), instanced: true, mesh: boxMesh(stage) },
    { material: flatMaterial([1, 1, 1], 0.5), instanced: true, mesh: boxMesh(stage) },
    // A home's windows, lamplit, and the sheen of metal and wet things (M79).
    { material: windowMaterial(), instanced: true, mesh: boxMesh(stage) },
    { material: flatMaterial([1, 1, 1], 1, 0.7, 0.5), instanced: true, mesh: boxMesh(stage) },
    // What burns on a land, and its smoke (N1).
    ...wildfireMaterials(stage),
  ];
}

/** A rocky world's sea over a region. */
const SEA: Rgb = [0.08, 0.3, 0.66];

const SEA_OPACITY_PS = `
uniform float material_opacity;
uniform sampler2D uCrowns;
uniform vec4 uTileMap;
void getOpacity() {
	dAlpha = material_opacity;
	if (uTileMap.w > 0.5) {
		vec2 uv = ((vPositionW.xz + uTileMap.x) / uTileMap.y + 0.5) / uTileMap.z;
		dAlpha *= smoothstep(0.08, 0.5, texture2D(uCrowns, uv).a);
	}
}
`;

/** How far below the sea's sheet its floor is drawn at least at its shore, and more far out (scene units, by its depth as read). */
const SEA_FLOOR = 0.06,
  SEA_FLOOR_DEEP = 0.5;
/** How much of what lies under it a land's sea hides: as a rule, and over a people of the water's towns. */
const SEA_OPACITY = 0.62,
  CLEAR_SEA = 0.3;

/**
 * The sea over a region: a glossy sheet (blue, or its kind's), clear enough to show the shallows. Over the land as it is
 * (`uTileMap.w` 1) it comes in from the shore by how deep the water reads (`crowns`' alpha over the sea, groundTexels): none
 * within a step of the shore, where the ground's own shallows show and a steep shore's facet passes under it, its whole a
 * little way out; never a line where it meets the land.
 */
function seaMaterial(colour: Rgb = SEA, crowns: pc.Texture | null = null): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  if (crowns) {
    m.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set("opacityPS", SEA_OPACITY_PS);
    m.shaderChunksVersion = pc.CHUNKAPI_2_8;
    m.setParameter("uCrowns", crowns);
    m.setParameter("uTileMap", [0, 1, 1, 0]);
  }
  m.diffuse = new pc.Color(colour[0], colour[1], colour[2]);
  m.specular = new pc.Color(0.85, 0.92, 1);
  m.gloss = 0.84;
  m.opacity = SEA_OPACITY;
  m.blendType = pc.BLEND_NORMAL;
  m.depthWrite = false;
  m.update();
  return m;
}
