// A land's towns, fields and roads drawn (Phase 25 M150): each town's fabric as the view lays it
// out (the parts of its own streets), set on the land's ground at the land's scale — what lies
// flat set into the ground as a slab, what stands on it at its height above — all the land's towns
// in one set of batches by mesh and colour; what stands all year put once as a year's plans come,
// what rises put again as it climbs (a few times a second at most); fields by what they show at
// the season; roads trodden, paved and railed; and what goes along them and out on the sea
// (Phase 26 M153, render/landtraffic.ts).
import * as pc from "playcanvas";
import { YEAR } from "../kernel/index.ts";
import type { LandPlan } from "../bridge/index.ts";
import {
  CROPS,
  LAND_ACROSS,
  LAND_FLAT,
  LAND_UP,
  TownParts,
  civicsActive,
  cropAt,
  groundAt,
  landFields,
  laneLine,
  landReach,
  linePieces,
  roadLine,
  roadLook,
  roadOutside,
  roadTiles,
  tileMiddle,
  townCivics,
  townGround,
  townHomes,
  townScene,
  townWalls,
  wayOf,
  wetAt,
  type FieldsLaid,
  type LandField,
  type LandGround,
  type PartMesh,
  type TownScene,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh, gableMesh, keptMesh } from "./batch.ts";
import { LandTraffic, type BusyWay, type CarrierKind, type RoadWay } from "./landtraffic.ts";
import type { Rgb, Stage } from "./stage.ts";

/** How far over the ground a town's ground stands (region units), and how deep its slabs go into it. */
const LIFT = 0.01;
const SLAB = 0.06;
/** How much higher a flat thing's every metre stands (its order kept: a yard over its street). */
const FLAT_UP = 0.004;
/** How often what rises is put again: sim moments apart at the least, and real milliseconds. */
const RISE_EVERY = 6 * 3600;
const RISE_WAIT = 250;

/** One town of the land, as drawn. */
type Drawn = {
  readonly ref: string;
  key: number;
  scene: TownScene;
  x: number;
  z: number;
  reach: number;
  settled: TownParts;
  busy: boolean;
};

/** Batches by mesh and colour for all a land's towns, each part set on the ground where it falls. */
class GroundBatches {
  private readonly batches = new Map<string, InstancedBatch>();
  private scratch = new Float32Array(0);
  private readonly stage: Stage;
  private readonly root: pc.Entity;
  private readonly meshes: Readonly<Record<PartMesh, pc.Mesh>>;
  constructor(stage: Stage, root: pc.Entity, meshes: Readonly<Record<PartMesh, pc.Mesh>>) {
    this.stage = stage;
    this.root = root;
    this.meshes = meshes;
  }

  show(towns: readonly { parts: TownParts; x: number; z: number }[], g: LandGround): void {
    const keys = new Map<string, { mesh: PartMesh; color: Rgb; n: number }>();
    for (const t of towns)
      for (const [key, grp] of t.parts.groups) {
        // (No lamps on the land: it is seen by day.)
        if (grp.lamp || !grp.data.length) continue;
        const k = keys.get(key);
        if (k) k.n += grp.data.length / 7;
        else keys.set(key, { mesh: grp.mesh, color: grp.color, n: grp.data.length / 7 });
      }
    for (const [key, k] of keys) {
      if (this.scratch.length < k.n * 7) this.scratch = new Float32Array(Math.ceil(k.n * 1.3) * 7);
      const out = this.scratch;
      let m = 0;
      for (const t of towns) {
        const grp = t.parts.groups.get(key);
        if (!grp) continue;
        const d = grp.data;
        for (let o = 0; o < d.length; o += 7) {
          const x = t.x + d[o]! * LAND_ACROSS,
            z = t.z + d[o + 2]! * LAND_ACROSS;
          if (wetAt(g, x, z)) continue;
          const ground = groundAt(g, x, z) + LIFT,
            top = d[o + 1]! + d[o + 4]! / 2,
            q = m * 7;
          out[q] = x;
          out[q + 2] = z;
          out[q + 3] = d[o + 3]! * LAND_ACROSS;
          out[q + 5] = d[o + 5]! * LAND_ACROSS;
          out[q + 6] = d[o + 6]!;
          if (top < LAND_FLAT) {
            // Flat: a slab set into the ground, its top a little over it (higher for higher things).
            const up = ground + top * FLAT_UP;
            out[q + 1] = up - SLAB / 2;
            out[q + 4] = SLAB;
          } else {
            out[q + 1] = ground + d[o + 1]! * LAND_UP;
            out[q + 4] = d[o + 4]! * LAND_UP;
          }
          m++;
        }
      }
      let b = this.batches.get(key);
      if (!b || b.capacity < m) {
        b?.destroy();
        b = new InstancedBatch(
          this.stage,
          this.meshes[k.mesh],
          [k.color[0], k.color[1], k.color[2]],
          Math.max(16, Math.ceil(m * 1.3)),
          this.root,
        );
        this.batches.set(key, b);
      }
      b.set(m, (i, o) => {
        const q = i * 7;
        o[0] = out[q]!;
        o[1] = out[q + 1]!;
        o[2] = out[q + 2]!;
        o[3] = out[q + 3]!;
        o[4] = out[q + 4]!;
        o[5] = out[q + 5]!;
        o[6] = out[q + 6]!;
      });
    }
    for (const [key, b] of this.batches) if (!keys.has(key)) b.set(0, () => {});
  }

  get count(): number {
    let n = 0;
    for (const b of this.batches.values()) n += b.size;
    return n;
  }

  destroy(): void {
    for (const b of this.batches.values()) b.destroy();
    this.batches.clear();
  }
}

/** The colours of a field at each of its crops: ploughed, green, ripe, stubble. */
const CROP_COLORS: readonly Rgb[] = [
  [0.46, 0.34, 0.22],
  [0.42, 0.62, 0.24],
  [0.86, 0.72, 0.3],
  [0.72, 0.66, 0.42],
];
/** A road's colours and breadths (region units): a track, a paved road, a railway's bed and rails. */
const TRACK: Rgb = [0.66, 0.55, 0.38],
  PAVED: Rgb = [0.6, 0.6, 0.58],
  RAILS: Rgb = [0.26, 0.22, 0.2];
const ROAD_WIDE = { track: 0.07, paved: 0.1, rails: 0.05 } as const;

export class LandLayer {
  readonly root = new pc.Entity("land-towns");
  private readonly settled: GroundBatches;
  private readonly rising: GroundBatches;
  private readonly fieldBatches: InstancedBatch[] = [];
  private readonly roadBatches: Record<"track" | "paved" | "rails", InstancedBatch | null> = {
    track: null,
    paved: null,
    rails: null,
  };
  private readonly stage: Stage;
  private readonly meshes: Readonly<Record<PartMesh, pc.Mesh>>;
  private readonly traffic: LandTraffic;
  /** The ways carriers go along: its roads and railways as drawn this year, its sea lanes (each lane's line worked out once). */
  private roadWays: RoadWay[] = [];
  private railWays: BusyWay[] = [];
  private laneWays: BusyWay[] = [];
  private laneLines = new Map<string, { x: number; z: number }[]>();
  private ground: LandGround | null = null;
  private towns = new Map<string, Drawn>();
  private fields: { field: LandField; crop: number }[] = [];
  private plan: LandPlan | null = null;
  /** Each road's line on the land (by its ends), worked out once. */
  private lines = new Map<string, { x: number; z: number }[]>();
  private roadsKey = "";
  private drawnAt = -Infinity;
  private drawnWall = 0;
  private season = -1;
  private year = -1;
  /** Whether the clock ran when last drawn (a new plan come while it is held leaves all standing). */
  private running = false;

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    parent.addChild(this.root);
    this.meshes = {
      box: keptMesh(boxMesh(stage)),
      gable: keptMesh(gableMesh(stage)),
      cone: keptMesh(coneMesh(stage, 0.5, 1, 8)),
      cyl: keptMesh(cylinderMesh(stage, 0.5, 1, 10)),
    };
    this.settled = new GroundBatches(stage, this.root, this.meshes);
    this.rising = new GroundBatches(stage, this.root, this.meshes);
    this.traffic = new LandTraffic(stage, this.root, this.meshes);
  }

  /** A new land: its ground, and nothing on it yet. */
  reset(ground: LandGround | null): void {
    this.ground = ground;
    this.towns.clear();
    this.lines.clear();
    this.laneLines.clear();
    this.roadWays = [];
    this.railWays = [];
    this.laneWays = [];
    this.traffic.clear();
    this.fields = [];
    this.plan = null;
    this.roadsKey = "";
    this.season = -1;
    this.year = -1;
    const none: { parts: TownParts; x: number; z: number }[] = [];
    if (ground) {
      this.settled.show(none, ground);
      this.rising.show(none, ground);
    }
    for (const b of this.fieldBatches) b.set(0, () => {});
    for (const b of Object.values(this.roadBatches)) b?.set(0, () => {});
  }

  /** The towns drawn and where (region units), for the trees to be cleared from them. */
  clearings(): { x: number; z: number; r: number }[] {
    const out: { x: number; z: number; r: number }[] = [];
    for (const d of this.towns.values()) out.push({ x: d.x, z: d.z, r: d.reach + 0.15 });
    for (const f of this.fields) out.push({ x: f.field.x, z: f.field.z, r: f.field.w / 2 });
    return out;
  }

  /** The towns drawn from their fabric (the rest are drawn as huts). */
  drawn(): Set<string> {
    return new Set(this.towns.keys());
  }

  /** A town's square and how far it reaches (region units), or null. */
  townAt(ref: string): { x: number; z: number; r: number } | null {
    const d = this.towns.get(ref);
    return d ? { x: d.x, z: d.z, r: d.reach } : null;
  }

  /** A land's towns and roads as they stand at moment t (a town whose plan is unchanged kept). */
  set(plan: LandPlan, t: number): void {
    const g = this.ground;
    if (!g) return;
    this.plan = plan;
    const seen = new Set<string>();
    let changed = false;
    for (const town of plan.towns) {
      if (!town.plan || town.plan.lots === 0) continue;
      seen.add(town.ref);
      const had = this.towns.get(town.ref);
      if (had && had.key === town.key) continue;
      const m = tileMiddle(g, town.tile),
        scene = townScene(town.plan, t, had?.scene.lots),
        settled = had?.settled ?? new TownParts();
      settled.clear();
      townGround(scene, settled);
      townHomes(scene, scene.settled, t, settled);
      this.towns.set(town.ref, {
        ref: town.ref,
        key: town.key,
        scene,
        x: m.x,
        z: m.z,
        reach: landReach(scene),
        settled,
        busy: scene.active.length > 0 || civicsActive(town.plan, t) || !!town.plan.walls,
      });
      changed = true;
    }
    for (const ref of [...this.towns.keys()])
      if (!seen.has(ref)) {
        this.towns.delete(ref);
        changed = true;
      }
    if (changed) {
      this.settled.show(
        [...this.towns.values()].map((d) => ({ parts: d.settled, x: d.x, z: d.z })),
        g,
      );
      // Fields about each town, the greatest's first, none on another's ground or fields.
      const circles = plan.towns.map((town) => {
          const d = this.towns.get(town.ref),
            m = tileMiddle(g, town.tile);
          return { ref: town.ref, x: m.x, z: m.z, r: d?.reach ?? 0.3 };
        }),
        laid: FieldsLaid = new Map();
      this.fields = [...plan.towns]
        .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
        .flatMap((town) => {
          const c = circles.find((o) => o.ref === town.ref)!;
          return landFields(
            g,
            town,
            c.x,
            c.z,
            c.r,
            circles.filter((o) => o.ref !== town.ref),
            laid,
          ).map((field) => ({ field, crop: -1 }));
        });
      this.season = -1;
    }
    this.drawnAt = -Infinity;
    this.drawnWall = 0;
    this.update(t, this.running);
  }

  /**
   * What rises through the year, the fields at the season, the roads at the year; and what goes
   * along them, on while the clock runs (`running`) and standing while it is held.
   */
  update(t: number, running = true): void {
    const g = this.ground;
    if (!g || !this.plan) return;
    this.running = running;
    this.traffic.move(g, running);
    const wall = performance.now();
    if (Math.abs(t - this.drawnAt) >= RISE_EVERY && wall - this.drawnWall >= RISE_WAIT) {
      this.drawnAt = t;
      this.drawnWall = wall;
      const rising: { parts: TownParts; x: number; z: number }[] = [];
      for (const d of this.towns.values()) {
        if (!d.busy) continue;
        const parts = new TownParts();
        townHomes(d.scene, d.scene.active, t, parts);
        townCivics(d.scene, t, parts);
        townWalls(d.scene, t, parts);
        rising.push({ parts, x: d.x, z: d.z });
      }
      this.rising.show(rising, g);
    }
    const share = (t % YEAR) / YEAR,
      season = Math.floor(share * 48);
    if (season !== this.season) {
      this.season = season;
      this.showFields(share);
    }
    const year = Math.floor(t / YEAR);
    if (year !== this.year) {
      this.year = year;
      this.showRoads(year);
    }
  }

  private showFields(share: number): void {
    const g = this.ground!;
    const by: LandField[][] = CROPS.map(() => []);
    for (const f of this.fields) by[cropAt(f.field, share)]!.push(f.field);
    by.forEach((list, k) => {
      let b = this.fieldBatches[k];
      if (!b || b.capacity < list.length) {
        b?.destroy();
        b = new InstancedBatch(
          this.stage,
          this.meshes.box,
          [...CROP_COLORS[k]!],
          Math.max(64, Math.ceil(list.length * 1.3)),
          this.root,
        );
        this.fieldBatches[k] = b;
      }
      b.set(list.length, (i, o) => {
        const f = list[i]!;
        o[0] = f.x;
        o[1] = groundAt(g, f.x, f.z) + LIFT * 0.6 - SLAB / 2;
        o[2] = f.z;
        o[3] = f.w;
        o[4] = SLAB;
        o[5] = f.d;
        o[6] = f.yaw;
      });
    });
  }

  private showRoads(year: number): void {
    const g = this.ground!,
      plan = this.plan!;
    const pieces: Record<"track" | "paved" | "rails", number[][]> = {
      track: [],
      paved: [],
      rails: [],
    };
    const key = `${this.stage.quality.landTraffic}|${plan.era}|${plan.roads
      .map((r) => `${r.from}-${r.to}-${roadLook(r, year)}-${r.traffic}`)
      .join("|")}|${plan.lanes
      .map((l) => (l.since <= year ? `${l.from}:${l.dx}:${l.dz}:${l.ships}` : ""))
      .join("|")}`;
    if (key === this.roadsKey) return;
    this.roadsKey = key;
    this.roadWays = [];
    this.railWays = [];
    for (const road of plan.roads) {
      const look = roadLook(road, year);
      if (look === "none") continue;
      const k = `${road.from}-${road.to}`;
      let line = this.lines.get(k);
      if (!line) this.lines.set(k, (line = roadLine(g, roadTiles(g, road.from, road.to))));
      if (line.length < 2) continue;
      const ends = [road.a, road.b].flatMap((ref) => {
          const d = ref ? this.towns.get(ref) : undefined;
          return d ? [{ x: d.x, z: d.z, r: d.reach * 0.92 }] : [];
        }),
        out = roadOutside(line, ends);
      if (out.length < 2) continue;
      pieces[look === "rails" ? "paved" : look].push(...linePieces(g, out, LIFT * 1.4));
      this.roadWays.push({ way: wayOf(out), look, traffic: road.traffic });
      if (look === "rails") {
        // The railway beside the road: its bed a little to one side.
        const off = ROAD_WIDE.paved * 0.9,
          side = out.map((p, i) => {
            const q = out[Math.min(out.length - 1, i + 1)]!,
              r = out[Math.max(0, i - 1)]!,
              dx = q.x - r.x,
              dz = q.z - r.z,
              n = Math.hypot(dx, dz) || 1;
            return { x: p.x - (dz / n) * off, z: p.z + (dx / n) * off };
          });
        pieces.rails.push(...linePieces(g, side, LIFT * 1.6));
        this.railWays.push({ way: wayOf(side), busy: road.traffic });
      }
    }
    // Its sea lanes, from the year its ships first went.
    this.laneWays = [];
    for (const lane of plan.lanes) {
      if (lane.since > year) continue;
      const k = `${lane.from}:${lane.dx}:${lane.dz}`;
      let line = this.laneLines.get(k);
      if (!line) this.laneLines.set(k, (line = laneLine(g, lane.from, lane.dx, lane.dz)));
      if (line.length >= 2) this.laneWays.push({ way: wayOf(line), busy: lane.ships });
    }
    this.traffic.lay(
      plan.era,
      this.roadWays,
      this.railWays,
      this.laneWays,
      this.stage.quality.landTraffic,
    );
    for (const look of ["track", "paved", "rails"] as const) {
      const list = pieces[look];
      let b = this.roadBatches[look];
      if (!b || b.capacity < list.length) {
        b?.destroy();
        b = new InstancedBatch(
          this.stage,
          this.meshes.box,
          [...(look === "track" ? TRACK : look === "paved" ? PAVED : RAILS)],
          Math.max(64, Math.ceil(list.length * 1.3)),
          this.root,
        );
        this.roadBatches[look] = b;
      }
      b.set(list.length, (i, o) => {
        const [x, y, z, len, yaw, pitch] = list[i]!;
        o[0] = x!;
        o[1] = y!;
        o[2] = z!;
        o[3] = ROAD_WIDE[look];
        o[4] = 0.012;
        o[5] = len!;
        o[6] = yaw!;
        o[7] = pitch!;
      });
    }
  }

  /** Parts drawn in all (for the budgets). */
  get count(): number {
    return this.settled.count + this.rising.count;
  }

  /**
   * What the land draws: its towns from their fabric, their parts, its fields, its roads' pieces,
   * its sea lanes and what goes along its ways, by kind (the look tools).
   */
  info(): {
    towns: number;
    parts: number;
    fields: number;
    roads: number;
    lanes: number;
    traffic: Partial<Record<CarrierKind, number>>;
  } {
    let roads = 0;
    for (const b of Object.values(this.roadBatches)) roads += b?.size ?? 0;
    return {
      towns: this.towns.size,
      parts: this.count,
      fields: this.fields.length,
      roads,
      lanes: this.laneWays.length,
      traffic: this.traffic.info(),
    };
  }

  /** Where the first carrier of a kind is now (region units), or null (the look tools). */
  carrier(kind: CarrierKind): { x: number; z: number } | null {
    return this.traffic.first(kind);
  }

  destroy(): void {
    this.settled.destroy();
    this.rising.destroy();
    this.traffic.destroy();
    for (const b of this.fieldBatches) b.destroy();
    for (const b of Object.values(this.roadBatches)) b?.destroy();
    this.root.destroy();
  }
}
