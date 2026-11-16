// Who works at what in a land, and why (sim/population/systems.ts farmingShare): the hands its fields need to feed its people
// at what a farmer's work yields there now, and those freed to the crafts and to trade. Pure readings, made when a page is read.
import type { World } from "../../kernel/index.ts";
import type { Block } from "../../bridge/index.ts";
import { OCC } from "../../rules/index.ts";
import { adults, farmingShare, populationContext } from "../../sim/index.ts";
import { share, stat } from "./words.ts";

/** A land's work, for its People tab (nothing where no one sows). */
export function labourBlock(world: World, cell: number): Block | null {
  const ctx = populationContext(world),
    p = ctx.provinces.get(cell);
  if (!p?.total() || !p.knowsCultivation) return null;
  const grown = Math.max(1, adults(p, ctx.life)),
    of = (o: number) => p.occupation(o) / grown;
  return {
    type: "facts",
    title: "Their work",
    rows: [
      stat("Its fields need", `${share(farmingShare(ctx, p))} of the hands the old ways sent them`),
      stat("Farming", share(of(OCC.farmer))),
      stat("At crafts and trade", share(of(OCC.crafter) + of(OCC.trader))),
    ],
  };
}
