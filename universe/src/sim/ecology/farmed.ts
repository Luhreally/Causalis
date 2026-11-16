// How much of a land's farmland its fields use: what its farmers would bring in, against what its farmland gives at full use.
import { MACHINE_GAIN, OCC, PRODUCTIVITY, TOOL_GAIN } from "../../rules/index.ts";
import type { Province } from "../population/model.ts";
import {
  hallsShare,
  marketsOf,
  provinceCapacity,
  type PopulationContext,
} from "../population/systems.ts";

/**
 * The share of a land's farmland its fields use (0 … 1), as the year's food reckons it: its farmers' work with their tools and
 * machines, as each farmer's day goes into its harvest (population/systems.ts), against what its farmland gives at full use.
 * (Without the tools a farmer with a plough and a tractor worked as much ground as one with a digging stick: where the fields
 * take only the hands they need, round "peoples", a land's fields would have shrunk as its tools grew.)
 */
export function farmedOf(ctx: PopulationContext, p: Province): number {
  const m = marketsOf(ctx.world).get(p.cell),
    tools = m
      ? (1 + (TOOL_GAIN * m.toolCover) / 1000) * (1 + (MACHINE_GAIN * m.machineCover) / 1000)
      : 1,
    gathers = ctx.life.appetite * (1 - hallsShare(ctx, p.cell));
  return Math.min(
    1,
    (p.occupation(OCC.farmer) * PRODUCTIVITY[OCC.farmer]! * tools * gathers) /
      Math.max(1, provinceCapacity(ctx, p.cell).farm),
  );
}
