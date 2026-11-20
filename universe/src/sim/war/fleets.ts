// Fleets as things (2026-11-19). A realm's ships are tonnes (sim/war/navy.ts); here its fleet is someone's: it sails under a
// flagship named in its seat's tongue, laid down the year it first kept warships, and under its admiral: a post of its own (a
// notable), named the day its fleet first meets another (until then, whoever commands its arms). Each year a war is fought at sea, what the fleets lost to each other
// that year is a meeting of fleets where it was much (FLEET.told of a side's tonnes): told, kept a while, and a deed on each
// commander's name. A side that lost FLEET.flagship of its tonnes in the one year lost its flagship with them, and names
// another. No draws: all of it is read off the navy's own year. Level: one record a realm with warships (a named ship, a
// named person where one is kept), one a meeting of fleets. Nothing here moves a ship: the navy's year decides the sea.
import {
  YEAR,
  defineEventType,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { tongueName } from "../../gen/index.ts";
import { DOMAIN } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { cultureOf } from "../culture/culture.ts";
import { loreOf } from "../lore/lore.ts";
import { seaRange } from "../economy/sea.ts";
import { notablesOf } from "../notable/kept.ts";
import { admiralIn, admiralLeft, notableDeed } from "../notable/notables.ts";
import { coastal, navyOf } from "./navy.ts";
import { warsOf } from "./war.ts";

export const FLEET_EVENTS = {
  /** Two fleets met at sea in a war, and what each lost. */
  met: defineEventType("war.fleet", 4),
};

export const FLEET = {
  /** A year's losses at sea are a meeting of fleets from this share of a side's tonnes. */
  told: 0.1,
  /** A side that lost this share of its tonnes in the year lost its flagship. */
  flagship: 0.4,
  /** How long a meeting is kept (years): a war at sea is a meeting most years it lasts, some four a year the world over late on. */
  years: 60,
  /** What a meeting adds to or takes from its commander's standing (thousandths of the line). */
  won: 250,
  lost: -120,
} as const;

/** A realm's fleet. */
export type Fleet = {
  readonly realm: Ref;
  /** Its flagship, the year she was named, and how many it has lost before her. */
  flagship: string;
  laid: number;
  lost: number;
  /** The meetings of fleets it has fought. */
  fought: number;
};

/** Two fleets met. */
export type SeaFight = {
  readonly war: Ref;
  readonly year: number;
  /** Each side's tonnes as it began, and what it lost (0: the war's attacker). */
  readonly tons: readonly [number, number];
  readonly sunk: readonly [number, number];
  readonly flags: readonly [string, string];
  readonly led: readonly [string | null, string | null];
  /** Whose flagship went down (-1: neither). */
  readonly lost: -1 | 0 | 1;
  readonly won: 0 | 1;
  readonly event: Ref;
};

const serial = (r: Ref): number => Number(r.split(":").at(-1)) || 0;

export class FleetStore implements StateStore {
  readonly name = "war.fleets";
  private readonly fleets = new Map<Ref, Fleet>();
  private fights: SeaFight[] = [];
  /** What each war's sides had lost at sea when last read: the year's own losses are what is past it. */
  private readonly seen = new Map<Ref, [number, number]>();
  dormant(): boolean {
    return !this.fleets.size && !this.fights.length;
  }
  of(realm: Ref): Fleet | undefined {
    return this.fleets.get(realm);
  }
  set(f: Fleet): void {
    this.fleets.set(f.realm, f);
  }
  drop(realm: Ref): void {
    this.fleets.delete(realm);
  }
  realms(): Ref[] {
    return [...this.fleets.keys()];
  }
  allFights(): readonly SeaFight[] {
    return this.fights;
  }
  fightsOf(war: Ref): SeaFight[] {
    return this.fights.filter((f) => f.war === war);
  }
  addFight(f: SeaFight): void {
    this.fights.push(f);
  }
  forget(before: number): void {
    if (this.fights.length && this.fights[0]!.year < before)
      this.fights = this.fights.filter((f) => f.year >= before);
  }
  hasSeen(war: Ref): boolean {
    return this.seen.has(war);
  }
  seenIn(war: Ref): readonly [number, number] {
    return this.seen.get(war) ?? [0, 0];
  }
  see(war: Ref, sunk: readonly [number, number]): void {
    this.seen.set(war, [sunk[0], sunk[1]]);
  }
  unsee(keep: ReadonlySet<Ref>): void {
    for (const w of [...this.seen.keys()]) if (!keep.has(w)) this.seen.delete(w);
  }
  pinned(): Ref[] {
    return this.fights.map((f) => f.event);
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    const rs = [...this.fleets.keys()].sort((a, b) => (a < b ? -1 : 1));
    h.int(rs.length);
    for (const r of rs) {
      const f = this.fleets.get(r)!;
      h.string(r).string(f.flagship).int(f.lost).int(f.fought);
    }
    h.int(this.fights.length);
    if (this.fights.length) h.string(this.fights.at(-1)!.event);
  }
  save(): unknown {
    return {
      fleets: [...this.fleets.values()].sort((a, b) => (a.realm < b.realm ? -1 : 1)),
      fights: this.fights,
      seen: [...this.seen].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
    };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as {
      fleets?: Fleet[];
      fights?: SeaFight[];
      seen?: [Ref, [number, number]][];
    };
    this.fleets.clear();
    for (const f of s.fleets ?? []) this.fleets.set(f.realm, { ...f });
    this.fights = [...(s.fights ?? [])];
    this.seen.clear();
    for (const [w, v] of s.seen ?? []) this.seen.set(w, [v[0], v[1]]);
  }
}

export function fleetsOf(world: World): FleetStore | null {
  return world.hasStore("war.fleets") ? world.store<FleetStore>("war.fleets") : null;
}

/** A flagship's name: in the tongue of its realm's seat, the n-th it has had. */
function flagshipName(world: World, p: Polity, nth: number): string {
  const tongue = cultureOf(world).get(p.seat)?.tongue,
    key = serial(p.ref) * 64 + nth + 7;
  return tongue ? tongueName(tongue, key) : `the ${nth + 1}th ship of ${realmName(p)}`;
}

/** Who commands a realm's fleet: its admiral, where it has had one named; else the one who commands its arms, where it keeps one. */
export function fleetCommander(
  world: World,
  realm: Ref,
): { id: number; name: string; admiral: boolean } | null {
  const kept = notablesOf(world),
    a = kept?.holder("fleet", realm),
    n = a ?? kept?.holder("command", realm);
  return n ? { id: n.id, name: n.name, admiral: !!a } : null;
}

/** The fleets' year, after the navy's: each realm with warships has its flagship; each war's year at sea, where much was lost, is a meeting told. */
export function fleetsYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = fleetsOf(world),
    navy = navyOf(world);
  if (!store || !navy || (navy.dormant() && store.dormant())) return;
  const realms = politiesOf(world),
    year = yearOfMoment(t);
  // 1. Each realm with warships sails under a flagship; one with none keeps no fleet.
  for (const r of store.realms())
    if (!(navy.of(r)?.tons ?? 0)) {
      store.drop(r);
      admiralLeft(world, r);
    }
  for (const r of navy.realms()) {
    if (store.of(r) || !(navy.of(r)!.tons > 0)) continue;
    const p = realms.get(r);
    if (p)
      store.set({ realm: r, flagship: flagshipName(world, p, 0), laid: year, lost: 0, fought: 0 });
  }
  // 2. The year at sea in each war fought there.
  const wars = navy.wars(),
    live = new Set<Ref>(wars);
  for (const w of wars) {
    const s = navy.sea(w)!,
      was = store.seenIn(w),
      sunk: [number, number] = [Math.max(0, s.sunk[0] - was[0]), Math.max(0, s.sunk[1] - was[1])];
    const first = !store.hasSeen(w);
    store.see(w, s.sunk);
    const war = warsOf(world).get(w),
      sides = war ? sidesOf(world, war.attacker, war.defender) : null;
    // (A war already old when first read, in a world from before fleets were kept: its past years at sea are not this year's.)
    if (!war || !sides || (first && war.declared < year - 1)) continue;
    const ships = [navy.of(sides[0].ref), navy.of(sides[1].ref)],
      tons: [number, number] = [(ships[0]?.tons ?? 0) + sunk[0], (ships[1]?.tons ?? 0) + sunk[1]],
      share = [sunk[0] / Math.max(1, tons[0]), sunk[1] / Math.max(1, tons[1])];
    if (Math.max(share[0]!, share[1]!) < FLEET.told || sunk[0] + sunk[1] <= 0) continue;
    const fleets = [store.of(sides[0].ref), store.of(sides[1].ref)],
      flags: [string, string] = [fleets[0]?.flagship ?? "", fleets[1]?.flagship ?? ""],
      won: 0 | 1 = s.command[0] >= s.command[1] ? 0 : 1,
      lost: -1 | 0 | 1 =
        share[1 - won]! >= FLEET.flagship && fleets[1 - won] ? ((1 - won) as 0 | 1) : -1,
      coast = (p: Polity) => [...p.members].sort((x, y) => x - y).find((c) => coastal(ctx, c)),
      place = coast(sides[1 - won]!) ?? null,
      // (Each fleet under its admiral: the one it has, or one the day makes, of the coast it sails from.)
      led = [0, 1].map((k) =>
        fleets[k]
          ? admiralIn(ctx, sides[k]!, coast(sides[k]!) ?? sides[k]!.seat, t)
          : fleetCommander(world, sides[k]!.ref),
      ),
      event = world.events.emit({
        type: FLEET_EVENTS.met.type,
        importance: lost >= 0 ? 4 : 3,
        subjects: [w, sides[0].ref, sides[1].ref],
        place: place !== null ? (ctx.provinces.get(place)?.ref ?? null) : null,
        causes: [{ ref: war.event, role: "trigger", weight: 1 }],
        data: {
          a: realmName(sides[0]),
          b: realmName(sides[1]),
          tons,
          sunk,
          flags,
          led: [led[0]?.name ?? null, led[1]?.name ?? null],
          ledId: [led[0]?.id ?? null, led[1]?.id ?? null],
          // (What each side's shipwrights knew that year: for whoever watches it after.)
          rig: [rigOf(world, sides[0]), rigOf(world, sides[1])],
          won,
          ...(lost >= 0 ? { lost } : {}),
        },
      });
    store.addFight({
      war: w,
      year,
      tons,
      sunk,
      flags,
      led: [led[0]?.name ?? null, led[1]?.name ?? null],
      lost,
      won,
      event,
    });
    for (const k of [0, 1] as const) {
      const f = fleets[k];
      if (f) {
        f.fought++;
        if (lost === k) {
          f.lost++;
          f.flagship = flagshipName(world, sides[k], f.lost);
          f.laid = year;
        }
      }
      if (led[k])
        notableDeed(world, led[k]!.id, {
          y: year,
          d: DOMAIN.war,
          w: k === won ? "war.fleet won" : "war.fleet lost",
          e: event,
          g: k === won ? FLEET.won : FLEET.lost,
          n: realmName(sides[1 - k]!),
        });
    }
  }
  store.unsee(live);
  store.forget(year - FLEET.years);
}

/**
 * What a realm's shipwrights know, as kept with a meeting: how far its ships carry (sea provinces: 2 sails, 4 planked hulls,
 * 8 ships that keep the sea, 16 steam), whether its works give its hulls (iron and steel), and whether it knows powder.
 */
export type FleetRig = readonly [steps: number, works: 0 | 1, powder: 0 | 1];
export function rigOf(world: World, p: Polity): FleetRig {
  const lore = loreOf(world),
    steps = seaRange(lore, p.seat);
  return [
    steps,
    lore.effect(p.seat, "power") > 0 && steps >= 16 ? 1 : 0,
    lore.get(p.seat, "gunpowder") ? 1 : 0,
  ];
}

/** A war's two realms, living (null: either is gone). */
function sidesOf(world: World, attacker: Ref, defender: Ref): readonly [Polity, Polity] | null {
  const realms = politiesOf(world),
    a = realms.get(attacker),
    b = realms.get(defender);
  return a && b && a.ended === null && b.ended === null ? [a, b] : null;
}

/** Teach a peopled world its fleets. */
export function installFleets(world: World, ctx: () => PopulationContext): FleetStore {
  const store = world.register(new FleetStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "184.war.zfleets", every: YEAR, run: (t) => fleetsYear(ctx(), t) });
  return store;
}
