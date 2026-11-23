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
  Footprints,
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
  beganAt,
  lotsKey,
  shopsBelow,
  townLots,
  townLotsAhead,
  townReach,
  OUTLINE,
  outlineAt,
  outlineOf,
  wallRing,
  wetGround,
  type LotStates,
  type TownCivic,
  type TownDesign,
  type TownLots,
  type TownPlan,
  type WallLength,
  type VillagePlan,
} from "../bridge/index.ts";
import { HOME_LIFE } from "../rules/index.ts";
import {
  RANK_SORTS,
  groundWealth,
  homeGround,
  rankSteep,
  type RankHall,
  type RankMark,
  type RankSeat,
} from "../bridge/index.ts";
import { houseLook, type HouseLook } from "./village.ts";
import { biomeColor } from "./globe.ts";
import { lifeTint } from "./biochem.ts";
import { WORN_WIDE, wornOf } from "./worn.ts";
import {
  edgeYard,
  formGround,
  formLook,
  formTiers,
  streetOf,
  tierOf,
  vergeTone,
  yardTone,
} from "./townform.ts";
import {
  TIER,
  hasSpires,
  laidAt,
  rectPoints,
  sprawlOf,
  streetWide,
  wallAt,
} from "../bridge/index.ts";

import { holdPlaces, onHeld } from "../bridge/index.ts";
import { townHolds } from "./strongholds.ts";
import { blockGround, lineOver } from "./streetline.ts";

export { hasSpires, sprawlOf };

/** How far about a stronghold's ground a block of a town yields it: a block's half breadth across its corners. */
export const HELD_PAD = Math.hypot(BLOCK_W, BLOCK_D) / 2;

type Rgb = readonly [number, number, number];
export type PartMesh = "box" | "gable" | "cone" | "cyl" | "dome";
import type { CompoundMesh, LampMesh } from "./compound.ts";

/** A window's glass: lit from within from dusk to dawn (the renderer's lamplight). */
export const LAMP: Rgb = [0.14, 0.18, 0.24];

/**
 * Parts gathered by mesh and colour: seven numbers each (x, y, z, sx, sy, sz, yaw), metres; the
 * windows in a group of their own, lit at night. A home drawn as one (view/compound.ts: `compound`) is a part of a shape's
 * mesh, its roof's colour with its group and its roof's breadth, height and depth (metres) three numbers more each in `extra`.
 */
export type TownGroup = {
  mesh: PartMesh | CompoundMesh | LampMesh;
  color: Rgb;
  data: number[];
  lamp?: boolean;
  roof?: Rgb;
  extra?: number[];
};
export class TownParts {
  readonly groups = new Map<string, TownGroup>();
  /**
   * Whether its homes are drawn each as one (view/compound.ts): the town's own view, where a great city's tens of thousands
   * of parts went through a phone's GPU each frame (2026-11-21). A land's towns and the checks have them part by part.
   */
  compound = false;
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
  /** A home's bands of windows as one (view/compound.ts LAMP_COMPOUNDS), lit at night: the home's middle and size. */
  lampShape(
    mesh: LampMesh,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    yaw: number,
  ): void {
    const key = `lamp:${mesh}`;
    let g = this.groups.get(key);
    if (!g) this.groups.set(key, (g = { mesh, color: LAMP, data: [], lamp: true }));
    g.data.push(x, y, z, sx, sy, sz, yaw);
  }
  /**
   * A home as one (view/compound.ts COMPOUNDS): its walls' middle and size; `roof` its roof's colour (null: none), and its
   * roof's breadth, height and depth, on its walls' top.
   */
  shape(
    mesh: CompoundMesh,
    color: Rgb,
    roof: Rgb | null,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    yaw: number,
    rw = 0,
    rh = 0,
    rd = 0,
  ): void {
    if (this.tone) {
      color = this.tone(color);
      if (roof) roof = this.tone(roof);
    }
    const key = `${partKey(mesh, color)}${roof ? `/${roof[0].toFixed(3)}|${roof[1].toFixed(3)}|${roof[2].toFixed(3)}` : ""}`;
    let g = this.groups.get(key);
    if (!g)
      this.groups.set(key, (g = { mesh, color, data: [], ...(roof ? { roof, extra: [] } : {}) }));
    g.data.push(x, y, z, sx, sy, sz, yaw);
    g.extra?.push(rw, rh, rd);
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
    const key = partKey(mesh, color);
    let g = this.groups.get(key);
    if (!g) this.groups.set(key, (g = { mesh, color, data: [] }));
    g.data.push(x, y, z, sx, sy, sz, yaw);
  }
  /**
   * How many batches draw them: one to a mesh, its roofs apart (snow lies on them), and the windows' own; each part's
   * colour rides in its instance (render/stage.ts tonedMaterial), so a colour more is no batch more.
   */
  get batches(): number {
    const seen = new Set<string>();
    for (const [key, g] of this.groups) if (g.data.length) seen.add(partBatch(key, g));
    return seen.size;
  }
  /** How many parts in all. */
  get count(): number {
    let n = 0;
    for (const g of this.groups.values()) n += g.data.length / 7;
    return n;
  }
  clear(): void {
    for (const g of this.groups.values()) {
      g.data.length = 0;
      if (g.extra) g.extra.length = 0;
    }
  }
}

/**
 * A part's group: its mesh and its colour to a thousandth, kept for each colour as made (a city's choosing put some 35,000
 * parts, each its key written out anew: a great deal for the page to sweep up after, as the eye moved; 2026-11-21).
 */
const PART_KEYS = new WeakMap<Rgb, Partial<Record<PartMesh | CompoundMesh, string>>>();
function partKey(mesh: PartMesh | CompoundMesh, color: Rgb): string {
  let kept = PART_KEYS.get(color);
  if (!kept) PART_KEYS.set(color, (kept = {}));
  return (kept[mesh] ??=
    `${mesh}|${color[0].toFixed(3)}|${color[1].toFixed(3)}|${color[2].toFixed(3)}`);
}

/** The batch a group of parts is drawn in (TownParts.batches). */
export function partBatch(key: string, g: { mesh: TownGroup["mesh"]; lamp?: boolean }): string {
  return g.lamp ? key : `${g.mesh}|${g.mesh === "gable" || g.mesh === "cone" ? "roof" : "wall"}`;
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
/** The tallest level drawn (bridge/town.ts SPIRE_LEVEL: a town with homes at it has spires). */
export const TOP_LEVEL = LEVELS.length - 1;
/**
 * How high a home of a town stands to its roof's top, and how broad it is (metres; Phase 42
 * M201): a hut or a house as its look draws it, its roof as steep as its rain wants.
 */
export function homeSize(scene: TownScene, p: number): { high: number; wide: number } {
  const level = Math.max(0, Math.min(TOP_LEVEL, scene.states.level[p]!)),
    L = LEVELS[level]!;
  const look = formLook(scene, p, scene.states.design[p]!)!;
  if (level > 1)
    return { high: L.h * tallOf(look, level) + (level === 2 ? roof2(look) : 0.5), wide: L.w };
  const [w, d] = lowFoot(L, look),
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
/** The colours a shape drawn as one (view/compound.ts) gives its tower's frames and its tall homes' tar. */
export const SHAPE_TONES = { frame: FRAME, tar: TAR } as const;

const darker = (c: Rgb, f: number): Rgb => [c[0] * f, c[1] * f, c[2] * f];

/**
 * A hut's or a house's footprint in its land's look (along its street, deep) — as long as its
 * look, but no longer than its lot holds, its eaves clear of its neighbours'.
 */
const lowFoot = (L: { w: number; d: number }, look: HouseLook): [number, number] => [
  Math.min(
    look.joined ? LOT_W - 0.1 : look.apart ? LOT_W - 3 : LOT_W - 1.2,
    L.w * (look.length / 0.7),
  ),
  // (By the square a house is built back to its lot's end: no ground there is left for a yard.)
  look.joined ? LOT_D - 1 : Math.min(LOT_D - 1.6, L.d * (look.width / 0.55)),
];

/**
 * How high a home's walls stand against its level's own: a hut's or a house's as its look has it; a tenement's, a block's and
 * a high-rise's as its ground is dear, a townhouse by the square a floor higher (view/townform.ts; a spire as ever).
 */
const tallOf = (look: HouseLook, level: number): number =>
  level <= 1
    ? look.height
    : level >= 3 && level < TOP_LEVEL
      ? (look.tall ?? 1)
      : level === 2
        ? (look.joined ? 4 / 3 : 1) * (look.storey ?? 1)
        : 1;

/** How high a townhouse's roof rises: as its roofing asks, the steeper for the snow it sheds. */
const roof2 = (look: HouseLook): number => (look.rise < 0.1 ? 0.6 : 3.2 * (look.steep ?? 1));

/** A part placed by an offset in a turned frame: (u along, v across) from (x, z), turned by yaw. */
function at(x: number, z: number, yaw: number, u: number, v: number): [number, number] {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return [x + u * c + v * s, z - u * s + v * c];
}

/** Everything a town's drawing needs, read once from its plan. */
export type TownScene = {
  readonly plan: TownPlan;
  /** What its land's signals put in it as last drawn (signals): its poles, the wires between them, a mast. */
  signals?: { poles: number; wires: number; mast: boolean };
  readonly lots: TownLots;
  readonly states: LotStates;
  /** Its homes razed by what struck it (Phase 42 M201): the lots, in the order they caught or fell. */
  readonly struck: readonly number[];
  /** Which blocks hold anything (the rest are open ground). */
  readonly held: Uint8Array;
  /** Its walls as they stand (null: none). */
  readonly walls: {
    readonly r: number;
    /** Their line (bridge/wall.ts): how far out they run toward each bearing. */
    readonly line: Float32Array;
    readonly n: number;
    readonly lengths: readonly WallLength[];
  } | null;
  readonly looks: readonly HouseLook[];
  /** The lots whose drawing changes through the year (rising, or not yet begun), and the rest. */
  readonly active: readonly number[];
  readonly settled: readonly number[];
  /** Each lot's ground as its worth sorts it and how high a tall home stands on it (view/townform.ts; null: no form read). */
  readonly tiers: Uint8Array | null;
  /** The moment its plan came (seconds). */
  readonly at: number;
  /** The looks its homes stand in by design, ground and height, made as they are asked for. */
  readonly formLooks: Map<number, HouseLook>;
  /** How far out its lots drawn reach toward each of OUTLINE bearings about its square (metres): its outline. */
  readonly outline: Float32Array;
  /** Its sprawl's roofs as they stand on their ground, each clear of every other and of its blocks (made when first asked). */
  sprawlRoofs?: Float32Array;
  /** Which of its lots are drawn afresh through the year (`active`, by lot: made when first asked). */
  activeLots?: Uint8Array;
  /** The home its haze stands in (hazeHome: made when first asked). */
  haze?: { level: number; look: HouseLook };
  /** How many of its sprawl's roofs would stand where its lots past those drawn now do (sprawlLaid: for a budget). */
  sprawlLeft?: number;
  /** The colour of the yards of its blocks past those drawn, and how many pieces their streets were laid in (farGround). */
  farYard?: Rgb;
  farPlate?: number;
  /** A great city's lots past those drawn, on its own blocks grown on (farOf: null, none; made when first asked). */
  far?: TownFar | null;
  /**
   * Whether a stronghold may stand on a disc of ground (metres about its square): its land's map sets it, which draws water
   * the town's own view does not know (render/land.ts). Absent: every one stands.
   */
  holdOn?: (x: number, z: number, r: number) => boolean;
};

export { OUTLINE, outlineAt, outlineOf };

/** How far out a town's sprawl goes toward a bearing (metres): its outline, as many times over as all its lots are to those drawn (the same way sprawlOf reckons its furthest). */
export function sprawlFar(scene: TownScene, ring: { r0: number; r1: number }, a: number): number {
  return outlineAt(scene.outline, a) * (ring.r1 / ring.r0);
}

/** A town's scene at the moment its plan came (lots that change from then on are active). */
export function townScene(plan: TownPlan, t: number, previous?: TownLots): TownScene {
  const lots =
      previous &&
      previous.key === lotsKey(plan) &&
      previous.x.length >= plan.lots &&
      previous.blocks.x.length >= Math.ceil(plan.lots / BLOCK_LOTS)
        ? previous
        : townLots(plan.family, plan.seed, plan.axis, plan.lots, plan.water, plan.site ?? null),
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
    walls = wallRing(plan, lots, held),
    scene: TownScene = {
      plan,
      lots,
      states,
      struck,
      held,
      walls,
      looks,
      active,
      settled,
      // (Its walls make ground scarce while they stand.)
      tiers: formTiers(plan, !!walls?.lengths.length),
      formLooks: new Map(),
      at: t,
      outline: outlineOf(lots, plan.lots),
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
  const look = formLook(scene, p, homeWear(scene, p, t).look);
  if (!look) return null;
  if (level <= 1) {
    const [, d] = lowFoot(L, look),
      rise = look.tent ? 7.5 : look.rise < 0.1 ? 0.6 : Math.min(5, look.rise * d * 0.5);
    return look.raised * 10 + L.h * look.height + rise;
  }
  return L.h * tallOf(look, level) + (level === 2 ? roof2(look) : level === 5 ? 10 : 2.8);
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

/** What stands at a point is looked for among the lots in squares of the ground this broad (metres), each lot in every square its building reaches into. */
const SURFACE_CELL = 16,
  /** How far a lot's building reaches from its lot's middle at most (metres): the broadest level's half-diagonal, and its eaves. */
  LOT_REACH = 9,
  /** How high the ground of a town lies (metres): its yards a curb over its streets. */
  GROUND_TOP = 0.5;

/** A town's lots by the squares of the ground they stand in, and its other buildings' footprints: laid once for a scene. */
type Standing = {
  readonly x0: number;
  readonly z0: number;
  readonly nx: number;
  readonly nz: number;
  /** Where each square's lots begin in `list` (they end where the next square's begin). */
  readonly start: Int32Array;
  readonly list: Int32Array;
  readonly civics: readonly {
    readonly f: { x: number; z: number; yaw: number; w: number; d: number };
    readonly kind: string;
    readonly began: number;
    readonly done: number;
    readonly fell: number | null;
    readonly asked: TownCivic["asked"];
    readonly flat: boolean;
  }[];
};
const STANDING = new WeakMap<TownScene, Standing>();

function standingOf(scene: TownScene): Standing {
  const kept = STANDING.get(scene);
  if (kept) return kept;
  const { lots, plan } = scene,
    n = Math.min(plan.lots, lots.x.length);
  let x0 = Infinity,
    z0 = Infinity,
    x1 = -Infinity,
    z1 = -Infinity;
  for (let p = 0; p < n; p++) {
    x0 = Math.min(x0, lots.x[p]!);
    x1 = Math.max(x1, lots.x[p]!);
    z0 = Math.min(z0, lots.z[p]!);
    z1 = Math.max(z1, lots.z[p]!);
  }
  if (!(n > 0)) x0 = z0 = x1 = z1 = 0;
  x0 -= LOT_REACH;
  z0 -= LOT_REACH;
  const nx = Math.max(1, Math.ceil((x1 + LOT_REACH - x0) / SURFACE_CELL)),
    nz = Math.max(1, Math.ceil((z1 + LOT_REACH - z0) / SURFACE_CELL)),
    start = new Int32Array(nx * nz + 1),
    // (Twice over the lots: how many in each square, then each in its place.)
    each = (p: number, fn: (cell: number) => void) => {
      const i0 = Math.max(0, Math.floor((lots.x[p]! - LOT_REACH - x0) / SURFACE_CELL)),
        i1 = Math.min(nx - 1, Math.floor((lots.x[p]! + LOT_REACH - x0) / SURFACE_CELL)),
        j0 = Math.max(0, Math.floor((lots.z[p]! - LOT_REACH - z0) / SURFACE_CELL)),
        j1 = Math.min(nz - 1, Math.floor((lots.z[p]! + LOT_REACH - z0) / SURFACE_CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * nx + i);
    };
  for (let p = 0; p < n; p++) each(p, (c) => start[c + 1]!++);
  for (let c = 0; c < nx * nz; c++) start[c + 1]! += start[c]!;
  const list = new Int32Array(start[nx * nz]!),
    at = start.slice(0, nx * nz);
  for (let p = 0; p < n; p++) each(p, (c) => (list[at[c]!++] = p));
  const civics = (plan.civics ?? [])
    .filter((c) => c.at + c.lots <= lots.x.length && !!lots.blocks)
    .map((c) => {
      const m = civicMoments(c);
      return {
        f: footprint(lots, c.at, c.lots),
        kind: c.kind,
        began: m.began,
        done: m.done,
        fell: m.fell,
        asked: c.asked,
        flat: c.at < (plan.ash ?? 0),
      };
    });
  const made: Standing = { x0, z0, nx, nz, start, list, civics };
  STANDING.set(scene, made);
  return made;
}

/**
 * How high what stands at a point of a town reaches at moment t (metres; its bare ground where nothing stands): a home's
 * roof where the point is under it, as it slopes; a tower's top; one of its other buildings; a ruin's heap. What falls
 * comes down on the first of these in its way, and what is thrown off it lies there (War past the line: raids, rockets).
 */
export function townSurface(scene: TownScene, x: number, z: number, t: number): number {
  const { states, lots } = scene;
  // (A scene laid out without its homes' shapes stands on bare ground.)
  if (!states.what || !lots.yaw || !scene.looks) return GROUND_TOP;
  const s = standingOf(scene),
    i = Math.floor((x - s.x0) / SURFACE_CELL),
    j = Math.floor((z - s.z0) / SURFACE_CELL);
  let top = GROUND_TOP;
  if (i >= 0 && j >= 0 && i < s.nx && j < s.nz) {
    const c = j * s.nx + i;
    for (let k = s.start[c]!; k < s.start[c + 1]!; k++) {
      const h = lotTop(scene, s.list[k]!, x, z, t);
      if (h > top) top = h;
    }
  }
  for (const c of s.civics) {
    if (t < c.began - (c.asked ? ASKED_AHEAD : 0) || !inside(c.f, x, z)) continue;
    const high = CIVIC_HIGH[c.kind] ?? 10,
      years = c.fell !== null ? (t - c.fell) / YEAR_S : -1,
      // (Most of a building's shape is under its tallest part: a hall's roof, a mill's cap.)
      h =
        years >= 0
          ? years < 60
            ? high * (c.flat ? 0.08 : Math.max(0.12, 0.45 - years / 120))
            : 0
          : high *
            0.8 *
            (c.asked
              ? askedGrown(c.asked, t)
              : Math.min(1, (t - c.began) / Math.max(1, c.done - c.began)));
    if (h > top) top = h;
  }
  return top;
}

/** How high a lot's home reaches over a point at moment t (metres; 0: the point is not under it). */
function lotTop(scene: TownScene, p: number, x: number, z: number, t: number): number {
  const { states, lots, looks } = scene,
    what = states.what[p];
  let level = states.level[p]!,
    design = states.design[p]!,
    grow = 1,
    roof = 1;
  if (what === LOT.home) {
    const g = progress(states.began[p]!, states.takes[p]!, t);
    // (Rising, or rebuilt as it wears: its walls as far as they have come, its roof at the last.)
    let rise = g < 1 ? g : -1;
    if (g >= 1) {
      const w = homeWear(scene, p, t);
      design = w.look;
      if (w.at !== null && t < w.at + states.takes[p]!) rise = (t - w.at) / states.takes[p]!;
    } else if (g <= 0) {
      if (states.raised[p] === 1) level = Math.max(1, level - 1);
      else if (states.raised[p] !== 2) return 0;
      rise = -1;
    }
    if (rise >= 0) {
      if (rise < 0.32) return under(lots, p, x, z, LOT_W - 1, LOT_D - 2) ? 0.7 : 0;
      grow = Math.min(1, (rise - 0.32) / 0.53);
      roof = rise < 0.85 ? 0 : (rise - 0.85) / 0.15;
    }
  } else if (what === LOT.razed && states.struck[p]! >= 0) {
    const since = t - states.began[p]!;
    if (since >= 0) {
      const k = since / FALLS_S,
        great = !!scene.plan.struck?.[states.struck[p]!]?.raid?.great;
      // (Burnt out, thrown down, or what the greatest fire left: a low heap.)
      if (great || k >= 1 || states.burns[p] !== 1 || thrownDown(scene, p))
        return under(lots, p, x, z, LOT_W - 1, LOT_D - 1.6) ? (great ? 1.6 : RUBBLE_HIGH) : 0;
      // (Burning: whole a while, then its roof gone and its walls burning down.)
      if (k >= 0.6) {
        grow = 1 - (0.5 * (k - 0.6)) / 0.4;
        roof = 0;
      }
    }
  } else if (what === LOT.fallen || what === LOT.razed)
    return t >= states.began[p]! && under(lots, p, x, z, LOT_W - 1.5, LOT_D - 2) ? 1.2 : 0;
  else return 0;
  const look = formLook(scene, p, design);
  if (!look) return 0;
  return shapeTop(look, level, lots.x[p]!, lots.z[p]!, lots.yaw[p]!, grow, roof, x, z);
}

/** Whether a point lies over a lot's ground, so broad along its street and so deep. */
const under = (lots: TownLots, p: number, x: number, z: number, w: number, d: number): boolean =>
  inside({ x: lots.x[p]!, z: lots.z[p]!, yaw: lots.yaw[p]!, w, d }, x, z);

/**
 * How high a home drawn at (hx, hz) reaches over a point (metres; 0: not under it), as `home` draws it: a hut's or a house's
 * roof sloping from its ridge, a townhouse's, a block's flat top, a spire's shafts, a sealed town's domes.
 */
function shapeTop(
  look: HouseLook,
  level: number,
  hx: number,
  hz: number,
  yaw: number,
  grow: number,
  roof: number,
  x: number,
  z: number,
): number {
  const dx = x - hx,
    dz = z - hz,
    c = Math.cos(yaw),
    s = Math.sin(yaw),
    // (In its own frame: along its front, and across it.)
    u = Math.abs(dx * c - dz * s),
    v = Math.abs(dx * s + dz * c),
    L = LEVELS[Math.max(0, Math.min(TOP_LEVEL, level))]!;
  if (look.sealed) {
    if (level <= 1) {
      const r = (level === 0 ? 5.6 : 7.4) / 2,
        h = (level === 0 ? 3.1 : 4.1) * grow,
        e = Math.hypot(u, v) / r;
      return e <= 1 ? 0.8 + h * Math.sqrt(1 - e * e) : 0;
    }
    const r =
        (Math.min(LOT_W - 0.5, L.w + 0.6) *
          (level === 2 ? 1 : level === 3 ? 0.92 : level === 4 ? 0.84 : level === 5 ? 0.76 : 0.7)) /
        2,
      h = L.h * grow * (level > 5 ? spireShare(hx, hz) : 1);
    return Math.hypot(u, v) <= r ? 0.8 + h + 0.3 + (level >= 4 ? r * 1.1 : r * 0.84) * roof : 0;
  }
  if (level >= TOP_LEVEL) {
    const high = L.h * spireShare(hx, hz) * grow;
    if (u > L.w / 2 || v > L.d / 2) return 0;
    let top = Math.min(14, high);
    for (const [to, wide] of SPIRE_SHAFTS)
      if (u <= (L.w * wide) / 2 && v <= (L.d * wide) / 2) top = Math.max(top, high * to);
    return top;
  }
  const h = L.h * tallOf(look, level) * grow;
  if (level <= 1) {
    const [w, d] = lowFoot(L, look),
      base = look.raised * 10 + h,
      flat = look.rise < 0.1,
      rh = (look.tent ? 7.5 : flat ? 0.6 : Math.min(5, look.rise * d * 0.5)) * roof;
    if (look.open || roof <= 0)
      return (look.round ? Math.hypot(u / w, v / d) <= 0.5 : u <= w / 2 && v <= d / 2) ? base : 0;
    if (look.round || look.tent) {
      const e = 2 * Math.hypot(u / (w * 1.15), v / (d * 1.15));
      return e <= 1 ? base + rh * (1 - e) : 0;
    }
    if (flat) return u <= w * 0.51 && v <= d * 0.51 ? base + rh : 0;
    // (Its ridge along its street: the roof falls away from it across the house.)
    return u <= w * 0.575 && v <= d * 0.575 ? base + rh * (1 - v / (d * 0.575)) : 0;
  }
  if (u > L.w * 0.52 || v > L.d * 0.54) return 0;
  if (level === 2) {
    const flat = look.rise < 0.1,
      rh = roof2(look) * roof;
    return flat ? h + rh : h + rh * (1 - v / (L.d * 0.54));
  }
  return h + (roof > 0 ? 0.5 : 0);
}

/** A spire's shafts: to how much of its height each rises, and how much of its footing each is. */
const SPIRE_SHAFTS: readonly (readonly [number, number])[] = [
  [0.5, 0.88],
  [0.8, 0.66],
  [1, 0.42],
];

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
    // (A street none has worn is the land's own, bared (told from the yards beside it): what has worn it is drawn over it, R1.)
    street: Rgb = plan.paved ? [0.66, 0.64, 0.6] : mixed(yard, [0.6, 0.53, 0.4], 0.7);
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
  const blocks = Math.ceil(plan.lots / BLOCK_LOTS),
    // (Its strongholds' and seats' ground: no block of it there, bridge/holdplaces.ts.)
    held = holdPlaces(plan, lots);
  for (let b = 0; b < blocks; b++) {
    if (b * BLOCK_LOTS < ash) continue;
    const x = lots.blocks.x[b]!,
      z = lots.blocks.z[b]!,
      yaw = lots.blocks.yaw[b]!;
    if (held.length && onHeld(held, x, z, HELD_PAD)) continue;
    // (As broad as its part of the town was laid: bridge/form.ts. Its ground tells its age: a lane as it was trodden, a
    // street measured out set evener and paler, one laid for engines tarred.)
    const wide = plan.site?.laid ? streetWide(plan.site, b) : STREET,
      // (By the square the ground between its blocks is trodden bare: no green left from wall to wall.)
      trod = plan.form && !plan.form.over && tierOf(scene, b * BLOCK_LOTS) === TIER.heart ? 12 : 0;
    out.put(
      "box",
      streetOf(scene, b, street),
      x,
      0.18,
      z,
      BLOCK_W + wide + trod,
      0.24,
      BLOCK_D + wide + trod,
      yaw,
    );
    // (By the square no ground is left to grass: a block's yards are trodden courts.)
    const court = tierOf(scene, b * BLOCK_LOTS) === TIER.heart && !plan.ways;
    out.put(
      "box",
      court ? street : yardTone(scene, b, yard),
      x,
      0.3,
      z,
      BLOCK_W - 0.6,
      0.4,
      BLOCK_D - 0.6,
      yaw,
    );
    // (A street laid for engines keeps a verge of grass along its blocks, under their yards' curbs and over its tar.)
    const verge = plan.site?.laid && !court ? laidAt(plan.site, b)?.verge : 0;
    if (verge)
      out.put(
        "box",
        vergeTone(scene, yard),
        x,
        0.34,
        z,
        BLOCK_W + 2 * verge,
        0.16,
        BLOCK_D + 2 * verge,
        yaw,
      );
  }
  // (Its lots past those drawn on their own blocks, their streets and yards with them: farOf.)
  farGround(scene, out, street, yard);
  // Its form on its ground: its main streets, its market's cover, its column, its temple's steps (view/townform.ts).
  formGround(scene, out, ash);
  // Its strongholds and seats about it (view/strongholds.ts), in its land's way of building.
  if (held.length && ash <= 0) townHolds(scene, out, scene.looks[scene.looks.length - 1]);
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
  scene.signals = townSignals(scene, out, ash);
  sprawl(scene, out, burned, street);
}

const POLE: Rgb = [0.32, 0.25, 0.18],
  WIRE: Rgb = [0.12, 0.12, 0.13],
  MAST: Rgb = [0.62, 0.64, 0.66],
  MAST_TOP: Rgb = [0.86, 0.18, 0.14];
/** The most of its blocks a wire runs past (its oldest first): a line through the town, never every street. */
export const WIRED_BLOCKS = 24;

/**
 * What its land's signals put in a town (signals): a pole at a corner of each of its first blocks, seven metres high, and the
 * wire slung between them along its streets; a mast over its square, thirty metres, where it has words on waves through the
 * air. Two batches and a third, whatever its size.
 */
export function townSignals(
  scene: TownScene,
  out: TownParts,
  ash = 0,
): { poles: number; wires: number; mast: boolean } {
  const { plan, lots } = scene,
    s = plan.signals,
    drawn = { poles: 0, wires: 0, mast: false };
  if (!s?.wire || plan.ways === "swim") return drawn;
  const blocks = Math.min(WIRED_BLOCKS, Math.ceil(plan.lots / BLOCK_LOTS)),
    high = 7,
    tops: [number, number][] = [],
    held = holdPlaces(plan);
  for (let b = 0; b < blocks; b++) {
    if (b * BLOCK_LOTS < ash) continue;
    // (A block yielded to a stronghold has no pole: townHomes.)
    if (held.length && onHeld(held, lots.blocks.x[b]!, lots.blocks.z[b]!, HELD_PAD)) continue;
    const [x, z] = at(
      lots.blocks.x[b]!,
      lots.blocks.z[b]!,
      lots.blocks.yaw[b]!,
      (BLOCK_W + STREET * 0.6) / 2,
      (BLOCK_D + STREET * 0.6) / 2,
    );
    out.put("cyl", POLE, x, high / 2, z, 0.28, high, 0.28, 0);
    out.put("box", POLE, x, high - 0.4, z, 1.6, 0.14, 0.14, lots.blocks.yaw[b]!);
    tops.push([x, z]);
    drawn.poles++;
  }
  // (The wire from each pole to the nearest strung before it that it reaches over no block's ground, no stronghold's: a line
  // through the town that branches, never a web, and never through a house. view/streetline.ts.)
  const over =
    tops.length > 1
      ? lineOver(blockGround(lots, Math.ceil(plan.lots / BLOCK_LOTS), ash, held, HELD_PAD), held)
      : null;
  for (let i = 1; i < tops.length; i++) {
    const [x1, z1] = tops[i]!,
      near: [number, number][] = [];
    for (let m = 0; m < i; m++) {
      const dd = Math.hypot(tops[m]![0] - x1, tops[m]![1] - z1);
      if (dd >= 1 && dd <= 90) near.push([dd, m]);
    }
    near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const j = near.find(([, m]) => !over!(tops[m]![0], tops[m]![1], x1, z1))?.[1];
    if (j === undefined) continue;
    const [x0, z0] = tops[j]!,
      len = Math.hypot(x1 - x0, z1 - z0);
    out.put(
      "box",
      WIRE,
      (x0 + x1) / 2,
      high - 0.5,
      (z0 + z1) / 2,
      0.06,
      0.06,
      len,
      Math.atan2(x1 - x0, z1 - z0),
    );
    drawn.wires++;
  }
  if (s.mast) {
    const mx = SQUARE * 0.9,
      mz = -SQUARE * 0.9;
    out.put("cyl", MAST, mx, 15, mz, 0.5, 30, 0.5, 0);
    out.put("box", MAST, mx, 10, mz, 2.4, 0.18, 0.18, 0);
    out.put("box", MAST, mx, 20, mz, 1.6, 0.18, 0.18, 0);
    out.put("cone", MAST_TOP, mx, 30.6, mz, 0.7, 1.2, 0.7, 0);
    drawn.mast = true;
  }
  return drawn;
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
 * A great city's lots past those drawn: its sprawl, low roofs on its trodden ground out to as far
 * as all its lots would reach, one roof for every few homes, into the haze — its avenues kept
 * clear, and its water.
 */
function sprawl(scene: TownScene, out: TownParts, burned = false, street?: Rgb): void {
  const { plan, looks } = scene,
    ring = sprawlOf(plan, scene.lots);
  if (!ring) return;
  // (Its lots past those drawn stand on their own blocks: the haze begins past them, for those left: farOf.)
  const far = farOf(scene);
  if (far && plan.whole - plan.lots - far.count <= 0) return;
  const clear = burned ? ashReach(plan, scene.lots) : 0;
  const { r0, r1 } = ring,
    water = plan.water,
    wet = (x: number, z: number, margin: number) =>
      !!water && Math.hypot(x - water.x, z - water.z) < water.r + margin,
    towers = hasSpires(plan),
    // (Its streets' own ground, as about its blocks drawn: the haze is the same town, its streets and yards, no bare earth.)
    trodden: Rgb = towers
      ? [0.34, 0.35, 0.38]
      : (street ?? (plan.paved ? [0.56, 0.55, 0.5] : [0.55, 0.5, 0.4]));
  // Its trodden ground, in bands of patches about it (none on the water).
  const bands = 6,
    round = 72;
  // (From its lots' own outline each way, out as many times over as all its lots are to those drawn: its sprawl is the
  // town's own shape grown on, with no ring of one radius at its inner edge or its outer.)
  for (let b = 0; b < bands; b++) {
    for (let k = 0; k < round; k++) {
      const a = ((k + 0.5) / round) * 2 * Math.PI,
        near = edgeAt(scene, a),
        far = sprawlFar(scene, ring, a),
        lo = near + ((far - near) * b) / bands,
        hi = near + ((far - near) * (b + 1)) / bands,
        mid = (lo + hi) / 2,
        across = (2 * Math.PI * hi) / round + 1,
        x = mid * Math.cos(a),
        z = mid * Math.sin(a);
      if (hi <= clear || hi - lo < 2) continue;
      if (wet(x, z, across / 2) || wetGround(plan.site, x, z)) continue;
      out.put("box", trodden, x, 0.12, z, across, 0.1, hi - lo + 1, Math.PI / 2 - a);
    }
  }
  // Its avenues, out through it.
  for (let k = 0; k < AVENUES; k++) {
    const a = avenueWay(plan, k),
      ca = Math.cos(a),
      sa = Math.sin(a);
    const far = sprawlFar(scene, ring, a);
    for (let r = edgeAt(scene, a); r < far; r += 60) {
      const len = Math.min(60, far - r),
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

/** A sprawl's roof as laid: x, z, its breadth, depth and height, its yaw, how far out of its sprawl (0 … 1), its draw. */
const ROOF = 8;

/**
 * A great city's sprawl's roofs on their ground (sprawlRoofs, ROOF to each): one for every few homes past those drawn,
 * scattered from its outline out, off its avenues and its water; and each on ground of its own (asked 2026-11-20: "are you
 * fixing this overlapping and glitch thats going on here too?"). Its blocks drawn take their ground first, then each roof in
 * turn: one that would run into what stands is laid narrower, or not at all. Read once a scene, so the ash's edge drawing
 * them again draws the same.
 */
function sprawlLaid(scene: TownScene): Float32Array {
  if (scene.sprawlRoofs) return scene.sprawlRoofs;
  const { plan } = scene,
    ring = sprawlOf(plan, scene.lots),
    rows: number[] = [];
  let left = 0;
  if (ring) {
    const { r0, r1 } = ring,
      far = farOf(scene),
      n = Math.min(3000, Math.round((plan.whole - plan.lots) / 6)),
      haze = hazeHome(scene),
      HL = LEVELS[haze.level]!,
      // (Each the footprint of the home it is: hazeHome.)
      [footW, footD] = haze.level <= 1 ? lowFoot(HL, haze.look) : [HL.w, HL.d],
      water = plan.water,
      wet = (x: number, z: number, margin: number) =>
        !!water && Math.hypot(x - water.x, z - water.z) < water.r + margin,
      towers = hasSpires(plan),
      walls = scene.walls && plan.walls && plan.walls.reach > plan.lots ? scene.walls.line : null,
      sector = (2 * Math.PI) / AVENUES,
      taken = new Footprints(48),
      blocks = scene.lots.blocks,
      held = holdPlaces(plan, scene.lots);
    // (Its blocks drawn, their streets' edge with them.)
    for (let b = 0; b < Math.ceil(plan.lots / BLOCK_LOTS) && b < blocks.x.length; b++)
      taken.add({
        x: blocks.x[b]!,
        z: blocks.z[b]!,
        w: BLOCK_W + 4,
        d: BLOCK_D + 4,
        yaw: blocks.yaw[b]!,
      });
    // (And those of its lots past them: farOf.)
    if (far)
      for (let b = 0; b < far.laid.length; b++)
        taken.add({
          x: far.blocks.x[b]!,
          z: far.blocks.z[b]!,
          w: BLOCK_W + 4,
          d: BLOCK_D + 4,
          yaw: far.blocks.yaw[b]!,
        });
    // (Its roofs a street's breadth past the lots drawn.)
    const inner = r0 + SPRAWL_GAP;
    for (let i = 0; i < n; i++) {
      const a = scatter(plan.seed, i, 1) * 2 * Math.PI,
        // (As far out that way as its ground is taken: bridge/sites.ts reachToward.)
        at = Math.sqrt(inner * inner + scatter(plan.seed, i, 0) * (r1 * r1 - inner * inner)),
        near = outlineAt(scene.outline, a) + SPRAWL_GAP,
        r = near + ((at - inner) / (r1 - inner)) * Math.max(0, sprawlFar(scene, ring, a) - near),
        out = (at - inner) / (r1 - inner),
        // Nearer the heart, the taller.
        // (By how far out of its sprawl it stands, not by a radius: its sprawl is no ring. A roof read by the old ring's
        // radius stood hundreds of metres high where its outline came in close: 2026-11-20.)
        h = 5 + scatter(plan.seed, i, 2) * 5 + 14 * (1 - out) ** 3,
        d = footD,
        x = r * Math.cos(a),
        z = r * Math.sin(a),
        // (Turned as the farthest of its blocks that way are, where they stand: the same streets run on.)
        yaw = far
          ? far.turn[Math.floor(((a / (2 * Math.PI) + 1) % 1) * OUTLINE) % OUTLINE]!
          : Math.PI / 2 - a,
        off = ((((a - plan.axis) % sector) + sector) % sector) * r;
      const w = footW;
      // (Off its avenues, and out of its water.)
      if (Math.min(off, sector * r - off) < AVENUE_HALF + w / 2 + 1 || wet(x, z, w / 2 + 4))
        continue;
      if (wetGround(plan.site, x, z)) continue;
      if (held.length && onHeld(held, x, z, w)) continue;
      // (None where its lots past those drawn stand on their own blocks: as thick as ever past them: farOf.)
      if (far && r < edgeAt(scene, a) + SPRAWL_GAP) {
        left++;
        continue;
      }
      // (Off the line its walls stand on out in it, or stood on: their ground, or the ring street where they stood, kept clear.)
      if (walls && Math.abs(r - wallAt(walls, a)) < w / 2 + WALL_THICK + 4) continue;
      // (What it stands on, its eaves with it: a tower's own breadth, a roof's overhang.)
      // (What it stands on, its eaves with it.)
      const foot = { x, z, w: w * 1.15 + 1, d: d * 1.15 + 1, yaw };
      if (taken.clashes(foot)) continue;
      taken.add(foot);
      rows.push(x, z, w, d, h, yaw, out, i);
    }
  }
  scene.sprawlLeft = left;
  return (scene.sprawlRoofs = Float32Array.from(rows));
}

/** A great city's roofs past those drawn, between so far and so far from its middle (metres). */
function sprawlRoofs(scene: TownScene, out: TownParts, from: number, to: number): void {
  const roofs = sprawlLaid(scene),
    { level, look } = hazeHome(scene);
  for (let k = 0; k < roofs.length; k += ROOF) {
    const x = roofs[k]!,
      z = roofs[k + 1]!,
      r = Math.hypot(x, z);
    if (r < from || r >= to) continue;
    // (The same homes as those its lots past those drawn stand in at their edge, their walls and roofs alone.)
    home(out, look, level, x, z, roofs[k + 5]!, 1, 1, -1);
  }
}

/**
 * The home its haze stands in: the level and design most of the homes at its edge are of (the last 2,000 of its lots past
 * those drawn, else of its own lots), so that its haze is more of the same town.
 */
function hazeHome(scene: TownScene): { level: number; look: HouseLook } {
  if (scene.haze) return scene.haze;
  const far = farOf(scene),
    count = new Map<number, number>();
  if (far)
    for (let k = Math.max(0, far.count - 2000); k < far.count; k++) {
      if (far.level[k]! < 0) continue;
      const key = far.level[k]! * 1000 + far.design[k]!;
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  if (!count.size)
    for (const p of scene.settled.slice(-500)) {
      if (scene.states.what[p] !== LOT.home) continue;
      const key = scene.states.level[p]! * 1000 + scene.states.design[p]!;
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  let best = 1000 + scene.looks.length - 1,
    most = 0;
  for (const [key, n] of count) if (n > most || (n === most && key < best)) [best, most] = [key, n];
  const level = Math.max(0, Math.min(TOP_LEVEL, Math.floor(best / 1000))),
    look = scene.looks[best % 1000] ?? scene.looks[0]!;
  return (scene.haze = { level, look });
}

/**
 * How many of a great city's lots past those drawn stand on its own blocks grown on, each as what its runs say stands there
 * (farOf); the rest, kilometres out, in the haze (sprawl).
 */
export const FAR_LOTS = 24_000,
  /**
   * How many parts its homes past those drawn may take, as far off as the eye is from them all (about what a great city's
   * whole view took before them): out to where they run out the city's lots stand on its blocks, past them its haze.
   */
  FAR_PARTS = 10_000,
  /**
   * How many more its homes past those may take, thinner the farther out (townDetail; with each its block's yard): the
   * city's far part as many roofs as its haze laid scattered had, on its own blocks.
   */
  THIN_PARTS = 5000;
/**
 * How much farther from the eye a lot drawn whole may be than one drawn as seen from afar (metres): which are drawn whole is
 * chosen again once the eye has moved half as far (render/town.ts TownLayer.look; townDetail).
 */
export const DETAIL_HYSTERESIS = 60;
/**
 * How many parts a great city's homes past its lots drawn nearest the eye take whole, and the next as seen from afar
 * (homeLod: the same building, its chimney and what stands on its roof left off); past them its rows (rowsLod).
 */
export const FAR_WHOLE = 2500,
  LOD_LOTS = 4000;
/**
 * About how many parts a home takes by its level, whole and as seen from afar (measured 2026-11-21), a spire's (TOP_LEVEL)
 * with them: without it a city's first spire drawn whole left its count not a number, and no home after it was drawn whole.
 */
const WHOLE_PARTS = [4.5, 4.5, 6.5, 7, 9, 15, 15],
  LOD_PARTS = [4, 4, 5, 5, 7, 15, 15],
  FINE0_PARTS = [2, 2, 5, 4, 7, 15, 15];

/** A town's lots past those its plan draws whole: where each stands on its blocks grown on, and what stands there. */
export type TownFar = {
  /** The first of them (its plan's lots drawn) and how many. */
  readonly from: number;
  readonly count: number;
  /** Where each stands and its turn (metres; lot from + k at k). */
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly yaw: Float32Array;
  /** Their blocks (block b of the town at b - first), and whether each is laid (not on its walls' line). */
  readonly blocks: {
    readonly x: Float32Array;
    readonly z: Float32Array;
    readonly yaw: Float32Array;
  };
  readonly first: number;
  readonly laid: Uint8Array;
  /** The level of the home that stands on each (-1: none) and its design (as `looks`). */
  readonly level: Int8Array;
  readonly design: Int16Array;
  /** Which hold a ruin (1: razed, 2: let fall; 0: none), and how many. */
  readonly ruin: Uint8Array;
  readonly ruins: number;
  /** How far out the farthest of them reaches (metres; 0: none), and toward each of OUTLINE bearings (as TownScene.outline). */
  readonly reach: number;
  readonly outline: Float32Array;
  /** The turn of the farthest of its blocks toward each of OUTLINE bearings (its haze past them is laid the same way). */
  readonly turn: Float32Array;
};

/**
 * The last town's lots laid out past its far lots (any first so many of them are the same, however many are laid): laying
 * them out again for each year's plan cost a great city 20-60 ms.
 */
let farKept: { key: string; count: number; lots: TownLots } | null = null;

/**
 * A great city's lots past those drawn (null: none; asked 2026-11-21, "why is what is circled look diffrent from each
 * other?"): its own blocks grown on past those drawn (bridge/town.ts townLots, the same blocks first), as many as FAR_LOTS,
 * each lot's home as its runs past the drawn say (TownPlan.beyond). Kept on its scene.
 */
/** farOf(), its blocks grown ahead over steps first (bridge/town.ts townLotsAhead); the same lots. */
export function* farSteps(scene: TownScene): Generator<void, TownFar | null, void> {
  if (scene.far !== undefined) return scene.far;
  const { plan } = scene,
    from = plan.lots,
    count = Math.min(FAR_LOTS, Math.max(0, plan.whole - from));
  if (count > 0 && !plan.sealed && plan.designs.length && plan.beyond) {
    const key = lotsKey(plan);
    if (farKept?.key !== key || farKept.count < from + count)
      yield* townLotsAhead(
        plan.seed,
        plan.axis,
        from + Math.min(FAR_LOTS, Math.ceil(count * 1.25)),
        plan.water,
        plan.site ?? null,
      );
  }
  return farOf(scene);
}

export function farOf(scene: TownScene): TownFar | null {
  if (scene.far !== undefined) return scene.far;
  const { plan } = scene,
    from = plan.lots;
  let count = Math.min(FAR_LOTS, Math.max(0, plan.whole - from));
  if (count <= 0 || plan.sealed || !plan.designs.length || !plan.beyond) return (scene.far = null);
  const key = lotsKey(plan);
  if (farKept?.key !== key || farKept.count < from + count) {
    // (As it grows, a quarter more than it holds, so that it is laid again only now and then.)
    const more = from + Math.min(FAR_LOTS, Math.ceil(count * 1.25));
    farKept = {
      key,
      count: more,
      lots: townLots(plan.family, plan.seed, plan.axis, more, plan.water, plan.site ?? null),
    };
  }
  const lots = farKept.lots;
  // (Where its ground runs out, its blocks do: none past the last laid.)
  count = Math.max(0, Math.min(count, lots.blocks.x.length * BLOCK_LOTS - from));
  if (count <= 0) return (scene.far = null);
  const first = Math.floor(from / BLOCK_LOTS);
  const level = new Int8Array(count).fill(-1),
    design = new Int16Array(count),
    ruin = new Uint8Array(count);
  const designOf = new Map(plan.designs.map((d, i) => [d.since, i])),
    ash = plan.ash ?? 0;
  for (const run of plan.beyond) {
    const [kind, lo, hi, , , lv, since] = run as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    if (kind === 2 || kind === 3) {
      for (let p = Math.max(from, lo); p < Math.min(hi, from + count); p++) {
        ruin[p - from] = kind === 3 ? 1 : 2;
        level[p - from] = -1;
      }
      continue;
    }
    if (kind !== 0 && kind !== 1) continue;
    const takes = (plan.months[lv] ?? 3) * (YEAR_S / 12);
    for (let p = Math.max(from, lo); p < Math.min(hi, from + count); p++) {
      // (One not yet done when its plan came stands at the year's turn after: a home raised higher as it stood till then.)
      const done = progress(beganAt(run, p), takes, scene.at) >= 1;
      if (!done && kind === 0) continue;
      level[p - from] = done ? lv : Math.max(0, lv - 1);
      design[p - from] = designOf.get(since) ?? 0;
    }
  }
  // (All of them, however many draw: which do, and how, is chosen by where the eye is: townDetail.)
  const nb = Math.ceil((from + count) / BLOCK_LOTS) - first,
    laid = new Uint8Array(nb).fill(1);
  // (Its walls' line out in it, or where they stood: no block of it there.)
  const line = scene.walls && plan.walls && plan.walls.reach > plan.lots ? scene.walls.line : null,
    half = Math.hypot(BLOCK_W, BLOCK_D) / 2 + WALL_THICK + 2,
    // (A stronghold's ground: no block of it there.)
    holds = holdPlaces(plan, scene.lots);
  let reach = 0;
  const turn = new Float32Array(OUTLINE),
    farthest = new Float32Array(OUTLINE);
  for (let k = 0; k < count; k++) {
    const p = from + k,
      b = Math.floor(p / BLOCK_LOTS) - first;
    if (line && (p % BLOCK_LOTS === 0 || k === 0)) {
      const bx = lots.blocks.x[b + first]!,
        bz = lots.blocks.z[b + first]!;
      if (Math.abs(Math.hypot(bx, bz) - wallAt(line, Math.atan2(bz, bx))) < half) laid[b] = 0;
    }
    if (holds.length && (p % BLOCK_LOTS === 0 || k === 0)) {
      const bx = lots.blocks.x[b + first]!,
        bz = lots.blocks.z[b + first]!;
      if (onHeld(holds, bx, bz, HELD_PAD)) laid[b] = 0;
    }
    if (!laid[b] || p < ash) {
      level[k] = -1;
      ruin[k] = 0;
    }
    if (!laid[b]) continue;
    const r = Math.hypot(lots.x[p]!, lots.z[p]!),
      o =
        Math.floor(((Math.atan2(lots.z[p]!, lots.x[p]!) / (2 * Math.PI) + 1) % 1) * OUTLINE) %
        OUTLINE;
    reach = Math.max(reach, r + LOT_D);
    if (r > farthest[o]!) {
      farthest[o] = r;
      turn[o] = lots.blocks.yaw[b + first]!;
    }
  }
  return (scene.far = {
    from,
    count,
    x: lots.x.subarray(from, from + count),
    z: lots.z.subarray(from, from + count),
    yaw: lots.yaw.subarray(from, from + count),
    blocks: {
      x: lots.blocks.x.subarray(first, first + nb),
      z: lots.blocks.z.subarray(first, first + nb),
      yaw: lots.blocks.yaw.subarray(first, first + nb),
    },
    first,
    laid,
    level,
    design,
    ruin,
    // (A row's alike as one, as homesSeen draws them.)
    ruins: ruin.reduce(
      (n, v, k) => n + (v && (k === 0 || (from + k) % 4 === 0 || ruin[k - 1] !== v) ? 1 : 0),
      0,
    ),
    reach,
    outline: outlineOf(lots, from + count),
    turn,
  });
}

/** How many bands of windows a tall home's storeys are told by (home: fewer than its storeys on the tall ones). */
function towerBands(level: number): number {
  return Math.min(6, Math.max(1, Math.floor(LEVELS[level]!.storeys / (level === 5 ? 4 : 2))));
}

/** About how many parts a home past a city's lots drawn takes in its row (rowsLod): for FAR_PARTS. */
function farParts(level: number, look: HouseLook | undefined): number {
  if (!look) return 0;
  // (A spire as it stands whole, its masts, bands and caps tall enough to be seen as far as it is drawn.)
  if (level >= TOP_LEVEL) return 15;
  // (Each on its own as from afar: home's fine 0, measured.)
  if (!rowJoins(level, look)) return look.open ? 1 : FINE0_PARTS[level]!;
  if (level <= 1) return 1;
  if (level === 2) return 1.25;
  return (2 + towerBands(level)) / 4;
}

/** How far out a town's lots reach toward a bearing (metres): those drawn, and those past them on their own blocks (farOf). */
function edgeAt(scene: TownScene, a: number): number {
  const far = farOf(scene),
    own = outlineAt(scene.outline, a);
  return far ? Math.max(own, outlineAt(far.outline, a)) : own;
}

/**
 * The ground of a great city's lots past those drawn, as of those drawn: its streets, laid under all of it from its lots drawn
 * out to its farthest toward each bearing (pieces of a wedge, none on its water or its walls' line), and each block's yards on
 * them.
 */
function farGround(scene: TownScene, out: TownParts, street: Rgb, yard: Rgb): void {
  const far = farOf(scene);
  if (!far) return;
  let plate = 0;
  // (Its streets only about its blocks that hold anything, homes or ruins: open ground is not paved.)
  const CELL = 60,
    held = new Set<number>(),
    cellOf = (x: number, z: number) => Math.floor(x / CELL) * 100_003 + Math.floor(z / CELL);
  for (let k = 0; k < far.count; k += 1) {
    if (far.level[k]! < 0 && !far.ruin[k]) continue;
    const b = Math.floor((far.from + k) / BLOCK_LOTS) - far.first;
    held.add(cellOf(far.blocks.x[b]!, far.blocks.z[b]!));
    k = (b + far.first + 1) * BLOCK_LOTS - far.from - 1;
  }
  const near = (x: number, z: number) => {
    for (let u = -1; u <= 1; u++)
      for (let v = -1; v <= 1; v++) if (held.has(cellOf(x + u * CELL, z + v * CELL))) return true;
    return false;
  };
  const { plan } = scene,
    water = plan.water,
    line = scene.walls && plan.walls && plan.walls.reach > plan.lots ? scene.walls.line : null,
    round = OUTLINE,
    wet = (x: number, z: number) =>
      (!!water && Math.hypot(x - water.x, z - water.z) < water.r + 1) || wetGround(plan.site, x, z),
    // (A piece of the wedge toward bearing a from lo out to hi; one reaching the water in quarters, twice over, those on it left out.)
    lay = (a: number, lo: number, hi: number, split: number): void => {
      const mid = (lo + hi) / 2,
        across = (2 * Math.PI * hi) / round + 1,
        x = mid * Math.cos(a),
        z = mid * Math.sin(a),
        yaw = Math.PI / 2 - a,
        corners = rectPoints({ x, z, w: across, d: hi - lo + 1, yaw });
      let any = false;
      for (let r = lo; r <= hi && !any; r += CELL / 2) any = near(r * Math.cos(a), r * Math.sin(a));
      if (!any) return;
      if (wet(x, z) || corners.some((q) => wet(q.x, q.z))) {
        if (split > 0)
          for (let q = 0; q < 4; q++)
            lay(a, lo + ((hi - lo) * q) / 4, lo + ((hi - lo) * (q + 1)) / 4, split - 1);
        return;
      }
      out.put("box", street, x, 0.16, z, across, 0.2, hi - lo + 1, yaw);
      plate++;
    };
  for (let k = 0; k < round; k++) {
    const a = ((k + 0.5) / round) * 2 * Math.PI,
      from = Math.max(0, outlineAt(scene.outline, a) - LOT_D),
      to = outlineAt(far.outline, a) + STREET,
      wall = line ? wallAt(line, a) : -1e9;
    for (let lo = from; lo < to;) {
      // (Pieces as long as an eighth of how far out they lie, a hundred metres and more.)
      let hi = Math.min(to, lo + Math.max(100, lo / 8));
      // (Its walls' line kept clear: the piece ends short of it, and the next begins past it.)
      if (lo < wall + WALL_THICK + 4 && hi > wall - WALL_THICK - 4) {
        if (lo >= wall - WALL_THICK - 4) {
          lo = wall + WALL_THICK + 4;
          continue;
        }
        hi = wall - WALL_THICK - 4;
      }
      lay(a, lo, hi, 2);
      lo = hi;
    }
  }
  // (Its yards with its homes as drawn from where the eye looks: homesSeen. None under a block seen kilometres out.)
  scene.farYard = yard;
  scene.farPlate = plate;
}

/**
 * Which of a city's homes past its lots drawn are drawn whole, from where the eye looks (`focus`, metres from its square):
 * the nearest whole as FAR_WHOLE parts allow, the next as seen from afar as LOD_LOTS allow (homeLod), the rest in their rows (rowsLod), each the same
 * building, only less of it; past all those FAR_PARTS draws, thinner the farther out (THIN_PARTS). Its own lots drawn stand
 * whole as ever. By lot (its own at p, those past at far.from + k): 1 whole, 2 as seen from afar, 3 in its row, 4 not drawn
 * (thinned out); 0 drawn as ever (its own, rising, a ruin, not a home). Chosen again only once
 * the eye has moved half DETAIL_HYSTERESIS (render/town.ts), drawn over frames.
 */
export type TownDetail = { readonly focus: { x: number; z: number }; readonly drawn: Uint8Array };
export function townDetail(
  scene: TownScene,
  focus: { x: number; z: number },
  /** How many parts each way (for a check to ask fewer). */
  budget: { whole: number; lod: number; rows: number; thin: number } = DETAIL_BUDGET,
  /** As last chosen (null: none): those thinned out far off stay as they were unless their chance has passed their draw by THIN_HOLD. */
  was: TownDetail | null = null,
): TownDetail {
  const run = townDetailSteps(scene, focus, budget, was);
  for (;;) {
    const r = run.next();
    if (r.done) return r.value;
  }
}

const DETAIL_BUDGET = { whole: FAR_WHOLE, lod: LOD_LOTS, rows: FAR_PARTS, thin: THIN_PARTS };
/** How many of a city's lots townDetailSteps goes through between yields. */
const DETAIL_STEP = 2048;
/**
 * How far past its draw a far home's chance must go before it comes or goes from as it was last chosen (a share of its
 * chance): with none, every 30 m the eye moved some thousands far off came and went, 0.4-0.8% of the view (2026-11-21).
 */
const THIN_HOLD = 1;

/**
 * townDetail a few thousand lots a step (render/town.ts draws a choosing over frames): in one, a great city's choosing held
 * a frame of WebKit's half a second and more, its lots gone through before its code was quick (2026-11-21).
 */
export function* townDetailSteps(
  scene: TownScene,
  focus: { x: number; z: number },
  budget: { whole: number; lod: number; rows: number; thin: number } = DETAIL_BUDGET,
  was: TownDetail | null = null,
): Generator<void, TownDetail> {
  const { plan, states } = scene,
    far = farOf(scene),
    n = plan.lots + (far?.count ?? 0),
    drawn = new Uint8Array(n);
  for (const p of scene.settled) if (states.what[p] === LOT.home) drawn[p] = 1;
  if (!far) return { focus: { x: focus.x, z: focus.z }, drawn };
  // (Nearest first, by the metre: counted out, not sorted, so a great city's choosing takes a few milliseconds. Its homes
  // and its ruins.)
  const d = new Float64Array(far.count),
    counted = (k: number) => far.level[k]! >= 0 || far.ruin[k]! > 0;
  let most = 0,
    homes = 0;
  for (let k = 0; k < far.count; k++) {
    if (k % DETAIL_STEP === 0) yield;
    if (!counted(k)) continue;
    d[k] = Math.hypot(far.x[k]! - focus.x, far.z[k]! - focus.z);
    most = Math.max(most, d[k]!);
    homes++;
  }
  const slots = Math.floor(most) + 2,
    starts = new Int32Array(slots + 1),
    order = new Int32Array(homes);
  for (let k = 0; k < far.count; k++) if (counted(k)) starts[Math.floor(d[k]!) + 1]!++;
  for (let i = 1; i <= slots; i++) starts[i]! += starts[i - 1]!;
  yield;
  for (let k = 0; k < far.count; k++) if (counted(k)) order[starts[Math.floor(d[k]!)]!++] = k;
  yield;
  // (What each takes drawn in its row, its block's yard and street its share: as a ruin, what stands of a row of them.)
  const cost = (k: number) =>
    (far.ruin[k]
      ? 0.4
      : farParts(
          Math.max(0, Math.min(TOP_LEVEL, far.level[k]!)),
          formLook(scene, far.from + k, far.design[k]!),
        )) +
    1 / BLOCK_LOTS;
  // (By the parts they take: fewer towers whole than houses. All of them, as many as FAR_PARTS would draw in their rows.)
  let whole = 0,
    lod = 0,
    rows = 0,
    edge = 1,
    i = 0;
  for (; i < homes && rows < budget.rows; i++) {
    if (i % DETAIL_STEP === 0) yield;
    const k = order[i]!;
    rows += cost(k);
    edge = Math.max(edge, d[k]!);
    // (A ruin drawn as ever.)
    if (far.ruin[k]) continue;
    const lv = Math.max(0, Math.min(TOP_LEVEL, far.level[k]!));
    if (whole < budget.whole) {
      whole += WHOLE_PARTS[lv]!;
      drawn[far.from + k] = 1;
    } else if (lod < budget.lod) {
      lod += LOD_PARTS[lv]!;
      drawn[far.from + k] = 2;
    } else drawn[far.from + k] = 3;
  }
  // Past them, thinner the farther out, each in its row (a ruin as ever) or not drawn (4) by a draw of its own that does
  // not change (so as the eye moves only those whose chance passes their draw come or go, few and far off), as many as
  // THIN_PARTS draw. All drawn where they begin, then fewer as (edge / far) to the sixth, down to a share of the square
  // of it: no ring where the city thins at once (a share kept from the edge out read as a second town past it), and the
  // city on out to its farthest as thick on the screen as near (the ground each covers grows as the square of how far
  // off it is). The share is as the budget allows, worked out by the metre.
  // (A home drawn alone there brings its block's yard: a part more.)
  const slot = new Float64Array(slots + 1);
  for (let j = i; j < homes; j++) {
    if (j % DETAIL_STEP === 0) yield;
    const k = order[j]!;
    slot[Math.floor(d[k]!)]! += cost(k) + (far.ruin[k] ? 0 : 1);
  }
  const chance = (r: number, share: number) => {
      const q = (edge / r) ** 2;
      return Math.min(1, Math.max(q * q * q, share * q));
    },
    // (By the metre: each its square and sixth once.)
    near2 = new Float64Array(slots + 1),
    from = Math.floor(edge);
  for (let m = from; m <= slots; m++) near2[m] = (edge / (m + 0.5)) ** 2;
  const want = (share: number) => {
    let n = 0;
    for (let m = from; m <= slots; m++) {
      if (!slot[m]) continue;
      const q = near2[m]!;
      n += slot[m]! * Math.min(1, Math.max(q * q * q, share * q));
    }
    return n;
  };
  let share = 1;
  if (i < homes && want(1) > budget.thin) {
    let lo = 0,
      hi = 1;
    for (let step = 0; step < 14; step++) {
      yield;
      share = (lo + hi) / 2;
      if (want(share) > budget.thin) hi = share;
      else lo = share;
    }
    share = lo;
  }
  for (let j = i; j < homes; j++) {
    if (j % DETAIL_STEP === 0) yield;
    const k = order[j]!,
      p = far.from + k,
      then = was && was.drawn.length > p ? was.drawn[p]! : -1,
      // (Kept before: kept on till its chance falls a good way under its draw; left out before: left till well over.)
      hold = then === 4 ? 1 / (1 + THIN_HOLD) : then >= 0 ? 1 + THIN_HOLD : 1,
      kept = scatter(plan.seed, p, 41) < chance(d[k]!, share) * hold;
    drawn[far.from + k] = !kept ? 4 : far.ruin[k] ? 0 : 3;
  }
  return { focus: { x: focus.x, z: focus.z }, drawn };
}

/** A home seen from afar: the same building as `home` stands, its chimney and what stands on its roof left off (`fine`: home's). */
function homeLod(
  out: TownParts,
  look: HouseLook,
  level: number,
  x: number,
  z: number,
  yaw: number,
  fine = 1,
): void {
  home(out, look, level, x, z, yaw, 1, 1, fine);
}

/** A home standing done at a level and look, as finely as asked (home's `fine`: 2 whole, 1 as seen from afar, 0 further off): for a check. */
export function homeAt(
  out: TownParts,
  look: HouseLook,
  level: number,
  x: number,
  z: number,
  yaw: number,
  fine: number,
): void {
  home(out, look, level, x, z, yaw, 1, 1, fine);
}

/** A row of `n` homes of one level and look side by side along their street from (x, z), drawn in their row (rowsLod): for a check. */
export function rowAt(
  out: TownParts,
  look: HouseLook,
  level: number,
  n: number,
  x: number,
  z: number,
  yaw: number,
): void {
  const list = Array.from({ length: n }, (_, k) => k);
  rowsLod(
    out,
    list,
    (p) => {
      const [px, pz] = at(x, z, yaw, p * LOT_W, 0);
      return { x: px, z: pz, yaw };
    },
    () => ({ level, look }),
  );
}

/** The walls of a tall home: brick, concrete, glass; where its people have no brick to stack, what its low homes are of. */
function tallWall(look: HouseLook, level: number): Rgb {
  return level === 3
    ? (look.stuff ?? (look.own ? darker(look.wall, 0.85) : BRICK))
    : level === 4
      ? (look.block ?? (look.own ? mixed(look.wall, CONCRETE, 0.5) : CONCRETE))
      : (look.glass ?? GLASS);
}

/**
 * Whether a row of homes of one level and look stands wall to wall, so that drawn as one it is the same row (gaps between
 * them under a metre: townhouses, tenements, blocks; a land's joined houses).
 */
function rowJoins(level: number, look: HouseLook): boolean {
  if (look.sealed || look.open || look.tent || look.round || level >= TOP_LEVEL) return false;
  if (level <= 1) return look.joined === true;
  // (Not towers a metre and more apart: drawn as one, the gaps between them closed and opened as the eye moved, near
  // enough to see: 2026-11-21. Drawn each on its own they are as they stand whole.)
  return LOT_W - LEVELS[level]!.w <= 0.6;
}

/**
 * Homes far from the eye in their rows (`place(p)` where lot p stands; `of(p)` its level and look, null: none): each run of
 * lots of one row of a block, side by side, of one level and look and standing wall to wall, one body as long as they, its
 * roof along it and a band of windows on it, the same row with the hand's breadth between its homes closed; any other home
 * as seen from afar (homeLod), each where it stands.
 */
function rowsLod(
  out: TownParts,
  list: readonly number[],
  place: (p: number) => { x: number; z: number; yaw: number },
  of: (p: number) => { level: number; look: HouseLook } | null,
): void {
  const sorted = [...list].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length;) {
    const p = sorted[i]!,
      h0 = of(p);
    if (!h0) {
      i++;
      continue;
    }
    const { level, look } = h0;
    if (!rowJoins(level, look)) {
      const c = place(p);
      homeLod(out, look, level, c.x, c.z, c.yaw, 0);
      i++;
      continue;
    }
    // (The run: the same row of four, lot after lot, alike.)
    let j = i + 1;
    while (
      j < sorted.length &&
      sorted[j] === sorted[j - 1]! + 1 &&
      sorted[j]! % 4 !== 0 &&
      of(sorted[j]!)?.level === level &&
      of(sorted[j]!)?.look === look
    )
      j++;
    const n = j - i,
      a = place(p),
      b = place(sorted[j - 1]!);
    i = j;
    if (n === 1) {
      homeLod(out, look, level, a.x, a.z, a.yaw, 0);
      continue;
    }
    const L = LEVELS[level]!,
      [w, d] = level <= 1 ? lowFoot(L, look) : [L.w, L.d],
      h = L.h * tallOf(look, level),
      rise = level <= 1 ? look.raised * 10 : 0,
      x = (a.x + b.x) / 2,
      z = (a.z + b.z) / 2,
      long = w + (n - 1) * LOT_W,
      yaw = a.yaw;
    if (h <= 0.01) continue;
    const flat = look.rise < 0.1;
    if (out.compound) {
      // (Drawn as one (view/compound.ts): the row's walls and roof, or tar, and its bands of windows.)
      if (level >= 3) {
        out.shape("block", tallWall(look, level), null, x, h / 2, z, long, h, d, yaw);
        out.lampShape(level === 3 ? "bands2" : "bands5", x, h / 2, z, long, h, d, yaw);
        continue;
      }
      if (level === 2) {
        out.shape(
          flat ? "houseFlat" : "house",
          look.wall,
          look.roof,
          x,
          h / 2,
          z,
          long,
          h,
          d,
          yaw,
          long + L.w * 0.04,
          roof2(look),
          L.d * 1.08,
        );
        // (Its windows as each of its homes' run, 78% of a row as long less a home's 22%.)
        out.lampShape("bands3", x, h / 2, z, (long - L.w * 0.22) / 0.78, h, d, yaw);
        continue;
      }
    }
    if (!out.compound || level >= 2)
      out.put(
        "box",
        level >= 3 ? tallWall(look, level) : look.wall,
        x,
        rise + h / 2,
        z,
        long,
        h,
        d,
        yaw,
      );
    if (level >= 3) {
      // (Its storeys' bands and its roof's tar, as each of its homes has them.)
      const bands = towerBands(level);
      for (let k = 0; k < bands; k++)
        out.lamp(x, ((k + 0.6) / bands) * h, z, long + L.w * 0.01, 0.8, L.d * 1.01, yaw);
      out.put("box", TAR, x, h + 0.25, z, long + L.w * 0.02, 0.5, L.d * 1.02, yaw);
      continue;
    }
    if (level === 2) {
      // (A band of windows for each of its storeys, front and back, as each of its homes has.)
      for (let k = 0; k < L.storeys; k++)
        out.lamp(x, ((k + 0.55) / L.storeys) * h, z, long - L.w * 0.22, 0.9, L.d * 1.02, yaw);
      const rh = roof2(look);
      out.put(
        flat ? "box" : "gable",
        look.roof,
        x,
        h + rh / 2,
        z,
        long + L.w * 0.04,
        rh,
        L.d * 1.08,
        yaw,
      );
      continue;
    }
    // (Joined houses: their windows on their front, one band along it; their roof along the row.)
    // (At the heights of each of its homes' windows: the door's floor and the one above, the one above alone apart.)
    if (h > 1.4) {
      const [wx, wz] = at(x, z, yaw, 0, -d / 2 - 0.06);
      for (const up of look.apart ? [0.74] : [0.3, 0.74])
        out.lamp(wx, rise + h * up, wz, long * 0.86, Math.min(0.8, h * 0.3), 0.14, yaw);
    }
    const rh = flat ? 0.6 : Math.min(5, look.rise * d * 0.5);
    if (out.compound)
      out.shape(
        flat ? "houseFlat" : "house",
        look.wall,
        look.roof,
        x,
        rise + h / 2,
        z,
        long,
        h,
        d,
        yaw,
        long + w * (flat ? 0.02 : 0.15),
        rh,
        d * (flat ? 1.02 : 1.15),
      );
    else
      out.put(
        flat ? "box" : "gable",
        look.roof,
        x,
        rise + h + rh / 2,
        z,
        long + w * (flat ? 0.02 : 0.15),
        rh,
        d * (flat ? 1.02 : 1.15),
        yaw,
      );
  }
}

/**
 * A town's homes standing done as drawn from where the eye looks (`detail`; null: as ever, and its lots past those drawn
 * a row's alike as one): the nearest whole, then each its body and roof, then by rows. Yields every few hundred lots, so a
 * new choosing is drawn over frames (render/town.ts).
 */
export function* homesSeen(
  scene: TownScene,
  detail: TownDetail | null,
  t: number,
  out: TownParts,
  /** Its own lots' homes, those past them, or both (its own are drawn whole wherever the eye is: drawn once a year). */
  which: "all" | "own" | "far" = "all",
): Generator<void, void> {
  const far = farOf(scene),
    drawn = detail?.drawn,
    STEP = 100;
  // (Its own lots drawn whole as ever.)
  if (which !== "far")
    for (let i = 0; i < scene.settled.length; i += STEP) {
      townHomes(scene, scene.settled.slice(i, i + STEP), t, out);
      yield;
    }
  if (!far || which === "own") return;
  const farAt = (p: number) => {
      const k = p - far.from;
      return { x: far.x[k]!, z: far.z[k]!, yaw: far.yaw[k]! };
    },
    farOfLot = (p: number) => {
      const k = p - far.from,
        level = far.level[k]!,
        // (In its district's look, as the town's own lots are: apart at the edge, close by the square. townform.ts.)
        look = formLook(scene, p, far.design[k]!) ?? scene.looks[0];
      return level >= 0 && look ? { level, look } : null;
    },
    rows: number[] = [],
    yard = scene.farYard,
    yarded = new Uint8Array(far.laid.length),
    // (A block's yards, once, where any of its homes stands; a block begun among those drawn has them with its ground.)
    yardOf = (k: number) => {
      const p = far.from + k,
        b = Math.floor(p / BLOCK_LOTS) - far.first;
      if (!yard || yarded[b] || (b + far.first) * BLOCK_LOTS < far.from) return;
      yarded[b] = 1;
      out.put(
        "box",
        yardTone(scene, b + far.first, yard),
        far.blocks.x[b]!,
        0.3,
        far.blocks.z[b]!,
        BLOCK_W - 0.6,
        0.4,
        BLOCK_D - 0.6,
        far.blocks.yaw[b]!,
      );
    };
  let since = 0;
  for (let k = 0; k < far.count; k++) {
    // (A row's worth gathered drawn at the row's end, a few hundred lots a step.)
    if (++since >= STEP * 4 && (far.from + k) % 4 === 0) {
      since = 0;
      rowsLod(out, rows, farAt, farOfLot);
      rows.length = 0;
      yield;
    }
    const p = far.from + k,
      h = farOfLot(p);
    // (Ruins as seen from afar: their floors and what stands of their walls, low, a row's alike as one.)
    // (Not drawn, thinned out far off: townDetail.)
    if (drawn?.[p] === 4) continue;
    if (far.ruin[k]) {
      const kind = far.ruin[k]!,
        razed = kind === 1;
      let n = 1;
      while (
        k + n < far.count &&
        (far.from + k + n) % 4 !== 0 &&
        far.ruin[k + n] === kind &&
        drawn?.[far.from + k + n] !== 4
      )
        n++;
      const e = k + n - 1;
      out.put(
        "box",
        razed ? ASH : DARK,
        (far.x[k]! + far.x[e]!) / 2,
        0.5 + (razed ? 0.3 : 0.8),
        (far.z[k]! + far.z[e]!) / 2,
        n * LOT_W - 2.5,
        razed ? 0.6 : 1.6,
        LOT_D - 4,
        far.yaw[k]!,
      );
      k = e;
      continue;
    }
    if (!h) continue;
    yardOf(k);
    const how = drawn ? drawn[p]! : 3;
    if (how === 1) home(out, h.look, h.level, far.x[k]!, far.z[k]!, far.yaw[k]!);
    else if (how === 2) homeLod(out, h.look, h.level, far.x[k]!, far.z[k]!, far.yaw[k]!);
    else rows.push(p);
  }
  rowsLod(out, rows, farAt, farOfLot);
}

/** homesSeen at once. */
export function townHomesSeen(
  scene: TownScene,
  detail: TownDetail | null,
  t: number,
  out: TownParts,
): void {
  const run = homesSeen(scene, detail, t, out);
  while (!run.next().done);
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
  /**
   * As home's: its bands, caps and mast at every fineness but the haze's (-1, its shafts alone): a spire's mast and bands are
   * metres high, seen as far off as it is drawn, and drawn and left off as the eye moved they came and went in its sight.
   */
  fine = 2,
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
    if (fine >= 0) {
      if (grow >= 1)
        for (let k = 0; k < bands!; k++)
          out.lamp(x, from + ((k + 0.6) / bands!) * span, z, w * 1.008, 1.8, d * 1.008, yaw);
      out.put("box", CARBON, x, top + 0.4, z, w * 1.05, 0.9, d * 1.05, yaw);
    }
    from = top;
  });
  if (roof >= 1 && fine >= 0) {
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
  /**
   * How finely: 2 whole; 1 as seen from afar, its chimney and what stands on its roof left off (homeLod); 0 further off
   * still, a hut's or a house's two front windows left off too (rowsLod); -1 in the haze past all its lots drawn, its
   * walls and roof alone (sprawlRoofs). All else the same building.
   */
  fine = 2,
): void {
  // (Halls on another body: Phase 64.)
  if (look.sealed) return sealedHome(out, look, level, x, z, yaw, grow, roof);
  if (level >= TOP_LEVEL) return spire(out, look, x, z, yaw, grow, roof, fine);
  const L = LEVELS[Math.max(0, Math.min(TOP_LEVEL, level))]!,
    h = L.h * tallOf(look, level) * grow;
  if (h <= 0.01) return;
  if (level <= 1) {
    // Huts and houses: the land's own, round or square, its roof pitched to the rain.
    const [w, d] = lowFoot(L, look),
      wall = look.wall,
      flat = look.rise < 0.1,
      rh = look.tent ? 7.5 : flat ? 0.6 : Math.min(5, look.rise * d * 0.5),
      // (Drawn as one, its walls and roof (view/compound.ts): a square home standing whole.)
      one = out.compound && !look.round && !look.tent && !look.open && roof >= 1 && grow >= 1;
    if (one)
      out.shape(
        flat ? "houseFlat" : "house",
        wall,
        look.roof,
        x,
        look.raised * 10 + h / 2,
        z,
        w,
        h,
        d,
        yaw,
        w * (flat ? 1.02 : 1.15),
        rh,
        d * (flat ? 1.02 : 1.15),
      );
    else out.put(look.round ? "cyl" : "box", wall, x, look.raised * 10 + h / 2, z, w, h, d, yaw);
    // Two windows on its front, toward its street (none in a tent, nor where it is open).
    if (!look.tent && !look.open && grow >= 1 && h > 1.4 && fine >= 1)
      for (const side of [-1, 1]) {
        // (Apart at the edge, a cottage of one window; by the square a floor higher, a window to each floor.)
        if (look.apart && side < 0) continue;
        const [wx, wz] = at(x, z, yaw, (side * w) / 4, (-d / 2) * (look.round ? 0.9 : 1) - 0.06);
        out.lamp(
          wx,
          look.raised * 10 + h * (look.joined ? (side < 0 ? 0.3 : 0.74) : 0.55),
          wz,
          Math.min(1, w / 5),
          Math.min(0.8, h * 0.3),
          0.14,
          yaw,
        );
      }
    if (one || look.open || roof <= 0) return;
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
    const flat = look.rise < 0.1,
      rh = roof2(look);
    if (out.compound && roof >= 1 && grow >= 1) {
      // (Drawn as one: its walls and roof, and its storeys' windows (view/compound.ts).)
      out.shape(
        flat ? "houseFlat" : "house",
        look.wall,
        look.roof,
        x,
        h / 2,
        z,
        L.w,
        h,
        L.d,
        yaw,
        L.w * 1.04,
        rh,
        L.d * 1.08,
      );
      if (fine >= 0) out.lampShape("bands3", x, h / 2, z, L.w, h, L.d, yaw);
      if (fine >= 2) {
        const [cx, cz] = at(x, z, yaw, L.w * 0.3, 0);
        out.put("box", BRICK, cx, h + 2.6, cz, 0.8, 2.2, 0.8, yaw);
      }
      return;
    }
    out.put("box", look.wall, x, h / 2, z, L.w, h, L.d, yaw);
    if (roof <= 0) return;
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
    if (grow >= 1 && fine >= 0)
      for (let k = 0; k < L.storeys; k++)
        out.lamp(x, ((k + 0.55) / L.storeys) * h, z, L.w * 0.78, 0.9, L.d * 1.02, yaw);
    if (roof >= 1 && fine >= 2) {
      const [cx, cz] = at(x, z, yaw, L.w * 0.3, 0);
      out.put("box", BRICK, cx, h + 2.6, cz, 0.8, 2.2, 0.8, yaw);
    }
    return;
  }
  // (Brick, concrete, glass; where its people have no brick to stack, in what its low homes are built of.)
  const wall =
    level === 3
      ? (look.stuff ?? (look.own ? darker(look.wall, 0.85) : BRICK))
      : level === 4
        ? (look.block ?? (look.own ? mixed(look.wall, CONCRETE, 0.5) : CONCRETE))
        : (look.glass ?? GLASS);
  if (out.compound && roof >= 1 && grow >= 1) {
    // (Drawn as one (view/compound.ts): a tower its walls, frames, tar and mast, its windows one more; a block or a
    // tenement its walls and tar, its bands of windows one more; past all its lots drawn, walls and tar alone.)
    if (level === 5 && fine >= 0) {
      out.shape("tower", wall, null, x, h / 2, z, L.w, h, L.d, yaw);
      out.lampShape("bands6", x, h / 2, z, L.w, h, L.d, yaw);
      return;
    }
    out.shape("block", wall, null, x, h / 2, z, L.w, h, L.d, yaw);
    if (fine >= 0 && level < 5)
      out.lampShape(level === 3 ? "bands2" : "bands5", x, h / 2, z, L.w, h, L.d, yaw);
    if (fine < 2 || level === 5) return;
    if (level === 3) out.put("cyl", TIMBER, x, h + 1.6, z, 2, 2.2, 2, 0);
    else out.put("box", CONCRETE, x, h + 1.6, z, L.w * 0.4, 2.4, L.d * 0.3, yaw);
    return;
  }
  out.put("box", wall, x, h / 2, z, L.w, h, L.d, yaw);
  // Storeys told by bands of windows, lit at night (fewer bands than storeys on the tall ones;
  // a tower's between the frames of its floors).
  const bands =
    fine < 0 ? 0 : Math.min(6, Math.max(1, Math.floor((L.storeys * grow) / (level === 5 ? 4 : 2))));
  for (let k = 0; k < bands; k++) {
    const y = ((k + 0.6) / bands) * h;
    if (level === 5) towerBand(out, x, y, z, L.w, L.d, L.w, h / bands, grow >= 1, yaw);
    else if (grow >= 1) out.lamp(x, y, z, L.w * 1.01, 0.8, L.d * 1.01, yaw);
    else out.put("box", DARK, x, y, z, L.w * 1.01, 0.8, L.d * 1.01, yaw);
  }
  if (roof <= 0) return;
  out.put("box", TAR, x, h + 0.25, z, L.w * 1.02, 0.5, L.d * 1.02, yaw);
  // On the roof: a tank on a tenement, a plant-house on a block (a couple of metres: left off from afar), a mast on a
  // tower (ten metres high: seen as far off as the tower is drawn).
  if (level === 5) {
    if (fine >= 0) towerMast(out, x, z, h);
    return;
  }
  if (fine < 2) return;
  if (level === 3) out.put("cyl", TIMBER, x, h + 1.6, z, 2, 2.2, 2, 0);
  else if (level === 4) out.put("box", CONCRETE, x, h + 1.6, z, L.w * 0.4, 2.4, L.d * 0.3, yaw);
}

/** A tower's mast on its roof, its top `h` up. */
function towerMast(out: TownParts, x: number, z: number, h: number): void {
  out.put("box", FRAME, x, h + 5, z, 0.4, 10, 0.4, 0);
}

/**
 * A tower's frame of a floor at `y` and its windows lit below it (`long` along its street: its own breadth, or a row's;
 * `w` its own, `apart` how far its bands are apart).
 */
function towerBand(
  out: TownParts,
  x: number,
  y: number,
  z: number,
  long: number,
  d: number,
  w: number,
  apart: number,
  lit: boolean,
  yaw: number,
): void {
  out.put("box", FRAME, x, y, z, long + w * 0.01, 0.5, d * 1.01, yaw);
  if (lit) out.lamp(x, y - apart / 2, z, long + w * 0.005, 1.2, d * 1.005, yaw);
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
    h = L.h * tallOf(look, level) * (level >= TOP_LEVEL ? spireShare(x, z) : 1),
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
  // A crane over the tall ones: its mast at a front corner in its own yard, against its face, its jib over them. (Beside
  // them it stood in the next lot's house, or out in the street at a row's end, 2026-11-23.)
  if (level >= 3) {
    const [mx, mz] = at(x, z, yaw, w / 2 - 0.5, -(d / 2 + 0.45)),
      mast = h + 12;
    out.put("box", CRANE, mx, mast / 2, mz, 0.8, mast, 0.8, yaw);
    const [jx, jz] = at(x, z, yaw, w / 2 - 0.5, -(d / 2 + 0.45) + 8);
    out.put("box", CRANE, jx, mast, jz, 0.8, 0.8, 22, yaw);
  }
}

/** How high a town's homes stand at their tallest (metres; a spire by as much again as its level's third). */
export function homesRiseTo(plan: TownPlan): number {
  let top = 0;
  for (const r of plan.runs) if (r[0]! <= 1) top = Math.max(top, r[5]!);
  return LEVELS[Math.min(top, TOP_LEVEL)]!.h * (top >= TOP_LEVEL ? 1.4 : 1);
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
  const { lots, states, looks } = scene,
    held = holdPlaces(scene.plan, lots);
  for (const p of which) {
    // (Its block yields a stronghold's ground: bridge/holdplaces.ts.)
    if (held.length && onHeld(held, lots.blocks.x[p >> 3]!, lots.blocks.z[p >> 3]!, HELD_PAD))
      continue;
    const what = states.what[p]!,
      x = lots.x[p]!,
      z = lots.z[p]!,
      yaw = lots.yaw[p]!,
      look = formLook(scene, p, states.design[p]!);
    if (!look) continue;
    if (what === LOT.home) {
      const level = states.level[p]!,
        g = progress(states.began[p]!, states.takes[p]!, t);
      if (g >= 1) {
        // Done: standing, or worn and being rebuilt.
        const w = homeWear(scene, p, t),
          now = formLook(scene, p, w.look) ?? look;
        if (w.at !== null && t < w.at + states.takes[p]!)
          rising(out, now, level, x, z, yaw, (t - w.at) / states.takes[p]!);
        else {
          rankedHome(scene, out, now, level, p, x, z, yaw, t);
          // (At the edge, what stands in its yard: view/townform.ts.)
          if (level <= 1 && !now.joined)
            edgeYard(scene, out, p, x, z, yaw, LEVELS[level]!.d, yardWalled);
          // (Shops on the ground floor of a tall home near the square: asked 2026-11-16.)
          if (shopsBelow(p, scene.plan.whole, level)) shopfront(out, level, x, z, yaw, p);
          // (Framed against the shaking, as many as its people have learned to frame: the lessons.)
          const braced = scene.plan.braced ?? 0;
          if (braced > 0 && (Math.imul(p + 1, 0x9e3779b1) >>> 0) / 4294967296 < braced)
            bracing(out, now, level, x, z, yaw);
        }
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

/** Awnings over a shop's windows, by the shop (a few colours, each its own). */
const AWNINGS: readonly Rgb[] = [
  [0.72, 0.22, 0.2],
  [0.2, 0.46, 0.3],
  [0.82, 0.62, 0.2],
  [0.24, 0.36, 0.62],
];
/** A shop on a tall home's ground floor: its lit window along its street front, an awning over it. */
function shopfront(
  out: TownParts,
  level: number,
  x: number,
  z: number,
  yaw: number,
  p: number,
): void {
  const L = LEVELS[level]!,
    [sx, sz] = at(x, z, yaw, 0, -L.d / 2 - 0.05),
    [ax, az] = at(x, z, yaw, 0, -L.d / 2 - 0.7);
  out.lamp(sx, 1.4, sz, L.w * 0.8, 1.8, 0.12, yaw);
  out.put("box", AWNINGS[p % AWNINGS.length]!, ax, 3.1, az, L.w * 0.86, 0.22, 1.4, yaw);
}

// —— Whose it is, seen (asked 2026-11-17: "can you make it so the leaders houses and the rich houses look notably different") ——
// The same parts as every home, scaled and painted: nothing new for the renderer to draw with.

const GARDEN: Rgb = [0.3, 0.56, 0.26],
  DRESSED: Rgb = [0.94, 0.92, 0.86],
  MUD: Rgb = [0.42, 0.34, 0.26],
  PATCH: Rgb = [0.5, 0.46, 0.4],
  SKIN_TONE: Rgb = [0.8, 0.62, 0.48],
  PAVED: Rgb = [0.8, 0.77, 0.7];

/** A plan's halls and marked homes by lot, and how far its homes are told apart by wealth. */
type Ranked = {
  readonly halls: Map<number, RankHall>;
  readonly marks: Map<number, RankMark>;
  readonly steep: number;
};
const RANKED = new WeakMap<TownPlan, Ranked>();
function rankedOf(plan: TownPlan): Ranked | null {
  const rank = plan.rank;
  if (!rank || plan.sealed) return null;
  let r = RANKED.get(plan);
  if (!r) {
    r = {
      halls: new Map((rank.halls ?? []).map((h) => [h.lot, h])),
      marks: new Map((rank.marks ?? []).map((m) => [m.lot, m])),
      steep: rank.gini >= RANK_SORTS ? rankSteep(rank.gini) : 0,
    };
    RANKED.set(plan, r);
  }
  return r;
}

/** A mast with a banner in a colour, a stripe of its arms across it. */
function banner(out: TownParts, x: number, z: number, yaw: number, high: number, c: Rgb): void {
  const wide = Math.max(1.6, high * 0.28);
  out.put("box", MAST, x, high / 2, z, 0.22, high, 0.22, 0);
  const [bx, bz] = at(x, z, yaw, wide / 2 + 0.1, 0);
  out.put("box", c, bx, high - wide * 0.4, bz, wide, wide * 0.7, 0.12, yaw);
  out.put("box", DRESSED, bx, high - wide * 0.4, bz, wide * 1.01, wide * 0.16, 0.14, yaw);
}

/** The well-off's roofs (slate), the stuffs their walls are of where the land builds in them, the poor's patched roofs, a tree. */
const SLATE: Rgb = [0.3, 0.36, 0.46],
  RICH_WALL: Readonly<Record<string, Rgb>> = {
    stone: [0.86, 0.84, 0.78],
    brick: [0.72, 0.4, 0.3],
    concrete: [0.84, 0.84, 0.82],
  },
  POOR_ROOFS: readonly Rgb[] = [
    [0.44, 0.38, 0.3],
    [0.36, 0.33, 0.3],
    [0.5, 0.42, 0.28],
  ],
  LEAF: Rgb = [0.16, 0.42, 0.2],
  TRUNK: Rgb = [0.36, 0.26, 0.16];

/** A garden's tree. */
function tree(out: TownParts, x: number, z: number, high: number): void {
  out.put("cyl", TRUNK, x, high * 0.2, z, 0.4, high * 0.4, 0.4, 0);
  out.put("cone", LEAF, x, high * 0.68, z, high * 0.5, high * 0.7, high * 0.5, 0);
}

/** A low wall about a yard of `w` by `d` about (x, z), open at its gate on the street side. */
function yardWall(
  out: TownParts,
  x: number,
  z: number,
  yaw: number,
  w: number,
  d: number,
  high: number,
  thick: number,
): void {
  for (const [u, v, sw, sd] of [
    [-w / 2, 0, thick, d],
    [w / 2, 0, thick, d],
    [0, d / 2, w, thick],
    [-w * 0.3, -d / 2, w * 0.4, thick],
    [w * 0.3, -d / 2, w * 0.4, thick],
  ] as const) {
    const [cx, cz] = at(x, z, yaw, u, v);
    out.put("box", PAVED, cx, high / 2, cz, sw, high, sd, yaw);
  }
}

/** Whether a lot's home stands whole now, of a level. */
function wholeHome(scene: TownScene, p: number, level: number, t: number): boolean {
  const s = scene.states;
  if (!(
    p >= 0 &&
    p < scene.plan.lots &&
    s.level[p] === level &&
    s.what[p] === LOT.home &&
    progress(s.began[p]!, s.takes[p]!, t) >= 1
  ))
    return false;
  // (Not being rebuilt: one rising on its lot would stand inside the house across both.)
  const w = homeWear(scene, p, t);
  return w.at === null || t >= w.at + s.takes[p]!;
}

/** Whether a lot is drawn afresh through the year (the scene's `active`), not once for it. */
function drawnAfresh(scene: TownScene, p: number): boolean {
  let a = scene.activeLots;
  if (!a) {
    a = scene.activeLots = new Uint8Array(scene.plan.lots);
    for (const q of scene.active) a[q] = 1;
  }
  return a[p] === 1;
}

/**
 * A home as who holds it shows (asked 2026-11-17, and again: "notably different"): a great house's hall in its walled yard
 * under its own roof and banner; a key figure's home under a roof and a pennant of its colour; and, where its land's wealth is
 * held unevenly, the well-off's a quarter to point at, slate-roofed houses of stone or brick (where the land builds in them)
 * across two lots where two stand side by side, walled, gardened and treed; the poor's another, low and small under patched
 * roofs of dull colours, a second hovel crowded into each yard. The more so the steeper the land: an even land's homes stand
 * all alike.
 */
/** Whether the home rankedHome drew last walled its own yard (a well-off home's; its plot is not hedged again: townform.ts). */
let yardWalled = false;
function rankedHome(
  scene: TownScene,
  out: TownParts,
  look: HouseLook,
  level: number,
  p: number,
  x: number,
  z: number,
  yaw: number,
  t: number,
): void {
  const r = rankedOf(scene.plan);
  yardWalled = false;
  if (!r || look.sealed || look.tent || level > 2) return home(out, look, level, x, z, yaw);
  const rank = scene.plan.rank!,
    hall = r.halls.get(p),
    seat = rank.seat,
    stuff = rank.stuff ? RICH_WALL[rank.stuff] : undefined;
  if (seat && seat.lot === p) {
    // The ruler's own house, where no hall of law stands yet: the greatest of the town's, the realm's guards at its gate.
    greatHall(out, look, x, z, yaw, seat.color, 0.3 + 0.2 * seat.grade, stuff);
    for (const side of [-1, 1]) {
      const [gx, gz] = at(x, z, yaw, side * 1.3, -LOT_D / 2 - 0.4);
      out.put("box", seat.color, gx, 0.85, gz, 0.5, 1.3, 0.4, yaw);
      out.put("box", SKIN_TONE, gx, 1.67, gz, 0.3, 0.32, 0.3, yaw);
    }
    return;
  }
  if (hall) return greatHall(out, look, x, z, yaw, hall.color, hall.share, stuff);
  const mark = r.marks.get(p),
    k = r.steep,
    wealth =
      k && !mark
        ? groundWealth(
            homeGround(scene.plan.seed, p, scene.plan.whole, level, rank.gini, rank.drives),
          )
        : 0,
    L = LEVELS[level]!,
    [w, d] = level <= 1 ? lowFoot(L, look) : [L.w, L.d],
    base = look.raised * 10;
  if (mark) {
    // A key figure's home: its roof and a tall pennant in their colour, a lamp by the door (seen from over the land too).
    const c = mark.color ?? seat?.color ?? GOLD,
      [mx, mz] = at(x, z, yaw, w / 2 + 0.4, -d / 2 - 0.5);
    home(out, { ...look, roof: c, height: look.height * 1.2 }, level, x, z, yaw);
    banner(out, mx, mz, yaw, 11, c);
    out.lamp(mx, 1.6, mz, 0.4, 0.4, 0.4, yaw);
    return;
  }
  if (wealth > 0) {
    const roof = mixed(look.roof, SLATE, Math.min(1, 0.45 + 0.7 * k)),
      wall = mixed(look.wall, stuff ?? DRESSED, stuff ? Math.min(1, 0.4 + 0.7 * k) : 0.35 * k),
      rich: HouseLook = { ...look, roof, wall, height: look.height * (1 + 0.45 * k) },
      // (Two side by side are one house across both lots: the even one draws it, the odd one its garden.)
      mate = level <= 1 && !look.round ? p ^ 1 : -1,
      pair =
        mate >= 0 &&
        // (Both drawn once for the year or both afresh through it, so neither is drawn as one while the other is not.)
        drawnAfresh(scene, mate) === drawnAfresh(scene, p) &&
        wholeHome(scene, mate, level, t) &&
        // (Nor one round: its own round house would stand inside the house across both.)
        !formLook(scene, mate, homeWear(scene, mate, t).look)?.round &&
        !r.halls.has(mate) &&
        !r.marks.has(mate) &&
        seat?.lot !== mate &&
        groundWealth(
          homeGround(scene.plan.seed, mate, scene.plan.whole, level, rank.gini, rank.drives),
        ) > 0 &&
        Math.abs(Math.hypot(scene.lots.x[mate]! - x, scene.lots.z[mate]! - z) - LOT_W) < 0.6;
    if (pair) {
      yardWalled = true;
      const mx = (x + scene.lots.x[mate]!) / 2,
        mz = (z + scene.lots.z[mate]!) / 2;
      if (p % 2 === 0) {
        const h = L.h * rich.height,
          ww = LOT_W * 2 - 4.5,
          dd = Math.min(LOT_D - 5, d * 1.15),
          flat = look.rise < 0.1,
          rh = flat ? 0.6 : Math.min(4.5, Math.max(1.6, look.rise * dd * 0.5));
        out.put("box", wall, mx, base + h / 2, mz, ww, h, dd, yaw);
        out.put(
          flat ? "box" : "gable",
          roof,
          mx,
          base + h + rh / 2,
          mz,
          ww * 1.06,
          rh,
          dd * 1.1,
          yaw,
        );
        for (const u of [-ww * 0.3, 0, ww * 0.3]) {
          const [lx, lz] = at(mx, mz, yaw, u, -dd / 2 - 0.06);
          if (u) out.lamp(lx, base + h * 0.55, lz, 1.1, Math.min(1.2, h * 0.3), 0.14, yaw);
          else out.put("box", DRESSED, lx, base + 1.2, lz, 2, 2.4, 0.7, yaw);
        }
        yardWall(out, mx, mz, yaw, LOT_W * 2 - 0.8, LOT_D - 0.8, 1.3, 0.4);
        const [gx, gz] = at(mx, mz, yaw, 0, LOT_D / 2 - 2.2);
        out.put("box", GARDEN, gx, 0.2, gz, LOT_W * 2 - 1.8, 0.4, 3, yaw);
      } else
        for (const u of [-LOT_W + 2, LOT_W - 2]) {
          const [tx, tz] = at(mx, mz, yaw, u, LOT_D / 2 - 2.2);
          tree(out, tx, tz, 4.5 + 2 * k);
        }
      return;
    }
    home(out, rich, level, x, z, yaw);
    // A garden and a tree behind, a dressed porch and a lamp at the door, a wall about its yard.
    const [gx, gz] = at(x, z, yaw, 0, d / 2 + 1.5),
      [tx, tz] = at(x, z, yaw, w * 0.3, d / 2 + 1.6),
      [px, pz] = at(x, z, yaw, 0, -d / 2 - 0.35);
    out.put("box", GARDEN, gx, 0.2, gz, Math.min(LOT_W - 0.6, w * 1.2), 0.4, 2.6, yaw);
    if (level <= 1) {
      tree(out, tx, tz, 3.6 + 2 * k);
      yardWall(out, x, z, yaw, LOT_W - 0.6, LOT_D - 0.8, 1.1, 0.35);
      yardWalled = true;
    }
    out.put("box", DRESSED, px, base + 1.2, pz, Math.min(2.2, w * 0.36), 2.4, 0.6, yaw);
    out.lamp(px, base + 2.1, pz, 0.5, 0.5, 0.7, yaw);
  } else if (wealth < 0) {
    // Low and small under a patched roof of a dull colour of its own, a second hovel crowded into its yard.
    const tone = POOR_ROOFS[(Math.imul(p + 7, 0x9e3779b1) >>> 28) % POOR_ROOFS.length]!,
      poor: HouseLook = {
        ...look,
        height: look.height * (1 - 0.3 * k),
        length: look.length * (1 - 0.22 * k),
        width: look.width * (1 - 0.22 * k),
        wall: mixed(look.wall, MUD, Math.min(1, 0.3 + 0.5 * k)),
        roof: mixed(look.roof, tone, Math.min(1, 0.45 + 0.6 * k)),
      },
      [qx, qz] = at(x, z, yaw, w * 0.12, 0.3);
    home(out, poor, level, x, z, yaw);
    if (level <= 1) {
      const top = base + L.h * poor.height + 1.1,
        [sx, sz] = at(x, z, yaw, ((p % 3) - 1) * 1.6, d / 2 + 2.2),
        other = POOR_ROOFS[(p + 1) % POOR_ROOFS.length]!;
      out.put("box", PATCH, qx, top, qz, 1.5, 0.16, 1.3, yaw + 0.3);
      out.put("box", poor.wall, sx, 0.9, sz, 3, 1.8, 2.6, yaw);
      out.put("box", other, sx, 1.9, sz, 3.4, 0.2, 3, yaw + 0.08);
    }
  } else home(out, look, level, x, z, yaw);
}

/**
 * A great hall on a lot: its body filling it, of stone or brick where its land builds in them, under a steep roof of its own
 * colour, a tower at its back, a high wall about its yard, a tall banner over its gate. As great as its share is (0 … 1).
 */
function greatHall(
  out: TownParts,
  look: HouseLook,
  x: number,
  z: number,
  yaw: number,
  color: Rgb,
  share: number,
  stuff: Rgb | undefined,
): void {
  const big = Math.min(1, share * 2),
    wall = stuff ?? mixed(look.wall, DRESSED, 0.5),
    w = LOT_W - 2,
    d = LOT_D - 5,
    h = 5.5 + 5 * big,
    rh = 3.2 + 1.2 * big;
  out.put("box", wall, x, h / 2, z, w, h, d, yaw);
  out.put("gable", color, x, h + rh / 2, z, w * 1.08, rh, d * 1.08, yaw);
  // Its tower at the back, the same colour on its cap.
  const [tx, tz] = at(x, z, yaw, -w * 0.28, d / 2 + 1.2),
    th = h + 5 + 5 * big;
  out.put("box", wall, tx, th / 2, tz, 2.8, th, 2.8, yaw);
  out.put("cone", color, tx, th + 1.5, tz, 3.6, 3, 3.6, yaw);
  yardWall(out, x, z, yaw, LOT_W - 0.3, LOT_D - 0.3, 2.4, 0.6);
  const [bx, bz] = at(x, z, yaw, w * 0.36, -LOT_D / 2 + 0.6),
    [lx, lz] = at(x, z, yaw, 0, -d / 2 - 0.1);
  banner(out, bx, bz, yaw, 15 + 5 * big, color);
  out.lamp(lx, 2.2, lz, w * 0.5, 1.4, 0.2, yaw);
  out.lamp(lx, h * 0.72, lz, w * 0.7, 1, 0.2, yaw);
}

/**
 * A realm's seat: the ruler's hall with its forecourt paved before it, the realm's banners at its door and its guards under
 * them; a palace (an older realm of more lands) with a keep over it, a great one with wings.
 */
function palace(
  out: TownParts,
  f: { x: number; z: number; yaw: number; w: number; d: number },
  seat: RankSeat,
): void {
  const put = (
    mesh: PartMesh,
    c: Rgb,
    u: number,
    y: number,
    v: number,
    sx: number,
    sy: number,
    sz: number,
  ) => {
    const [cx, cz] = at(f.x, f.z, f.yaw, u, v);
    out.put(mesh, c, cx, y, cz, sx, sy, sz, f.yaw);
  };
  // Its forecourt, and its steps.
  put("box", PAVED, 0, 0.32, f.d * 0.43, f.w * 0.98, 0.3, f.d * 0.14);
  put("box", DRESSED, 0, 0.6, f.d * 0.36, f.w * 0.5, 0.5, f.d * 0.06);
  for (const side of [-1, 1]) {
    const [bx, bz] = at(f.x, f.z, f.yaw, side * f.w * 0.44, f.d * 0.44);
    banner(out, bx, bz, f.yaw, 13 + 3 * seat.grade, seat.color);
    // A guard each side of its door: in the realm's colour, a spear in hand.
    put("box", seat.color, side * 1.6, 1.2, f.d * 0.4, 0.5, 1.3, 0.4);
    put("box", SKIN_TONE, side * 1.6, 2.02, f.d * 0.4, 0.3, 0.32, 0.3);
    put("box", MAST, side * 1.95, 1.5, f.d * 0.4, 0.07, 2.6, 0.07);
  }
  if (seat.grade >= 1) {
    // A keep over its roof, the realm's colour on its cap.
    put("box", DRESSED, 0, 9, -f.d * 0.22, f.w * 0.28, 18, f.d * 0.3);
    put("cone", seat.color, 0, 19.6, -f.d * 0.22, f.w * 0.34, 3.2, f.d * 0.36);
    put("box", GOLD, 0, 21.6, -f.d * 0.22, 0.5, 0.9, 0.5);
  }
  if (seat.grade >= 2)
    for (const side of [-1, 1]) {
      // Its wings, each a pavilion at an end of it, lamp-lit.
      put("box", DRESSED, side * f.w * 0.4, 6.5, -f.d * 0.05, f.w * 0.2, 13, f.d * 0.82);
      put("gable", seat.color, side * f.w * 0.4, 14.2, -f.d * 0.05, f.w * 0.22, 2.4, f.d * 0.86);
      const [lx, lz] = at(f.x, f.z, f.yaw, side * f.w * 0.4, f.d * 0.365);
      out.lamp(lx, 7, lz, f.w * 0.14, 1.2, 0.2, f.yaw);
    }
}

/** A home framed against the ground's shaking: its corner posts and a belt rail about its walls, in its roof's timber. */
function bracing(
  out: TownParts,
  look: HouseLook,
  level: number,
  x: number,
  z: number,
  yaw: number,
): void {
  if (look.sealed || look.round || look.tent || look.open || level > 1) return;
  const L = LEVELS[Math.max(0, Math.min(TOP_LEVEL, level))]!,
    h = L.h * look.height,
    [w, d] = lowFoot(L, look),
    y0 = look.raised * 10,
    post = 0.28;
  if (h <= 1) return;
  for (const [u, v] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const [px, pz] = at(x, z, yaw, (u * (w + post)) / 2, (v * (d + post)) / 2);
    out.put("box", look.roof, px, y0 + h / 2, pz, post, h, post, yaw);
  }
  // A rail at the height of a hand, about its front and back.
  for (const v of [-1, 1]) {
    const [px, pz] = at(x, z, yaw, 0, (v * (d + post)) / 2);
    out.put("box", look.roof, px, y0 + h * 0.55, pz, w + post, post, post, yaw);
  }
}

/**
 * One of a town's other buildings, whole: its shape, in footprint metres — a shrine's spire, a
 * granary's bins, a kiln's dome, a smithy's shed and stack, a market's stalls under awnings, a
 * mill's sails, a temple's tiers and gilded crown, a hall's columns, a school's bell, workshops,
 * docks, an academy's dome, baths, an observatory, a hospital's cross, a factory's saw-teeth and
 * chimneys, a station's long shed and clock, a power station's cooling tower, offices of glass.
 */
/** Boards across a building no one here can work now, on its street side and its back: seen from over the roofs (K1). */
function boardedOver(
  out: TownParts,
  f: { x: number; z: number; yaw: number; w: number; d: number },
): void {
  for (const side of [1, -1])
    for (const [tilt, y] of [
      [0.5, 2.2],
      [-0.5, 2.2],
      [0, 3.4],
    ] as const) {
      const [px, pz] = at(f.x, f.z, f.yaw, 0, (side * f.d) / 2 - side * 0.2);
      out.put("box", TIMBER, px, y, pz, Math.min(f.w * 0.8, 7), 0.35, 0.3, f.yaw + tilt * 0.3);
    }
}

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
    case "prison":
      // (A blind block within a wall, a watch tower at one corner.)
      put("box", [0.5, 0.5, 0.52], 0, 1.8, 0, w * 0.96, 3.6, d * 0.96);
      put("box", [0.42, 0.42, 0.45], 0, 4.5, 0, w * 0.7, 9, d * 0.6);
      put("box", [0.36, 0.36, 0.4], w * 0.42, 6, d * 0.42, 2.4, 12, 2.4);
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
): {
  kind: string;
  shut: boolean;
  f: { x: number; z: number; yaw: number; w: number; d: number };
}[] {
  const { plan, lots } = scene,
    out: {
      kind: string;
      shut: boolean;
      f: { x: number; z: number; yaw: number; w: number; d: number };
    }[] = [];
  for (const c of plan.civics) {
    if (c.at + c.lots > lots.x.length) continue;
    const m = civicMoments(c);
    if (m.done > t || (m.fell !== null && t >= m.fell)) continue;
    out.push({ kind: c.kind, shut: !!c.shut, f: footprint(lots, c.at, c.lots) });
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
  for (const { kind, f, shut } of standing(scene, t)) {
    // (A smithy no one knows how to work now is cold: K1.)
    if (shut) continue;
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
  prison: 12,
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
    civicShape(
      out,
      c.kind,
      f,
      g < 1 ? Math.max(0.05, g) : 1,
      c.shut ? (k) => darker(k, 0.72) : undefined,
      still,
    );
    if (c.shut && g >= 1) boardedOver(out, f);
    // (A realm's seat: its hall the ruler's. bridge/rank.ts)
    if (c.kind === "hall" && g >= 1 && !c.shut && plan.rank?.seat && !plan.sealed)
      palace(out, f, plan.rank.seat);
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

/** Where a site's flag stands, off its corner (metres). */
export function siteFlagAt(f: { x: number; z: number; yaw: number; w: number; d: number }): {
  x: number;
  z: number;
} {
  const [x, z] = at(f.x, f.z, f.yaw, -f.w / 2 - 1, -f.d / 2 - 1);
  return { x, z };
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
  const { x: px, z: pz } = siteFlagAt(f),
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
 * its road runs out — none where the town has grown over them, nor in its water, nor where a siege
 * has opened them (`open`: the breach's bearing and breadth, view/siegeworks.ts; its rubble lies there).
 */
export function townWalls(
  scene: TownScene,
  t: number,
  out: TownParts,
  open: { readonly mid: number; readonly wide: number } | null = null,
): void {
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
    // (Open in a siege's breach: its rubble lies where it stood.)
    if (
      open &&
      !l.gate &&
      Math.abs(
        Math.atan2(
          Math.sin(Math.atan2(l.z, l.x) - open.mid),
          Math.cos(Math.atan2(l.z, l.x) - open.mid),
        ),
      ) <
        open.wide / 2 + l.len / 2 / Math.max(20, Math.hypot(l.x, l.z))
    )
      continue;
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
  | { readonly kind: "hold"; readonly k: number }
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
  // (A stronghold or seat: its page says whose, why and of what: bridge/strongholds.ts.)
  for (const h of holdPlaces(plan, lots))
    if (Math.hypot(h.x - x, h.z - z) < h.r) return { kind: "hold", k: h.hold.k };
  for (const c of plan.civics) {
    if (c.at + c.lots > lots.x.length) continue;
    const m = civicMoments(c);
    if (t < m.began || (m.fell !== null && t >= m.fell + 60 * YEAR_S)) continue;
    if (inside(footprint(lots, c.at, c.lots), x, z, 1))
      return { kind: "civic", at: c.truly ?? c.at, start: c.start };
  }
  const w = plan.walls;
  if (w && scene.walls && t >= (w.asked ? w.asked.began : (w.start + 1) * YEAR_S)) {
    // (Those asked for go up length by length: as far round as they've come, and the one going up.)
    const up = w.asked ? askedGrown(w.asked, t) * scene.walls.lengths.length : Infinity;
    let k = -1;
    for (const l of scene.walls.lengths) {
      k++;
      if (k > up) break;
      // (Thin and tall: a finger on its face comes down on the ground behind it.)
      if (
        inside(
          { x: l.x, z: l.z, yaw: l.yaw, w: l.gate ? GATE_TOWER : l.len, d: WALL_THICK },
          x,
          z,
          4,
        )
      )
        return { kind: "walls" };
    }
  }
  const p = lotNear(scene, x, z, LOT_W * 0.75);
  return p >= 0 ? { kind: "lot", lot: p } : null;
}

/** How far a point stands from a footprint turned by its yaw (0: within it). */
function offFootprint(
  f: { x: number; z: number; yaw: number; w: number; d: number },
  x: number,
  z: number,
): number {
  const dx = x - f.x,
    dz = z - f.z,
    c = Math.cos(f.yaw),
    s = Math.sin(f.yaw);
  return Math.hypot(
    Math.max(0, Math.abs(dx * c - dz * s) - f.w / 2),
    Math.max(0, Math.abs(dx * s + dz * c) - f.d / 2),
  );
}

/**
 * The building of a town a point lies within at moment t (metres from its middle), or stands before (within `pad` metres of
 * it: those at its door, in their rows before it or at work on it, are as hidden by it from its far side as one inside): one of
 * its buildings begun and not fallen, or the home on a lot; the nearest. Its middle, its turn (its front on the street it faces)
 * and its breadth along the street and depth. Null on open ground, the square, a street's middle or past its edge: for the eye
 * set on one who is there (view/streetfight.ts goToFrame).
 */
export function townBuildingAt(
  scene: TownScene,
  x: number,
  z: number,
  t: number,
  pad = 6,
): { x: number; z: number; yaw: number; w: number; d: number } | null {
  const { plan, lots, states } = scene;
  let best: { x: number; z: number; yaw: number; w: number; d: number } | null = null,
    near = pad;
  for (const c of plan.civics) {
    if (c.at + c.lots > lots.x.length) continue;
    const m = civicMoments(c);
    if (t < m.began || (m.fell !== null && t >= m.fell)) continue;
    const f = footprint(lots, c.at, c.lots),
      off = offFootprint(f, x, z);
    if (off < near) {
      near = off;
      best = f;
    }
  }
  const reach = (LOT_D + pad) ** 2;
  for (let p = 0; p < plan.lots; p++) {
    const dx = lots.x[p]! - x,
      dz = lots.z[p]! - z;
    if (dx * dx + dz * dz >= reach || states.what[p] !== LOT.home || t < states.began[p]!) continue;
    const f = { x: lots.x[p]!, z: lots.z[p]!, yaw: lots.yaw[p]!, w: LOT_W, d: LOT_D },
      off = offFootprint(f, x, z);
    if (off < near) {
      near = off;
      best = f;
    }
  }
  return best;
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
