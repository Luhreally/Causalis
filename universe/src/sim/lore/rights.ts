// Grants of sole use (breadth round, 2026-11-23; the rule is rules/patents.ts). Each realm keeps two faded tallies, filled by the
// lore's year: what its lands found, and what they learned from lands of their own realm; and, while it grants, the year its
// grants began and the event that told it. Once a year, a realm whose seat keeps written records grants where what its finders
// would gain is more than what its learners would lose, and lets its grants lapse where it is the other way. A few numbers a realm.
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
import {
  GRANT_HOLD,
  RIGHTS_FADE,
  adultHazard,
  grantPull,
  grantTerm,
  grantsPay,
  timePreference,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { politiesOf, realmName } from "../polity/polity.ts";
import { loreOf } from "./lore.ts";

export const RIGHTS_EVENTS = {
  /** A realm begins to grant its finders sole use of what they find, for a term. */
  granted: defineEventType("lore.granted", 3),
  /** A realm lets its grants lapse. */
  lapsed: defineEventType("lore.lapsed", 2),
  /** A realm's spy brings home a craft of the realm it was placed in. */
  stolen: defineEventType("lore.stolen", 3),
};

/** A realm's tallies (faded a year by RIGHTS_FADE, thousandths), and its grants: the year they began, the event, the term. */
export type Rights = {
  finds: number;
  within: number;
  since: number | null;
  event: Ref | null;
  term: number;
};

export class RightsStore implements StateStore {
  readonly name = "lore.rights";
  private readonly by = new Map<Ref, Rights>();
  dormant(): boolean {
    return this.by.size === 0;
  }
  get(realm: Ref): Rights | undefined {
    return this.by.get(realm);
  }
  of(realm: Ref): Rights {
    let r = this.by.get(realm);
    if (!r) this.by.set(realm, (r = { finds: 0, within: 0, since: null, event: null, term: 0 }));
    return r;
  }
  drop(realm: Ref): void {
    this.by.delete(realm);
  }
  realms(): Ref[] {
    return [...this.by.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const r of this.by.values()) if (r.event) out.push(r.event);
    return out;
  }
  hashInto(h: Hasher): void {
    const rs = this.realms();
    h.int(rs.length);
    for (const k of rs) h.string(k).value(this.by.get(k));
  }
  save(): unknown {
    return this.realms().map((k) => [k, this.by.get(k)]);
  }
  load(state: unknown): void {
    this.by.clear();
    for (const [k, r] of (state as [Ref, Rights][]) ?? []) this.by.set(k, { ...r });
  }
}

export function rightsOf(world: World): RightsStore | null {
  return world.peek<RightsStore>("lore.rights") ?? null;
}

/** Whether a realm grants now, and its term: null where it does not. */
export function grantOf(world: World, realm: Ref | null): Rights | null {
  if (!realm) return null;
  const r = rightsOf(world)?.get(realm);
  return r && r.since !== null ? r : null;
}

/** The lore's year tells what each land found or learned (lore.ts): a finding, or a learning from a land of its own realm. */
export function tallyLore(world: World, realm: Ref | null, found: boolean, within: boolean): void {
  const store = rightsOf(world);
  if (!store || !realm) return;
  const r = store.of(realm);
  if (found) r.finds += 1000;
  else if (within) r.within += 1000;
}

/** A realm's people's time preference, by its seat (rules/thrift.ts). */
function preferenceOf(ctx: PopulationContext, seat: number): number {
  const prov = ctx.provinces.get(seat);
  return timePreference(adultHazard(ctx.life), prov ? prov.leanest / 1000 : 1);
}

/** The year's grants: tallies faded, and each realm whose seat writes grants or lets its grants lapse as they pay it. */
export function rightsYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = rightsOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    lore = loreOf(world);
  for (const k of store.realms()) {
    const p = realms.get(k);
    if (!p || p.ended !== null) {
      store.drop(k);
      continue;
    }
    const r = store.of(k);
    r.finds = Math.round(r.finds * RIGHTS_FADE);
    r.within = Math.round(r.within * RIGHTS_FADE);
    const writes = lore.effect(p.seat, "writing") > 0,
      rho = preferenceOf(ctx, p.seat),
      pays = writes && grantsPay(r.finds, r.within, rho),
      lapses =
        r.since !== null && (!writes || r.within * GRANT_HOLD > 2 * r.finds * (grantPull(rho) - 1));
    if (r.since === null && pays) {
      r.since = year;
      r.term = grantTerm(rho);
      // (Its records are what a grant is written in: the writing its seat came to.)
      const wrote = lore.get(p.seat, "writing")?.event;
      r.event = world.events.emit({
        type: RIGHTS_EVENTS.granted.type,
        subjects: [p.ref],
        place: ctx.provinces.get(p.seat)?.ref ?? null,
        causes: wrote ? [{ ref: wrote, role: "enabler", weight: 1 }] : [],
        data: {
          realm: realmName(p),
          term: r.term,
          finds: Math.round(r.finds / 1000),
          within: Math.round(r.within / 1000),
        },
      });
    } else if (lapses) {
      world.events.emit({
        type: RIGHTS_EVENTS.lapsed.type,
        subjects: [p.ref],
        place: ctx.provinces.get(p.seat)?.ref ?? null,
        causes: r.event ? [{ ref: r.event, role: "trigger", weight: 1 }] : [],
        data: { realm: realmName(p), years: year - r.since! },
      });
      r.since = null;
      r.event = null;
      r.term = 0;
    }
  }
}

export function installRights(world: World, ctx: () => PopulationContext): RightsStore {
  const store = world.register(new RightsStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "157.lore.rights", every: YEAR, run: (t) => rightsYear(ctx(), t) });
  return store;
}
