// A town drawn from its fabric (Phase 23 M149, asked for 2026-10-24: "i cant see the cities form
// and evolve and get that type of detail i got from the og causalisis"): its streets about its
// blocks, paved once its land paves them; each home at its level in the design it was raised in
// — huts, houses, townhouses of three storeys, tenements of five, blocks of ten, high-rises of
// twenty-four — and, while one rises, its stages as Classic drew them: stakes, a footing, the
// frame, walls climbing inside a scaffold (a crane over the tall ones), the roof going on; a
// home let fall standing empty, roofless, its walls crumbling year by year; a burnt one black
// stubs — and, where the god's fire or a quake struck it, each home standing till it caught,
// blackening as it burns and falling in, or shaken down to rubble (Phase 42 M201); its other
// buildings each in a shape of its own, rising, standing, fallen; its walls
// raised course by course, a tower at every few lengths and a gate where its road runs out —
// pulled down where the town has grown over them; a great city's sprawl past the lots drawn, its
// avenues kept clear. Past our ages (Phase 66): spires of woven carbon, works with no stack, vats, and a
// sprawl of towers to the haze where its people have built over their fields. Pure: what is drawn at a
// moment, in parts (metres from the square's middle), for the renderer to put in its batches.
import { greatGone, timeRaids } from "./raid.ts";
import {
  BLOCK_D,
  BLOCK_LOTS,
  BLOCK_W,
  GATE_TOWER,
  LOT,
  LOT_D,
  LOT_W,
  SPREAD,
  SQUARE,
  STREET,
  WALL_THICK,
  WALL_TOWER,
  blocksHeld,
  askedGrown,
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
  type VillagePlan,
} from "../bridge/index.ts";
import { HOME_LIFE } from "../rules/index.ts";
import { houseLook, type HouseLook } from "./village.ts";
import { biomeColor } from "./globe.ts";
import { lifeTint } from "./biochem.ts";
import { WORN_WIDE, wornOf } from "./worn.ts";

type Rgb = readonly [number, number, number];
export type PartMesh = "box" | "gable" | "cone" | "cyl" | "dome";

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
  /** A ring of ports about a round hall, lit as windows are (Phase 64). */
  lampRound(x: number, y: number, z: number, wide: number, high: number): void {
    let g = this.groups.get("lampRound");
    if (!g) this.groups.set("lampRound", (g = { mesh: "cyl", color: LAMP, data: [], lamp: true }));
    g.data.push(x, y, z, wide, high, wide, 0);
  }
  /** What every colour put is seen as, for a while (a sealed town's buildings, Phase 64). */
  tone: ((c: Rgb) => Rgb) | null = null;
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
    if (this.tone) color = this.tone(color);
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
  { w: 8.6, d: 12.2, h: 300, storeys: 120 },
];
/** The tallest level drawn. */
const TOP_LEVEL = LEVELS.length - 1;
/**
 * How high a home of a town stands to its roof's top, and how broad it is (metres; Phase 42
 * M201): a hut or a house as its look draws it, its roof as steep as its rain wants.
 */
export function homeSize(scene: TownScene, p: number): { high: number; wide: number } {
  const level = Math.max(0, Math.min(TOP_LEVEL, scene.states.level[p]!)),
    L = LEVELS[level]!;
  if (level > 1) return { high: L.h + (level === 2 ? 3.2 : 0.5), wide: L.w };
  const look = scene.looks[scene.states.design[p]!] ?? scene.looks[0]!,
    [w, d] = lowFoot(L, look),
    flat = look.rise < 0.1,
    rh = look.open ? 0 : look.tent ? 7.5 : flat ? 0.6 : Math.min(5, look.rise * d * 0.5);
  return { high: look.raised * 10 + L.h * look.height + rh, wide: Math.max(w, d) };
}
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
  ASH: Rgb = [0.22, 0.21, 0.2],
  SCORCHED: Rgb = [0.13, 0.12, 0.11],
  // (Its top clear of the yards' half a metre; what is left of what stood rises through it.)
  ASH_FOOT = 0.2,
  ASH_TOP = 0.8,
  ASH_TOP_FAR = 3,
  ASH_QUARTERS: readonly (readonly [number, number])[] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  HEARTH: Rgb = [0.46, 0.44, 0.41],
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
  /** Its homes razed by what struck it (Phase 42 M201): the lots, in the order they caught or fell. */
  readonly struck: readonly number[];
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
    looks = plan.designs.map((d: TownDesign) => {
      const look = houseLook(
        { walls: d.walls, roof: d.roof, form: d.form, pitch: d.pitch, design: null },
        plan.lifeLook,
      );
      return plan.sealed ? { ...look, sealed: true } : look;
    }),
    active: number[] = [],
    settled: number[] = [],
    struck: number[] = [],
    scene = {
      plan,
      lots,
      states,
      struck,
      held,
      walls: wallRing(plan, lots, held),
      looks,
      active,
      settled,
    };
  // (A raid's lots caught as its machines pass over them: W2.)
  timeRaids(plan, lots, states, homesRiseTo(plan), sprawlOf(plan, lots));
  for (let p = 0; p < plan.lots; p++) if (states.struck[p]! >= 0) struck.push(p);
  struck.sort((a, b) => states.began[a]! - states.began[b]!);
  // Active: rising, or to be rebuilt as it wears before the year is out; or struck, till it has
  // burnt and fallen in.
  for (let p = 0; p < plan.lots; p++) {
    if (states.struck[p]! >= 0 && t < states.began[p]! + FALLS_S) active.push(p);
    else if (states.what[p] !== LOT.home) settled.push(p);
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
  const level = Math.max(0, Math.min(TOP_LEVEL, states.level[p]!)),
    L = LEVELS[level]!;
  // (No hearth's smoke from a needle.)
  if (level >= TOP_LEVEL) return null;
  const look = looks[homeWear(scene, p, t).look] ?? looks[0];
  if (!look) return null;
  if (level <= 1) {
    const [, d] = lowFoot(L, look),
      rise = look.tent ? 7.5 : look.rise < 0.1 ? 0.6 : Math.min(5, look.rise * d * 0.5);
    return look.raised * 10 + L.h * look.height + rise;
  }
  return L.h + (level === 2 ? 3.2 : level === 5 ? 10 : 2.8);
}

/** A home's box at moment t, whole or rising or what is left of it (metres), for what is laid over it; null: no such lot. */
export function homeBox(
  scene: TownScene,
  p: number,
  t: number,
): {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
} | null {
  const { lots, states } = scene;
  if (p < 0 || p >= lots.x.length) return null;
  const L = LEVELS[Math.max(0, Math.min(TOP_LEVEL, states.level[p]!))]!,
    home = states.what[p] === LOT.home,
    whole = home && progress(states.began[p]!, states.takes[p]!, t) >= 1,
    top = whole ? (roofTop(scene, p, t) ?? L.h) : home ? 2 : 0.6;
  return {
    x: lots.x[p]!,
    z: lots.z[p]!,
    yaw: lots.yaw[p]!,
    w: L.w + 0.8,
    d: L.d + 0.8,
    h: top + 0.4,
  };
}

/**
 * The ground of a sealed town (Phase 64): its first hall, a great dome on the square its pods ring; its
 * blocks' plates of rock levelled and swept, a covered way down each with the pressure kept in it.
 */
function sealedGround(scene: TownScene, out: TownParts): void {
  const { plan, lots } = scene,
    rock = plan.sealed!.rock,
    plate: Rgb = [rock[0] * 0.7 + 0.12, rock[1] * 0.7 + 0.12, rock[2] * 0.7 + 0.12],
    deck: Rgb = [0.42, 0.43, 0.46],
    way: Rgb = [0.78, 0.8, 0.8],
    glass: Rgb = [0.5, 0.68, 0.8];
  out.put("cyl", deck, 0, 0.2, 0, SQUARE * 2.1, 0.36, SQUARE * 2.1, 0);
  const blocks = Math.ceil(plan.lots / BLOCK_LOTS);
  for (let b = 0; b < blocks; b++) {
    const x = lots.blocks.x[b]!,
      z = lots.blocks.z[b]!,
      yaw = lots.blocks.yaw[b]!;
    out.put("box", deck, x, 0.18, z, BLOCK_W + STREET, 0.24, BLOCK_D + STREET, yaw);
    out.put("box", plate, x, 0.3, z, BLOCK_W - 0.6, 0.4, BLOCK_D - 0.6, yaw);
    // (A covered way along its street's one side, with a glass ridge.)
    const [wx, wz] = at(x, z, yaw, 0, -BLOCK_D / 2 - STREET * 0.28);
    out.put("box", way, wx, 1.1, wz, BLOCK_W + STREET, 1.8, 1.7, yaw);
    out.put("box", glass, wx, 2.1, wz, BLOCK_W + STREET, 0.3, 0.9, yaw);
  }
  // The first hall, on its square: a great dome and its airlocks, its glass lit from within.
  const r = SQUARE * 1.15;
  out.put("cyl", SEAL, 0, 0.7, 0, r * 2.14, 0.6, r * 2.14, 0);
  out.put("dome", HULL, 0, 1 + r * 0.6, 0, r * 2, r * 1.2, r * 2, 0);
  out.put("dome", DOME, 0, 1 + r * 1.2 - 0.9, 0, r * 0.9, 2.4, r * 0.9, 0);
  for (let k = 0; k < 4; k++) {
    const a = plan.axis + (k * Math.PI) / 2,
      c = Math.cos(a),
      s = Math.sin(a);
    out.put("box", way, c * (r + 1.2), 1.4, s * (r + 1.2), 3.4, 2.4, 3.4, -a);
    out.lamp(c * (r + 0.15), 3.6, s * (r + 0.15), 2.2, 0.7, 2.2, -a);
  }
}

/**
 * The ground of a town: its square, and each block's street about it and its yards. `burned`: where the greatest fire
 * took it, none of that (a land's map sets each piece on its own rise, so what lay under the ash would stand through it).
 */
export function townGround(
  scene: TownScene,
  out: TownParts,
  burned = false,
  /** The most pieces of worn ground drawn (R1). */
  mostWorn = 1500,
): void {
  const { plan, lots } = scene;
  if (plan.sealed) return sealedGround(scene, out);
  const ash = burned ? (plan.ash ?? 0) : 0;
  // (On a world of another kind, its grassland's colour: Phase 56; its life's: Phase 57.)
  const yard: Rgb = lifeTint(
      plan.kind ? biomeColor(8, plan.kind) : [0.5, 0.6, 0.34],
      plan.lifeLook,
    ),
    // (A street none has worn is the land's own, a little bared: what has worn it is drawn over it, R1.)
    street: Rgb = plan.paved ? [0.66, 0.64, 0.6] : mixed(yard, [0.6, 0.53, 0.4], 0.5);
  // In metres, as everything here: the streets stand a hand above the land's ground and the
  // pasture under them, the yards a curb above the streets, so neither sinks out of sight.
  if (ash <= 0)
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
    if (b * BLOCK_LOTS < ash) continue;
    const x = lots.blocks.x[b]!,
      z = lots.blocks.z[b]!,
      yaw = lots.blocks.yaw[b]!;
    out.put("box", street, x, 0.18, z, BLOCK_W + STREET, 0.24, BLOCK_D + STREET, yaw);
    out.put("box", yard, x, 0.3, z, BLOCK_W - 0.6, 0.4, BLOCK_D - 0.6, yaw);
  }
  // Where its people have gone (R1), over the streets and under the yards' curbs.
  // (Bared to the ground under it, in its land's own colours: dark enough to be told from a street none walks, from as far as a person's eye goes.)
  const wornEarth: Rgb =
    plan.ways === "swim" ? [0.86, 0.84, 0.68] : mixed(yard, [0.16, 0.1, 0.05], 0.8);
  for (const w of wornOf(scene, mostWorn).pieces) {
    const deep = 0.5 + 0.12 * w.band,
      base: Rgb = plan.paved
        ? mixed(street, [0.2, 0.2, 0.22], 0.28 + 0.13 * w.band)
        : mixed(street, wornEarth, deep),
      // (A way none walks now goes back to green. Bands of it, so a few batches hold them all.)
      c = w.green > 0.5 ? mixed(base, yard, w.green > 0.8 ? 0.8 : 0.55) : base,
      tunnel = plan.ways === "tunnel";
    out.put(
      "box",
      c,
      w.x,
      tunnel ? 0.5 : 0.415,
      w.z,
      WORN_WIDE[w.band]!,
      tunnel ? 0.26 : 0.03,
      w.len,
      w.yaw,
    );
  }
  // A well at the square's heart; a market cross once it is paved.
  out.put("cyl", STONE, 0, 0.5, 0, 2.4, 1, 2.4, 0);
  if (plan.paved) out.put("box", STONE, 0, 2.2, 0, 0.6, 3.4, 0.6, 0);
  sprawl(scene, out, burned);
}

/** Two colours mixed: `k` of the second. */
function mixed(a: Rgb, b: Rgb, k: number): Rgb {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
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
    // (Built up as spires are, it holds as many on far less: yet it has spread far past any other.)
    r1 = Math.min(hasSpires(plan) ? 5200 : 2600, r0 * Math.sqrt(plan.whole / plan.lots));
  return r1 > r0 + 20 ? { r0, r1 } : null;
}

/**
 * A great city's lots past those drawn: its sprawl, low roofs on its trodden ground out to as far
 * as all its lots would reach, one roof for every few homes, into the haze — its avenues kept
 * clear, and its water.
 */
function sprawl(scene: TownScene, out: TownParts, burned = false): void {
  const { plan, looks } = scene,
    ring = sprawlOf(plan, scene.lots);
  if (!ring) return;
  const clear = burned ? ashReach(plan, scene.lots) : 0;
  const { r0, r1 } = ring,
    n = Math.min(3000, Math.round((plan.whole - plan.lots) / 6)),
    water = plan.water,
    wet = (x: number, z: number, margin: number) =>
      !!water && Math.hypot(x - water.x, z - water.z) < water.r + margin,
    towers = hasSpires(plan),
    trodden: Rgb = towers ? [0.34, 0.35, 0.38] : plan.paved ? [0.56, 0.55, 0.5] : [0.55, 0.5, 0.4];
  // Its trodden ground, in bands of patches about it (none on the water).
  const bands = 6,
    round = 72;
  for (let b = 0; b < bands; b++) {
    const lo = r0 + ((r1 - r0) * b) / bands,
      hi = r0 + ((r1 - r0) * (b + 1)) / bands,
      mid = (lo + hi) / 2,
      across = (2 * Math.PI * hi) / round + 1;
    if (hi <= clear) continue;
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
      if (wet(x, z, 4) || r + len <= clear) continue;
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
  sprawlRoofs(scene, out, ashReach(plan, scene.lots), Infinity);
}

/** How far out from its middle the greatest fire's ash reaches (metres; 0: none). */
export function ashReach(plan: TownPlan, lots: TownLots): number {
  const ash = plan.ash ?? 0;
  if (ash <= 0) return 0;
  const ring = sprawlOf(plan, lots);
  if (!ring || ash <= plan.lots) return townReach(lots, Math.min(ash, plan.lots));
  const { r0, r1 } = ring;
  return Math.sqrt(r0 * r0 + (r1 * r1 - r0 * r0) * ((ash - plan.lots) / (plan.whole - plan.lots)));
}

/** A great city's roofs past those drawn, between so far and so far from its middle (metres). */
function sprawlRoofs(scene: TownScene, out: TownParts, from: number, to: number): void {
  const { plan, looks } = scene,
    ring = sprawlOf(plan, scene.lots);
  if (!ring) return;
  const { r0, r1 } = ring,
    n = Math.min(3000, Math.round((plan.whole - plan.lots) / 6)),
    water = plan.water,
    wet = (x: number, z: number, margin: number) =>
      !!water && Math.hypot(x - water.x, z - water.z) < water.r + margin,
    towers = hasSpires(plan);
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
    if (r < from || r >= to) continue;
    // (Off its avenues, and out of its water.)
    if (Math.min(off, sector * r - off) < AVENUE_HALF + w / 2 + 1 || wet(x, z, w / 2 + 4)) continue;
    if (towers) {
      // Towers and more towers, tallest toward its heart, their floors lit, into the haze.
      const near = 1 - (r - r0) / (r1 - r0),
        high = 34 + 40 * scatter(plan.seed, i, 5) + 170 * near * near * scatter(plan.seed, i, 6),
        glass = SPIRE_GLASS[i % SPIRE_GLASS.length]!;
      out.put("box", glass, x, high / 2, z, Math.min(w, 18), high, Math.min(d * 2, 18), yaw);
      for (const up of [0.46, 0.8])
        out.lamp(x, high * up, z, Math.min(w, 18) * 1.01, 1.8, Math.min(d * 2, 18) * 1.01, yaw);
      continue;
    }
    out.put("box", look.wall, x, h / 2, z, w, h, d, yaw);
    out.put("gable", look.roof, x, h + 1.1, z, w * 1.04, 2.2, d * 1.1, yaw);
  }
}

/**
 * A land built over, as its land's map draws what its towns' own fabric does not reach (Phase 66): low
 * roofs in great blocks and towers among them, a set number, thick on the ground wherever the ground is dry.
 * `half` is how far the land goes from its middle (m). From its land's key, the same each time it is seen.
 */
export function builtOverParts(key: number, half: number, out: TownParts): void {
  const across = (k: number) => (scatter(key, k, 30) * 2 - 1) * half,
    down = (k: number) => (scatter(key, k, 31) * 2 - 1) * half;
  for (let i = 0; i < BUILT_ROOFS; i++) {
    const u = scatter(key, i, 32),
      w = 340 + 520 * u,
      d = 340 + 520 * scatter(key, i, 33),
      h = 22 + 44 * scatter(key, i, 34);
    out.put(
      "box",
      BUILT_GREYS[i % BUILT_GREYS.length]!,
      across(i),
      h / 2,
      down(i),
      w,
      h,
      d,
      u * 0.2,
    );
  }
  for (let i = 0; i < BUILT_TOWERS; i++) {
    const k = i + BUILT_ROOFS,
      v = scatter(key, k, 35),
      w = 90 + 110 * scatter(key, k, 36),
      h = 90 + 460 * v * v * v;
    out.put(
      "box",
      SPIRE_GLASS[i % SPIRE_GLASS.length]!,
      across(k),
      h / 2,
      down(k),
      w,
      h,
      w * (0.8 + 0.5 * scatter(key, k, 37)),
      v * 1.2,
    );
  }
}

/** How much of a land built over the land's map draws, past its towns' own fabric. */
const BUILT_ROOFS = 3600,
  BUILT_TOWERS = 2400,
  BUILT_GREYS: readonly Rgb[] = [
    [0.5, 0.5, 0.52],
    [0.42, 0.43, 0.46],
    [0.58, 0.56, 0.54],
  ];

/**
 * A craft flying a town's sky (Phase 66): its lane about the town or along an avenue, how high it flies,
 * how fast. A look, seen by the screen's clock, as the beasts are: nothing it does is history.
 */
export type Flier = {
  /** Ring (r: how far out) or avenue (way: its heading, from r out to `to` and back). */
  readonly way: number | null;
  readonly r: number;
  readonly to: number;
  readonly high: number;
  /** Metres a second. */
  readonly pace: number;
  /** Where along its lane it was at the clock's beginning (0 … 1). */
  readonly from: number;
};

/** A town's fliers, from its plan (none: none in its sky). */
export function fliersOf(plan: VillagePlan): readonly Flier[] {
  const town = plan.town,
    n = plan.past?.fliers ?? 0;
  if (!town || n <= 0 || town.sealed) return [];
  const seed = town.seed,
    reach = Math.max(120, Math.min(900, 18 * Math.sqrt(town.lots))),
    out: Flier[] = [];
  for (let i = 0; i < n; i++) {
    const r = 60 + scatter(seed, i, 20) * reach,
      // (A world built over keeps its lanes among its towers and over them.)
      high = plan.past?.covered
        ? 70 + 96 * Math.floor(scatter(seed, i, 21) * 6)
        : 42 + 36 * Math.floor(scatter(seed, i, 21) * 5),
      pace = 34 + 40 * scatter(seed, i, 22),
      from = scatter(seed, i, 23);
    out.push(
      i % 3 === 0
        ? { way: avenueWay(town, i % AVENUES), r: 30, to: reach * 1.5, high, pace, from }
        : { way: null, r, to: r, high, pace, from },
    );
  }
  return out;
}

/** Where a flier is by the screen's clock: its place and heading (metres from the town's middle). */
export function flierAt(f: Flier, clock: number): { x: number; y: number; z: number; yaw: number } {
  if (f.way === null) {
    const a = f.from * 2 * Math.PI + (clock * f.pace) / f.r;
    return { x: f.r * Math.cos(a), y: f.high, z: f.r * Math.sin(a), yaw: -a };
  }
  // (Out along its avenue and back.)
  const span = f.to - f.r,
    k = (f.from * 2 * span + clock * f.pace) % (2 * span),
    out = k <= span,
    d = f.r + (out ? k : 2 * span - k);
  return {
    x: d * Math.cos(f.way),
    y: f.high,
    z: d * Math.sin(f.way),
    yaw: Math.PI / 2 - f.way + (out ? 0 : Math.PI),
  };
}

/** A sealed hall's colours (Phase 64): its hull, tinted by its design; its glass; its dark seals. */
const HULL: Rgb = [0.9, 0.91, 0.9],
  DOME: Rgb = [0.56, 0.78, 0.9],
  SEAL: Rgb = [0.36, 0.38, 0.42];

/** A building's colours under a sealed town's roofs: its brick and timber plated, a hint of them kept. */
const sealedTone = (c: Rgb): Rgb => [c[0] * 0.34 + 0.54, c[1] * 0.34 + 0.55, c[2] * 0.34 + 0.56];

/**
 * A home of sealed halls (Phase 64): at a hut's and a house's level a pod, a low dome on its ring with
 * a lock to the covered way; above it, round halls of three and five storeys under glass; then towers
 * of ten and twenty-four storeys, their tops domed: a town kept against an empty sky.
 */
function sealedHome(
  out: TownParts,
  look: HouseLook,
  level: number,
  x: number,
  z: number,
  yaw: number,
  grow: number,
  roof: number,
): void {
  const hull: Rgb = [
      HULL[0] + (look.wall[0] - HULL[0]) * 0.1,
      HULL[1] + (look.wall[1] - HULL[1]) * 0.1,
      HULL[2] + (look.wall[2] - HULL[2]) * 0.1,
    ],
    // (Its design's colour, stronger, as a band about its top: whose work it is, seen from afar.)
    band: Rgb = [
      Math.min(1, look.wall[0] * 1.25 + 0.05),
      Math.min(1, look.wall[1] * 0.9 + 0.05),
      Math.min(1, look.wall[2] * 0.8 + 0.08),
    ],
    L = LEVELS[Math.max(0, Math.min(TOP_LEVEL, level))]!;
  if (level <= 1) {
    const w = level === 0 ? 5.6 : 7.4,
      h = (level === 0 ? 3.1 : 4.1) * grow;
    if (h <= 0.05) return;
    out.put("cyl", SEAL, x, 0.72, z, w + 0.5, 0.44, w + 0.5, yaw);
    out.put("dome", hull, x, 0.8 + h / 2, z, w, h, w, yaw);
    if (grow >= 1) {
      // Its skylight, its lock, its lit port.
      out.put("dome", DOME, x, 0.8 + h - 0.22, z, w * 0.34, 0.6, w * 0.34, yaw);
      const [lx, lz] = at(x, z, yaw, 0, -w / 2 - 0.15);
      out.put("box", SEAL, lx, 1.2, lz, 1.5, 1.7, 1.2, yaw);
      const [wx, wz] = at(x, z, yaw, w * 0.3, -w * 0.33);
      out.lamp(wx, 1.9, wz, 0.9, 0.6, 0.5, yaw);
    }
    return;
  }
  // (The taller the slimmer: its footing the wider, a fat drum of three storeys, a needle of twenty-four.)
  const r =
      Math.min(LOT_W - 0.5, L.w + 0.6) *
      (level === 2 ? 1 : level === 3 ? 0.92 : level === 4 ? 0.84 : level === 5 ? 0.76 : 0.7),
    // (Woven carbon past the first towers: as high again as its neighbour, or half as high.)
    h = L.h * grow * (level > 5 ? spireShare(x, z) : 1);
  if (h <= 0.05) return;
  out.put("cyl", SEAL, x, 0.72, z, r + 0.5, 0.44, r + 0.5, yaw);
  out.put("cyl", hull, x, 0.8 + h / 2, z, r, h, r, yaw);
  const bands = Math.min(5, Math.max(1, Math.floor((L.storeys * grow) / (level >= 4 ? 5 : 2))));
  for (let k = 0; k < bands; k++) {
    const y = 0.8 + ((k + 0.5) / (bands + 0.6)) * h;
    if (grow >= 1) out.lampRound(x, y, z, r * 1.012, 0.55);
    else out.put("cyl", SEAL, x, y, z, r * 1.012, 0.55, r * 1.012, yaw);
  }
  if (roof <= 0) return;
  out.put("cyl", band, x, 0.8 + h * 0.97, z, r * 1.02, Math.min(1.2, h * 0.06), r * 1.02, yaw);
  out.put("cyl", SEAL, x, 0.8 + h + 0.15, z, r * 1.04, 0.3, r * 1.04, yaw);
  const cap = level >= 4 ? r * 0.55 : r * 0.42;
  out.put(
    "dome",
    DOME,
    x,
    0.8 + h + 0.3 + (cap * roof) / 2,
    z,
    r * 0.92,
    cap * roof,
    r * 0.92,
    yaw,
  );
  if (level >= 5) out.put("box", FRAME, x, 0.8 + h + cap + 4, z, 0.4, 8, 0.4, 0);
}

/** A spire's share of its level's height, by where it stands: no two neighbours the same. */
function spireShare(x: number, z: number): number {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453,
    u = v - Math.floor(v),
    // (A skyline, not a wood: the most of them far under the tallest, and those at its heart.)
    heart = Math.max(0, 1 - Math.hypot(x, z) / 700);
  return 0.2 + (0.4 + 0.75 * heart) * u * u * (0.5 + 1.1 * u);
}

/** What a spire is dressed in (Phase 66): four glasses, its frames, its plinth of shops, a lit needle. */
const SPIRE_GLASS: readonly Rgb[] = [
    [0.4, 0.58, 0.74],
    [0.62, 0.56, 0.64],
    [0.32, 0.56, 0.58],
    [0.82, 0.86, 0.9],
  ],
  CARBON: Rgb = [0.16, 0.17, 0.2],
  PLINTH: Rgb = [0.36, 0.37, 0.4],
  NEEDLE: Rgb = [0.92, 0.3, 0.22];

/**
 * A spire: a plinth of shops, three shafts stepped in, each with its lit floors and a dark ring of woven
 * carbon where it steps, a needle at its top. Its land's design shows only in its plinth's colour: at
 * this height nothing is built but of what can stand there.
 */
function spire(
  out: TownParts,
  look: HouseLook,
  x: number,
  z: number,
  yaw: number,
  grow: number,
  roof: number,
): void {
  const L = LEVELS[TOP_LEVEL]!,
    share = spireShare(x, z),
    high = L.h * share,
    h = high * grow;
  if (h <= 0.05) return;
  const glass = SPIRE_GLASS[Math.floor(share * 53) % SPIRE_GLASS.length]!,
    plinth = Math.min(14, h);
  out.put(
    "box",
    [
      PLINTH[0] * 0.8 + look.wall[0] * 0.2,
      PLINTH[1] * 0.8 + look.wall[1] * 0.2,
      PLINTH[2] * 0.8 + look.wall[2] * 0.2,
    ],
    x,
    plinth / 2,
    z,
    L.w,
    plinth,
    L.d,
    yaw,
  );
  // (Three shafts: to a half, to four-fifths, to its top; each narrower.)
  let from = plinth;
  [
    [0.5, 0.88, 3],
    [0.8, 0.66, 2],
    [1, 0.42, 1],
  ].forEach(([to, wide, bands]) => {
    const top = Math.min(h, high * to!);
    if (top <= from) return;
    const span = top - from,
      w = L.w * wide!,
      d = L.d * wide!;
    out.put("box", glass, x, from + span / 2, z, w, span, d, yaw);
    if (grow >= 1)
      for (let k = 0; k < bands!; k++)
        out.lamp(x, from + ((k + 0.6) / bands!) * span, z, w * 1.008, 1.8, d * 1.008, yaw);
    out.put("box", CARBON, x, top + 0.4, z, w * 1.05, 0.9, d * 1.05, yaw);
    from = top;
  });
  if (roof >= 1) {
    out.put("box", FRAME, x, high + 9, z, 0.6, 18, 0.6, 0);
    out.put("box", NEEDLE, x, high + 18.5, z, 1, 1, 1, 0);
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
  // (Halls on another body: Phase 64.)
  if (look.sealed) return sealedHome(out, look, level, x, z, yaw, grow, roof);
  if (level >= TOP_LEVEL) return spire(out, look, x, z, yaw, grow, roof);
  const L = LEVELS[Math.max(0, Math.min(TOP_LEVEL, level))]!,
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
  const L = LEVELS[Math.max(0, Math.min(TOP_LEVEL, level))]!,
    [w, d] = level <= 1 ? lowFoot(L, look) : [L.w, L.d],
    h = L.h * (level <= 1 ? look.height : 1) * (level >= TOP_LEVEL ? spireShare(x, z) : 1),
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
    for (let y = 3; y < top; y += level >= TOP_LEVEL ? 30 : level >= 3 ? 6 : 3)
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

/** How high a town's homes stand at their tallest (metres; a spire by as much again as its level's third). */
export function homesRiseTo(plan: TownPlan): number {
  let top = 0;
  for (const r of plan.runs) if (r[0]! <= 1) top = Math.max(top, r[5]!);
  return LEVELS[Math.min(top, TOP_LEVEL)]!.h * (top >= TOP_LEVEL ? 1.4 : 1);
}

/** Whether a town has come to raise spires: what its sprawl is then made of. */
export function hasSpires(plan: TownPlan): boolean {
  return plan.runs.some((r) => r[0]! <= 1 && r[5]! >= TOP_LEVEL);
}

/** What the greatest fire left of a home: its lot's whole width in a low black heap, and here and there a stub (W5). */
function flatRubble(out: TownParts, x: number, z: number, yaw: number): void {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453,
    r = v - Math.floor(v),
    // (Over the ash that lies about it.)
    high = ASH_TOP - 0.5 + 0.3 + r * 0.9;
  out.put("box", r < 0.55 ? CHAR : ASH, x, 0.5 + high / 2, z, LOT_W - 1, high, LOT_D - 1.6, yaw);
  if (r > 0.72) out.put("box", CHAR, x, 0.5 + high + 0.8, z, 0.5, 1.6, 0.5, yaw + r * 3);
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
    // Burnt out (Phase 42 M201): its floor in ash, the stubs of its corner posts standing black
    // (one fallen), a beam come down across it, and its hearth's chimney left standing in its
    // smoked stone — all of it lower as the years go.
    const fade = Math.max(0.35, 1 - years / 30),
      // (Each ruin its own: how its posts burned, which fell.)
      r = (k: number) => {
        const v = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453;
        return v - Math.floor(v);
      },
      fallen = Math.floor(r(0) * 4),
      // (On its yard, which stands a curb above the street: half a metre up.)
      yard = 0.5;
    out.put("box", ASH, x, yard + 0.08, z, w * 0.96, 0.16, d * 0.96, yaw);
    for (let k = 0; k < 4; k++) {
      if (k === fallen) continue;
      const [px, pz] = at(
          x,
          z,
          yaw,
          (k & 1 ? 1 : -1) * (w / 2 - 0.3),
          (k & 2 ? 1 : -1) * (d / 2 - 0.3),
        ),
        h = (0.7 + 1.5 * r(k + 1)) * fade;
      out.put("box", CHAR, px, yard + h / 2, pz, 0.32, h, 0.32, yaw);
    }
    out.put("box", CHAR, x, yard + 0.3, z, w * 0.8, 0.28, 0.3, yaw + 0.45 + r(5) * 0.3);
    const [cx, cz] = at(x, z, yaw, w * 0.28, 0),
      high = 2.6 * fade;
    out.put("box", HEARTH, cx, yard + high / 2, cz, 0.9, high, 0.9, yaw);
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

/**
 * How what strikes a town plays out (seconds, Phase 42 M201): a burning home falls in after an
 * hour and a half; its flames burn two and a half hours; it smoulders a day and more after; the
 * dust of homes shaken down hangs a quarter of an hour; a quake shakes the ground forty seconds.
 */
export const FALLS_S = 1.5 * 3600,
  FLAMES_S = 2.5 * 3600,
  SMOULDER_S = 30 * 3600,
  DUST_S = 15 * 60,
  SHAKE_S = 40;

/** When the greatest fire comes on a town drawn from this plan (null: it has not fallen here; its moment unknown: long past). */
function greatAt(plan: TownPlan): number | null {
  if (!plan.ash) return null;
  const k = plan.struck?.find((s) => s.raid?.great);
  return k ? k.at + (k.raid!.rocket ? SPREAD.rocketFrom : SPREAD.raidFrom) : -Infinity;
}

/** How far out from its middle the greatest fire's ash lies at moment t (metres; 0: none, or not yet). */
export function ashGone(scene: TownScene, t: number): number {
  const at = greatAt(scene.plan);
  return at === null ? 0 : Math.min(ashReach(scene.plan, scene.lots), greatGone(t - at));
}

/** The moment a land's map draws a town at: past the greatest fire once it has fallen, the land having no film of it (W5). */
export function landMoment(plan: TownPlan, t: number): number {
  const at = greatAt(plan);
  return at === null || at === -Infinity ? t : Math.max(t, at + 2 * FALLS_S);
}

/**
 * The ground the greatest fire burned, as far as it has gone (W5): all one level, one black, a good way over all that lay
 * under it (its levels so near one another, one over the next, flicker from any way off), in patches that lie on a land's
 * rises as a town's sprawl does (`fine`: for a land's map, the more of them), up to its water's edge. And, ahead of the
 * fire, the roofs it has yet to take out there.
 */
export function townAsh(scene: TownScene, t: number, out: TownParts, fine = false): void {
  const { plan, lots } = scene;
  if (!plan.ash) return;
  const reach = ashReach(plan, lots),
    gone = ashGone(scene, t);
  if (gone < reach) sprawlRoofs(scene, out, gone, reach);
  if (gone <= 0) return;
  // (A land's map keeps its own water: its slabs are not set on it.)
  const water = fine ? undefined : plan.water,
    bands = fine ? 28 : 14,
    rounds = fine ? 144 : 72,
    // (From a land's height a slab must stand as far again over the land under it, or the two flicker.)
    top = fine ? ASH_TOP_FAR : ASH_TOP,
    y = (ASH_FOOT + top) / 2,
    high = top - ASH_FOOT,
    // (A patch reaching the water, in quarters as far as it takes to lie by the shore.)
    lay = (x: number, z: number, w: number, d: number, yaw: number, parts: number): void => {
      const off = water ? Math.hypot(x - water.x, z - water.z) - water.r : Infinity,
        half = Math.hypot(w, d) / 2;
      if (off >= half) {
        out.put("box", SCORCHED, x, y, z, w, high, d, yaw);
        return;
      }
      if (off <= -half || parts <= 0) return;
      for (const [u, v] of ASH_QUARTERS) {
        const [px, pz] = at(x, z, yaw, (u * w) / 4, (v * d) / 4);
        lay(px, pz, w / 2, d / 2, yaw, parts - 1);
      }
    };
  for (let b = 0; b < bands; b++) {
    const lo = (gone * b) / bands,
      hi = (gone * (b + 1)) / bands,
      round = Math.ceil((rounds * (b + 1)) / bands),
      across = (2 * Math.PI * hi) / round + 1;
    for (let k = 0; k < round; k++) {
      const a = ((k + 0.5) / round) * 2 * Math.PI;
      lay(
        ((lo + hi) / 2) * Math.cos(a),
        ((lo + hi) / 2) * Math.sin(a),
        across,
        hi - lo + 1,
        Math.PI / 2 - a,
        3,
      );
    }
  }
}

/** Whether a home of a town struck was thrown down by a quake (in rubble, not standing as it burned). */
export function thrownDown(scene: TownScene, p: number): boolean {
  const k = scene.plan.struck?.[scene.states.struck[p]!];
  // (And what the greatest fire reaches, W5: gone as it comes out to them, not burned down in hours.)
  return k?.kind === "quake" || !!k?.raid?.great;
}

/** How high a home's rubble lies, thrown down (metres). */
export const RUBBLE_HIGH = 1.6;

/**
 * Whether a home struck caught, fell or fell in between two moments (Phase 42 M201), so that it
 * is drawn again at once, not at the fire's next minute.
 */
export function strikeTurned(scene: TownScene, a: number, b: number): boolean {
  const lo = Math.min(a, b),
    hi = Math.max(a, b);
  if (!(hi > lo)) return false;
  for (const p of scene.struck) {
    const at = scene.states.began[p]!;
    if ((at > lo && at <= hi) || (at + FALLS_S > lo && at + FALLS_S <= hi)) return true;
  }
  return false;
}

/** When what struck a town plays out: from the first home catching to the last falling in (null: nothing struck). */
export function strikeSpan(scene: TownScene): { from: number; until: number } | null {
  const { struck, states } = scene;
  if (!struck.length) return null;
  return {
    from: states.began[struck[0]!]!,
    until: states.began[struck[struck.length - 1]!]! + FALLS_S,
  };
}

/** Parts put darkened by the fire, their windows dark: a burning home's (Phase 42 M201). */
class Scorched extends TownParts {
  private readonly into: TownParts;
  private readonly f: number;
  constructor(into: TownParts, f: number) {
    super();
    this.into = into;
    this.f = f;
  }
  override lamp(): void {}
  override put(
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
    this.into.put(mesh, darker(color, this.f), x, y, z, sx, sy, sz, yaw);
  }
}

/**
 * A home struck (Phase 42 M201) at moment t, its catching (or falling) `began` ago: standing whole
 * till then; burning — blackening by stages, its roof falling in, its walls burning down — till it
 * falls in, then black stubs; or, shaken down unburnt, rubble.
 */
function struckHome(
  out: TownParts,
  look: HouseLook,
  level: number,
  x: number,
  z: number,
  yaw: number,
  since: number,
  burns: boolean,
  thrown: boolean,
  flat: boolean,
): void {
  if (since < 0) {
    home(out, look, level, x, z, yaw);
    return;
  }
  if (flat) {
    flatRubble(out, x, z, yaw);
    return;
  }
  // (Thrown down: its rubble, burning there a while if it caught.)
  if (!burns || (thrown && since < FALLS_S)) {
    ruin(out, look, x, z, yaw, 20 + since / YEAR_S, false);
    return;
  }
  if (since >= FALLS_S) {
    ruin(out, look, x, z, yaw, since / YEAR_S, true);
    return;
  }
  const k = since / FALLS_S,
    f = [1, 0.66, 0.42, 0.26][Math.min(3, Math.floor(k * 4))]!;
  home(
    new Scorched(out, f),
    look,
    level,
    x,
    z,
    yaw,
    k < 0.6 ? 1 : 1 - (0.5 * (k - 0.6)) / 0.4,
    k < 0.6 ? 1 : 0,
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
    } else if (what === LOT.razed && states.struck[p]! >= 0)
      // (Struck: Phase 42 M201.)
      struckHome(
        out,
        look,
        states.level[p]!,
        x,
        z,
        yaw,
        t - states.began[p]!,
        states.burns[p] === 1,
        thrownDown(scene, p),
        !!scene.plan.struck?.[states.struck[p]!]?.raid?.great,
      );
    else if (what === LOT.fallen || what === LOT.razed) {
      const years = (t - states.began[p]!) / YEAR_S;
      if (years >= 0)
        if (what === LOT.razed && p < (scene.plan.ash ?? 0)) flatRubble(out, x, z, yaw);
        else ruin(out, look, x, z, yaw, years, what === LOT.razed);
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
  still = true,
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
    // A well: a low ring of stone, two posts and a little roof over it (H1).
    case "well":
      put("cyl", STONE, 0, 0.6, 0, 3.2, 1.2, 3.2);
      put("box", TIMBER, -1.5, 1.8, 0, 0.25, 3.6, 0.25);
      put("box", TIMBER, 1.5, 1.8, 0, 0.25, 3.6, 0.25);
      put("gable", [0.42, 0.32, 0.24], 0, 3.9, 0, 3.8, 0.8, 2.2);
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
      // (Its sails: still here, or turning where a mill standing is drawn near: civicMotions.)
      if ((still || grow < 1) && !out.tone) {
        put("box", TIMBER, 0, 9, d * 0.24, 16, 0.8, 0.3, 0.6);
        put("box", TIMBER, 0, 9, d * 0.24, 16, 0.8, 0.3, -0.6 + Math.PI / 2);
      }
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
    case "fusion": {
      // A flame held in a bottle: a drum of magnets in coils under a pale dome, its yard of
      // switchgear. No stack and no smoke: what it burns leaves nothing to carry away.
      const r = Math.min(w, d) * 0.72;
      put("box", CONCRETE, 0, 0.6, 0, w * 0.96, 1.2, d * 0.96);
      put("cyl", [0.58, 0.62, 0.68], 0, 8, 0, r, 15, r);
      for (let k = 0; k < 4; k++)
        put("cyl", [0.2, 0.42, 0.62], 0, 3 + k * 3.6, 0, r * 1.07, 1.3, r * 1.07);
      put("dome", [0.82, 0.86, 0.88], 0, 15.5 + r * 0.16, 0, r, r * 0.32, r);
      put("box", TAR, w * 0.38, 2.5, d * 0.34, w * 0.14, 5, d * 0.18);
      put("box", TAR, -w * 0.38, 2.5, d * 0.34, w * 0.14, 5, d * 0.18);
      for (const u of [-w * 0.44, w * 0.44]) put("box", FRAME, u, 11, -d * 0.4, 0.7, 22, 0.7);
      if (grow >= 1)
        out.lampRound(at(x, z, yaw, 0, 0)[0], 11, at(x, z, yaw, 0, 0)[1], r * 1.015, 1.1);
      break;
    }
    case "minds": {
      // A mind of crystal: a windowless black block in its cold, fins along its flanks to shed what
      // it thinks with, a thin lit seam up each corner of it.
      const high = 40;
      put("box", [0.1, 0.11, 0.14], 0, high / 2, 0, w * 0.72, high, d * 0.72);
      for (let k = 0; k < 5; k++) {
        const v = ((k + 0.5) / 5 - 0.5) * d * 0.68;
        put("box", [0.5, 0.54, 0.6], w * 0.42, high * 0.45, v, w * 0.1, high * 0.9, 0.5);
        put("box", [0.5, 0.54, 0.6], -w * 0.42, high * 0.45, v, w * 0.1, high * 0.9, 0.5);
      }
      put("box", FRAME, 0, high + 0.5, 0, w * 0.5, 1, d * 0.5);
      if (grow >= 1)
        for (const su of [-1, 1])
          for (const sv of [-1, 1]) {
            const [lx, lz] = at(x, z, yaw, (su * w * 0.72) / 2, (sv * d * 0.72) / 2);
            out.lamp(lx, high / 2, lz, 0.5, high * 0.96, 0.5, yaw);
          }
      break;
    }
    case "vats": {
      // Food with no field behind it: rows of tall green tanks, capped and piped, tended from a low hall.
      const green: Rgb = [0.3, 0.62, 0.36];
      put("box", CONCRETE, 0, 0.4, 0, w * 0.96, 0.8, d * 0.96);
      put("box", WHITE, -w * 0.36, 3, 0, w * 0.2, 6, d * 0.84);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 4; j++) {
          const u = ((i + 0.5) / 3 - 0.2) * w * 0.68,
            v = ((j + 0.5) / 4 - 0.5) * d * 0.84,
            tank = Math.min(w, d) * 0.15;
          put("cyl", green, u, 7, v, tank, 14, tank);
          put("cyl", FRAME, u, 14.5, v, tank * 1.1, 1, tank * 1.1);
          if (grow >= 1 && j % 2 === i % 2) {
            const [lx, lz] = at(x, z, yaw, u, v);
            out.lampRound(lx, 9, lz, tank * 1.02, 4);
          }
        }
      break;
    }
  }
}

/** A town's buildings standing whole at moment t, each with its footprint. */
function standing(
  scene: TownScene,
  t: number,
): { kind: string; f: { x: number; z: number; yaw: number; w: number; d: number } }[] {
  const { plan, lots } = scene,
    out: { kind: string; f: { x: number; z: number; yaw: number; w: number; d: number } }[] = [];
  for (const c of plan.civics) {
    if (c.at + c.lots > lots.x.length) continue;
    const m = civicMoments(c);
    if (m.done > t || (m.fell !== null && t >= m.fell)) continue;
    out.push({ kind: c.kind, f: footprint(lots, c.at, c.lots) });
  }
  return out;
}

/**
 * Where a town's buildings smoke at moment t (Phase 41 M199): the kiln's flue, the smithy's
 * stack, the workshops' chimneys, the factories' and the power stations' — their tops, in metres
 * from its middle (as civicShape raises them).
 */
export function civicChimneys(scene: TownScene, t: number): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  for (const { kind, f } of standing(scene, t)) {
    const top = (u: number, v: number, y: number) => {
      const [x, z] = at(f.x, f.z, f.yaw, u, v);
      out.push({ x, y, z });
    };
    switch (kind) {
      case "kiln":
        top(2.5, -2.5, 8);
        break;
      case "smithy":
        top(f.w * 0.25, f.d * 0.2, 9);
        break;
      case "workshop":
        top(f.w * 0.3, -f.d * 0.2, 10);
        break;
      case "factory":
        top(f.w * 0.36, f.d * 0.36, 28);
        top(f.w * 0.22, f.d * 0.36, 24);
        break;
      case "power":
        top(f.w * 0.36, f.d * 0.3, 44);
        break;
    }
  }
  return out;
}

/**
 * One of a town's buildings whose work is seen moving (Phase 41 M199): a mill's sails turning on
 * their hub, a kiln's mouth aglow while it is fired, sparks from the anvil before a smithy at each
 * blow. Where (metres from the town's middle, y up: the hub, the mouth; a smithy's, its door), which
 * way its front looks (its footprint's yaw: its street lies that way's back), and its door.
 */
export type CivicMotion = {
  readonly kind: "mill" | "kiln" | "smithy";
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly door: { readonly x: number; readonly z: number };
};

/** A town's mills, kilns and smithies standing at moment t, for their work drawn moving. */
export function civicMotions(scene: TownScene, t: number): CivicMotion[] {
  const out: CivicMotion[] = [];
  for (const { kind, f } of standing(scene, t)) {
    if (kind !== "mill" && kind !== "kiln" && kind !== "smithy") continue;
    // (No sails turn in a sealed town: Phase 64.)
    if (kind === "mill" && scene.plan.sealed) continue;
    const [dx, dz] = at(f.x, f.z, f.yaw, 0, -(f.d / 2 + 1.9)),
      door = { x: dx, z: dz },
      // (A mill's hub before its tower, on the street side; a kiln's mouth at its foot.)
      [x, z] =
        kind === "mill"
          ? at(f.x, f.z, f.yaw, 0, -3.6)
          : kind === "kiln"
            ? at(f.x, f.z, f.yaw, 0, -3.05)
            : [door.x, door.z];
    out.push({ kind, x, y: kind === "mill" ? 9 : kind === "kiln" ? 0.9 : 0, z, yaw: f.yaw, door });
  }
  return out;
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
  fusion: 24,
  minds: 42,
  vats: 16,
  well: 4,
};

/**
 * A town's other buildings at moment t: rising in a scaffold, standing, or fallen to ruin.
 * `still`: a mill's sails drawn with it (else turning, drawn by itself: civicMotions).
 */
export function townCivics(scene: TownScene, t: number, out: TownParts, still = true): void {
  out.tone = scene.plan.sealed ? sealedTone : null;
  civicsPut(scene, t, out, still);
  out.tone = null;
}

function civicsPut(scene: TownScene, t: number, out: TownParts, still: boolean): void {
  const { plan, lots, states } = scene;
  for (const c of plan.civics) {
    if (c.at + c.lots > lots.x.length) continue;
    const m = civicMoments(c),
      f = footprint(lots, c.at, c.lots);
    // (What's asked takes its start from the world's clock, a moment on from the screen's: with the clock stopped it would stand unseen.)
    if (t < m.began - (c.asked ? ASKED_AHEAD : 0)) continue;
    if (m.fell !== null && t >= m.fell) {
      // Fallen: its ruin, till homes are raised on its lots.
      let built = false;
      for (let p = c.at; p < c.at + c.lots && !built; p++)
        built = states.what[p] === LOT.home && states.began[p]! > m.fell;
      const years = (t - m.fell) / YEAR_S;
      // (What the greatest fire brought down does not stand: W5.)
      const flat = c.at < (plan.ash ?? 0);
      if (!built && years < 60)
        civicShape(out, c.kind, f, flat ? 0.08 : Math.max(0.12, 0.45 - years / 120), (k) =>
          darker(k, flat ? 0.25 : 0.55),
        );
      continue;
    }
    const g = c.asked
      ? askedGrown(c.asked, t)
      : Math.min(1, (t - m.began) / Math.max(1, m.done - m.began));
    out.put("box", FOOTING, f.x, 0.1, f.z, f.w - 0.6, 0.2, f.d - 0.6, f.yaw);
    civicShape(out, c.kind, f, g < 1 ? Math.max(0.05, g) : 1, undefined, still);
    if (g < 1 && c.asked) siteStuff(out, f, g, c.asked.heap, c.asked.stopped);
    if (g < 1) {
      const top = (CIVIC_HIGH[c.kind] ?? 10) * g + (c.asked ? 3 : 1.5);
      // (A frame about what was asked for, to the height it has come to: its rails seen from over the roofs.)
      if (c.asked && !c.asked.left)
        for (const [u, v, w, d] of [
          [0, f.d / 2, f.w, 0.35],
          [0, -f.d / 2, f.w, 0.35],
          [f.w / 2, 0, 0.35, f.d],
          [-f.w / 2, 0, 0.35, f.d],
        ] as const) {
          const [cx, cz] = at(f.x, f.z, f.yaw, u, v);
          out.put("box", TIMBER, cx, top, cz, w, 0.35, d, f.yaw);
        }
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

/** What stands by a site a town was asked for (H1): heaps of what it wants, going down as it goes up, and its flag, down while it stands idle. */
function siteStuff(
  out: TownParts,
  f: { x: number; z: number; yaw: number; w: number; d: number },
  g: number,
  heap: readonly [number, number, number],
  stopped: boolean,
): void {
  const left = 1 - g,
    colour: Rgb = [heap[0], heap[1], heap[2]];
  out.put("box", DUG, f.x, 0.16, f.z, f.w + 2, 0.12, f.d + 2, f.yaw);
  for (const [u, v, s] of [
    [f.w / 2 + 2.2, 1.6, 1],
    [f.w / 2 + 2.2, -1.6, 0.7],
    [-(f.w / 2) - 2.2, 0, 0.85],
  ] as const) {
    const [x, z] = at(f.x, f.z, f.yaw, u, v),
      high = (0.3 + 1.5 * left) * s;
    out.put("box", colour, x, high / 2, z, 2.4 * s, high, 2 * s, f.yaw);
  }
  const [px, pz] = at(f.x, f.z, f.yaw, -f.w / 2 - 1, -f.d / 2 - 1),
    pole = stopped ? 4 : 13;
  out.put("box", TIMBER, px, pole / 2, pz, 0.4, pole, 0.4, 0);
  // (Two ways, so that it shows from any side and from over the roofs.)
  out.put("box", SITE_FLAG, px + 1.6, pole - 1, pz, 3.2, 2, 0.15, 0);
  out.put("box", SITE_FLAG, px, pole - 1, pz + 1.6, 0.15, 2, 3.2, 0);
}

/** Whether a town's buildings change through the year from moment t (one rising, begun, fallen). */
export function civicsActive(plan: TownPlan, t: number): boolean {
  return plan.civics.some((c: TownCivic) => {
    const m = civicMoments(c);
    return t < m.done || (m.fell !== null && t < m.fell + YEAR_S);
  });
}

/** How far on from the screen's clock an asking can fall, and still be drawn (seconds). */
const ASKED_AHEAD = 86_400;
/** The orange of a site's flag, and its dug ground (H1). */
const SITE_FLAG: Rgb = [0.95, 0.42, 0.08],
  DUG: Rgb = [0.5, 0.4, 0.28];

/**
 * A town's walls at moment t: courses of stone about it, a tower every few lengths, a gate where
 * its road runs out — none where the town has grown over them, nor in its water.
 */
export function townWalls(scene: TownScene, t: number, out: TownParts): void {
  const w = scene.plan.walls,
    ring = scene.walls;
  if (!w || !ring) return;
  const begun = w.asked ? w.asked.began : (w.start + 1) * YEAR_S;
  if (t < begun) return;
  const g = w.asked
      ? askedGrown(w.asked, t)
      : Math.min(1, (t - begun) / Math.max(YEAR_S, (w.end - w.start) * YEAR_S)),
    around = w.asked ? g * ring.lengths.length : 0;
  let k = -1;
  for (const l of ring.lengths) {
    k++;
    // (Those asked for go up length by length about the town; what a town raises by itself rises all at once, as it always has.)
    const high = 7 * (w.asked ? Math.max(0, Math.min(1, around - k)) : g);
    // (A gate where the road runs out, both ways: a tower between two ways through.)
    if (l.gate) {
      if (high > 0.05 || !w.asked)
        out.put("box", STONE, l.x, high * 0.75, l.z, GATE_TOWER, high * 1.5, GATE_TOWER, l.yaw);
      continue;
    }
    if (high <= 0.05) continue;
    out.put("box", STONE, l.x, high / 2, l.z, l.len, high, WALL_THICK, l.yaw);
    if (l.tower)
      out.put("cyl", STONE, l.x, high * 0.65, l.z, WALL_TOWER, high * 1.3, WALL_TOWER, 0);
  }
}

/** What of a town is at a point (metres from its middle), for a tap: one of its buildings, its walls, a lot. */
export type TownThing =
  | { readonly kind: "civic"; readonly at: number; readonly start: number }
  | { readonly kind: "walls" }
  | { readonly kind: "lot"; readonly lot: number };

/** Whether a point lies in a footprint turned by its yaw (with `pad` metres about it). */
function inside(
  f: { x: number; z: number; yaw: number; w: number; d: number },
  x: number,
  z: number,
  pad = 0,
): boolean {
  const dx = x - f.x,
    dz = z - f.z,
    c = Math.cos(f.yaw),
    s = Math.sin(f.yaw);
  // (In its own frame: along its front, and across.)
  return Math.abs(dx * c - dz * s) <= f.w / 2 + pad && Math.abs(dx * s + dz * c) <= f.d / 2 + pad;
}

/**
 * What of a town stands at a point at moment t: one of its buildings (begun, standing or its ruin),
 * a length of its walls or a gate, else the lot under it (null: a street, the square, past its edge).
 */
export function townThingAt(scene: TownScene, x: number, z: number, t: number): TownThing | null {
  const { plan, lots } = scene;
  for (const c of plan.civics) {
    if (c.at + c.lots > lots.x.length) continue;
    const m = civicMoments(c);
    if (t < m.began || (m.fell !== null && t >= m.fell + 60 * YEAR_S)) continue;
    if (inside(footprint(lots, c.at, c.lots), x, z, 1))
      return { kind: "civic", at: c.truly ?? c.at, start: c.start };
  }
  const w = plan.walls;
  if (w && scene.walls && t >= (w.start + 1) * YEAR_S)
    for (const l of scene.walls.lengths)
      if (
        inside(
          { x: l.x, z: l.z, yaw: l.yaw, w: l.gate ? GATE_TOWER : l.len, d: WALL_THICK },
          x,
          z,
          2,
        )
      )
        return { kind: "walls" };
  const p = lotNear(scene, x, z, LOT_W * 0.75);
  return p >= 0 ? { kind: "lot", lot: p } : null;
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
