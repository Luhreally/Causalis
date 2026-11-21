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
  kindWater,
  seasonKey,
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
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";
import { windowMaterial } from "./village.ts";

export class RegionScene {
  private readonly stage: Stage;
  private readonly root = new pc.Entity("region");
  private mesh: pc.Mesh | null = null;
  /** For each drawn corner, the tile it colours by; and the corners' colours. */
  private corners: Int32Array | null = null;
  private colors: Uint8Array | null = null;
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
        positions[t * 3 + 1] = heights[t]!;
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
      P = new Float64Array(21);
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
        const from = (q === 0 ? a : q === 1 ? b : c) * 3;
        at[o + 3 * q] = P[from]!;
        at[o + 3 * q + 1] = P[from + 1]!;
        at[o + 3 * q + 2] = P[from + 2]!;
        normals[o + 3 * q] = nx;
        normals[o + 3 * q + 1] = ny;
        normals[o + 3 * q + 2] = nz;
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
      }
      for (let d = 0; d < 3; d++) {
        P[9 + d] = (P[d]! + P[3 + d]!) / 2;
        P[12 + d] = (P[3 + d]! + P[6 + d]!) / 2;
        P[15 + d] = (P[6 + d]! + P[d]!) / 2;
        P[18 + d] = (P[d]! + P[3 + d]! + P[6 + d]!) / 3;
      }
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
    const material = new pc.StandardMaterial();
    material.diffuseVertexColor = true;
    // Matte facets, as the globe's.
    material.specular = new pc.Color(0.05, 0.05, 0.06);
    material.gloss = 0.1;
    material.update();
    const terrain = new pc.Entity("terrain");
    terrain.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material)] });
    this.root.addChild(terrain);
    const sea = new pc.Entity("sea");
    sea.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(
          cylinderMesh(this.stage, half * 1.42, 0.02, 48),
          seaMaterial(this.seaColour),
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
   * in it was cut into each tile's share when the mesh was made, and each share's three corners are its one tile.)
   */
  paint(colors: Uint8Array): void {
    if (!this.mesh || !this.corners || !this.colors) return;
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
    const half = ((this.size - 1) * this.tileKm) / 2,
      i = Math.max(0, Math.min(this.size - 1, Math.round((x + half) / this.tileKm))),
      j = Math.max(0, Math.min(this.size - 1, Math.round((z + half) / this.tileKm)));
    return Math.max(0, this.heights[j * this.size + i]!);
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
  setTowns(plan: LandPlan, t: number): void {
    this.clearSea(!!plan.undersea);
    if (!this.ground) return;
    this.land.set(plan, t);
    const drawn = this.land.drawn();
    this.setVillages(plan.towns, drawn);
    // (What has burned stands bare: at a plan's coming at most, so a fire costs a planting a second while it moves.)
    this.fire.set(plan.burns ?? [], t, this.firePace);
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
    return this.fire.update(t, pace, distance, running);
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

/** How much of what lies under it a land's sea hides: as a rule, and over a people of the water's towns. */
const SEA_OPACITY = 0.62,
  CLEAR_SEA = 0.3;

/** The sea over a region: a glossy sheet (blue, or its kind's), clear enough to show the shallows. */
function seaMaterial(colour: Rgb = SEA): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(colour[0], colour[1], colour[2]);
  m.specular = new pc.Color(0.85, 0.92, 1);
  m.gloss = 0.84;
  m.opacity = SEA_OPACITY;
  m.blendType = pc.BLEND_NORMAL;
  m.depthWrite = false;
  m.update();
  return m;
}
