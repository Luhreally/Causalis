// What a land's town draws (rules/urban.ts), land by land: once in five years in the land's own year, its town's wage against its
// fields', less what its crowds cost, and a land coming a share of the way a year toward it. Read each year where a land's settled
// people are shared among its town and villages (systems.ts settle: readsTownDraw), so a town grows by those it draws, its crowds
// breed sickness (sim/health) and it may grow into a city (sim/city). One row a land with a town; nothing that grows with history.
import { YEAR, yearOfMoment, type SimTime, type World } from "../../kernel/index.ts";
import { OCC, drawAfter, townDraw } from "../../rules/index.ts";
import type { MarketStore } from "../economy/market.ts";
import { readsTownDraw, type PopulationContext } from "./systems.ts";
import type { Province } from "./model.ts";
import { URBAN_ROW, URBAN_STORE, cultureRows } from "../culture/rows.ts";
import { gangDeterOf } from "../order/underworld-kept.ts";
import { pilgrimFeed } from "../ideas/pilgrims-kept.ts";
import { URBAN } from "../../rules/index.ts";

/** A land weighs what its town draws once in so many years, each land in its own year. */
export const URBAN_EVERY = 5;

/** What a land's town pays and its fields pay a year's work (grain), each weighted by those at the work. Only reads. */
export function wagesOfLand(world: World, p: Province): { town: number; field: number } {
  const wage = world.store<MarketStore>("economy.markets").wagesOf(p.cell);
  if (!wage) return { town: 0, field: 0 };
  const mean = (occs: readonly number[]) => {
    let n = 0,
      w = 0;
    for (const o of occs) {
      const k = p.occupation(o);
      n += k;
      w += k * (wage[o] ?? 0);
    }
    return n > 0 ? w / n : 0;
  };
  return { town: mean([OCC.crafter, OCC.trader]), field: mean([OCC.farmer, OCC.herder]) };
}

/** What a land's town draws, as last weighed: how many times its trades and their kin it holds, and toward what. */
export function urbanOf(
  world: World,
  cell: number,
): { draw: number; target: number; ratio: number; town: number } | null {
  const row = cultureRows(world, URBAN_STORE)?.get(cell);
  if (!row) return null;
  return {
    draw: row[URBAN_ROW.draw]! / 1000,
    target: row[URBAN_ROW.target]! / 1000,
    ratio: row[URBAN_ROW.ratio]! / 1000,
    town: row[URBAN_ROW.town]!,
  };
}

/** The year's towns: each land with a town in its year of five comes the years' way toward what its town draws. */
export function urbanYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    rows = cultureRows(world, URBAN_STORE);
  if (!rows) return;
  const year = yearOfMoment(t);
  for (const p of ctx.provinces.all()) {
    if ((year + p.cell) % URBAN_EVERY !== 0) continue;
    const town = p.total() ? ctx.settlements.kept(p.cell).find((v) => v.market) : undefined;
    if (!town) {
      if (rows.get(p.cell)) rows.drop(p.cell);
      continue;
    }
    const w = wagesOfLand(world, p),
      // (Fewer come to a town whose quarters are fought over: sim/order/underworld.ts. Exactly as before where none is kept.)
      drawn = townDraw(w.town, w.field, town.population),
      deterred = drawn > 1 ? 1 + (drawn - 1) * (1 - gangDeterOf(world, p.cell)) : drawn,
      // (And more to a town pilgrims come to, for what they leave there: sim/ideas. Exactly as before where none come.)
      fed = pilgrimFeed(world, p.cell),
      target = fed > 0 ? Math.min(URBAN.most, deterred * (1 + fed)) : deterred,
      row = rows.get(p.cell),
      // (A land is weighed in its own year of every URBAN_EVERY, and comes those years' way at once; first weighed, its
      // town holds its trades alone and begins to draw.)
      draw = row ? drawAfter(row[URBAN_ROW.draw]! / 1000, target, URBAN_EVERY) : 1;
    if (!row && target <= 1) continue;
    rows.set(p.cell, [
      Math.round(draw * 1000),
      Math.round(target * 1000),
      Math.round((w.field > 0 ? w.town / w.field : 0) * 1000),
      town.population,
    ]);
  }
}

/** How many times its trades and their kin a land's town holds (1: its trades alone, before it was weighed). */
function drawOf(world: World, cell: number): number {
  const row = cultureRows(world, URBAN_STORE)?.get(cell);
  return row ? Math.max(1, row[URBAN_ROW.draw]! / 1000) : 1;
}

/** Teach a peopled world what its towns draw. */
export function installUrban(world: World, ctx: () => PopulationContext): void {
  world.system({ key: "141.population.urban", every: YEAR, run: (t) => urbanYear(ctx(), t) });
  readsTownDraw(drawOf);
}
