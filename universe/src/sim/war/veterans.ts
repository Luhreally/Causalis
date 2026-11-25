// Veterans come home (rules/veterans.ts): at a war's peace, each side's discharged (the most it fielded in a battle of it,
// less its fallen, as the groups and the underworld count them) go back to its lands. Where enough of a land's served long
// enough, a craft its seat knows and the land could take up goes home with them; where its treasury ended the war short,
// its lands are aggrieved by them. Run only at a peace: nothing kept.
import { defineEventType, type Ref, type SimTime } from "../../kernel/index.ts";
import { offworldSite } from "../../gen/index.ts";
import {
  OCC,
  VETERANS,
  veteransGrievance,
  veteransSkilled,
  type Principle,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { grieve } from "../acts/disasters.ts";
import { giveLore, loreOf, openTo } from "../lore/lore.ts";
import { deficitOf, revenueOf } from "../money/kept.ts";
import { realmName, type Polity } from "../polity/polity.ts";

export const VETERAN_EVENTS = {
  /** A realm's discharged came home: with a craft, or owed their pay. */
  home: defineEventType("war.veterans", 3),
};

/** The lands of a realm looked at for a craft to carry home (its most peopled but its seat). */
const LANDS = 4;

export function veteransHome(
  ctx: PopulationContext,
  w: {
    readonly ref: Ref;
    readonly event: Ref;
    readonly attacker: Ref;
    readonly declared: number;
    readonly battles: readonly { readonly fielded?: readonly number[] }[];
    readonly fallen: readonly number[];
  },
  p: Polity,
  peace: Ref,
  year: number,
  _t: SimTime,
): void {
  if (p.ended !== null) return;
  const { world } = ctx,
    side = w.attacker === p.ref ? 0 : 1;
  let most = 0;
  for (const b of w.battles) most = Math.max(most, b.fielded?.[side] ?? 0);
  const discharged = Math.max(0, most - (w.fallen[side] ?? 0));
  if (discharged < VETERANS.crew) return;
  const years = Math.max(1, year - w.declared),
    lands: { cell: number; workers: number }[] = [];
  let workers = 0;
  for (const c of p.members) {
    if (offworldSite(ctx.generated, c)) continue;
    const prov = ctx.provinces.get(c);
    if (!prov) continue;
    const n = Math.max(0, prov.total() - prov.occupation(OCC.dependent));
    if (n <= 0) continue;
    workers += n;
    lands.push({ cell: c, workers: n });
  }
  if (!(workers > 0)) return;
  const revenue = revenueOf(world, p.ref),
    owed = revenue > 0 ? Math.min(1, deficitOf(world, p.ref) / revenue) : 0,
    grievance = veteransGrievance(discharged, workers, owed, years),
    skilled = veteransSkilled(discharged, years),
    lore = loreOf(world);
  // (A craft goes home with them: to the most peopled of its lands, but its seat, where a crew's worth of the skilled live and
  // something its seat knows lies open to it; the first such in the tree's order.)
  let craft: { cell: number; pr: Principle } | null = null;
  const byPeople = lands
    .filter((l) => l.cell !== p.seat && (skilled * l.workers) / workers >= VETERANS.crew)
    .sort((a, b) => b.workers - a.workers || a.cell - b.cell)
    .slice(0, LANDS);
  for (const l of byPeople) {
    const open = openTo(ctx, l.cell).find(
      (pr) => pr.id !== "metalworking" && pr.id !== "cultivation" && !!lore.get(p.seat, pr.id),
    );
    if (!open) continue;
    craft = { cell: l.cell, pr: open };
    break;
  }
  if (!craft && grievance < VETERANS.told) return;
  const event = world.events.emit({
    type: VETERAN_EVENTS.home.type,
    subjects: craft ? [p.ref, w.ref, ctx.provinces.get(craft.cell)!.ref] : [p.ref, w.ref],
    place: ctx.provinces.get(craft ? craft.cell : p.seat)?.ref ?? null,
    causes: [
      { ref: peace, role: "trigger", weight: 1 },
      { ref: w.event, role: "enabler", weight: 0.5 },
    ],
    data: {
      realm: realmName(p),
      men: Math.round(discharged),
      years,
      ...(craft ? { craft: craft.pr.name } : {}),
      ...(grievance >= VETERANS.told ? { owed: Math.round(owed * 100) } : {}),
    },
  });
  if (craft) giveLore(ctx, craft.cell, craft.pr, event);
  if (grievance >= VETERANS.told) for (const l of lands) grieve(world, l.cell, grievance, event);
}
