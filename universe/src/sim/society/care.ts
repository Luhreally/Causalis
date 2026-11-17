// Care of the sick and of the old, year by year (the society sweep; the rules are rules/care.ts, what is kept ./kept.ts).
//   187.society.care, a land every five years in its turn (by its cell and the year): what its households spend on their sick, the
//     healers that keeps, whom they reach (wealth's spread against the temple's alms and its realm's public care), its people near a
//     hospital, and the share of its deaths its care spares; the population's deaths and the sickness's toll read it.
//   187.society.old, a land every five years in its turn: its frail, who keeps them (kin, temple, savings, pension), the share no one
//     keeps (the population's deaths press on its frail by it), and the children more its mothers want for their age (the
//     population's births read it).
//   187.society.provision, a realm a year, its pension and public care weighed once in five years (money/kept.ts LAWS_EVERY): how far
//     it pays its old and its poor's care, and what that costs its treasury (money.ts treasuryYear spends it).
// Nothing is drawn: each is a reckoning from numbers the world keeps.
import { defineEventType, dmath, yearOfMoment, type SimTime } from "../../kernel/index.ts";
import { offworldSite } from "../../gen/index.ts";
import {
  BANDS,
  CARE,
  CARE_OLD,
  HOLD,
  OCC,
  SEXES,
  almsOf,
  careAccess,
  careReach,
  careSpared,
  careSpend,
  frailBand,
  healersPerThousand,
  keptOld,
  pairingOf,
  pensionWanted,
  publicCareWanted,
} from "../../rules/index.ts";
import type { Province } from "../population/model.ts";
import { row } from "../population/model.ts";
import { marketsOf, mouths, type PopulationContext } from "../population/systems.ts";
import type { Market } from "../economy/market.ts";
import { loreOf } from "../lore/lore.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { holdsOf } from "../order/holds.ts";
import { giniOf, lawTurn, LAWS_EVERY, stepped, taxBurden } from "../money/kept.ts";
import {
  CARE_ROW,
  CARE_STORE,
  OLD_ROW,
  OLD_STORE,
  PROVISION,
  PROVISION_STORE,
  provisionOf,
  societyStore,
} from "./kept.ts";

export const CARE_EVENTS = {
  /** A realm first paid its old a pension; first paid the care of the poor its healers did not reach. */
  pensions: defineEventType("society.pensions", 4),
  publicCare: defineEventType("society.public-care", 3),
};

/** A land is weighed once in this many years, in its turn, and stepped those years at once. */
export const SOCIETY_EVERY = 5;
/** Whether a land is weighed this year. */
export const landTurn = (cell: number, year: number): boolean =>
  (cell + year) % SOCIETY_EVERY === 0;

/** What a land's people have and how they live, as the society sweep reads it. */
export type LandMeans = {
  readonly people: number;
  /** Its workers' share of its people; what a worker's year earns and what keeps him and his (grain's worth). */
  readonly workers: number;
  readonly earns: number;
  readonly living: number;
  /** What its bread costs of its earnings (0 … 1), and what it has over its bread (0 … 1). */
  readonly need: number;
  readonly surplus: number;
  /** The share of its people in its towns, its Gini. */
  readonly towns: number;
  readonly gini: number;
};

/** A land's means (null where no one lives). */
export function landMeans(
  ctx: PopulationContext,
  p: Province,
  m: Market | undefined,
): LandMeans | null {
  const people = p.total();
  if (people <= 0) return null;
  const workers = Math.max(1, people - p.occupation(OCC.dependent));
  let earned = 0,
    hands = 0;
  if (m)
    for (const o of [OCC.forager, OCC.farmer, OCC.herder, OCC.crafter, OCC.trader]) {
      const n = p.occupation(o);
      earned += n * (m.wage[o] ?? 0);
      hands += n;
    }
  const price = m?.price[0] ?? 1,
    living = ((12 * mouths(p, ctx.life)) / workers) * price,
    earns = Math.max(living, hands > 0 ? earned / hands : living),
    need = earns > 0 ? dmath.clamp(living / earns, 0, 1) : 1;
  let town = 0;
  for (const s of ctx.settlements.inProvince(p.cell)) town += s.population;
  return {
    people,
    workers: workers / people,
    earns,
    living,
    need,
    surplus: 1 - need,
    towns: dmath.clamp(town / people, 0, 1),
    gini: giniOf(ctx.world, p.cell) ?? 0.35,
  };
}

/** The share of a land's people living in towns large enough to keep a hospital, where medicine is known (0 … 1). */
function nearHospital(ctx: PopulationContext, cell: number, people: number): number {
  if (!loreOf(ctx.world).get(cell, "medicine")) return 0;
  let n = 0;
  for (const s of ctx.settlements.inProvince(cell))
    if (s.population >= CARE.hospitalTown) n += s.population;
  return dmath.clamp(n / Math.max(1, people), 0, 1);
}

// —— 187.society.care ————————————————————————————————————————————————————————————————————————————————————

export function careYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = societyStore(world, CARE_STORE);
  if (!store) return;
  const year = yearOfMoment(t),
    markets = marketsOf(world),
    lore = loreOf(world),
    culture = cultureOf(world),
    realms = politiesOf(world);
  for (const p of ctx.provinces.all()) {
    const c = p.cell;
    if (store.get(c) && !landTurn(c, year)) continue;
    const means = landMeans(ctx, p, markets.get(c));
    if (!means) {
      store.drop(c);
      continue;
    }
    const spend = careSpend(means.surplus),
      healers = healersPerThousand(spend, means.workers),
      reach = careReach(healers),
      alms = almsOf(culture.get(c)?.traits[WAY.piety] ?? 0.5),
      realm = realms.of(c),
      publicCare = realm ? provisionOf(world, realm.ref).publicCare : 0,
      { access, effective } = careAccess(reach, means.gini, alms, publicCare),
      known = lore.effect(c, "health"),
      hospitals = nearHospital(ctx, c, means.people),
      spared = careSpared(known, hospitals, effective),
      drained = lore.get(c, "sanitation") ? means.towns : 0;
    store.set(c, [
      spend * 10_000,
      healers * 10,
      reach * 1000,
      access * 1000,
      effective * 1000,
      alms * 1000,
      publicCare * 1000,
      Math.min(CARE.most, known) * 1000,
      hospitals * 1000,
      spared * 1000,
      drained * 1000,
    ]);
  }
}

// —— 187.society.old ————————————————————————————————————————————————————————————————————————————————————

/** A land's frail and its grown under the frail age (whole people). */
function frailCount(p: Province, adulthood: number, bands: readonly number[], frail: number) {
  let old = 0,
    grown = 0;
  for (let s = 0; s < SEXES; s++)
    for (let b = 0; b < BANDS; b++) {
      const n = p.counts.rowSum(row(s, b));
      if (b >= frail) old += n;
      else if (bands[b]! >= adulthood) grown += n;
    }
  return { old, grown };
}

export function oldYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = societyStore(world, OLD_STORE);
  if (!store) return;
  const year = yearOfMoment(t),
    life = ctx.life,
    frail = frailBand(life),
    pairing = pairingOf(ctx.generated.life.people?.body, life.adulthood),
    markets = marketsOf(world),
    lore = loreOf(world),
    culture = cultureOf(world),
    realms = politiesOf(world);
  for (const p of ctx.provinces.all()) {
    const c = p.cell;
    if (store.get(c) && !landTurn(c, year)) continue;
    const means = landMeans(ctx, p, markets.get(c));
    if (!means) {
      store.drop(c);
      continue;
    }
    const { old, grown } = frailCount(p, life.adulthood, life.bands, frail),
      ways = culture.get(c),
      realm = realms.of(c),
      kept = keptOld({
        pairing,
        kinship: ways?.traits[WAY.kinship] ?? 0.5,
        towns: means.towns,
        support: old > 0 ? grown / old : 10,
        piety: ways?.traits[WAY.piety] ?? 0.5,
        money: lore.get(c, "banking") ? 1 : lore.get(c, "currency") ? 0.4 : 0,
        surplus: means.surplus,
        gini: means.gini,
        pension: realm ? provisionOf(world, realm.ref).pension : 0,
      });
    store.set(c, [
      (1000 * old) / means.people,
      frail,
      kept.kin * 1000,
      kept.temple * 1000,
      kept.savings * 1000,
      kept.pension * 1000,
      kept.neglected * 1000,
      kept.security * 1000,
      kept.want * 1000,
      kept.press * 1000,
      old > 0 ? Math.min(999, (10 * grown) / old) : 999,
    ]);
  }
}

// —— 187.society.provision ——————————————————————————————————————————————————————————————————————————————

export function provisionYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = societyStore(world, PROVISION_STORE),
    care = societyStore(world, CARE_STORE),
    olds = societyStore(world, OLD_STORE);
  if (!store || !care || !olds) return;
  const year = yearOfMoment(t),
    lore = loreOf(world),
    markets = marketsOf(world),
    living = [...politiesOf(world).living()].sort((a, b) => (a.ref < b.ref ? -1 : 1)),
    alive = new Set<string>(living.map((p) => p.ref));
  for (const k of store.keys()) if (!alive.has(k)) store.drop(k);
  for (const p of living) {
    const was = store.get(p.ref),
      turn = !was || lawTurn(p, year);
    // Its lands' old and untended, and what a pension and their care would cost (grain's worth a year).
    let people = 0,
      old = 0,
      kin = 0,
      untended = 0,
      pensionAll = 0,
      careAll = 0;
    for (const c of p.members) {
      const prov = ctx.provinces.get(c),
        cr = care.get(c),
        or = olds.get(c);
      if (!prov || !cr || !or) continue;
      const n = prov.total(),
        means = landMeans(ctx, prov, markets.get(c));
      if (!means || n <= 0) continue;
      const frail = (n * or[OLD_ROW.share]!) / 1000,
        off = n * (1 - cr[CARE_ROW.access]! / 1000);
      people += n;
      old += frail;
      kin += frail * (or[OLD_ROW.kin]! / 1000);
      untended += off;
      // (A pension of half a living a year for each frail one; the care its untended would buy at what its households spend on theirs.)
      pensionAll += frail * means.living * CARE_OLD.pension;
      careAll += off * (cr[CARE_ROW.spend]! / 10_000) * means.earns * means.workers;
    }
    if (people <= 0) {
      store.drop(p.ref);
      continue;
    }
    const voice = holdsOf(world, p.ref)[HOLD.voice]!,
      roll = !!lore.get(p.seat, "writing") && !!lore.get(p.seat, "bureaucracy"),
      sides = {
        voice,
        roll,
        old: old / people,
        kin: old > 0 ? kin / old : 1,
        untended: untended / people,
        burden: taxBurden(world, p.ref),
      };
    let pension = (was?.[PROVISION.pension] ?? 0) / 1000,
      publicCare = (was?.[PROVISION.publicCare] ?? 0) / 1000,
      told = was?.[PROVISION.told] ?? 0;
    if (turn) {
      const years = was ? LAWS_EVERY : 1,
        pw = pensionWanted(sides),
        cw = publicCareWanted(sides),
        pace = stepped(0.15, years);
      pension = dmath.clamp(pension + pace * (pw.level - pension), 0, 1);
      publicCare = dmath.clamp(publicCare + pace * (cw.level - publicCare), 0, 1);
      const place = ctx.provinces.get(p.seat)?.ref ?? null;
      for (const [bit, level, w, type] of [
        [1, pension, pw, CARE_EVENTS.pensions.type],
        [2, publicCare, cw, CARE_EVENTS.publicCare.type],
      ] as const) {
        if (told & bit || level < 0.2) continue;
        told |= bit;
        const decision = world.decisions.record({
          rule: type,
          subject: p.ref,
          outcome: { level: Math.round(level * 100) },
          score: w.level,
          threshold: 0.2,
          factors: w.parts.map(([name, v]) => ({
            name,
            value: Math.round(v * 100) / 100,
            contribution: v,
            source: null,
          })),
        });
        world.events.emit({
          type,
          subjects: [p.ref],
          place,
          causes: [{ ref: decision, role: "trigger", weight: 1 }],
          data: {
            realm: realmName(p),
            level: Math.round(level * 100),
            old: Math.round((1000 * old) / people) / 10,
          },
        });
      }
    }
    store.set(p.ref, [
      pension * 1000,
      pension * pensionAll,
      publicCare * 1000,
      publicCare * careAll,
      (1000 * old) / people,
      (1000 * untended) / people,
      voice * 1000,
      roll ? 1 : 0,
      told,
    ]);
  }
}

/** The realm a land's provision comes from (for pages). */
export function provisionRealm(ctx: PopulationContext, cell: number): Polity | null {
  return politiesOf(ctx.world).of(cell) ?? null;
}

/** Whether a land lies on another world's halls (its climate is the halls'). */
export function inHalls(ctx: PopulationContext, cell: number): boolean {
  return !!offworldSite(ctx.generated, cell);
}
