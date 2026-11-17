// A faith's houses (rules/temple.ts), faith by faith, each year: what the devout of each of its lands give it of their harvest,
// what keeps its clergy and what is laid up in its granaries, what it gives out to its lands gone hungry, and how far its clergy
// teach. Its granaries are grain taken from its lands' markets in good years and given back to its hungry lands in bad ones,
// wherever they lie; its teaching counts as a school in a land of its faith (sim/lore/letters.ts teachesAsSchool). One row a
// faith that has lands; nothing a person, nothing that grows with history.
import { YEAR, yearOfMoment, type SimTime, type World } from "../../kernel/index.ts";
import {
  FOODS,
  G,
  TEMPLE,
  clergyKept,
  creedHeld,
  granaryAfter,
  scriptureOfTenet,
  templeGiving,
  templeTeaching,
} from "../../rules/index.ts";
import { mouths, type PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { teachesAsSchool } from "../lore/letters.ts";
import { refNumber } from "../money/kept.ts";
import { TEMPLE_ROW, TEMPLE_STORE, cultureRows } from "../culture/rows.ts";
import { beliefOf, type Faith } from "./belief.ts";

/** What a faith's lands gave and need this year, gathered before its granary is reckoned. */
type FaithYear = { given: number; laid: number; faithful: number; lands: number; hungry: number[] };

/** A faith's houses as last reckoned, or null where it has none yet. */
export function templeOf(
  world: World,
  faith: Faith,
): {
  clergy: number;
  granary: number;
  given: number;
  relief: number;
  teaching: number;
  faithful: number;
  lands: number;
  since: number;
} | null {
  const row = cultureRows(world, TEMPLE_STORE)?.get(refNumber(faith.ref));
  if (!row) return null;
  return {
    clergy: row[TEMPLE_ROW.clergy]!,
    granary: row[TEMPLE_ROW.granary]!,
    given: row[TEMPLE_ROW.given]!,
    relief: row[TEMPLE_ROW.relief]!,
    teaching: row[TEMPLE_ROW.teaching]! / 1000,
    faithful: row[TEMPLE_ROW.faithful]!,
    lands: row[TEMPLE_ROW.lands]!,
    since: row[TEMPLE_ROW.since]!,
  };
}

/** How far the clergy of a land's faith teach there (0 … 1), as last reckoned. Only reads. */
export function templeTeachingIn(world: World, cell: number): number {
  const rows = cultureRows(world, TEMPLE_STORE);
  if (!rows || !world.hasStore("belief.faiths")) return 0;
  const faith = beliefOf(world).of(cell).faith;
  return faith ? rows.at(refNumber(faith), TEMPLE_ROW.teaching) / 1000 : 0;
}

/** The share of a land's clergy that carry a faith's word there (clergy to the faithful, 0 … 1 of a teaching clergy). */
export function pulpitIn(world: World, cell: number): number {
  const rows = cultureRows(world, TEMPLE_STORE);
  if (!rows || !world.hasStore("belief.faiths")) return 0;
  const faith = beliefOf(world).of(cell).faith,
    row = faith ? rows.get(refNumber(faith)) : undefined;
  if (!row || !row[TEMPLE_ROW.faithful]) return 0;
  return Math.min(1, row[TEMPLE_ROW.clergy]! / row[TEMPLE_ROW.faithful]! / TEMPLE.teachAt);
}

/** The year's houses of faith: what each land gives, what each faith lays up, gives the hungry, and teaches. */
export function templeYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    rows = cultureRows(world, TEMPLE_STORE);
  if (!rows || !world.hasStore("belief.faiths")) return;
  const faiths = beliefOf(world),
    culture = cultureOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    year = yearOfMoment(t),
    span = ctx.generated.life.people?.body.span ?? 70,
    foodAYear = 12 * ctx.life.appetite,
    byFaith = new Map<string, FaithYear>();
  // 1. Each land of a faith gives of its last harvest, never from the food it needs to come through the year.
  for (const p of ctx.provinces.all()) {
    const n = p.total();
    if (!n) continue;
    const b = faiths.of(p.cell);
    if (!b.faith) continue;
    let fy = byFaith.get(b.faith);
    if (!fy) byFaith.set(b.faith, (fy = { given: 0, laid: 0, faithful: 0, lands: 0, hungry: [] }));
    fy.faithful += n;
    fy.lands++;
    const famine = p.lastFamine ? world.events.get(p.lastFamine) : undefined;
    if (famine && t - famine.t < YEAR) {
      fy.hungry.push(p.cell);
      continue;
    }
    const m = markets.get(p.cell),
      ways = culture.get(p.cell);
    if (!m || !ways) continue;
    const share = templeGiving(ways.traits[WAY.piety]!, creedHeld(year - b.since, span));
    if (share <= 0) continue;
    const made = m.years.at(-1)?.ledger[0]?.[G.grain] ?? 0,
      spare = Math.max(0, m.food(FOODS) - mouths(p, ctx.life) * 12),
      given = Math.min(m.stock[G.grain]!, Math.floor(Math.min(spare, made * share)));
    if (given <= 0) continue;
    // (What keeps its clergy is eaten where they are; what is laid up leaves the land's market for the faith's granaries.)
    const laid = given - Math.floor(given * TEMPLE.kept);
    if (laid > 0) markets.sendApart("granaries", m, G.grain, laid);
    fy.given += given;
    fy.laid += laid;
  }
  // 2. Each faith's granaries: what rots, what was laid up, what its hungry lands are given (the hungriest first).
  for (const f of [...faiths.all()].sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0))) {
    const fy = byFaith.get(f.ref),
      serial = refNumber(f.ref),
      row = rows.get(serial);
    if (!fy) {
      if (row) rows.drop(serial);
      continue;
    }
    let granary = granaryAfter(row ? row[TEMPLE_ROW.granary]! : 0, fy.laid, 0, 1),
      relief = 0;
    const needs = fy.hungry
      .map((c) => ({
        c,
        need: Math.floor(mouths(ctx.provinces.get(c)!, ctx.life) * TEMPLE.reliefMonths),
      }))
      .sort((a, b) => b.need - a.need || a.c - b.c);
    for (const { c, need } of needs) {
      const n = Math.min(need, Math.floor(granary));
      if (n <= 0) break;
      markets.bringFromApart("granaries", markets.of(c), G.grain, n);
      granary -= n;
      relief += n;
    }
    const clergy = clergyKept(fy.given, foodAYear),
      teaching = templeTeaching(clergy, fy.faithful, scriptureOfTenet(f.tenet));
    if (!row && fy.given <= 0) continue;
    rows.set(serial, [
      Math.round(clergy),
      Math.floor(granary),
      fy.given,
      relief,
      Math.round(teaching * 1000),
      fy.faithful,
      fy.lands,
      row ? row[TEMPLE_ROW.since]! : year,
    ]);
  }
}

/** Whether the clergy of a land's faith teach there as a school does (rules/temple.ts school). Only reads. */
function taughtByClergy(world: World, cell: number): boolean {
  return templeTeachingIn(world, cell) >= TEMPLE.school;
}

/** Teach a peopled world its faiths' houses. */
export function installTemples(world: World, ctx: () => PopulationContext): void {
  world.system({ key: "176.belief.temples", every: YEAR, run: (t) => templeYear(ctx(), t) });
  teachesAsSchool(taughtByClergy);
}
