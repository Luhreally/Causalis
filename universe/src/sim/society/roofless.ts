// Without a roof, year by year (the society sweep; the rule is rules/roof.ts, what is kept ./kept.ts ROOF_ROW).
//   187.society.roofless, a land with a town a year (what turns people out comes in a year, and is read back from the year's events):
//     its least roof a household and who its rent shuts out (by its five fifths, Round B's shares, and trade's town rent where it is
//     kept); those beyond the homes its town has built (sim/town/fabric.ts housing, outrun by those its town draws); those turned out
//     by battle, sack, quake, fire, a stone and flood, housed again as it rebuilds; some of those who need what they take (Round B's
//     intoxicants) and of its frail no one keeps (./care.ts); who takes them in: kin (./care.ts old rows), the temple's alms, the
//     realm's provision (its public care); and so the street. It runs after the care, the old, the provision and dress it reads.
//     What follows: the cold's and a sickness's deaths (population/systems.ts vitalMonth, health.ts tollOf), the town's grievance
//     (polity.ts), the realm's relief (money.ts treasuryYear), and the town's cases (host/inspect/justice.ts).
// Nothing is drawn.
import { YEAR, defineEventType, yearOfMoment, type Ref, type SimTime } from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import {
  ORPHANS,
  ROOF,
  almsOf,
  carersOf,
  orphanedOf,
  roofCost,
  rooflessAll,
  shutOut,
  takenIn,
  type Pairing,
} from "../../rules/index.ts";
import { adults, marketsOf, type PopulationContext } from "../population/systems.ts";
import type { Province } from "../population/model.ts";
import { familySizeOf, peopleKin } from "../population/life.ts";
import { ORPHAN_ROW, ORPHAN_STORE, cultureRows } from "../culture/rows.ts";
import { warsOf } from "../war/war.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { politiesOf } from "../polity/polity.ts";
import { housingOf, townsOf } from "../town/fabric.ts";
import { SHARE, SHARES_STORE, intoxDependent, moneyStore } from "../money/kept.ts";
import {
  DRESS_ROW,
  DRESS_STORE,
  OLD_ROW,
  OLD_STORE,
  ROOFLESS_STORE,
  ROOF_ROW,
  provisionOf,
  societyStore,
} from "./kept.ts";
import { landMeans, landTurn } from "./care.ts";
import { orgShelteredOf } from "../order/groups-kept.ts";

export const ORPHAN_EVENTS = {
  /** A year's dying left a land's young needing a hearth: who took them in. */
  left: defineEventType("society.orphans", 3),
};

/** Trade's town rent where it is kept (its store, by name: a town's ground's earnings a year, grain's worth; 0 where none is). */
const TRADE_RENT = { store: "trade.rent", rent: 3 } as const;
/** Culture's town draw where it is kept (its store, by name: how many times its trades its town holds, now and drawn toward). */
const TOWN_DRAW = { store: "town.urban", draw: 0, target: 1 } as const;

/** A typical five fifths where a land keeps none (a Gini about a third). */
const FIFTHS = [0.07, 0.12, 0.17, 0.24, 0.4];

export function rooflessYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = societyStore(world, ROOFLESS_STORE);
  if (!store) return;
  const markets = marketsOf(world),
    towns = townsOf(world),
    culture = cultureOf(world),
    realms = politiesOf(world),
    shares = moneyStore(world, SHARES_STORE),
    olds = societyStore(world, OLD_STORE),
    dress = societyStore(world, DRESS_STORE),
    rent = world.peek<never>(TRADE_RENT.store) ?? null,
    draw = world.peek<never>(TOWN_DRAW.store) ?? null,
    { struck, blows } = struckThisYear(ctx, t),
    year = yearOfMoment(t),
    // (Orphans: rules/orphans.ts. How its people rear their young, and their young as a share of them.)
    pairing = peopleKin(ctx.generated).pairing,
    rears = carersOf(pairing) > 0,
    orphanRows = cultureRows(world, ORPHAN_STORE);
  for (const p of ctx.provinces.all()) {
    const c = p.cell,
      was = store.get(c);
    // (Each land in its turn, once in SOCIETY_EVERY years as the sweep's others; every year while it has people turned out,
    // who are housed again a share a year, and in a year a blow fell on it.)
    // (While a twentieth and more of them are: the last few housed again wait for its turn. A blow's own year always.)
    // (And in a year after many of its grown died, for the young they left: twice an ordinary year's dead and more.)
    // (Asked of a land with a town weighed before, and only past what its town's people alone would make a dying year.)
    const died = rears && was ? ctx.history.deathsIn(c, year - 1) : 0,
      people = died > 0 && died >= ORPHANS.dying * was![ROOF_ROW.town]! ? p.total() : 0,
      orphaned =
        people > 0 && died >= ORPHANS.dying * people
          ? orphanedIn(ctx, p, year - 1, pairing, people + died)
          : 0;
    if (was && !landTurn(c, year) && was[ROOF_ROW.displaced]! < 50 && !struck.get(c) && !orphaned)
      continue;
    // Its towns: those it has raised a fabric for, and the homes they hold.
    let town = 0,
      housing = 0,
      waiting = 0;
    for (const s of ctx.settlements.kept(c)) {
      const f = towns.of(s);
      if (!f) continue;
      const homes = housingOf(f);
      town += s.population;
      housing += homes;
      // (Those beyond its homes past what its builders raise in a year (fabric.ts grow: a quarter of its people, thirty at
      // least) wait without one; in a town new within ROOF.settling years its settlers raise their own as it rises.)
      if (year - s.founded >= ROOF.settling)
        waiting += Math.max(0, s.population - homes - Math.max(30, s.population / 4));
    }
    const means = town > 0 ? landMeans(ctx, p, markets.get(c)) : null;
    if (!means) {
      store.drop(c);
      continue;
    }
    const family = familySizeOf(world),
      hhWorkers = family * means.workers,
      households = Math.max(1, town / family),
      beyond = housing > 0 ? Math.max(0, town - housing) / town : 0,
      waits = waiting / town,
      ground = rent ? (rowAt(rent, c, TRADE_RENT.rent) ?? 0) / households : 0,
      roof = roofCost(means.earns, ground, housing > 0 ? beyond : 0),
      fifths = shares?.get(c)
        ? [0, 1, 2, 3, 4].map((k) => shares.at(c, SHARE.fifths + k) / 1000)
        : FIFTHS,
      shut = shutOut(fifths, means.earns * hhWorkers, means.living * hhWorkers, roof),
      // (Those turned out, housed again a share a year, and this year's blows.)
      displaced = Math.min(
        0.9,
        // (The last few of them, weighed only in the land's turn, are housed by then.)
        ((was?.[ROOF_ROW.displaced] ?? 0) >= 50
          ? ((was?.[ROOF_ROW.displaced] ?? 0) / 1000) * (1 - ROOF.rebuilt)
          : 0) + (struck.get(c) ?? 0),
      ),
      addicted = ROOF.addicted * intoxDependent(world, c),
      oldRow = olds?.get(c),
      old = oldRow ? (ROOF.old * oldRow[OLD_ROW.share]! * oldRow[OLD_ROW.neglected]!) / 1e6 : 0,
      // (Those turned out and those beyond its homes are one want of homes, not two chances: where a blow razed its homes, the
      // fabric's own shortfall already holds those it turned out, so the greater of the two is told.)
      roofless = rooflessAll([shut, Math.max(waits, displaced), addicted, old, orphaned]),
      realm = realms.of(c),
      // (Newcomers: those beyond its homes, and those its town still draws toward its draw's aim.)
      drawn = draw ? drawGap(draw, c) : 0,
      taken = takenIn(
        oldRow ? oldRow[OLD_ROW.kin]! / 1000 : 0.5,
        almsOf(culture.get(c)?.traits[WAY.piety] ?? 0.5),
        realm ? provisionOf(world, realm.ref).publicCare : 0,
        roofless > 0 ? Math.min(1, (waits + drawn * roofless) / roofless) : 0,
      ),
      townShare = Math.min(1, town / means.people),
      // (Of those the street would hold, its mutual-aid societies take in a share: sim/order/groups.ts. Nothing where none is kept.)
      aided = orgShelteredOf(world, c),
      street = aided > 0 ? roofless * taken.street * (1 - aided) : roofless * taken.street,
      doubled =
        aided > 0
          ? roofless * (taken.kin + taken.temple + taken.realm + taken.street * aided)
          : roofless * (taken.kin + taken.temple + taken.realm),
      streetLand = street * townShare,
      doubledLand = doubled * townShare,
      need = (dress?.get(c)?.[DRESS_ROW.need] ?? 0) / 1000,
      cold = 1 + ROOF.cold * need * streetLand,
      sick = 1 + ROOF.sick * (streetLand + ROOF.doubled * doubledLand),
      sheltered = (roofless * taken.realm * town) / familySizeOf(world);
    if (orphaned >= ORPHANS.told && orphanRows) {
      const told = orphanRows.at(c, ORPHAN_ROW.told),
        count = Math.round(orphaned * means.people);
      if (count > 0 && (told === 0 || year - told >= ORPHANS.again)) {
        const war = realm ? warsOf(world).fighting(realm.ref)[0] : undefined,
          cause = blows.get(c) ?? war?.event ?? null,
          aidedTook = aided > 0 ? taken.street * aided : 0;
        world.events.emit({
          type: ORPHAN_EVENTS.left.type,
          importance: orphaned >= 0.02 ? 4 : 3,
          subjects: [p.ref],
          place: p.ref,
          causes: cause ? [{ ref: cause, role: "trigger", weight: 1 }] : [],
          data: {
            orphans: count,
            kin: Math.round(taken.kin * 100),
            houses: Math.round((taken.temple + taken.realm + aidedTook) * 100),
            street: Math.round((taken.street - aidedTook) * 100),
            dead: Math.round((died / (people + died)) * 1000),
          },
        });
        orphanRows.set(c, [year, count]);
      }
    }
    store.set(c, [
      roof,
      shut * 1000,
      waits * 1000,
      displaced * 1000,
      addicted * 1000,
      old * 1000,
      roofless * 1000,
      taken.kin * 1000,
      taken.temple * 1000,
      taken.realm * 1000,
      street * 1000,
      streetLand * 1000,
      doubledLand * 1000,
      sheltered * roof,
      town,
      cold * 1000,
      sick * 1000,
    ]);
  }
}

/** One number of another lane's row store, read by name (null where it keeps no row). */
function rowAt(store: unknown, key: number, i: number): number | null {
  const s = store as { get?: (k: number) => readonly number[] | undefined };
  const row = typeof s.get === "function" ? s.get(key) : undefined;
  return row ? (row[i] ?? null) : null;
}

/** How far a land's town still draws toward what it is drawn to, a share of what it holds (0 where none is kept). */
function drawGap(store: unknown, cell: number): number {
  const now = rowAt(store, cell, TOWN_DRAW.draw),
    aim = rowAt(store, cell, TOWN_DRAW.target);
  return now && aim && aim > now ? Math.min(1, (aim - now) / now) : 0;
}

/**
 * Of a land's people (as they were before the year's dead, `before`), the share who are young left needing a hearth by those
 * of its grown who died in `year` (rules/orphans.ts): its grown dead against its grown, by how its people rear.
 */
function orphanedIn(
  ctx: PopulationContext,
  p: Province,
  year: number,
  pairing: Pairing,
  before: number,
): number {
  const life = ctx.life;
  let dead = 0;
  for (let b = 0; b < life.bands.length; b++)
    if (life.bands[b]! >= life.adulthood) dead += ctx.history.deathsIn(p.cell, year, b);
  const grown = adults(p, life),
    young = Math.max(0, p.total() - grown),
    was = grown + dead;
  if (!(dead > 0) || !(was > 0) || !(before > 0)) return 0;
  return (orphanedOf(dead / was, pairing).needing * young) / before;
}

/**
 * The share of each land's homes the year's blows took (battles, sacks, quakes, fires, stones, wildfires, floods); and the
 * last of the year's blows and sicknesses that fell on each (`blows`: what its orphans are told by).
 */
function struckThisYear(
  ctx: PopulationContext,
  t: SimTime,
): { struck: Map<number, number>; blows: Map<number, Ref> } {
  const out = new Map<number, number>(),
    blows = new Map<number, Ref>(),
    events = ctx.world.events,
    land = cellRef(0, 0).slice(0, cellRef(0, 0).lastIndexOf(":") + 1);
  for (let i = events.count - 1; i >= 0; i--) {
    const e = events.at(i);
    if (e.t < t - YEAR) break;
    const take = ROOF.struck[e.type];
    if ((!take && e.type !== "health.outbreak") || !e.place || !e.place.startsWith(land)) continue;
    const cell = Number(e.place.slice(e.place.lastIndexOf(":") + 1));
    if (!Number.isFinite(cell)) continue;
    if (!blows.has(cell)) blows.set(cell, e.id);
    if (take) out.set(cell, Math.min(0.9, (out.get(cell) ?? 0) + take));
  }
  return { struck: out, blows };
}
