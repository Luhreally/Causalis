// How a land bears its years (asked 2026-11-22: "mental health ... then a per-land number, if it can feed something real"; the rule
// is rules/self.ts landStrainOf, what is kept ./strain-kept.ts). 187.society.strain, a land every five years in its turn (as the
// care of its sick is): its deaths these five years against what its people are used to, a foe holding it, its leanest month and
// its realm's idle hands, those of it held in bondage or on the street, against its healers' reach, its clergy and how closely its
// kind lives. What flows back: a land worn so makes the less at its crafts (trade/kept.ts craftsKept). Nothing is drawn; a person's
// own mind is read on their page (host/self.ts), never kept.
import { yearOfMoment, type SimTime } from "../../kernel/index.ts";
import { STRAIN, landStrainOf, selfNature } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { homePlanet } from "../planet/store.ts";
import { politiesOf } from "../polity/polity.ts";
import { orderOf } from "../order/order.ts";
import { occupationOf } from "../war/occupation.ts";
import { clergyIn } from "../order/institutions-kept.ts";
import { idleOf } from "../trade/kept.ts";
import { CARE_ROW, CARE_STORE, societyStore, streetOf } from "./kept.ts";
import { landTurn, SOCIETY_EVERY } from "./care.ts";
import { STRAIN_ROW, STRAIN_STORE } from "./strain-kept.ts";

export function strainYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = societyStore(world, STRAIN_STORE);
  if (!store) return;
  const year = yearOfMoment(t),
    nature = selfNature(homePlanet(world).generated.life.people?.body),
    care = societyStore(world, CARE_STORE),
    order = orderOf(world),
    occupied = occupationOf(world),
    realms = politiesOf(world);
  for (const p of ctx.provinces.all()) {
    const c = p.cell,
      had = store.get(c);
    if (had && !landTurn(c, year)) continue;
    const people = p.total();
    if (people <= 0) {
      store.drop(c);
      continue;
    }
    let dead = 0;
    for (let y = year - SOCIETY_EVERY; y < year; y++) dead += ctx.history.deathsIn(c, y);
    const deaths = dead / SOCIETY_EVERY / people,
      // (What its people are used to: a land first reckoned is used to what it has.)
      usual = had
        ? (had[STRAIN_ROW.usual]! / 1e6) * (1 - STRAIN.usual) + deaths * STRAIN.usual
        : deaths,
      realm = realms.of(c),
      last = ctx.history.yearsOf(c).at(-1),
      s = landStrainOf({
        nature,
        deaths,
        usual: had ? had[STRAIN_ROW.usual]! / 1e6 : deaths,
        occupied: !!occupied?.of(c),
        fed: last ? last.fed / 1000 : 1,
        idle: realm ? idleOf(world, realm.ref) : 0,
        bound: order?.bound(c) ?? 0,
        street: streetOf(world, c),
        care: (care?.at(c, CARE_ROW.effective) ?? 0) / 1000,
        clergy: clergyIn(world, c),
      });
    store.set(c, [
      s.strain * 1000,
      s.weights.loss * 1000,
      s.weights.war * 1000,
      s.weights.want * 1000,
      s.weights.place * 1000,
      s.held * 1000,
      deaths * 1e6,
      usual * 1e6,
    ]);
  }
}
