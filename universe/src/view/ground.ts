// What stands on a village's ground that a walker cannot walk through, and the ways round it: the bridge's
// (bridge/ground.ts, bridge/streets.ts), which the host reads too. Here, only what is the view's own: a village's ground
// made from its plan by how its houses are drawn, and kept while the plan stands.
import { groundOf, type Ground, type VillagePlan } from "../bridge/index.ts";
import { houseLook } from "./village.ts";

export {
  approachWay,
  clearAt,
  clearOf,
  dryAt,
  keepOut,
  pushOut,
  route,
  wayClear,
  type Ground,
  type Solid,
} from "../bridge/index.ts";

const GROUNDS = new WeakMap<VillagePlan, Ground>();

/** A village's solid ground, from its plan (metres; kept while the plan stands). */
export function villageGround(plan: VillagePlan): Ground {
  const known = GROUNDS.get(plan);
  if (known) return known;
  const g = groundOf(plan, plan.town ? null : houseLook(plan.house));
  GROUNDS.set(plan, g);
  return g;
}
