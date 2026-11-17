// Kinds of want (the sweep, Nature lane; the rules are rules/nutrition.ts). Once a year each peopled land's last year of eating is
// read from its books (what it used of its flesh and milk, its wild food and its grain, its own and what it bought in), and from it
// how well its people were nourished: matched protein, and vitamins and metals, against what their bodies want. Where they go
// short, their young die the more and their grown a little more; and what their bodies make in their skin from their sun, as far
// toward the poles from their cradle and as smoky their sky are (the light lived, rules/nutrition.ts sunMade) (population/systems.ts vitalMonth: dietDeaths, exactly 1 on a
// land fed as its body wants, or one whose year has not yet been read). Food grown in vats is made whole. One small row a land.
import {
  YEAR,
  defineEventType,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { offworldSite } from "../../gen/index.ts";
import { FOODS, G, STUNTING, dietOf, sunMade, wantDeaths } from "../../rules/index.ts";
import { airSmoke } from "../climate/air.ts";
import { LEDGER } from "../economy/market.ts";
import { loreOf } from "../lore/lore.ts";
import { marketsOf, type PopulationContext } from "./systems.ts";

export const DIET_EVENTS = {
  /** A land's people gone short of what their bodies build from, though fed. */
  poor: defineEventType("life.diet-poor", 3),
};

const USED = LEDGER.indexOf("used");
/** Told where a land's diet goes this short; eased below the other. */
const POOR = 0.25,
  EASED = 0.1;

/** A land's diet, in thousandths: what it ate of each food (FOODS order), its protein and vitamins against its want, how short. */
export type DietLand = {
  readonly cell: number;
  eaten: number[];
  protein: number;
  micro: number;
  /** What its sun and its food give of what a body makes in its skin. */
  sun: number;
  short: number;
  poor: Ref | null;
};

export class DietStore implements StateStore {
  readonly name = "life.diet";
  readonly packed = true;
  readonly lands = new Map<number, DietLand>();
  dormant(): boolean {
    return this.lands.size === 0;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const l of this.lands.values()) if (l.poor) out.push(l.poor);
    return out;
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    h.value([...this.lands.values()].sort((a, b) => a.cell - b.cell));
  }
  save(): unknown {
    return this.dormant()
      ? {}
      : { lands: [...this.lands.values()].sort((a, b) => a.cell - b.cell) };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as { lands?: DietLand[] };
    this.lands.clear();
    for (const l of s.lands ?? []) this.lands.set(l.cell, { ...l, eaten: [...l.eaten] });
  }
}

export function dietOfWorld(world: World): DietStore | null {
  return world.hasStore("life.diet") ? world.store<DietStore>("life.diet") : null;
}

const ONE = { young: 1, grown: 1 } as const;

/** How much likelier death is for a land's young and grown for what they went short of (exactly 1 where none). */
export function dietDeaths(world: World, cell: number): { young: number; grown: number } {
  const l = dietOfWorld(world)?.lands.get(cell);
  return l && l.short > 0 ? wantDeaths(l.short / 1000) : ONE;
}

/** The year's diets (121.life.diet): each peopled land's last year of eating read. */
export function dietYear(ctx: PopulationContext, _t: SimTime): void {
  const store = dietOfWorld(ctx.world);
  if (!store) return;
  const { world } = ctx,
    markets = marketsOf(world),
    lore = loreOf(world),
    body = ctx.generated.life.people?.body.diet,
    g = ctx.generated,
    cradle = g.life.people?.cell ?? -1,
    // (The light lived: a land read against its people's cradle, by its world's tilt. A people of the water makes none in its skin.)
    deg = (c: number) => (g.grid.lat[c]! * 180) / Math.PI,
    lightOf = (c: number) =>
      ctx.medium === "water" || cradle < 0
        ? 1
        : sunMade(deg(c), deg(cradle), g.planet.tilt, airSmoke(ctx, c));
  for (const p of ctx.provinces.all()) {
    const m = markets.get(p.cell),
      book = m?.years.at(-1)?.ledger[USED];
    if (!p.total() || !book || offworldSite(ctx.generated, p.cell)) {
      store.lands.delete(p.cell);
      continue;
    }
    const eaten: Record<number, number> = {};
    for (const g of FOODS) eaten[g] = book[g] ?? 0;
    // (Food grown in vats is made whole, as its makers would have it.)
    const vats = !!lore.get(p.cell, "vat-food"),
      sun = lightOf(p.cell),
      r = dietOf(eaten, body, !!lore.get(p.cell, "rotation"), sun),
      short = vats ? 0 : r.short,
      was = store.lands.get(p.cell),
      l: DietLand = {
        cell: p.cell,
        eaten: FOODS.map((g) => Math.round(1000 * (r.shares[g] ?? 0))),
        protein: Math.round(1000 * (vats ? 1 : r.protein)),
        micro: Math.round(1000 * (vats ? 1 : r.micro)),
        sun: Math.round(1000 * (vats ? 1 : r.sun)),
        short: Math.round(1000 * short),
        poor: was?.poor ?? null,
      };
    if (!l.poor && short >= POOR)
      l.poor = world.events.emit({
        type: DIET_EVENTS.poor.type,
        place: p.ref,
        causes: p.cultivation ? [{ ref: p.cultivation, role: "enabler", weight: 0.5 }] : [],
        data: {
          short: Math.round(short * 100),
          grain: Math.round(l.eaten[FOODS.indexOf(G.grain)]! / 10),
        },
      });
    else if (l.poor && short < EASED) l.poor = null;
    store.lands.set(p.cell, l);
  }
}

/** What a land's diet reads as, for its page (null where it is not read). */
export function dietReading(world: World, cell: number) {
  const l = dietOfWorld(world)?.lands.get(cell);
  if (!l) return null;
  return {
    eaten: Object.fromEntries(FOODS.map((g, i) => [g, (l.eaten[i] ?? 0) / 1000])) as Record<
      number,
      number
    >,
    protein: l.protein / 1000,
    micro: l.micro / 1000,
    sun: (l.sun ?? 1000) / 1000,
    short: l.short / 1000,
    stunted: STUNTING * (l.short / 1000),
    deaths: wantDeaths(l.short / 1000),
    poor: l.poor,
  };
}

/** Teach a peopled world its kinds of want. */
export function installDiet(world: World, ctx: () => PopulationContext): DietStore {
  const store = world.register(new DietStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "121.life.diet", every: YEAR, run: (t) => dietYear(ctx(), t) });
  return store;
}
