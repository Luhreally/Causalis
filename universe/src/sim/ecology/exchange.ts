// Pests and beasts carried on contact (the sweep, Nature lane; the rules are rules/exchange.ts). Beside each sowing land's crop
// (ecology/crops.ts) it keeps the lineages its fields have met, the share of its crop carried weeds and pests take, and the herd
// beast it keeps. Every five years (with its crop) a land looks at the lands it meets: a lineage sown there its fields have never
// met, and that grows wild neither on it nor beside it, brings its weeds and pests; a beast kept there that would give it a tenth more is taken up. What the pests leave of its
// fields, and what its beast gives against the one it first kept, are read by the year's food (population/systems.ts). A land's
// first row reckons every lineage it already meets long known, so the exchange begins with the chronicle: exactly 1 both, until
// a contact is new.
//
// One small row a sowing land; a fifth of the lands step each year, five years at once (cell + year). No draw.
import {
  YEAR,
  Hasher,
  defineEventType,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
  yearOfMoment,
} from "../../kernel/index.ts";
import { isProvinceWorld, lives, offworldSite } from "../../gen/index.ts";
import { EXCHANGE, beastWorth, lineageBit, pestStrike, pestsAfter } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { Province } from "../population/model.ts";
import { CROP_STEP, cropFieldOf, cropMeets, cropName, cropsOf } from "./crops.ts";

export const EXCHANGE_EVENTS = {
  /** A lineage's weeds and pests came to fields that had never met them. */
  pests: defineEventType("life.pests-came", 3),
  /** A land took up the herd beast of a land it meets. */
  beast: defineEventType("life.beast-carried", 3),
};

/** A land's exchange, in whole numbers. */
export type ExchangeLand = {
  readonly cell: number;
  /** The lineages its fields have met (rules/exchange.ts lineageBit), and the share of its crop carried pests take (thousandths). */
  met: number;
  pests: number;
  /**
   * Its herd beast (a lineage of its world; -1: none kept), the land it was first kept on, the beast the land first kept, and
   * what its beast gives here against that first one, as the land is now (thousandths).
   */
  beast: number;
  beastFrom: number;
  first: number;
  gives: number;
  /** The events of the last pests come and the last beast taken up (null: none in the chronicle). */
  struck: Ref | null;
  came: Ref | null;
};

function fold(d: [number, number], xs: readonly number[]): void {
  let a = d[0],
    b = d[1];
  for (const x of xs) {
    const lo = x | 0,
      hi = Math.floor(x / 4294967296) | 0;
    a = Math.imul(a ^ lo, 0x01000193) ^ hi;
    b = Math.imul(b + lo + 0x9e3779b9, 0x85ebca6b) ^ (b >>> 13);
  }
  d[0] = a;
  d[1] = b;
}

export class ExchangeStore implements StateStore {
  readonly name = "life.exchange";
  readonly packed = true;
  private readonly map = new Map<number, ExchangeLand>();
  private readonly digest: [number, number] = [0x811c9dc5, 0];
  begun = false;

  get(cell: number): ExchangeLand | undefined {
    return this.map.get(cell);
  }
  set(l: ExchangeLand): void {
    this.map.set(l.cell, l);
    fold(this.digest, [l.cell, l.met, l.pests, l.beast, l.beastFrom, l.first, l.gives]);
  }
  all(): ExchangeLand[] {
    return [...this.map.values()].sort((a, b) => a.cell - b.cell);
  }
  get size(): number {
    return this.map.size;
  }
  dormant(): boolean {
    return !this.begun && this.map.size === 0;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const l of this.map.values()) for (const r of [l.struck, l.came]) if (r) out.push(r);
    return out;
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    h.int(this.map.size)
      .int(this.digest[0])
      .int(this.digest[1])
      .int(this.begun ? 1 : 0);
  }
  save(): unknown {
    if (this.dormant()) return {};
    return { lands: this.all(), digest: [...this.digest], begun: this.begun };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as {
      lands?: ExchangeLand[];
      digest?: [number, number];
      begun?: boolean;
    };
    this.map.clear();
    for (const l of s.lands ?? []) this.map.set(l.cell, { ...l });
    this.digest[0] = s.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s.digest?.[1] ?? 0;
    this.begun = s.begun ?? false;
  }
}

export function exchangeOf(world: World): ExchangeStore | null {
  return world.hasStore("life.exchange") ? world.store<ExchangeStore>("life.exchange") : null;
}

/** What carried weeds and pests leave of a land's fields (1 where none came). */
export function pestsLeft(world: World, cell: number): number {
  const l = exchangeOf(world)?.get(cell);
  return l ? 1 - l.pests / 1000 : 1;
}

/** What a land's herd beast gives against the one it first kept (1 where it keeps its first, or none). */
export function herdGives(world: World, cell: number): number {
  const l = exchangeOf(world)?.get(cell);
  return l ? l.gives / 1000 : 1;
}

/** A beast's worth on a land (millionths; 0: none). */
function worthHere(ctx: PopulationContext, beast: number, cell: number): number {
  const s = beast >= 0 ? ctx.generated.life.species[beast] : undefined;
  return s ? Math.round(1e6 * beastWorth(s, cropFieldOf(ctx, cell))) : 0;
}

/**
 * Whether a crop's lineage grows wild on a land or beside it: its weeds and pests live there already (roots and fruit, and beds,
 * are many plants, all of them its own).
 */
function wildAbout(ctx: PopulationContext, cell: number, crop: number): boolean {
  if (crop < 0) return true;
  const g = ctx.generated;
  if (lives(g.life, cell, crop)) return true;
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++)
    if (lives(g.life, g.grid.neighbours[k]!, crop)) return true;
  return false;
}

/** The lineages a land and the lands it meets sow. */
function metNow(ctx: PopulationContext, cell: number): number {
  const crops = cropsOf(ctx.world);
  let met = 0;
  for (const c of [cell, ...cropMeets(ctx, cell)]) {
    const l = crops?.get(c);
    if (l) met |= lineageBit(l.crop);
  }
  return met;
}

/** The beast a herding land keeps at first: its own best tame grazer, else the best its neighbours keep. */
function firstBeast(
  ctx: PopulationContext,
  store: ExchangeStore,
  p: Province,
): { beast: number; from: number } {
  const own = ctx.generated.life.herdBeast[p.cell]!;
  let beast = own,
    from = p.cell;
  if (own < 0)
    for (const c of cropMeets(ctx, p.cell)) {
      const o = store.get(c);
      if (o && o.beast >= 0 && worthHere(ctx, o.beast, p.cell) > worthHere(ctx, beast, p.cell)) {
        beast = o.beast;
        from = o.beastFrom;
      }
    }
  return { beast, from };
}

/** A land's first row: every lineage it meets now long known, the beast it keeps its first. */
function firstLand(ctx: PopulationContext, store: ExchangeStore, p: Province): ExchangeLand {
  const b = p.herding ? firstBeast(ctx, store, p) : { beast: -1, from: p.cell };
  return {
    cell: p.cell,
    met: metNow(ctx, p.cell),
    pests: 0,
    beast: b.beast,
    beastFrom: b.from,
    first: b.beast,
    gives: 1000,
    struck: null,
    came: null,
  };
}

/** A land's exchange over five years: its pests kept down, new lineages' brought, a better beast taken up. */
function stepLand(
  ctx: PopulationContext,
  store: ExchangeStore,
  p: Province,
  l: ExchangeLand,
): void {
  const { world } = ctx,
    crops = cropsOf(world);
  l.pests = Math.round(1000 * pestsAfter(l.pests / 1000, CROP_STEP));
  // The lineages sown about it that its fields never met: those of its own wild bring nothing new.
  const fresh: { cell: number; crop: number }[] = [];
  for (const c of cropMeets(ctx, p.cell)) {
    const o = crops?.get(c);
    if (!o || l.met & lineageBit(o.crop)) continue;
    l.met |= lineageBit(o.crop);
    if (!wildAbout(ctx, p.cell, o.crop)) fresh.push({ cell: c, crop: o.crop });
  }
  if (fresh.length) {
    let pests = l.pests / 1000;
    for (let k = 0; k < fresh.length; k++) pests = pestStrike(pests);
    l.pests = Math.round(1000 * pests);
    const first = fresh[0]!,
      from = ctx.provinces.get(first.cell);
    l.struck = world.events.emit({
      type: EXCHANGE_EVENTS.pests.type,
      place: p.ref,
      subjects: from ? [p.ref, from.ref] : [p.ref],
      causes: [],
      data: { crop: cropName(ctx, first.crop), from: first.cell, share: l.pests },
    });
  }
  if (!p.herding) return;
  // (Herding learned since its first row: the beast it keeps first.)
  if (l.beast < 0) {
    const b = firstBeast(ctx, store, p);
    l.beast = b.beast;
    l.beastFrom = b.from;
    l.first = b.beast;
  }
  // The herds of the lands it meets.
  let now = worthHere(ctx, l.beast, p.cell),
    taken: ExchangeLand | null = null;
  for (const c of cropMeets(ctx, p.cell)) {
    const o = store.get(c);
    if (!o || o.beast < 0 || o.beast === l.beast) continue;
    const w = worthHere(ctx, o.beast, p.cell);
    if (w > now * EXCHANGE.better) {
      taken = o;
      now = w;
    }
  }
  if (taken) {
    const from = ctx.provinces.get(taken.cell),
      had = l.beast,
      species = ctx.generated.life.species;
    l.beast = taken.beast;
    l.beastFrom = taken.beastFrom;
    if (l.first < 0) l.first = taken.beast;
    l.came = world.events.emit({
      type: EXCHANGE_EVENTS.beast.type,
      place: p.ref,
      subjects: from ? [p.ref, from.ref] : [p.ref],
      causes: taken.came ? [{ ref: taken.came, role: "enabler", weight: 0.5 }] : [],
      data: {
        beast: species[l.beast]?.name ?? "a beast",
        had: had >= 0 ? (species[had]?.name ?? "a beast") : null,
        from: taken.cell,
      },
    });
  }
  // (Against its first beast on the land as it is now: a warming moves both alike.)
  const was = worthHere(ctx, l.first, p.cell);
  l.gives = l.beast === l.first || was <= 0 ? 1000 : Math.round((1000 * now) / was);
}

/** The year's exchange (152.life.exchange, after the crops): new sowers given their row, a fifth of the lands stepped. */
export function exchangeYear(ctx: PopulationContext, t: SimTime): void {
  const store = exchangeOf(ctx.world),
    crops = cropsOf(ctx.world);
  if (!store || !crops || !isProvinceWorld(ctx.generated)) return;
  const year = yearOfMoment(t);
  for (const p of ctx.provinces.all()) {
    if (!crops.get(p.cell) || offworldSite(ctx.generated, p.cell)) continue;
    const l = store.get(p.cell);
    if (!l) {
      store.set(firstLand(ctx, store, p));
      continue;
    }
    if ((p.cell + year) % CROP_STEP !== 0) continue;
    stepLand(ctx, store, p, l);
    store.set(l);
  }
  store.begun = true;
}

/** What a land's exchange reads as, for its page (null where it sows none). */
export function exchangeReading(world: World, ctx: PopulationContext, cell: number) {
  const l = exchangeOf(world)?.get(cell);
  if (!l) return null;
  const s = l.beast >= 0 ? ctx.generated.life.species[l.beast] : undefined;
  return {
    pests: l.pests / 1000,
    struck: l.struck,
    beast: s ? { name: s.name, ref: s.ref } : null,
    beastFrom: l.beastFrom,
    gives: l.gives / 1000,
    came: l.came,
  };
}

/** Teach a peopled world its exchange of pests and beasts. */
export function installExchange(world: World, ctx: () => PopulationContext): ExchangeStore {
  const store = world.register(new ExchangeStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "152.life.exchange", every: YEAR, run: (t) => exchangeYear(ctx(), t) });
  return store;
}
