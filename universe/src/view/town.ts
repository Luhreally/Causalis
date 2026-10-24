// A town drawn from its fabric (Phase 23 M149, asked for 2026-10-24: "i cant see the cities form
// and evolve and get that type of detail i got from the og causalisis"): its streets about its
// blocks, paved once its land paves them; each home at its level in the design it was raised in
// — huts, houses, townhouses of three storeys, tenements of five, blocks of ten, high-rises of
// twenty-four — and, while one rises, its stages as Classic drew them: stakes, a footing, the
// frame, walls climbing inside a scaffold (a crane over the tall ones), the roof going on; a
// home let fall standing empty, roofless, its walls crumbling year by year; a burnt one black
// stubs; its other buildings each in a shape of its own, rising, standing, fallen; its walls
// raised course by course, a tower at every few lengths and a gate where its road runs out —
// pulled down where the town has grown over them; a great city's sprawl past the lots drawn, its
// avenues kept clear. Pure: what is drawn at a moment, in parts (metres from the square's middle), for the renderer
// to put in its batches.
import {
  BLOCK_D,
  BLOCK_LOTS,
  BLOCK_W,
  GATE_TOWER,
  LOT,
  LOT_D,
  LOT_W,
  SQUARE,
  STREET,
  WALL_THICK,
  WALL_TOWER,
  blocksHeld,
  civicMoments,
  footprint,
  lotStates,
  progress,
  townLots,
  townReach,
  wallRing,
  type LotStates,
  type TownCivic,
  type TownDesign,
  type TownLots,
  type TownPlan,
  type WallLength,
} from "../bridge/index.ts";
import { HOME_LIFE } from "../rules/index.ts";
import { houseLook, type HouseLook } from "./village.ts";

type Rgb = readonly [number, number, number];
export type PartMesh = "box" | "gable" | "cone" | "cyl";

/** A window's glass: lit from within from dusk to dawn (the renderer's lamplight). */
export const LAMP: Rgb = [0.14, 0.18, 0.24];

/**
 * Parts gathered by mesh and colour: seven numbers each (x, y, z, sx, sy, sz, yaw), metres; the
 * windows in a group of their own, lit at night.
 */
export class TownParts {
  readonly groups = new Map<
    string,
    { mesh: PartMesh; color: Rgb; data: number[]; lamp?: boolean }
  >();
  /** A window (a box of glass), lit at night. */
  lamp(x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw: number): void {
    let g = this.groups.get("lamp");
    if (!g) this.groups.set("lamp", (g = { mesh: "box", color: LAMP, data: [], lamp: true }));
    g.data.push(x, y, z, sx, sy, sz, yaw);
  }
  put(
    mesh: PartMesh,
    color: Rgb,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    yaw: number,
  ): void {
    const key = `${mesh}|${color[0].toFixed(3)}|${color[1].toFixed(3)}|${color[2].toFixed(3)}`;
    let g = this.groups.get(key);
    if (!g) this.groups.set(key, (g = { mesh, color, data: [] }));
    g.data.push(x, y, z, sx, sy, sz, yaw);
  }
  /** How many parts in all. */
  get count(): number {
    let n = 0;
    for (const g of this.groups.values()) n += g.data.length / 7;
    return n;
  }
  clear(): void {
    for (const g of this.groups.values()) g.data.length = 0;
  }
}

const YEAR_S = 365 * 86_400;

/** The look of each level: footprint (along the street, deep), walls' height, storeys; metres. */
const LEVELS: readonly { w: number; d: number; h: number; storeys: number }[] = [
  { w: 5, d: 4.4, h: 2.4, storeys: 1 },
  { w: 7.2, d: 6, h: 3.4, storeys: 1 },
  { w: 8.4, d: 10, h: 9, storeys: 3 },
  { w: 8.8, d: 12, h: 15, storeys: 5 },
  { w: 8.8, d: 12.4, h: 30, storeys: 10 },
  { w: 7.8, d: 11, h: 72, storeys: 24 },
];
/** The industrial levels' own materials: brick, concrete, glass. */
const BRICK: Rgb = [0.66, 0.32, 0.24],
  CONCRETE: Rgb = [0.7, 0.69, 0.65],
  GLASS: Rgb = [0.44, 0.58, 0.7],
  FRAME: Rgb = [0.86, 0.88, 0.9],
  TAR: Rgb = [0.3, 0.3, 0.32],
  TIMBER: Rgb = [0.55, 0.38, 0.22],
  STAKE: Rgb = [0.48, 0.34, 0.2],
  FOOTING: Rgb = [0.64, 0.6, 0.54],
  CRANE: Rgb = [0.96, 0.74, 0.12],
  CHAR: Rgb = [0.17, 0.15, 0.14],
  STONE: Rgb = [0.74, 0.72, 0.66],
  GOLD: Rgb = [0.98, 0.8, 0.25],
  WHITE: Rgb = [0.94, 0.93, 0.9],
  DARK: Rgb = [0.32, 0.3, 0.3];

const darker = (c: Rgb, f: number): Rgb => [c[0] * f, c[1] * f, c[2] * f];

/**
 * A hut's or a house's footprint in its land's look (along its street, deep) — as long as its
 * look, but no longer than its lot holds, its eaves clear of its neighbours'.
 */
const lowFoot = (L: { w: number; d: number }, look: HouseLook): [number, number] => [
  Math.min(LOT_W - 1.2, L.w * (look.length / 0.7)),
  Math.min(LOT_D - 1.6, L.d * (look.width / 0.55)),
];

/** A part placed by an offset in a turned frame: (u along, v across) from (x, z), turned by yaw. */
function at(x: number, z: number, yaw: number, u: number, v: number): [number, number] {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return [x + u * c + v * s, z - u * s + v * c];
}

/** Everything a town's drawing needs, read once from its plan. */
export type TownScene = {
  readonly plan: TownPlan;
  readonly lots: TownLots;
  readonly states: LotStates;
  /** Which blocks hold anything (the rest are open ground). */
  readonly held: Uint8Array;
  /** Its walls as they stand (null: none). */
  readonly walls: {
    readonly r: number;
    readonly n: number;
    readonly lengths: readonly WallLength[];
  } | null;
  readonly looks: readonly HouseLook[];
  /** The lots whose drawing changes through the year (rising, or not yet begun), and the rest. */
  readonly active: readonly number[];
  readonly settled: readonly number[];
};

/** A town's scene at the moment its plan came (lots that change from then on are active). */
export function townScene(plan: TownPlan, t: number, previous?: TownLots): TownScene {
  const lots =
      previous &&
      previous.x.length >= plan.lots &&
      previous.blocks.x.length >= Math.ceil(plan.lots / BLOCK_LOTS)
        ? previous
        : townLots(plan.family, plan.seed, plan.axis, plan.lots, plan.water),
    states = lotStates(plan),
    held = blocksHeld(plan, states),
    looks = plan.designs.map((d: TownDesign) =>
      houseLook({ walls: d.walls, roof: d.roof, form: d.form, pitch: d.pitch, design: null }),
    ),
    active: number[] = [],
    settled: number[] = [],
    scene = { plan, lots, states, held, walls: wallRing(plan, lots, held), looks, active, settled };
  // Active: rising, or to be rebuilt as it wears before the year is out.
  for (let p = 0; p < plan.lots; p++) {
    if (states.what[p] !== LOT.home) settled.push(p);
    else if (progress(states.began[p]!, states.takes[p]!, t) < 1) active.push(p);
    else {
      const w = homeWear(scene, p, t);
      if ((w.at !== null && t < w.at + states.takes[p]!) || w.next < t + YEAR_S) active.push(p);
      else settled.push(p);
    }
  }
  return scene;
}

/**
 * A home's wear (seen, not lived: the fabric holds the homes, their wearing is the eye's). Done,
 * it stands its level's years, each lot a fifth either way of them, and is rebuilt in its place at
 * its level in its land's design of that day — a town lived in is never long without a scaffold,
 * and its oldest streets come in time to the newest look. When the rebuilding it is in (or last
 * had) began (null: never yet), when the next begins, and the look it stands in.
 */
export function homeWear(
  scene: TownScene,
  p: number,
  t: number,
): { at: number | null; next: number; look: number } {
  const { plan, states } = scene,
    done = states.began[p]! + states.takes[p]!,
    life = HOME_LIFE[states.level[p]!]! * YEAR_S * (0.8 + 0.4 * scatter(plan.seed, p, 9));
  if (t < done + life) return { at: null, next: done + life, look: states.design[p]! };
  const at = done + Math.floor((t - done) / life) * life,
    year = Math.floor(at / YEAR_S);
  // (The newest of its land's designs by then.)
  let look = states.design[p]!;
  for (let i = 0; i < plan.designs.length; i++) if (plan.designs[i]!.since <= year) look = i;
  return { at, next: at + life, look };
}

/**
 * How high a lot's home stands to its roof's top at moment t, its hearth's smoke rising from it
 * (metres; null where no home stands whole).
 */
export function roofTop(scene: TownScene, p: number, t: number): number | null {
  const { states, looks } = scene;
  if (states.what[p] !== LOT.home || progress(states.began[p]!, states.takes[p]!, t) < 1)
    return null;
  const level = Math.max(0, Math.min(5, states.level[p]!)),
    L = LEVELS[level]!,
    look = looks[homeWear(scene, p, t).look] ?? looks[0];
  if (!look) return null;
  if (level <= 1) {
    const [, d] = lowFoot(L, look),
      rise = look.tent ? 7.5 : look.rise < 0.1 ? 0.6 : Math.min(5, look.rise * d * 0.5);
    return look.raised * 10 + L.h * look.height + rise;
  }
  return L.h + (level === 2 ? 3.2 : level === 5 ? 10 : 2.8);
}

/** The ground of a town: its square, and each block's street about it and its yards. */
export function townGround(scene: TownScene, out: TownParts): void {
  const { plan, lots } = scene,
    street: Rgb = plan.paved ? [0.66, 0.64, 0.6] : [0.6, 0.53, 0.4],
    yard: Rgb = [0.5, 0.6, 0.34];
  // In metres, as everything here: the streets stand a hand above the land's ground and the
  // pasture under them, the yards a curb above the streets, so neither sinks out of sight.
  out.put(
    "cyl",
    plan.paved ? [0.74, 0.72, 0.66] : [0.68, 0.6, 0.46],
    0,
    0.22,
    0,
    SQUARE * 2,
    0.36,
    SQUARE * 2,
    0,
  );
  const blocks = Math.ceil(plan.lots / BLOCK_LOTS);
  for (let b = 0; b < blocks; b++) {
    const x = lots.blocks.x[b]!,
      z = lots.blocks.z[b]!,
      yaw = lots.blocks.yaw[b]!;
    out.put("box", street, x, 0.18, z, BLOCK_W + STREET, 0.24, BLOCK_D + STREET, yaw);
    out.put("box", yard, x, 0.3, z, BLOCK_W - 0.6, 0.4, BLOCK_D - 0.6, yaw);
  }
  // A well at the square's heart; a market cross once it is paved.
  out.put("cyl", STONE, 0, 0.5, 0, 2.4, 1, 2.4, 0);
  if (plan.paved) out.put("box", STONE, 0, 2.2, 0, 0.6, 3.4, 0.6, 0);
  sprawl(scene, out);
}

/** A whole number's share in [0, 1), for the sprawl's scatter (the plan's own, not history's). */
function scatter(seed: number, i: number, k: number): number {
  let h = (seed ^ Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The ways out through a great city's sprawl, kept clear of its roofs: its road both ways, and six more. */
export const AVENUES = 8;
/** Half an avenue's breadth (metres). */
export const AVENUE_HALF = 7;
/** How far past the lots drawn a great city's sprawl begins (metres: a street's breadth and more). */
export const SPRAWL_GAP = 16;

/** The way of avenue k out of a town (radians). */
export function avenueWay(plan: TownPlan, k: number): number {
  return plan.axis + (k / AVENUES) * 2 * Math.PI;
}

/**
 * A great city's sprawl (null: none): from as far as its lots drawn reach out to as far as all its
 * lots would (metres).
 */
export function sprawlOf(plan: TownPlan, lots: TownLots): { r0: number; r1: number } | null {
  if (plan.whole <= plan.lots || plan.lots === 0 || !plan.designs.length) return null;
  const r0 = townReach(lots, plan.lots),
    r1 = Math.min(2600, r0 * Math.sqrt(plan.whole / plan.lots));
  return r1 > r0 + 20 ? { r0, r1 } : null;
}

/**
 * A great city's lots past those drawn: its sprawl, low roofs on its trodden ground out to as far
 * as all its lots would reach, one roof for every few homes, into the haze — its avenues kept
 * clear, and its water.
 */
function sprawl(scene: TownScene, out: TownParts): void {
  const { plan, looks } = scene,
    ring = sprawlOf(plan, scene.lots);
  if (!ring) return;
  const { r0, r1 } = ring,
    n = Math.min(3000, Math.round((plan.whole - plan.lots) / 6)),
    water = plan.water,
    wet = (x: number, z: number, margin: number) =>
      !!water && Math.hypot(x - water.x, z - water.z) < water.r + margin,
    trodden: Rgb = plan.paved ? [0.56, 0.55, 0.5] : [0.55, 0.5, 0.4];
  // Its trodden ground, in bands of patches about it (none on the water).
  const bands = 6,
    round = 72;
  for (let b = 0; b < bands; b++) {
    const lo = r0 + ((r1 - r0) * b) / bands,
      hi = r0 + ((r1 - r0) * (b + 1)) / bands,
      mid = (lo + hi) / 2,
      across = (2 * Math.PI * hi) / round + 1;
    for (let k = 0; k < round; k++) {
      const a = ((k + 0.5) / round) * 2 * Math.PI,
        x = mid * Math.cos(a),
        z = mid * Math.sin(a);
      if (wet(x, z, across / 2)) continue;
      out.put("box", trodden, x, 0.12, z, across, 0.1, hi - lo + 1, Math.PI / 2 - a);
    }
  }
  // Its avenues, out through it.
  for (let k = 0; k < AVENUES; k++) {
    const a = avenueWay(plan, k),
      ca = Math.cos(a),
      sa = Math.sin(a);
    for (let r = r0; r < r1; r += 60) {
      const len = Math.min(60, r1 - r),
        x = (r + len / 2) * ca,
        z = (r + len / 2) * sa;
      if (wet(x, z, 4)) continue;
      out.put(
        "box",
        plan.paved ? [0.66, 0.64, 0.6] : [0.6, 0.53, 0.4],
        x,
        0.2,
        z,
        AVENUE_HALF * 2 - 2,
        0.06,
        len,
        Math.PI / 2 - a,
      );
    }
  }
  const sector = (2 * Math.PI) / AVENUES;
  // (Its roofs a street's breadth past the lots drawn.)
  const inner = r0 + SPRAWL_GAP;
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(inner * inner + scatter(plan.seed, i, 0) * (r1 * r1 - inner * inner)),
      a = scatter(plan.seed, i, 1) * 2 * Math.PI,
      look = looks[i % looks.length]!,
      // Nearer the heart, the taller.
      h = 5 + scatter(plan.seed, i, 2) * 5 + 14 * (1 - (r - r0) / (r1 - r0)) ** 3,
      w = 10 + scatter(plan.seed, i, 3) * 16,
      d = 7 + scatter(plan.seed, i, 4) * 4,
      x = r * Math.cos(a),
      z = r * Math.sin(a),
      yaw = Math.PI / 2 - a,
      off = ((((a - plan.axis) % sector) + sector) % sector) * r;
    // (Off its avenues, and out of its water.)
    if (Math.min(off, sector * r - off) < AVENUE_HALF + w / 2 + 1 || wet(x, z, w / 2 + 4)) continue;
    out.put("box", look.wall, x, h / 2, z, w, h, d, yaw);
    out.put("gable", look.roof, x, h + 1.1, z, w * 1.04, 2.2, d * 1.1, yaw);
  }
}

/** A home standing whole: walls and roof at its level, in its design (the tall ones in brick, concrete, glass). */
function home(
  out: TownParts,
  look: HouseLook,
  level: number,
  x: number,
  z: number,
  yaw: number,
  grow = 1,
  roof = 1,
): void {
  const L = LEVELS[Math.max(0, Math.min(5, level))]!,
    h = L.h * (level <= 1 ? look.height : 1) * grow;
  if (h <= 0.01) return;
  if (level <= 1) {
    // Huts and houses: the land's own, round or square, its roof pitched to the rain.
    const [w, d] = lowFoot(L, look),
      wall = look.wall;
    out.put(look.round ? "cyl" : "box", wall, x, look.raised * 10 + h / 2, z, w, h, d, yaw);
    // Two windows on its front, toward its street (none in a tent, nor where it is open).
    if (!look.tent && !look.open && grow >= 1 && h > 1.4)
      for (const side of [-1, 1]) {
        const [wx, wz] = at(x, z, yaw, (side * w) / 4, (-d / 2) * (look.round ? 0.9 : 1) - 0.06);
        out.lamp(
          wx,
          look.raised * 10 + h * 0.55,
          wz,
          Math.min(1, w / 5),
          Math.min(0.8, h * 0.3),
          0.14,
          yaw,
        );
      }
    if (look.open || roof <= 0) return;
    const flat = look.rise < 0.1,
      rh = look.tent ? 7.5 : flat ? 0.6 : Math.min(5, look.rise * d * 0.5);
    out.put(
      look.round || look.tent ? "cone" : flat ? "box" : "gable",
      look.roof,
      x,
      look.raised * 10 + h + (rh * roof) / 2,
      z,
      w * (flat ? 1.02 : 1.15),
      rh * roof,
      d * (flat ? 1.02 : 1.15),
      yaw,
    );
    return;
  }
  if (level === 2) {
    // A townhouse of three storeys, wall to wall along its street, its roof along the street.
    out.put("box", look.wall, x, h / 2, z, L.w, h, L.d, yaw);
    if (roof <= 0) return;
    const flat = look.rise < 0.1,
      rh = flat ? 0.6 : 3.2;
    out.put(
      flat ? "box" : "gable",
      look.roof,
      x,
      h + (rh * roof) / 2,
      z,
      L.w * 1.04,
      rh * roof,
      L.d * 1.08,
      yaw,
    );
    // (A row of windows on each storey, front and back, and a chimney.)
    if (grow >= 1)
      for (let k = 0; k < L.storeys; k++)
        out.lamp(x, ((k + 0.55) / L.storeys) * h, z, L.w * 0.78, 0.9, L.d * 1.02, yaw);
    if (roof >= 1) {
      const [cx, cz] = at(x, z, yaw, L.w * 0.3, 0);
      out.put("box", BRICK, cx, h + 2.6, cz, 0.8, 2.2, 0.8, yaw);
    }
    return;
  }
  const wall = level === 3 ? BRICK : level === 4 ? CONCRETE : GLASS;
  out.put("box", wall, x, h / 2, z, L.w, h, L.d, yaw);
  // Storeys told by bands of windows, lit at night (fewer bands than storeys on the tall ones;
  // a tower's between the frames of its floors).
  const bands = Math.min(6, Math.max(1, Math.floor((L.storeys * grow) / (level === 5 ? 4 : 2))));
  for (let k = 0; k < bands; k++) {
    const y = ((k + 0.6) / bands) * h;
    if (level === 5) {
      out.put("box", FRAME, x, y, z, L.w * 1.01, 0.5, L.d * 1.01, yaw);
      if (grow >= 1) out.lamp(x, y - h / bands / 2, z, L.w * 1.005, 1.2, L.d * 1.005, yaw);
    } else if (grow >= 1) out.lamp(x, y, z, L.w * 1.01, 0.8, L.d * 1.01, yaw);
    else out.put("box", DARK, x, y, z, L.w * 1.01, 0.8, L.d * 1.01, yaw);
  }
  if (roof <= 0) return;
  out.put("box", TAR, x, h + 0.25, z, L.w * 1.02, 0.5, L.d * 1.02, yaw);
  // On the roof: a tank on a tenement, a plant-house on a block, a mast on a tower.
  if (level === 3) out.put("cyl", TIMBER, x, h + 1.6, z, 2, 2.2, 2, 0);
  else if (level === 4) out.put("box", CONCRETE, x, h + 1.6, z, L.w * 0.4, 2.4, L.d * 0.3, yaw);
  else out.put("box", FRAME, x, h + 5, z, 0.4, 10, 0.4, 0);
}

/** A home rising: stakes and a footing, the frame, walls climbing in a scaffold, the roof going on. */
function rising(
  out: TownParts,
  look: HouseLook,
  level: number,
  x: number,
  z: number,
  yaw: number,
  p: number,
): void {
  const L = LEVELS[Math.max(0, Math.min(5, level))]!,
    [w, d] = level <= 1 ? lowFoot(L, look) : [L.w, L.d],
    h = L.h * (level <= 1 ? look.height : 1),
    corners = [
      [w / 2 + 0.5, d / 2 + 0.5],
      [-w / 2 - 0.5, d / 2 + 0.5],
      [w / 2 + 0.5, -d / 2 - 0.5],
      [-w / 2 - 0.5, -d / 2 - 0.5],
    ] as const;
  // Stakes and strings: the plot marked out.
  if (p < 0.12) {
    for (const [u, v] of corners) {
      const [cx, cz] = at(x, z, yaw, u - Math.sign(u) * 0.5, v - Math.sign(v) * 0.5);
      out.put("box", STAKE, cx, 0.6, cz, 0.15, 1.2, 0.15, 0);
    }
    out.put("box", FOOTING, x, 0.55, z, w * Math.min(1, p / 0.12), 0.1, d, yaw);
    return;
  }
  // The footing laid; then the frame: posts at its corners to the walls' height.
  out.put("box", FOOTING, x, 0.55, z, w + 0.4, 0.3, d + 0.4, yaw);
  if (p < 0.32) {
    const up = h * ((p - 0.12) / 0.2);
    for (const [u, v] of corners) {
      const [cx, cz] = at(x, z, yaw, u - Math.sign(u) * 0.5, v - Math.sign(v) * 0.5);
      out.put("box", TIMBER, cx, up / 2, cz, 0.3, up, 0.3, 0);
    }
    return;
  }
  // The walls climb inside a scaffold of poles and boards; the roof goes on at the last.
  const walls = Math.min(1, (p - 0.32) / 0.53);
  home(out, look, level, x, z, yaw, walls, p < 0.85 ? 0 : (p - 0.85) / 0.15);
  const top = h * walls + 1.2;
  for (const [u, v] of corners) {
    const [cx, cz] = at(x, z, yaw, u, v);
    out.put("box", TIMBER, cx, top / 2, cz, 0.2, top, 0.2, 0);
  }
  for (const v of [d / 2 + 0.5, -d / 2 - 0.5]) {
    const [bx, bz] = at(x, z, yaw, 0, v);
    for (let y = 3; y < top; y += level >= 3 ? 6 : 3)
      out.put("box", TIMBER, bx, y, bz, w + 1.2, 0.15, 0.5, yaw);
  }
  // A crane over the tall ones: its mast beside them, its jib over them.
  if (level >= 3) {
    const [mx, mz] = at(x, z, yaw, w / 2 + 3, 0),
      mast = h + 12;
    out.put("box", CRANE, mx, mast / 2, mz, 1, mast, 1, 0);
    const [jx, jz] = at(x, z, yaw, w / 2 - 6, 0);
    out.put("box", CRANE, jx, mast, jz, 22, 0.8, 0.8, yaw);
  }
}

/** A home's ruin: let fall, it stands roofless and crumbles; burnt, black stubs that sink. */
function ruin(
  out: TownParts,
  look: HouseLook,
  x: number,
  z: number,
  yaw: number,
  years: number,
  burnt: boolean,
): void {
  const L = LEVELS[1]!,
    [w, d] = lowFoot(L, look);
  if (burnt) {
    const h = Math.max(0.8, 1.6 - years / 25);
    out.put("box", CHAR, x, h / 2, z, w, h, d, yaw);
    return;
  }
  const h = L.h * Math.max(0.15, 1 - years / 35),
    wall = darker(look.wall, 0.72);
  // Empty a while with its roof sagging in; then only walls, lower each decade.
  out.put(look.round ? "cyl" : "box", wall, x, h / 2, z, w, h, d, yaw);
  if (years < 4 && !look.open)
    out.put(
      "gable",
      darker(look.roof, 0.6),
      x,
      h + 0.8,
      z,
      w * 1.1,
      1.6 * (1 - years / 4),
      d * 1.1,
      yaw,
    );
}

/** The homes of the given lots, as they stand at moment t. */
export function townHomes(
  scene: TownScene,
  which: readonly number[],
  t: number,
  out: TownParts,
): void {
  const { lots, states, looks } = scene;
  for (const p of which) {
    const what = states.what[p]!,
      x = lots.x[p]!,
      z = lots.z[p]!,
      yaw = lots.yaw[p]!,
      look = looks[states.design[p]!] ?? looks[0];
    if (!look) continue;
    if (what === LOT.home) {
      const level = states.level[p]!,
        g = progress(states.began[p]!, states.takes[p]!, t);
      if (g >= 1) {
        // Done: standing, or worn and being rebuilt.
        const w = homeWear(scene, p, t),
          now = looks[w.look] ?? look;
        if (w.at !== null && t < w.at + states.takes[p]!)
          rising(out, now, level, x, z, yaw, (t - w.at) / states.takes[p]!);
        else home(out, now, level, x, z, yaw);
      } else if (g > 0) rising(out, look, level, x, z, yaw, g);
      // (Not yet begun: a home rebuilt higher still stands as it was, a step lower; a worn one
      // as it was.)
      else if (states.raised[p] === 1) home(out, look, Math.max(1, level - 1), x, z, yaw);
      else if (states.raised[p] === 2) home(out, look, level, x, z, yaw);
    } else if (what === LOT.fallen || what === LOT.razed) {
      const years = (t - states.began[p]!) / YEAR_S;
      if (years >= 0) ruin(out, look, x, z, yaw, years, what === LOT.razed);
    }
  }
}

/**
 * One of a town's other buildings, whole: its shape, in footprint metres — a shrine's spire, a
 * granary's bins, a kiln's dome, a smithy's shed and stack, a market's stalls under awnings, a
 * mill's sails, a temple's tiers and gilded crown, a hall's columns, a school's bell, workshops,
 * docks, an academy's dome, baths, an observatory, a hospital's cross, a factory's saw-teeth and
 * chimneys, a station's long shed and clock, a power station's cooling tower, offices of glass.
 */
function civicShape(
  out: TownParts,
  kind: string,
  f: { x: number; z: number; yaw: number; w: number; d: number },
  grow: number,
  color = (c: Rgb) => c,
): void {
  const { x, z, yaw, w, d } = f,
    put = (
      mesh: PartMesh,
      c: Rgb,
      u: number,
      y: number,
      v: number,
      sx: number,
      sy: number,
      sz: number,
      turn = 0,
    ) => {
      const [px, pz] = at(x, z, yaw, u, v);
      if (sy * grow > 0.01)
        out.put(mesh, color(c), px, y * grow, pz, sx, sy * grow, sz, yaw + turn);
    };
  switch (kind) {
    case "shrine":
      put("box", STONE, 0, 0.4, 0, w * 0.7, 0.8, d * 0.5, 0);
      put("box", WHITE, 0, 2.5, 0, 4, 3.4, 4);
      put("cone", GOLD, 0, 5.4, 0, 2.6, 2.6, 2.6);
      break;
    case "granary":
      for (const u of [-w * 0.25, w * 0.25]) {
        put("cyl", [0.8, 0.66, 0.42], u, 3, 0, 6, 6, 6);
        put("cone", [0.86, 0.68, 0.3], u, 7, 0, 7, 2, 7);
      }
      break;
    case "kiln":
      put("cyl", BRICK, 0, 2, 0, 6, 4, 6);
      put("cone", BRICK, 0, 5, 0, 6.4, 2.2, 6.4);
      put("box", BRICK, 2.5, 4, -2.5, 1, 8, 1);
      break;
    case "smithy":
      put("box", [0.42, 0.32, 0.24], 0, 2, 0, w * 0.8, 4, d * 0.6);
      put("gable", [0.36, 0.34, 0.34], 0, 5, 0, w * 0.86, 2, d * 0.66);
      put("box", STONE, w * 0.25, 4.5, d * 0.2, 1.4, 9, 1.4);
      put("box", [1, 0.45, 0.1], 0, 1, d * 0.31, 2, 1.4, 0.3);
      break;
    case "market":
      put("box", [0.62, 0.46, 0.3], 0, 3.5, 0, w * 0.92, 0.6, d * 0.7);
      for (let k = 0; k < 4; k++) {
        const u = (k - 1.5) * (w / 4);
        put("box", [0.62, 0.46, 0.3], u, 1, 0, w / 4 - 1.5, 2, d * 0.5);
        put(
          "box",
          k % 2 ? [0.9, 0.22, 0.2] : [0.98, 0.8, 0.2],
          u,
          2.6,
          0,
          w / 4 - 0.6,
          0.3,
          d * 0.62,
        );
      }
      break;
    case "mill":
      put("cyl", WHITE, 0, 5, 0, 6, 10, 6);
      put("cone", [0.5, 0.36, 0.24], 0, 11, 0, 6.6, 2.4, 6.6);
      put("box", TIMBER, 0, 9, d * 0.24, 16, 0.8, 0.3, 0.6);
      put("box", TIMBER, 0, 9, d * 0.24, 16, 0.8, 0.3, -0.6 + Math.PI / 2);
      break;
    case "temple":
      [1, 0.72, 0.46].forEach((s, n) =>
        put("box", WHITE, 0, 1.5 + n * 3, 0, w * 0.9 * s, 3, d * 0.9 * s),
      );
      put("cone", GOLD, 0, 10.5, 0, d * 0.3, 3, d * 0.3);
      break;
    case "hall":
      put("box", STONE, 0, 0.5, 0, w * 0.95, 1, d * 0.9);
      put("box", WHITE, 0, 5, -d * 0.1, w * 0.8, 8, d * 0.6);
      put("gable", [0.82, 0.28, 0.16], 0, 10, -d * 0.1, w * 0.86, 3, d * 0.7);
      for (let k = 0; k < 6; k++)
        put("cyl", WHITE, ((k - 2.5) / 6) * w * 0.8, 4.5, d * 0.32, 1, 8, 1);
      break;
    case "school":
      put("box", BRICK, 0, 3.5, 0, w * 0.9, 7, d * 0.7);
      put("gable", [0.4, 0.42, 0.46], 0, 8, 0, w * 0.94, 2, d * 0.76);
      put("box", WHITE, w * 0.3, 7, d * 0.2, 2.6, 14, 2.6);
      put("cone", [0.4, 0.42, 0.46], w * 0.3, 15, d * 0.2, 3.2, 2.4, 3.2);
      break;
    case "workshop":
      put("box", [0.56, 0.5, 0.44], 0, 2.5, 0, w * 0.9, 5, d * 0.8);
      put("gable", [0.46, 0.44, 0.44], 0, 6, 0, w * 0.94, 2, d * 0.84);
      put("box", BRICK, w * 0.3, 6, -d * 0.2, 1.2, 8, 1.2);
      break;
    case "docks":
      put("box", TIMBER, 0, 0.6, 0, w * 0.95, 1.2, d * 0.95);
      put("box", [0.6, 0.5, 0.4], -w * 0.2, 4, 0, w * 0.5, 6, d * 0.6);
      put("box", CRANE, w * 0.3, 6, 0, 1, 12, 1);
      put("box", CRANE, w * 0.3, 12, d * 0.2, 0.8, 0.8, 9);
      break;
    case "academy":
      put("box", WHITE, 0, 4, 0, w * 0.9, 8, d * 0.8);
      put("cyl", WHITE, 0, 10, 0, 9, 4, 9);
      put("cone", [0.34, 0.56, 0.5], 0, 14, 0, 10, 4, 10);
      break;
    case "baths":
      put("box", [0.86, 0.8, 0.66], 0, 3, 0, w * 0.9, 6, d * 0.8);
      put("cone", [0.86, 0.8, 0.66], 0, 8, 0, d * 0.7, 4, d * 0.7);
      break;
    case "observatory":
      put("cyl", WHITE, 0, 6, 0, 8, 12, 8);
      put("cone", [0.62, 0.66, 0.72], 0, 14, 0, 9, 4, 9);
      break;
    case "hospital":
      put("box", WHITE, 0, 6, 0, w * 0.9, 12, d * 0.8);
      put("box", [0.86, 0.14, 0.14], 0, 12.3, 0, 7, 0.4, 2.2);
      put("box", [0.86, 0.14, 0.14], 0, 12.3, 0, 2.2, 0.4, 7);
      break;
    case "factory":
      put("box", BRICK, 0, 5, 0, w * 0.92, 10, d * 0.9);
      for (let k = 0; k < 4; k++)
        put("gable", [0.5, 0.5, 0.52], 0, 11.5, ((k - 1.5) / 4) * d * 0.9, w * 0.92, 3, d * 0.22);
      put("cyl", BRICK, w * 0.36, 14, d * 0.36, 2.4, 28, 2.4);
      put("cyl", BRICK, w * 0.22, 12, d * 0.36, 2, 24, 2);
      break;
    case "station":
      put("box", [0.7, 0.6, 0.5], 0, 4, -d * 0.2, w * 0.9, 8, d * 0.4);
      put("box", [0.5, 0.52, 0.56], 0, 6, d * 0.2, w * 0.95, 0.6, d * 0.4);
      put("box", [0.7, 0.6, 0.5], -w * 0.38, 9, -d * 0.2, 4, 18, 4);
      put("box", WHITE, -w * 0.38, 15, -d * 0.2 + 2.05, 2.4, 2.4, 0.2);
      break;
    case "power":
      put("cyl", [0.82, 0.82, 0.8], -w * 0.2, 12, 0, 16, 24, 16);
      put("box", CONCRETE, w * 0.25, 6, 0, w * 0.4, 12, d * 0.6);
      put("cyl", [0.9, 0.3, 0.26], w * 0.36, 22, d * 0.3, 2.6, 44, 2.6);
      break;
    case "offices":
      put("box", GLASS, 0, 30, 0, w * 0.9, 60, d * 0.8);
      put("box", FRAME, 0, 61, 0, w * 0.6, 2, d * 0.5);
      break;
  }
}

/** The tallest a building of each kind stands (metres), for its scaffold. */
const CIVIC_HIGH: Readonly<Record<string, number>> = {
  shrine: 7,
  granary: 8,
  kiln: 8,
  smithy: 9,
  market: 4,
  mill: 12,
  temple: 12,
  hall: 12,
  school: 16,
  workshop: 9,
  docks: 12,
  academy: 16,
  baths: 10,
  observatory: 16,
  hospital: 13,
  factory: 28,
  station: 18,
  power: 44,
  offices: 62,
};

/** A town's other buildings at moment t: rising in a scaffold, standing, or fallen to ruin. */
export function townCivics(scene: TownScene, t: number, out: TownParts): void {
  const { plan, lots, states } = scene;
  for (const c of plan.civics) {
    if (c.at + c.lots > lots.x.length) continue;
    const m = civicMoments(c),
      f = footprint(lots, c.at, c.lots);
    if (t < m.began) continue;
    if (m.fell !== null && t >= m.fell) {
      // Fallen: its ruin, till homes are raised on its lots.
      let built = false;
      for (let p = c.at; p < c.at + c.lots && !built; p++)
        built = states.what[p] === LOT.home && states.began[p]! > m.fell;
      const years = (t - m.fell) / YEAR_S;
      if (!built && years < 60)
        civicShape(out, c.kind, f, Math.max(0.12, 0.45 - years / 120), (k) => darker(k, 0.55));
      continue;
    }
    const g = Math.min(1, (t - m.began) / Math.max(1, m.done - m.began));
    out.put("box", FOOTING, f.x, 0.1, f.z, f.w - 0.6, 0.2, f.d - 0.6, f.yaw);
    civicShape(out, c.kind, f, g < 1 ? Math.max(0.05, g) : 1);
    if (g < 1) {
      const top = (CIVIC_HIGH[c.kind] ?? 10) * g + 1.5;
      for (const [u, v] of [
        [f.w / 2, f.d / 2],
        [-f.w / 2, f.d / 2],
        [f.w / 2, -f.d / 2],
        [-f.w / 2, -f.d / 2],
      ] as const) {
        const [cx, cz] = at(f.x, f.z, f.yaw, u, v);
        out.put("box", TIMBER, cx, top / 2, cz, 0.25, top, 0.25, 0);
      }
    }
  }
}

/** Whether a town's buildings change through the year from moment t (one rising, begun, fallen). */
export function civicsActive(plan: TownPlan, t: number): boolean {
  return plan.civics.some((c: TownCivic) => {
    const m = civicMoments(c);
    return t < m.done || (m.fell !== null && t < m.fell + YEAR_S);
  });
}

/**
 * A town's walls at moment t: courses of stone about it, a tower every few lengths, a gate where
 * its road runs out — none where the town has grown over them, nor in its water.
 */
export function townWalls(scene: TownScene, t: number, out: TownParts): void {
  const w = scene.plan.walls,
    ring = scene.walls;
  if (!w || !ring) return;
  const begun = (w.start + 1) * YEAR_S;
  if (t < begun) return;
  const g = Math.min(1, (t - begun) / Math.max(YEAR_S, (w.end - w.start) * YEAR_S)),
    high = 7 * g;
  for (const l of ring.lengths) {
    // (A gate where the road runs out, both ways: a tower between two ways through.)
    if (l.gate) {
      out.put("box", STONE, l.x, high * 0.75, l.z, GATE_TOWER, high * 1.5, GATE_TOWER, l.yaw);
      continue;
    }
    if (high <= 0.05) continue;
    out.put("box", STONE, l.x, high / 2, l.z, l.len, high, WALL_THICK, l.yaw);
    if (l.tower)
      out.put("cyl", STONE, l.x, high * 0.65, l.z, WALL_TOWER, high * 1.3, WALL_TOWER, 0);
  }
}

/** The lot nearest a point (metres from the middle), for a tap (-1 if none near). */
export function lotNear(scene: TownScene, x: number, z: number, reach = LOT_W): number {
  let best = -1,
    d = reach * reach;
  const { lots, plan } = scene;
  for (let p = 0; p < plan.lots; p++) {
    const dx = lots.x[p]! - x,
      dz = lots.z[p]! - z,
      e = dx * dx + dz * dz;
    if (e < d) {
      d = e;
      best = p;
    }
  }
  return best;
}
