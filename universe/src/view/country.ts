// The countryside about a town, as Classic drew it (Phase 32 M170–M172, asked for 2026-10-24:
// "i cant see the cities form and evolve and get that type of detail i got from the og
// causalisis"): each field bounded in its land's manner — a hedgerow where the land grows broad
// leaves, a drystone wall where its homes are of stone, a post-and-rail fence where of timber,
// wattle hurdles, an earth bank where of mud and brick — with a gap toward the town; the crop in
// rows, a patchwork of grain going gold at the reaping, greens and fallow grass; one field in five
// an orchard, its trees in rows, white with blossom in spring and hung with fruit at the summer's
// end; barns by the outermost fields and sheds by the far ones; hay standing in the stubble after the
// reaping (rolled in round bales once the land has engines); scarecrows over the growing corn;
// windmills on the fields' rim once the land works metal, their sails turning, and tall wind
// turbines in the modern age; silos by the barns from the engines' age, and tractors in the
// modern one — out on their fields at the sowing and the harvest by day, waiting at the gate
// between; the pasture fenced, its trough, and a rack of hay where no flock grazes — where one
// does, its fold of hurdles (Phase 46 M208), racks of hay in it for the winter. And by its
// water (M173, as Classic's seafaring drew its docks): a jetty out from the shore nearest the
// town, and its boats as its age builds them — rowing boats, sailing boats once it works metal,
// steam launches, motor boats — out on the water by day, tied up at the jetty by night and while
// the water is frozen. Pure: the same plan, the same countryside; what moves (a tractor, the
// sails, the boats) by the moment and the screen's clock.
import { LAKE_R, type VillagePlan } from "../bridge/index.ts";
import { hashText, unitOf } from "./draws.ts";
import { HARVEST, SOWING } from "./seasons.ts";
import { foldOf, foldReach } from "./flock.ts";

const DAY = 86_400,
  YEAR = 365 * DAY;

/** How a land bounds its fields. */
export type Manner = "hedge" | "wall" | "fence" | "hurdle" | "bank" | "ridge";

/** A town's boats, by its age: rowing boats, sailing boats, steam launches, motor boats. */
export type Boat = "row" | "sail" | "steam" | "motor";

/** What a sown field grows: grain (green, gold at the reaping), greens (roots and beans), or fallow grass. */
export type Crop = "grain" | "greens" | "fallow";

type Rgb = readonly [number, number, number];

/** A piece of the countryside: its middle (metres from the town's; y up), its size, its turn. */
export type Piece = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly yaw: number;
};

/** Where a thing stands (metres from the town's middle), and which way it faces. */
export type Spot = { readonly x: number; readonly z: number; readonly yaw: number };

export type Country = {
  /** Each of the plan's fields: an orchard (true), or sown. */
  readonly orchard: readonly boolean[];
  /** What each of the plan's fields grows (null: an orchard). */
  readonly crop: readonly (Crop | null)[];
  /** How the fields are bounded (null: they are not, the grounds of a foraging people). */
  readonly manner: Manner | null;
  /** The bounds along the fields' edges — hedges, walls, banks, hurdles or rails — a gap toward the town. */
  readonly bounds: readonly Piece[];
  /** The posts of the fences and the stakes of the hurdles. */
  readonly posts: readonly Piece[];
  /**
   * The rows of the crop across the sown fields (none across the fallow), by what they grow: each
   * of its field (its place in the plan's fields) and its place among the field's rows (from the
   * field's near side). Laid out flat (`sy` one): the year stands them (view/fields.ts).
   */
  readonly rows: readonly (Piece & {
    readonly crop: Crop;
    readonly field: number;
    readonly row: number;
  })[];
  /** The orchards' trees, in rows: where, and how big against a common one. */
  readonly trees: readonly { readonly x: number; readonly z: number; readonly size: number }[];
  /** Barns by the outermost fields, and sheds by the far ones. */
  readonly barns: readonly (Spot & {
    readonly w: number;
    readonly d: number;
    readonly h: number;
  })[];
  /** Silos by the barns (from the engines' age): steel, or the blue of the modern ones. */
  readonly silos: readonly (Spot & {
    readonly r: number;
    readonly h: number;
    readonly blue: boolean;
  })[];
  /** Where hay stands after the reaping, a few to a field. */
  readonly hay: readonly Spot[];
  /** Whether the hay is rolled in round bales (the engines' age on), else stacked. */
  readonly bales: boolean;
  /** Scarecrows over the growing corn (before the engines' age). */
  readonly scarecrows: readonly Spot[];
  /** Windmills on the fields' rim (a land that works metal, until the modern age), or wind turbines (modern). */
  readonly mills: readonly (Spot & { readonly kind: "mill" | "turbine" })[];
  /** Tractors (the modern age): the field each works, the gate it waits at, and its paint. */
  readonly tractors: readonly {
    readonly field: number;
    readonly gate: Spot;
    readonly paint: number;
  }[];
  /**
   * By its water (null: none): the jetty's deck and piles, its boats' kind, and each boat's
   * mooring at the jetty and the stretch of water it goes about by day.
   */
  readonly water: {
    readonly pier: readonly Piece[];
    readonly boat: Boat;
    readonly boats: readonly {
      readonly mooring: Spot;
      readonly out: { readonly x: number; readonly z: number; readonly r: number };
    }[];
  } | null;
  /** The pasture's fence (its rails and posts, a gap toward the town); its trough; its rack of hay if no flock grazes. */
  readonly pen: {
    readonly rails: readonly Piece[];
    readonly posts: readonly Piece[];
    readonly trough: Spot | null;
    readonly rack: Spot | null;
    /**
     * Where a flock is kept (Phase 46 M208), its fold: hurdles round where it lies by night, open
     * toward the town and toward the pasture; a rack at each side within (filled with hay in
     * winter); where its fleeces are piled on the day of the shearing.
     */
    readonly fold: {
      readonly hurdles: readonly Piece[];
      readonly racks: readonly Spot[];
      readonly fleeces: Spot;
    } | null;
  };
};

/** How much of the fields are orchards; of the outer fields, how many have a barn; and so on. */
const ORCHARD_SHARE = 0.2,
  GREENS_SHARE = 0.28,
  FALLOW_SHARE = 0.14,
  BARN_SHARE = 0.45,
  SHED_SHARE = 0.3,
  SILO_SHARE = 0.5,
  HAY_SHARE = 0.5,
  SCARECROW_SHARE = 0.34,
  TRACTOR_SHARE = 0.34,
  TRACTORS_MOST = 6,
  SCARECROWS_MOST = 14;
/** A hedge's, a wall's, a bank's height and breadth (metres); the fences' posts apart. */
const BOUND: Readonly<Record<Manner, { h: number; w: number; posts: number }>> = {
  hedge: { h: 1.7, w: 1.3, posts: 0 },
  wall: { h: 1.05, w: 0.7, posts: 0 },
  bank: { h: 0.8, w: 1.8, posts: 0 },
  ridge: { h: 0.55, w: 1.4, posts: 0 },
  fence: { h: 0.1, w: 0.12, posts: 4 },
  hurdle: { h: 1.0, w: 0.14, posts: 2 },
};
/** The gate's gap in a field's bound, as a share of its side. */
const GAP: readonly [number, number] = [0.38, 0.62];
/** The orchards' trees apart (metres). */
const TREE_GAP = 7;
/** The crop's rows apart, and the furrow between them; their ends in from the field's bound (metres). */
export const ROW_GAP = 3,
  FURROW = 0.7,
  ROW_ENDS = 1.25;
/** The pasture's posts apart; the jetty's length out over the water (metres). */
const PEN_POST = 6,
  PIER = 32;
/** A hurdle's length (metres); how wide the fold is open each way (radians either side). */
const HURDLE = 2.2,
  FOLD_OPEN = 0.45;
/** Lands that grow broad leaves enough for hedgerows (gen's BIOME codes: steppe, the temperate and tropical woods, savanna). */
const HEDGED = new Set([8, 9, 10, 12, 13, 14]);

/** What a field is: its middle, its size along its own two ways, its turn. */
type Field = VillagePlan["fields"][number];

/** A point of a field, by its own ways: u along its width (−½ … ½), v along its depth. */
export function fieldPoint(f: Field, u: number, v: number): { x: number; z: number } {
  const c = Math.cos(f.yaw),
    s = Math.sin(f.yaw),
    a = u * f.w,
    b = v * f.d;
  return { x: f.x + c * a + s * b, z: f.z - s * a + c * b };
}

/** How the land bounds its fields: by what it builds with, and whether it grows broad leaves. */
export function mannerOf(plan: Pick<VillagePlan, "era" | "biome" | "house">): Manner | null {
  if (plan.era === "forage" || plan.biome === 16) return null;
  const walls = plan.house.walls;
  if (walls === "stone") return "wall";
  if (walls === "timber") return "fence";
  if (["reef-walls", "shell-walls", "burrow"].includes(walls)) return "ridge";
  if (HEDGED.has(plan.biome)) return "hedge";
  return walls === "mudbrick" || walls === "brick" ? "bank" : "hurdle";
}

/** How many rows of its crop a field is sown in (along its width, across its depth). */
export function rowsOf(f: Pick<Field, "d">): number {
  return Math.max(0, Math.ceil((f.d - 1) / ROW_GAP) - 1);
}

const CROPS = new WeakMap<
  Pick<VillagePlan, "fields">,
  { readonly orchard: readonly boolean[]; readonly crop: readonly (Crop | null)[] }
>();

/**
 * What each of a town's fields is: an orchard (where trees grow at all), or sown with grain,
 * greens or left fallow — the same fields the same, each by its own draw; a foraging people's
 * grounds all grass and seed (`grain`, never bounded nor sown in rows).
 */
export function cropsOf(plan: Pick<VillagePlan, "ref" | "era" | "biome" | "house" | "fields">): {
  readonly orchard: readonly boolean[];
  readonly crop: readonly (Crop | null)[];
} {
  const known = CROPS.get(plan);
  if (known) return known;
  const seed = hashText(`country ${plan.ref}`),
    draw = (i: number, n: number) => unitOf(seed, i, n),
    // (An orchard wants a land where trees grow at all.)
    orchards = !!mannerOf(plan) && ![5, 7, 11, 15].includes(plan.biome),
    orchard = plan.fields.map((_, k) => orchards && draw(k, 1) < ORCHARD_SHARE),
    crop = plan.fields.map((_, k): Crop | null => {
      if (!mannerOf(plan)) return "grain";
      if (orchard[k]) return null;
      const u = draw(k, 14);
      return u < FALLOW_SHARE ? "fallow" : u < FALLOW_SHARE + GREENS_SHARE ? "greens" : "grain";
    }),
    out = { orchard, crop };
  CROPS.set(plan, out);
  return out;
}

/**
 * The countryside about a town: built once for its plan. `detail` is the setting's (0 plain …
 * 3 the finest): the pasture's second rail from 1.
 */
export function countryOf(plan: VillagePlan, detail = 1): Country {
  const manner = mannerOf(plan),
    era = plan.era ?? "farm",
    seed = hashText(`country ${plan.ref}`),
    draw = (i: number, n: number) => unitOf(seed, i, n),
    fields = plan.fields,
    none: Country = {
      orchard: fields.map(() => false),
      crop: fields.map(() => "grain"),
      manner,
      bounds: [],
      posts: [],
      rows: [],
      trees: [],
      barns: [],
      silos: [],
      hay: [],
      bales: false,
      scarecrows: [],
      mills: [],
      tractors: [],
      water: null,
      pen: { rails: [], posts: [], trough: null, rack: null, fold: null },
    };
  if (!manner) return none;
  const engines = era === "industry" || era === "modern",
    modern = era === "modern",
    { orchard, crop } = cropsOf(plan);
  const bounds: Country["bounds"][number][] = [],
    posts: Piece[] = [],
    rows: Country["rows"][number][] = [],
    trees: { x: number; z: number; size: number }[] = [],
    hay: Spot[] = [],
    scarecrows: Spot[] = [],
    gates: Spot[] = [],
    b = BOUND[manner];
  fields.forEach((f, k) => {
    // The four sides, by the field's own ways: each its two ends (u, v); the gate in the one
    // nearest the town's middle.
    const sides = [
        [-0.5, -0.5, 0.5, -0.5],
        [0.5, -0.5, 0.5, 0.5],
        [0.5, 0.5, -0.5, 0.5],
        [-0.5, 0.5, -0.5, -0.5],
      ] as const,
      mids = sides.map(([u0, v0, u1, v1]) => fieldPoint(f, (u0 + u1) / 2, (v0 + v1) / 2)),
      gate = mids
        .map((m, i) => ({ i, r: Math.hypot(m.x, m.z) }))
        .sort((p, q) => p.r - q.r || p.i - q.i)[0]!.i;
    sides.forEach(([u0, v0, u1, v1], i) => {
      const along = i % 2 === 0 ? f.w : f.d,
        spans: (readonly [number, number])[] =
          i === gate
            ? [
                [0, GAP[0]],
                [GAP[1], 1],
              ]
            : [[0, 1]];
      for (const [a, c] of spans) {
        const from = fieldPoint(f, u0 + (u1 - u0) * a, v0 + (v1 - v0) * a),
          to = fieldPoint(f, u0 + (u1 - u0) * c, v0 + (v1 - v0) * c),
          len = along * (c - a),
          yaw = Math.atan2(to.x - from.x, to.z - from.z);
        // (Fences' rails at two heights; the rest one length of hedge, wall or bank.)
        const heights = manner === "fence" ? (detail ? [0.55, 1.05] : [0.85]) : [b.h / 2];
        for (const y of heights)
          bounds.push({
            x: (from.x + to.x) / 2,
            y,
            z: (from.z + to.z) / 2,
            sx: b.w,
            sy: b.h,
            sz: len,
            yaw,
          });
        if (b.posts)
          for (let n = 0, count = Math.max(1, Math.round(len / b.posts)); n <= count; n++) {
            const p = n / count;
            posts.push({
              x: from.x + (to.x - from.x) * p,
              y: manner === "fence" ? 0.65 : 0.6,
              z: from.z + (to.z - from.z) * p,
              sx: manner === "fence" ? 0.18 : 0.08,
              sy: manner === "fence" ? 1.3 : 1.2,
              sz: manner === "fence" ? 0.18 : 0.08,
              yaw,
            });
          }
      }
    });
    // The gate: the gap's middle, a little out, facing in.
    const [gu0, gv0, gu1, gv1] = sides[gate]!,
      inner = fieldPoint(f, (gu0 + gu1) / 2, (gv0 + gv1) / 2),
      out = Math.hypot(inner.x - f.x, inner.z - f.z) || 1,
      gx = inner.x + ((inner.x - f.x) / out) * 3,
      gz = inner.z + ((inner.z - f.z) / out) * 3;
    gates.push({ x: gx, z: gz, yaw: Math.atan2(f.x - gx, f.z - gz) });
    if (orchard[k]) {
      // Trees in rows, a few metres in from the bound.
      const cols = Math.max(2, Math.floor((f.w - 6) / TREE_GAP) + 1),
        lines = Math.max(2, Math.floor((f.d - 6) / TREE_GAP) + 1);
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < lines; j++) {
          const p = fieldPoint(
            f,
            (i - (cols - 1) / 2) * (TREE_GAP / f.w),
            (j - (lines - 1) / 2) * (TREE_GAP / f.d),
          );
          trees.push({ x: p.x, z: p.z, size: 0.85 + 0.3 * draw(1000 + trees.length, 2) });
        }
      return;
    }
    // The crop in rows along its width (grass lies as it grows), a furrow between each two.
    const sown = crop[k]!;
    if (sown !== "fallow")
      for (let j = 0, n = rowsOf(f); j < n; j++) {
        const p = fieldPoint(f, 0, (j + 1) * (ROW_GAP / f.d) - 0.5);
        rows.push({
          x: p.x,
          y: 0,
          z: p.z,
          sx: f.w - 2 * ROW_ENDS,
          sy: 1,
          sz: ROW_GAP - FURROW,
          yaw: f.yaw,
          crop: sown,
          field: k,
          row: j,
        });
      }
    if (sown !== "grain") return;
    // Hay after the reaping on one field of grain in two, three to the field; a scarecrow on one in three.
    if (draw(k, 3) < HAY_SHARE)
      for (const [u, v] of [
        [-0.25, -0.15],
        [0.05, 0.2],
        [0.3, -0.1],
      ] as const) {
        const p = fieldPoint(f, u, v);
        hay.push({ x: p.x, z: p.z, yaw: f.yaw + draw(k * 3 + hay.length, 4) * Math.PI });
      }
    if (!engines && scarecrows.length < SCARECROWS_MOST && draw(k, 5) < SCARECROW_SHARE) {
      const p = fieldPoint(f, 0.1, 0.05);
      scarecrows.push({ x: p.x, z: p.z, yaw: f.yaw + draw(k, 6) * 0.8 });
    }
  });
  // Barns by the outermost fields, out past them, silos beside them from the engines' age; sheds
  // by the far fields (past the middle of the fields' reach), in the gap before the next ring.
  const radius = (f: Field) => Math.hypot(f.x, f.z),
    rim = fields.reduce((m, f) => Math.max(m, radius(f) + Math.max(f.w, f.d) / 2), 0),
    outermost = fields.length ? Math.max(...fields.map(radius)) : 0,
    middle = [...fields.map(radius)].sort((a, c) => a - c)[Math.floor(fields.length / 2)] ?? 0,
    barns: Country["barns"][number][] = [],
    silos: Country["silos"][number][] = [];
  fields.forEach((f, k) => {
    if (orchard[k]) return;
    const r = radius(f) || 1,
      yaw = Math.atan2(-f.x, -f.z),
      outer = radius(f) >= outermost - 50;
    if (!outer || draw(k, 7) >= BARN_SHARE) {
      if (radius(f) > middle && draw(k, 15) < SHED_SHARE) {
        const out = Math.max(f.w, f.d) / 2 + 4.5;
        barns.push({
          x: f.x + (f.x / r) * out,
          z: f.z + (f.z / r) * out,
          yaw,
          w: 6,
          d: 4.5,
          h: 2.8,
        });
      }
      return;
    }
    const out = Math.max(f.w, f.d) / 2 + 9,
      x = f.x + (f.x / r) * out,
      z = f.z + (f.z / r) * out;
    barns.push({ x, z, yaw, w: 11, d: 8, h: 4.2 });
    if (engines && draw(k, 8) < SILO_SHARE) {
      // (Beside the barn, along the rim.)
      const side = 9.5;
      silos.push({
        x: x + Math.cos(yaw) * side,
        z: z - Math.sin(yaw) * side,
        yaw,
        r: 2.4,
        h: modern ? 14 : 11,
        blue: modern && draw(k, 9) < 0.5,
      });
    }
  });
  // Windmills on the rim toward the fields (two or three for many fields); turbines further out
  // in the modern age — clear of the road and the water.
  const fan = Math.atan2(
      fields.reduce((a, f) => a + f.z, 0),
      fields.reduce((a, f) => a + f.x, 0),
    ),
    roadWay = Math.atan2(plan.road.z, plan.road.x),
    apart = (a: number, c: number) =>
      Math.abs(((((a - c) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI),
    clear = (x: number, z: number, room: number) =>
      (!plan.water || Math.hypot(x - plan.water.x, z - plan.water.z) > LAKE_R + room) &&
      Math.hypot(x - plan.pasture.x, z - plan.pasture.z) > plan.pasture.r + room &&
      apart(Math.atan2(z, x), roadWay) * Math.hypot(x, z) > 24 &&
      (!plan.districts || apart(Math.atan2(z, x), roadWay + Math.PI) * Math.hypot(x, z) > 24),
    wind = draw(0, 10) * 2 * Math.PI,
    mills: Country["mills"][number][] = [],
    milling = era === "metal" || era === "industry",
    count = modern
      ? 3 + Math.floor(draw(0, 11) * 3)
      : milling
        ? fields.length >= 60
          ? 3
          : fields.length >= 30
            ? 2
            : fields.length >= 8
              ? 1
              : 0
        : 0;
  for (let i = 0; mills.length < count && i < 24; i++) {
    const step = Math.ceil(i / 2) * (i % 2 ? 1 : -1),
      a = fan + step * (modern ? 0.16 : 0.42),
      r = rim + (modern ? 70 : 22),
      x = r * Math.cos(a),
      z = r * Math.sin(a);
    if (clear(x, z, modern ? 40 : 20))
      mills.push({ x, z, yaw: wind, kind: modern ? "turbine" : "mill" });
  }
  // Tractors in the modern age: one to a few sown fields, each waiting at its field's gate.
  const tractors: Country["tractors"][number][] = [];
  if (modern)
    fields.forEach((_, k) => {
      if (
        crop[k] !== null &&
        crop[k] !== "fallow" &&
        tractors.length < TRACTORS_MOST &&
        draw(k, 12) < TRACTOR_SHARE
      )
        tractors.push({ field: k, gate: gates[k]!, paint: Math.floor(draw(k, 13) * 3) });
    });
  // The pasture fenced round, its gap toward the town; its trough toward the town, and a rack of
  // hay beside it where no flock grazes.
  const p = plan.pasture,
    toward = Math.atan2(-p.z, -p.x),
    n = Math.max(12, Math.round((2 * Math.PI * p.r) / PEN_POST)),
    rails: Piece[] = [],
    penPosts: Piece[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = toward + ((i + 0.5) / n) * 2 * Math.PI,
      a1 = toward + ((i + 1.5) / n) * 2 * Math.PI,
      x0 = p.x + p.r * Math.cos(a0),
      z0 = p.z + p.r * Math.sin(a0),
      x1 = p.x + p.r * Math.cos(a1),
      z1 = p.z + p.r * Math.sin(a1);
    penPosts.push({ x: x0, y: 0.65, z: z0, sx: 0.2, sy: 1.3, sz: 0.2, yaw: a0 });
    // (The gap: the last length, which reaches round to the side toward the town.)
    if (i === n - 1) continue;
    for (const y of detail ? [0.6, 1.1] : [0.85])
      rails.push({
        x: (x0 + x1) / 2,
        y,
        z: (z0 + z1) / 2,
        sx: 0.12,
        sy: 0.12,
        sz: Math.hypot(x1 - x0, z1 - z0),
        yaw: Math.atan2(x1 - x0, z1 - z0),
      });
  }
  const tx = p.x + Math.cos(toward) * p.r * 0.45,
    tz = p.z + Math.sin(toward) * p.r * 0.45;
  // The flock's fold: hurdles round where it lies, open toward the town and the pasture.
  let fold: Country["pen"]["fold"] = null;
  if (plan.fauna?.flock && plan.fauna.flock.herders > 0) {
    const f = foldOf(plan),
      r = foldReach(plan),
      m = Math.max(12, Math.round((2 * Math.PI * r) / HURDLE)),
      hurdles: Piece[] = [],
      side = (a: number, out: number): Spot => ({
        x: f.x + Math.cos(a) * out,
        z: f.z + Math.sin(a) * out,
        yaw: Math.atan2(-Math.sin(a), Math.cos(a)),
      });
    for (let i = 0; i < m; i++) {
      const a = toward + ((i + 0.5) / m) * 2 * Math.PI,
        off = Math.abs(Math.atan2(Math.sin(a - toward), Math.cos(a - toward)));
      if (off < FOLD_OPEN || off > Math.PI - FOLD_OPEN) continue;
      hurdles.push({
        ...side(a, r),
        y: 0.5,
        sx: 0.1,
        sy: 1,
        sz: ((2 * Math.PI * r) / m) * 0.94,
      });
    }
    fold = {
      hurdles,
      racks: [-1, 1].map((k) => side(toward + (k * Math.PI) / 2, r * 0.8)),
      fleeces: side(toward + 0.85, r * 0.7),
    };
  }
  // By its water: a jetty out from the shore nearest the town, a boat for every few hundred of
  // its people (five at most), each tied up along it and going about its own stretch of water.
  let water: Country["water"] = null;
  if (plan.water) {
    const w = plan.water,
      from = Math.hypot(w.x, w.z) || 1,
      // (Into the water: from the town toward the lake's middle.)
      ix = w.x / from,
      iz = w.z / from,
      shore = { x: w.x - ix * LAKE_R, z: w.z - iz * LAKE_R },
      yaw = Math.atan2(ix, iz),
      pier: Piece[] = [
        {
          x: shore.x + ix * (PIER / 2 - 2),
          y: 0.7,
          z: shore.z + iz * (PIER / 2 - 2),
          sx: 3,
          sy: 0.3,
          sz: PIER,
          yaw,
        },
      ];
    for (let s = 4; s <= PIER - 2; s += 5)
      for (const side of [-1, 1])
        pier.push({
          x: shore.x + ix * s + iz * side * 1.4,
          y: 0.3,
          z: shore.z + iz * s - ix * side * 1.4,
          sx: 0.35,
          sy: 1.6,
          sz: 0.35,
          yaw,
        });
    const count = Math.max(1, Math.min(5, 1 + Math.floor(plan.population / 400))),
      boats: NonNullable<Country["water"]>["boats"][number][] = [];
    for (let i = 0; i < count; i++) {
      const along = 9 + Math.floor(i / 2) * 8,
        side = i % 2 ? 1 : -1,
        a = Math.atan2(-iz, -ix) + Math.PI + (i - (count - 1) / 2) * 0.9 + draw(i, 16) * 0.3,
        far = LAKE_R * (0.35 + 0.25 * draw(i, 17));
      boats.push({
        // (Alongside the jetty, bow out over the water.)
        mooring: {
          x: shore.x + ix * along + iz * side * 4,
          z: shore.z + iz * along - ix * side * 4,
          yaw: Math.atan2(-iz, ix),
        },
        out: { x: w.x + Math.cos(a) * far, z: w.z + Math.sin(a) * far, r: 22 + 18 * draw(i, 18) },
      });
    }
    water = {
      pier,
      boat:
        era === "modern"
          ? "motor"
          : era === "industry"
            ? "steam"
            : era === "metal"
              ? "sail"
              : "row",
      boats,
    };
  }
  return {
    orchard,
    crop,
    manner,
    bounds,
    posts,
    rows,
    trees,
    barns,
    silos,
    hay,
    bales: engines,
    scarecrows,
    mills,
    tractors,
    water,
    pen: {
      rails,
      posts: penPosts,
      trough: { x: tx, z: tz, yaw: toward },
      rack: plan.fauna?.flock
        ? null
        : { x: tx + Math.sin(toward) * 8, z: tz - Math.cos(toward) * 8, yaw: toward },
      fold,
    },
  };
}

/** The share of the year gone (0 … 1). */
function yearShare(t: number): number {
  return (((t % YEAR) + YEAR) % YEAR) / YEAR;
}

/**
 * A crop's colour at moment t: grain bare, sprouting, green, ripe gold, then stubble; greens a
 * deeper green from the sowing to the lifting, the soil turned after; fallow grass all year.
 */
export function cropColor(crop: Crop, t: number): Rgb {
  const d = yearShare(t);
  switch (crop) {
    case "grain":
      if (d < 0.2) return [0.46, 0.36, 0.24];
      if (d < 0.35) return [0.5, 0.62, 0.3];
      if (d < 0.6) return [0.34, 0.58, 0.24];
      if (d < 0.75) return [0.82, 0.7, 0.32];
      return [0.6, 0.52, 0.34];
    case "greens":
      if (d < 0.22) return [0.4, 0.31, 0.21];
      if (d < 0.32) return [0.4, 0.55, 0.28];
      if (d < 0.74) return [0.2, 0.44, 0.24];
      return [0.43, 0.34, 0.22];
    case "fallow":
      return [0.5, 0.63, 0.3];
  }
}

/** Whether hay stands in the stubble: once the grain is cut, into the winter. */
export function hayStands(t: number): boolean {
  const d = yearShare(t);
  return d >= HARVEST[1] - 0.03 && d < 0.95;
}

/** Whether the scarecrows stand over the corn: from the sowing to the reaping. */
export function scarecrowsStand(t: number): boolean {
  const d = yearShare(t);
  return d >= SOWING[0] && d < HARVEST[1];
}

/** How white the orchards are with blossom (0 … 1): a few weeks of spring. */
export function blossomOf(t: number): number {
  const d = yearShare(t);
  return Math.max(0, 1 - Math.abs(d - 0.29) / 0.06);
}

/** Whether the orchards hang with fruit: the summer's end, until it is picked. */
export function fruitHangs(t: number): boolean {
  const d = yearShare(t);
  return d >= 0.55 && d < 0.74;
}

/** A tractor's way at work, metres a second of the screen's clock. */
const TRACTOR_PACE = 4.5;

/**
 * Where tractor `k` is at moment t: at the sowing and the harvest, by day, going up and down its
 * field's rows (by the screen's clock, so it is seen at work at any speed the world runs); else
 * at its field's gate. `working` while it is out on the field.
 */
export function tractorAt(
  plan: VillagePlan,
  c: Country,
  k: number,
  t: number,
  clock: number,
): Spot & { readonly working: boolean } {
  const tractor = c.tractors[k]!,
    f = plan.fields[tractor.field]!,
    d = yearShare(t),
    hour = (((t % DAY) + DAY) % DAY) / 3600,
    season = (d >= SOWING[0] && d < SOWING[1]) || (d >= HARVEST[0] && d < HARVEST[1]);
  if (!season || hour < 7 || hour >= 18) return { ...tractor.gate, working: false };
  // Up and down the rows, turning at the headlands.
  const run = Math.max(4, f.w - 5),
    lines = Math.max(1, Math.floor((f.d - 4) / ROW_GAP)),
    s = (clock * TRACTOR_PACE + k * 37) % (run * lines),
    line = Math.floor(s / run),
    along = s - line * run,
    back = line % 2 === 1,
    u = (back ? run - along : along) / f.w - run / (2 * f.w),
    v = ((line + 0.5) * ROW_GAP) / f.d - 0.5 + 2 / f.d,
    p = fieldPoint(f, u, v);
  return { x: p.x, z: p.z, yaw: f.yaw + (back ? Math.PI : 0), working: true };
}

/** A boat's way about its water, metres a second of the screen's clock. */
const BOAT_PACE = 2.2;

/**
 * Where boat `k` is at moment t: out on its stretch of water by day (going round it by the
 * screen's clock), tied up at the jetty from dusk to dawn, and while the water is `frozen`.
 */
export function boatAt(
  c: Country,
  k: number,
  t: number,
  clock: number,
  frozen = false,
): Spot & { readonly out: boolean } {
  const b = c.water!.boats[k]!,
    hour = (((t % DAY) + DAY) % DAY) / 3600;
  if (frozen || hour < 6.5 || hour >= 18.5) return { ...b.mooring, out: false };
  const turn = (clock * BOAT_PACE) / b.out.r + k * 2.3;
  return {
    x: b.out.x + Math.cos(turn) * b.out.r,
    z: b.out.z + Math.sin(turn) * b.out.r,
    // (Going round, bow ahead: along the circle's turning.)
    yaw: Math.atan2(-Math.cos(turn), -Math.sin(turn)),
    out: true,
  };
}

/** How far round a mill's sails (or a turbine's blades) have turned, by the screen's clock. */
export function sailTurn(k: number, clock: number, kind: "mill" | "turbine"): number {
  return clock * (kind === "turbine" ? 1.4 : 0.9) + k * 1.3;
}
