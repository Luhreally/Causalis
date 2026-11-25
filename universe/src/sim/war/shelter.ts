// Civil defence, realm by realm (rules/civildefence.ts): what the strikes on its towns have cost it, remembered; after each
// strike, whether cover for its townspeople is worth the work, and so how many it covers; and of those the next strike would
// kill, those spared. Nothing runs in a year without a strike: a realm never struck keeps no row.
import {
  defineEventType,
  yearOfMoment,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { DEFENCE, coverBuilt, defenceFade, defenceWorth } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { SHELTER_ROW, SHELTER_STORE, cultureRows } from "../culture/rows.ts";
import { FISC, TREASURY_STORE, moneyStore } from "../money/kept.ts";
import { capacityOf } from "../order/order.ts";
import { realmName, type Polity } from "../polity/polity.ts";

export const SHELTER_EVENTS = {
  /** A realm gives its struck towns' people cover (or much more of it than it had). */
  built: defineEventType("war.shelter", 4),
};

/** The share of its struck towns' people a realm has under cover (0 … 1; exactly 0 where it was never struck). */
export function shelterCover(world: World, realm: Ref): number {
  return (cultureRows(world, SHELTER_STORE)?.at(realm, SHELTER_ROW.cover) ?? 0) / 1000;
}

/**
 * A strike fell on a town of `p`'s, of `people`, that would have killed `raw` with no cover (`event`: the strike): remembered,
 * and its cover weighed anew. Where its cover rises by DEFENCE.told or more, a decision and an event citing the strike, and
 * its treasury pays the work (a working year: a year's grain for one).
 */
export function noteStruck(
  ctx: PopulationContext,
  p: Polity,
  people: number,
  raw: number,
  event: Ref,
  t: SimTime,
): void {
  const { world } = ctx,
    store = cultureRows(world, SHELTER_STORE);
  if (!store || !(people > 0)) return;
  const year = yearOfMoment(t),
    row = store.get(p.ref),
    since = row ? year - row[SHELTER_ROW.at]! : 0,
    dead = defenceFade(row?.[SHELTER_ROW.dead] ?? 0, since) + raw,
    struck = defenceFade(row?.[SHELTER_ROW.people] ?? 0, since) + people,
    had = (row?.[SHELTER_ROW.cover] ?? 0) / 1000,
    told = (row?.[SHELTER_ROW.told] ?? 0) / 1000,
    span = ctx.generated.life.people?.body.span ?? 70,
    share = dead / struck,
    w = defenceWorth(share, span),
    capacity = capacityOf(ctx, p).value,
    // (Cover once built stands while the danger is remembered: it does not fall with one light raid.)
    cover = Math.max(coverBuilt(w.worth, capacity), defenceFade(had, since));
  // (What was told stands until its cover has fallen to half of it: a long air war is not told anew with every raid.)
  let nowTold = cover < told / 2 ? cover : told;
  if (cover >= told + DEFENCE.told) {
    const factors: Factor[] = [
        {
          name: "the working years its strikes would take of each of its struck towns' people, were they spared",
          value: Math.round(share * 10000) / 10000,
          contribution: w.lives,
          source: { ref: event, role: "pressure", weight: 1 },
        },
        {
          name: "the work of giving one of them cover",
          value: w.work,
          contribution: -w.work,
          source: null,
        },
        {
          name: "how far its seat's will is done in its lands",
          value: Math.round(capacity * 100) / 100,
          contribution: 0,
          source: null,
        },
      ],
      decision = world.decisions.record({
        rule: "war.shelter",
        subject: p.ref,
        outcome: { cover: Math.round(cover * 100) },
        score: w.worth,
        threshold: 1,
        factors,
      }),
      // (Its treasury pays the work of the new cover, for as many as this town's people: a working year, a year's grain.)
      cost = Math.round((cover - had) * people * DEFENCE.work * 12),
      fisc = moneyStore(world, TREASURY_STORE),
      purse = fisc?.get(p.ref);
    if (fisc && purse && cost > 0) {
      const next = [...purse];
      next[FISC.reserve] = Math.max(0, purse[FISC.reserve]! - cost);
      fisc.set(p.ref, next);
    }
    world.events.emit({
      type: SHELTER_EVENTS.built.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes: [
        { ref: decision, role: "trigger", weight: 1 },
        { ref: event, role: "pressure", weight: 0.8 },
      ],
      data: {
        realm: realmName(p),
        cover: Math.round(cover * 100),
        dead: Math.round(share * 1000),
        cost,
        ...(told > 0 ? { more: true } : {}),
      },
    });
    nowTold = cover;
  }
  const next: number[] = [];
  next[SHELTER_ROW.dead] = dead;
  next[SHELTER_ROW.people] = struck;
  next[SHELTER_ROW.at] = year;
  next[SHELTER_ROW.cover] = cover * 1000;
  next[SHELTER_ROW.told] = nowTold * 1000;
  store.set(p.ref, next);
}
