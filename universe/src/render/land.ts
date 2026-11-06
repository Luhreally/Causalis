// A land's towns, fields and roads drawn (Phase 25 M150): each town's fabric as the view lays it
// out (the parts of its own streets), set on the land's ground at the land's scale — what lies
// flat set into the ground as a slab, what stands on it at its height above — all the land's towns
// in one set of batches by mesh and colour; what stands all year put once as a year's plans come,
// what rises put again as it climbs (a few times a second at most); fields by what they show at
// the season; roads trodden, paved and railed; and what goes along them and out on the sea
// (Phase 26 M153, render/landtraffic.ts).
import * as pc from "playcanvas";
import { YEAR, hashString } from "../kernel/index.ts";
import type { LandPlan } from "../bridge/index.ts";
import {
  CROPS,
  LAND_ACROSS,
  campTracks,
  cutLine,
  roadNow,
  LAND_FLAT,
  LAND_UP,
  TownParts,
  builtOverParts,
  civicsActive,
  cropAt,
  groundAt,
  tileOf,
  landFields,
  laneLine,
  landReach,
  linePieces,
  onLines,
  roadLine,
  roadLook,
  roadOutside,
  roadTiles,
  tileMiddle,
  townCivics,
  ashReach,
  landMoment,
  townAsh,
  townGround,
  townHomes,
  townScene,
  townWalls,
  wayOf,
  floorAt,
  wetAt,
  type FieldsLaid,
  type LandField,
  type LandGround,
  type PartMesh,
  type TownScene,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh, gableMesh, keptMesh } from "./batch.ts";
import { LandTraffic, type BusyWay, type CarrierKind, type RoadWay } from "./landtraffic.ts";
import { LandWorks, type WorksSite } from "./landworks.ts";
import { LandHerdsLayer } from "./landherds.ts";
import type { LandHerds } from "../bridge/index.ts";
import { LandCamps } from "./landcamps.ts";
import { domeMesh } from "./colony.ts";
import type { Rgb, Stage } from "./stage.ts";

/** How far over the ground a town's ground stands (region units), and how deep its slabs go into it. */
const LIFT = 0.01;
/** Over the tiles a flat thing `r` about a point lies on, how high its top comes. */
function layTop(
  tops: Float32Array,
  g: LandGround,
  x: number,
  z: number,
  r: number,
  top: number,
): void {
  const half = ((g.size - 1) * g.tileKm) / 2,
    i0 = Math.max(0, Math.round((x - r + half) / g.tileKm)),
    i1 = Math.min(g.size - 1, Math.round((x + r + half) / g.tileKm)),
    j0 = Math.max(0, Math.round((z - r + half) / g.tileKm)),
    j1 = Math.min(g.size - 1, Math.round((z + r + half) / g.tileKm));
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const t = j * g.size + i;
      if (top > tops[t]!) tops[t] = top;
    }
}
const SLAB = 0.06;
/** How far off a road a block of a land built over stands (region units): the road, the rails beside it, what goes on them. */
const WAY_CLEAR = 0.2;
/** A slab's corners, as signs along it and across it. */
const CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];
/** How much higher a flat thing's every metre stands (its order kept: a yard over its street). */
const FLAT_UP = 0.004;
/** How often what rises is put again: sim moments apart at the least, and real milliseconds. */
const RISE_EVERY = 6 * 3600;
const RISE_WAIT = 250;

/** How high what stands (m) is drawn on the land: as it is to a block's height, far less past that. */
const landHigh = (m: number) => (m <= 60 ? m : 60 + (m - 60) * 0.2);

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
  /** The top of the wide slabs over each tile, as last shown. */
  tops: Float32Array | null = null;
  private readonly stage: Stage;
  private readonly root: pc.Entity;
  private readonly meshes: Readonly<Record<PartMesh, pc.Mesh>>;
  constructor(stage: Stage, root: pc.Entity, meshes: Readonly<Record<PartMesh, pc.Mesh>>) {
    this.stage = stage;
    this.root = root;
    this.meshes = meshes;
  }

  show(
    towns: readonly {
      parts: TownParts;
      x: number;
      z: number;
      /** Where none of it stands (region units). */
      gone?: readonly { x: number; z: number; r: number }[];
      /** Whether anything raised may not stand somewhere, `r` about a point (region units). */
      kept?: (x: number, z: number, r: number) => boolean;
    }[],
    g: LandGround,
    /** A people of the water's: it stands on the seabed, none of it ashore. */
    undersea = false,
  ): void {
    const floor = undersea ? floorAt : groundAt;
    if (this.tops?.length !== g.size * g.size) this.tops = new Float32Array(g.size * g.size);
    this.tops.fill(-Infinity);
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
          if (wetAt(g, x, z) !== undersea) continue;
          if (t.gone?.some((h) => Math.hypot(x - h.x, z - h.z) < h.r)) continue;
          const top = d[o + 1]! + d[o + 4]! / 2,
            q = m * 7;
          let ground = floor(g, x, z),
            wide = false;
          // (A wide slab lies on its highest corner, or the land's rises come up through it. On the
          // seabed the shore comes up over it, as it should: one lifted there would hang in the sea.)
          const sx = d[o + 3]! * LAND_ACROSS,
            sz = d[o + 5]! * LAND_ACROSS;
          if (t.kept && top >= LAND_FLAT && t.kept(x, z, Math.max(sx, sz) / 2 + WAY_CLEAR))
            continue;
          if (!undersea && Math.max(sx, sz) > g.tileKm / 4) {
            wide = true;
            const c = Math.cos(d[o + 6]!),
              s = Math.sin(d[o + 6]!);
            for (const [u, v] of CORNERS) {
              const a = (u * sx) / 2,
                b = (v * sz) / 2;
              ground = Math.max(ground, floor(g, x + a * c + b * s, z - a * s + b * c));
            }
          }
          ground += LIFT;
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
            if (wide) layTop(this.tops, g, x, z, Math.hypot(sx, sz) / 2, up);
          } else {
            // (Towers kept from being needles at the land's height: Phase 66.)
            const foot = landHigh(d[o + 1]! - d[o + 4]! / 2),
              head = landHigh(top);
            out[q + 1] = ground + ((foot + head) / 2) * LAND_UP;
            out[q + 4] = (head - foot) * LAND_UP;
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
/** A way worn between camps and hamlets, before any road is laid (R1): thin, and nearer the ground's own colour. */
const FAINT: Rgb = [0.58, 0.5, 0.36];
const FAINT_WIDE = 0.035;
/** How often a road's laying is looked at, in a year; a road's sections, and how far either side of a cut lies open (region units). */
const WORKS_LOOKS = 8;
const SECTION = 0.25;
const CUT_GAP = 0.34;
/** The most pieces of a town's worn ground its land draws. */
const LAND_WORN = 340;
/** The most gangs drawn on a land at once. */
const MOST_GANGS = 20;

/** How far over the road the middle of one riding on it is (region units). */
const RIDER_UP = 0.1;

export class LandLayer {
  readonly root = new pc.Entity("land-towns");
  private readonly settled: GroundBatches;
  private readonly rising: GroundBatches;
  private readonly fieldBatches: InstancedBatch[] = [];
  private readonly roadBatches: Record<
    "track" | "paved" | "rails" | "faint",
    InstancedBatch | null
  > = {
    track: null,
    paved: null,
    rails: null,
    faint: null,
  };
  private readonly stage: Stage;
  private readonly meshes: Readonly<Record<PartMesh, pc.Mesh>>;
  private readonly traffic: LandTraffic;
  /** Those laying its roads (R1). */
  private readonly works: LandWorks;
  /** Its bands' camps (Phase 28 M159). */
  readonly camps: LandCamps;
  /** What goes on its ground that no one drives (Z1). */
  readonly herds: LandHerdsLayer;
  /** The ways carriers go along: its roads and railways as drawn this year, its sea lanes (each lane's line worked out once). */
  private roadWays: RoadWay[] = [];
  private railWays: BusyWay[] = [];
  private laneWays: BusyWay[] = [];
  private laneLines = new Map<string, { x: number; z: number }[]>();
  private ground: LandGround | null = null;
  private towns = new Map<string, Drawn>();
  private fields: { field: LandField; crop: number }[] = [];
  private plan: LandPlan | null = null;
  /** What a land built over shows past its towns' own fabric (Phase 66). */
  private built: TownParts | null = null;
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
      dome: keptMesh(domeMesh(stage)),
    };
    this.settled = new GroundBatches(stage, this.root, this.meshes);
    this.rising = new GroundBatches(stage, this.root, this.meshes);
    this.traffic = new LandTraffic(stage, this.root, this.meshes);
    this.works = new LandWorks(stage, this.root, this.meshes);
    this.camps = new LandCamps(stage, this.root, this.meshes);
    this.herds = new LandHerdsLayer(stage, this.root, this.meshes);
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
    this.works.clear();
    this.camps.clear();
    this.herds.clear();
    this.fields = [];
    this.fieldTops = null;
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

  /** A land's creatures as last asked, set on its ground (Z1). */
  setHerds(plan: LandHerds): void {
    if (this.ground) this.herds.set(plan, this.ground, this.clearings());
  }

  /** The towns drawn and where (region units), for the trees to be cleared from them. */
  clearings(): { x: number; z: number; r: number }[] {
    // (No wood stands on a land built over.)
    if (this.plan?.covered) return [{ x: 0, z: 0, r: 1e6 }];
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
  townAt(ref: string): { x: number; z: number; r: number; ash: number } | null {
    const d = this.towns.get(ref);
    return d
      ? {
          x: d.x,
          z: d.z,
          r: d.reach,
          ash: d.scene.plan.ash ? ashReach(d.scene.plan, d.scene.lots) * LAND_ACROSS : 0,
        }
      : null;
  }

  /** A land's towns and roads as they stand at moment t (a town whose plan is unchanged kept). */
  set(plan: LandPlan, t: number): void {
    const g = this.ground;
    if (!g) return;
    this.plan = plan;
    this.camps.set(plan.camps ?? [], g);
    const seen = new Set<string>();
    let changed = false;
    for (const town of plan.towns) {
      if (!town.plan || town.plan.lots === 0) continue;
      seen.add(town.ref);
      const had = this.towns.get(town.ref);
      if (had && had.key === town.key) continue;
      const m = tileMiddle(g, town.tile),
        moment = landMoment(town.plan, t),
        scene = townScene(town.plan, moment, had?.scene.lots),
        settled = had?.settled ?? new TownParts();
      settled.clear();
      // (Of worn ground, what the land's eye can make out.)
      townGround(
        scene,
        settled,
        !!town.plan.ash,
        Math.min(LAND_WORN, 40 + Math.floor(scene.plan.lots / 6)),
      );
      townHomes(scene, scene.settled, moment, settled);
      townAsh(scene, moment, settled, true);
      this.towns.set(town.ref, {
        ref: town.ref,
        key: town.key,
        scene,
        x: m.x,
        z: m.z,
        reach: landReach(scene),
        settled,
        busy: scene.active.length > 0 || civicsActive(town.plan, moment) || !!town.plan.walls,
      });
      changed = true;
    }
    for (const ref of [...this.towns.keys()])
      if (!seen.has(ref)) {
        this.towns.delete(ref);
        changed = true;
      }
    // (Built over from edge to edge, past where any town's own fabric reaches: Phase 66.)
    if (!!plan.covered !== !!this.built) {
      changed = true;
      this.built = plan.covered ? new TownParts() : null;
      if (this.built)
        builtOverParts(
          hashString(`${plan.towns[0]?.ref ?? ""} built over`),
          (g.size * g.tileKm) / 2 / LAND_ACROSS,
          this.built,
        );
    }
    if (changed) {
      this.settled.show(
        [
          ...[...this.towns.values()].map((d) => ({ parts: d.settled, x: d.x, z: d.z })),
          // (A land built over: what the greatest fire burned is burned, past its town's own lots too.)
          ...(this.built
            ? [
                {
                  parts: this.built,
                  x: 0,
                  z: 0,
                  // (Its roads run clear through it: what goes on them can be seen.)
                  kept: onLines(
                    plan.roads.flatMap((r) => {
                      const out =
                        roadLook(r, Math.floor(t / YEAR)) === "none" ? null : this.roadOut(r);
                      return out ? [out] : [];
                    }),
                  ),
                  gone: [...this.towns.values()].flatMap((d) =>
                    d.scene.plan.ash
                      ? [{ x: d.x, z: d.z, r: ashReach(d.scene.plan, d.scene.lots) * LAND_ACROSS }]
                      : [],
                  ),
                },
              ]
            : []),
        ],
        g,
        !!plan.undersea,
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
      this.layFieldTops();
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
    this.traffic.move(g, running, this.overFields);
    this.works.move(running);
    this.camps.update(running);
    this.herds.update(g, this.clearings(), (t % YEAR) / YEAR, running);
    const wall = performance.now();
    if (Math.abs(t - this.drawnAt) >= RISE_EVERY && wall - this.drawnWall >= RISE_WAIT) {
      this.drawnAt = t;
      this.drawnWall = wall;
      const rising: { parts: TownParts; x: number; z: number }[] = [];
      for (const d of this.towns.values()) {
        if (!d.busy) continue;
        const parts = new TownParts(),
          moment = landMoment(d.scene.plan, t);
        townHomes(d.scene, d.scene.active, moment, parts);
        townCivics(d.scene, moment, parts);
        townWalls(d.scene, moment, parts);
        rising.push({ parts, x: d.x, z: d.z });
      }
      this.rising.show(rising, g, !!this.plan.undersea);
    }
    const share = (t % YEAR) / YEAR,
      season = Math.floor(share * 48);
    if (season !== this.season) {
      this.season = season;
      this.showFields(share);
    }
    // (A road's gang moves on a section at a time, between the year's turns.)
    const look = Math.floor(t / (YEAR / WORKS_LOOKS));
    if (look !== this.year) {
      this.year = look;
      this.showRoads(t / YEAR);
    }
  }

  /**
   * The top of the field plates lying over each tile: a plate is flat at its middle's height, so across a slope it stands
   * above the ground, and a road and what goes along it run over it, not under it. As over a great city's trodden ground.
   */
  private fieldTops: Float32Array | null = null;
  private readonly overFields = (g: LandGround, x: number, z: number): number => {
    const t = tileOf(g, x, z);
    return Math.max(
      groundAt(g, x, z),
      this.fieldTops?.[t] ?? -Infinity,
      this.settled.tops?.[t] ?? -Infinity,
    );
  };
  private layFieldTops(): void {
    const g = this.ground;
    if (!g) return;
    const tops = new Float32Array(g.size * g.size).fill(-Infinity);
    for (const { field: f } of this.fields)
      layTop(tops, g, f.x, f.z, Math.hypot(f.w, f.d) / 2, groundAt(g, f.x, f.z) + LIFT * 0.6);
    this.fieldTops = tops;
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

  /** A road's way between the towns it joins (null: none to draw). */
  private roadOut(road: LandPlan["roads"][number]): { x: number; z: number }[] | null {
    const g = this.ground!,
      k = `${road.from}-${road.to}`;
    let line = this.lines.get(k);
    if (!line)
      this.lines.set(
        k,
        (line = roadLine(g, roadTiles(g, road.from, road.to, !!this.plan!.undersea))),
      );
    if (line.length < 2) return null;
    const ends = [road.a, road.b].flatMap((ref) => {
        const d = ref ? this.towns.get(ref) : undefined;
        return d ? [{ x: d.x, z: d.z, r: d.reach * 0.92 }] : [];
      }),
      out = roadOutside(line, ends);
    return out.length < 2 ? null : out;
  }

  private showRoads(moment: number): void {
    const g = this.ground!,
      plan = this.plan!,
      year = Math.floor(moment),
      onGround = plan.undersea ? floorAt : this.overFields;
    const pieces: Record<"track" | "paved" | "rails" | "faint", number[][]> = {
      track: [],
      paved: [],
      rails: [],
      faint: [],
    };
    const nows = plan.roads.map((r) => roadNow(r, moment)),
      /** A road's sections laid. */
      laidOf = (k: number) => {
        const n = nows[k]!;
        if (!n.works) return -1;
        const out = this.roadOut(plan.roads[k]!);
        let long = 0;
        if (out)
          for (let q = 0; q + 1 < out.length; q++)
            long += Math.hypot(out[q + 1]!.x - out[q]!.x, out[q + 1]!.z - out[q]!.z);
        return Math.floor((n.share * long) / SECTION);
      },
      cutNow = (r: LandPlan["roads"][number]) =>
        r.cut && moment >= r.cut.from && moment < r.cut.until ? r.cut : null;
    const key = `${this.stage.quality.landTraffic}|${plan.era}|${plan.roads
      .map(
        (r, k) =>
          `${r.from}-${r.to}-${nows[k]!.behind}-${nows[k]!.ahead}-${laidOf(k)}-${nows[k]!.stopped ?? ""}-${cutNow(r)?.from ?? ""}-${r.traffic}`,
      )
      .join("|")}|${plan.lanes
      .map((l) => (l.since <= year ? `${l.from}:${l.dx}:${l.dz}:${l.ships}` : ""))
      .join(
        "|",
      )}|${(plan.envoys ?? []).map((e) => e.ref).join("|")}|${(plan.camps ?? []).map((c) => c.home).join(",")}`;
    if (key === this.roadsKey) return;
    this.roadsKey = key;
    this.roadWays = [];
    this.railWays = [];
    const sites: WorksSite[] = [];
    plan.roads.forEach((road, k) => {
      const now = nows[k]!,
        look = now.behind,
        out = this.roadOut(road);
      if (!out || (look === "none" && now.ahead === "none")) return;
      // Behind the gang as it is laid, ahead of it as it was. A road cut lies open at the cut.
      const [built, left] = now.works ? cutLine(out, now.share) : [out, []],
        cut = cutNow(road),
        gap = cut ? (cutLine(out, cut.at)[0].at(-1) ?? null) : null,
        lay = (line: readonly { x: number; z: number }[], as: typeof look) => {
          if (as === "none" || line.length < 2) return;
          const open = (list: number[][]) =>
            gap ? list.filter((q) => Math.hypot(q[0]! - gap.x, q[2]! - gap.z) > CUT_GAP) : list;
          pieces[as === "rails" ? "paved" : as].push(
            ...open(linePieces(g, line, LIFT * 1.4, undefined, onGround)),
          );
          if (as === "rails") {
            // The railway beside the road: its bed a little to one side.
            const off = ROAD_WIDE.paved * 0.9,
              side = line.map((p, i) => {
                const q = line[Math.min(line.length - 1, i + 1)]!,
                  r = line[Math.max(0, i - 1)]!,
                  dx = q.x - r.x,
                  dz = q.z - r.z,
                  n = Math.hypot(dx, dz) || 1;
                return { x: p.x - (dz / n) * off, z: p.z + (dx / n) * off };
              });
            pieces.rails.push(...open(linePieces(g, side, LIFT * 1.6, undefined, onGround)));
            this.railWays.push({ way: wayOf(side), busy: road.traffic });
          }
        };
      lay(built, look);
      lay(left, now.ahead);
      // What goes along it goes as far as it is laid, and no farther than a cut.
      const going =
        look === "none"
          ? left
          : now.ahead === "none"
            ? built
            : cut
              ? cutLine(out, Math.max(cut.at, 1 - cut.at))[0]
              : out;
      if (going.length >= 2) {
        const as = (look === "none" ? now.ahead : look) as "track" | "paved" | "rails";
        this.roadWays.push({ way: wayOf(going), look: as, traffic: road.traffic });
      }
      const ref = road.ref;
      if (ref && now.works)
        sites.push({
          ref,
          line: out,
          share: now.share,
          what: now.works.what,
          colour: now.works.colour,
          machines: now.works.machines,
          hands: now.works.hands,
          stopped: !!now.stopped,
          cut: false,
        });
      else if (ref && cut)
        sites.push({
          ref,
          line: out,
          share: cut.at,
          what: look === "none" ? "track" : look,
          colour: [0.5, 0.48, 0.44],
          machines: false,
          hands: 6,
          stopped: false,
          cut: true,
        });
    });
    this.works.set(sites.slice(0, MOST_GANGS), g, onGround, !!plan.undersea);
    // Ways worn between camps and hamlets, by feet: those no road has been laid along.
    if (!plan.undersea && plan.camps?.length)
      for (const [a, b] of campTracks(plan.camps, plan.towns, plan.roads, g.size)) {
        const k = `${a}-${b}`;
        let line = this.lines.get(k);
        if (!line) this.lines.set(k, (line = roadLine(g, roadTiles(g, a, b))));
        if (line.length >= 2) pieces.faint.push(...linePieces(g, line, LIFT * 1.1, 0.5, onGround));
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
      !!plan.undersea,
      (plan.envoys ?? []).map((e) => e.color),
      plan.about?.how,
    );
    for (const look of ["track", "paved", "rails", "faint"] as const) {
      const list = pieces[look];
      let b = this.roadBatches[look];
      if (!b || b.capacity < list.length) {
        b?.destroy();
        b = new InstancedBatch(
          this.stage,
          this.meshes.box,
          [
            ...(look === "track"
              ? TRACK
              : look === "paved"
                ? PAVED
                : look === "faint"
                  ? FAINT
                  : RAILS),
          ],
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
        o[3] = look === "faint" ? FAINT_WIDE : ROAD_WIDE[look];
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
    camps: number;
    campParts: number;
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
      camps: this.camps.info().length,
      campParts: this.camps.count,
    };
  }

  /** Where the first carrier of a kind is now (region units), or null (the look tools). */
  carrier(kind: CarrierKind): { x: number; y: number; z: number } | null {
    return this.traffic.nth(kind, 0);
  }

  /** A road's gang's page at a point of the screen, within a finger's reach (R1). */
  gangAt(cam: pc.CameraComponent, x: number, y: number): string | null {
    return this.works.pick(cam, x, y);
  }

  /** The road at a point of the screen, within a finger's reach of its line (R1): its page, or null. */
  roadAt(cam: pc.CameraComponent, x: number, y: number, reach = 14): string | null {
    const g = this.ground,
      plan = this.plan;
    if (!g || !plan) return null;
    const at = new pc.Vec3(),
      out = new pc.Vec3(),
      onGround = plan.undersea ? floorAt : this.overFields,
      now = this.year / WORKS_LOOKS;
    let best: string | null = null,
      most = reach * reach;
    for (const road of plan.roads) {
      if (!road.ref) continue;
      const n = roadNow(road, now);
      if (n.behind === "none" && n.ahead === "none") continue;
      const line = this.roadOut(road);
      if (!line) continue;
      let px = 0,
        py = 0,
        had = false;
      for (const p of line) {
        at.set(p.x, onGround(g, p.x, p.z) + LIFT, p.z);
        cam.worldToScreen(at, out);
        if (out.z <= 0) {
          had = false;
          continue;
        }
        if (had) {
          const dx = out.x - px,
            dy = out.y - py,
            len = dx * dx + dy * dy,
            u = len ? Math.max(0, Math.min(1, ((x - px) * dx + (y - py) * dy) / len)) : 0,
            ex = px + dx * u - x,
            ey = py + dy * u - y,
            d = ex * ex + ey * ey;
          if (d < most) {
            most = d;
            best = road.ref;
          }
        }
        px = out.x;
        py = out.y;
        had = true;
      }
    }
    return best;
  }

  /** Those at work on its roads, on the screen (R1). */
  gangs(
    cam: pc.CameraComponent,
  ): { ref: string; x: number; y: number; stopped: boolean; cut: boolean }[] {
    return this.works.gangs(cam);
  }

  /** What the works draw, for the look tools (R1). */
  worksInfo(): { gangs: number; hands: number; parts: number; faint: number } {
    return { ...this.works.info(), faint: this.roadBatches.faint?.size ?? 0 };
  }

  /** Where one on an errand on this land's roads is now (region units), or null: on none of its roads (D1). A road: its gang, else its middle (R1). */
  rider(ref: string): { x: number; y: number; z: number } | null {
    if (ref.startsWith("road:")) {
      const head = this.works.head(ref);
      if (head) return head;
      const road = this.plan?.roads.find((r) => r.ref === ref),
        line = road ? this.roadOut(road) : null,
        m = line?.[Math.floor(line.length / 2)];
      return m && this.ground ? { x: m.x, y: groundAt(this.ground, m.x, m.z), z: m.z } : null;
    }
    const k = (this.plan?.envoys ?? []).findIndex((e) => e.ref === ref);
    return k < 0 ? null : this.traffic.nth("envoy", k);
  }

  /** Those on an errand on its roads: their page, and where on the screen each stands. */
  riders(cam: pc.CameraComponent): { ref: string; name: string; x: number; y: number }[] {
    const at = new pc.Vec3(),
      out = new pc.Vec3(),
      list: { ref: string; name: string; x: number; y: number }[] = [];
    for (const e of this.plan?.envoys ?? []) {
      const r = this.rider(e.ref);
      if (!r) continue;
      at.set(r.x, r.y + RIDER_UP, r.z);
      cam.worldToScreen(at, out);
      if (out.z > 0) list.push({ ref: e.ref, name: e.name, x: out.x, y: out.y });
    }
    return list;
  }

  /** The one on an errand nearest a point of the screen, within a finger's reach. */
  riderAt(cam: pc.CameraComponent, x: number, y: number, reach = 30): string | null {
    let best: string | null = null,
      most = reach * reach;
    for (const r of this.riders(cam)) {
      const d = (r.x - x) ** 2 + (r.y - y) ** 2;
      if (d < most) {
        most = d;
        best = r.ref;
      }
    }
    return best;
  }

  destroy(): void {
    this.settled.destroy();
    this.rising.destroy();
    this.traffic.destroy();
    this.works.destroy();
    this.camps.destroy();
    this.herds.destroy();
    for (const b of this.fieldBatches) b.destroy();
    for (const b of Object.values(this.roadBatches)) b?.destroy();
    this.root.destroy();
  }
}
