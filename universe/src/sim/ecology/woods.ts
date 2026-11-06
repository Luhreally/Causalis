// Woods that move (E1, Classic 19, 113, 119). Every land's woods have a reach: the share of it they stand on where no one
// fells them. It moves by the world's own rule for where woods stand (gen's `classify`), asked again at the rain and warmth
// this age gives: woods let alone fill what their land holds and seed from the land beside; a run of dry years kills what
// its rain no longer holds, and a long drying takes it slowly. What people fell and fire burns of what stands is the
// ecology's `forest`, as it always was (what stands = reach × forest). One number a land, once in five years; no fine patch
// is read after a world's table is made. A people of the water's are its weed beds, on the shelf, by how cold its sea is.
// Read a world's worst before changing a rate: tools/e1-tally.ts.
import {
  YEAR,
  defineEventType,
  defineStream,
  yearOfMoment,
  type CauseRef,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { BIOME, classify, offworldSite } from "../../gen/index.ts";
import {
  GROVE,
  GROVE_RAINS,
  GROVE_WARMS,
  GROVE_WHYS,
  groveAt,
  groveHolds,
  groveStep,
  groveWords,
  type GroveWhy,
  type GroveWords,
} from "../../rules/index.ts";
import { airOf, rainShift, warmingOf } from "../climate/air.ts";
import { longRain } from "../climate/long.ts";
import { homePlanet } from "../planet/store.ts";
import type { PopulationContext } from "../population/systems.ts";
import { wildOf } from "../acts/wild.ts";
import { ecologyOf, firstForest } from "./ecology.ts";

export const WOODS_EVENTS = {
  turn: defineEventType("ecology.woods-turn", 3),
};

const RUNS = defineStream("woods.runs");

/** A turn of a land's woods: when it was told, what they were and came to (hundredths of the land), and why. */
export type WoodsTurn = {
  readonly year: number;
  readonly from: number;
  readonly to: number;
  readonly why: GroveWhy;
  readonly ref: Ref | null;
};

/** What a world's lands can hold, read once from its ground: never part of its state. */
type GroveIndex = {
  readonly key: string;
  readonly lands: number;
  /** What each land holds at each rain and warming. */
  readonly table: Float32Array;
  /** What it had at first, and the most it could ever hold. */
  readonly first: Float32Array;
  readonly most: Float32Array;
};

const FORESTS: ReadonlySet<number> = new Set([
  BIOME.borealForest,
  BIOME.temperateForest,
  BIOME.temperateRainforest,
  BIOME.tropicalDryForest,
  BIOME.tropicalRainforest,
]);

function readGrove(ctx: PopulationContext): GroveIndex {
  const planet = homePlanet(ctx.world),
    g = planet.generated,
    f = g.fine,
    n = g.offworld.base,
    water = ctx.medium === "water",
    // (Where no life took hold, nothing grows at all.)
    bare = !g.life.species.length,
    table = new Float32Array(n * GROVE_RAINS.length * GROVE_WARMS.length),
    first = new Float32Array(n),
    most = new Float32Array(n);
  for (let c = 0; c < n && !bare; c++) {
    let area = 0;
    for (let k = g.childOffsets[c]!; k < g.childOffsets[c + 1]!; k++) {
      const x = g.children[k]!,
        a = f.grid.areas[x]!,
        e = f.tectonics.elevation[x]!,
        warm = f.climate.temperature[x]!,
        rain = f.climate.precipitation[x]!;
      if (water ? e > 0 || f.climate.biome[x] !== BIOME.shelf : e <= 0) continue;
      area += a;
      GROVE_RAINS.forEach((kr, r) =>
        GROVE_WARMS.forEach((dt, w) => {
          const holds = water
            ? warm + dt >= GROVE.bedCold + (1 - kr) * GROVE.bedSwing &&
              warm + dt <= GROVE.bedWarm + (kr - 1) * GROVE.bedSwing
            : FORESTS.has(classify(e, warm + dt, rain * kr));
          if (holds) table[groveAt(c, r, w)]! += a;
        }),
      );
    }
    if (area <= 0) continue;
    const dry = groveAt(c, 0, 0);
    for (let j = 0; j < GROVE_RAINS.length * GROVE_WARMS.length; j++) {
      const v = table[dry + j]! / area;
      table[dry + j] = v;
      if (v > most[c]!) most[c] = v;
    }
    first[c] = water ? table[groveAt(c, 4, 0)]! : firstForest(g, c);
    if (first[c]! > most[c]!) most[c] = first[c]!;
  }
  return { key: planet.surfaceKey, lands: n, table, first, most };
}

export class WoodsStore implements StateStore {
  readonly name = "ecology.woods";
  /** Each land's reach, in ten-thousandths of it (empty: not begun, every land's as it was at first). */
  reach: Uint16Array = new Uint16Array(0);
  /** A land's reach and what stood of it when it was last told, in hundredths. */
  markReach: Uint8Array = new Uint8Array(0);
  markStood: Uint8Array = new Uint8Array(0);
  /** The years' rain since a land was last looked at, for those who keep it: the sum in thousandths, and the count by the million. */
  readonly rain = new Map<number, number>();
  /** Each land's last turns, oldest first (a land's few). */
  readonly turns = new Map<number, WoodsTurn[]>();
  /** How many of each why, for ever. */
  tally: Record<GroveWhy, number> = Object.fromEntries(GROVE_WHYS.map((w) => [w, 0])) as Record<
    GroveWhy,
    number
  >;
  lastGreat = -1000;
  /** Read from the world's own ground once, not state. */
  index: GroveIndex | null = null;

  get begun(): boolean {
    return this.reach.length > 0;
  }
  dormant(): boolean {
    return !this.begun;
  }
  hashInto(h: Hasher): void {
    if (!this.begun) return;
    for (let c = 0; c < this.reach.length; c++)
      h.int(this.reach[c]!).int(this.markReach[c]!).int(this.markStood[c]!);
    h.value({
      rain: [...this.rain.entries()].sort((a, b) => a[0] - b[0]),
      turns: [...this.turns.entries()].sort((a, b) => a[0] - b[0]),
      tally: this.tally,
      last: this.lastGreat,
    });
  }
  save(): unknown {
    if (!this.begun) return {};
    return {
      reach: [...this.reach],
      markReach: [...this.markReach],
      markStood: [...this.markStood],
      rain: [...this.rain.entries()].sort((a, b) => a[0] - b[0]),
      turns: [...this.turns.entries()].sort((a, b) => a[0] - b[0]),
      tally: this.tally,
      last: this.lastGreat,
    };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as {
      reach?: number[];
      markReach?: number[];
      markStood?: number[];
      rain?: [number, number][];
      turns?: [number, WoodsTurn[]][];
      tally?: Partial<Record<GroveWhy, number>>;
      last?: number;
    };
    this.reach = Uint16Array.from(s.reach ?? []);
    this.markReach = Uint8Array.from(s.markReach ?? []);
    this.markStood = Uint8Array.from(s.markStood ?? []);
    this.rain.clear();
    for (const [c, v] of s.rain ?? []) this.rain.set(c, v);
    this.turns.clear();
    for (const [c, v] of s.turns ?? []) this.turns.set(c, v);
    for (const w of GROVE_WHYS) this.tally[w] = s.tally?.[w] ?? 0;
    this.lastGreat = s.last ?? -1000;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const list of this.turns.values()) for (const t of list) if (t.ref) out.push(t.ref);
    return out;
  }
}

export function woodsOf(world: World): WoodsStore | null {
  return world.hasStore("ecology.woods") ? world.store<WoodsStore>("ecology.woods") : null;
}

/** What a world's lands hold (made once, and again if a god's hand has moved its ground). */
function indexOf(ctx: PopulationContext, store: WoodsStore): GroveIndex {
  const key = homePlanet(ctx.world).surfaceKey;
  if (store.index?.key !== key) store.index = readGrove(ctx);
  return store.index;
}

const stoodOf = (world: World, cell: number): number => ecologyOf(world).get(cell)?.forest ?? 1;

/** The share of a land its woods stand on now, felling and fire and all; and at first. */
export function woodsRead(
  ctx: PopulationContext,
  cell: number,
): { now: number; first: number; reach: number; stood: number } {
  const store = woodsOf(ctx.world);
  if (!store || cell >= homePlanet(ctx.world).generated.offworld.base)
    return { now: 0, first: 0, reach: 0, stood: 1 };
  const idx = indexOf(ctx, store),
    first = idx.first[cell] ?? 0,
    reach = store.begun ? store.reach[cell]! / 10000 : first,
    stood = stoodOf(ctx.world, cell);
  return { now: reach * stood, first, reach, stood };
}

/** The share of what a land had at first that stands of it now: what a fire has to burn (1: as it was). */
export function woodsStanding(ctx: PopulationContext, cell: number): number {
  const w = woodsRead(ctx, cell);
  return w.first > 0.01 ? w.stood * Math.min(1.5, w.reach / w.first) : w.stood;
}

/** A world's words for its woods. */
export function woodsWords(ctx: PopulationContext): GroveWords {
  return groveWords(ctx.medium === "water");
}

/** A fire crossed a land no one keeps: what it took of its woods. */
export function woodsBurned(
  ctx: PopulationContext,
  cell: number,
  share: number,
  year: number,
): void {
  const store = woodsOf(ctx.world);
  if (!store?.begun || cell >= store.reach.length) return;
  store.reach[cell] = Math.round(store.reach[cell]! * Math.max(0, 1 - GROVE.burned * share));
  told(ctx, store, cell, store.reach[cell]! / 10000, 1, year, "fire");
}

function begin(ctx: PopulationContext, store: WoodsStore, idx: GroveIndex): void {
  const n = idx.lands;
  store.reach = new Uint16Array(n);
  store.markReach = new Uint8Array(n);
  store.markStood = new Uint8Array(n);
  for (let c = 0; c < n; c++) {
    const first = idx.first[c]!;
    store.reach[c] = Math.round(first * 10000);
    store.markReach[c] = Math.round(first * 100);
    store.markStood[c] = Math.round(stoodOf(ctx.world, c) * 100);
  }
}

/** If a land's woods have moved far enough since it was last told, say so; `why` where it is known. */
function told(
  ctx: PopulationContext,
  store: WoodsStore,
  c: number,
  reach: number,
  stood: number,
  year: number,
  known: GroveWhy | null,
  run = 1,
  long = 1,
): void {
  const was = (store.markReach[c]! * store.markStood[c]!) / 10000,
    now = reach * stood,
    moved = now - was;
  if (Math.abs(moved) < GROVE.turn) return;
  const { world } = ctx,
    byNature = reach - store.markReach[c]! / 100,
    byPeople = (stood - store.markStood[c]! / 100) * reach,
    p = ctx.provinces.get(c),
    scarred =
      wildOf(world)
        ?.on(c)
        .find((s) => s.year >= year - 2 * GROVE.every) ?? null;
  let why: GroveWhy;
  if (known) why = known;
  // (Back over what they held at first is growing back; past it, onto new ground, is seeding.)
  else if (moved > 0)
    why = byPeople > byNature || now <= (store.index?.first[c] ?? 0) + 0.02 ? "regrown" : "seeded";
  else if (byPeople < byNature) why = scarred ? "fire" : "felled";
  else if (scarred) why = "fire";
  else if (run < long - GROVE.dryRun) why = "dry";
  else why = warmingOf(world) >= 0.5 ? "warming" : "age";
  store.tally[why]++;
  store.markReach[c] = Math.round(reach * 100);
  store.markStood[c] = Math.round(stood * 100);
  // (Where no one lives, it is nothing to anyone: no one's history keeps it, though its page says so.)
  // (And what fire does is told as the fire; what merely grows back is told by no one.)
  const peopled = !!p && p.total() > 0;
  let ref: Ref | null = why === "fire" ? (scarred?.event ?? null) : null;
  if (peopled && why !== "fire" && why !== "regrown") {
    const great =
      peopled &&
      Math.abs(moved) >= GROVE.great &&
      year - store.lastGreat >= GROVE.greatEvery &&
      ctx.settlements.seenIn(c).length > 0;
    if (great) store.lastGreat = year;
    const causes: CauseRef[] = [];
    const source =
      why === "dry"
        ? p?.lastDrought
        : why === "felled"
          ? p?.cultivation
          : why === "warming"
            ? (airOf(world).shiftOf(c) ?? airOf(world).air.lastWarmer)
            : null;
    if (source && world.events.get(source))
      causes.push({ ref: source, role: "trigger", weight: 1 });
    ref = world.events.emit({
      type: WOODS_EVENTS.turn.type,
      importance: great ? 5 : 3,
      place: `cell:0:${c}` as Ref,
      causes,
      data: {
        from: Math.round(was * 100),
        to: Math.round(now * 100),
        why,
        woods: woodsWords(ctx).woods,
        year,
      },
    });
  }
  const list = store.turns.get(c) ?? [];
  list.push({ year, from: Math.round(was * 100), to: Math.round(now * 100), why, ref });
  if (list.length > 3) list.shift();
  store.turns.set(c, list);
}

/** A year of the world's woods. */
export function woodsYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = woodsOf(world);
  if (!store) return;
  const idx = indexOf(ctx, store),
    year = yearOfMoment(t);
  if (!store.begun) begin(ctx, store, idx);
  // A year's rain, kept for those who keep it.
  for (const p of ctx.provinces.all()) {
    if (!p.total() || p.cell >= idx.lands) continue;
    store.rain.set(p.cell, (store.rain.get(p.cell) ?? 0) + p.rain + 1_000_000);
  }
  const warm = Math.max(0, warmingOf(world)),
    { offsets, neighbours } = g.grid;
  for (let c = year % GROVE.every; c < idx.lands; c += GROVE.every) {
    const kept = store.rain.get(c);
    store.rain.delete(c);
    if (idx.most[c]! <= 0 && store.reach[c]! === 0) continue;
    if (offworldSite(g, c)) continue;
    const reach = store.reach[c]! / 10000,
      long = (1 + GROVE.edge * (longRain(ctx, c, year) - 1)) * rainShift(ctx, c);
    let run: number;
    if (kept) {
      const n = Math.floor(kept / 1_000_000);
      run = (kept - n * 1_000_000) / n / 1000;
    } else {
      // (A land no one lives in keeps no years' rain: the run of them as often, by a draw of its own.)
      const u = world.rng.real(RUNS, c, t, 0) + world.rng.real(RUNS, c, t, 1) - 1;
      run = long * (1 + GROVE.runSpread * 2.45 * u);
    }
    let beside = 0;
    for (let k = offsets[c]!; k < offsets[c + 1]!; k++) {
      const m = neighbours[k]!;
      if (m >= idx.lands) continue;
      const there = (store.reach[m]! / 10000) * stoodOf(world, m);
      if (there > beside) beside = there;
    }
    const next = groveStep(
      reach,
      groveHolds(idx.table, c, long, warm),
      // (Only a run of years well under the age's rain kills: a year or two of the usual swing does not.)
      run < long - GROVE.dryRun ? groveHolds(idx.table, c, run, warm) : 1,
      beside,
      GROVE.every,
    );
    store.reach[c] = Math.round(next * 10000);
    told(ctx, store, c, next, stoodOf(world, c), year, null, run, long);
  }
}

/** Teach a peopled world its woods. */
export function installWoods(world: World, ctx: () => PopulationContext): WoodsStore {
  const store = world.register(new WoodsStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "116.woods.year", every: YEAR, run: (t) => woodsYear(ctx(), t) });
  return store;
}
