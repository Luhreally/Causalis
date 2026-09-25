// Explanations for the population's own things: a village is there because of the
// decision that founded it (whose factors reach the farming that filled it and the
// ground that drew it).
import type { World } from "../kernel/index.ts";
import { SETTLEMENT, type SettlementStore } from "../sim/index.ts";
import { edges, registerExplainer } from "./why.ts";

registerExplainer(SETTLEMENT.code, (world: World, ref) => {
  if (!world.storeNames().includes("population.settlements")) return null;
  const s = world.store<SettlementStore>("population.settlements").get(ref);
  if (!s) return null;
  return {
    ref,
    claim: `${s.name}, a village of ${s.population}, founded in year ${s.founded}`,
    basis: "recorded",
    t: null,
    causes: edges(world, [{ ref: s.event, role: "trigger", weight: 1 }]),
  };
});
