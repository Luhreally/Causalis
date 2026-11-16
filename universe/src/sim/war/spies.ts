// Spies (round E, order). A realm that writes sends those who watch and report into the realms it has most reason to watch:
// those at war with it, its rivals (their regard below RIVALRY), and the one it fears most (sim/finance). Its chance of placing
// one in a year is as its reach (sim/order capacityOf) and as freely word moves where they go (rules/holds.ts word: a watched
// people is hard to pass among); one placed is caught in a year as the realm it is in watches its people and keeps their arms
// (word low, force high). A realm with a spy in another reads that one's host truly (sim/war/ties.ts misreadOf: as an embassy
// does, and better); one caught is a wrong the other remembers (a term of its regard, fading over a generation) and an event.
// At most three a realm, each a few numbers.
import {
  defineEventType,
  defineStream,
  parseRef,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { capacityOf } from "../order/order.ts";
import { holdsOf } from "../order/holds.ts";
import { knows } from "../lore/lore.ts";
import { RIVALRY, diplomacyOf } from "../diplomacy/diplomacy.ts";
import { topFear } from "../finance/finance.ts";
import { warsOf } from "./war.ts";

export const SPY_EVENTS = {
  /** A realm's spy found out in another, and sent home or hanged. */
  caught: defineEventType("ties.spy", 3),
};

export const SPYING = {
  /** The most a realm keeps abroad, and its best chance of placing one in a year. */
  most: 3,
  place: 0.25,
  /** The most chance a year of one being caught, where the realm it is in watches every word and keeps every arm. */
  caught: 0.3,
  /** How ill the one it was caught in thinks of the one who sent it, at first (fading as a remembered wrong does). */
  wrong: 0.2,
} as const;

const STREAM = defineStream("war.spies");

export type Spy = { readonly in: Ref; readonly since: number };

export class SpyStore implements StateStore {
  readonly name = "ties.spies";
  private readonly by = new Map<Ref, Spy[]>();
  dormant(): boolean {
    return this.by.size === 0;
  }
  /** The realms a realm keeps spies in. */
  of(realm: Ref): readonly Spy[] {
    return this.by.get(realm) ?? [];
  }
  /** Whether a realm keeps a spy in another. */
  has(seer: Ref, seen: Ref): boolean {
    return (this.by.get(seer) ?? []).some((s) => s.in === seen);
  }
  set(realm: Ref, spies: Spy[]): void {
    if (spies.length) this.by.set(realm, spies);
    else this.by.delete(realm);
  }
  realms(): Ref[] {
    return [...this.by.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  hashInto(h: Hasher): void {
    const rs = this.realms();
    h.int(rs.length);
    for (const r of rs) h.string(r).value(this.by.get(r));
  }
  save(): unknown {
    return this.realms().map((r) => [r, this.by.get(r)]);
  }
  load(state: unknown): void {
    this.by.clear();
    for (const [r, s] of (state as [Ref, Spy[]][]) ?? []) this.by.set(r, s);
  }
}

export function spiesOf(world: World): SpyStore | null {
  return world.hasStore("ties.spies") ? world.store<SpyStore>("ties.spies") : null;
}

/** The realms a realm has most reason to watch, most first: those at war with it, its rivals, the one it fears most. */
function watchedBy(world: World, p: Polity, rivals: ReadonlyMap<Ref, readonly Ref[]>): Ref[] {
  const out: Ref[] = [];
  for (const w of warsOf(world).hotOf(p.ref))
    if (w.ended === null) out.push(w.attacker === p.ref ? w.defender : w.attacker);
  out.push(...(rivals.get(p.ref) ?? []));
  const fear = topFear(world, p.ref);
  if (fear && fear.of !== p.ref) out.push(fear.of);
  return [...new Set(out)];
}

/** The year's spies: those caught, and those newly placed. */
export function spiesYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = spiesOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world);
  // 1. Caught, or gone with the realm they were in or the one that sent them. (A realm whose spy was caught this year
  // sends none back in the year it was caught: the one it was in is watching for the next.)
  const caught = new Set<string>();
  for (const r of store.realms()) {
    const sender = realms.get(r);
    if (!sender || sender.ended !== null) {
      store.set(r, []);
      continue;
    }
    const kept: Spy[] = [];
    for (const s of store.of(r)) {
      const host = realms.get(s.in);
      if (!host || host.ended !== null) continue;
      const [force, , word] = holdsOf(world, host.ref) as [number, number, number],
        watch = SPYING.caught * (1 - word) * force,
        u = world.rng.real(STREAM, parseRef(r).b, year, parseRef(s.in).b);
      if (u >= watch) {
        kept.push(s);
        continue;
      }
      const event = world.events.emit({
        type: SPY_EVENTS.caught.type,
        subjects: [host.ref, sender.ref],
        place: ctx.provinces.get(host.seat)?.ref ?? null,
        causes: [],
        data: { a: realmName(host), b: realmName(sender), since: s.since },
      });
      caught.add(`${sender.ref}>${host.ref}`);
      diplomacyOf(world).remember(host.ref, sender.ref, {
        name: `a spy of ${realmName(sender)} caught`,
        value: -SPYING.wrong,
        year,
        source: event,
      });
    }
    store.set(r, kept);
  }
  // 2. Placed: by a realm that writes, in those it most has reason to watch. (Its rivals read once, most bitter first.)
  const rivals = new Map<Ref, Ref[]>(),
    bitter = diplomacyOf(world)
      .all()
      .filter((r) => r.opinion < RIVALRY)
      .sort(
        (a, b) => a.opinion - b.opinion || (a.a < b.a ? -1 : a.a > b.a ? 1 : a.b < b.b ? -1 : 1),
      );
  for (const r of bitter) {
    (rivals.get(r.a) ?? rivals.set(r.a, []).get(r.a)!).push(r.b);
    (rivals.get(r.b) ?? rivals.set(r.b, []).get(r.b)!).push(r.a);
  }
  for (const p of realms.living()) {
    if (!knows(ctx, p.seat, "writing")) continue;
    const have = [...store.of(p.ref)];
    if (have.length >= SPYING.most) continue;
    const reach = capacityOf(ctx, p).value;
    for (const target of watchedBy(world, p, rivals)) {
      if (have.length >= SPYING.most) break;
      if (have.some((s) => s.in === target) || caught.has(`${p.ref}>${target}`)) continue;
      const word = holdsOf(world, target)[2] ?? 0.5,
        chance = SPYING.place * reach * (0.3 + 0.7 * word),
        u = world.rng.real(STREAM, parseRef(p.ref).b, year, 1_000_000 + parseRef(target).b);
      if (u < chance) have.push({ in: target, since: year });
    }
    store.set(p.ref, have);
  }
}
