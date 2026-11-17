// The society sweep, installed (2026-11-16, asked: "everyday life and its institutions"): care of the sick and the old and what a
// realm provides, who does what by the body that bears, what a realm's law holds to and what holders put into their land, what a
// people eats and keeps, wears, and does when it rests. Each keeps one store of fixed rows (./kept.ts), dormant while it holds nothing.
// They run after the order's year (its holds, its laws, its skimming) and before the treasury, which pays what a realm provides.
import { YEAR, type World } from "../../kernel/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { RowStore } from "../money/kept.ts";
import { SOCIETY_STORES } from "./kept.ts";
import { careYear, oldYear, provisionYear } from "./care.ts";
import { rolesYear } from "./roles.ts";
import { holdingsYear, lawYear } from "./holding.ts";
import { dressYear, leisureYear, tableYear } from "./everyday.ts";

/** Register the society sweep's stores and systems on a peopled world. */
export function installSociety(world: World, ctx: () => PopulationContext): void {
  for (const [name, width] of SOCIETY_STORES) world.register(new RowStore(name, width));
  world.system({ key: "187.society.care", every: YEAR, run: (t) => careYear(ctx(), t) });
  world.system({ key: "187.society.old", every: YEAR, run: (t) => oldYear(ctx(), t) });
  world.system({ key: "187.society.provision", every: YEAR, run: (t) => provisionYear(ctx(), t) });
  world.system({ key: "187.society.roles", every: YEAR, run: (t) => rolesYear(ctx(), t) });
  world.system({ key: "187.society.law", every: YEAR, run: (t) => lawYear(ctx(), t) });
  world.system({
    key: "187.society.law.holdings",
    every: YEAR,
    run: (t) => holdingsYear(ctx(), t),
  });
  world.system({ key: "187.society.table", every: YEAR, run: (t) => tableYear(ctx(), t) });
  world.system({ key: "187.society.dress", every: YEAR, run: (t) => dressYear(ctx(), t) });
  world.system({ key: "187.society.leisure", every: YEAR, run: (t) => leisureYear(ctx(), t) });
}
