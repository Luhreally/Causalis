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
//   twice, thirty-five; every twentieth from three times, twenty-five).
// What moves is people, as every migration moves them: a people abroad is who came into a land of another tongue
// (sim/culture/abroad.ts), and those who fled are kept by where they came to (sim/war/held.ts), by what drove them. Nothing is
// kept here: each realm's faith law and seat's faith are read once a year, lazily, and a land's wage when it is weighed.
import {
  YEAR,
  defineEventType,
  refHash,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  BORDERS,
  HOLD,
  OCC,
  entryBar,
  entryParts,
  exitBar,
  exitParts,
  gateBand,
  gateWords,
  gatesOpen,
  type GateRead,
} from "../../rules/index.ts";
import type { PopulationContext } from "./systems.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { beliefOf } from "../belief/belief.ts";
import { orderOf } from "../order/order.ts";
import { LAW_OF } from "../order/laws.ts";
import { holdOf } from "../order/holds.ts";
import { BIND, BIND_STORE, moneyStore } from "../money/kept.ts";
import { strangersIn } from "../culture/abroad-kept.ts";
import { identityOf } from "../culture/folk.ts";
import type { MarketStore } from "../economy/market.ts";

export const FLIGHT = {
  /** How hard a law of one faith pushes a land of another faith to leave a year, at a full grievance (one that bears others:
   * a quarter of it), weighed FLIGHT.every years at once; hunger at its worst pushes 0.6 a year, war 0.5. */
  faith: 0.02,
  /** How much worse fed a land those who flee ruin or persecution will take (as `attraction`, food a mouth against their own). */
  refuge: 0.3,
  /** A land's going wage must pass their own by this share before it draws anyone; and those it draws a year at most, of
   * a land's people, at five times their wage and more. */
  wageLeast: 2,
  wage: 0.002,
  /** Over a border, among strangers, the hope draws this share as many. */
  border: 0.5,
  /** Those who go for wages take no land hungrier than their own by more than this. */
  hungrier: 0.05,
  /** Each land weighs persecution and the hope of wages once in so many years (about a generation), in its own year. */
  every: 30,
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

// —— A realm's gates: who may leave it, who may come in (rules/borders.ts) ————————————————————————————————————————————————————

export const BORDER_EVENTS = {
  /** A realm's bar on leaving or on coming in told in other words: its people barred from leaving, its gates shut to strangers. */
  gate: defineEventType("population.gate", 4),
};

/** A realm's two bars, in hundredths, and the events that last told each (null: never told; open as it began). */
type Gates = { exit: number; entry: number; exitEvent: Ref | null; entryEvent: Ref | null };

/** Each realm's gates. A couple of numbers a realm, weighed once in BORDERS.every years; none kept for a realm that bars nothing. */
export class BorderStore implements StateStore {
  readonly name = "population.borders";
  private readonly realms = new Map<Ref, Gates>();
  dormant(): boolean {
    return this.realms.size === 0;
  }
  of(realm: Ref): Readonly<Gates> | undefined {
    return this.realms.get(realm);
  }
  set(realm: Ref, g: Gates): void {
    if (!g.exit && !g.entry && !g.exitEvent && !g.entryEvent) this.realms.delete(realm);
    else this.realms.set(realm, g);
  }
  drop(realm: Ref): void {
    this.realms.delete(realm);
  }
  keys(): Ref[] {
    return [...this.realms.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const g of this.realms.values()) {
      if (g.exitEvent) out.push(g.exitEvent);
      if (g.entryEvent) out.push(g.entryEvent);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    const ks = this.keys();
    h.int(ks.length);
    for (const k of ks) {
      const g = this.realms.get(k)!;
      h.value(k).int(g.exit).int(g.entry);
    }
  }
  save(): unknown {
    return this.keys().map((k) => {
      const g = this.realms.get(k)!;
      return [k, g.exit, g.entry, g.exitEvent, g.entryEvent];
    });
  }
  load(state: unknown): void {
    this.realms.clear();
    for (const [k, exit, entry, exitEvent, entryEvent] of (state as
      [Ref, number, number, Ref | null, Ref | null][] | undefined) ?? [])
      this.realms.set(k, { exit, entry, exitEvent, entryEvent });
  }
}

export function bordersOf(world: World): BorderStore | null {
  return world.peek<BorderStore>("population.borders") ?? null;
}

/** A realm's bars (0 … 1 each; 0 where it keeps none). Only reads. */
export function gatesOf(
  world: World,
  realm: Ref | null | undefined,
): { exit: number; entry: number } {
  const g = realm ? bordersOf(world)?.of(realm) : undefined;
  return g ? { exit: g.exit / 100, entry: g.entry / 100 } : { exit: 0, entry: 0 };
}

/** What a realm's gates are read from, people-weighted over its lands (rules/borders.ts GateRead). */
export function gateRead(ctx: PopulationContext, p: Polity): GateRead {
  const { world } = ctx,
    binds = moneyStore(world, BIND_STORE);
  let people = 0,
    gain = 0,
    hold = 0,
    strangers = 0,
    nation = 0;
  for (const c of p.members) {
    const n = ctx.provinces.get(c)?.total() ?? 0;
    if (!n) continue;
    const row = binds?.get(c),
      f = identityOf(world, c);
    people += n;
    gain += n * (row ? row[BIND.gain]! / 1000 : 0);
    hold += n * (row ? Math.min(1, row[BIND.power]! / 1000) : 0);
    strangers += n * strangersIn(world, c);
    nation += n * (f ? f.nation : 0);
  }
  const d = Math.max(1, people);
  return {
    gain: gain / d,
    hold: hold / d,
    voice: holdOf(world, p.ref, HOLD.voice),
    force: holdOf(world, p.ref, HOLD.force),
    word: holdOf(world, p.ref, HOLD.word),
    strangers: strangers / d,
    nation: nation / d,
  };
}

/** The year of the gates: each realm in its own year of BORDERS.every weighs them again; a bar told in other words is an event. */
export function bordersYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = bordersOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world);
  for (const k of store.keys()) {
    const p = realms.get(k);
    if (!p || p.ended !== null) store.drop(k);
  }
  for (const p of realms.living()) {
    if ((year + (refHash(p.ref) >>> 0)) % BORDERS.every !== 0) continue;
    const read = gateRead(ctx, p),
      was = store.of(p.ref) ?? { exit: 0, entry: 0, exitEvent: null, entryEvent: null },
      now: Gates = {
        ...was,
        exit: Math.round(exitBar(read) * 100),
        entry: Math.round(entryBar(read) * 100),
      };
    for (const which of ["exit", "entry"] as const) {
      const from = gateBand(was[which] / 100),
        to = gateBand(now[which] / 100);
      if (from === to) continue;
      // (A bar holds as it was until what moves it is clearly past the line: no gate shut and opened again every ten years.)
      if (Math.abs(now[which] / 100 - BORDERS.bands[Math.min(from, to)]!) < BORDERS.slack) {
        now[which] = was[which];
        continue;
      }
      const parts = which === "exit" ? exitParts(read) : entryParts(read),
        told = which === "exit" ? was.exitEvent : was.entryEvent,
        decision = world.decisions.record({
          rule: "population.gate",
          subject: p.ref,
          outcome: { which, band: to },
          score: now[which] / 100,
          threshold: BORDERS.bands[Math.min(from, to)]!,
          factors: parts.map((x) => ({
            name: x.name,
            value: Math.round(x.value * 1000) / 1000,
            contribution: x.by,
            source: null,
          })),
        }),
        event = world.events.emit({
          type: BORDER_EVENTS.gate.type,
          // (Its gates shut or its people barred are a turn of its story; opened again, a line of its years.)
          importance: to > from ? 4 : 3,
          subjects: [p.ref],
          place: ctx.provinces.get(p.seat)?.ref ?? null,
          causes: [
            { ref: decision, role: "trigger", weight: 1 },
            ...(told ? [{ ref: told, role: "enabler" as const, weight: 0.3 }] : []),
          ],
          data: {
            realm: realmName(p),
            which,
            band: to,
            from,
            words: gateWords(which, now[which] / 100),
            bar: now[which],
          },
        });
      if (which === "exit") now.exitEvent = event;
      else now.entryEvent = event;
    }
    store.set(p.ref, now);
  }
}

/**
 * How far a band leaving land `from` for land `to` goes through the gates (0 … 1; exactly 1 within one realm, or where neither
 * bars): what the leaving realm's bar on leaving and the coming realm's bar on coming in leave open (rules/borders.ts gatesOpen).
 */
export function throughGates(world: World, from: number, to: number, war: boolean): number {
  const store = bordersOf(world);
  if (!store || store.dormant()) return 1;
  const realms = politiesOf(world),
    a = realms.of(from),
    b = realms.of(to);
  if (a === b) return 1;
  const ga = a ? store.of(a.ref) : undefined,
    gb = b ? store.of(b.ref) : undefined;
  if (!ga && !gb) return 1;
  return gatesOpen((ga?.exit ?? 0) / 100, (gb?.entry ?? 0) / 100, war);
}

/** Teach a peopled world its realms' gates. */
export function installBorders(world: World, ctx: () => PopulationContext): BorderStore {
  const store = world.register(new BorderStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "129.population.borders", every: YEAR, run: (t) => bordersYear(ctx(), t) });
  return store;
}
