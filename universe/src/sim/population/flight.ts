// Why a land's people leave it, past hunger, crowding and a worked-out mine (asked 2026-11-22, the audit's items 16 and 17:
// refugees and peoples abroad were read only off migration, and migration was all hunger: first light moved 12,265 times a
// century at 1000 and 58 at 1500, once its famines ended, and those who fled a battle went only where they would eat better).
// Read by sim/population migrateYear, which makes every move:
//   - war: a battle, a siege, a raid on the posted fought in the land the year gone. Those who flee it take a land not struck
//     even where it feeds them worse than their own (FLIGHT.refuge): safety first, food after. (Ruin that is over once it has
//     struck, a quake, a flood, a fire, a strike from the air, drives them only to a land that feeds them better, as before:
//     taken as war is, a world of 1500 moved five hundred times as often, its ten thousand fires and floods a century each
//     sending four in a hundred of a land's people over a border.)
//   - persecution: their land's faith is not their realm's seat's, under a law that asks one faith or only bears others
//     (sim/order/laws.ts, as lawGrievance reads it), the more as the land is aggrieved. They go only to a haven: a land of
//     another realm, or none, whose seat keeps their faith or whose law lets them keep it.
//   - the hope of wages: a neighbouring land whose going wage is more than three times their own draws a few of them (half as many
//     over a border, where they are strangers), to the one that pays best.
//   Persecution and wages are weighed in each land's own year of FLIGHT.every, that many years' leaving setting out together
//   (first light at 1500 has 600 peopled lands: 330 with a neighbour paying twice theirs, 256 three times, and 130 under a
//   law against their faith: weighed yearly from twice, they were three hundred moves a year; every twentieth year from
//   twice, thirty-five).
// What moves is people, as every migration moves them: a people abroad is who came into a land of another tongue
// (sim/culture/abroad.ts), and those who fled are kept by where they came to (sim/war/held.ts), by what drove them. Nothing is
// kept here: each realm's faith law and seat's faith are read once a year, lazily, and a land's wage when it is weighed.
import type { Ref, World } from "../../kernel/index.ts";
import { OCC } from "../../rules/index.ts";
import type { PopulationContext } from "./systems.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { beliefOf } from "../belief/belief.ts";
import { orderOf } from "../order/order.ts";
import { LAW_OF } from "../order/laws.ts";
import type { MarketStore } from "../economy/market.ts";

export const FLIGHT = {
  /** How hard a law of one faith pushes a land of another faith to leave a year, at a full grievance (one that bears others:
   * a quarter of it), weighed FLIGHT.every years at once; hunger at its worst pushes 0.6 a year, war 0.5. */
  faith: 0.025,
  /** How much worse fed a land those who flee ruin or persecution will take (as `attraction`, food a mouth against their own). */
  refuge: 0.3,
  /** A land's going wage must pass their own by this share before it draws anyone; and those it draws a year at most, of
   * a land's people, at five times their wage and more. */
  wageLeast: 2,
  wage: 0.003,
  /** Over a border, among strangers, the hope draws this share as many. */
  border: 0.5,
  /** Those who go for wages take no land hungrier than their own by more than this. */
  hungrier: 0.05,
  /** Each land weighs persecution and the hope of wages once in so many years, in its own year. */
  every: 20,
} as const;

/** What fought in a land drives its people to whatever land is safe (the rest of ruin, only to a better: systems.ts FLED_FROM). */
export const WAR_FLIGHT: ReadonlySet<string> = new Set(["war.battle", "war.siege", "war.raid"]);

/** What drives a land's people to leave it and what of it may be cited. */
export type Persecuted = { push: number; faith: Ref | null; cause: Ref | null };
const NONE: Persecuted = { push: 0, faith: null, cause: null };

type RealmFaith = { law: number; faith: Ref | null; cause: Ref | null };

/** The year's reading for migration: each realm's law of faith and seat's faith, read once when first asked. */
export class FlightYear {
  private readonly realms = new Map<Ref, RealmFaith>();
  private readonly order;
  private readonly belief;
  private readonly polities;
  private readonly markets: MarketStore | null;
  constructor(ctx: PopulationContext) {
    const { world } = ctx;
    this.order = orderOf(world);
    this.belief = world.hasStore("belief.faiths") ? beliefOf(world) : null;
    this.polities = politiesOf(world);
    this.markets = world.peek<MarketStore>("economy.markets") ?? null;
  }

  private realmFaith(p: Polity): RealmFaith {
    let r = this.realms.get(p.ref);
    if (!r) {
      const o = this.order?.of(p.ref);
      r = {
        law: o ? (o.laws[LAW_OF.faith] ?? 1) : 2,
        faith: this.belief?.of(p.seat).faith ?? null,
        cause: o ? (o.lawEvents[LAW_OF.faith] ?? p.event) : null,
      };
      this.realms.set(p.ref, r);
    }
    return r;
  }

  /** What its realm's law of faith pushes a land's people to leave (0 where they keep its seat's faith, or the law bears all). */
  persecuted(cell: number): Persecuted {
    if (!this.belief || !this.order) return NONE;
    const p = this.polities.of(cell);
    if (!p || p.seat === cell) return NONE;
    const r = this.realmFaith(p);
    if (r.law >= 2 || r.faith === null) return NONE;
    const theirs = this.belief.of(cell).faith;
    if (theirs === null || theirs === r.faith) return NONE;
    const level = Math.min(1, this.polities.discontent(cell).level),
      push = FLIGHT.faith * (r.law === 0 ? 1 : 0.25) * level;
    return push > 0.01 ? { push, faith: theirs, cause: r.cause } : NONE;
  }

  /** Whether a land is a haven for those of a faith fleeing their realm (`from`, the land they leave). */
  haven(from: number, to: number, faith: Ref): boolean {
    const there = this.polities.of(to),
      here = this.polities.of(from);
    if (!there) return true;
    if (there === here) return false;
    const r = this.realmFaith(there);
    return r.law >= 1 || r.faith === faith;
  }

  /** What a year's work fetches in a land, as a newcomer would take it: the better of its fields' and its crafts' wage. */
  wageOf(cell: number): number {
    const w = this.markets?.wagesOf(cell);
    return w ? Math.max(w[OCC.farmer] ?? 0, w[OCC.crafter] ?? 0) : 0;
  }

  /** How far a neighbouring land's wage draws a land's people (0 … 1: from past three times their own, wholly at five). */
  drawn(from: number, to: number, own: number): number {
    if (!(own > 0)) return 0;
    const gap = this.wageOf(to) / own - 1 - FLIGHT.wageLeast;
    if (!(gap > 0)) return 0;
    const over = this.polities.of(to) !== this.polities.of(from);
    return Math.min(1, gap / 2) * (over ? FLIGHT.border : 1);
  }
}

/** Whether a land weighs persecution and the hope of wages this year (its own year of FLIGHT.every). */
export function weighsWages(cell: number, year: number): boolean {
  return (year + cell) % FLIGHT.every === 0;
}

/** The world's year of flight, made once by migrateYear. */
export function flightYear(ctx: PopulationContext): FlightYear {
  return new FlightYear(ctx);
}

/** For a page: whether a world reads these causes at all (a world with no order or no faiths reads none of persecution). */
export function readsPersecution(world: World): boolean {
  return orderOf(world) !== null && world.hasStore("belief.faiths");
}
