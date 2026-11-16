// How much of a land's farmland its fields use: what its farmers would bring in, against what its farmland gives at full use.
import { OCC, PRODUCTIVITY } from "../../rules/index.ts";
import type { Province } from "../population/model.ts";
import { provinceCapacity, type PopulationContext } from "../population/systems.ts";

/** The share of a land's farmland its fields use (0 … 1), as the year's food reckons it. */
export function farmedOf(ctx: PopulationContext, p: Province): number {
  return Math.min(
    1,
    (p.occupation(OCC.farmer) * PRODUCTIVITY[OCC.farmer]! * ctx.life.appetite) /
      Math.max(1, provinceCapacity(ctx, p.cell).farm),
  );
}
