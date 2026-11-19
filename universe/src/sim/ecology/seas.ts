// The sea's stock (2026-11-19). A land's own waters are its own (sim/ecology/ecology.ts `fish`: a river, a lake, its shore).
// The open sea is no one's: a reach of it is fished by every land on it that has boats (the principle "fishing"), whoever
// rules them. Each reach keeps one number, its stock against what it held untouched. It grows back as a living stock does
// (fastest half full, slowly when nearly gone: logistic), and is drawn down by the catch of all who fish it: of what each
// land's wild can feed, the part its boats bring in, as far as its gatherers take it (the same take the ecology reckons),
// against what the reach's size gives for good. What a land's boats
// bring in is the part of its wild food its boats gave it (rules/principles.ts fishing: forageYield), and that part goes with
// the reach's stock: a sea fished out by its neighbours feeds a land the less however little it fishes itself. Told when a
// reach grows poor, with those who fished it most.
// A people of the water do not fish their reach: they live in it and tend it, and it is their whole wild. Where they herd
// (their flocks are the sea's own), their take presses it far less, and all their wild food goes with its stock.
// A reach is read off the world as made: the sea cut into stretches of some SEA.cells cells, in cell order. One row a reach
// that anyone fishes; none on a world with no boats. Level: a number a reach of sea, shared by the lands on it.
import {
  YEAR,
  defineEventType,
  dmath,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { keptKey, offworldSite, type HomeWorld } from "../../gen/index.ts";
import { OCC, PRODUCTIVITY } from "../../rules/index.ts";
import { provinceCapacity, type PopulationContext } from "../population/systems.ts";
import { politiesOf } from "../polity/polity.ts";
import { loreOf } from "../lore/lore.ts";
import { wildsOf } from "./ecology.ts";

export const SEA_EVENTS = {
  /** A reach of sea fished poor by the lands on it. */
  few: defineEventType("ecology.sea-few", 4),
};

export const SEA = {
  /** How many cells of sea make a reach. */
  cells: 24,
  /** People a cell of a reach feeds from its boats' catch, year after year, pressed as hard as it bears for good. */
  feeds: 800,
  /** How fast a stock grows back at its fastest (a year, of what it lacks, half full); what a full take draws of it. */
  grows: 0.25,
  takes: 0.35,
  /** Of a land people's wild food, the part their boats bring in; of a water people's, the part that goes with their reach. */
  boats: 0.13,
  lives: 0.6,
  /** A people who tend their reach press it this much as hard. */
  tended: 0.3,
  /** Poor at this; well again at this. */
  poor: 0.35,
  well: 0.7,
  least: 0.03,
} as const;

/** A reach of sea that is fished. */
export type Sea = {
  readonly reach: number;
  stock: number;
  /** How hard it was pressed last year (1: all it can give for good), by how many lands, and the land that pressed it most. */
  pressed: number;
  lands: number;
  most: number;
  /** The event of its growing poor (null: not poor). */
  few: Ref | null;
};

export class SeaStore implements StateStore {
  readonly name = "ecology.seas";
  private readonly rows = new Map<number, Sea>();
  /** Each cell's reach (-1: none), read off the world as made, for the world it was read from. */
  private reaches: { key: string; of: Int32Array; size: Int32Array } | null = null;
  /**
   * What each land's wild food is worth as its reach stands, where less than whole (thousandths): set by the year, read by
   * the months' food (a land not here: 1). Kept in a save, so that a world loaded eats as the one that ran on.
   */
  private readonly yields = new Map<number, number>();
  dormant(): boolean {
    return this.rows.size === 0;
  }
  yieldOf(cell: number): number {
    const y = this.yields.get(cell);
    return y === undefined ? 1 : y / 1000;
  }
  setYields(next: ReadonlyMap<number, number>): void {
    this.yields.clear();
    for (const [c, y] of next) this.yields.set(c, y);
  }
  get(reach: number): Sea | undefined {
    return this.rows.get(reach);
  }
  set(s: Sea): void {
    this.rows.set(s.reach, s);
  }
  drop(reach: number): void {
    this.rows.delete(reach);
  }
  all(): IterableIterator<Sea> {
    return this.rows.values();
  }
  /** Each cell's reach, and each reach's cells of sea. */
  reachesOf(g: HomeWorld, water: boolean): { of: Int32Array; size: Int32Array } {
    const key = `${keptKey(g)} ${g.grid.count} ${water ? 1 : 0}`;
    if (this.reaches?.key === key) return this.reaches;
    const n = g.grid.count,
      of = new Int32Array(n).fill(-1),
      e = g.tectonics.elevation,
      sizes: number[] = [];
    // The sea in stretches: from each sea cell not yet in one, outward, cell by cell, until the stretch is full.
    for (let c = 0; c < n; c++) {
      if (e[c]! > 0 || of[c] !== -1) continue;
      const id = sizes.length,
        queue = [c];
      of[c] = id;
      for (let q = 0; q < queue.length && queue.length < SEA.cells; q++) {
        const at = queue[q]!;
        for (let k = g.grid.offsets[at]!; k < g.grid.offsets[at + 1]!; k++) {
          const m = g.grid.neighbours[k]!;
          if (e[m]! > 0 || of[m] !== -1 || queue.length >= SEA.cells) continue;
          of[m] = id;
          queue.push(m);
        }
      }
      sizes.push(queue.length);
    }
    // A land is on the reach of its lowest sea neighbour (a people of the water live in theirs already).
    if (!water)
      for (let c = 0; c < n; c++) {
        if (e[c]! <= 0) {
          continue;
        }
        let best = -1;
        for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
          const m = g.grid.neighbours[k]!;
          if (e[m]! <= 0 && (best < 0 || m < best)) best = m;
        }
        if (best >= 0) of[c] = of[best]!;
      }
    this.reaches = { key, of, size: Int32Array.from(sizes) };
    return this.reaches;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const s of this.rows.values()) if (s.few) out.push(s.few);
    return out;
  }
  hashInto(h: Hasher): void {
    if (!this.rows.size) return;
    const ids = [...this.rows.keys()].sort((a, b) => a - b);
    h.int(ids.length);
    for (const id of ids) {
      const s = this.rows.get(id)!;
      h.int(id)
        .int(Math.round(s.stock * 1e6))
        .string(s.few ?? "");
    }
    let sum = 0;
    for (const [c, y] of this.yields) sum += c * 1009 + y;
    h.int(this.yields.size).int(sum);
  }
  save(): unknown {
    return {
      rows: [...this.rows.keys()]
        .sort((a, b) => a - b)
        .map((id) => {
          const s = this.rows.get(id)!;
          return [s.reach, s.stock, s.pressed, s.lands, s.most, s.few];
        }),
      yields: [...this.yields].sort((a, b) => a[0] - b[0]),
    };
  }
  load(state: unknown): void {
    this.rows.clear();
    this.yields.clear();
    const t = state as {
      rows?: [number, number, number, number, number, Ref | null][];
      yields?: [number, number][];
    } | null;
    for (const [reach, stock, pressed, lands, most, few] of t?.rows ?? [])
      this.rows.set(reach, { reach, stock, pressed, lands, most, few });
    for (const [c, y] of t?.yields ?? []) this.yields.set(c, y);
  }
}

export function seasOf(world: World): SeaStore | null {
  return world.hasStore("ecology.seas") ? world.store<SeaStore>("ecology.seas") : null;
}

/** The reach a land is on (-1: none), and its row where it is fished. */
export function seaOf(
  ctx: PopulationContext,
  cell: number,
): { reach: number; sea: Sea | undefined } {
  const store = seasOf(ctx.world);
  if (!store) return { reach: -1, sea: undefined };
  const reach = store.reachesOf(ctx.generated, ctx.medium === "water").of[cell] ?? -1;
  return { reach, sea: reach >= 0 ? store.get(reach) : undefined };
}

/** Whether a land's people go out on their reach: a people of the water always, a people of the land with boats. */
function goesOut(ctx: PopulationContext, cell: number): boolean {
  return ctx.medium === "water" || !!loreOf(ctx.world).get(cell, "fishing");
}

/**
 * What a land's wild food is worth as its reach of sea stands (1: untouched, or it does not go out on one): the part its
 * boats bring in goes with the stock; a water people's wild, most of it. sim/population reads it where the year's food is made.
 */
export function seaYield(ctx: PopulationContext, cell: number): number {
  const store = seasOf(ctx.world);
  return store && !store.dormant() ? store.yieldOf(cell) : 1;
}

/** The same as it is reckoned from its reach's stock (the year sets what the months read). */
function yieldNow(ctx: PopulationContext, sea: Sea | undefined, cell: number): number {
  if (!sea || sea.stock >= 1 || !goesOut(ctx, cell)) return 1;
  return 1 - (ctx.medium === "water" ? SEA.lives : SEA.boats) * (1 - sea.stock);
}

/** The year of every reach that is fished: pressed by all who go out on it, grown back, told when it grows poor. */
export function seasYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = seasOf(world);
  if (!store) return;
  const water = ctx.medium === "water",
    { of, size } = store.reachesOf(g, water),
    lore = loreOf(world),
    pressed = new Map<number, { p: number; lands: number; most: number; mostBy: number }>();
  for (const p of ctx.provinces.all()) {
    const reach = of[p.cell] ?? -1;
    if (reach < 0 || offworldSite(g, p.cell)) continue;
    if (!water && !lore.get(p.cell, "fishing")) continue;
    const pop = p.total();
    if (!pop) continue;
    const w = wildsOf(ctx, p.cell),
      c = provinceCapacity(ctx, p.cell),
      // (The share of what the wild yields that its gatherers take: as the ecology reckons it.)
      take =
        1 -
        dmath.exp(
          -(p.occupation(OCC.forager) * PRODUCTIVITY[OCC.forager]! * ctx.life.appetite) /
            Math.max(1, c.forage * w.wild),
        ),
      // (What its boats bring in of it: that part of what its wild can feed, as far as its gatherers take it. People-years of food.)
      by =
        take *
        c.forage *
        w.wild *
        (water ? SEA.lives : SEA.boats) *
        (water && p.herding !== null ? SEA.tended : 1),
      row = pressed.get(reach);
    if (!(by > 0)) continue;
    if (!row) pressed.set(reach, { p: by, lands: 1, most: p.cell, mostBy: by });
    else {
      row.p += by;
      row.lands++;
      if (by > row.mostBy) {
        row.mostBy = by;
        row.most = p.cell;
      }
    }
  }
  // (Reaches no longer fished grow back, and are let go when whole.)
  for (const s of [...store.all()])
    if (!pressed.has(s.reach)) pressed.set(s.reach, { p: 0, lands: 0, most: s.most, mostBy: 0 });
  for (const [reach, r] of pressed) {
    const was = store.get(reach),
      stock = was?.stock ?? 1,
      press = r.p / Math.max(1, (size[reach] ?? 1) * SEA.feeds),
      next = dmath.clamp(
        stock + SEA.grows * 4 * stock * (1 - stock) + 0.01 - SEA.takes * Math.min(2, press) * stock,
        SEA.least,
        1,
      ),
      s: Sea = was ?? { reach, stock: 1, pressed: 0, lands: 0, most: r.most, few: null };
    s.stock = Math.round(next * 1e4) / 1e4;
    s.pressed = Math.round(press * 1000) / 1000;
    s.lands = r.lands;
    s.most = r.most;
    if (!was && s.stock >= 1) continue;
    if (s.stock >= 1 && !r.lands && !s.few) {
      // (Whole and left alone: no row.)
      store.drop(reach);
      continue;
    }
    if (s.stock < SEA.poor && !s.few && r.lands) {
      const realm = politiesOf(world).of(r.most),
        prov = ctx.provinces.get(r.most),
        boats = lore.get(r.most, "fishing");
      s.few = world.events.emit({
        type: SEA_EVENTS.few.type,
        importance: r.lands >= 4 ? 4 : 3,
        subjects: realm ? [realm.ref] : [],
        place: prov?.ref ?? null,
        causes: [
          ...(boats ? [{ ref: boats.event, role: "enabler" as const, weight: 0.5 }] : []),
          ...(prov?.arrival ? [{ ref: prov.arrival, role: "pressure" as const, weight: 0.5 }] : []),
        ],
        data: {
          stock: Math.round(s.stock * 100),
          lands: r.lands,
          pressed: s.pressed,
          water,
          year: yearOfMoment(t),
        },
      });
    } else if (s.stock > SEA.well && s.few) s.few = null;
    store.set(s);
  }
  // What each land that goes out on a reach less than whole eats of it, until next year.
  const yields = new Map<number, number>();
  if (!store.dormant())
    for (const p of ctx.provinces.all()) {
      const reach = of[p.cell] ?? -1,
        sea = reach >= 0 ? store.get(reach) : undefined;
      if (!sea) continue;
      const y = Math.round(yieldNow(ctx, sea, p.cell) * 1000);
      if (y < 1000) yields.set(p.cell, y);
    }
  store.setYields(yields);
}

/** Teach a peopled world its seas. */
export function installSeas(world: World, ctx: () => PopulationContext): SeaStore {
  const store = world.register(new SeaStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "115.ecology.zseas", every: YEAR, run: (t) => seasYear(ctx(), t) });
  return store;
}
