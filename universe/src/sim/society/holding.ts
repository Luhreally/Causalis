// What a realm's law holds to, year by year (the society sweep; the rule is rules/holding.ts, what is kept ./kept.ts).
//   187.society.law, a realm a year, weighed once in five (money/kept.ts LAWS_EVERY): how far its law is written (law-codes, its clerks'
//     and roads' reach, its readers), how likely its ruler is to take what its people hold (force without voice, officers bought,
//     what binds him, a treasury short), how safe a holding is (that, and its courts' reach), how far a deal is held to (by its courts,
//     or among kin and those who know each other), and what a tiller keeps of what he puts into his land (its land law).
//   187.society.holdings, a land every five years in its turn, stepped five years at once: what its holders have put into its fields,
//     built toward what is worth it as far as it is safe and theirs, worn by the years and by battles fought on it. Its fields yield the
//     more for it (systems.ts foodMonth, farmingShare); and its trade with another land moves as far as both keep their deals
//     (economy/systems.ts trade).
// Nothing is drawn.
import { defineEventType, yearOfMoment, type SimTime } from "../../kernel/index.ts";
import {
  COURTS,
  HOLD,
  TENURE,
  contractsKept,
  holdingSecure,
  improveTarget,
  improvedStep,
  lawWritten,
  seizureRisk,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { loreOf } from "../lore/lore.ts";
import { readersOf } from "../lore/letters.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { politiesOf, realmName } from "../polity/polity.ts";
import { capacityOf, orderOf } from "../order/order.ts";
import { holdsOf } from "../order/holds.ts";
import { LAW_OF } from "../order/laws.ts";
import { warsOf } from "../war/war.ts";
import { deficitOf, lawTurn, revenueOf } from "../money/kept.ts";
import { HOLDINGS, HOLDINGS_STORE, LAW_ROW, LAW_STORE, societyStore } from "./kept.ts";
import { SOCIETY_EVERY, landTurn } from "./care.ts";

export const HOLDING_EVENTS = {
  /** A realm's law came to be written: its judges judge by it more than by custom. */
  written: defineEventType("society.written", 4),
};

// —— 187.society.law ———————————————————————————————————————————————————————————————————————————————————

export function lawYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = societyStore(world, LAW_STORE);
  if (!store) return;
  const year = yearOfMoment(t),
    lore = loreOf(world),
    culture = cultureOf(world),
    order = orderOf(world),
    living = [...politiesOf(world).living()].sort((a, b) => (a.ref < b.ref ? -1 : 1)),
    alive = new Set<string>(living.map((p) => p.ref));
  for (const k of store.keys()) if (!alive.has(k)) store.drop(k);
  for (const p of living) {
    const was = store.get(p.ref);
    if (was && !lawTurn(p, year)) continue;
    const o = order?.of(p.ref),
      held = holdsOf(world, p.ref),
      capacity = capacityOf(ctx, p).value,
      written = lawWritten(
        !!lore.get(p.seat, "law-codes"),
        lore.effect(p.seat, "writing") > 0,
        capacity,
        readersOf(world, p.seat),
      ),
      corruption = o?.corruption ?? 0,
      revenue = revenueOf(world, p.ref),
      short = revenue > 0 ? deficitOf(world, p.ref) / revenue : 0,
      seized = seizureRisk({
        force: held[HOLD.force]!,
        voice: held[HOLD.voice]!,
        corruption,
        written,
        short,
      }),
      courts = COURTS[o?.laws[LAW_OF.justice] ?? 0] ?? COURTS[0],
      secure = holdingSecure(seized.risk, courts, capacity),
      deals = contractsKept(
        courts,
        written,
        corruption,
        capacity,
        held[HOLD.trust]!,
        culture.get(p.seat)?.traits[WAY.kinship] ?? 0.5,
      ),
      tenure = TENURE[o?.laws[LAW_OF.land] ?? 0] ?? TENURE[0];
    let told = was?.[LAW_ROW.told] ?? 0;
    if (written >= 0.5 && !(told & 1)) {
      told |= 1;
      const codes = lore.get(p.seat, "law-codes"),
        decision = world.decisions.record({
          rule: HOLDING_EVENTS.written.type,
          subject: p.ref,
          outcome: { written: Math.round(written * 100) },
          score: written,
          threshold: 0.5,
          factors: [
            {
              name: "law-codes known at its seat",
              value: codes ? 1 : 0,
              contribution: 0.4,
              source: codes ? { ref: codes.event, role: "enabler", weight: 1 } : null,
            },
            {
              name: "how far its clerks and roads reach",
              value: Math.round(capacity * 100) / 100,
              contribution: 0.6 * capacity,
              source: null,
            },
          ],
        });
      world.events.emit({
        type: HOLDING_EVENTS.written.type,
        subjects: [p.ref],
        place: ctx.provinces.get(p.seat)?.ref ?? null,
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: { realm: realmName(p), written: Math.round(written * 100) },
      });
    }
    store.set(p.ref, [
      written * 1000,
      seized.risk * 1000,
      ...seized.parts.map(([, v]) => v * 1000),
      secure * 1000,
      deals.kept * 1000,
      deals.byCourts * 1000,
      deals.byKin * 1000,
      courts * 1000,
      tenure * 1000,
      told,
    ]);
  }
}

// —— 187.society.holdings ——————————————————————————————————————————————————————————————————————————————

export function holdingsYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = societyStore(world, HOLDINGS_STORE),
    laws = societyStore(world, LAW_STORE);
  if (!store || !laws) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world);
  let fought: Map<number, number> | null = null;
  for (const p of ctx.provinces.all()) {
    const c = p.cell,
      was = store.get(c);
    if (was && !landTurn(c, year)) continue;
    const realm = realms.of(c),
      law = realm ? laws.get(realm.ref) : undefined;
    if (p.total() <= 0) {
      store.drop(c);
      continue;
    }
    if (!law) {
      // (A land no realm holds keeps what was put into it, wearing, and none is put in: nothing holds it safe; its deals are held
      // to only among kin and those who know each other.)
      const improved = was
          ? improvedStep(was[HOLDINGS.improved]! / 10_000, 0, SOCIETY_EVERY, 0)
          : 0,
        kin = contractsKept(
          0,
          0,
          0,
          0,
          holdsOf(world, null)[HOLD.trust]!,
          cultureOf(world).get(c)?.traits[WAY.kinship] ?? 0.5,
        );
      store.set(c, [improved * 10_000, 0, 0, 0, kin.kept * 1000]);
      continue;
    }
    // (The battles fought on its lands in the years since it was last weighed: read once a year, for every land at once.)
    fought ??= battleYears(ctx, year);
    const secure = law[LAW_ROW.secure]! / 1000,
      tenure = law[LAW_ROW.tenure]! / 1000,
      target = improveTarget(secure, tenure),
      improved = improvedStep(
        (was?.[HOLDINGS.improved] ?? 0) / 10_000,
        target,
        was ? SOCIETY_EVERY : 1,
        Math.min(SOCIETY_EVERY, fought.get(c) ?? 0),
      );
    store.set(c, [
      improved * 10_000,
      target * 10_000,
      secure * 10_000,
      tenure * 10_000,
      law[LAW_ROW.deals]!,
    ]);
  }
}

/** The years in which a battle was fought on each land, of the last SOCIETY_EVERY. */
function battleYears(ctx: PopulationContext, year: number): Map<number, number> {
  const out = new Map<number, Set<number>>();
  for (const { b } of warsOf(ctx.world).battlesIn(year - SOCIETY_EVERY + 1, year + 1)) {
    let s = out.get(b.land);
    if (!s) out.set(b.land, (s = new Set()));
    s.add(b.year);
  }
  return new Map([...out].map(([k, s]) => [k, s.size]));
}
