// A body the god's hand is in that is not one of the hand's people (Phase 61): a soldier of a battle
// fought before a town (sim/hand/fight.ts), a beast of a town's flock or of the wild about it
// (sim/hand/wild.ts). Each is taken by its own command; both are stepped by a second's bids
// ("possess.held") and let go ("possess.leave") alike, as the hand's people are (sim/hand/possess.ts).
import type { SimTime, World } from "../../kernel/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { installFight, soldierBidsProblem, stepSoldier } from "./fight.ts";
import { handOf } from "./hand.ts";
import { beastBidsProblem, installWild, stepBeast } from "./wild.ts";

/** A second's bids for the body held (or a letting go's): the step it begins at, the bids in letters. */
export type HeldInput = { readonly step: number; readonly steps: string };

/** Teach a peopled world the hand in a soldier and in a beast: taking each, stepping and letting go of either. */
export function installHeld(world: World, ctx: () => PopulationContext): void {
  const store = handOf(world);
  installFight(world, ctx);
  installWild(world, ctx);
  /** Why a second's bids (or a letting go's) cannot be taken (null: they can). */
  const problem = (args: unknown, whole: boolean): string | null => {
    const h = store.held;
    if (!h) return "your hand is in no soldier or beast";
    return h.kind === "soldier"
      ? soldierBidsProblem(h, args, whole)
      : beastBidsProblem(h, args, whole);
  };
  const step = (
    args: unknown,
    cause: Parameters<typeof stepSoldier>[4],
    t: SimTime,
    release: boolean,
  ) => {
    const h = store.held!,
      a = args as HeldInput;
    if (h.kind === "soldier") stepSoldier(world, ctx(), h, a.steps, cause, t, release);
    else stepBeast(world, ctx(), h, a.steps, cause, t, release);
  };
  world.defineCommand({
    type: "possess.held",
    validate: (args) => problem(args, true),
    apply: (command, t) => step(command.args, command.id, t, false),
  });
  world.defineCommand({
    type: "possess.leave",
    validate: (args) => problem(args, false),
    apply: (command, t) => step(command.args, command.id, t, true),
  });
}
