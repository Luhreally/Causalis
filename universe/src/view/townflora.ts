// What grows about a town, as its own view sees it (asked 2026-11-20: the ground about a town one flat colour, few trees).
// Its land's reading about its tile (host/flora.ts townFlora: bridge/biome.ts, a window of its land's map as the town's water
// is read) gives its ground's colour point by point, blended between the tiles' middles, greener by its water, trodden about
// its streets; and what stands on it: trees by each tile's canopy and forms, in groves and clearings, hedgerows along its
// fields where its land keeps them, tufts of grass and stones, nearest the square first, as many as the setting's budget.
// Never on its water, its streets, its road out, its fields or its pasture. Pure: the same plan, the same ground and trees.
import { FLORA, tileUnit, wetGround, type FloraTiles, type VillagePlan } from "../bridge/index.ts";
import { lifePalette } from "./globe.ts";
import type { Rgb } from "./sandbox.ts";
import { villageGround } from "./ground.ts";
import {
  ROW,
  cellUnit,
  formAt,
  formColor,
  mixRgb,
  openGround,
  rings,
  scale,
  tileGround,
  warmOf,
  woodsShade,
  type NearThing,
} from "./flora.ts";

/** How a form stands in a town's view (metres): crown breadth and height, trunk height. */
const TOWN_FORM: Readonly<
  Record<string, { w: number; h: number; trunk: number; crown: "cone" | "ball" | "none" }>
> = {
  conifer: { w: 7, h: 14, trunk: 3, crown: "cone" },
  broadleaf: { w: 10, h: 8, trunk: 4.5, crown: "ball" },
  palm: { w: 7, h: 3, trunk: 10, crown: "ball" },
  flat: { w: 12, h: 3.5, trunk: 5, crown: "ball" },
  tall: { w: 11, h: 11, trunk: 12, crown: "ball" },
  scrub: { w: 4, h: 2.6, trunk: 0, crown: "ball" },
  dead: { w: 0.9, h: 0, trunk: 6, crown: "none" },
  kelp: { w: 2, h: 9, trunk: 0, crown: "cone" },
};
const TRUNK: Rgb = [0.36, 0.27, 0.19];

/** A town's ground as its land's reading has it: each tile's growth and colour about its square. */
export type TownGround = {
  readonly read: FloraTiles;
  readonly palette: readonly Rgb[];
  /** Each tile's ground colour. */
  readonly colors: readonly Rgb[];
  /** Metres a tile, how many tiles from the middle each way, and where the middle tile's middle is from the square. */
  readonly m: number;
  readonly half: number;
  readonly ox: number;
  readonly oz: number;
};

/** A town's ground read (null: its plan carries no reading: a colony's, a land built over). */
export function townGroundOf(plan: VillagePlan): TownGround | null {
  const w = plan.landFlora;
  if (!w || plan.colony || plan.past?.covered) return null;
  const size = 2 * w.half + 1,
    n = size * size,
    read: FloraTiles = {
      size,
      cover: new Uint8Array(n),
      canopy: new Uint8Array(n),
      rock: new Uint8Array(n),
      wet: new Uint8Array(n),
      lush: new Uint8Array(n),
    };
  for (let t = 0; t < n; t++) {
    read.cover[t] = w.tiles[t * 5]!;
    read.canopy[t] = w.tiles[t * 5 + 1]!;
    read.rock[t] = w.tiles[t * 5 + 2]!;
    read.wet[t] = w.tiles[t * 5 + 3]!;
    read.lush[t] = w.tiles[t * 5 + 4]!;
  }
  const palette = lifePalette(plan.kind, plan.lifeLook),
    seed = Math.abs(plan.seed | 0),
    colors: Rgb[] = [];
  for (let t = 0; t < n; t++) colors.push(tileGround(palette, read, t, seed + t));
  const bank = plan.landWater?.bank;
  return { read, palette, colors, m: w.m, half: w.half, ox: -(bank?.x ?? 0), oz: -(bank?.z ?? 0) };
}

/** The tile of the reading a point (metres from the square) falls on. */
function tileAt(g: TownGround, x: number, z: number): number {
  const s = 2 * g.half + 1,
    i = Math.max(0, Math.min(s - 1, Math.round((x - g.ox) / g.m) + g.half)),
    j = Math.max(0, Math.min(s - 1, Math.round((z - g.oz) / g.m) + g.half));
  return j * s + i;
}

/**
 * The ground's colour at a point (metres from the square): the tiles' colours blended between their middles, greener near
 * its water, trodden (toward its soil) about its streets out to `edge`, a little lighter or darker in patches.
 */
export function townGroundAt(
  g: TownGround,
  plan: VillagePlan,
  x: number,
  z: number,
  edge: number,
): Rgb {
  const s = 2 * g.half + 1,
    fx = Math.max(0, Math.min(s - 1 - 1e-6, (x - g.ox) / g.m + g.half)),
    fz = Math.max(0, Math.min(s - 1 - 1e-6, (z - g.oz) / g.m + g.half)),
    i = Math.floor(fx),
    j = Math.floor(fz),
    u = fx - i,
    v = fz - j,
    a = g.colors[j * s + i]!,
    b = g.colors[j * s + i + 1]!,
    c = g.colors[(j + 1) * s + i]!,
    d = g.colors[(j + 1) * s + i + 1]!;
  let col = mixRgb(mixRgb(a, b, u), mixRgb(c, d, u), v);
  // (By the water, the grass greener.)
  if (plan.landWater?.wet) {
    let near = 0;
    for (let k = 0; k < 4 && !near; k++) {
      const an = (k * Math.PI) / 2;
      if (wetGround(plan.landWater, x + 45 * Math.cos(an), z + 45 * Math.sin(an))) near = 1;
    }
    if (near) col = mixRgb(col, scale(g.palette[ROW.green]!, 0.95), 0.35);
  }
  // (Trodden about the town: its soil showing, most at its streets' edge.)
  const r = Math.hypot(x, z),
    worn = r < edge ? 0.3 : Math.max(0, 0.3 * (1 - (r - edge) / 160));
  if (worn > 0) col = mixRgb(col, g.palette[ROW.coldSoil]!, worn);
  // (Patches lighter and darker: grass is never one colour.)
  const p = cellUnit(Math.floor(x / 55), Math.floor(z / 55), 77) - 0.5;
  return scale(col, 1 + 0.12 * p);
}

/** How much of the ground at a point (metres from the square) its woods cover, blended between the tiles' middles (0 … 1). */
export function townCanopyAt(g: TownGround, x: number, z: number): number {
  const s = 2 * g.half + 1,
    fx = Math.max(0, Math.min(s - 1 - 1e-6, (x - g.ox) / g.m + g.half)),
    fz = Math.max(0, Math.min(s - 1 - 1e-6, (z - g.oz) / g.m + g.half)),
    i = Math.floor(fx),
    j = Math.floor(fz),
    u = fx - i,
    v = fz - j,
    c = g.read.canopy,
    a = c[j * s + i]!,
    b = c[j * s + i + 1]!,
    d = c[(j + 1) * s + i]!,
    e = c[(j + 1) * s + i + 1]!;
  return ((a + (b - a) * u) * (1 - v) + (d + (e - d) * u) * v) / 255;
}

/** How many things the town's view draws about it, by the setting (its `villageTrees` share). */
export function townBudget(share: number): {
  trees: number;
  tufts: number;
  stones: number;
  hedges: number;
} {
  const trees = Math.round(Math.min(5000, Math.max(900, 3200 * share)));
  return {
    trees,
    tufts: Math.round(trees * 0.9),
    stones: Math.round(trees * 0.12),
    hedges: Math.round(trees * 0.35),
  };
}

/** What stands about a town (metres), as near the eye's things are drawn (render/townflora.ts). */
export type TownFlora = {
  trunks: NearThing[];
  cones: NearThing[];
  balls: NearThing[];
  tufts: NearThing[];
  stones: NearThing[];
  trees: number;
  hedges: number;
};

/** The town's built ground's edge (metres from the square): its streets' or homes' farthest. */
export function townEdge(plan: VillagePlan): number {
  let edge = 40;
  for (const h of plan.homes) edge = Math.max(edge, Math.hypot(h.x, h.z));
  if (plan.town) edge = Math.max(edge, villageGround(plan).homesReach);
  return edge;
}

/** Whether something `r` across may stand at a point about a town: off its water, its built ground, its road, fields and pasture. */
export function townClear(
  plan: VillagePlan,
  edge: number,
): (x: number, z: number, r: number) => boolean {
  const roadLen = Math.hypot(plan.road.x, plan.road.z) || 1,
    rx = plan.road.x / roadLen,
    rz = plan.road.z / roadLen,
    fields = plan.fields.map((f) => ({ ...f, c: Math.cos(f.yaw), s: Math.sin(f.yaw) }));
  return (x, z, r) => {
    if (Math.hypot(x, z) < edge + 15 + r) return false;
    const along = x * rx + z * rz,
      off = Math.abs(-x * rz + z * rx);
    if (off < 9 + r && (plan.districts ? true : along > 0) && along < roadLen + 10) return false;
    if (Math.hypot(x - plan.pasture.x, z - plan.pasture.z) < plan.pasture.r + 4 + r) return false;
    if (plan.water && Math.hypot(x - plan.water.x, z - plan.water.z) < (plan.water.r ?? 0) + 6 + r)
      return false;
    if (wetGround(plan.landWater, x, z)) return false;
    for (const f of fields) {
      const dx = x - f.x,
        dz = z - f.z,
        u = dx * f.c - dz * f.s,
        v = dx * f.s + dz * f.c;
      if (Math.abs(u) < f.w / 2 + 2 + r && Math.abs(v) < f.d / 2 + 2 + r) return false;
    }
    return true;
  };
}

/** Of the land's covers, those whose farmers keep hedgerows between their fields. */
const HEDGED = new Set<number>([
  FLORA.mixed,
  FLORA.broadleaf,
  FLORA.meadow,
  FLORA.temperateRain,
  FLORA.steppe,
  FLORA.taiga,
]);

/**
 * What stands about a town: trees by each tile's canopy (groves and clearings, its forms by the tile's mix), hedgerows along
 * its fields where its land keeps them, tufts where its grass grows, stones where its rock shows; nearest the square first,
 * out to `reach` metres, as many as the budget; none where `clear` says no.
 */
export function townFlora(
  g: TownGround,
  plan: VillagePlan,
  reach: number,
  budget: { trees: number; tufts: number; stones: number; hedges: number },
  edge = townEdge(plan),
): TownFlora {
  const out: TownFlora = {
      trunks: [],
      cones: [],
      balls: [],
      tufts: [],
      stones: [],
      trees: 0,
      hedges: 0,
    },
    clear = townClear(plan, edge),
    r = g.read,
    p = g.palette,
    r2 = reach * reach,
    salt = Math.abs(plan.seed | 0) % 9973,
    put = (
      list: NearThing[],
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      yaw: number,
      c: Rgb,
    ) => list.push({ x, y, z, w, h, yaw, r: c[0], g: c[1], b: c[2] }),
    tree = (x: number, z: number, form: string, k: number, u: number, base: Rgb) => {
      const size = TOWN_FORM[form] ?? TOWN_FORM.broadleaf!,
        tone = 0.86 + 0.28 * u,
        col: Rgb = [base[0] * tone, base[1] * tone, base[2] * tone],
        yaw = u * 40,
        trunk = form === "dead" ? size.trunk * (u < 0.7 ? 0.25 : 1) * k : size.trunk * k;
      if (trunk > 0)
        put(
          out.trunks,
          x,
          0,
          z,
          Math.max(0.6, size.w * 0.1) * k,
          trunk,
          yaw,
          form === "dead" ? base : TRUNK,
        );
      if (size.crown !== "none") {
        const ch = size.h * k,
          foot = trunk > 0 ? trunk * 0.85 : -ch * 0.2;
        put(size.crown === "cone" ? out.cones : out.balls, x, foot, z, size.w * k, ch, yaw, col);
      }
    };
  // Trees: a cell's one, by its tile's canopy.
  const CELL = 26;
  for (const [i, j] of rings(0, 0, CELL, reach, edge)) {
    if (out.trees >= budget.trees) break;
    const x = (i + 0.15 + 0.7 * cellUnit(i, j, 1 + salt)) * CELL,
      z = (j + 0.15 + 0.7 * cellUnit(i, j, 2 + salt)) * CELL;
    if (x * x + z * z > r2) continue;
    const t = tileAt(g, x, z),
      want =
        (r.canopy[t]! / 255) *
        (0.2 + 1.6 * cellUnit(Math.floor(x / 140), Math.floor(z / 140), 900 + salt));
    if (cellUnit(i, j, 3 + salt) >= want) continue;
    const form = formAt(r, t, cellUnit(i, j, 4 + salt), warmOf(r, t)),
      size = TOWN_FORM[form] ?? TOWN_FORM.broadleaf!,
      k = 0.75 + 0.5 * cellUnit(i, j, 5 + salt);
    if (!clear(x, z, (size.w * k) / 2)) continue;
    tree(x, z, form, k, cellUnit(i, j, 6 + salt), formColor(p, form));
    out.trees++;
  }
  // Hedgerows: a field's edges a few metres out, a bush every few metres, where its land keeps them.
  for (const f of plan.fields) {
    if (out.hedges >= budget.hedges) break;
    const t = tileAt(g, f.x, f.z);
    if (!HEDGED.has(r.cover[t]!)) continue;
    const c = Math.cos(f.yaw),
      s = Math.sin(f.yaw),
      hedge = mixRgb(formColor(p, "broadleaf"), woodsShade(p, r.cover[t]!), 0.4);
    for (const [hu, hv, along] of [
      [0, -1, f.w],
      [0, 1, f.w],
      [-1, 0, f.d],
      [1, 0, f.d],
    ] as const) {
      const steps = Math.floor(along / 7);
      for (let q = 0; q <= steps && out.hedges < budget.hedges; q++) {
        const a = -along / 2 + q * 7,
          u = hu ? (hu * f.w) / 2 + hu * 4.5 : a,
          v = hv ? (hv * f.d) / 2 + hv * 4.5 : a,
          x = f.x + u * c + v * s,
          z = f.z - u * s + v * c,
          n = tileUnit(Math.floor(x * 7 + 99991 * z) | 0, 5 + salt);
        if (n < 0.22 || !clear(x, z, 1.5)) continue;
        // (Now and then a tree standing in the hedge.)
        if (n > 0.93) tree(x, z, "broadleaf", 0.8, n, formColor(p, "broadleaf"));
        else
          put(out.balls, x, -0.4, z, 3.6 + 1.6 * n, 2.4 + n, n * 9, scale(hedge, 0.86 + 0.28 * n));
        out.hedges++;
      }
    }
  }
  // Tufts where the grass grows, near.
  const TUFT = 6,
    tuftReach = Math.min(reach, edge + 420);
  for (const [i, j] of rings(0, 0, TUFT, tuftReach, edge)) {
    if (out.tufts.length >= budget.tufts) break;
    const x = (i + cellUnit(i, j, 21 + salt)) * TUFT,
      z = (j + cellUnit(i, j, 22 + salt)) * TUFT;
    if (x * x + z * z > tuftReach * tuftReach) continue;
    const t = tileAt(g, x, z),
      cover = r.cover[t]!;
    if (cover === FLORA.ice || cover === FLORA.rock) continue;
    const open = Math.max(0, 1 - r.canopy[t]! / 255 - r.rock[t]! / 255),
      lush = r.lush[t]! / 255,
      want = open * (0.06 + 0.3 * lush + (cover === FLORA.marsh ? 0.25 : 0));
    if (cellUnit(i, j, 23 + salt) >= want || !clear(x, z, 0.6)) continue;
    const k = 0.7 + 0.6 * cellUnit(i, j, 25 + salt),
      reed = cover === FLORA.marsh;
    put(
      out.tufts,
      x,
      0,
      z,
      1.3 * k,
      (reed ? 2.4 : 0.9) * k,
      cellUnit(i, j, 26 + salt) * 6.28,
      scale(openGround(p, cover, Math.min(1, lush + 0.2)), 0.8 + 0.35 * cellUnit(i, j, 24 + salt)),
    );
  }
  // Stones where rock shows (and a few anywhere).
  const STONE = 30;
  for (const [i, j] of rings(0, 0, STONE, reach, edge)) {
    if (out.stones.length >= budget.stones) break;
    const x = (i + cellUnit(i, j, 31 + salt)) * STONE,
      z = (j + cellUnit(i, j, 32 + salt)) * STONE;
    if (x * x + z * z > r2) continue;
    const t = tileAt(g, x, z),
      k = r.rock[t]! / 255;
    if (cellUnit(i, j, 33 + salt) >= 0.05 + 0.75 * k) continue;
    const sz = 1 + 3.5 * cellUnit(i, j, 34 + salt) * (0.5 + k);
    if (!clear(x, z, sz)) continue;
    put(
      out.stones,
      x,
      -sz * 0.15,
      z,
      sz,
      sz * (0.5 + 0.4 * cellUnit(i, j, 36 + salt)),
      cellUnit(i, j, 37 + salt) * 6.28,
      scale(mixRgb(p[ROW.rock]!, p[ROW.coldSoil]!, 0.3), 0.8 + 0.35 * cellUnit(i, j, 35 + salt)),
    );
  }
  return out;
}
