// Higher learning (rules/academy.ts), land by land: once in ten years in the land's own year (five years off its readers' turn), what
// its patrons give to keeping scholars (its faith's temple, of its faithful's givings there; its realm's seat, of its tithe, where it
// is the seat; the great houses seated there, of what they take in), how many of its readers its fields spare for study, and its
// learned coming a generation's way toward what they keep. Read where a land inquires (sim/lore/lore.ts inquiresMore), where its
// healers spare its sick (sim/health healsMore) and where its seat's reach is weighed (order.ts addsReach). One row a land.
import { YEAR, yearOfMoment, type SimTime, type World } from "../../kernel/index.ts";
import {
  G,
  OCC,
  academyFunds,
  learnedAfter,
  learnedHealing,
  learnedInquiry,
  learnedReach,
  scholarsTarget,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { Province } from "../population/model.ts";
import type { MarketStore } from "../economy/market.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { beliefOf } from "../belief/belief.ts";
import { templeOf } from "../belief/temple.ts";
import { housesOf } from "../order/houses.ts";
import { addsReach } from "../order/order.ts";
import { healsMore } from "../health/health.ts";
import { ACADEMY_ROW, ACADEMY_STORE, cultureRows } from "../culture/rows.ts";
import { inquiresMore, loreOf } from "./lore.ts";
import { readersOf } from "./letters.ts";
import { orgCloisterKeepsOf } from "../order/groups-kept.ts";

/** A land weighs its higher learning once in so many years, each in its own year. */
export const ACADEMY_EVERY = 10;
/** Of its turn, the year off its readers' (sim/lore/letters.ts LETTERS_EVERY). */
const OFFSET = 5;

/** What each of a land's patrons has to spare a year (grain), and what makes its scholars: pure reads of the world. */
export function patronsOf(
  ctx: PopulationContext,
  p: Province,
): {
  temple: number;
  seat: number;
  houses: number;
  script: boolean;
  readers: number;
  spare: number;
} {
  const { world } = ctx,
    cell = p.cell,
    people = p.total();
  // The temple: the land's part of what its faith was given.
  let temple = 0;
  if (world.hasStore("belief.faiths")) {
    const faith = beliefOf(world).of(cell).faith,
      f = faith ? beliefOf(world).get(faith) : undefined,
      t = f ? templeOf(world, f) : null;
    if (t && t.faithful > 0) temple = (t.given * people) / t.faithful;
  }
  // (And a monastic order's house on it, sim/order/groups.ts: what it keeps for its learning. Nothing where none is kept.)
  const cloister = orgCloisterKeepsOf(world, cell);
  if (cloister > 0) temple += cloister;
  // The seat: what its tithe brings in from its lands, where this land is a realm's seat.
  let seat = 0,
    houses = 0;
  const realm: Polity | undefined = world.hasStore("polity.states")
    ? politiesOf(world).of(cell)
    : undefined;
  if (realm && realm.seat === cell) {
    const markets = world.store<MarketStore>("economy.markets");
    for (const c of realm.members)
      seat += (markets.get(c)?.years.at(-1)?.ledger[0]?.[G.grain] ?? 0) * realm.tribute;
  }
  // The great houses seated here: what they take in.
  if (realm)
    for (const h of housesOf(world)?.of(realm.ref)?.houses ?? [])
      if (h.seat === cell) houses += Math.max(0, h.income);
  const working = people - p.occupation(OCC.dependent),
    food = p.occupation(OCC.forager) + p.occupation(OCC.farmer) + p.occupation(OCC.herder);
  return {
    temple,
    seat,
    houses,
    script: loreOf(world).effect(cell, "writing") > 0,
    readers: readersOf(world, cell),
    spare: working > 0 ? Math.max(0, working - food) / working : 0,
  };
}

/** A land's higher learning as last weighed, or null. */
export function academyOf(
  world: World,
  cell: number,
): {
  learned: number;
  target: number;
  temple: number;
  seat: number;
  houses: number;
  at: number;
} | null {
  const row = cultureRows(world, ACADEMY_STORE)?.get(cell);
  if (!row) return null;
  return {
    learned: row[ACADEMY_ROW.learned]! / 1e5,
    target: row[ACADEMY_ROW.target]! / 1e5,
    temple: row[ACADEMY_ROW.temple]!,
    seat: row[ACADEMY_ROW.seat]!,
    houses: row[ACADEMY_ROW.houses]!,
    at: row[ACADEMY_ROW.at]!,
  };
}

/** The share of a land's people learned past their letters (0 … 1), as last weighed. Only reads. */
export function learnedOf(world: World, cell: number): number {
  return (cultureRows(world, ACADEMY_STORE)?.at(cell, ACADEMY_ROW.learned) ?? 0) / 1e5;
}

/** The year's higher learning: each peopled land in its year of ten comes the years' way toward what its patrons keep. */
export function academyYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    rows = cultureRows(world, ACADEMY_STORE);
  if (!rows) return;
  const year = yearOfMoment(t),
    span = ctx.generated.life.people?.body.span ?? 70,
    foodAYear = 12 * ctx.life.appetite;
  for (const p of ctx.provinces.all()) {
    if ((year + p.cell + OFFSET) % ACADEMY_EVERY !== 0) continue;
    const row = rows.get(p.cell),
      people = p.total();
    if (!people) {
      if (row) rows.drop(p.cell);
      continue;
    }
    const s = patronsOf(ctx, p),
      funds = academyFunds(s.temple, s.seat, s.houses),
      target = scholarsTarget(s.script, funds, foodAYear, people, s.readers, s.spare);
    if (!row && target <= 0) continue;
    const years = row
        ? Math.min(5 * ACADEMY_EVERY, Math.max(1, year - row[ACADEMY_ROW.at]!))
        : ACADEMY_EVERY,
      learned = learnedAfter(row ? row[ACADEMY_ROW.learned]! / 1e5 : 0, target, years, span);
    if (row && learned < 1e-6 && target <= 0) {
      rows.drop(p.cell);
      continue;
    }
    rows.set(p.cell, [
      Math.round(learned * 1e5),
      Math.round(target * 1e5),
      Math.round(s.temple),
      Math.round(s.seat),
      Math.round(s.houses),
      year,
    ]);
  }
}

/** A seat's learned clerks and judges, as a part of its reach. */
function academyReach(ctx: PopulationContext, p: Polity) {
  const r = learnedReach(learnedOf(ctx.world, p.seat));
  return r > 0.0005
    ? [{ name: "learned clerks and judges at its seat", value: r, contribution: r, source: null }]
    : [];
}

/** How much more readily a land inquires for its learned. */
const inquiryBy = (world: World, cell: number): number => learnedInquiry(learnedOf(world, cell));
/** How much further its physicians carry what a land knows of healing. */
const healingBy = (world: World, cell: number): number => learnedHealing(learnedOf(world, cell));

/** Teach a peopled world its higher learning. */
export function installAcademies(world: World, ctx: () => PopulationContext): void {
  world.system({ key: "157.lore.academies", every: YEAR, run: (t) => academyYear(ctx(), t) });
  inquiresMore(inquiryBy);
  healsMore(healingBy);
  addsReach(academyReach);
}
