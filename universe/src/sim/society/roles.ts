// Who does what, by the body that bears and the work a land asks, year by year (the society sweep; the rule is rules/roles.ts).
//   187.society.roles, a land every five years in its turn, stepped five years at once: how far its kind's sexes differ (from how it
//     pairs), how far its young hold a mother now (round C's bearingHeld, as many young as its people bear), what its fields ask of
//     strength (the plough, the hunt, less machines), and so what its work would have of a bearer's beyond the home; its people's norm,
//     going a fiftieth of the way to that a year; and what a child costs its mother's work, which the population's births read
//     (systems.ts raisingCost).
// Nothing is drawn.
import { yearOfMoment, type SimTime } from "../../kernel/index.ts";
import {
  DIMORPHISM,
  bearersRule,
  bearingHeld,
  fieldStrength,
  forgone,
  normStep,
  pairingOf,
  rolesTarget,
} from "../../rules/index.ts";
import {
  machineShare,
  marketsOf,
  transition,
  type PopulationContext,
} from "../population/systems.ts";
import { loreOf } from "../lore/lore.ts";
import { readersOf } from "../lore/letters.ts";
import { ROLE_ROW, ROLES_STORE, societyStore } from "./kept.ts";
import { SOCIETY_EVERY, landMeans, landTurn } from "./care.ts";

export function rolesYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = societyStore(world, ROLES_STORE);
  if (!store) return;
  const year = yearOfMoment(t),
    body = ctx.generated.life.people?.body,
    pairing = pairingOf(body, ctx.life.adulthood),
    dimorphism = DIMORPHISM[pairing] ?? 0.25,
    heldAtPlenty = bearingHeld(body, ctx.life),
    markets = marketsOf(world),
    lore = loreOf(world);
  for (const p of ctx.provinces.all()) {
    const c = p.cell,
      was = store.get(c);
    if (was && !landTurn(c, year)) continue;
    const means = landMeans(ctx, p, markets.get(c));
    if (!means) {
      store.drop(c);
      continue;
    }
    const machines = machineShare(ctx, c),
      readers = readersOf(world, c),
      // (Her young hold her as many as her people bear now: its fertility kept, of what its bodies could bear.)
      held = Math.min(1, heldAtPlenty * transition(ctx, c)),
      strength = fieldStrength(p.knowsCultivation, !!lore.get(c, "plough"), machines),
      target = rolesTarget({
        held,
        dimorphism,
        strength,
        towns: means.towns,
        readers,
        machines,
      }),
      // (A people new to the reckoning begins where its work stands.)
      norm = was ? normStep(was[ROLE_ROW.norm]! / 1000, target, SOCIETY_EVERY) : target,
      cost = forgone(norm, means.towns, machines);
    store.set(c, [
      dimorphism * 1000,
      held * 1000,
      strength * 1000,
      target * 1000,
      norm * 1000,
      cost * 1000,
      bearersRule(norm, dimorphism) * 1000,
      means.towns * 1000,
    ]);
  }
}
