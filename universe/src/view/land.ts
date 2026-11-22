// A land's towns, roads and fields as the land draws them (Phase 25 M150, asked for 2026-10-24:
// "i cant see the cities form and evolve and get that type of detail i got from the og
// causalisis, i mean like the land view"): each town drawn from its fabric as its own streets are
// — its blocks, homes at their levels, buildings, walls and ruins, rising and falling as the years
// go — at LAND_SCALE times its size on the map, so a village is a knot of roofs and a great city
// spreads over the tiles about it, and as tall as the land's relief stands its hills; its fields
// about it, more for more people, on the good dry ground, green in spring and gold at harvest;
// its roads over the land from town to town and out of it, round the water and the steep,
// trodden, then paved, then railed. Pure: what is drawn, in the region's units (kilometres).
import { MinHeap, YEAR, hashString } from "../kernel/index.ts";
import { civic, type CivicKind } from "../rules/index.ts";
import type {
  LandCamp,
  LandPlan,
  LandRoad,
  LandTown,
  RoadWorks,
  TownSite,
} from "../bridge/index.ts";
import { REGION_RELIEF, type RegionTree } from "./region.ts";
import { outlineAt, sprawlFar, sprawlOf, type TownScene } from "./town.ts";
import { fieldLook, type FieldsNow } from "./fields.ts";
import { lifeTint } from "./biochem.ts";
import {
  BLOCK_D,
  BLOCK_W,
  GROUND,
  GroundClaims,
  holdPlaces,
  LAND_SCALE,
  LOT_D,
  LOT_W,
  fieldCount,
  fieldEdge,
  fieldsMeant,
  kindsOf,
  layOn,
  rectPoints,
  townClaims,
  townReach,
  wallAt,
  type TownLots,
} from "../bridge/index.ts";

export { LAND_SCALE };
/** Region units to a town's metre: across, and up (the land's own relief). */
export const LAND_ACROSS = LAND_SCALE / 1000;
export const LAND_UP = REGION_RELIEF / 1000;
/** What lies flat on the ground (under this height, metres) is drawn as a slab set into it. */
export const LAND_FLAT = 1.5;

/** The land's ground as its roads and fields read it. */
export type LandGround = {
  readonly size: number;
  readonly tileKm: number;
  /** Each tile's height (region units: the terrain's). */
  readonly heights: Float32Array;
  /** Each tile's water: 0 land, 1 sea, 2 river, 3 lake. */
  readonly water: Uint8Array;
  /** Each tile's soil (0–255). */
  readonly fertility: Uint8Array;
};

/** Where a tile's middle is (region units: the region is centred on its middle tile). */
export function tileMiddle(g: LandGround, tile: number): { x: number; z: number } {
  const half = ((g.size - 1) * g.tileKm) / 2;
  return {
    x: (tile % g.size) * g.tileKm - half,
    z: Math.floor(tile / g.size) * g.tileKm - half,
  };
}

/**
 * Where a town's square is on its land (region units): its tile's middle, or that tile's bank where the map draws the tile as
 * water (TownSite.bank). Its mark, its name, its roads' ends, its walls and its fields are all laid about this one point.
 */
export function townMiddle(
  g: LandGround,
  town: { readonly tile: number; readonly plan: { readonly site?: TownSite } | null },
): { x: number; z: number } {
  const m = tileMiddle(g, town.tile),
    b = town.plan?.site?.bank;
  return b ? { x: m.x + b.x * LAND_ACROSS, z: m.z + b.z * LAND_ACROSS } : m;
}

/** The tile a point of the region falls on (its nearest). */
export function tileOf(g: LandGround, x: number, z: number): number {
  const half = ((g.size - 1) * g.tileKm) / 2,
    i = Math.max(0, Math.min(g.size - 1, Math.round((x + half) / g.tileKm))),
    j = Math.max(0, Math.min(g.size - 1, Math.round((z + half) / g.tileKm)));
  return j * g.size + i;
}

/**
 * Whether the land's map draws a point as water: of the facet it lies on (the two each square of four tiles' middles is
 * cut into, as the terrain's mesh cuts them), the share of the tile whose corner it is nearest by the facet's own measure
 * (the greatest of its three weights), and whether that tile is water (render/region.ts cuts a facet of water and land so).
 */
export function facetWet(g: LandGround, x: number, z: number): boolean {
  return facetWater(g, x, z) !== 0;
}

/** The water the land's map draws at a point (0 land, 1 sea, 2 river, 3 lake: of the tile whose facet share it lies in). */
export function facetWater(g: LandGround, x: number, z: number): number {
  const half = ((g.size - 1) * g.tileKm) / 2,
    fx = Math.max(0, Math.min(g.size - 1 - 1e-6, (x + half) / g.tileKm)),
    fz = Math.max(0, Math.min(g.size - 1 - 1e-6, (z + half) / g.tileKm)),
    i = Math.floor(fx),
    j = Math.floor(fz),
    o = facetOwner(fx - i, fz - j);
  return g.water[j * g.size + i + o[0] + o[1] * g.size]!;
}

/**
 * Whose share of its facet a point of a square of four tiles' middles lies in: the tile east by `[0]` and south by `[1]` of
 * the square's north-west one (u east, v south, each 0 … 1). The square is cut north-east to south-west.
 */
export function facetOwner(u: number, v: number): readonly [number, number] {
  if (u + v <= 1) {
    const w = 1 - u - v;
    return w >= u && w >= v ? [0, 0] : u >= v ? [1, 0] : [0, 1];
  }
  const w = u + v - 1,
    e = 1 - v,
    so = 1 - u;
  return w >= e && w >= so ? [1, 1] : e >= so ? [1, 0] : [0, 1];
}

/**
 * The ground's height at a point, on the terrain's own facets: each square of four tiles' middles
 * split corner to corner from its upper right to its lower left, as the mesh is (never below the sea).
 */
export function groundAt(g: LandGround, x: number, z: number): number {
  return Math.max(0, floorAt(g, x, z));
}

/** The floor at a point, the seabed under the sea: where a people of the water's town stands. */
export function floorAt(g: LandGround, x: number, z: number): number {
  const half = ((g.size - 1) * g.tileKm) / 2,
    fi = Math.max(0, Math.min(g.size - 1 - 1e-9, (x + half) / g.tileKm)),
    fj = Math.max(0, Math.min(g.size - 1 - 1e-9, (z + half) / g.tileKm)),
    i = Math.floor(fi),
    j = Math.floor(fj),
    u = fi - i,
    v = fj - j,
    h = g.heights,
    a = h[j * g.size + i]!,
    b = h[j * g.size + i + 1]!,
    c = h[(j + 1) * g.size + i]!,
    d = h[(j + 1) * g.size + i + 1]!,
    y = u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  return y;
}

/** Whether a point of the region is over the sea or a lake (rivers are bridged and built over). */
export function wetAt(g: LandGround, x: number, z: number): boolean {
  const w = g.water[tileOf(g, x, z)]!;
  return w === 1 || w === 3;
}

/** How far a town's drawing reaches from its square, in region units (its sprawl, if it has one). */
export function landReach(scene: TownScene): number {
  const ring = sprawlOf(scene.plan, scene.lots),
    r = ring ? ring.r1 : townReach(scene.lots, scene.plan.lots);
  return r * LAND_ACROSS;
}

/** How far a town's drawing reaches toward a bearing, in region units: its outline, and its sprawl's where it has one. */
export function landEdge(scene: TownScene): (a: number) => number {
  const ring = sprawlOf(scene.plan, scene.lots);
  return (a) => (ring ? sprawlFar(scene, ring, a) : outlineAt(scene.outline, a)) * LAND_ACROSS;
}

/**
 * A field about a town: its middle, its size and turn (region units), whose it is and which of its fields (as its own view
 * numbers them: VillagePlan.fields, the crop each is sown with read by that number, view/country.ts cropsOf).
 */
export type LandField = {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly yaw: number;
  readonly ref: string;
  readonly k: number;
};

/** How far a town's road out is drawn in its own view (metres), at the most (host/village.ts ROAD_OUT). */
const ROAD_OUT = 1100;
/** How many of a town's fields are laid between two breaks of its land's laying. */
const FIELDS_A_STEP = 4;
/** The most fields drawn about a town (bridge/town.ts fieldCount). */
export const MOST_FIELDS = 90;

/** The cell a land's ground is read by (region units: 60 m on the map, less than a field or a road is across). */
export const LAND_STEP = 0.06;
/** Half the breadth of ground a road takes on a land (region units: its paving and a verge). */
export const ROAD_TAKES = 0.06;

/** A land's ground as it is taken (bridge/claims.ts): its water first, read from its own tiles as its map draws them. */
export function landClaims(g: LandGround, undersea = false): GroundClaims {
  return new GroundClaims(LAND_STEP, undersea ? () => false : (x, z) => facetWet(g, x, z));
}

/** The way a town's best ground lies from its tile, as its own view reads it (host/village.ts fieldWayOf): the first of the
 * eight ways out with the best soil that is not water. */
export function fieldWayOn(g: LandGround, tile: number): number {
  const i0 = tile % g.size,
    j0 = Math.floor(tile / g.size);
  let best = -1,
    way = 0;
  for (let k = 0; k < 8; k++) {
    const angle = (k / 8) * 2 * Math.PI,
      i = Math.round(i0 + Math.cos(angle)),
      j = Math.round(j0 + Math.sin(angle));
    if (i < 0 || j < 0 || i >= g.size || j >= g.size) continue;
    const t = j * g.size + i,
      soil = g.water[t] === 0 ? g.fertility[t]! : 0;
    if (soil > best) {
      best = soil;
      way = angle;
    }
  }
  return way;
}

/**
 * A town's fields (none where its land does not sow): the very fields its own view lays (host/village.ts; the owner's rule,
 * 2026-11-21: one field is one thing, seen from its land or from its streets), as many, as large and where they are meant
 * to lie — a fan toward its good ground past its edge, twelve to a ring (bridge/town.ts fieldsMeant) — drawn LAND_SCALE
 * times their size as its streets are; each on ground no one has taken (`claims`: the land's water, its towns' ground, its
 * roads, and the fields of the towns laid before it), else on out to the nearest free (bridge/claims.ts layOn), else not
 * sown; and not up a hillside, where a flat plate would stand off the ground.
 */
export function landFields(...args: Parameters<typeof landFieldsLaying>): LandField[] {
  return runToEnd(landFieldsLaying(...args));
}

/** landFields a few fields at a time (each `yield` a place the laying may be broken off for a frame). */
export function* landFieldsLaying(
  g: LandGround,
  town: LandTown,
  x: number,
  z: number,
  reach: number,
  others: readonly { x: number; z: number; r: number }[] = [],
  claims: GroundClaims = landClaims(g),
  /** How far its drawing reaches toward a bearing (region units: landEdge), where its lots are not given. */
  edge?: (a: number) => number,
  /** Whose its fields are among the land's holders. */
  owner = -1,
  /** Its lots (metres about its square), how many of them are read and of how many in all: its edge read as its own
   * view reads it (bridge/town.ts fieldEdge). */
  lots?: { readonly lots: TownLots; readonly drawn: number; readonly whole: number },
  spires = false,
): Generator<void, LandField[]> {
  void others;
  if (!town.fields || town.population <= 0) return [];
  const count = town.sow?.count ?? Math.max(4, Math.min(160, Math.ceil(town.population / 5))),
    way = town.sow?.way ?? fieldWayOn(g, town.tile),
    seed = hashString(`village ${town.ref}`),
    k = LAND_ACROSS,
    reading = fieldEdge({
      lots: lots?.lots ?? null,
      drawn: lots?.drawn ?? 0,
      whole: lots?.whole ?? 0,
      city: town.city,
      cityRim: 600,
      count,
      spires,
    }),
    edgeAt =
      !lots && edge
        ? (a: number) => Math.max(edge(a - 0.12), edge(a), edge(a + 0.12)) / k + 30
        : reading.edgeAt,
    meant = fieldsMeant(seed, way, fieldCount(count), edgeAt),
    // (Not up a hillside: the ground under its corners and middle within a tenth of a unit of level.)
    level = (f: { x: number; z: number; w: number; d: number; yaw: number }) => {
      const y = groundAt(g, f.x, f.z);
      return rectPoints(f).every((p) => Math.abs(groundAt(g, p.x, p.z) - y) <= 0.1);
    },
    // (Its road out, as its own view lays it: along its busiest road in, else a city's axis, else between its fields and
    // its poorer ground; as far as the dry ground goes that way, to 1100 m: host/village.ts.)
    roadWay =
      town.plan?.site?.roads[0]?.bearing ??
      (town.city ? (town.plan?.axis ?? 0) : way + Math.PI * 0.75),
    dryOut = (a: number) => {
      for (let r = 10; r <= ROAD_OUT; r += 10)
        if (facetWet(g, x + r * Math.cos(a) * k, z + r * Math.sin(a) * k))
          return Math.max(0, r - 10);
      return ROAD_OUT;
    },
    roadLong = (town.city ? [roadWay, roadWay + Math.PI] : [roadWay]).reduce(
      (m, a) => Math.min(m, dryOut(a)),
      ROAD_OUT,
    ),
    // (Its own ground read as its own view reads it, in metres on its own cells — its built ground, its road out, its
    // fields as they are laid — so each is moved where its view moves it, and not where the land's coarser cells would part
    // two its view lays side by side; the land's own ground read as well: its water, the other towns', its roads.)
    own = townClaims({
      ground: null,
      blocks: lots ? lots.lots.blocks : null,
      count: lots ? Math.ceil(lots.drawn / 8) : 0,
      outline: reading.outline,
      outlineAt,
      scale: Math.sqrt((lots?.whole ?? 0) / Math.max(1, lots?.drawn ?? 0)),
      edge: reading.edge,
      road: { x: roadLong * Math.cos(roadWay), z: roadLong * Math.sin(roadWay) },
      through: town.city,
    }),
    onLand = (f: { x: number; z: number; w: number; d: number; yaw: number }) => ({
      x: x + f.x * k,
      z: z + f.z * k,
      w: f.w * k,
      d: f.d * k,
      yaw: f.yaw,
    }),
    out: LandField[] = [];
  // (Its strongholds' and seats' ground, as its own view lays them: no field on it. bridge/holdplaces.ts.)
  if (town.plan && lots)
    for (const p of holdPlaces(town.plan, lots.lots)) own.disc(p.x, p.z, p.r, GROUND.works, 0);
  void reach;
  // (Laid one at a time, as its own view lays them: each takes its ground before the next is laid.)
  const laid: { x: number; z: number; w: number; d: number; yaw: number }[] = [],
    layOnFields = (some: typeof meant) =>
      layOn(
        {
          free: (fx: number, fz: number, w: number, d: number, yaw: number) => {
            if (!own.free(fx, fz, w, d, yaw, 0, 0)) return false;
            const r = onLand({ x: fx, z: fz, w, d, yaw });
            return claims.free(r.x, r.z, r.w, r.d, r.yaw, owner, kindsOf(GROUND.field));
          },
          rect: (fx: number, fz: number, w: number, d: number, yaw: number) =>
            own.rect(fx, fz, w, d, yaw, GROUND.field, 0),
        } as unknown as GroundClaims,
        some,
        GROUND.field,
        0,
        { x: 0, z: 0 },
        24,
        12,
      );
  // (A few at a time, so that no frame is held long by a town that looks far for free ground.)
  for (let i = 0; i < meant.length; i += FIELDS_A_STEP) {
    laid.push(...layOnFields(meant.slice(i, i + FIELDS_A_STEP)));
    if (i + FIELDS_A_STEP < meant.length) yield;
  }
  // (Numbered as its own view numbers what it lays, one not drawn here for its hillside too.)
  laid.forEach((f, n) => {
    const r = onLand(f);
    if (level(r)) out.push({ ...r, ref: town.ref, k: n });
  });
  for (const f of out) claims.rect(f.x, f.z, f.w, f.d, f.yaw, GROUND.field, owner);
  return out;
}

/**
 * The lots of a town drawn on its land's map (of `which`): each wholly on its land's ground, its middle, its corners and its
 * sides' middles off the water the map draws (a people of the water's: all, on its sea), and none on ground a greater town
 * holds (heldByGreater). A lot is drawn whole or not at all, so no house of it stands half in the water.
 */
export function lotsOnLand(
  g: LandGround,
  town: { readonly x: number; readonly z: number },
  scene: Pick<TownScene, "lots">,
  which: readonly number[],
  undersea: boolean,
  held?: (x: number, z: number) => boolean,
): readonly number[] {
  if (undersea && !held) return which;
  const lots = scene.lots;
  return which.filter((p) => {
    const x = town.x + lots.x[p]! * LAND_ACROSS,
      z = town.z + lots.z[p]! * LAND_ACROSS;
    if (held?.(x, z)) return false;
    if (undersea) return true;
    const r = { x, z, w: LOT_W * LAND_ACROSS, d: LOT_D * LAND_ACROSS, yaw: lots.yaw[p]! };
    return !rectPoints(r).some((q) => facetWet(g, q.x, q.z));
  });
}

/**
 * Whether another town holds the ground at a point of a land as laid (landLaid), so that none of this town's stands there:
 * where two towns' ground meets, the greater holds it, being laid first (undefined: none can hold this one's, it is the greatest).
 */
export function heldByGreater(
  laid: { readonly claims: GroundClaims; readonly owner: ReadonlyMap<string, number> } | null,
  ref: string,
): ((x: number, z: number) => boolean) | undefined {
  const own = laid?.owner.get(ref) ?? -1;
  if (!laid || own <= 0) return undefined;
  const claims = laid.claims;
  return (x, z) => {
    const by = claims.laidBy(x, z);
    return by >= 0 && by < own;
  };
}

/**
 * Whether a piece of road (linePieces': middle x, y, z, length, heading) is drawn on its land's ground as laid: not where
 * it runs over a town's built ground or its walls, or the water within them, where the town's own streets carry it (its ends,
 * its middle and its middle's sides read); nor out on the sea or a lake, where a way between two tiles of land drawn as
 * water ashore of a town would carry it.
 */
export function roadClear(
  claims: GroundClaims | null,
  /** Its land's ground, for a people of the land's: no piece is drawn whose middle lies on the sea or a lake (a river is bridged). */
  g?: LandGround,
): (piece: readonly number[]) => boolean {
  if (!claims) return () => true;
  return (q) => {
    if (g) {
      const w = facetWater(g, q[0]!, q[2]!);
      if (w === 1 || w === 3) return false;
    }
    const ux = Math.sin(q[4]!),
      uz = Math.cos(q[4]!),
      along = q[3]! / 2,
      side = ROAD_TAKES / 2;
    // (Its two ends, its middle, its middle's two sides and its four corners.)
    for (const [t, n] of ROAD_READ) {
      // (What a town holds, its water within it with it: the town's own streets and bridges carry it there.)
      const k = claims.laidAt(
        q[0]! + t * along * ux + n * side * uz,
        q[2]! + t * along * uz - n * side * ux,
      );
      if (k === GROUND.built || k === GROUND.wall) return false;
    }
    return true;
  };
}

const ROAD_READ = [
  [-1, 0],
  [0, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

/** How far a band's camp spreads about its middle on its land's map (region units: its tents' rings and its fire). */
export const CAMP_REACH = 0.45;

/**
 * Where a band's camp is pitched on its land's map (region units): a keyed spot within its tile, not all on the tiles'
 * grid; where that ground is taken (`free`: the land's ground as laid, view/land.ts landLaid), the nearest free ground
 * about it, ring by ring; none free, the keyed spot.
 */
export function campSpot(
  g: LandGround,
  camp: { readonly id: number; readonly home: number; readonly tile: number },
  free?: (x: number, z: number, r: number) => boolean,
): { x: number; z: number; seed: number } {
  const m = tileMiddle(g, camp.tile),
    seed = ((camp.id * 2654435761) ^ (camp.home * 40503)) >>> 0,
    x = m.x + ((seed % 1000) / 1000 - 0.5) * 0.6 * g.tileKm,
    z = m.z + (((seed >>> 10) % 1000) / 1000 - 0.5) * 0.6 * g.tileKm;
  if (!free || free(x, z, CAMP_REACH)) return { x, z, seed };
  for (let ring = 1; ring <= 8; ring++)
    for (let k = 0; k < 8 + 2 * ring; k++) {
      const a = (k / (8 + 2 * ring)) * 2 * Math.PI + (seed % 7) * 0.3,
        px = x + Math.cos(a) * ring * 0.3,
        pz = z + Math.sin(a) * ring * 0.3;
      if (free(px, pz, CAMP_REACH)) return { x: px, z: pz, seed };
    }
  return { x, z, seed };
}

/** A town as its land draws it, for laying what lies about it: its square, how far it reaches, and toward each bearing. */
export type LandDrawn = {
  readonly x: number;
  readonly z: number;
  readonly reach: number;
  readonly edge?: (a: number) => number;
  /** The ways its own streets leave it by (TownSite's roads), which the land's roads come in on. */
  readonly site?: TownSite;
  /** Its blocks drawn (metres about its square) and how many: the ground its lots stand on. */
  readonly blocks?: {
    readonly x: Float32Array;
    readonly z: Float32Array;
    readonly yaw: Float32Array;
  };
  readonly count?: number;
  /** Its walls' line as they stand (bridge/wall.ts: metres out toward each bearing; absent: none). */
  readonly wall?: Float32Array;
  /** Its lots (metres about its square), how many are read and of how many in all: where its fields begin (landFields). */
  readonly lots?: { readonly lots: TownLots; readonly drawn: number; readonly whole: number };
};

/**
 * A road's way between the towns it joins (null: none to draw): round the water over the dry ground, into each end town
 * along the street its own streets were laid by, cut at their edges. `lines` keeps each road's way over the land once.
 */
export function landRoadOut(
  g: LandGround,
  road: LandRoad,
  drawn: (ref: string) => LandDrawn | undefined,
  lines: Map<string, { x: number; z: number }[]>,
  undersea = false,
): { x: number; z: number }[] | null {
  const k = `${road.from}-${road.to}`;
  let line = lines.get(k);
  if (!line) lines.set(k, (line = roadLine(g, roadTiles(g, road.from, road.to, undersea))));
  if (line.length < 2) return null;
  // (Cut where it comes into its ends' towns' ground, then into each along its main street, the bearing its own streets
  // were laid by, to where its outline comes that way: the town's view shows the same, and no lot of it stands on the road.)
  const ends = [road.a, road.b].flatMap((ref) => {
    const d = ref ? drawn(ref) : undefined;
    return d ? [{ x: d.x, z: d.z, r: d.reach * 0.92 }] : [];
  });
  let met: { x: number; z: number }[] = roadOutside(line, ends);
  if (met.length < 2) met = [line[0]!, line.at(-1)!];
  // (Over a lake or the sea a road does not go: where its way in along the street would cross them, it comes in as it
  // came over the land.)
  const overWater = (line: readonly { x: number; z: number }[]) =>
    !undersea &&
    line.some((p, k) => {
      const q = line[k + 1];
      if (!q) return false;
      const n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / LAND_STEP);
      for (let s = 1; s < n; s++) {
        const w = facetWater(g, p.x + ((q.x - p.x) * s) / n, p.z + ((q.z - p.z) * s) / n);
        if (w === 1 || w === 3) return true;
      }
      return false;
    });
  [road.a, road.b].forEach((ref, end) => {
    const d = ref ? drawn(ref) : undefined,
      far = end === 0 ? road.to : road.from,
      way = d?.site?.roads.find((r) => r.to === far);
    if (!d || !way) return;
    const into = roadIntoTown(
      met,
      { x: d.x, z: d.z, r: d.reach },
      way.bearing,
      end === 1,
      d.edge ? Math.min(d.reach * 0.97, d.edge(way.bearing) + LAND_STEP) : d.reach * 0.97,
    );
    // (Only what it adds is read: its first three points from that end.)
    const added = end === 1 ? into.slice(-3) : into.slice(0, 3);
    if (!overWater(added)) met = into;
  });
  const out = met;
  return out.length < 2 ? null : out;
}

/**
 * What a land lays on its ground about its towns (bridge/claims.ts): its water first (its own tiles); then each town's
 * built ground out to its outline, the greatest first; then its roads; then its fields, the greatest town's first, each
 * field only where its town is the nearest that tills it and the ground is free. `roads`: the roads' ways as drawn.
 */
export function landLaid(
  g: LandGround,
  plan: Pick<LandPlan, "towns" | "undersea">,
  drawn: (ref: string) => LandDrawn | undefined,
  middle: (town: LandTown) => { x: number; z: number },
  roads: readonly (readonly { x: number; z: number }[])[],
): LandLaid {
  return runToEnd(landLaying(g, plan, drawn, middle, roads));
}

/** A land's ground as laid (landLaid). */
export type LandLaid = { claims: GroundClaims; fields: LandField[]; owner: Map<string, number> };

/** Run a laying to its end (each `yield` a place it may be broken off for a frame), and what it lays. */
export function runToEnd<T>(run: Generator<void, T>): T {
  for (;;) {
    const r = run.next();
    if (r.done) return r.value;
  }
}

/**
 * landLaid a town at a time: it yields after each town's ground and each town's fields, so that a land laid again as its
 * year turns can be laid over several frames (render/land.ts), none of them held long.
 */
export function* landLaying(
  g: LandGround,
  plan: Pick<LandPlan, "towns" | "undersea" | "sowing">,
  drawn: (ref: string) => LandDrawn | undefined,
  middle: (town: LandTown) => { x: number; z: number },
  roads: readonly (readonly { x: number; z: number }[])[],
): Generator<void, LandLaid> {
  const claims = landClaims(g, !!plan.undersea),
    order = [...plan.towns].sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1)),
    owner = new Map(order.map((t, i) => [t.ref, i])),
    circles = order.map((town) => {
      const d = drawn(town.ref),
        m = middle(town);
      return { ref: town.ref, x: m.x, z: m.z, r: d?.reach ?? 0.3, edge: d?.edge };
    });
  // (Each town's built ground, as far out as it is drawn each way: the greatest first, so that where two towns' ground
  // meets, the greater holds it.)
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i]!,
      d = drawn(c.ref);
    if (!d) continue;
    claims.star(c.x, c.z, c.edge ?? (() => c.r), GROUND.built, i);
    // (Its walls' line and what it holds, where they stand out past its lots.)
    const line = d.wall;
    if (line)
      claims.star(c.x, c.z, (a) => wallAt(line, a) * LAND_ACROSS + ROAD_TAKES, GROUND.wall, i);
    // (And every block it draws, where its outline between two bearings comes in past one.)
    for (let b = 0; d.blocks && b < (d.count ?? 0); b++)
      claims.rect(
        c.x + d.blocks.x[b]! * LAND_ACROSS,
        c.z + d.blocks.z[b]! * LAND_ACROSS,
        BLOCK_W * LAND_ACROSS,
        BLOCK_D * LAND_ACROSS,
        d.blocks.yaw[b]!,
        GROUND.built,
        i,
      );
    yield;
  }
  for (const line of roads) claims.line(line, ROAD_TAKES, GROUND.road, -1);
  yield;
  const fields: LandField[] = [];
  for (let i = 0; i < order.length; i++) {
    const c = circles[i]!;
    fields.push(
      ...(yield* landFieldsLaying(
        g,
        order[i]!,
        c.x,
        c.z,
        c.r,
        circles.filter((o) => o.ref !== c.ref),
        claims,
        c.edge,
        i,
        drawn(c.ref)?.lots,
        !!plan.sowing?.spires,
      )),
    );
    yield;
  }
  return { claims, fields, owner };
}

/** What a town's fields are sown with, as its own view reads them (its VillagePlan's): for landFieldLook. */
export type LandSown = Parameters<typeof fieldLook>[0];

/** A town of a land's fields as its own view would read them, `n` of them (host/village.ts villagePlan). */
export function landSown(
  plan: Pick<LandPlan, "era" | "sowing">,
  town: LandTown,
  n: number,
): LandSown {
  return {
    ref: town.ref,
    era: plan.era,
    // (Its ground's own; an old plan's: the temperate wood's.)
    biome: town.sow?.biome ?? 9,
    house: { walls: plan.sowing?.walls ?? "timber" } as LandSown["house"],
    seed: hashString(`village ${town.ref}`),
    // (Only how many, and each deep enough to be sown in rows, are read.)
    fields: Array.from({ length: n }, () => ({ x: 0, z: 0, w: 40, d: 26, yaw: 0 })),
  };
}

/**
 * A field's colour on its land at t: as its own view shows it from afar (view/fields.ts fieldLook), its crop in its land's
 * life's colours (Phase 57).
 */
export function landFieldLook(
  sown: LandSown,
  f: LandField,
  t: number,
  year: FieldsNow,
  lifeLook?: string,
): readonly [number, number, number] {
  return lifeTint(
    fieldLook(sown, f.k, t, year, { w: f.w / LAND_ACROSS, d: f.d / LAND_ACROSS }),
    lifeLook,
  );
}

/** The trees of a land not standing on its towns and fields (cleared for them). */
export function treesClear(
  g: LandGround,
  trees: readonly RegionTree[],
  clearings: readonly { x: number; z: number; r: number }[],
): RegionTree[] {
  if (!clearings.length) return [...trees];
  // (Each clearing kept in the squares of a grid it reaches into, a tree's own crown with it; each tree read against those
  // of its own square alone. Read against every clearing, a land of thousands of fields and as many trees took a phone a
  // quarter of a second each time its fields were laid again: 2026-11-20.)
  let most = 0;
  for (const t of trees) most = Math.max(most, 0.35 * t.size * g.tileKm);
  const step = g.tileKm * 2,
    cells = new Map<number, number[]>(),
    keyOf = (i: number, j: number) => (i + 32768) * 65536 + (j + 32768);
  clearings.forEach((c, k) => {
    const r = c.r + most;
    // (One greater than the whole land: read by every tree.)
    if (r > step * 64) return;
    for (let i = Math.floor((c.x - r) / step); i <= Math.floor((c.x + r) / step); i++)
      for (let j = Math.floor((c.z - r) / step); j <= Math.floor((c.z + r) / step); j++) {
        const key = keyOf(i, j),
          list = cells.get(key);
        if (list) list.push(k);
        else cells.set(key, [k]);
      }
  });
  const every = clearings.filter((c) => c.r + most > step * 64);
  return trees.filter((t) => {
    const m = tileMiddle(g, t.tile),
      x = m.x + t.dx * g.tileKm,
      z = m.z + t.dz * g.tileKm,
      half = 0.35 * t.size * g.tileKm,
      near = cells.get(keyOf(Math.floor(x / step), Math.floor(z / step)));
    if (every.some((c) => Math.hypot(x - c.x, z - c.z) <= c.r + half)) return false;
    return (
      !near ||
      near.every((k) => {
        const c = clearings[k]!;
        return Math.hypot(x - c.x, z - c.z) > c.r + half;
      })
    );
  });
}

/** The nearest dry tile to a tile (itself, if dry): a road's end on the land. */
function dryNear(g: LandGround, tile: number): number {
  if (g.water[tile] === 0 || g.water[tile] === 2) return tile;
  const i0 = tile % g.size,
    j0 = Math.floor(tile / g.size);
  for (let r = 1; r < 12; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = i0 + di,
          j = j0 + dj;
        if (i < 0 || j < 0 || i >= g.size || j >= g.size) continue;
        const t = j * g.size + i;
        if (g.water[t] === 0) return t;
      }
  return tile;
}

/** A road's way over the land between two tiles: round the sea and the lakes, easy on the climbs, bridging rivers where it must. */
export function roadTiles(
  g: LandGround,
  from: number,
  to: number,
  /** A people of the water's: along the seabed, and never ashore. */
  undersea = false,
): number[] {
  const a = undersea ? from : dryNear(g, from),
    b = undersea ? to : dryNear(g, to),
    n = g.size * g.size,
    cost = new Float64Array(n).fill(Infinity),
    came = new Int32Array(n).fill(-1),
    done = new Uint8Array(n),
    open = new MinHeap(),
    bi = b % g.size,
    bj = Math.floor(b / g.size),
    guess = (t: number) => {
      const di = Math.abs((t % g.size) - bi),
        dj = Math.abs(Math.floor(t / g.size) - bj);
      return (Math.max(di, dj) + 0.4142 * Math.min(di, dj)) * g.tileKm;
    };
  cost[a] = 0;
  open.push(guess(a), a);
  while (open.size) {
    const t = open.pop();
    if (t === b) break;
    if (done[t]) continue;
    done[t] = 1;
    const i = t % g.size,
      j = Math.floor(t / g.size);
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di,
          nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= g.size || nj >= g.size) continue;
        const s = nj * g.size + ni,
          w = g.water[s]!,
          barred = (q: number) =>
            undersea ? g.water[q] !== 1 : g.water[q] === 1 || g.water[q] === 3;
        if (done[s] || (barred(s) && s !== b)) continue;
        // (Not across a corner of the water: a step slantwise passes over the two tiles beside it, as the map draws them.)
        if (di && dj && (barred(j * g.size + ni) || barred(nj * g.size + i))) continue;
        const run = (di && dj ? Math.SQRT2 : 1) * g.tileKm,
          climb = Math.abs(g.heights[s]! - g.heights[t]!) / run,
          step = run * (1 + 5 * climb) + (w === 2 ? 2 * g.tileKm : 0),
          c = cost[t]! + step;
        if (c < cost[s]!) {
          cost[s] = c;
          came[s] = t;
          open.push(c + guess(s), s);
        }
      }
  }
  if (a !== b && came[b] === -1) return [];
  const path: number[] = [];
  for (let t = b; t !== -1; t = came[t]!) path.push(t);
  return path.reverse();
}

/** A road's line through its tiles' middles, its corners rounded (twice cut). */
export function roadLine(g: LandGround, tiles: readonly number[]): { x: number; z: number }[] {
  let line = tiles.map((t) => tileMiddle(g, t));
  for (let pass = 0; pass < 2 && line.length > 2; pass++) {
    const next = [line[0]!];
    for (let k = 0; k + 1 < line.length; k++) {
      const p = line[k]!,
        q = line[k + 1]!;
      next.push(
        { x: 0.75 * p.x + 0.25 * q.x, z: 0.75 * p.z + 0.25 * q.z },
        { x: 0.25 * p.x + 0.75 * q.x, z: 0.25 * p.z + 0.75 * q.z },
      );
    }
    next.push(line.at(-1)!);
    line = next;
  }
  return line;
}

/** How a road is drawn: trodden, paved, railed (with the road beside it) at a year. */
export function roadLook(road: LandRoad, year: number): "none" | "track" | "paved" | "rails" {
  if (year < road.since) return "none";
  if (road.rails !== null && year >= road.rails) return "rails";
  if (road.paved !== null && year >= road.paved) return "paved";
  return "track";
}

/** A road at a moment of a year (R1): what it is behind its gang and ahead of it, how far along the gang has got, and the gang. */
export type RoadNow = {
  readonly behind: "none" | "track" | "paved" | "rails";
  readonly ahead: "none" | "track" | "paved" | "rails";
  /** 0 to 1 along its line. */
  readonly share: number;
  readonly works: RoadWorks | null;
  /** The gang stands idle now: its last stop's why (null: at work). */
  readonly stopped: string | null;
};

/** How far a gang has got by year y, its idle years not counted. */
export function worksShare(w: RoadWorks, y: number): number {
  let idle = 0,
    idleAll = 0;
  for (const s of w.stops) {
    idleAll += s.to - s.from;
    if (y > s.from) idle += Math.min(y, s.to) - s.from;
  }
  const all = w.until - w.from - idleAll;
  return all > 0 ? Math.max(0, Math.min(1, (y - w.from - idle) / all)) : 1;
}

/** A road as it stands at year y (a share of the way through it): stage by stage where its stages are told, else all at once as it ever was. */
export function roadNow(road: LandRoad, y: number): RoadNow {
  const stages = road.stages;
  if (!stages?.length) {
    const look = roadLook(road, Math.floor(y));
    return { behind: look, ahead: look, share: 1, works: null, stopped: null };
  }
  let done: RoadNow["behind"] = "none";
  for (const s of stages) {
    if (y >= s.until && (road.works?.what !== s.what || road.works.again || y >= road.works.until))
      done = s.what;
  }
  const w = road.works && y >= road.works.from && y < road.works.until ? road.works : null;
  if (!w) return { behind: done, ahead: done, share: 1, works: null, stopped: null };
  const stop = w.stops.find((s) => y >= s.from && y < s.to);
  return {
    behind: w.again ? done : w.what,
    ahead: done,
    share: worksShare(w, y),
    works: w,
    stopped: stop?.why ?? null,
  };
}

/** A line cut at a share of its length: the part before and the part after, each with the point between. */
export function cutLine(
  line: readonly { x: number; z: number }[],
  share: number,
): [{ x: number; z: number }[], { x: number; z: number }[]] {
  if (share <= 0) return [[], [...line]];
  if (share >= 1 || line.length < 2) return [[...line], []];
  let whole = 0;
  for (let k = 0; k + 1 < line.length; k++)
    whole += Math.hypot(line[k + 1]!.x - line[k]!.x, line[k + 1]!.z - line[k]!.z);
  let left = share * whole;
  for (let k = 0; k + 1 < line.length; k++) {
    const p = line[k]!,
      q = line[k + 1]!,
      len = Math.hypot(q.x - p.x, q.z - p.z);
    if (left <= len && len > 0) {
      const at = { x: p.x + ((q.x - p.x) * left) / len, z: p.z + ((q.z - p.z) * left) / len };
      return [
        [...line.slice(0, k + 1), at],
        [at, ...line.slice(k + 1)],
      ];
    }
    left -= len;
  }
  return [[...line], []];
}

/**
 * A land's tracks between its camps and hamlets, before anyone lays a road: each to the nearest of those about it, as bands and hamlets go between
 * them. In tiles; none between two a road already joins, and none past a day's walk.
 */
export function campTracks(
  camps: readonly { readonly home: number }[],
  towns: readonly { readonly tile: number }[],
  roads: readonly { readonly from: number; readonly to: number }[],
  size: number,
  most = 28,
): (readonly [number, number])[] {
  const sites = [...camps.map((c) => c.home), ...towns.map((t) => t.tile)],
    joined = new Set(roads.flatMap((r) => [`${r.from}-${r.to}`, `${r.to}-${r.from}`])),
    d2 = (a: number, b: number) =>
      ((a % size) - (b % size)) ** 2 + (Math.floor(a / size) - Math.floor(b / size)) ** 2,
    out: (readonly [number, number])[] = [],
    seen = new Set<string>();
  sites.forEach((a, i) => {
    let best = -1,
      far = 34 * 34;
    sites.forEach((b, j) => {
      if (i === j || a === b) return;
      const d = d2(a, b);
      if (d < far) {
        far = d;
        best = j;
      }
    });
    if (best < 0) return;
    const b = sites[best]!,
      key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key) || joined.has(`${a}-${b}`) || out.length >= most) return;
    seen.add(key);
    out.push([a, b]);
  });
  return out;
}

/**
 * A road's line cut where it enters a town's ground (its ends' towns', of `reach` each): it runs
 * to their edges, not through their blocks.
 */
export function roadOutside(
  line: readonly { x: number; z: number }[],
  towns: readonly { x: number; z: number; r: number }[],
): { x: number; z: number }[] {
  return line.filter((p) => towns.every((t) => Math.hypot(p.x - t.x, p.z - t.z) > t.r));
}

/**
 * A road's line as it meets a town's main street (asked 2026-11-16: the land's map and the town's own view of it agree): it
 * leaves the town's edge on the bearing its street runs out by (TownSite's road), and bends onto its way over the land past
 * twice the town's reach. `atEnd`: the town is at the line's end, not its start.
 */
export function roadIntoTown(
  line: readonly { x: number; z: number }[],
  town: { x: number; z: number; r: number },
  bearing: number,
  atEnd = false,
  /** How far out from its square the road meets it (default: nearly its whole reach). */
  enter = town.r * 0.97,
): { x: number; z: number }[] {
  const way = atEnd ? [...line].reverse() : [...line],
    far = 2 * town.r;
  let k = 0;
  while (k < way.length - 1 && Math.hypot(way[k]!.x - town.x, way[k]!.z - town.z) < far) k++;
  const c = Math.cos(bearing),
    s = Math.sin(bearing),
    out = [
      { x: town.x + c * enter, z: town.z + s * enter },
      { x: town.x + c * town.r * 1.4, z: town.z + s * town.r * 1.4 },
      ...way.slice(k),
    ];
  return atEnd ? out.reverse() : out;
}

/**
 * Whether something `r` about a point lies on any of these lines (region units), read by where the lines go: a land
 * built over asks it of thousands of blocks.
 */
export function onLines(
  lines: readonly (readonly { x: number; z: number }[])[],
): (x: number, z: number, r: number) => boolean {
  const CELL = 8,
    cells = new Map<number, number[]>(),
    keyOf = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096);
  for (const line of lines)
    for (let k = 0; k + 1 < line.length; k++) {
      const p = line[k]!,
        q = line[k + 1]!,
        n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / (CELL / 2)) + 1,
        seen = new Set<number>();
      for (let s = 0; s <= n; s++) {
        const key = keyOf(
          Math.floor((p.x + ((q.x - p.x) * s) / n) / CELL),
          Math.floor((p.z + ((q.z - p.z) * s) / n) / CELL),
        );
        if (seen.has(key)) continue;
        seen.add(key);
        const c = cells.get(key);
        if (c) c.push(p.x, p.z, q.x, q.z);
        else cells.set(key, [p.x, p.z, q.x, q.z]);
      }
    }
  return (x, z, r) => {
    const i1 = Math.floor((x + r) / CELL),
      j1 = Math.floor((z + r) / CELL);
    for (let i = Math.floor((x - r) / CELL); i <= i1; i++)
      for (let j = Math.floor((z - r) / CELL); j <= j1; j++) {
        const c = cells.get(keyOf(i, j));
        if (!c) continue;
        for (let o = 0; o < c.length; o += 4) {
          const dx = c[o + 2]! - c[o]!,
            dz = c[o + 3]! - c[o + 1]!,
            len = dx * dx + dz * dz,
            u = len ? Math.max(0, Math.min(1, ((x - c[o]!) * dx + (z - c[o + 1]!) * dz) / len)) : 0,
            ex = c[o]! + u * dx - x,
            ez = c[o + 1]! + u * dz - z;
          if (ex * ex + ez * ez < r * r) return true;
        }
      }
    return false;
  };
}

/**
 * Pieces of a line laid on the ground, a piece every `step` at most: [x, y, z, length, yaw, pitch]
 * each, its middle `lift` over the ground (lengths and heights in region units).
 */
export function linePieces(
  g: LandGround,
  line: readonly { x: number; z: number }[],
  lift: number,
  step = 0.3,
  /** What it lies on: the ground, or (a people of the water's) the seabed. */
  floor: (g: LandGround, x: number, z: number) => number = groundAt,
): number[][] {
  const out: number[][] = [];
  for (let k = 0; k + 1 < line.length; k++) {
    const p = line[k]!,
      q = line[k + 1]!,
      run = Math.hypot(q.x - p.x, q.z - p.z),
      n = Math.max(1, Math.ceil(run / step));
    for (let s = 0; s < n; s++) {
      const x0 = p.x + ((q.x - p.x) * s) / n,
        z0 = p.z + ((q.z - p.z) * s) / n,
        x1 = p.x + ((q.x - p.x) * (s + 1)) / n,
        z1 = p.z + ((q.z - p.z) * (s + 1)) / n,
        y0 = floor(g, x0, z0) + lift,
        y1 = floor(g, x1, z1) + lift,
        dx = x1 - x0,
        dz = z1 - z0,
        flat = Math.hypot(dx, dz);
      if (flat < 1e-6) continue;
      out.push([
        (x0 + x1) / 2,
        (y0 + y1) / 2,
        (z0 + z1) / 2,
        Math.hypot(flat, y1 - y0) + 0.01,
        Math.atan2(dx, dz),
        Math.atan2(-(y1 - y0), flat),
      ]);
    }
  }
  return out;
}

// —— Traffic on the land (Phase 26 M153) ————————————————————————————————————————————————

/**
 * A sea lane's way over the water, region units: from the sea beside its port out across the sea
 * as far as it reaches the way the far land lies (the map's edge, where the sea runs to it), round
 * the land between; none where no sea is at hand.
 */
export function laneLine(
  g: LandGround,
  from: number,
  dx: number,
  dz: number,
): { x: number; z: number }[] {
  const size = g.size,
    sea = (t: number) => g.water[t] === 1,
    i0 = from % size,
    j0 = Math.floor(from / size);
  // The sea beside the port.
  let start = -1;
  for (let r = 1; r <= 2 && start < 0; r++)
    for (let dj = -r; dj <= r && start < 0; dj++)
      for (let di = -r; di <= r && start < 0; di++) {
        const i = i0 + di,
          j = j0 + dj;
        if (i >= 0 && j >= 0 && i < size && j < size && sea(j * size + i)) start = j * size + i;
      }
  if (start < 0) return [];
  // The sea reached from it, and the farthest of it the way the far land lies.
  const seen = new Uint8Array(size * size),
    queue = [start];
  seen[start] = 1;
  let goal = start,
    best = -Infinity;
  for (let q = 0; q < queue.length; q++) {
    const t = queue[q]!,
      i = t % size,
      j = Math.floor(t / size),
      along = i * dx + j * dz;
    if (along > best + 1e-9) {
      best = along;
      goal = t;
    }
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const ni = i + di,
        nj = j + dj,
        s = nj * size + ni;
      if (ni < 0 || nj < 0 || ni >= size || nj >= size || seen[s] || !sea(s)) continue;
      seen[s] = 1;
      queue.push(s);
    }
  }
  if (goal === start) return [];
  // Over the sea alone (a ground with every land tile walled off, and flat: a ship climbs no depths).
  const water = new Uint8Array(size * size);
  for (let t = 0; t < size * size; t++) water[t] = sea(t) ? 0 : 1;
  const tiles = roadTiles({ ...g, water, heights: new Float32Array(size * size) }, start, goal);
  return tiles.length ? roadLine(g, tiles) : [];
}

/** A way's line with the length run to each of its points (region units), for things going along it. */
export type Way = {
  readonly line: readonly { x: number; z: number }[];
  readonly run: Float64Array;
  readonly length: number;
};

export function wayOf(line: readonly { x: number; z: number }[]): Way {
  const run = new Float64Array(line.length);
  for (let k = 1; k < line.length; k++)
    run[k] = run[k - 1]! + Math.hypot(line[k]!.x - line[k - 1]!.x, line[k]!.z - line[k - 1]!.z);
  return { line, run, length: line.length ? run[line.length - 1]! : 0 };
}

/**
 * Where something going along a way is at `s` of its length to and fro (0 … 2 × its length: out,
 * then back), kept to its right by `aside`: its point and its heading (yaw).
 */
export function alongWay(w: Way, s: number, aside = 0): { x: number; z: number; yaw: number } {
  const L = w.length,
    m = L > 0 ? ((s % (2 * L)) + 2 * L) % (2 * L) : 0,
    back = m > L,
    d = back ? 2 * L - m : m;
  // (The first point at or past d: halved toward it.)
  let lo = 1,
    hi = Math.max(1, w.line.length - 1);
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (w.run[mid]! < d) lo = mid + 1;
    else hi = mid;
  }
  const k = lo;
  const a = w.line[k - 1]!,
    b = w.line[k] ?? a,
    span = w.run[k]! - w.run[k - 1]! || 1,
    f = Math.max(0, Math.min(1, (d - w.run[k - 1]!) / span)),
    ux = (b.x - a.x) / span,
    uz = (b.z - a.z) / span,
    hx = back ? -ux : ux,
    hz = back ? -uz : uz;
  return {
    // (Its right: the heading turned a quarter clockwise, seen from above.)
    x: a.x + (b.x - a.x) * f - hz * aside,
    z: a.z + (b.z - a.z) * f + hx * aside,
    yaw: Math.atan2(hx, hz),
  };
}

/** What goes along a land's ways at an era: on its roads, on its rails, on its sea lanes. */
export const CARRIERS: Readonly<
  Record<
    "forage" | "farm" | "metal" | "industry" | "modern",
    { road: "none" | "cart" | "wagon" | "truck"; sea: "none" | "sail" | "steam" }
  >
> = {
  forage: { road: "none", sea: "none" },
  farm: { road: "cart", sea: "sail" },
  metal: { road: "wagon", sea: "sail" },
  industry: { road: "wagon", sea: "steam" },
  modern: { road: "truck", sea: "steam" },
};

// —— A land's towns watched growing (Phase 26 M154) ———————————————————————————————————————

/**
 * What each town of a land did between two of its plans, in a few words for its label — the two
 * greatest of: founded, become a city, a building begun, its walls begun, homes raised on new
 * lots, homes rebuilt higher (by its towns' refs; none for a town that did nothing, nor where the
 * clock went back).
 */
export function landTidings(prev: LandPlan | null, next: LandPlan): Map<string, string> {
  const out = new Map<string, string>();
  if (!prev || next.t <= prev.t) return out;
  const before = new Map(prev.towns.map((t) => [t.ref, t])),
    was = Math.floor(prev.t / YEAR),
    now = Math.floor(next.t / YEAR),
    // (A run's lots, shared over its years, as many as fell in the years between.)
    within = (first: number, last: number, lots: number) => {
      const span = last + 1 - first,
        over = Math.min(now + 1, last + 1) - Math.max(was + 1, first);
      return over > 0 && span > 0 ? (lots * over) / span : 0;
    };
  for (const t of next.towns) {
    const p = before.get(t.ref),
      said: string[] = [];
    if (!p) {
      if (t.founded > was) said.push("founded");
    } else {
      if (t.city && !p.city) said.push("now a city");
      const begun = (t.plan?.civics ?? []).filter((c) => c.start > was && c.start <= now),
        // (New lots, but for those a building was begun on.)
        newLots =
          (t.plan?.whole ?? 0) -
          (p.plan?.whole ?? 0) -
          begun.filter((c) => c.at >= (p.plan?.whole ?? 0)).reduce((n, c) => n + c.lots, 0);
      const first = begun[0];
      if (first) said.push(`${civic(first.kind as CivicKind).name} begun`);
      if (t.plan?.walls && t.plan.walls.start > was && t.plan.walls.start <= now)
        said.push("walls begun");
      if (newLots > 0) said.push(`+${newLots} ${newLots === 1 ? "home" : "homes"}`);
      let higher = 0;
      for (const r of t.plan?.runs ?? [])
        if (r[0] === 1) higher += within(r[3]!, r[4]!, r[2]! - r[1]!);
      const up = Math.round(higher);
      if (up > 0) said.push(`${up} rebuilt higher`);
    }
    if (said.length) out.set(t.ref, said.slice(0, 2).join(", "));
  }
  return out;
}

/** A camp's name on the land (Phase 28 M159): its bands, whether they herd, how many they are. */
export function campWords(c: LandCamp): string {
  if (c.fled)
    return `⛺ ${c.people.toLocaleString("en-US")} fled ${c.fled.why}, from ${c.fled.from}`;
  const who = c.bands > 1 ? `${c.bands} bands` : "a band";
  return `${c.herds ? "🐑" : "⛺"} ${who}${c.herds ? " of herders" : ""} · ${c.people}`;
}
