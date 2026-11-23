// A far people's reigns as news (the audit's item 29, 2026-11-22: a far people's ruler and house were readings of the year, with
// no event and nothing kept). Who leads a people of another star and which house holds its seat are still read off the people
// and the year alone (./far-rulers.ts); what is kept is only what the home world has come to know of it: for each people it has
// heard (./contact.ts), the reign and house it last knew of, and the event that told it. When a reign passes, it is told: within
// the house, a succession; to another house, the old house's fall. Told only of peoples heard, as their signals bring it (their
// light's years late: what is heard of them now is as they were then). One small row a people heard; nothing grows with history.
import {
  Hasher,
  YEAR,
  defineEventType,
  yearOfMoment,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { civName } from "../../gen/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { civilizationOf, contactsOf } from "./contact.ts";
import { farHouseOf, farRulerOf } from "./far-rulers.ts";

export const FAR_REIGN_EVENTS = {
  /** A far people's seat passed to another of its house, or its house fell and another took it. */
  reign: defineEventType("space.far-reign", 3),
};

/** What the home world knows of a far people's seat: the reign, the house, the event that told it. */
export type FarReign = { reign: number; house: string; event: Ref | null };

export class FarReignStore implements StateStore {
  readonly name = "space.farreigns";
  private readonly by = new Map<string, FarReign>();
  dormant(): boolean {
    return this.by.size === 0;
  }
  of(civ: Ref): Readonly<FarReign> | undefined {
    return this.by.get(civ);
  }
  set(civ: Ref, r: FarReign): void {
    this.by.set(civ, r);
  }
  private keys(): string[] {
    return [...this.by.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const r of this.by.values()) if (r.event) out.push(r.event);
    return out;
  }
  hashInto(h: Hasher): void {
    const ks = this.keys();
    h.int(ks.length);
    for (const k of ks) {
      const r = this.by.get(k)!;
      h.string(k)
        .int(r.reign)
        .string(r.house)
        .string(r.event ?? "");
    }
  }
  save(): unknown {
    return this.keys().map((k) => {
      const r = this.by.get(k)!;
      return [k, r.reign, r.house, r.event];
    });
  }
  load(state: unknown): void {
    this.by.clear();
    for (const [k, reign, house, event] of (state as [string, number, string, Ref | null][]) ?? [])
      this.by.set(k, { reign, house, event });
  }
}

export function farReignsOf(world: World): FarReignStore | null {
  return world.peek<FarReignStore>("space.farreigns") ?? null;
}

/** The year's news of far seats: for each people heard, a reign passed since the last is told (the first known is only kept). */
export function farReignsYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = farReignsOf(world);
  if (!store || !world.hasStore("space.contact")) return;
  const year = yearOfMoment(t);
  for (const c of contactsOf(world).all()) {
    const civ = civilizationOf(world, c.civ);
    if (!civ) continue;
    // (What is heard of them now left them as many years ago as their light takes.)
    const seen = year - Math.ceil(civ.distance),
      ruler = farRulerOf(world, civ, seen);
    if (!ruler) continue;
    const kept = store.of(civ.ref);
    if (kept && kept.reign === ruler.reign) continue;
    const house = farHouseOf(world, civ, seen);
    if (!house) continue;
    if (!kept) {
      store.set(civ.ref, { reign: ruler.reign, house: house.name, event: null });
      continue;
    }
    const fell = house.name !== kept.house,
      event = world.events.emit({
        type: FAR_REIGN_EVENTS.reign.type,
        subjects: [civ.ref],
        place: null,
        causes: [
          ...(kept.event ? [{ ref: kept.event, role: "enabler" as const, weight: 0.5 }] : []),
          { ref: c.heard, role: "enabler" as const, weight: 0.5 },
        ],
        data: {
          people: civName(world.rng, civ),
          ruler: ruler.name,
          house: house.name,
          ...(fell ? { fell: kept.house } : {}),
          ...(ruler.many ? { many: 1 } : {}),
          then: seen,
        },
      });
    store.set(civ.ref, { reign: ruler.reign, house: house.name, event });
  }
}

/** Teach a world that hears other peoples the news of their seats. */
export function installFarReigns(world: World, ctx: () => PopulationContext): FarReignStore {
  const store = world.register(new FarReignStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "199.space.zfarreigns", every: YEAR, run: (t) => farReignsYear(ctx(), t) });
  return store;
}
