// A year's digging (E1, Classic 42): what the crafters took of a land's lode goes down; a lode whose depth is done gives
// way to a deeper one where a people's means reach it, and gives out where they do not. A mine that gives out is told;
// its town feels it (`lodePush`: who worked it go, as a famine's hungry do); what it fed comes from a neighbour's
// lode, two lands off at a long haul, or down a road, as the market finds it. Means learned later reopen it. The ages do
// not wait: a people comes to know by what was there (`oreKnown`), and machines that think sort the old heaps for ever.
import {
  YEAR,
  defineEventType,
  yearOfMoment,
  type CauseRef,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { worldChemistry } from "../../gen/index.ts";
import {
  G,
  LODE,
  LODE_KINDS,
  OWN_ENGINES,
  SMELTING,
  lodeSize,
  roleWord,
  worldOre,
} from "../../rules/index.ts";
import { loreOf } from "../lore/lore.ts";
import type { PopulationContext } from "../population/systems.ts";
import { oreWorkable } from "./heat.ts";
import { LodeStore, lodesOf, type Lode } from "./lodes.ts";
import type { MarketStore } from "./market.ts";
import { oresIn } from "./ore.ts";

export const LODE_EVENTS = {
  /** A lode done, at the depth its people's means reach. */
  out: defineEventType("industry.lode-out", 4),
  /** Done at one depth, and sunk to the next by those whose means reach it. */
  deeper: defineEventType("industry.lode-deeper", 3),
};

/** How deep a people's means reach: 0 picks; 1 engines to pump and hoist; 2 machines that think. */
export function digMeans(ctx: PopulationContext, cell: number): number {
  const lore = loreOf(ctx.world);
  if (lore.get(cell, "machine-minds")) return 2;
  return lore.get(cell, "steam-engine") ||
    lore.get(cell, "current-mills") ||
    OWN_ENGINES.some((id) => !!lore.get(cell, id))
    ? 1
    : 0;
}

/** The depth a means reaches a lode to: picks the first; engines the second; thinking machines the third and the heaps. */
const reachedBy = (means: number): number => (means >= 2 ? 3 : means);

/** Who dug each lode this year (not state: the year's own, read when its digging is done). */
const WORKERS = new Map<LodeStore, Map<number, number>>();
const workersOf = (s: LodeStore): Map<number, number> => {
  let m = WORKERS.get(s);
  if (!m) {
    if (WORKERS.size > 8) WORKERS.clear();
    WORKERS.set(s, (m = new Map()));
  }
  return m;
};

/** A land's crafters won `made` of an ore's good this year, `crafters` of them: its lode goes down by that, more for a lean one. */
export function digOre(
  ctx: PopulationContext,
  cell: number,
  kind: string,
  made: number,
  crafters: number,
  seam = false,
): void {
  const lodes = lodesOf(ctx.world);
  if (!lodes || made <= 0) return;
  let at = cell,
    what = kind,
    lean = 1;
  if (!seam) {
    const o = oreWorkable(ctx, cell, kind);
    if (!o) return;
    at = o.cell;
    what = o.arsenical ? "copper" : kind;
    lean = Math.max(0.05, o.grade / Math.max(0.05, o.reach));
  }
  lodes.dig(at, what, made / lean);
  const by = workersOf(lodes),
    k = at * 8 + LODE_KINDS.indexOf(what);
  by.set(k, (by.get(k) ?? 0) + crafters);
}

/** What a lode holds at its first depth, a pure function of the world. */
function sizeOf(ctx: PopulationContext, lodes: LodeStore, lode: Lode): number {
  const key = lode.cell * 8 + LODE_KINDS.indexOf(lode.kind);
  let size = lodes.sizes.get(key);
  if (size === undefined) {
    const lies = oresIn(ctx, lode.cell, lode.kind);
    size = lodeSize(lode.kind, Math.max(0, ...lies.map((o) => o.richness)));
    lodes.sizes.set(key, size);
  }
  return size;
}

function ringOf(ctx: PopulationContext, cell: number): number[] {
  const g = ctx.generated,
    out = new Set([cell]);
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
    const n = g.grid.neighbours[k]!;
    out.add(n);
    for (let j = g.grid.offsets[n]!; j < g.grid.offsets[n + 1]!; j++)
      out.add(g.grid.neighbours[j]!);
  }
  return [...out];
}

/** The best means among a land and those beside it that might dig it. */
function meansNear(ctx: PopulationContext, cell: number): number {
  const g = ctx.generated;
  let best = ctx.provinces.get(cell) ? digMeans(ctx, cell) : 0;
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]! && best < 2; k++) {
    const n = g.grid.neighbours[k]!;
    if (ctx.provinces.get(n)) best = Math.max(best, digMeans(ctx, n));
  }
  return best;
}

/** The good a lode's kind makes. */
function goodOf(kind: string): number {
  if (kind === "coal") return G.coal;
  if (kind === "oil") return G.oil;
  return SMELTING.find((s) => s.ore === kind)?.good ?? G.copper;
}

/** The name a world has for a kind (coal and oil their own), and for how it lies there. */
function namesOf(ctx: PopulationContext, cell: number, kind: string) {
  const chem = worldChemistry(ctx.generated),
    lie = oresIn(ctx, cell, kind)[0]?.lie ?? "surface";
  return {
    metal: roleWord(chem, kind),
    ore: lie === "seam" ? null : (worldOre(chem, kind, lie)?.name ?? null),
    lie,
  };
}

/** A year's lodes, once its digging is done. */
export function lodesYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    lodes = lodesOf(world);
  if (!lodes) return;
  const year = yearOfMoment(t),
    by = workersOf(lodes);
  if (lodes.dugNow.size) {
    for (const key of [...lodes.dugNow].sort((a, b) => a - b)) {
      const lode = lodes.byKey(key);
      if (!lode || lode.out !== null) continue;
      const limit = sizeOf(ctx, lodes, lode) * (LODE.depths[lode.tier] ?? Infinity);
      if (lode.dug < limit) continue;
      if (reachedBy(meansNear(ctx, lode.cell)) > lode.tier) deepen(ctx, lodes, lode, year, false);
      else giveOut(ctx, lodes, lode, year, by.get(key) ?? 0);
    }
    lodes.dugNow.clear();
    by.clear();
  }
  // What was done at one depth, and is reached now by means learned since.
  for (const lode of lodes.done())
    if (reachedBy(meansNear(ctx, lode.cell)) > lode.tier) deepen(ctx, lodes, lode, year, true);
  lodes.forgetFelt(year - LODE.feltYears);
}

function deepen(
  ctx: PopulationContext,
  lodes: LodeStore,
  lode: Lode,
  year: number,
  reopened: boolean,
): void {
  const { world } = ctx,
    n = namesOf(ctx, lode.cell, lode.kind),
    was = lode.ref;
  lode.tier++;
  lode.out = null;
  lode.ref = null;
  lodes.changed(lode.kind, ringOf(ctx, lode.cell));
  if (reopened) lodes.tally.reopened++;
  else lodes.tally.deeper++;
  const causes: CauseRef[] = [];
  if (was && world.events.get(was)) causes.push({ ref: was, role: "trigger", weight: 1 });
  if (!ctx.provinces.get(lode.cell)) return;
  world.events.emit({
    type: LODE_EVENTS.deeper.type,
    importance: reopened ? 4 : 3,
    place: ctx.provinces.get(lode.cell)!.ref,
    causes,
    data: {
      kind: lode.kind,
      metal: n.metal,
      ore: n.ore,
      lie: n.lie,
      tier: lode.tier,
      reopened,
      year,
    },
  });
}

function giveOut(
  ctx: PopulationContext,
  lodes: LodeStore,
  lode: Lode,
  year: number,
  crafters: number,
): void {
  const { world } = ctx,
    p = ctx.provinces.get(lode.cell),
    people = p?.total() ?? 0,
    n = namesOf(ctx, lode.cell, lode.kind);
  lode.out = year;
  lode.first ??= year;
  lodes.tally.out++;
  lodes.changed(lode.kind, ringOf(ctx, lode.cell));
  // Where its people turn: a neighbour's lode, one two lands off, a road, what is in store, or nothing.
  const seam = lode.kind === "coal" || lode.kind === "oil",
    next = seam ? null : oreWorkable(ctx, lode.cell, lode.kind),
    markets = world.store<MarketStore>("economy.markets"),
    m = markets.get(lode.cell),
    good = goodOf(lode.kind),
    road =
      m && m.book("in", good) > 0
        ? markets.flows.find((f) => f.to === lode.cell && f.good === good)
        : undefined,
    how = next
      ? next.reach < 0.5
        ? "far"
        : "neighbour"
      : road
        ? "road"
        : (m?.stock[good] ?? 0) > 0
          ? "store"
          : "none";
  lodes.tally[how]++;
  const towns = ctx.settlements.seenIn(lode.cell),
    town = towns.find((s) => s.market) ?? towns[0],
    share = people > 0 ? crafters / people : 0,
    whole = share >= LODE.wholeTrade;
  if (town) lodes.tally.towns++;
  if (town && whole) lodes.tally.whole++;
  lodes.feel(lode.cell, year, Math.min(LODE.mostPush, share * LODE.pushPerShare));
  // (Where no one lives or digs near it, it is nothing to anyone: no one's history keeps it.)
  const place = p?.ref ?? null,
    great = (lodes.tally.out === 1 || whole) && !!town && year - lodes.lastGreat >= LODE.greatEvery;
  if (great) lodes.lastGreat = year;
  const decision = world.decisions.record({
    rule: "lode.out",
    subject: place ?? (`cell:0:${lode.cell}` as Ref),
    outcome: { kind: lode.kind, how },
    score: lode.dug,
    threshold: sizeOf(ctx, lodes, lode) * (LODE.depths[lode.tier] ?? 1),
    factors: [
      {
        name: "what had been dug of it",
        value: Math.round(lode.dug),
        contribution: 1,
        source: null,
      },
      {
        name: "who worked it, of its people",
        value: Math.round(share * 1000) / 1000,
        contribution: share,
        source: null,
      },
    ],
  });
  const mine = m?.mine ?? m?.metalworking ?? null,
    causes: CauseRef[] = [{ ref: decision, role: "trigger", weight: 0.8 }];
  if (mine && world.events.get(mine)) causes.push({ ref: mine, role: "enabler", weight: 0.2 });
  const firstEver = lodes.tally.out === 1 && !!town;
  lode.ref = world.events.emit({
    type: LODE_EVENTS.out.type,
    importance: firstEver ? 6 : great ? 5 : 4,
    subjects: town ? [town.ref] : [],
    place: place ?? (`cell:0:${lode.cell}` as Ref),
    causes,
    data: {
      kind: lode.kind,
      metal: n.metal,
      ore: n.ore,
      lie: n.lie,
      year,
      tier: lode.tier,
      town: town?.name ?? null,
      how,
      from: next && next.cell !== lode.cell ? next.cell : road ? road.from : null,
      whole,
      // (The first in the world is news for everyone: what the world did by itself.)
      ...(firstEver ? { natural: true } : {}),
    },
  });
}

/** How hard a mine's end still pushes a land's people to go (0 where none has ended, or its years are past). */
export function lodePush(world: World, cell: number, year: number): number {
  const felt = lodesOf(world)?.feltBy(cell);
  if (!felt) return 0;
  const left = 1 - (year - felt[0]) / LODE.feltYears;
  return left > 0 ? felt[1] * left : 0;
}

/** Teach a peopled world what its lodes hold. */
export function installLodes(world: World, ctx: () => PopulationContext): LodeStore {
  const store = world.register(new LodeStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "127.lodes.year", every: YEAR, run: (t) => lodesYear(ctx(), t) });
  return store;
}
