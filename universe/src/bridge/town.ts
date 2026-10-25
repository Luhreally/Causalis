// A town's plan as the view draws it (Phase 23 M149, asked for 2026-10-24: "i cant see the
// cities form and evolve and get that type of detail i got from the og causalisis"): its lots
// laid out about its square in the order it takes them — in blocks of eight, two rows of four
// back to back, streets between the blocks — on a grid, in rings about its heart, or in fingers
// along winding lanes, as its people lay out their towns; and what stands on each lot at a
// moment, read from its fabric's runs: open ground, a home rising (its footing, its frame, its
// walls, its roof) or standing at its level in the design it was raised in, the ruin of one
// fallen or burnt; its other buildings rising, standing, fallen; its walls. Shared by the host
// (its people's homes, where its fields begin) and the view (what is drawn).
import { MONTH, YEAR, mix } from "../kernel/index.ts";
import type { GenesisPlan, MeadowPlan } from "./genesis.ts";

/** A lot: so many metres along its street, so many deep. */
export const LOT_W = 9;
export const LOT_D = 14;
/** The streets between blocks, and the square at a town's heart (its radius). */
export const STREET = 8;
export const SQUARE = 20;
/** A block: two rows of four lots, back to back. */
export const BLOCK_W = 4 * LOT_W;
export const BLOCK_D = 2 * LOT_D;
export const BLOCK_LOTS = 8;
/** No part of a block stands further than this from its middle (half its diagonal). */
export const BLOCK_REACH = Math.hypot(BLOCK_W / 2, BLOCK_D / 2);
/** How far a town's blocks keep from its water's edge (metres): a shore to walk along. */
export const SHORE = 10;

export type TownFamily = "lanes" | "grid" | "rings";

/** A town's water — a lake, the sea's edge — beside it: its middle and reach (metres from its square). */
export type TownWater = { readonly x: number; readonly z: number; readonly r: number };

/**
 * What struck a town these two years past (Phase 42 M201): fire the god sent on it, the ground
 * shaken or fire fallen from the sky on its land — when; the lot of its plan a fire fell on (-1:
 * it took the town from its heart); and how many of its homes it brought down (-1: not told).
 */
export type TownStrike = {
  readonly kind: "fire" | "quake" | "meteor";
  readonly at: number;
  readonly lot: number;
  readonly homes: number;
  readonly event: string;
  /** How many of its people it killed (Phase 43 M205: buried two days after; absent: none told). */
  readonly dead?: number;
};

/** One of a town's buildings besides its homes, as its fabric keeps it. */
export type TownCivic = {
  readonly kind: string;
  readonly at: number;
  readonly lots: number;
  readonly start: number;
  readonly end: number;
  readonly fell: number | null;
};

/** How a design builds a home: its walls, its roof and its shape (realization ids), its roof's pitch. */
export type TownDesign = {
  readonly since: number;
  readonly walls: string;
  readonly roof: string;
  readonly form: string;
  readonly pitch: number;
};

export type TownPlan = {
  readonly family: TownFamily;
  /** For the plan's own turns and wanderings. */
  readonly seed: number;
  /** The heading of its streets (a grid's runs along its road). */
  readonly axis: number;
  /** Lots of its plan drawn: those ever taken, out to as many as the eye is given. */
  readonly lots: number;
  /** Lots of its plan ever taken (more than are drawn in a great city: its sprawl, seen far off). */
  readonly whole: number;
  /**
   * Its runs: [what, first lot, end lot, first year, last year, level, design] — what: 0 homes
   * built, 1 rebuilt higher, 2 fallen, 3 razed, 4 cleared for a building; design: the year the
   * design was realized (-1 before any). No two share a lot.
   */
  readonly runs: readonly (readonly number[])[];
  readonly civics: readonly TownCivic[];
  readonly walls: { readonly start: number; readonly end: number; readonly reach: number } | null;
  /** Months to raise a home of each level (hut, house, townhouse, tenement, block, high-rise). */
  readonly months: readonly number[];
  /** The designs its homes stand in, by the year each was realized. */
  readonly designs: readonly TownDesign[];
  /** Whether its streets are paved. */
  readonly paved: boolean;
  /** Its water: its blocks are laid about it, never in it (null: none beside it). */
  readonly water: TownWater | null;
  /** The year whose building it shows last (its runs' and buildings' latest). */
  readonly year: number;
  /** What struck it these two years past, oldest first (Phase 42 M201; absent: nothing). */
  readonly struck?: readonly TownStrike[];
};

/** A small hash of whole numbers, for the plan's wanderings (not history's). */
function hash(a: number, b: number, c = 0): number {
  return (mix(mix(mix(0x2545f491, a), b), c) >>> 0) / 4294967296;
}

/** The greatest common divisor, for a step that visits every place of a ring once. */
function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** A step about a ring of n places that visits each once, its turns spread (near the golden share). */
function spread(n: number): number {
  let step = Math.max(1, Math.round(n * 0.382));
  while (gcd(step, n) !== 1) step++;
  return step;
}

/** The turn of a block whose long side runs along (dx, dz). */
const heading = (dx: number, dz: number) => Math.atan2(-dz, dx);

/** Where a town's blocks stand, in the order it takes them: their middles and turns. */
export type TownBlocks = {
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly yaw: Float32Array;
};

/**
 * The first `count` blocks of a town's plan (each the same whatever the count: a block never
 * moves), none laid in its water: the town grows round it, a shore kept along it.
 */
export function townBlocks(
  family: TownFamily,
  seed: number,
  axis: number,
  count: number,
  water: TownWater | null = null,
): TownBlocks {
  const x = new Float32Array(count),
    z = new Float32Array(count),
    yaw = new Float32Array(count),
    ca = Math.cos(axis),
    sa = Math.sin(axis);
  let b = 0;
  const put = (bx: number, bz: number, turn: number) => {
    if (water && Math.hypot(bx - water.x, bz - water.z) < water.r + SHORE + BLOCK_REACH) return;
    x[b] = bx;
    z[b] = bz;
    yaw[b++] = turn;
  };
  for (let ring = 1; b < count; ring++) {
    if (family === "grid") {
      // Ring r of the grid about the square: 8r cells, taken in turns spread about it.
      const n = 8 * ring,
        step = spread(n),
        phase = Math.floor(hash(seed, ring) * n);
      for (let k = 0; k < n && b < count; k++) {
        const idx = (phase + k * step) % n,
          side = Math.floor(idx / (2 * ring)),
          t = idx % (2 * ring),
          [i, j] =
            side === 0
              ? [ring, -ring + t]
              : side === 1
                ? [ring - t, ring]
                : side === 2
                  ? [-ring, ring - t]
                  : [-ring + t, -ring],
          u = i * (BLOCK_W + STREET),
          v = j * (BLOCK_D + STREET);
        put(u * ca + v * sa, -u * sa + v * ca, axis);
      }
    } else if (family === "rings") {
      // Ring r about the heart: as many blocks as its round holds, their long sides along it.
      const radius = SQUARE + STREET + BLOCK_D / 2 + (ring - 1) * (BLOCK_D + STREET),
        n = Math.max(4, Math.floor((2 * Math.PI * radius) / (BLOCK_W + STREET))),
        step = spread(n),
        phase = hash(seed, ring);
      for (let k = 0; k < n && b < count; k++) {
        const a = axis + ((phase + ((k * step) % n)) / n) * 2 * Math.PI;
        put(radius * Math.cos(a), radius * Math.sin(a), heading(-Math.sin(a), Math.cos(a)));
      }
    } else {
      // Fingers along lanes winding out from the square: each block's long side down its lane,
      // a little askew, the lanes between them bending as they go.
      const reach = SQUARE + STREET + BLOCK_W / 2 + (ring - 1) * (BLOCK_W + STREET + 2),
        n = Math.max(5, Math.floor((2 * Math.PI * reach) / (BLOCK_D + STREET + 7))),
        step = spread(n),
        phase = hash(seed, ring),
        bend = (hash(seed, 7) - 0.5) * 0.5;
      for (let k = 0; k < n && b < count; k++) {
        const slot = (k * step) % n,
          a =
            axis +
            ((phase + slot + (hash(seed, ring, slot) - 0.5) * 0.35) / n) * 2 * Math.PI +
            bend * (ring - 1) * 0.12,
          r = reach + (hash(seed, ring, slot + 1000) - 0.5) * 6,
          turn = a + (hash(seed, ring, slot + 2000) - 0.5) * 0.3;
        put(r * Math.cos(a), r * Math.sin(a), heading(Math.cos(turn), Math.sin(turn)));
      }
    }
  }
  return { x, z, yaw };
}

/** Where a town's lots stand (metres from its square's middle) and how each is turned. */
export type TownLots = {
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly yaw: Float32Array;
  readonly blocks: TownBlocks;
};

/**
 * The first `count` lots of a town's plan: lot j of a block, its column j mod 4, its row j div 4
 * (none in its water).
 */
export function townLots(
  family: TownFamily,
  seed: number,
  axis: number,
  count: number,
  water: TownWater | null = null,
): TownLots {
  const blocks = townBlocks(family, seed, axis, Math.ceil(count / BLOCK_LOTS), water),
    x = new Float32Array(count),
    z = new Float32Array(count),
    yaw = new Float32Array(count);
  for (let p = 0; p < count; p++) {
    const b = Math.floor(p / BLOCK_LOTS),
      j = p % BLOCK_LOTS,
      u = ((j % 4) - 1.5) * LOT_W,
      v = (Math.floor(j / 4) - 0.5) * LOT_D,
      t = blocks.yaw[b]!,
      c = Math.cos(t),
      s = Math.sin(t);
    x[p] = blocks.x[b]! + u * c + v * s;
    z[p] = blocks.z[b]! - u * s + v * c;
    // (The back row faces the other street.)
    yaw[p] = j < 4 ? t : t + Math.PI;
  }
  return { x, z, yaw, blocks };
}

/**
 * The footprint of lots [at, at + lots) of a block-aligned building: its middle, its turn, and
 * its length along the street and depth (a lot; a half row; a row; the whole block).
 */
export function footprint(
  lots: TownLots,
  at: number,
  count: number,
): { x: number; z: number; yaw: number; w: number; d: number } {
  const b = Math.floor(at / BLOCK_LOTS),
    j = at % BLOCK_LOTS,
    rows = count > 4 ? 2 : 1,
    cols = Math.min(4, count),
    u = ((j % 4) + (cols - 1) / 2 - 1.5) * LOT_W,
    v = rows === 2 ? 0 : (Math.floor(j / 4) - 0.5) * LOT_D,
    t = lots.blocks.yaw[b] ?? 0,
    c = Math.cos(t),
    s = Math.sin(t),
    bx = lots.blocks.x[b] ?? 0,
    bz = lots.blocks.z[b] ?? 0;
  return {
    x: bx + u * c + v * s,
    z: bz - u * s + v * c,
    yaw: rows === 2 || j < 4 ? t : t + Math.PI,
    w: cols * LOT_W,
    d: rows * LOT_D,
  };
}

/** How far out a town's lots reach (to their far edge). */
export function townReach(lots: TownLots, count = lots.x.length): number {
  let r = SQUARE;
  for (let p = 0; p < count; p++) r = Math.max(r, Math.hypot(lots.x[p]!, lots.z[p]!) + LOT_D);
  return r;
}

/** What a lot holds. */
export const LOT = {
  /** Never taken, or open ground (cleared, weathered away). */
  open: 0,
  /** A home, rising or standing. */
  home: 1,
  /** A home let fall: empty, going to ruin. */
  fallen: 2,
  /** A home burnt or shaken down. */
  razed: 3,
} as const;

/**
 * What its runs say of each lot: what it holds, a home's level and design (an index into the
 * plan's designs), and when the change began and how long it takes (moments, seconds; a fall or
 * a burning takes none); and whether it is rebuilt — 1 higher (it stood a step lower before: the
 * runs keep no more), 2 worn and rebuilt in its place, as it stood.
 */
export type LotStates = {
  readonly what: Int8Array;
  readonly level: Int8Array;
  readonly design: Int16Array;
  readonly began: Float64Array;
  readonly takes: Float64Array;
  readonly raised: Uint8Array;
  /**
   * Of a home razed by what struck the town (Phase 42 M201): which of its strikes (-1: none — let
   * fall, or razed by no act it knows); `began` is then the moment it caught (or fell), and its
   * level and design those of the home that stood (as its nearest neighbour standing).
   */
  readonly struck: Int16Array;
  /** Whether it burned (a quake shakes most down unburnt). */
  readonly burns: Uint8Array;
};

/**
 * How what struck a town spreads (seconds): a fire from the lot it fell on to the farthest of its
 * homes in an hour and a half at most, a house to every three quarters of a minute; fire from the
 * sky over its homes in two minutes; a quake's homes falling within its forty seconds, one in four
 * catching fire from its hearths a few minutes after.
 */
export const SPREAD = { fire: 45, fireAll: 5400, meteorAll: 120, quakeAll: 40, quakeBurns: 0.25 };

/**
 * The moment the change of lot p in a run began: a year's work done through the year after it
 * (the fabric is reckoned at the year's turn), lot by lot through the run; a run of several
 * years spread through them.
 */
function beganAt(run: readonly number[], p: number): number {
  const [what, from, to, start, end] = run as [number, number, number, number, number],
    n = Math.max(1, to - from),
    i = what === 2 ? to - 1 - p : p - from,
    share = (i + 0.5) / n;
  return (start + 1) * YEAR + share * ((end - start) * YEAR + 0.8 * YEAR);
}

/** What stands on each of a town's lots, from its plan's runs. */
export function lotStates(plan: TownPlan): LotStates {
  const n = plan.lots,
    what = new Int8Array(n),
    level = new Int8Array(n).fill(-1),
    design = new Int16Array(n),
    began = new Float64Array(n),
    takes = new Float64Array(n),
    raised = new Uint8Array(n),
    designOf = new Map(plan.designs.map((d, i) => [d.since, i]));
  for (const run of plan.runs) {
    const [kind, from, to, , , lv, since] = run as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    for (let p = Math.max(0, from); p < Math.min(to, n); p++) {
      began[p] = beganAt(run, p);
      if (kind === 0 || kind === 1) {
        what[p] = LOT.home;
        level[p] = lv;
        design[p] = designOf.get(since) ?? 0;
        takes[p] = (plan.months[lv] ?? 3) * MONTH;
        raised[p] = kind === 1 ? 1 : 0;
      } else {
        what[p] = kind === 2 ? LOT.fallen : kind === 3 ? LOT.razed : LOT.open;
        takes[p] = 0;
      }
    }
  }
  // (A run of homes long built may pass over a standing building's lots: they are the building's.)
  for (const c of plan.civics) {
    if (c.fell !== null) continue;
    for (let p = Math.max(0, c.at); p < Math.min(c.at + c.lots, n); p++) {
      what[p] = LOT.open;
      level[p] = -1;
      takes[p] = 0;
      raised[p] = 0;
    }
  }
  const struck = new Int16Array(n).fill(-1),
    burns = new Uint8Array(n);
  strikes(plan, what, level, design, began, struck, burns);
  return { what, level, design, began, takes, raised, struck, burns };
}

/**
 * Each home razed in a year something struck the town (Phase 42 M201) given to its strike, each
 * strike's in the order it spread through them: when each caught or fell, whether it burned, and
 * what stood. The strikes of a year take theirs in the order they fell, each as many as it brought
 * down, as the fabric chose them — those nearest the lot a fire fell on, else from the heart out —
 * of those its earlier ones left (a strike that told no count: those lying nearer it than any other).
 */
function strikes(
  plan: TownPlan,
  what: Int8Array,
  level: Int8Array,
  design: Int16Array,
  began: Float64Array,
  struck: Int16Array,
  burns: Uint8Array,
): void {
  const list = plan.struck ?? [],
    n = what.length;
  if (!list.length) return;
  const theirs: number[][] = list.map(() => []),
    // (The razed lots of each year a strike fell in.)
    razed = new Map<number, Set<number>>();
  for (const run of plan.runs) {
    const [kind, lo, hi, start, end] = run as [number, number, number, number, number];
    if (kind !== 3) continue;
    for (let p = Math.max(0, lo); p < Math.min(hi, n); p++) {
      if (what[p] !== LOT.razed) continue;
      for (const k of list) {
        const year = Math.floor(k.at / YEAR);
        if (year < start || year > end) continue;
        let of = razed.get(year);
        if (!of) razed.set(year, (of = new Set()));
        of.add(p);
      }
    }
  }
  const order = list.map((_, i) => i).sort((a, b) => list[a]!.at - list[b]!.at || a - b),
    near = (k: TownStrike) => (a: number, b: number) =>
      Math.abs(a - Math.max(0, k.lot)) - Math.abs(b - Math.max(0, k.lot)) || a - b;
  for (const i of order) {
    const k = list[i]!,
      left = razed.get(Math.floor(k.at / YEAR));
    if (!left?.size || k.homes < 0) continue;
    const mine = [...left].sort(near(k)).slice(0, k.homes);
    for (const p of mine) left.delete(p);
    theirs[i] = mine;
  }
  // (Those a strike that told no count has: the rest of its year's, each to the nearest of them.)
  for (const [year, left] of razed)
    for (const p of left) {
      let best = -1,
        far = Infinity;
      list.forEach((k, i) => {
        if (k.homes >= 0 || Math.floor(k.at / YEAR) !== year) return;
        const d = Math.abs(p - Math.max(0, k.lot));
        if (d < far) {
          far = d;
          best = i;
        }
      });
      if (best >= 0) theirs[best]!.push(p);
    }
  theirs.forEach((lots, i) => {
    const k = list[i]!,
      from = Math.max(0, k.lot);
    lots.sort((a, b) => Math.abs(a - from) - Math.abs(b - from) || a - b);
    const step =
      k.kind === "fire"
        ? Math.min(SPREAD.fire, SPREAD.fireAll / Math.max(1, lots.length))
        : (k.kind === "meteor" ? SPREAD.meteorAll : SPREAD.quakeAll) / Math.max(1, lots.length);
    lots.forEach((p, j) => {
      struck[p] = i;
      const burnt = k.kind !== "quake" || hash(p, Math.round(k.at), 7) < SPREAD.quakeBurns;
      burns[p] = burnt ? 1 : 0;
      began[p] = k.at + (j + hash(p, Math.round(k.at), 3)) * step;
      // (What stood there: as the nearest home standing beside it.)
      level[p] = 1;
      for (let d = 1; d <= 16; d++) {
        const q = what[p - d] === LOT.home ? p - d : what[p + d] === LOT.home ? p + d : -1;
        if (q < 0) continue;
        level[p] = level[q]!;
        design[p] = design[q]!;
        break;
      }
    });
  });
}

/** How far a change begun at `began`, taking `takes`, has come at moment t: 0 not begun, 1 done. */
export function progress(began: number, takes: number, t: number): number {
  if (t <= began) return 0;
  return takes <= 0 ? 1 : Math.min(1, (t - began) / takes);
}

/** The moments a building of a town was begun, done and fell (null: it stands). */
export function civicMoments(c: TownCivic): { began: number; done: number; fell: number | null } {
  const began = (c.start + 1) * YEAR + hash(c.at, c.start) * 0.3 * YEAR;
  return {
    began,
    done: Math.max(began + MONTH, (c.end + 1) * YEAR),
    fell: c.fell === null ? null : (c.fell + 1) * YEAR,
  };
}

/**
 * Which of a town's drawn blocks hold anything (1) — a home rising, standing or fallen, a
 * building or its ruin; the rest are open ground, walked across.
 */
export function blocksHeld(plan: TownPlan, states: LotStates): Uint8Array {
  const held = new Uint8Array(Math.ceil(plan.lots / BLOCK_LOTS));
  for (let p = 0; p < plan.lots; p++)
    if (states.what[p] !== LOT.open) held[Math.floor(p / BLOCK_LOTS)] = 1;
  for (const c of plan.civics) if (c.at < plan.lots) held[Math.floor(c.at / BLOCK_LOTS)] = 1;
  return held;
}

/** A length of a town's walls: its place about the ring, its middle, its turn (its length along it), how long. */
export type WallLength = {
  readonly k: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly len: number;
  /** A gate: a tower between two ways through, where the road runs out. */
  readonly gate: boolean;
  /** A round tower at its middle (every fourth length). */
  readonly tower: boolean;
};

/** A wall's thickness, a gate's tower's side, a round tower's breadth (metres). */
export const WALL_THICK = 2.4;
export const GATE_TOWER = 4;
export const WALL_TOWER = 5;

/**
 * A town's walls as they stand (null: it has none): a ring about the lots walled, a length every
 * twenty-odd metres, a gate where its road runs out both ways (at the length standing nearest), a
 * round tower every fourth length — none in its water, none where the town has since grown over
 * their line, and none at all once it has grown over a third of it (pulled down, a ring road
 * where they stood).
 */
export function wallRing(
  plan: TownPlan,
  lots: TownLots,
  held: Uint8Array,
): { r: number; n: number; lengths: WallLength[] } | null {
  const w = plan.walls;
  if (!w) return null;
  const reach = Math.min(w.reach, lots.x.length);
  let r = SQUARE + 10;
  for (let p = 0; p < reach; p++) r = Math.max(r, Math.hypot(lots.x[p]!, lots.z[p]!) + LOT_D);
  r += 8;
  const n = Math.max(16, Math.round((2 * Math.PI * r) / 22)),
    len = (2 * Math.PI * r) / n + 0.8,
    gate = (((plan.axis % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / ((2 * Math.PI) / n),
    bx = lots.blocks.x,
    bz = lots.blocks.z,
    near: number[] = [];
  // (The blocks held about its line, which it may have been pulled down for.)
  for (let b = 0; b < Math.min(held.length, bx.length); b++)
    if (held[b] && Math.abs(Math.hypot(bx[b]!, bz[b]!) - r) < BLOCK_REACH + len) near.push(b);
  const built = (x: number, z: number) =>
    near.some((b) => {
      const dx = x - bx[b]!,
        dz = z - bz[b]!,
        t = lots.blocks.yaw[b]!,
        c = Math.cos(t),
        s = Math.sin(t);
      // (In the block's own frame: along its street, and across.)
      return (
        Math.abs(dx * c - dz * s) < BLOCK_W / 2 + 2 && Math.abs(dx * s + dz * c) < BLOCK_D / 2 + 2
      );
    });
  const standing: { k: number; x: number; z: number; yaw: number }[] = [];
  let dry = 0,
    over = 0;
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) / n) * 2 * Math.PI,
      x = r * Math.cos(a),
      z = r * Math.sin(a),
      ux = -Math.sin(a),
      uz = Math.cos(a);
    if (plan.water && Math.hypot(x - plan.water.x, z - plan.water.z) < plan.water.r + 2) continue;
    dry++;
    let built_ = false;
    for (let f = -0.5; f <= 0.5 && !built_; f += 0.25)
      built_ = built(x + ux * f * len, z + uz * f * len);
    if (built_) over++;
    else standing.push({ k, x, z, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) });
  }
  if (over * 3 > dry) return { r, n, lengths: [] };
  // A gate each way the road runs out: at the length standing nearest it.
  const gateNear = (at: number) => {
    let best = -1,
      off = 4;
    for (const l of standing) {
      const d = Math.abs(l.k + 0.5 - at),
        o = Math.min(d, n - d);
      if (o < off) {
        off = o;
        best = l.k;
      }
    }
    return best;
  };
  const gates = new Set([gateNear(gate), gateNear((gate + n / 2) % n)]);
  return {
    r,
    n,
    lengths: standing.map((l) => ({ ...l, len, gate: gates.has(l.k), tower: l.k % 4 === 0 })),
  };
}

/**
 * A town of a land as the land draws it (Phase 25 M150): where it stands, how many it holds, and
 * its fabric's plan (null: none yet) — `key` changes when the plan does.
 */
export type LandTown = {
  readonly ref: string;
  readonly name: string;
  readonly tile: number;
  readonly population: number;
  readonly founded: number;
  readonly city: boolean;
  /** Whether its land sows (its fields about it). */
  readonly fields: boolean;
  readonly plan: TownPlan | null;
  readonly key: number;
};

/**
 * A road of a land (tiles of its map): between two of its towns, or out of it toward another
 * land (`b` null, `toward` that land's greatest town); trodden from `since`, paved from `paved`,
 * railed from `rails` (years; null: not yet).
 */
export type LandRoad = {
  readonly from: number;
  readonly to: number;
  readonly a: string;
  readonly b: string | null;
  readonly toward: string | null;
  readonly since: number;
  readonly paved: number | null;
  readonly rails: number | null;
  /** How busy it is: the carts (or wagons, trucks) on it at once (Phase 26 M153). */
  readonly traffic: number;
};

/**
 * A sea lane of a land (Phase 26 M153): from the town its ships put out from, out across the sea
 * toward a land its goods have reached by ship (`dx`, `dz` the way, region units: x east, z
 * south), from the year they first went; and how many ships are on it at once.
 */
export type LandLane = {
  readonly from: number;
  readonly a: string;
  readonly toward: string | null;
  readonly dx: number;
  readonly dz: number;
  readonly since: number;
  readonly ships: number;
};

/** How far a land has come, for what its people carry their goods in. */
export type LandEra = "forage" | "farm" | "metal" | "industry" | "modern";

/**
 * A camp of a land's bands (Phase 28 M159): of its people who forage or herd and so live in no
 * village, those ranging about one of the land's good sites — where its villages are founded once
 * they come to farm — camped this season on a tile near it.
 */
export type LandCamp = {
  /** Its number among the land's camps (its range: the same from season to season). */
  readonly id: number;
  /** Where it is camped this season (a tile of the land's map), and its range's middle. */
  readonly tile: number;
  readonly home: number;
  /** How many camp there, in how many bands; whether they herd (their flocks about them). */
  readonly people: number;
  readonly bands: number;
  readonly herds: boolean;
};

/** A land's towns and roads, as the land draws them at moment `t`; and its bands' camps. */
export type LandPlan = {
  readonly t: number;
  readonly era: LandEra;
  readonly towns: readonly LandTown[];
  readonly roads: readonly LandRoad[];
  readonly lanes: readonly LandLane[];
  readonly camps: readonly LandCamp[];
};

/**
 * A camp of a land's bands seen near (Phase 29 M160): what one of its bands lives its day among —
 * the land's own beasts and grasses now (as a meadow is made from), the people's figure, how many
 * the band is, the world's hour.
 */
export type CampNear = {
  readonly cell: number;
  readonly camp: LandCamp;
  /** The land's name, and its people's as the world calls them. */
  readonly land: string;
  readonly people: string;
  readonly figure: NonNullable<GenesisPlan["people"]>["figure"] | null;
  /** The land's living lineages now, all of its one age (the present). */
  readonly plan: MeadowPlan;
  /** Their flocks, when they herd (indices among the plan's lineages). */
  readonly flocks: readonly number[];
  /** How many the band seen is, and the hour of the world's day (0 … 24). */
  readonly size: number;
  /** Each of them by name, in the land's tongue (Phase 29 M161). */
  readonly names: readonly string[];
  readonly hour: number;
};
