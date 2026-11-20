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
 *
 * A land with no ground that can be tilled has no fields, whoever there is called a farmer: none of its ground is under the
 * plough, its wild keeps its ground, its woods stand and its soil is not worn. (Until 2026-11-20 one farmer on such a land, one
 * who took up the plough there or came in from a farming land, read as fields over all of it: its game fell to the fifth of it
 * the fields leave, and its foragers starved. First light's cold dry tundra about lands 337-388, a thousand or two foragers on 120,000-140,000 km² each,
 * starved every other year of every century for it: a few hands at the plough on ground no plough could turn.)
 */
export function farmedOf(ctx: PopulationContext, p: Province): number {
  const farm = provinceCapacity(ctx, p.cell).farm;
  if (!(farm > 0)) return 0;
  const m = marketsOf(ctx.world).get(p.cell),
    tools = m
      ? (1 + (TOOL_GAIN * m.toolCover) / 1000) * (1 + (MACHINE_GAIN * m.machineCover) / 1000)
      : 1,
    gathers = ctx.life.appetite * (1 - hallsShare(ctx, p.cell));
  return Math.min(
    1,
    (p.occupation(OCC.farmer) * PRODUCTIVITY[OCC.farmer]! * tools * gathers) / Math.max(1, farm),
  );
}
