// How much of a land's farmland its fields use: what its farmers would bring in, against what its farmland gives at full use. And
// what the ways of farming it knows do there (rules/tillage.ts): each lifts what holds its own fields back.
import {
  MACHINE_GAIN,
  OCC,
  PRINCIPLES,
  PRINCIPLE_INDEX,
  PRODUCTIVITY,
  TILLAGE_IDS,
  TOOL_GAIN,
  fieldNeeds,
  tillageOf,
} from "../../rules/index.ts";
import { coverAt, skyOf, type Province } from "../population/model.ts";
import { loreOf } from "../lore/lore.ts";
import { landSlope } from "./ground.ts";
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
    gathers = ctx.life.appetite * (1 - hallsShare(ctx, p.cell)) * tillageAt(ctx, p.cell).work;
  return Math.min(
    1,
    (p.occupation(OCC.farmer) * PRODUCTIVITY[OCC.farmer]! * tools * gathers) / Math.max(1, farm),
  );
}

/**
 * What the ways of farming a land knows do there: its fields' yield (1 + each way's gain by the land's own need of it) and its
 * farmers' work (1 + the plough's, the share's and the mill's), and anything else a principle gives its fields, flat as it was.
 * Read once while the land knows what it knows (lore.readOff).
 */
export function tillageAt(ctx: PopulationContext, cell: number): { yields: number; work: number } {
  const lore = loreOf(ctx.world);
  return lore.readOff(cell, "tillage", () => {
    const g = ctx.generated,
      cover = coverAt(g, cell),
      needs = fieldNeeds(
        cover.moist,
        g.climate.seasonality[cell]!,
        landSlope(ctx, cell),
        cover.woody,
        skyOf(g).rock,
      ),
      t = tillageOf((id) => !!lore.get(cell, id), needs);
    // (Any other principle's flat gain to its fields, as it always was.)
    let flat = 0;
    for (const id of TILLAGE_IDS)
      if (lore.get(cell, id)) flat += PRINCIPLES[PRINCIPLE_INDEX.get(id)!]!.effects.farmYield ?? 0;
    return { yields: t.yields + Math.max(0, lore.effect(cell, "farmYield") - flat), work: t.work };
  });
}
