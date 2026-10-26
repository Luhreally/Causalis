// The town's day as lived (Phase 39 M198, asked for 2026-10-25: "bringing back og causlisis like
// town/country game play and sim like the depth the og game had ... and just actions of stuff"):
// what a town keeps in store and where — its granary, its yard of timber, stone and ore, its
// smithy — the buildings going up on a day, and each of its people's work for that day as its
// needs set it. Classic's heart (need → task → walk → act on matter → stores and buildings
// changed) played over the town's own stores and building as history keeps them: a shadow window
// (docs/architecture §9), its stores copied from history each day and nothing flowing back. The
// harvest brings sheaves to the granary and its seed goes out to the fields; builders carry beams
// and stone from the yard to every home and building rising, and fellers and quarrymen fill the
// yard again; miners bring up ore and smiths forge it; each household fetches its bread; in a
// lean year the granary has nothing to give, and the idle go out to the wild for what it gives.
import { finish, hashString, mix } from "../kernel/index.ts";
import {
  LOT,
  LOT_D,
  civicMoments,
  footprint,
  type StoreBook,
  type StoreKind,
  type TownLots,
  type VillagePlan,
} from "../bridge/index.ts";
import { CIVIC_INDEX, HOME_LEVELS, OCC, civic, type CivicKind } from "../rules/index.ts";
import { clearAt, type Ground } from "./ground.ts";
import { streetDoor } from "./streets.ts";
import { homeWear, townScene, type TownScene } from "./town.ts";
import { HARVEST, SOWING, WINTER, restDay } from "./seasons.ts";
import { REAPERS_AT, fieldsNow, pulledOn, reapingOn, stookedOn, wateredOn } from "./fields.ts";
import { HUNT_PARTY, huntOn } from "./hunt.ts";
import { traderSeat, tripOn } from "./trade.ts";
import { furnaceOf } from "./work.ts";

const DAY = 86_400,
  YEAR = 365 * DAY;

type Point = { readonly x: number; readonly z: number };

const unit = (h: number) => (h >>> 0) / 4294967296;

/** A keyed stream for one person on one day. */
export function dayDraw(ref: string, day: number): (n: number) => number {
  const base = mix(hashString(ref), day);
  return (n) => unit(finish(mix(base, n), 17));
}

export { HARVEST, SOWING, WINTER, restDay };

/** Each store's sign and its name, for the town's stores card. */
export const STORE_WORDS: Readonly<
  Record<StoreKind, { readonly sign: string; readonly name: string }>
> = {
  grain: { sign: "🌾", name: "Grain" },
  food: { sign: "🍖", name: "Meat, milk and wild food" },
  wood: { sign: "🪵", name: "Timber in the yard" },
  stone: { sign: "🪨", name: "Stone in the yard" },
  ore: { sign: "⛏️", name: "Ore and coal" },
  tools: { sign: "🔨", name: "Tools" },
};

/** A store's book: what it held at moment t, and what a year brings in and takes out. */
type Book = {
  readonly t: number;
  readonly have: StoreBook;
  readonly made: StoreBook;
  readonly used: StoreBook;
};

/**
 * The town's stores as history keeps them, or (a plan without them: a village of the usual) half a
 * year's grain, a month's other food, and as much flowing in as is eaten.
 */
function bookOf(plan: VillagePlan): Book {
  if (plan.stores) return plan.stores;
  const n = plan.population,
    digs = !!plan.works?.mine && plan.works.mine.what !== "stone",
    flows = {
      grain: n * 10,
      food: n * 2,
      wood: 0,
      stone: 0,
      ore: digs ? n * 0.3 : 0,
      tools: n * 0.1,
    };
  return {
    t: 0,
    have: { grain: n * 5, food: n, wood: 0, stone: 0, ore: digs ? n * 0.4 : 0, tools: n * 0.3 },
    made: flows,
    used: flows,
  };
}

/** How much of a year's grain is reaped by moment t (whole years, and the reaping's share of this one). */
function reapedBy(t: number): number {
  const y = Math.floor(t / YEAR),
    s = t / YEAR - y;
  return y + Math.max(0, Math.min(1, (s - HARVEST[0]) / (HARVEST[1] - HARVEST[0])));
}

/**
 * What the town holds of a kind at moment t, from history's books: what it held when they were
 * read, with what has come in since (the grain at the reaping, the rest through the year) and less
 * what has gone out. Wood and stone are the yard's (the day's own, below).
 */
export function storeAt(plan: VillagePlan, kind: StoreKind, t: number): number {
  if (kind === "wood" || kind === "stone") return 0;
  const b = bookOf(plan),
    years = (t - b.t) / YEAR,
    made = kind === "grain" ? (reapedBy(t) - reapedBy(b.t)) * b.made.grain : b.made[kind] * years;
  return Math.max(0, b.have[kind] + made - b.used[kind] * years);
}

/** What comes into a kind's store over [a, b), and what goes out, by history's books. */
export function storeFlow(
  plan: VillagePlan,
  kind: StoreKind,
  a: number,
  b: number,
): { made: number; used: number } {
  const book = bookOf(plan),
    years = (b - a) / YEAR;
  return {
    made:
      kind === "grain" ? (reapedBy(b) - reapedBy(a)) * book.made.grain : book.made[kind] * years,
    used: book.used[kind] * years,
  };
}

/**
 * How many months `amount` of the given stores would last, going out as history's books have them
 * going (99 at most; none going out, as long as there is any).
 */
export function monthsOf(plan: VillagePlan, kinds: readonly StoreKind[], amount: number): number {
  const b = bookOf(plan),
    monthly = kinds.reduce((n, k) => n + b.used[k], 0) / 12;
  return monthly > 0 ? Math.min(99, amount / monthly) : amount > 0 ? 99 : 0;
}

/**
 * Whether the town goes hungry on a day: its land ill fed, or its granary and larders near empty
 * (less than a fortnight of eating left).
 */
export function leanOn(plan: VillagePlan, day: number): boolean {
  const t = day * DAY;
  if ((plan.life?.fed ?? 1) < 0.85) return true;
  return (
    monthsOf(plan, ["grain", "food"], storeAt(plan, "grain", t) + storeAt(plan, "food", t)) < 0.5
  );
}

// —— Where the stores are kept ——————————————————————————————————————————————————

/** A store: where its heap or its door stands (metres from the middle), and which way it faces. */
export type Store = Point & {
  readonly yaw: number;
  /** Where those who bring and fetch stand at it. */
  readonly door: Point;
  /** Its heap drawn in the open (a store with a building of its own keeps it within). */
  readonly heap: boolean;
  /** In words: "the granary", "the yard". */
  readonly words: string;
};

export type StoreSpots = { readonly granary: Store; readonly yard: Store; readonly smithy: Store };

/** Where a village's crafters keep their workshop (by the market hall, or in the square). */
export const WORKSHOP: Point = { x: 14, z: -10 };

const SPOTS = new WeakMap<VillagePlan, StoreSpots>();

/**
 * Where the town keeps its stores. A town built lot by lot: in its granary, its market hall and
 * its smithy, where it has them standing — at their doors, on their streets — else in the corners
 * of its square. A village: its granary at the edge of its homes toward the fields, its yard
 * beside it off the fields' way, its smithy its workshop by the square.
 */
export function storeSpots(plan: VillagePlan, ground: Ground, t: number): StoreSpots {
  let s = SPOTS.get(plan);
  if (s) return s;
  const store = (at: Point, yaw: number, heap: boolean, words: string): Store => ({
    ...at,
    yaw,
    door: heap ? { x: at.x + 3.6 * Math.sin(yaw), z: at.z + 3.6 * Math.cos(yaw) } : at,
    heap,
    words,
  });
  if (plan.town) {
    const town = plan.town,
      lots = lotsOf(plan, t),
      standing = (kind: CivicKind) =>
        town.civics.find((c) => {
          const m = civicMoments(c);
          return c.kind === kind && c.at < town.lots && m.done <= t && (m.fell ?? Infinity) > t;
        }),
      door = (kind: CivicKind, words: string) => {
        const c = standing(kind);
        if (!c || !lots) return null;
        const f = footprint(lots, c.at, c.lots),
          at = streetDoor(f, 0, f.d / 2 + 1.9);
        return store(at, Math.atan2(f.x - at.x, f.z - at.z), false, words);
      },
      // (The square's corners, beyond its stalls and its feast: each heap facing its middle.)
      corner = (k: number, words: string) => {
        const a = Math.PI / 4 + (k * Math.PI) / 2,
          at = { x: 22 * Math.cos(a), z: 22 * Math.sin(a) };
        return store(at, Math.atan2(-at.x, -at.z), true, words);
      };
    const granary =
        door("granary", "the granary") ??
        door("market", "the market hall") ??
        corner(1, "the granary heap in the square"),
      yard = corner(3, "the yard in the square");
    s = {
      granary,
      yard,
      smithy: door("smithy", "the smithy") ?? door("workshop", "the workshop") ?? yard,
    };
  } else {
    // Out at the edge of the homes, toward the fields: the granary; the yard a turn round from it.
    const fx = plan.fields.reduce((a, f) => a + f.x, 0),
      fz = plan.fields.reduce((a, f) => a + f.z, 0),
      toFields = plan.fields.length ? Math.atan2(fz, fx) : 0,
      out = ground.homesReach + 12,
      road = Math.atan2(plan.road.z, plan.road.x),
      apart = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))),
      spot = (from: number, turn: number, words: string) => {
        for (let k = 0; k < 16; k++) {
          const a = from + turn * k * 0.2,
            at = { x: out * Math.cos(a), z: out * Math.sin(a) };
          if (apart(a, road) > 0.25 && clearAt(ground, at, 5))
            return store(at, Math.atan2(-at.x, -at.z), true, words);
        }
        const at = { x: out * Math.cos(from), z: out * Math.sin(from) };
        return store(at, Math.atan2(-at.x, -at.z), true, words);
      };
    const granary = spot(toFields, 1, "the granary"),
      yard = spot(Math.atan2(granary.z, granary.x) + 1.1, 1, "the yard");
    s = { granary, yard, smithy: store(WORKSHOP, 0, false, "the workshop") };
  }
  SPOTS.set(plan, s);
  return s;
}

// —— The town's buildings at work (Phase 41 M199) ————————————————————————————————

/** One of a town's buildings standing: its door on its street (those at work there face it), and its footprint. */
export type CivicDoor = Store & {
  readonly kind: CivicKind;
  /** Its middle, which way it is turned, its breadth and depth (metres). */
  readonly middle: Point & { readonly yaw: number; readonly w: number; readonly d: number };
};

const DOORS = new WeakMap<
  VillagePlan,
  { readonly year: number; readonly doors: ReadonlyMap<CivicKind, readonly CivicDoor[]> }
>();
const NO_DOORS: ReadonlyMap<CivicKind, readonly CivicDoor[]> = new Map();

/**
 * A town's buildings standing in a year (Phase 41 M199: Classic's trades each at its own
 * building), by kind, the nearest its square first: each one's door on its street, where those
 * who work there stand. (A village has none: its crafts are kept at home and by its square.)
 */
export function civicDoors(
  plan: VillagePlan,
  t: number,
): ReadonlyMap<CivicKind, readonly CivicDoor[]> {
  const year = Math.floor(t / YEAR),
    known = DOORS.get(plan);
  if (known && known.year === year) return known.doors;
  const town = plan.town,
    lots = town ? lotsOf(plan, t) : null;
  if (!town || !lots) return NO_DOORS;
  const doors = new Map<CivicKind, CivicDoor[]>();
  for (const c of town.civics) {
    const m = civicMoments(c),
      kind = c.kind as CivicKind;
    if (!CIVIC_INDEX.has(kind)) continue;
    if (c.at + c.lots > lots.x.length || m.done > t || (m.fell ?? Infinity) <= t) continue;
    const f = footprint(lots, c.at, c.lots),
      at = streetDoor(f, 0, f.d / 2 + 1.9),
      list = doors.get(kind) ?? [];
    list.push({
      ...at,
      yaw: Math.atan2(f.x - at.x, f.z - at.z),
      door: at,
      heap: false,
      words: `the ${civic(kind).name.replace(/^an? /, "")}`,
      kind,
      middle: { x: f.x, z: f.z, yaw: f.yaw, w: f.w, d: f.d },
    });
    doors.set(kind, list);
  }
  for (const list of doors.values())
    list.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  DOORS.set(plan, { year, doors });
  return doors;
}

/**
 * Where the `seat`-th of those at a building stands before its door (metres from the middle):
 * along its street in fives, a step back for each five — facing it. `gap` apart; `back` how far
 * out from its door the first row stands.
 */
export function beside(store: Store, seat: number, gap = 1.4, back = 0.6, row = 5): Point {
  const c = Math.cos(store.yaw),
    s = Math.sin(store.yaw),
    across = ((seat % row) - (row - 1) / 2) * gap,
    out = back + Math.floor(seat / row) * gap;
  return { x: store.door.x + c * across - s * out, z: store.door.z - s * across - c * out };
}

/**
 * The rack against a smithy's front, past the end of its smiths' row, where the day's new tools
 * are hung (Phase 51 M213): its middle and which way its bar runs (its front's), and where one
 * stands to hang a tool on it (metres from the town's middle).
 */
export function rackOf(store: Store): { x: number; z: number; yaw: number; stand: Point } {
  const c = Math.cos(store.yaw),
    s = Math.sin(store.yaw),
    across = 9.5,
    at = (out: number): Point => ({
      x: store.door.x + c * across - s * out,
      z: store.door.z - s * across - c * out,
    });
  return { ...at(-1), yaw: store.yaw, stand: at(1.2) };
}

/**
 * Whether a town burns charcoal (Phase 51 M214): where its works smelt their own ore, or its own
 * smiths forge its metal — its collier at the clamp in the woodlot.
 */
export function burnsCharcoal(plan: VillagePlan): boolean {
  return (
    (!!plan.stuff?.ore && !!furnaceOf(plan.works?.mine)) ||
    (plan.metal !== undefined &&
      plan.metal !== "stone" &&
      plan.people.some((p) => p.trade?.kind === "smith"))
  );
}

/** How many moulds a foundry's casting floor holds (two a tap, six taps a day), and their rows. */
export const MOULDS = 12,
  MOULD_ROW = 6;

/**
 * A town's foundry by its works (Phase 51 M215), where its land keeps works in the age of engines:
 * the cupola beside the works' front (toward the town), its spout at its foot and where its iron is
 * drawn, its charging door's stockpile; the casting floor before the works, its moulds in two rows;
 * where the castings are stacked; which way the works face. Null: no works, or before engines.
 */
export function foundryOf(plan: VillagePlan): {
  readonly cupola: Point;
  readonly spout: Point;
  readonly stock: Point;
  readonly moulds: readonly Point[];
  readonly stack: Point;
  readonly yaw: number;
} | null {
  const f = plan.works?.factory;
  if (!f || (plan.era !== "industry" && plan.era !== "modern")) return null;
  // (As the works are drawn: facing the town's middle, its front toward it.)
  const yaw = Math.atan2(-f.x, -f.z),
    c = Math.cos(yaw),
    s = Math.sin(yaw),
    at = (x: number, z: number): Point => ({ x: f.x + x * c + z * s, z: f.z - x * s + z * c });
  return {
    cupola: at(26, 7),
    spout: at(22.5, 10.5),
    stock: at(34, 1),
    moulds: Array.from({ length: MOULDS }, (_, m) =>
      at(-12.5 + (m % MOULD_ROW) * 5, 16 + Math.floor(m / MOULD_ROW) * 4.5),
    ),
    stack: at(-27, 9),
    yaw,
  };
}

/** How many machines the works' floor holds, in two rows (Phase 51 M215): presses in front, lathes behind. */
export const MACHINES = 12,
  MACHINE_ROW = 6;

/** The machine a machinist of a seat works at: the presses and the lathes in turn, from the middle out. */
export function machineOf(seat: number): number {
  return (seat % 2) * MACHINE_ROW + (Math.floor(seat / 2) % MACHINE_ROW);
}

/**
 * A town's works' floor in the modern age (Phase 51 M215): the front half of the works' hall,
 * open to the sky on its steel frame toward the town (its roof over its back half), its machines
 * in two rows across it — the presses in front, the lathes behind them — each facing the front,
 * where its machinist stands at it; the bench just out before the hall where the finished parts
 * are set; which way the works face. Null: no works, or before the modern age.
 */
export function floorOf(plan: VillagePlan): {
  readonly machines: readonly (Point & {
    readonly kind: "lathe" | "press";
    readonly stand: Point;
  })[];
  readonly bench: Point;
  readonly yaw: number;
} | null {
  const f = plan.works?.factory;
  if (!f || plan.era !== "modern") return null;
  const yaw = Math.atan2(-f.x, -f.z),
    c = Math.cos(yaw),
    s = Math.sin(yaw),
    at = (x: number, z: number): Point => ({ x: f.x + x * c + z * s, z: f.z - x * s + z * c });
  return {
    machines: Array.from({ length: MACHINES }, (_, m) => {
      const x = -15 + (m % MACHINE_ROW) * 6,
        press = m < MACHINE_ROW,
        z = press ? 7.5 : 2.5;
      return { ...at(x, z), kind: press ? "press" : "lathe", stand: at(x, z + 2.6) };
    }),
    bench: at(0, 13.4),
    yaw,
  };
}

/** How far out from a kiln's door its potters' wheels stand, three to a row, and how far apart (metres). */
const WHEEL_OUT = 3.4,
  WHEEL_GAP = 4.2,
  WHEEL_ROW = 5.5;

/**
 * The w-th potter's wheel before a kiln (Phase 51 M214): three to a row along its front, a row
 * further out for each three; where it stands, which way its potter faces at it (toward the kiln),
 * and where they stand (metres from the town's middle).
 */
export function wheelOf(
  kiln: Store,
  w: number,
): { x: number; z: number; yaw: number; stand: Point } {
  const c = Math.cos(kiln.yaw),
    s = Math.sin(kiln.yaw),
    across = ((w % 3) - 1) * WHEEL_GAP,
    out = WHEEL_OUT + Math.floor(w / 3) * WHEEL_ROW,
    at = (o: number): Point => ({
      x: kiln.door.x + c * across - s * o,
      z: kiln.door.z - s * across - c * o,
    });
  return { ...at(out), yaw: kiln.yaw, stand: at(out + 1.6) };
}

/**
 * The boards against a kiln's front, past its wheels, where the pots thrown are set to dry
 * before their firing (Phase 51 M214): their middle, which way they run, where one stands at them.
 */
export function boardsOf(kiln: Store): { x: number; z: number; yaw: number; stand: Point } {
  return rackOf(kiln);
}

/**
 * The w-th weaver's loom before a workshop (Phase 51 M214): upright, either side of its door past
 * those at their craft before it, turn about; where it stands (its cloth across its front), which
 * way its weaver faces at it, and where they stand (metres from the town's middle).
 */
export function loomOf(
  shop: Store,
  w: number,
): { x: number; z: number; yaw: number; stand: Point } {
  const c = Math.cos(shop.yaw),
    s = Math.sin(shop.yaw),
    across = (w % 2 ? -1 : 1) * (6.5 + Math.floor(w / 2) * 5.6),
    at = (o: number): Point => ({
      x: shop.door.x + c * across - s * o,
      z: shop.door.z - s * across - c * o,
    });
  return { ...at(1.4), yaw: shop.yaw, stand: at(3.6) };
}

/** A piece of a store's heap: its middle (metres from the town's), its size (metres), how it lies. */
export type HeapPiece = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly yaw: number;
  readonly pitch: number;
};

/** The heaps of a town's stores in the open: its granary's sacks, its yard's logs and stones, its ore. */
export type Heaps = {
  readonly sacks: readonly HeapPiece[];
  readonly logs: readonly HeapPiece[];
  readonly stones: readonly HeapPiece[];
  readonly ore: readonly HeapPiece[];
};

/** The most of each piece a heap is drawn with (a fuller store's heap is drawn as full). */
export const HEAP_MOST = { sacks: 30, logs: 42, stones: 36, ore: 1 } as const;

/**
 * How many of each piece the stores' heaps are drawn with now: a sack for each fortnight of grain
 * the granary holds (where it is a heap in the open), a log and a stone for each load in the yard,
 * and the ore's heap (its months, a year's at most).
 */
export function heapCounts(
  spots: StoreSpots,
  n: {
    readonly grain: number;
    readonly wood: number;
    readonly stone: number;
    readonly ore: number;
  },
): { sacks: number; logs: number; stones: number; ore: number } {
  const most = HEAP_MOST;
  return {
    sacks: spots.granary.heap
      ? Math.min(most.sacks, Math.max(0, Math.ceil(n.grain * 2 - 0.01)))
      : 0,
    logs: spots.yard.heap ? Math.min(most.logs, Math.max(0, Math.round(n.wood))) : 0,
    stones: spots.yard.heap ? Math.min(most.stones, Math.max(0, Math.round(n.stone))) : 0,
    ore: spots.yard.heap ? Math.round(Math.min(12, Math.max(0, n.ore)) * 4) / 4 : 0,
  };
}

/**
 * The stores' heaps laid out (Phase 39 M198): the granary's sacks piled behind where its grain is
 * brought, the yard's logs in a pile (a second beside it) and its stones stacked by it, and its ore
 * heaped the other side. `k` is the scale the people are drawn at against an upright ape's (the
 * heaps of the things they carry are drawn as they carry them).
 */
export function storeHeaps(
  spots: StoreSpots,
  n: {
    readonly sacks: number;
    readonly logs: number;
    readonly stones: number;
    readonly ore: number;
  },
  k: number,
): Heaps {
  /** A piece at (across, up, ahead) of a store, ahead toward its door. */
  const at = (
    s: Store,
    across: number,
    y: number,
    ahead: number,
    size: readonly [number, number, number],
    yaw = 0,
    pitch = 0,
  ): HeapPiece => {
    const c = Math.cos(s.yaw),
      sn = Math.sin(s.yaw);
    return {
      x: s.x + across * c + ahead * sn,
      y,
      z: s.z - across * sn + ahead * c,
      sx: size[0],
      sy: size[1],
      sz: size[2],
      yaw: s.yaw + yaw,
      pitch,
    };
  };
  const sacks: HeapPiece[] = [],
    logs: HeapPiece[] = [],
    stones: HeapPiece[] = [],
    ore: HeapPiece[] = [];
  // Sacks lying in rows, each layer a sack narrower and (from the third) a row shallower.
  const g = spots.granary;
  for (let l = 0, left = n.sacks; left > 0 && l < 6; l++) {
    const cols = 6 - l,
      rows = Math.max(1, 3 - Math.floor(l / 2));
    for (let r = 0; r < rows && left > 0; r++)
      for (let j = 0; j < cols && left > 0; j++, left--)
        sacks.push(
          at(
            g,
            (j - (cols - 1) / 2) * 1.55 * k,
            (l + 0.5) * 0.9 * k,
            -(r + 0.5 + l * 0.25) * 1.25 * k,
            [1.5 * k, 0.9 * k, 1.2 * k],
          ),
        );
  }
  // Logs lying across the yard, a pile narrowing as it rises (twenty-one to a pile).
  const y = spots.yard;
  for (let left = n.logs, pile = 0; left > 0 && pile < 2; pile++)
    for (let l = 0; l < 6 && left > 0; l++)
      for (let j = 0; j < 6 - l && left > 0; j++, left--)
        logs.push(
          at(
            y,
            (pile ? 6.2 : 0) * k,
            (0.4 + l * 0.7) * k,
            -(1 + (j + l / 2) * 0.85) * k,
            [0.8 * k, 5.2 * k, 0.8 * k],
            Math.PI / 2,
            Math.PI / 2,
          ),
        );
  // Stones stacked beside them, four by three a layer.
  for (let left = n.stones, l = 0; left > 0 && l < 3; l++)
    for (let r = 0; r < 3 && left > 0; r++)
      for (let j = 0; j < 4 && left > 0; j++, left--)
        stones.push(
          at(y, (-5.2 - j * 1.8) * k, (0.65 + l * 1.3) * k, -(1.2 + r * 1.4) * k, [
            1.7 * k,
            1.3 * k,
            1.3 * k,
          ]),
        );
  // The ore heaped behind the pile, as high as the months it would last.
  if (n.ore > 0) {
    const r = (1.2 + 2.6 * Math.sqrt(n.ore / 12)) * k,
      h = r * 0.6;
    ore.push(at(y, 0, h / 2, -(7.5 * k + r), [2 * r, h, 2 * r]));
  }
  return { sacks, logs, stones, ore };
}

const SCENES = new WeakMap<VillagePlan, TownScene | null>();
/** A town's scene as its view has it (its lots, what stands on each, which change), once a plan. */
export function sceneOf(plan: VillagePlan, t: number): TownScene | null {
  let s = SCENES.get(plan);
  if (s === undefined) SCENES.set(plan, (s = plan.town ? townScene(plan.town, t) : null));
  return s;
}
function lotsOf(plan: VillagePlan, t: number): TownLots | null {
  return sceneOf(plan, t)?.lots ?? null;
}

// —— What is going up ——————————————————————————————————————————————————————————

/** A building going up on a day: where, its builders' places about it, how many hands it wants. */
export type Site = Point & {
  readonly yaw: number;
  /** Where its builders stand at their work (metres from the middle), each facing it. */
  readonly spots: readonly Point[];
  /** How many it wants at work on it at once. */
  readonly hands: number;
  /** What it is, for its builders' errands: "the new home", "the new granary". */
  readonly name: string;
  /** In words, for the town's card: "a house rising", "a granary going up". */
  readonly words: string;
  /** Whether it is raised in stone as well as timber. */
  readonly stone: boolean;
};

/** Hands wanted at a home of each level going up: a hut's two, a high-rise's many. */
const HANDS = [2, 2, 3, 4, 5, 6];
/** The most sites worked on at once (the nearest the square's): a great city's more go unseen. */
const MOST_SITES = 48;

const SITES = new WeakMap<VillagePlan, Map<number, Site[]>>();

/**
 * What is going up in the town on a day, the nearest its square first: a village's next home (when
 * it grows), the homes rising on its lots — new, raised higher, or worn and rebuilt in their
 * place — and the buildings going up on its streets. (As history and the town's view raise them:
 * when each begins and is done is never the errands'.)
 */
export function sitesOn(plan: VillagePlan, day: number, ground: Ground): Site[] {
  let days = SITES.get(plan);
  if (!days) SITES.set(plan, (days = new Map()));
  const known = days.get(day);
  if (known) return known;
  const out: Site[] = [],
    stoneLand = ["stone", "brick", "mudbrick"].includes(plan.house.walls);
  const site = plan.life?.site;
  if (site && !plan.town) {
    // A village turns out to raise its next home: a ring of places about its rising walls.
    const spots = Array.from({ length: 10 }, (_, k) => {
      const a = (k / 10) * 2 * Math.PI + 0.3;
      return { x: site.x + 9 * Math.cos(a), z: site.z + 9 * Math.sin(a) };
    }).filter((p) => clearAt(ground, p, 1.2));
    out.push({
      x: site.x,
      z: site.z,
      yaw: site.yaw,
      spots,
      hands: 99,
      name: "the new home",
      words: "the next home rising",
      stone: stoneLand,
    });
  }
  const a = day * DAY,
    b = a + DAY,
    scene = plan.town ? sceneOf(plan, a) : null;
  if (scene) {
    const { lots, states } = scene,
      front = (at: { x: number; z: number; yaw: number }, out: number, alongs: readonly number[]) =>
        alongs.map((u) => streetDoor(at, u, out));
    // (Those that change through the plan's year: rising, or worn and to be rebuilt.)
    for (const p of scene.active) {
      if (states.what[p] !== LOT.home || states.takes[p]! <= 0) continue;
      const began = states.began[p]!,
        takes = states.takes[p]!,
        level = Math.max(0, states.level[p]!),
        kind = HOME_LEVELS[level] ?? "home";
      let name: string | null = null,
        words = "";
      if (began < b && began + takes > a) {
        name = `the new ${kind}`;
        words = states.raised[p] ? `a ${kind} raised in place of the old` : `a ${kind} rising`;
      } else if (began + takes <= a) {
        const w = homeWear(scene, p, b);
        if (w.at !== null && w.at < b && w.at + takes > a) {
          name = `the ${kind} being rebuilt`;
          words = `a worn ${kind} rebuilt`;
        }
      }
      if (!name) continue;
      const at = { x: lots.x[p]!, z: lots.z[p]!, yaw: lots.yaw[p]! };
      out.push({
        ...at,
        spots: front(at, LOT_D / 2 + 1.9, [-3, 0, 3, -1.5, 1.5, 4.5]),
        hands: HANDS[level] ?? 2,
        name,
        words,
        stone: stoneLand || level >= 2,
      });
    }
    const town = scene.plan;
    for (const c of town.civics) {
      if (c.at >= town.lots) continue;
      const m = civicMoments(c);
      if (m.began >= b || m.done <= a || (m.fell !== null && m.fell <= a)) continue;
      const f = footprint(lots, c.at, c.lots),
        what = civic(c.kind as CivicKind).name;
      out.push({
        x: f.x,
        z: f.z,
        yaw: f.yaw,
        spots: front(f, f.d / 2 + 1.9, [-6, -2, 2, 6, -4, 4]),
        hands: 6,
        name: `the new ${what.replace(/^(a|an) /, "")}`,
        words: `${what} going up`,
        stone: true,
      });
    }
  }
  // (The nearest the square's first: the eye is there most.)
  out.sort((p, q) => p.x * p.x + p.z * p.z - (q.x * q.x + q.z * q.z));
  const kept = out.slice(0, MOST_SITES);
  if (days.size > 60) days.clear();
  days.set(day, kept);
  return kept;
}

// —— Who does what ————————————————————————————————————————————————————————————

/**
 * What a person does on a day (their work's errands, as the town's needs set them): the
 * harvest's reaping and the sowing; the hoe; firewood and mending in the slack season; the wild's gathering
 * and the shore's fishing; the flock; building at a site; felling timber and cutting stone for
 * the yard; the mine; the smithy and the workshop; foraging in a lean year — or the day as it was
 * before (children, the old, traders, leaders, the rest), "as ever".
 */
export type RoleKind =
  | "as-ever"
  | "reap"
  | "sow"
  | "hoe"
  | "firewood"
  | "mend"
  | "gather"
  | "fish"
  | "herd"
  | "build"
  | "cut"
  | "quarry"
  | "mine"
  // At the furnace by the diggings, smelting its own ore (Phase 51 M213); at the charcoal clamp in
  // the woodlot, burning the furnace's and the forge's charcoal (Phase 51 M214).
  | "smelt"
  | "collier"
  // At the foundry by the works, in the age of engines; at the works' machines in the modern age
  // (Phase 51 M215).
  | "foundry"
  | "machine"
  | "smith"
  | "workshop"
  | "forage"
  // At the town's own buildings (Phase 41 M199): the potters' kiln, the millers' mill, the
  // children at school and the one who teaches them.
  | "kiln"
  | "mill"
  | "teach"
  | "school"
  // The year in the fields (Phase 44 M206): water carried out to them in a dry year, a blight
  // pulled and burned.
  | "water"
  | "pull"
  | "cart"
  // The hunt (Phase 47 M209): out after the game with the others.
  | "hunt"
  // The road's trade (Phase 48 M210): a trader setting out, away, or coming back with goods.
  | "trade";

/** Each day's work in words, for the town's card: "reaping", "felling timber". */
export const ROLE_WORDS: Readonly<Record<RoleKind, string>> = {
  "as-ever": "about their usual day",
  reap: "reaping",
  sow: "sowing",
  hoe: "in the fields",
  firewood: "cutting firewood",
  mend: "mending at home",
  gather: "gathering",
  fish: "fishing",
  herd: "with the flocks",
  build: "building",
  cut: "felling timber",
  quarry: "cutting stone",
  mine: "in the mine",
  smelt: "smelting ore at the furnace",
  collier: "burning charcoal in the woodlot",
  foundry: "at the foundry",
  machine: "at the works' machines",
  smith: "at the forge",
  workshop: "at the workshop",
  forage: "foraging in the wild",
  kiln: "at the kiln",
  mill: "at the mill",
  teach: "teaching",
  school: "at school",
  water: "carrying water to the fields",
  pull: "pulling the blighted crop",
  cart: "carrying in the sheaves",
  hunt: "out hunting",
  trade: "on the road with goods",
};

export type Role = {
  readonly kind: RoleKind;
  /** The site they build at (an index into the day's sites; -1 none). */
  readonly site: number;
  /** Fetching their household's bread from the granary on the way home. */
  readonly fetch: boolean;
  /** Bringing in the flock's milk on the way home (herders, some days). */
  readonly milk: boolean;
  /**
   * Which of the town's buildings of their trade they work at (civicDoors' order), or which of its
   * fields (Phase 44 M206: the plan's fields' order — reaped, watered, pulled); -1 none.
   */
  readonly place: number;
  /** Their place among those at it (its rows before the door). */
  readonly seat: number;
};

/** The town's day: what is going up, who does what, whether it goes hungry. */
export type TownDay = {
  readonly sites: readonly Site[];
  readonly roles: readonly Role[];
  readonly lean: boolean;
  /** The day of rest (none works). */
  readonly rest: boolean;
};

/** How many fire a kiln and its pots, and how many work at a workshop, at most. */
export const POTTERS = 4,
  SHOP_HANDS = 8;

/** Whether a child is of an age for school: six to thirteen for upright apes, as late in any people's span. */
export function schoolAge(plan: VillagePlan, p: VillagePlan["people"][number]): boolean {
  const age = (p.age * 70) / (plan.body?.span ?? 70);
  return p.child && age >= 6 && age < 14;
}

/** Whether a person is old: from sixty-two for upright apes, as late in any people's span. */
export function oldOf(plan: VillagePlan, p: VillagePlan["people"][number]): boolean {
  return p.age >= (62 * (plan.body?.span ?? 70)) / 70;
}

const DAYS = new WeakMap<VillagePlan, Map<number, TownDay>>();

/**
 * Who does what on a day, as the town's needs set it: its sites take the crafters first (and, in
 * the slack season, the farmers), and as many fellers and quarrymen as keep its yard in what they
 * draw from it; half the rest of the crafters dig where the land has a mine, and those left forge
 * its ore or keep to the workshop; the farmers reap, sow or hoe by the season (firewood, mending
 * and the muck in winter); and one of each household fetches its bread every third day (every day
 * in a lean year, when the granary has nothing to give, and the idle go out to the wild).
 */
export function townDay(plan: VillagePlan, day: number, ground: Ground): TownDay {
  let days = DAYS.get(plan);
  if (!days) DAYS.set(plan, (days = new Map()));
  const known = days.get(day);
  if (known) return known;
  const rest = restDay(plan, day),
    sites = rest ? [] : sitesOn(plan, day, ground),
    lean = leanOn(plan, day),
    season = (day % 365) / 365,
    winter = season >= WINTER || season < SOWING[0],
    reaping = season >= HARVEST[0] && season < HARVEST[1],
    sowing = season >= SOWING[0] && season < SOWING[1],
    mine = plan.works?.mine ?? null,
    digs = !!mine && mine.what !== "stone",
    quarry = !!mine && mine.what === "stone",
    oreIn = storeAt(plan, "ore", day * DAY) > 1,
    hunting = !rest && !!huntOn(plan, day),
    kinds: RoleKind[] = plan.people.map(() => "as-ever"),
    siteOf = plan.people.map(() => -1),
    // (The town's buildings standing, each trade's own: Phase 41 M199.)
    doors = plan.town ? civicDoors(plan, day * DAY) : NO_DOORS,
    schools = doors.get("school") ?? [],
    kilns = doors.get("kiln") ?? [],
    mills = doors.get("mill") ?? [],
    shops = doors.get("workshop") ?? [],
    placeOf = plan.people.map(() => -1),
    seatOf = plan.people.map(() => -1),
    seated = new Map<string, number>(),
    sit = (i: number, kind: RoleKind, place: number) => {
      const key = `${kind}:${place}`,
        n = seated.get(key) ?? 0;
      kinds[i] = kind;
      placeOf[i] = place;
      seatOf[i] = n;
      seated.set(key, n + 1);
    },
    draws = plan.people.map((p) => dayDraw(p.ref, day)),
    // The year in the fields (Phase 44 M206): the fields being reaped today, those a dry year
    // carries water out to, those a blight is pulled from.
    year = fieldsNow(plan, day * DAY + 12 * 3600),
    reaped = reaping ? reapingOn(plan, day) : [],
    stooked = reaping ? stookedOn(plan, day) : [],
    watered = !reaping && !sowing && !winter ? wateredOn(plan, day, year) : [],
    pulled = !reaping && !sowing && !winter ? pulledOn(plan, day, year) : [],
    sent = { reap: 0, water: 0, pull: 0 },
    working = (i: number) => {
      const p = plan.people[i]!;
      return !rest && !p.child && !oldOf(plan, p);
    };
  // Builders first: each site's hands, the nearest first, from those willing — and as they are
  // put to it, as many fellers and quarrymen as keep the yard in what they draw from it (a
  // builder's day takes three or four loads, half of them stone where it raises stone; a feller's
  // brings in four or five, a quarryman's three or four).
  const want = sites.map((s) => s.hands);
  let wood = 0,
    stone = 0,
    fellers = 0,
    quarrymen = 0;
  const put = (i: number, supply: boolean): boolean => {
    // (To the site with the most hands still wanted against what it wants; ties, the nearer.)
    let best = -1;
    for (let k = 0; k < sites.length; k++)
      if (
        want[k]! > 0 &&
        (best < 0 || want[k]! / sites[k]!.hands > want[best]! / sites[best]!.hands)
      )
        best = k;
    if (best < 0) return false;
    if (supply && fellers * 4.5 < wood) {
      fellers++;
      kinds[i] = "cut";
      return true;
    }
    if (supply && quarry && quarrymen * 3.5 < stone) {
      quarrymen++;
      kinds[i] = "quarry";
      return true;
    }
    want[best]!--;
    kinds[i] = "build";
    siteOf[i] = best;
    wood += quarry && sites[best]!.stone ? 1.75 : 3.5;
    stone += quarry && sites[best]!.stone ? 1.75 : 0;
    return true;
  };
  const crafters: number[] = [];
  // The children of an age for it to school, where the town keeps one: each to the nearest.
  if (!rest && schools.length)
    plan.people.forEach((p, i) => {
      if (!schoolAge(plan, p)) return;
      const home = plan.homes[p.home]!;
      let best = 0;
      schools.forEach((sc, k) => {
        const b = schools[best]!;
        if (Math.hypot(sc.x - home.x, sc.z - home.z) < Math.hypot(b.x - home.x, b.z - home.z))
          best = k;
      });
      sit(i, "school", best);
    });
  // Kept at the town's own buildings whatever goes up: one to teach at each school its children
  // go to (lean or not), one at each kiln and each mill — the crafter living nearest it, the same
  // one day on day. (Without them a day of much building took every crafter to the sites and the
  // woodlot, and the children sat before an empty door.)
  // (Where the town has its own smiths and potters, named, the forge and the kilns are theirs: the
  // pages of its smithy and kilns name who works there, Phase 50 M212.)
  const own = (kind: string) => plan.people.some((p) => p.trade?.kind === kind),
    smiths = own("smith"),
    potters = own("potter");
  const kept = new Set<number>(),
    keep = (kind: RoleKind, at: readonly { x: number; z: number }[]) =>
      at.forEach((d, k) => {
        if (kind === "teach" && !seated.has(`school:${k}`)) return;
        // (A kiln its own potters keep, or any where the town has its own, wants no other.)
        if (kind === "kiln" && (potters || seated.has(`kiln:${k}`))) return;
        let best = -1,
          far = Infinity;
        plan.people.forEach((p, i) => {
          if (kept.has(i) || p.occupation !== OCC.crafter || !working(i)) return;
          const h = plan.homes[p.home]!,
            r = (h.x - d.x) * (h.x - d.x) + (h.z - d.z) * (h.z - d.z);
          if (r < far) {
            far = r;
            best = i;
          }
        });
        if (best < 0) return;
        kept.add(best);
        sit(best, kind, k);
      });
  // The town's makers at their own trades, day on day (Phase 50 M212): its smiths at the forge
  // while there is ore to work, its potters at its kilns, its weavers at its workshops — the same
  // people the pages of its buildings name, and the makers of the things its people hold.
  if (!rest && !lean)
    plan.people.forEach((p, i) => {
      const t = p.trade;
      if (!t || !working(i)) return;
      if (t.kind === "smith") {
        if (!oreIn || plan.metal === "stone") return;
        kept.add(i);
        sit(i, "smith", 0);
        return;
      }
      // (Its founders at the foundry by its works, its machinists at its machines: Phase 51 M215.)
      if (t.kind === "founder") {
        if (!foundryOf(plan)) return;
        kept.add(i);
        sit(i, "foundry", 0);
        return;
      }
      if (t.kind === "machinist") {
        if (!floorOf(plan)) return;
        kept.add(i);
        sit(i, "machine", 0);
        return;
      }
      // (Its own, at most six to a trade: each to theirs, however many the others fill.)
      const kind = t.kind === "potter" ? "kiln" : "workshop",
        at = t.kind === "potter" ? kilns : shops;
      if (!at.length) return;
      kept.add(i);
      sit(i, kind, t.seat % at.length);
    });
  if (!rest) {
    keep("teach", schools);
    if (!lean) {
      keep("kiln", kilns);
      keep("mill", mills);
    }
  }
  plan.people.forEach((p, i) => {
    if (!working(i) || kept.has(i)) return;
    const draw = draws[i]!;
    switch (p.occupation) {
      case OCC.crafter:
        // (A village's crafters mostly; a town's, with its many going up, nearly all.)
        if (sites.length && draw(14) < (plan.town ? 0.85 : 0.6) && put(i, true)) return;
        if (digs && draw(12) < 0.5) kinds[i] = "mine";
        else crafters.push(i);
        return;
      case OCC.farmer:
        // (A farmer or two lends a hand at a village's next home, but for the harvest.)
        if (!reaping && !plan.town && sites.length && draw(14) < 0.12 && put(i, false)) return;
        // At the harvest, each to one of the fields being reaped today, in turn; in a dry year so
        // many carry water out to the nearest fields, and where a blight has taken, so many pull it.
        if (reaped.length) {
          // (So many at each field's front; the rest carry in the sheaves of the fields reaped.)
          const n = sent.reap++;
          if (n >= REAPERS_AT * reaped.length && stooked.length)
            return sit(i, "cart", stooked[(n - REAPERS_AT * reaped.length) % stooked.length]!);
          return sit(i, "reap", reaped[n % reaped.length]!);
        }
        if (watered.length && draw(19) < Math.min(0.7, year.dry))
          return sit(i, "water", watered[sent.water++ % watered.length]!);
        if (pulled.length && draw(20) < Math.min(0.8, year.blight + 0.25))
          return sit(i, "pull", pulled[sent.pull++ % pulled.length]!);
        // (In the slack season: firewood, mending at home, the muck ploughed in.)
        kinds[i] = reaping
          ? "reap"
          : sowing
            ? "sow"
            : !winter
              ? "hoe"
              : draw(15) < 0.4
                ? "firewood"
                : draw(15) < 0.7
                  ? "mend"
                  : "hoe";
        return;
      case OCC.herder:
        // (Each its own place with the flock: Phase 46 M208.)
        sit(i, "herd", 0);
        return;
      case OCC.forager:
        // (On a hunting day the first few out after the game together: Phase 47 M209.)
        if (hunting && (seated.get("hunt:0") ?? 0) < HUNT_PARTY) {
          sit(i, "hunt", 0);
          return;
        }
        kinds[i] = plan.water && draw(12) < 0.4 ? "fish" : "gather";
        return;
      case OCC.dependent:
        if (lean) kinds[i] = "forage";
        return;
      case OCC.trader:
        // (On the road with the town's goods, on the days of a trip: Phase 48 M210.)
        if (tripOn(plan, traderSeat(plan, i), day)) kinds[i] = "trade";
        return;
    }
  });
  // In the slack season the farmers raise what the crafters cannot.
  if (winter)
    plan.people.forEach((p, i) => {
      if ((kinds[i] === "firewood" || kinds[i] === "mend") && draws[i]!(17) < 0.6) put(i, true);
    });
  // One of its diggers at the furnace by the diggings, where its works smelt their own ore (Phase 51
  // M213): the one the day draws, on a working day not lean (none digging today, a crafter).
  if (!lean && plan.stuff?.ore && furnaceOf(mine)) {
    const first = (from: readonly number[]) =>
      from.reduce((a, i) => (a < 0 || draws[i]!(43) < draws[a]!(43) ? i : a), -1);
    let smelter = first(kinds.flatMap((k, i) => (k === "mine" ? [i] : [])));
    if (smelter < 0) {
      smelter = first(crafters);
      if (smelter >= 0) crafters.splice(crafters.indexOf(smelter), 1);
    }
    if (smelter >= 0) kinds[smelter] = "smelt";
  }
  // One of its fellers at the charcoal clamp in the woodlot, where it smelts its own ore or its own
  // smiths forge (Phase 51 M214): the one the day draws (none felling, a crafter).
  if (!lean && !rest && burnsCharcoal(plan)) {
    const first = (from: readonly number[]) =>
      from.reduce((a, i) => (a < 0 || draws[i]!(44) < draws[a]!(44) ? i : a), -1);
    let collier = first(kinds.flatMap((k, i) => (k === "cut" ? [i] : [])));
    if (collier < 0) {
      collier = first(crafters);
      if (collier >= 0) crafters.splice(crafters.indexOf(collier), 1);
    }
    if (collier >= 0) kinds[collier] = "collier";
  }
  // (Where the willing were too few to keep the yard, the rest of the crafters fell and cut for it.)
  while (crafters.length && fellers * 4.5 < wood - 2.25) {
    kinds[crafters.shift()!] = "cut";
    fellers++;
  }
  while (quarry && crafters.length && quarrymen * 3.5 < stone - 1.75) {
    kinds[crafters.shift()!] = "quarry";
    quarrymen++;
  }
  // The rest: one to teach at each school its children go to, two to each mill; the others forge
  // the ore the town has, fire its kilns or keep to its workshops (in a lean year, all out to the
  // wild — but the teachers).
  let c = 0;
  schools.forEach((_, k) => {
    if (c < crafters.length && seated.has(`school:${k}`) && !seated.has(`teach:${k}`))
      sit(crafters[c++]!, "teach", k);
  });
  if (!lean)
    for (let k = 0; k < mills.length; k++)
      while ((seated.get(`mill:${k}`) ?? 0) < 2 && c < crafters.length)
        sit(crafters[c++]!, "mill", k);
  // (A kiln keeps four at it, a workshop eight: the rest at their craft by the market.)
  const room = (kind: RoleKind, n: number, from: number, most: number): number => {
    for (let j = 0; j < n; j++) {
      const k = (from + j) % n;
      if ((seated.get(`${kind}:${k}`) ?? 0) < most) return k;
    }
    return -1;
  };
  for (const i of crafters.slice(c)) {
    const d = draws[i]!(16),
      from = Math.floor(draws[i]!(18) * 64),
      kiln = d < 0.75 && !potters ? room("kiln", kilns.length, from, POTTERS) : -1,
      shop = room("workshop", shops.length, from, SHOP_HANDS);
    if (lean) kinds[i] = "forage";
    else if (oreIn && d < 0.5 && !smiths && plan.metal !== "stone") sit(i, "smith", 0);
    else if (kiln >= 0) sit(i, "kiln", kiln);
    else if (shop >= 0) sit(i, "workshop", shop);
    else kinds[i] = "workshop";
  }
  // A household's bread: one of it (who works, and is not away down the road) every third day,
  // every day in a lean year.
  const fetcher = new Map<number, number>();
  plan.people.forEach((p, i) => {
    if (!working(i) || kinds[i] === "as-ever" || kinds[i] === "trade") return;
    const was = fetcher.get(p.home);
    if (was === undefined || draws[i]!(31) < draws[was]!(31)) fetcher.set(p.home, i);
  });
  const roles = plan.people.map((p, i): Role => ({
    kind: kinds[i]!,
    site: siteOf[i]!,
    fetch:
      fetcher.get(p.home) === i &&
      (lean || (day + (hashString(`${plan.ref}|${p.home}`) % 3)) % 3 === 0),
    milk: kinds[i] === "herd" && draws[i]!(30) < 0.5,
    place: placeOf[i]!,
    seat: seatOf[i]!,
  }));
  const town: TownDay = { sites, roles, lean, rest };
  if (days.size > 60) days.clear();
  days.set(day, town);
  return town;
}
