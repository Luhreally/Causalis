// How many children a land's people bear, and why (rules/children.ts, sim/population/systems.ts transition): what a mother's
// body could bear, how many of them live to bear their own, how many living they want, and what makes each cost to raise.
// Pure readings, made when a page is read.
import type { World } from "../../kernel/index.ts";
import type { Block, Stat } from "../../bridge/index.ts";
import { CHILDREN, bearingOf, childrenWanted, livingToBear } from "../../rules/index.ts";
import {
  machineShare,
  populationContext,
  raisingCost,
  readersOf,
  slowDeaths,
  transition,
} from "../../sim/index.ts";
import { share, stat, yearNow } from "./words.ts";

const one = (x: number) => (Math.round(x * 10) / 10).toFixed(1);

/** A land's children, for its People tab (nothing where no one lives). */
export function childrenBlock(world: World, cell: number): Block | null {
  const ctx = populationContext(world),
    p = ctx.provinces.get(cell);
  if (!p?.total()) return null;
  const life = ctx.life,
    could = bearingOf(life).born,
    kept = transition(ctx, cell),
    live = livingToBear(life, slowDeaths(ctx, cell)),
    wanted = childrenWanted(raisingCost(ctx, cell)),
    born = ctx.history.birthsIn(cell, yearNow(world) - 1),
    rows: Stat[] = [
      stat("A mother bears", `${one(could * kept)} at plenty, of the ${one(could)} her body could`),
      stat("Living to bear their own", share(live)),
      stat("Living children they want", `${one(wanted)} (${one(CHILDREN.replace)} replace them)`),
      stat("Schooled before they work", share(readersOf(world, cell))),
      stat("Work machines do", share(machineShare(ctx, cell))),
      stat("Born last year", `${one((1000 * born) / p.total())} in a thousand`),
    ];
  return { type: "facts", title: "Children", rows };
}
